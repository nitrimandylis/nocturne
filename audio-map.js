// Maps building rows to FFT frequency bands and measures their energy.
// Bottom rows get the bass, top rows get the treble, spaced logarithmically
// because musical energy piles up in the low bins.

// Returns one [loBin, hiBin) pair per row. Row 0 is the TOP of the building,
// so it gets the highest band; the last row gets the lowest.
function makeRowBands(rows, binCount) {
  const loBin = 2;               // skip DC and near-DC rumble
  const hiBin = Math.floor(binCount * 0.6); // above this is mostly hiss
  const bands = [];
  for (let i = 0; i < rows; i++) {
    // t runs 0..1 from bottom row to top row
    const t0 = (rows - 1 - i) / rows;
    const t1 = (rows - i) / rows;
    const lo = Math.floor(loBin * Math.pow(hiBin / loBin, t0));
    let hi = Math.floor(loBin * Math.pow(hiBin / loBin, t1));
    if (hi <= lo) hi = lo + 1;   // every band gets at least one bin
    bands.push([lo, hi]);
  }
  return bands;
}

// Average byte energy of one band, scaled to 0..1.
function bandEnergy(freqData, band) {
  let sum = 0;
  for (let i = band[0]; i < band[1]; i++) sum += freqData[i];
  return sum / (band[1] - band[0]) / 255;
}

if (typeof module !== "undefined") {
  module.exports = { makeRowBands, bandEnergy };
}
