// Nocturne — an apartment building that flashes with your music.
// Windows twinkle on musical onsets: bass = big bursts, mids = medium,
// hats = single sparkles. Dark between hits. Everything drawn in code.

// ---------- canvas setup ----------

const canvas = document.getElementById("scene");
const ctx = canvas.getContext("2d");
let W = 0, H = 0; // CSS pixel size

function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  buildScene();
}

// ---------- seeded randomness ----------

let seed = 1234;

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(rand, list) {
  return list[Math.floor(rand() * list.length)];
}

// ---------- rooms ----------

// Each room: a color temperature on the tungsten ramp, and at most one
// large silhouette shape. Stable per building seed, so the same apartment
// flashes the same way every time.
function makeRoom(rand) {
  return {
    temp: rand(),
    silhouette: pick(rand, ["none", "none", "none", "curtain", "plant", "figure"]),
    silSide: rand() < 0.5 ? 0 : 1, // which side the shape sits on
    silX: 0.25 + rand() * 0.5,
  };
}

// tungsten ramp: deep amber (temp 0) to warm white (temp 1)
function tungsten(temp) {
  const r = Math.round(255);
  const g = Math.round(166 + (244 - 166) * temp);
  const b = Math.round(77 + (228 - 77) * temp);
  return [r, g, b];
}

const TV_BLUE = [156, 196, 255];

// ---------- scene layout ----------

let building = null;
let bg = null;

function buildScene() {
  const rand = mulberry32(seed);

  const bw = Math.min(W * 0.42, 540);
  const groundY = H * 0.96;
  const bh = H * 0.84;
  const bx = (W - bw) / 2;
  const by = groundY - bh;

  const cols = Math.max(7, Math.min(12, Math.round(bw / 48)));
  const rows = Math.max(10, Math.min(20, Math.round(bh / 44)));
  const cellW = bw / cols;
  const cellH = bh / rows;

  const windows = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      windows.push({
        x: bx + c * cellW + cellW * 0.18,
        y: by + r * cellH + cellH * 0.16,
        w: cellW * 0.64,
        h: cellH * 0.66,
        room: makeRoom(rand),
        flash: null, // {start, dur, strength, blue} while flashing
      });
    }
  }

  building = { x: bx, y: by, w: bw, h: bh, cols, rows, cellW, cellH, groundY, windows };
  drawBackground(rand);
}

// ---------- background: flat poster shapes, drawn once per seed/resize ----------

function drawBackground(rand) {
  bg = document.createElement("canvas");
  bg.width = canvas.width;
  bg.height = canvas.height;
  const g = bg.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);

  const b = building;

  // sky: one very dark, very subtle vertical ramp
  const sky = g.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, "#030409");
  sky.addColorStop(1, "#0b0c16");
  g.fillStyle = sky;
  g.fillRect(0, 0, W, H);

  // sparse sharp stars
  for (let i = 0; i < 90; i++) {
    g.fillStyle = `rgba(215, 222, 245, ${0.2 + rand() * 0.4})`;
    g.fillRect(rand() * W, rand() * H * 0.5, 1, 1);
  }

  // small sharp moon, flat, no halo
  g.fillStyle = "#dde2f2";
  g.beginPath();
  g.arc(W * 0.82, H * 0.13, 11, 0, Math.PI * 2);
  g.fill();

  // hard-edged skyline, two flat depth layers, unlit
  drawSkyline(g, rand, b.groundY, 0.30, "#080a12");
  drawSkyline(g, rand, b.groundY, 0.48, "#0d0f1a");

  // main building: flat slab
  g.fillStyle = "#12100c";
  g.fillRect(b.x - 8, b.y - 6, b.w + 16, b.h + 6);

  // roofline: parapet, water tank, antenna mast
  g.fillStyle = "#0b0a07";
  g.fillRect(b.x - 12, b.y - 12, b.w + 24, 8);
  g.fillRect(b.x + b.w * 0.12, b.y - 34, 34, 24);
  g.fillRect(b.x + b.w * 0.12 + 4, b.y - 40, 26, 6);
  g.fillRect(b.x + b.w * 0.7, b.y - 52, 3, 42);

  // floor ledges: thin crisp lines
  g.fillStyle = "rgba(0, 0, 0, 0.4)";
  for (let r = 1; r < b.rows; r++) {
    g.fillRect(b.x - 8, b.y + r * b.cellH, b.w + 16, 1.5);
  }

  // dark window glass: static, windows only ever get brighter than this
  for (const win of b.windows) {
    g.fillStyle = "#06070c";
    g.fillRect(win.x, win.y, win.w, win.h);
    g.strokeStyle = "#04040a";
    g.lineWidth = 1.5;
    g.strokeRect(win.x, win.y, win.w, win.h);
  }

  // flat ground
  g.fillStyle = "#040507";
  g.fillRect(0, b.groundY, W, H - b.groundY);
}

function drawSkyline(g, rand, groundY, heightScale, color) {
  g.fillStyle = color;
  let x = -20;
  while (x < W + 20) {
    const bw = 30 + rand() * 80;
    const bh = H * heightScale * (0.35 + rand() * 0.65);
    g.fillRect(x, groundY - bh, bw, bh);
    x += bw + rand() * 14;
  }
}

// ---------- flash rendering ----------

// instant on, hold, then quick fall
function flashEnvelope(p) {
  if (p >= 1) return 0;
  if (p < 0.5) return 1;
  const q = (p - 0.5) / 0.5;
  return 1 - q * q;
}

function drawFlash(win, now) {
  const f = win.flash;
  const p = (now - f.start) / f.dur;
  if (p >= 1) { win.flash = null; return; }
  const bright = flashEnvelope(p) * (0.85 + f.strength * 0.15);

  const { x, y, w, h, room } = win;
  const [r, g, b] = f.blue ? TV_BLUE : tungsten(room.temp);
  ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${bright})`;
  ctx.fillRect(x, y, w, h);

  // whisper of spill: one tight, faint rim on the facade
  ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${bright * 0.07})`;
  ctx.fillRect(x - w * 0.18, y - w * 0.18, w * 1.36, h + w * 0.36);

  // at most one large dark shape, subliminal at this speed
  ctx.fillStyle = `rgba(4, 4, 8, ${bright * 0.9})`;
  if (room.silhouette === "curtain") {
    const cw = w * 0.28;
    ctx.fillRect(room.silSide === 0 ? x : x + w - cw, y, cw, h);
  } else if (room.silhouette === "plant") {
    const px = x + (room.silSide === 0 ? w * 0.24 : w * 0.76);
    ctx.fillRect(px - w * 0.08, y + h * 0.78, w * 0.16, h * 0.22);
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.ellipse(px + (i - 1.5) * w * 0.07, y + h * 0.62, w * 0.07, h * 0.2, (i - 1.5) * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (room.silhouette === "figure") {
    const px = x + w * room.silX;
    ctx.beginPath();
    ctx.arc(px, y + h * 0.38, w * 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(px - w * 0.17, y + h);
    ctx.quadraticCurveTo(px, y + h * 0.42, px + w * 0.17, y + h);
    ctx.fill();
  }

  // mullions: crisp dark cross over the lit glass
  ctx.fillStyle = `rgba(4, 4, 8, ${bright})`;
  ctx.fillRect(x + w / 2 - 0.75, y, 1.5, h);
  ctx.fillRect(x, y + h * 0.42, w, 1.5);
}

// ---------- spawning ----------

const BURST_COUNTS = {
  bass: (s) => Math.round(5 + s * 9),
  mid: (s) => Math.round(2 + s * 4),
  treble: () => 1,
};
const FLASH_DUR = { bass: 380, mid: 300, treble: 240 };

function spawnFlashes(onsets, now) {
  for (const onset of onsets) {
    const count = BURST_COUNTS[onset.band](onset.strength);
    const dark = building.windows.filter((w) => !w.flash);
    for (let i = 0; i < count && dark.length > 0; i++) {
      const idx = Math.floor(Math.random() * dark.length);
      const win = dark.splice(idx, 1)[0];
      win.flash = {
        start: now,
        dur: FLASH_DUR[onset.band] * (0.85 + Math.random() * 0.3),
        strength: onset.strength,
        blue: Math.random() < 1 / 30,
      };
    }
  }
}

// ---------- audio ----------

let audioCtx = null;
let analyser = null;
let freqData = null;
let audioEl = null;
let micStream = null;
let mode = "none"; // none | file | mic | system
let detectOnsets = null;
const simMode = new URLSearchParams(location.search).has("sim");

// system mode: the nocturne CLI serves this page and streams FFT bins over
// a WebSocket; we run the same onset detector on them, no AudioContext needed
const pendingOnsets = [];

function trySystemStream() {
  let ws;
  try { ws = new WebSocket(`ws://${location.host}/stream`); } catch { return; }
  let sysDetect = null;
  ws.onopen = () => {
    if (mode !== "none") return; // a file or mic is already active, leave it
    mode = "system";
    sysDetect = makeOnsetDetector();
    trackName.textContent = "System audio";
    showPlayer();
  };
  ws.onmessage = (ev) => {
    if (mode !== "system" || !sysDetect) return;
    const msg = JSON.parse(ev.data);
    if (msg.meta !== undefined) {
      trackName.textContent = msg.meta || "System audio";
      return;
    }
    if (!msg.b) return;
    const raw = atob(msg.b);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    pendingOnsets.push(...sysDetect(bytes));
  };
  // page not served by the CLI: the socket just fails and nothing changes
  ws.onerror = () => {};
}

function ensureAudioCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.5; // low smoothing keeps onsets sharp
    freqData = new Uint8Array(analyser.frequencyBinCount);
    detectOnsets = makeOnsetDetector();
  }
  if (audioCtx.state === "suspended") audioCtx.resume();
}

function playFile(file) {
  ensureAudioCtx();
  stopMic();
  if (!audioEl) {
    audioEl = new Audio();
    audioEl.crossOrigin = "anonymous";
    const src = audioCtx.createMediaElementSource(audioEl);
    src.connect(analyser);
    analyser.connect(audioCtx.destination);
    audioEl.addEventListener("play", updatePlayButton);
    audioEl.addEventListener("pause", updatePlayButton);
    audioEl.addEventListener("ended", updatePlayButton);
  }
  audioEl.src = URL.createObjectURL(file);
  audioEl.volume = volumeInput.value / 100;
  audioEl.play();
  mode = "file";
  trackName.textContent = file.name.replace(/\.[^.]+$/, "");
  showPlayer();
}

async function startMic() {
  ensureAudioCtx();
  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    alert("Microphone access was blocked.");
    return;
  }
  if (audioEl) audioEl.pause();
  const src = audioCtx.createMediaStreamSource(micStream);
  src.connect(analyser); // deliberately not connected to speakers: no feedback
  mode = "mic";
  trackName.textContent = "Microphone";
  showPlayer();
}

function stopMic() {
  if (micStream) {
    micStream.getTracks().forEach((tr) => tr.stop());
    micStream = null;
  }
}

// ---------- sim mode: fake 120bpm onsets for previewing without audio ----------

let lastSimT = 0;

function simOnsets(t) {
  const onsets = [];
  // bass on every beat (0.5s), mid on every second offbeat, treble scattered
  if (Math.floor(t / 0.5) > Math.floor(lastSimT / 0.5)) {
    onsets.push({ band: "bass", strength: 0.5 + 0.5 * Math.abs(Math.sin(t * 0.7)) });
  }
  if (Math.floor((t + 0.25) / 1.0) > Math.floor((lastSimT + 0.25) / 1.0)) {
    onsets.push({ band: "mid", strength: 0.6 });
  }
  if (Math.random() < 0.08) {
    onsets.push({ band: "treble", strength: 0.5 });
  }
  lastSimT = t;
  return onsets;
}

// ---------- main loop ----------

let startTime = performance.now();

function frame(now) {
  const t = (now - startTime) / 1000;
  const b = building;

  ctx.drawImage(bg, 0, 0, W, H);

  let onsets = [];
  if (simMode) {
    onsets = simOnsets(t);
  } else if (mode === "system") {
    onsets = pendingOnsets.splice(0, pendingOnsets.length);
  } else if (analyser && (mode === "mic" || (mode === "file" && !audioEl.paused))) {
    analyser.getByteFrequencyData(freqData);
    onsets = detectOnsets(freqData);
  }
  spawnFlashes(onsets, now);

  for (const w of b.windows) {
    if (w.flash) drawFlash(w, now);
  }

  // blinking antenna beacon
  const blink = Math.sin(t * 2.5) > 0.92 ? 0.9 : 0.12;
  ctx.fillStyle = `rgba(255, 60, 60, ${blink})`;
  ctx.beginPath();
  ctx.arc(b.x + b.w * 0.7 + 1.5, b.y - 54, 2.5, 0, Math.PI * 2);
  ctx.fill();

  updateTimeLabel();
  requestAnimationFrame(frame);
}

// ---------- UI wiring ----------

const landing = document.getElementById("landing");
const player = document.getElementById("player");
const dropHint = document.getElementById("drop-hint");
const playBtn = document.getElementById("play-btn");
const trackName = document.getElementById("track-name");
const liveDot = document.getElementById("live-dot");
const timeLabel = document.getElementById("time-label");
const seekInput = document.getElementById("seek");
const volumeInput = document.getElementById("volume");
const fileInput = document.getElementById("file-input");

function showPlayer() {
  landing.hidden = true;
  player.hidden = false;
  const noTransport = mode === "mic" || mode === "system"; // live sources have no seek/pause
  liveDot.hidden = !noTransport;
  timeLabel.hidden = noTransport;
  seekInput.hidden = noTransport;
  playBtn.hidden = noTransport;
  updatePlayButton();
  bumpChrome();
}

function updatePlayButton() {
  playBtn.textContent = audioEl && !audioEl.paused ? "❚❚" : "▶";
}

function fmtTime(s) {
  if (!isFinite(s)) return "0:00";
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

let seeking = false;

function updateTimeLabel() {
  if (mode !== "file" || !audioEl) return;
  timeLabel.textContent = `${fmtTime(audioEl.currentTime)} / ${fmtTime(audioEl.duration)}`;
  if (!seeking && audioEl.duration) {
    seekInput.value = Math.round((audioEl.currentTime / audioEl.duration) * 1000);
  }
}

document.getElementById("browse-btn").addEventListener("click", () => fileInput.click());
document.getElementById("mic-btn").addEventListener("click", startMic);
fileInput.addEventListener("change", () => {
  if (fileInput.files[0]) playFile(fileInput.files[0]);
});

playBtn.addEventListener("click", togglePlay);
function togglePlay() {
  if (mode !== "file" || !audioEl) return;
  if (audioEl.paused) audioEl.play();
  else audioEl.pause();
}

seekInput.addEventListener("input", () => { seeking = true; });
seekInput.addEventListener("change", () => {
  if (audioEl && audioEl.duration) {
    audioEl.currentTime = (seekInput.value / 1000) * audioEl.duration;
  }
  seeking = false;
});

volumeInput.addEventListener("input", () => {
  if (audioEl) audioEl.volume = volumeInput.value / 100;
});

document.getElementById("reseed-btn").addEventListener("click", reseed);
function reseed() {
  seed = Math.floor(Math.random() * 1e9);
  buildScene();
}

document.getElementById("fullscreen-btn").addEventListener("click", toggleFullscreen);
function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen();
}

// drag and drop anywhere
window.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropHint.hidden = false;
});
window.addEventListener("dragleave", (e) => {
  if (e.relatedTarget === null) dropHint.hidden = true;
});
window.addEventListener("drop", (e) => {
  e.preventDefault();
  dropHint.hidden = true;
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith("audio")) playFile(file);
});

// keyboard
window.addEventListener("keydown", (e) => {
  if (e.target.tagName === "INPUT") return;
  if (e.code === "Space") { e.preventDefault(); togglePlay(); }
  if (e.key === "ArrowRight" && audioEl) audioEl.currentTime += 5;
  if (e.key === "ArrowLeft" && audioEl) audioEl.currentTime -= 5;
  if (e.key === "f") toggleFullscreen();
  if (e.key === "r") reseed();
  bumpChrome();
});

// chrome auto-hide: fades out after 3s without mouse movement while playing
let chromeTimer = null;

function bumpChrome() {
  document.body.classList.remove("chrome-hidden");
  clearTimeout(chromeTimer);
  chromeTimer = setTimeout(() => {
    const playing = mode === "mic" || (audioEl && !audioEl.paused);
    if (playing) document.body.classList.add("chrome-hidden");
  }, 3000);
}
window.addEventListener("mousemove", bumpChrome);

// ---------- go ----------

window.addEventListener("resize", resizeCanvas);
resizeCanvas();
if (simMode) { landing.hidden = true; }
trySystemStream();
requestAnimationFrame(frame);
