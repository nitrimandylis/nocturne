// Smallest check that the row-to-frequency mapping is sane. Run: bun audio-map.test.js
const assert = require("assert");
const { makeRowBands, bandEnergy } = require("./audio-map.js");

const rows = 18, bins = 1024;
const bands = makeRowBands(rows, bins);

assert.strictEqual(bands.length, rows);
for (const [lo, hi] of bands) {
  assert.ok(lo >= 2 && hi <= bins, "band inside valid bin range");
  assert.ok(hi > lo, "band is non-empty");
}
// row 0 is the top of the building: it must sit higher in frequency than the bottom row
assert.ok(bands[0][0] > bands[rows - 1][0], "top row maps to higher frequencies");

// energy: silence is 0, full-scale is 1
const silent = new Uint8Array(bins);
const loud = new Uint8Array(bins).fill(255);
assert.strictEqual(bandEnergy(silent, bands[0]), 0);
assert.strictEqual(bandEnergy(loud, bands[0]), 1);

console.log("audio-map ok");
