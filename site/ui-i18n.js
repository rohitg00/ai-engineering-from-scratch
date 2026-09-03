(function () {
  'use strict';

  var STORAGE_KEY = 'lang';
  var LANGUAGE_EVENT = 'aifs:language-change';
  var ATTRIBUTE_NAMES = {
    'aria-label': 1,
    'aria-valuetext': 1,
    alt: 1,
    title: 1,
    placeholder: 1,
    'data-tts-section': 1,
    'data-tts-label': 1
  };
  var NAVIGATION_ATTRIBUTE_NAMES = { href: 1, 'data-href': 1 };
  var LOCALIZED_ASSET_ATTRIBUTES = {
    src: 'data-i18n-src-',
    srcset: 'data-i18n-srcset-'
  };
  var EXCLUDED_TAGS = {
    SCRIPT: 1,
    STYLE: 1,
    CODE: 1,
    PRE: 1,
    KBD: 1,
    SAMP: 1,
    TEXTAREA: 1
  };
  var FALLBACK_DIR = 'ltr';
  var RTL_LANGUAGES = { ar: 1, he: 1, fa: 1, ur: 1 };
  var MAX_PATTERN_INPUT_LENGTH = 2048;
  var root = window;
  var doc = document;
  var hasOwn = Object.prototype.hasOwnProperty;
  var navigationState = createWeakStore();
  var assetState = createWeakStore();
  var textState = createWeakStore();
  var attrState = createWeakStore();
  var observer = null;
  var currentLanguage = 'en';
  var compiledCache = {};

  function emptyCompiled() {
    return { exact: {}, patterns: [], fragments: [], bundles: [] };
  }

  function createWeakStore() {
    if (typeof root.WeakMap === 'function') return new root.WeakMap();
    var keys = [];
    var values = [];
    return {
      get: function (key) {
        var i = indexOfKey(keys, key);
        return i >= 0 ? values[i] : void 0;
      },
      set: function (key, value) {
        var i = indexOfKey(keys, key);
        if (i >= 0) values[i] = value;
        else {
          keys.push(key);
          values.push(value);
        }
      }
    };
  }

  function indexOfKey(keys, key) {
    var i;
    for (i = 0; i < keys.length; i += 1) {
      if (keys[i] === key) return i;
    }
    return -1;
  }

  function readStorage() {
    try {
      return root.localStorage.getItem(STORAGE_KEY) || '';
    } catch (_) {
      return '';
    }
  }

  function writeStorage(lang) {
    try {
      if (!root.localStorage) return;
      if (!lang || lang === 'en') root.localStorage.removeItem(STORAGE_KEY);
      else root.localStorage.setItem(STORAGE_KEY, lang);
    } catch (_) {}
  }

  function queryLanguage() {
    var params;
    try {
      params = new root.URLSearchParams(root.location.search || '');
      return params.get('lang') || '';
    } catch (_) {
      return '';
    }
  }

  function markedPage() {
    var candidates = [doc && doc.documentElement, doc && doc.body];
    var element;
    var value;
    var i;
    for (i = 0; i < candidates.length; i += 1) {
      element = candidates[i];
      if (!element || !element.getAttribute) continue;
      value = element.getAttribute('data-i18n-page');
      if (value) return String(value).replace(/^\s+|\s+$/g, '');
    }
    if (doc && typeof doc.querySelector === 'function') {
      element = doc.querySelector('[data-i18n-page]');
      value = element && element.getAttribute('data-i18n-page');
      if (value) return String(value).replace(/^\s+|\s+$/g, '');
    }
    return '';
  }

  function pageFile() {
    var path = markedPage() || (root.location && root.location.pathname) || '';
    var clean = path.replace(/\/+$/, '');
    var parts = clean.split('/');
    var file = parts[parts.length - 1] || 'index.html';
    var aliases = {
      about: 'about.html',
      assessment: 'assessment.html',
      catalog: 'catalog.html',
      certification: 'certification.html',
      certifications: 'certifications.html',
      contact: 'contact.html',
      developer: 'developer.html',
      docs: 'developer.html',
      glossary: 'glossary.html',
      lesson: 'lesson.html',
      path: 'prereqs.html',
      privacy: 'privacy.html',
      roadmap: 'prereqs.html'
    };
    if (!clean || (path.charAt(path.length - 1) === '/' && !aliases[file])) return 'index.html';
    return aliases[file] || file;
  }

  function lessonPath() {
    try {
      return new root.URLSearchParams(root.location.search || '').get('path') || '';
    } catch (_) {
      return '';
    }
  }

  function isCertificationPath() {
    var file = pageFile();
    var path = lessonPath();
    if (file === 'certifications.html' || file === 'certification.html' || file === 'assessment.html') {
      return true;
    }
    return file === 'lesson.html' && path.indexOf('certifications/claude/lessons/') === 0;
  }

  function localizedInternalHref(value, lang) {
    var href = value == null ? '' : String(value);
    var hashIndex;
    var hash;
    var route;
    var queryIndex;
    var pathname;
    var filename;
    var params;
    if (!href || href.charAt(0) === '#' || /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(href)) return href;
    hashIndex = href.indexOf('#');
    hash = hashIndex >= 0 ? href.slice(hashIndex) : '';
    route = hashIndex >= 0 ? href.slice(0, hashIndex) : href;
    queryIndex = route.indexOf('?');
    pathname = queryIndex >= 0 ? route.slice(0, queryIndex) : route;
    filename = pathname.replace(/\/+$/, '').split('/').pop() || 'index.html';
    if (!/^(?:index|about|assessment|catalog|certification|certifications|contact|developer|docs|glossary|learning-paths|lesson|prereqs|privacy|roadmap)(?:\.html)?$/.test(filename)) {
      return href;
    }
    params = new root.URLSearchParams(queryIndex >= 0 ? route.slice(queryIndex + 1) : '');
    if (
      /^(?:assessment|certification|certifications)(?:\.html)?$/.test(filename)
      || (/^lesson(?:\.html)?$/.test(filename)
        && (
          (params.get('path') || '').indexOf('certifications/claude/lessons/') === 0
          || params.get('track')
          || params.get('fromTrack')
        ))
      || !lang
      || lang === 'en'
    ) {
      params.delete('lang');
    } else {
      params.set('lang', lang);
    }
    return pathname + (params.toString() ? '?' + params.toString() : '') + hash;
  }

  function syncNavigationAttributes(element, lang) {
    var name;
    var current;
    var desired;
    var records;
    var record;
    if (!element || element.nodeType !== 1) return;
    records = navigationState.get(element);
    if (!records) {
      records = {};
      navigationState.set(element, records);
    }
    for (name in NAVIGATION_ATTRIBUTE_NAMES) {
      if (!hasOwn.call(NAVIGATION_ATTRIBUTE_NAMES, name) || !element.hasAttribute(name)) continue;
      current = element.getAttribute(name);
      record = records[name];
      if (!record || (current !== record.original && current !== record.localized)) {
        record = { original: current, localized: null };
        records[name] = record;
      }
      desired = localizedInternalHref(record.original, lang);
      if (current !== desired) element.setAttribute(name, desired);
      record.localized = desired === record.original ? null : desired;
    }
  }

  function syncLocalizedAssetAttributes(element, lang) {
    var name;
    var current;
    var desired;
    var localized;
    var records;
    var record;
    if (!element || element.nodeType !== 1) return;
    records = assetState.get(element);
    if (!records) {
      records = {};
      assetState.set(element, records);
    }
    for (name in LOCALIZED_ASSET_ATTRIBUTES) {
      if (!hasOwn.call(LOCALIZED_ASSET_ATTRIBUTES, name) || !element.hasAttribute(name)) continue;
      current = element.getAttribute(name);
      record = records[name];
      if (!record || (current !== record.original && current !== record.localized)) {
        record = { original: current, localized: null };
        records[name] = record;
      }
      localized = lang === 'en'
        ? ''
        : element.getAttribute(LOCALIZED_ASSET_ATTRIBUTES[name] + lang);
      desired = localized || record.original;
      if (current !== desired) element.setAttribute(name, desired);
      record.localized = desired === record.original ? null : desired;
    }
  }

  function langStore(lang) {
    var source = root.AIFS_I18N || {};
    if (source && typeof source === 'object') {
      if (source.locales && source.locales[lang] && typeof source.locales[lang] === 'object') {
        return source.locales[lang];
      }
      if (source.languages && source.languages[lang] && typeof source.languages[lang] === 'object') {
        return source.languages[lang];
      }
      if (source[lang] && typeof source[lang] === 'object' && !isBundleShape(source[lang])) {
        return source[lang];
      }
    }
    return source;
  }

  function bundleContainer(lang) {
    var store = langStore(lang);
    if (store && store.bundles && typeof store.bundles === 'object') return store.bundles;
    return store;
  }

  function isBundleShape(value) {
    if (!value || typeof value !== 'object') return false;
    return !!(
      value.exact ||
      value.strings ||
      value.patterns ||
      value.target ||
      value.locale ||
      value.providers ||
      value.phases ||
      value.lessons
    );
  }

  function bundleNamesFor(lang) {
    var names = [];
    var store = bundleContainer(lang);
    var key;
    if (!store || typeof store !== 'object') return names;
    for (key in store) {
      if (!hasOwn.call(store, key)) continue;
      if (isBundleShape(store[key])) names.push(key);
    }
    if (!names.length) {
      for (key in root.AIFS_I18N) {
        if (!hasOwn.call(root.AIFS_I18N, key)) continue;
        if (key.indexOf(lang + '/') === 0) names.push(key.slice(lang.length + 1));
      }
    }
    return unique(names);
  }

  function bundleFor(lang, bundleName) {
    var source = root.AIFS_I18N || {};
    var store = bundleContainer(lang);
    var langValue = langStore(lang);
    if (store && store[bundleName] && isBundleShape(store[bundleName])) return store[bundleName];
    if (langValue && langValue.bundles && langValue.bundles[bundleName] && isBundleShape(langValue.bundles[bundleName])) {
      return langValue.bundles[bundleName];
    }
    if (source[lang + '/' + bundleName] && isBundleShape(source[lang + '/' + bundleName])) return source[lang + '/' + bundleName];
    if (source[lang + ':' + bundleName] && isBundleShape(source[lang + ':' + bundleName])) return source[lang + ':' + bundleName];
    if (source[bundleName] && isBundleShape(source[bundleName])) return source[bundleName];
    return null;
  }

  function supportedLanguages() {
    var source = root.AIFS_I18N || {};
    var langs = ['en'];
    var registered = Array.isArray(root.AIFS_LANGS) ? root.AIFS_LANGS : [];
    var key;
    var i;
    for (i = 0; i < registered.length; i += 1) {
      if (registered[i] && registered[i].code) langs.push(registered[i].code);
    }
    if (source.locales && typeof source.locales === 'object') {
      for (key in source.locales) if (hasOwn.call(source.locales, key)) langs.push(key);
      return unique(langs);
    }
    if (source.languages && typeof source.languages === 'object') {
      for (key in source.languages) if (hasOwn.call(source.languages, key)) langs.push(key);
      return unique(langs);
    }
    for (key in source) {
      if (!hasOwn.call(source, key)) continue;
      if (key === 'en') continue;
      if (key.indexOf('/') > 0) {
        langs.push(key.split('/')[0]);
      } else if (!isBundleShape(source[key])) {
        langs.push(key);
      }
    }
    return unique(langs);
  }

  function isSupportedLanguage(lang) {
    var langs = supportedLanguages();
    var i;
    if (!lang || lang === 'en') return true;
    for (i = 0; i < langs.length; i += 1) {
      if (langs[i] === lang) return true;
    }
    return false;
  }

  function resolveCurrentLanguage(preferred) {
    var query;
    var saved;
    if (isCertificationPath()) return 'en';
    if (preferred) return isSupportedLanguage(preferred) ? preferred : 'en';
    query = queryLanguage();
    if (query && isSupportedLanguage(query)) return query;
    saved = readStorage();
    return saved && isSupportedLanguage(saved) ? saved : 'en';
  }

  function figureNameForNode(node) {
    var current = node && node.nodeType === 1 ? node : node && node.parentNode;
    var value;
    while (current && current.nodeType === 1) {
      value = current.getAttribute && current.getAttribute('data-figure');
      if (value) return String(value).replace(/^\s+|\s+$/g, '').split(/\s+/)[0];
      current = current.parentNode;
    }
    return '';
  }

  function figureBundleForNode(lang, node, allNames) {
    var figureName = figureNameForNode(node);
    var providerMap = root.AIFS_FIGURE_PROVIDERS || {};
    var providers = figureName && providerMap[figureName];
    var provider = providers && providers.length ? providers[providers.length - 1] : 'lesson-figures.js';
    var i;
    var bundle;
    if (!figureName) return '';
    for (i = 0; i < allNames.length; i += 1) {
      if (allNames[i].indexOf('figures-') !== 0) continue;
      bundle = bundleFor(lang, allNames[i]);
      if (bundle && Array.isArray(bundle.providers) && bundle.providers.indexOf(provider) >= 0) {
        return allNames[i];
      }
    }
    return '';
  }

  function currentBundles(lang, contextNode) {
    var bundles = ['shared'];
    var file = pageFile();
    var allNames = bundleNamesFor(lang);
    var i;

    if (!isCertificationPath()) {
      bundles.push('catalog');
      bundles.push('learning-paths');
    }

    if (file === 'index.html' || file === '') {
      bundles.push('home');
    } else if (file === 'catalog.html') {
      bundles.push('catalog-glossary');
    } else if (file === 'glossary.html') {
      for (i = 0; i < allNames.length; i += 1) {
        if (allNames[i].indexOf('glossary-') === 0) bundles.push(allNames[i]);
      }
      bundles.push('catalog-glossary');
    } else if (file === 'lesson.html') {
      bundles.push('lesson');
      bundles.push('fallback-quiz');
      if (!isCertificationPath()) {
        bundles.push('figures-a');
        bundles.push(figureBundleForNode(lang, contextNode, allNames));
      }
    } else if (!isCertificationPath()) {
      bundles.push('pages');
    }

    return unique(bundles);
  }

  function unique(values) {
    var out = [];
    var seen = {};
    var i;
    for (i = 0; i < values.length; i += 1) {
      if (!values[i] || seen[values[i]]) continue;
      seen[values[i]] = 1;
      out.push(values[i]);
    }
    return out;
  }

  function getCompiled(lang, contextNode) {
    var bundleNames;
    var cacheKey;
    var compiled;
    var i;
    var bundle;
    if (!lang || lang === 'en') return emptyCompiled();
    bundleNames = currentBundles(lang, contextNode);
    cacheKey = lang + '|' + bundleNames.join('|');
    if (hasOwn.call(compiledCache, cacheKey)) return compiledCache[cacheKey];

    compiled = { exact: {}, patterns: [], fragments: [], bundles: bundleNames.slice(0) };

    for (i = 0; i < bundleNames.length; i += 1) {
      bundle = bundleFor(lang, bundleNames[i]);
      if (!bundle) continue;
      mergeExact(compiled.exact, bundle.exact);
      mergeExact(compiled.exact, bundle.strings);
      if (bundleNames[i].indexOf('figures-') === 0) {
        collectFragments(compiled.fragments, bundle.exact);
        collectFragments(compiled.fragments, bundle.strings);
      }
      if (bundle.phases || bundle.lessons) mergeCatalog(compiled.exact, bundle);
    }

    for (i = bundleNames.length - 1; i >= 0; i -= 1) {
      bundle = bundleFor(lang, bundleNames[i]);
      if (!bundle || !bundle.patterns || !bundle.patterns.length) continue;
      compilePatternList(compiled.patterns, bundle.patterns);
    }
    compiled.fragments.sort(function (left, right) {
      return right.source.length - left.source.length;
    });

    compiledCache[cacheKey] = compiled;
    return compiled;
  }

  function mergeExact(target, source) {
    var key;
    if (!source || typeof source !== 'object') return;
    for (key in source) {
      if (hasOwn.call(source, key)) target[key] = source[key];
    }
  }

  function collectFragments(target, source) {
    var key;
    var trimmed;
    if (!source || typeof source !== 'object') return;
    for (key in source) {
      if (!hasOwn.call(source, key) || key === key.replace(/^\s+|\s+$/g, '')) continue;
      trimmed = key.replace(/^\s+|\s+$/g, '');
      if (trimmed.length < 4 || !/[A-Za-z]/.test(trimmed) || /[<>]/.test(key)) continue;
      target.push({ source: key, replacement: source[key] });
    }
  }

  function mergeCatalog(target, bundle) {
    var phases = bundle && bundle.phases || {};
    var lessons = bundle && bundle.lessons || {};
    var allPhases = typeof root.PHASES !== 'undefined' && Array.isArray(root.PHASES)
      ? root.PHASES
      : typeof PHASES !== 'undefined' && Array.isArray(PHASES)
        ? PHASES
        : [];
    var i;
    var j;
    var phase;
    var phaseKey;
    var localized;
    var match;
    var lessonPathValue;
    var lessonLocalized;
    for (i = 0; i < allPhases.length; i += 1) {
      phase = allPhases[i];
      localized = null;
      for (phaseKey in phases) {
        if (hasOwn.call(phases, phaseKey) && parseInt(phaseKey, 10) === Number(phase.id)) {
          localized = phases[phaseKey];
          break;
        }
      }
      if (localized) {
        if (phase.name && localized.title) {
          target[phase.name] = localized.title;
          target[String(phase.name).toUpperCase()] = localized.title;
        }
        if (phase.desc && localized.description) target[phase.desc] = localized.description;
      }
      for (j = 0; j < (phase.lessons || []).length; j += 1) {
        match = String(phase.lessons[j].url || '').match(/(phases\/[^/?#]+\/[^/?#]+)/);
        lessonPathValue = match ? match[1] : '';
        lessonLocalized = hasOwn.call(lessons, lessonPathValue)
          ? lessons[lessonPathValue]
          : lessons[lessonPathValue + '/'];
        if (lessonPathValue && phase.lessons[j].name && lessonLocalized) {
          target[phase.lessons[j].name] = lessonLocalized;
        }
      }
    }
  }

  function compilePatternList(target, patterns) {
    var i;
    var compiled;
    var ranked = [];
    for (i = 0; i < patterns.length; i += 1) {
      compiled = compilePattern(patterns[i]);
      if (compiled) ranked.push(compiled);
    }
    ranked.sort(function (left, right) {
      return right.specificity - left.specificity;
    });
    for (i = 0; i < ranked.length; i += 1) {
      target.push(ranked[i]);
    }
  }

  function compilePattern(entry) {
    var source = '';
    var replacement = '';
    var pattern = '';
    if (!entry || typeof entry !== 'object') return null;

    if (typeof entry.replacement === 'string') replacement = entry.replacement;
    else if (typeof entry.translation === 'string') replacement = entry.translation;
    else if (typeof entry.target === 'string') replacement = entry.target;
    else return null;

    if (typeof entry.pattern === 'string') {
      pattern = entry.pattern;
      return makeRegexPattern(pattern, replacement, null);
    }

    if (typeof entry.exact === 'string') {
      source = entry.exact;
      return compileSourcePattern(source, replacement);
    }

    if (typeof entry.source === 'string') {
      source = entry.source;
      return compileSourcePattern(source, replacement);
    }

    return null;
  }

  function compileSourcePattern(source, replacement) {
    if (hasTemplatePlaceholders(source)) return makeTemplatePattern(source, replacement);
    if (looksLikeRegex(source)) return makeRegexPattern(source, replacement, null);
    return makeRegexPattern('^' + escapeRegExp(source) + '$', replacement, null);
  }

  function hasTemplatePlaceholders(value) {
    return /\{[A-Za-z0-9_]+\}/.test(value || '');
  }

  function looksLikeRegex(value) {
    if (!value) return false;
    return value.charAt(0) === '^' ||
      value.charAt(value.length - 1) === '$' ||
      value.indexOf('\\') >= 0 ||
      value.indexOf('(?<') >= 0 ||
      value.indexOf('(.') >= 0 ||
      value.indexOf('[') >= 0;
  }

  function makeTemplatePattern(source, replacement) {
    var tokens = [];
    var regexSource = source.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    regexSource = regexSource.replace(/\\\{([A-Za-z0-9_]+)\\\}/g, function (_, name) {
      tokens.push(name);
      return /^(?:number|count|done|total|shown|matched|remaining|phase)$/.test(name)
        ? '(\\d+)'
        : '(.+?)';
    });
    return makeRegexPattern('^' + regexSource + '$', replacement, tokens);
  }

  function makeRegexPattern(source, replacement, tokens) {
    var regex;
    if (hasClearlyUnsafeRegexStructure(source)) return null;
    try {
      regex = new RegExp(source);
    } catch (_) {
      return null;
    }
    return {
      regex: regex,
      replacement: replacement,
      tokens: tokens || [],
      specificity: String(source).length
    };
  }

  function regexQuantifierAt(source, index) {
    var character = source.charAt(index);
    var match;
    var minimum;
    var maximum;
    if (character === '*' || character === '+') {
      return { length: 1, variable: true, repeatsGroup: true };
    }
    if (character === '?') {
      return { length: 1, variable: true, repeatsGroup: false };
    }
    if (character !== '{') return null;
    match = source.slice(index).match(/^\{(\d+)(?:,(\d*))?\}/);
    if (!match) return null;
    minimum = parseInt(match[1], 10);
    maximum = typeof match[2] === 'undefined'
      ? minimum
      : match[2] === ''
        ? null
        : parseInt(match[2], 10);
    return {
      length: match[0].length,
      variable: maximum === null || maximum !== minimum,
      repeatsGroup: maximum === null || maximum > 1
    };
  }

  function isQuantifierModifier(source, index) {
    var previous = source.charAt(index - 1);
    if (source.charAt(index) !== '?') return false;
    if (previous === '(' || previous === '*' || previous === '+' || previous === '?') return true;
    return previous === '}' && /\{\d+(?:,\d*)?\}$/.test(source.slice(0, index));
  }

  function hasClearlyUnsafeRegexStructure(source) {
    var groups = [];
    var escaped = false;
    var inCharacterClass = false;
    var character;
    var quantifier;
    var group;
    var i;
    var j;
    source = String(source || '');
    for (i = 0; i < source.length; i += 1) {
      character = source.charAt(i);
      if (escaped) {
        escaped = false;
        continue;
      }
      if (character === '\\') {
        escaped = true;
        continue;
      }
      if (inCharacterClass) {
        if (character === ']') inCharacterClass = false;
        continue;
      }
      if (character === '[') {
        inCharacterClass = true;
        continue;
      }
      if (character === '(') {
        groups.push({ hasVariableQuantifier: false });
        continue;
      }
      if (character === ')') {
        group = groups.pop();
        quantifier = regexQuantifierAt(source, i + 1);
        if (group && quantifier && quantifier.repeatsGroup && group.hasVariableQuantifier) return true;
        continue;
      }
      quantifier = regexQuantifierAt(source, i);
      if (!quantifier || isQuantifierModifier(source, i)) continue;
      if (quantifier.variable) {
        for (j = 0; j < groups.length; j += 1) groups[j].hasVariableQuantifier = true;
      }
      i += quantifier.length - 1;
    }
    return false;
  }

  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function splitWhitespace(value) {
    var match;
    if (value == null) return { lead: '', core: '', trail: '' };
    match = String(value).match(/^(\s*)([\s\S]*?)(\s*)$/);
    return {
      lead: match ? match[1] : '',
      core: match ? match[2] : String(value),
      trail: match ? match[3] : ''
    };
  }

  function translateCore(core, lang, contextNode) {
    var compiled;
    var translated;
    var inner;
    var pairs = { '“': '”', '‘': '’', '"': '"' };
    var i;
    if (!core || lang === 'en') return core;
    compiled = getCompiled(lang, contextNode);
    if (hasOwn.call(compiled.exact, core)) return compiled.exact[core];
    if (core.length > 2 && pairs[core.charAt(0)] === core.charAt(core.length - 1)) {
      inner = core.slice(1, -1);
      if (hasOwn.call(compiled.exact, inner)) {
        return core.charAt(0) + compiled.exact[inner] + core.charAt(core.length - 1);
      }
    }
    if (core.length > MAX_PATTERN_INPUT_LENGTH) return core;
    for (i = 0; i < compiled.patterns.length; i += 1) {
      translated = applyPattern(compiled.patterns[i], core, compiled.exact);
      if (translated != null && translated !== core) return translated;
    }
    translated = core;
    for (i = 0; i < compiled.fragments.length; i += 1) {
      if (translated.indexOf(compiled.fragments[i].source) >= 0) {
        translated = translated.split(compiled.fragments[i].source).join(compiled.fragments[i].replacement);
      }
    }
    if (translated !== core) return translated;
    return core;
  }

  function translateCapture(value, exact) {
    return exact && hasOwn.call(exact, value) ? exact[value] : value;
  }

  function applyPattern(pattern, value, exact) {
    var match = pattern.regex.exec(value);
    var result;
    var groups;
    var i;
    if (!match) return null;

    result = pattern.replacement;
    if (result.indexOf('$') >= 0) {
      result = result.replace(/\$(\d+)/g, function (token, index) {
        var captured = match[parseInt(index, 10)];
        return typeof captured === 'undefined' ? token : translateCapture(captured, exact);
      });
    }

    groups = {};
    if (match.groups) {
      for (i in match.groups) if (hasOwn.call(match.groups, i)) groups[i] = match.groups[i];
    }
    for (i = 0; i < pattern.tokens.length; i += 1) {
      groups[pattern.tokens[i]] = match[i + 1];
    }

    if (result.indexOf('{') >= 0) {
      result = result.replace(/\{([A-Za-z0-9_]+)\}/g, function (_, name) {
        return hasOwn.call(groups, name) ? translateCapture(groups[name], exact) : _;
      });
    }

    return result;
  }

  function translateValue(value, lang, contextNode) {
    var raw = value == null ? '' : String(value);
    var compiled;
    var parts = splitWhitespace(value);
    if (!raw || lang === 'en') return raw;
    compiled = getCompiled(lang, contextNode);
    if (hasOwn.call(compiled.exact, raw)) return compiled.exact[raw];
    var translated = translateCore(parts.core, lang, contextNode);
    return parts.lead + translated + parts.trail;
  }

  function shouldSkipElement(element) {
    var current = element;
    while (current && current.nodeType === 1) {
      if (EXCLUDED_TAGS[current.tagName]) return true;
      if (current.getAttribute && (current.getAttribute('translate') === 'no' || current.hasAttribute('data-no-i18n'))) {
        return true;
      }
      current = current.parentNode;
    }
    return false;
  }

  function shouldSkipNode(node) {
    var parent = node && node.parentNode;
    if (!parent || parent.nodeType !== 1) return true;
    return shouldSkipElement(parent);
  }

  function textRecord(node) {
    var record = textState.get(node);
    if (!record) {
      record = { original: node.nodeValue, translated: null };
      textState.set(node, record);
    }
    return record;
  }

  function attrRecord(element) {
    var record = attrState.get(element);
    if (!record) {
      record = {};
      attrState.set(element, record);
    }
    return record;
  }

  function syncOriginalValue(record, currentValue) {
    if (currentValue !== record.original && currentValue !== record.translated) {
      record.original = currentValue;
      record.translated = null;
    }
  }

  function translateTextNode(node, lang) {
    var record;
    var desired;
    if (!node || node.nodeType !== 3 || shouldSkipNode(node)) return;
    record = textRecord(node);
    syncOriginalValue(record, node.nodeValue);
    desired = lang === 'en' ? record.original : translateValue(record.original, lang, node);
    if (node.nodeValue !== desired) node.nodeValue = desired;
    record.translated = lang === 'en' ? null : desired;
  }

  function translateAttribute(element, name, lang) {
    var record;
    var desired;
    if (!element || element.nodeType !== 1 || !ATTRIBUTE_NAMES[name] || !element.hasAttribute(name)) return;
    if (shouldSkipElement(element)) return;
    record = attrRecord(element);
    if (!hasOwn.call(record, name)) record[name] = { original: element.getAttribute(name), translated: null };
    syncOriginalValue(record[name], element.getAttribute(name));
    desired = lang === 'en' ? record[name].original : translateValue(record[name].original, lang, element);
    if (element.getAttribute(name) !== desired) element.setAttribute(name, desired);
    record[name].translated = lang === 'en' ? null : desired;
  }

  function translateElementAttributes(element, lang) {
    var name;
    if (!element || element.nodeType !== 1 || EXCLUDED_TAGS[element.tagName]) return;
    for (name in ATTRIBUTE_NAMES) {
      if (hasOwn.call(ATTRIBUTE_NAMES, name)) translateAttribute(element, name, lang);
    }
  }

  function walk(node, lang) {
    var child;
    if (!node) return;
    if (node.nodeType === 3) {
      translateTextNode(node, lang);
      return;
    }
    if (node.nodeType !== 1 && node.nodeType !== 9 && node.nodeType !== 11) return;
    if (node.nodeType === 1) {
      if (shouldSkipElement(node)) return;
      translateElementAttributes(node, lang);
      syncLocalizedAssetAttributes(node, lang);
    }
    child = node.firstChild;
    while (child) {
      walk(child, lang);
      child = child.nextSibling;
    }
  }

  function walkNavigation(node, lang) {
    var child;
    if (!node || (node.nodeType !== 1 && node.nodeType !== 9 && node.nodeType !== 11)) return;
    if (node.nodeType === 1) syncNavigationAttributes(node, lang);
    child = node.firstChild;
    while (child) {
      walkNavigation(child, lang);
      child = child.nextSibling;
    }
  }

  function setDocumentLanguage(lang) {
    if (!doc || !doc.documentElement) return;
    doc.documentElement.lang = lang === 'en' ? 'en' : lang;
    doc.documentElement.dir = RTL_LANGUAGES[lang] ? 'rtl' : FALLBACK_DIR;
  }

  function isDocumentRoot(target) {
    return target === doc || target === doc.documentElement || target === doc.body;
  }

  function applyInternal(target, forcedLang, updateDocument) {
    var lang = resolveCurrentLanguage(forcedLang || currentLanguage);
    var rootNode = target && target.nodeType ? target : doc.documentElement || doc.body;
    if (updateDocument) {
      currentLanguage = lang;
      api.current = lang;
      setDocumentLanguage(lang);
    }
    walk(rootNode, lang);
    walkNavigation(rootNode, lang);
    return lang;
  }

  function apply(target, forcedLang) {
    if (typeof target === 'string' && typeof forcedLang === 'undefined') {
      return applyInternal(doc.documentElement || doc.body, target, true);
    }
    return applyInternal(target, forcedLang, isDocumentRoot(target));
  }

  function handleMutations(mutations) {
    var i;
    var j;
    var mutation;
    var node;
    for (i = 0; i < mutations.length; i += 1) {
      mutation = mutations[i];
      if (mutation.type === 'characterData') {
        translateTextNode(mutation.target, currentLanguage);
      } else if (mutation.type === 'attributes') {
        if (NAVIGATION_ATTRIBUTE_NAMES[mutation.attributeName]) {
          syncNavigationAttributes(mutation.target, currentLanguage);
        } else if (LOCALIZED_ASSET_ATTRIBUTES[mutation.attributeName]) {
          syncLocalizedAssetAttributes(mutation.target, currentLanguage);
        } else {
          translateAttribute(mutation.target, mutation.attributeName, currentLanguage);
        }
      } else if (mutation.type === 'childList') {
        for (j = 0; j < mutation.addedNodes.length; j += 1) {
          node = mutation.addedNodes[j];
          walk(node, currentLanguage);
          walkNavigation(node, currentLanguage);
        }
      }
    }
  }

  function ensureObserver() {
    if (observer || typeof root.MutationObserver !== 'function') return;
    observer = new root.MutationObserver(handleMutations);
    observer.observe(doc.documentElement || doc.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: [
        'aria-label',
        'aria-valuetext',
        'alt',
        'title',
        'placeholder',
        'data-tts-section',
        'data-tts-label',
        'src',
        'srcset',
        'href',
        'data-href'
      ]
    });
  }

  function t(value, params, lang) {
    var resolved = value == null ? '' : String(value);
    var translated;
    var map = params;
    var targetLang = lang;
    if (typeof params === 'string' && typeof lang === 'undefined') {
      targetLang = params;
      map = null;
    }
    if (map && typeof map === 'object') {
      translated = translateValue(resolved, resolveCurrentLanguage(targetLang || currentLanguage));
      return translated.replace(/\{([A-Za-z0-9_]+)\}/g, function (_, name) {
        return hasOwn.call(map, name) ? map[name] : _;
      });
    }
    return translateValue(resolved, resolveCurrentLanguage(targetLang || currentLanguage));
  }

  function searchText(values, lang) {
    var list = Array.isArray(values) ? values : [values];
    var targetLang = resolveCurrentLanguage(lang || currentLanguage);
    var parts = [];
    function append(value) {
      value = value == null ? '' : String(value).replace(/^\s+|\s+$/g, '');
      if (value && parts.indexOf(value) < 0) parts.push(value);
    }
    for (var i = 0; i < list.length; i += 1) {
      append(list[i]);
      append(translateValue(list[i], targetLang));
    }
    return parts.join(' ');
  }

  function catalogPhase(phase, name) {
    var number = phase == null ? '' : String(phase);
    var padded = number.length === 1 ? '0' + number : number;
    if (typeof name === 'string' && name) {
      return t('Phase ' + padded + ': ' + name);
    }
    return t('Phase ' + padded);
  }

  function catalogLesson(value) {
    if (typeof value === 'number') return t(String(value) + ' lessons');
    return t(value == null ? '' : String(value));
  }

  function catalogTitle(url, fallback, lang) {
    var targetLang = resolveCurrentLanguage(lang || currentLanguage);
    var match = String(url || '').match(/(phases\/[^/?#]+\/[^/?#]+)/);
    var lessonPathValue = match ? match[1] : '';
    var catalog = bundleFor(targetLang, 'catalog');
    var lessons = catalog && catalog.lessons || {};
    if (targetLang !== 'en' && lessonPathValue) {
      if (hasOwn.call(lessons, lessonPathValue)) return lessons[lessonPathValue];
      if (hasOwn.call(lessons, lessonPathValue + '/')) return lessons[lessonPathValue + '/'];
    }
    return t(fallback == null ? '' : String(fallback), targetLang);
  }

  function handleLanguageEvent(event) {
    var detail = event && event.detail;
    var lang = '';
    if (typeof detail === 'string') lang = detail;
    else if (detail && typeof detail === 'object') lang = detail.lang || detail.language || detail.current || '';
    lang = resolveCurrentLanguage(lang || queryLanguage() || readStorage() || 'en');
    writeStorage(lang);
    apply(doc.documentElement || doc.body, lang);
  }

  var api = {
    current: currentLanguage,
    t: t,
    translate: t,
    searchText: searchText,
    apply: apply,
    catalogPhase: catalogPhase,
    catalogLesson: catalogLesson,
    catalogTitle: catalogTitle
  };

  root.AIFS_I18n = api;

  function init() {
    currentLanguage = resolveCurrentLanguage();
    api.current = currentLanguage;
    setDocumentLanguage(currentLanguage);
    apply(doc.documentElement || doc.body, currentLanguage);
    ensureObserver();
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init);
  else init();

  root.addEventListener(LANGUAGE_EVENT, handleLanguageEvent);
})();
