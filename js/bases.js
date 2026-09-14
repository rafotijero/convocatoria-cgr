/* Página de bases: cuenta regresiva, estado del cronograma e índice activo. */
(function () {
  'use strict';

  /* ---------- Cuenta regresiva al cierre de inscripción ---------- */
  var CIERRE = new Date('2026-09-25T17:30:00-05:00');
  var cd = document.getElementById('countdown');
  var cdEstado = document.getElementById('countdown-status');

  function pad(n) { return String(n).padStart(2, '0'); }

  function tick() {
    if (!cd) return;
    var ms = CIERRE - new Date();
    if (ms <= 0) {
      cd.hidden = true;
      if (cdEstado) cdEstado.textContent = 'La inscripción virtual ya cerró.';
      return;
    }
    var s = Math.floor(ms / 1000);
    var partes = { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
    Object.keys(partes).forEach(function (k) {
      var el = cd.querySelector('[data-unit="' + k + '"]');
      if (el) el.textContent = k === 'd' ? partes[k] : pad(partes[k]);
    });
  }
  tick();
  setInterval(tick, 1000);

  /* ---------- Etapa actual del cronograma ---------- */
  var hoy = new Date();
  document.querySelectorAll('.timeline > li[data-start]').forEach(function (li) {
    var ini = new Date(li.dataset.start + 'T00:00:00-05:00');
    var fin = new Date(li.dataset.end + 'T23:59:59-05:00');
    if (hoy > fin) li.classList.add('is-done');
    else if (hoy >= ini) {
      li.classList.add('is-current');
      var t = li.querySelector('.timeline__title');
      if (t) t.insertAdjacentHTML('beforeend', '<span class="tag tag--accent">En curso</span>');
    }
  });

  /* ---------- Índice: resaltar sección visible ---------- */
  var links = Array.prototype.slice.call(document.querySelectorAll('.toc a[href^="#"]'));
  var porId = {};
  links.forEach(function (a) { porId[a.getAttribute('href').slice(1)] = a; });

  function activar(id) {
    links.forEach(function (a) { a.classList.remove('is-active'); });
    var a = porId[id];
    if (!a) return;
    a.classList.add('is-active');
    if (window.matchMedia('(max-width: 960px)').matches) {
      a.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
    }
  }

  if ('IntersectionObserver' in window) {
    var visibles = new Map();
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { visibles.set(e.target.id, e.isIntersecting ? e.boundingClientRect.top : null); });
      var mejor = null;
      visibles.forEach(function (top, id) {
        if (top !== null && (mejor === null || top < visibles.get(mejor))) mejor = id;
      });
      if (mejor) activar(mejor);
    }, { rootMargin: '-80px 0px -60% 0px' });
    Object.keys(porId).forEach(function (id) {
      var sec = document.getElementById(id);
      if (sec) obs.observe(sec);
    });
  }
})();
