// Smallest check that onset detection is sane. Run: bun onsets.test.js
const assert = require("assert");
const { makeOnsetDetector, BANDS } = require("./onsets.js");

function frameWith(band, value) {
  const data = new Uint8Array(1024);
  for (let i = band.lo; i < band.hi; i++) data[i] = value;
  return data;
}

const silence = new Uint8Array(1024);
const bass = BANDS[0];
const treble = BANDS[2];

// silence never fires
const detect = makeOnsetDetector();
for (let i = 0; i < 20; i++) {
  assert.strictEqual(detect(silence).length, 0, "silence fires no onsets");
}

// a bass spike after silence fires exactly one bass onset
let onsets = detect(frameWith(bass, 220));
assert.strictEqual(onsets.length, 1);
assert.strictEqual(onsets[0].band, "bass");
assert.ok(onsets[0].strength > 0 && onsets[0].strength <= 1);

// the very next identical frame is inside the cooldown: no retrigger
onsets = detect(frameWith(bass, 220));
assert.strictEqual(onsets.length, 0, "cooldown blocks immediate retrigger");

// a treble spike on a fresh detector fires treble, not bass
const detect2 = makeOnsetDetector();
for (let i = 0; i < 10; i++) detect2(silence);
onsets = detect2(frameWith(treble, 200));
assert.strictEqual(onsets.length, 1);
assert.strictEqual(onsets[0].band, "treble");

// the first frames never fire, even if loud (startup guard)
const detect3 = makeOnsetDetector();
assert.strictEqual(detect3(frameWith(bass, 220)).length, 0, "no onset before warmup");

console.log("onsets ok");
