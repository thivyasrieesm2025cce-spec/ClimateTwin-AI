/*
 * ClimateTwin AI - simulation engine
 * Pure functions, no DOM. Runs in the browser and in Node (tests, dataset generation).
 *
 * Methods (all documented on the Methodology page of the app):
 *   - Storm runoff:   NRCS/SCS Curve Number, event based (Q = (P-Ia)^2 / (P-Ia+S), Ia = 0.2 S)
 *   - Surface heat:   area-weighted midday surface temperature from per-material excess over air temperature
 *   - Energy:         baseline cooling electricity (user input) minus roof retrofit savings per m2
 *   - Solar:          canopy area x yield per m2
 *   - Carbon:         net electricity x grid emission factor
 *   - Irrigation:     crop-coefficient method, ETc = Kc x ET0
 *   - Cost:           quantity x unit cost (planning-level, editable)
 * Every coefficient is an assumption, grouped in three sets (conservative / central / optimistic)
 * so that results are reported with a range.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CT = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var COVER_KEYS = ['pavedImp', 'pavedPv', 'pavedPerm', 'roofStd', 'roofCool', 'roofGreen', 'lawn', 'canopy'];
  var COVER_LABELS = {
    pavedImp: 'Paved, impervious (asphalt / concrete)',
    pavedPv: 'Paved, shaded by solar canopy',
    pavedPerm: 'Paved, permeable',
    roofStd: 'Roof, standard',
    roofCool: 'Roof, cool (high albedo)',
    roofGreen: 'Roof, green',
    lawn: 'Lawn and open vegetation',
    canopy: 'Tree canopy'
  };

  var IV_KEYS = ['treesLawn', 'treesPaved', 'depavePerm', 'depaveLawn', 'coolRoof', 'greenRoof', 'solarCanopy', 'rwhTank'];

  var DEFAULT_SETTINGS = {
    ambientC: 37.8,      // Pune, mean daily maximum of the hottest month (April), 1991-2020 normals
    stormMm: 75,         // 24 h design storm depth - ASSUMPTION, replace with an IMD return-period value
    gridEF: 0.716,       // kg CO2e / kWh, CEA CO2 Baseline Database v19 - verify the latest edition
    tariff: 8.5,         // INR / kWh - ASSUMPTION
    et0: 4.5,            // mm / day reference evapotranspiration - ASSUMPTION
    irrigDays: 200,      // irrigated days per year - ASSUMPTION
    irrigEff: 0.85,
    canopyPerTree: 14,   // m2 of ground shaded per tree, about 10 years after planting (maturity preset)
    solarYield: 200,     // kWh per m2 of canopy per year - ASSUMPTION
    rwhFills: 12,        // times a harvesting tank is filled per year - ASSUMPTION
    annualRainMm: 866,   // Pune annual normal 1991-2020
    costs: {             // INR, planning-level, ASSUMPTIONS
      permeable: 1800,   // per m2 depaved and relaid with permeable pavers
      depaveLawn: 900,   // per m2 depaved and turfed
      tree: 3500,        // per tree, planted with two years of establishment care
      coolRoof: 350,     // per m2 reflective coating
      greenRoof: 3500,   // per m2
      solar: 8300,       // per m2 of solar canopy
      rwh: 10000         // per m3 of tank storage
    }
  };

  var KC = { lawn: 0.8, canopy: 0.4, roofGreen: 0.5 };

  var SETS = {
    cons: {
      label: 'Conservative',
      excess: { pavedImp: 16, pavedPv: 10, pavedPerm: 13, roofStd: 14, roofCool: 8, roofGreen: 4, lawn: -1, canopy: -2 },
      cn: { pavedImp: 98, pavedPv: 98, pavedPerm: 88, roofStd: 98, roofCool: 98, roofGreen: 90, lawn: 78, canopy: 74 },
      kCool: 5, kGreen: 3, solarMul: 0.75
    },
    central: {
      label: 'Central',
      excess: { pavedImp: 20, pavedPv: 8, pavedPerm: 12, roofStd: 17, roofCool: 6, roofGreen: 1, lawn: -3, canopy: -4 },
      cn: { pavedImp: 98, pavedPv: 98, pavedPerm: 80, roofStd: 98, roofCool: 98, roofGreen: 86, lawn: 74, canopy: 70 },
      kCool: 9, kGreen: 6, solarMul: 1
    },
    opt: {
      label: 'Optimistic',
      excess: { pavedImp: 24, pavedPv: 6, pavedPerm: 10, roofStd: 20, roofCool: 4, roofGreen: -1, lawn: -5, canopy: -6 },
      cn: { pavedImp: 98, pavedPv: 98, pavedPerm: 74, roofStd: 98, roofCool: 98, roofGreen: 82, lawn: 70, canopy: 66 },
      kCool: 14, kGreen: 10, solarMul: 1.25
    }
  };

  /* Illustrative demo layout. Areas are NOT surveyed - they are placeholders to be replaced with measured values. */
  var DEMO_ZONES = [
    { id: 'z1', name: 'Academic Blocks', type: 'academic', roofStd: 12000, roofCool: 0, roofGreen: 0, pavedImp: 11000, pavedPv: 0, pavedPerm: 500, lawn: 3500, canopy: 3000, coolingKwh: 1100000 },
    { id: 'z2', name: 'Hostels and Mess', type: 'residential', roofStd: 8000, roofCool: 0, roofGreen: 0, pavedImp: 7000, pavedPv: 0, pavedPerm: 500, lawn: 3500, canopy: 3000, coolingKwh: 650000 },
    { id: 'z3', name: 'Main Parking', type: 'parking', roofStd: 600, roofCool: 0, roofGreen: 0, pavedImp: 13700, pavedPv: 0, pavedPerm: 300, lawn: 600, canopy: 800, coolingKwh: 20000 },
    { id: 'z4', name: 'Central Garden', type: 'green', roofStd: 200, roofCool: 0, roofGreen: 0, pavedImp: 1300, pavedPv: 0, pavedPerm: 700, lawn: 7000, canopy: 4800, coolingKwh: 8000 },
    { id: 'z5', name: 'Sports Grounds', type: 'sports', roofStd: 900, roofCool: 0, roofGreen: 0, pavedImp: 2600, pavedPv: 0, pavedPerm: 500, lawn: 12000, canopy: 2000, coolingKwh: 60000 },
    { id: 'z6', name: 'Admin and Entry Plaza', type: 'admin', roofStd: 2600, roofCool: 0, roofGreen: 0, pavedImp: 3800, pavedPv: 0, pavedPerm: 300, lawn: 800, canopy: 500, coolingKwh: 220000 }
  ];

  var IV_META = {
    treesLawn: { label: 'Plant trees in open green ground', unit: 'trees', costKey: 'tree' },
    treesPaved: { label: 'Plant shade trees in paved areas', unit: 'trees', costKey: 'tree' },
    depavePerm: { label: 'Replace asphalt with permeable paving', unit: 'm²', costKey: 'permeable' },
    depaveLawn: { label: 'Convert asphalt to lawn / planting', unit: 'm²', costKey: 'depaveLawn' },
    coolRoof: { label: 'Coat roofs with high-albedo membrane', unit: 'm²', costKey: 'coolRoof' },
    greenRoof: { label: 'Convert roofs to green roofs', unit: 'm²', costKey: 'greenRoof' },
    solarCanopy: { label: 'Install solar canopy over paved areas', unit: 'm²', costKey: 'solar' },
    rwhTank: { label: 'Rainwater harvesting tank', unit: 'm³', costKey: 'rwh' }
  };

  function num(v) { v = +v; return isFinite(v) && v > 0 ? v : 0; }
  function sum(a) { var s = 0; for (var i = 0; i < a.length; i++) s += a[i]; return s; }
  function clamp(x, lo, hi) { return Math.min(hi, Math.max(lo, x)); }
  function round(x, d) { var p = Math.pow(10, d || 0); return Math.round(x * p) / p; }

  function withDefaults(S) {
    S = S || {};
    var out = {};
    for (var k in DEFAULT_SETTINGS) if (k !== 'costs') out[k] = S[k] != null && isFinite(+S[k]) ? +S[k] : DEFAULT_SETTINGS[k];
    out.costs = {};
    for (var c in DEFAULT_SETTINGS.costs) out.costs[c] = S.costs && S.costs[c] != null && isFinite(+S.costs[c]) ? +S.costs[c] : DEFAULT_SETTINGS.costs[c];
    return out;
  }

  function zoneTotal(z) {
    var t = 0;
    for (var i = 0; i < COVER_KEYS.length; i++) t += num(z[COVER_KEYS[i]]);
    return t;
  }
  function baseCover(z) {
    var c = {};
    for (var i = 0; i < COVER_KEYS.length; i++) c[COVER_KEYS[i]] = num(z[COVER_KEYS[i]]);
    return c;
  }

  /* Remaining capacity of a zone for each intervention, given the other interventions already chosen. */
  function capacities(z, iv, S) {
    var cpt = S.canopyPerTree;
    var cover = baseCover(z);
    var usedPaved = num(iv.solarCanopy) + num(iv.treesPaved) * cpt + num(iv.depavePerm) + num(iv.depaveLawn);
    var usedRoof = num(iv.coolRoof) + num(iv.greenRoof);
    return {
      treesLawn: Math.floor(cover.lawn / cpt),
      treesPaved: Math.floor(Math.max(0, cover.pavedImp - (usedPaved - num(iv.treesPaved) * cpt)) / cpt),
      depavePerm: Math.max(0, cover.pavedImp - (usedPaved - num(iv.depavePerm))),
      depaveLawn: Math.max(0, cover.pavedImp - (usedPaved - num(iv.depaveLawn))),
      solarCanopy: Math.max(0, cover.pavedImp - (usedPaved - num(iv.solarCanopy))),
      coolRoof: Math.max(0, cover.roofStd - (usedRoof - num(iv.coolRoof))),
      greenRoof: Math.max(0, cover.roofStd - (usedRoof - num(iv.greenRoof))),
      rwhTank: 1000
    };
  }

  /* Clamp an intervention set to what is physically possible in the zone. Returns the clamped set and messages. */
  function normalizeIv(z, iv, S) {
    var cpt = S.canopyPerTree;
    var cover = baseCover(z);
    var out = {}, issues = [];
    IV_KEYS.forEach(function (k) { out[k] = num(iv && iv[k]); });
    function cut(key, value, why) {
      if (out[key] > value + 1e-9) {
        issues.push(IV_META[key].label + ' reduced from ' + Math.round(out[key]).toLocaleString('en-IN') + ' to ' + Math.floor(value).toLocaleString('en-IN') + ' ' + IV_META[key].unit + ': ' + why);
        out[key] = Math.floor(value);
      }
    }
    cut('treesLawn', Math.floor(cover.lawn / cpt), 'not enough open green ground in ' + z.name);
    var paved = cover.pavedImp;
    cut('solarCanopy', paved, 'not enough impervious paving');
    paved -= out.solarCanopy;
    cut('treesPaved', Math.floor(paved / cpt), 'not enough impervious paving left');
    paved -= out.treesPaved * cpt;
    cut('depavePerm', paved, 'not enough impervious paving left');
    paved -= out.depavePerm;
    cut('depaveLawn', paved, 'not enough impervious paving left');
    var roof = cover.roofStd;
    cut('coolRoof', roof, 'not enough standard roof');
    roof -= out.coolRoof;
    cut('greenRoof', roof, 'not enough standard roof left');
    cut('rwhTank', 1000, 'above the 1,000 m³ tank limit');
    return { iv: out, issues: issues };
  }

  function applyIv(z, ivn, S) {
    var cpt = S.canopyPerTree;
    var c = baseCover(z);
    var tp = ivn.treesPaved * cpt, tl = ivn.treesLawn * cpt;
    return {
      pavedImp: c.pavedImp - ivn.solarCanopy - tp - ivn.depavePerm - ivn.depaveLawn,
      pavedPv: c.pavedPv + ivn.solarCanopy,
      pavedPerm: c.pavedPerm + ivn.depavePerm,
      roofStd: c.roofStd - ivn.coolRoof - ivn.greenRoof,
      roofCool: c.roofCool + ivn.coolRoof,
      roofGreen: c.roofGreen + ivn.greenRoof,
      lawn: c.lawn + ivn.depaveLawn - tl,
      canopy: c.canopy + tp + tl
    };
  }

  function scsDepth(cn, P) {
    var s = 25400 / cn - 254;
    var ia = 0.2 * s;
    return P > ia ? Math.pow(P - ia, 2) / (P - ia + s) : 0;
  }

  /* All indicators for one zone, one coefficient set, baseline or proposed. */
  function zoneMetrics(cover, z, ivn, set, S, proposed) {
    var total = 0, k, i;
    for (i = 0; i < COVER_KEYS.length; i++) total += cover[COVER_KEYS[i]];
    total = total || 1;
    var excessSum = 0, cnSum = 0;
    for (i = 0; i < COVER_KEYS.length; i++) {
      k = COVER_KEYS[i];
      excessSum += cover[k] * set.excess[k];
      cnSum += cover[k] * set.cn[k];
    }
    var cn = cnSum / total;
    var qDepth = scsDepth(cn, S.stormMm);
    var runoffRaw = qDepth / 1000 * total;
    var qRoofStd = scsDepth(set.cn.roofStd, S.stormMm), qRoofGreen = scsDepth(set.cn.roofGreen, S.stormMm);
    var roofVol = ((cover.roofStd + cover.roofCool) * qRoofStd + cover.roofGreen * qRoofGreen) / 1000;
    var captured = proposed ? Math.min(ivn.rwhTank, roofVol) : 0;
    var runoff = Math.max(0, runoffRaw - captured);

    var irrig = (cover.lawn * KC.lawn + cover.canopy * KC.canopy + cover.roofGreen * KC.roofGreen) * S.et0 * S.irrigDays / 1000 / S.irrigEff;
    var roofArea = cover.roofStd + cover.roofCool + cover.roofGreen;
    var harvest = proposed ? Math.min(ivn.rwhTank * S.rwhFills, 0.85 * S.annualRainMm / 1000 * roofArea) : 0;
    var irrigNet = Math.max(0, irrig - harvest);

    var saved = proposed ? ivn.coolRoof * set.kCool + ivn.greenRoof * set.kGreen : 0;
    var baseCool = num(z.coolingKwh);
    var cooling = Math.max(0.6 * baseCool, baseCool - saved);
    var solar = cover.pavedPv * S.solarYield * set.solarMul;
    var netKwh = cooling - solar;
    var co2 = netKwh * S.gridEF / 1000;

    return {
      total: total,
      green: cover.lawn + cover.canopy + cover.roofGreen,
      imp: cover.pavedImp + cover.pavedPv + cover.roofStd + cover.roofCool,
      shaded: cover.canopy + cover.pavedPv,
      surfTemp: S.ambientC + excessSum / total,
      excessSum: excessSum,
      cn: cn,
      runoff: runoff,
      runoffCoeff: S.stormMm > 0 ? qDepth / S.stormMm : 0,
      qDepth: qDepth,
      irrig: irrigNet,
      cooling: cooling,
      solar: solar,
      netKwh: netKwh,
      co2: co2
    };
  }

  function aggregate(list) {
    var o = { total: 0, green: 0, imp: 0, shaded: 0, excessSum: 0, runoff: 0, irrig: 0, cooling: 0, solar: 0, netKwh: 0, co2: 0, tempW: 0, qW: 0 };
    list.forEach(function (m) {
      o.total += m.total; o.green += m.green; o.imp += m.imp; o.shaded += m.shaded;
      o.excessSum += m.excessSum; o.runoff += m.runoff; o.irrig += m.irrig;
      o.cooling += m.cooling; o.solar += m.solar; o.netKwh += m.netKwh; o.co2 += m.co2;
      o.tempW += m.surfTemp * m.total;
    });
    o.surfTemp = o.total ? o.tempW / o.total : 0;
    o.greenPct = o.total ? o.green / o.total * 100 : 0;
    o.impPct = o.total ? o.imp / o.total * 100 : 0;
    o.shadedPct = o.total ? o.shaded / o.total * 100 : 0;
    return o;
  }

  function costOf(totals, S) {
    var c = S.costs, items = [];
    function add(key, qty, label, unit, costKey) {
      if (qty > 0) items.push({ key: key, label: label, qty: qty, unit: unit, unitCost: c[costKey], cost: qty * c[costKey] });
    }
    add('treesLawn', totals.treesLawn, IV_META.treesLawn.label, 'trees', 'tree');
    add('treesPaved', totals.treesPaved, IV_META.treesPaved.label, 'trees', 'tree');
    add('depavePerm', totals.depavePerm, IV_META.depavePerm.label, 'm²', 'permeable');
    add('depaveLawn', totals.depaveLawn, IV_META.depaveLawn.label, 'm²', 'depaveLawn');
    add('coolRoof', totals.coolRoof, IV_META.coolRoof.label, 'm²', 'coolRoof');
    add('greenRoof', totals.greenRoof, IV_META.greenRoof.label, 'm²', 'greenRoof');
    add('solarCanopy', totals.solarCanopy, IV_META.solarCanopy.label, 'm²', 'solar');
    add('rwhTank', totals.rwhTank, IV_META.rwhTank.label, 'm³', 'rwh');
    return { items: items, total: sum(items.map(function (i) { return i.cost; })) };
  }

  function planTotals(zones, plan, S) {
    var t = {};
    IV_KEYS.forEach(function (k) { t[k] = 0; });
    zones.forEach(function (z) {
      var n = normalizeIv(z, plan && plan[z.id], S).iv;
      IV_KEYS.forEach(function (k) { t[k] += n[k]; });
    });
    return t;
  }

  /* Main entry point. */
  function simulate(zones, plan, settings) {
    var S = withDefaults(settings);
    plan = plan || {};
    var issues = [];
    var norm = {};
    zones.forEach(function (z) {
      var r = normalizeIv(z, plan[z.id], S);
      norm[z.id] = r.iv;
      r.issues.forEach(function (m) { issues.push(m); });
    });

    var perSet = {};
    ['cons', 'central', 'opt'].forEach(function (sk) {
      var set = SETS[sk];
      var rows = zones.map(function (z) {
        var cover = applyIv(z, norm[z.id], S);
        return {
          id: z.id,
          base: zoneMetrics(baseCover(z), z, norm[z.id], set, S, false),
          prop: zoneMetrics(cover, z, norm[z.id], set, S, true)
        };
      });
      perSet[sk] = {
        rows: rows,
        base: aggregate(rows.map(function (r) { return r.base; })),
        prop: aggregate(rows.map(function (r) { return r.prop; }))
      };
    });

    var cen = perSet.central;
    function deltaRange(field) {
      var ds = ['cons', 'central', 'opt'].map(function (sk) { return perSet[sk].prop[field] - perSet[sk].base[field]; });
      return { lo: Math.min.apply(null, ds), hi: Math.max.apply(null, ds) };
    }
    var ranges = {};
    ['surfTemp', 'runoff', 'cooling', 'solar', 'netKwh', 'co2', 'irrig'].forEach(function (f) { ranges[f] = deltaRange(f); });

    var totals = planTotals(zones, plan, S);
    var cost = costOf(totals, S);
    var savedKwh = (cen.base.cooling - cen.prop.cooling) + (cen.prop.solar - cen.base.solar);
    var annualSaving = savedKwh * S.tariff;

    return {
      settings: S,
      issues: issues,
      plan: norm,
      totals: totals,
      zones: zones.map(function (z, i) {
        return { id: z.id, name: z.name, type: z.type, base: cen.rows[i].base, prop: cen.rows[i].prop };
      }),
      campus: { base: cen.base, prop: cen.prop },
      ranges: ranges,
      cost: cost,
      savedKwh: savedKwh,
      annualSaving: annualSaving,
      payback: annualSaving > 0 && cost.total > 0 ? cost.total / annualSaving : null
    };
  }

  /* ---- Plan allocation (used by the optimizer and by presets) ---- */

  function waterfill(total, caps, weights) {
    var out = caps.map(function () { return 0; });
    var left = total;
    for (var pass = 0; pass < 4 && left > 1e-9; pass++) {
      var wsum = 0;
      caps.forEach(function (c, i) { if (out[i] < c - 1e-9) wsum += weights[i]; });
      if (wsum <= 0) break;
      var given = 0;
      caps.forEach(function (c, i) {
        if (out[i] < c - 1e-9) {
          var add = Math.min(c - out[i], left * weights[i] / wsum);
          out[i] += add; given += add;
        }
      });
      left -= given;
    }
    return out;
  }

  /* Spread campus totals across zones in a fixed, documented order. */
  function allocate(zones, totals, settings) {
    var S = withDefaults(settings);
    var cpt = S.canopyPerTree;
    var plan = {};
    var rem = {};
    zones.forEach(function (z) {
      plan[z.id] = { treesLawn: 0, treesPaved: 0, depavePerm: 0, depaveLawn: 0, coolRoof: 0, greenRoof: 0, solarCanopy: 0, rwhTank: 0 };
      var c = baseCover(z);
      rem[z.id] = { paved: c.pavedImp, lawn: c.lawn, roof: c.roofStd, roofAll: c.roofStd + c.roofCool + c.roofGreen };
    });
    function spread(key, total, capFn, weightFn, unitFn) {
      var caps = zones.map(function (z) { return Math.max(0, capFn(z)); });
      var w = zones.map(function (z, i) { return caps[i] > 0 ? Math.max(1e-6, weightFn(z)) : 0; });
      var res = waterfill(num(total), caps, w);
      zones.forEach(function (z, i) {
        var v = unitFn ? Math.floor(res[i] + 1e-9) : res[i];
        plan[z.id][key] = v;
      });
    }
    // 1 solar canopy: parking zones only, up to 60% of their paving
    spread('solarCanopy', totals.solarCanopy,
      function (z) { return z.type === 'parking' ? 0.6 * rem[z.id].paved : 0; },
      function (z) { return rem[z.id].paved; });
    zones.forEach(function (z) { rem[z.id].paved -= plan[z.id].solarCanopy; });
    // 2 shade trees in paved areas, up to 35% of remaining paving
    spread('treesPaved', totals.treesPaved,
      function (z) { return Math.floor(0.35 * rem[z.id].paved / cpt); },
      function (z) { return rem[z.id].paved; }, true);
    zones.forEach(function (z) { rem[z.id].paved -= plan[z.id].treesPaved * cpt; });
    // 3 permeable paving, up to 60% of remaining paving
    spread('depavePerm', totals.depavePerm,
      function (z) { return 0.6 * rem[z.id].paved; },
      function (z) { return rem[z.id].paved; });
    zones.forEach(function (z) { rem[z.id].paved -= plan[z.id].depavePerm; });
    // 4 asphalt to lawn, up to 30% of remaining paving
    spread('depaveLawn', totals.depaveLawn,
      function (z) { return 0.3 * rem[z.id].paved; },
      function (z) { return rem[z.id].paved; });
    // 5 trees in open ground, up to 50% of lawn
    spread('treesLawn', totals.treesLawn,
      function (z) { return Math.floor(0.5 * rem[z.id].lawn / cpt); },
      function (z) { return rem[z.id].lawn; }, true);
    // 6 cool roofs, up to 100% of standard roof
    spread('coolRoof', totals.coolRoof,
      function (z) { return rem[z.id].roof; },
      function (z) { return rem[z.id].roof; });
    zones.forEach(function (z) { rem[z.id].roof -= plan[z.id].coolRoof; });
    // 7 green roofs, up to 50% of remaining standard roof
    spread('greenRoof', totals.greenRoof,
      function (z) { return 0.5 * rem[z.id].roof; },
      function (z) { return rem[z.id].roof; });
    // 8 rainwater tanks, weighted by roof area
    spread('rwhTank', totals.rwhTank,
      function (z) { return rem[z.id].roofAll > 500 ? 400 : 0; },
      function (z) { return rem[z.id].roofAll; });
    return plan;
  }

  /* Upper bounds of each campus total, used to sample and to size sliders. */
  function maxTotals(zones, settings) {
    var S = withDefaults(settings);
    var cpt = S.canopyPerTree;
    var m = { treesLawn: 0, treesPaved: 0, depavePerm: 0, depaveLawn: 0, coolRoof: 0, greenRoof: 0, solarCanopy: 0, rwhTank: 0 };
    zones.forEach(function (z) {
      var c = baseCover(z);
      m.treesLawn += Math.floor(0.5 * c.lawn / cpt);
      m.treesPaved += Math.floor(0.35 * c.pavedImp / cpt);
      m.depavePerm += 0.6 * c.pavedImp;
      m.depaveLawn += 0.3 * c.pavedImp;
      m.coolRoof += c.roofStd;
      m.greenRoof += 0.5 * c.roofStd;
      if (z.type === 'parking') m.solarCanopy += 0.6 * c.pavedImp;
      if (c.roofStd + c.roofCool + c.roofGreen > 500) m.rwhTank += 400;
    });
    return m;
  }

  /* Optimizer objective, 0..1. Cost is handled as a hard budget constraint outside. */
  function scoreOutputs(baseOut, out, weights) {
    var gHeat = clamp((baseOut.surfTemp - out.surfTemp) / 2.0, 0, 1);
    var gWater = baseOut.runoff > 0 ? clamp((baseOut.runoff - out.runoff) / baseOut.runoff / 0.5, 0, 1) : 0;
    var gCarbon = baseOut.co2 > 0 ? clamp((baseOut.co2 - out.co2) / baseOut.co2 / 0.2, 0, 1) : 0;
    var gIrrig = baseOut.irrig > 0 ? clamp(1 - (out.irrig - baseOut.irrig) / (0.2 * baseOut.irrig), 0, 1) : 1;
    var ws = (weights.heat || 0) + (weights.water || 0) + (weights.carbon || 0) + (weights.irrig || 0);
    if (ws <= 0) return 0;
    return ((weights.heat || 0) * gHeat + (weights.water || 0) * gWater + (weights.carbon || 0) * gCarbon + (weights.irrig || 0) * gIrrig) / ws;
  }

  /* Short fingerprint of everything the surrogate model was trained on. */
  function stateKey(zones, settings) {
    var S = withDefaults(settings);
    var parts = [];
    zones.forEach(function (z) {
      parts.push(z.id, z.type);
      COVER_KEYS.forEach(function (k) { parts.push(Math.round(num(z[k]))); });
      parts.push(Math.round(num(z.coolingKwh)));
    });
    ['gridEF', 'et0', 'irrigDays', 'irrigEff', 'canopyPerTree', 'solarYield', 'rwhFills', 'annualRainMm'].forEach(function (k) { parts.push(S[k]); });
    var s = parts.join('|'), h = 5381;
    for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return (h >>> 0).toString(16);
  }

  function featureVector(zones, plan, settings) {
    var S = withDefaults(settings);
    var t = planTotals(zones, plan, S);
    return IV_KEYS_FEATURE.map(function (k) { return t[k]; }).concat([S.ambientC, S.stormMm]);
  }
  var CLIMATE_FEATURES = ['ambientC', 'stormMm'];
  var CLIMATE_RANGE = { ambientC: [30, 45], stormMm: [30, 150] };   // range the surrogate was trained on
  var IV_KEYS_FEATURE = ['solarCanopy', 'treesPaved', 'depavePerm', 'depaveLawn', 'treesLawn', 'coolRoof', 'greenRoof', 'rwhTank'];

  return {
    COVER_KEYS: COVER_KEYS, COVER_LABELS: COVER_LABELS, IV_KEYS: IV_KEYS, IV_META: IV_META,
    FEATURES: IV_KEYS_FEATURE, CLIMATE_FEATURES: CLIMATE_FEATURES, CLIMATE_RANGE: CLIMATE_RANGE, SETS: SETS, KC: KC,
    DEFAULT_SETTINGS: DEFAULT_SETTINGS, DEMO_ZONES: DEMO_ZONES,
    withDefaults: withDefaults, zoneTotal: zoneTotal, baseCover: baseCover,
    capacities: capacities, normalizeIv: normalizeIv, applyIv: applyIv,
    simulate: simulate, allocate: allocate, maxTotals: maxTotals, planTotals: planTotals,
    costOf: costOf, scoreOutputs: scoreOutputs, stateKey: stateKey, featureVector: featureVector,
    scsDepth: scsDepth, round: round, clamp: clamp
  };
});
