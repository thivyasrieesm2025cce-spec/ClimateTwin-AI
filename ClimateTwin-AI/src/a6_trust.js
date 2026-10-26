/* ===== ClimateTwin AI - credibility helpers: data-type legend, calculation trace, formula-vs-ML table, example scenarios ===== */

function dataTypeLegend(full) {
  var items = [
    ['illus', 'Demonstration values: the PCCOE zone areas and baseline electricity. Not surveyed.'],
    ['calc', 'Results from documented formulas (curve-number runoff, surface-heat, energy, carbon). Every headline number in this app.'],
    ['model', 'Output of the trained neural network. Used only for fast plan screening and shown beside the formulas for comparison.'],
    ['real', 'Measured data from a reliable source. Today: Pune climate normals only. Campus measurements, NASA POWER, ERA5 and Landsat are future work.']
  ];
  return '<ul class="dtl' + (full ? ' full' : '') + '">' + items.map(function (i) { return '<li>' + badge(i[0]) + (full ? '<span>' + i[1] + '</span>' : '') + '</li>'; }).join('') + '</ul>';
}

function calcTraceCard(sim) {
  var S = sim.settings, t = sim.totals, C = CT.SETS.central, L = [];
  var trees = t.treesLawn + t.treesPaved;
  if (trees > 0) L.push(['Canopy', n0(trees) + ' trees × ' + nd(S.canopyPerTree, 0) + ' m² per tree = <b>' + n0(trees * S.canopyPerTree) + ' m²</b> of new canopy. Green cover rises only for trees planted in lawn; trees over paving add shade and lower surface temperature.']);
  if (t.depavePerm > 0) {
    var qi = CT.scsDepth(C.cn.pavedImp, S.stormMm), qp = CT.scsDepth(C.cn.pavedPerm, S.stormMm);
    L.push(['Permeable paving', n0(t.depavePerm) + ' m² changes from CN ' + C.cn.pavedImp + ' to CN ' + C.cn.pavedPerm + '. For a ' + S.stormMm + ' mm storm the SCS formula gives ' + nd(qi, 1) + ' mm → ' + nd(qp, 1) + ' mm runoff depth, about <b>' + n0(t.depavePerm * (qi - qp) / 1000) + ' m³</b> less per storm before zone averaging.']);
  }
  if (t.coolRoof > 0 || t.greenRoof > 0) L.push(['Roof savings', n0(t.coolRoof) + ' m² cool roof × ' + C.kCool + ' kWh/m²/yr + ' + n0(t.greenRoof) + ' m² green roof × ' + C.kGreen + ' kWh/m²/yr = <b>' + n0((t.coolRoof * C.kCool + t.greenRoof * C.kGreen) / 1000) + ' MWh/yr</b> (a zone is never cut by more than 40%).']);
  if (t.solarCanopy > 0) L.push(['Solar', n0(t.solarCanopy) + ' m² × ' + S.solarYield + ' kWh/m²/yr = <b>' + n0(t.solarCanopy * S.solarYield / 1000) + ' MWh/yr</b>.']);
  var b = sim.campus.base, p = sim.campus.prop;
  L.push(['Carbon', 'Net electricity = cooling − solar: ' + n0(b.netKwh / 1000) + ' → ' + n0(p.netKwh / 1000) + ' MWh/yr. × grid factor ' + S.gridEF + ' kg CO₂e/kWh = ' + n0(b.co2) + ' → <b>' + n0(p.co2) + ' t CO₂e/yr</b>. Tree carbon storage is not counted.']);
  return card('How these numbers were calculated <span class="badge b-calc">Calculated estimate</span>',
    '<ul class="plain trace">' + L.map(function (r) { return '<li><strong>' + r[0] + '.</strong> ' + r[1] + '</li>'; }).join('') + '</ul><p class="hint">Central assumption set shown. The conservative and optimistic sets give the ranges in the matrix below. All coefficients are listed in Data and Methodology and can be edited in Settings.</p>');
}

function mlCompareCard(sim) {
  var S = sim.settings, head = 'Calculated estimate versus ML model prediction';
  if (!MODEL) return card(head, '<p class="hint">No trained model is loaded.</p>');
  if (!surrogateValid()) {
    return card(head, '<p class="hint">The ML model is switched off for the current inputs (edited zone areas, changed settings, or climate outside ' + CT.CLIMATE_RANGE.ambientC.join('–') + ' °C / ' + CT.CLIMATE_RANGE.stormMm.join('–') + ' mm). Everything shown is a calculated estimate from the formulas. Retrain with <code>python3 ml/train_surrogate.py</code> to cover these inputs.</p>');
  }
  var pr = SUR.predict(MODEL, surFeatures(sim.totals, S)), o = sim.campus.prop;
  var rows = [['Surface temperature (°C)', o.surfTemp, pr.surfTemp, 2], ['Storm runoff (m³)', o.runoff, pr.runoff, 0], ['Net electricity (MWh/yr)', o.netKwh / 1000, pr.netKwh / 1000, 0], ['Irrigation (m³/yr)', o.irrig, pr.irrig, 0]].map(function (r) {
    var d = r[2] - r[1];
    return '<tr><th scope="row">' + r[0] + '</th><td class="num">' + nd(r[1], r[3]) + '</td><td class="num">' + nd(r[2], r[3]) + '</td><td class="num">' + sgn(d, r[3]) + ' (' + sgn(r[1] ? d / Math.abs(r[1]) * 100 : 0, 2) + '%)</td></tr>';
  }).join('');
  return card(head + ' <span class="badge b-model">Model prediction (ML)</span>',
    '<p class="hint">The headline numbers in this app are calculated estimates. The neural network below is a separate, trained model that imitates the formulas. Agreement shows the model learned the engine; it does not prove either one matches the real campus.</p>' +
    '<div class="tablewrap"><table class="tbl compact"><thead><tr><th scope="col">Indicator, proposed scenario</th><th scope="col" class="num">Calculated estimate</th><th scope="col" class="num">ML prediction</th><th scope="col" class="num">Difference</th></tr></thead><tbody>' + rows + '</tbody></table></div>');
}

/* Example scenarios A, B, C for the Scenario History demo */
var EXAMPLES = [
  { name: 'Scenario A: More Trees', desc: 'About 300 trees planted in open green ground across academic, hostel, garden and sports zones.', plan: { z1: { treesLawn: 60 }, z2: { treesLawn: 60 }, z4: { treesLawn: 80 }, z5: { treesLawn: 100 } } },
  { name: 'Scenario B: Green Parking', desc: 'Main parking lot: 5,000 m² of permeable paving and 60 shade trees along the bays.', plan: { z3: { depavePerm: 5000, treesPaved: 60 } } },
  { name: 'Scenario C: Trees + Green Parking', desc: 'Scenarios A and B together.', plan: { z1: { treesLawn: 60 }, z2: { treesLawn: 60 }, z4: { treesLawn: 80 }, z5: { treesLawn: 100 }, z3: { depavePerm: 5000, treesPaved: 60 } } }
];
function loadExamples() {
  var added = 0;
  EXAMPLES.slice().reverse().forEach(function (e) {
    if (state.saved.some(function (s) { return s.name === e.name; })) return;
    state.saved.unshift({ id: uid(), name: e.name, desc: e.desc, plan: JSON.parse(JSON.stringify(e.plan)), created: today() }); added++;
  });
  persistSaved();
  state.cmp = EXAMPLES.map(function (e) { var r = state.saved.filter(function (s) { return s.name === e.name; })[0]; return r && r.id; }).filter(Boolean);
  return added;
}
