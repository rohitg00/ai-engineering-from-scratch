/* Shared header chrome strings (nav links, search, theme toggle) for every
 * page. The landing catalog in site/landing-i18n.js owns page content only and
 * delegates these keys here, so the header is localized on the lesson, catalog,
 * glossary, prereqs and about pages too — not just on the landing page.
 *
 * Markup contract, the same attributes site/landing-i18n.js reads:
 *   data-i18n="nav.catalog"        text content
 *   data-i18n-aria="header.search" aria-label
 *   data-i18n-title="header.search" title
 * A key this catalog does not own is left untouched, so a page may mix these
 * attributes with its own locale file.
 */
(function () {
  'use strict';

  var LOCALES = {
    fa: {
      'nav.contents': 'محتوا',
      'nav.books': 'کتاب‌ها',
      'nav.catalog': 'فهرست',
      'nav.roadmap': 'نقشه‌راه',
      'nav.glossary': 'واژه‌نامه',
      'nav.about': 'درباره',
      'header.search': 'جست‌وجو (⌘K)',
      'header.theme': 'تغییر پوسته',
      'palette.aria': 'جست‌وجوی درس‌ها و واژه‌نامه',
      'palette.placeholder': 'جست‌وجوی درس‌ها و واژه‌نامه…',
      'palette.input_aria': 'جست‌وجو',
      'palette.results_aria': 'نتایج جست‌وجو',
      'palette.navigate': 'جابه‌جایی',
      'palette.open': 'بازکردن',
      'palette.close': 'بستن',
      'palette.hint': 'برای جست‌وجو در درس‌ها، خروجی‌ها و واژه‌نامه تایپ کنید',
      'palette.no_results': 'نتیجه‌ای برای'
    }
  };

  // Keys this catalog owns in any language. English has no entries — it restores
  // the markup's own text — so the set cannot come from the active locale alone.
  var KEYS = {};
  Object.keys(LOCALES).forEach(function (lang) {
    Object.keys(LOCALES[lang]).forEach(function (key) { KEYS[key] = true; });
  });

  function own(obj, key) {
    return Object.prototype.hasOwnProperty.call(obj, key);
  }

  function base(code) {
    return String(code || 'en').toLowerCase().split('-')[0];
  }

  function locale() {
    var root = document.documentElement;
    return base(root.getAttribute('lang') || root.getAttribute('data-lang') || 'en');
  }

  function text(key, fallback) {
    var strings = LOCALES[locale()] || {};
    return own(strings, key) ? strings[key] : fallback;
  }

  // The English source text lives in the markup, so remember it once and reuse
  // it as the fallback: switching back to English restores it exactly.
  function remembered(el, attr, store, read) {
    if (!el.hasAttribute(store)) el.setAttribute(store, read());
    return el.getAttribute(store);
  }

  function applyAttr(selector, keyAttr, store, read, write) {
    document.querySelectorAll(selector).forEach(function (el) {
      var key = el.getAttribute(keyAttr);
      if (!own(KEYS, key)) return;
      write(el, text(key, remembered(el, keyAttr, store, function () { return read(el); })));
    });
  }

  function apply() {
    applyAttr('[data-i18n]', 'data-i18n', 'data-i18n-chrome-default',
      function (el) { return el.textContent; },
      function (el, value) { el.textContent = value; });
    applyAttr('[data-i18n-aria]', 'data-i18n-aria', 'data-i18n-chrome-aria',
      function (el) { return el.getAttribute('aria-label') || ''; },
      function (el, value) { el.setAttribute('aria-label', value); });
    applyAttr('[data-i18n-title]', 'data-i18n-title', 'data-i18n-chrome-title',
      function (el) { return el.getAttribute('title') || ''; },
      function (el, value) { el.setAttribute('title', value); });
  }

  window.AIFS_chromeText = text;
  // A page-level catalog must not also write these elements: it would remember
  // an already-localized string as the English default and then restore that.
  window.AIFS_chromeOwns = function (key) { return own(KEYS, key); };
  window.AIFS_applyChrome = apply;
  // lang-picker.js emits this on every change; a page-level locale file keeps
  // its own window.AIFS_onLangChange hook, so both run without one overwriting
  // the other.
  document.addEventListener('aifs:langchange', apply);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', apply);
  } else {
    apply();
  }
}());
