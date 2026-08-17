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

## How it works

- `index.html` + `style.css` + `app.js` + `audio-map.js`. No dependencies, no
  build step. Serve the folder statically (`python3 -m http.server`) or open it
  on any static host.
- Web Audio AnalyserNode → log-spaced frequency bands, one per floor
  (`audio-map.js`, tested by `audio-map.test.js`, run with `bun audio-map.test.js`).
- Rooms latch on with hysteresis (a lit window is always bright, energy decides
  how many are lit), fast attack / slow release envelopes, beat detection makes
  lit rooms throb.
- Seeded RNG per building: press `r` for a new building.
- `?sim=1` runs a fake 120bpm groove for previewing without audio.

## Controls

Drag-drop anywhere, Browse files, Use microphone. Space play/pause, arrows seek
5s, `f` fullscreen, `r` reseed. Chrome auto-hides after 3s while playing.

## Status / direction

Built 2026-08-17. Local only, not published. Possible next: rain/fog toggle,
a proper demo track (needs a rights-free recording), OffscreenCanvas perf pass
if window counts grow.
