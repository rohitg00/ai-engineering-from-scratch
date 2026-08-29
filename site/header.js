/**
 * Shared header behaviors: responsive navigation, current-page state, and the
 * live GitHub star counter.
 */
(function () {
  'use strict';

  var REPO = 'rohitg00/ai-engineering-from-scratch';
  var CACHE_KEY = 'gh:stars:' + REPO;
  var CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
  var COMPACT_HEADER_QUERY = '(max-width: 1400px)';
  var NARROW_HEADER_QUERY = '(max-width: 820px)';
  var NARRATION_VERSION = '20260829a';
  var navId = 0;

  function isStaticPreview(locationValue) {
    var current = locationValue || window.location;
    var hostname = String(current && current.hostname || '').toLowerCase();
    return !!(current && current.protocol === 'file:') ||
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      hostname === '[::1]';
  }

  function adaptRouteHref(href, locationValue) {
    if (typeof href !== 'string' || !isStaticPreview(locationValue)) return href;
    if (/^[a-z][a-z\d+.-]*:/i.test(href) || href.indexOf('//') === 0) {
      try {
        var resolved = new URL(href, (locationValue || window.location).href);
        if (resolved.origin !== (locationValue || window.location).origin) return href;
      } catch (_) {
        return href;
      }
    }
    return href.replace(/(^|\/)(lesson|certification)(?=[?#]|$)/, '$1$2.html');
  }

  function adaptRouteLink(link) {
    if (!link || typeof link.getAttribute !== 'function') return;
    var href = link.getAttribute('href');
    var adapted = adaptRouteHref(href);
    if (adapted !== href) link.setAttribute('href', adapted);
  }

  function adaptRouteTree(root) {
    if (!root) return;
    if (typeof root.matches === 'function' && root.matches('a[href]')) adaptRouteLink(root);
    if (typeof root.querySelectorAll !== 'function') return;
    var links = root.querySelectorAll('a[href]');
    for (var i = 0; i < links.length; i++) adaptRouteLink(links[i]);
  }

  function setupRouteLinks() {
    window.AIFSRouteLinks = {
      isStaticPreview: isStaticPreview,
      adaptHref: adaptRouteHref,
      adaptLink: adaptRouteLink,
      adaptTree: adaptRouteTree
    };
    if (!isStaticPreview()) return;

    adaptRouteTree(document);
    document.addEventListener('click', function (event) {
      var target = event.target;
      var link = target && typeof target.closest === 'function' ? target.closest('a[href]') : null;
      adaptRouteLink(link);
    }, true);

    if (typeof MutationObserver === 'function') {
      var observer = new MutationObserver(function (mutations) {
        for (var i = 0; i < mutations.length; i++) {
          if (mutations[i].type === 'attributes') adaptRouteLink(mutations[i].target);
          var added = mutations[i].addedNodes || [];
          for (var j = 0; j < added.length; j++) adaptRouteTree(added[j]);
        }
      });
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['href'],
        childList: true,
        subtree: true
      });
    }
  }

  function format(n) {
    if (n >= 10000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
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
    var links = document.querySelectorAll('.header-github');
    for (var j = 0; j < links.length; j++) {
      links[j].setAttribute('aria-label', 'View ai-engineering-from-scratch on GitHub, ' + format(n) + ' stars');
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
    } catch (e) {
      // localStorage may be disabled
    }
  }

  function loadStars() {
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
      .catch(function () {
        // Leave the placeholder; the link still works.
      });
  }

  /**
   * Narration is a site capability, not a page-template responsibility. Load
   * it once from the shared header so new pages cannot silently omit it.
   */
  function ensureNarration() {
    if (window.__AIFS_TTS_VERSION === NARRATION_VERSION || document.querySelector('script[data-aifs-tts="' + NARRATION_VERSION + '"]')) return;
    var script = document.createElement('script');
    script.src = 'tts.js?v=' + NARRATION_VERSION;
    script.async = true;
    script.setAttribute('data-aifs-tts', NARRATION_VERSION);
    document.head.appendChild(script);
  }

  function pageFile(url) {
    try {
      var parsed = new URL(url, location.href);
      if (parsed.origin !== location.origin) return '';
      var file = parsed.pathname.split('/').pop() || 'index.html';
      if (file.indexOf('.') === -1) file += '.html';
      return file.toLowerCase();
    } catch (_) {
      return '';
    }
  }

  function syncCurrentPage(header) {
    var nav = header.querySelector('.header-nav');
    var logo = header.querySelector('.logo');
    if (!nav) return;

    var links = nav.querySelectorAll('a');
    for (var i = 0; i < links.length; i++) links[i].removeAttribute('aria-current');
    if (logo) logo.removeAttribute('aria-current');

    var current = pageFile(location.href);
    if (current === 'index.html') {
      if (logo) logo.setAttribute('aria-current', 'page');
      return;
    }

    var target = current;
    if (current === 'certification.html' || current === 'assessment.html') {
      target = 'certifications.html';
    } else if (current === 'lesson.html') {
      try {
        var params = new URLSearchParams(location.search);
        var lessonPath = params.get('path') || '';
        if (params.has('track') || params.has('fromTrack') || lessonPath.indexOf('certifications/') === 0) {
          target = 'certifications.html';
        }
      } catch (_) {}
    }

    for (var j = 0; j < links.length; j++) {
      if (pageFile(links[j].href) === target) {
        links[j].setAttribute('aria-current', 'page');
        break;
      }
    }
  }

  function ensureNavigationLink(nav, filename, label, className) {
    var links = nav.querySelectorAll('a');
    for (var i = 0; i < links.length; i++) {
      if (pageFile(links[i].href) === filename) return;
    }

    var link = document.createElement('a');
    link.href = filename;
    if (className) link.className = className;
    link.textContent = label;
    var github = nav.querySelector('.header-github');
    nav.insertBefore(link, github || null);
  }

  function addNavigationLinks(nav) {
    ensureNavigationLink(nav, 'learning-paths.html', 'Learning Paths', '');
    ensureNavigationLink(nav, 'certifications.html', 'Certifications', 'header-mobile-only');
  }

  function setupNavigation(header) {
    var inner = header.querySelector('.header-inner');
    var nav = header.querySelector('.header-nav');
    var logo = header.querySelector('.logo');
    if (!inner || !nav || !logo || inner.querySelector('.header-menu-toggle')) return;

    addNavigationLinks(nav);
    syncCurrentPage(header);

    navId += 1;
    if (!nav.id) nav.id = 'siteNavigation' + navId;
    if (!nav.getAttribute('aria-label')) nav.setAttribute('aria-label', 'Primary');

    var toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'header-menu-toggle';
    toggle.setAttribute('aria-controls', nav.id);
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Open navigation');
    toggle.innerHTML = '<span class="header-menu-icon" aria-hidden="true">'
      + '<span></span><span></span><span></span></span>';
    inner.insertBefore(toggle, nav);

    var priorityNav = document.createElement('nav');
    priorityNav.className = 'header-priority-nav';
    priorityNav.setAttribute('aria-label', 'Quick links');
    priorityNav.hidden = true;
    inner.insertBefore(priorityNav, nav);

    var priorityEntries = [];
    var routeLinks = Array.prototype.filter.call(nav.children, function (child) {
      return child.tagName === 'A';
    });
    routeLinks.forEach(function (link) {
      var label = link.textContent.trim().toLowerCase();
      if (label !== 'contents' && label !== 'catalog' && label !== 'learning paths') return;
      var marker = document.createComment('header-priority-' + label);
      nav.insertBefore(marker, link);
      priorityEntries.push({ link: link, marker: marker });
    });

    var github = nav.querySelector('.header-github');
    if (github) {
      github.setAttribute('data-header-persistent', 'true');
      inner.insertBefore(github, nav.nextSibling);
    }

    var tools = document.createElement('div');
    tools.className = 'header-mobile-tools';
    tools.setAttribute('role', 'group');
    tools.setAttribute('aria-label', 'Site tools');
    nav.appendChild(tools);

    var toolAnchor = document.createComment('header-tools');
    var directChildren = Array.prototype.slice.call(inner.children);
    var search = directChildren.find(function (child) {
      return child.classList && child.classList.contains('search-toggle');
    });
    var firstTool = directChildren.find(function (child) {
      return child !== logo && child !== nav && child !== toggle && child !== priorityNav && child !== github && child !== search;
    });
    inner.insertBefore(toolAnchor, search ? search.nextSibling : (firstTool || null));

    var compact = window.matchMedia ? window.matchMedia(COMPACT_HEADER_QUERY) : null;
    var narrow = window.matchMedia ? window.matchMedia(NARROW_HEADER_QUERY) : null;
    var open = false;

    function isMovableTool(child) {
      return child !== logo && child !== nav && child !== toggle && child !== priorityNav && child !== github && child !== search;
    }

    function appendTool(child) {
      var theme = tools.querySelector('.theme-toggle:not(.tts-toggle)');
      if (child.classList && child.classList.contains('tts-toggle') && theme) {
        tools.insertBefore(child, theme);
      } else {
        tools.appendChild(child);
      }
    }

    function moveToolsIntoMenu() {
      var children = Array.prototype.slice.call(inner.children);
      children.forEach(function (child) {
        if (isMovableTool(child)) appendTool(child);
      });
    }

    function restoreDesktopTools() {
      while (tools.firstChild) inner.insertBefore(tools.firstChild, toolAnchor);
    }

    function movePriorityLinksOut() {
      for (var i = 0; i < priorityEntries.length; i++) {
        priorityNav.appendChild(priorityEntries[i].link);
      }
      priorityNav.hidden = priorityEntries.length === 0;
    }

    function restorePriorityLinks() {
      for (var i = 0; i < priorityEntries.length; i++) {
        var entry = priorityEntries[i];
        nav.insertBefore(entry.link, entry.marker.nextSibling);
      }
      priorityNav.hidden = true;
    }

    function setOpen(next, restoreFocus) {
      open = !!next;
      header.classList.toggle('header-nav-open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
      if (compact && compact.matches) nav.hidden = !open;
      else nav.hidden = false;
      if (restoreFocus && !open) toggle.focus();
    }

    function syncLayout() {
      var isCompact = compact ? compact.matches : false;
      var isNarrow = narrow ? narrow.matches : false;
      var menuHadFocus = nav.contains(document.activeElement);
      var priorityHadFocus = priorityNav.contains(document.activeElement);
      if (isCompact) {
        if (isNarrow) restorePriorityLinks();
        else movePriorityLinksOut();
        moveToolsIntoMenu();
        setOpen(false, menuHadFocus || (isNarrow && priorityHadFocus));
      } else {
        restorePriorityLinks();
        setOpen(false, false);
        restoreDesktopTools();
        nav.hidden = false;
      }
    }

    toggle.addEventListener('click', function () { setOpen(!open, false); });
    toggle.addEventListener('keydown', function (event) {
      if (event.key !== 'ArrowDown') return;
      event.preventDefault();
      setOpen(true, false);
      var firstLink = nav.querySelector('a:not([hidden])');
      if (firstLink) firstLink.focus();
    });
    nav.addEventListener('click', function (event) {
      if (event.target.closest('a')) setOpen(false, false);
    });
    document.addEventListener('click', function (event) {
      if (open && !header.contains(event.target)) setOpen(false, false);
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && open && !event.defaultPrevented) {
        event.preventDefault();
        setOpen(false, true);
      }
    });

    if (compact) {
      if (typeof compact.addEventListener === 'function') compact.addEventListener('change', syncLayout);
      else if (typeof compact.addListener === 'function') compact.addListener(syncLayout);
    }
    if (narrow) {
      if (typeof narrow.addEventListener === 'function') narrow.addEventListener('change', syncLayout);
      else if (typeof narrow.addListener === 'function') narrow.addListener(syncLayout);
    }

    if (typeof MutationObserver === 'function') {
      var observer = new MutationObserver(function (mutations) {
        if (!compact || !compact.matches) return;
        for (var i = 0; i < mutations.length; i++) {
          var added = mutations[i].addedNodes;
          for (var j = 0; j < added.length; j++) {
            if (added[j].nodeType === 1 && isMovableTool(added[j])) appendTool(added[j]);
          }
        }
      });
      observer.observe(inner, { childList: true });
    }
    syncLayout();
  }

  function load() {
    var headers = document.querySelectorAll('.site-header');
    for (var i = 0; i < headers.length; i++) setupNavigation(headers[i]);
    loadStars();
    ensureNarration();
  }

  setupRouteLinks();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', load);
  } else {
    load();
  }
})();
