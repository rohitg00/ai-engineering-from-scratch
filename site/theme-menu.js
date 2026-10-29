(function (root) {
  'use strict';

  var KEY = 'theme';
  var MODES = ['system', 'light', 'dark'];
  var LABELS = { system: 'System', light: 'Light', dark: 'Dark' };

  function modeFrom(stored) {
    return stored === 'light' || stored === 'dark' ? stored : 'system';
  }

  function resolve(mode, prefersDark) {
    var m = modeFrom(mode);
    return m === 'system' ? (prefersDark ? 'dark' : 'light') : m;
  }

  function storageValue(mode) {
    return mode === 'light' || mode === 'dark' ? mode : null;
  }

  var api = { KEY: KEY, MODES: MODES, LABELS: LABELS, modeFrom: modeFrom, resolve: resolve, storageValue: storageValue };
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
    return;
  }
  root.AIFSThemeMenu = api;
  if (!root.document) return;

  var doc = root.document;
  var html = doc.documentElement;
  var query = root.matchMedia ? root.matchMedia('(prefers-color-scheme: dark)') : null;
  var SVG = '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" aria-hidden="true" focusable="false">';
  var ICONS = {
    system: SVG + '<rect x="1.75" y="2.75" width="12.5" height="8.5"/><path d="M5.5 14h5M8 11.25V14"/></svg>',
    light: SVG + '<circle cx="8" cy="8" r="2.75"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.4 1.4M11.55 11.55l1.4 1.4M3.05 12.95l1.4-1.4M11.55 4.45l1.4-1.4"/></svg>',
    dark: SVG + '<path d="M13.5 9.6A5.75 5.75 0 0 1 6.4 2.5a5.75 5.75 0 1 0 7.1 7.1z"/></svg>'
  };
  var CSS = [
    '.theme-toggle[data-theme-menu] svg{display:block}',
    '.theme-menu{position:fixed;z-index:1000;width:208px;background:var(--modal-bg,var(--bg,#fafaf5));border:1px solid var(--rule,rgba(26,26,26,.32));box-shadow:var(--shadow-hard,3px 3px 0 #1a1a1a);font-family:var(--font-mono,ui-monospace,monospace);opacity:1;transform:translateY(0);transition:opacity 180ms cubic-bezier(.23,1,.32,1),transform 180ms cubic-bezier(.23,1,.32,1)}',
    '.theme-menu[hidden]{display:none}',
    '@starting-style{.theme-menu{opacity:0;transform:translateY(-4px)}.theme-menu[data-side="top"]{transform:translateY(4px)}}',
    '.theme-menu-head{margin:0;padding:12px 14px 8px;font-size:.62rem;letter-spacing:.18em;text-transform:uppercase;color:var(--ink-mute,#7a7a78);border-bottom:1px solid var(--rule-soft,rgba(26,26,26,.16))}',
    '.theme-menu-item{display:grid;grid-template-columns:18px 1fr 14px;align-items:center;gap:12px;width:100%;min-height:44px;margin:0;padding:0 14px;border:0;border-bottom:1px solid var(--rule-soft,rgba(26,26,26,.16));background:transparent;color:var(--ink,#1a1a1a);font:500 .72rem var(--font-mono,ui-monospace,monospace);letter-spacing:.14em;text-transform:uppercase;text-align:start;cursor:pointer;transition:background-color 180ms cubic-bezier(.23,1,.32,1),color 180ms cubic-bezier(.23,1,.32,1)}',
    '.theme-menu-item:last-child{border-bottom:0}',
    '.theme-menu-item svg{display:block}',
    '.theme-menu-item[aria-checked="true"]{color:var(--blueprint,#3553ff)}',
    '.theme-menu-tick{visibility:hidden;font-size:.82rem;line-height:1;color:var(--blueprint,#3553ff)}',
    '.theme-menu-item[aria-checked="true"] .theme-menu-tick{visibility:visible}',
    '.theme-menu-item:focus-visible{outline:2px solid var(--blueprint,#3553ff);outline-offset:-2px;background:var(--blueprint-tint,rgba(53,83,255,.08))}',
    '@media (hover:hover) and (pointer:fine){.theme-menu-item:hover{background:var(--blueprint-tint,rgba(53,83,255,.08));color:var(--blueprint,#3553ff)}}',
    '@media (prefers-reduced-motion:reduce){.theme-menu,.theme-menu-item{transition:none}@starting-style{.theme-menu,.theme-menu[data-side="top"]{opacity:0;transform:none}}}'
  ].join('\n');

  var session = null;

  function stored() {
    if (session) return session;
    try { return modeFrom(root.localStorage.getItem(KEY)); } catch (e) { return 'system'; }
  }

  function save(mode) {
    session = null;
    try {
      var value = storageValue(mode);
      if (value) root.localStorage.setItem(KEY, value);
      else root.localStorage.removeItem(KEY);
      if (modeFrom(root.localStorage.getItem(KEY)) !== modeFrom(mode)) session = mode;
    } catch (e) {
      session = mode;
    }
  }

  function announce(mode, theme) {
    var detail = { mode: mode, theme: theme };
    var event;
    try {
      event = new root.CustomEvent('aifs:themechange', { detail: detail });
    } catch (e) {
      event = doc.createEvent('CustomEvent');
      event.initCustomEvent('aifs:themechange', false, false, detail);
    }
    doc.dispatchEvent(event);
  }

  function apply(mode) {
    var theme = resolve(mode, !!(query && query.matches));
    if (html.getAttribute('data-theme') !== theme) {
      html.setAttribute('data-theme', theme);
      announce(mode, theme);
    }
  }

  function ensureStyles() {
    if (doc.getElementById('aifs-theme-menu-css')) return;
    var style = doc.createElement('style');
    style.id = 'aifs-theme-menu-css';
    style.textContent = CSS;
    doc.head.appendChild(style);
  }

  function setup() {
    var button = doc.getElementById('themeToggle');
    if (!button || button.getAttribute('data-theme-menu') === 'true') return;
    ensureStyles();
    button.setAttribute('data-theme-menu', 'true');
    button.setAttribute('aria-haspopup', 'menu');
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-controls', 'aifsThemeMenu');
    button.setAttribute('aria-label', 'Change theme');
    button.setAttribute('title', 'Change theme');

    var panel = doc.createElement('div');
    panel.id = 'aifsThemeMenu';
    panel.className = 'theme-menu';
    panel.setAttribute('role', 'menu');
    panel.setAttribute('aria-label', 'Theme');
    panel.hidden = true;
    var head = doc.createElement('p');
    head.className = 'theme-menu-head';
    head.setAttribute('aria-hidden', 'true');
    head.textContent = 'Theme';
    panel.appendChild(head);
    var items = MODES.map(function (mode) {
      var item = doc.createElement('button');
      item.type = 'button';
      item.className = 'theme-menu-item';
      item.setAttribute('role', 'menuitemradio');
      item.setAttribute('data-mode', mode);
      item.tabIndex = -1;
      item.innerHTML = '<span class="theme-menu-icon">' + ICONS[mode] + '</span><span class="theme-menu-label"></span><span class="theme-menu-tick" aria-hidden="true">&#10003;</span>';
      item.querySelector('.theme-menu-label').textContent = LABELS[mode];
      panel.appendChild(item);
      return item;
    });
    doc.body.appendChild(panel);

    var open = false;

    function sync() {
      var mode = stored();
      button.innerHTML = '<span class="theme-toggle-icon">' + ICONS[mode] + '</span>';
      button.setAttribute('data-theme-mode', mode);
      items.forEach(function (item) {
        item.setAttribute('aria-checked', String(item.getAttribute('data-mode') === mode));
      });
    }

    function place() {
      var r = button.getBoundingClientRect();
      var w = panel.offsetWidth;
      var h = panel.offsetHeight;
      var vw = root.innerWidth || html.clientWidth;
      var vh = root.innerHeight || html.clientHeight;
      var rtl = (html.getAttribute('dir') || '').toLowerCase() === 'rtl';
      var left = Math.min(Math.max(8, rtl ? r.left : r.right - w), vw - w - 8);
      var top = r.bottom + 8;
      var above = top + h > vh - 8 && r.top - h - 8 >= 8;
      if (above) top = r.top - h - 8;
      panel.setAttribute('data-side', above ? 'top' : 'bottom');
      panel.style.left = Math.round(left) + 'px';
      panel.style.top = Math.round(top) + 'px';
    }

    function setOpen(next, moveFocus) {
      open = next;
      panel.hidden = !next;
      button.setAttribute('aria-expanded', String(next));
      if (next) {
        place();
        if (moveFocus) {
          var current = items.filter(function (item) { return item.getAttribute('aria-checked') === 'true'; })[0] || items[0];
          current.focus();
        }
      } else if (moveFocus) {
        button.focus();
      }
    }

    function choose(mode) {
      save(mode);
      apply(mode);
      sync();
      setOpen(false, true);
    }

    doc.addEventListener('click', function (event) {
      if (button.contains(event.target)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        setOpen(!open, event.detail === 0);
        return;
      }
      if (open && !panel.contains(event.target)) setOpen(false, false);
    }, true);

    panel.addEventListener('click', function (event) {
      event.stopPropagation();
      var item = event.target.closest ? event.target.closest('[data-mode]') : null;
      if (item) choose(item.getAttribute('data-mode'));
    });

    doc.addEventListener('keydown', function (event) {
      if (!open) {
        if (event.target === button && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
          event.preventDefault();
          event.stopImmediatePropagation();
          setOpen(true, true);
        }
        return;
      }
      var index = items.indexOf(doc.activeElement);
      var inside = panel.contains(doc.activeElement) || doc.activeElement === button;
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        setOpen(false, true);
      } else if (!inside) {
        return;
      } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        var delta = event.key === 'ArrowDown' ? 1 : -1;
        items[index < 0 ? 0 : (index + delta + items.length) % items.length].focus();
      } else if (event.key === 'Home' || event.key === 'End') {
        event.preventDefault();
        items[event.key === 'Home' ? 0 : items.length - 1].focus();
      } else if (event.key === 'Tab') {
        setOpen(false, false);
      }
    }, true);

    root.addEventListener('resize', function () { if (open) place(); });
    doc.addEventListener('scroll', function () { if (open) place(); }, { capture: true, passive: true });

    if (query) {
      var onSystem = function () { if (stored() === 'system') apply('system'); };
      if (typeof query.addEventListener === 'function') query.addEventListener('change', onSystem);
      else if (typeof query.addListener === 'function') query.addListener(onSystem);
    }

    root.addEventListener('storage', function (event) {
      if (event.key !== KEY && event.key !== null) return;
      session = null;
      apply(stored());
      sync();
    });

    sync();
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', setup);
  else setup();
})(typeof window !== 'undefined' ? window : this);
