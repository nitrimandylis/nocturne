---
name: nocturne-cli
description: Drive the nocturne CLI — a terminal music visualizer that draws a night-time apartment building whose windows flash with whatever the Mac is playing, via a Core Audio system-audio tap. Use when the user wants a music visualizer in the terminal or browser, asks to visualize system audio, Apple Music, or Cider playback, mentions nocturne, or is debugging its audio tap or web mirror.
---

# nocturne CLI

Terminal music visualizer. `nocturne` fills the terminal with a night building
whose windows flash on musical onsets, tapping macOS system audio.

If the binary is not on PATH, run from the repo with `bun nocturne.ts`.

## The one thing to know

**nocturne is a fullscreen TUI that runs until the user quits it.** It needs a
real terminal and never exits on its own (except `--file`, which exits when
the track ends). Never run it from a tool call except `--help` — anything else
hangs. Hand the user the command to run instead.

Safe to run headless: `nocturne --help`. Nothing else.

## Commands to hand the user

- `nocturne` — visualize system audio (whatever is playing)
- `nocturne --app Music` — one app only (exact running-app name, e.g. Music, Cider)
- `nocturne --file track.mp3` — play a file and visualize it; exits when done
- `nocturne --web` — same, plus the browser version on localhost:4173, live-mirrored
- `nocturne --sim` — fake 120bpm groove, no audio needed (demo mode)
- Keys inside: `q` quit, `r` new building

## Things that will bite you

- First run needs the macOS System Audio Recording permission; the prompt is
  attributed to the terminal app (Ghostty/Terminal), not to nocturne. If every
  window stays dark while music plays, that permission is the first suspect:
  System Settings > Privacy & Security > Screen & System Audio Recording.
- Needs macOS 14.4+. The tap helper (`nocturne-tap`) prints a JSON error and
  exits on older systems.
- `--sim` cannot be combined with `--app` or `--file` (it replaces the tap).
- The web page at `--web` also works standalone (file drop + microphone), but
  the "System audio" source only exists while the CLI is serving it.
- There is no `--json` and no read commands; the tool only draws. Nothing to
  parse.
- `--app` matches the app's localized name case-insensitively but exactly:
  `--app music` works for Music.app, a partial like `--app mus` does not.
