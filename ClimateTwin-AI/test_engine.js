const CT = require('./src/engine.js');
let fails = 0;
function ok(c, m){ if(!c){ fails++; console.log('FAIL', m);} else console.log('ok  ', m); }
const Z = CT.DEMO_ZONES;

// 1. demo zones are internally consistent (areas sum, positive)
Z.forEach(z => ok(CT.zoneTotal(z) > 0, 'zone '+z.id+' total '+CT.zoneTotal(z)));

// 2. empty plan => no change
let r0 = CT.simulate(Z, {}, {});
ok(Math.abs(r0.campus.prop.runoff - r0.campus.base.runoff) < 1e-9, 'empty plan: runoff unchanged');
ok(Math.abs(r0.campus.prop.surfTemp - r0.campus.base.surfTemp) < 1e-9, 'empty plan: temp unchanged');
ok(r0.cost.total === 0, 'empty plan: zero cost');
console.log('baseline', JSON.stringify({t:r0.campus.base.surfTemp.toFixed(2), runoff:Math.round(r0.campus.base.runoff), cool:Math.round(r0.campus.base.cooling), co2:r0.campus.base.co2.toFixed(0), green:r0.campus.base.greenPct.toFixed(1), imp:r0.campus.base.impPct.toFixed(1), irrig:Math.round(r0.campus.base.irrig)}));

// 3. SCS reference: CN 98 / P 75 => ~69.1 mm ; CN 74 => ~22.3
ok(Math.abs(CT.scsDepth(98,75)-69.1) < 0.2, 'SCS CN98 P75 = '+CT.scsDepth(98,75).toFixed(2));
ok(Math.abs(CT.scsDepth(74,75)-22.3) < 0.3, 'SCS CN74 P75 = '+CT.scsDepth(74,75).toFixed(2));
ok(CT.scsDepth(74, 5) === 0, 'SCS below initial abstraction = 0');

// 4. permeable paving in parking reduces runoff, temp
let r1 = CT.simulate(Z, {z3:{depavePerm:4000}}, {});
ok(r1.campus.prop.runoff < r1.campus.base.runoff, 'permeable paving reduces runoff: '+Math.round(r1.campus.base.runoff)+' -> '+Math.round(r1.campus.prop.runoff));
ok(r1.campus.prop.surfTemp < r1.campus.base.surfTemp, 'permeable paving reduces surface temp');
ok(r1.cost.total === 4000*1800, 'cost = qty x unit cost');

// 5. trees in paving reduce temp more than in lawn per tree (lawn->canopy only small change)
let rp = CT.simulate(Z, {z3:{treesPaved:30}}, {});
let rl = CT.simulate(Z, {z3:{treesLawn:30}}, {});
ok(rp.campus.prop.surfTemp < rl.campus.prop.surfTemp, 'paved-area trees cool more than lawn trees');

// 6. cool roof reduces cooling energy, green roof raises irrigation
let r2 = CT.simulate(Z, {z1:{coolRoof:6000}}, {});
ok(r2.campus.prop.cooling < r2.campus.base.cooling, 'cool roof reduces cooling kWh by '+Math.round(r2.campus.base.cooling-r2.campus.prop.cooling));
let r3 = CT.simulate(Z, {z1:{greenRoof:2000}}, {});
ok(r3.campus.prop.irrig > r3.campus.base.irrig, 'green roof raises irrigation demand (trade-off)');

// 7. solar canopy reduces net kWh and CO2
let r4 = CT.simulate(Z, {z3:{solarCanopy:3000}}, {});
ok(r4.campus.prop.solar === 3000*200, 'solar generation = area x yield');
ok(r4.campus.prop.co2 < r4.campus.base.co2, 'solar canopy reduces net CO2');

// 8. validation: impossible requests are clamped and reported
let r5 = CT.simulate(Z, {z3:{depavePerm:99999, treesLawn:9999, coolRoof:50000}}, {});
ok(r5.issues.length >= 3, 'impossible plan produces '+r5.issues.length+' issues');
ok(r5.plan.z3.depavePerm <= 13700, 'depave clamped to available paving');
Object.values(r5.zones).forEach(z => ok(z.prop.total > 0 && Math.abs(z.prop.total - z.base.total) < 1e-6, 'area conserved in '+z.id));

// 9. area conservation across mixed plan
let mixed = {z1:{treesPaved:20, depavePerm:2000, coolRoof:5000, greenRoof:1000, solarCanopy:0}, z3:{solarCanopy:3000, treesPaved:40, depavePerm:3000, depaveLawn:500, rwhTank:50}};
let r6 = CT.simulate(Z, mixed, {});
r6.zones.forEach(z => ok(Math.abs(z.prop.total - z.base.total) < 1e-6, 'mixed plan conserves area '+z.id));
console.log('mixed plan', {dT:(r6.campus.prop.surfTemp-r6.campus.base.surfTemp).toFixed(2), dRunoff:Math.round(r6.campus.prop.runoff-r6.campus.base.runoff), dCO2:(r6.campus.prop.co2-r6.campus.base.co2).toFixed(1), cost:r6.cost.total, payback:r6.payback&&r6.payback.toFixed(1), ranges:r6.ranges.surfTemp});
ok(r6.ranges.surfTemp.lo <= (r6.campus.prop.surfTemp-r6.campus.base.surfTemp)+1e-9 && r6.ranges.surfTemp.hi >= (r6.campus.prop.surfTemp-r6.campus.base.surfTemp)-1e-9, 'central delta inside range');

// 10. rainwater harvesting cuts runoff, offsets irrigation
let r7 = CT.simulate(Z, {z1:{rwhTank:100}}, {});
ok(r7.campus.prop.runoff < r7.campus.base.runoff, 'RWH cuts runoff by '+Math.round(r7.campus.base.runoff-r7.campus.prop.runoff)+' m3');

// 11. allocate: totals respected, plan feasible
const mt = CT.maxTotals(Z, {});
console.log('maxTotals', Object.fromEntries(Object.entries(mt).map(([k,v])=>[k,Math.round(v)])));
let totals = {}; Object.keys(mt).forEach(k => totals[k] = 0.5*mt[k]);
let plan = CT.allocate(Z, totals, {});
let rr = CT.simulate(Z, plan, {});
ok(rr.issues.length === 0, 'allocated plan has no validation issues ('+rr.issues.join('; ')+')');
const fv = CT.featureVector(Z, plan, {});
console.log('feature vector', fv.map(Math.round));

// 12. stateKey deterministic and sensitive
ok(CT.stateKey(Z,{}) === CT.stateKey(Z,{}), 'stateKey deterministic');
ok(CT.stateKey(Z,{}) === CT.stateKey(Z,{stormMm:90, ambientC:41}), 'stateKey ignores climate inputs (they are model features)');
ok(CT.stateKey(Z,{}) !== CT.stateKey(Z,{solarYield:150}), 'stateKey changes with a non-climate assumption');
const Z2 = JSON.parse(JSON.stringify(Z)); Z2[0].lawn += 100;
ok(CT.stateKey(Z,{}) !== CT.stateKey(Z2,{}), 'stateKey changes with baseline edit');

// 13. NaN / negative inputs are safe
let r8 = CT.simulate(Z, {z1:{treesLawn:NaN, depavePerm:-50, coolRoof:'abc'}}, {});
ok(isFinite(r8.campus.prop.runoff) && r8.cost.total === 0, 'bad numbers handled');

console.log(fails ? ('\n'+fails+' FAILED') : '\nALL PASSED');
process.exit(fails ? 1 : 0);
