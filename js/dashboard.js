/* Dashboard de perfiles: filtros, gráficos, resultados paginados y detalle. */
(function () {
  'use strict';

  const D = window.CPM_DATA;
  const resultsEl = document.getElementById('results');
  if (!D) {
    resultsEl.innerHTML = '<p class="empty">No se pudieron cargar los datos (js/data.js).</p>';
    return;
  }

  /* ---------- Utilidades ---------- */
  const { perfiles, funciones } = D;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const fmt = (n) => n.toLocaleString('en-US');
  const money = (n) => 'S/ ' + fmt(n);
  const catLabel = (c) => c.charAt(0) + c.slice(1).toLowerCase().replace(/\b(i|ii|iii|iv|v|vi)\b/g, (m) => m.toUpperCase());
  const years = (n) => (n > 0 ? `${Number.isInteger(n) ? n : n.toFixed(1)} ${n === 1 ? 'año' : 'años'}` : 'No aplica');
  const noAplica = (t) => !t || /^no aplica\.?$/i.test(t.trim());
  const sum = (arr, f) => arr.reduce((a, x) => a + f(x), 0);

  const ICON = {
    pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    cap: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 10 12 5 2 10l10 5 10-5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>',
    book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5V21h16"/></svg>',
    bulb: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18h6M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.3h6c0-1 .4-1.8 1-2.3A7 7 0 0 0 12 2z"/></svg>',
    brief: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>',
    star: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/></svg>',
    list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  };

  /* ---------- Índices ---------- */
  perfiles.forEach((p) => {
    p._lug = p.lugares.map((l) => norm(l.n));
    p._car = norm(p.carreras.join(' | ') + ' ' + p.carrerasTexto);
    p._q = norm([
      p.id, `${p.id}-2026`, p.puesto, p.organo, p.cargo, p.carrerasTexto, p.conocimientos,
      p.cursos.map((c) => c.texto).join(' '), p.lugares.map((l) => l.n).join(' '), p.requisitos, p.categoria,
    ].join(' '));
  });

  const TOTAL_POS = sum(perfiles, (p) => p.posiciones);
  const uniq = (arr) => Array.from(new Set(arr));
  const collator = new Intl.Collator('es', { sensitivity: 'base' });

  const ESCALAS = uniq(perfiles.map((p) => p.categoria))
    .map((cat) => ({ cat, monto: perfiles.find((p) => p.categoria === cat).remuneracion }))
    .sort((a, b) => a.monto - b.monto);
  const SEDE_CENTRAL = 'Órganos de sede central';
  const AMBITOS = uniq(perfiles.map((p) => p.ambito)).sort((a, b) => (a === SEDE_CENTRAL ? -1 : b === SEDE_CENTRAL ? 1 : collator.compare(a, b)));
  const NIVELES = uniq(perfiles.map((p) => p.nivel).filter(Boolean));
  const LUGARES = uniq(perfiles.flatMap((p) => p.lugares.map((l) => l.n))).sort(collator.compare);
  const CARRERAS = uniq(perfiles.flatMap((p) => p.carreras)).sort(collator.compare);

  /* ---------- Estado ---------- */
  const state = {
    q: '', tipo: '', ambito: '', organo: '', lugar: '', escalas: new Set(), nivel: '', carrera: '',
    exp: '', sinEsp: false, sinPub: false, sinCol: false, sort: 'codigo', perPage: 12, page: 1,
  };
  let ambitoExpanded = false;
  let vista = 'buscar'; // 'buscar' | 'general'
  let current = []; // lista filtrada y ordenada

  /* ---------- Controles ---------- */
  const el = {
    q: $('#f-q'), lugar: $('#f-lugar'), ambito: $('#f-ambito'), organo: $('#f-organo'),
    escalas: $('#f-escalas'), carrera: $('#f-carrera'), nivel: $('#f-nivel'), exp: $('#f-exp'),
    sinEsp: $('#f-sinesp'), sinPub: $('#f-sinpub'), sinCol: $('#f-sincol'),
    sort: $('#sort'), perPage: $('#per-page'), tiles: $('#tiles'), count: $('#count'),
    pills: $('#active-filters'), pager: $('#pager'), chartEscala: $('#chart-escala'),
    chartAmbito: $('#chart-ambito'), ambitoMore: $('#chart-ambito-more'),
    panel: $('#filter-panel'), summary: $('#filter-summary'), summaryText: $('#filter-summary-text'),
    editBtn: $('#edit-filters'), applyBtn: $('#apply-filters'), liveCount: $('#live-count'),
    generalNote: $('#general-note'), generalNoteText: $('#general-note-text'),
  };

  const option = (v, label) => `<option value="${esc(v)}">${esc(label || v)}</option>`;
  el.ambito.insertAdjacentHTML('beforeend', AMBITOS.map((a) => option(a)).join(''));
  el.nivel.insertAdjacentHTML('beforeend', NIVELES.map((n) => option(n)).join(''));
  $('#dl-lugares').innerHTML = LUGARES.map((l) => `<option value="${esc(l)}">`).join('');
  $('#dl-carreras').innerHTML = CARRERAS.map((c) => `<option value="${esc(c)}">`).join('');
  el.escalas.innerHTML = ESCALAS.map((e) => {
    const n = perfiles.filter((p) => p.categoria === e.cat);
    return `<label class="scale-opt">
      <input type="checkbox" value="${esc(e.cat)}">
      <span>${esc(catLabel(e.cat))}</span>
      <span class="scale-opt__amount">${money(e.monto)}</span>
      <span class="scale-opt__count" data-count="${esc(e.cat)}">${n.length} perfiles · ${fmt(sum(n, (p) => p.posiciones))} posiciones</span>
    </label>`;
  }).join('');

  function fillOrganos() {
    const pool = perfiles.filter((p) => !state.ambito || p.ambito === state.ambito);
    const orgs = uniq(pool.map((p) => p.organo)).sort(collator.compare);
    if (state.organo && !orgs.includes(state.organo)) state.organo = '';
    el.organo.innerHTML = option('', 'Todos') + orgs.map((o) => option(o)).join('');
    el.organo.value = state.organo;
  }

  /* ---------- URL <-> estado ---------- */
  function readUrl() {
    const u = new URLSearchParams(location.search);
    state.q = u.get('q') || '';
    state.tipo = u.get('tipo') || '';
    state.ambito = AMBITOS.includes(u.get('ambito')) ? u.get('ambito') : '';
    state.organo = u.get('organo') || '';
    state.lugar = u.get('lugar') || '';
    state.escalas = new Set((u.get('escala') || '').split(',').filter((c) => ESCALAS.some((e) => e.cat === c)));
    state.nivel = u.get('nivel') || '';
    state.carrera = u.get('carrera') || '';
    state.exp = u.get('exp') || '';
    state.sinEsp = u.get('sinesp') === '1';
    state.sinPub = u.get('sinpub') === '1';
    state.sinCol = u.get('sincol') === '1';
    state.sort = u.get('orden') || 'codigo';
    state.perPage = [12, 24, 48].includes(+u.get('pp')) ? +u.get('pp') : 12;
    state.page = Math.max(1, +u.get('pag') || 1);
    vista = u.get('vista') === 'general' ? 'general' : 'buscar';
    return u.get('perfil');
  }

  function writeUrl(perfilId) {
    const u = new URLSearchParams();
    const set = (k, v) => { if (v) u.set(k, v); };
    set('q', state.q); set('tipo', state.tipo); set('ambito', state.ambito); set('organo', state.organo);
    set('lugar', state.lugar); set('escala', Array.from(state.escalas).join(',')); set('nivel', state.nivel);
    set('carrera', state.carrera); set('exp', state.exp);
    if (state.sinEsp) u.set('sinesp', '1');
    if (state.sinPub) u.set('sinpub', '1');
    if (state.sinCol) u.set('sincol', '1');
    if (state.sort !== 'codigo') u.set('orden', state.sort);
    if (state.perPage !== 12) u.set('pp', state.perPage);
    if (state.page > 1) u.set('pag', state.page);
    if (vista === 'general') u.set('vista', 'general');
    if (perfilId) u.set('perfil', perfilId);
    const qs = u.toString();
    try { history.replaceState(null, '', qs ? `?${qs}` : location.pathname); } catch (e) { /* file:// en algunos navegadores */ }
  }

  function syncControls() {
    el.q.value = state.q;
    $$('input[name="tipo"]').forEach((r) => { r.checked = r.value === state.tipo; });
    el.ambito.value = state.ambito;
    fillOrganos();
    el.lugar.value = state.lugar;
    $$('input', el.escalas).forEach((c) => { c.checked = state.escalas.has(c.value); });
    el.carrera.value = state.carrera;
    el.nivel.value = state.nivel;
    el.exp.value = state.exp;
    el.sinEsp.checked = state.sinEsp;
    el.sinPub.checked = state.sinPub;
    el.sinCol.checked = state.sinCol;
    el.sort.value = state.sort;
    el.perPage.value = String(state.perPage);
  }

  /* ---------- Filtrado ---------- */
  function matches(p, except) {
    const s = state;
    if (except !== 'q' && s.q) {
      const tokens = norm(s.q).split(/\s+/);
      if (!tokens.every((t) => p._q.includes(t))) return false;
    }
    if (except !== 'tipo' && s.tipo && p.tipo !== s.tipo) return false;
    if (except !== 'ambito' && s.ambito && p.ambito !== s.ambito) return false;
    if (except !== 'organo' && s.organo && p.organo !== s.organo) return false;
    if (except !== 'lugar' && s.lugar) {
      const l = norm(s.lugar);
      if (!p._lug.some((x) => x.includes(l))) return false;
    }
    if (except !== 'escala' && s.escalas.size && !s.escalas.has(p.categoria)) return false;
    if (except !== 'nivel' && s.nivel && p.nivel !== s.nivel) return false;
    if (except !== 'carrera' && s.carrera && !p._car.includes(norm(s.carrera))) return false;
    if (except !== 'exp' && s.exp !== '' && p.exp.generalAnios > +s.exp) return false;
    if (s.sinEsp && p.exp.funcionAnios > 0) return false;
    if (s.sinPub && p.exp.publicoAnios > 0) return false;
    if (s.sinCol && p.colegiatura) return false;
    return true;
  }
  const filtered = (except) => perfiles.filter((p) => matches(p, except));

  const SORTS = {
    codigo: (a, b) => a.id.localeCompare(b.id),
    'rem-desc': (a, b) => b.remuneracion - a.remuneracion || a.id.localeCompare(b.id),
    'rem-asc': (a, b) => a.remuneracion - b.remuneracion || a.id.localeCompare(b.id),
    'pos-desc': (a, b) => b.posiciones - a.posiciones || a.id.localeCompare(b.id),
    'exp-asc': (a, b) => a.exp.generalAnios - b.exp.generalAnios || a.id.localeCompare(b.id),
  };

  /* ---------- Render ---------- */
  function render(opts = {}) {
    current = filtered().sort(SORTS[state.sort] || SORTS.codigo);
    const pages = Math.max(1, Math.ceil(current.length / state.perPage));
    if (state.page > pages) state.page = pages;
    renderTiles();
    renderCharts();
    renderPills();
    renderResults();
    renderPager(pages);
    writeUrl(opts.perfil);
  }

  function renderTiles() {
    const pos = sum(current, (p) => p.posiciones);
    const orgs = uniq(current.map((p) => p.organo)).length;
    const rems = current.map((p) => p.remuneracion);
    const rango = rems.length ? (Math.min(...rems) === Math.max(...rems) ? fmt(rems[0]) : `${fmt(Math.min(...rems))} – ${fmt(Math.max(...rems))}`) : '—';
    const tile = (label, value, hint) => `<div class="card tile"><div class="tile__label">${label}</div><div class="tile__value">${value}</div><div class="tile__hint">${hint}</div></div>`;
    el.tiles.innerHTML =
      tile('Perfiles', fmt(current.length), `de ${fmt(perfiles.length)} convocados`) +
      tile('Posiciones', fmt(pos), `de ${fmt(TOTAL_POS)} en total`) +
      tile('Órganos', fmt(orgs), 'unidades de organización') +
      tile('Remuneración (S/)', rango, 'mensual, según escala');
  }

  function barRow({ label, value, max, active, title, data }) {
    const w = max ? Math.max(1.5, (value / max) * 100) : 0;
    return `<button type="button" class="hbar${active ? ' is-active' : ''}" aria-pressed="${active}" title="${esc(title)}" ${data}>
      <span class="hbar__label">${esc(label)}</span>
      <span class="hbar__track"><span class="hbar__fill" style="width:${value ? w : 0}%"></span></span>
      <span class="hbar__value">${fmt(value)}</span>
    </button>`;
  }

  function renderCharts() {
    // Cada gráfico ignora su propio filtro para que se pueda alternar.
    const byEscala = filtered('escala');
    const rowsE = ESCALAS.map((e) => {
      const ps = byEscala.filter((p) => p.categoria === e.cat);
      return { e, perf: ps.length, pos: sum(ps, (p) => p.posiciones) };
    });
    const maxE = Math.max(0, ...rowsE.map((r) => r.pos));
    el.chartEscala.innerHTML = rowsE.map((r) => barRow({
      label: `${catLabel(r.e.cat)} · ${money(r.e.monto)}`,
      value: r.pos, max: maxE, active: state.escalas.has(r.e.cat),
      title: `${catLabel(r.e.cat)} (${money(r.e.monto)}): ${fmt(r.pos)} posiciones en ${r.perf} perfiles`,
      data: `data-escala="${esc(r.e.cat)}"`,
    })).join('');
    rowsE.forEach((r) => {
      const c = el.escalas.querySelector(`[data-count="${CSS.escape(r.e.cat)}"]`);
      if (c) c.textContent = `${r.perf} perfiles · ${fmt(r.pos)} posiciones`;
    });

    const byAmbito = filtered('ambito');
    const rowsA = AMBITOS.map((a) => {
      const ps = byAmbito.filter((p) => p.ambito === a);
      return { a, perf: ps.length, pos: sum(ps, (p) => p.posiciones) };
    }).filter((r) => r.pos > 0 || r.a === state.ambito).sort((x, y) => y.pos - x.pos || collator.compare(x.a, y.a));
    const maxA = Math.max(0, ...rowsA.map((r) => r.pos));
    const LIMIT = 8;
    let shown = ambitoExpanded ? rowsA : rowsA.slice(0, LIMIT);
    if (!ambitoExpanded && state.ambito && !shown.some((r) => r.a === state.ambito)) {
      shown = shown.concat(rowsA.filter((r) => r.a === state.ambito));
    }
    el.chartAmbito.innerHTML = shown.length
      ? shown.map((r) => barRow({
        label: r.a, value: r.pos, max: maxA, active: state.ambito === r.a,
        title: `${r.a}: ${fmt(r.pos)} posiciones en ${r.perf} perfiles`, data: `data-ambito="${esc(r.a)}"`,
      })).join('')
      : '<p class="muted" style="margin:0">Sin posiciones con estos filtros.</p>';
    el.ambitoMore.hidden = rowsA.length <= LIMIT;
    el.ambitoMore.textContent = ambitoExpanded ? 'Ver menos' : `Ver todos (${rowsA.length})`;
  }

  function renderPills() {
    const pills = [];
    const add = (label, clear) => pills.push({ label, clear });
    if (state.q) add(`“${state.q}”`, () => { state.q = ''; });
    if (state.tipo) add(state.tipo, () => { state.tipo = ''; });
    if (state.lugar) add(`Lugar: ${state.lugar}`, () => { state.lugar = ''; });
    if (state.ambito) add(state.ambito, () => { state.ambito = ''; });
    if (state.organo) add(state.organo, () => { state.organo = ''; });
    state.escalas.forEach((c) => add(`${catLabel(c)} · ${money(ESCALAS.find((e) => e.cat === c).monto)}`, () => { state.escalas.delete(c); }));
    if (state.carrera) add(`Carrera: ${state.carrera}`, () => { state.carrera = ''; });
    if (state.nivel) add(state.nivel, () => { state.nivel = ''; });
    if (state.exp) add(`Experiencia ≤ ${state.exp} años`, () => { state.exp = ''; });
    if (state.sinEsp) add('Sin exp. específica', () => { state.sinEsp = false; });
    if (state.sinPub) add('Sin exp. sector público', () => { state.sinPub = false; });
    if (state.sinCol) add('Sin colegiatura', () => { state.sinCol = false; });
    el.pills.innerHTML = pills.map((p, i) => `<button type="button" class="pill" data-pill="${i}" aria-label="Quitar filtro ${esc(p.label)}"><span>${esc(p.label)}</span>${ICON.x}</button>`).join('');
    el.pills._pills = pills;

    const n = current.length;
    const encontrados = n === 1 ? '1 perfil encontrado' : `${fmt(n)} perfiles encontrados`;
    const aplicados = pills.length === 1 ? '1 filtro aplicado' : `${pills.length} filtros aplicados`;
    el.count.textContent = encontrados;
    el.liveCount.innerHTML = `<strong>${fmt(n)}</strong> ${n === 1 ? 'perfil coincide' : 'perfiles coinciden'}`;
    el.applyBtn.textContent = n === 1 ? 'Aceptar · ver 1 perfil' : `Aceptar · ver ${fmt(n)} perfiles`;
    el.summaryText.textContent = pills.length ? `${aplicados} · ${encontrados}` : `Sin filtros · se muestran los ${fmt(perfiles.length)} perfiles`;
    el.generalNote.hidden = !pills.length;
    el.generalNoteText.textContent = `Las cifras corresponden a ${aplicados}.`;
  }

  function carrerasCorto(p) {
    if (!p.carreras.length) return p.nivel === 'Secundaria' ? 'No requiere carrera · Secundaria completa' : p.carrerasTexto || '—';
    const txt = p.carreras.join(', ');
    return p.carrerasAfines ? `${txt} u otras afines` : txt;
  }

  function lugarCorto(p) {
    const l = norm(state.lugar);
    const match = l ? p.lugares.find((x) => norm(x.n).includes(l)) : null;
    if (match) return `${match.n} (${match.c})`;
    if (p.lugares.length === 1) return p.lugares[0].n;
    return `${p.lugares.length} lugares de prestación`;
  }

  function renderResults() {
    const start = (state.page - 1) * state.perPage;
    const page = current.slice(start, start + state.perPage);
    if (!page.length) {
      resultsEl.innerHTML = `<div class="card empty" style="grid-column:1/-1">${ICON.search}<p><strong>No hay perfiles con esos filtros.</strong></p><p>Prueba quitando alguno de los filtros activos.</p><button type="button" class="btn btn--ghost btn--sm" data-clear>Limpiar filtros</button></div>`;
      return;
    }
    resultsEl.innerHTML = page.map((p) => `
      <article class="card pcard" tabindex="0" role="button" data-id="${p.id}" aria-label="Ver perfil ${p.id}-2026: ${esc(p.puesto)}">
        <div class="pcard__top">
          <span class="pcard__code">N° ${p.id}-2026</span>
          <span class="tag${p.tipo === 'Programa de formación' ? ' tag--accent' : ''}">${esc(p.tipo)}</span>
        </div>
        <h3 class="pcard__title">${esc(p.puesto)}</h3>
        <p class="pcard__org">${esc(p.organo)}</p>
        <div class="pcard__money">
          <span class="pcard__amount">${money(p.remuneracion)}</span>
          <span class="tag">${esc(catLabel(p.categoria))}</span>
        </div>
        <p class="pcard__careers"><strong>Carreras:</strong> ${esc(carrerasCorto(p))}</p>
        <p class="pcard__place">${ICON.pin}<span>${esc(lugarCorto(p))}</span></p>
        <dl class="pcard__meta">
          <div><dt>Posiciones</dt><dd>${p.posiciones}</dd></div>
          <div><dt>Exp. general</dt><dd>${years(p.exp.generalAnios)}</dd></div>
          <div><dt>Exp. específica</dt><dd>${years(p.exp.funcionAnios)}</dd></div>
        </dl>
      </article>`).join('');
  }

  function renderPager(pages) {
    if (pages <= 1) { el.pager.innerHTML = ''; return; }
    const cur = state.page;
    const nums = [];
    for (let i = 1; i <= pages; i++) {
      if (i === 1 || i === pages || Math.abs(i - cur) <= 1) nums.push(i);
      else if (nums[nums.length - 1] !== '…') nums.push('…');
    }
    el.pager.innerHTML =
      `<button type="button" data-page="${cur - 1}" ${cur === 1 ? 'disabled' : ''} aria-label="Página anterior">‹</button>` +
      nums.map((n) => (n === '…' ? '<span class="pager__gap">…</span>' : `<button type="button" data-page="${n}" ${n === cur ? 'aria-current="page"' : ''}>${n}</button>`)).join('') +
      `<button type="button" data-page="${cur + 1}" ${cur === pages ? 'disabled' : ''} aria-label="Página siguiente">›</button>`;
  }

  /* ---------- Detalle ---------- */
  const dlg = $('#detail');
  const dBody = $('#d-body');
  let dTab = 'resumen';
  let dId = null;

  const panel = (icon, title, body) => `<section class="panel"><h3>${ICON[icon] || ''}${esc(title)}</h3>${body}</section>`;
  // Omite filas sin valor (algunos perfiles no traen todos los datos de identificación).
  const kv = (rows) => `<dl class="kv">${rows.filter((r) => r && String(r[1]).trim()).map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join('')}</dl>`;
  const yesNo = (b, yes, no) => (b ? `<span class="tag tag--accent">${ICON.check}${yes}</span>` : `<span class="tag">${no}</span>`);
  const chips = (items) => `<ul class="chip-list">${items.map((i) => `<li><span class="chip">${esc(i)}</span></li>`).join('')}</ul>`;

  function tabResumen(p) {
    const expEsp = p.exp.funcionAnios ? `${years(p.exp.funcionAnios)} en la función o materia` : 'No aplica';
    const extra = noAplica(p.requisitos) ? null : ['Requisito adicional', esc(p.requisitos)];
    return `
      <div class="facts">
        <div class="fact"><div class="fact__label">Remuneración mensual</div><div class="fact__value">${money(p.remuneracion)}</div><div class="fact__hint">${esc(catLabel(p.categoria))}</div></div>
        <div class="fact"><div class="fact__label">Posiciones</div><div class="fact__value">${p.posiciones}</div><div class="fact__hint">${p.lugares.length} ${p.lugares.length === 1 ? 'lugar' : 'lugares'} de prestación</div></div>
        <div class="fact"><div class="fact__label">Tipo</div><div class="fact__value">${esc(p.tipo)}</div><div class="fact__hint">${p.clasificacion ? `Clasificación ${esc(p.clasificacion)}` : esc(catLabel(p.categoria))}</div></div>
      </div>
      ${p.tipo === 'Programa de formación' ? `<div class="callout" style="margin-bottom:12px">${ICON.cap}<p>Quienes ganen ingresan al <strong>Programa de Formación y Entrenamiento de la Escuela Nacional de Control</strong> durante el periodo de prueba. Deben haber egresado <strong>desde el 01/07/2021</strong>.</p></div>` : ''}
      ${panel('star', 'Lo más relevante del perfil', kv([
        ['Formación', esc([p.nivel, p.grado].filter(Boolean).join(' · ') || '—')],
        ['Carreras', esc(carrerasCorto(p))],
        ['Experiencia general', years(p.exp.generalAnios)],
        ['Experiencia específica', esc(expEsp)],
        p.exp.publicoAnios ? ['En el sector público', years(p.exp.publicoAnios)] : null,
        ['Colegiatura y habilitación', p.colegiatura ? 'Sí, requeridas' : 'No requeridas'],
        ['Cursos / programas', p.cursos.length ? esc(p.cursos.map((c) => c.tipo + (c.horas ? ` (${c.horas} h)` : '')).join(' + ')) : 'No aplica'],
        extra,
      ]))}
      ${p.mision ? panel('bulb', 'Misión del puesto', `<p>${esc(p.mision)}</p>`) : ''}
      ${panel('brief', 'Identificación del puesto', kv([
        ['Órgano', esc(p.organo)],
        p.unidadOrganica !== p.organo ? ['Unidad orgánica', esc(p.unidadOrganica)] : null,
        ['Nombre del cargo', esc(p.cargo)],
        ['Dependencia jerárquica', esc(p.dependencia)],
      ]))}`;
  }

  function tabFormacion(p) {
    const cursos = p.cursos.length
      ? p.cursos.map((c) => `<div class="course"><span class="tag${c.tipo === 'Curso' ? '' : ' tag--accent'}">${esc(c.tipo)}</span><p>${esc(c.texto)}</p>${c.horas && !/horas/i.test(c.texto) ? `<small>Mínimo ${c.horas} horas</small>` : ''}</div>`).join('')
      : '<p>No aplica.</p>';
    const ofi = (p.ofimatica || []).map((o) => `${o.n}: ${o.v}`);
    const idi = (p.idiomas || []).map((o) => `${o.n}: ${o.v}`);
    return `
      ${panel('cap', 'Formación académica', kv([
        ['Nivel educativo', esc(p.nivel || '—')],
        ['Grado o situación académica', esc(p.grado || 'No aplica')],
        ['Colegiatura', yesNo(p.colegiatura, 'Requerida', 'No requerida')],
        ['Habilitación profesional', yesNo(p.habilitacion, 'Requerida', 'No requerida')],
        p.maestria ? ['Maestría', esc(p.maestria)] : null,
      ]))}
      ${panel('cap', 'Carreras requeridas', p.carreras.length
        ? chips(p.carreras) + (p.carrerasAfines ? '<p class="muted" style="margin:10px 0 0;font-size:.86rem">…u otras afines por la formación (según el Clasificador del INEI 2022 y con relación directa a las funciones).</p>' : '')
        : `<p>${esc(p.nivel === 'Secundaria' ? 'No requiere carrera: secundaria completa.' : p.carrerasTexto || 'No aplica.')}</p>`)}
      ${panel('book', 'Cursos y programas de especialización', `${cursos}<p class="muted" style="margin:10px 0 0;font-size:.84rem">Se sustentan con certificados o constancias. Los programas y diplomados deben tener mínimo 90 horas (80 si los organiza el ente rector).</p>`)}
      ${panel('bulb', 'Conocimientos técnicos', `<p>${esc(p.conocimientos || 'No aplica.')}</p><p class="muted" style="margin:0;font-size:.84rem">No se sustentan con documentos.</p>`)}
      ${ofi.length || idi.length ? panel('list', 'Ofimática e idiomas', `${ofi.length ? chips(ofi) : ''}${idi.length ? `<div style="margin-top:8px">${chips(idi)}</div>` : ''}<p class="muted" style="margin:10px 0 0;font-size:.84rem">Solo se declaran en la Ficha de Postulante.</p>`) : ''}`;
  }

  function tabExperiencia(p) {
    const box = (label, n, texto) => `<div class="exp${n ? '' : ' exp--na'}"><div class="exp__label">${label}</div><div class="exp__value">${n ? years(n) : esc(texto && !noAplica(texto) ? texto : 'No aplica')}</div></div>`;
    return `
      ${panel('brief', 'Experiencia solicitada', `<div class="exp-grid">
        ${box('Experiencia general (pública o privada)', p.exp.generalAnios, p.exp.general)}
        ${box('Específica en la función o materia', p.exp.funcionAnios, p.exp.funcion)}
        ${box('Específica en el sector público', p.exp.publicoAnios, p.exp.publico)}
        ${box('Específica en el puesto o cargo', p.exp.puestoAnios, p.exp.puesto)}
      </div>`)}
      ${noAplica(p.exp.otros) ? '' : panel('info', 'Otros aspectos sobre la experiencia', `<p>${esc(p.exp.otros)}</p>`)}
      <div class="callout" style="margin-top:12px">${ICON.info}<div>
        <p>La experiencia se cuenta <strong>desde la fecha de egreso</strong>. Las prácticas preprofesionales (3 meses o más) y las profesionales (hasta 24 meses) cuentan como experiencia. La experiencia específica forma parte de la general.</p>
        <p><a href="index.html#curricular">Ver cómo se acredita la experiencia</a></p>
      </div></div>`;
  }

  function tabAdicional(p) {
    const l = norm(state.lugar);
    const lugares = `<ul class="places">${p.lugares.map((x) => `<li class="${l && norm(x.n).includes(l) ? 'is-match' : ''}"><span>${esc(x.n)}</span><span class="places__n" title="Posiciones">${x.c} ${x.c === 1 ? 'posición' : 'posiciones'}</span></li>`).join('')}</ul>`;
    const hab = p.habilidades ? p.habilidades.replace(/\.$/, '').split(/,\s*|\s+y\s+/).filter(Boolean) : [];
    const licencia = /licencia de conducir/i.test(p.requisitos);
    return `
      ${panel('star', 'Requisitos adicionales', `<p>${esc(noAplica(p.requisitos) ? 'No aplica.' : p.requisitos)}</p>${licencia ? '<p class="muted" style="margin:0;font-size:.86rem">La licencia debe estar vigente al postular y adjuntarse (nota del Anexo N° 03).</p>' : ''}`)}
      ${panel('pin', `Lugares de prestación (${p.lugares.length})`, lugares + `<p class="muted" style="margin:10px 0 0;font-size:.84rem">${esc(p.tipoLugar)}. Las sedes se asignan según priorización y necesidad institucional.</p>`)}
      ${hab.length ? panel('bulb', 'Habilidades o competencias', chips(hab.map((h) => h.charAt(0).toUpperCase() + h.slice(1)))) : ''}`;
  }

  function tabFunciones(p) {
    return panel('list', `Funciones del puesto (${p.fn.length})`, `<ol class="fn-list">${p.fn.map((i) => `<li>${esc(funciones[i])}</li>`).join('')}</ol>`);
  }

  const TABS = { resumen: tabResumen, formacion: tabFormacion, experiencia: tabExperiencia, adicional: tabAdicional, funciones: tabFunciones };

  function paintDetail() {
    const p = perfiles.find((x) => x.id === dId);
    if (!p) return;
    $('#d-code').textContent = `Perfil N° ${p.id}-2026`;
    $('#d-title').textContent = p.puesto;
    $('#d-org').textContent = p.organo;
    $$('[data-tab]', dlg).forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === dTab)));
    dBody.innerHTML = TABS[dTab](p);
    dBody.scrollTop = 0;
    const idx = current.findIndex((x) => x.id === p.id);
    $('#d-prev').disabled = idx <= 0;
    $('#d-next').disabled = idx < 0 || idx >= current.length - 1;
    $('#d-pos').textContent = idx >= 0 ? `${idx + 1} de ${fmt(current.length)}` : '';
  }

  function openDetail(id) {
    dId = id;
    paintDetail();
    if (!dlg.open) dlg.showModal();
    writeUrl(id);
  }

  function stepDetail(delta) {
    const idx = current.findIndex((x) => x.id === dId);
    const next = current[idx + delta];
    if (!next) return;
    dId = next.id;
    paintDetail();
    writeUrl(dId);
  }

  $$('[data-tab]', dlg).forEach((b) => b.addEventListener('click', () => { dTab = b.dataset.tab; paintDetail(); }));
  $('.drawer__tabs').addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const tabs = $$('[data-tab]', dlg);
    const i = tabs.findIndex((t) => t.dataset.tab === dTab);
    const t = tabs[(i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
    dTab = t.dataset.tab;
    paintDetail();
    t.focus();
  });
  $('#d-close').addEventListener('click', () => dlg.close());
  $('#d-prev').addEventListener('click', () => stepDetail(-1));
  $('#d-next').addEventListener('click', () => stepDetail(1));
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  dlg.addEventListener('close', () => { dId = null; writeUrl(); });

  /* ---------- Eventos ---------- */
  const update = (resetPage = true) => { if (resetPage) state.page = 1; render(); };
  let tq;
  el.q.addEventListener('input', () => { clearTimeout(tq); tq = setTimeout(() => { state.q = el.q.value.trim(); update(); }, 180); });
  $$('input[name="tipo"]').forEach((r) => r.addEventListener('change', () => { state.tipo = r.value; update(); }));
  el.lugar.addEventListener('input', () => { clearTimeout(tq); tq = setTimeout(() => { state.lugar = el.lugar.value.trim(); update(); }, 200); });
  el.ambito.addEventListener('change', () => { state.ambito = el.ambito.value; fillOrganos(); update(); });
  el.organo.addEventListener('change', () => { state.organo = el.organo.value; update(); });
  el.escalas.addEventListener('change', (e) => {
    if (e.target.checked) state.escalas.add(e.target.value); else state.escalas.delete(e.target.value);
    update();
  });
  el.carrera.addEventListener('input', () => { clearTimeout(tq); tq = setTimeout(() => { state.carrera = el.carrera.value.trim(); update(); }, 200); });
  el.nivel.addEventListener('change', () => { state.nivel = el.nivel.value; update(); });
  el.exp.addEventListener('change', () => { state.exp = el.exp.value; update(); });
  el.sinEsp.addEventListener('change', () => { state.sinEsp = el.sinEsp.checked; update(); });
  el.sinPub.addEventListener('change', () => { state.sinPub = el.sinPub.checked; update(); });
  el.sinCol.addEventListener('change', () => { state.sinCol = el.sinCol.checked; update(); });
  el.sort.addEventListener('change', () => { state.sort = el.sort.value; update(); });
  el.perPage.addEventListener('change', () => { state.perPage = +el.perPage.value; update(); });

  function clearAll() {
    Object.assign(state, { q: '', tipo: '', ambito: '', organo: '', lugar: '', nivel: '', carrera: '', exp: '', sinEsp: false, sinPub: false, sinCol: false, page: 1 });
    state.escalas.clear();
    syncControls();
    render();
  }
  $('#clear-filters').addEventListener('click', clearAll);

  el.chartEscala.addEventListener('click', (e) => {
    const b = e.target.closest('[data-escala]');
    if (!b) return;
    const c = b.dataset.escala;
    const agregar = !state.escalas.has(c);
    if (agregar) state.escalas.add(c); else state.escalas.delete(c);
    syncControls();
    update();
    if (agregar) goToResults();
  });
  el.chartAmbito.addEventListener('click', (e) => {
    const b = e.target.closest('[data-ambito]');
    if (!b) return;
    state.ambito = state.ambito === b.dataset.ambito ? '' : b.dataset.ambito;
    syncControls();
    update();
    if (state.ambito) goToResults();
  });
  el.ambitoMore.addEventListener('click', () => { ambitoExpanded = !ambitoExpanded; renderCharts(); });

  el.pills.addEventListener('click', (e) => {
    const b = e.target.closest('[data-pill]');
    if (!b) return;
    el.pills._pills[+b.dataset.pill].clear();
    syncControls();
    update();
  });

  resultsEl.addEventListener('click', (e) => {
    if (e.target.closest('[data-clear]')) { clearAll(); return; }
    const card = e.target.closest('[data-id]');
    if (card) openDetail(card.dataset.id);
  });
  resultsEl.addEventListener('keydown', (e) => {
    const card = e.target.closest('[data-id]');
    if (card && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openDetail(card.dataset.id); }
  });

  el.pager.addEventListener('click', (e) => {
    const b = e.target.closest('[data-page]');
    if (!b || b.disabled) return;
    state.page = +b.dataset.page;
    render();
    $('.results-bar').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  /* ---------- Vistas (pestañas) y panel de filtros ---------- */
  const viewTabs = $$('[data-view]');
  function setView(v, focus = false) {
    vista = v === 'general' ? 'general' : 'buscar';
    viewTabs.forEach((t) => {
      const on = t.dataset.view === vista;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
      if (on && focus) t.focus();
    });
    writeUrl(dId);
  }
  viewTabs.forEach((t) => t.addEventListener('click', () => setView(t.dataset.view)));
  $('.page-tabs').addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') setView(vista === 'buscar' ? 'general' : 'buscar', true);
  });

  // Al aceptar se ocultan los filtros y queda visible un resumen con lo aplicado.
  function setFiltersOpen(open) {
    el.panel.hidden = !open;
    el.summary.hidden = open;
    el.editBtn.setAttribute('aria-expanded', String(open));
  }
  function goToResults() {
    setView('buscar');
    setFiltersOpen(false);
    el.summary.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function flushTextFilters() {
    clearTimeout(tq);
    state.q = el.q.value.trim();
    state.lugar = el.lugar.value.trim();
    state.carrera = el.carrera.value.trim();
    update();
  }
  el.applyBtn.addEventListener('click', () => { flushTextFilters(); goToResults(); });
  el.editBtn.addEventListener('click', () => {
    setFiltersOpen(true);
    el.panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  el.panel.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.matches('input.input')) {
      e.preventDefault();
      flushTextFilters();
      goToResults();
    }
  });
  $('#clear-general').addEventListener('click', clearAll);

  /* ---------- Inicio ---------- */
  const perfilInicial = readUrl();
  syncControls();
  render();
  // Un enlace que ya trae filtros abre directamente los resultados con el resumen visible.
  setFiltersOpen(!el.pills._pills.length);
  setView(vista);
  if (perfilInicial && perfiles.some((p) => p.id === perfilInicial)) openDetail(perfilInicial);
})();
