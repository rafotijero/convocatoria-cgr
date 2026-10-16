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
  // Las publicaciones de evaluaciones omiten el nombre de los NO CALIFICA, DESCALIFICA
  // y NO SE PRESENTÓ. Los CALIFICA en inscripción sirven además de respaldo para
  // detectar a quienes no figuren en ninguna evaluación.
  // Clave de cruce sin ceros a la izquierda: inscripción guarda el documento como número
  // y los carnés de extranjería (9 dígitos) no coinciden al rellenar a 8.
  const docKey = (d) => String(d).replace(/^0+/, '');
  const nombrePorDni    = new Map();
  const inscritosCalif  = new Map(); // docKey → perfil, de los CALIFICA en inscripción

  if (window.CPM_RESULTADOS && Array.isArray(window.CPM_RESULTADOS.data)) {
    window.CPM_RESULTADOS.data.forEach((r) => {
      const dni = docKey(r[0]);
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
    evalDniSet.add(docKey(dniStr));

    const nombre  = r[1] || nombrePorDni.get(docKey(dniStr)) || null;
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
      ganando:   false,
      _q:        norm(nombre) + ' ' + dniStr,
    });
  });

  /* ---------- Agregar los que no se presentaron ---------- */
  // (ganando siempre false para estos)
  // CALIFICA en inscripción pero sin ningún registro de evaluación → cond 3
  // (los NO SE PRESENTÓ ya vienen en D.data; esto solo cubre omisiones)
  inscritosCalif.forEach((perfil, key) => {
    if (evalDniSet.has(key)) return;
    const dniStr = key.padStart(8, '0');
    const nombre = nombrePorDni.get(key) || null;
    records.push({
      dni: dniStr, nombre, perfil,
      ptScore: null, ptCond: null, paScore: null, paCond: null,
      ecScore: null, ecCond: null, epScore: null, epCond: null,
      acumulado: null, cond: 3, ganando: false,
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

  /* ---------- Marcar ganadores por perfil ---------- */
  // Por cada perfil, los N primeros CALIFICA por puntaje acumulado "van ganando",
  // donde N = número de plazas del perfil. Los empates en el límite se incluyen todos.
  (function markGanadores() {
    const porPerfil = {};
    records.forEach((r) => {
      if (r.cond !== 0 || r.acumulado === null) return;
      if (!porPerfil[r.perfil]) porPerfil[r.perfil] = [];
      porPerfil[r.perfil].push(r);
    });

    Object.entries(porPerfil).forEach(([perfil, grupo]) => {
      const p = perfilesMap[parseInt(perfil, 10)];
      const plazas = p ? p.posiciones : 0;
      if (!plazas) return;

      const sorted    = [...grupo].sort((a, b) => b.acumulado - a.acumulado);
      const limiteIdx = Math.min(plazas, sorted.length) - 1;
      if (limiteIdx < 0) return;
      const limiteScore = sorted[limiteIdx].acumulado;

      grupo.forEach((r) => { if (r.acumulado >= limiteScore) r.ganando = true; });
    });
  })();

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
  const ptCondEl   = $('f-pt-cond');
  const ptMinEl    = $('f-pt-min');
  const ptMaxEl    = $('f-pt-max');
  const paCondEl   = $('f-pa-cond');
  const paMinEl    = $('f-pa-min');
  const paMaxEl    = $('f-pa-max');
  const presetEls  = document.querySelectorAll('#eval-presets [data-preset]');
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

  /* ---------- Estado de filtros ↔ parámetros de URL ---------- */
  // Los campos de la vista se leen y escriben como parámetros (?pt=0&pa=1&ptmin=20…),
  // así las consultas rápidas, la URL y el formulario comparten una sola representación.
  // La búsqueda por nombre o DNI queda fuera para no dejar datos personales en enlaces.
  let soloGanando = false;
  const CAMPOS = {
    cond:  condEl,
    pt:    ptCondEl,
    ptmin: ptMinEl,
    ptmax: ptMaxEl,
    pa:    paCondEl,
    pamin: paMinEl,
    pamax: paMaxEl,
  };

  function getParams() {
    const p = new URLSearchParams();
    const perfilV = perfilIdFromInput(perfilEl.value);
    if (perfilV !== null) p.set('perfil', perfilV);
    Object.entries(CAMPOS).forEach(([k, el]) => { if (el.value.trim() !== '') p.set(k, el.value.trim()); });
    if (soloGanando) p.set('ganando', '1');
    return p;
  }

  function setParams(p) {
    const perfil = p.get('perfil');
    if (perfil) {
      const id    = parseInt(perfil, 10);
      const opts  = Array.from(document.querySelectorAll('#dl-perfiles option'));
      const match = opts.find((o) => parseInt(o.value, 10) === id);
      perfilEl.value = match ? match.value : perfil;
    } else {
      perfilEl.value = '';
    }
    Object.entries(CAMPOS).forEach(([k, el]) => { el.value = p.get(k) || ''; });
    soloGanando = p.get('ganando') === '1';
    syncKpis();
  }

  function syncKpis() {
    kpiEls.forEach((k) => k.classList.toggle('is-active', k.dataset.cond === condEl.value));
  }

  // Marca la consulta rápida que coincide exactamente con los filtros actuales
  function syncPresets(current) {
    const cur = new URLSearchParams(current);
    cur.delete('perfil');
    cur.sort();
    presetEls.forEach((b) => {
      const pre = new URLSearchParams(b.dataset.preset);
      pre.sort();
      b.classList.toggle('is-active', pre.toString() === cur.toString());
    });
  }

  const num = (el) => {
    const v = el.value.trim();
    if (v === '') return null;
    const n = parseFloat(v.replace(',', '.'));
    return isNaN(n) ? null : n;
  };

  // Condición de una etapa: '' cualquiera, 'none' sin registro, o el código numérico
  function matchEtapa(score, cond, condV, min, max) {
    if (condV === 'none') { if (cond !== null) return false; }
    else if (condV !== '' && cond !== parseInt(condV, 10)) return false;
    if (min !== null && (score === null || score < min)) return false;
    if (max !== null && (score === null || score > max)) return false;
    return true;
  }

  /* ---------- Filtrar ---------- */
  function applyFilters() {
    const q       = norm(searchEl.value);
    const perfilV = perfilIdFromInput(perfilEl.value);
    const condV   = condEl.value;
    const ptCondV = ptCondEl.value, ptMin = num(ptMinEl), ptMax = num(ptMaxEl);
    const paCondV = paCondEl.value, paMin = num(paMinEl), paMax = num(paMaxEl);

    filtered = records.filter((r) => {
      if (q && !r._q.includes(q)) return false;
      if (perfilV !== null && r.perfil !== perfilV) return false;
      if (condV !== '' && r.cond !== parseInt(condV, 10)) return false;
      if (!matchEtapa(r.ptScore, r.ptCond, ptCondV, ptMin, ptMax)) return false;
      if (!matchEtapa(r.paScore, r.paCond, paCondV, paMin, paMax)) return false;
      if (soloGanando && !r.ganando) return false;
      return true;
    });

    const params = getParams();
    syncPresets(params);
    const qs = params.toString();
    history.replaceState(null, '', qs ? `?${qs}` : location.pathname);

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
    const tag = cond !== null ? COND_TAG[cond] : '';
    // DESCALIFICA y NO SE PRESENTÓ no tienen puntaje, pero sí condición
    if (score === null) return `<td class="num muted">—${tag ? `<br><small>${tag}</small>` : ''}</td>`;
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
          (r, i) => {
            const condHtml = r.cond !== null ? COND_TAG[r.cond] : '<span class="muted">—</span>';
            const ganadoHtml = r.ganando ? '<br><small><span class="tag tag--ok eval-ganando">★ va ganando</span></small>' : '';
            return `<tr${r.ganando ? ' class="is-winning"' : ''}>
              <td class="num muted">${fmt(start + i + 1)}</td>
              <td class="num">${r.dni}</td>
              <td>${escHtml(r.nombre)}</td>
              <td class="num"><button class="perfil-link" data-id="${r.perfil}" type="button" title="Ver requisitos del perfil N° ${r.perfil}">${r.perfil}</button></td>
              ${scoreCell(r.ptScore, r.ptCond)}
              ${scoreCell(r.paScore, r.paCond)}
              ${scoreCell(r.ecScore, r.ecCond)}
              ${scoreCell(r.epScore, r.epCond)}
              <td class="num">${r.acumulado !== null ? Number(r.acumulado).toFixed(2) : '<span class="muted">—</span>'}</td>
              <td>${condHtml}${ganadoHtml}</td>
            </tr>`;
          }
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

  [ptCondEl, paCondEl].forEach((el) => el.addEventListener('change', applyFilters));

  let rangoTimer;
  [ptMinEl, ptMaxEl, paMinEl, paMaxEl].forEach((el) => el.addEventListener('input', () => {
    clearTimeout(rangoTimer);
    rangoTimer = setTimeout(applyFilters, 220);
  }));

  // Consulta rápida: reemplaza los filtros (conservando el perfil); un segundo clic la quita
  presetEls.forEach((b) => b.addEventListener('click', () => {
    const p = b.classList.contains('is-active') ? new URLSearchParams() : new URLSearchParams(b.dataset.preset);
    const perfilV = perfilIdFromInput(perfilEl.value);
    if (perfilV !== null) p.set('perfil', perfilV);
    setParams(p);
    applyFilters();
  }));

  function clearFilters() {
    searchEl.value = '';
    setParams(new URLSearchParams());
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
  setParams(new URLSearchParams(location.search));
  applyFilters();
})();
