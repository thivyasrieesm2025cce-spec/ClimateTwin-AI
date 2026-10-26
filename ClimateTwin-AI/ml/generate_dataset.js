// Generates the training set for the surrogate model by running the physics-based engine
// on randomly sampled campus plans. Usage: node ml/generate_dataset.js [N] [outfile]
const fs = require('fs');
const path = require('path');
const CT = require('../src/engine.js');

const N = +(process.argv[2] || 30000);
const out = process.argv[3] || path.join(__dirname, '..', 'data', 'surrogate_dataset.csv');

function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const rnd = mulberry32(20261021);

const zones = CT.DEMO_ZONES;
const S = CT.DEFAULT_SETTINGS;
const maxT = CT.maxTotals(zones, S);
const base = CT.simulate(zones, {}, S).campus.base;

const header = CT.FEATURES.concat(CT.CLIMATE_FEATURES).concat(['surfTemp', 'runoff', 'netKwh', 'irrig']);
const lines = [header.join(',')];
for (let i = 0; i < N; i++) {
  const totals = {};
  CT.FEATURES.forEach(k => {
    totals[k] = rnd() < 0.3 ? 0 : rnd() * maxT[k];
  });
  const R = CT.CLIMATE_RANGE;
  const Sx = Object.assign({}, S, { ambientC: R.ambientC[0] + rnd() * (R.ambientC[1] - R.ambientC[0]), stormMm: R.stormMm[0] + rnd() * (R.stormMm[1] - R.stormMm[0]) });
  const plan = CT.allocate(zones, totals, Sx);
  const r = CT.simulate(zones, plan, Sx);
  const f = CT.FEATURES.map(k => r.totals[k]).concat([Sx.ambientC, Sx.stormMm]);
  const p = r.campus.prop;
  lines.push(f.concat([p.surfTemp, p.runoff, p.netKwh, p.irrig]).map(v => +v.toFixed(5)).join(','));
}
fs.writeFileSync(out, lines.join('\n'));
console.log('wrote', N, 'rows to', out);
console.log('state key', CT.stateKey(zones, S));
console.log('baseline', JSON.stringify({ surfTemp: base.surfTemp, runoff: base.runoff, netKwh: base.netKwh, irrig: base.irrig, co2: base.co2 }));
fs.writeFileSync(path.join(__dirname, '..', 'data', 'surrogate_meta.json'), JSON.stringify({
  stateKey: CT.stateKey(zones, S),
  baseline: { surfTemp: base.surfTemp, runoff: base.runoff, netKwh: base.netKwh, irrig: base.irrig, co2: base.co2 },
  maxTotals: maxT
}, null, 1));
