/* ===== ClimateTwin AI - view helpers: colours, composition bars, map, charts ===== */

var COMP = [
  { k: 'imp', label: 'Impervious paving', c: '#3E4A56' },
  { k: 'perm', label: 'Permeable paving', c: '#8DB3D6' },
  { k: 'roof', label: 'Roofs', c: '#E2B866' },
  { k: 'green', label: 'Lawn and green roofs', c: '#5FAF85' },
  { k: 'canopy', label: 'Tree canopy', c: '#174B38' }
];
function compGroups(c) {
  return [
    c.pavedImp + c.pavedPv,
    c.pavedPerm,
    c.roofStd + c.roofCool,
    c.lawn + c.roofGreen,
    c.canopy
  ];
}

var RAMPS = {
  heat: ['#FDF1D8', '#F2C46F', '#D98B2B', '#A9561A', '#6E320F'],
  runoff: ['#E9F0F6', '#B5CBE0', '#6F98BF', '#376C9B', '#1B4268']
};
function hex2rgb(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
function rampColor(name, t) {
  var s = RAMPS[name], n = s.length - 1; t = clamp(t, 0, 1);
  var i = Math.min(n - 1, Math.floor(t * n)), f = t * n - i, a = hex2rgb(s[i]), b = hex2rgb(s[i + 1]);
  return 'rgb(' + [0, 1, 2].map(function (j) { return Math.round(a[j] + (b[j] - a[j]) * f); }).join(',') + ')';
}
function lumOf(rgbStr) {
  var m = rgbStr.match(/\d+/g).map(Number).map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
  return 0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2];
}
function inkOn(rgbStr) { return lumOf(rgbStr) > 0.3 ? '#1D2939' : '#FFFFFF'; }

/* Stacked composition bar (HTML). 2px surface gaps between segments. */
function compBar(cover, opts) {
  opts = opts || {};
  var vals = compGroups(cover), tot = vals.reduce(function (a, b) { return a + b; }, 0) || 1;
  var segs = COMP.map(function (g, i) {
    var pct = vals[i] / tot * 100;
    if (pct <= 0) return '';
    return '<span class="seg" style="width:' + pct + '%;background:' + g.c + '" title="' + esc(g.label) + ': ' + n0(vals[i]) + ' m² (' + nd(pct, 1) + '%)"></span>';
  }).join('');
  return '<div class="compbar' + (opts.tall ? ' tall' : '') + '" role="img" aria-label="' + esc(COMP.map(function (g, i) { return g.label + ' ' + nd(vals[i] / tot * 100, 0) + '%'; }).join(', ')) + '">' + segs + '</div>';
}
function compLegend() {
  return '<ul class="legend">' + COMP.map(function (g) { return '<li><i style="background:' + g.c + '"></i>' + esc(g.label) + '</li>'; }).join('') + '</ul>';
}

/* ---------- schematic site map ---------- */
var MAP_RECTS = {
  z1: [16, 16, 296, 204], z6: [324, 16, 164, 204], z3: [500, 16, 204, 204],
  z2: [16, 232, 248, 204], z4: [276, 232, 212, 204], z5: [500, 232, 204, 204]
};
var LAYERS = {
  land: { label: 'Land use', unit: '' },
  heat: { label: 'Surface heat', unit: '°C', lo: 38, hi: 50, ramp: 'heat' },
  runoff: { label: 'Storm runoff', unit: 'mm', lo: 10, hi: 70, ramp: 'runoff' }
};
function layerValue(layer, m) {
  if (layer === 'heat') return m.surfTemp;
  if (layer === 'runoff') return m.runoff / m.total * 1000;
  return m.imp / m.total * 100;
}
function mapSvg(sim, layer, view, selId) {
  var L = LAYERS[layer], cover = {};
  var parts = ['<svg viewBox="0 0 720 452" class="map" role="group" aria-label="Schematic site map of the campus zones. Not to scale.">'];
  sim.zones.forEach(function (z) {
    var m = view === 'baseline' ? z.base : z.prop;
    var zone = zoneById(z.id);
    var cv = view === 'baseline' ? CT.baseCover(zone) : CT.applyIv(zone, sim.plan[z.id] || curIvZero(), sim.settings);
    var r = MAP_RECTS[z.id], x = r[0], y = r[1], w = r[2], h = r[3];
    var v = layerValue(layer, m), fill = '#FFFFFF', ink = '#1D2939';
    if (layer !== 'land') { fill = rampColor(L.ramp, (v - L.lo) / (L.hi - L.lo)); ink = inkOn(fill); }
    var sel = z.id === selId;
    var big = layer === 'land' ? nd(v, 0) + '% impervious' : nd(v, layer === 'heat' ? 1 : 0) + ' ' + L.unit;
    var label = z.name + ', ' + n0(m.total) + ' square metres, ' + (layer === 'land' ? nd(v, 0) + ' percent impervious' : L.label + ' ' + nd(v, 1) + ' ' + L.unit) + '. Select to inspect.';
    parts.push('<g class="zone' + (sel ? ' sel' : '') + '" data-zone="' + z.id + '" role="button" tabindex="0" aria-pressed="' + sel + '" aria-label="' + esc(label) + '">');
    parts.push('<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="12" fill="' + fill + '" stroke="' + (sel ? '#174B38' : '#CBD2D9') + '" stroke-width="' + (sel ? 3 : 1) + '"/>');
    parts.push('<text x="' + (x + 16) + '" y="' + (y + 30) + '" font-size="14" font-weight="600" fill="' + ink + '">' + esc(z.name) + '</text>');
    parts.push('<text x="' + (x + 16) + '" y="' + (y + 50) + '" font-size="12" fill="' + ink + '" opacity="0.85">' + n0(m.total) + ' m²</text>');
    parts.push('<text x="' + (x + 16) + '" y="' + (y + h - 56) + '" font-size="' + (layer === 'land' ? 18 : 26) + '" font-weight="600" fill="' + ink + '">' + esc(big) + '</text>');
    // composition strip
    var vals = compGroups(cv), tot = vals.reduce(function (a, b) { return a + b; }, 0) || 1, cx = x + 16, avail = w - 32 - 2 * (COMP.length - 1);
    vals.forEach(function (val, i) {
      var sw = val / tot * avail; if (sw <= 0.4) return;
      parts.push('<rect x="' + cx.toFixed(1) + '" y="' + (y + h - 32) + '" width="' + sw.toFixed(1) + '" height="12" rx="3" fill="' + COMP[i].c + '"/>');
      cx += sw + 2;
    });
    parts.push('</g>');
  });
  parts.push('<text x="16" y="448" font-size="11" fill="#667085">Schematic layout, not to scale. Not derived from satellite imagery.</text>');
  parts.push('</svg>');
  return parts.join('');
}
function curIvZero() { var o = {}; CT.IV_KEYS.forEach(function (k) { o[k] = 0; }); return o; }
function layerLegend(layer) {
  if (layer === 'land') return compLegend();
  var L = LAYERS[layer], stops = RAMPS[L.ramp].join(',');
  return '<div class="ramp-legend"><span>' + L.lo + ' ' + L.unit + '</span><i style="background:linear-gradient(90deg,' + stops + ')"></i><span>' + L.hi + ' ' + L.unit + '</span></div>' +
    '<p class="hint">' + (layer === 'heat' ? 'Indicative midday surface temperature, area-weighted per zone. Compare zones, do not read it as a measurement.' : 'Runoff depth over the zone for the design storm, in mm.') + '</p>';
}

/* ---------- paired before/after bars ---------- */
function pairedBars(rows) {
  var html = rows.map(function (m) {
    var bv = m.excess ? m.b - state.settings.ambientC : m.b, pv = m.excess ? m.p - state.settings.ambientC : m.p;
    var mx = Math.max(Math.abs(bv), Math.abs(pv), 1e-9);
    var bw = Math.abs(bv) / mx * 100, pw = Math.abs(pv) / mx * 100;
    var lab = m.excess ? 'Surface heat above air temperature' : (m.short || m.label);
    var unit = m.unit;
    var bt = nd(bv, m.d), pt = nd(pv, m.d);
    return '<div class="pb-row"><div class="pb-label"><span>' + esc(lab) + '</span>' + deltaChip(m) + '</div>' +
      '<div class="pb-bars" role="img" aria-label="' + esc(lab + ': baseline ' + bt + ' ' + unit + ', proposed ' + pt + ' ' + unit) + '">' +
      '<div class="pb-line"><span class="pb-track"><span class="pb-bar base" style="width:' + bw + '%"></span></span><span class="pb-val">' + bt + ' ' + esc(unit) + '</span></div>' +
      '<div class="pb-line"><span class="pb-track"><span class="pb-bar prop" style="width:' + pw + '%"></span></span><span class="pb-val strong">' + pt + ' ' + esc(unit) + '</span></div>' +
      '</div></div>';
  }).join('');
  return '<div class="pb">' + html + '</div><ul class="legend inline"><li><i class="sw base"></i>Baseline</li><li><i class="sw prop"></i>Proposed</li></ul>';
}

/* ---------- Pune climate normals (public compilation of station data, 1991-2020) ---------- */
var CLIMATE = {
  months: ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'],
  names: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  tmax: [30.0, 32.2, 36.1, 37.8, 37.2, 31.7, 28.3, 27.8, 29.4, 31.7, 30.6, 29.4],
  tmin: [11.1, 12.2, 15.6, 19.4, 22.8, 22.8, 22.2, 21.7, 21.1, 18.3, 15.0, 11.7],
  rain: [5.1, 2.5, 5.1, 22.9, 12.7, 218.4, 228.6, 144.8, 129.5, 86.4, 5.1, 5.1]
};
function rainChart() {
  var W = 360, H = 170, L = 34, R = 8, T = 18, B = 24, iw = W - L - R, ih = H - T - B, max = 250, bw = 16;
  var s = ['<svg viewBox="0 0 ' + W + ' ' + H + '" class="chart" role="img" aria-label="Pune monthly rainfall in millimetres. July is highest at 228.6 mm. June to September bring about 83 percent of the 866 mm annual total.">'];
  [0, 100, 200].forEach(function (t) {
    var y = T + ih - t / max * ih;
    s.push('<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y + '" y2="' + y + '" stroke="#E5E7EB"/>');
    s.push('<text x="' + (L - 6) + '" y="' + (y + 4) + '" font-size="11" text-anchor="end" fill="#667085">' + t + '</text>');
  });
  CLIMATE.rain.forEach(function (v, i) {
    var step = iw / 12, x = L + i * step + (step - bw) / 2, h = v / max * ih, y = T + ih - h;
    s.push('<path d="M' + x + ' ' + (T + ih) + 'V' + (y + 4) + 'Q' + x + ' ' + y + ' ' + (x + 4) + ' ' + y + 'H' + (x + bw - 4) + 'Q' + (x + bw) + ' ' + y + ' ' + (x + bw) + ' ' + (y + 4) + 'V' + (T + ih) + 'Z" fill="#376C9B"><title>' + CLIMATE.names[i] + ': ' + CLIMATE.rain[i] + ' mm</title></path>');
    s.push('<text x="' + (x + bw / 2) + '" y="' + (H - 7) + '" font-size="11" text-anchor="middle" fill="#667085">' + CLIMATE.months[i] + '</text>');
  });
  s.push('<text x="' + (L + 6 * (iw / 12) + 4) + '" y="' + (T + ih - 228.6 / max * ih - 5) + '" font-size="11" fill="#344054" text-anchor="middle">228.6 mm</text>');
  s.push('</svg>');
  return s.join('');
}
function tempChart() {
  var W = 360, H = 170, L = 34, R = 8, T = 18, B = 24, iw = W - L - R, ih = H - T - B, lo = 10, hi = 40;
  var s = ['<svg viewBox="0 0 ' + W + ' ' + H + '" class="chart" role="img" aria-label="Pune average daily maximum temperature by month. April is hottest at 37.8 degrees Celsius.">'];
  [10, 20, 30, 40].forEach(function (t) {
    var y = T + ih - (t - lo) / (hi - lo) * ih;
    s.push('<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y + '" y2="' + y + '" stroke="#E5E7EB"/>');
    s.push('<text x="' + (L - 6) + '" y="' + (y + 4) + '" font-size="11" text-anchor="end" fill="#667085">' + t + '</text>');
  });
  var pts = CLIMATE.tmax.map(function (v, i) { var step = iw / 12; return [L + i * step + step / 2, T + ih - (v - lo) / (hi - lo) * ih]; });
  s.push('<path d="M' + pts.map(function (p) { return p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join('L') + '" fill="none" stroke="#B7791F" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>');
  pts.forEach(function (p, i) {
    if (i === 3) {
      s.push('<circle cx="' + p[0] + '" cy="' + p[1] + '" r="5" fill="#B7791F" stroke="#FFFFFF" stroke-width="2"><title>Apr: 37.8 °C</title></circle>');
      s.push('<text x="' + p[0] + '" y="' + (p[1] - 10) + '" font-size="11" text-anchor="middle" fill="#344054">37.8 °C</text>');
    }
    s.push('<text x="' + p[0] + '" y="' + (H - 7) + '" font-size="11" text-anchor="middle" fill="#667085">' + CLIMATE.months[i] + '</text>');
  });
  s.push('</svg>');
  return s.join('');
}

/* ---------- horizontal importance bars ---------- */
function importanceBars(imp) {
  var items = Object.keys(imp).map(function (k) { return { k: k, v: imp[k] }; }).sort(function (a, b) { return b.v - a.v; });
  var mx = items[0] ? items[0].v : 1;
  return '<div class="ib">' + items.map(function (it) {
    return '<div class="ib-row"><span class="ib-label">' + esc(featLabel(it.k)) + '</span><span class="ib-track"><span class="ib-bar" style="width:' + (it.v / mx * 100) + '%"></span></span><span class="ib-val">' + nd(it.v * 100, 0) + '%</span></div>';
  }).join('') + '</div>';
}

function iconSvg(name) {
  var p = {
    overview: '<path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    twin: '<path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z"/><path d="M9 3v15M15 6v15"/>',
    sim: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
    cmp: '<path d="M5 20V10M12 20V4M19 20v-7"/>',
    rec: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.8.8 1 1.5 1 2.5h6c0-1 .2-1.7 1-2.5A6 6 0 0 0 12 3z"/>',
    hist: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
    meth: '<path d="M9 3h6M10 3v6L5 19a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-10V3"/><path d="M7.5 15h9"/>',
    set: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>'
  };
  return '<svg class="ico" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (p[name] || '') + '</svg>';
}
