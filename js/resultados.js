/* Resultados de la etapa de inscripción virtual — CPM N° 06-2026-CG */
(function () {
  'use strict';

  const D = window.CPM_RESULTADOS;
  if (!D) return;

  const $ = (id) => document.getElementById(id);
  const CONDS = D.conds; // ['CALIFICA','NO CALIFICA','DESCALIFICA','DESCALIFICA*']

  /* ---------- Normalización para búsqueda ---------- */
  const norm = (s) =>
    String(s || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();

  /* ---------- Preprocesar datos una sola vez ---------- */
  // Cada registro: [dni, nombre, perfil, cond_idx]
  const records = D.data.map((r) => {
    const dniStr = String(r[0]).padStart(8, '0');
    return { dni: dniStr, nombre: r[1], perfil: r[2], cond: r[3], _q: norm(r[1]) + ' ' + dniStr };
  });

  /* ---------- Poblar datalist de perfiles ---------- */
  (function buildPerfilDatalist() {
    const dl = $('dl-perfiles');
    if (!dl) return;

    // Contar postulantes por perfil desde los datos de resultados
    const counts = {};
    records.forEach((r) => { counts[r.perfil] = (counts[r.perfil] || 0) + 1; });

    // Obtener nombres de puestos desde data.js (si está disponible)
    const nombres = {};
    if (window.CPM_DATA) {
      window.CPM_DATA.perfiles.forEach((p) => { nombres[parseInt(p.id, 10)] = p.puesto; });
    }

    // Construir opciones ordenadas por número de perfil
    const ids = Object.keys(counts)
      .map(Number)
      .sort((a, b) => a - b);

    const fragment = document.createDocumentFragment();
    ids.forEach((id) => {
      const opt = document.createElement('option');
      const nombre = nombres[id] || '';
      const count = counts[id];
      const label = nombre.length > 70 ? nombre.slice(0, 68) + '…' : nombre;
      opt.value = label ? `${id} — ${label} (${count})` : `${id} (${count})`;
      fragment.appendChild(opt);
    });
    dl.appendChild(fragment);
  })();

  /* ---------- Lookup de perfiles (data.js) ---------- */
  const perfilesMap = {};
  if (window.CPM_DATA) {
    window.CPM_DATA.perfiles.forEach((p) => { perfilesMap[parseInt(p.id, 10)] = p; });
  }

  /* ---------- Extraer número de perfil desde texto libre ---------- */
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
  const searchEl    = $('f-search');
  const perfilEl    = $('f-perfil');
  const condEl      = $('f-cond');
  const clearBtn    = $('clear-filters');
  const countEl     = $('res-count');
  const liveCount   = $('live-count');
  const tbody       = $('res-tbody');
  const emptyEl     = $('res-empty');
  const pagerEl     = $('pager');
  const perPageEl   = $('per-page');
  const kpiEls      = document.querySelectorAll('.res-kpi');
  const perfilCard  = $('res-perfil-card');
  const perfilLink  = $('res-perfil-link');
  const rpcCode     = $('rpc-code');
  const rpcTitle    = $('rpc-title');
  const rpcMeta     = $('rpc-meta');

  /* ---------- Tarjeta del perfil seleccionado ---------- */
  function updatePerfilCard() {
    const id = perfilIdFromInput(perfilEl.value);
    if (!id || !perfilCard) { if (perfilCard) perfilCard.hidden = true; return; }
    const p = perfilesMap[id];
    if (!p) { perfilCard.hidden = true; return; }

    rpcCode.textContent = `N° ${p.id}-2026`;
    rpcTitle.textContent = p.puesto;

    const plazas = `${p.posiciones} plaza${p.posiciones !== 1 ? 's' : ''}`;
    const unidad = p.unidadOrganica && p.unidadOrganica !== p.organo ? p.unidadOrganica : p.organo;
    rpcMeta.textContent = `${plazas} · ${unidad}`;

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
      if (condV !== '') {
        const idx = parseInt(condV, 10);
        // condV 2 = DESCALIFICA incluye DESCALIFICA* (idx 3)
        if (idx === 2) { if (r.cond !== 2 && r.cond !== 3) return false; }
        else { if (r.cond !== idx) return false; }
      }
      return true;
    });

    page = 1;
    updatePerfilCard();
    render();
  }

  /* ---------- Renderizar tabla ---------- */
  const COND_TAG = [
    '<span class="tag tag--ok">CALIFICA</span>',
    '<span class="tag tag--warn">NO CALIFICA</span>',
    '<span class="tag tag--danger">DESCALIFICA</span>',
    '<span class="tag tag--danger">DESCALIFICA*</span>',
  ];

  function render() {
    const total = filtered.length;
    const pages = Math.max(1, Math.ceil(total / perPage));
    if (page > pages) page = pages;

    // Contador
    countEl.textContent =
      total === records.length
        ? `${total.toLocaleString('es-PE')} postulantes`
        : `${total.toLocaleString('es-PE')} de ${records.length.toLocaleString('es-PE')} postulantes`;

    liveCount.innerHTML = total > 0
      ? `<strong>${total.toLocaleString('es-PE')}</strong> resultado${total !== 1 ? 's' : ''}`
      : 'Sin resultados';

    // Filas
    const start = (page - 1) * perPage;
    const slice = filtered.slice(start, start + perPage);

    if (slice.length === 0) {
      tbody.innerHTML = '';
      emptyEl.hidden = false;
    } else {
      emptyEl.hidden = true;
      tbody.innerHTML = slice
        .map(
          (r, i) =>
            `<tr>
              <td class="num muted">${(start + i + 1).toLocaleString('es-PE')}</td>
              <td class="num">${r.dni}</td>
              <td>${escHtml(r.nombre)}</td>
              <td class="num"><button class="perfil-link" data-id="${r.perfil}" type="button" title="Ver requisitos del perfil N° ${r.perfil}">${r.perfil}</button></td>
              <td>${COND_TAG[r.cond]}</td>
            </tr>`
        )
        .join('');
    }

    renderPager(pages);
  }

  const escHtml = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

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
      if (n === page) {
        html += `<button aria-current="page" data-p="${n}">${n}</button>`;
      } else {
        html += `<button data-p="${n}">${n}</button>`;
      }
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

  // Sincronizar KPI activo cuando cambia el select manualmente
  condEl.addEventListener('change', () => {
    const val = condEl.value;
    kpiEls.forEach((k) => {
      k.classList.toggle('is-active', k.dataset.cond === val);
    });
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

  condEl.addEventListener('change', applyFilters);

  // Botón del código de perfil → abre el drawer
  if (perfilLink) {
    perfilLink.addEventListener('click', () => {
      const id = perfilIdFromInput(perfilEl.value);
      if (id && window.CPM_PERFIL_DRAWER) {
        window.CPM_PERFIL_DRAWER.open(String(id));
      }
    });
  }

  clearBtn.addEventListener('click', () => {
    searchEl.value = '';
    perfilEl.value = '';
    condEl.value = '';
    kpiEls.forEach((k) => k.classList.toggle('is-active', k.dataset.cond === ''));
    if (perfilCard) perfilCard.hidden = true;
    applyFilters();
  });

  perPageEl.addEventListener('change', () => {
    perPage = parseInt(perPageEl.value, 10);
    page = 1;
    render();
  });

  tbody.addEventListener('click', (e) => {
    const btn = e.target.closest('.perfil-link');
    if (!btn) return;
    const id = parseInt(btn.dataset.id, 10);
    // Buscar la opción del datalist que empiece con ese id
    const opts = Array.from(document.querySelectorAll('#dl-perfiles option'));
    const match = opts.find((o) => parseInt(o.value, 10) === id);
    perfilEl.value = match ? match.value : String(id);
    searchEl.value = '';
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

  /* ---------- Arranque ---------- */
  applyFilters();
})();
