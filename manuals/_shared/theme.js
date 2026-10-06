(function () {
  var root = document.documentElement;
  var stored = '';
  try { stored = localStorage.getItem('theme') || ''; } catch (_) {}
  var dark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  root.setAttribute('data-theme', stored || (dark ? 'dark' : 'light'));
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
