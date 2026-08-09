// Shared language picker in the reference-manual aesthetic: a mono blueprint
// button that opens a filterable panel of native language names. Reads the
// registry from window.AIFS_LANGS (site/langs.js). On a lesson page the host
// sets window.AIFS_onLangChange to re-render in the chosen language; on the
// home page selecting a language just stores the preference for later.
(function () {
  'use strict';
  var LANGS = Array.isArray(window.AIFS_LANGS) ? window.AIFS_LANGS : [{ code: 'en', native: 'English' }];
  var RTL = { ar: 1, he: 1, fa: 1, ur: 1 };
  var pickerId = 0;

  function isCertificationLesson() {
    try {
      var path = new URLSearchParams(location.search).get('path') || '';
      return path.indexOf('certifications/claude/lessons/') === 0;
    } catch (_) {
      return false;
    }
  }

  function supported(code) {
    return !!code && code !== 'en' && LANGS.some(function (l) { return l.code === code; });
  }
  function current() {
    if (isCertificationLesson()) return 'en';
    var q = new URLSearchParams(location.search).get('lang');
    if (supported(q)) return q;
    var saved = '';
    try { saved = localStorage.getItem('lang') || ''; } catch (_) {}
    return supported(saved) ? saved : 'en';
  }
  function nativeOf(code) {
    for (var i = 0; i < LANGS.length; i++) if (LANGS[i].code === code) return LANGS[i].native;
    return 'English';
  }
  function applyDir(code) {
    document.documentElement.lang = code;
    document.documentElement.dir = RTL[code] ? 'rtl' : 'ltr';
  }
  window.AIFS_currentLang = current;
  window.AIFS_applyLangDir = applyDir;

  function mount(host) {
    pickerId += 1;
    var id = 'languagePicker' + pickerId;
    host.classList.add('lang-picker');
    host.innerHTML = '';

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'lang-picker-btn';
    btn.setAttribute('aria-haspopup', 'dialog');
    btn.setAttribute('aria-controls', id + 'Panel');
    btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML = '<span class="lang-glyph" aria-hidden="true">A文</span>'
      + '<span class="lang-current"></span><span class="lang-caret" aria-hidden="true">▾</span>';
    host.appendChild(btn);

    var panel = document.createElement('div');
    panel.id = id + 'Panel';
    panel.className = 'lang-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-labelledby', id + 'Title');
    panel.hidden = true;
    panel.innerHTML = '<div class="lang-panel-head" id="' + id + 'Title">LANGUAGE</div>'
      + '<input class="lang-filter" type="text" placeholder="filter…" aria-label="Filter languages"'
      + ' role="combobox" aria-autocomplete="list" aria-expanded="false"'
      + ' aria-controls="' + id + 'List">'
      + '<div class="lang-list" id="' + id + 'List" role="listbox" aria-label="Languages"></div>';
    host.appendChild(panel);

    var currentLabel = btn.querySelector('.lang-current');
    var filter = panel.querySelector('.lang-filter');
    var list = panel.querySelector('.lang-list');

    function updateButton() {
      var label = nativeOf(current());
      currentLabel.textContent = label;
      btn.setAttribute('aria-label', 'Choose language. Current language: ' + label);
    }

    function renderList(q) {
      q = (q || '').toLowerCase();
      var cur = current();
      list.innerHTML = '';
      LANGS.forEach(function (l) {
        if (q && l.native.toLowerCase().indexOf(q) < 0 && l.code.toLowerCase().indexOf(q) < 0) return;
        var item = document.createElement('button');
        item.type = 'button';
        item.className = 'lang-item' + (l.code === cur ? ' is-current' : '');
        item.id = id + 'Option-' + l.code;
        item.setAttribute('role', 'option');
        item.setAttribute('aria-selected', l.code === cur ? 'true' : 'false');
        item.tabIndex = -1;
        item.dataset.code = l.code;
        item.innerHTML = '<span class="lang-tick" aria-hidden="true">'
          + (l.code === cur ? '•' : '') + '</span>'
          + '<span class="lang-native">' + l.native + '</span>'
          + '<span class="lang-code">' + l.code + '</span>';
        list.appendChild(item);
      });
    }

    function options() {
      return list.querySelectorAll('.lang-item');
    }

    function focusOption(index) {
      var items = options();
      if (!items.length) return;
      items[Math.max(0, Math.min(index, items.length - 1))].focus();
    }

    function open(optionIndex) {
      renderList('');
      filter.value = '';
      panel.hidden = false;
      btn.setAttribute('aria-expanded', 'true');
      filter.setAttribute('aria-expanded', 'true');
      if (typeof optionIndex === 'number') focusOption(optionIndex < 0 ? options().length - 1 : optionIndex);
      else filter.focus();
    }

    function close(returnFocus) {
      panel.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
      filter.setAttribute('aria-expanded', 'false');
      if (returnFocus) btn.focus();
    }
    function toggle() { panel.hidden ? open() : close(false); }

    function choose(code) {
      var lang = supported(code) ? code : 'en';
      var url = new URL(location.href);
      if (lang === 'en') {
        try { localStorage.removeItem('lang'); } catch (_) {}
        url.searchParams.delete('lang');
      } else {
        try { localStorage.setItem('lang', lang); } catch (_) {}
        url.searchParams.set('lang', lang);
      }
      history.replaceState(null, '', url);
      applyDir(lang);
      updateButton();
      close(true);
      if (typeof window.AIFS_onLangChange === 'function') window.AIFS_onLangChange(lang);
    }

    btn.addEventListener('click', function (e) { e.stopPropagation(); toggle(); });
    btn.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      e.preventDefault();
      e.stopPropagation();
      open(e.key === 'ArrowUp' ? -1 : 0);
    });
    filter.addEventListener('input', function () { renderList(filter.value); });
    filter.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        close(true);
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        focusOption(e.key === 'ArrowUp' ? options().length - 1 : 0);
      }
    });
    list.addEventListener('keydown', function (e) {
      var item = e.target.closest('.lang-item');
      if (!item) return;
      var items = Array.prototype.slice.call(options());
      var index = items.indexOf(item);
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        close(true);
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Home' || e.key === 'End') {
        e.preventDefault();
        var next = index;
        if (e.key === 'ArrowDown') next = (index + 1) % items.length;
        if (e.key === 'ArrowUp') next = (index - 1 + items.length) % items.length;
        if (e.key === 'Home') next = 0;
        if (e.key === 'End') next = items.length - 1;
        focusOption(next);
      }
    });
    list.addEventListener('click', function (e) {
      var item = e.target.closest('.lang-item');
      if (item) choose(item.dataset.code);
    });
    document.addEventListener('click', function (e) { if (!host.contains(e.target)) close(false); });
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape' || panel.hidden || e.defaultPrevented) return;
      e.preventDefault();
      e.stopPropagation();
      close(true);
    });

    updateButton();
    applyDir(current());
  }

  function init() {
    var host = document.getElementById('langPicker');
    if (isCertificationLesson()) {
      applyDir('en');
      if (host) host.hidden = true;
      return;
    }
    if (host) mount(host);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
