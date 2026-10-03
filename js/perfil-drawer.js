/*
 * Drawer de detalle de perfil — CPM N° 06-2026-CG
 * Módulo autónomo. Requiere:
 *   - window.CPM_DATA (data.js)
 *   - El HTML del <dialog id="detail"> en la página
 * Expone: window.CPM_PERFIL_DRAWER = { open(id, context?) }
 *   context: array de perfiles para navegación prev/next (opcional; por defecto todos)
 */
(function () {
  'use strict';

  function init() {
    const D = window.CPM_DATA;
    const dlg = document.getElementById('detail');
    if (!D || !dlg) return;

    const { perfiles, funciones } = D;

    /* ---------- Utilidades ---------- */
    const $ = (sel, root) => (root || document).querySelector(sel);
    const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const money = (n) => 'S/ ' + n.toLocaleString('en-US');
    const catLabel = (c) => c.charAt(0) + c.slice(1).toLowerCase().replace(/\b(i|ii|iii|iv|v|vi)\b/g, (m) => m.toUpperCase());
    const years = (n) => n > 0 ? `${Number.isInteger(n) ? n : n.toFixed(1)} ${n === 1 ? 'año' : 'años'}` : 'No aplica';
    const noAplica = (t) => !t || /^no aplica\.?$/i.test(t.trim());

    /* ---------- Iconos ---------- */
    const ICON = {
      pin:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>',
      x:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>',
      cap:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 10 12 5 2 10l10 5 10-5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>',
      book:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5V21h16"/></svg>',
      bulb:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18h6M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.3h6c0-1 .4-1.8 1-2.3A7 7 0 0 0 12 2z"/></svg>',
      brief: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>',
      info:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>',
      check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>',
      star:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/></svg>',
      list:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>',
    };

    /* ---------- Constructores HTML ---------- */
    const panel = (icon, title, body) =>
      `<section class="panel"><h3>${ICON[icon] || ''}${esc(title)}</h3>${body}</section>`;
    const kv = (rows) =>
      `<dl class="kv">${rows.filter((r) => r && String(r[1]).trim()).map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join('')}</dl>`;
    const yesNo = (b, yes, no) =>
      b ? `<span class="tag tag--accent">${ICON.check}${yes}</span>` : `<span class="tag">${no}</span>`;
    const chips = (items) =>
      `<ul class="chip-list">${items.map((i) => `<li><span class="chip">${esc(i)}</span></li>`).join('')}</ul>`;

    function carrerasCorto(p) {
      if (!p.carreras.length) return p.nivel === 'Secundaria' ? 'No requiere carrera · Secundaria completa' : p.carrerasTexto || '—';
      return p.carrerasAfines ? p.carreras.join(', ') + ' u otras afines' : p.carreras.join(', ');
    }

    /* ---------- Pestañas de contenido ---------- */
    function tabResumen(p) {
      const expEsp = p.exp.funcionAnios ? `${years(p.exp.funcionAnios)} en la función o materia` : 'No aplica';
      const extra = noAplica(p.requisitos) ? null : ['Requisito adicional', esc(p.requisitos)];
      return `
        <div class="facts">
          <div class="fact"><div class="fact__label">Remuneración mensual</div><div class="fact__value">${money(p.remuneracion)}</div><div class="fact__hint">${esc(catLabel(p.categoria))}</div></div>
          <div class="fact"><div class="fact__label">Posiciones</div><div class="fact__value">${p.posiciones}</div><div class="fact__hint">${p.lugares.length} ${p.lugares.length === 1 ? 'lugar' : 'lugares'} de prestación</div></div>
          <div class="fact"><div class="fact__label">Tipo</div><div class="fact__value">${esc(p.tipo)}</div><div class="fact__hint">${p.clasificacion ? `Clasificación ${esc(p.clasificacion)}` : esc(catLabel(p.categoria))}</div></div>
        </div>
        ${p.tipo === 'Programa de formación' ? `<div class="callout" style="margin-bottom:12px">${ICON.cap}<p>Quienes ganen ingresan al <strong>Programa de Formación y Entrenamiento de la Escuela Nacional de Control</strong> durante el periodo de prueba.</p></div>` : ''}
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
      const box = (label, n, texto) =>
        `<div class="exp${n ? '' : ' exp--na'}"><div class="exp__label">${label}</div><div class="exp__value">${n ? years(n) : esc(texto && !noAplica(texto) ? texto : 'No aplica')}</div></div>`;
      return `
        ${panel('brief', 'Experiencia solicitada', `<div class="exp-grid">
          ${box('Experiencia general (pública o privada)', p.exp.generalAnios, p.exp.general)}
          ${box('Específica en la función o materia', p.exp.funcionAnios, p.exp.funcion)}
          ${box('Específica en el sector público', p.exp.publicoAnios, p.exp.publico)}
          ${box('Específica en el puesto o cargo', p.exp.puestoAnios, p.exp.puesto)}
        </div>`)}
        ${noAplica(p.exp.otros) ? '' : panel('info', 'Otros aspectos sobre la experiencia', `<p>${esc(p.exp.otros)}</p>`)}
        <div class="callout" style="margin-top:12px">${ICON.info}<div>
          <p>La experiencia se cuenta <strong>desde la fecha de egreso</strong>. Las prácticas preprofesionales (3 meses o más) y las profesionales (hasta 24 meses) cuentan como experiencia.</p>
          <p><a href="index.html#curricular">Ver cómo se acredita la experiencia</a></p>
        </div></div>`;
    }

    function tabAdicional(p) {
      const lugares = `<ul class="places">${p.lugares.map((x) => `<li><span>${esc(x.n)}</span><span class="places__n" title="Posiciones">${x.c} ${x.c === 1 ? 'posición' : 'posiciones'}</span></li>`).join('')}</ul>`;
      const hab = p.habilidades ? p.habilidades.replace(/\.$/, '').split(/,\s*|\s+y\s+/).filter(Boolean) : [];
      const licencia = /licencia de conducir/i.test(p.requisitos);
      return `
        ${panel('star', 'Requisitos adicionales', `<p>${esc(noAplica(p.requisitos) ? 'No aplica.' : p.requisitos)}</p>${licencia ? '<p class="muted" style="margin:0;font-size:.86rem">La licencia debe estar vigente al postular y adjuntarse (nota del Anexo N° 03).</p>' : ''}`)}
        ${panel('pin', `Lugares de prestación (${p.lugares.length})`, lugares + `<p class="muted" style="margin:10px 0 0;font-size:.84rem">${esc(p.tipoLugar)}. Las sedes se asignan según priorización y necesidad institucional.</p>`)}
        ${hab.length ? panel('bulb', 'Habilidades o competencias', chips(hab.map((h) => h.charAt(0).toUpperCase() + h.slice(1)))) : ''}`;
    }

    function tabFunciones(p) {
      return panel('list', `Funciones del puesto (${p.fn.length})`,
        `<ol class="fn-list">${p.fn.map((i) => `<li>${esc(funciones[i])}</li>`).join('')}</ol>`);
    }

    const TABS = { resumen: tabResumen, formacion: tabFormacion, experiencia: tabExperiencia, adicional: tabAdicional, funciones: tabFunciones };

    /* ---------- Estado del drawer ---------- */
    let dId = null;
    let dTab = 'resumen';
    let dContext = perfiles; // lista para navegación prev/next

    const dBody = $('#d-body');
    const dCode = $('#d-code');
    const dTitle = $('#d-title');
    const dOrg = $('#d-org');
    const dPrev = $('#d-prev');
    const dNext = $('#d-next');
    const dPos = $('#d-pos');

    function paintDetail() {
      const p = perfiles.find((x) => x.id === dId);
      if (!p) return;
      dCode.textContent = `Perfil N° ${p.id}-2026`;
      dTitle.textContent = p.puesto;
      dOrg.textContent = p.organo;
      $$('[data-tab]', dlg).forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === dTab)));
      dBody.innerHTML = TABS[dTab](p);
      dBody.scrollTop = 0;
      const idx = dContext.findIndex((x) => x.id === dId);
      if (dPrev) dPrev.disabled = idx <= 0;
      if (dNext) dNext.disabled = idx < 0 || idx >= dContext.length - 1;
      if (dPos) dPos.textContent = idx >= 0 && dContext.length > 1 ? `${idx + 1} de ${dContext.length}` : '';
    }

    function openDetail(id, context) {
      dId = String(id);
      if (context) dContext = context;
      dTab = 'resumen';
      paintDetail();
      if (!dlg.open) dlg.showModal();
    }

    /* ---------- Eventos del drawer ---------- */
    $$('[data-tab]', dlg).forEach((b) =>
      b.addEventListener('click', () => { dTab = b.dataset.tab; paintDetail(); })
    );
    $('.drawer__tabs', dlg).addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const tabs = $$('[data-tab]', dlg);
      const i = tabs.findIndex((t) => t.dataset.tab === dTab);
      const t = tabs[(i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
      dTab = t.dataset.tab;
      paintDetail();
      t.focus();
    });
    $('#d-close').addEventListener('click', () => dlg.close());
    if (dPrev) dPrev.addEventListener('click', () => {
      const idx = dContext.findIndex((x) => x.id === dId);
      if (idx > 0) { dId = dContext[idx - 1].id; paintDetail(); }
    });
    if (dNext) dNext.addEventListener('click', () => {
      const idx = dContext.findIndex((x) => x.id === dId);
      if (idx >= 0 && idx < dContext.length - 1) { dId = dContext[idx + 1].id; paintDetail(); }
    });
    dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });

    /* ---------- API pública ---------- */
    window.CPM_PERFIL_DRAWER = { open: openDetail };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
