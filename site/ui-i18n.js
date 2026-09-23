(function (root) {
  'use strict';

  var TRANSLATIONS_BASE = 'https://raw.githubusercontent.com/rohitg00/ai-engineering-from-scratch/translations/i18n/';
  var ATTRS = ['aria-label', 'title', 'placeholder'];
  var SKIP_TAGS = { SCRIPT: 1, STYLE: 1, CODE: 1, PRE: 1, KBD: 1, SAMP: 1, TEXTAREA: 1, NOSCRIPT: 1, svg: 1, SVG: 1, MATH: 1 };
  var SKIP_SELECTOR = '.lang-picker, .mermaid-render, .mermaid-modal-body, .quiz-question-text, .quiz-option-text, .quiz-explanation, .nav-title, .sidebar-lesson-link, .toc-nav, [data-i18n-skip]';
  var ARTICLE_SELECTOR = '.lesson-article';
  var ARTICLE_ALLOW_SELECTOR = '.lesson-action-panel, .lesson-action-path, .ai-panels, .quiz-section, .lesson-nav-bottom, .continue-callout, .cert-notice';
  var RTL = { ar: 1, he: 1, fa: 1, ur: 1 };

  var records = typeof WeakMap === 'function' ? new WeakMap() : null;
  var dictionaries = {};
  var pending = {};
  var active = 'en';
  var touched = false;
  var request = 0;
  var observer = null;

  function preload(lang, dict) {
    var table = dict && typeof dict === 'object' && dict.strings && typeof dict.strings === 'object' ? dict.strings : dict;
    if (table && typeof table === 'object') dictionaries[lang] = table;
    else delete dictionaries[lang];
  }

  function dictionaryFor(lang) {
    if (!lang || lang === 'en') return null;
    var dict = dictionaries[lang];
    return dict && typeof dict === 'object' ? dict : null;
  }

  function loadDictionary(lang, done) {
    if (!lang || lang === 'en' || Object.prototype.hasOwnProperty.call(dictionaries, lang)) {
      done(dictionaryFor(lang));
      return;
    }
    if (pending[lang]) {
      pending[lang].push(done);
      return;
    }
    pending[lang] = [done];
    root.fetch(TRANSLATIONS_BASE + encodeURIComponent(lang) + '/ui.json')
      .then(function (response) {
        if (!response.ok) throw new Error('missing');
        return response.json();
      })
      .then(function (json) { preload(lang, json); }, function () {})
      .then(function () {
        var callbacks = pending[lang] || [];
        delete pending[lang];
        for (var i = 0; i < callbacks.length; i++) callbacks[i](dictionaryFor(lang));
      });
  }

  function translateText(text, dict) {
    if (!dict) return text;
    var source = String(text);
    var lead = source.match(/^\s*/)[0];
    var core = source.slice(lead.length);
    var trail = core.match(/\s*$/)[0];
    core = core.slice(0, core.length - trail.length);
    if (!core) return source;
    var key = core.replace(/\s+/g, ' ');
    if (!Object.prototype.hasOwnProperty.call(dict, key)) return source;
    return lead + dict[key] + trail;
  }

  function matches(el, selector) {
    return !!(el && el.nodeType === 1 && typeof el.matches === 'function' && el.matches(selector));
  }

  function eligible(el) {
    var inArticle = false;
    var allowedInside = false;
    for (var node = el; node && node.nodeType === 1; node = node.parentNode) {
      if (SKIP_TAGS[node.nodeName] || matches(node, SKIP_SELECTOR)) return false;
      if (matches(node, ARTICLE_ALLOW_SELECTOR)) allowedInside = true;
      if (matches(node, ARTICLE_SELECTOR)) inArticle = true;
    }
    return !inArticle || allowedInside;
  }

  function record(node) {
    if (!records) return null;
    var rec = records.get(node);
    if (!rec) {
      rec = { text: null, attrs: {} };
      records.set(node, rec);
    }
    return rec;
  }

  function applyText(node, dict) {
    var rec = record(node);
    if (!rec) return;
    var current = node.nodeValue;
    if (!rec.text || current !== rec.text.out) rec.text = { orig: current, out: current };
    var out = dict ? translateText(rec.text.orig, dict) : rec.text.orig;
    if (out !== current) node.nodeValue = out;
    rec.text.out = out;
  }

  function applyAttr(el, name, dict) {
    if (!el.hasAttribute(name)) return;
    var rec = record(el);
    if (!rec) return;
    var current = el.getAttribute(name);
    var slot = rec.attrs[name];
    if (!slot || current !== slot.out) slot = rec.attrs[name] = { orig: current, out: current };
    var out = dict ? translateText(slot.orig, dict) : slot.orig;
    if (out !== current) el.setAttribute(name, out);
    slot.out = out;
  }

  function applyElement(el, dict) {
    if (!eligible(el)) return;
    for (var i = 0; i < ATTRS.length; i++) applyAttr(el, ATTRS[i], dict);
  }

  function applyNode(node, dict) {
    if (node.nodeType === 3) {
      if (eligible(node.parentNode)) applyText(node, dict);
    } else if (node.nodeType === 1) {
      applyElement(node, dict);
    }
  }

  function applyTree(rootNode, dict) {
    if (!rootNode) return;
    applyNode(rootNode, dict);
    if (rootNode.nodeType !== 1 && rootNode.nodeType !== 9 && rootNode.nodeType !== 11) return;
    var doc = rootNode.ownerDocument || rootNode;
    var walker = doc.createTreeWalker(rootNode, 5, null, false);
    var node;
    while ((node = walker.nextNode())) applyNode(node, dict);
  }

  function applyDir(lang) {
    if (typeof root.AIFS_applyLangDir === 'function') {
      root.AIFS_applyLangDir(lang);
      return;
    }
    root.document.documentElement.lang = lang;
    root.document.documentElement.dir = RTL[lang] ? 'rtl' : 'ltr';
  }

  function setLanguage(lang) {
    var sequence = ++request;
    loadDictionary(lang, function (dict) {
      if (sequence !== request) return;
      active = dict ? lang : 'en';
      if (!dict && !touched) return;
      touched = true;
      applyTree(root.document.body, dict);
      applyDir(active);
      observe();
    });
  }

  function observe() {
    if (observer || typeof MutationObserver !== 'function') return;
    observer = new MutationObserver(function (mutations) {
      var dict = dictionaryFor(active);
      if (!dict) return;
      for (var i = 0; i < mutations.length; i++) {
        var m = mutations[i];
        if (m.type === 'childList') {
          for (var j = 0; j < m.addedNodes.length; j++) applyTree(m.addedNodes[j], dict);
        } else if (m.type === 'characterData') {
          if (eligible(m.target.parentNode)) applyText(m.target, dict);
        } else if (m.type === 'attributes') {
          if (eligible(m.target)) applyAttr(m.target, m.attributeName, dict);
        }
      }
    });
    observer.observe(root.document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ATTRS
    });
  }

  function currentLang() {
    if (typeof root.AIFS_currentLang === 'function') return root.AIFS_currentLang();
    var fromQuery = '';
    try { fromQuery = new URLSearchParams(root.location.search).get('lang') || ''; } catch (_) {}
    if (fromQuery) return fromQuery;
    try { return root.localStorage.getItem('lang') || 'en'; } catch (_) { return 'en'; }
  }

  function start() {
    if (root.AIFS_UI_STRINGS && typeof root.AIFS_UI_STRINGS === 'object') {
      for (var lang in root.AIFS_UI_STRINGS) {
        if (Object.prototype.hasOwnProperty.call(root.AIFS_UI_STRINGS, lang)) preload(lang, root.AIFS_UI_STRINGS[lang]);
      }
    }
    root.document.addEventListener('aifs:lang', function (event) {
      setLanguage(event.detail && event.detail.lang);
    });
    if (root.document.readyState === 'loading') {
      root.document.addEventListener('DOMContentLoaded', function () { setLanguage(currentLang()); }, { once: true });
    } else {
      setLanguage(currentLang());
    }
  }

  var api = {
    translateText: translateText,
    dictionaryFor: dictionaryFor,
    loadDictionary: loadDictionary,
    preload: preload,
    currentLang: currentLang,
    setLanguage: setLanguage,
    TRANSLATIONS_BASE: TRANSLATIONS_BASE,
    ATTRS: ATTRS,
    SKIP_SELECTOR: SKIP_SELECTOR,
    ARTICLE_ALLOW_SELECTOR: ARTICLE_ALLOW_SELECTOR
  };
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.AIFSUiI18n = api;

  if (root.document && typeof root.document.createElement === 'function' && typeof root.fetch === 'function') start();
})(typeof window !== 'undefined' ? window : globalThis);
