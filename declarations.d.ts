// *.html is already declared by bun-types; adding our own wildcard for it
// collides (TS2309), so only .css and the .js files get declarations here.
declare module "*.css" { const text: string; export default text; }
declare module "*/app.js" { const text: string; export default text; }

declare module "*/onsets.js" {
  // default export is the file's text (assets.ts imports it with type: "text");
  // the named exports are the real module shape (nocturne.ts imports those)
  const text: string;
  export default text;
  export type Onset = { band: "bass" | "mid" | "treble"; strength: number };
  export function makeOnsetDetector(): (freqData: Uint8Array) => Onset[];
  export function bandEnergy(freqData: Uint8Array, lo: number, hi: number): number;
  export const BANDS: { name: string; lo: number; hi: number; jump: number; floor: number; cooldown: number }[];
}
