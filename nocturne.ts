#!/usr/bin/env bun
// nocturne — an apartment building in your terminal that flashes with
// whatever your Mac is playing. System audio via the bundled Core Audio
// tap helper; --web mirrors the same data to the browser app.

import { parseArgs } from "node:util";
import onsetsSource from "./web/onsets.js" with { type: "text" };
import { WEB_FILES } from "./assets";
import { layoutScene, tungsten, flashEnvelope, TV_BLUE, type Scene } from "./scene";

// web/onsets.js is the one copy of the onset logic, embedded as text because
// it is also served to the browser. Importing it as a module AND as text
// collides in Bun's module graph, so we evaluate the text instead — the CLI
// runs literally the same file the browser gets.
type Onset = { band: "bass" | "mid" | "treble"; strength: number };
const onsetsModule = { exports: {} as { makeOnsetDetector: () => (freqData: Uint8Array) => Onset[] } };
new Function("module", onsetsSource)(onsetsModule);
const makeOnsetDetector = onsetsModule.exports.makeOnsetDetector;

const HELP = `nocturne — a building that flashes with your music

usage: nocturne [options]

options:
  --app <name>   tap one app's audio (e.g. --app Music) instead of the system mix
  --file <path>  play an audio file (via afplay) and visualize it
  --web          also serve the web app on localhost and open it, live-mirrored
  --port <n>     port for --web (default 4173)
  --sim          fake 120bpm onsets, no audio tap (demo / testing)
  --seed <n>     building seed (default random)
  -h, --help     show this help

keys: q quit · r new building

The audio tap needs macOS 14.4+ and the System Audio Recording permission
(you get the prompt on first run).`;

// ---------- arguments ----------

let values: {
  app?: string; file?: string; web?: boolean; port?: string;
  sim?: boolean; seed?: string; help?: boolean;
};
try {
  ({ values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      app: { type: "string" },
      file: { type: "string" },
      web: { type: "boolean" },
      port: { type: "string" },
      sim: { type: "boolean" },
      seed: { type: "string" },
      help: { type: "boolean", short: "h" },
    },
    strict: true,
  }));
} catch (err) {
  console.error((err as Error).message);
  console.error(`try: nocturne --help`);
  process.exit(1);
}

if (values.help) {
  console.log(HELP);
  process.exit(0);
}
if (values.sim && (values.app || values.file)) {
  console.error("--sim replaces the audio tap; it cannot be combined with --app or --file");
  process.exit(1);
}
if (!process.stdout.isTTY) {
  console.error("nocturne draws a TUI and needs a terminal (use --help for options)");
  process.exit(1);
}

const port = Number(values.port ?? 4173);
let seed = values.seed !== undefined ? Number(values.seed) : Math.floor(Math.random() * 1e9);

// ---------- state ----------

type Flash = { win: number; start: number; dur: number; strength: number; blue: boolean };

let scene: Scene = layoutScene(process.stdout.columns, process.stdout.rows, seed);
let flashes: Flash[] = [];
const detect = makeOnsetDetector();

const BURST_COUNTS: Record<string, (s: number) => number> = {
  bass: (s) => Math.round(5 + s * 9),
  mid: (s) => Math.round(2 + s * 4),
  treble: () => 1,
};
const FLASH_DUR: Record<string, number> = { bass: 380, mid: 300, treble: 240 };

function spawnFlashes(onsets: Onset[]) {
  const now = performance.now();
  for (const onset of onsets) {
    const busy = new Set(flashes.map((f) => f.win));
    const free = scene.wins.map((_, i) => i).filter((i) => !busy.has(i));
    const count = BURST_COUNTS[onset.band](onset.strength);
    for (let i = 0; i < count && free.length > 0; i++) {
      const pick = Math.floor(Math.random() * free.length);
      flashes.push({
        win: free.splice(pick, 1)[0],
        start: now,
        dur: FLASH_DUR[onset.band] * (0.85 + Math.random() * 0.3),
        strength: onset.strength,
        blue: Math.random() < 1 / 30,
      });
    }
  }
}

// ---------- audio sources ----------

let server: ReturnType<typeof Bun.serve> | null = null;
let tapProc: Bun.Subprocess | null = null;
let playerProc: Bun.Subprocess | null = null;

function handleBinsLine(line: string) {
  let msg: { b?: string; err?: string; ok?: boolean };
  try { msg = JSON.parse(line); } catch { return; }
  if (msg.err) die(`audio tap: ${msg.err}`);
  if (!msg.b) return;
  const bytes = new Uint8Array(Buffer.from(msg.b, "base64"));
  spawnFlashes(detect(bytes));
  server?.publish("bins", line);
}

function resolveTapBinary(): string {
  if (process.env.NOCTURNE_TAP) return process.env.NOCTURNE_TAP;
  const installed = Bun.which("nocturne-tap");
  if (installed) return installed;
  const local = new URL("./helper/nocturne-tap", import.meta.url).pathname;
  if (require("node:fs").existsSync(local)) return local;
  console.error("nocturne-tap helper not found.");
  console.error("build it: swiftc -O helper/nocturne-tap.swift -o helper/nocturne-tap");
  console.error("(or run `bun run compile` to install both binaries)");
  process.exit(1);
}

async function startTap() {
  const cmd = [resolveTapBinary()];
  if (values.app) cmd.push("--app", values.app);
  tapProc = Bun.spawn(cmd, { stdout: "pipe", stderr: "ignore" });
  const decoder = new TextDecoder();
  let pending = "";
  for await (const chunk of tapProc.stdout as ReadableStream<Uint8Array>) {
    pending += decoder.decode(chunk);
    const lines = pending.split("\n");
    pending = lines.pop() ?? "";
    for (const line of lines) if (line) handleBinsLine(line);
  }
  if (!quitting) die("audio tap exited unexpectedly");
}

// --sim: synthesize the same byte-bins the tap would emit, at 60Hz.
// Bass thump every 500ms, mid stab every 1s, scattered treble ticks.
function startSim() {
  const bins = new Uint8Array(1024);
  const t0 = performance.now();
  setInterval(() => {
    const t = (performance.now() - t0) / 1000;
    bins.fill(0);
    if (t % 0.5 < 0.12) bins.fill(220, 2, 14);
    if ((t + 0.25) % 1.0 < 0.1) bins.fill(160, 14, 90);
    if (Math.random() < 0.1) bins.fill(120, 90, 200);
    const line = JSON.stringify({ b: Buffer.from(bins).toBase64() });
    handleBinsLine(line);
  }, 16);
}

// ---------- terminal rendering ----------

const out = process.stdout;
const bg = (r: number, g: number, b: number) => `\x1b[48;2;${r};${g};${b}m`;

const SKY_TOP: [number, number, number] = [3, 4, 9];
const SKY_BOTTOM: [number, number, number] = [11, 12, 22];
const FACADE: [number, number, number] = [18, 16, 12];
const GLASS: [number, number, number] = [6, 7, 12];
const SKYLINE: [number, number, number] = [10, 12, 20];
const MOON: [number, number, number] = [221, 226, 242];
const STAR: [number, number, number] = [90, 96, 122];

let base: [number, number, number][][] = [];

function buildBase() {
  const cols = out.columns, rows = out.rows;
  base = [];
  for (let y = 0; y < rows; y++) {
    const t = y / Math.max(1, rows - 1);
    const sky: [number, number, number] = [
      Math.round(SKY_TOP[0] + (SKY_BOTTOM[0] - SKY_TOP[0]) * t),
      Math.round(SKY_TOP[1] + (SKY_BOTTOM[1] - SKY_TOP[1]) * t),
      Math.round(SKY_TOP[2] + (SKY_BOTTOM[2] - SKY_TOP[2]) * t),
    ];
    base.push(new Array(cols).fill(sky));
  }
  const paint = (x: number, y: number, w: number, h: number, c: [number, number, number]) => {
    for (let yy = y; yy < y + h; yy++) {
      if (yy < 0 || yy >= rows) continue;
      for (let xx = x; xx < x + w; xx++) {
        if (xx >= 0 && xx < cols) base[yy][xx] = c;
      }
    }
  };
  for (const s of scene.stars) paint(s.x, s.y, 1, 1, STAR);
  for (const r of scene.skyline) paint(r.x, r.y, r.w, r.h, SKYLINE);
  if (scene.moon) paint(scene.moon.x, scene.moon.y, scene.moon.w, scene.moon.h, MOON);
  paint(scene.bx, scene.by, scene.bw, scene.bh, FACADE);
  for (const w of scene.wins) paint(w.x, w.y, 2, 1, GLASS);
}

function render() {
  const cols = out.columns, rows = out.rows;
  const now = performance.now();

  // overlay = active flashes + beacon, everything else comes from base
  const overlay = new Map<number, [number, number, number]>();
  flashes = flashes.filter((f) => now - f.start < f.dur);
  for (const f of flashes) {
    const env = flashEnvelope((now - f.start) / f.dur) * (0.85 + f.strength * 0.15);
    const [r, g, b] = f.blue ? TV_BLUE : tungsten(scene.wins[f.win].temp);
    const c: [number, number, number] = [Math.round(r * env), Math.round(g * env), Math.round(b * env)];
    const w = scene.wins[f.win];
    overlay.set(w.y * cols + w.x, c);
    overlay.set(w.y * cols + w.x + 1, c);
  }
  if (scene.beacon) {
    const on = Math.sin(now / 400) > 0.92;
    overlay.set(scene.beacon.y * cols + scene.beacon.x, on ? [255, 60, 60] : [40, 14, 14]);
  }

  let frame = "\x1b[H";
  let last = "";
  for (let y = 0; y < rows - 1; y++) {
    for (let x = 0; x < cols; x++) {
      const c = overlay.get(y * cols + x) ?? base[y]?.[x] ?? SKY_TOP;
      const esc = bg(c[0], c[1], c[2]);
      if (esc !== last) { frame += esc; last = esc; }
      frame += " ";
    }
    if (y < rows - 2) { frame += "\x1b[0m\r\n"; last = ""; }
  }
  // status line
  const source = values.sim ? "sim" : values.app ? `app: ${values.app}` : values.file ? "file" : "system audio";
  const web = server ? ` · web: http://localhost:${server.port}` : "";
  frame += `\x1b[0m\r\n\x1b[2m ${source}${web} · q quit · r reseed\x1b[0m\x1b[K`;
  out.write(frame);
}

// ---------- lifecycle ----------

let quitting = false;

function die(message: string): never {
  cleanup();
  console.error(message);
  process.exit(1);
}

function cleanup() {
  quitting = true;
  tapProc?.kill();
  playerProc?.kill();
  out.write("\x1b[0m\x1b[?25h\x1b[?1049l"); // reset color, show cursor, leave alt screen
  if (process.stdin.isTTY) process.stdin.setRawMode(false);
}

function relayout() {
  scene = layoutScene(out.columns, out.rows, seed);
  flashes = [];
  buildBase();
  out.write("\x1b[2J");
}

function main() {
  out.write("\x1b[?1049h\x1b[?25l\x1b[2J"); // alt screen, hide cursor, clear
  buildBase();

  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.on("data", (key: Buffer) => {
    const k = key.toString();
    if (k === "q" || k === "\x03") { cleanup(); process.exit(0); }
    if (k === "r") { seed = Math.floor(Math.random() * 1e9); relayout(); }
  });
  process.on("SIGWINCH", relayout);
  process.on("SIGTERM", () => { cleanup(); process.exit(0); });

  if (values.web) {
    server = Bun.serve({
      port,
      fetch(req, srv) {
        const url = new URL(req.url);
        if (url.pathname === "/stream") {
          return srv.upgrade(req, { data: null }) ? undefined : new Response("upgrade failed", { status: 400 });
        }
        const file = WEB_FILES[url.pathname === "/" ? "/index.html" : url.pathname];
        if (!file) return new Response("not found", { status: 404 });
        return new Response(file.body, { headers: { "content-type": file.type } });
      },
      websocket: {
        open(ws) { ws.subscribe("bins"); },
        message() {},
      },
    });
    Bun.spawn(["open", `http://localhost:${server.port}`], { stdout: "ignore", stderr: "ignore" });
  }

  if (values.sim) {
    startSim();
  } else {
    startTap(); // async; feeds flashes as lines arrive
    if (values.file) {
      playerProc = Bun.spawn(["afplay", values.file], { stdout: "ignore", stderr: "ignore" });
      (playerProc.exited as Promise<number>).then(() => {
        if (!quitting) { cleanup(); process.exit(0); }
      });
    }
  }

  setInterval(render, 33); // ~30fps
}

main();
