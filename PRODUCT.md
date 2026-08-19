# Nocturne

An apartment building at night that flashes with your music, as a terminal CLI
and a web page. The CLI taps macOS system audio directly (Core Audio process
taps via the bundled Swift helper, no BlackHole), so it visualizes whatever
the Mac is playing; `--web` serves the browser version on localhost and
live-mirrors the same stream to it.

Inspired by https://window-music-wave.replit.app/ ("Window Symphony"), rebuilt
from scratch to be better: that one composites ~40 baked JPG room photos and
toggles them randomly; this one generates rooms in code (lamps, TVs, plants,
cats, drifting silhouettes, curtains) and maps the building's floors to FFT
frequency bands, so the building visibly reads the song.

## How it works

**CLI (v3, 2026-08-19):** `nocturne.ts` (Bun, compiled to `~/.bun/bin/nocturne`
by `bun run compile`) + `scene.ts` (pure layout, tested) + `assets.ts` (web
files embedded in the binary) + `helper/nocturne-tap.swift` (Core Audio process
tap, FFT via Accelerate, emits Web-Audio-style byte bins as JSON lines at 60Hz,
installed as `nocturne-tap`). Sources: system mix (default), `--app <name>`,
`--file <path>` (afplay), `--sim`. `--web` serves the embedded web app and
broadcasts the bins over `/stream`. Zero runtime dependencies. Needs macOS
14.4+ and the System Audio Recording permission (prompt attributed to the
terminal app). Man page in `man/`, agent skill in `nocturne-cli/`.

**Web (v2, 2026-08-18):** `web/` — `index.html` + `style.css` + `app.js` +
`onsets.js`. No dependencies, no build step. Works standalone (file drop, mic)
served statically, and gains a "System audio" source when served by the CLI.
`web/onsets.js` is the single copy of the onset logic: the browser loads it as
a script, the CLI embeds the same text and evaluates it.
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
