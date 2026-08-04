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
  if (typeof window === 'undefined') return;
  var synth = window.speechSynthesis;
  if (!synth || typeof window.SpeechSynthesisUtterance !== 'function') return;

  var RATE_KEY = 'tts:rate';
  var VOICE_KEY = 'tts:voice';
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
    'p', 'li', 'blockquote', 'dd', 'dt', 'figcaption', 'summary', 'td', 'th',
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

  // Prev/next lesson links are full page loads, so playback state has to
  // survive navigation: the next page picks it back up on its own.
  var RESUME_KEY = 'tts:resume';

  function setResume(on) {
    try {
      if (on) sessionStorage.setItem(RESUME_KEY, '1');
      else sessionStorage.removeItem(RESUME_KEY);
    } catch (e) {
      // sessionStorage may be disabled; playback just won't carry over.
    }
  }

  function wantsResume() {
    try {
      return sessionStorage.getItem(RESUME_KEY) === '1';
    } catch (e) {
      return false;
    }
  }

  var reducedMotion =
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');

  function prefersReducedMotion() {
    return !!(reducedMotion && reducedMotion.matches);
  }

  var state = {
    chunks: [],
    index: 0,
    playing: false,
    paused: false,
    // True between a lesson navigation and its content being ready to read.
    waiting: false,
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
  };

  var els = {};

  /* ---------------------------------------------------------------- text */

  function contentRoot() {
    var candidates = [
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
    return text
      .replace(/\s+/g, ' ')
      .replace(/[`*_#~|]+/g, ' ')
      .replace(/\s+([,.;:!?])/g, '$1')
      .trim();
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
        // Descend into plain wrappers so nested blocks stay un-duplicated.
        out += n.querySelector(BLOCK_SELECTOR) ? ownText(n) : n.textContent || '';
      }
    }
    return out;
  }

  /** Build the play queue: [{ text, el }] in document order. */
  function collect() {
    var root = contentRoot();
    if (!root) return [];
    var blocks = root.querySelectorAll(BLOCK_SELECTOR);
    var chunks = [];
    var seen = 0;
    for (var i = 0; i < blocks.length; i++) {
      var el = blocks[i];
      if (isSkipped(el) || !isVisible(el)) continue;
      var text;
      if (el.querySelector(NESTED_PROBE)) {
        // A wrapper (list item holding a code block, panel holding headings).
        // Read only its own text; the nested blocks come round on their own.
        text = clean(ownText(el));
      } else {
        text = clean(el.textContent || '');
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
        chunks.push({ text: parts[j], el: el });
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

  function score(v) {
    var name = (v.name || '').toLowerCase();
    var lang = (v.lang || '').toLowerCase();
    var s = 0;

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

    // English first; en-US/en-GB above the rest.
    if (/^en/.test(lang)) s += 200;
    if (/^en[-_](us|gb)/.test(lang)) s += 20;
    if (v.default) s += 2;

    return s;
  }

  function voices() {
    var all = (synth.getVoices() || []).slice();
    var ranked = all.map(function (v, i) {
      return { v: v, s: score(v), i: i };
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
    var list = voices();
    return list.length ? list[0] : null;
  }

  function selectedVoice() {
    // A voice that kept dropping has been replaced for this session.
    if (state.forcedLocal) return state.forcedLocal;
    var wanted = lsGet(VOICE_KEY);
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
    var list = voices();
    if (!list.length) return;
    var current = lsGet(VOICE_KEY) || '';
    var best = list[0];
    els.voice.innerHTML = '';
    var def = document.createElement('option');
    def.value = '';
    def.textContent = 'Auto — ' + best.name;
    els.voice.appendChild(def);
    for (var i = 0; i < list.length; i++) {
      var o = document.createElement('option');
      o.value = list[i].voiceURI;
      o.textContent =
        (score(list[i]) >= 240 ? '★ ' : '') + list[i].name + ' (' + list[i].lang + ')';
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
  function resync() {
    var current = state.chunks[state.index];
    var fresh = collect();
    if (!fresh.length) return false;
    var at = -1;
    for (var i = 0; i < fresh.length; i++) {
      if (current && fresh[i].text === current.text) {
        at = i;
        break;
      }
    }
    state.chunks = fresh;
    state.index = at >= 0 ? at : Math.min(state.index, fresh.length - 1);
    return true;
  }

  function speakCurrent() {
    if (state.index >= state.chunks.length) {
      stop();
      return;
    }
    var stale = state.chunks[state.index].el;
    if (stale && !document.contains(stale)) resync();
    var chunk = state.chunks[state.index];
    var u = new SpeechSynthesisUtterance(chunk.text);
    u.rate = rate();
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
      if (token !== state.seq || !state.playing) return;
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
      if (token !== state.seq || !state.playing) return;
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
    startWatchdog();
    return start(false, block);
  }

  function start(silentIfEmpty, fromEl) {
    state.chunks = collect();
    if (!state.chunks.length) {
      if (!silentIfEmpty) flash('Nothing to read on this page');
      return false;
    }
    cancelSpeech();
    state.index = fromEl ? indexOfBlock(fromEl) : 0;
    state.playing = true;
    state.paused = false;
    state.waiting = false;
    state.stalls = 0;
    setResume(true);
    startWatchdog();
    render();
    speakCurrent();
    return true;
  }

  function pause() {
    if (!state.playing || state.paused) return;
    state.paused = true;
    setResume(false);
    synth.pause();
    render();
  }

  function resume() {
    if (!state.playing || !state.paused) return;
    state.paused = false;
    setResume(true);
    synth.resume();
    render();
  }

  function stop() {
    state.playing = false;
    state.paused = false;
    state.utterance = null;
    state.chunks = [];
    state.index = 0;
    state.waiting = false;
    setResume(false);
    stopWatchdog();
    cancelSpeech();
    highlight(null);
    hideSelectionButton();
    render();
  }

  /**
   * Carry playback across a lesson navigation. Lesson bodies are fetched after
   * load, so poll until there is something to read before starting.
   */
  function autoResume() {
    if (!wantsResume()) return;
    state.waiting = true;
    render();

    var tries = 0;
    var lastSize = -1;
    var timer = setInterval(function () {
      if (!state.waiting) {
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
        state.waiting = false;
        clearInterval(timer);
        armGestureFallback();
        return;
      }
      if (tries > 60) {
        // ~15s: the page has nothing to read, so drop the hand-off.
        state.waiting = false;
        setResume(false);
        clearInterval(timer);
        render();
      }
    }, 250);
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
      if (state.playing && !state.paused && !synth.speaking) speakCurrent();
    };
    document.addEventListener('pointerdown', retry, true);
    document.addEventListener('keydown', retry, true);
    setTimeout(function () {
      if (state.playing && !state.paused && !synth.speaking) {
        flash('Press play or click the page to continue reading');
      }
    }, 1200);
  }

  function jump(delta) {
    if (!state.playing) return;
    var next = state.index + delta;
    if (next < 0) next = 0;
    if (next >= state.chunks.length) {
      stop();
      return;
    }
    state.index = next;
    state.paused = false;
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
    synth.cancel();
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
      if (!state.playing || state.paused) return;
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
      if (!state.playing || state.paused || state.waiting) return;
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
      flash('Speech engine stopped responding');
      stop();
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
    var all = voices();
    for (var i = 0; i < all.length; i++) {
      if (all[i].localService) return all[i];
    }
    return null;
  }

  /* ------------------------------------------------------------------ ui */

  function flash(msg) {
    if (!els.bar) return;
    els.bar.hidden = false;
    els.bar.classList.add('is-visible');
    els.status.textContent = msg;
    setTimeout(function () {
      if (!state.playing) {
        els.bar.classList.remove('is-visible');
        els.bar.hidden = true;
      }
    }, 2200);
  }

  function render() {
    var active = state.playing || state.waiting;
    if (els.toggle) {
      els.toggle.classList.toggle('is-active', active && !state.paused);
      els.toggle.setAttribute('aria-pressed', active ? 'true' : 'false');
      els.toggle.setAttribute(
        'aria-label',
        active ? (state.paused ? 'Resume reading aloud' : 'Stop reading aloud') : 'Read this page aloud'
      );
      els.toggle.title = els.toggle.getAttribute('aria-label');
    }
    if (!els.bar) return;
    els.bar.hidden = !active;
    els.bar.classList.toggle('is-visible', active);
    // Collapsed, the puck's speaker icon is the only playback feedback left.
    els.bar.classList.toggle('is-reading', active && !state.paused);
    if (!active) return;
    els.playPause.textContent = state.paused ? '▶' : '⏸';
    els.playPause.setAttribute('aria-label', state.paused ? 'Resume' : 'Pause');
    if (state.waiting) {
      els.status.textContent = 'Loading page…';
      return;
    }
    els.status.textContent =
      (state.paused ? 'Paused' : 'Reading') +
      ' · ' +
      Math.min(state.index + 1, state.chunks.length) +
      '/' +
      state.chunks.length;
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

  function buildButton() {
    var themeToggle = document.querySelector('.theme-toggle');
    if (!themeToggle || !themeToggle.parentNode) return null;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'theme-toggle tts-toggle';
    btn.id = 'ttsToggle';
    btn.innerHTML = icon();
    btn.setAttribute('aria-label', 'Read this page aloud');
    btn.title = 'Read this page aloud';
    btn.setAttribute('aria-pressed', 'false');
    themeToggle.parentNode.insertBefore(btn, themeToggle);
    btn.addEventListener('click', function () {
      // The speaker is the on/off switch — pause lives in the control bar.
      if (state.playing || state.waiting) stop();
      else if (!readFromSelection()) start();
    });
    return btn;
  }

  /* ------------------------------------------------- collapse and dragging */

  var COLLAPSED_KEY = 'tts:collapsed';
  var POS_KEY = 'tts:pos';
  var DRAG_SLOP = 4;

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
    clampToViewport();
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
  function place(x, y, persist) {
    if (!els.bar) return;
    var w = els.bar.offsetWidth;
    var h = els.bar.offsetHeight;
    var maxX = Math.max(8, document.documentElement.clientWidth - w - 8);
    var maxY = Math.max(8, window.innerHeight - h - 8);
    var cx = Math.min(Math.max(8, x), maxX);
    var cy = Math.min(Math.max(8, y), maxY);
    els.bar.classList.add('is-placed');
    els.bar.style.left = cx + 'px';
    els.bar.style.top = cy + 'px';
    if (persist) lsSet(POS_KEY, JSON.stringify({ x: cx, y: cy }));
  }

  function clampToViewport() {
    if (!els.bar || !els.bar.classList.contains('is-placed')) return;
    var rect = els.bar.getBoundingClientRect();
    place(rect.left, rect.top, false);
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

    bar.addEventListener('pointerdown', function (e) {
      if (e.button != null && e.button !== 0) return;
      // Leave real controls alone while the bar is open; the puck is all
      // button, so it has to be draggable too.
      if (!state.collapsed && e.target.closest('select,input,option')) return;
      var rect = bar.getBoundingClientRect();
      active = true;
      moved = false;
      startX = e.clientX;
      startY = e.clientY;
      originX = rect.left;
      originY = rect.top;
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
      place(originX + dx, originY + dy, false);
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
      var rect = bar.getBoundingClientRect();
      place(rect.left, rect.top, true);
      // Swallow the click a completed drag is about to produce. A cancelled
      // gesture emits no click, so arming the guard there would eat the next
      // real one instead.
      state.dragged = e.type === 'pointerup';
    };

    bar.addEventListener('pointerup', end);
    bar.addEventListener('pointercancel', end);
    window.addEventListener('resize', clampToViewport);
  }

  function buildBar() {
    var bar = document.createElement('div');
    bar.className = 'tts-bar';
    bar.id = 'ttsBar';
    bar.hidden = true;
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', 'Read aloud controls');
    bar.innerHTML =
      '<button type="button" class="tts-btn" data-tts="prev" aria-label="Previous paragraph">⏪</button>' +
      '<button type="button" class="tts-btn tts-btn-main" data-tts="playpause" aria-label="Pause">⏸</button>' +
      '<button type="button" class="tts-btn" data-tts="next" aria-label="Next paragraph">⏩</button>' +
      '<span class="tts-status" id="ttsStatus" aria-live="polite">Reading</span>' +
      '<label class="tts-field"><span>Speed</span>' +
      '<select class="tts-select" id="ttsRate" aria-label="Reading speed">' +
      '<option value="0.75">0.75x</option><option value="1">1x</option>' +
      '<option value="1.25">1.25x</option><option value="1.5">1.5x</option>' +
      '<option value="1.75">1.75x</option><option value="2">2x</option></select></label>' +
      '<label class="tts-field tts-field-voice"><span>Voice</span>' +
      '<select class="tts-select" id="ttsVoice" aria-label="Voice"></select></label>' +
      '<button type="button" class="tts-btn tts-btn-stop" data-tts="stop" aria-label="Stop reading">Stop</button>' +
      '<button type="button" class="tts-btn tts-btn-collapse" data-tts="collapse" ' +
      'aria-label="Collapse controls" aria-expanded="true" title="Collapse (drag to move)">▾</button>';
    document.body.appendChild(bar);

    els.bar = bar;
    els.status = bar.querySelector('#ttsStatus');
    els.playPause = bar.querySelector('[data-tts="playpause"]');
    els.rate = bar.querySelector('#ttsRate');
    els.voice = bar.querySelector('#ttsVoice');

    els.collapse = bar.querySelector('[data-tts="collapse"]');

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
      else if (action === 'playpause') state.paused ? resume() : pause();
      else if (action === 'stop') stop();
      else if (action === 'next') jump(1);
      else if (action === 'prev') jump(-1);
    });

    els.rate.value = String(rate());
    els.rate.addEventListener('change', function () {
      lsSet(RATE_KEY, els.rate.value);
      if (state.playing) {
        // Rate only applies to a new utterance, so restart the current chunk.
        state.paused = false;
        cancelSpeech();
        speakCurrent();
      }
    });

    els.voice.addEventListener('change', function () {
      lsSet(VOICE_KEY, els.voice.value);
      // An explicit choice overrides the automatic offline fallback.
      state.forcedLocal = null;
      if (state.playing) {
        state.paused = false;
        cancelSpeech();
        speakCurrent();
      }
    });

    bindDrag(bar);
    setCollapsed(lsGet(COLLAPSED_KEY) === '1', true);
    var pos = savedPosition();
    if (pos) place(pos.x, pos.y, false);

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
    if (!state.playing && !state.waiting) {
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

  function init() {
    if (document.getElementById('ttsToggle')) return;
    var btn = buildButton();
    if (!btn) return;
    els.toggle = btn;
    buildBar();
    bindSelection();
    render();

    // Leftover utterances would keep talking over the next page; the resume
    // flag (not the audio) is what carries playback across the navigation.
    window.addEventListener('pagehide', function () {
      cancelSpeech();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && (state.playing || state.waiting)) stop();
      // The chip sits at the end of the tab order, so keyboard users get a
      // shortcut instead: Alt+R reads from wherever the selection starts.
      if (e.altKey && !e.ctrlKey && !e.metaKey && (e.key === 'r' || e.key === 'R')) {
        if (selectedBlock() && readFromSelection()) e.preventDefault();
      }
    });

    autoResume();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
