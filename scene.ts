// Pure scene logic for the terminal renderer: layout, colors, envelopes.
// No I/O here so it can be unit tested.
//
// The scene lives in "pixel" space: one terminal cell is 1 pixel wide and
// 2 pixels tall (rendered with half-block characters), which makes pixels
// roughly square. A terminal of C x R cells gives a canvas of C x (R-1)*2
// pixels, with the last cell row reserved for the status line.

export type Win = { x: number; y: number; temp: number };
export type Rect = { x: number; y: number; w: number; h: number };
export type Scene = {
  width: number; height: number;            // pixel canvas size
  bx: number; by: number; bw: number; bh: number; // building rect in pixels
  wins: Win[];                               // windows, 2px wide x 3px tall
  ledges: number[];                          // y of each dark floor line
  skyline: Rect[];
  stars: { x: number; y: number; bright: boolean }[];
  moon: { cx: number; cy: number; r: number } | null;
  tank: Rect | null;                         // rooftop water tank
  mast: Rect | null;                         // antenna mast
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

// Windows are 2x3 px on a 4x5 pitch: 2px of facade between columns,
// 2px between floors, with a ledge line drawn under each floor.
export function layoutScene(termCols: number, termRows: number, seed: number): Scene {
  const rand = mulberry32(seed);
  const width = termCols;
  const height = Math.max(8, (termRows - 1) * 2);

  const groundY = height - 2;                       // 2px street band
  const bw = Math.max(14, Math.min(Math.floor(width * 0.48), 62));
  const bh = Math.max(10, Math.floor((groundY - 6) / 5) * 5 + 1);
  const bx = Math.floor((width - bw) / 2);
  const by = groundY - bh;

  const winCols = Math.floor((bw - 2) / 4);
  const winRows = Math.floor((bh - 2) / 5);
  const xPad = Math.floor((bw - winCols * 4 + 2) / 2); // center the grid
  const wins: Win[] = [];
  const ledges: number[] = [];
  for (let r = 0; r < winRows; r++) {
    const y = by + 2 + r * 5;
    for (let c = 0; c < winCols; c++) {
      wins.push({ x: bx + xPad + c * 4, y, temp: rand() });
    }
    if (r < winRows - 1) ledges.push(y + 4);
  }

  const skyline: Rect[] = [];
  if (width - bw >= 24) {
    for (const [from, to] of [[0, bx - 4], [bx + bw + 4, width]] as const) {
      let x = from;
      while (x < to) {
        const w = 5 + Math.floor(rand() * 9);
        const h = 6 + Math.floor(rand() * Math.max(6, bh * 0.5));
        skyline.push({ x, y: groundY - h, w: Math.min(w, to - x), h });
        x += w + 1 + Math.floor(rand() * 4);
      }
    }
  }

  const stars: { x: number; y: number; bright: boolean }[] = [];
  if (height >= 30) {
    for (let i = 0; i < Math.floor(width / 4); i++) {
      stars.push({
        x: Math.floor(rand() * width),
        y: Math.floor(rand() * Math.max(1, by - 4)),
        bright: rand() < 0.15,
      });
    }
  }

  const moon = width >= 70 && height >= 36
    ? { cx: Math.floor(width * 0.82), cy: 7, r: 3 }
    : null;

  // rooftop: parapet is drawn by the renderer at by-1; tank and mast sit on it
  const tank = bw >= 30
    ? { x: bx + Math.floor(bw * 0.12), y: by - 5, w: 7, h: 4 }
    : null;
  const mastX = bx + Math.floor(bw * 0.72);
  const mast = by >= 8 ? { x: mastX, y: by - 8, w: 1, h: 7 } : null;
  const beacon = mast ? { x: mastX, y: mast.y - 1 } : null;

  return { width, height, bx, by, bw, bh, wins, ledges, skyline, stars, moon, tank, mast, beacon };
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
