// Shared language picker in the reference-manual aesthetic: a mono blueprint
// button that opens a filterable panel of native language names. Reads the
// registry from window.AIFS_LANGS (site/langs.js). On a lesson page the host
// sets window.AIFS_onLangChange to re-render in the chosen language; on the
// home page selecting a language just stores the preference for later.
(function () {
  'use strict';
  var LANGS = Array.isArray(window.AIFS_LANGS) ? window.AIFS_LANGS : [{ code: 'en', native: 'English' }];
  var RTL = { ar: 1, he: 1, fa: 1, ur: 1 };

  function supported(code) {
    return !!code && code !== 'en' && LANGS.some(function (l) { return l.code === code; });
  }
  function current() {
    var q = new URLSearchParams(location.search).get('lang');
    if (supported(q)) return q;
    var saved = localStorage.getItem('lang');
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
    host.classList.add('lang-picker');
    host.innerHTML = '';

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'lang-picker-btn';
    btn.setAttribute('aria-haspopup', 'listbox');
    btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML = '<span class="lang-glyph" aria-hidden="true">A文</span>'
      + '<span class="lang-current"></span><span class="lang-caret" aria-hidden="true">▾</span>';
    host.appendChild(btn);

    var panel = document.createElement('div');
    panel.className = 'lang-panel';
    panel.setAttribute('role', 'listbox');
    panel.hidden = true;
    panel.innerHTML = '<div class="lang-panel-head">LANGUAGE</div>'
      + '<input class="lang-filter" type="text" placeholder="filter…" aria-label="Filter languages">'
      + '<div class="lang-list"></div>';
    host.appendChild(panel);

    var currentLabel = btn.querySelector('.lang-current');
    var filter = panel.querySelector('.lang-filter');
    var list = panel.querySelector('.lang-list');

    function renderList(q) {
      q = (q || '').toLowerCase();
      var cur = current();
      list.innerHTML = '';
      LANGS.forEach(function (l) {
        if (q && l.native.toLowerCase().indexOf(q) < 0 && l.code.toLowerCase().indexOf(q) < 0) return;
        var item = document.createElement('button');
        item.type = 'button';
        item.className = 'lang-item' + (l.code === cur ? ' is-current' : '');
        item.setAttribute('role', 'option');
        item.setAttribute('aria-selected', l.code === cur ? 'true' : 'false');
        item.dataset.code = l.code;
        item.innerHTML = '<span class="lang-tick" aria-hidden="true">'
          + (l.code === cur ? '•' : '') + '</span>'
          + '<span class="lang-native">' + l.native + '</span>'
          + '<span class="lang-code">' + l.code + '</span>';
        list.appendChild(item);
      });
    }

    function open() {
      renderList('');
      filter.value = '';
      panel.hidden = false;
      btn.setAttribute('aria-expanded', 'true');
      filter.focus();
    }
    function close() {
      panel.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
    }
    function toggle() { panel.hidden ? open() : close(); }

    function choose(code) {
      var lang = supported(code) ? code : 'en';
      var url = new URL(location.href);
      if (lang === 'en') { localStorage.removeItem('lang'); url.searchParams.delete('lang'); }
      else { localStorage.setItem('lang', lang); url.searchParams.set('lang', lang); }
      history.replaceState(null, '', url);
      applyDir(lang);
      currentLabel.textContent = nativeOf(lang);
      close();
      if (typeof window.AIFS_onLangChange === 'function') window.AIFS_onLangChange(lang);
    }

    btn.addEventListener('click', function (e) { e.stopPropagation(); toggle(); });
    filter.addEventListener('input', function () { renderList(filter.value); });
    list.addEventListener('click', function (e) {
      var item = e.target.closest('.lang-item');
      if (item) choose(item.dataset.code);
    });
    document.addEventListener('click', function (e) { if (!host.contains(e.target)) close(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });

    currentLabel.textContent = nativeOf(current());
    applyDir(current());
  }

  function init() {
    var host = document.getElementById('langPicker');
    if (host) mount(host);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
