/**
 * Shared header behaviors: live GitHub star counter + language selector.
 * Loaded by every page that includes the .header-github component.
 */
(function () {
  var REPO = 'rohitg00/ai-engineering-from-scratch';
  var CACHE_KEY = 'gh:stars:' + REPO;
  var CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

  function format(n) {
    if (n >= 10000) return (n / 1000).toFixed(1).replace(/\\.0$/, '') + 'k';
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\\.0$/, '') + 'k';
    return String(n);
  }

  function paint(n) {
    var els = document.querySelectorAll(
      '.header-github .star-count, #starCount, [data-gh-stars="' + REPO + '"]'
    );
    for (var i = 0; i < els.length; i++) {
      els[i].textContent = format(n);
      els[i].removeAttribute('data-loading');
    }
  }

  function readCache() {
    try {
      var raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (Date.now() - parsed.t > CACHE_TTL_MS) return null;
      return parsed.n;
    } catch (e) {
      return null;
    }
  }

  function writeCache(n) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ n: n, t: Date.now() }));
    } catch (e) {}
  }

  function load() {
    var cached = readCache();
    if (cached != null) {
      paint(cached);
      return;
    }
    fetch('https://api.github.com/repos/' + REPO, {
      headers: { Accept: 'application/vnd.github+json' },
    })
      .then(function (r) {
        if (!r.ok) throw new Error('gh ' + r.status);
        return r.json();
      })
      .then(function (data) {
        var n = data.stargazers_count;
        if (typeof n !== 'number') return;
        writeCache(n);
        paint(n);
      })
      .catch(function () {});
  }

  /* --------------------------------------------------------
   * Language Selector (EN / PT-BR)
   * -------------------------------------------------------- */
  var LANG_STORAGE_KEY = 'aifs:lang';

  var TRANSLATIONS = {
    'en': {
      'Lessons': 'Lessons',
      'Contents': 'Contents',
      'Phases': 'Phases',
      'Glossary': 'Glossary',
      'Catalog': 'Catalog',
      'Search': 'Search',
      'Roadmap': 'Roadmap',
      'Prerequisites': 'Prerequisites',
      'Learning Objectives': 'Learning Objectives',
      'Type': 'Type',
      'Languages': 'Languages',
      'Time': 'Time',
      'Back to catalog': 'Back to catalog',
      'Lesson Catalog': 'Lesson Catalog',
      'AI Glossary': 'AI Glossary',
      'Search lessons...': 'Search lessons...',
      'All Phases': 'All Phases',
      'All Status': 'All Status',
      'Phase': 'Phase',
      'Language': 'Language',
      'Status': 'Status',
      'Search terms...': 'Search terms...'
    },
    'pt-br': {
      'Lessons': 'Aulas',
      'Contents': 'Conteudo',
      'Phases': 'Fases',
      'Glossary': 'Glossario',
      'Catalog': 'Catalogo',
      'Search': 'Buscar',
      'Roadmap': 'Roteiro',
      'Prerequisites': 'Pre-requisitos',
      'Learning Objectives': 'Objetivos de Aprendizado',
      'Type': 'Tipo',
      'Languages': 'Linguagens',
      'Time': 'Tempo',
      'Back to catalog': 'Voltar ao catalogo',
      'Lesson Catalog': 'Catalogo de Aulas',
      'AI Glossary': 'Glossario de IA',
      'Search lessons...': 'Buscar aulas...',
      'All Phases': 'Todas as Fases',
      'All Status': 'Todos os Estados',
      'Phase': 'Fase',
      'Language': 'Idioma',
      'Status': 'Estado',
      'Search terms...': 'Buscar termos...'
    }
  };

  function getLang() {
    var params = new URLSearchParams(window.location.search);
    var urlLang = params.get('lang');
    if (urlLang && TRANSLATIONS[urlLang]) return urlLang;
    try {
      var stored = localStorage.getItem(LANG_STORAGE_KEY);
      if (stored && TRANSLATIONS[stored]) return stored;
    } catch (e) {}
    return 'en';
  }

  function setLang(lang) {
    try { localStorage.setItem(LANG_STORAGE_KEY, lang); } catch (e) {}
    var url = new URL(window.location.href);
    url.searchParams.set('lang', lang);
    window.history.replaceState({}, '', url.toString());
  }

  function t(key) {
    var lang = getLang();
    return (TRANSLATIONS[lang] && TRANSLATIONS[lang][key]) || key;
  }

  window.AIFSLang = { getLang: getLang, setLang: setLang, t: t, TRANSLATIONS: TRANSLATIONS };

  function applyTranslations() {
    var lang = getLang();
    // Translate nav links
    document.querySelectorAll('.header-nav a').forEach(function (link) {
      var text = link.textContent.trim();
      var translated = t(text);
      if (translated !== text) {
        var hasSvg = false;
        for (var c = 0; c < link.childNodes.length; c++) {
          if (link.childNodes[c].nodeType === 1 && link.childNodes[c].tagName.toLowerCase() === 'svg') {
            hasSvg = true;
            break;
          }
        }
        if (!hasSvg) link.textContent = translated;
      }
    });

    // Translate elements with data-i18n
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      el.textContent = t(el.getAttribute('data-i18n'));
    });

    // Translate placeholders
    document.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
      el.placeholder = t(el.getAttribute('data-i18n-placeholder'));
    });

    // Update lang toggle button
    var langBtn = document.getElementById('langToggle');
    if (langBtn) {
      langBtn.textContent = lang === 'en' ? 'PT' : 'EN';
      langBtn.title = lang === 'en' ? 'Mudar para Portugues' : 'Switch to English';
    }

    document.documentElement.lang = lang === 'pt-br' ? 'pt-BR' : 'en';
  }

  function initLangSelector() {
    var headerInner = document.querySelector('.header-inner');
    if (!headerInner || document.getElementById('langToggle')) return;

    var btn = document.createElement('button');
    btn.id = 'langToggle';
    btn.className = 'lang-toggle';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Toggle language');
    btn.setAttribute('title', getLang() === 'en' ? 'Mudar para Portugues' : 'Switch to English');

    var themeToggle = document.getElementById('themeToggle');
    if (themeToggle && themeToggle.parentNode === headerInner) {
      headerInner.insertBefore(btn, themeToggle);
    } else {
      headerInner.appendChild(btn);
    }

    btn.addEventListener('click', function () {
      var current = getLang();
      var next = current === 'en' ? 'pt-br' : 'en';
      setLang(next);
      applyTranslations();
      window.location.reload();
    });

    applyTranslations();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      load();
      initLangSelector();
    });
  } else {
    load();
    initLangSelector();
  }
})();
