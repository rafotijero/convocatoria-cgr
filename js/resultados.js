/* Resultados de la etapa de inscripción virtual y sedes de evaluación — CPM N° 06-2026-CG */
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
  // Cada registro: [dni, nombre, perfil, cond_idx] + [local_idx, aula] si CALIFICA
  const records = D.data.map((r) => {
    const dniStr = String(r[0]).padStart(8, '0');
    const local = r.length > 4 ? r[4] : -1;
    return {
      dni: dniStr, nombre: r[1], perfil: r[2], cond: r[3],
      local, aula: local < 0 ? 0 : r[5],
      _q: norm(r[1]) + ' ' + dniStr,
    };
  });

  /* ---------- Sedes y locales de evaluación ---------- */
  // D.locales: [sede_idx, nombre, dirección]; cada aula pertenece a un solo local
  const SEDES = D.sedes || [];
  const LOCALES = (D.locales || []).map((l, i) => ({ idx: i, sede: l[0], nombre: l[1], direccion: l[2], total: 0, aulas: {} }));
  const sedeTotal = SEDES.map(() => 0);
  records.forEach((r) => {
    if (r.local < 0) return;
    const l = LOCALES[r.local];
    l.total++;
    l.aulas[r.aula] = (l.aulas[r.aula] || 0) + 1;
    sedeTotal[l.sede]++;
  });
  const localesDeSede = (s) => LOCALES.filter((l) => l.sede === s);

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
  const sedeEl      = $('f-sede');
  const localEl     = $('f-local');
  const aulaEl      = $('f-aula');
  const localField  = $('field-local');
  const localCard   = $('res-local-card');
  const rlcSede     = $('rlc-sede');
  const rlcTitle    = $('rlc-title');
  const rlcDir      = $('rlc-dir');
  const rlcEval     = $('rlc-eval');
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

  /* ---------- Filtros en cascada: sede → local → aula ---------- */
  const fmt = (n) => n.toLocaleString('es-PE');
  const setOptions = (sel, first, items) => {
    sel.innerHTML = '';
    sel.add(new Option(first, ''));
    items.forEach(([value, label]) => sel.add(new Option(label, value)));
  };

  setOptions(sedeEl, 'Todas las sedes', SEDES.map((s, i) => [i, `${s} (${fmt(sedeTotal[i])})`]));

  // Local efectivo: el elegido o, si la sede tiene uno solo, ese
  function localEfectivo() {
    if (localEl.value !== '') return LOCALES[parseInt(localEl.value, 10)];
    if (sedeEl.value === '') return null;
    const ls = localesDeSede(parseInt(sedeEl.value, 10));
    return ls.length === 1 ? ls[0] : null;
  }

  function fillAulas() {
    const l = localEfectivo();
    const aulas = l ? Object.keys(l.aulas).map(Number).sort((a, b) => a - b) : [];
    setOptions(aulaEl, 'Todas las aulas', aulas.map((a) => [a, `Aula ${a} (${l.aulas[a]})`]));
    aulaEl.disabled = !l;
  }

  // El selector de local solo aparece si la sede tiene más de un local
  function fillLocales() {
    const ls = sedeEl.value === '' ? [] : localesDeSede(parseInt(sedeEl.value, 10));
    setOptions(localEl, 'Todos los locales', ls.map((l) => [l.idx, `${l.nombre} (${fmt(l.total)})`]));
    localField.hidden = ls.length < 2;
    fillAulas();
  }

  function setSede(sedeIdx, localIdx, aula) {
    sedeEl.value = sedeIdx === null ? '' : String(sedeIdx);
    fillLocales();
    if (localIdx !== null && !localField.hidden) localEl.value = String(localIdx);
    fillAulas();
    if (aula) aulaEl.value = String(aula);
  }

  /* ---------- Tarjeta del local de evaluación ---------- */
  // Se muestra cuando todos los resultados comparten un mismo local
  function updateLocalCard() {
    let idx = -1;
    for (const r of filtered) {
      if (r.local < 0 || (idx >= 0 && r.local !== idx)) { idx = -1; break; }
      idx = r.local;
    }
    if (idx < 0) { localCard.hidden = true; return; }
    const l = LOCALES[idx];
    const ev = D.evaluacion || {};
    rlcSede.textContent = SEDES[l.sede];
    rlcTitle.textContent = l.nombre;
    rlcDir.textContent = `Ingreso: ${l.direccion}`;
    rlcEval.textContent = [ev.fecha && `Evaluación: ${ev.fecha}`, ev.ingreso && `ingreso de ${ev.ingreso}`]
      .filter(Boolean).join(' · ');
    localCard.hidden = false;
  }

  /* ---------- Filtrar ---------- */
  function applyFilters() {
    const q       = norm(searchEl.value);
    const perfilV = perfilIdFromInput(perfilEl.value);
    const condV   = condEl.value;
    const sedeV   = sedeEl.value === '' ? null : parseInt(sedeEl.value, 10);
    const localV  = localEl.value === '' ? null : parseInt(localEl.value, 10);
    const aulaV   = aulaEl.value === '' ? null : parseInt(aulaEl.value, 10);

    filtered = records.filter((r) => {
      if (q && !r._q.includes(q)) return false;
      if (perfilV !== null && r.perfil !== perfilV) return false;
      if (condV !== '') {
        const idx = parseInt(condV, 10);
        // condV 2 = DESCALIFICA incluye DESCALIFICA* (idx 3)
        if (idx === 2) { if (r.cond !== 2 && r.cond !== 3) return false; }
        else { if (r.cond !== idx) return false; }
      }
      if (sedeV !== null && (r.local < 0 || LOCALES[r.local].sede !== sedeV)) return false;
      if (localV !== null && r.local !== localV) return false;
      if (aulaV !== null && r.aula !== aulaV) return false;
      return true;
    });

    page = 1;
    updatePerfilCard();
    updateLocalCard();
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
              ${localCells(r)}
            </tr>`
        )
        .join('');
    }

    renderPager(pages);
  }

  const localCells = (r) => {
    if (r.local < 0) return '<td class="muted">—</td><td class="num muted">—</td>';
    const l = LOCALES[r.local];
    return `<td class="res-local"><button class="perfil-link local-link" data-local="${l.idx}" type="button" title="Ver postulantes de este local">${escHtml(SEDES[l.sede])}</button><span class="res-local__name">${escHtml(l.nombre)}</span></td>
              <td class="num"><button class="perfil-link" data-aula="${r.aula}" data-aula-local="${l.idx}" type="button" title="Ver postulantes del aula ${r.aula}">${r.aula}</button></td>`;
  };

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

  sedeEl.addEventListener('change', () => { fillLocales(); applyFilters(); });
  localEl.addEventListener('change', () => { fillAulas(); applyFilters(); });
  aulaEl.addEventListener('change', applyFilters);

  // Botón del código de perfil → abre el drawer
  if (perfilLink) {
    perfilLink.addEventListener('click', () => {
      const id = perfilIdFromInput(perfilEl.value);
      if (id && window.CPM_PERFIL_DRAWER) {
        window.CPM_PERFIL_DRAWER.open(String(id));
      }
    });
  }

  function clearFilters() {
    searchEl.value = '';
    perfilEl.value = '';
    condEl.value = '';
    setSede(null, null, null);
    kpiEls.forEach((k) => k.classList.toggle('is-active', k.dataset.cond === ''));
  }

  clearBtn.addEventListener('click', () => {
    clearFilters();
    applyFilters();
  });

  perPageEl.addEventListener('change', () => {
    perPage = parseInt(perPageEl.value, 10);
    page = 1;
    render();
  });

  // Enlaces de la tabla: cada uno deja activo solo su propio filtro
  // (el aula arrastra su sede y local, de los que depende)
  tbody.addEventListener('click', (e) => {
    const btn = e.target.closest('.perfil-link');
    if (!btn) return;
    clearFilters();
    if (btn.dataset.aula) {
      const l = LOCALES[parseInt(btn.dataset.aulaLocal, 10)];
      setSede(l.sede, l.idx, parseInt(btn.dataset.aula, 10));
    } else if (btn.dataset.local) {
      const l = LOCALES[parseInt(btn.dataset.local, 10)];
      setSede(l.sede, l.idx, null);
    } else {
      const id = parseInt(btn.dataset.id, 10);
      // Buscar la opción del datalist que empiece con ese id
      const opts = Array.from(document.querySelectorAll('#dl-perfiles option'));
      const match = opts.find((o) => parseInt(o.value, 10) === id);
      perfilEl.value = match ? match.value : String(id);
    }
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

  /* ---------- Arranque: leer ?perfil=, ?sede=, ?local= y ?aula= de la URL ---------- */
  // sede y local son números de orden (desde 1) según la publicación oficial
  const params = new URLSearchParams(location.search);
  const urlNum = (k) => { const n = parseInt(params.get(k), 10); return isNaN(n) ? null : n; };
  const urlLocal = LOCALES[(urlNum('local') || 0) - 1] || null;
  const urlSede = urlLocal ? urlLocal.sede : (urlNum('sede') || 0) - 1;
  if (urlSede >= 0 && urlSede < SEDES.length) setSede(urlSede, urlLocal ? urlLocal.idx : null, null);
  const urlAula = urlNum('aula');
  if (urlAula !== null && !aulaEl.disabled) {
    aulaEl.value = String(urlAula);
    if (aulaEl.selectedIndex < 0) aulaEl.value = '';
  }

  const urlPerfil = params.get('perfil');
  if (urlPerfil) {
    const id = parseInt(urlPerfil, 10);
    const opts = Array.from(document.querySelectorAll('#dl-perfiles option'));
    const match = opts.find((o) => parseInt(o.value, 10) === id);
    perfilEl.value = match ? match.value : String(id);
  }
  applyFilters();
})();
