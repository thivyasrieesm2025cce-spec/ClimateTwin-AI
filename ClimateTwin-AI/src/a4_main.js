/* ===== ClimateTwin AI - events and rendering ===== */

var root = null;
function render() {
  root.innerHTML = state.page === 'home' ? landingHtml() : shell();
}
function focusKey(el) {
  if (!el || !el.closest) return null;
  if (el.id) return '#' + el.id;
  var a = el.getAttribute && el.getAttribute('data-action');
  if (a) {
    var s = '[data-action="' + a + '"]';
    ['data-zone', 'data-l', 'data-v', 'data-id', 'data-i'].forEach(function (n) { if (el.getAttribute(n)) s += '[' + n + '="' + el.getAttribute(n) + '"]'; });
    return s;
  }
  var nv = el.getAttribute && el.getAttribute('data-nav');
  return nv ? '[data-nav="' + nv + '"]' : null;
}
function renderPage() {
  var key = focusKey(document.activeElement);
  var tb = $('#topbar'), pg = $('#page');
  if (tb) tb.innerHTML = topbar();
  if (pg) pg.innerHTML = pageHtml();
  if (key) { var n = $(key); if (n && n.focus) { try { n.focus({ preventScroll: true }); } catch (e) { n.focus(); } } }
}
function renderAll() {
  var key = focusKey(document.activeElement);
  render();
  if (key) { var n = $(key); if (n && n.focus) n.focus({ preventScroll: true }); }
}
function go(page, opts) {
  state.page = page; state.menuOpen = false; state.confirm = null; state.renaming = null;
  render();
  if (!(opts && opts.keepScroll)) window.scrollTo(0, 0);
  var m = $('#main-content'); if (m && !(opts && opts.noFocus)) m.focus({ preventScroll: true });
  announce(page === 'home' ? 'Home page' : pageMeta(page).label + ' page');
}
function announce(t) { var l = $('#sr-live'); if (l) { l.textContent = ''; setTimeout(function () { l.textContent = t; }, 30); } }
var toastTimer = null;
function toast(msg) {
  var t = $('#toast'); if (!t) return;
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove('show'); }, 3200);
}

/* ---------- live updates for the simulator without losing slider focus ---------- */
function updateSimLive() {
  var zone = zoneById(state.selZone), S = state.settings, iv = curIv(zone.id), caps = CT.capacities(zone, iv, S);
  CT.IV_KEYS.forEach(function (k) {
    var sl = $('#sl-' + k); if (!sl) return;
    var meta = CT.IV_META[k], cap = caps[k];
    sl.max = Math.max(cap, iv[k], 0);
    if (+sl.value !== iv[k]) sl.value = iv[k];
    var dis = cap <= 0 && iv[k] <= 0; sl.disabled = dis;
    sl.closest('.slrow').classList.toggle('off', dis);
    $('#o-' + k).textContent = fmtq(iv[k], k, S);
    $('#cap-' + k).textContent = dis ? 'Not available in this zone' : 'Up to ' + n0(cap) + ' ' + meta.unit + ' available';
    $('#cost-' + k).textContent = iv[k] > 0 ? inr(iv[k] * S.costs[meta.costKey]) : '';
  });
  var lr = $('#live-results'); if (lr) lr.innerHTML = resultsPanel();
  var tb = $('#topbar'); if (tb) tb.innerHTML = topbar();
  var sv = $('#btn-save2'); if (sv) sv.disabled = planIsEmpty();
  $$('.tab').forEach(function (t) {
    var id = t.getAttribute('data-zone'), changed = CT.IV_KEYS.some(function (k) { return curIv(id)[k] > 0; });
    var d = $('.dot', t);
    if (changed && !d) t.insertAdjacentHTML('beforeend', '<span class="dot" title="Has changes"></span><span class="sr"> (has changes)</span>');
    if (!changed && d) { d.nextSibling && d.nextSibling.remove(); d.remove(); }
  });
}
function markCustom() {
  if (state.name === 'Baseline reference') { state.name = 'Custom scenario'; state.desc = 'Your own combination of changes.'; var n = $('#scn-name'), d = $('#scn-desc'); if (n) n.value = state.name; if (d) d.value = state.desc; }
}

/* ---------- clipboard and report ---------- */
function copyText(text) {
  function fallback() {
    var ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select();
    var ok = false; try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    ta.remove(); return ok;
  }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return fallback(); });
  }
  return Promise.resolve(fallback());
}
function downloadReport() {
  try {
    var blob = new Blob([reportHtml()], { type: 'text/html' }), a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'climatetwin-report.html'; document.body.appendChild(a); a.click(); a.remove();
    toast('Report downloaded. If nothing happened, use Copy report.');
  } catch (e) { toast('Download is blocked here. Use Copy report instead.'); }
}

/* ---------- modal ---------- */
var lastFocus = null;
function openModal(kind) {
  lastFocus = document.activeElement; state.modal = kind;
  $('#modal-root').innerHTML = modalHtml();
  var f = $('#modal-root input, #modal-root button.btn-primary'); if (f) f.focus();
}
function closeModal() {
  state.modal = null; $('#modal-root').innerHTML = '';
  if (lastFocus && document.body.contains(lastFocus)) lastFocus.focus();
}
function confirmSave() {
  var name = $('#m-name').value.trim(), desc = $('#m-desc').value.trim(), msg = $('#m-msg');
  if (!name) { msg.textContent = 'Give the scenario a name.'; $('#m-name').focus(); return; }
  if (planIsEmpty()) { msg.textContent = 'There are no changes to save. Move a slider or load a preset first.'; return; }
  if (state.saved.some(function (s) { return s.name.toLowerCase() === name.toLowerCase(); })) { msg.textContent = 'A saved scenario already has this name. Choose a different one.'; return; }
  state.name = name; state.desc = desc || 'No description.';
  state.saved.unshift({ id: uid(), name: name, desc: state.desc, plan: JSON.parse(JSON.stringify(sanitizePlan(state.plan))), created: today() });
  var ok = persistSaved();
  closeModal(); renderPage();
  toast(ok ? 'Scenario saved in this browser.' : 'Saved for this session only. Browser storage is unavailable.');
}

/* ---------- click handling ---------- */
document.addEventListener('click', function (e) {
  var t = e.target.closest('[data-nav],[data-action]'); if (!t) {
    var z = e.target.closest('[data-zone]'); if (z && z.classList.contains('zone')) selectZone(z.getAttribute('data-zone'));
    return;
  }
  var nav = t.getAttribute('data-nav');
  if (nav) { go(nav); return; }
  var act0 = t.getAttribute('data-action');
  if (act0 === 'launch') { go('overview'); return; }
  if (act0 === 'home') { go('home'); return; }
  if (act0 === 'launch-tour') { go('overview'); state.tour = 0; tourStep(); return; }
  if (act0 === 'launch-preset') { var lp = presetById(t.getAttribute('data-id')); applyPlan(lp.plan, lp.name, lp.desc); go('simulator'); toast('Loaded: ' + lp.name); return; }
  if (act0 === 'hero') {
    var on = t.getAttribute('data-v') === '1', g = $('#hero-grid'), nt = $('#hero-note');
    if (g) g.innerHTML = heroTiles(on);
    $$('[data-action="hero"]').forEach(function (b) { b.setAttribute('aria-pressed', String(b === t)); });
    if (nt) nt.textContent = on ? 'With plan: ' + nd(HERO.p.impPct, 0) + '% built-up or paved, ' + nd(HERO.p.greenPct, 0) + '% green. Runoff ' + sgn(pctDelta(HERO.b.runoff, HERO.p.runoff), 0) + '%, midday surface temperature ' + sgn(HERO.p.surfTemp - HERO.b.surfTemp, 1) + ' °C.' : 'Today: ' + nd(HERO.b.impPct, 0) + '% built-up or paved, ' + nd(HERO.b.greenPct, 0) + '% green. Balanced Climate Plan applied to the demo PCCOE layout (illustrative areas).';
    return;
  }
  var a = t.getAttribute('data-action'), id = t.getAttribute('data-id'), zid = t.getAttribute('data-zone');
  switch (a) {
    case 'menu': state.menuOpen = !state.menuOpen; render(); var mb = $('[data-action="menu"]'); if (mb) mb.focus(); break;
    case 'layer': state.layer = t.getAttribute('data-l'); renderPage(); break;
    case 'view': state.view = t.getAttribute('data-v'); renderPage(); break;
    case 'inspect': state.selZone = zid; state.editOpen = false; go('twin'); break;
    case 'select-zone': state.selZone = zid; renderPage(); break;
    case 'goto-sim': state.selZone = zid; go('simulator'); break;
    case 'toggle-edit': state.editOpen = !state.editOpen; renderPage(); break;
    case 'preset': var p = presetById(id); applyPlan(p.plan, p.name, p.desc); renderPage(); toast('Loaded: ' + p.name); break;
    case 'reset-plan': resetPlan(); renderPage(); toast('Scenario reset to baseline.'); break;
    case 'open-save': openModal('save'); break;
    case 'close-modal': closeModal(); break;
    case 'confirm-save': confirmSave(); break;
    case 'copy-report': copyText(reportMarkdown()).then(function (ok) { toast(ok ? 'Report copied as text.' : 'Copy was blocked. Open the report view and select the text.'); }); break;
    case 'view-report': openModal('report'); break;
    case 'download-report': downloadReport(); break;
    case 'load-saved': var s = state.saved.filter(function (r) { return r.id === id; })[0]; if (s) { applyPlan(s.plan, s.name, s.desc); go('comparison'); toast('Opened: ' + s.name); } break;
    case 'dup': var o = state.saved.filter(function (r) { return r.id === id; })[0]; if (o) { var nm = o.name + ' (copy)', n = 2; while (state.saved.some(function (r) { return r.name === nm; })) nm = o.name + ' (copy ' + n++ + ')'; state.saved.unshift({ id: uid(), name: nm, desc: o.desc, plan: JSON.parse(JSON.stringify(o.plan)), created: today() }); persistSaved(); renderPage(); toast('Duplicated.'); } break;
    case 'rename': state.renaming = id; renderPage(); var ri = $('#rn-' + id); if (ri) { ri.focus(); ri.select(); } break;
    case 'rename-ok': var v = ($('#rn-' + id).value || '').trim(); if (!v) { toast('A name is required.'); break; } if (state.saved.some(function (r) { return r.id !== id && r.name.toLowerCase() === v.toLowerCase(); })) { toast('Another scenario already has that name.'); break; } state.saved.forEach(function (r) { if (r.id === id) r.name = v; }); state.renaming = null; persistSaved(); renderPage(); toast('Renamed.'); break;
    case 'delete': state.confirm = id; renderPage(); break;
    case 'delete-cancel': state.confirm = null; renderPage(); break;
    case 'delete-ok': state.saved = state.saved.filter(function (r) { return r.id !== id; }); state.cmp = state.cmp.filter(function (c) { return c !== id; }); state.confirm = null; persistSaved(); renderPage(); toast('Scenario deleted.'); break;
    case 'try-cand': var cands = scoreCandidates(buildCandidates(), state.weights), c = cands[+t.getAttribute('data-i')]; if (c) { applyPlan(c.plan, CAND_META[c.key].title + ' in ' + c.zoneName, 'Single intervention from the ranked list. Adjust it or add more changes.'); state.selZone = c.zoneId; go('simulator'); toast('Loaded into the simulator.'); } break;
    case 'run-opt':
      state.budgetLakh = clamp(+($('#budget').value) || 150, 5, 2000); state.optBusy = true; renderPage();
      setTimeout(function () { state.opt = runOptimizer(); state.optBusy = false; renderPage(); announce('Optimizer finished'); }, 40); break;
    case 'load-opt': if (state.opt && state.opt.best) { applyPlan(state.opt.best.plan, 'Optimized plan, ₹' + n0(state.budgetLakh) + ' lakh budget', 'Found by the plan optimizer for the current weights and budget.'); go('simulator'); toast('Optimized plan loaded.'); } break;
    case 'reset-zone': var dz = CT.DEMO_ZONES.filter(function (z) { return z.id === zid; })[0]; state.zones = state.zones.map(function (z) { return z.id === zid ? JSON.parse(JSON.stringify(dz)) : z; }); persistZones(); state.plan = sanitizePlan(state.plan); touch(); renderPage(); toast('Demo values restored for this zone.'); break;
    case 'reset-all-zones': state.zones = cloneZones(CT.DEMO_ZONES); persistZones(); state.plan = sanitizePlan(state.plan); touch(); renderPage(); toast('Demo layout restored.'); break;
    case 'reset-settings': state.settings = CT.withDefaults({}); persistSettings(); state.plan = sanitizePlan(state.plan); touch(); renderPage(); toast('Assumptions reset to defaults.'); break;
    case 'clear-all': state.confirm = 'clear-all'; renderPage(); break;
    case 'clear-ok': state.saved = []; state.cmp = []; state.zones = cloneZones(CT.DEMO_ZONES); LS.del('saved'); LS.del('zones'); state.plan = {}; state.name = 'Baseline reference'; state.desc = 'No changes applied. This is the current campus layout.'; state.confirm = null; touch(); renderPage(); toast('Saved data cleared.'); break;
    case 'load-examples': var na = loadExamples(); renderPage(); toast(na ? 'Loaded ' + na + ' example scenarios. Compare them below.' : 'Examples are already saved. They are ticked for comparison below.'); break;
    case 'start-tour': state.tour = 0; tourStep(); break;
    case 'tour-next': if (state.tour >= TOUR.length - 1) { endTour(); } else { state.tour++; tourStep(); } break;
    case 'tour-prev': if (state.tour > 0) { state.tour--; tourStep(); } break;
    case 'tour-end': endTour(); break;
  }
});
function selectZone(id) { state.selZone = id; state.editOpen = false; renderPage(); var n = $('.zone[data-zone="' + id + '"]'); if (n) n.focus({ preventScroll: true }); }
function tourStep() {
  var s = TOUR[state.tour];
  if (s.page === 'simulator' && planIsEmpty()) { var p = presetById('combined'); applyPlan(p.plan, p.name, p.desc); }
  if (s.page === 'twin') state.selZone = 'z3';
  go(s.page, { noFocus: true }); $('#tour-root').innerHTML = tourHtml();
}
function endTour() { state.tour = null; $('#tour-root').innerHTML = ''; }

document.addEventListener('keydown', function (e) {
  var z = e.target.closest && e.target.closest('.zone');
  if (z && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); selectZone(z.getAttribute('data-zone')); return; }
  if (e.key === 'Escape') {
    if (state.modal) { closeModal(); return; }
    if (state.tour != null) { endTour(); return; }
    if (state.menuOpen) { state.menuOpen = false; render(); }
  }
  if (e.key === 'Tab' && state.modal) {
    var m = $('.modal'); if (!m) return;
    var f = $$('button, input, textarea, select, [href]', m).filter(function (n) { return !n.disabled; });
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
});

/* ---------- inputs ---------- */
document.addEventListener('input', function (e) {
  var el = e.target;
  if (el.hasAttribute('data-iv')) { markCustom(); setIv(state.selZone, el.getAttribute('data-iv'), +el.value); updateSimLive(); return; }
  if (el.id === 'scn-name') { state.name = el.value; var tb = $('#topbar'); if (tb) tb.innerHTML = topbar(); return; }
  if (el.id === 'scn-desc') { state.desc = el.value; return; }
  if (el.hasAttribute('data-w')) { var k = el.getAttribute('data-w'); state.weights[k] = +el.value; var o = $('#wo-' + k); if (o) o.textContent = el.value; return; }
  if (el.hasAttribute('data-ed')) { var tot = 0; CT.COVER_KEYS.forEach(function (k) { var i = $('#ed-' + k); tot += Math.max(0, +i.value || 0); }); var te = $('#ed-total'); if (te) te.textContent = 'Zone area: ' + n0(tot) + ' m²'; }
});
document.addEventListener('change', function (e) {
  var el = e.target;
  if (el.hasAttribute('data-w')) { renderPage(); return; }
  if (el.id === 'budget') { state.budgetLakh = clamp(+el.value || 150, 5, 2000); el.value = state.budgetLakh; return; }
  if (el.getAttribute('data-action') === 'cmp-pick') {
    var id = el.getAttribute('data-id'), i = state.cmp.indexOf(id);
    if (el.checked && i < 0) state.cmp.push(id); if (!el.checked && i >= 0) state.cmp.splice(i, 1);
    if (state.cmp.length > 3) state.cmp = state.cmp.slice(-3);
    renderPage(); return;
  }
  if (el.hasAttribute('data-set') || el.hasAttribute('data-cost')) saveSetting(el);
});
function saveSetting(el) {
  var msg = $('#settings-msg'), v = +el.value, min = el.getAttribute('min') != null ? +el.getAttribute('min') : -Infinity, max = el.getAttribute('max') != null ? +el.getAttribute('max') : Infinity;
  if (!isFinite(v) || el.value === '' || v < min || v > max) {
    msg.className = 'formmsg'; msg.textContent = 'Enter a value between ' + min + ' and ' + (isFinite(max) ? max : 'any') + '. The previous value was kept.';
    var cur = el.hasAttribute('data-cost') ? state.settings.costs[el.getAttribute('data-cost')] : state.settings[el.getAttribute('data-set')];
    el.value = cur; return;
  }
  if (el.hasAttribute('data-cost')) state.settings.costs[el.getAttribute('data-cost')] = v; else state.settings[el.getAttribute('data-set')] = v;
  persistSettings(); state.plan = sanitizePlan(state.plan); touch();
  msg.className = 'formmsg ok'; msg.textContent = 'Saved. Results use the new value.';
}
document.addEventListener('submit', function (e) {
  var f = e.target;
  if (f.getAttribute('data-form') !== 'edit-zone') return;
  e.preventDefault();
  var z = zoneById(state.selZone), vals = {}, msg = $('#ed-msg'), bad = null, tot = 0;
  CT.COVER_KEYS.concat(['coolingKwh']).forEach(function (k) {
    var i = $('#ed-' + k), v = i.value === '' ? NaN : +i.value;
    if (!isFinite(v) || v < 0) bad = bad || [i, CT.COVER_LABELS[k] || 'Cooling electricity'];
    vals[k] = v; if (k !== 'coolingKwh') tot += v;
  });
  if (bad) { msg.textContent = bad[1] + ' must be a number, zero or more.'; bad[0].focus(); return; }
  if (tot < 500) { msg.textContent = 'The zone area is only ' + n0(tot) + ' m². Enter at least 500 m² in total.'; return; }
  CT.COVER_KEYS.concat(['coolingKwh']).forEach(function (k) { z[k] = vals[k]; });
  persistZones(); state.plan = sanitizePlan(state.plan); touch(); state.editOpen = false; renderPage(); toast('Baseline updated for ' + z.name + '.');
});

/* ---------- boot ---------- */
(function boot() {
  root = document.getElementById('root');
  loadState();
  state.page = 'home';
  try { var h = (location.hash || '').replace('#', ''); if (PAGES.some(function (p) { return p.id === h; })) state.page = h; } catch (e) { }
  render();
})();
