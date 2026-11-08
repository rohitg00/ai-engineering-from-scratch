(function () {
  'use strict';

  function hasWord(list, word) {
    return (' ' + list + ' ').indexOf(' ' + word + ' ') >= 0;
  }

  function cardVisible(card, filters, visibleRows, totalRows) {
    var text = !filters.q || card.search.indexOf(filters.q) >= 0;
    var open = totalRows === 0 || !filters.q;
    if (filters.level) return visibleRows > 0;
    if (filters.role) return visibleRows > 0 || (hasWord(card.roles, filters.role) && text && open);
    return visibleRows > 0 || (text && open);
  }

  if (typeof module === 'object' && module.exports) module.exports = { cardVisible: cardVisible };
  if (typeof document === 'undefined') return;

  function store(key, value) {
    try {
      if (value === undefined) return sessionStorage.getItem(key) || '';
      sessionStorage.setItem(key, value);
    } catch (_) {
      return '';
    }
    return value;
  }

  function setupFilters(page) {
    var form = page.querySelector('[data-filters]');
    if (!form) return;
    var rows = Array.prototype.slice.call(page.querySelectorAll('[data-item]'));
    var cards = Array.prototype.slice.call(page.querySelectorAll('[data-card]'));
    var groups = Array.prototype.slice.call(page.querySelectorAll('[data-group-section]'));
    var count = page.querySelector('[data-count]');
    var empty = page.querySelector('[data-empty]');
    var params = new URLSearchParams(location.search);

    ['q', 'level', 'role'].forEach(function (name) {
      var value = params.get(name);
      if (value === null) return;
      var fields = form.querySelectorAll('[name="' + name + '"]');
      for (var i = 0; i < fields.length; i++) {
        if (fields[i].type === 'radio') fields[i].checked = fields[i].value === value;
        else fields[i].value = value;
      }
    });

    function value(name) {
      var field = form.querySelector('[name="' + name + '"]:checked') || form.querySelector('input[type="search"][name="' + name + '"]');
      return field ? field.value.trim().toLowerCase() : '';
    }

    function apply() {
      var q = value('q');
      var level = value('level');
      var role = value('role');
      var shown = 0;
      rows.forEach(function (row) {
        var ok = (!q || row.getAttribute('data-search').indexOf(q) >= 0)
          && (!level || row.getAttribute('data-level') === level)
          && (!role || hasWord(row.getAttribute('data-roles'), role));
        row.hidden = !ok;
        if (ok) shown += 1;
      });
      cards.forEach(function (card) {
        var id = card.getAttribute('data-card');
        var own = rows.filter(function (row) { return row.getAttribute('data-card-id') === id; });
        var shownRows = own.filter(function (row) { return !row.hidden; }).length;
        card.hidden = !cardVisible({ search: card.getAttribute('data-search'), roles: card.getAttribute('data-roles') }, { q: q, level: level, role: role }, shownRows, own.length);
      });
      groups.forEach(function (group) {
        group.hidden = !group.querySelector('[data-card]:not([hidden])');
      });
      if (count) {
        var cardsShown = cards.filter(function (card) { return !card.hidden; }).length;
        count.textContent = shown + (shown === 1 ? ' item' : ' items') + (cards.length ? ' in ' + cardsShown + (cardsShown === 1 ? ' card' : ' cards') : '');
      }
      if (empty) empty.hidden = shown > 0;
      var next = new URLSearchParams();
      if (q) next.set('q', q);
      if (level) next.set('level', level);
      if (role) next.set('role', role);
      var query = next.toString();
      history.replaceState(null, '', location.pathname + (query ? '?' + query : '') + location.hash);
    }

    form.addEventListener('input', apply);
    form.addEventListener('change', apply);
    apply();
  }

  function setupEvidence(page) {
    var box = page.querySelector('[data-evidence]');
    if (!box) return;
    var steps = Array.prototype.slice.call(box.querySelectorAll('[data-step]'));
    var controls = box.querySelector('[data-ev-controls]');
    if (!controls || steps.length < 2) return;
    var next = controls.querySelector('[data-ev-next]');
    var all = controls.querySelector('[data-ev-all]');
    var key = 'interviews:evidence:' + location.pathname;
    var open = Math.max(1, Math.min(steps.length, parseInt(store(key), 10) || 1));

    function render(focus) {
      steps.forEach(function (step, index) {
        step.hidden = index >= open;
      });
      controls.hidden = open >= steps.length;
      next.textContent = 'Show evidence ' + (open + 1) + ' of ' + steps.length;
      store(key, String(open));
      if (focus) {
        var heading = steps[open - 1].querySelector('h3');
        if (heading) {
          heading.setAttribute('tabindex', '-1');
          heading.focus();
        }
      }
    }

    next.addEventListener('click', function () {
      open = Math.min(steps.length, open + 1);
      render(true);
    });
    all.addEventListener('click', function () {
      open = steps.length;
      render(false);
    });
    render(false);
  }

  function start() {
    var page = document.querySelector('.iv-page');
    if (!page) return;
    setupFilters(page);
    setupEvidence(page);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
}());
