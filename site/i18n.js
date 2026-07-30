/* i18n.js — translation layer for the site.
 *
 * Dictionaries map an English source string to its translation, so the pages
 * stay untouched: no data-i18n attributes to maintain, no keys to invent, and
 * a missing entry degrades to readable English instead of a bare key. The same
 * pass covers content the other scripts render from data.js — phase cards,
 * catalog rows, glossary entries — because it watches the DOM rather than
 * hooking each renderer.
 *
 * Language resolution: ?lang= (shareable) > localStorage > navigator.language.
 * Load order: dictionary first, then this file, at the end of <body> so the
 * static DOM is already parsed and translates before paint.
 */
(function () {
  'use strict';

  var STORE_KEY = 'lang';
  var DEFAULT = 'en';
  // lang -> the global its dictionary is published on.
  var DICTS = { 'zh-Hant': 'I18N_ZH_HANT' };

  // Code and vector text is never prose. Rejected with the whole subtree.
  // Kept as both a set and a selector: membership must be exact, or tags like
  // <p> and <a> match as substrings of "pre" and "textarea".
  var SKIP_TAGS = { SCRIPT: 1, STYLE: 1, PRE: 1, CODE: 1, TEXTAREA: 1, NOSCRIPT: 1, SVG: 1 };
  var SKIP_SEL = 'script,style,pre,code,textarea,noscript,svg';
  var ATTRS = ['placeholder', 'aria-label', 'title', 'alt', 'content'];

  function normalize(v) {
    return /^zh/i.test(String(v || '')) ? 'zh-Hant' : DEFAULT;
  }

  function resolveLang() {
    var q = null;
    try { q = new URLSearchParams(location.search).get('lang'); } catch (e) {}
    if (q) {
      q = normalize(q);
      try { localStorage.setItem(STORE_KEY, q); } catch (e) {}
      return q;
    }
    try {
      var saved = localStorage.getItem(STORE_KEY);
      if (saved) return normalize(saved);
    } catch (e) {}
    return normalize(navigator.language);
  }

  var lang = resolveLang();
  var dict = (lang !== DEFAULT && window[DICTS[lang]]) || null;

  if (lang !== DEFAULT) document.documentElement.setAttribute('lang', lang);

  // ── Lookup ─────────────────────────────────────────────────────────
  // Source strings are matched with their whitespace collapsed, so the same
  // entry works whether the HTML wrapped the line or not.
  function translate(s) {
    if (!dict || !s) return null;
    var key = s.replace(/\s+/g, ' ').trim();
    return (key && dict[key]) || null;
  }

  function skipped(node) {
    var el = node.nodeType === 1 ? node : node.parentNode;
    return !!(el && el.nodeType === 1 && el.closest && el.closest(SKIP_SEL));
  }

  // Full-width punctuation carries its own spacing, so an inherited Latin
  // space either side of it reads as a typo in Chinese.
  var HUGS_LEFT = /^[，。、；：！？）】》」』…·]/;
  var HUGS_RIGHT = /[（【《「『]$/;

  function translateText(node) {
    var raw = node.nodeValue;
    if (!raw || !/\S/.test(raw) || skipped(node)) return;
    // Keep the surrounding whitespace: it carries inline spacing between
    // a text node and its neighbouring elements.
    var m = /^(\s*)([\s\S]*?)(\s*)$/.exec(raw);
    var hit = translate(m[2]);
    if (!hit) return;
    var next = (HUGS_LEFT.test(hit) ? '' : m[1]) + hit +
               (HUGS_RIGHT.test(hit) ? '' : m[3]);
    // Writing an identical value still queues a mutation record, which the
    // observer would translate again — an endless loop for any term that is
    // the same in both languages ("PPO", "StyleGAN"). Only write real changes.
    if (next !== raw) node.nodeValue = next;
  }

  function translateAttrs(el, only) {
    var list = only ? [only] : ATTRS;
    for (var i = 0; i < list.length; i++) {
      var v = el.getAttribute && el.getAttribute(list[i]);
      var hit = v && translate(v);
      if (hit && hit !== v) el.setAttribute(list[i], hit);
    }
  }

  function walk(root) {
    if (!dict || !root) return;
    if (root.nodeType === 3) return translateText(root);
    if (root.nodeType !== 1 && root.nodeType !== 9 && root.nodeType !== 11) return;
    if (root.nodeType === 1) {
      if (root.closest && root.closest(SKIP_SEL)) return;
      translateAttrs(root);
    }
    var walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
      {
        acceptNode: function (n) {
          if (n.nodeType === 1) {
            return SKIP_TAGS[n.tagName.toUpperCase()]
              ? NodeFilter.FILTER_REJECT
              : NodeFilter.FILTER_ACCEPT;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );
    var n;
    while ((n = walker.nextNode())) {
      if (n.nodeType === 1) translateAttrs(n);
      else translateText(n);
    }
  }

  // ── Apply, then keep applying ───────────────────────────────────────
  var applying = false;

  function apply(root) {
    if (!dict || applying) return;
    applying = true;
    try { walk(root || document.documentElement); } finally { applying = false; }
  }

  function observe() {
    if (!dict || typeof MutationObserver !== 'function') return;
    new MutationObserver(function (records) {
      if (applying) return;
      applying = true;
      try {
        for (var i = 0; i < records.length; i++) {
          var r = records[i];
          if (r.type === 'childList') {
            for (var j = 0; j < r.addedNodes.length; j++) walk(r.addedNodes[j]);
          } else if (r.type === 'characterData') {
            translateText(r.target);
          } else if (r.type === 'attributes') {
            translateAttrs(r.target, r.attributeName);
          }
        }
      } finally { applying = false; }
    }).observe(document.documentElement, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ATTRS
    });
  }

  // ── Toggle ─────────────────────────────────────────────────────────
  // Injected next to the theme toggle, which every page already has, so no
  // page markup changes to add a language.
  function setLang(next) {
    try { localStorage.setItem(STORE_KEY, next); } catch (e) {}
    try {
      var url = new URL(location.href);
      url.searchParams.set('lang', next === 'en' ? 'en' : 'zh');
      location.replace(url.toString());
    } catch (e) {
      location.reload();
    }
  }

  function mountToggle() {
    var anchor = document.getElementById('themeToggle');
    if (!anchor || document.getElementById('langToggle')) return;
    var zh = lang !== DEFAULT;
    var btn = document.createElement('button');
    btn.id = 'langToggle';
    btn.type = 'button';
    btn.className = anchor.className;
    btn.textContent = zh ? 'EN' : '中';
    btn.setAttribute('lang', zh ? 'en' : 'zh-Hant');
    btn.setAttribute('title', zh ? 'Switch to English' : '切換為繁體中文');
    btn.setAttribute('aria-label', btn.getAttribute('title'));
    btn.addEventListener('click', function () { setLang(zh ? 'en' : 'zh-Hant'); });
    anchor.parentNode.insertBefore(btn, anchor);
  }

  apply();
  observe();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { apply(); mountToggle(); });
  } else {
    mountToggle();
  }

  window.I18N = { lang: lang, t: function (s) { return translate(s) || s; }, apply: apply, set: setLang };
})();
