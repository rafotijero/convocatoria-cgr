/*
 * Calculadora de posibilidades de ganar una plaza — CPM N° 06-2026-CG
 * Se abre desde la grilla de evaluaciones en el <dialog id="calc">.
 * Expone: window.CPM_CALC = { open(persona, finalistas, perfil) }
 *   persona    registro de evaluaciones.js (acumulado, ptScore, ecScore, puesto, ganando…)
 *   finalistas los CALIFICA del mismo perfil en orden de mérito (incluye a la persona)
 *   perfil     objeto de CPM_DATA (puesto, posiciones…)
 *
 * Falta solo la entrevista personal (EP, 20%): PF = acumulado + 0.20 × EP.
 * Los cálculos exactos no usan supuestos; las probabilidades simulan la entrevista de los
 * rivales con una distribución normal elegida por el usuario.
 */
(function () {
  'use strict';

  const dlg = document.getElementById('calc');
  if (!dlg) return;

  const $ = (sel) => dlg.querySelector(sel);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const r2 = (v) => Math.round(v * 100) / 100;
  const f2 = (v) => v.toFixed(2);
  const f1 = (v) => (Number.isInteger(v) ? String(v) : v.toFixed(1));
  const pct = (p) => (p >= 0.995 ? '100%' : p > 0 && p < 0.005 ? '<1%' : `${Math.round(p * 100)}%`);

  const EP_MIN = 12, EP_MAX = 20, W_EP = 0.20;
  const ESCENARIOS = {
    flojos:  { label: 'Rivales flojos',  mu: 14.5, sd: 2.5, ns: 5 },
    central: { label: 'Central',         mu: 15.5, sd: 2.5, ns: 5 },
    fuertes: { label: 'Rivales fuertes', mu: 16.5, sd: 2.0, ns: 3 },
  };

  // Estado de los supuestos: se conserva entre aperturas del panel
  const st = { esc: 'central', mu: 15.5, sd: 2.5, ns: 5, pb: 0, ffaa: false, disc: false, jov: false, ep: 20 };
  let actual = null; // { s, rivales, plazas, perfil }

  /* ---------- Puntaje final y comparación ---------- */
  // Bonificaciones propias: FF. AA. +10% y discapacidad +15% sobre el total;
  // jóvenes (Ley 31533) +10% sobre la nota de la entrevista.
  function pfPropio(a, e) {
    const ep = st.jov ? e * 1.10 : e;
    const mult = 1 + (st.ffaa ? 0.10 : 0) + (st.disc ? 0.15 : 0);
    return r2((a + W_EP * ep) * mult);
  }

  // ¿El rival (con nota x y puntaje final pfR) queda por delante de la persona (nota e, pfS)?
  // Desempate de las bases: conocimientos, curricular y entrevista. Si sigue el empate
  // (experiencia o entrevista dirimente, que no están en los datos): empateGana decide.
  function vaDelante(r, x, pfR, s, e, pfS, empateGana) {
    if (pfR !== pfS) return pfR > pfS;
    if (r.ptScore !== s.ptScore) return r.ptScore > s.ptScore;
    if (r.ecScore !== s.ecScore) return r.ecScore > s.ecScore;
    if (x !== e) return x > e;
    return empateGana();
  }

  /* ---------- Cálculos exactos ---------- */
  // Menor nota (de 12 a 20, cada 0.1) con la que la persona queda dentro de las plazas
  // si todos los rivales sacan x. Los empates sin resolver se cuentan en contra.
  function notaNecesaria(x) {
    const { s, rivales, plazas } = actual;
    for (let e10 = EP_MIN * 10; e10 <= EP_MAX * 10; e10++) {
      const e = e10 / 10;
      const pfS = pfPropio(s.acumulado, e);
      let delante = 0;
      for (const r of rivales) {
        if (vaDelante(r, x, r2(r.acumulado + W_EP * x), s, e, pfS, () => true)) delante++;
        if (delante >= plazas) break;
      }
      if (delante < plazas) return e;
    }
    return null;
  }

  // Nota más alta (de 12 a 20, cada 0.1) que puede sacar el rival sin superar a la persona
  // si ella saca e. 20 = no la supera nunca; null = la supera aunque saque 12 (tendría
  // que desaprobar o no presentarse).
  function limiteRival(r, e) {
    const { s } = actual;
    const pfS = pfPropio(s.acumulado, e);
    for (let x10 = EP_MAX * 10; x10 >= EP_MIN * 10; x10--) {
      const x = x10 / 10;
      if (!vaDelante(r, x, r2(r.acumulado + W_EP * x), s, e, pfS, () => true)) return x;
    }
    return null;
  }

  // Nota más alta que pueden sacar todos los rivales a la vez para que la persona entre
  // si ella saca e; null = no entra aunque todos aprueben con 12.
  function maximoIgual(e) {
    const { s, rivales, plazas } = actual;
    const pfS = pfPropio(s.acumulado, e);
    for (let x10 = EP_MAX * 10; x10 >= EP_MIN * 10; x10--) {
      const x = x10 / 10;
      let delante = 0;
      for (const r of rivales) {
        if (vaDelante(r, x, r2(r.acumulado + W_EP * x), s, e, pfS, () => true) && ++delante >= plazas) break;
      }
      if (delante < plazas) return x;
    }
    return null;
  }

  /* ---------- Simulación ---------- */
  // Generador con semilla: el mismo DNI y los mismos supuestos dan siempre el mismo resultado
  function rng(seed) {
    let t = seed >>> 0;
    return () => {
      t += 0x6D2B79F5;
      let z = Math.imul(t ^ (t >>> 15), 1 | t);
      z ^= z + Math.imul(z ^ (z >>> 7), 61 | z);
      return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
    };
  }

  function simular(epPropio, n) {
    const { s, rivales, plazas } = actual;
    const rnd = rng(parseInt(s.dni, 10) + Math.round(st.mu * 10) * 7 + Math.round(st.sd * 10) * 13 + st.ns * 17 + st.pb * 19 + (epPropio ?? 99) * 23);
    const normal = () => { let u = 0; while (!u) u = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd()); };
    const nota = () => Math.min(EP_MAX, Math.max(0, Math.round((st.mu + st.sd * normal()) * 10) / 10));
    const moneda = () => rnd() < 0.5;
    let gana = 0;

    for (let k = 0; k < n; k++) {
      const e = epPropio ?? nota();
      if (e < EP_MIN) continue; // no aprueba la entrevista
      const pfS = pfPropio(s.acumulado, e);
      let delante = 0;
      for (const r of rivales) {
        if (rnd() < st.ns / 100) continue;          // no se presenta
        const x = nota();
        if (x < EP_MIN) continue;                   // no aprueba
        const bono = rnd() < st.pb / 100 ? 1.10 : 1;
        if (vaDelante(r, x, r2((r.acumulado + W_EP * x) * bono), s, e, pfS, moneda) && ++delante >= plazas) break;
      }
      if (delante < plazas) gana++;
    }
    return gana / n;
  }

  /* ---------- Render ---------- */
  function renderExactos() {
    const { s, rivales, plazas, finalistas } = actual;
    const asegura = notaNecesaria(EP_MAX);
    const con12   = notaNecesaria(EP_MIN);
    // Puesto en que quedaría si saca e y todos sus rivales sacan x
    const puestoCon = (e, x) => 1 + rivales.filter((r) =>
      vaDelante(r, x, r2(r.acumulado + W_EP * x), s, e, pfPropio(s.acumulado, e), () => true)).length;
    const igual = puestoCon(16, 16);
    const plz = `${plazas} plaza${plazas !== 1 ? 's' : ''}`;

    const fila = (k, v, hint) => `<div><dt>${k}</dt><dd>${v}${hint ? `<br><small class="muted">${hint}</small>` : ''}</dd></div>`;
    const si = (t) => `<span class="tag tag--ok">${t}</span>`;
    const no = (t) => `<span class="tag tag--danger">${t}</span>`;

    const filaAsegura = asegura === null
      ? fila('¿Puede asegurar la plaza?', no('No'), 'Aun con 20, depende de lo que saquen sus rivales: abajo verás cuánto pueden sacar como máximo.')
      : asegura === EP_MIN
        ? fila('¿Puede asegurar la plaza?', si('Sí, con solo aprobar (12)'), 'Gana aunque todos sus rivales saquen 20.')
        : fila('¿Puede asegurar la plaza?', `${si('Sí')} con <strong>${f1(asegura)}</strong> o más`, 'Con esa nota gana aunque todos sus rivales saquen 20.');

    const filaMinima = con12 === null
      ? fila('Nota mínima que necesita', no('No entra aunque saque 20'), 'Ni siquiera si todos sus rivales aprueban con 12; solo si varios desaprueban o no se presentan.')
      : fila('Nota mínima que necesita', con12 === EP_MIN ? si('12 (aprobar)') : `<strong>${f1(con12)}</strong>`,
        'Si todos sus rivales aprueban con lo mínimo (12). Con menos, solo entraría si algunos desaprueban o no se presentan.');

    // Si saca st.ep: hasta cuánto pueden sacar sus rivales
    const opciones = [];
    for (let e = EP_MAX; e >= EP_MIN; e -= 0.5) opciones.push(`<option value="${e}"${e === st.ep ? ' selected' : ''}>${f1(e)}</option>`);
    const maxIgual = maximoIgual(st.ep);
    const valorSi = maxIgual === null
      ? no('No entra aunque todos sus rivales aprueben con 12')
      : maxIgual === EP_MAX ? si('Entra aunque todos sus rivales saquen 20')
        : `Entra si sus rivales sacan como máximo <strong>${f1(maxIgual)}</strong>`;
    const filaSi = fila(`Si saca <select class="select calc-ep" id="c-ep" aria-label="Nota de entrevista de la persona">${opciones.join('')}</select>`,
      valorSi, 'Suponiendo que todos sus rivales sacan la misma nota. El detalle por rival está debajo.');

    $('#c-exactos').innerHTML = `<dl class="kv">
      ${filaAsegura}
      ${filaSi}
      ${filaMinima}
      ${fila('Si todos sacan la misma nota', igual <= plazas ? si(`Gana: queda ${igual}°`) : no(`No gana: queda ${igual}°`),
        `La entrevista no cambia el orden actual del acumulado; hay ${plz}.`)}
      ${fila('Su puntaje final posible', `${f2(pfPropio(s.acumulado, EP_MIN))} a ${f2(pfPropio(s.acumulado, EP_MAX))}`, 'con 12 y con 20 en la entrevista, de 20 puntos')}
    </dl>
    ${renderLimites()}
    ${finalistas.length <= plazas ? `<p class="calc-nota">Hay ${finalistas.length} finalista${finalistas.length !== 1 ? 's' : ''} para ${plz}: todos los que aprueben la entrevista ganan.</p>` : ''}
    <p class="calc-nota">Los empates que no resuelven conocimientos, curricular ni entrevista se cuentan en contra.</p>`;

    $('#c-ep').addEventListener('change', (e) => { st.ep = parseFloat(e.target.value); renderExactos(); });
  }

  // Rivales que podrían quedar por delante de la persona si ella saca st.ep, con la nota máxima que
  // cada uno puede sacar sin pasarla y cuántos tienen que quedarse por debajo.
  function renderLimites() {
    const { rivales, plazas } = actual;
    const e = st.ep;
    const peligrosos = rivales
      .map((r) => ({ r, lim: limiteRival(r, e) }))
      .filter((x) => x.lim !== EP_MAX);
    const plz = `${plazas} plaza${plazas !== 1 ? 's' : ''}`;

    if (peligrosos.length < plazas) {
      return `<p class="calc-limites-titulo">Con ${f1(e)} ningún rival puede quitarle la plaza: como mucho ${peligrosos.length} quedarían por delante y hay ${plz}.</p>`;
    }
    const necesita = peligrosos.length - (plazas - 1);
    const filas = peligrosos.map(({ r, lim }) => `<tr>
        <td class="num">${r.puesto}°</td>
        <td>${esc(r.nombre || r.dni)}</td>
        <td class="num">${lim === null
          ? '<span class="calc-delante">Desaprobar (menos de 12)</span>'
          : `<strong>${f1(lim)}</strong> como máximo`}</td>
      </tr>`).join('');
    return `
      <p class="calc-limites-titulo">Si saca ${f1(e)}, <strong>${peligrosos.length}</strong> rival${peligrosos.length !== 1 ? 'es' : ''} podría${peligrosos.length !== 1 ? 'n' : ''} quedar por delante.
        Hay ${plz}, así que necesita que <strong>al menos ${necesita}</strong> de ell${peligrosos.length !== 1 ? 'os' : 'o'} se quede${necesita !== 1 ? 'n' : ''} en su límite o por debajo (o no se presente${necesita !== 1 ? 'n' : ''}):</p>
      <div class="res-table-wrap calc-limites">
        <table class="res-table">
          <thead><tr><th class="num">Puesto</th><th>Rival</th><th class="num">Para no quedar por delante debe sacar</th></tr></thead>
          <tbody>${filas}</tbody>
        </table>
      </div>`;
  }

  let timer;
  function renderProbabilidades() {
    clearTimeout(timer);
    $('#c-global').textContent = '…';
    timer = setTimeout(() => {
      const N = 4000;
      const filas = [];
      for (let e = EP_MIN; e <= EP_MAX; e++) filas.push({ e, p: simular(e, N) });
      $('#c-global').textContent = pct(simular(null, N));
      $('#c-por-nota').innerHTML = filas.map(({ e, p }) => `
        <div class="hbar calc-hbar" title="Con ${e} en la entrevista: ${pct(p)}">
          <span class="hbar__label">Entrevista ${e}</span>
          <span class="hbar__track"><span class="hbar__fill" style="width:${Math.max(p * 100, 0.5)}%;${p >= 0.5 ? 'background:var(--ok)' : ''}"></span></span>
          <span class="hbar__value">${pct(p)}</span>
        </div>`).join('');
      $('#c-supuesto').textContent =
        `Rivales: promedio ${f1(st.mu)} y desviación ${f1(st.sd)} en la entrevista; ` +
        `${st.ns}% no se presenta${st.pb ? `; ${st.pb}% con bonificación de +10%` : ''}.`;
    }, 30);
  }

  function renderRivales() {
    const { s, plazas, finalistas } = actual;
    // Dos tramos: alrededor del corte de plazas y alrededor de la persona
    const idx = finalistas.indexOf(s);
    const set = new Set();
    for (let i = plazas - 3; i <= plazas + 1; i++) set.add(i);
    for (let i = idx - 2; i <= idx + 2; i++) set.add(i);
    const indices = [...set].filter((i) => i >= 0 && i < finalistas.length).sort((a, b) => a - b);
    const dif = (r) => {
      if (r === s) return '<span class="muted">—</span>';
      const d = (r.acumulado - s.acumulado) / W_EP;
      return d === 0 ? 'Empate' : d > 0 ? `<span class="calc-delante">${f1(d)} delante</span>` : `${f1(-d)} detrás`;
    };
    $('#c-rivales').innerHTML = indices.map((pos, i) => {
      const r = finalistas[pos];
      const salto = i > 0 && pos - indices[i - 1] > 1 ? '<tr class="calc-salto"><td colspan="5">…</td></tr>' : '';
      const corte = pos === plazas - 1 && pos < finalistas.length - 1 ? ' calc-corte' : '';
      return `${salto}<tr class="${r === s ? 'calc-yo' : ''}${corte}">
        <td class="num">${r.puesto}°${r.ganando ? ' <span class="calc-star" title="Va ganando">★</span>' : ''}</td>
        <td>${esc(r.nombre || r.dni)}</td>
        <td class="num">${f2(r.acumulado)}</td>
        <td class="num">${r.ptScore} · ${r.ecScore}</td>
        <td class="num">${dif(r)}</td>
      </tr>`;
    }).join('');
    $('#c-rivales-nota').textContent = `${finalistas.length} finalistas en total. ` +
      'La diferencia está en puntos de entrevista: cada 0.20 de acumulado equivale a 1 punto. La línea marca el corte de plazas.';
  }

  function syncControles() {
    dlg.querySelectorAll('input[name="c-esc"]').forEach((i) => { i.checked = i.value === st.esc; });
    ['mu', 'sd', 'ns', 'pb'].forEach((k) => {
      $(`#c-${k}`).value = st[k];
      $(`#c-${k}-v`).textContent = k === 'ns' || k === 'pb' ? `${st[k]}%` : f1(st[k]);
    });
    ['ffaa', 'disc', 'jov'].forEach((k) => { $(`#c-${k}`).checked = st[k]; });
  }

  /* ---------- Cita de la entrevista ---------- */
  const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  function renderCita(s) {
    const el = $('#c-cita');
    const H = window.CPM_CITA;
    if (!s.cita || !H) { el.hidden = true; return; }
    const { dia, ini, fin, panel } = s.cita;
    const [y, m, d] = dia.split('-').map(Number);
    const fecha = `${DIAS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${d} de ${MESES[m - 1]}`;
    el.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
      <p><strong>Entrevista: ${fecha}, de ${H.hhmm(ini)} a ${H.hhmm(fin)} · ${H.panelTxt(panel)}</strong><br>
      <small>Virtual. Conectarse con el DNI 10 minutos antes; el enlace llega al correo registrado en la inscripción.</small></p>`;
    el.hidden = false;
  }

  /* ---------- Abrir ---------- */
  function open(s, finalistas, perfil) {
    const plazas = perfil ? perfil.posiciones : 0;
    actual = { s, finalistas, rivales: finalistas.filter((r) => r !== s), plazas, perfil };
    const corte = finalistas.length >= plazas ? finalistas[plazas - 1] : null;

    $('#c-eyebrow').textContent = `Calculadora · Perfil N° ${s.perfil}`;
    $('#c-title').textContent = s.nombre || `Documento ${s.dni}`;
    $('#c-sub').textContent = `${s.dni} · ${perfil ? perfil.puesto : ''}`;

    const distancia = !corte || corte === s ? null : (corte.acumulado - s.acumulado) / W_EP;
    $('#c-facts').innerHTML = `
      <div class="fact"><div class="fact__label">Puesto actual</div><div class="fact__value">${s.puesto}° de ${finalistas.length}</div><div class="fact__hint">${s.ganando ? '★ va ganando' : 'fuera de las plazas'}</div></div>
      <div class="fact"><div class="fact__label">Plazas</div><div class="fact__value">${plazas}</div><div class="fact__hint">${finalistas.length} finalistas</div></div>
      <div class="fact"><div class="fact__label">Acumulado</div><div class="fact__value">${f2(s.acumulado)}</div><div class="fact__hint">de 16 posibles · PT ${s.ptScore} · PA ${s.paScore} · EC ${s.ecScore}</div></div>
      <div class="fact"><div class="fact__label">Corte actual</div><div class="fact__value">${corte ? f2(corte.acumulado) : '—'}</div><div class="fact__hint">${
        !corte ? 'hay menos finalistas que plazas'
          : distancia === null ? 'es el último puesto ganador'
            : distancia > 0 ? `a ${f1(distancia)} pts de entrevista` : `le saca ${f1(-distancia)} pts de entrevista`}</div></div>`;

    renderCita(s);
    syncControles();
    renderExactos();
    renderRivales();
    renderProbabilidades();
    if (!dlg.open) dlg.showModal();
    $('.drawer__body').scrollTop = 0;
  }

  /* ---------- Controles ---------- */
  dlg.querySelectorAll('input[name="c-esc"]').forEach((i) => i.addEventListener('change', () => {
    st.esc = i.value;
    if (i.value === 'custom') {
      // Personalizado parte de los valores actuales y abre los ajustes
      const det = $('#c-ajustes');
      det.open = true;
      det.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      $('#c-mu').focus({ preventScroll: true });
      return;
    }
    Object.assign(st, { mu: ESCENARIOS[i.value].mu, sd: ESCENARIOS[i.value].sd, ns: ESCENARIOS[i.value].ns });
    syncControles();
    renderProbabilidades();
  }));
  ['mu', 'sd', 'ns', 'pb'].forEach((k) => $(`#c-${k}`).addEventListener('input', (e) => {
    st[k] = parseFloat(e.target.value);
    const preset = Object.entries(ESCENARIOS).find(([, v]) => v.mu === st.mu && v.sd === st.sd && v.ns === st.ns);
    st.esc = preset ? preset[0] : 'custom';
    syncControles();
    renderProbabilidades();
  }));
  ['ffaa', 'disc', 'jov'].forEach((k) => $(`#c-${k}`).addEventListener('change', (e) => {
    st[k] = e.target.checked;
    renderExactos();
    renderProbabilidades();
  }));
  $('#c-close').addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });

  window.CPM_CALC = { open };
})();
