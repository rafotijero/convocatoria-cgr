/* Reporte de cambios entre publicaciones de la evaluación curricular — CPM N° 06-2026-CG */
(function () {
  'use strict';

  const D = window.CPM_EVAL;
  const P = window.CPM_EC_PREV;
  if (!D || !P || !window.CPM_MERITO) return;

  const { calcAcumulado, rankear } = window.CPM_MERITO;
  const $ = (id) => document.getElementById(id);
  const fmt = (n) => n.toLocaleString('es-PE');
  const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const CONDS = ['CALIFICA', 'NO CALIFICA', 'DESCALIFICA', 'NO SE PRESENTÓ', 'NO FIGURA'];
  const COND_TAG = ['tag--ok', 'tag--warn', 'tag--danger', '', ''];
  const FALTA = 4; // calificó en aptitud y no figura en la publicación curricular

  /* ---------- Perfiles ---------- */
  const perfiles = new Map();
  (window.CPM_DATA ? window.CPM_DATA.perfiles : []).forEach((p) => perfiles.set(parseInt(p.id, 10), p));
  const plazasDe = (id) => (perfiles.get(id) ? perfiles.get(id).posiciones : 0);

  /* ---------- Nombres (las publicaciones omiten el de los no CALIFICA) ---------- */
  const docKey = (d) => String(d).replace(/^0+/, '');
  const nombreInscripcion = new Map();
  if (window.CPM_RESULTADOS) window.CPM_RESULTADOS.data.forEach((r) => { if (r[1]) nombreInscripcion.set(docKey(r[0]), r[1]); });

  /* ---------- Reconstruir ambas publicaciones ---------- */
  // CPM_EVAL tiene la curricular vigente; CPM_EC_PREV, la anterior de quienes cambiaron.
  const prevPorDni = new Map(P.cambios.map((c) => [c[0], { ecScore: c[1], ecCond: c[2] }]));

  function registro(r, ecScore, ecCond) {
    const ptCond = r[4], paCond = r[6];
    const falta = paCond === 0 && ecCond === null;
    const conds = [ptCond, paCond, ecCond].filter((v) => v !== null);
    return {
      dni: r[0], perfil: r[2],
      ptScore: r[3], paScore: r[5], ecScore, ecCond,
      acumulado: calcAcumulado(r[3], r[5], ecScore, null),
      cond: falta ? FALTA : (conds.length ? Math.max(...conds) : null),
    };
  }

  const antes = [], ahora = [], personas = [];
  D.data.forEach((r) => {
    const nuevo = registro(r, r[7], r[8]);
    const p = prevPorDni.get(r[0]);
    const viejo = p ? registro(r, p.ecScore, p.ecCond) : registro(r, r[7], r[8]);
    antes.push(viejo);
    ahora.push(nuevo);
    personas.push({
      dni: r[0], perfil: r[2],
      nombre: r[1] || nombreInscripcion.get(docKey(r[0])) || null,
      a: viejo, b: nuevo, directo: Boolean(p),
    });
  });
  const gruposAntes = rankear(antes, plazasDe);
  const gruposAhora = rankear(ahora, plazasDe);

  /* ---------- Clasificar el efecto ---------- */
  // Prioridad: entrar/salir de los puestos ganadores, luego calificar/dejar de calificar,
  // luego el puntaje curricular propio y, por último, el puesto en el orden de mérito.
  function efecto(x) {
    const { a, b } = x;
    if (a.ganando !== b.ganando) return b.ganando
      ? { signo: 1, tipo: 'entra', texto: 'Entra a los puestos ganadores' }
      : { signo: -1, tipo: 'sale', texto: 'Sale de los puestos ganadores' };
    if ((a.cond === 0) !== (b.cond === 0)) return b.cond === 0
      ? { signo: 1, tipo: 'califica', texto: 'Ahora califica' }
      : { signo: -1, tipo: 'descalifica', texto: 'Deja de calificar' };
    if (a.ecScore !== null && b.ecScore !== null && a.ecScore !== b.ecScore) return b.ecScore > a.ecScore
      ? { signo: 1, tipo: 'puntaje', texto: 'Sube su puntaje' }
      : { signo: -1, tipo: 'puntaje', texto: 'Baja su puntaje' };
    if (a.puesto !== null && b.puesto !== null && a.puesto !== b.puesto) return b.puesto < a.puesto
      ? { signo: 1, tipo: 'puesto', texto: 'Sube de puesto', soloPuesto: true }
      : { signo: -1, tipo: 'puesto', texto: 'Baja de puesto', soloPuesto: true };
    if (x.directo) return { signo: 0, tipo: 'neutro', texto: 'Sin efecto: sigue sin calificar' };
    return null;
  }

  const afectados = personas.filter((x) => (x.ef = efecto(x)) !== null);
  const directos  = afectados.filter((x) => x.directo);
  const perfilesAfectados = new Set(directos.map((x) => x.perfil));

  /* ---------- Resumen por perfil ---------- */
  function corte(grupo, plazas) {
    if (!grupo || !grupo.length || !plazas) return null;
    if (grupo.length < plazas) return { lleno: false, n: grupo.length };
    return { lleno: true, valor: grupo[plazas - 1].acumulado };
  }

  const resumenPerfiles = [...perfilesAfectados].map((id) => {
    const xs = afectados.filter((x) => x.perfil === id);
    const cuenta = (f) => xs.filter(f).length;
    const plazas = plazasDe(id);
    const ca = corte(gruposAntes.get(id), plazas), cb = corte(gruposAhora.get(id), plazas);
    return {
      id, plazas,
      puesto: perfiles.get(id) ? perfiles.get(id).puesto : '',
      cambios: cuenta((x) => x.directo),
      califican: cuenta((x) => x.a.cond !== 0 && x.b.cond === 0),
      dejan: cuenta((x) => x.a.cond === 0 && x.b.cond !== 0),
      entran: cuenta((x) => !x.a.ganando && x.b.ganando),
      salen: cuenta((x) => x.a.ganando && !x.b.ganando),
      finalistasAntes: (gruposAntes.get(id) || []).length,
      finalistasAhora: (gruposAhora.get(id) || []).length,
      corteAntes: ca, corteAhora: cb,
    };
  });

  /* ---------- KPIs ---------- */
  const favorecidos  = afectados.filter((x) => x.ef.signo > 0 && !x.ef.soloPuesto);
  const perjudicados = afectados.filter((x) => x.ef.signo < 0 && !x.ef.soloPuesto);
  $('k-cambios').textContent = fmt(directos.length);
  $('k-cambios-hint').textContent = `en ${fmt(perfilesAfectados.size)} perfiles`;
  $('k-fav').textContent = fmt(favorecidos.length);
  $('k-fav-hint').textContent = `${fmt(favorecidos.filter((x) => x.ef.tipo === 'entra').length)} entran a los puestos ganadores`;
  $('k-per').textContent = fmt(perjudicados.length);
  $('k-per-hint').textContent = `${fmt(perjudicados.filter((x) => x.ef.tipo === 'sale').length)} salen de los puestos ganadores`;
  $('k-ind').textContent = fmt(afectados.filter((x) => !x.directo && !x.ef.soloPuesto).length);
  $('pub-info').textContent =
    `Compara la publicación del ${P.pub} (reemplazada) con la del ${D.pub.ec}. ` +
    'Los puestos ganadores se calculan con el puntaje acumulado de PT, PA y EC y las plazas de cada perfil; aún falta la entrevista personal.';

  /* ---------- Gráficos ---------- */
  function hbars(el, items, onClick) {
    const max = Math.max(1, ...items.map((i) => i.n));
    el.innerHTML = items.map((i) => `
      <button type="button" class="hbar${i.activo ? ' is-active' : ''}" ${i.data || ''} title="${esc(i.title || i.label)}" ${onClick ? '' : 'tabindex="-1" style="cursor:default"'}>
        <span class="hbar__label">${esc(i.label)}</span>
        <span class="hbar__track"><span class="hbar__fill" style="width:${(100 * i.n) / max}%;${i.color ? `background:${i.color}` : ''}"></span></span>
        <span class="hbar__value">${fmt(i.n)}</span>
      </button>`).join('');
    if (onClick) el.onclick = (e) => { const b = e.target.closest('.hbar'); if (b) onClick(b); };
  }

  const nombreCond = (c) => (c === null ? 'Sin resultado' : CONDS[c]);
  (function chartTransiciones() {
    const t = new Map();
    directos.forEach((x) => {
      const k = `${nombreCond(x.a.ecCond)} → ${nombreCond(x.b.ecCond)}${x.a.ecCond === 0 && x.b.ecCond === 0 ? ' (puntaje)' : ''}`;
      t.set(k, (t.get(k) || 0) + 1);
    });
    const color = (k) => (/→ CALIFICA/.test(k) ? 'var(--ok)' : /^CALIFICA → (?!CALIFICA)/.test(k) ? 'var(--danger)' : '');
    hbars($('chart-trans'), [...t].sort((a, b) => b[1] - a[1]).map(([label, n]) => ({ label, n, color: color(label) })));
  })();

  /* ---------- Estado de la vista ---------- */
  const tabs = document.querySelectorAll('.page-tab');
  const views = document.querySelectorAll('[data-panel]');
  const perfilEl = $('f-perfil'), buscarEl = $('f-buscar'), puestoEl = $('f-puesto'), ordenEl = $('f-orden');
  let tab = 'perfiles';

  const perfilSel = () => { const n = parseInt(perfilEl.value, 10); return isNaN(n) ? null : n; };

  (function datalist() {
    const dl = $('dl-perfiles');
    resumenPerfiles.slice().sort((a, b) => a.id - b.id).forEach((r) => {
      const o = document.createElement('option');
      o.value = `${r.id} — ${r.puesto.length > 70 ? r.puesto.slice(0, 68) + '…' : r.puesto}`;
      dl.appendChild(o);
    });
  })();

  function setPerfil(id) {
    const o = [...document.querySelectorAll('#dl-perfiles option')].find((x) => parseInt(x.value, 10) === id);
    perfilEl.value = id == null ? '' : (o ? o.value : String(id));
  }

  function syncUrl() {
    const p = new URLSearchParams();
    if (tab !== 'perfiles') p.set('vista', tab);
    if (perfilSel() !== null) p.set('perfil', perfilSel());
    if (puestoEl.checked) p.set('puestos', '1');
    if (tab === 'perfiles' && ordenEl.value !== 'impacto') p.set('orden', ordenEl.value);
    const qs = p.toString();
    history.replaceState(null, '', qs ? `?${qs}` : location.pathname);
  }

  /* ---------- Render: perfiles ---------- */
  const corteTxt = (c) => (!c ? '—' : c.lleno ? c.valor.toFixed(2) : `<span class="muted" title="Hay menos finalistas que plazas">${c.n} fin.</span>`);
  const delta = (mas, menos) => {
    const t = (n, s) => (n ? `<span class="tag ${s > 0 ? 'tag--ok' : 'tag--danger'}">${s > 0 ? '+' : '−'}${n}</span>` : '');
    return mas || menos ? t(mas, 1) + t(menos, -1) : '<span class="muted">—</span>';
  };

  const ORDEN = {
    impacto: (a, b) => (b.entran + b.salen) - (a.entran + a.salen) || b.cambios - a.cambios || a.id - b.id,
    cambios: (a, b) => b.cambios - a.cambios || (b.entran + b.salen) - (a.entran + a.salen) || a.id - b.id,
    califican: (a, b) => (b.califican - b.dejan) - (a.califican - a.dejan) || b.cambios - a.cambios || a.id - b.id,
    corte: (a, b) => {
      const d = (r) => (r.corteAntes && r.corteAhora && r.corteAntes.lleno && r.corteAhora.lleno ? r.corteAhora.valor - r.corteAntes.valor : -1);
      return d(b) - d(a) || a.id - b.id;
    },
  };

  function renderPerfiles() {
    const id = perfilSel();
    const rows = resumenPerfiles.filter((r) => id === null || r.id === id).sort(ORDEN[ordenEl.value] || ORDEN.impacto);
    $('n-perfiles').textContent = `${fmt(rows.length)} perfil${rows.length !== 1 ? 'es' : ''} con cambios`;
    $('t-perfiles').innerHTML = rows.map((r) => `
      <tr${r.entran + r.salen ? ' class="is-impacto"' : ''}>
        <td class="num"><button class="perfil-link" type="button" data-perfil="${r.id}" title="Ver el ranking del perfil">${r.id}</button></td>
        <td class="cmb-puesto">${esc(r.puesto)}</td>
        <td class="num">${r.plazas}</td>
        <td class="num">${r.cambios}</td>
        <td class="num">${delta(r.califican, r.dejan)}</td>
        <td class="num">${r.finalistasAntes} → ${r.finalistasAhora}</td>
        <td class="num">${delta(r.entran, r.salen)}</td>
        <td class="num">${corteTxt(r.corteAntes)} → ${corteTxt(r.corteAhora)}</td>
      </tr>`).join('');
  }

  /* ---------- Render: personas ---------- */
  const condTag = (c) => (c === null ? '<span class="muted">—</span>' : `<span class="tag ${COND_TAG[c]}">${CONDS[c]}</span>`);
  const ecTxt = (s) => (s === null ? s : `<span class="cmb-ec">${s}</span>`);
  const ecCell = (r) => `${r.ecScore !== null ? ecTxt(r.ecScore) + ' ' : ''}${condTag(r.ecCond)}`;
  const acum = (v) => (v === null ? '<span class="muted">—</span>' : v.toFixed(2));
  const puesto = (r) => (r.puesto === null ? '<span class="muted">—</span>' : `${r.puesto}°${r.ganando ? ' <span class="cmb-star" title="Va ganando">★</span>' : ''}`);

  function renderPersonas(signo) {
    const id = perfilSel();
    const q = norm(buscarEl.value);
    const rows = afectados
      .filter((x) => x.ef.signo === signo && (puestoEl.checked || !x.ef.soloPuesto))
      .filter((x) => id === null || x.perfil === id)
      .filter((x) => !q || norm(x.nombre).includes(q) || x.dni.includes(q))
      .sort((a, b) => {
        const peso = { entra: 0, sale: 0, califica: 1, descalifica: 1, puntaje: 2, puesto: 3 };
        return peso[a.ef.tipo] - peso[b.ef.tipo] || a.perfil - b.perfil || (a.b.puesto ?? 999) - (b.b.puesto ?? 999);
      });
    const tbody = $(signo > 0 ? 't-fav' : 't-per');
    $(signo > 0 ? 'n-fav' : 'n-per').textContent = `${fmt(rows.length)} postulante${rows.length !== 1 ? 's' : ''}`;
    tbody.innerHTML = rows.map((x) => `
      <tr class="${x.ef.tipo === 'entra' || x.ef.tipo === 'sale' ? 'is-impacto' : ''}">
        <td class="num">${x.dni}</td>
        <td>${x.nombre ? esc(x.nombre) : '<span class="muted">—</span>'}</td>
        <td class="num"><button class="perfil-link" type="button" data-perfil="${x.perfil}" title="Ver el ranking del perfil">${x.perfil}</button></td>
        <td><span class="tag ${signo > 0 ? 'tag--ok' : 'tag--danger'}">${esc(x.ef.texto)}</span><br><small class="muted">${x.directo ? 'Cambió su curricular' : 'Por cambios de otros postulantes'}</small></td>
        <td class="num">${ecCell(x.a)}<br><small class="muted">→</small> ${ecCell(x.b)}</td>
        <td class="num">${acum(x.a.acumulado)} → ${acum(x.b.acumulado)}</td>
        <td class="num">${puesto(x.a)} → ${puesto(x.b)}</td>
      </tr>`).join('');
    $(signo > 0 ? 'e-fav' : 'e-per').hidden = rows.length > 0;
  }

  /* ---------- Ranking del perfil seleccionado ---------- */
  function renderRanking() {
    const id = perfilSel();
    const card = $('ranking');
    if (id === null || !perfilesAfectados.has(id)) { card.hidden = true; return; }
    const p = perfiles.get(id);
    $('rk-title').textContent = `N° ${id} · ${p ? p.puesto : ''}`;
    $('rk-meta').textContent = `${plazasDe(id)} plaza${plazasDe(id) !== 1 ? 's' : ''}. Finalistas de antes y de ahora en orden de mérito; ★ va ganando.`;
    const filas = personas
      .filter((x) => x.perfil === id && (x.a.puesto !== null || x.b.puesto !== null))
      .sort((m, n) => (m.b.puesto ?? 999) - (n.b.puesto ?? 999) || (m.a.puesto ?? 999) - (n.a.puesto ?? 999));
    $('t-rank').innerHTML = filas.map((x) => {
      const cls = x.ef && !x.ef.soloPuesto ? (x.ef.signo > 0 ? 'is-fav' : x.ef.signo < 0 ? 'is-per' : '') : '';
      return `<tr class="${cls}">
        <td class="num">${puesto(x.b)}</td>
        <td class="num">${puesto(x.a)}</td>
        <td class="num">${x.dni}</td>
        <td>${x.nombre ? esc(x.nombre) : '<span class="muted">—</span>'}</td>
        <td class="num">${ecCell(x.a)} → ${ecCell(x.b)}</td>
        <td class="num">${acum(x.a.acumulado)} → ${acum(x.b.acumulado)}</td>
        <td>${x.ef ? `<span class="tag ${x.ef.signo > 0 ? 'tag--ok' : x.ef.signo < 0 ? 'tag--danger' : ''}">${esc(x.ef.texto)}</span>` : '<span class="muted">Sin cambios</span>'}</td>
      </tr>`;
    }).join('');
    card.hidden = false;
  }

  /* ---------- Perfiles con más impacto (gráfico) ---------- */
  function renderTop() {
    const top = resumenPerfiles.filter((r) => r.entran + r.salen > 0).sort(ORDEN.impacto).slice(0, 10);
    hbars($('chart-top'), top.map((r) => ({
      label: `${r.id} · ${r.puesto}`, n: r.entran + r.salen,
      title: `${r.entran} entran y ${r.salen} salen de los puestos ganadores; ${r.cambios} cambios en curricular`,
      data: `data-perfil="${r.id}"`, activo: perfilSel() === r.id,
    })), (b) => { const id = parseInt(b.dataset.perfil, 10); setPerfil(perfilSel() === id ? null : id); render(); });
  }

  /* ---------- Render general ---------- */
  function render() {
    tabs.forEach((t) => t.setAttribute('aria-selected', String(t.dataset.tab === tab)));
    views.forEach((v) => { v.hidden = v.dataset.panel !== tab; });
    $('fld-buscar').hidden = tab === 'perfiles';
    $('fld-puesto').hidden = tab === 'perfiles';
    $('fld-orden').hidden = tab !== 'perfiles';
    renderTop();
    renderRanking();
    if (tab === 'perfiles') renderPerfiles();
    else renderPersonas(tab === 'favorecidos' ? 1 : -1);
    syncUrl();
  }

  tabs.forEach((t) => t.addEventListener('click', () => { tab = t.dataset.tab; render(); }));
  let timer;
  [perfilEl, buscarEl].forEach((el) => el.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(render, 200); }));
  [puestoEl, ordenEl].forEach((el) => el.addEventListener('change', render));
  $('limpiar').addEventListener('click', () => { perfilEl.value = ''; buscarEl.value = ''; puestoEl.checked = false; render(); });
  document.addEventListener('click', (e) => {
    const b = e.target.closest('.perfil-link[data-perfil]');
    if (!b) return;
    setPerfil(parseInt(b.dataset.perfil, 10));
    render();
    $('ranking').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  /* ---------- Estado inicial desde la URL ---------- */
  const qs = new URLSearchParams(location.search);
  if (['favorecidos', 'perjudicados'].includes(qs.get('vista'))) tab = qs.get('vista');
  if (qs.get('perfil')) setPerfil(parseInt(qs.get('perfil'), 10));
  puestoEl.checked = qs.get('puestos') === '1';
  if (ORDEN[qs.get('orden')]) ordenEl.value = qs.get('orden');
  render();
})();
