import { test, expect } from "bun:test";
import { existsSync } from "node:fs";
import { makeOnsetDetector, BANDS } from "./web/onsets.js";
import { layoutScene, tungsten, flashEnvelope } from "./scene";

// ---------- onset detection ----------

function frameWith(band: { lo: number; hi: number }, value: number) {
  const data = new Uint8Array(1024);
  for (let i = band.lo; i < band.hi; i++) data[i] = value;
  return data;
}
const silence = new Uint8Array(1024);
const bass = BANDS[0];
const treble = BANDS[2];

test("silence never fires", () => {
  const detect = makeOnsetDetector();
  for (let i = 0; i < 20; i++) expect(detect(silence).length).toBe(0);
});

test("bass spike fires one bass onset, cooldown blocks the next", () => {
  const detect = makeOnsetDetector();
  for (let i = 0; i < 20; i++) detect(silence);
  const onsets = detect(frameWith(bass, 220));
  expect(onsets.length).toBe(1);
  expect(onsets[0].band).toBe("bass");
  expect(onsets[0].strength).toBeGreaterThan(0);
  expect(detect(frameWith(bass, 220)).length).toBe(0);
});

test("treble spike fires treble, not bass", () => {
  const detect = makeOnsetDetector();
  for (let i = 0; i < 10; i++) detect(silence);
  const onsets = detect(frameWith(treble, 200));
  expect(onsets.length).toBe(1);
  expect(onsets[0].band).toBe("treble");
});

test("no onset before warmup", () => {
  const detect = makeOnsetDetector();
  expect(detect(frameWith(bass, 220)).length).toBe(0);
});

// ---------- terminal scene layout ----------

test("layout fits the pixel canvas and is deterministic", () => {
  const a = layoutScene(120, 40, 42);
  const b = layoutScene(120, 40, 42);
  expect(a).toEqual(b);
  expect(a.width).toBe(120);
  expect(a.height).toBe(78); // (rows - 1) * 2
  expect(a.wins.length).toBeGreaterThan(20);
  for (const w of a.wins) {
    expect(w.x).toBeGreaterThanOrEqual(a.bx);
    expect(w.x + 2).toBeLessThanOrEqual(a.bx + a.bw);
    expect(w.y).toBeGreaterThanOrEqual(a.by);
    expect(w.y + 3).toBeLessThanOrEqual(a.by + a.bh);
  }
});

test("small terminal still yields a building, no environment", () => {
  const s = layoutScene(40, 14, 1);
  expect(s.wins.length).toBeGreaterThan(0);
  expect(s.moon).toBeNull();
  expect(s.skyline.length).toBe(0);
});

test("windows never overlap and ledges sit between floors", () => {
  const s = layoutScene(200, 50, 7);
  const cells = new Set<string>();
  for (const w of s.wins) {
    for (let dy = 0; dy < 3; dy++) {
      for (const x of [w.x, w.x + 1]) {
        const key = `${x},${w.y + dy}`;
        expect(cells.has(key)).toBe(false);
        cells.add(key);
      }
    }
  }
  for (const y of s.ledges) {
    for (const w of s.wins) {
      expect(y === w.y || y === w.y + 1 || y === w.y + 2).toBe(false); // never through glass
    }
  }
});

// ---------- color and envelope ----------

test("tungsten ramp stays warm and in range", () => {
  for (const temp of [0, 0.5, 1]) {
    const [r, g, b] = tungsten(temp);
    expect(r).toBe(255);
    expect(g).toBeGreaterThanOrEqual(166);
    expect(g).toBeLessThanOrEqual(244);
    expect(b).toBeGreaterThanOrEqual(77);
    expect(b).toBeLessThanOrEqual(228);
  }
});

test("flash envelope: on instantly, gone at the end", () => {
  expect(flashEnvelope(0)).toBe(1);
  expect(flashEnvelope(0.4)).toBe(1);
  expect(flashEnvelope(0.75)).toBeLessThan(1);
  expect(flashEnvelope(1)).toBe(0);
});

// ---------- helper lifecycle ----------

// The tap must exit on its own when nobody is reading it. Bun sets SIGPIPE to
// SIG_IGN and children inherit that, so a helper that does not check its writes
// survives its parent and holds the audio tap open forever. Needs the compiled
// helper, so it skips on a fresh clone and in CI.
const tapBinary = process.env.NOCTURNE_TAP ?? new URL("./helper/nocturne-tap", import.meta.url).pathname;

test.skipIf(!existsSync(tapBinary))("tap exits when its reader goes away", async () => {
  const tap = Bun.spawn([tapBinary], { stdout: "pipe", stderr: "ignore" });
  const reader = (tap.stdout as ReadableStream).getReader();
  await reader.read();   // first line means it started
  await reader.cancel(); // drop the read end, as a dying parent would
  const result = await Promise.race([tap.exited, Bun.sleep(5000).then(() => "orphaned")]);
  if (result === "orphaned") tap.kill();
  expect(result).not.toBe("orphaned");
});
