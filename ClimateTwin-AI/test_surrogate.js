const fs = require('fs');
const S = require('./src/surrogate.js');
const CT = require('./src/engine.js');
const model = JSON.parse(fs.readFileSync('data/surrogate_model.json'));
const par = JSON.parse(fs.readFileSync('data/surrogate_parity.json'));
let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log(c ? 'ok  ' : 'FAIL', m); };
// 1. JS inference equals sklearn predict
let maxRel = 0;
par.X.forEach((x, i) => { const p = S.predict(model, x); model.targets.forEach((t, j) => { const ref = par.P[i][j]; maxRel = Math.max(maxRel, Math.abs(p[t] - ref) / Math.max(1, Math.abs(ref))); }); });
ok(maxRel < 1e-3, 'JS inference matches sklearn within weight-rounding tolerance (max rel diff ' + maxRel.toExponential(2) + ')');
ok(model.features.length === 10 && model.features.includes('ambientC') && model.features.includes('stormMm'), 'model uses climate inputs as features');
// 2. fresh plans + fresh climate never seen in training: surrogate vs engine
const Z = CT.DEMO_ZONES, St0 = CT.DEFAULT_SETTINGS, mt = CT.maxTotals(Z, St0), R = CT.CLIMATE_RANGE;
function rng(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const r = rng(777), mape = {surfTemp:0,runoff:0,netKwh:0,irrig:0}, N = 500;
for (let i = 0; i < N; i++) {
  const St = Object.assign({}, St0, { ambientC: R.ambientC[0] + r()*(R.ambientC[1]-R.ambientC[0]), stormMm: R.stormMm[0] + r()*(R.stormMm[1]-R.stormMm[0]) });
  const tot = {}; CT.FEATURES.forEach(k => tot[k] = r() < 0.3 ? 0 : r() * mt[k]);
  const plan = CT.allocate(Z, tot, St), sim = CT.simulate(Z, plan, St), o = sim.campus.prop;
  const p = S.predict(model, CT.FEATURES.map(k => sim.totals[k]).concat([St.ambientC, St.stormMm]));
  Object.keys(mape).forEach(k => mape[k] += Math.abs(p[k] - o[k]) / Math.abs(o[k]) / N * 100);
}
Object.keys(mape).forEach(k => ok(mape[k] < 2, 'fresh plans + fresh climate: ' + k + ' mean error ' + mape[k].toFixed(3) + '%'));
// 3. climate sensitivity: hotter day must raise predicted surface temp, bigger storm must raise runoff
const base = CT.FEATURES.map(k => mt[k] * 0.3);
const cool = S.predict(model, base.concat([32, 60])), hot = S.predict(model, base.concat([42, 60])), wet = S.predict(model, base.concat([32, 120]));
ok(hot.surfTemp > cool.surfTemp + 5, 'model: +10 C air raises predicted surface temp (' + cool.surfTemp.toFixed(1) + ' -> ' + hot.surfTemp.toFixed(1) + ')');
ok(wet.runoff > cool.runoff * 1.5, 'model: bigger storm raises predicted runoff (' + Math.round(cool.runoff) + ' -> ' + Math.round(wet.runoff) + ')');
ok(CT.stateKey(Z, St0) === model.stateKey, 'state key matches the baseline the model was trained for');
ok(CT.stateKey(Z, Object.assign({}, St0, { ambientC: 41, stormMm: 90 })) === model.stateKey, 'changing climate inputs does not invalidate the model');
console.log(fails ? 'FAILED ' + fails : 'ALL PASSED'); process.exit(fails ? 1 : 0);
