(function () {
  'use strict';

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
          && (!role || (' ' + row.getAttribute('data-roles') + ' ').indexOf(' ' + role + ' ') >= 0);
        row.hidden = !ok;
        if (ok) shown += 1;
      });
      cards.forEach(function (card) {
        var id = card.getAttribute('data-card');
        var hasItem = rows.some(function (row) {
          return row.getAttribute('data-card-id') === id
            && (!level || row.getAttribute('data-level') === level)
            && (!role || (' ' + row.getAttribute('data-roles') + ' ').indexOf(' ' + role + ' ') >= 0);
        });
        var listed = !role || (' ' + card.getAttribute('data-roles') + ' ').indexOf(' ' + role + ' ') >= 0;
        var ok = (!q || card.getAttribute('data-search').indexOf(q) >= 0)
          && (level ? hasItem : (listed || hasItem));
        card.hidden = !ok;
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

  function setupCopy() {
    document.addEventListener('click', function (event) {
      var button = event.target.closest && event.target.closest('[data-copy]');
      if (!button) return;
      var block = button.closest('.iv-code');
      var code = block && block.querySelector('code');
      if (!code || !navigator.clipboard) return;
      navigator.clipboard.writeText(code.textContent).then(function () {
        button.textContent = 'Copied';
        setTimeout(function () { button.textContent = 'Copy'; }, 1400);
      }, function () {
        button.textContent = 'Select and copy';
      });
    });
  }

  function start() {
    var page = document.querySelector('.iv-page');
    if (!page) return;
    setupFilters(page);
    setupEvidence(page);
    setupCopy();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
}());
