/* Resultados de las etapas de evaluación — CPM N° 06-2026-CG */
(function () {
  'use strict';

  const D = window.CPM_EVAL;
  if (!D) return;

  const $ = (id) => document.getElementById(id);

  const norm = (s) =>
    String(s || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();

  /* ---------- Ponderaciones según las bases ---------- */
  const W = { pt: 0.30, pa: 0.20, ec: 0.30, ep: 0.20 };

  /* ---------- Condición general: la peor de las etapas con resultado ---------- */
  function overallCond(conds) {
    const vals = conds.filter((v) => v !== null && v !== undefined);
    if (vals.length === 0) return null;
    return Math.max(...vals);
  }

  /* ---------- Acumulado ponderado de las etapas disponibles ---------- */
  function calcAcumulado(ptScore, paScore, ecScore, epScore) {
    let acc = null;
    if (ptScore !== null) acc = (acc ?? 0) + ptScore * W.pt;
    if (paScore !== null) acc = (acc ?? 0) + paScore * W.pa;
    if (ecScore !== null) acc = (acc ?? 0) + ecScore * W.ec;
    if (epScore !== null) acc = (acc ?? 0) + epScore * W.ep;
    return acc;
  }

  /* ---------- Mapa de nombres y perfiles desde inscripción ---------- */
  // Los PDF de evaluaciones omiten el nombre para los NO CALIFICA.
  // También necesitamos saber quiénes CALIFICAN en inscripción para detectar
  // a los que no se presentaron a la evaluación.
  const nombrePorDni    = new Map();
  const inscritosCalif  = new Map(); // dni → perfil, de los CALIFICA en inscripción

  if (window.CPM_RESULTADOS && Array.isArray(window.CPM_RESULTADOS.data)) {
    window.CPM_RESULTADOS.data.forEach((r) => {
      const dni = String(r[0]).padStart(8, '0');
      if (r[1]) nombrePorDni.set(dni, r[1]);
      if (r[3] === 0) inscritosCalif.set(dni, r[2]); // cond 0 = CALIFICA
    });
  }

  /* ---------- Registros evaluados ---------- */
  // D.data: [dni, nombre, perfil, pt_score, pt_cond, pa_score, pa_cond,
  //          ec_score?, ec_cond?, ep_score?, ep_cond?]
  const evalDniSet = new Set();
  const records    = [];

  D.data.forEach((r) => {
    const dniStr  = String(r[0]).padStart(8, '0');
    evalDniSet.add(dniStr);

    const nombre  = r[1] || nombrePorDni.get(dniStr) || null;
    const ptScore = r[3]  != null ? r[3]  : null;
    const ptCond  = r[4]  != null ? r[4]  : null;
    const paScore = r[5]  != null ? r[5]  : null;
    const paCond  = r[6]  != null ? r[6]  : null;
    const ecScore = r[7]  != null ? r[7]  : null;
    const ecCond  = r[8]  != null ? r[8]  : null;
    const epScore = r[9]  != null ? r[9]  : null;
    const epCond  = r[10] != null ? r[10] : null;

    records.push({
      dni: dniStr, nombre, perfil: r[2],
      ptScore, ptCond, paScore, paCond,
      ecScore, ecCond, epScore, epCond,
      acumulado: calcAcumulado(ptScore, paScore, ecScore, epScore),
      cond:      overallCond([ptCond, paCond, ecCond, epCond]),
      _q:        norm(nombre) + ' ' + dniStr,
    });
  });

  /* ---------- Agregar los que no se presentaron ---------- */
  // CALIFICA en inscripción pero sin ningún registro de evaluación → cond 3
  inscritosCalif.forEach((perfil, dniStr) => {
    if (evalDniSet.has(dniStr)) return;
    const nombre = nombrePorDni.get(dniStr) || null;
    records.push({
      dni: dniStr, nombre, perfil,
      ptScore: null, ptCond: null, paScore: null, paCond: null,
      ecScore: null, ecCond: null, epScore: null, epCond: null,
      acumulado: null, cond: 3,
      _q: norm(nombre) + ' ' + dniStr,
    });
  });

  /* ---------- KPIs ---------- */
  let nOk = 0, nWarn = 0, nDanger = 0, nNP = 0;
  records.forEach((r) => {
    if      (r.cond === 3) nNP++;
    else if (r.cond === 2) nDanger++;
    else if (r.cond === 1) nWarn++;
    else                   nOk++;
  });

  const fmt = (n) => n.toLocaleString('es-PE');
  $('kpi-total').textContent  = fmt(records.length);
  $('kpi-ok').textContent     = fmt(nOk);
  $('kpi-warn').textContent   = fmt(nWarn);
  $('kpi-danger').textContent = fmt(nDanger);
  $('kpi-np').textContent     = fmt(nNP);

  /* ---------- Texto de publicación ---------- */
  (function buildPubInfo() {
    const pub = D.pub || {};
    const etapas = [pub.pt && 'PT', pub.pa && 'PA', pub.ec && 'EC', pub.ep && 'EP'].filter(Boolean);
    const fechas = [...new Set([pub.pt, pub.pa, pub.ec, pub.ep].filter(Boolean))];
    let text = '';
    if (!etapas.length) {
      text = 'CPM N° 06-2026-CG';
    } else if (fechas.length === 1) {
      text = `${etapas.join(' y ')} publicados el ${fechas[0]} · CPM N° 06-2026-CG`;
    } else {
      const parts = [];
      if (pub.pt) parts.push(`PT: ${pub.pt}`);
      if (pub.pa) parts.push(`PA: ${pub.pa}`);
      if (pub.ec) parts.push(`EC: ${pub.ec}`);
      if (pub.ep) parts.push(`EP: ${pub.ep}`);
      text = parts.join(' · ') + ' · CPM N° 06-2026-CG';
    }
    const el = $('eval-pub-info');
    if (el) el.textContent = text;
  })();

  /* ---------- Datalist de perfiles ---------- */
  (function buildPerfilDatalist() {
    const dl = $('dl-perfiles');
    if (!dl) return;
    const counts = {};
    records.forEach((r) => { counts[r.perfil] = (counts[r.perfil] || 0) + 1; });
    const nombres = {};
    if (window.CPM_DATA) {
      window.CPM_DATA.perfiles.forEach((p) => { nombres[parseInt(p.id, 10)] = p.puesto; });
    }
    const ids = Object.keys(counts).map(Number).sort((a, b) => a - b);
    const fragment = document.createDocumentFragment();
    ids.forEach((id) => {
      const opt = document.createElement('option');
      const nombre = nombres[id] || '';
      const label = nombre.length > 70 ? nombre.slice(0, 68) + '…' : nombre;
      opt.value = label ? `${id} — ${label} (${counts[id]})` : `${id} (${counts[id]})`;
      fragment.appendChild(opt);
    });
    dl.appendChild(fragment);
  })();

  /* ---------- Lookup de perfiles ---------- */
  const perfilesMap = {};
  if (window.CPM_DATA) {
    window.CPM_DATA.perfiles.forEach((p) => { perfilesMap[parseInt(p.id, 10)] = p; });
  }

  function perfilIdFromInput(val) {
    if (!val || !val.trim()) return null;
    const n = parseInt(val, 10);
    return isNaN(n) ? null : n;
  }

  /* ---------- Estado ---------- */
  let filtered = records;
  let page = 1;
  let perPage = 50;

  /* ---------- Elementos ---------- */
  const searchEl   = $('f-search');
  const perfilEl   = $('f-perfil');
  const condEl     = $('f-cond');
  const sortEl     = $('sort');
  const clearBtn   = $('clear-filters');
  const countEl    = $('res-count');
  const liveCount  = $('live-count');
  const tbody      = $('res-tbody');
  const emptyEl    = $('res-empty');
  const pagerEl    = $('pager');
  const perPageEl  = $('per-page');
  const kpiEls     = document.querySelectorAll('.res-kpi');
  const perfilCard = $('res-perfil-card');
  const perfilLink = $('res-perfil-link');
  const rpcCode    = $('rpc-code');
  const rpcTitle   = $('rpc-title');
  const rpcMeta    = $('rpc-meta');

  /* ---------- Tarjeta del perfil seleccionado ---------- */
  function updatePerfilCard() {
    const id = perfilIdFromInput(perfilEl.value);
    if (!id || !perfilCard) { if (perfilCard) perfilCard.hidden = true; return; }
    const p = perfilesMap[id];
    if (!p) { perfilCard.hidden = true; return; }
    rpcCode.textContent  = `N° ${p.id}-2026`;
    rpcTitle.textContent = p.puesto;
    const plazas = `${p.posiciones} plaza${p.posiciones !== 1 ? 's' : ''}`;
    const unidad = p.unidadOrganica && p.unidadOrganica !== p.organo ? p.unidadOrganica : p.organo;
    rpcMeta.textContent  = `${plazas} · ${unidad}`;
    perfilCard.hidden = false;
  }

  /* ---------- Filtrar ---------- */
  function applyFilters() {
    const q       = norm(searchEl.value);
    const perfilV = perfilIdFromInput(perfilEl.value);
    const condV   = condEl.value;

    filtered = records.filter((r) => {
      if (q && !r._q.includes(q)) return false;
      if (perfilV !== null && r.perfil !== perfilV) return false;
      if (condV !== '' && r.cond !== parseInt(condV, 10)) return false;
      return true;
    });

    // Ordenar: nulls siempre al final
    const sk = sortEl ? sortEl.value : 'dni';
    if (sk === 'acum-desc') {
      filtered = [...filtered].sort((a, b) => {
        if (a.acumulado === null && b.acumulado === null) return 0;
        if (a.acumulado === null) return 1;
        if (b.acumulado === null) return -1;
        return b.acumulado - a.acumulado;
      });
    } else if (sk === 'acum-asc') {
      filtered = [...filtered].sort((a, b) => {
        if (a.acumulado === null && b.acumulado === null) return 0;
        if (a.acumulado === null) return 1;
        if (b.acumulado === null) return -1;
        return a.acumulado - b.acumulado;
      });
    }

    page = 1;
    updatePerfilCard();
    render();
  }

  /* ---------- Renderizar tabla ---------- */
  const escHtml = (s) =>
    String(s == null ? '' : s).replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
    );

  const COND_TAG = [
    '<span class="tag tag--ok">CALIFICA</span>',
    '<span class="tag tag--warn">NO CALIFICA</span>',
    '<span class="tag tag--danger">DESCALIFICA</span>',
    '<span class="tag">NO SE PRESENTÓ</span>',
  ];

  function scoreCell(score, cond) {
    if (score === null) return '<td class="num muted">—</td>';
    const tag = cond !== null ? COND_TAG[cond] : '';
    return `<td class="num eval-score">${Number(score).toFixed(2)}<br><small>${tag}</small></td>`;
  }

  function render() {
    const total = filtered.length;
    const pages = Math.max(1, Math.ceil(total / perPage));
    if (page > pages) page = pages;

    countEl.textContent =
      total === records.length
        ? `${fmt(total)} postulantes`
        : `${fmt(total)} de ${fmt(records.length)} postulantes`;

    liveCount.innerHTML = total > 0
      ? `<strong>${fmt(total)}</strong> resultado${total !== 1 ? 's' : ''}`
      : 'Sin resultados';

    const start = (page - 1) * perPage;
    const slice = filtered.slice(start, start + perPage);

    if (slice.length === 0) {
      tbody.innerHTML = '';
      emptyEl.hidden  = false;
    } else {
      emptyEl.hidden  = true;
      tbody.innerHTML = slice
        .map(
          (r, i) =>
            `<tr>
              <td class="num muted">${fmt(start + i + 1)}</td>
              <td class="num">${r.dni}</td>
              <td>${escHtml(r.nombre)}</td>
              <td class="num"><button class="perfil-link" data-id="${r.perfil}" type="button" title="Ver requisitos del perfil N° ${r.perfil}">${r.perfil}</button></td>
              ${scoreCell(r.ptScore, r.ptCond)}
              ${scoreCell(r.paScore, r.paCond)}
              ${scoreCell(r.ecScore, r.ecCond)}
              ${scoreCell(r.epScore, r.epCond)}
              <td class="num">${r.acumulado !== null ? Number(r.acumulado).toFixed(2) : '<span class="muted">—</span>'}</td>
              <td>${r.cond !== null ? COND_TAG[r.cond] : '<span class="muted">—</span>'}</td>
            </tr>`
        )
        .join('');
    }

    renderPager(pages);
  }

  /* ---------- Paginación ---------- */
  function renderPager(pages) {
    if (pages <= 1) { pagerEl.innerHTML = ''; return; }
    const MAX_BTNS = 7;
    let html = '';
    html += `<button ${page === 1 ? 'disabled' : ''} data-p="${page - 1}" aria-label="Página anterior">‹</button>`;
    const nums = pageNums(page, pages, MAX_BTNS);
    let prev = null;
    for (const n of nums) {
      if (prev !== null && n - prev > 1) html += '<span class="pager__gap">…</span>';
      html += `<button ${n === page ? 'aria-current="page"' : ''} data-p="${n}">${n}</button>`;
      prev = n;
    }
    html += `<button ${page === pages ? 'disabled' : ''} data-p="${page + 1}" aria-label="Página siguiente">›</button>`;
    pagerEl.innerHTML = html;
  }

  function pageNums(cur, total, max) {
    if (total <= max) return Array.from({ length: total }, (_, i) => i + 1);
    const half = Math.floor((max - 2) / 2);
    let lo = Math.max(2, cur - half);
    let hi = Math.min(total - 1, cur + half);
    if (hi - lo + 1 < max - 2) {
      if (cur < total / 2) hi = Math.min(total - 1, lo + max - 3);
      else lo = Math.max(2, hi - max + 3);
    }
    const nums = [1];
    for (let i = lo; i <= hi; i++) nums.push(i);
    nums.push(total);
    return nums;
  }

  /* ---------- KPI cards como atajo de filtro ---------- */
  kpiEls.forEach((el) => {
    el.addEventListener('click', () => {
      const val = el.dataset.cond;
      condEl.value = val;
      kpiEls.forEach((k) => k.classList.remove('is-active'));
      el.classList.add('is-active');
      applyFilters();
      $('res-filters').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  });

  condEl.addEventListener('change', () => {
    const val = condEl.value;
    kpiEls.forEach((k) => k.classList.toggle('is-active', k.dataset.cond === val));
    applyFilters();
  });

  /* ---------- Eventos ---------- */
  let searchTimer;
  searchEl.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(applyFilters, 220);
  });

  let perfilTimer;
  perfilEl.addEventListener('input', () => {
    clearTimeout(perfilTimer);
    perfilTimer = setTimeout(applyFilters, 220);
  });

  if (perfilLink) {
    perfilLink.addEventListener('click', () => {
      const id = perfilIdFromInput(perfilEl.value);
      if (id && window.CPM_PERFIL_DRAWER) window.CPM_PERFIL_DRAWER.open(String(id));
    });
  }

  function clearFilters() {
    searchEl.value = '';
    perfilEl.value = '';
    condEl.value   = '';
    kpiEls.forEach((k) => k.classList.toggle('is-active', k.dataset.cond === ''));
  }

  clearBtn.addEventListener('click', () => { clearFilters(); applyFilters(); });

  sortEl.addEventListener('change', applyFilters);

  perPageEl.addEventListener('change', () => {
    perPage = parseInt(perPageEl.value, 10);
    page = 1;
    render();
  });

  tbody.addEventListener('click', (e) => {
    const btn = e.target.closest('.perfil-link');
    if (!btn) return;
    clearFilters();
    const id = parseInt(btn.dataset.id, 10);
    const opts = Array.from(document.querySelectorAll('#dl-perfiles option'));
    const match = opts.find((o) => parseInt(o.value, 10) === id);
    perfilEl.value = match ? match.value : String(id);
    applyFilters();
    $('res-filters').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });

  pagerEl.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-p]');
    if (!btn || btn.disabled) return;
    page = parseInt(btn.dataset.p, 10);
    render();
    $('results-top').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });

  /* ---------- Parámetros de URL ---------- */
  const params = new URLSearchParams(location.search);
  const urlPerfil = params.get('perfil');
  if (urlPerfil) {
    const id   = parseInt(urlPerfil, 10);
    const opts = Array.from(document.querySelectorAll('#dl-perfiles option'));
    const match = opts.find((o) => parseInt(o.value, 10) === id);
    perfilEl.value = match ? match.value : urlPerfil;
  }
  const urlCond = params.get('cond');
  if (urlCond !== null) {
    condEl.value = urlCond;
    kpiEls.forEach((k) => k.classList.toggle('is-active', k.dataset.cond === urlCond));
  }

  applyFilters();
})();
