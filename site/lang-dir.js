// Paint the selected language direction before the page body is parsed.
// lang-picker.js owns the interactive control; this tiny synchronous bootstrap
// prevents an RTL page from flashing in the default LTR layout first.
(function () {
  'use strict';

  var RTL = { ar: 1, fa: 1, he: 1, ur: 1 };
  /*
   * Optional per-language font configuration. Add another language key here
   * when its translation needs a webfont; the loader and CSS stay generic.
   * `body` and `heading` are CSS font-family values, not font names only.
   */
  var LANGUAGE_FONTS = {
    fa: {
      href: 'https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;500;600;700&display=swap',
      body: "'Vazirmatn', 'Source Serif 4', 'Source Serif Pro', Georgia, serif",
      heading: "'Vazirmatn', 'Source Serif 4', Georgia, serif"
    }
  };

  function base(code) {
    return String(code || 'en').toLowerCase().split('-')[0];
  }

  // This file runs before langs.js, so the registry is not available to reject
  // an unknown language here. Accept only a language-tag shape: an arbitrary
  // string would land in documentElement.lang, which screen readers read for
  // pronunciation, and would let any value paint a direction that
  // lang-picker.js then reverses — the exact flash this bootstrap prevents.
  var TAG = /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/;

  function choice() {
    try {
      var query = new URLSearchParams(window.location.search).get('lang');
      if (query && TAG.test(query)) return query;
    } catch (_) {}
    try {
      var saved = window.localStorage.getItem('lang');
      if (saved && TAG.test(saved)) return saved;
    } catch (_) {}
    return 'en';
  }

  function ensureLanguageFont(code) {
    var lang = base(code);
    var config = LANGUAGE_FONTS[lang] || null;
    var root = document.documentElement;
    var existing = document.querySelector('link[data-aifs-language-font]');

    if (!config) {
      if (existing) existing.remove();
      root.style.removeProperty('--font-body');
      root.style.removeProperty('--font-heading');
      root.removeAttribute('data-font');
      return;
    }

    if (!existing || existing.getAttribute('data-language') !== lang) {
      if (existing) existing.remove();
      if (document.head && config.href) {
        existing = document.createElement('link');
        existing.rel = 'stylesheet';
        existing.href = config.href;
        existing.setAttribute('data-aifs-language-font', '');
        existing.setAttribute('data-language', lang);
        document.head.appendChild(existing);
      }
    }

    if (config.body) root.style.setProperty('--font-body', config.body);
    else root.style.removeProperty('--font-body');
    if (config.heading) root.style.setProperty('--font-heading', config.heading);
    else root.style.removeProperty('--font-heading');
    root.setAttribute('data-font', 'custom');
  }

  function apply(code) {
    var lang = code || 'en';
    var root = document.documentElement;
    root.setAttribute('lang', lang);
    root.setAttribute('dir', RTL[base(lang)] ? 'rtl' : 'ltr');
    root.setAttribute('data-lang', base(lang));
  }

  window.AIFS_applyLangDirEarly = apply;
  window.AIFS_ensureLanguageFont = ensureLanguageFont;
  var initialLang = choice();
  apply(initialLang);
  ensureLanguageFont(initialLang);
}());
