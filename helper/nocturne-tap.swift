// nocturne-tap: taps macOS system audio (or one app's audio) via Core Audio
// process taps, runs an FFT, and prints frequency bins as newline JSON on
// stdout at ~60Hz: {"b":"<base64 of 1024 bytes>"}. The byte scaling mimics
// the Web Audio API's getByteFrequencyData (-100..-30 dB mapped to 0..255)
// so the same onset detector works on both sides.
//
// Build: swiftc -O helper/nocturne-tap.swift -o helper/nocturne-tap
// Needs macOS 14.4+. First run triggers the System Audio Recording prompt.

import Foundation
import CoreAudio
import AppKit
import Accelerate

func fail(_ message: String) -> Never {
    print("{\"err\":\"\(message)\"}")
    fflush(stdout)
    exit(1)
}

guard #available(macOS 14.4, *) else {
    fail("macOS 14.4 or newer is required for system audio taps")
}

// ---------- arguments ----------

var appName: String? = nil
var args = Array(CommandLine.arguments.dropFirst())
while !args.isEmpty {
    let a = args.removeFirst()
    if a == "--app" {
        guard !args.isEmpty else { fail("--app needs a name") }
        appName = args.removeFirst()
    } else {
        fail("unknown argument \(a)")
    }
}

// ---------- find the process to tap (for --app) ----------

func processObjectFor(pid: pid_t) -> AudioObjectID? {
    var address = AudioObjectPropertyAddress(
        mSelector: kAudioHardwarePropertyTranslatePIDToProcessObject,
        mScope: kAudioObjectPropertyScopeGlobal,
        mElement: kAudioObjectPropertyElementMain)
    var inputPID = pid
    var objectID = AudioObjectID(kAudioObjectUnknown)
    var size = UInt32(MemoryLayout<AudioObjectID>.size)
    let err = withUnsafeMutablePointer(to: &inputPID) { pidPtr in
        AudioObjectGetPropertyData(
            AudioObjectID(kAudioObjectSystemObject), &address,
            UInt32(MemoryLayout<pid_t>.size), pidPtr, &size, &objectID)
    }
    if err != noErr || objectID == kAudioObjectUnknown { return nil }
    return objectID
}

// ---------- create the tap ----------

let tapDescription: CATapDescription
if let appName {
    let running = NSWorkspace.shared.runningApplications
    guard let app = running.first(where: {
        ($0.localizedName ?? "").caseInsensitiveCompare(appName) == .orderedSame
    }) else {
        fail("no running app named \(appName)")
    }
    guard let processObject = processObjectFor(pid: app.processIdentifier) else {
        fail("could not resolve audio process for \(appName)")
    }
    tapDescription = CATapDescription(stereoMixdownOfProcesses: [processObject])
} else {
    // empty exclude list = tap everything the system plays
    tapDescription = CATapDescription(stereoGlobalTapButExcludeProcesses: [])
}
tapDescription.uuid = UUID()
tapDescription.muteBehavior = .unmuted
tapDescription.name = "nocturne-tap"
tapDescription.isPrivate = true

var tapID = AudioObjectID(kAudioObjectUnknown)
var err = AudioHardwareCreateProcessTap(tapDescription, &tapID)
guard err == noErr else {
    fail("could not create audio tap (error \(err)); check System Audio Recording permission in System Settings > Privacy & Security")
}

// ---------- wrap the tap in a private aggregate device ----------

func defaultOutputUID() -> String? {
    var address = AudioObjectPropertyAddress(
        mSelector: kAudioHardwarePropertyDefaultOutputDevice,
        mScope: kAudioObjectPropertyScopeGlobal,
        mElement: kAudioObjectPropertyElementMain)
    var deviceID = AudioObjectID(kAudioObjectUnknown)
    var size = UInt32(MemoryLayout<AudioObjectID>.size)
    guard AudioObjectGetPropertyData(AudioObjectID(kAudioObjectSystemObject), &address, 0, nil, &size, &deviceID) == noErr else { return nil }
    var uidAddress = AudioObjectPropertyAddress(
        mSelector: kAudioDevicePropertyDeviceUID,
        mScope: kAudioObjectPropertyScopeGlobal,
        mElement: kAudioObjectPropertyElementMain)
    var uid: CFString = "" as CFString
    size = UInt32(MemoryLayout<CFString>.size)
    guard AudioObjectGetPropertyData(deviceID, &uidAddress, 0, nil, &size, &uid) == noErr else { return nil }
    return uid as String
}

guard let outputUID = defaultOutputUID() else { fail("no default output device") }

let aggregateDescription: [String: Any] = [
    kAudioAggregateDeviceNameKey: "nocturne tap device",
    kAudioAggregateDeviceUIDKey: UUID().uuidString,
    kAudioAggregateDeviceMainSubDeviceKey: outputUID,
    kAudioAggregateDeviceIsPrivateKey: true,
    kAudioAggregateDeviceIsStackedKey: false,
    kAudioAggregateDeviceTapAutoStartKey: true,
    kAudioAggregateDeviceSubDeviceListKey: [[kAudioSubDeviceUIDKey: outputUID]],
    kAudioAggregateDeviceTapListKey: [[
        kAudioSubTapDriftCompensationKey: true,
        kAudioSubTapUIDKey: tapDescription.uuid.uuidString,
    ]],
]

var aggregateID = AudioObjectID(kAudioObjectUnknown)
err = AudioHardwareCreateAggregateDevice(aggregateDescription as CFDictionary, &aggregateID)
guard err == noErr else { fail("could not create aggregate device (error \(err))") }

// ---------- capture into a ring buffer ----------

let fftSize = 2048
let ringSize = 8192
var ring = [Float](repeating: 0, count: ringSize)
var ringWrite = 0
let ringLock = NSLock() // ponytail: a lock on the audio thread is impure but harmless at 60Hz reads

var ioProcID: AudioDeviceIOProcID? = nil
err = AudioDeviceCreateIOProcIDWithBlock(&ioProcID, aggregateID, nil) {
    _, inInputData, _, _, _ in
    let bufferList = UnsafeMutableAudioBufferListPointer(UnsafeMutablePointer(mutating: inInputData))
    guard let buffer = bufferList.first, let data = buffer.mData else { return }
    let channels = Int(buffer.mNumberChannels)
    let samples = data.bindMemory(to: Float.self, capacity: Int(buffer.mDataByteSize) / 4)
    let frameCount = Int(buffer.mDataByteSize) / 4 / max(channels, 1)
    ringLock.lock()
    for frame in 0..<frameCount {
        var mono: Float = 0
        for ch in 0..<channels { mono += samples[frame * channels + ch] }
        ring[ringWrite] = mono / Float(max(channels, 1))
        ringWrite = (ringWrite + 1) % ringSize
    }
    ringLock.unlock()
}
guard err == noErr, ioProcID != nil else { fail("could not create IO proc (error \(err))") }
guard AudioDeviceStart(aggregateID, ioProcID) == noErr else { fail("could not start capture") }

// ---------- FFT to Web-Audio-style bytes, 60 times a second ----------

guard let fftSetup = vDSP_create_fftsetup(vDSP_Length(log2(Float(fftSize))), FFTRadix(kFFTRadix2)) else {
    fail("could not create FFT setup")
}
var window = [Float](repeating: 0, count: fftSize)
vDSP_hann_window(&window, vDSP_Length(fftSize), Int32(vDSP_HANN_NORM))

var windowed = [Float](repeating: 0, count: fftSize)
var real = [Float](repeating: 0, count: fftSize / 2)
var imag = [Float](repeating: 0, count: fftSize / 2)
var magnitudes = [Float](repeating: 0, count: fftSize / 2)
var bytes = [UInt8](repeating: 0, count: fftSize / 2)

let minDb: Float = -100
let maxDb: Float = -30

setvbuf(stdout, nil, _IOLBF, 0)
print("{\"ok\":true}")

let timer = Timer(timeInterval: 1.0 / 60.0, repeats: true) { _ in
    // copy the newest fftSize samples out of the ring
    ringLock.lock()
    var start = ringWrite - fftSize
    if start < 0 { start += ringSize }
    for i in 0..<fftSize {
        windowed[i] = ring[(start + i) % ringSize] * window[i]
    }
    ringLock.unlock()

    windowed.withUnsafeBufferPointer { input in
        real.withUnsafeMutableBufferPointer { realPtr in
            imag.withUnsafeMutableBufferPointer { imagPtr in
                var split = DSPSplitComplex(realp: realPtr.baseAddress!, imagp: imagPtr.baseAddress!)
                input.baseAddress!.withMemoryRebound(to: DSPComplex.self, capacity: fftSize / 2) {
                    vDSP_ctoz($0, 2, &split, 1, vDSP_Length(fftSize / 2))
                }
                vDSP_fft_zrip(fftSetup, &split, 1, vDSP_Length(log2(Float(fftSize))), FFTDirection(FFT_FORWARD))
                vDSP_zvabs(&split, 1, &magnitudes, 1, vDSP_Length(fftSize / 2))
            }
        }
    }

    for i in 0..<(fftSize / 2) {
        // normalize (the /2 undoes vDSP's packed-FFT doubling), then to dB
        let amplitude = magnitudes[i] / Float(fftSize) / 2
        let db = 20 * log10(max(amplitude, 1e-10))
        let scaled = (db - minDb) / (maxDb - minDb)
        bytes[i] = UInt8(max(0, min(255, scaled * 255)))
    }
    let b64 = Data(bytes).base64EncodedString()
    print("{\"b\":\"\(b64)\"}")

    // Parent gone: our stdout pipe has no reader, so that write failed with EPIPE.
    // Normally SIGPIPE would kill us, but Bun sets SIGPIPE to SIG_IGN and children
    // inherit that, so print() swallows the error and we would spin at 60Hz forever
    // with the tap open, making the Mac look permanently "playing audio" (which
    // silently breaks AirPods auto-switching). Checked here because no parent-side
    // cleanup can cover a parent that was SIGKILLed.
    if ferror(stdout) != 0 { exit(0) }
}
RunLoop.main.add(timer, forMode: .common)
RunLoop.main.run()
