(function () {
  'use strict';

  var Anchor = window.AIFSHighlightAnchor;
  var Store = window.AIFSHighlightStore;
  if (!Anchor || !Store || !document.createRange || !window.getSelection) return;

  var COLORS = Store.COLORS;
  var COLOR_LABELS = { yellow: 'Yellow', green: 'Green', blue: 'Blue', pink: 'Pink' };
  var MAX_SELECTION = 20000;
  var QUOTE_PREVIEW = 240;
  var SETTLE_QUIET = 1500;
  var SETTLE_MAX = 12000;
  var SHARE_PREFIX = '#aifs-share=';
  var INTERACTIVE = 'a, button, summary, [role="button"]';
  var TEXT_BUTTONS = '.quiz-option, .lesson-action-step';
  var UNIT_TEXT = 'foreignObject, figcaption, .lf-cap, .lf-head, .asf-caption';

  var state = {
    article: null,
    ctx: null,
    pressSelection: null,
    pending: null,
    runtime: {},
    painting: false,
    bound: false,
    tab: 'page',
    editor: null,
    selectionTimer: 0,
    orphanCache: {},
    observer: null,
    mutationTimer: 0,
    settleTimer: 0,
    settleDeadline: 0,
    settled: false,
    lastHash: '',
    shared: null,
    sharedRuntime: {},
    approx: {},
    findAgain: '',
    translated: false,
    toastTimer: 0
  };
  var ui = {};

  function make(tag, className, attrs) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (attrs) {
      for (var key in attrs) {
        if (Object.prototype.hasOwnProperty.call(attrs, key)) node.setAttribute(key, attrs[key]);
      }
    }
    return node;
  }

  function button(className, label, attrs) {
    var node = make('button', className, attrs);
    node.type = 'button';
    node.textContent = label;
    return node;
  }

  function announce(message) {
    if (!ui.live) return;
    ui.live.textContent = '';
    window.setTimeout(function () { ui.live.textContent = message; }, 30);
  }

  function toast(message) {
    if (!ui.toast) return;
    ui.toast.textContent = message;
    ui.toast.hidden = false;
    window.clearTimeout(state.toastTimer);
    state.toastTimer = window.setTimeout(function () { ui.toast.hidden = true; }, 4200);
    announce(message);
  }

  function reducedMotion() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function coarsePointer() {
    return !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  }

  function narrow() {
    return coarsePointer() || window.innerWidth < 720;
  }

  function langOf(item) {
    return item.lang || 'en';
  }

  function currentItems() {
    return state.ctx ? Store.items(state.ctx.path) : [];
  }

  function findItem(id) {
    var items = currentItems();
    for (var i = 0; i < items.length; i++) {
      if (items[i].id === id) return items[i];
    }
    return null;
  }

  function displayText(text) {
    return String(text || '').replace(/\[(diagram|figure) [^\]]*\]/g, '[$1]');
  }

  function preview(text) {
    var value = displayText(text);
    return value.length > QUOTE_PREVIEW ? value.slice(0, QUOTE_PREVIEW - 1) + '\u2026' : value;
  }

  function pageHref(path, id, lang) {
    var url = Store.urlFor(path);
    if (lang) url += (url.indexOf('?') >= 0 ? '&' : '?') + 'lang=' + encodeURIComponent(lang);
    return url + (id ? '#hl-' + id : '');
  }

  function textHash(value) {
    var hash = 2166136261;
    for (var i = 0; i < value.length; i++) {
      hash ^= value.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36) + ':' + value.length;
  }

  function ensureUi() {
    if (ui.root) return;
    ui.root = make('div', 'aifs-hl-ui aifs-hl-layer');

    ui.live = make('div', 'aifs-hl-sr', { 'aria-live': 'polite', role: 'status' });
    ui.hint = make('span', 'aifs-hl-sr', { id: 'aifsHlMarkHint' });
    ui.hint.textContent = 'Highlighted text. Press Enter to change the colour or note.';
    ui.sharedHint = make('span', 'aifs-hl-sr', { id: 'aifsHlSharedHint' });
    ui.sharedHint.textContent = 'Shared highlight. Press Enter to read the note or add it to your highlights.';
    ui.toast = make('div', 'aifs-hl-toast aifs-hl-ui', { 'aria-hidden': 'true' });
    ui.toast.hidden = true;

    ui.toolbar = make('div', 'aifs-hl-toolbar aifs-hl-ui', { role: 'toolbar', 'aria-label': 'Highlight the selected text' });
    ui.toolbar.hidden = true;
    ui.swatches = make('div', 'aifs-hl-toolbar-group');
    COLORS.forEach(function (color) {
      ui.swatches.appendChild(button('aifs-hl-swatch-btn aifs-hl-bg-' + color, '', {
        'data-color': color,
        'aria-label': 'Highlight ' + COLOR_LABELS[color].toLowerCase(),
        title: 'Highlight ' + COLOR_LABELS[color].toLowerCase()
      }));
    });
    ui.swatches.appendChild(button('aifs-hl-tool-text', 'Note', { 'data-note': 'true', title: 'Highlight and add a note' }));
    ui.attachGroup = make('div', 'aifs-hl-toolbar-group');
    ui.attachGroup.hidden = true;
    ui.attachGroup.appendChild(button('aifs-hl-tool-text aifs-hl-tool-primary', 'Attach here', { 'data-attach': 'true' }));
    ui.attachGroup.appendChild(button('aifs-hl-tool-text', 'Cancel', { 'data-attach-cancel': 'true' }));
    ui.toolbar.appendChild(ui.swatches);
    ui.toolbar.appendChild(ui.attachGroup);

    ui.editor = make('div', 'aifs-hl-editor aifs-hl-ui', { role: 'dialog', 'aria-label': 'Edit highlight' });
    ui.editor.hidden = true;
    ui.editorQuote = make('p', 'aifs-hl-editor-quote');
    ui.editorQuote.hidden = true;
    ui.editorColors = make('div', 'aifs-hl-editor-colors', { role: 'group', 'aria-label': 'Colour' });
    COLORS.forEach(function (color) {
      ui.editorColors.appendChild(button('aifs-hl-swatch-btn aifs-hl-bg-' + color, '', {
        'data-color': color,
        'aria-label': COLOR_LABELS[color],
        'aria-pressed': 'false',
        title: COLOR_LABELS[color]
      }));
    });
    ui.editorLabel = make('label', 'aifs-hl-editor-label', { for: 'aifsHlNote' });
    ui.editorLabel.textContent = 'Note';
    ui.editorNote = make('textarea', 'aifs-hl-editor-note', { id: 'aifsHlNote', rows: '3', maxlength: '2000', placeholder: 'Why this matters to you' });
    ui.editorStatus = make('p', 'aifs-hl-editor-status');
    var editorActions = make('div', 'aifs-hl-editor-actions');
    ui.editorSave = button('aifs-hl-btn aifs-hl-btn-primary', 'Save note');
    ui.editorAdopt = button('aifs-hl-btn aifs-hl-btn-primary', 'Add to mine');
    ui.editorDelete = button('aifs-hl-btn aifs-hl-btn-danger', 'Delete');
    ui.editorClose = button('aifs-hl-btn', 'Close');
    editorActions.appendChild(ui.editorSave);
    editorActions.appendChild(ui.editorAdopt);
    editorActions.appendChild(ui.editorDelete);
    editorActions.appendChild(ui.editorClose);
    ui.editor.appendChild(ui.editorQuote);
    ui.editor.appendChild(ui.editorColors);
    ui.editor.appendChild(ui.editorLabel);
    ui.editor.appendChild(ui.editorNote);
    ui.editor.appendChild(ui.editorStatus);
    ui.editor.appendChild(editorActions);

    ui.launcher = button('aifs-hl-launch aifs-hl-ui', '', { 'aria-controls': 'aifsHlPanel', 'aria-expanded': 'false' });
    ui.launcherLabel = make('span', 'aifs-hl-launch-label');
    ui.launcherLabel.textContent = 'Highlights';
    ui.launcherCount = make('span', 'aifs-hl-launch-count');
    ui.launcher.appendChild(ui.launcherLabel);
    ui.launcher.appendChild(ui.launcherCount);
    ui.launcher.hidden = true;

    ui.shareBar = make('div', 'aifs-hl-sharebar aifs-hl-ui', { role: 'region', 'aria-label': 'Shared highlights' });
    ui.shareBar.hidden = true;
    ui.shareText = make('p', 'aifs-hl-sharebar-text');
    ui.shareAddAll = button('aifs-hl-btn aifs-hl-btn-primary', 'Add all to mine');
    ui.shareDismiss = button('aifs-hl-btn', 'Dismiss');
    ui.shareBar.appendChild(ui.shareText);
    ui.shareBar.appendChild(ui.shareAddAll);
    ui.shareBar.appendChild(ui.shareDismiss);

    ui.panel = make('div', 'aifs-hl-panel aifs-hl-ui', { id: 'aifsHlPanel', role: 'dialog', 'aria-modal': 'false', 'aria-labelledby': 'aifsHlPanelTitle' });
    ui.panel.hidden = true;
    var head = make('div', 'aifs-hl-panel-head');
    var title = make('h2', 'aifs-hl-panel-title', { id: 'aifsHlPanelTitle' });
    title.textContent = 'My highlights';
    ui.panelClose = button('aifs-hl-btn', 'Close');
    head.appendChild(title);
    head.appendChild(ui.panelClose);
    var tabs = make('div', 'aifs-hl-tabs', { role: 'tablist', 'aria-label': 'Highlight scope' });
    ui.tabPage = button('aifs-hl-tab', 'This page', { role: 'tab', id: 'aifsHlTabPage', 'aria-controls': 'aifsHlList', 'data-tab': 'page' });
    ui.tabAll = button('aifs-hl-tab', 'All pages', { role: 'tab', id: 'aifsHlTabAll', 'aria-controls': 'aifsHlList', 'data-tab': 'all' });
    tabs.appendChild(ui.tabPage);
    tabs.appendChild(ui.tabAll);
    ui.panelNotice = make('div', 'aifs-hl-notice', { role: 'status' });
    ui.panelNotice.hidden = true;
    ui.list = make('div', 'aifs-hl-list', { id: 'aifsHlList', role: 'tabpanel', tabindex: '0' });
    var foot = make('div', 'aifs-hl-panel-foot');
    ui.exportMd = button('aifs-hl-btn', 'Export Markdown');
    ui.exportJson = button('aifs-hl-btn', 'Export JSON');
    ui.importBtn = button('aifs-hl-btn', 'Import JSON');
    ui.sharePage = button('aifs-hl-btn', 'Share link');
    ui.importInput = make('input', 'aifs-hl-file', { type: 'file', accept: 'application/json,.json', tabindex: '-1', 'aria-hidden': 'true' });
    ui.allLink = make('a', 'aifs-hl-link aifs-hl-all-link', { href: 'highlights.html' });
    ui.allLink.textContent = 'Open the My Highlights page';
    ui.footNote = make('p', 'aifs-hl-foot-note');
    ui.footNote.textContent = 'Highlights stay in this browser. Use a sync file or a share link to move them to another device.';
    foot.appendChild(ui.exportMd);
    foot.appendChild(ui.exportJson);
    foot.appendChild(ui.importBtn);
    foot.appendChild(ui.sharePage);
    foot.appendChild(ui.importInput);
    foot.appendChild(ui.allLink);
    foot.appendChild(ui.footNote);
    ui.panel.appendChild(head);
    ui.panel.appendChild(tabs);
    ui.panel.appendChild(ui.panelNotice);
    ui.panel.appendChild(ui.list);
    ui.panel.appendChild(foot);

    ui.root.appendChild(ui.live);
    ui.root.appendChild(ui.hint);
    ui.root.appendChild(ui.sharedHint);
    document.body.appendChild(ui.root);
    document.body.appendChild(ui.toolbar);
    document.body.appendChild(ui.editor);
    document.body.appendChild(ui.launcher);
    document.body.appendChild(ui.panel);
    document.body.appendChild(ui.shareBar);
    document.body.appendChild(ui.toast);
    bindUi();
  }

  function bindUi() {
    ui.toolbar.addEventListener('mousedown', function (event) { event.preventDefault(); });
    ui.toolbar.addEventListener('click', function (event) {
      var target = event.target.closest('button');
      if (!target) return;
      if (target.getAttribute('data-attach')) attachPending();
      else if (target.getAttribute('data-attach-cancel')) cancelFindAgain(true);
      else if (target.getAttribute('data-note')) createFromPending(COLORS[0], true);
      else createFromPending(target.getAttribute('data-color'), false);
    });

    ui.editor.addEventListener('click', function (event) {
      var target = event.target.closest('button[data-color]');
      if (!target || !state.editor || state.editor.shared) return;
      saveEditor({ color: target.getAttribute('data-color') }, false);
    });
    ui.editorSave.addEventListener('click', function () { saveEditor({ note: ui.editorNote.value }, true); });
    ui.editorAdopt.addEventListener('click', adoptFromEditor);
    ui.editorDelete.addEventListener('click', deleteFromEditor);
    ui.editorClose.addEventListener('click', function () { closeEditor(true); });
    ui.editorNote.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        saveEditor({ note: ui.editorNote.value }, true);
      }
    });

    ui.launcher.addEventListener('click', function () {
      if (ui.panel.hidden) openPanel();
      else closePanel(true);
    });
    ui.panelClose.addEventListener('click', function () { closePanel(true); });
    ui.tabPage.addEventListener('click', function () { setTab('page'); });
    ui.tabAll.addEventListener('click', function () { setTab('all'); });
    [ui.tabPage, ui.tabAll].forEach(function (tab) {
      tab.addEventListener('keydown', function (event) {
        if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
        event.preventDefault();
        var next = tab === ui.tabPage ? ui.tabAll : ui.tabPage;
        setTab(next.getAttribute('data-tab'));
        next.focus();
      });
    });
    ui.list.addEventListener('click', onListClick);
    ui.panelNotice.addEventListener('click', function (event) {
      var input = event.target.closest('input');
      if (input) input.select();
    });
    ui.exportMd.addEventListener('click', function () { exportScope('md'); });
    ui.exportJson.addEventListener('click', function () { exportScope('json'); });
    ui.importBtn.addEventListener('click', function () { ui.importInput.click(); });
    ui.importInput.addEventListener('change', onImport);
    ui.sharePage.addEventListener('click', function () { shareItems(null); });
    ui.shareAddAll.addEventListener('click', function () { adoptShared(null); });
    ui.shareDismiss.addEventListener('click', dismissShared);
  }

  function bindDocument() {
    if (state.bound) return;
    state.bound = true;

    document.addEventListener('pointerup', function (event) {
      if (event.target && event.target.closest && event.target.closest('.aifs-hl-ui')) return;
      scheduleSelection(10);
    });
    document.addEventListener('keyup', function (event) {
      if (event.shiftKey || event.key === 'Shift' || /^Arrow/.test(event.key)) scheduleSelection(10);
    });
    document.addEventListener('selectionchange', function () {
      var selection = window.getSelection();
      if (!selection || selection.isCollapsed) {
        window.clearTimeout(state.selectionTimer);
        state.selectionTimer = window.setTimeout(function () {
          if (!toolbarFocused() && !selectionInfo()) hideToolbar();
        }, 300);
        return;
      }
      scheduleSelection(coarsePointer() ? 350 : 250);
    });
    document.addEventListener('keydown', onKeydown, true);
    document.addEventListener('pointerdown', function () { state.pressSelection = selectionSignature(); }, true);
    document.addEventListener('click', onSelectingClick, true);
    document.addEventListener('click', onDocumentClick);
    document.addEventListener('copy', onCopy);
    document.addEventListener('pointerdown', function (event) {
      if (!state.editor || ui.editor.hidden) return;
      var target = event.target;
      if (target.closest && (target.closest('.aifs-hl-editor') || target.closest('.aifs-hl') || target.closest('.aifs-hl-atom') || target.closest('.aifs-hl-panel'))) return;
      closeEditor(false);
    });
    window.addEventListener('resize', function () {
      hideToolbar();
      if (state.editor) positionEditor();
    });
    window.addEventListener('pageshow', function (event) {
      if (event.persisted) Store.reload();
    });
    window.addEventListener('hashchange', function () {
      if (!state.article) return;
      var hash = window.location.hash || '';
      if (hash.indexOf(SHARE_PREFIX) === 0 || (state.shared && (hash === '' || hash === '#'))) {
        if (state.editor && state.editor.shared) closeEditor(false);
        readShare();
        paint(false);
        renderPanel();
      }
      if (/^#hl-/.test(hash)) revealHashTarget();
    });
    window.addEventListener('load', function () {
      if (state.article && state.hashPending && !state.userMoved) revealHashTarget();
    });
    ['wheel', 'touchstart', 'keydown', 'pointerdown'].forEach(function (name) {
      window.addEventListener(name, function () { state.userMoved = true; }, { passive: true, capture: true });
    });
    Store.onChange(function (_, meta) {
      if (state.painting || !state.article) return;
      syncWithStore();
      paint(!(meta && meta.external));
      renderPanel();
    });
  }

  function toolbarFocused() {
    return !!(ui.toolbar && ui.toolbar.contains(document.activeElement));
  }

  function scheduleSelection(delay) {
    window.clearTimeout(state.selectionTimer);
    state.selectionTimer = window.setTimeout(updateToolbar, delay);
  }

  function insideKind(node) {
    var el = node && (node.nodeType === 3 ? node.parentNode : node);
    if (!el || !el.closest) return '';
    if (el.closest('.math-inline, .math-display')) return 'math';
    if (el.closest('.lesson-figure, .mermaid-container, .m-fig-art')) {
      if (el.closest(UNIT_TEXT)) return '';
      return 'figure';
    }
    return '';
  }

  function inTextRegion(unit, node) {
    var el = node && (node.nodeType === 3 ? node.parentNode : node);
    var region = el && el.closest ? el.closest(UNIT_TEXT) : null;
    return !!(region && unit.contains(region));
  }

  function unitSelected(unit, range) {
    var startIn = unit.contains(range.startContainer);
    var endIn = unit.contains(range.endContainer);
    if (!startIn && !endIn) return true;
    if (startIn && !inTextRegion(unit, range.startContainer)) return true;
    if (endIn && !inTextRegion(unit, range.endContainer)) return true;
    return false;
  }

  function selectionInfo() {
    if (!state.article || !state.article.isConnected) return null;
    var selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.rangeCount) return null;
    var range = selection.getRangeAt(0);
    var common = range.commonAncestorContainer;
    if (!state.article.contains(common.nodeType === 3 ? common.parentNode : common)) return null;
    var model = Anchor.buildModel(state.article);
    var rawStart = -1;
    var rawEnd = -1;
    var snapped = '';
    for (var i = 0; i < model.segments.length; i++) {
      var segment = model.segments[i];
      if (!segment.node) continue;
      var hits = false;
      try { hits = range.intersectsNode(segment.node); } catch (_) { hits = false; }
      if (!hits) continue;
      var from = segment.start;
      var to = segment.end;
      if (!segment.atomic) {
        if (segment.node === range.startContainer) from = segment.start + range.startOffset;
        if (segment.node === range.endContainer) to = segment.start + range.endOffset;
      } else if (segment.unit && !unitSelected(segment.node, range)) {
        continue;
      } else if (segment.node.contains(range.startContainer) || segment.node.contains(range.endContainer)) {
        snapped = segment.unit ? 'figure' : 'math';
      }
      if (to <= from) continue;
      if (rawStart < 0) rawStart = from;
      rawEnd = to;
    }
    if (rawStart < 0) return null;
    var span = Anchor.rawToNormalized(model.normalized, rawStart, rawEnd);
    if (span.end <= span.start) return null;
    var kind = snapped || insideKind(range.startContainer) || insideKind(range.endContainer);
    return {
      model: model,
      start: span.start,
      end: span.end,
      snapped: kind,
      tooLong: span.end - span.start > MAX_SELECTION,
      rect: range.getBoundingClientRect()
    };
  }

  function isTranslated() {
    var root = document.documentElement;
    return /\btranslated-(ltr|rtl)\b/.test(root.className || '') || !!document.querySelector('html.translated-ltr, html.translated-rtl, body > .goog-te-banner-frame');
  }

  function selectionForToolbar() {
    var info = selectionInfo();
    if (info && state.editor && !ui.editor.hidden) {
      if (!closeEditor(false)) return null;
      info = restoreSelection(info);
    }
    return info;
  }

  function rawPoint(model, offset, isEnd) {
    for (var i = 0; i < model.segments.length; i++) {
      var segment = model.segments[i];
      if (!segment.node || segment.atomic || offset < segment.start || offset > segment.end) continue;
      if (isEnd ? offset > segment.start : offset < segment.end) return { node: segment.node, offset: offset - segment.start };
    }
    return null;
  }

  function restoreSelection(info) {
    var model = Anchor.buildModel(state.article);
    var raw = model.normalized ? Anchor.normalizedToRaw(model.normalized, info.start, info.end) : null;
    var start = raw && rawPoint(model, raw.start, false);
    var end = raw && rawPoint(model, raw.end, true);
    var selection = window.getSelection();
    if (start && end && selection && selection.addRange) {
      var range = document.createRange();
      range.setStart(start.node, start.offset);
      range.setEnd(end.node, end.offset);
      selection.removeAllRanges();
      selection.addRange(range);
    }
    return selectionInfo();
  }

  function updateToolbar() {
    var info = selectionForToolbar();
    if (!info) {
      if (!toolbarFocused()) hideToolbar();
      return;
    }
    state.pending = info;
    showToolbar(info);
  }

  function showToolbar(info) {
    var readOnly = Store.info().readOnly;
    var translated = isTranslated();
    var attaching = !!state.findAgain;
    ui.swatches.hidden = attaching;
    ui.attachGroup.hidden = !attaching;
    var buttons = ui.toolbar.querySelectorAll('button');
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].disabled = (info.tooLong || readOnly || translated) && !buttons[i].hasAttribute('data-attach-cancel');
    }
    var label = 'Highlight the selected text';
    if (attaching) label = 'Attach the highlight to the selected text';
    if (info.tooLong) label = 'Selection is too long to highlight';
    if (translated) label = 'Turn off page translation to highlight';
    ui.toolbar.setAttribute('aria-label', label);
    ui.toolbar.title = info.tooLong ? 'Select less text to highlight it (up to ' + MAX_SELECTION + ' characters).' : (translated ? label : '');
    ui.toolbar.hidden = false;
    var rect = info.rect;
    var width = ui.toolbar.offsetWidth;
    var height = ui.toolbar.offsetHeight;
    var docWidth = document.documentElement.clientWidth;
    var tts = document.getElementById('ttsFromHere');
    var ttsShown = !!(tts && !tts.hidden);
    var below = coarsePointer() || rect.top < 120 || ttsShown;
    var top = below ? rect.bottom + window.pageYOffset + 10 : rect.top + window.pageYOffset - height - 10;
    if (below && ttsShown) {
      var chip = tts.getBoundingClientRect();
      if (chip.bottom + window.pageYOffset >= top - 4) top = Math.max(top, chip.bottom + window.pageYOffset + 8);
    }
    var left = rect.left + window.pageXOffset + rect.width / 2 - width / 2;
    left = Math.max(window.pageXOffset + 8, Math.min(left, window.pageXOffset + docWidth - width - 8));
    ui.toolbar.style.top = Math.round(top) + 'px';
    ui.toolbar.style.left = Math.round(left) + 'px';
  }

  function hideToolbar() {
    if (ui.toolbar) ui.toolbar.hidden = true;
    state.pending = null;
  }

  function clearSelection() {
    var selection = window.getSelection();
    if (selection && selection.removeAllRanges) selection.removeAllRanges();
  }

  function storageMessage() {
    var info = Store.info();
    if (info.readOnly) return 'These highlights were saved by a newer version of this site. They are shown here but cannot be changed.';
    if (info.lastError === 'full') return 'Highlights use their full share of browser storage. Delete or export some before adding more.';
    if (info.lastError === 'quota') return 'Browser storage is full. New highlights last only until you close this tab. Export them to keep a copy.';
    if (!info.persistent) return 'This browser does not allow site storage here, so highlights last only until you close this tab.';
    if (info.lastError === 'unreadable' || info.lastError === 'skipped-invalid') {
      return 'Some saved highlight data could not be read. The original was kept in browser storage under aifs:highlights:v2:unreadable.';
    }
    return '';
  }

  function operationMessage() {
    var info = Store.info();
    return info.operationError || !info.persistent ? storageMessage() : '';
  }

  function snapMessage(kind) {
    if (kind === 'math') return 'Formulas are highlighted whole, so the highlight covers the full formula.';
    if (kind === 'figure') return 'Figures and diagrams are highlighted whole.';
    return '';
  }

  function anchorFields(pending) {
    var described = Anchor.describe(pending.model.text, pending.start, pending.end);
    var section = Anchor.describeSection(pending.model, described.position.start, described.position.end);
    return {
      quote: described.quote,
      position: described.position,
      section: section.section,
      sectionTitle: section.sectionTitle,
      sectionIndex: section.sectionIndex,
      sectionOffset: section.sectionOffset,
      sectionSpan: section.sectionSpan
    };
  }

  function createFromPending(color, withNote) {
    var pending = state.pending;
    if (!pending || pending.tooLong || !state.ctx || COLORS.indexOf(color) < 0) return;
    if (isTranslated()) {
      toast('Turn off page translation to highlight. Translated text would not match the lesson.');
      return;
    }
    var fields = anchorFields(pending);
    var item = Store.add(state.ctx.path, Object.assign(fields, {
      lang: state.ctx.lang,
      color: color,
      note: '',
      status: 'anchored',
      review: '',
      confidence: 1
    }), { title: state.ctx.title });
    clearSelection();
    hideToolbar();
    if (!item) {
      announce(Store.info().readOnly ? 'Highlights cannot be changed in this browser.' : (operationMessage() || 'The highlight could not be saved.'));
      return;
    }
    var message = operationMessage() || snapMessage(pending.snapped);
    if (message) toast(message);
    else announce('Highlight saved.');
    if (withNote) openEditor(item.id, true);
    else {
      var mark = firstMark(item.id);
      if (mark && mark.hasAttribute('tabindex')) mark.focus({ preventScroll: true });
    }
  }

  function startFindAgain(id) {
    state.findAgain = id;
    if (narrow()) closePanel(false);
    toast('Select the text to attach this highlight to, then choose Attach here.');
  }

  function cancelFindAgain(announceIt) {
    state.findAgain = '';
    hideToolbar();
    if (announceIt) announce('Find again cancelled.');
  }

  function cancelDeletedFindAgain() {
    cancelFindAgain(false);
    toast('That highlight was deleted, so attaching it was cancelled.');
  }

  function attachPending() {
    var pending = state.pending;
    var id = state.findAgain;
    if (!pending || !id || !state.ctx || pending.tooLong) return;
    var item = findItem(id);
    if (!item) {
      cancelDeletedFindAgain();
      return;
    }
    var fields = anchorFields(pending);
    var updated = Store.update(state.ctx.path, id, Object.assign(fields, {
      originalExact: item.originalExact || item.quote.exact,
      status: 'anchored',
      review: 'confirmed',
      confidence: 1,
      orphanHash: '',
      originalQuote: null,
      lang: state.ctx.lang
    }));
    state.findAgain = '';
    clearSelection();
    hideToolbar();
    toast(updated ? 'Highlight attached to the new text.' : 'The highlight could not be attached.');
  }

  function unpaint() {
    if (!state.article) return;
    var marks = state.article.querySelectorAll('mark.aifs-hl');
    for (var i = marks.length - 1; i >= 0; i--) {
      try { Anchor.unwrap(marks[i]); } catch (_) {}
    }
    var atoms = state.article.querySelectorAll('.aifs-hl-atom');
    for (var j = 0; j < atoms.length; j++) {
      var atom = atoms[j];
      atom.classList.remove('aifs-hl-atom', 'aifs-hl-shared', 'aifs-hl-approx');
      COLORS.forEach(function (color) { atom.classList.remove('aifs-hl-bg-' + color); });
      atom.removeAttribute('data-hl-ids');
      if (atom.hasAttribute('data-hl-focus')) {
        atom.removeAttribute('data-hl-focus');
        atom.removeAttribute('tabindex');
        atom.removeAttribute('aria-describedby');
        if (atom.id && /^hl-/.test(atom.id)) atom.removeAttribute('id');
      }
    }
  }

  function createMark(entry) {
    return function (index) {
      var mark = document.createElement('mark');
      var classes = ['aifs-hl', 'aifs-hl-bg-' + entry.color];
      if (entry.note) classes.push('aifs-hl-noted');
      if (entry.layer) classes.push('aifs-hl-' + entry.layer);
      mark.className = classes.join(' ');
      mark.setAttribute('data-hl-id', entry.id);
      if (index === 0) mark.id = 'hl-' + entry.id;
      if (entry.note) mark.title = entry.note;
      return mark;
    };
  }

  function makeFocusable(node, entry) {
    if (!node || node.closest(INTERACTIVE)) return;
    node.tabIndex = 0;
    node.setAttribute('aria-describedby', entry.layer === 'shared' ? 'aifsHlSharedHint' : 'aifsHlMarkHint');
  }

  function resolveOwn(model, hash, items, runtime, patches, entries, persist) {
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      if (langOf(item) !== state.ctx.lang) {
        var approx = state.approx[item.id] ? Anchor.approximate(model, item) : null;
        if (approx) {
          runtime[item.id] = { status: 'approx' };
          entries.push({ id: item.id, color: item.color, note: item.note, layer: 'approx', start: approx.start, end: approx.end });
        } else {
          runtime[item.id] = { status: 'other-lang', approxAvailable: !!Anchor.approximate(model, item) };
        }
        continue;
      }
      var cacheKey = item.id + '|' + item.quote.exact + '|' + item.review;
      var knownOrphan = state.orphanCache[cacheKey] === hash || (item.status === 'orphaned' && item.orphanHash === hash);
      var section = Anchor.sectionById(model, item.section);
      var hit = null;
      var whole = !!persist && state.settled;
      if (!knownOrphan) {
        hit = Anchor.locate(model.text, item, { regions: section ? [section] : [], wholeText: whole });
        if (hit && hit.method !== 'context' && item.review === 'rejected') hit = null;
      }
      if (!hit) {
        if (whole || item.quote.exact.length < 40) state.orphanCache[cacheKey] = hash;
        runtime[item.id] = { status: state.settled ? 'orphaned' : 'loading' };
        if (state.settled && (item.status !== 'orphaned' || item.orphanHash !== hash)) {
          patches[item.id] = { status: 'orphaned', orphanHash: hash };
        }
        continue;
      }
      var fuzzy = hit.method === 'fuzzy';
      var uncertain = fuzzy || (hit.ambiguous && item.position.start !== hit.start);
      var status = uncertain || (item.status === 'moved' && item.review !== 'confirmed') ? 'moved' : 'anchored';
      var confidence = fuzzy ? hit.confidence : (status === 'moved' ? item.confidence : hit.confidence);
      runtime[item.id] = { status: status, method: hit.method, confidence: confidence };
      var described = Anchor.describe(model.text, hit.start, hit.end);
      var sectionInfo = Anchor.describeSection(model, described.position.start, described.position.end);
      var patch = {};
      if (item.status !== status) patch.status = status;
      if (uncertain) {
        patch.review = 'pending';
        patch.confidence = confidence;
        if (!item.originalQuote) {
          patch.originalQuote = { exact: item.quote.exact, prefix: item.quote.prefix, suffix: item.quote.suffix, position: item.position };
        }
      }
      if (hit.method !== 'context' || item.position.start !== described.position.start || item.position.length !== described.position.length) {
        patch.quote = described.quote;
        patch.position = described.position;
        if (described.quote.exact !== item.quote.exact && !item.originalExact) patch.originalExact = item.quote.exact;
      }
      if (item.orphanHash) patch.orphanHash = '';
      if (sectionInfo.section && (sectionInfo.section !== item.section || sectionInfo.sectionOffset !== item.sectionOffset)) {
        patch.section = sectionInfo.section;
        patch.sectionTitle = sectionInfo.sectionTitle;
        patch.sectionIndex = sectionInfo.sectionIndex;
        patch.sectionOffset = sectionInfo.sectionOffset;
        patch.sectionSpan = sectionInfo.sectionSpan;
      }
      if (persist && Object.keys(patch).length) patches[item.id] = patch;
      entries.push({ id: item.id, color: item.color, note: item.note, layer: status === 'moved' ? 'moved' : '', start: hit.start, end: hit.end });
    }
  }

  function resolveShared(model, entries) {
    state.sharedRuntime = {};
    if (!state.shared || state.shared.path !== state.ctx.path) return;
    var hash = textHash(model.text);
    if (state.sharedHash !== hash) {
      state.sharedHash = hash;
      state.sharedHits = state.shared.items.map(function (item) { return Anchor.locate(model.text, item, { exactOnly: true }); });
    }
    state.shared.items.forEach(function (item, index) {
      var hit = state.sharedHits[index];
      state.sharedRuntime[index] = hit ? 'found' : 'missing';
      if (hit) entries.push({ id: 's' + index, color: item.color, note: item.note, layer: 'shared', start: hit.start, end: hit.end, sharedIndex: index });
    });
  }

  function paint(persist) {
    if (!state.article || !state.ctx || state.painting) return;
    state.painting = true;
    stopObserving();
    var patches = {};
    var focusedId = idFromTarget(document.activeElement);
    try {
      unpaint();
      var items = currentItems();
      var model = Anchor.buildModel(state.article);
      var hash = textHash(model.text);
      state.lastHash = hash;
      var runtime = {};
      var entries = [];
      resolveOwn(model, hash, items, runtime, patches, entries, persist !== false);
      resolveShared(model, entries);
      entries.sort(function (a, b) { return b.start - a.start || a.end - b.end; });
      var wrappedFrom = Infinity;
      for (var r = 0; r < entries.length; r++) {
        var entry = entries[r];
        if (entry.end > wrappedFrom) model = Anchor.buildModel(state.article);
        wrappedFrom = Math.min(wrappedFrom, entry.start);
        var painted = Anchor.wrap(model, entry.start, entry.end, createMark(entry));
        if (painted.marks.length) {
          painted.marks[painted.marks.length - 1].classList.add('aifs-hl-end');
          makeFocusable(painted.marks[0], entry);
          if (runtime[entry.id]) runtime[entry.id].marks = true;
        }
        for (var a = 0; a < painted.atoms.length; a++) {
          var atom = painted.atoms[a];
          atom.classList.add('aifs-hl-atom', 'aifs-hl-bg-' + entry.color);
          if (entry.layer === 'shared' || entry.layer === 'approx') atom.classList.add('aifs-hl-' + entry.layer);
          var ids = (atom.getAttribute('data-hl-ids') || '').split(' ').filter(Boolean);
          ids.push(entry.id);
          atom.setAttribute('data-hl-ids', ids.join(' '));
        }
        if (!painted.marks.length && painted.atoms.length && !painted.atoms[0].hasAttribute('tabindex')) {
          painted.atoms[0].setAttribute('data-hl-focus', entry.id);
          if (!painted.atoms[0].id) painted.atoms[0].id = 'hl-' + entry.id;
          makeFocusable(painted.atoms[0], entry);
        }
        if (!painted.marks.length && !painted.atoms.length && entry.layer !== 'shared' && entry.layer !== 'approx') {
          runtime[entry.id] = { status: state.settled ? 'orphaned' : 'loading' };
        }
      }
      state.runtime = runtime;
    } catch (error) {
      if (window.console && console.warn) console.warn('Highlights could not be drawn', error);
    } finally {
      state.painting = false;
      startObserving();
    }
    var canPersist = persist !== false && state.settled && !isTranslated() && !Store.info().readOnly;
    if (canPersist && Object.keys(patches).length) {
      state.painting = true;
      try { Store.updateMany(state.ctx.path, patches, true); } finally { state.painting = false; }
    }
    if (focusedId && !(state.article.contains(document.activeElement) && document.activeElement !== document.body && idFromTarget(document.activeElement))) {
      var again = firstMark(focusedId);
      if (again && again.hasAttribute('tabindex')) again.focus({ preventScroll: true });
    }
    updateLauncher();
    updateShareBar();
  }

  function stopObserving() {
    if (state.observer) state.observer.disconnect();
  }

  function startObserving() {
    if (!state.article || !window.MutationObserver) return;
    if (!state.observer) {
      state.observer = new MutationObserver(onMutations);
    }
    state.observer.observe(state.article, { childList: true, subtree: true, characterData: true });
  }

  function onMutations() {
    if (state.painting) return;
    if (!state.settled) scheduleSettle();
    window.clearTimeout(state.mutationTimer);
    state.mutationTimer = window.setTimeout(function () {
      if (!state.article || state.painting) return;
      var model = Anchor.buildModel(state.article);
      var hash = textHash(model.text);
      var broken = false;
      for (var id in state.runtime) {
        if (!Object.prototype.hasOwnProperty.call(state.runtime, id) || !/^(anchored|moved|approx)$/.test(state.runtime[id].status)) continue;
        var hasMark = !!state.article.querySelector('mark.aifs-hl[data-hl-id="' + id + '"]');
        if (state.runtime[id].marks ? !hasMark : !firstMark(id)) {
          broken = true;
          break;
        }
      }
      if (hash !== state.lastHash || broken) {
        state.translated = isTranslated();
        paint(false);
        renderPanel();
      }
    }, 250);
  }

  function asyncContentReady() {
    if (!state.article) return true;
    var pendingNodes = state.article.querySelectorAll('.mermaid-render:empty, .lesson-figure:empty');
    return !pendingNodes.length;
  }

  function scheduleSettle() {
    window.clearTimeout(state.settleTimer);
    var delay = Math.max(0, Math.min(SETTLE_QUIET, state.settleDeadline - Date.now()));
    state.settleTimer = window.setTimeout(function () {
      if (!state.article) return;
      if (!asyncContentReady() && Date.now() < state.settleDeadline) {
        scheduleSettle();
        return;
      }
      state.settled = true;
      paint(true);
      renderPanel();
      revealPendingHash();
    }, delay);
  }

  function revealPendingHash() {
    if (!state.hashPending) return;
    state.hashPending = false;
    if (!state.userMoved) revealHashTarget();
  }

  function syncWithStore() {
    if (state.findAgain && !findItem(state.findAgain)) cancelDeletedFindAgain();
    if (!state.editor || state.editor.shared) return;
    var item = findItem(state.editor.id);
    if (!item) {
      state.editor = null;
      ui.editor.hidden = true;
      return;
    }
    if (ui.editorNote.value === state.editor.baseNote && item.note !== state.editor.baseNote) {
      ui.editorNote.value = item.note;
      state.editor.baseNote = item.note;
    }
  }

  function firstMark(id) {
    if (!state.article) return null;
    var mark = document.getElementById('hl-' + id);
    if (mark && state.article.contains(mark)) return mark;
    var atoms = state.article.querySelectorAll('.aifs-hl-atom');
    for (var i = 0; i < atoms.length; i++) {
      if ((' ' + atoms[i].getAttribute('data-hl-ids') + ' ').indexOf(' ' + id + ' ') >= 0) return atoms[i];
    }
    return null;
  }

  function idFromTarget(target) {
    if (!target || !target.closest || !state.article || !state.article.contains(target)) return '';
    var mark = target.closest('mark.aifs-hl');
    if (mark) return mark.getAttribute('data-hl-id');
    var atom = target.closest('.aifs-hl-atom');
    if (atom) return atom.getAttribute('data-hl-focus') || (atom.getAttribute('data-hl-ids') || '').split(' ')[0] || '';
    return '';
  }

  function selectionSignature() {
    var selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.rangeCount) return null;
    return { anchor: selection.anchorNode, anchorOffset: selection.anchorOffset, focus: selection.focusNode, focusOffset: selection.focusOffset };
  }

  function selectionUnchangedSincePress() {
    var before = state.pressSelection;
    var now = selectionSignature();
    return !!before && !!now && before.anchor === now.anchor && before.anchorOffset === now.anchorOffset && before.focus === now.focus && before.focusOffset === now.focusOffset;
  }

  function onSelectingClick(event) {
    if (!event.detail) return;
    if (selectionUnchangedSincePress()) return;
    var control = event.target && event.target.closest ? event.target.closest(TEXT_BUTTONS) : null;
    if (!control || !state.article || !state.article.contains(control)) return;
    var selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.rangeCount) return;
    var range = selection.getRangeAt(0);
    var touches = false;
    try { touches = range.intersectsNode(control); } catch (_) { touches = false; }
    if (!touches) return;
    event.preventDefault();
    event.stopPropagation();
  }

  function onDocumentClick(event) {
    var id = idFromTarget(event.target);
    if (!id) return;
    var selection = window.getSelection();
    if (selection && !selection.isCollapsed) return;
    if (event.target.closest(INTERACTIVE)) return;
    openEditor(id, false);
  }

  function onCopy(event) {
    if (!state.article || !event.clipboardData) return;
    var selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.rangeCount) return;
    var range = selection.getRangeAt(0);
    var common = range.commonAncestorContainer;
    if (!state.article.contains(common.nodeType === 3 ? common.parentNode : common)) return;
    var holder = document.createElement('div');
    holder.appendChild(range.cloneContents());
    var marks = holder.querySelectorAll('mark.aifs-hl');
    if (!marks.length && !holder.querySelector('.aifs-hl-atom')) return;
    for (var i = marks.length - 1; i >= 0; i--) Anchor.unwrap(marks[i]);
    var atoms = holder.querySelectorAll('.aifs-hl-atom');
    for (var j = 0; j < atoms.length; j++) {
      atoms[j].classList.remove('aifs-hl-atom', 'aifs-hl-shared', 'aifs-hl-approx');
      COLORS.forEach(function (color) { atoms[j].classList.remove('aifs-hl-bg-' + color); });
      atoms[j].removeAttribute('data-hl-ids');
      atoms[j].removeAttribute('data-hl-focus');
      atoms[j].removeAttribute('tabindex');
      atoms[j].removeAttribute('aria-describedby');
    }
    event.clipboardData.setData('text/plain', selection.toString());
    event.clipboardData.setData('text/html', holder.innerHTML);
    event.preventDefault();
  }

  function onKeydown(event) {
    if (event.key === 'Escape') {
      if (state.editor && !ui.editor.hidden) {
        event.preventDefault();
        closeEditor(true);
        return;
      }
      if (ui.toolbar && !ui.toolbar.hidden) {
        event.preventDefault();
        if (state.findAgain) cancelFindAgain(true);
        else hideToolbar();
        return;
      }
      if (state.findAgain) {
        cancelFindAgain(true);
        return;
      }
      if (ui.panel && !ui.panel.hidden && ui.panel.contains(document.activeElement)) {
        event.preventDefault();
        closePanel(true);
      }
      return;
    }
    if (event.altKey && !event.ctrlKey && !event.metaKey && (event.code === 'KeyH' || event.key === 'h' || event.key === 'H')) {
      var info = selectionForToolbar();
      if (!info) return;
      event.preventDefault();
      state.pending = info;
      showToolbar(info);
      var first = ui.toolbar.querySelector('.aifs-hl-toolbar-group:not([hidden]) button:not([disabled])');
      if (first) first.focus();
      return;
    }
    if (event.key === 'Tab' && !event.shiftKey && ui.toolbar && !ui.toolbar.hidden && !toolbarFocused()) {
      var active = document.activeElement;
      if (active && active !== document.body && !(state.article && state.article.contains(active))) return;
      var firstButton = ui.toolbar.querySelector('.aifs-hl-toolbar-group:not([hidden]) button:not([disabled])');
      if (!firstButton) return;
      event.preventDefault();
      firstButton.focus();
      return;
    }
    if ((event.key === 'Enter' || event.key === ' ') && event.target && event.target.matches && event.target.matches('mark.aifs-hl[tabindex], .aifs-hl-atom[data-hl-focus]')) {
      event.preventDefault();
      openEditor(idFromTarget(event.target), false);
    }
  }

  function sharedItem(id) {
    if (!state.shared || !/^s\d+$/.test(id)) return null;
    return state.shared.items[Number(id.slice(1))] || null;
  }

  function openEditor(id, focusNote, anchorEl) {
    if (!sharedItem(id) && !findItem(id)) return;
    var fromPanel = !!(anchorEl && ui.panel.contains(anchorEl));
    if (state.editor && !closeEditor(false)) return;
    var shared = sharedItem(id);
    var item = shared || findItem(id);
    if (!item) return;
    hideToolbar();
    state.findAgain = '';
    state.editor = { id: id, anchor: anchorEl || null, fromPanel: fromPanel, shared: !!shared, baseNote: item.note || '', returnFocus: fromPanel ? null : (anchorEl || firstMark(id)) };
    ui.editorNote.value = item.note || '';
    ui.editorStatus.textContent = '';
    var readOnly = Store.info().readOnly || !!shared;
    var swatches = ui.editorColors.querySelectorAll('button[data-color]');
    for (var i = 0; i < swatches.length; i++) {
      swatches[i].setAttribute('aria-pressed', swatches[i].getAttribute('data-color') === item.color ? 'true' : 'false');
      swatches[i].disabled = readOnly;
    }
    ui.editor.setAttribute('aria-label', shared ? 'Shared highlight' : 'Edit highlight');
    ui.editorQuote.hidden = !shared;
    ui.editorQuote.textContent = shared ? preview(item.quote.exact) : '';
    ui.editorColors.hidden = !!shared;
    ui.editorNote.readOnly = readOnly;
    ui.editorLabel.textContent = shared ? 'Shared note' : 'Note';
    ui.editorSave.hidden = !!shared;
    ui.editorDelete.hidden = !!shared;
    ui.editorAdopt.hidden = !shared;
    ui.editorSave.disabled = readOnly;
    ui.editorDelete.disabled = readOnly;
    ui.editor.hidden = false;
    positionEditor();
    if (shared) ui.editorAdopt.focus();
    else if (focusNote) ui.editorNote.focus();
    else {
      var pressed = ui.editor.querySelector('button[aria-pressed="true"]');
      (pressed || ui.editorNote).focus();
    }
  }

  function positionEditor() {
    if (!state.editor) return;
    var anchor = state.editor.fromPanel ? null : firstMark(state.editor.id);
    if (!anchor) {
      ui.editor.classList.add('aifs-hl-editor-fixed');
      ui.editor.style.top = '';
      ui.editor.style.left = '';
      return;
    }
    ui.editor.classList.remove('aifs-hl-editor-fixed');
    var docWidth = document.documentElement.clientWidth;
    var width = ui.editor.offsetWidth;
    var rect = anchor.getBoundingClientRect();
    var top = rect.bottom + window.pageYOffset + 10;
    var left = rect.left + window.pageXOffset;
    left = Math.max(window.pageXOffset + 8, Math.min(left, window.pageXOffset + docWidth - width - 8));
    ui.editor.style.top = Math.round(top) + 'px';
    ui.editor.style.left = Math.round(left) + 'px';
  }

  function closeEditor(restoreFocus) {
    if (!state.editor) return true;
    var editing = state.editor;
    if (!editing.shared && state.ctx && !Store.info().readOnly && ui.editorNote.value !== editing.baseNote && findItem(editing.id)) {
      if (!Store.update(state.ctx.path, editing.id, { note: ui.editorNote.value })) {
        ui.editorStatus.textContent = ('The note could not be saved. ' + storageMessage()).trim();
        announce(ui.editorStatus.textContent);
        return false;
      }
      announce(operationMessage() || 'Note saved.');
    }
    var target = state.editor.returnFocus;
    var id = state.editor.id;
    var fromPanel = state.editor.fromPanel;
    state.editor = null;
    ui.editor.hidden = true;
    if (!restoreFocus) return true;
    if (fromPanel && !ui.panel.hidden) {
      var row = ui.list.querySelector('.aifs-hl-item[data-hl-id="' + id + '"] button[data-action="edit"]');
      (row || ui.list).focus();
      return true;
    }
    if (!target || !target.isConnected) target = firstMark(id);
    if (target && target.focus) target.focus({ preventScroll: true });
    return true;
  }

  function saveEditor(patch, closeAfter) {
    if (!state.editor || !state.ctx || state.editor.shared) return;
    var id = state.editor.id;
    var updated = Store.update(state.ctx.path, id, patch);
    if (!updated) {
      ui.editorStatus.textContent = 'The change could not be saved.';
      return;
    }
    if (state.editor && state.editor.id === id) state.editor.baseNote = updated.note;
    var swatches = ui.editorColors.querySelectorAll('button[data-color]');
    for (var i = 0; i < swatches.length; i++) {
      swatches[i].setAttribute('aria-pressed', swatches[i].getAttribute('data-color') === updated.color ? 'true' : 'false');
    }
    var message = operationMessage();
    announce(message || (patch.color ? 'Colour changed to ' + COLOR_LABELS[updated.color].toLowerCase() + '.' : 'Note saved.'));
    if (closeAfter) closeEditor(true);
    else positionEditor();
  }

  function deleteFromEditor() {
    if (!state.editor || !state.ctx || state.editor.shared) return;
    var id = state.editor.id;
    var fromPanel = state.editor.fromPanel;
    state.editor = null;
    ui.editor.hidden = true;
    if (Store.remove(state.ctx.path, id)) announce('Highlight deleted.');
    if (fromPanel && !ui.panel.hidden) ui.list.focus();
    else ui.launcher.focus();
  }

  function adoptFromEditor() {
    if (!state.editor || !state.editor.shared) return;
    var index = Number(state.editor.id.slice(1));
    closeEditor(false);
    adoptShared([index]);
  }

  function readShare() {
    state.shared = null;
    state.sharedHash = '';
    var hash = window.location.hash || '';
    if (hash.indexOf(SHARE_PREFIX) !== 0) return;
    state.shared = Store.decodeShare(hash.slice(SHARE_PREFIX.length));
    if (!state.shared) toast('That share link could not be read.');
  }

  function adoptShared(indexes) {
    if (!state.shared) return;
    var added = Store.addShared(state.shared, indexes);
    toast(added ? 'Added ' + added + (added === 1 ? ' highlight' : ' highlights') + ' to yours.' : 'Those highlights are already in yours.');
    if (!indexes) dismissShared();
  }

  function dismissShared() {
    if (state.editor && state.editor.shared) closeEditor(false);
    state.shared = null;
    if ((window.location.hash || '').indexOf(SHARE_PREFIX) === 0 && window.history && history.replaceState) {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
    paint(false);
    renderPanel();
  }

  function updateShareBar() {
    if (!ui.shareBar) return;
    if (!state.shared || !state.ctx) {
      ui.shareBar.hidden = true;
      return;
    }
    ui.shareBar.hidden = false;
    var total = state.shared.items.length;
    if (state.shared.path !== state.ctx.path) {
      ui.shareText.textContent = 'This share link holds ' + total + (total === 1 ? ' highlight' : ' highlights') + ' for another page: ' + (state.shared.title || state.shared.path) + '.';
      ui.shareAddAll.textContent = 'Add all to mine';
      return;
    }
    var found = 0;
    for (var key in state.sharedRuntime) {
      if (Object.prototype.hasOwnProperty.call(state.sharedRuntime, key) && state.sharedRuntime[key] === 'found') found++;
    }
    ui.shareText.textContent = 'Shared highlights: ' + found + ' of ' + total + ' shown on this page, read-only. Select one to read its note.';
  }

  function shareUrl(path, ids) {
    var encoded = Store.share(path, ids);
    if (!encoded) return '';
    return window.location.origin + window.location.pathname + window.location.search + SHARE_PREFIX + encoded;
  }

  function shareItems(ids) {
    if (!state.ctx) return;
    var link = shareUrl(state.ctx.path, ids);
    if (!link) {
      toast(Store.info().operationError === 'share-too-large' ? 'Those highlights are too long for one link. Share fewer highlights, or use a sync file.' : 'There is nothing to share on this page yet.');
      return;
    }
    showShareLink(link);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(link).then(function () {
        toast('Share link copied. It holds the highlights in the link itself; nothing is uploaded.');
      }, function () {
        toast('Copy the share link from the panel.');
      });
    } else {
      toast('Copy the share link from the panel.');
    }
  }

  function showShareLink(link) {
    if (ui.panel.hidden) openPanel();
    ui.panelNotice.hidden = false;
    ui.panelNotice.textContent = '';
    var label = make('label', 'aifs-hl-share-label', { for: 'aifsHlShareLink' });
    label.textContent = 'Share link (the highlights travel inside the link and never reach a server)';
    var input = make('input', 'aifs-hl-share-input', { id: 'aifsHlShareLink', type: 'text', readonly: 'readonly' });
    input.value = link;
    ui.panelNotice.appendChild(label);
    ui.panelNotice.appendChild(input);
    if (link.length > 8000) {
      var warn = make('p', 'aifs-hl-share-warn');
      warn.textContent = 'This link is long. Some chat apps cut long links; share fewer highlights if it does not open.';
      ui.panelNotice.appendChild(warn);
    }
  }

  function updateLauncher() {
    if (!ui.launcher || !state.ctx) return;
    var count = currentItems().length;
    ui.launcherCount.textContent = count ? String(count) : '';
    ui.launcherCount.hidden = !count;
    ui.launcher.setAttribute('aria-label', count ? 'My highlights, ' + count + ' on this page' : 'My highlights');
  }

  function openPanel() {
    if (state.findAgain) cancelFindAgain(false);
    ui.panel.hidden = false;
    ui.launcher.setAttribute('aria-expanded', 'true');
    document.documentElement.classList.add('aifs-hl-panel-open');
    renderPanel();
    ui.panelClose.focus();
  }

  function closePanel(restoreFocus) {
    if (!ui.panel || ui.panel.hidden) return;
    ui.panel.hidden = true;
    ui.launcher.setAttribute('aria-expanded', 'false');
    document.documentElement.classList.remove('aifs-hl-panel-open');
    ui.panelNotice.textContent = '';
    ui.panelNotice.hidden = true;
    if (state.editor && state.editor.fromPanel) closeEditor(false);
    if (restoreFocus) ui.launcher.focus();
  }

  function setTab(tab) {
    state.tab = tab === 'all' ? 'all' : 'page';
    renderPanel();
  }

  function percent(value) {
    return typeof value === 'number' ? Math.round(value * 100) + '%' : '';
  }

  function statusBadge(item, runtime) {
    var status = runtime ? runtime.status : item.status;
    if (item.review === 'conflict') return { cls: 'aifs-hl-badge-conflict', text: 'Conflict copy', help: 'An import changed this note. This copy keeps the version that would have been lost.' };
    if (status === 'loading') return { cls: 'aifs-hl-badge-lang', text: 'Waiting for the page', help: 'Part of the page is still loading.' };
    if (status === 'orphaned') return { cls: 'aifs-hl-badge-orphan', text: item.review === 'rejected' ? 'Orphaned (re-anchor rejected)' : 'Orphaned', help: 'The text changed and this passage was not found. The highlight is kept. Use Find again to attach it to new text.' };
    if (status === 'moved') {
      var confidence = runtime && typeof runtime.confidence === 'number' ? runtime.confidence : item.confidence;
      var pendingReview = item.review === 'pending';
      return { cls: 'aifs-hl-badge-moved', text: 'Re-anchored' + (percent(confidence) ? ' \u00b7 ' + percent(confidence) + ' match' : '') + (pendingReview ? ' \u00b7 needs review' : ''), help: 'The text changed. The highlight now marks the closest match. Confirm it or reject it.' };
    }
    if (status === 'approx') return { cls: 'aifs-hl-badge-approx', text: 'Approximate place', help: 'This highlight was made on another language version. It is shown at about the same place in the same section.' };
    if (status === 'other-lang') return { cls: 'aifs-hl-badge-lang', text: 'Saved in ' + langOf(item), help: 'This highlight was made on the ' + langOf(item) + ' version of the page.' };
    return null;
  }

  function itemNode(item, runtime, scope, path) {
    var status = runtime ? runtime.status : item.status;
    var li = make('li', 'aifs-hl-item', { 'data-hl-id': item.id, 'data-path': path });
    var swatch = make('span', 'aifs-hl-item-swatch aifs-hl-bg-' + item.color, { 'aria-hidden': 'true' });
    var body = make('div', 'aifs-hl-item-body');
    var quote = make('blockquote', 'aifs-hl-item-quote', { lang: langOf(item), dir: 'auto' });
    quote.textContent = preview(item.quote.exact);
    body.appendChild(quote);
    if (item.originalExact && item.originalExact !== item.quote.exact) {
      var original = make('p', 'aifs-hl-item-note aifs-hl-item-original', { dir: 'auto' });
      original.textContent = 'Originally: ' + preview(item.originalExact);
      body.appendChild(original);
    }
    if (item.note) {
      var note = make('p', 'aifs-hl-item-note', { dir: 'auto' });
      note.textContent = item.note;
      body.appendChild(note);
    }
    var meta = make('p', 'aifs-hl-item-meta');
    if (item.sectionTitle) {
      var section = make('span', 'aifs-hl-item-section', { dir: 'auto' });
      section.textContent = item.sectionTitle;
      meta.appendChild(section);
    }
    var badge = statusBadge(item, runtime);
    if (badge) {
      var tag = make('span', 'aifs-hl-badge ' + badge.cls, { title: badge.help });
      tag.textContent = badge.text;
      meta.appendChild(tag);
      if (scope === 'page' && /^(orphaned|moved|approx|other-lang)$/.test(status)) {
        var help = make('span', 'aifs-hl-item-help');
        help.textContent = badge.help;
        meta.appendChild(help);
      }
    }
    if (meta.childNodes.length) body.appendChild(meta);
    var actions = make('div', 'aifs-hl-item-actions');
    if (scope === 'page') {
      if (/^(anchored|moved|approx)$/.test(status)) actions.appendChild(button('aifs-hl-link', 'Jump to text', { 'data-action': 'jump' }));
      if (status === 'moved' && item.review !== 'confirmed') {
        actions.appendChild(button('aifs-hl-link', 'Confirm', { 'data-action': 'confirm' }));
        actions.appendChild(button('aifs-hl-link', 'Reject', { 'data-action': 'reject' }));
      }
      if (status === 'orphaned') {
        actions.appendChild(button('aifs-hl-link', 'Find again', { 'data-action': 'find' }));
        if (item.section && document.getElementById(item.section)) actions.appendChild(button('aifs-hl-link', 'Go to section', { 'data-action': 'section' }));
      }
      if (status === 'other-lang' || status === 'approx') {
        var open = make('a', 'aifs-hl-link', { href: pageHref(path, item.id, langOf(item)) });
        open.textContent = 'Open the ' + langOf(item) + ' version';
        actions.appendChild(open);
        if (status === 'approx') actions.appendChild(button('aifs-hl-link', 'Hide here', { 'data-action': 'approx-off' }));
        else if (runtime && runtime.approxAvailable) actions.appendChild(button('aifs-hl-link', 'Show on this version', { 'data-action': 'approx-on' }));
      }
      if (item.review === 'conflict') actions.appendChild(button('aifs-hl-link', 'Mark resolved', { 'data-action': 'resolve' }));
      if (status !== 'other-lang' && status !== 'approx') actions.appendChild(button('aifs-hl-link', item.note ? 'Edit note' : 'Add note', { 'data-action': 'edit' }));
      actions.appendChild(button('aifs-hl-link', 'Share', { 'data-action': 'share' }));
      actions.appendChild(button('aifs-hl-link aifs-hl-link-danger', 'Delete', { 'data-action': 'delete' }));
    } else {
      var link = make('a', 'aifs-hl-link', { href: Store.itemUrl(path, item) });
      link.textContent = 'Open';
      actions.appendChild(link);
    }
    body.appendChild(actions);
    li.appendChild(swatch);
    li.appendChild(body);
    return li;
  }

  function renderPanel() {
    if (!ui.panel || ui.panel.hidden || !state.ctx) return;
    var active = document.activeElement;
    var focusRow = active && ui.list.contains(active) && active.closest('.aifs-hl-item');
    var focusKey = focusRow ? { id: focusRow.getAttribute('data-hl-id'), action: active.getAttribute('data-action') || '', tag: active.tagName } : null;
    renderPanelContent();
    if (focusKey) {
      var row = ui.list.querySelector('.aifs-hl-item[data-hl-id="' + focusKey.id + '"]');
      var again = row && (focusKey.action ? row.querySelector('[data-action="' + focusKey.action + '"]') : row.querySelector(focusKey.tag === 'A' ? 'a' : 'button'));
      (again || row || ui.list).focus();
    }
  }

  function renderPanelContent() {
    var pageItems = currentItems();
    var all = Store.pages();
    var total = 0;
    for (var p = 0; p < all.length; p++) total += all[p].items.length;
    ui.tabPage.textContent = 'This page (' + pageItems.length + ')';
    ui.tabAll.textContent = 'All pages (' + total + ')';
    ui.tabPage.setAttribute('aria-selected', state.tab === 'page' ? 'true' : 'false');
    ui.tabAll.setAttribute('aria-selected', state.tab === 'all' ? 'true' : 'false');
    ui.tabPage.tabIndex = state.tab === 'page' ? 0 : -1;
    ui.tabAll.tabIndex = state.tab === 'all' ? 0 : -1;
    ui.list.setAttribute('aria-labelledby', state.tab === 'page' ? 'aifsHlTabPage' : 'aifsHlTabAll');
    if (!ui.panelNotice.querySelector('input')) {
      var message = storageMessage();
      ui.panelNotice.hidden = !message;
      ui.panelNotice.textContent = message;
    }
    ui.importBtn.disabled = Store.info().readOnly;
    ui.list.textContent = '';

    if (state.tab === 'page') {
      if (!pageItems.length) {
        var empty = make('p', 'aifs-hl-empty');
        empty.textContent = 'Select text on the page to highlight it. On a keyboard, select with Shift and the arrow keys, then press Alt+H.';
        ui.list.appendChild(empty);
        return;
      }
      var orphans = 0;
      var review = 0;
      var list = make('ul', 'aifs-hl-items');
      pageItems.forEach(function (item) {
        var runtime = state.runtime[item.id];
        var status = runtime ? runtime.status : item.status;
        if (status === 'orphaned') orphans++;
        if (status === 'moved' && item.review === 'pending') review++;
        list.appendChild(itemNode(item, runtime, 'page', state.ctx.path));
      });
      if (orphans || review) {
        var summary = make('p', 'aifs-hl-orphan-summary');
        var parts = [];
        if (orphans) parts.push(orphans + (orphans === 1 ? ' highlight is' : ' highlights are') + ' orphaned: the text changed and was not found. Nothing was deleted.');
        if (review) parts.push(review + (review === 1 ? ' re-anchored highlight needs' : ' re-anchored highlights need') + ' your review.');
        summary.textContent = parts.join(' ');
        ui.list.appendChild(summary);
      }
      ui.list.appendChild(list);
      return;
    }
    if (!all.length) {
      var none = make('p', 'aifs-hl-empty');
      none.textContent = 'No highlights in this browser yet.';
      ui.list.appendChild(none);
      return;
    }
    all.forEach(function (page) {
      var group = make('section', 'aifs-hl-group');
      var heading = make('h3', 'aifs-hl-group-title');
      var link = make('a', '', { href: pageHref(page.path, '', '') });
      link.textContent = page.title || page.path;
      heading.appendChild(link);
      var count = make('span', 'aifs-hl-group-count');
      count.textContent = (page.kind === 'manual' ? 'Manual \u00b7 ' : '') + page.items.length + (page.items.length === 1 ? ' highlight' : ' highlights');
      heading.appendChild(count);
      group.appendChild(heading);
      var items = make('ul', 'aifs-hl-items');
      page.items.forEach(function (item) {
        var runtime = page.path === state.ctx.path ? state.runtime[item.id] : null;
        items.appendChild(itemNode(item, runtime, 'all', page.path));
      });
      group.appendChild(items);
      ui.list.appendChild(group);
    });
  }

  function revealDetails(node) {
    var parent = node.parentNode;
    while (parent && parent !== document.body) {
      if (parent.tagName === 'DETAILS' && !parent.open) parent.open = true;
      parent = parent.parentNode;
    }
  }

  function jumpTo(target) {
    if (!target) return;
    revealDetails(target);
    if (narrow()) closePanel(false);
    target.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'center' });
    if (target.focus) {
      if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    }
    var id = target.getAttribute('data-hl-id') || target.getAttribute('data-hl-focus') || '';
    var marks = id ? state.article.querySelectorAll('mark.aifs-hl[data-hl-id="' + id + '"]') : [target];
    if (!marks.length) marks = [target];
    for (var i = 0; i < marks.length; i++) {
      marks[i].classList.remove('aifs-hl-flash');
      void marks[i].offsetWidth;
      marks[i].classList.add('aifs-hl-flash');
    }
  }

  function revealHashTarget() {
    var hash = window.location.hash || '';
    if (!/^#hl-[A-Za-z0-9_-]+$/.test(hash)) return;
    var target = firstMark(hash.slice(4));
    if (target) {
      revealDetails(target);
      target.scrollIntoView({ behavior: 'auto', block: 'center' });
    }
  }

  function onListClick(event) {
    var actionButton = event.target.closest('button[data-action]');
    if (!actionButton) return;
    var li = actionButton.closest('.aifs-hl-item');
    var id = li && li.getAttribute('data-hl-id');
    if (!id || !state.ctx) return;
    var action = actionButton.getAttribute('data-action');
    var item = findItem(id);
    if (action === 'jump') jumpTo(firstMark(id));
    else if (action === 'section') {
      if (item) jumpTo(document.getElementById(item.section));
    } else if (action === 'edit') {
      var mark = firstMark(id);
      if (mark && !narrow()) openEditor(id, true, mark);
      else openEditor(id, true, li);
    } else if (action === 'delete') {
      if (Store.remove(state.ctx.path, id)) announce('Highlight deleted.');
      ui.list.focus();
    } else if (action === 'confirm') {
      Store.update(state.ctx.path, id, { status: 'anchored', review: 'confirmed', originalQuote: null });
      announce('Re-anchor confirmed.');
      ui.list.focus();
    } else if (action === 'reject' && item) {
      var original = item.originalQuote;
      var restore = original ? { exact: original.exact, prefix: original.prefix, suffix: original.suffix } : { exact: item.originalExact || item.quote.exact, prefix: item.originalExact ? '' : item.quote.prefix, suffix: item.originalExact ? '' : item.quote.suffix };
      Store.update(state.ctx.path, id, {
        status: 'orphaned',
        review: 'rejected',
        quote: restore,
        position: original ? original.position : item.position,
        orphanHash: ''
      });
      announce('Re-anchor rejected. The highlight is now orphaned. Use Find again to attach it.');
      ui.list.focus();
    } else if (action === 'find') {
      startFindAgain(id);
    } else if (action === 'approx-on') {
      state.approx[id] = true;
      paint(false);
      renderPanel();
    } else if (action === 'approx-off') {
      delete state.approx[id];
      paint(false);
      renderPanel();
    } else if (action === 'resolve') {
      Store.update(state.ctx.path, id, { review: '' });
      announce('Marked resolved.');
    } else if (action === 'share') {
      shareItems([id]);
    }
  }

  function slug(value) {
    return String(value || 'page').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'page';
  }

  function download(filename, type, content) {
    var blob = new Blob([content], { type: type });
    var url = URL.createObjectURL(blob);
    var link = make('a', '', { href: url, download: filename });
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    window.setTimeout(function () {
      URL.revokeObjectURL(url);
      link.remove();
    }, 1000);
  }

  function exportScope(kind) {
    if (!state.ctx) return;
    var selection = state.tab === 'page' ? [state.ctx.path] : null;
    var date = new Date().toISOString().slice(0, 10);
    var name = 'highlights-' + (state.tab === 'page' ? slug(state.ctx.path.split('/').pop()) : 'all') + '-' + date;
    var origin = /^https?:/.test(window.location.origin || '') ? window.location.origin + window.location.pathname.replace(/\/[^/]*$/, '') : 'https://aiengineeringfromscratch.com';
    if (kind === 'md') download(name + '.md', 'text/markdown;charset=utf-8', Store.exportMarkdown(selection, { origin: origin }));
    else download(name + '.json', 'application/json;charset=utf-8', Store.exportJson(selection));
    announce(kind === 'md' ? 'Markdown export ready.' : 'JSON export ready.');
  }

  function importMessage(result) {
    if (!result.ok) {
      if (result.error === 'newer-schema') return 'That file comes from a newer version of this site, or this browser holds newer highlights, so nothing was imported.';
      if (result.error === 'too-large') return 'Importing that file would use too much browser storage, so nothing was imported.';
      return 'That file is not a highlights export and was not imported.';
    }
    var message = 'Imported ' + result.added + ' new, updated ' + result.updated + ', kept ' + result.unchanged + ' unchanged';
    if (result.conflicts) message += ', kept ' + result.conflicts + ' conflicting ' + (result.conflicts === 1 ? 'note' : 'notes') + ' as conflict copies to review';
    if (result.skipped) message += ', skipped ' + result.skipped + ' invalid';
    return message + '.';
  }

  function onImport() {
    var file = ui.importInput.files && ui.importInput.files[0];
    ui.importInput.value = '';
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showNotice('That file is larger than 5 MB and was not imported.');
      return;
    }
    file.text().then(function (content) {
      var message = importMessage(Store.importJson(content));
      renderPanel();
      showNotice(message);
      announce(message);
    }).catch(function () {
      showNotice('The file could not be read.');
    });
  }

  function showNotice(message) {
    ui.panelNotice.hidden = false;
    ui.panelNotice.textContent = message;
  }

  function normalizeLang(value) {
    var lang = String(value || 'en').toLowerCase();
    return /^[a-z]{2,3}(?:-[a-z0-9]{2,8})?$/.test(lang) ? lang : 'en';
  }

  function mount(article, ctx) {
    unmount();
    if (!article || !ctx || !ctx.path) return;
    ensureUi();
    bindDocument();
    state.article = article;
    state.ctx = { path: String(ctx.path), lang: normalizeLang(ctx.lang), title: String(ctx.title || '') };
    state.runtime = {};
    state.approx = {};
    state.settled = false;
    state.settleDeadline = Date.now() + SETTLE_MAX;
    state.translated = isTranslated();
    readShare();
    ui.launcher.hidden = false;
    document.documentElement.classList.add('aifs-hl-launch-on');
    paint(false);
    renderPanel();
    state.hashPending = /^#hl-/.test(window.location.hash || '');
    state.userMoved = false;
    revealHashTarget();
    scheduleSettle();
  }

  function unmount() {
    hideToolbar();
    if (state.editor && !closeEditor(false)) {
      state.editor = null;
      ui.editor.hidden = true;
    }
    stopObserving();
    window.clearTimeout(state.settleTimer);
    window.clearTimeout(state.mutationTimer);
    if (state.article) {
      try { unpaint(); } catch (_) {}
    }
    state.article = null;
    state.ctx = null;
    state.runtime = {};
    state.findAgain = '';
    if (ui.launcher) ui.launcher.hidden = true;
    document.documentElement.classList.remove('aifs-hl-launch-on');
    if (ui.shareBar) ui.shareBar.hidden = true;
    if (ui.panel && !ui.panel.hidden) closePanel(false);
  }

  window.AIFSHighlights = {
    mount: mount,
    unmount: unmount,
    refresh: function () {
      if (!state.article) return;
      paint(true);
      renderPanel();
    },
    settle: function () {
      if (!state.article) return;
      window.clearTimeout(state.settleTimer);
      state.settled = true;
      paint(true);
      renderPanel();
      revealPendingHash();
    },
    status: function () {
      var copy = {};
      for (var id in state.runtime) {
        if (Object.prototype.hasOwnProperty.call(state.runtime, id)) copy[id] = state.runtime[id].status;
      }
      return copy;
    },
    isSettled: function () { return state.settled; }
  };
}());
