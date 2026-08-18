# Nocturne

An apartment building at night that plays your music. Drop an audio file (or use
the microphone) and the lit windows follow the song: bass lights the lower
floors, treble the upper ones, and every room is drawn procedurally in canvas,
no images.

Inspired by https://window-music-wave.replit.app/ ("Window Symphony"), rebuilt
from scratch to be better: that one composites ~40 baked JPG room photos and
toggles them randomly; this one generates rooms in code (lamps, TVs, plants,
cats, drifting silhouettes, curtains) and maps the building's floors to FFT
frequency bands, so the building visibly reads the song.

## How it works (v2, 2026-08-18)

- `index.html` + `style.css` + `app.js` + `onsets.js`. No dependencies, no
  build step. Serve the folder statically (`python3 -m http.server`) or open it
  on any static host.
- Windows twinkle on musical onsets: ~300ms crisp flashes, scattered anywhere.
  Tiered detection (`onsets.js`, tested by `onsets.test.js`, run with
  `bun onsets.test.js`): bass onset = big burst, mid = medium, treble = single
  sparkles. Full dark between hits and when idle. Deliberately NOT a spectrum:
  v1 mapped floors to frequency bands and read as cava bars; Nick killed it.
- Look: graphic poster, not photo. Tungsten palette (warm white to amber,
  ~1/30 flashes TV-blue), crisp glass with a whisper of spill, at most one
  large silhouette per window (curtain, plant, figure), flat facade, hard
  skyline, sharp moon.
- Seeded RNG per building: press `r` for a new building.
- `?sim=1` fires fake 120bpm onsets for previewing without audio.

## Controls

Drag-drop anywhere, Browse files, Use microphone. Space play/pause, arrows seek
5s, `f` fullscreen, `r` reseed. Chrome auto-hides after 3s while playing.

## Status / direction

v1 built 2026-08-17 (procedural room interiors, frequency-floor mapping);
v2 rebuilt the visualizer 2026-08-18 after a grill-me session. Local only, not
published. Known accepted tradeoff: ambient/onset-less music leaves the
building mostly dark; severity is the point. Possible next: a proper demo
track (needs a rights-free recording).
