/* ===== ClimateTwin AI - app core: utilities, state, persistence, presets, analysis ===== */
var CT = window.CT, SUR = window.CTSurrogate, MODEL = window.__CT_MODEL__ || null;

var $ = function (s, r) { return (r || document).querySelector(s); };
var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
var nf0 = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
var MINUS = '−';
function n0(v) { return nf0.format(Math.round(v)).replace('-', MINUS); }
function nd(v, d) { var s = new Intl.NumberFormat('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d }).format(v); return s.replace('-', MINUS); }
function sgn(v, d) { var r = Math.abs(v) < Math.pow(10, -d) / 2 ? 0 : v; return (r > 0 ? '+' : r < 0 ? MINUS : '') + nd(Math.abs(r), d); }
function inr(v) {
  var a = Math.abs(v), s = v < 0 ? MINUS : '';
  if (a >= 1e7) return s + '₹' + (a / 1e7).toFixed(2) + ' crore';
  if (a >= 1e5) return s + '₹' + (a / 1e5).toFixed(1) + ' lakh';
  return s + '₹' + n0(a);
}
function clamp(x, lo, hi) { return Math.min(hi, Math.max(lo, x)); }
function uid() { return 's' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36); }
function today() { try { return new Date().toISOString().slice(0, 10); } catch (e) { return ''; } }

/* ---------- persistence (per-browser, wrapped because storage can be unavailable) ---------- */
var storageOk = true;
var LS = {
  get: function (k, def) { try { var v = localStorage.getItem('ct1.' + k); return v ? JSON.parse(v) : def; } catch (e) { storageOk = false; return def; } },
  set: function (k, v) { try { localStorage.setItem('ct1.' + k, JSON.stringify(v)); return true; } catch (e) { storageOk = false; return false; } },
  del: function (k) { try { localStorage.removeItem('ct1.' + k); } catch (e) { storageOk = false; } }
};

function cloneZones(z) { return JSON.parse(JSON.stringify(z)); }
function validZones(z) {
  if (!Array.isArray(z) || z.length !== CT.DEMO_ZONES.length) return false;
  return z.every(function (r, i) {
    return r && r.id === CT.DEMO_ZONES[i].id && CT.COVER_KEYS.every(function (k) { return isFinite(+r[k]) && +r[k] >= 0; }) && isFinite(+r.coolingKwh);
  });
}

/* ---------- state ---------- */
var state = {
  page: 'overview',
  ver: 0,
  zones: null,
  settings: null,
  plan: {},
  name: 'Baseline reference',
  desc: 'No changes applied. This is the current campus layout.',
  selZone: 'z3',
  layer: 'heat',
  view: 'proposed',
  saved: [],
  cmp: [],
  weights: { heat: 30, water: 25, carbon: 25, irrig: 10, cost: 10 },
  budgetLakh: 150,
  opt: null,
  optBusy: false,
  modal: null,
  tour: null,
  menuOpen: false,
  confirm: null,
  editOpen: false
};

function loadState() {
  var z = LS.get('zones', null);
  state.zones = validZones(z) ? z : cloneZones(CT.DEMO_ZONES);
  state.settings = CT.withDefaults(LS.get('settings', {}));
  var s = LS.get('saved', []);
  state.saved = Array.isArray(s) ? s.filter(function (r) { return r && r.id && r.plan; }) : [];
}
function touch() { state.ver++; }
var _sim = null, _simVer = -1;
function getSim() {
  if (!_sim || _simVer !== state.ver) { _sim = CT.simulate(state.zones, state.plan, state.settings); _simVer = state.ver; }
  return _sim;
}
function planIsEmpty() {
  return !Object.keys(state.plan).some(function (id) { return CT.IV_KEYS.some(function (k) { return +(state.plan[id] && state.plan[id][k]) > 0; }); });
}
function zoneById(id) { return state.zones.filter(function (z) { return z.id === id; })[0]; }
function persistSaved() { return LS.set('saved', state.saved); }
function persistZones() { return LS.set('zones', state.zones); }
function persistSettings() { return LS.set('settings', state.settings); }

/* ---------- presets (zone-by-zone plans; always passed through validation) ---------- */
var PRESETS = [
  {
    id: 'sponge', name: 'Sponge Parking',
    desc: 'Depave the main parking lot and the plaza for permeable paving, with shade trees along the car park.',
    plan: { z3: { depavePerm: 6000, depaveLawn: 800, treesPaved: 40 }, z1: { depavePerm: 2500 }, z6: { depavePerm: 1200, treesPaved: 15 } }
  },
  {
    id: 'forest', name: 'Urban Forest',
    desc: 'Large-scale tree planting in open ground and along paved areas to raise shaded ground.',
    plan: { z1: { treesLawn: 60, treesPaved: 30 }, z2: { treesLawn: 60, treesPaved: 30 }, z3: { treesPaved: 80, treesLawn: 10 }, z5: { treesLawn: 60 }, z6: { treesPaved: 20 } }
  },
  {
    id: 'energy', name: 'Cool Roofs and Solar Carport',
    desc: 'High-albedo roof coating on the main buildings and a solar canopy over the parking lot.',
    plan: { z1: { coolRoof: 8000 }, z2: { coolRoof: 5000 }, z6: { coolRoof: 1800 }, z3: { solarCanopy: 6000 } }
  },
  {
    id: 'combined', name: 'Balanced Climate Plan',
    desc: 'A blend of permeable paving, shade trees, cool roofs, a solar carport and rainwater tanks.',
    plan: {
      z3: { solarCanopy: 3500, treesPaved: 40, depavePerm: 3500, depaveLawn: 500 },
      z1: { coolRoof: 6000, depavePerm: 1500, treesPaved: 25, rwhTank: 80 },
      z2: { coolRoof: 4000, treesPaved: 20, rwhTank: 60 },
      z6: { coolRoof: 1500, depavePerm: 800 }
    }
  }
];
function presetById(id) { return PRESETS.filter(function (p) { return p.id === id; })[0]; }
function sanitizePlan(plan) {
  var out = {};
  state.zones.forEach(function (z) {
    var n = CT.normalizeIv(z, plan && plan[z.id], state.settings).iv;
    if (CT.IV_KEYS.some(function (k) { return n[k] > 0; })) out[z.id] = n;
  });
  return out;
}
function applyPlan(plan, name, desc) {
  state.plan = sanitizePlan(plan);
  state.name = name; state.desc = desc;
  state.view = 'proposed';
  state.opt = state.opt; touch();
}
function resetPlan() {
  state.plan = {}; state.name = 'Baseline reference'; state.desc = 'No changes applied. This is the current campus layout.'; touch();
}
function curIv(zoneId) {
  var o = {}; CT.IV_KEYS.forEach(function (k) { o[k] = +(state.plan[zoneId] && state.plan[zoneId][k]) || 0; }); return o;
}
function setIv(zoneId, key, val) {
  var z = zoneById(zoneId), iv = curIv(zoneId);
  var cap = CT.capacities(z, iv, state.settings)[key];
  iv[key] = clamp(Math.round(val), 0, Math.max(0, cap));
  state.plan[zoneId] = iv;
  touch();
}

/* ---------- metric definitions shared by tiles, comparison, reports ---------- */
function metricRows(sim) {
  var b = sim.campus.base, p = sim.campus.prop, R = sim.ranges, S = sim.settings;
  return [
    { id: 'green', label: 'Green cover', unit: '%', d: 1, b: b.greenPct, p: p.greenPct, good: 'up', basis: 'Calculated from areas', hint: 'Lawn, tree canopy and green roofs as a share of the campus.', conf: 'High' },
    { id: 'imp', label: 'Impervious surface', unit: '%', d: 1, b: b.impPct, p: p.impPct, good: 'down', basis: 'Calculated from areas', hint: 'Paving and roofs that do not let rain soak in.', conf: 'High' },
    { id: 'shade', label: 'Shaded ground', unit: '%', d: 1, b: b.shadedPct, p: p.shadedPct, good: 'up', basis: 'Calculated from areas', hint: 'Ground under tree canopy or solar canopy.', conf: 'High' },
    { id: 'temp', label: 'Surface temperature, midday (indicative)', short: 'Surface temperature', unit: '°C', d: 1, b: b.surfTemp, p: p.surfTemp, good: 'down', basis: 'Assumption-driven estimate', hint: 'Area-weighted surface temperature on a hot day, not a measurement.', conf: 'Medium', range: R.surfTemp, excess: true },
    { id: 'runoff', label: 'Storm runoff per design storm', short: 'Storm runoff', unit: 'm³', d: 0, b: b.runoff, p: p.runoff, good: 'down', basis: 'SCS Curve Number method', hint: 'Water leaving the campus in one ' + S.stormMm + ' mm, 24 h storm.', conf: 'Medium', range: R.runoff },
    { id: 'irrig', label: 'Irrigation demand', unit: 'm³/yr', d: 0, b: b.irrig, p: p.irrig, good: 'down', basis: 'Crop coefficient method', hint: 'Water needed to keep lawns, trees and green roofs healthy.', conf: 'Medium', range: R.irrig },
    { id: 'cool', label: 'Cooling electricity', unit: 'MWh/yr', d: 0, b: b.cooling / 1000, p: p.cooling / 1000, good: 'down', basis: 'Baseline input minus roof savings', hint: 'Air-conditioning electricity. Baseline is an entered value.', conf: 'Low', range: { lo: R.cooling.lo / 1000, hi: R.cooling.hi / 1000 } },
    { id: 'solar', label: 'Solar generation', unit: 'MWh/yr', d: 0, b: b.solar / 1000, p: p.solar / 1000, good: 'up', basis: 'Canopy area x yield', hint: 'Electricity from solar canopies.', conf: 'Medium', range: { lo: R.solar.lo / 1000, hi: R.solar.hi / 1000 } },
    { id: 'co2', label: 'Net CO₂e from electricity', unit: 't/yr', d: 0, b: b.co2, p: p.co2, good: 'down', basis: 'Net kWh x grid factor', hint: 'Cooling electricity minus solar, times the grid emission factor.', conf: 'Low', range: R.co2 }
  ];
}
function rowById(rows, id) { return rows.filter(function (r) { return r.id === id; })[0]; }
function isChanged(m) { return Math.abs(m.p - m.b) >= Math.pow(10, -m.d) / 2; }
function isGood(m) { var d = m.p - m.b; return m.good === 'up' ? d > 0 : d < 0; }
function deltaChip(m) {
  if (!isChanged(m)) return '<span class="chip chip-flat">No change</span>';
  var d = m.p - m.b, good = isGood(m);
  return '<span class="chip ' + (good ? 'chip-good' : 'chip-warn') + '"><span aria-hidden="true">' + (d > 0 ? '▲' : '▼') + '</span> ' + sgn(d, m.d) + ' ' + esc(m.unit) +
    '<span class="sr">, ' + (good ? 'improvement' : 'trade-off') + '</span></span>';
}
function pctChange(m) { return m.b !== 0 ? (m.p - m.b) / Math.abs(m.b) * 100 : null; }

/* ---------- zone facts and priority ---------- */
function zoneFacts(sim) {
  var list = sim.zones.map(function (z) {
    var m = z.base;
    return { id: z.id, name: z.name, type: z.type, total: m.total, impPct: m.imp / m.total * 100, greenPct: m.green / m.total * 100, shadedPct: m.shaded / m.total * 100, temp: m.surfTemp, qDepth: m.qDepth, cooling: m.cooling, runoff: m.runoff, runoffPerHa: m.runoff / m.total * 10000 };
  });
  function norm(key) {
    var vals = list.map(function (r) { return r[key]; }), lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
    return function (r) { return hi > lo ? (r[key] - lo) / (hi - lo) : 0; };
  }
  var nT = norm('temp'), nQ = norm('qDepth'), nI = norm('impPct');
  list.forEach(function (r) { r.priority = 100 * (0.4 * nT(r) + 0.3 * nQ(r) + 0.3 * nI(r)); });
  return list;
}

/* ---------- single-intervention candidates and ranking ---------- */
var CAND_META = {
  depavePerm: { title: 'Replace asphalt with permeable paving', cat: 'Stormwater', trade: 'Permeable paving needs vacuum sweeping once or twice a year, or its pores clog and infiltration drops.' },
  treesPaved: { title: 'Plant shade trees along paved areas', cat: 'Heat', trade: 'Young trees shade little at first, and need regular watering for the first two years. The model counts shade at about 10 years.' },
  treesLawn: { title: 'Plant trees in open green ground', cat: 'Heat', trade: 'Cooling is smaller than for trees over paving because grass already runs cooler. Adds some irrigation demand.' },
  coolRoof: { title: 'Coat roofs with a high-albedo membrane', cat: 'Energy and carbon', trade: 'Coating loses reflectivity with dust and needs washing or recoating every few years. Savings depend on how much of the top floor is air-conditioned.' },
  greenRoof: { title: 'Convert part of the roofs to green roofs', cat: 'Heat and stormwater', trade: 'Highest cost per m² here, needs a structural check, and adds irrigation demand.' },
  solarCanopy: { title: 'Install a solar canopy over the car park', cat: 'Energy and carbon', trade: 'Cuts electricity emissions and shades vehicles, but does little for stormwater. Needs structural and grid approvals.' },
  rwhTank: { title: 'Add rainwater harvesting tanks', cat: 'Stormwater and water', trade: 'Only helps if the tank is empty before the storm, so it needs a use (irrigation, flushing) that draws it down.' }
};

function candidateDefs(z, S) {
  var c = CT.baseCover(z), cpt = S.canopyPerTree, roofAll = c.roofStd + c.roofCool + c.roofGreen;
  var r100 = function (v) { return Math.floor(v / 100) * 100; };
  var out = [];
  if (c.pavedImp >= 1000) {
    out.push({ key: 'depavePerm', qty: r100(Math.min(0.4 * c.pavedImp, 4000)) });
    out.push({ key: 'treesPaved', qty: Math.min(60, Math.floor(0.2 * c.pavedImp / cpt)) });
  }
  if (c.lawn >= 1500) out.push({ key: 'treesLawn', qty: Math.min(80, Math.floor(0.25 * c.lawn / cpt)) });
  if (c.roofStd >= 1500) out.push({ key: 'coolRoof', qty: r100(0.6 * c.roofStd) });
  if (c.roofStd >= 3000) out.push({ key: 'greenRoof', qty: r100(0.2 * c.roofStd) });
  if (z.type === 'parking' && c.pavedImp >= 3000) out.push({ key: 'solarCanopy', qty: r100(0.4 * c.pavedImp) });
  if (roofAll >= 1500) out.push({ key: 'rwhTank', qty: Math.min(200, Math.round(0.02 * roofAll / 10) * 10) });
  return out.filter(function (d) { return d.qty > 0; });
}

function buildCandidates() {
  var S = state.settings, zones = state.zones;
  var baseSim = CT.simulate(zones, {}, S), b = baseSim.campus.base;
  var facts = {};
  zoneFacts(baseSim).forEach(function (f) { facts[f.id] = f; });
  var list = [];
  zones.forEach(function (z) {
    candidateDefs(z, S).forEach(function (d) {
      var plan = {}; plan[z.id] = {}; plan[z.id][d.key] = d.qty;
      var r = CT.simulate(zones, plan, S), p = r.campus.prop;
      list.push({
        zoneId: z.id, zoneName: z.name, key: d.key, qty: d.qty, unit: CT.IV_META[d.key].unit,
        dTemp: b.surfTemp - p.surfTemp, dRunoff: b.runoff - p.runoff, dCo2: b.co2 - p.co2, dIrrig: p.irrig - b.irrig,
        zTempBase: r.zones.filter(function (q) { return q.id === z.id; })[0].base.surfTemp,
        zTempProp: r.zones.filter(function (q) { return q.id === z.id; })[0].prop.surfTemp,
        zRunBase: r.zones.filter(function (q) { return q.id === z.id; })[0].base.runoff,
        zRunProp: r.zones.filter(function (q) { return q.id === z.id; })[0].prop.runoff,
        cost: r.cost.total, payback: r.payback, saving: r.annualSaving, facts: facts[z.id], plan: plan
      });
    });
  });
  return list;
}

function scoreCandidates(list, w) {
  function maxOf(f) { return Math.max.apply(null, list.map(f).concat([1e-9])); }
  var mH = maxOf(function (c) { return Math.max(0, c.dTemp); });
  var mW = maxOf(function (c) { return Math.max(0, c.dRunoff); });
  var mC = maxOf(function (c) { return Math.max(0, c.dCo2); });
  var mI = maxOf(function (c) { return Math.max(0, c.dIrrig); });
  var mK = maxOf(function (c) { return c.cost; });
  var ws = w.heat + w.water + w.carbon + w.irrig + w.cost || 1;
  list.forEach(function (c) {
    c.parts = {
      heat: Math.max(0, c.dTemp) / mH, water: Math.max(0, c.dRunoff) / mW, carbon: Math.max(0, c.dCo2) / mC,
      irrig: 1 - Math.max(0, c.dIrrig) / mI, cost: 1 - c.cost / mK
    };
    c.score = 100 * (w.heat * c.parts.heat + w.water * c.parts.water + w.carbon * c.parts.carbon + w.irrig * c.parts.irrig + w.cost * c.parts.cost) / ws;
  });
  return list.slice().sort(function (a, b) { return b.score - a.score; });
}

function whyText(c, S) {
  var f = c.facts, z = c.zoneName, P = S.stormMm;
  switch (c.key) {
    case 'depavePerm': return z + ' is ' + nd(f.impPct, 0) + '% impervious and sends ' + nd(f.qDepth, 0) + ' mm of a ' + P + ' mm storm to the drains. Converting ' + n0(c.qty) + ' m² lowers the zone’s runoff from ' + n0(c.zRunBase) + ' to ' + n0(c.zRunProp) + ' m³.';
    case 'treesPaved': return z + ' has only ' + nd(f.shadedPct, 0) + '% shaded ground and a midday surface temperature of about ' + nd(f.temp, 1) + ' °C. ' + c.qty + ' trees shade ' + n0(c.qty * S.canopyPerTree) + ' m² of paving.';
    case 'treesLawn': return z + ' has ' + nd(f.greenPct, 0) + '% green cover and room for planting. ' + c.qty + ' trees add ' + n0(c.qty * S.canopyPerTree) + ' m² of canopy.';
    case 'coolRoof': return z + ' draws about ' + n0(f.cooling / 1000) + ' MWh of cooling electricity a year under standard roofs. Coating ' + n0(c.qty) + ' m² is estimated to save ' + n0(c.qty * CT.SETS.central.kCool / 1000) + ' MWh a year.';
    case 'greenRoof': return z + ' has large flat roofs. ' + n0(c.qty) + ' m² of green roof lowers roof surface heat and slows runoff, at a high cost per m².';
    case 'solarCanopy': return z + ' is ' + nd(f.impPct, 0) + '% impervious car park. A ' + n0(c.qty) + ' m² canopy generates about ' + n0(c.qty * S.solarYield / 1000) + ' MWh a year and shades the paving below.';
    case 'rwhTank': return z + ' has roofs that shed water quickly in a storm. A ' + c.qty + ' m³ tank captures part of the first flush and can supply irrigation.';
  }
  return '';
}

/* ---------- optimizer: surrogate screening, exact engine verification ---------- */
function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function climateInRange(S) { var R = CT.CLIMATE_RANGE; return S.ambientC >= R.ambientC[0] && S.ambientC <= R.ambientC[1] && S.stormMm >= R.stormMm[0] && S.stormMm <= R.stormMm[1]; }
function surrogateValid() { return !!MODEL && MODEL.stateKey === CT.stateKey(state.zones, state.settings) && climateInRange(state.settings); }
function surFeatures(totals, S) { return CT.FEATURES.map(function (k) { return totals[k]; }).concat([S.ambientC, S.stormMm]); }
var FEAT_LABEL = { ambientC: 'Hot-day air temperature (climate input)', stormMm: 'Design storm depth (climate input)' };
function featLabel(k) { return FEAT_LABEL[k] || CT.IV_META[k].label; }

function runOptimizer() {
  var t0 = (window.performance || Date).now();
  var zones = state.zones, S = state.settings, budget = state.budgetLakh * 1e5;
  var baseSim = CT.simulate(zones, {}, S);
  var b = baseSim.campus.base;
  var baseOut = { surfTemp: b.surfTemp, runoff: b.runoff, co2: b.co2, irrig: b.irrig };
  var mt = CT.maxTotals(zones, S), useAI = surrogateValid();
  var N = useAI ? 20000 : 2500, rnd = mulberry(1021 + Math.round(budget / 1e4));
  var w = { heat: state.weights.heat, water: state.weights.water, carbon: state.weights.carbon, irrig: state.weights.irrig };
  var top = [];
  function actualTotals(plan) { return CT.planTotals(zones, plan, S); }
  for (var i = 0; i < N; i++) {
    var tot = {};
    CT.FEATURES.forEach(function (k) { tot[k] = rnd() < 0.35 ? 0 : rnd() * mt[k]; });
    var plan = CT.allocate(zones, tot, S), at = actualTotals(plan), cost = CT.costOf(at, S).total;
    if (cost > budget) {
      var f = budget / cost * 0.98;
      CT.FEATURES.forEach(function (k) { tot[k] = at[k] * f; });
      plan = CT.allocate(zones, tot, S); at = actualTotals(plan); cost = CT.costOf(at, S).total;
      if (cost > budget) continue;
    }
    if (cost <= 0) continue;
    var out;
    if (useAI) {
      var p = SUR.predict(MODEL, surFeatures(at, S));
      out = { surfTemp: p.surfTemp, runoff: p.runoff, irrig: p.irrig, co2: p.netKwh * S.gridEF / 1000 };
    } else {
      var q = CT.simulate(zones, plan, S).campus.prop;
      out = { surfTemp: q.surfTemp, runoff: q.runoff, irrig: q.irrig, co2: q.co2 };
    }
    var sc = CT.scoreOutputs(baseOut, out, w);
    top.push({ score: sc, plan: plan, cost: cost, ai: out });
    if (top.length > 400) { top.sort(function (a, c) { return c.score - a.score; }); top.length = 40; }
  }
  top.sort(function (a, c) { return c.score - a.score; });
  var finalists = top.slice(0, 5).map(function (c) {
    var sim = CT.simulate(zones, c.plan, S), p = sim.campus.prop;
    var exact = { surfTemp: p.surfTemp, runoff: p.runoff, irrig: p.irrig, co2: p.co2 };
    return { plan: c.plan, sim: sim, aiScore: c.score, score: CT.scoreOutputs(baseOut, exact, w), ai: c.ai, exact: exact, cost: c.cost };
  });
  finalists.sort(function (a, c) { return c.score - a.score; });
  var ms = Math.round((window.performance || Date).now() - t0);
  return finalists.length ? { best: finalists[0], finalists: finalists, evaluated: N, useAI: useAI, ms: ms, budget: budget, key: CT.stateKey(zones, S), weights: w } : { best: null, evaluated: N, useAI: useAI, ms: ms, budget: budget };
}

/* ---------- reports ---------- */
function planLines(sim) {
  var lines = [];
  state.zones.forEach(function (z) {
    var iv = sim.plan[z.id]; if (!iv) return;
    var parts = [];
    CT.IV_KEYS.forEach(function (k) { if (iv[k] > 0) parts.push(CT.IV_META[k].label + ': ' + n0(iv[k]) + ' ' + CT.IV_META[k].unit); });
    if (parts.length) lines.push({ zone: z.name, items: parts });
  });
  return lines;
}
function reportData() {
  var sim = getSim(), rows = metricRows(sim), S = sim.settings;
  var cands = scoreCandidates(buildCandidates(), state.weights).slice(0, 3);
  return { sim: sim, rows: rows, S: S, cands: cands, lines: planLines(sim), date: today() };
}
function reportMarkdown() {
  var d = reportData(), sim = d.sim, S = d.S, L = [];
  L.push('# ClimateTwin AI scenario report', '');
  L.push('**Scenario:** ' + state.name, '**Campus:** PCCOE Pune, demo layout (illustrative areas)', '**Date:** ' + d.date, '', state.desc, '');
  L.push('## Proposed changes', '');
  if (!d.lines.length) L.push('No changes applied (baseline).');
  d.lines.forEach(function (l) { L.push('- **' + l.zone + ':** ' + l.items.join('; ')); });
  L.push('', '## Results', '', '| Indicator | Baseline | Proposed | Change | Range of change |', '|---|---|---|---|---|');
  d.rows.forEach(function (m) {
    var rg = m.range ? sgn(m.range.lo, m.d) + ' to ' + sgn(m.range.hi, m.d) : 'n/a';
    L.push('| ' + m.label + ' (' + m.unit + ') | ' + nd(m.b, m.d) + ' | ' + nd(m.p, m.d) + ' | ' + sgn(m.p - m.b, m.d) + ' | ' + rg + ' |');
  });
  L.push('', '**Indicative cost:** ' + inr(sim.cost.total) + (sim.payback ? '; simple payback on electricity savings about ' + nd(sim.payback, 1) + ' years' : '; no electricity savings, so no payback is computed'));
  L.push('', '## Recommended next actions (single interventions ranked by the current weights)', '');
  d.cands.forEach(function (c, i) { L.push((i + 1) + '. ' + CAND_META[c.key].title + ' in ' + c.zoneName + ' (' + n0(c.qty) + ' ' + c.unit + '), score ' + nd(c.score, 0) + '/100. ' + whyText(c, S)); });
  L.push('', '## Methods', '',
    '- Storm runoff: NRCS Curve Number method for a ' + S.stormMm + ' mm, 24 h design storm (assumption).',
    '- Surface temperature: area-weighted midday surface temperature using per-material excess over a ' + S.ambientC + ' °C air temperature. Indicative, not measured.',
    '- Energy: entered baseline cooling electricity minus roof retrofit savings per m². Solar: canopy area x ' + S.solarYield + ' kWh/m²/yr.',
    '- Carbon: net electricity x ' + S.gridEF + ' kg CO₂e/kWh (CEA CO₂ Baseline Database v19; check the latest edition).',
    '- Ranges come from conservative, central and optimistic coefficient sets.', '',
    '## Data and limitations', '',
    '- Campus areas and baseline cooling electricity are illustrative sample values and must be replaced with measured data.',
    '- Climate context: Pune monthly normals 1991–2020 (public compilation of station data).',
    '- The AI surrogate model is trained on this engine’s outputs, not on field measurements.',
    '- Results are planning estimates for comparing options, not predictions of measured outcomes.');
  return L.join('\n');
}
function reportHtml() {
  var md = reportMarkdown();
  var body = esc(md).replace(/^# (.*)$/gm, '<h1>$1</h1>').replace(/^## (.*)$/gm, '<h2>$1</h2>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  var html = [], inTable = false, inList = false;
  body.split('\n').forEach(function (line) {
    if (line.indexOf('|') === 0) {
      if (/^\|[-| ]+\|$/.test(line)) return;
      if (!inTable) { html.push('<table>'); inTable = true; }
      var cells = line.split('|').slice(1, -1);
      html.push('<tr>' + cells.map(function (c) { return (html[html.length - 1] === '<table>' ? '<th>' : '<td>') + c.trim() + (html[html.length - 1] === '<table>' ? '</th>' : '</td>'); }).join('') + '</tr>');
      return;
    }
    if (inTable) { html.push('</table>'); inTable = false; }
    if (/^- /.test(line)) { if (!inList) { html.push('<ul>'); inList = true; } html.push('<li>' + line.slice(2) + '</li>'); return; }
    if (inList) { html.push('</ul>'); inList = false; }
    if (/^\d+\. /.test(line)) { html.push('<p>' + line + '</p>'); return; }
    if (line.trim()) html.push(/^<h/.test(line) ? line : '<p>' + line + '</p>');
  });
  if (inTable) html.push('</table>'); if (inList) html.push('</ul>');
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>ClimateTwin AI report</title><style>body{font:15px/1.55 Inter,system-ui,sans-serif;color:#344054;max-width:860px;margin:32px auto;padding:0 20px}h1{color:#174B38;font-size:28px}h2{color:#174B38;font-size:19px;margin-top:28px}table{border-collapse:collapse;width:100%;font-size:13px}th,td{border:1px solid #E5E7EB;padding:6px 8px;text-align:left}th{background:#DCEBDD;color:#174B38}</style></head><body>' + html.join('\n') + '</body></html>';
}
