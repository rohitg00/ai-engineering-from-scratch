/**
 * Read-aloud support built on the browser's built-in SpeechSynthesis API.
 *
 * Injects a speaker button into the site header (immediately before the
 * theme toggle) on any page that has readable article content, plus a
 * floating control bar for pause/stop/speed while playback runs.
 *
 * No network calls and no dependencies: everything is native Web Speech API.
 */
(function () {
  if (typeof window === 'undefined') return;
  var synth = window.speechSynthesis;
  if (!synth || typeof window.SpeechSynthesisUtterance !== 'function') return;

  var RATE_KEY = 'tts:rate';
  var VOICE_KEY = 'tts:voice';
  var CODE_KEY = 'tts:code';
  var MAX_CHUNK = 220;

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
    'pre',
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

  // Mermaid keeps its definition in a hidden <pre> next to the rendered SVG.
  var MERMAID_SOURCE = 'pre.mermaid-source';

  // Storage throws instead of returning null when a browser blocks it
  // (Safari with cookies off, sandboxed iframes), so every read goes through
  // these — readCode() runs on the collection hot path and must never throw.
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

  // Code read aloud is hard to follow — off unless the listener opts in.
  function readCode() {
    return lsGet(CODE_KEY) === '1';
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
    keepAlive: null,
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
    // The mermaid source <pre> is display:none by design — read it anyway,
    // since the rendered SVG beside it has no speakable text.
    if (el.matches(MERMAID_SOURCE)) return false;
    if (el.closest(HARD_SKIP)) return true;
    if (el.closest(ALLOW_SELECTOR)) return false;
    if (el.matches('pre')) return !readCode();
    // Code inside a <pre> is covered by the <pre> block itself.
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

  /* ----------------------------------------------------------------- code */

  var SYMBOLS = [
    [/=>/g, ' arrow '],
    [/->/g, ' arrow '],
    [/===?/g, ' equals '],
    [/!==?/g, ' not equals '],
    [/<=/g, ' less than or equal '],
    [/>=/g, ' greater than or equal '],
    [/\+=/g, ' plus equals '],
    [/-=/g, ' minus equals '],
    [/\*\*/g, ' to the power of '],
    [/\|\|/g, ' or '],
    [/&&/g, ' and '],
    [/@/g, ' at '],
    [/#/g, ' comment: '],
    [/\/\//g, ' comment: '],
    [/=/g, ' equals '],
    [/[{}[\]()]/g, ' '],
    [/[;,]/g, ', '],
    [/["'`]/g, ' '],
    [/\|/g, ' pipe '],
    [/\*/g, ' times '],
    [/\//g, ' over '],
    [/%/g, ' percent '],
    [/</g, ' less than '],
    [/>/g, ' greater than '],
    [/:/g, ': '],
  ];

  function language(pre) {
    var el = pre.querySelector('code') || pre;
    var cls = (el.className || '') + ' ' + (pre.className || '');
    var m = cls.match(/(?:language|lang)-([a-z0-9+#]+)/i);
    if (m) return m[1];
    var attr = pre.getAttribute('data-lang') || el.getAttribute('data-lang');
    return attr || '';
  }

  /**
   * Code read verbatim is unlistenable: punctuation soup and no word breaks.
   * Convert identifiers to words and the common operators to their spoken
   * form, then announce the block so listeners know where they are.
   */
  function codeToSpeech(pre) {
    var raw = pre.textContent || '';
    var lines = raw.split('\n').filter(function (l) {
      return l.trim().length > 0;
    });
    if (!lines.length) return '';

    var spoken = lines
      .map(function (line) {
        var t = line.trim();
        for (var i = 0; i < SYMBOLS.length; i++) {
          t = t.replace(SYMBOLS[i][0], SYMBOLS[i][1]);
        }
        t = t
          .replace(/_/g, ' ')
          .replace(/\.(?=[A-Za-z_])/g, ' dot ')
          .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
          .replace(/\s+/g, ' ')
          .trim();
        // Give the voice a beat between statements.
        return t ? t.replace(/[.:,]+$/, '') + '.' : '';
      })
      .filter(Boolean)
      .join(' ');

    var lang = language(pre);
    var head =
      (lang ? lang + ' code block' : 'Code block') +
      ', ' +
      lines.length +
      (lines.length === 1 ? ' line. ' : ' lines. ');
    return head + spoken;
  }

  /* ------------------------------------------------------------- diagrams */

  var DIAGRAM_NAMES = {
    graph: 'Flowchart',
    flowchart: 'Flowchart',
    sequencediagram: 'Sequence diagram',
    classdiagram: 'Class diagram',
    statediagram: 'State diagram',
    'statediagram-v2': 'State diagram',
    erdiagram: 'Entity relationship diagram',
    journey: 'User journey',
    gantt: 'Gantt chart',
    pie: 'Pie chart',
    mindmap: 'Mind map',
    timeline: 'Timeline',
    quadrantchart: 'Quadrant chart',
  };

  var MAX_EDGES = 24;

  // Arrow tokens: --> --- -.-> ==> --x --o <--> ~~~ ->> -->>
  // Single-dash forms must still require a '>' so hyphenated ids stay intact.
  var ARROW = /(<?(?:-\.->?|-{2,3}[->xo]{0,2}|={2,3}[>xo]{0,2}|~{2,3}|-{1,2}>{1,2}|={1,2}>{1,2}))/;

  // Same pattern, compiled once for splitting edge chains.
  var ARROW_SPLIT = new RegExp(ARROW.source, 'g');

  var CLOSERS = { '[': ']', '(': ')', '{': '}' };

  function stripLabel(raw) {
    return clean(
      String(raw)
        .replace(/<br\s*\/?>/gi, ', ')
        .replace(/\\n/g, ', ')
        .replace(/["`*]/g, '')
        // Divider runs and bullet glyphs are visual, not spoken.
        .replace(/[-—–]{2,}/g, ', ')
        .replace(/[►▶●■◆→⇒✓✗✔✘]/g, ' ')
        // Leading bracket is the shape delimiter; trailing ones belong to the
        // text itself ("Remote (GitHub)"), so only trim whitespace at the end.
        .replace(/^[\s([{<]+|\s+$/g, '')
    );
  }

  /**
   * Pull `id[Label]` shapes off a line, recording each label and returning the
   * line with the label text removed. Parsing edges on the stripped skeleton
   * keeps punctuation inside labels (---, -->, |) from faking an arrow.
   */
  function stripNodeLabels(line, labels) {
    var out = '';
    var i = 0;
    while (i < line.length) {
      var ch = line[i];
      // Only a bracket right after an identifier opens a node label.
      var idMatch = CLOSERS[ch] ? out.match(/([A-Za-z0-9_.-]+)$/) : null;
      if (!idMatch) {
        out += ch;
        i++;
        continue;
      }
      var depth = 0;
      var j = i;
      var quote = '';
      var body = '';
      while (j < line.length) {
        var c = line[j];
        if (quote) {
          if (c === quote) quote = '';
          body += c;
        } else if (c === '"' || c === "'") {
          quote = c;
          body += c;
        } else if (CLOSERS[c] && c !== '>') {
          depth++;
          body += c;
        } else if (c === ']' || c === ')' || c === '}') {
          depth--;
          if (depth <= 0) {
            j++;
            break;
          }
          body += c;
        } else {
          body += c;
        }
        j++;
      }
      var label = stripLabel(body);
      if (idMatch && label) labels[idMatch[1]] = label;
      i = j;
    }
    return out;
  }

  /**
   * Turn a mermaid definition into prose. The rendered SVG carries no text we
   * can speak, but the source says exactly what connects to what.
   */
  function mermaidToSpeech(src) {
    var lines = String(src)
      .split('\n')
      .map(function (l) {
        return l.replace(/%%.*$/, '').trim();
      })
      .filter(function (l) {
        return (
          l &&
          !/^(classDef|class\s|style\s|click\s|linkStyle|direction\s|accTitle|accDescr|autonumber|loop\s|alt\s|else\b|opt\s|par\s|rect\s|activate\s|deactivate\s)/i.test(l)
        );
      });
    if (!lines.length) return '';

    var head = lines[0].split(/[\s;{]+/)[0].toLowerCase();
    var kind = DIAGRAM_NAMES[head] || 'Diagram';
    var labels = {};
    var sentences = [];

    // Ids keep their underscores; clean() would eat them and break lookups.
    function idOf(s) {
      return String(s).replace(/\s+/g, ' ').replace(/^[|"'\s]+|[|"'\s]+$/g, '');
    }

    function name(id) {
      var key = idOf(id);
      if (!key) return '';
      if (labels[key]) return labels[key];
      // Bare ids read better as words: kv_cache -> "kv cache".
      return stripLabel(key.replace(/[_-]+/g, ' '));
    }

    // Pass 1: harvest every label first — a node is often described on a line
    // after the edge that references it.
    var prepared = [];
    for (var p = 0; p < lines.length; p++) {
      var raw = lines[p].replace(/;+$/, '');
      var part = raw.match(/^(?:participant|actor)\s+([A-Za-z0-9_.-]+)(?:\s+as\s+(.+))?$/i);
      if (part) {
        if (part[2]) labels[part[1]] = stripLabel(part[2]);
        prepared.push(null);
        continue;
      }
      // Strip labels first, so a colon inside label text is not mistaken for
      // the message separator of a sequence-diagram line.
      var skel = stripNodeLabels(raw, labels);
      var msg = '';
      var cut = skel.indexOf(':');
      if (cut !== -1 && ARROW.test(skel.slice(0, cut))) {
        msg = stripLabel(skel.slice(cut + 1));
        skel = skel.slice(0, cut);
      }
      prepared.push({ line: raw, skeleton: skel, message: msg });
    }

    // Pass 2: say it.
    for (var j = 1; j < prepared.length; j++) {
      if (!prepared[j]) continue;
      var line = prepared[j].line;
      var skeleton = prepared[j].skeleton;
      var message = prepared[j].message;

      var sub = line.match(/^subgraph\s+(.+)$/i);
      if (sub) {
        // Pass 1 already harvested `subgraph ID["Title"]` into labels.
        var subId = idOf(skeleton.replace(/^subgraph\s+/i, ''));
        var groupName = labels[subId] || stripLabel(sub[1]).replace(/["\])}]+$/, '');
        if (groupName) sentences.push('Group: ' + groupName + '.');
        continue;
      }
      if (/^end$/i.test(line)) continue;

      var note = line.match(/^note\s+(?:over|left of|right of)\s+[^:]*:\s*(.+)$/i);
      if (note) {
        sentences.push('Note: ' + stripLabel(note[1]) + '.');
        continue;
      }

      if (ARROW.test(skeleton)) {
        var tokens = skeleton.split(ARROW_SPLIT);
        var nodes = [];
        var edgeLabels = [];
        for (var t = 0; t < tokens.length; t++) {
          if (t % 2 === 1) continue; // arrow token
          var piece = tokens[t];
          // An edge label rides on the piece after its arrow: |yes| Next
          var pipe = piece.match(/^\s*\|([^|]*)\|/);
          edgeLabels.push(pipe ? stripLabel(pipe[1]) : '');
          nodes.push(name(pipe ? piece.slice(pipe[0].length) : piece));
        }
        var said = false;
        for (var k = 0; k < nodes.length - 1; k++) {
          if (!nodes[k] || !nodes[k + 1]) continue;
          var via = edgeLabels[k + 1];
          sentences.push(
            nodes[k] +
              (via ? ', ' + via + ', ' : ' ') +
              (message ? 'to ' + nodes[k + 1] + ': ' + message : 'leads to ' + nodes[k + 1]) +
              '.'
          );
          said = true;
        }
        if (said) continue;
      }

      var title = line.match(/^title\s+(.+)$/i);
      if (title) {
        sentences.push('Titled: ' + stripLabel(title[1]) + '.');
        continue;
      }

      // A node declared on its own line: say its label, never its source.
      var loneId = idOf(skeleton);
      if (loneId && labels[loneId]) {
        sentences.push(labels[loneId] + '.');
        continue;
      }

      // Timeline entries, gantt rows, pie slices: "Label : value : detail".
      if (line.indexOf(':') !== -1) {
        var row = clean(line.replace(/\s*:\s*/g, ': '));
        if (row.length > 1) sentences.push(row.replace(/[.:]+$/, '') + '.');
      }
    }

    if (!sentences.length) {
      // Nothing structural parsed: fall back to the labels in reading order.
      var names = [];
      for (var key in labels) {
        if (Object.prototype.hasOwnProperty.call(labels, key)) names.push(labels[key]);
      }
      if (!names.length) return '';
      sentences.push('Showing ' + names.join(', ') + '.');
    }

    var more = '';
    if (sentences.length > MAX_EDGES) {
      more = ' And ' + (sentences.length - MAX_EDGES) + ' more connections.';
      sentences = sentences.slice(0, MAX_EDGES);
    }
    return kind + '. ' + sentences.join(' ') + more;
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
      if (isSkipped(el)) continue;
      var text;
      if (el.matches(MERMAID_SOURCE)) {
        // Highlight the rendered diagram, not the hidden source.
        var render = document.getElementById(
          'mermaid-render-' + (el.id || '').replace('mermaid-', '')
        );
        if (render && !isVisible(render)) continue;
        text = mermaidToSpeech(el.textContent || '');
        if (text) {
          var mparts = split(text);
          for (var mi = 0; mi < mparts.length; mi++) {
            chunks.push({ text: mparts[mi], el: render || el });
          }
        }
        continue;
      }
      if (!isVisible(el)) continue;
      if (el.matches('pre')) {
        text = codeToSpeech(el);
      } else if (el.querySelector(BLOCK_SELECTOR)) {
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
    u.onend = function () {
      if (!state.playing) return;
      state.index++;
      render();
      speakCurrent();
    };
    u.onerror = function (e) {
      // "interrupted"/"canceled" are the normal result of stop()/next().
      if (e && (e.error === 'interrupted' || e.error === 'canceled')) return;
      if (!state.playing) return;
      state.index++;
      if (state.index < state.chunks.length) speakCurrent();
      else stop();
    };
    state.utterance = u;
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
    startKeepAlive();
    return start(false, block);
  }

  function start(silentIfEmpty, fromEl) {
    state.chunks = collect();
    if (!state.chunks.length) {
      if (!silentIfEmpty) flash('Nothing to read on this page');
      return false;
    }
    synth.cancel();
    state.index = fromEl ? indexOfBlock(fromEl) : 0;
    state.playing = true;
    state.paused = false;
    state.waiting = false;
    setResume(true);
    startKeepAlive();
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
    stopKeepAlive();
    synth.cancel();
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
    synth.cancel();
    render();
    speakCurrent();
  }

  /**
   * Chromium drops long-running synthesis after ~15s of wall time. Chunking
   * already avoids most of it; this watchdog covers the rest — but only on
   * Chromium, since pause()/resume() is flaky elsewhere and would risk
   * glitching playback that was working fine.
   */
  var isChromium = /Chrom(e|ium)|Edg\//.test(navigator.userAgent || '');

  function startKeepAlive() {
    stopKeepAlive();
    if (!isChromium) return;
    state.keepAlive = setInterval(function () {
      if (!state.playing || state.paused) return;
      if (!synth.speaking) return;
      synth.pause();
      synth.resume();
    }, 10000);
  }

  function stopKeepAlive() {
    if (state.keepAlive) clearInterval(state.keepAlive);
    state.keepAlive = null;
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
      '<label class="tts-field tts-field-code"><input type="checkbox" class="tts-check" id="ttsCode">' +
      '<span>Code</span></label>' +
      '<button type="button" class="tts-btn tts-btn-stop" data-tts="stop" aria-label="Stop reading">Stop</button>' +
      '<button type="button" class="tts-btn tts-btn-collapse" data-tts="collapse" ' +
      'aria-label="Collapse controls" aria-expanded="true" title="Collapse (drag to move)">▾</button>';
    document.body.appendChild(bar);

    els.bar = bar;
    els.status = bar.querySelector('#ttsStatus');
    els.playPause = bar.querySelector('[data-tts="playpause"]');
    els.rate = bar.querySelector('#ttsRate');
    els.voice = bar.querySelector('#ttsVoice');
    els.code = bar.querySelector('#ttsCode');

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
        synth.cancel();
        speakCurrent();
      }
    });

    els.voice.addEventListener('change', function () {
      lsSet(VOICE_KEY, els.voice.value);
      if (state.playing) {
        state.paused = false;
        synth.cancel();
        speakCurrent();
      }
    });

    els.code.checked = readCode();
    els.code.addEventListener('change', function () {
      lsSet(CODE_KEY, els.code.checked ? '1' : '0');
      if (!state.playing) return;
      // Rebuild the queue and stay on the block currently being read.
      var anchor = state.chunks[state.index] && state.chunks[state.index].el;
      state.chunks = collect();
      // Switching Code off drops the <pre> being read out of the queue, so
      // fall through to the next block instead of restarting from the top.
      state.index = indexOfBlock(anchor);
      state.paused = false;
      synth.cancel();
      render();
      speakCurrent();
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
      synth.cancel();
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
