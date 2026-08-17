// Nocturne — an apartment building that listens to your music.
// Every room is drawn in code. No images, no libraries.

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

// ---------- room generation ----------

// Warm domestic light colors, with a few rare cool ones.
const WALL_COLORS = [
  "#ffd9a0", "#ffd9a0", "#ffca82", "#ffca82", "#ffc06a", "#ffc06a",
  "#ffe0b8", "#ffb45e", "#ffb45e", "#f5d9b8", "#ffc9b0",
  "#cfe8c0", "#9fd8d0", "#e8b8c8", // rare cool accents
];
const PARTY_COLORS = ["#ff6a50", "#d080ff", "#ffd060", "#60c8b0"];

function makeRoom(rand) {
  const type = pick(rand, ["lamp", "lamp", "lamp", "lamp", "tv", "shelf", "plant", "bare", rand() < 0.5 ? "party" : "lamp"]);
  return {
    type,
    wall: type === "party" ? pick(rand, PARTY_COLORS) : pick(rand, WALL_COLORS),
    curtain: pick(rand, ["none", "none", "drapes", "blinds", "sheer"]),
    lampX: 0.15 + rand() * 0.7,     // where the light source sits, 0..1
    hasPlant: rand() < 0.3,
    hasCat: rand() < 0.08,
    hasPerson: rand() < 0.22,
    personX: 0.2 + rand() * 0.6,
    personSpeed: 0.1 + rand() * 0.3,
    flickerPhase: rand() * 100,
  };
}

// ---------- scene layout ----------

let building = null;  // main building geometry + windows
let bg = null;        // prerendered background canvas
let rowBands = [];

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
        row: r, col: c,
        x: bx + c * cellW + cellW * 0.18,
        y: by + r * cellH + cellH * 0.16,
        w: cellW * 0.64,
        h: cellH * 0.66,
        room: makeRoom(rand),
        gain: 0.7 + rand() * 0.6,     // how strongly this room reacts
        thresh: 0.22 + rand() * 0.45, // how loud it must get before waking
        brightness: 0,
        pulse: 0,
        target: 0,
        lit: false,
        ambient: false,
      });
    }
  }

  building = { x: bx, y: by, w: bw, h: bh, cols, rows, cellW, cellH, groundY, windows };
  rowBands = makeRowBands(rows, 1024);
  drawBackground(rand);
}

// ---------- background (drawn once per seed/resize) ----------

function drawBackground(rand) {
  bg = document.createElement("canvas");
  bg.width = canvas.width;
  bg.height = canvas.height;
  const g = bg.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);

  const b = building;

  // night sky
  const sky = g.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, "#04050c");
  sky.addColorStop(0.55, "#0a0d1c");
  sky.addColorStop(1, "#141222");
  g.fillStyle = sky;
  g.fillRect(0, 0, W, H);

  // stars
  for (let i = 0; i < 140; i++) {
    const x = rand() * W;
    const y = rand() * H * 0.55;
    g.fillStyle = `rgba(220, 228, 255, ${0.15 + rand() * 0.5})`;
    g.fillRect(x, y, rand() < 0.12 ? 1.5 : 1, 1);
  }

  // moon: hazy disc, no hard crescent
  const mx = W * 0.82, my = H * 0.14, mr = 18;
  const halo = g.createRadialGradient(mx, my, mr * 0.3, mx, my, mr * 5);
  halo.addColorStop(0, "rgba(225, 230, 250, 0.16)");
  halo.addColorStop(1, "rgba(225, 230, 250, 0)");
  g.fillStyle = halo;
  g.fillRect(mx - mr * 5, my - mr * 5, mr * 10, mr * 10);
  const moon = g.createRadialGradient(mx - mr * 0.3, my - mr * 0.3, 1, mx, my, mr);
  moon.addColorStop(0, "#f2f4fc");
  moon.addColorStop(0.8, "#c9d0e8");
  moon.addColorStop(1, "#9aa2c0");
  g.fillStyle = moon;
  g.beginPath();
  g.arc(mx, my, mr, 0, Math.PI * 2);
  g.fill();

  // distant skyline, two depth layers
  drawSkyline(g, rand, b.groundY, 0.30, "#0b0e19", 0.55);
  drawSkyline(g, rand, b.groundY, 0.48, "#101322", 0.75);

  // main building slab
  g.fillStyle = "#191510";
  g.fillRect(b.x - 8, b.y - 6, b.w + 16, b.h + 6);
  // subtle concrete texture
  for (let i = 0; i < 900; i++) {
    const x = b.x - 8 + rand() * (b.w + 16);
    const y = b.y - 6 + rand() * b.h;
    g.fillStyle = rand() < 0.5 ? "rgba(0,0,0,0.25)" : "rgba(255,240,220,0.03)";
    g.fillRect(x, y, 1.5, 1.5);
  }
  // faint vertical edges to give the slab form
  const edge = g.createLinearGradient(b.x - 8, 0, b.x + b.w + 8, 0);
  edge.addColorStop(0, "rgba(0,0,0,0.5)");
  edge.addColorStop(0.12, "rgba(0,0,0,0)");
  edge.addColorStop(0.88, "rgba(0,0,0,0)");
  edge.addColorStop(1, "rgba(0,0,0,0.5)");
  g.fillStyle = edge;
  g.fillRect(b.x - 8, b.y - 6, b.w + 16, b.h + 6);

  // roofline: parapet, water tank, antenna mast
  g.fillStyle = "#0e0c09";
  g.fillRect(b.x - 12, b.y - 12, b.w + 24, 8);
  g.fillStyle = "#131009";
  g.fillRect(b.x + b.w * 0.12, b.y - 34, 34, 24);            // water tank
  g.fillRect(b.x + b.w * 0.12 + 4, b.y - 40, 26, 6);         // tank lid
  g.fillRect(b.x + b.w * 0.7, b.y - 52, 3, 42);              // antenna

  // floor ledges
  g.fillStyle = "rgba(0,0,0,0.35)";
  for (let r = 1; r < b.rows; r++) {
    g.fillRect(b.x - 8, b.y + r * b.cellH, b.w + 16, 2);
  }

  // street glow at the base
  const street = g.createLinearGradient(0, b.groundY - 40, 0, H);
  street.addColorStop(0, "rgba(255, 160, 60, 0)");
  street.addColorStop(1, "rgba(255, 160, 60, 0.10)");
  g.fillStyle = street;
  g.fillRect(0, b.groundY - 40, W, H - b.groundY + 40);
  g.fillStyle = "#050408";
  g.fillRect(0, b.groundY, W, H - b.groundY);
}

function drawSkyline(g, rand, groundY, heightScale, color, litAlpha) {
  let x = -20;
  while (x < W + 20) {
    const bw = 30 + rand() * 80;
    const bh = H * heightScale * (0.35 + rand() * 0.65);
    g.fillStyle = color;
    g.fillRect(x, groundY - bh, bw, bh);
    // sparse dim windows on distant buildings
    const n = Math.floor(rand() * 6);
    for (let i = 0; i < n; i++) {
      g.fillStyle = `rgba(255, 190, 110, ${0.04 + rand() * 0.08 * litAlpha})`;
      g.fillRect(x + 4 + rand() * (bw - 10), groundY - bh + 6 + rand() * (bh - 12), 3, 4);
    }
    x += bw + rand() * 14;
  }
}

// ---------- window rendering ----------

function drawWindow(win, t) {
  const { x, y, w, h } = win;
  const b = Math.min(1, win.brightness + win.pulse);

  // dark glass base: always drawn, gives the grid its faint night sheen
  ctx.fillStyle = "#070810";
  ctx.fillRect(x, y, w, h);
  const sheen = ctx.createLinearGradient(x, y, x + w, y + h);
  sheen.addColorStop(0, "rgba(120, 150, 200, 0.035)");
  sheen.addColorStop(0.5, "rgba(120, 150, 200, 0)");
  sheen.addColorStop(1, "rgba(120, 150, 200, 0.02)");
  ctx.fillStyle = sheen;
  ctx.fillRect(x, y, w, h);

  if (b > 0.02) drawRoom(win, b, t);

  // frame and mullions on top of everything inside the glass
  ctx.strokeStyle = "#060504";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = "#0a0806";
  ctx.fillRect(x + w / 2 - 0.75, y, 1.5, h);
  ctx.fillRect(x, y + h * 0.42, w, 1.5);
  // sill
  ctx.fillStyle = "#0d0b08";
  ctx.fillRect(x - 2, y + h, w + 4, 2.5);
}

function drawRoom(win, b, t) {
  const { x, y, w, h, room } = win;
  const isTV = room.type === "tv";

  // flicker: TVs stutter, lamps breathe very slightly
  let flicker = 1;
  if (isTV) {
    flicker = 0.75 + 0.25 * Math.abs(Math.sin(t * 13 + room.flickerPhase) * Math.sin(t * 7.3));
  }

  const alpha = b * flicker;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();

  // room light: radial from the lamp (or screen) position
  const lx = x + w * (isTV ? 0.5 : room.lampX);
  const ly = y + h * (isTV ? 0.75 : 0.35);
  const light = ctx.createRadialGradient(lx, ly, 1, lx, ly, w * 1.4);
  const wall = isTV ? "#3a4a6a" : room.wall;
  light.addColorStop(0, tint(wall, 0.55));   // hot core near the lamp
  light.addColorStop(0.45, wall);
  light.addColorStop(1, shade(wall, 0.45));
  ctx.globalAlpha = alpha;
  ctx.fillStyle = light;
  ctx.fillRect(x, y, w, h);

  // furniture silhouettes
  ctx.fillStyle = "rgba(20, 12, 6, 0.75)";
  if (room.type === "shelf") {
    ctx.fillRect(x + w * 0.08, y + h * 0.25, w * 0.3, h * 0.65);
    ctx.fillStyle = wall;
    ctx.globalAlpha = alpha * 0.5;
    for (let i = 1; i < 4; i++) {
      ctx.fillRect(x + w * 0.1, y + h * (0.25 + i * 0.16), w * 0.26, 1.5);
    }
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "rgba(20, 12, 6, 0.75)";
  }
  if (room.type === "lamp") {
    // floor lamp: stem + shade near the light source
    const sx = lx, sy = y + h * 0.32;
    ctx.fillRect(sx - 1, sy + h * 0.1, 2, h * 0.55);
    ctx.beginPath();
    ctx.moveTo(sx - w * 0.09, sy + h * 0.12);
    ctx.lineTo(sx + w * 0.09, sy + h * 0.12);
    ctx.lineTo(sx + w * 0.06, sy - h * 0.02);
    ctx.lineTo(sx - w * 0.06, sy - h * 0.02);
    ctx.fill();
  }
  if (isTV) {
    // glowing screen
    ctx.fillStyle = `rgba(180, 210, 255, ${alpha * 0.9})`;
    ctx.fillRect(x + w * 0.3, y + h * 0.55, w * 0.4, h * 0.28);
    ctx.fillStyle = "rgba(20, 12, 6, 0.75)";
  }
  if (room.hasPlant || room.type === "plant") {
    const px = x + w * 0.82, py = y + h * 0.92;
    ctx.fillRect(px - w * 0.05, py - h * 0.08, w * 0.1, h * 0.08);
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.ellipse(px + (i - 1.5) * w * 0.035, py - h * 0.14, w * 0.035, h * 0.09, (i - 1.5) * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (room.hasCat) {
    // cat on the sill: body blob + ears
    const cx = x + w * 0.7, cy = y + h * 0.97;
    ctx.beginPath();
    ctx.ellipse(cx, cy - h * 0.05, w * 0.09, h * 0.05, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + w * 0.07, cy - h * 0.1, w * 0.04, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx + w * 0.045, cy - h * 0.12);
    ctx.lineTo(cx + w * 0.06, cy - h * 0.17);
    ctx.lineTo(cx + w * 0.08, cy - h * 0.12);
    ctx.fill();
  }
  if (room.hasPerson) {
    // a silhouette drifting around the room
    const px = x + w * (room.personX + Math.sin(t * room.personSpeed) * 0.18);
    ctx.beginPath();
    ctx.arc(px, y + h * 0.5, w * 0.07, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(px - w * 0.12, y + h);
    ctx.quadraticCurveTo(px, y + h * 0.5, px + w * 0.12, y + h);
    ctx.fill();
  }

  // curtains
  if (room.curtain === "drapes") {
    ctx.fillStyle = "rgba(15, 8, 4, 0.85)";
    wavyStrip(x, y, w * 0.18, h);
    wavyStrip(x + w * 0.82, y, w * 0.18, h);
  } else if (room.curtain === "blinds") {
    ctx.fillStyle = "rgba(10, 6, 3, 0.7)";
    for (let yy = y; yy < y + h * 0.55; yy += 4) ctx.fillRect(x, yy, w, 2);
  } else if (room.curtain === "sheer") {
    ctx.fillStyle = `rgba(255, 250, 240, ${alpha * 0.25})`;
    ctx.fillRect(x, y, w, h);
  }

  ctx.restore();

  // light spill onto the facade around the window
  const spill = ctx.createRadialGradient(x + w / 2, y + h / 2, w * 0.3, x + w / 2, y + h / 2, w * 1.4);
  spill.addColorStop(0, hexToRgba(wall, alpha * 0.13));
  spill.addColorStop(1, hexToRgba(wall, 0));
  ctx.fillStyle = spill;
  ctx.fillRect(x - w * 1.2, y - w * 1.2, w * 3.4, h + w * 2.4);
}

function wavyStrip(x, y, w, h) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w, y);
  for (let yy = y; yy <= y + h; yy += h / 6) {
    ctx.quadraticCurveTo(x + w * 1.3, yy + h / 12, x + w, yy + h / 6);
  }
  ctx.lineTo(x, y + h);
  ctx.fill();
}

// push a hex color toward white by factor (0 = unchanged, 1 = white)
function tint(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) + (255 - ((n >> 16) & 255)) * f);
  const g2 = Math.round(((n >> 8) & 255) + (255 - ((n >> 8) & 255)) * f);
  const b2 = Math.round((n & 255) + (255 - (n & 255)) * f);
  return `rgb(${r}, ${g2}, ${b2})`;
}

// darken a hex color by factor (0 = black, 1 = unchanged)
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * f);
  const g2 = Math.round(((n >> 8) & 255) * f);
  const b2 = Math.round((n & 255) * f);
  return `rgb(${r}, ${g2}, ${b2})`;
}

function hexToRgba(color, a) {
  if (color.startsWith("rgb")) return color.replace("rgb(", "rgba(").replace(")", `, ${a})`);
  const n = parseInt(color.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

// ---------- audio ----------

let audioCtx = null;
let analyser = null;
let freqData = null;
let audioEl = null;
let micStream = null;
let mode = "none"; // none | file | mic
const simMode = new URLSearchParams(location.search).has("sim");

function ensureAudioCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.75;
    freqData = new Uint8Array(analyser.frequencyBinCount);
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

// ---------- energy + beat tracking ----------

const bassHistory = [];
let beatCooldown = 0;

function currentRowEnergies(t) {
  const rows = building.rows;
  const energies = new Array(rows).fill(0);

  if (simMode) {
    // fake groove at 120bpm so the scene can be previewed with no audio
    const beat = Math.pow(Math.max(0, Math.sin(t * Math.PI * 4)), 6);
    for (let r = 0; r < rows; r++) {
      const depth = (rows - 1 - r) / rows; // 1 = bottom
      energies[r] = 0.08 + 0.6 * beat * depth * depth + 0.3 * Math.pow(Math.abs(Math.sin(t * 1.7 + r * 2.4)), 3);
    }
    return energies;
  }

  if (!analyser || mode === "none" || (mode === "file" && audioEl.paused)) return null;

  analyser.getByteFrequencyData(freqData);
  for (let r = 0; r < rows; r++) {
    energies[r] = bandEnergy(freqData, rowBands[r]);
  }
  return energies;
}

function detectBeat(energies) {
  // bass = bottom quarter of rows
  const rows = building.rows;
  let bass = 0;
  const q = Math.max(1, Math.floor(rows / 4));
  for (let r = rows - q; r < rows; r++) bass += energies[r];
  bass /= q;

  bassHistory.push(bass);
  if (bassHistory.length > 43) bassHistory.shift();
  const avg = bassHistory.reduce((a, v) => a + v, 0) / bassHistory.length;

  if (beatCooldown > 0) beatCooldown--;
  if (bass > avg * 1.35 && bass > 0.3 && beatCooldown === 0) {
    beatCooldown = 12;
    return true;
  }
  return false;
}

// ---------- ambient mode (before any audio starts) ----------

let lastAmbientFlip = 0;

function ambientUpdate(t) {
  const wins = building.windows;
  if (t - lastAmbientFlip > 2.2) {
    lastAmbientFlip = t;
    const w = wins[Math.floor(Math.random() * wins.length)];
    w.ambient = !w.ambient;
  }
  for (const w of wins) {
    w.target = w.ambient ? 0.8 + 0.08 * Math.sin(t + w.col) : 0;
  }
}

// ---------- main loop ----------

let startTime = performance.now();

function frame(now) {
  const t = (now - startTime) / 1000;
  const b = building;

  ctx.drawImage(bg, 0, 0, W, H);

  const energies = currentRowEnergies(t);
  if (energies) {
    if (detectBeat(energies)) {
      // a beat makes every lit room throb a little
      for (const w of b.windows) {
        if (w.lit) w.pulse = Math.max(w.pulse, 0.18);
      }
    }
    for (const w of b.windows) {
      const e = energies[w.row] * w.gain;
      // hysteresis: a room switches ON past its threshold and stays lit
      // until the energy really dies, so lit windows are always bright
      if (!w.lit && e > w.thresh) w.lit = true;
      if (w.lit && e < w.thresh * 0.35) w.lit = false;
      w.target = w.lit ? Math.min(1, 0.75 + e * 0.4) : 0;
    }
  } else {
    ambientUpdate(t);
  }

  for (const w of b.windows) {
    // fast attack, slow release: rooms snap on and fade off like real lights
    const k = w.target > w.brightness ? 0.3 : 0.045;
    w.brightness += (w.target - w.brightness) * k;
    w.pulse *= 0.92;
    drawWindow(w, t);
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
  const isMic = mode === "mic";
  liveDot.hidden = !isMic;
  timeLabel.hidden = isMic;
  seekInput.hidden = isMic;
  playBtn.hidden = isMic;
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
requestAnimationFrame(frame);
