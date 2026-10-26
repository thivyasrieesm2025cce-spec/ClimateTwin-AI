/* ===== ClimateTwin AI - landing page (the PPT story). All numbers come from the live engine. ===== */
var HERO = null;
function heroData() {
  var pr = presetById('combined');
  var sim = CT.simulate(state.zones, pr.plan, state.settings), b = sim.campus.base, p = sim.campus.prop;
  var rng = mulberry(20261021), N = 84, rank = [];
  for (var i = 0; i < N; i++) rank.push({ i: i, r: rng() });
  rank.sort(function (a, c) { return a.r - c.r; });
  function cls(m) {
    var hard = Math.round(m.impPct / 100 * N), green = Math.round(m.greenPct / 100 * N), out = new Array(N);
    rank.forEach(function (t, k) { out[t.i] = k < hard ? 'h' : k < hard + green ? 'g' : 's'; });
    return out;
  }
  return { sim: sim, b: b, p: p, before: cls(b), after: cls(p), plan: pr };
}
function heroTiles(after) {
  var H = HERO, c = after ? H.after : H.before, nm = { h: 'Built-up and paved', g: 'Green', s: 'Other surface' };
  return c.map(function (k) { return '<i class="t t-' + k + '" title="' + nm[k] + '"></i>'; }).join('');
}
function pctDelta(b, p) { return b ? (p - b) / b * 100 : 0; }
function landingHtml() {
  if (!HERO) HERO = heroData();
  var H = HERO, ro = pctDelta(H.b.runoff, H.p.runoff), dT = H.p.surfTemp - H.b.surfTemp, dC = pctDelta(H.b.cooling, H.p.cooling), dCo = pctDelta(H.b.co2, H.p.co2);
  function bar(label, b, p, unit, d) {
    var w = Math.max(6, p / b * 100);
    return '<div class="lp-bar"><div class="lp-bar-l"><span>' + label + '</span><span>' + n0(b) + ' &rarr; <b>' + (d ? nd(p, d) : n0(p)) + '</b> ' + unit + '</span></div><div class="lp-track"><span class="cur" style="width:100%"></span></div><div class="lp-track"><span class="sim" style="width:' + w.toFixed(0) + '%"></span></div></div>';
  }
  var feats = [
    ['A', 'Add trees', 'Increase canopy cover across open zones and along paving.', 'forest'],
    ['B', 'Shaded parking', 'Cover heat-absorbing parking with a solar canopy.', 'energy'],
    ['C', 'Permeable surface', 'Replace concrete and asphalt to improve infiltration.', 'sponge'],
    ['D', 'Combined', 'Blend interventions for the best trade-off.', 'combined']
  ].map(function (f) {
    return '<button type="button" class="lp-feat' + (f[0] === 'D' ? ' on' : '') + '" data-action="launch-preset" data-id="' + f[3] + '"><span class="lp-letter">' + f[0] + '</span><b>' + f[1] + '</b><span>' + f[2] + '</span><em>Try this scenario &rarr;</em></button>';
  }).join('');
  var steps = [['Create or select area', 'Pick a campus or urban zone to model.'], ['Enter a proposed change', '&ldquo;Add 100 trees&rdquo; or &ldquo;Convert 2,000 m&sup2; of concrete to a permeable surface&rdquo;.'], ['AI simulation', 'The engine combines surface, rainfall and energy assumptions with an AI surrogate to screen options.'], ['Impact comparison', 'Current scenario is scored against the proposed one.'], ['Action recommendation', 'Ranked interventions with a plain-language reason.']]
    .map(function (s, i) { return '<li><span class="lp-n">' + (i + 1) + '</span><div><b>' + s[0] + '</b><span>' + s[1] + '</span></div></li>'; }).join('');
  var extras = [
    ['Plan optimizer', 'Give a budget and priorities; it screens 20,000 plans with the AI surrogate and verifies the best with the exact engine.'],
    ['Ranges, not false precision', 'Every result carries a conservative-to-optimistic range and a confidence label.'],
    ['Trade-offs shown', 'More planting raises irrigation demand. We show that instead of hiding it.'],
    ['Cost and payback', 'Planning-level rupee costs and electricity-only payback, all editable.'],
    ['Editable twin', 'Replace the demo areas with surveyed values and everything recalculates.'],
    ['Reports and history', 'Save, duplicate, compare and export scenarios.']
  ].map(function (x) { return '<div class="lp-x"><b>' + x[0] + '</b><span>' + x[1] + '</span></div>'; }).join('');
  return '<a class="skip" href="#lp-main">Skip to content</a>' +
  '<header class="lp-nav"><div class="lp-wrap"><div class="lp-brand"><span class="brandmark" aria-hidden="true"></span>ClimateTwin <b>AI</b></div>' +
  '<nav aria-label="Page sections"><a href="#lp-problem">Problem</a><a href="#lp-solution">Solution</a><a href="#lp-how">How it works</a><a href="#lp-features">Features</a><a href="#lp-trust">Data</a></nav>' +
  '<button type="button" class="btn lp-cta sm" data-action="launch">Launch simulator</button></div></header>' +
  '<main id="lp-main">' +
  '<section class="lp-hero"><div class="lp-wrap lp-herogrid"><div><p class="lp-eyebrow">PCCOE International Grand Challenge 2026 &middot; Pune, India</p><span class="lp-pill">Theme: AI for Climate Change</span>' +
  '<h1>ClimateTwin AI</h1><p class="lp-sub">AI-Powered Climate Impact Simulator</p><p class="lp-quote">&ldquo;Simulate before you build. Act before climate impact happens.&rdquo;</p>' +
  '<p class="lp-explain"><b>Simulate Before You Build.</b> Explore how trees, green parking, cool roofs and solar canopies may influence campus heat, stormwater runoff, energy demand and carbon emissions.</p>' +
  '<div class="lp-row"><button type="button" class="btn lp-cta" data-action="launch-preset" data-id="combined">Try a Sample Scenario</button><button type="button" class="btn lp-ghost" data-action="launch">Open dashboard</button><button type="button" class="btn lp-ghost" data-action="launch-tour">Watch guided demo</button></div></div>' +
  '<div class="lp-twin"><div class="lp-twin-h"><span>DIGITAL TWIN &middot; ILLUSTRATIVE CAMPUS</span><div class="seg-ctl dark" role="group" aria-label="Show scenario"><button type="button" data-action="hero" data-v="0" aria-pressed="true">Today</button><button type="button" data-action="hero" data-v="1" aria-pressed="false">With plan</button></div></div>' +
  '<div class="lp-grid" id="hero-grid" role="img" aria-label="Tile map of the campus. Today: ' + n0(H.b.impPct) + ' percent built-up or paved, ' + n0(H.b.greenPct) + ' percent green. With the balanced plan: ' + n0(H.p.impPct) + ' and ' + n0(H.p.greenPct) + ' percent.">' + heroTiles(false) + '</div>' +
  '<ul class="lp-leg"><li><i class="t t-h"></i>Built-up and paved</li><li><i class="t t-g"></i>Green</li><li><i class="t t-s"></i>Other surface</li></ul>' +
  '<p class="lp-note" id="hero-note">Today: ' + nd(H.b.impPct, 0) + '% built-up or paved, ' + nd(H.b.greenPct, 0) + '% green. Balanced Climate Plan applied to the demo PCCOE layout (illustrative areas).</p></div></div></section>' +

  '<section id="lp-problem" class="lp-sec"><div class="lp-wrap"><p class="lp-kick">Why this matters</p><h2>Development decisions are made blind</h2>' +
  '<p class="lp-lead">Urban development decisions are often made without accurately predicting their future climate impact. Decision-makers lack a simple way to simulate these impacts before implementing a change.</p>' +
  '<div class="lp-two"><div class="lp-card"><h3>Change made &rarr; leads to</h3><div class="lp-cl"><ul><li>More built-up area</li><li>Less green cover</li><li>Larger parking zones</li><li>Heat-absorbing surfaces</li></ul><span class="lp-arrow" aria-hidden="true">&rarr;</span><ul><li>Higher local temperature</li><li>Increased water stress</li><li>Higher energy demand</li><li>More carbon emissions</li></ul></div></div>' +
  '<div class="lp-card"><h3>The gap in existing tools</h3><p class="lp-flow old"><small>Today&rsquo;s tools</small>Monitor &rarr; Measure &rarr; Report</p><p class="lp-flow new"><small>ClimateTwin AI</small>Propose &rarr; Simulate &rarr; Compare &rarr; Act</p></div></div></div></section>' +

  '<section id="lp-solution" class="lp-sec alt"><div class="lp-wrap"><p class="lp-kick">Proposed solution</p><h2>A software-only digital twin with a what-if engine</h2>' +
  '<ol class="lp-pipe"><li><small>01</small><b>Real-world area</b><span>Campus or urban zone</span></li><li><small>02</small><b>Digital twin</b><span>Editable layer model</span></li><li><small>03</small><b>AI simulation</b><span>What-if engine</span></li><li><small>04</small><b>Impact prediction</b><span>Heat &middot; water &middot; energy &middot; CO&#8322;</span></li><li class="last"><small>05</small><b>Recommended action</b><span>Ranked intervention</span></li></ol>' +
  '<div class="lp-two"><div class="lp-card"><h3>Current vs proposed, from the live engine</h3>' +
  bar('Midday surface temperature', H.b.surfTemp, H.p.surfTemp, '&deg;C', 1) + bar('Storm runoff', H.b.runoff, H.p.runoff, 'm&sup3;', 0) + bar('Cooling electricity', H.b.cooling / 1000, H.p.cooling / 1000, 'MWh/yr', 0) + bar('Net CO&#8322;e from electricity', H.b.co2, H.p.co2, 't/yr', 0) +
  '<p class="lp-fine"><span class="lp-key cur"></span>Current <span class="lp-key sim"></span>With Balanced Climate Plan. Illustrative campus areas; indicators are planning estimates, not measurements.</p></div>' +
  '<div class="lp-card"><h3>What the plan changes</h3><ul class="lp-stats"><li><b>' + sgn(ro, 0) + '%</b><span>storm runoff</span></li><li><b>' + sgn(dT, 1) + ' &deg;C</b><span>midday surface temperature (campus mean)</span></li><li><b>' + sgn(dC, 0) + '%</b><span>cooling electricity</span></li><li><b>' + sgn(dCo, 0) + '%</b><span>net CO&#8322;e (includes solar)</span></li></ul><p class="lp-fine">Cost of this plan: ' + inr(H.sim.cost.total) + ' (planning-level).</p></div></div></div></section>' +

  '<section id="lp-how" class="lp-sec"><div class="lp-wrap"><p class="lp-kick">AI-powered what-if engine</p><h2>How it works</h2><ol class="lp-steps">' + steps + '</ol></div></section>' +

  '<section id="lp-features" class="lp-sec alt"><div class="lp-wrap"><p class="lp-kick">From monitoring to prediction</p><h2>Unique features</h2><p class="lp-lead"><b>Observe &rarr; Analyse &rarr; Report</b> becomes <b>Simulate &rarr; Predict &rarr; Compare &rarr; Act</b>. Pick a scenario to open it in the simulator.</p><div class="lp-feats">' + feats + '</div>' +
  '<h3 class="lp-h3">Beyond the slides</h3><div class="lp-xs">' + extras + '</div></div></section>' +

  '<section id="lp-trust" class="lp-sec"><div class="lp-wrap"><p class="lp-kick">Honest by design</p><h2>What is real, and what is illustrative</h2><div class="lp-trust">' +
  '<div><span class="badge b-real">Real external data</span><p>Pune monthly climate normals (1991&ndash;2020).</p></div><div><span class="badge b-illus">Illustrative sample</span><p>Zone areas and baseline electricity for the demo campus. Replace with a survey.</p></div><div><span class="badge b-assume">Assumption</span><p>Design storm, tariff, costs, coefficients. All editable in Settings.</p></div><div><span class="badge b-model">Model output</span><p>Physics-based engine plus an AI surrogate trained on engine outputs, with held-out accuracy shown.</p></div></div>' +
  '<p class="lp-fine">Nothing here is presented as a measured result. See Data and Methodology in the app.</p></div></section>' +

  '<section class="lp-sec alt"><div class="lp-wrap"><p class="lp-kick">Deliverables &middot; impact &middot; future scope</p><h2>Expected outcome</h2><div class="lp-three"><div class="lp-card"><h3>Deliverables</h3><ul><li>Web-based digital-twin simulator (working prototype)</li><li>AI impact-prediction surrogate with published accuracy</li><li>Scenario comparison dashboard</li><li>Auto-generated climate-action report</li></ul></div><div class="lp-card"><h3>Short term</h3><ul><li>Campus-level pilot</li><li>Better green-space planning</li><li>Reduced heat exposure</li></ul></div><div class="lp-card"><h3>Long term</h3><ul><li>City-scale adoption</li><li>Lower carbon emissions</li><li>Climate-resilient planning</li></ul></div></div>' +
  '<div class="lp-future"><h3>Future scope: a scalable AI climate decision-support system</h3><div><span><b>Satellite imagery</b>Automatic land-use extraction</span><span><b>Real-time data</b>Live weather and sensor feeds</span><span><b>Advanced models</b>Higher-fidelity microclimate physics</span><span><b>Urban datasets</b>City-wide, multi-zone simulation</span></div></div></div></section>' +

  '<section class="lp-final"><div class="lp-wrap"><h2>Simulate it before you build it</h2><p>Don&rsquo;t wait to measure climate impact after development.</p><button type="button" class="btn lp-cta" data-action="launch">Launch simulator</button></div></section></main>' +
  '<footer class="lp-foot"><div class="lp-wrap">ClimateTwin AI &middot; PCCOE International Grand Challenge 2026 &middot; Pune, India &middot; Theme: AI for Climate Change</div></footer>';
}
