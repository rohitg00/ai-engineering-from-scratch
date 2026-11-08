(function () {
  'use strict';

  var root = document.documentElement;
  var stored = '';
  try { stored = localStorage.getItem('theme') || ''; } catch (_) {}
  var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  var theme = prefersDark ? 'dark' : 'light';
  if (stored === 'dark' || stored === 'light') theme = stored;
  root.setAttribute('data-theme', theme);
  root.setAttribute('data-writing-ready', '');

  function init() {
    var themeButton = document.getElementById('themeToggle');
    var themeIcon = document.getElementById('themeIcon');
    function updateThemeButton() {
      var light = root.getAttribute('data-theme') === 'light';
      if (themeIcon) themeIcon.textContent = light ? 'N' : 'D';
      if (themeButton) themeButton.setAttribute('aria-label', light ? 'Switch to dark theme' : 'Switch to light theme');
    }
    updateThemeButton();
    if (themeButton) themeButton.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('theme', next); } catch (_) {}
      updateThemeButton();
    });

    var cards = Array.prototype.slice.call(document.querySelectorAll('#portfolio-content .writing-card'));
    if (!cards.length) return;
    var controls = document.getElementById('writing-controls');
    var search = document.getElementById('writing-search');
    search.value = new URLSearchParams(window.location.search).get('search') || '';
    var count = document.getElementById('writing-count');
    var empty = document.getElementById('writing-empty');
    var reset = document.getElementById('writing-reset');
    var buttons = Array.prototype.slice.call(document.querySelectorAll('[data-writing-filter]'));
    var kind = 'all';
    var entries = cards.map(function (card) {
      return { card: card, kind: card.getAttribute('data-kind'), text: card.textContent.toLowerCase() };
    });

    function filter() {
      var terms = search.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
      var visible = 0;
      entries.forEach(function (entry) {
        var matches = (kind === 'all' || entry.kind === kind) && terms.every(function (term) {
          return entry.text.indexOf(term) !== -1;
        });
        entry.card.hidden = !matches;
        if (matches) visible += 1;
      });
      buttons.forEach(function (button) {
        button.setAttribute('aria-pressed', button.getAttribute('data-writing-filter') === kind ? 'true' : 'false');
      });
      count.textContent = visible + ' of ' + cards.length + ' articles and guides';
      empty.hidden = visible !== 0;
    }

    buttons.forEach(function (button) {
      button.addEventListener('click', function () {
        kind = button.getAttribute('data-writing-filter');
        filter();
      });
    });
    search.addEventListener('input', filter);
    reset.addEventListener('click', function () {
      kind = 'all';
      search.value = '';
      filter();
      search.focus();
    });
    controls.hidden = false;
    filter();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
