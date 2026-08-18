// Tiered onset detection over three broad frequency bands.
// An onset = a band's energy this frame jumping well above its recent average.
// bass fires big window bursts, mid fires medium ones, treble fires single sparkles.

const BANDS = [
  { name: "bass", lo: 2, hi: 14, jump: 0.10, floor: 0.30, cooldown: 9 },
  { name: "mid", lo: 14, hi: 90, jump: 0.08, floor: 0.18, cooldown: 6 },
  { name: "treble", lo: 90, hi: 500, jump: 0.05, floor: 0.08, cooldown: 4 },
];

const HISTORY = 30; // ~half a second of frames

function bandEnergy(freqData, lo, hi) {
  let sum = 0;
  for (let i = lo; i < hi; i++) sum += freqData[i];
  return sum / (hi - lo) / 255;
}

// Returns an update function: feed it one FFT frame per animation frame,
// it returns the onsets that frame contains as [{band, strength}].
function makeOnsetDetector() {
  const history = BANDS.map(() => []);
  const cooldowns = BANDS.map(() => 0);

  return function update(freqData) {
    const onsets = [];
    for (let i = 0; i < BANDS.length; i++) {
      const band = BANDS[i];
      const e = bandEnergy(freqData, band.lo, band.hi);
      const h = history[i];
      const avg = h.length ? h.reduce((a, v) => a + v, 0) / h.length : 0;
      if (cooldowns[i] > 0) cooldowns[i]--;
      // h.length >= 5 keeps the very first frames from firing on startup noise
      if (h.length >= 5 && cooldowns[i] === 0 && e > band.floor && e - avg > band.jump) {
        cooldowns[i] = band.cooldown;
        const strength = Math.min(1, (e - avg - band.jump) / 0.25);
        onsets.push({ band: band.name, strength });
      }
      h.push(e);
      if (h.length > HISTORY) h.shift();
    }
    return onsets;
  };
}

if (typeof module !== "undefined") {
  module.exports = { makeOnsetDetector, bandEnergy, BANDS };
}
