/**
 * Read-aloud support built on the browser's built-in SpeechSynthesis API.
 *
 * Injects a speaker button into the site header (between the language picker
 * and the theme toggle) on any page that has readable article content, plus a
 * floating control bar for pause/stop/speed while playback runs.
 *
 * Scope is the article prose: headings, paragraphs, lists, tables, the lesson
 * motto and meta tags, quiz text and figure captions. Code blocks and rendered
 * diagrams are skipped — narrating those needs its own parsing layer and lands
 * separately.
 *
 * No network calls and no dependencies: everything is native Web Speech API.
 */
(function () {
  'use strict';

  if (typeof window === 'undefined') return;
  var VERSION = '20260809a';
  if (window.__AIFS_TTS_VERSION === VERSION && window.AIFS_TTS) return;
  window.__AIFS_TTS_VERSION = VERSION;

  function localSilentMode() {
    if (location.hostname !== '127.0.0.1' && location.hostname !== 'localhost') return false;
    try { return new URLSearchParams(location.search).get('ttsTest') === 'silent'; } catch (e) { return false; }
  }

  function SilentUtterance(text) {
    this.text = text;
    this.rate = 1;
    this.lang = '';
    this.voice = null;
    this.onend = null;
    this.onerror = null;
  }

  function silentSynthesizer() {
    var current = null;
    return {
      speaking: false,
      pending: false,
      paused: false,
      onvoiceschanged: null,
      getVoices: function () {
        var locale = document.documentElement.getAttribute('lang') || 'en-US';
        return [{ name: 'Silent QA voice', lang: locale, voiceURI: 'aifs-silent', localService: true, default: true }];
      },
      speak: function (utterance) {
        current = utterance;
        this.speaking = true;
        this.pending = false;
      },
      cancel: function () {
        current = null;
        this.speaking = false;
        this.pending = false;
        this.paused = false;
      },
      pause: function () { this.paused = true; },
      resume: function () { this.paused = false; this.speaking = !!current; },
      addEventListener: function () {},
    };
  }

  var silentMode = localSilentMode();
  // The optional overrides and local silent mode are tiny test seams. They let
  // browser QA exercise every control without producing audible speech.
  var synth = window.__AIFS_TTS_SYNTH__ || window.speechSynthesis;
  var Utterance = window.__AIFS_TTS_UTTERANCE__ || window.SpeechSynthesisUtterance;
  if (silentMode) {
    synth = silentSynthesizer();
    Utterance = SilentUtterance;
  }
  var supported = !!(synth && typeof Utterance === 'function');

  var RATE_KEY = 'tts:rate';
  var LEGACY_VOICE_KEY = 'tts:voice';
  var VOICE_KEY_PREFIX = 'tts:voice:';
  var MAX_CHUNK = 160;

  // Regions that are chrome, not content — nothing inside is ever read.
  var HARD_SKIP = [
    'script',
    'style',
    'svg',
    'canvas',
    'noscript',
    'nav',
    'textarea',
    'input',
    'select',
    '.katex',
    '.lesson-sidebar',
    '.toc-sidebar',
    '.site-header',
    '.site-footer',
    '.tts-bar',
    '.copy-btn',
    '[aria-hidden="true"]',
    '[data-tts-skip]',
  ].join(',');

  // Interactive elements are skipped by default (copy buttons, tabs, controls)
  // except these, which carry real content.
  var ALLOW_SELECTOR = '.quiz-option,.quiz-explanation,[data-tts-read]';

  var INTERACTIVE_SKIP = 'button,code,[role="button"]';

  var BLOCK_SELECTOR = [
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'p', 'li', 'blockquote', 'dd', 'dt', 'figcaption', 'summary', 'tr',
    // Lesson prose and panels build their text out of plain divs.
    '.motto',
    '.lesson-meta-tag',
    '.ai-panel-title',
    '.ai-panel-subtitle',
    '.quiz-question-num',
    '.quiz-question-text',
    '.quiz-option',
    '.quiz-explanation',
    '.quiz-score-number',
    '.quiz-score-label',
    '.quiz-deeper',
    // Interactive lesson figures: title + caption carry the explanation.
    '.lf-label',
    '.lf-cap',
    '[data-tts-read]',
  ].join(',');

  // A block that contains one of these is a wrapper: read only its own text
  // so a list item holding a code block still reads its sentence, and the
  // code inside it stays unread.
  var NESTED_PROBE = BLOCK_SELECTOR + ',pre';

  // Storage throws instead of returning null when a browser blocks it
  // (Safari with cookies off, sandboxed iframes), so every read goes through
  // these — lsGet() runs on the collection hot path and must never throw.
  function lsGet(key) {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }

  function lsSet(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      // Storage disabled; the preference just won't persist.
    }
  }

  // Only an explicit lesson continuation may carry playback to another page.
  // The target route is stored so an unrelated page can never inherit audio.
  var RESUME_KEY = 'tts:resume';

  function routeKey(url) {
    try {
      var parsed = new URL(url, location.href);
      if (parsed.origin !== location.origin) return '';
      return parsed.pathname + parsed.search;
    } catch (e) {
      return '';
    }
  }

  function setResumeTarget(url) {
    var target = routeKey(url);
    if (!target) return clearResumeTarget();
    try {
      sessionStorage.setItem(RESUME_KEY, JSON.stringify({ target: target, createdAt: Date.now() }));
    } catch (e) {
      // sessionStorage may be disabled; playback just won't carry over.
    }
  }

  function clearResumeTarget() {
    try {
      sessionStorage.removeItem(RESUME_KEY);
    } catch (e) {
      // sessionStorage may be disabled.
    }
  }

  function takeResumeTarget() {
    var raw = null;
    try {
      raw = sessionStorage.getItem(RESUME_KEY);
      sessionStorage.removeItem(RESUME_KEY);
    } catch (e) {
      return false;
    }
    if (!raw) return false;
    try {
      var intent = JSON.parse(raw);
      return !!(
        intent &&
        intent.target === routeKey(location.href) &&
        typeof intent.createdAt === 'number' &&
        Date.now() - intent.createdAt < 60000
      );
    } catch (e) {
      return false;
    }
  }

  var reducedMotion =
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
  var reducedMotionListener = null;

  function prefersReducedMotion() {
    return !!(reducedMotion && reducedMotion.matches);
  }

  function bindReducedMotionPreference() {
    if (!reducedMotion || reducedMotionListener) return;
    reducedMotionListener = function (event) {
      if (event.matches) commitDragInertiaForReducedMotion();
    };
    if (typeof reducedMotion.addEventListener === 'function') {
      reducedMotion.addEventListener('change', reducedMotionListener);
    } else if (typeof reducedMotion.addListener === 'function') {
      reducedMotion.addListener(reducedMotionListener);
    }
  }

  function disposeReducedMotionPreference() {
    if (!reducedMotion || !reducedMotionListener) return;
    if (typeof reducedMotion.removeEventListener === 'function') {
      reducedMotion.removeEventListener('change', reducedMotionListener);
    } else if (typeof reducedMotion.removeListener === 'function') {
      reducedMotion.removeListener(reducedMotionListener);
    }
    reducedMotionListener = null;
  }

  var state = {
    chunks: [],
    index: 0,
    mode: 'idle',
    message: '',
    scope: null,
    // Bar shown as a single puck, and the drag-vs-click guard.
    collapsed: false,
    dragged: false,
    highlighted: null,
    utterance: null,
    // Playback health: sequence token for stale callbacks, strong refs against
    // GC, stall counter, and the offline voice a stall fell back to.
    seq: 0,
    spoken: [],
    stalls: 0,
    idleTicks: 0,
    forcedLocal: null,
    watchdog: null,
    observer: null,
    refreshTimer: null,
    navigationTarget: '',
  };

  var els = {};

  /* ---------------------------------------------------------------- text */

  function contentRoot(scope) {
    if (scope && scope.nodeType === 1 && document.contains(scope)) return scope;
    var candidates = [
      '[data-tts-root]',
      '.lesson-article',
      '#lessonContent',
      'main#main',
      'main',
      '.container',
    ];
    for (var i = 0; i < candidates.length; i++) {
      var el = document.querySelector(candidates[i]);
      if (el && el.textContent.trim().length > 40) return el;
    }
    return null;
  }

  function isSkipped(el) {
    if (!el.closest) return true;
    var explicit = el.closest('[data-tts-read]');
    if (explicit && !explicit.closest('[data-tts-skip],.site-header,.site-footer,.tts-bar,[aria-hidden="true"]')) return false;
    if (el.closest(HARD_SKIP)) return true;
    if (el.closest(ALLOW_SELECTOR)) return false;
    // Code blocks and rendered diagrams are not narrated by this reader.
    if (el.closest('pre')) return true;
    return !!el.closest(INTERACTIVE_SKIP);
  }

  function isVisible(el) {
    if (el.hidden) return false;
    // offsetParent is null for display:none (and for position:fixed, which
    // none of the readable blocks use).
    return el.offsetParent !== null || el.getClientRects().length > 0;
  }

  function clean(text) {
    var value = String(text || '')
      .replace(/\s+/g, ' ')
      .replace(/[`*_#~|]+/g, ' ')
      .replace(/\s+([,.;:!?])/g, '$1')
      .trim();
    var replacements = [
      [/\bCI\s*\/\s*CD\b/gi, 'C I slash C D'],
      [/\bLLMs?\b/g, function (match) { return match === 'LLMs' ? 'L L M s' : 'L L M'; }],
      [/\bAPIs?\b/g, function (match) { return match === 'APIs' ? 'A P I s' : 'A P I'; }],
      [/\bMCP\b/g, 'M C P'],
      [/\bSLOs?\b/g, function (match) { return match === 'SLOs' ? 'S L O s' : 'S L O'; }],
      [/\bADRs?\b/g, function (match) { return match === 'ADRs' ? 'A D R s' : 'A D R'; }],
      [/\bJSON\b/g, 'J S O N'],
      [/\bHTTP\b/g, 'H T T P'],
      [/\bSDKs?\b/g, function (match) { return match === 'SDKs' ? 'S D K s' : 'S D K'; }],
      [/\s*[→⇒]\s*/g, ' leads to '],
      [/\s*≤\s*/g, ' less than or equal to '],
      [/\s*≥\s*/g, ' greater than or equal to '],
    ];
    for (var i = 0; i < replacements.length; i++) value = value.replace(replacements[i][0], replacements[i][1]);
    return value.replace(/\s+/g, ' ').trim();
  }

  /** Preserve visual line breaks as spoken word boundaries. */
  function readableText(el) {
    var out = '';
    for (var i = 0; i < el.childNodes.length; i++) {
      var node = el.childNodes[i];
      if (node.nodeType === 3) {
        out += node.nodeValue;
      } else if (node.nodeType === 1) {
        if (node.tagName === 'BR') out += ' ';
        else if (!isSkipped(node)) out += readableText(node);
      }
    }
    return out;
  }

  /** Split a long block into speakable pieces at sentence boundaries. */
  function split(text) {
    if (text.length <= MAX_CHUNK) return [text];
    var sentences = text.match(/[^.!?]+[.!?]*\s*/g) || [text];
    var out = [];
    var buf = '';
    for (var i = 0; i < sentences.length; i++) {
      var s = sentences[i];
      while (s.length > MAX_CHUNK) {
        // A single monster sentence: break it on the last space in range.
        var cut = s.lastIndexOf(' ', MAX_CHUNK);
        if (cut <= 0) cut = MAX_CHUNK;
        if (buf) {
          out.push(buf.trim());
          buf = '';
        }
        out.push(s.slice(0, cut).trim());
        s = s.slice(cut);
      }
      if ((buf + s).length > MAX_CHUNK) {
        out.push(buf.trim());
        buf = s;
      } else {
        buf += s;
      }
    }
    if (buf.trim()) out.push(buf.trim());
    return out.filter(Boolean);
  }

  /** Text belonging to this element but not to any nested readable block. */
  function ownText(el) {
    var out = '';
    for (var i = 0; i < el.childNodes.length; i++) {
      var n = el.childNodes[i];
      if (n.nodeType === 3) {
        out += n.nodeValue;
      } else if (n.nodeType === 1 && !n.matches(BLOCK_SELECTOR) && !isSkipped(n)) {
        if (n.tagName === 'BR') {
          out += ' ';
          continue;
        }
        // Descend into plain wrappers so nested blocks stay un-duplicated.
        out += n.querySelector(BLOCK_SELECTOR) ? ownText(n) : readableText(n);
      }
    }
    return out;
  }

  function tableRowText(row) {
    var cells = Array.prototype.slice.call(row.querySelectorAll(':scope > th, :scope > td'));
    if (!cells.length) return '';
    var table = row.closest('table');
    var headerCells = table ? Array.prototype.slice.call(table.querySelectorAll('thead tr:first-child > th, thead tr:first-child > td')) : [];
    var inHead = !!row.closest('thead');
    if (inHead || cells.every(function (cell) { return cell.tagName === 'TH'; })) {
      return 'Table columns. ' + cells.map(function (cell) { return clean(cell.textContent); }).filter(Boolean).join('. ');
    }
    return cells.map(function (cell, index) {
      var value = clean(cell.textContent);
      var label = headerCells[index] ? clean(headerCells[index].textContent) : '';
      return label && value ? label + ': ' + value : value;
    }).filter(Boolean).join('. ');
  }

  function sectionName(el) {
    if (!el || !el.closest) return '';
    if (/^H[1-6]$/.test(el.tagName)) return clean(readableText(el));
    var namedSection = el.closest('[data-tts-section]');
    var namedLabel = namedSection && namedSection.getAttribute('data-tts-section');
    if (namedLabel) return clean(namedLabel);
    var section = el.closest('[data-tts-section],article,section');
    var heading = section && section.querySelector('h1,h2,h3,h4,h5,h6');
    if (heading) return clean(readableText(heading));
    var cursor = el.previousElementSibling;
    while (cursor) {
      if (/^H[1-6]$/.test(cursor.tagName)) return clean(readableText(cursor));
      cursor = cursor.previousElementSibling;
    }
    return '';
  }

  /** Build the play queue: [{ text, el }] in document order. */
  function collect(scope) {
    var root = contentRoot(scope);
    if (!root) return [];
    var blocks = root.querySelectorAll(BLOCK_SELECTOR);
    var chunks = [];
    var seen = 0;
    for (var i = 0; i < blocks.length; i++) {
      var el = blocks[i];
      if (isSkipped(el) || !isVisible(el)) continue;
      if (el.closest('tr') && !el.matches('tr')) continue;
      var text;
      if (el.hasAttribute('data-tts-label')) {
        text = clean(el.getAttribute('data-tts-label'));
      } else if (el.matches('tr')) {
        text = clean(tableRowText(el));
      } else if (el.querySelector(NESTED_PROBE)) {
        // A wrapper (list item holding a code block, panel holding headings).
        // Read only its own text; the nested blocks come round on their own.
        text = clean(ownText(el));
      } else {
        text = clean(readableText(el));
        if (el.matches('.quiz-option')) {
          // Markup is <span>A</span><span>answer</span> with no whitespace
          // between them, so read the letter as its own beat.
          var letter = el.querySelector('.opt-letter');
          var label = letter ? clean(letter.textContent || '') : '';
          var rest = label ? clean(text.slice(label.length)) : text;
          text = 'Option ' + (label ? label + '. ' : '') + rest;
        } else if (el.matches('.quiz-explanation')) {
          text = 'Explanation. ' + text;
        } else if (el.matches('.lf-label')) {
          text = 'Interactive figure: ' + text + '.';
        }
      }
      if (text.length < 2) continue;
      var parts = split(text);
      for (var j = 0; j < parts.length; j++) {
        chunks.push({
          text: parts[j],
          el: el,
          section: sectionName(el),
          words: parts[j].split(/\s+/).filter(Boolean).length,
        });
      }
      seen++;
      if (seen > 4000) break;
    }
    return chunks;
  }

  /* --------------------------------------------------------------- voices */

  /**
   * Voice quality varies wildly per platform, and the browser default is often
   * the worst option available (Windows ships robotic SAPI5 voices as default).
   * Score every voice so "Auto" lands on the best neural/cloud voice present.
   */

  // Named winners, best first. Matched loosely against voice.name.
  var PREFERRED = [
    // Edge / Windows 11 neural voices
    'microsoft aria', 'microsoft jenny', 'microsoft guy', 'microsoft ava',
    'microsoft andrew', 'microsoft emma', 'microsoft brian', 'microsoft libby',
    'microsoft ryan', 'microsoft sonia',
    // Chrome cloud voices
    'google us english', 'google uk english female', 'google uk english male',
    // Apple high-quality voices
    'samantha', 'ava', 'allison', 'tom', 'evan', 'zoe', 'nathan', 'joelle',
    'serena', 'daniel', 'alex',
  ];

  // macOS novelty voices — comedic, unusable for prose.
  var NOVELTY = /^(albert|bad news|bahh|bells|boing|bubbles|cellos|deranged|good news|jester|organ|superstar|trinoids|whisper|wobble|zarvox|junior|ralph|fred|kathy|bruce|princess|grandma|grandpa|rocko|shelley|sandy|eddy|flo|reed|grandpa|bells)\b/i;

  function pageLocale() {
    var value = document.documentElement.getAttribute('lang') || navigator.language || 'en';
    return String(value).replace('_', '-').toLowerCase();
  }

  function languageBase(value) {
    return String(value || '').toLowerCase().split(/[-_]/)[0];
  }

  function sameLanguage(voice, locale) {
    return languageBase(voice && voice.lang) === languageBase(locale);
  }

  function voiceKey() {
    return VOICE_KEY_PREFIX + pageLocale();
  }

  function score(v, locale) {
    var name = (v.name || '').toLowerCase();
    var lang = (v.lang || '').toLowerCase();
    var s = 0;
    var wanted = locale || pageLocale();

    if (NOVELTY.test(v.name || '')) return -100;

    // Explicit quality markers in the voice name.
    if (/natural|neural/.test(name)) s += 60;
    if (/premium|enhanced/.test(name)) s += 50;
    if (/\bonline\b/.test(name)) s += 40;
    if (/^google/.test(name)) s += 35;
    // SAPI5 desktop voices are the robotic legacy set.
    if (/desktop/.test(name)) s -= 30;
    if (v.localService === false) s += 15;

    for (var i = 0; i < PREFERRED.length; i++) {
      if (name.indexOf(PREFERRED[i]) !== -1) {
        s += 100 - i; // earlier in the list wins ties
        break;
      }
    }

    // Match the content language first. A beautiful English voice is still
    // the wrong default for Spanish, Hindi, Japanese, or any other locale.
    if (sameLanguage(v, wanted)) s += 260;
    else s -= 250;
    if (lang === wanted) s += 35;
    if (v.default) s += 2;

    return s;
  }

  function voices(locale) {
    var wanted = locale || pageLocale();
    var all = (synth.getVoices() || []).slice();
    var ranked = all.map(function (v, i) {
      return { v: v, s: score(v, wanted), i: i };
    });
    ranked.sort(function (a, b) {
      return b.s - a.s || a.i - b.i;
    });
    return ranked
      .filter(function (r) {
        return r.s > -100;
      })
      .map(function (r) {
        return r.v;
      });
  }

  function bestVoice() {
    var locale = pageLocale();
    var list = voices(locale);
    for (var i = 0; i < list.length; i++) {
      if (sameLanguage(list[i], locale)) return list[i];
    }
    // Let the browser choose for utterance.lang when no matching installed
    // voice exists. Forcing an unrelated English voice is worse.
    return null;
  }

  function selectedVoice() {
    // A voice that kept dropping has been replaced for this session.
    if (state.forcedLocal) return state.forcedLocal;
    var wanted = lsGet(voiceKey());
    if (!wanted && languageBase(pageLocale()) === 'en') wanted = lsGet(LEGACY_VOICE_KEY);
    var all = synth.getVoices() || [];
    if (wanted) {
      for (var i = 0; i < all.length; i++) {
        if (all[i].voiceURI === wanted) return all[i];
      }
    }
    // No stored pick (or it vanished with an OS update): auto-pick the best.
    return bestVoice();
  }

  function fillVoices() {
    if (!els.voice) return;
    var locale = pageLocale();
    var list = voices(locale);
    if (!list.length) return;
    var current = lsGet(voiceKey()) || '';
    var best = bestVoice();
    els.voice.innerHTML = '';
    var def = document.createElement('option');
    def.value = '';
    def.textContent = 'Auto — ' + (best ? best.name : locale.toUpperCase());
    els.voice.appendChild(def);
    for (var i = 0; i < list.length; i++) {
      var o = document.createElement('option');
      o.value = list[i].voiceURI;
      o.textContent =
        (sameLanguage(list[i], locale) ? '★ ' : '') + list[i].name + ' (' + list[i].lang + ')';
      els.voice.appendChild(o);
    }
    els.voice.value = current;
    // A stored voice that no longer exists falls back to Auto.
    if (els.voice.value !== current) els.voice.value = '';
  }

  function rate() {
    var stored = parseFloat(lsGet(RATE_KEY));
    return stored >= 0.5 && stored <= 3 ? stored : 1;
  }

  /* ------------------------------------------------------------- playback */

  function isActive() {
    return state.mode !== 'idle';
  }

  function isPlaying() {
    return state.mode === 'playing';
  }

  function isPaused() {
    return state.mode === 'paused';
  }

  function isWaiting() {
    return state.mode === 'waiting';
  }

  function remainingMinutes() {
    var words = 0;
    for (var i = state.index; i < state.chunks.length; i++) words += state.chunks[i].words || 0;
    return words ? Math.max(1, Math.ceil(words / (180 * rate()))) : 0;
  }

  function highlight(el) {
    if (state.highlighted === el) return;
    if (state.highlighted) state.highlighted.classList.remove('tts-reading');
    state.highlighted = el || null;
    if (!el) return;
    el.classList.add('tts-reading');
    var box = el.getBoundingClientRect();
    if (box.top < 80 || box.bottom > window.innerHeight - 80) {
      // Auto-scrolling at every chunk boundary is the most motion-heavy part
      // of the feature, so honour the same preference the CSS does.
      el.scrollIntoView({ block: 'center', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    }
  }

  /**
   * The lesson page keeps building itself after the first paint (panels,
   * diagrams, figures). If the block we are on has been swapped out, rebuild
   * the queue against the live DOM and keep our place by text.
   */
  function refreshQueue(restartIfMissing) {
    var current = state.chunks[state.index];
    var fresh = collect(state.scope);
    if (!fresh.length) return false;
    var at = -1;
    for (var i = 0; i < fresh.length; i++) {
      if (current && fresh[i].el === current.el && fresh[i].text === current.text) {
        at = i;
        break;
      }
    }
    if (at < 0) {
      for (var j = 0; j < fresh.length; j++) {
        if (current && fresh[j].text === current.text) {
          at = j;
          break;
        }
      }
    }
    state.chunks = fresh;
    state.index = at >= 0 ? at : Math.min(state.index, fresh.length - 1);
    render();
    if (restartIfMissing && at < 0 && isPlaying()) {
      cancelSpeech();
      deferSpeak();
    }
    return true;
  }

  function scheduleRefresh() {
    if (!isActive()) return;
    clearTimeout(state.refreshTimer);
    state.refreshTimer = setTimeout(function () {
      state.refreshTimer = null;
      refreshQueue(true);
    }, 90);
  }

  function nonNarrationClasses(value) {
    return String(value || '')
      .split(/\s+/)
      .filter(function (name) {
        return name && name !== 'tts-reading' && name !== 'tts-active';
      })
      .sort()
      .join(' ');
  }

  function isNarrationMutation(mutation, target) {
    if (target.closest('.tts-bar,.tts-from-here,.tts-toggle')) return true;
    if (mutation.type !== 'attributes' || mutation.attributeName !== 'class') return false;

    // Highlight movement removes tts-reading from the previous block before
    // adding it to the next one. Mutation callbacks run after both operations,
    // so comparing only against state.highlighted misses the removal and makes
    // narration rebuild its own queue. Ignore a class mutation only when the
    // non-narration classes are unchanged; real application class changes still
    // refresh the readable DOM.
    return nonNarrationClasses(mutation.oldValue) ===
      nonNarrationClasses(target.getAttribute('class'));
  }

  function observeQueue() {
    if (state.observer || typeof MutationObserver !== 'function' || !document.body) return;
    state.observer = new MutationObserver(function (mutations) {
      var meaningful = mutations.some(function (mutation) {
        var target = mutation.target && mutation.target.nodeType === 1 ? mutation.target : mutation.target.parentElement;
        if (!target) return false;
        if (isNarrationMutation(mutation, target)) return false;
        return true;
      });
      if (meaningful) scheduleRefresh();
    });
    state.observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeOldValue: true,
      attributeFilter: ['hidden', 'aria-hidden', 'open', 'class', 'style'],
    });
  }

  function disconnectQueueObserver() {
    clearTimeout(state.refreshTimer);
    state.refreshTimer = null;
    if (state.observer) state.observer.disconnect();
    state.observer = null;
  }

  function speakCurrent() {
    if (state.index >= state.chunks.length) {
      stop();
      return;
    }
    var stale = state.chunks[state.index].el;
    if (stale && (!document.contains(stale) || !isVisible(stale))) refreshQueue(false);
    var chunk = state.chunks[state.index];
    if (!chunk) {
      stop();
      return;
    }
    var u = new Utterance(chunk.text);
    u.rate = rate();
    u.lang = pageLocale();
    var v = selectedVoice();
    if (v) {
      u.voice = v;
      u.lang = v.lang;
    }
    // Callbacks from an utterance we have already moved past must not advance
    // the queue: the watchdog can re-speak a chunk whose original is still
    // sitting somewhere inside the engine.
    var token = ++state.seq;

    u.onend = function () {
      if (token !== state.seq || !isPlaying()) return;
      state.index++;
      state.stalls = 0;
      render();
      // Calling speak() synchronously from inside onend wedges the queue in
      // some Chromium builds; yielding first is reliable.
      deferSpeak();
    };
    u.onerror = function (e) {
      // "interrupted"/"canceled" are the normal result of stop()/next().
      if (e && (e.error === 'interrupted' || e.error === 'canceled')) return;
      if (token !== state.seq || !isPlaying()) return;
      state.index++;
      state.stalls = 0;
      if (state.index < state.chunks.length) deferSpeak();
      else stop();
    };

    state.utterance = u;
    // Chromium can garbage-collect an in-flight utterance and cut it off, so
    // hold a strong reference to the recent ones.
    state.spoken.push(u);
    if (state.spoken.length > 8) state.spoken.shift();

    highlight(chunk.el);
    synth.speak(u);
  }

  /* ------------------------------------------------------- read from here */

  /**
   * The readable block an arbitrary node sits in. When the node is inside
   * something unreadable (a code block), the node itself is returned so the
   * caller can start from whatever comes after it.
   */
  function blockOf(node) {
    var el = node && node.nodeType === 3 ? node.parentNode : node;
    var first = el;
    var root = contentRoot();
    while (el && el.nodeType === 1) {
      if (el.matches(BLOCK_SELECTOR) && !isSkipped(el)) return el;
      if (root && el === root) break;
      el = el.parentNode;
    }
    return first && first.nodeType === 1 ? first : null;
  }

  /** Queue position for a block: itself, or the next one that follows it. */
  function indexOfBlock(el) {
    if (!el) return 0;
    for (var i = 0; i < state.chunks.length; i++) {
      var c = state.chunks[i].el;
      if (c === el || (c && (c.contains(el) || el.contains(c)))) return i;
    }
    // Not queued (skipped block): fall through to the next one in the document.
    for (var j = 0; j < state.chunks.length; j++) {
      var pos = el.compareDocumentPosition(state.chunks[j].el);
      if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return j;
    }
    return 0;
  }

  /** The block the current text selection starts in, if any. */
  function selectedBlock() {
    var sel = window.getSelection && window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) return null;
    if (!clean(sel.toString())) return null;
    var root = contentRoot();
    var node = sel.getRangeAt(0).startContainer;
    if (root && !root.contains(node.nodeType === 3 ? node.parentNode : node)) return null;
    return blockOf(node);
  }

  function readFromSelection() {
    var block = selectedBlock();
    if (!block) return false;
    hideSelectionButton();
    var sel = window.getSelection && window.getSelection();
    if (sel && sel.removeAllRanges) sel.removeAllRanges();
    return start(false, block);
  }

  function start(silentIfEmpty, fromEl, scopeEl) {
    if (!supported) {
      if (!silentIfEmpty) flash('Read aloud is unavailable in this browser');
      return false;
    }
    state.scope = scopeEl && document.contains(scopeEl) ? scopeEl : null;
    state.chunks = collect(state.scope);
    if (!state.chunks.length) {
      if (!silentIfEmpty) flash('Nothing to read on this page');
      state.scope = null;
      return false;
    }
    cancelSpeech();
    state.index = fromEl ? indexOfBlock(fromEl) : 0;
    state.mode = 'playing';
    state.message = '';
    state.stalls = 0;
    clearResumeTarget();
    observeQueue();
    startWatchdog();
    render();
    speakCurrent();
    return true;
  }

  function pause() {
    if (!isPlaying()) return;
    state.mode = 'paused';
    clearResumeTarget();
    synth.pause();
    render();
  }

  function resume() {
    if (!isPaused()) return;
    state.mode = 'playing';
    synth.resume();
    render();
  }

  function stop() {
    state.mode = 'idle';
    state.message = '';
    state.utterance = null;
    state.chunks = [];
    state.index = 0;
    state.scope = null;
    state.navigationTarget = '';
    clearResumeTarget();
    stopWatchdog();
    disconnectQueueObserver();
    cancelSpeech();
    highlight(null);
    hideSelectionButton();
    render();
  }

  function fail(message) {
    state.mode = 'error';
    state.message = message;
    clearResumeTarget();
    stopWatchdog();
    disconnectQueueObserver();
    cancelSpeech();
    highlight(null);
    render();
  }

  /**
   * Carry playback across a lesson navigation. Lesson bodies are fetched after
   * load, so poll until there is something to read before starting.
   */
  function autoResume() {
    if (!takeResumeTarget()) return;
    state.mode = 'waiting';
    render();

    var tries = 0;
    var lastSize = -1;
    var timer = setInterval(function () {
      if (!isWaiting()) {
        clearInterval(timer);
        return;
      }
      tries++;
      // Wait for the article to stop growing, otherwise we would queue up
      // paragraphs that the page is about to replace — and the highlight
      // would land on detached nodes.
      var root = contentRoot();
      var size = root ? root.textContent.trim().length : 0;
      if (!size || size !== lastSize) {
        lastSize = size;
        if (tries <= 60) return;
      }
      if (start(true)) {
        clearInterval(timer);
        armGestureFallback();
        return;
      }
      if (tries > 60) {
        // ~15s: the page has nothing to read, so drop the hand-off.
        state.mode = 'idle';
        clearResumeTarget();
        clearInterval(timer);
        render();
      }
    }, 250);
  }

  function isLessonContinuationLink(link) {
    if (!link || !link.matches('.lesson-nav-btn,.continue-link')) return false;
    try {
      var url = new URL(link.href, location.href);
      return url.origin === location.origin && /\/lesson\.html$/.test(url.pathname) && !!url.searchParams.get('path');
    } catch (e) {
      return false;
    }
  }

  function bindNavigationResume() {
    document.addEventListener('click', function (event) {
      var link = event.target.closest && event.target.closest('a[href]');
      if (!link) return;
      state.navigationTarget = '';
      clearResumeTarget();
      if (!isPlaying() || !isLessonContinuationLink(link)) return;
      if (silentMode) {
        var silentUrl = new URL(link.href, location.href);
        silentUrl.searchParams.set('ttsTest', 'silent');
        link.href = silentUrl.toString();
      }
      state.navigationTarget = routeKey(link.href);
      setResumeTarget(link.href);
    }, true);
  }

  /**
   * Some browsers refuse to speak on a page the user has not interacted with
   * yet. If that happened, the first click or key press starts it.
   */
  function armGestureFallback() {
    if (synth.speaking) return;
    var retry = function () {
      document.removeEventListener('pointerdown', retry, true);
      document.removeEventListener('keydown', retry, true);
      if (isPlaying() && !synth.speaking) speakCurrent();
    };
    document.addEventListener('pointerdown', retry, true);
    document.addEventListener('keydown', retry, true);
    setTimeout(function () {
      if (isPlaying() && !synth.speaking) {
        flash('Press play or click the page to continue reading');
      }
    }, 1200);
  }

  function jump(delta) {
    if (!isPlaying() && !isPaused()) return;
    var next = state.index + delta;
    if (next < 0) next = 0;
    if (next >= state.chunks.length) {
      stop();
      return;
    }
    state.index = next;
    state.mode = 'playing';
    cancelSpeech();
    render();
    speakCurrent();
  }

  /**
   * cancel() does not silence the callbacks of the utterance it kills: WebKit
   * still fires onend for a cancelled utterance, and engines that report an
   * error without a recognised `error` string fall through the same path. Bump
   * the sequence first so anything arriving afterwards is stale and cannot
   * advance the queue or start a second reader.
   */
  function cancelSpeech() {
    state.seq++;
    if (supported) synth.cancel();
  }

  /**
   * Hand control to the next chunk on a fresh task. Each deferral remembers
   * the sequence it was scheduled under, so if anything else takes over in the
   * meantime — a stall retry, a jump, a stop — this one quietly drops instead
   * of starting a second reader.
   */
  function deferSpeak() {
    var expected = state.seq;
    setTimeout(function () {
      if (!isPlaying()) return;
      if (state.seq !== expected) return;
      speakCurrent();
    }, 0);
  }

  /**
   * Network-backed voices (Google's, and Edge's "Online (Natural)" set) can
   * drop an utterance without ever firing onend or onerror. The queue then
   * stalls silently while the bar still says it is reading, which is heard as
   * "the voice stops after a few seconds".
   *
   * Nothing in the API reports this, so poll for it: an engine that is neither
   * speaking nor pending, while we believe playback is running, has dropped
   * the utterance.
   */
  function startWatchdog() {
    stopWatchdog();
    state.idleTicks = 0;
    state.watchdog = setInterval(function () {
      if (!isPlaying()) return;
      if (synth.speaking || synth.pending) {
        state.idleTicks = 0;
        return;
      }
      // Two ticks, so an ordinary gap between utterances is not read as a stall.
      if (++state.idleTicks < 2) return;
      state.idleTicks = 0;
      recoverFromStall();
    }, 400);
  }

  function stopWatchdog() {
    if (state.watchdog) clearInterval(state.watchdog);
    state.watchdog = null;
  }

  function recoverFromStall() {
    state.stalls++;
    // Give up on the fourth ignored attempt; a fifth only skips one more chunk.
    if (state.stalls >= 4) {
      fail('Speech engine stopped responding');
      return;
    }
    var local = state.stalls >= 2 && !state.forcedLocal ? localVoice() : null;
    if (local) {
      // A cloud voice that keeps dropping will not recover on its own; move to
      // an offline voice, which is plainer but does not cut out.
      state.forcedLocal = local;
      flash('Switched to ' + local.name + ' — the previous voice kept cutting out');
    } else if (state.stalls >= 3) {
      // Still stalling after the fallback: skip the chunk rather than retry it
      // forever, so the rest of the article is still read.
      state.index++;
      if (state.index >= state.chunks.length) {
        stop();
        return;
      }
      render();
    }
    cancelSpeech();
    deferSpeak();
  }

  /** Best offline voice, used when a network voice keeps dropping out. */
  function localVoice() {
    var locale = pageLocale();
    var all = voices(locale);
    for (var i = 0; i < all.length; i++) {
      if (all[i].localService && sameLanguage(all[i], locale)) return all[i];
    }
    for (var j = 0; j < all.length; j++) if (all[j].localService) return all[j];
    return null;
  }

  /* ------------------------------------------------------------------ ui */

  function flash(msg) {
    if (!els.bar) return;
    els.bar.hidden = false;
    els.bar.classList.add('is-visible');
    els.status.textContent = msg;
    setTimeout(function () {
      if (!isActive()) {
        els.bar.classList.remove('is-visible');
        els.bar.hidden = true;
      }
    }, 2200);
  }

  function updateBarReserve(active) {
    if (!document.body) return;
    document.body.classList.toggle('tts-active', active);
    if (!active) {
      document.documentElement.style.removeProperty('--tts-bar-height');
      return;
    }
    requestAnimationFrame(function () {
      if (els.bar && !els.bar.hidden) {
        document.documentElement.style.setProperty('--tts-bar-height', Math.ceil(els.bar.getBoundingClientRect().height) + 'px');
      }
    });
  }

  function render() {
    var active = isActive();
    if (els.toggle) {
      els.toggle.classList.toggle('is-active', isPlaying() || isWaiting());
      els.toggle.setAttribute('aria-pressed', active && state.mode !== 'error' ? 'true' : 'false');
      els.toggle.setAttribute(
        'aria-label',
        isPaused()
          ? 'Resume reading aloud'
          : state.mode === 'error'
            ? 'Dismiss read aloud error'
            : active
              ? 'Stop reading aloud'
              : 'Read this page aloud'
      );
      els.toggle.title = els.toggle.getAttribute('aria-label');
    }
    if (!els.bar) return;
    updateBarReserve(active);
    var wasHidden = els.bar.hidden;
    els.bar.hidden = !active;
    els.bar.classList.toggle('is-visible', active);
    if (active && wasHidden && els.bar.classList.contains('is-placed')) schedulePlacementBoundsRefresh();
    // Collapsed, the puck's speaker icon is the only playback feedback left.
    els.bar.classList.toggle('is-reading', isPlaying() || isWaiting());
    if (!active) return;
    els.playPause.textContent = isPaused() ? '▶' : '⏸';
    els.playPause.setAttribute('aria-label', isPaused() ? 'Resume' : 'Pause');
    els.playPause.disabled = isWaiting() || state.mode === 'error';
    if (isWaiting()) {
      els.status.textContent = 'Loading the next lesson…';
      els.progress.removeAttribute('value');
      return;
    }
    if (state.mode === 'error') {
      els.status.textContent = state.message || 'Read aloud stopped';
      els.progress.value = 0;
      return;
    }
    var current = state.chunks[state.index] || {};
    var section = current.section ? current.section.slice(0, 52) : 'Page';
    var minutes = remainingMinutes();
    els.status.textContent =
      (isPaused() ? 'Paused' : 'Reading') + ' · ' + section + ' · ' +
      Math.min(state.index + 1, state.chunks.length) + '/' + state.chunks.length +
      (minutes ? ' · ' + minutes + ' min left' : '');
    els.progress.max = Math.max(1, state.chunks.length);
    els.progress.value = Math.min(state.index + 1, state.chunks.length);
  }

  function icon() {
    return (
      '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<polygon points="4 9 8 9 13 5 13 19 8 15 4 15"></polygon>' +
      '<path class="tts-wave-1" d="M16.5 8.5a5 5 0 0 1 0 7"></path>' +
      '<path class="tts-wave-2" d="M19.5 5.5a9 9 0 0 1 0 13"></path>' +
      '</svg>'
    );
  }

  function hashStartElement() {
    var hash = location.hash ? decodeURIComponent(location.hash.slice(1)) : '';
    if (!hash) return null;
    var target = document.getElementById(hash);
    var phaseMatch = hash.match(/^phase-(\d{1,2})$/);
    if (!target && phaseMatch) target = document.querySelector('.roadmap-node[data-phase="' + parseInt(phaseMatch[1], 10) + '"]');
    var root = contentRoot();
    if (!target || !root || !root.contains(target)) return null;
    return blockOf(target) || target;
  }

  function closeCompactNavigation() {
    var toggle = document.querySelector('.header-menu-toggle[aria-expanded="true"]');
    if (toggle) toggle.click();
  }

  function placeToggle(btn) {
    var header = btn.closest('.site-header') || document.querySelector('.site-header');
    var inner = header && header.querySelector('.header-inner');
    var themeToggle = header && header.querySelector('.theme-toggle:not(.tts-toggle)');
    if (!inner || !themeToggle) return;
    var compact = window.matchMedia && window.matchMedia('(max-width: 1100px)').matches;
    var menuToggle = inner.querySelector('.header-menu-toggle');
    if (compact && menuToggle) inner.insertBefore(btn, menuToggle);
    else themeToggle.parentNode.insertBefore(btn, themeToggle);
  }

  function buildButton() {
    var themeToggle = document.querySelector('.theme-toggle');
    if (!themeToggle || !themeToggle.parentNode) return null;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'theme-toggle tts-toggle';
    btn.id = 'ttsToggle';
    btn.setAttribute('data-header-persistent', 'true');
    btn.innerHTML = icon();
    btn.setAttribute('aria-label', 'Read this page aloud');
    btn.title = 'Read this page aloud';
    btn.setAttribute('aria-pressed', 'false');
    placeToggle(btn);
    var compact = window.matchMedia && window.matchMedia('(max-width: 1100px)');
    if (compact) {
      var reposition = function () { placeToggle(btn); };
      if (typeof compact.addEventListener === 'function') compact.addEventListener('change', reposition);
      else if (typeof compact.addListener === 'function') compact.addListener(reposition);
    }
    if (!supported) {
      btn.disabled = true;
      btn.setAttribute('aria-label', 'Read aloud unavailable in this browser');
      btn.title = 'Read aloud unavailable in this browser';
      return btn;
    }
    btn.addEventListener('click', function () {
      closeCompactNavigation();
      if (isPaused()) resume();
      else if (isActive()) stop();
      else if (!readFromSelection()) start(false, hashStartElement());
    });
    return btn;
  }

  /* ------------------------------------------------- collapse and dragging */

  var COLLAPSED_KEY = 'tts:collapsed';
  var POS_KEY = 'tts:pos';
  var DRAG_SLOP = 4;
  var dragInertiaFrame = 0;
  var placementBoundsFrame = 0;
  var placementTransitionFrame = 0;
  var placementBounds = null;
  var placedPosition = null;
  var playerResizeObserver = null;

  function stopDragInertia() {
    if (dragInertiaFrame) window.cancelAnimationFrame(dragInertiaFrame);
    dragInertiaFrame = 0;
    if (els.bar) {
      els.bar.classList.remove('is-gliding');
      els.bar.style.removeProperty('transition');
    }
  }

  function commitDragInertiaForReducedMotion() {
    if (!els.bar || (!dragInertiaFrame && !els.bar.classList.contains('is-gliding'))) return;
    stopDragInertia();
    if (!els.bar.classList.contains('is-placed') || !placedPosition) return;
    els.bar.style.transition = 'none';
    place(placedPosition.x, placedPosition.y, true, placementBounds || refreshPlacementBounds());
    restorePlacementTransition();
  }

  /** Collapsed, the bar is just the speaker puck — click it to expand. */
  function setCollapsed(on, quiet) {
    state.collapsed = !!on;
    if (!quiet) lsSet(COLLAPSED_KEY, on ? '1' : '0');
    if (!els.bar) return;
    els.bar.classList.toggle('is-collapsed', state.collapsed);
    if (els.collapse) {
      els.collapse.innerHTML = state.collapsed ? icon() : '▾';
      els.collapse.setAttribute('aria-expanded', state.collapsed ? 'false' : 'true');
      var label = state.collapsed ? 'Expand read aloud controls' : 'Collapse controls';
      els.collapse.setAttribute('aria-label', label);
      els.collapse.title = label + ' (drag to move)';
    }
    schedulePlacementBoundsRefresh();
  }

  function savedPosition() {
    try {
      var raw = lsGet(POS_KEY);
      if (!raw) return null;
      var p = JSON.parse(raw);
      if (typeof p.x !== 'number' || typeof p.y !== 'number') return null;
      return p;
    } catch (e) {
      return null;
    }
  }

  /** Pin the bar at viewport coordinates, replacing the default anchoring. */
  function enterPlacedMode() {
    if (!els.bar || els.bar.classList.contains('is-placed')) return;
    els.bar.classList.add('is-placed');
    els.bar.style.left = '0px';
    els.bar.style.top = '0px';
  }

  function place(x, y, persist, limits) {
    if (!els.bar) return;
    limits = limits || placementBounds || refreshPlacementBounds();
    var cx = Math.min(Math.max(limits.minX, x), limits.maxX);
    var cy = Math.min(Math.max(limits.minY, y), limits.maxY);
    placedPosition = { x: cx, y: cy };
    enterPlacedMode();
    els.bar.style.transform = 'translate3d(' + cx + 'px,' + cy + 'px,0)';
    if (els.resetPosition) els.resetPosition.hidden = false;
    if (persist) lsSet(POS_KEY, JSON.stringify({ x: cx, y: cy }));
    return placedPosition;
  }

  function resetPosition() {
    stopDragInertia();
    lsSet(POS_KEY, '');
    placedPosition = null;
    if (!els.bar) return;
    els.bar.classList.remove('is-placed', 'is-gliding');
    els.bar.style.removeProperty('left');
    els.bar.style.removeProperty('top');
    els.bar.style.removeProperty('transform');
    els.bar.style.removeProperty('transition');
    if (els.resetPosition) els.resetPosition.hidden = true;
    updateBarReserve(isActive());
  }

  function refreshPlacementBounds(rect) {
    var measured = rect || (els.bar ? els.bar.getBoundingClientRect() : null);
    var width = measured && measured.width ? measured.width : placementBounds ? placementBounds.width : 0;
    var height = measured && measured.height ? measured.height : placementBounds ? placementBounds.height : 0;
    placementBounds = {
      minX: 8,
      minY: 8,
      maxX: Math.max(8, document.documentElement.clientWidth - width - 8),
      maxY: Math.max(8, window.innerHeight - height - 8),
      width: width,
      height: height,
    };
    return placementBounds;
  }

  function schedulePlacementBoundsRefresh() {
    if (placementBoundsFrame) return;
    placementBoundsFrame = window.requestAnimationFrame(function () {
      placementBoundsFrame = 0;
      if (!els.bar) return;
      if (els.bar.classList.contains('is-placed')) clampToViewport();
      else refreshPlacementBounds();
    });
  }

  function restorePlacementTransition() {
    if (placementTransitionFrame) window.cancelAnimationFrame(placementTransitionFrame);
    placementTransitionFrame = window.requestAnimationFrame(function () {
      placementTransitionFrame = 0;
      if (!els.bar || els.bar.classList.contains('is-dragging') || els.bar.classList.contains('is-gliding')) return;
      els.bar.style.removeProperty('transition');
    });
  }

  function resistEdge(value, min, max) {
    if (value < min) {
      var before = min - value;
      return min - (before * 0.3) / (1 + before / 96);
    }
    if (value > max) {
      var after = value - max;
      return max + (after * 0.3) / (1 + after / 96);
    }
    return value;
  }

  function placeDuringDrag(x, y, limits) {
    if (!els.bar) return;
    var resistedX = resistEdge(x, limits.minX, limits.maxX);
    var resistedY = resistEdge(y, limits.minY, limits.maxY);
    enterPlacedMode();
    els.bar.style.transform = 'translate3d(' + resistedX + 'px,' + resistedY + 'px,0)';
    placedPosition = { x: resistedX, y: resistedY };
    return placedPosition;
  }

  function clampToViewport() {
    if (!els.bar || !els.bar.classList.contains('is-placed')) return;
    stopDragInertia();
    var rect = els.bar.getBoundingClientRect();
    var limits = refreshPlacementBounds(rect);
    var current = placedPosition || { x: rect.left, y: rect.top };
    place(current.x, current.y, false, limits);
  }

  /**
   * Drag the bar anywhere over the article. Buttons and selects keep their own
   * behaviour unless the pointer actually moves, so a collapsed puck can be
   * both clicked and dragged.
   */
  function bindDrag(bar) {
    var active = false;
    var moved = false;
    var startX = 0;
    var startY = 0;
    var originX = 0;
    var originY = 0;
    var lastX = 0;
    var lastY = 0;
    var lastTime = 0;
    var velocityX = 0;
    var velocityY = 0;
    var currentX = 0;
    var currentY = 0;
    var dragLimits = null;

    function beginInertia(initialVelocityX, initialVelocityY, initialX, initialY, limits) {
      if (prefersReducedMotion()) {
        bar.style.transition = 'none';
        place(initialX, initialY, true, limits);
        restorePlacementTransition();
        return;
      }

      var x = initialX;
      var y = initialY;
      var vx = initialVelocityX;
      var vy = initialVelocityY;
      var previous = performance.now();
      bar.classList.add('is-gliding');
      bar.style.transition = 'none';

      function settle() {
        dragInertiaFrame = 0;
        bar.classList.remove('is-gliding');
        place(x, y, true, limits);
        restorePlacementTransition();
      }

      function glide(now) {
        var elapsed = Math.min(32, Math.max(1, now - previous));
        previous = now;

        x += vx * elapsed;
        y += vy * elapsed;

        if (x < limits.minX || x > limits.maxX) {
          x = Math.min(Math.max(limits.minX, x), limits.maxX);
          vx *= -0.24;
        }
        if (y < limits.minY || y > limits.maxY) {
          y = Math.min(Math.max(limits.minY, y), limits.maxY);
          vy *= -0.24;
        }

        var damping = Math.pow(0.9, elapsed / (1000 / 60));
        vx *= damping;
        vy *= damping;
        place(x, y, false, limits);

        if (Math.abs(vx) + Math.abs(vy) < 0.018) {
          settle();
          return;
        }
        dragInertiaFrame = window.requestAnimationFrame(glide);
      }

      dragInertiaFrame = window.requestAnimationFrame(glide);
    }

    bar.addEventListener('pointerdown', function (e) {
      if (e.button != null && e.button !== 0) return;
      if (window.matchMedia && window.matchMedia('(max-width: 720px)').matches) return;
      // Leave real controls alone while the bar is open; the puck is all
      // button, so it has to be draggable too.
      if (!state.collapsed && e.target.closest('select,input,option')) return;
      stopDragInertia();
      var rect = bar.getBoundingClientRect();
      dragLimits = refreshPlacementBounds(rect);
      active = true;
      moved = false;
      startX = e.clientX;
      startY = e.clientY;
      originX = rect.left;
      originY = rect.top;
      currentX = originX;
      currentY = originY;
      placedPosition = { x: originX, y: originY };
      lastX = e.clientX;
      lastY = e.clientY;
      lastTime = e.timeStamp || performance.now();
      velocityX = 0;
      velocityY = 0;
    });

    bar.addEventListener('pointermove', function (e) {
      if (!active) return;
      var dx = e.clientX - startX;
      var dy = e.clientY - startY;
      if (!moved && Math.abs(dx) < DRAG_SLOP && Math.abs(dy) < DRAG_SLOP) return;
      if (!moved) {
        moved = true;
        bar.classList.add('is-dragging');
        if (bar.setPointerCapture) bar.setPointerCapture(e.pointerId);
      }
      e.preventDefault();
      var now = e.timeStamp || performance.now();
      var elapsed = Math.max(1, now - lastTime);
      var sampleX = (e.clientX - lastX) / elapsed;
      var sampleY = (e.clientY - lastY) / elapsed;
      velocityX = velocityX * 0.6 + sampleX * 0.4;
      velocityY = velocityY * 0.6 + sampleY * 0.4;
      lastX = e.clientX;
      lastY = e.clientY;
      lastTime = now;
      var placement = placeDuringDrag(originX + dx, originY + dy, dragLimits);
      currentX = placement.x;
      currentY = placement.y;
    });

    var end = function (e) {
      if (!active) return;
      active = false;
      if (!moved) return;
      bar.classList.remove('is-dragging');
      if (bar.releasePointerCapture && e.pointerId != null) {
        try {
          bar.releasePointerCapture(e.pointerId);
        } catch (err) {
          // Capture may already be gone.
        }
      }
      if (e.type === 'pointerup' && Math.abs(velocityX) + Math.abs(velocityY) >= 0.06) {
        beginInertia(velocityX, velocityY, currentX, currentY, dragLimits);
      } else {
        bar.style.transition = 'none';
        place(currentX, currentY, true, dragLimits);
        restorePlacementTransition();
      }
      // Swallow the click a completed drag is about to produce. A cancelled
      // gesture emits no click, so arming the guard there would eat the next
      // real one instead.
      state.dragged = e.type === 'pointerup';
    };

    bar.addEventListener('pointerup', end);
    bar.addEventListener('pointercancel', end);
    window.addEventListener('resize', schedulePlacementBoundsRefresh);
    window.addEventListener('orientationchange', schedulePlacementBoundsRefresh);
    if (typeof ResizeObserver === 'function') {
      playerResizeObserver = new ResizeObserver(schedulePlacementBoundsRefresh);
      playerResizeObserver.observe(bar);
    }
  }

  function buildBar() {
    var bar = document.createElement('div');
    bar.className = 'tts-bar';
    bar.id = 'ttsBar';
    bar.hidden = true;
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', 'Read aloud controls');
    bar.innerHTML =
      '<button type="button" class="tts-btn" data-tts="prev" aria-label="Previous passage">⏪</button>' +
      '<button type="button" class="tts-btn tts-btn-main" data-tts="playpause" aria-label="Pause">⏸</button>' +
      '<button type="button" class="tts-btn" data-tts="next" aria-label="Next passage">⏩</button>' +
      '<span class="tts-status" id="ttsStatus" aria-live="polite">Reading</span>' +
      '<progress class="tts-progress" id="ttsProgress" max="1" value="0" aria-label="Narration progress"></progress>' +
      '<label class="tts-field"><span>Speed</span>' +
      '<select class="tts-select" id="ttsRate" aria-label="Reading speed">' +
      '<option value="0.75">0.75x</option><option value="1">1x</option>' +
      '<option value="1.25">1.25x</option><option value="1.5">1.5x</option>' +
      '<option value="1.75">1.75x</option><option value="2">2x</option></select></label>' +
      '<label class="tts-field tts-field-voice"><span>Voice</span>' +
      '<select class="tts-select" id="ttsVoice" aria-label="Voice"></select></label>' +
      '<button type="button" class="tts-btn tts-btn-reset" data-tts="reset" aria-label="Reset player position" hidden>Dock</button>' +
      '<button type="button" class="tts-btn tts-btn-stop" data-tts="stop" aria-label="Stop reading">Stop</button>' +
      '<button type="button" class="tts-btn tts-btn-collapse" data-tts="collapse" ' +
      'aria-label="Collapse controls" aria-expanded="true" title="Collapse (drag to move)">▾</button>';
    document.body.appendChild(bar);

    els.bar = bar;
    els.status = bar.querySelector('#ttsStatus');
    els.progress = bar.querySelector('#ttsProgress');
    els.playPause = bar.querySelector('[data-tts="playpause"]');
    els.rate = bar.querySelector('#ttsRate');
    els.voice = bar.querySelector('#ttsVoice');

    els.collapse = bar.querySelector('[data-tts="collapse"]');
    els.resetPosition = bar.querySelector('[data-tts="reset"]');

    bar.addEventListener('click', function (e) {
      // A click that ended a drag should not also press the button under it.
      if (state.dragged) {
        state.dragged = false;
        return;
      }
      var target = e.target.closest('[data-tts]');
      if (!target) return;
      var action = target.getAttribute('data-tts');
      if (action === 'collapse') setCollapsed(!state.collapsed);
      else if (action === 'playpause') isPaused() ? resume() : pause();
      else if (action === 'stop') stop();
      else if (action === 'next') jump(1);
      else if (action === 'prev') jump(-1);
      else if (action === 'reset') resetPosition();
    });

    els.rate.value = String(rate());
    els.rate.addEventListener('change', function () {
      lsSet(RATE_KEY, els.rate.value);
      if (isPlaying()) {
        // Rate only applies to a new utterance, so restart the current chunk.
        cancelSpeech();
        speakCurrent();
      }
      render();
    });

    els.voice.addEventListener('change', function () {
      lsSet(voiceKey(), els.voice.value);
      // An explicit choice overrides the automatic offline fallback.
      state.forcedLocal = null;
      if (isPlaying()) {
        cancelSpeech();
        speakCurrent();
      }
    });

    bindDrag(bar);
    setCollapsed(lsGet(COLLAPSED_KEY) === '1', true);
    var pos = savedPosition();
    if (pos && !(window.matchMedia && window.matchMedia('(max-width: 720px)').matches)) {
      place(pos.x, pos.y, false);
    }

    fillVoices();
    if (typeof synth.onvoiceschanged !== 'undefined') {
      synth.addEventListener('voiceschanged', fillVoices);
    }
    return bar;
  }

  /**
   * A "Read from here" chip that follows a text selection inside the article.
   */
  function buildSelectionButton() {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tts-from-here';
    btn.id = 'ttsFromHere';
    btn.hidden = true;
    btn.innerHTML = '<span aria-hidden="true">▶</span> Read from here';
    btn.title = 'Read from here (Alt+R)';
    // mousedown would clear the selection before the click lands.
    btn.addEventListener('mousedown', function (e) {
      e.preventDefault();
    });
    btn.addEventListener('click', readFromSelection);
    document.body.appendChild(btn);
    els.fromHere = btn;
    return btn;
  }

  function hideSelectionButton() {
    if (els.fromHere) els.fromHere.hidden = true;
  }

  function showSelectionButton() {
    if (!els.fromHere) return;
    // Only offered while read-aloud is running — with the bar closed, the
    // speaker button is the way in.
    if (!isPlaying() && !isPaused()) {
      hideSelectionButton();
      return;
    }
    var sel = window.getSelection && window.getSelection();
    if (!selectedBlock()) {
      hideSelectionButton();
      return;
    }
    var rect = sel.getRangeAt(0).getBoundingClientRect();
    if (!rect || (!rect.width && !rect.height)) {
      hideSelectionButton();
      return;
    }
    els.fromHere.hidden = false;
    var top = rect.top + window.pageYOffset - els.fromHere.offsetHeight - 8;
    // Flip below the selection when there is no room above it.
    if (rect.top < 60) top = rect.bottom + window.pageYOffset + 8;
    var left = rect.left + window.pageXOffset + rect.width / 2 - els.fromHere.offsetWidth / 2;
    var max = document.documentElement.clientWidth - els.fromHere.offsetWidth - 8;
    els.fromHere.style.top = Math.max(8, top) + 'px';
    els.fromHere.style.left = Math.min(Math.max(8, left), Math.max(8, max)) + 'px';
  }

  function bindSelection() {
    buildSelectionButton();
    var pending = null;
    var refresh = function () {
      clearTimeout(pending);
      pending = setTimeout(showSelectionButton, 10);
    };
    document.addEventListener('mouseup', refresh);
    document.addEventListener('keyup', function (e) {
      if (e.shiftKey || e.key === 'Shift' || /^Arrow/.test(e.key)) refresh();
    });
    document.addEventListener('selectionchange', function () {
      var sel = window.getSelection && window.getSelection();
      if (!sel || sel.isCollapsed) hideSelectionButton();
    });
    window.addEventListener('scroll', hideSelectionButton, { passive: true });
    window.addEventListener('resize', hideSelectionButton);
  }

  function resolveElement(target) {
    if (!target) return null;
    if (target.nodeType === 1) return target;
    if (typeof target !== 'string') return null;
    try {
      return document.querySelector(target);
    } catch (e) {
      return document.getElementById(target.replace(/^#/, ''));
    }
  }

  function startAt(target, options) {
    var element = resolveElement(target);
    if (!element) return false;
    var scope = options && options.scope ? resolveElement(options.scope) : null;
    if (!scope && options && options.section) scope = element.closest('[data-tts-section],article,section');
    closeCompactNavigation();
    return start(false, blockOf(element) || element, scope);
  }

  function bindSectionStarts() {
    document.addEventListener('click', function (event) {
      var control = event.target.closest && event.target.closest('[data-tts-start]');
      if (!control) return;
      event.preventDefault();
      var selector = control.getAttribute('data-tts-start');
      var target = selector ? resolveElement(selector) : control.closest('[data-tts-section],article,section');
      var scope = control.closest('[data-tts-section],article,section');
      if (target) start(false, blockOf(target) || target, scope);
    });
  }

  function stateSnapshot() {
    var current = state.chunks[state.index] || {};
    return {
      version: VERSION,
      supported: supported,
      silentMode: silentMode,
      mode: state.mode,
      index: state.index,
      total: state.chunks.length,
      section: current.section || '',
      locale: pageLocale(),
      remainingMinutes: remainingMinutes(),
      scoped: !!state.scope,
    };
  }

  window.AIFS_TTS = {
    version: VERSION,
    supported: supported,
    start: function () { return start(false, hashStartElement()); },
    startAt: startAt,
    pause: pause,
    resume: resume,
    stop: stop,
    refresh: function () { return refreshQueue(false); },
    getState: stateSnapshot,
  };

  function init() {
    if (document.getElementById('ttsToggle')) return;
    var btn = buildButton();
    if (!btn) return;
    els.toggle = btn;
    if (!supported) {
      document.dispatchEvent(new CustomEvent('aifs:tts-ready', { detail: stateSnapshot() }));
      return;
    }
    buildBar();
    bindReducedMotionPreference();
    bindSelection();
    bindSectionStarts();
    bindNavigationResume();
    render();

    // Leftover utterances would keep talking over the next page; the resume
    // flag (not the audio) is what carries playback across the navigation.
    window.addEventListener('pagehide', function (event) {
      if (!state.navigationTarget) clearResumeTarget();
      cancelSpeech();
      if (!event.persisted) disposeReducedMotionPreference();
    });
    window.addEventListener('pageshow', function () {
      bindReducedMotionPreference();
      if (prefersReducedMotion()) commitDragInertiaForReducedMotion();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !e.defaultPrevented && isActive()) stop();
      // The chip sits at the end of the tab order, so keyboard users get a
      // shortcut instead: Alt+R reads from wherever the selection starts.
      if (e.altKey && !e.ctrlKey && !e.metaKey && (e.key === 'r' || e.key === 'R')) {
        if (selectedBlock() && readFromSelection()) e.preventDefault();
      }
    });

    autoResume();
    document.dispatchEvent(new CustomEvent('aifs:tts-ready', { detail: stateSnapshot() }));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
