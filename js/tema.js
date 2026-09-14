/* Tema claro / oscuro compartido. Se carga en <head> para evitar parpadeo. */
(function () {
  var KEY = 'cpm05-tema';
  var root = document.documentElement;

  function leer() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }
  function guardar(v) {
    try { localStorage.setItem(KEY, v); } catch (e) { /* sin almacenamiento */ }
  }
  function esOscuro() {
    var t = root.getAttribute('data-theme');
    if (t) return t === 'dark';
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  var inicial = leer();
  if (inicial === 'dark' || inicial === 'light') root.setAttribute('data-theme', inicial);

  var SOL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
  var LUNA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';

  function pintar(btn) {
    var oscuro = esOscuro();
    btn.innerHTML = oscuro ? SOL : LUNA;
    btn.setAttribute('aria-label', oscuro ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro');
    btn.title = btn.getAttribute('aria-label');
  }

  document.addEventListener('DOMContentLoaded', function () {
    var btn = document.getElementById('theme-toggle');
    if (!btn) return;
    pintar(btn);
    btn.addEventListener('click', function () {
      var nuevo = esOscuro() ? 'light' : 'dark';
      root.setAttribute('data-theme', nuevo);
      guardar(nuevo);
      pintar(btn);
    });
    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () { pintar(btn); });
    }
  });
})();
