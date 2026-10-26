/* ===== ClimateTwin AI - page renderers ===== */

var PAGES = [
  { id: 'overview', label: 'Overview', icon: 'overview' },
  { id: 'twin', label: 'Digital Twin', icon: 'twin' },
  { id: 'simulator', label: 'Scenario Simulator', icon: 'sim' },
  { id: 'comparison', label: 'Impact Comparison', icon: 'cmp' },
  { id: 'recommendations', label: 'Recommendations', icon: 'rec' },
  { id: 'history', label: 'Scenario History', icon: 'hist' },
  { id: 'methodology', label: 'Data and Methodology', icon: 'meth' },
  { id: 'settings', label: 'Settings', icon: 'set' }
];
function pageMeta(id) { return PAGES.filter(function (p) { return p.id === id; })[0] || PAGES[0]; }

var BADGES = {
  real: ['Real observation', 'b-real'],
  illus: ['Sample data', 'b-illus'],
  assume: ['Assumption', 'b-assume'],
  calc: ['Calculated estimate', 'b-calc'],
  model: ['Model prediction (ML)', 'b-model'],
  none: ['Not integrated yet', 'b-none']
};
function badge(t) { return '<span class="badge ' + BADGES[t][1] + '">' + BADGES[t][0] + '</span>'; }
function card(title, body, cls, extra) {
  return '<section class="card ' + (cls || '') + '"' + (extra || '') + '>' + (title ? '<h2 class="card-title">' + title + '</h2>' : '') + body + '</section>';
}
function pageHead(title, sub, actions) {
  return '<div class="pagehead"><div><h1>' + esc(title) + '</h1><p class="sub">' + esc(sub) + '</p></div>' + (actions ? '<div class="pageactions">' + actions + '</div>' : '') + '</div>';
}
function emptyBox(title, body, action) {
  return '<div class="empty"><strong>' + esc(title) + '</strong><p>' + body + '</p>' + (action || '') + '</div>';
}

/* ---------- shell ---------- */
function shell() {
  var nav = PAGES.map(function (p) {
    return '<button type="button" class="nav-item" data-nav="' + p.id + '"' + (state.page === p.id ? ' aria-current="page"' : '') + '>' + iconSvg(p.icon) + '<span>' + esc(p.label) + '</span></button>';
  }).join('');
  return '<a class="skip" href="#main-content">Skip to content</a>' +
    '<div class="app">' +
    '<header class="mtop"><div class="brand sm"><span class="brandmark" aria-hidden="true"></span><span>ClimateTwin <b>AI</b></span></div>' +
    '<button type="button" class="btn btn-ghost on-dark" data-action="menu" aria-expanded="' + state.menuOpen + '" aria-controls="sidenav">' + (state.menuOpen ? 'Close' : 'Menu') + '</button></header>' +
    '<aside class="side' + (state.menuOpen ? ' open' : '') + '" id="sidenav">' +
    '<button type="button" class="brand brandbtn" data-action="home" aria-label="ClimateTwin AI home"><span class="brandmark" aria-hidden="true"></span><div><div class="brandname">ClimateTwin <b>AI</b></div><div class="brandsub">Climate Impact Simulator</div></div></button>' +
    '<nav aria-label="Primary" class="nav">' + nav + '</nav>' +
    '<div class="sidefoot"><p>Simulate before you build.</p><p class="tiny">AI for Climate Change &middot; PCCOE International Grand Challenge 2026</p></div>' +
    '</aside>' +
    '<main id="main-content" tabindex="-1"><div class="topbar" id="topbar">' + topbar() + '</div><div id="page">' + pageHtml() + '</div></main>' +
    '</div><div id="modal-root">' + modalHtml() + '</div><div id="tour-root">' + tourHtml() + '</div>' +
    '<div id="toast" class="toast" role="status" aria-live="polite"></div><div id="sr-live" class="sr" aria-live="polite"></div>';
}
function topbar() {
  var empty = planIsEmpty();
  return '<div class="tb-left"><div class="tb-campus">PCCOE Pune &middot; demo layout</div><div class="tb-sub">Pune, Maharashtra &middot; 866 mm yearly rain &middot; 37.8 °C April mean maximum</div></div>' +
    '<div class="tb-right"><span class="chip chip-scn" title="' + esc(state.desc) + '"><span class="muted">Scenario</span> <strong>' + esc(state.name) + '</strong></span>' +
    '<button type="button" class="btn btn-secondary" data-action="reset-plan"' + (empty ? ' disabled' : '') + '>Reset</button>' +
    '<button type="button" class="btn btn-primary" data-action="open-save"' + (empty ? ' disabled' : '') + '>Save run</button></div>';
}
function pageHtml() {
  var fn = { overview: pageOverview, twin: pageTwin, simulator: pageSimulator, comparison: pageComparison, recommendations: pageRecommendations, history: pageHistory, methodology: pageMethodology, settings: pageSettings }[state.page] || pageOverview;
  return fn();
}

/* ---------- overview ---------- */
function tileHtml(m) {
  var rng = m.range && isChanged(m) ? '<p class="hint">Range of change: ' + sgn(m.range.lo, m.d) + ' to ' + sgn(m.range.hi, m.d) + ' ' + esc(m.unit) + '</p>' : '';
  return '<article class="tile"><h3>' + esc(m.short || m.label) + '</h3>' +
    '<div class="tile-val">' + nd(m.p, m.d) + '<span class="unit">' + esc(m.unit) + '</span></div>' +
    '<div class="tile-meta">' + deltaChip(m) + '<span class="muted">Baseline ' + nd(m.b, m.d) + '</span></div>' +
    rng + '<p class="hint">' + esc(m.hint) + '</p></article>';
}
function pageOverview() {
  var sim = getSim(), rows = metricRows(sim), empty = planIsEmpty();
  var tiles = ['green', 'imp', 'temp', 'runoff', 'cool', 'co2'].map(function (id) { return tileHtml(rowById(rows, id)); }).join('');
  var facts = zoneFacts(sim).sort(function (a, b) { return b.priority - a.priority; });
  var prio = facts.map(function (f, i) {
    return '<li class="prio"><span class="rank">' + (i + 1) + '</span><div class="prio-main"><div class="prio-top"><strong>' + esc(f.name) + '</strong><span class="muted">' + nd(f.priority, 0) + '/100</span></div>' +
      '<span class="meter" aria-hidden="true"><span style="width:' + f.priority + '%"></span></span>' +
      '<div class="prio-facts">' + nd(f.impPct, 0) + '% impervious &middot; ' + nd(f.temp, 1) + ' °C midday surface &middot; ' + nd(f.qDepth, 0) + ' mm runoff</div></div>' +
      '<button type="button" class="btn btn-ghost sm" data-action="inspect" data-zone="' + f.id + '">Inspect</button></li>';
  }).join('');
  var cands = scoreCandidates(buildCandidates(), state.weights), top = cands[0];
  var next = top ? '<div class="next"><span class="eyebrow">Recommended next action</span><h3>' + esc(CAND_META[top.key].title) + ' in ' + esc(top.zoneName) + '</h3><p>' + esc(whyText(top, sim.settings)) + '</p>' +
    '<div class="row"><button type="button" class="btn btn-primary" data-action="try-cand" data-i="0">Try it in the simulator</button><button type="button" class="btn btn-secondary" data-nav="recommendations">See all ranked actions</button></div></div>' : '';
  var rec = state.saved.slice(0, 3).map(function (s) {
    return '<li class="rowline"><div><strong>' + esc(s.name) + '</strong><div class="muted tiny">' + esc(s.created || '') + '</div></div><button type="button" class="btn btn-ghost sm" data-action="load-saved" data-id="' + s.id + '">Open</button></li>';
  }).join('');
  var viewToggle = empty ? '' : '<div class="seg-ctl" role="group" aria-label="Map view"><button type="button" data-action="view" data-v="baseline" aria-pressed="' + (state.view === 'baseline') + '">Baseline</button><button type="button" data-action="view" data-v="proposed" aria-pressed="' + (state.view === 'proposed') + '">Proposed</button></div>';
  var view = empty ? 'baseline' : state.view;
  return pageHead('Climate Overview', 'Explore climate impacts before making development decisions.',
    '<button type="button" class="btn btn-primary" data-action="start-tour">Start guided demo</button><button type="button" class="btn btn-secondary" data-nav="simulator">Open simulator</button>') +
    '<div class="notice"><strong>Sample data, not a survey.</strong> Zone areas and baseline cooling electricity are demonstration values for the PCCOE campus. Edit them in Digital Twin. All results below are <strong>calculated estimates</strong>; only the Pune climate normals are real observations.' + dataTypeLegend(false) + '</div>' +
    '<div class="tiles">' + tiles + '</div>' +
    '<div class="grid g-7-5">' +
    card('Campus digital twin <span class="badge b-illus">Illustrative layout</span>', '<div class="card-tools">' + layerToggle() + viewToggle + '</div><div class="mapwrap">' + mapSvg(sim, state.layer, view, state.selZone) + '</div>' + layerLegend(state.layer) + (next ? '<div class="accent-inline">' + next + '</div>' : ''), 'span') +
    '<div class="stack">' + card('Where to act first', '<p class="hint">Zones ranked by midday surface heat, storm runoff and share of impervious surface.</p><ol class="priolist">' + prio + '</ol>') + '</div>' +
    '</div>' +
    '<div class="grid g-2">' +
    card('Pune climate context <span class="badge b-real">Real external data</span>',
      '<div class="two-charts"><figure><figcaption>Monthly rainfall, mm</figcaption>' + rainChart() + '</figure><figure><figcaption>Average daily maximum, °C</figcaption>' + tempChart() + '</figure></div>' +
      '<p class="hint">Normals 1991–2020 from a public compilation of Pune station data (climate-zone.com), converted from °F and inches. June to September bring about 83% of the 866 mm yearly rain. The April mean maximum of 37.8 °C sets the hot-day air temperature used by the heat indicator.</p>') +
    card('Recent scenario activity', rec ? '<ul class="plain">' + rec + '</ul>' : emptyBox('Nothing saved yet', 'Build a scenario in the simulator and choose Save run. Saved scenarios appear here.', '<button type="button" class="btn btn-secondary" data-nav="simulator">Open simulator</button>')) +
    '</div>';
}
function layerToggle() {
  return '<div class="seg-ctl" role="group" aria-label="Map layer">' + Object.keys(LAYERS).map(function (k) {
    return '<button type="button" data-action="layer" data-l="' + k + '" aria-pressed="' + (state.layer === k) + '">' + esc(LAYERS[k].label) + '</button>';
  }).join('') + '</div>';
}

/* ---------- digital twin ---------- */
function coverTable(zone, ivn, S, showProp) {
  var base = CT.baseCover(zone), prop = CT.applyIv(zone, ivn, S), tb = CT.zoneTotal(zone);
  var rows = CT.COVER_KEYS.map(function (k) {
    return '<tr><th scope="row">' + esc(CT.COVER_LABELS[k]) + '</th><td class="num">' + n0(base[k]) + '</td><td class="num">' + nd(base[k] / tb * 100, 1) + '%</td>' + (showProp ? '<td class="num strong">' + n0(prop[k]) + '</td>' : '') + '</tr>';
  }).join('');
  return '<div class="tablewrap"><table class="tbl compact"><thead><tr><th scope="col">Land cover</th><th scope="col" class="num">Baseline m²</th><th scope="col" class="num">Share</th>' + (showProp ? '<th scope="col" class="num">Proposed m²</th>' : '') + '</tr></thead><tbody>' + rows +
    '<tr class="totalrow"><th scope="row">Total</th><td class="num">' + n0(tb) + '</td><td class="num">100%</td>' + (showProp ? '<td class="num strong">' + n0(tb) + '</td>' : '') + '</tr></tbody></table></div>';
}
function pageTwin() {
  var sim = getSim(), zone = zoneById(state.selZone) || state.zones[0], zr = sim.zones.filter(function (z) { return z.id === zone.id; })[0];
  var ivn = sim.plan[zone.id] || curIvZero(), empty = planIsEmpty();
  var view = empty ? 'baseline' : state.view;
  var viewToggle = empty ? '' : '<div class="seg-ctl" role="group" aria-label="Map view"><button type="button" data-action="view" data-v="baseline" aria-pressed="' + (state.view === 'baseline') + '">Baseline</button><button type="button" data-action="view" data-v="proposed" aria-pressed="' + (state.view === 'proposed') + '">Proposed</button></div>';
  var showProp = CT.IV_KEYS.some(function (k) { return ivn[k] > 0; });
  var m = zr.base, p = zr.prop;
  var inspector = '<h3 class="zname">' + esc(zone.name) + '</h3><p class="muted">' + esc(zoneTypeLabel(zone.type)) + ' &middot; ' + n0(CT.zoneTotal(zone)) + ' m²</p>' +
    compBar(CT.baseCover(zone), { tall: true }) + compLegend() +
    '<dl class="kv"><div><dt>Midday surface temperature</dt><dd>' + nd(m.surfTemp, 1) + ' °C' + (showProp ? ' &rarr; <strong>' + nd(p.surfTemp, 1) + ' °C</strong>' : '') + '</dd></div>' +
    '<div><dt>Runoff, ' + sim.settings.stormMm + ' mm storm</dt><dd>' + n0(m.runoff) + ' m³' + (showProp ? ' &rarr; <strong>' + n0(p.runoff) + ' m³</strong>' : '') + '</dd></div>' +
    '<div><dt>Composite curve number</dt><dd>' + nd(m.cn, 0) + (showProp ? ' &rarr; <strong>' + nd(p.cn, 0) + '</strong>' : '') + '</dd></div>' +
    '<div><dt>Cooling electricity</dt><dd>' + n0(m.cooling / 1000) + ' MWh/yr' + (showProp ? ' &rarr; <strong>' + n0(p.cooling / 1000) + ' MWh/yr</strong>' : '') + '</dd></div></dl>' +
    coverTable(zone, ivn, sim.settings, showProp) +
    '<div class="row"><button type="button" class="btn btn-primary" data-action="goto-sim" data-zone="' + zone.id + '">Plan changes in this zone</button><button type="button" class="btn btn-secondary" data-action="toggle-edit" aria-expanded="' + state.editOpen + '">' + (state.editOpen ? 'Close editor' : 'Edit baseline values') + '</button></div>' +
    (state.editOpen ? editForm(zone) : '');
  return pageHead('Campus Digital Twin', 'Select a zone to inspect its land cover. Change the baseline if you have measured values.') +
    '<div class="grid g-8-4">' +
    card('Site map', '<div class="card-tools">' + layerToggle() + viewToggle + '</div><div class="mapwrap">' + mapSvg(sim, state.layer, view, zone.id) + '</div>' + layerLegend(state.layer) +
      '<details class="alt"><summary>Table view of all zones</summary>' + zonesTable(sim) + '</details>', 'span') +
    card('Zone inspector <span class="badge b-illus">Illustrative areas</span>', inspector) +
    '</div>';
}
function zoneTypeLabel(t) { return { academic: 'Academic', residential: 'Residential', parking: 'Parking', green: 'Green space', sports: 'Sports', admin: 'Administration' }[t] || t; }
function zonesTable(sim) {
  var rows = sim.zones.map(function (z) {
    return '<tr><th scope="row">' + esc(z.name) + '</th><td class="num">' + n0(z.base.total) + '</td><td class="num">' + nd(z.base.greenPct || z.base.green / z.base.total * 100, 0) + '%</td><td class="num">' + nd(z.base.imp / z.base.total * 100, 0) + '%</td><td class="num">' + nd(z.base.surfTemp, 1) + '</td><td class="num">' + n0(z.base.runoff) + '</td><td class="num">' + n0(z.base.cooling / 1000) + '</td></tr>';
  }).join('');
  return '<div class="tablewrap"><table class="tbl compact"><thead><tr><th scope="col">Zone</th><th scope="col" class="num">Area m²</th><th scope="col" class="num">Green</th><th scope="col" class="num">Impervious</th><th scope="col" class="num">Surface °C</th><th scope="col" class="num">Runoff m³</th><th scope="col" class="num">Cooling MWh/yr</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
}
function editForm(zone) {
  var fields = CT.COVER_KEYS.map(function (k) {
    return '<div class="field"><label for="ed-' + k + '">' + esc(CT.COVER_LABELS[k]) + ' (m²)</label><input id="ed-' + k + '" type="number" inputmode="decimal" min="0" step="10" value="' + Math.round(zone[k]) + '" data-ed="' + k + '"></div>';
  }).join('');
  return '<form class="editform" data-form="edit-zone" novalidate><h4>Edit baseline: ' + esc(zone.name) + '</h4><p class="hint">Enter measured areas. All eight land-cover values together define the zone area. Existing scenario changes are re-checked against the new values.</p>' +
    '<div class="fields">' + fields + '<div class="field"><label for="ed-coolingKwh">Annual cooling electricity (kWh)</label><input id="ed-coolingKwh" type="number" inputmode="decimal" min="0" step="1000" value="' + Math.round(zone.coolingKwh) + '" data-ed="coolingKwh"></div></div>' +
    '<p class="hint" id="ed-total">Zone area: ' + n0(CT.zoneTotal(zone)) + ' m²</p><p id="ed-msg" class="formmsg" role="alert"></p>' +
    '<div class="row"><button type="submit" class="btn btn-primary">Apply values</button><button type="button" class="btn btn-secondary" data-action="reset-zone" data-zone="' + zone.id + '">Restore demo values for this zone</button><button type="button" class="btn btn-ghost" data-action="reset-all-zones">Restore whole demo layout</button></div></form>';
}

/* ---------- simulator ---------- */
function ivStep(k) { return CT.IV_META[k].unit === 'trees' ? 1 : (k === 'rwhTank' ? 5 : 50); }
function fmtq(v, k, S) {
  var meta = CT.IV_META[k];
  if (meta.unit === 'trees') return '+' + n0(v) + ' trees (' + n0(v * S.canopyPerTree) + ' m² canopy)';
  return (v > 0 ? '+' : '') + n0(v) + ' ' + meta.unit;
}
var SLIDER_GROUPS = [
  { title: 'Trees and green space', keys: ['treesPaved', 'treesLawn', 'depaveLawn'] },
  { title: 'Water and surfaces', keys: ['depavePerm', 'rwhTank'] },
  { title: 'Roofs and energy', keys: ['coolRoof', 'greenRoof', 'solarCanopy'] }
];
function sliderRow(zone, k, iv, caps, S) {
  var meta = CT.IV_META[k], cap = caps[k], dis = cap <= 0 && iv[k] <= 0;
  return '<div class="slrow' + (dis ? ' off' : '') + '"><div class="sl-top"><label for="sl-' + k + '">' + esc(meta.label) + '</label><output id="o-' + k + '" for="sl-' + k + '">' + esc(fmtq(iv[k], k, S)) + '</output></div>' +
    '<input type="range" id="sl-' + k + '" data-iv="' + k + '" min="0" max="' + Math.max(cap, iv[k], 0) + '" step="' + ivStep(k) + '" value="' + iv[k] + '"' + (dis ? ' disabled' : '') + '>' +
    '<div class="sl-foot"><span id="cap-' + k + '">' + (dis ? 'Not available in this zone' : 'Up to ' + n0(cap) + ' ' + meta.unit + ' available') + '</span><span id="cost-' + k + '">' + (iv[k] > 0 ? inr(iv[k] * S.costs[meta.costKey]) : '') + '</span></div></div>';
}
function zoneControls() {
  var zone = zoneById(state.selZone) || state.zones[0], S = state.settings, iv = curIv(zone.id), caps = CT.capacities(zone, iv, S);
  var groups = SLIDER_GROUPS.map(function (g) {
    return '<div class="slgroup"><h4>' + esc(g.title) + '</h4>' + g.keys.map(function (k) { return sliderRow(zone, k, iv, caps, S); }).join('') + '</div>';
  }).join('');
  return '<div class="zonehead"><div><h3 class="zname">' + esc(zone.name) + '</h3><p class="muted">' + esc(zoneTypeLabel(zone.type)) + ' &middot; ' + n0(CT.zoneTotal(zone)) + ' m²</p></div></div>' + compBar(CT.baseCover(zone)) + compLegend() + '<div class="slgrid">' + groups + '</div>';
}
function resultsPanel() {
  var sim = getSim(), rows = metricRows(sim), empty = planIsEmpty();
  var show = ['temp', 'runoff', 'cool', 'co2', 'irrig'].map(function (id) {
    var m = rowById(rows, id);
    return '<div class="lr"><div class="lr-top"><span>' + esc(m.short || m.label) + '</span>' + deltaChip(m) + '</div><div class="lr-vals"><span class="muted">' + nd(m.b, m.d) + '</span> &rarr; <strong>' + nd(m.p, m.d) + ' ' + esc(m.unit) + '</strong></div></div>';
  }).join('');
  var issues = sim.issues.length ? '<div class="alert warn" role="alert"><strong>Adjusted to fit the zone</strong><ul>' + sim.issues.map(function (i) { return '<li>' + esc(i) + '</li>'; }).join('') + '</ul></div>' : '';
  var cost = '<div class="costbox"><div><span class="muted">Indicative cost</span><strong>' + inr(sim.cost.total) + '</strong></div><div><span class="muted">Payback on electricity savings</span><strong>' + (sim.payback ? nd(sim.payback, 1) + ' years' : 'n/a') + '</strong></div></div>';
  return '<div class="lr-list">' + show + '</div>' + cost +
    (empty ? '<p class="hint">Move a slider to see results update. Costs are planning-level assumptions you can edit in Settings.</p>' : '<p class="hint">Payback counts electricity savings only. Heat, runoff and water benefits are not given a money value.</p>') + issues;
}
function pageSimulator() {
  var S = state.settings, empty = planIsEmpty();
  var tabs = state.zones.map(function (z) {
    var changed = CT.IV_KEYS.some(function (k) { return curIv(z.id)[k] > 0; });
    return '<button type="button" class="tab" role="tab" data-action="select-zone" data-zone="' + z.id + '" aria-selected="' + (z.id === state.selZone) + '">' + esc(z.name) + (changed ? '<span class="dot" title="Has changes"></span><span class="sr"> (has changes)</span>' : '') + '</button>';
  }).join('');
  var presets = PRESETS.map(function (p) { return '<button type="button" class="btn btn-secondary sm" data-action="preset" data-id="' + p.id + '" title="' + esc(p.desc) + '">' + esc(p.name) + '</button>'; }).join('');
  return pageHead('Scenario Simulator', 'Propose changes zone by zone. Every slider updates the results straight away.') +
    '<div class="presetbar"><span class="eyebrow">Start from a preset</span><div class="row">' + presets + '</div></div>' +
    '<div class="grid g-8-4 top">' +
    card('', '<div class="tabs" role="tablist" aria-label="Campus zones">' + tabs + '</div><div id="zone-controls">' + zoneControls() + '</div>', 'span') +
    '<div class="stack sticky"><section class="card"><h2 class="card-title">Live results</h2><div class="field"><label for="scn-name">Scenario name</label><input id="scn-name" type="text" maxlength="60" value="' + esc(state.name) + '"></div>' +
    '<div class="field"><label for="scn-desc">Description</label><textarea id="scn-desc" rows="2" maxlength="240">' + esc(state.desc) + '</textarea></div>' +
    '<div id="live-results">' + resultsPanel() + '</div>' +
    '<div class="row"><button type="button" class="btn btn-primary" data-action="open-save"' + (empty ? ' disabled' : '') + ' id="btn-save2">Save scenario</button><button type="button" class="btn btn-secondary" data-nav="comparison">View comparison</button></div></section></div>' +
    '</div>';
}

/* ---------- comparison ---------- */
function pageComparison() {
  var sim = getSim(), rows = metricRows(sim), empty = planIsEmpty(), S = sim.settings;
  if (empty) {
    return pageHead('Impact Comparison', 'Baseline against the proposed scenario.') +
      card('', empty_('No scenario to compare yet', 'Choose a preset or move a slider in the simulator. The comparison then fills in with baseline, proposed and the estimated change.', '<div class="row"><button type="button" class="btn btn-primary" data-nav="simulator">Open simulator</button><button type="button" class="btn btn-secondary" data-action="preset" data-id="combined">Load the Balanced Climate Plan</button></div>'));
  }
  var chartRows = ['green', 'imp', 'shade', 'temp', 'runoff', 'irrig', 'cool', 'co2'].map(function (id) { return rowById(rows, id); });
  var table = rows.map(function (m) {
    var pc = pctChange(m), rg = m.range && isChanged(m) ? sgn(m.range.lo, m.d) + ' to ' + sgn(m.range.hi, m.d) : '–';
    return '<tr><th scope="row">' + esc(m.label) + '<div class="muted tiny">' + esc(m.unit) + '</div></th><td class="num">' + nd(m.b, m.d) + '</td><td class="num strong">' + nd(m.p, m.d) + '</td><td class="num">' + deltaChip(m) + '</td><td class="num">' + (pc == null || !isChanged(m) ? '–' : sgn(pc, 1) + '%') + '</td><td class="num">' + rg + '</td><td><span class="tiny">' + esc(m.basis) + '</span><div class="tiny muted">Confidence: ' + esc(m.conf) + '</div></td></tr>';
  }).join('');
  var worse = rows.filter(function (m) { return isChanged(m) && !isGood(m); });
  var trade = worse.length ? '<ul class="plain">' + worse.map(function (m) {
    var tail = m.id === 'irrig' ? ' More planting and green roofs need more water, and a rainwater tank only offsets part of it.' : '';
    return '<li><strong>' + esc(m.short || m.label) + ' goes the wrong way:</strong> ' + sgn(m.p - m.b, m.d) + ' ' + esc(m.unit) + ' (' + sgn(pctChange(m), 1) + '%).' + tail + '</li>';
  }).join('') + '</ul>' : '<p>No indicator gets worse in this scenario.</p>';
  var zrows = sim.zones.map(function (z) {
    var dT = z.prop.surfTemp - z.base.surfTemp, dR = z.prop.runoff - z.base.runoff;
    return '<tr><th scope="row">' + esc(z.name) + '</th><td class="num">' + nd(z.base.surfTemp, 1) + ' &rarr; <strong>' + nd(z.prop.surfTemp, 1) + '</strong></td><td class="num">' + sgn(dT, 1) + '</td><td class="num">' + n0(z.base.runoff) + ' &rarr; <strong>' + n0(z.prop.runoff) + '</strong></td><td class="num">' + sgn(dR, 0) + '</td><td class="num">' + nd(z.base.green / z.base.total * 100, 0) + '% &rarr; <strong>' + nd(z.prop.green / z.prop.total * 100, 0) + '%</strong></td></tr>';
  }).join('');
  var cost = sim.cost.items.map(function (i) { return '<tr><th scope="row">' + esc(i.label) + '</th><td class="num">' + n0(i.qty) + ' ' + esc(i.unit) + '</td><td class="num">' + inr(i.unitCost) + '</td><td class="num">' + inr(i.cost) + '</td></tr>'; }).join('');
  return pageHead('Impact Comparison', 'Baseline against the proposed scenario: ' + state.name + '.',
    '<button type="button" class="btn btn-primary" data-action="copy-report">Copy report</button><button type="button" class="btn btn-secondary" data-action="download-report">Download report</button>') +
    '<div class="legendnote"><span><i class="sw base"></i>Baseline</span><span><i class="sw prop"></i>Proposed</span><span class="muted">Estimated change, with a range from conservative to optimistic assumptions.</span></div>' +
    '<div class="grid g-7-5">' + card('Baseline versus proposed', pairedBars(chartRows), 'span') +
    '<div class="stack">' + card('Trade-offs to weigh', trade) + card('Cost and payback', '<div class="costbox big"><div><span class="muted">Indicative cost</span><strong>' + inr(sim.cost.total) + '</strong></div><div><span class="muted">Electricity saved</span><strong>' + n0(sim.savedKwh / 1000) + ' MWh/yr</strong></div><div><span class="muted">Payback</span><strong>' + (sim.payback ? nd(sim.payback, 1) + ' yr' : 'n/a') + '</strong></div></div>' +
      '<div class="tablewrap"><table class="tbl compact"><thead><tr><th scope="col">Item</th><th scope="col" class="num">Quantity</th><th scope="col" class="num">Unit cost</th><th scope="col" class="num">Cost</th></tr></thead><tbody>' + cost + '</tbody></table></div><p class="hint">Costs are planning-level assumptions (Settings). Payback counts electricity savings only.</p>') + '</div></div>' +
    calcTraceCard(sim) +
    card('Detailed matrix', '<div class="tablewrap"><table class="tbl"><thead><tr><th scope="col">Indicator</th><th scope="col" class="num">Baseline</th><th scope="col" class="num">Proposed</th><th scope="col" class="num">Change</th><th scope="col" class="num">Change %</th><th scope="col" class="num">Range of change</th><th scope="col">Basis</th></tr></thead><tbody>' + table + '</tbody></table></div>') +
    mlCompareCard(sim) +
    card('By zone', '<div class="tablewrap"><table class="tbl compact"><thead><tr><th scope="col">Zone</th><th scope="col" class="num">Surface °C</th><th scope="col" class="num">Change</th><th scope="col" class="num">Runoff m³</th><th scope="col" class="num">Change</th><th scope="col" class="num">Green cover</th></tr></thead><tbody>' + zrows + '</tbody></table></div>');
}
function empty_(t, b, a) { return emptyBox(t, b, a); }

/* ---------- recommendations ---------- */
function weightField(id, label, hint) {
  return '<div class="wrow"><label for="w-' + id + '">' + esc(label) + '</label><input type="range" id="w-' + id + '" data-w="' + id + '" min="0" max="100" step="5" value="' + state.weights[id] + '"><output id="wo-' + id + '">' + state.weights[id] + '</output><span class="tiny muted">' + esc(hint) + '</span></div>';
}
function pageRecommendations() {
  var S = state.settings, cands = scoreCandidates(buildCandidates(), state.weights);
  var list = cands.slice(0, 8).map(function (c, i) {
    var meta = CAND_META[c.key];
    return '<article class="rec"><div class="rec-top"><div><span class="eyebrow">' + esc(meta.cat) + '</span><h3>' + (i + 1) + '. ' + esc(meta.title) + '</h3><p class="muted">' + esc(c.zoneName) + ' &middot; ' + n0(c.qty) + ' ' + esc(c.unit) + ' &middot; ' + inr(c.cost) + '</p></div><div class="score" aria-label="Score ' + nd(c.score, 0) + ' out of 100"><strong>' + nd(c.score, 0) + '</strong><span>/100</span></div></div>' +
      '<p><strong>Why it ranks here.</strong> ' + esc(whyText(c, S)) + '</p>' +
      '<div class="rec-grid"><div class="benefit"><strong>Estimated benefit</strong><ul class="plain"><li>Campus surface temperature ' + sgn(-c.dTemp, 2) + ' °C</li><li>Storm runoff ' + sgn(-c.dRunoff, 0) + ' m³ per storm</li><li>Net CO₂e ' + sgn(-c.dCo2, 1) + ' t/yr</li></ul></div>' +
      '<div class="tradeoff"><strong>Trade-off</strong><p>' + esc(meta.trade) + (c.dIrrig > 5 ? ' Irrigation demand rises by about ' + n0(c.dIrrig) + ' m³/yr.' : '') + '</p></div></div>' +
      '<div class="row"><button type="button" class="btn btn-secondary sm" data-action="try-cand" data-i="' + i + '">Try in simulator</button></div></article>';
  }).join('');
  var ai = surrogateValid();
  var weights = '<div class="weights">' + weightField('heat', 'Heat', 'Lower surface temperature') + weightField('water', 'Stormwater', 'Less runoff') + weightField('carbon', 'Carbon and energy', 'Lower net CO₂e') + weightField('irrig', 'Low water demand', 'Avoid extra irrigation') + weightField('cost', 'Low cost', 'Ranking list only') + '</div>';
  return pageHead('Recommendations', 'Interventions ranked with a documented score. They change when the baseline, settings or weights change.') +
    '<div class="grid g-4-8 top">' +
    '<div class="stack sticky">' + card('What matters most', weights + '<p class="hint">Score = weighted average of each action’s share of the best result in the list for heat, runoff, carbon and water demand, plus low cost. 0–100, relative to the other options shown.</p>') + optimizerCard(ai) + '</div>' +
    '<div class="stack">' + card('Ranked single interventions', '<p class="hint">Each action is simulated on its own, at a realistic size, against the current baseline. These are candidates to evaluate, not guaranteed outcomes.</p>' + list) + '</div></div>';
}
function optimizerCard(ai) {
  var o = state.opt, body;
  var form = '<div class="field"><label for="budget">Budget (₹ lakh)</label><input id="budget" type="number" inputmode="numeric" min="5" max="2000" step="5" value="' + state.budgetLakh + '"></div>' +
    '<button type="button" class="btn btn-primary" data-action="run-opt"' + (state.optBusy ? ' disabled' : '') + '>' + (state.optBusy ? 'Searching…' : 'Find the best plan within budget') + '</button>' +
    '<p class="hint">' + (ai ? 'The AI surrogate screens 20,000 candidate plans in a fraction of a second. The best five are then re-checked with the exact simulation engine.' : 'The baseline or settings differ from what the surrogate was trained on, so the optimizer uses the exact engine on 2,500 candidate plans instead.') + '</p>';
  if (!o) body = form;
  else if (!o.best) body = form + '<div class="alert warn">No plan fits this budget. Raise the budget and try again.</div>';
  else {
    var b = o.best, sim = b.sim, rows = metricRows(sim);
    var tbl = ['temp', 'runoff', 'co2', 'irrig'].map(function (id) { var m = rowById(rows, id); return '<tr><th scope="row">' + esc(m.short || m.label) + '</th><td class="num">' + nd(m.b, m.d) + '</td><td class="num strong">' + nd(m.p, m.d) + '</td><td class="num">' + sgn(m.p - m.b, m.d) + ' ' + esc(m.unit) + '</td></tr>'; }).join('');
    var items = sim.cost.items.map(function (i) { return '<li>' + esc(i.label) + ': <strong>' + n0(i.qty) + ' ' + esc(i.unit) + '</strong> <span class="muted">(' + inr(i.cost) + ')</span></li>'; }).join('');
    var chk = o.useAI ? '<p class="hint"><strong>Surrogate check.</strong> For this plan the AI predicted ' + nd(b.ai.surfTemp, 2) + ' °C and ' + n0(b.ai.runoff) + ' m³ runoff; the exact engine gives ' + nd(b.exact.surfTemp, 2) + ' °C and ' + n0(b.exact.runoff) + ' m³. Reported results below come from the exact engine.</p>' : '';
    body = form + '<div class="optres"><h3>Best plan found</h3><p class="muted">' + n0(o.evaluated) + ' plans screened in ' + o.ms + ' ms &middot; ' + (o.useAI ? 'AI surrogate + exact verification' : 'exact engine') + ' &middot; cost ' + inr(sim.cost.total) + ' of ' + inr(o.budget) + '</p>' +
      '<ul class="plain items">' + items + '</ul>' + '<div class="tablewrap"><table class="tbl compact"><thead><tr><th scope="col">Indicator</th><th scope="col" class="num">Baseline</th><th scope="col" class="num">Plan</th><th scope="col" class="num">Change</th></tr></thead><tbody>' + tbl + '</tbody></table></div>' + chk +
      '<div class="row"><button type="button" class="btn btn-primary" data-action="load-opt">Load this plan in the simulator</button></div></div>';
  }
  return card('AI plan optimizer', body);
}

/* ---------- history ---------- */
function pageHistory() {
  var S = state.settings;
  var starters = PRESETS.map(function (p) { return '<li class="rowline"><div><strong>' + esc(p.name) + '</strong><div class="muted tiny">' + esc(p.desc) + '</div></div><button type="button" class="btn btn-secondary sm" data-action="preset" data-id="' + p.id + '">Load</button></li>'; }).join('');
  var rows = state.saved.map(function (s) {
    var sim = CT.simulate(state.zones, s.plan, S), c = sim.campus;
    var sel = state.cmp.indexOf(s.id) >= 0;
    var nm = state.renaming === s.id ? '<input type="text" id="rn-' + s.id + '" class="inline-input" value="' + esc(s.name) + '" maxlength="60" aria-label="New name"><button type="button" class="btn btn-primary sm" data-action="rename-ok" data-id="' + s.id + '">Save name</button>' : '<strong>' + esc(s.name) + '</strong><div class="muted tiny">' + esc(s.desc || '') + '</div>';
    var del = state.confirm === s.id ? '<button type="button" class="btn btn-danger sm" data-action="delete-ok" data-id="' + s.id + '">Confirm delete</button><button type="button" class="btn btn-ghost sm" data-action="delete-cancel">Cancel</button>' : '<button type="button" class="btn btn-ghost sm" data-action="delete" data-id="' + s.id + '">Delete</button>';
    return '<tr><td><label class="chk"><input type="checkbox" data-action="cmp-pick" data-id="' + s.id + '"' + (sel ? ' checked' : '') + '><span class="sr">Compare ' + esc(s.name) + '</span></label></td><td>' + nm + '</td><td class="num">' + sgn(c.prop.surfTemp - c.base.surfTemp, 2) + ' °C</td><td class="num">' + sgn(c.prop.runoff - c.base.runoff, 0) + ' m³</td><td class="num">' + sgn(c.prop.co2 - c.base.co2, 0) + ' t</td><td class="num">' + inr(sim.cost.total) + '</td><td class="muted tiny">' + esc(s.created || '') + '</td>' +
      '<td class="actions"><button type="button" class="btn btn-secondary sm" data-action="load-saved" data-id="' + s.id + '">Open</button><button type="button" class="btn btn-ghost sm" data-action="dup" data-id="' + s.id + '">Duplicate</button><button type="button" class="btn btn-ghost sm" data-action="rename" data-id="' + s.id + '">Rename</button>' + del + '</td></tr>';
  }).join('');
  var table = state.saved.length ? '<div class="tablewrap"><table class="tbl"><thead><tr><th scope="col"><span class="sr">Compare</span></th><th scope="col">Scenario</th><th scope="col" class="num">Surface temp</th><th scope="col" class="num">Runoff</th><th scope="col" class="num">Net CO₂e</th><th scope="col" class="num">Cost</th><th scope="col">Saved</th><th scope="col"><span class="sr">Actions</span></th></tr></thead><tbody>' + rows + '</tbody></table></div><p class="hint">Results are recalculated with the current baseline and settings. ' + (storageOk ? 'Scenarios are stored in this browser only.' : 'Storage is unavailable here, so scenarios last only until you close this page.') + '</p>' :
    emptyBox('No saved scenarios', 'Build a scenario in the simulator, then choose Save run. Saved scenarios can be reopened, duplicated and compared side by side.', '<button type="button" class="btn btn-primary" data-nav="simulator">Open simulator</button>');
  return pageHead('Scenario History', 'Save scenarios, reopen them and compare up to three side by side.') +
    card('Saved scenarios', table) + compareCard() + card('Starter scenarios and examples', '<ul class="plain">' + starters + '</ul><div class="row"><button type="button" class="btn btn-secondary" data-action="load-examples">Load example set: A More Trees, B Green Parking, C Both</button></div><p class="hint">Saves three scenarios and ticks them for comparison below.</p>');
}
function compareCard() {
  var picked = state.cmp.map(function (id) { return state.saved.filter(function (s) { return s.id === id; })[0]; }).filter(Boolean);
  if (picked.length < 2) return card('Compare scenarios', '<p class="hint">Tick two or three saved scenarios above to compare them side by side.</p>');
  var S = state.settings, sims = picked.map(function (s) { return CT.simulate(state.zones, s.plan, S); }), rws = sims.map(metricRows);
  var body = rws[0].map(function (m, i) {
    var vals = rws.map(function (r) { return r[i].p; }), best = m.good === 'down' ? Math.min.apply(null, vals) : Math.max.apply(null, vals);
    var tie = vals.every(function (v) { return Math.abs(v - vals[0]) < Math.pow(10, -m.d) / 2; });
    return '<tr><th scope="row">' + esc(m.label) + '<div class="tiny muted">' + esc(m.unit) + '</div></th>' + vals.map(function (v) { return '<td class="num' + (!tie && Math.abs(v - best) < Math.pow(10, -m.d) / 2 ? ' win' : '') + '">' + nd(v, m.d) + '</td>'; }).join('') + '</tr>';
  }).join('');
  var costs = sims.map(function (s) { return s.cost.total; }), cheapest = Math.min.apply(null, costs);
  body += '<tr><th scope="row">Indicative cost</th>' + costs.map(function (c) { return '<td class="num' + (c === cheapest && costs.some(function (x) { return x !== c; }) ? ' win' : '') + '">' + inr(c) + '</td>'; }).join('') + '</tr>';
  var head = picked.map(function (s, i) { return '<th scope="col" class="num">' + esc(s.name) + '</th>'; }).join('');
  return card('Compare scenarios <span class="badge b-calc">Calculated estimate</span>', '<div class="tablewrap"><table class="tbl"><thead><tr><th scope="col">Indicator</th>' + head + '</tr></thead><tbody>' + body + '</tbody></table></div><p class="hint">Highlighted cells show the better value for each indicator. Baseline for all is the current campus layout. Costs are planning-level assumptions.</p>');
}

/* ---------- methodology ---------- */
function prov(name, type, use, src, status) {
  return '<tr><th scope="row">' + name + '</th><td>' + badge(type) + '</td><td>' + use + '</td><td>' + src + '</td><td>' + status + '</td></tr>';
}
function pageMethodology() {
  var S = state.settings, m = MODEL, ai = surrogateValid();
  var provRows = [
    prov('Pune monthly climate normals, 1991–2020', 'real', 'Hot-day air temperature (April mean maximum 37.8 °C) and annual rainfall (866 mm).', '<a href="https://www.climate-zone.com/climate/in/pune" target="_blank" rel="noopener">climate-zone.com, Pune</a>. Public compilation of station observations; values converted from °F and inches. Retrieved 21 Oct 2026.', 'Integrated'),
    prov('Campus land-cover areas', 'illus', 'Six zones and their surface areas.', 'Placeholder values for the PCCOE campus. Replace with surveyed areas (site plan, Google Earth polygons, Bhuvan land-use).', 'Editable in Digital Twin'),
    prov('Baseline cooling electricity per zone', 'illus', 'Starting point for energy and carbon.', 'Placeholder values. Replace with metered data from electricity bills.', 'Editable in Digital Twin'),
    prov('Design storm, ' + S.stormMm + ' mm in 24 h', 'assume', 'Runoff calculation.', 'Planning assumption. Replace with an IMD return-period value for the design life you care about.', 'Editable in Settings'),
    prov('Grid emission factor, ' + S.gridEF + ' kg CO₂e/kWh', 'assume', 'Carbon from electricity.', 'CEA CO₂ Baseline Database v19 value used in this prototype. Check the latest edition at <a href="https://cea.nic.in" target="_blank" rel="noopener">cea.nic.in</a>.', 'Editable in Settings'),
    prov('Curve numbers, surface temperature excess, roof savings, unit costs', 'assume', 'All impact coefficients.', 'Typical published ranges (USDA NRCS TR-55 for curve numbers; urban heat literature for surface temperatures). Three sets: conservative, central, optimistic. Not calibrated to this campus.', 'Shown below'),
    prov('Indicator results', 'calc', 'Everything shown in Overview, Comparison and Recommendations.', 'Computed live by the simulation engine from the inputs above.', 'Live'),
    prov('AI surrogate model', 'model', 'Instant screening of plans in the optimizer.', 'Neural network trained on the engine’s own outputs (see model card).', ai ? 'Active for the current inputs' : 'Inactive: inputs differ from training'),
    prov('NASA POWER, ERA5-Land, IMD gridded data, Bhuvan land cover, Landsat surface temperature', 'none', 'Would replace assumptions with measured or reanalysis data.', 'Potential sources. NASA POWER could not be reached from the environment where this prototype was built.', 'Next step')
  ].join('');
  var cSets = ['pavedImp', 'pavedPv', 'pavedPerm', 'roofStd', 'roofCool', 'roofGreen', 'lawn', 'canopy'].map(function (k) {
    return '<tr><th scope="row">' + esc(CT.COVER_LABELS[k]) + '</th><td class="num">' + CT.SETS.cons.excess[k] + '</td><td class="num strong">' + CT.SETS.central.excess[k] + '</td><td class="num">' + CT.SETS.opt.excess[k] + '</td><td class="num">' + CT.SETS.cons.cn[k] + '</td><td class="num strong">' + CT.SETS.central.cn[k] + '</td><td class="num">' + CT.SETS.opt.cn[k] + '</td></tr>';
  }).join('');
  var metricsRows = m ? m.targets.map(function (t) {
    var x = m.metrics[t], lab = { surfTemp: 'Surface temperature (°C)', runoff: 'Storm runoff (m³)', netKwh: 'Net electricity (kWh/yr)', irrig: 'Irrigation (m³/yr)' }[t];
    return '<tr><th scope="row">' + lab + '</th><td class="num">' + nd(x.r2_test, 5) + '</td><td class="num">' + nd(x.mae_test, t === 'surfTemp' ? 3 : 1) + '</td><td class="num">' + nd(x.mape_test_pct, 2) + '%</td><td class="num">' + nd(x.min_test, 1) + ' to ' + nd(x.max_test, 1) + '</td></tr>';
  }).join('') : '';
  var modelCard = m ? card('AI surrogate model card <span class="badge b-model">Model output</span>',
    '<p>A small neural network (' + esc(m.type) + ') learns to reproduce the simulation engine. It lets the optimizer screen 20,000 plans in about a tenth of a second. <strong>It is trained on engine outputs, not on field measurements</strong>, so a high score here means it imitates the engine well. It says nothing about how close the engine is to real campus conditions.</p>' +
    '<dl class="kv wide"><div><dt>Prediction targets</dt><dd>Campus surface temperature, storm runoff, net electricity, irrigation demand. CO₂e follows from net electricity.</dd></div><div><dt>Input features (10: 8 plan totals + 2 climate inputs)</dt><dd>Campus totals of: ' + m.features.map(function (f) { return esc(featLabel(f).toLowerCase()); }).join('; ') + '.</dd></div>' +
    '<div><dt>Training data</dt><dd>' + n0(m.nSamples) + ' random plans run through the engine (seeded), each with a random hot-day air temperature (30–45 °C) and design storm (30–150 mm), so the model learns how climate inputs change the result. Plans are allocated across zones by a fixed rule. Split ' + n0(m.split.train) + ' train, ' + n0(m.split.validation) + ' validation, ' + n0(m.split.test) + ' test. Trained ' + esc(m.trainedDate) + '.</dd></div>' +
    '<div><dt>Valid for</dt><dd>The demo baseline and default settings (fingerprint ' + esc(m.stateKey) + '). <strong>Status now: ' + (ai ? 'matches, surrogate active' : 'does not match, optimizer uses the exact engine') + '.</strong></dd></div></dl>' +
    '<h3>Accuracy on the held-out test set</h3><div class="tablewrap"><table class="tbl compact"><thead><tr><th scope="col">Target</th><th scope="col" class="num">R²</th><th scope="col" class="num">Mean abs. error</th><th scope="col" class="num">Mean % error</th><th scope="col" class="num">Range in test data</th></tr></thead><tbody>' + metricsRows + '</tbody></table></div>' +
    (m.extrapolation ? '<h3>Extrapolation check: climate the model never saw</h3><p class="hint">A second copy was trained only on air temperature up to 41 °C and storms up to 110 mm, then tested on ' + n0(m.extrapolation.rows_unseen) + ' hotter or wetter cases. Mean error: surface temperature ' + nd(m.extrapolation.surfTemp.mape_pct, 2) + '%, runoff ' + nd(m.extrapolation.runoff.mape_pct, 2) + '%, net electricity ' + nd(m.extrapolation.netKwh.mape_pct, 2) + '%, irrigation ' + nd(m.extrapolation.irrig.mape_pct, 2) + '%. The app switches the model off outside ' + CT.CLIMATE_RANGE.ambientC.join('–') + ' °C and ' + CT.CLIMATE_RANGE.stormMm.join('–') + ' mm.</p><p class="hint"><strong>Read R² with care.</strong> It is close to 1 because the engine is a smooth, noise-free formula that a network can imitate. That shows the network copied the engine. It does <em>not</em> show the predictions match real campus measurements; that needs field data (see roadmap below).</p>' : '') + '<h3>Which changes move the results most</h3>' + importanceBars(m.importance) + '<p class="hint">Permutation importance on the test set: how much the surrogate’s accuracy drops when one input is shuffled. Large rainwater-tank importance reflects its wide size range in the training plans.</p>' +
    '<p class="hint">Retrain with <code>python3 ml/train_surrogate.py</code> after changing the baseline or settings. Files are included in the project download.</p>') : '';
  var methods = [
    ['Storm runoff', 'NRCS Curve Number, event based. S = 25400/CN − 254, Ia = 0.2 S, Q = (P − Ia)² / (P − Ia + S). Composite CN per zone is the area-weighted mean of surface CNs. Runoff volume = Q × zone area. Rainwater tanks remove up to their capacity from roof runoff.'],
    ['Surface temperature', 'Each surface has a typical midday excess over air temperature. Zone surface temperature = air temperature + area-weighted mean excess. It is an indicator for comparing options, not a measurement.'],
    ['Irrigation', 'ETc = Kc × ET₀. Demand = (lawn × 0.8 + canopy × 0.4 + green roof × 0.5) × ET₀ × irrigated days ÷ efficiency, minus harvested rainwater.'],
    ['Cooling electricity', 'Entered baseline per zone minus cool-roof and green-roof savings per m², never more than a 40% cut.'],
    ['Solar and carbon', 'Solar = canopy m² × yield. Net electricity = cooling − solar. CO₂e = net electricity × grid emission factor. Tree carbon storage is not counted because there is no validated campus-specific figure.'],
    ['Cost', 'Quantity × unit cost, planning level. Payback = cost ÷ (electricity saved × tariff). Heat and water benefits are not given a money value.'],
    ['Ranges', 'Every result is recomputed with conservative, central and optimistic coefficient sets. The reported range is the spread of the estimated change.']
  ].map(function (r) { return '<div class="method"><h4>' + r[0] + '</h4><p>' + r[1] + '</p></div>'; }).join('');
  return pageHead('Data and Methodology', 'Where every number comes from, what is assumed, and what is not yet measured.') +
    card('Four kinds of information, kept apart', dataTypeLegend(true)) +
    card('Data provenance', '<div class="tablewrap"><table class="tbl provtbl"><thead><tr><th scope="col">Item</th><th scope="col">Type</th><th scope="col">Used for</th><th scope="col">Source</th><th scope="col">Status</th></tr></thead><tbody>' + provRows + '</tbody></table></div>') +
    card('Calculation methods', '<div class="methods">' + methods + '</div>') +
    card('Assumption sets', '<p class="hint">Surface temperature excess over air (°C) and curve numbers. Central values drive the headline numbers; the other two sets produce the ranges.</p><div class="tablewrap"><table class="tbl compact"><thead><tr><th scope="col" rowspan="2">Surface</th><th scope="colgroup" colspan="3" class="num">Heat excess °C</th><th scope="colgroup" colspan="3" class="num">Curve number</th></tr><tr><th scope="col" class="num">Cons.</th><th scope="col" class="num">Central</th><th scope="col" class="num">Opt.</th><th scope="col" class="num">Cons.</th><th scope="col" class="num">Central</th><th scope="col" class="num">Opt.</th></tr></thead><tbody>' + cSets + '</tbody></table></div><p class="hint">Cool-roof saving per m² per year: ' + CT.SETS.cons.kCool + ' / ' + CT.SETS.central.kCool + ' / ' + CT.SETS.opt.kCool + ' kWh. Green roof: ' + CT.SETS.cons.kGreen + ' / ' + CT.SETS.central.kGreen + ' / ' + CT.SETS.opt.kGreen + ' kWh. Solar yield multiplier: ' + CT.SETS.cons.solarMul + ' / ' + CT.SETS.central.solarMul + ' / ' + CT.SETS.opt.solarMul + '.</p>') +
    modelCard +
    card('Limitations and validation roadmap', '<div class="grid g-2 flat"><div><h4>Current limitations</h4><ul class="plain bullets"><li>Zone areas and baseline electricity are placeholders, not measurements.</li><li>Impact coefficients come from typical published ranges and are not calibrated to this campus.</li><li>Curve-number runoff with a composite CN per zone is a planning approximation.</li><li>Surface temperature is an indicator for comparing options, not a forecast of measured temperature.</li><li>The surrogate model imitates the engine; it has not been validated against field data.</li></ul></div><div><h4>How to make it measured</h4><ol class="plain nums"><li>Enter surveyed areas and metered cooling electricity.</li><li>Replace the design storm with an IMD return-period value, and add NASA POWER or ERA5-Land weather.</li><li>Compare surface temperature with Landsat or drone thermal imagery for the same zones.</li><li>Calibrate the coefficients, then retrain the surrogate.</li></ol></div></div>');
}

/* ---------- settings ---------- */
function setField(id, label, val, step, hint, min, max) {
  return '<div class="field"><label for="st-' + id + '">' + esc(label) + '</label><input id="st-' + id + '" type="number" inputmode="decimal" step="' + step + '" min="' + min + '" max="' + max + '" value="' + val + '" data-set="' + id + '"><span class="tiny muted">' + hint + '</span></div>';
}
function pageSettings() {
  var S = state.settings;
  var costs = [['permeable', 'Permeable paving (₹/m²)'], ['depaveLawn', 'Asphalt to lawn (₹/m²)'], ['tree', 'Tree, planted and established (₹ each)'], ['coolRoof', 'Cool roof coating (₹/m²)'], ['greenRoof', 'Green roof (₹/m²)'], ['solar', 'Solar canopy (₹/m²)'], ['rwh', 'Rainwater tank (₹/m³)']].map(function (c) {
    return '<div class="field"><label for="st-c-' + c[0] + '">' + esc(c[1]) + '</label><input id="st-c-' + c[0] + '" type="number" inputmode="decimal" step="50" min="0" value="' + S.costs[c[0]] + '" data-cost="' + c[0] + '"></div>';
  }).join('');
  var cm = '<div class="field"><label for="st-canopy">Tree maturity (canopy per tree)</label><select id="st-canopy" data-set="canopyPerTree"><option value="8"' + (S.canopyPerTree === 8 ? ' selected' : '') + '>Young, about 5 years: 8 m²</option><option value="14"' + (S.canopyPerTree === 14 ? ' selected' : '') + '>Established, about 10 years: 14 m²</option><option value="20"' + (S.canopyPerTree === 20 ? ' selected' : '') + '>Mature, 20+ years: 20 m²</option></select><span class="tiny muted">Cooling from planting depends on how large the trees are when you judge the result.</span></div>';
  return pageHead('Settings', 'Assumptions behind the calculations. Changes apply immediately and are saved in this browser.') +
    '<div id="settings-msg" class="formmsg" role="status"></div>' +
    card('Climate and physical assumptions',
      '<div class="fields">' + setField('ambientC', 'Hot-day air temperature (°C)', S.ambientC, 0.1, 'Pune April mean maximum is 37.8 °C.', 20, 50) + setField('stormMm', 'Design storm depth (mm in 24 h)', S.stormMm, 1, 'Assumption. Replace with an IMD return-period value.', 10, 400) + setField('et0', 'Reference evapotranspiration ET₀ (mm/day)', S.et0, 0.1, 'Assumption for dry-season irrigation.', 1, 10) + setField('irrigDays', 'Irrigated days per year', S.irrigDays, 5, 'Assumption.', 30, 365) + setField('solarYield', 'Solar canopy yield (kWh/m²/yr)', S.solarYield, 5, 'Assumption for canopy area, with spacing and losses.', 50, 350) + setField('rwhFills', 'Tank fills per year', S.rwhFills, 1, 'Assumption.', 1, 60) + cm + '</div>') +
    card('Electricity and carbon', '<div class="fields">' + setField('gridEF', 'Grid emission factor (kg CO₂e/kWh)', S.gridEF, 0.001, 'CEA CO₂ Baseline Database v19. Check the latest edition.', 0.1, 1.5) + setField('tariff', 'Electricity tariff (₹/kWh)', S.tariff, 0.1, 'Used for payback.', 1, 30) + '</div>') +
    card('Planning-level unit costs', '<div class="fields">' + costs + '</div><p class="hint">Rough placeholders for comparing options. Replace with local quotations before using the payback figure.</p>') +
    card('Data', '<div class="row"><button type="button" class="btn btn-secondary" data-action="reset-settings">Reset assumptions to defaults</button>' + (state.confirm === 'clear-all' ? '<button type="button" class="btn btn-danger" data-action="clear-ok">Confirm: delete saved scenarios and edits</button><button type="button" class="btn btn-ghost" data-action="delete-cancel">Cancel</button>' : '<button type="button" class="btn btn-ghost" data-action="clear-all">Clear saved scenarios and baseline edits</button>') + '</div><p class="hint">' + (storageOk ? 'Everything is stored in this browser only.' : 'Browser storage is unavailable here, so nothing persists after you close the page.') + '</p>');
}

/* ---------- modal and tour ---------- */
function modalHtml() {
  if (!state.modal) return '';
  return '<div class="scrim" data-action="close-modal"></div><div class="modal" role="dialog" aria-modal="true" aria-labelledby="m-title"><h2 id="m-title">Save scenario</h2>' +
    '<p class="hint">Saved in this browser. You can reopen, duplicate and compare it from Scenario History.</p>' +
    '<div class="field"><label for="m-name">Name</label><input id="m-name" type="text" maxlength="60" value="' + esc(state.name) + '"></div>' +
    '<div class="field"><label for="m-desc">Description</label><textarea id="m-desc" rows="3" maxlength="240">' + esc(state.desc) + '</textarea></div>' +
    '<p id="m-msg" class="formmsg" role="alert"></p><div class="row end"><button type="button" class="btn btn-secondary" data-action="close-modal">Cancel</button><button type="button" class="btn btn-primary" data-action="confirm-save">Save</button></div></div>';
}
var TOUR = [
  { page: 'overview', title: '1. The campus today', text: 'This is the digital twin of the demo campus: six zones with their land cover, plus the baseline heat, runoff, energy and carbon indicators. Areas are illustrative placeholders.' },
  { page: 'twin', title: '2. Inspect a zone', text: 'Select a zone to see its land cover and indicators. The parking lot is mostly asphalt, so it runs hottest and sheds the most runoff.' },
  { page: 'simulator', title: '3. Propose a change', text: 'We loaded the Balanced Climate Plan: permeable paving, shade trees, cool roofs, a solar carport and rainwater tanks. Move any slider and the results update immediately.' },
  { page: 'comparison', title: '4. Compare', text: 'Baseline and proposed side by side, with a range from conservative to optimistic assumptions, the trade-offs (irrigation goes up), and the cost.' },
  { page: 'recommendations', title: '5. Act', text: 'Interventions are ranked by a documented score. The optimizer screens 20,000 plans with the AI surrogate, then verifies the best five with the exact engine.' },
  { page: 'methodology', title: '6. Trust the numbers', text: 'Every input is labelled as real, illustrative or assumed. The model card shows what the AI was trained on and how accurate it is, and what it is not.' }
];
function tourHtml() {
  if (state.tour == null) return '';
  var s = TOUR[state.tour];
  return '<aside class="tour" role="dialog" aria-label="Guided demo" aria-live="polite"><div class="tour-step">Step ' + (state.tour + 1) + ' of ' + TOUR.length + '</div><h3>' + esc(s.title) + '</h3><p>' + esc(s.text) + '</p>' +
    '<div class="row"><button type="button" class="btn btn-secondary sm" data-action="tour-prev"' + (state.tour === 0 ? ' disabled' : '') + '>Back</button><button type="button" class="btn btn-primary sm" data-action="tour-next">' + (state.tour === TOUR.length - 1 ? 'Finish' : 'Next') + '</button><button type="button" class="btn btn-ghost sm" data-action="tour-end">End tour</button></div></aside>';
}
