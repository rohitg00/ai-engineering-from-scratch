(function () {
  var root = document.documentElement;
  var stored = '';
  try { stored = localStorage.getItem('theme') || ''; } catch (_) {}
  function prefers(query) { return !!(window.matchMedia && window.matchMedia(query).matches); }
  root.setAttribute('data-theme', stored || (prefers('(prefers-color-scheme: dark)') ? 'dark' : 'light'));
  if (!prefers('(prefers-reduced-motion: reduce)')) {
    root.classList.add('m-motion');
    setTimeout(function () { if (!root.hasAttribute('data-motion-ready')) root.classList.remove('m-motion'); }, 4000);
  }
  function icon() {
    var el = document.getElementById('themeIcon');
    if (el) el.textContent = root.getAttribute('data-theme') === 'light' ? 'N' : 'D';
  }
  document.addEventListener('DOMContentLoaded', function () {
    icon();
    var button = document.getElementById('themeToggle');
    if (!button) return;
    button.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('theme', next); } catch (_) {}
      icon();
    });
  });
})();
