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

  // Acumulado, orden de mérito y "va ganando": js/merito.js
  const { calcAcumulado, cmpMerito, rankear } = window.CPM_MERITO;

  /* ---------- Condición general: la peor de las etapas con resultado ---------- */
  function overallCond(conds) {
    const vals = conds.filter((v) => v !== null && v !== undefined);
    if (vals.length === 0) return null;
    return Math.max(...vals);
  }

  // Calificó en aptitud pero no figura en la publicación curricular ya publicada
  const COND_FALTA_EC = 4;

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

    const ecFalta = Boolean(D.pub && D.pub.ec) && paCond === 0 && ecCond === null;

    records.push({
      dni: dniStr, nombre, perfil: r[2],
      ptScore, ptCond, paScore, paCond,
      ecScore, ecCond, epScore, epCond, ecFalta,
      acumulado: calcAcumulado(ptScore, paScore, ecScore, epScore),
      cond:      ecFalta ? COND_FALTA_EC : overallCond([ptCond, paCond, ecCond, epCond]),
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
      ecScore: null, ecCond: null, epScore: null, epCond: null, ecFalta: false,
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
    else if (r.cond === 0) nOk++;
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
  // Por cada perfil, los N primeros CALIFICA en orden de mérito "van ganando",
  // donde N = número de plazas del perfil (ver js/merito.js).
  // Devuelve los CALIFICA de cada perfil en orden de mérito: los usa la calculadora.
  const finalistasPorPerfil = rankear(records, (perfil) => (perfilesMap[perfil] ? perfilesMap[perfil].posiciones : 0));

  /* ---------- Programación de la entrevista ---------- */
  // D.citas.data: [dni, panel, índice en dias, inicio, fin], horas en minutos desde la medianoche
  const CITAS = D.citas || { dias: [], data: [] };
  const DIAS_SEM = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
  const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  const diaCorto = (iso) => {
    const [y, mo, d] = iso.split('-').map(Number);
    return `${DIAS_SEM[new Date(Date.UTC(y, mo - 1, d)).getUTCDay()]} ${String(d).padStart(2, '0')}/${String(mo).padStart(2, '0')}`;
  };
  const panelTxt = (n) => `Panel ${String(n).padStart(2, '0')}`;
  (function asignarCitas() {
    const porDni = new Map(records.map((r) => [r.dni, r]));
    CITAS.data.forEach(([dni, panel, iDia, ini, fin]) => {
      const r = porDni.get(String(dni).padStart(8, '0')) || porDni.get(dni);
      if (r) r.cita = { panel, dia: CITAS.dias[iDia], ini, fin };
    });
  })();

  // Fecha y hora actuales en Lima, para "hoy" y "pendientes"
  function ahoraLima() {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date()).map((x) => [x.type, x.value]));
    return { dia: `${p.year}-${p.month}-${p.day}`, min: +p.hour * 60 + +p.minute };
  }
  const citaPendiente = (c, ahora) => c.dia > ahora.dia || (c.dia === ahora.dia && c.fin > ahora.min);
  const cmpCita = (a, b) => {
    if (!a.cita || !b.cita) return (!a.cita) - (!b.cita);
    return a.cita.dia.localeCompare(b.cita.dia) || a.cita.ini - b.cita.ini || a.cita.panel - b.cita.panel;
  };
  window.CPM_CITA = { hhmm, diaCorto, panelTxt }; // también los usa la calculadora

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
  const ecCondEl   = $('f-ec-cond');
  const ecMinEl    = $('f-ec-min');
  const ecMaxEl    = $('f-ec-max');
  const epDiaEl    = $('f-ep-dia');
  const epPanelEl  = $('f-ep-panel');

  // Opciones de día y panel, y la consulta rápida "Entrevistas de hoy" si hoy hay entrevistas
  (function opcionesEntrevista() {
    CITAS.dias.forEach((d) => epDiaEl.insertAdjacentHTML('beforeend', `<option value="${d}">${diaCorto(d)}</option>`));
    const paneles = [...new Set(CITAS.data.map((c) => c[1]))].sort((a, b) => a - b);
    paneles.forEach((n) => epPanelEl.insertAdjacentHTML('beforeend', `<option value="${n}">${panelTxt(n)}</option>`));
    const hoy = ahoraLima().dia;
    const btnHoy = document.querySelector('#eval-presets [data-preset-hoy]');
    if (btnHoy) {
      if (CITAS.dias.includes(hoy)) btnHoy.dataset.preset = `epdia=${hoy}`;
      else btnHoy.remove();
    }
  })();
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
    // Días y paneles en que se entrevista a los finalistas del perfil
    const citas = records.filter((r) => r.perfil === id && r.cita).map((r) => r.cita);
    let ent = '';
    if (citas.length) {
      const dias = [...new Set(citas.map((c) => c.dia))].sort().map(diaCorto);
      const paneles = [...new Set(citas.map((c) => c.panel))].sort((a, b) => a - b).map((n) => String(n).padStart(2, '0'));
      ent = ` · Entrevistas: ${dias.join(', ')} · Panel${paneles.length > 1 ? 'es' : ''} ${paneles.join(', ')}`;
    }
    rpcMeta.textContent  = `${plazas} · ${unidad}${ent}`;
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
    ec:    ecCondEl,
    ecmin: ecMinEl,
    ecmax: ecMaxEl,
    epdia: epDiaEl,
    eppanel: epPanelEl,
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
    const ecCondV = ecCondEl.value, ecMin = num(ecMinEl), ecMax = num(ecMaxEl);
    const epDiaV  = epDiaEl.value, epPanelV = epPanelEl.value === '' ? null : parseInt(epPanelEl.value, 10);
    const ahora   = ahoraLima();

    filtered = records.filter((r) => {
      if (q && !r._q.includes(q)) return false;
      if (perfilV !== null && r.perfil !== perfilV) return false;
      if (condV !== '' && r.cond !== parseInt(condV, 10)) return false;
      if (!matchEtapa(r.ptScore, r.ptCond, ptCondV, ptMin, ptMax)) return false;
      if (!matchEtapa(r.paScore, r.paCond, paCondV, paMin, paMax)) return false;
      // En curricular, 'falta' son quienes calificaron en PA y no figuran; 'none', quienes no llegaron
      if (ecCondV === 'falta' ? !r.ecFalta : ecCondV === 'none' && r.ecFalta) return false;
      if (!matchEtapa(r.ecScore, r.ecCond, ecCondV === 'falta' ? '' : ecCondV, ecMin, ecMax)) return false;
      // Entrevista: día ('prox' = las que aún no terminan) y panel
      if (epDiaV !== '' && !(r.cita && (epDiaV === 'prox' ? citaPendiente(r.cita, ahora) : r.cita.dia === epDiaV))) return false;
      if (epPanelV !== null && !(r.cita && r.cita.panel === epPanelV)) return false;
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
      filtered = [...filtered].sort(cmpMerito);
    } else if (sk === 'cita') {
      filtered = [...filtered].sort(cmpCita);
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

  const ICON_CALC = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 19h8"/></svg>';

  const COND_TAG = [
    '<span class="tag tag--ok">CALIFICA</span>',
    '<span class="tag tag--warn">NO CALIFICA</span>',
    '<span class="tag tag--danger">DESCALIFICA</span>',
    '<span class="tag">NO SE PRESENTÓ</span>',
    '<span class="tag" title="Calificó en aptitud, pero no figura en la publicación oficial de la evaluación curricular">SIN RESULTADO EC</span>',
  ];

  function scoreCell(score, cond, falta) {
    const tag = cond !== null ? COND_TAG[cond] : falta ? '<span class="tag" title="No figura en la publicación oficial">NO FIGURA</span>' : '';
    // DESCALIFICA y NO SE PRESENTÓ no tienen puntaje, pero sí condición
    if (score === null) return `<td class="num muted">—${tag ? `<br><small>${tag}</small>` : ''}</td>`;
    return `<td class="num eval-score">${Number(score).toFixed(2)}<br><small>${tag}</small></td>`;
  }

  // Columna de entrevista de un finalista: el botón de la calculadora y, cuando se publique,
  // su puntaje y condición en la entrevista
  // Mientras no haya resultado, muestra la cita (día, hora y panel)
  function epCalcCell(r, calcHtml, ahora) {
    const tag = r.epCond !== null ? `<small>${COND_TAG[r.epCond]}</small>` : '';
    const nota = r.epScore !== null ? `<span class="eval-score">${Number(r.epScore).toFixed(2)}</span>` : '';
    let info = nota || tag ? `${nota}${nota && tag ? '<br>' : ''}${tag}` : '';
    if (!info && r.cita) {
      const c = r.cita;
      const hoy = c.dia === ahora.dia;
      const pasada = !citaPendiente(c, ahora);
      info = `<span class="eval-cita${pasada ? ' is-pasada' : ''}" title="${pasada ? 'Entrevista realizada' : 'Entrevista programada'}: ${diaCorto(c.dia)}, de ${hhmm(c.ini)} a ${hhmm(c.fin)}, ${panelTxt(c.panel)}">
        ${hoy ? '<span class="tag tag--accent">Hoy</span>' : diaCorto(c.dia)} ${hhmm(c.ini)}<br><small>${panelTxt(c.panel)}</small></span>`;
    }
    return `<td class="num"><div class="eval-ep">${info ? `<div>${info}</div>` : ''}${calcHtml}</div></td>`;
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
    const ahora = ahoraLima();

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
            // Solo los finalistas (CALIFICA en PT, PA y EC) tienen algo que calcular
            const calcHtml = r.puesto !== null && window.CPM_CALC
              ? `<button class="calc-btn" type="button" data-dni="${r.dni}" title="Calcular sus posibilidades de ganar" aria-label="Calcular las posibilidades de ${escHtml(r.nombre || r.dni)}">${ICON_CALC}</button>`
              : '';
            return `<tr${r.ganando ? ' class="is-winning"' : ''}>
              <td class="num muted">${fmt(start + i + 1)}</td>
              <td class="num">${r.dni}</td>
              <td>${escHtml(r.nombre)}</td>
              <td class="num"><button class="perfil-link" data-id="${r.perfil}" type="button" title="Ver requisitos del perfil N° ${r.perfil}">${r.perfil}</button></td>
              ${scoreCell(r.ptScore, r.ptCond)}
              ${scoreCell(r.paScore, r.paCond)}
              ${scoreCell(r.ecScore, r.ecCond, r.ecFalta)}
              ${calcHtml ? epCalcCell(r, calcHtml, ahora) : scoreCell(r.epScore, r.epCond)}
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

  [ptCondEl, paCondEl, ecCondEl, epDiaEl, epPanelEl].forEach((el) => el.addEventListener('change', applyFilters));

  let rangoTimer;
  [ptMinEl, ptMaxEl, paMinEl, paMaxEl, ecMinEl, ecMaxEl].forEach((el) => el.addEventListener('input', () => {
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
    const calc = e.target.closest('.calc-btn');
    if (calc) {
      const r = records.find((x) => x.dni === calc.dataset.dni);
      if (r) window.CPM_CALC.open(r, finalistasPorPerfil.get(r.perfil) || [r], perfilesMap[r.perfil]);
      return;
    }
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
