// Realism checks: every claim is recomputed by hand, independently of the engine's internals.
const CT = require('./src/engine.js');
let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log(c ? 'ok  ' : 'FAIL', m); };
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const S = CT.withDefaults({}), C = CT.SETS.central, Z = CT.DEMO_ZONES;
const base = CT.simulate(Z, {}, S);
const z = id => Z.find(x => x.id === id);

// 1. Trees: canopy grows by trees x canopyPerTree, taken from lawn; total area conserved
{
  const zone = z('z4'), iv = { treesLawn: 30 };
  const n = CT.normalizeIv(zone, iv, S).iv, c = CT.applyIv(zone, n, S);
  ok(near(c.canopy - zone.canopy, 30 * S.canopyPerTree, 1e-9), '30 trees -> canopy +' + 30 * S.canopyPerTree + ' m2 (30 x ' + S.canopyPerTree + ')');
  ok(near(c.lawn, zone.lawn - 30 * S.canopyPerTree, 1e-9), 'trees in lawn use lawn area, not new area');
  ok(near(CT.zoneTotal(zone), Object.values(c).reduce((a, b) => a + b, 0), 1e-6), 'zone area conserved after planting');
  const r = CT.simulate(Z, { z4: iv }, S);
  ok(r.campus.prop.surfTemp < base.campus.base.surfTemp, 'trees lower surface temperature');
  ok(r.campus.prop.cooling === base.campus.base.cooling, 'trees do not change cooling kWh (no validated shading-of-buildings model)');
  const area = 30 * S.canopyPerTree, handIrrig = -area * (CT.KC.lawn - CT.KC.canopy) * S.et0 * S.irrigDays / 1000 / S.irrigEff;
  ok(near(r.campus.prop.irrig - base.campus.base.irrig, handIrrig, 1e-6), 'trees replacing lawn change irrigation by hand-calculated ' + handIrrig.toFixed(0) + ' m3/yr (turf Kc 0.8 -> canopy Kc 0.4)');
  const rp = CT.simulate(Z, { z3: { treesPaved: 30 } }, S);
  ok(rp.campus.prop.irrig > base.campus.base.irrig, 'trees over paving ADD irrigation demand (trade-off shown to user)');
  ok(r.campus.prop.co2 === base.campus.base.co2, 'trees do not claim carbon credit');
}
// 2. Permeable paving: single-zone runoff matches a hand SCS calculation
{
  const zone = z('z3'), A = 4000, n = CT.normalizeIv(zone, { depavePerm: A }, S).iv, cover = CT.applyIv(zone, n, S);
  const cons = CT.baseCover(zone), tot = CT.zoneTotal(zone);
  const cnOf = cv => CT.COVER_KEYS.reduce((a, k) => a + cv[k] * C.cn[k], 0) / tot;
  const q = cn => { const s = 25400 / cn - 254, ia = 0.2 * s, P = S.stormMm; return P > ia ? (P - ia) ** 2 / (P - ia + s) : 0; };
  const hand = (q(cnOf(cover)) - q(cnOf(cons))) / 1000 * tot;
  const r = CT.simulate(Z, { z3: { depavePerm: A } }, S);
  const zr = r.zones.find(x => x.id === 'z3'), eng = zr.prop.runoff - zr.base.runoff;
  ok(near(eng, hand, 0.01), 'permeable paving: engine runoff change ' + eng.toFixed(1) + ' m3 = hand SCS ' + hand.toFixed(1) + ' m3');
  ok(eng < 0 && Math.abs(eng) < tot * q(98) / 1000, 'runoff falls but never below zero');
  ok(CT.scsDepth(98, S.stormMm) > CT.scsDepth(80, S.stormMm), 'CN 98 sheds more than CN 80');
  const bigStorm = CT.simulate(Z, { z3: { depavePerm: A } }, Object.assign({}, S, { stormMm: 150 }));
  const small = CT.simulate(Z, { z3: { depavePerm: A } }, Object.assign({}, S, { stormMm: 30 }));
  ok(bigStorm.campus.base.runoff > small.campus.base.runoff, 'bigger design storm gives more runoff');
}
// 3. Cool roof: saving = area x kCool, capped at 40% of the zone baseline
{
  const zone = z('z1'), A = 5000, r = CT.simulate(Z, { z1: { coolRoof: A } }, S), zr = r.zones.find(x => x.id === 'z1');
  ok(near(zr.base.cooling - zr.prop.cooling, A * C.kCool, 1e-6), 'cool roof ' + A + ' m2 saves ' + A * C.kCool + ' kWh/yr (= area x ' + C.kCool + ')');
  const r2 = CT.simulate(Z, { z1: { coolRoof: 2 * A } }, S);
  ok(near(r2.campus.base.cooling - r2.campus.prop.cooling, 2 * A * C.kCool, 1e-6), 'doubling area doubles saving');
  const r0 = CT.simulate(Z, { z1: { coolRoof: 0 } }, S);
  ok(r0.campus.prop.cooling === r0.campus.base.cooling, 'zero area, zero saving');
  const tiny = CT.simulate([Object.assign({}, zone, { coolingKwh: 1000 })], { z1: { coolRoof: 10000 } }, S);
  ok(tiny.campus.prop.cooling >= 600 - 1e-6, 'saving capped: zone never cut by more than 40%');
}
// 4. Carbon: consistent with solar, electricity and emission factor
{
  const A = 3000, r = CT.simulate(Z, { z3: { solarCanopy: A }, z1: { coolRoof: 4000 } }, S), b = r.campus.base, p = r.campus.prop;
  ok(near(p.solar, A * S.solarYield * C.solarMul, 1e-6), 'solar kWh = area x ' + S.solarYield + ' x multiplier');
  ok(near(p.netKwh, p.cooling - p.solar, 1e-6), 'net kWh = cooling - solar');
  ok(near(p.co2, p.netKwh * S.gridEF / 1000, 1e-9), 'CO2 t = net kWh x grid factor ' + S.gridEF + ' / 1000');
  ok(near(p.co2 - b.co2, ((p.cooling - b.cooling) - p.solar) * S.gridEF / 1000, 1e-9), 'CO2 change = (cooling change - solar) x factor');
  const hi = CT.simulate(Z, { z3: { solarCanopy: A } }, Object.assign({}, S, { gridEF: 1.0 }));
  ok(Math.abs(hi.campus.prop.co2 - hi.campus.base.co2) > Math.abs(r.campus.prop.co2 * 0 + (CT.simulate(Z, { z3: { solarCanopy: A } }, S).campus.prop.co2 - CT.simulate(Z, { z3: { solarCanopy: A } }, S).campus.base.co2)), 'higher grid factor, larger CO2 change');
}
// 5. Physical limits and honest ranges
{
  const r = CT.simulate(Z, { z3: { depavePerm: 1e9, treesPaved: 1e9, solarCanopy: 1e9 } }, S);
  ok(r.issues.length > 0, 'impossible request is clamped and reported (' + r.issues.length + ' messages)');
  Z.forEach(zz => { const c = CT.applyIv(zz, r.plan[zz.id], S); ok(CT.COVER_KEYS.every(k => c[k] >= -1e-9) && near(CT.zoneTotal(zz), Object.values(c).reduce((a, b) => a + b, 0), 1e-6), 'no negative area, area conserved in ' + zz.name); });
  const m = CT.simulate(Z, { z3: { depavePerm: 3000, treesPaved: 40 } }, S);
  ok(m.ranges.surfTemp.lo <= m.campus.prop.surfTemp - m.campus.base.surfTemp + 1e-9 && m.ranges.surfTemp.hi >= m.campus.prop.surfTemp - m.campus.base.surfTemp - 1e-9, 'central estimate lies inside the conservative-optimistic range');
}
console.log(fails ? 'FAILED ' + fails : 'ALL PASSED'); process.exit(fails ? 1 : 0);
