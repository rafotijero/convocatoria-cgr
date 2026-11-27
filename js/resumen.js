/* Resumen final por perfil: ganadores y perfiles desiertos — CPM N° 06-2026-CG */
(function () {
  'use strict';

  const E = window.CPM_EVAL, R = window.CPM_RESULTADOS, PD = window.CPM_DATA;
  if (!E || !E.final || !R || !PD) return;

  const $ = (id) => document.getElementById(id);
  const fmt = (n) => n.toLocaleString('es-PE');
  const pct = (a, b) => (b ? (100 * a / b).toLocaleString('es-PE', { maximumFractionDigits: 1 }) : '0') + '%';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const docKey = (d) => String(d).replace(/^0+/, '');
  const pts = (n) => n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  /* ---------- Etapas del embudo ---------- */
  // Cada perfil queda desierto en la primera etapa en la que siguen en carrera menos
  // postulantes que plazas. "ins" no es una etapa de corte: sin inscritos no hubo postulantes.
  const ETAPAS = [
    { k: 'apt', label: 'Inscripción' },
    { k: 'pt', label: 'Conocimientos (PT)' },
    { k: 'pa', label: 'Aptitud (PA)' },
    { k: 'ec', label: 'Curricular (EC)' },
    { k: 'ep', label: 'Entrevista (EP)' },
  ];
  const SIN_POSTULANTES = 'Sin postulantes';

  /* ---------- Perfiles ---------- */
  // Mismo texto de carreras que el dashboard de perfiles
  function carrerasCorto(p) {
    if (!p.carreras.length) return p.nivel === 'Secundaria' ? 'No requiere carrera · Secundaria completa' : p.carrerasTexto || '—';
    const txt = p.carreras.join(', ');
    return p.carrerasAfines ? `${txt} u otras afines` : txt;
  }
  const perfiles = new Map();
  PD.perfiles.forEach((p) => {
    perfiles.set(parseInt(p.id, 10), {
      id: parseInt(p.id, 10), puesto: p.puesto, organo: p.organo, ambito: p.ambito,
      carreras: p.carreras, carrerasCorto: carrerasCorto(p), _car: norm(p.carreras.join(' | ') + ' ' + p.carrerasTexto),
      plazas: p.posiciones, ins: 0, apt: 0, pt: 0, pa: 0, ec: 0, ep: 0, ganadores: [], acc: 0,
    });
  });
  const P = (id) => perfiles.get(id);

  const nombrePorDoc = new Map();
  R.data.forEach((r) => {
    nombrePorDoc.set(docKey(r[0]), r[1]);
    const p = P(r[2]);
    if (!p) return;
    p.ins++;
    if (r[3] === 0) p.apt++;
  });

  // D.data: [dni, nombre, perfil, pt_score, pt_cond, pa_score, pa_cond, ec_score?, ec_cond?, ep_score?, ep_cond?]
  const evalPorDoc = new Map();
  E.data.forEach((r) => {
    evalPorDoc.set(r[0], r);
    const p = P(r[2]);
    if (!p) return;
    if (r[4] === 0) p.pt++;
    if (r[6] === 0) p.pa++;
    if (r[8] === 0) p.ec++;
    if (r[10] === 0) p.ep++;
  });

  // Cuadro de méritos: [dni, puntaje final, orden, 0 = GANADOR/A | 1 = ACCESITARIO/A, desempate]
  E.final.data.forEach((f) => {
    const r = evalPorDoc.get(f[0]);
    const p = r && P(r[2]);
    if (!p) return;
    if (f[3] === 0) {
      p.ganadores.push({ dni: f[0], nombre: r[1] || nombrePorDoc.get(docKey(f[0])) || '', final: f[1], orden: f[2], desempate: f[4] === 1 });
    } else p.acc++;
  });

  const lista = [...perfiles.values()].sort((a, b) => a.id - b.id);
  lista.forEach((p) => {
    p.ganadores.sort((a, b) => a.orden - b.orden);
    p.cubiertas = p.ganadores.length;
    p.desiertas = Math.max(0, p.plazas - p.cubiertas);
    p.estado = p.cubiertas === 0 ? 'desierto' : p.desiertas ? 'parcial' : 'completo';
    p.etapa = null;
    if (p.desiertas) {
      const e = ETAPAS.find((x) => p[x.k] < p.plazas);
      p.etapa = p.ins === 0 ? SIN_POSTULANTES : e ? e.label : 'Cuadro de méritos';
    }
    p._q = norm(`${p.id} ${p.puesto} ${p.organo} ${p.ganadores.map((g) => `${g.nombre} ${g.dni}`).join(' ')}`);
  });

  /* ---------- KPIs (de los perfiles de la carrera elegida, o de todos) ---------- */
  const sum = (arr, f) => arr.reduce((s, x) => s + f(x), 0);
  function renderKpis(base) {
    const tPlazas = sum(base, (p) => p.plazas);
    const tGan = sum(base, (p) => p.cubiertas);
    const nDes = base.filter((p) => p.estado === 'desierto').length;
    const nPar = base.filter((p) => p.estado === 'parcial').length;
    $('k-plazas').textContent = fmt(tPlazas);
    $('k-plazas-hint').textContent = `en ${fmt(base.length)} perfiles · ${fmt(sum(base, (p) => p.ins))} inscritos`;
    $('k-gan').textContent = fmt(tGan);
    $('k-gan-hint').textContent = `${pct(tGan, tPlazas)} de las plazas cubiertas`;
    $('k-des').textContent = fmt(sum(base, (p) => p.desiertas));
    $('k-des-hint').textContent = `${fmt(nDes)} perfiles desiertos y ${fmt(nPar)} parcialmente`;
    $('k-acc').textContent = fmt(sum(base, (p) => p.acc));
    $('k-acc-hint').textContent = `en ${fmt(base.filter((p) => p.acc).length)} perfiles, por si alguna plaza queda libre`;
  }
  $('pub-info').textContent =
    `Resultados finales publicados el ${E.final.pub}: quiénes ganaron en cada perfil y qué plazas quedaron desiertas, ` +
    'con el recorrido de los postulantes desde la inscripción · CPM N° 06-2026-CG';

  /* ---------- Filtros ---------- */
  const buscarEl = $('f-buscar'), carreraEl = $('f-carrera'), ambitoEl = $('f-ambito'), estadoEl = $('f-estado'), etapaEl = $('f-etapa');
  const collator = new Intl.Collator('es', { sensitivity: 'base' });
  const carreras = [...new Set(lista.flatMap((p) => p.carreras))].sort(collator.compare);
  $('dl-carreras').innerHTML = carreras.map((c) => `<option value="${esc(c)}">`).join('');
  // Perfiles de la carrera elegida (coincidencia parcial, como en el dashboard)
  const deCarrera = () => {
    const c = norm(carreraEl.value);
    return c ? lista.filter((p) => p._car.includes(c)) : lista;
  };
  const ambitos = [...new Set(lista.map((p) => p.ambito))].sort((a, b) => a.localeCompare(b, 'es'));
  ambitos.forEach((a) => ambitoEl.add(new Option(a, a)));
  const etapasUsadas = [SIN_POSTULANTES, ...ETAPAS.map((e) => e.label), 'Cuadro de méritos']
    .filter((l) => lista.some((p) => p.etapa === l));
  etapasUsadas.forEach((l) => etapaEl.add(new Option(l, l)));

  let tab = 'ganadores';
  let page = 1;
  const POR_PAGINA = 25;

  function filtrados() {
    const q = norm(buscarEl.value);
    const palabras = q ? q.split(/\s+/) : [];
    return deCarrera().filter((p) =>
      (!ambitoEl.value || p.ambito === ambitoEl.value) &&
      (tab === 'desiertos' ? p.desiertas > 0 && (!etapaEl.value || p.etapa === etapaEl.value)
                           : !estadoEl.value || p.estado === estadoEl.value) &&
      palabras.every((w) => p._q.includes(w)));
  }

  /* ---------- Gráficos ---------- */
  function hbars(el, items, onClick) {
    const max = Math.max(1, ...items.map((i) => i.n));
    el.innerHTML = items.map((i) => `
      <button type="button" class="hbar${i.activo ? ' is-active' : ''}" data-v="${esc(i.label)}" title="${esc(i.title || i.label)}">
        <span class="hbar__label">${esc(i.label)}</span>
        <span class="hbar__track"><span class="hbar__fill" style="width:${(100 * i.n) / max}%;${i.color ? `background:${i.color}` : ''}"></span></span>
        <span class="hbar__value">${fmt(i.n)}</span>
      </button>`).join('');
    el.onclick = (e) => { const b = e.target.closest('.hbar'); if (b) onClick(b.dataset.v); };
  }

  function renderCharts(base) {
    const porEtapa = new Map(etapasUsadas.map((l) => [l, { n: 0, perfiles: 0 }]));
    const porAmbito = new Map();
    base.forEach((p) => {
      if (!p.desiertas) return;
      const e = porEtapa.get(p.etapa); e.n += p.desiertas; e.perfiles++;
      porAmbito.set(p.ambito, (porAmbito.get(p.ambito) || 0) + p.desiertas);
    });
    hbars($('chart-etapa'), [...porEtapa].map(([label, v]) => ({
      label, n: v.n, color: 'var(--danger)', activo: tab === 'desiertos' && etapaEl.value === label,
      title: `${label}: ${fmt(v.n)} plazas desiertas en ${fmt(v.perfiles)} perfiles`,
    })), (v) => {
      etapaEl.value = etapaEl.value === v && tab === 'desiertos' ? '' : v;
      setTab('desiertos');
    });
    // Los 8 ámbitos con más plazas desiertas (y el filtrado, si queda fuera)
    const TOP = 8;
    const orden = [...porAmbito].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es'));
    const top = orden.filter(([label], i) => i < TOP || label === ambitoEl.value);
    const resto = orden.filter((x) => !top.includes(x));
    $('ambito-mas').textContent = resto.length
      ? `y ${resto.length} ámbitos más con ${fmt(sum(resto, ([, n]) => n))} plazas desiertas (filtra por ámbito abajo)`
      : '';
    hbars($('chart-ambito'), top.map(([label, n]) => ({
      label, n, activo: ambitoEl.value === label, title: `${label}: ${fmt(n)} plazas desiertas`,
    })), (v) => {
      ambitoEl.value = ambitoEl.value === v ? '' : v;
      page = 1;
      render();
    });
  }

  /* ---------- Tablas ---------- */
  const resaltar = (texto, palabras) => {
    let html = esc(texto);
    if (!palabras.length) return html;
    const n = norm(texto);
    return palabras.some((w) => w.length > 1 && n.includes(w)) ? `<mark>${html}</mark>` : html;
  };

  // Como en Evaluaciones: el código lleva a los resultados del perfil y el botón Ver perfil
  // abre su detalle en el panel lateral, sin salir del resumen (Anterior/Siguiente recorren
  // los perfiles listados con los filtros actuales).
  const celdaPerfil = (p) => `<td class="num"><a class="perfil-link" href="evaluaciones.html?perfil=${p.id}" title="Ver los resultados de evaluación del perfil ${p.id}">${p.id}</a></td>`;
  const celdaVerPerfil = (p) => `<td><button type="button" class="btn btn--ghost btn--sm rsm-ver" data-perfil="${p.id}" title="Ver el perfil del puesto ${p.id}">Ver perfil</button></td>`;

  const perfilData = new Map(PD.perfiles.map((p) => [parseInt(p.id, 10), p]));
  document.addEventListener('click', (e) => {
    const a = e.target.closest('.rsm-ver[data-perfil]');
    if (!a || !window.CPM_PERFIL_DRAWER) return;
    e.preventDefault();
    const contexto = filtrados().map((p) => perfilData.get(p.id)).filter(Boolean);
    window.CPM_PERFIL_DRAWER.open(a.dataset.perfil, contexto);
  });
  const celdaPuesto = (p) => `<td class="rsm-puesto">${esc(p.puesto)}<small class="muted">${esc(p.organo)} · ${esc(p.ambito)}</small>` +
    `<small class="muted">Carreras: ${esc(p.carrerasCorto)}</small></td>`;
  const estadoTag = (p) => p.estado === 'desierto' ? '<span class="tag tag--danger">Desierto</span>'
    : p.estado === 'parcial' ? `<span class="tag tag--warn">${p.desiertas} ${p.desiertas === 1 ? 'plaza desierta' : 'plazas desiertas'}</span>` : '';

  function renderGanadores(rows) {
    const q = norm(buscarEl.value);
    const palabras = q ? q.split(/\s+/) : [];
    const pages = Math.max(1, Math.ceil(rows.length / POR_PAGINA));
    page = Math.min(page, pages);
    const vis = rows.slice((page - 1) * POR_PAGINA, page * POR_PAGINA);
    $('t-gan').innerHTML = vis.map((p) => {
      const gan = p.ganadores.map((g) => `
        <li><span class="rsm-gan__n">${g.orden}.</span><span>${resaltar(g.nombre, palabras)} <small class="muted">${esc(g.dni)}</small></span>
        <span class="rsm-gan__pt">${pts(g.final)}${g.desempate ? '*' : ''}</span></li>`).join('');
      const vac = p.desiertas ? `<li><span class="rsm-gan__n"></span><span class="rsm-gan__vacante">${estadoTag(p)} ${esc(p.etapa)}</span><span></span></li>` : '';
      return `<tr class="${p.estado === 'desierto' ? 'is-desierto' : p.estado === 'parcial' ? 'is-parcial' : ''}">
        ${celdaPerfil(p)}${celdaPuesto(p)}
        <td class="num">${p.plazas}</td>
        <td><ul class="rsm-gan">${gan}${vac}</ul></td>
        <td class="num">${p.acc || '<span class="muted">—</span>'}</td>
        ${celdaVerPerfil(p)}
      </tr>`;
    }).join('');
    $('e-gan').hidden = rows.length > 0;
    const g = sum(rows, (p) => p.cubiertas);
    $('n-gan').textContent = `${fmt(rows.length)} perfiles · ${fmt(g)} ganadores de ${fmt(sum(rows, (p) => p.plazas))} plazas`;
    renderPager(pages);
  }

  function embudo(p) {
    const vals = [['ins', p.ins], ...ETAPAS.map((e) => [e.k, p[e.k]])];
    const corte = ETAPAS.find((e) => p[e.k] < p.plazas);
    return vals.map(([k, n]) => {
      const cls = n === 0 ? 'is-cero' : corte && corte.k === k ? 'is-corte' : '';
      return `<span class="${cls}">${fmt(n)}</span>`;
    }).join('<i>→</i>');
  }

  function renderDesiertos(rows) {
    $('t-des').innerHTML = rows.map((p) => `
      <tr class="${p.estado === 'desierto' ? 'is-desierto' : 'is-parcial'}">
        ${celdaPerfil(p)}${celdaPuesto(p)}
        <td class="num">${p.plazas}</td>
        <td class="num">${p.cubiertas}</td>
        <td class="num"><strong>${p.desiertas}</strong></td>
        <td class="rsm-embudo">${embudo(p)}</td>
        <td><span class="tag ${p.estado === 'desierto' ? 'tag--danger' : 'tag--warn'}">${esc(p.etapa)}</span><br>
          <small class="muted">${p.estado === 'desierto' ? 'Desierto' : 'Parcialmente desierto'}</small></td>
        ${celdaVerPerfil(p)}
      </tr>`).join('');
    $('e-des').hidden = rows.length > 0;
    const d = rows.filter((p) => p.estado === 'desierto').length;
    $('n-des').textContent = `${fmt(rows.length)} perfiles (${fmt(d)} desiertos, ${fmt(rows.length - d)} parcialmente) · ${fmt(sum(rows, (p) => p.desiertas))} plazas desiertas`;
  }

  /* ---------- Paginación ---------- */
  const pagerEl = $('pager');
  function renderPager(pages) {
    if (pages <= 1 || tab !== 'ganadores') { pagerEl.innerHTML = ''; return; }
    const nums = [];
    for (let n = 1; n <= pages; n++) if (n === 1 || n === pages || Math.abs(n - page) <= 2) nums.push(n);
    let html = `<button ${page === 1 ? 'disabled' : ''} data-p="${page - 1}" aria-label="Página anterior">‹</button>`;
    let prev = null;
    nums.forEach((n) => {
      if (prev !== null && n - prev > 1) html += '<span class="pager__gap">…</span>';
      html += `<button ${n === page ? 'aria-current="page"' : ''} data-p="${n}">${n}</button>`;
      prev = n;
    });
    html += `<button ${page === pages ? 'disabled' : ''} data-p="${page + 1}" aria-label="Página siguiente">›</button>`;
    pagerEl.innerHTML = html;
  }
  pagerEl.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-p]');
    if (!b || b.disabled) return;
    page = parseInt(b.dataset.p, 10);
    render();
    $('n-gan').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });

  /* ---------- Vistas y URL ---------- */
  const tabs = document.querySelectorAll('.page-tab');
  function setTab(t) {
    tab = t;
    page = 1;
    render();
  }
  tabs.forEach((b) => b.addEventListener('click', () => setTab(b.dataset.tab)));

  function syncUrl() {
    const p = new URLSearchParams();
    if (tab !== 'ganadores') p.set('vista', tab);
    if (buscarEl.value.trim()) p.set('q', buscarEl.value.trim());
    if (carreraEl.value.trim()) p.set('carrera', carreraEl.value.trim());
    if (ambitoEl.value) p.set('ambito', ambitoEl.value);
    if (tab === 'ganadores' && estadoEl.value) p.set('estado', estadoEl.value);
    if (tab === 'desiertos' && etapaEl.value) p.set('etapa', etapaEl.value);
    if (tab === 'ganadores' && page > 1) p.set('p', page);
    const qs = p.toString();
    history.replaceState(null, '', qs ? `?${qs}` : location.pathname);
  }

  function render() {
    tabs.forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
    document.querySelectorAll('[data-panel]').forEach((s) => { s.hidden = s.dataset.panel !== tab; });
    $('fld-estado').hidden = tab !== 'ganadores';
    $('fld-etapa').hidden = tab !== 'desiertos';
    const rows = filtrados();
    if (tab === 'ganadores') renderGanadores(rows); else { renderDesiertos(rows); renderPager(0); }
    const base = deCarrera();
    renderKpis(base);
    renderCharts(base);
    syncUrl();
  }

  let timer;
  [buscarEl, carreraEl].forEach((el) => el.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => { page = 1; render(); }, 200); }));
  [ambitoEl, estadoEl, etapaEl].forEach((el) => el.addEventListener('change', () => { page = 1; render(); }));
  $('limpiar').addEventListener('click', () => {
    buscarEl.value = ''; carreraEl.value = ''; ambitoEl.value = ''; estadoEl.value = ''; etapaEl.value = '';
    page = 1;
    render();
  });

  /* ---------- Estado inicial desde la URL ---------- */
  const qs = new URLSearchParams(location.search);
  if (qs.get('vista') === 'desiertos') tab = 'desiertos';
  if (qs.get('q')) buscarEl.value = qs.get('q');
  if (qs.get('carrera')) carreraEl.value = qs.get('carrera');
  if (ambitos.includes(qs.get('ambito'))) ambitoEl.value = qs.get('ambito');
  if (['completo', 'parcial', 'desierto'].includes(qs.get('estado'))) estadoEl.value = qs.get('estado');
  if (etapasUsadas.includes(qs.get('etapa'))) etapaEl.value = qs.get('etapa');
  page = Math.max(1, parseInt(qs.get('p'), 10) || 1);
  render();
})();
