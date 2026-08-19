// Pure scene logic for the terminal renderer: layout, colors, envelopes.
// No I/O here so it can be unit tested.

export type Win = { x: number; y: number; temp: number };
export type Rect = { x: number; y: number; w: number; h: number };
export type Scene = {
  bx: number; by: number; bw: number; bh: number; // building rect in cells
  wins: Win[];
  skyline: Rect[];
  stars: { x: number; y: number }[];
  moon: Rect | null;
  beacon: { x: number; y: number } | null;
};

export function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Terminal cells: windows are 2 cells wide, 1 tall, on a 3x2 pitch so facade
// shows between them. Skyline/moon/stars appear only when the terminal has room.
export function layoutScene(termCols: number, termRows: number, seed: number): Scene {
  const rand = mulberry32(seed);

  const statusRows = 1;
  const bw = Math.max(13, Math.min(Math.floor(termCols * 0.5), 61));
  const bh = Math.max(6, termRows - 4 - statusRows);
  const bx = Math.floor((termCols - bw) / 2);
  const by = termRows - statusRows - 1 - bh;

  const winCols = Math.floor((bw - 1) / 3);
  const winRows = Math.floor((bh - 1) / 2);
  const wins: Win[] = [];
  for (let r = 0; r < winRows; r++) {
    for (let c = 0; c < winCols; c++) {
      wins.push({
        x: bx + 2 + c * 3,
        y: by + 1 + r * 2,
        temp: rand(),
      });
    }
  }

  const skyline: Rect[] = [];
  if (termCols - bw >= 24) {
    for (const [from, to] of [[0, bx - 3], [bx + bw + 3, termCols]] as const) {
      let x = from;
      while (x < to) {
        const w = 4 + Math.floor(rand() * 8);
        const h = 3 + Math.floor(rand() * Math.max(3, bh * 0.45));
        skyline.push({ x, y: termRows - statusRows - 1 - h, w: Math.min(w, to - x), h });
        x += w + 1 + Math.floor(rand() * 3);
      }
    }
  }

  const stars: { x: number; y: number }[] = [];
  if (termRows >= 18) {
    for (let i = 0; i < Math.floor(termCols / 6); i++) {
      stars.push({ x: Math.floor(rand() * termCols), y: Math.floor(rand() * Math.max(1, by - 1)) });
    }
  }

  const moon = termCols >= 70 && termRows >= 20
    ? { x: Math.floor(termCols * 0.82), y: 2, w: 4, h: 2 }
    : null;

  const beacon = by >= 2 ? { x: bx + Math.floor(bw * 0.7), y: by - 1 } : null;

  return { bx, by, bw, bh, wins, skyline, stars, moon, beacon };
}

// tungsten ramp: deep amber (temp 0) to warm white (temp 1), same as the web app
export function tungsten(temp: number): [number, number, number] {
  return [255, Math.round(166 + 78 * temp), Math.round(77 + 151 * temp)];
}

export const TV_BLUE: [number, number, number] = [156, 196, 255];

// instant on, hold, then quick fall — same shape as the web app
export function flashEnvelope(p: number): number {
  if (p >= 1 || p < 0) return 0;
  if (p < 0.5) return 1;
  const q = (p - 0.5) / 0.5;
  return 1 - q * q;
}
