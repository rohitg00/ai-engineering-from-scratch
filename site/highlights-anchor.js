(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AIFSHighlightAnchor = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  var CONTEXT_LENGTH = 32;
  var FUZZY_MIN_LENGTH = 12;
  var FUZZY_MAX_PATTERN = 256;
  var FUZZY_EDGE = 64;
  var FUZZY_THRESHOLD = 0.75;
  var MAX_EXACT_HITS = 20000;
  var WHOLE_TEXT_FUZZY_MIN = 40;
  var CONTEXT_TOLERANCE = 0.25;
  var MIN_TOKEN_OVERLAP = 0.5;
  var LONG_MIN_RATIO = 0.7;
  var LONG_MAX_RATIO = 1.4;
  var SHORT_CONTEXT_MIN = 0.5;
  var FUZZY_CONTEXT_MIN = 0.3;
  var CJK = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af\uf900-\ufaff\uff66-\uff9f]/;

  var BLOCK_TAGS = {
    ADDRESS: 1, ARTICLE: 1, ASIDE: 1, BLOCKQUOTE: 1, BR: 1, DD: 1, DETAILS: 1, DIV: 1, DL: 1, DT: 1,
    FIGCAPTION: 1, FIGURE: 1, FOOTER: 1, H1: 1, H2: 1, H3: 1, H4: 1, H5: 1, H6: 1, HEADER: 1, HR: 1,
    LI: 1, MAIN: 1, OL: 1, P: 1, PRE: 1, SECTION: 1, SUMMARY: 1, TABLE: 1, TBODY: 1, TD: 1, TFOOT: 1,
    TH: 1, THEAD: 1, TR: 1, UL: 1
  };
  var SKIP_TAGS = {
    CANVAS: 1, INPUT: 1, NAV: 1, NOSCRIPT: 1, SCRIPT: 1, SELECT: 1, STYLE: 1, TEMPLATE: 1, TEXTAREA: 1,
    IFRAME: 1, VIDEO: 1, AUDIO: 1, OBJECT: 1, EMBED: 1
  };
  var SKIP_CLASSES = [
    'ai-panels', 'aifs-hl-ui', 'code-copy', 'code-lang', 'cb-label', 'cb-copy', 'lesson-nav-bottom', 'lesson-section-guide',
    'lesson-action-run', 'lesson-action-tags', 'lesson-action-status', 'quiz-marker', 'quiz-reset-status',
    'mermaid-toolbar', 'mermaid-source', 'm-dither', 'tts-from-here'
  ];
  var TEXT_BUTTON_CLASSES = ['quiz-option', 'lesson-action-step'];
  var ATOMIC_CLASSES = ['math-inline', 'math-display'];
  var UNIT_CLASSES = ['lesson-figure', 'mermaid-container', 'm-fig-art'];
  var CAPTION_CLASSES = ['lf-cap', 'lf-head', 'asf-caption'];
  var BLOCK_CLASSES = ['m-fig-num', 'm-fig-title', 'm-fig-kind', 'm-listing-title', 'm-section-num', 'm-kicker', 'quiz-option-text', 'lesson-action-step-title', 'lesson-action-step-copy', 'lesson-action-step-num'];
  var WHITESPACE = /[\s\u00a0\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]/;
  var INVISIBLE = /[\u00ad\u200b-\u200d\u2060\ufeff]/;

  function classList(el) {
    var value = el && el.getAttribute ? el.getAttribute('class') : '';
    return String(value || '').split(/\s+/);
  }

  function hasAnyClass(el, names) {
    var list = classList(el);
    for (var i = 0; i < names.length; i++) {
      if (list.indexOf(names[i]) >= 0) return true;
    }
    return false;
  }

  function normalize(raw) {
    raw = String(raw || '');
    var out = [];
    var map = [];
    var pendingSpace = -1;
    for (var i = 0; i < raw.length; i++) {
      var ch = raw.charAt(i);
      if (INVISIBLE.test(ch)) continue;
      if (WHITESPACE.test(ch)) {
        if (pendingSpace < 0 && out.length) pendingSpace = i;
        continue;
      }
      if (pendingSpace >= 0) {
        out.push(' ');
        map.push(pendingSpace);
        pendingSpace = -1;
      }
      out.push(ch);
      map.push(i);
    }
    return { text: out.join(''), map: map, rawLength: raw.length };
  }

  function normalizeQuote(text) {
    return normalize(text).text;
  }

  function lowerBound(values, target) {
    var lo = 0;
    var hi = values.length;
    while (lo < hi) {
      var mid = (lo + hi) >> 1;
      if (values[mid] < target) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  function rawToNormalized(normalized, rawStart, rawEnd) {
    var start = lowerBound(normalized.map, rawStart);
    var end = lowerBound(normalized.map, rawEnd);
    var text = normalized.text;
    while (start < end && text.charAt(start) === ' ') start++;
    while (end > start && text.charAt(end - 1) === ' ') end--;
    return { start: start, end: end };
  }

  function normalizedToRaw(normalized, start, end) {
    if (start >= end || !normalized.map.length) return null;
    return { start: normalized.map[start], end: normalized.map[end - 1] + 1 };
  }

  function isLowSurrogate(code) {
    return code >= 0xdc00 && code <= 0xdfff;
  }

  function isHighSurrogate(code) {
    return code >= 0xd800 && code <= 0xdbff;
  }

  function safeStart(text, index) {
    if (index > 0 && index < text.length && isLowSurrogate(text.charCodeAt(index))) return index - 1;
    return index;
  }

  function safeEnd(text, index) {
    if (index > 0 && index < text.length && isHighSurrogate(text.charCodeAt(index - 1))) return index + 1;
    return index;
  }

  function describe(text, start, end) {
    start = safeStart(text, start);
    end = safeEnd(text, end);
    var prefixStart = Math.max(0, start - CONTEXT_LENGTH);
    if (prefixStart > 0 && isLowSurrogate(text.charCodeAt(prefixStart))) prefixStart++;
    var suffixEnd = Math.min(text.length, end + CONTEXT_LENGTH);
    if (suffixEnd < text.length && isHighSurrogate(text.charCodeAt(suffixEnd - 1))) suffixEnd--;
    return {
      quote: {
        exact: text.slice(start, end),
        prefix: text.slice(prefixStart, start),
        suffix: text.slice(end, suffixEnd)
      },
      position: { start: start, end: end, length: text.length }
    };
  }

  function describeSection(model, start, end) {
    var section = sectionAt(model, start);
    if (!section) return { section: '', sectionTitle: '', sectionIndex: -1, sectionOffset: null, sectionSpan: null };
    var span = Math.max(1, section.end - section.start);
    return {
      section: section.id,
      sectionTitle: section.title,
      sectionIndex: section.index,
      sectionOffset: Math.max(0, Math.min(1, (start - section.start) / span)),
      sectionSpan: Math.max(0, Math.min(1, (end - start) / span))
    };
  }

  function commonSuffixLength(a, b) {
    var n = 0;
    while (n < a.length && n < b.length && a.charAt(a.length - 1 - n) === b.charAt(b.length - 1 - n)) n++;
    return n;
  }

  function commonPrefixLength(a, b) {
    var n = 0;
    while (n < a.length && n < b.length && a.charAt(n) === b.charAt(n)) n++;
    return n;
  }

  function findAll(text, exact) {
    var hits = [];
    var from = 0;
    while (hits.length < MAX_EXACT_HITS) {
      var at = text.indexOf(exact, from);
      if (at < 0) break;
      hits.push(at);
      from = at + 1;
    }
    return hits;
  }

  function expectedStart(text, position) {
    if (!position || !Number.isFinite(position.start)) return -1;
    var oldLength = Number(position.length) > 0 ? Number(position.length) : text.length;
    return Math.round(position.start * (text.length / oldLength));
  }

  function contextScore(text, at, exact, quote) {
    var prefix = quote.prefix || '';
    var suffix = quote.suffix || '';
    var before = text.slice(Math.max(0, at - prefix.length), at);
    var after = text.slice(at + exact.length, at + exact.length + suffix.length);
    var prefixScore = prefix.length ? commonSuffixLength(before, prefix) / prefix.length : 1;
    var suffixScore = suffix.length ? commonPrefixLength(after, suffix) / suffix.length : 1;
    return { full: before === prefix && after === suffix, score: prefixScore + suffixScore };
  }

  function pickNearest(candidates, target) {
    var best = candidates[0];
    if (target < 0) return best;
    for (var i = 1; i < candidates.length; i++) {
      if (Math.abs(candidates[i].start - target) < Math.abs(best.start - target)) best = candidates[i];
    }
    return best;
  }

  function locateExact(text, quote, target) {
    var exact = quote.exact;
    var prefix = quote.prefix || '';
    var withContext = findAll(text, prefix + exact + (quote.suffix || ''));
    if (withContext.length) {
      var direct = pickNearest(withContext.map(function (at) {
        return { start: at + prefix.length, end: at + prefix.length + exact.length };
      }), target);
      return { start: direct.start, end: direct.end, method: 'context', score: 1 };
    }
    var hits = findAll(text, exact);
    if (!hits.length) return null;
    var full = [];
    var scored = [];
    for (var i = 0; i < hits.length; i++) {
      var context = contextScore(text, hits[i], exact, quote);
      var candidate = { start: hits[i], end: hits[i] + exact.length, score: context.score };
      if (context.full) full.push(candidate);
      scored.push(candidate);
    }
    if (full.length) {
      var exactContext = pickNearest(full, target);
      return { start: exactContext.start, end: exactContext.end, method: 'context', score: 1 };
    }
    var topScore = -1;
    for (var j = 0; j < scored.length; j++) topScore = Math.max(topScore, scored[j].score);
    var top = scored.filter(function (candidate) { return candidate.score >= topScore - CONTEXT_TOLERANCE; });
    var chosen = pickNearest(top, target);
    if (exact.length < FUZZY_MIN_LENGTH) {
      var near = target >= 0 && Math.abs(chosen.start - target) <= Math.max(200, text.length * 0.02);
      if (chosen.score < SHORT_CONTEXT_MIN && !near) return null;
    }
    return { start: chosen.start, end: chosen.end, method: 'quote', score: Math.min(1, 0.7 + chosen.score * 0.15), ambiguous: top.length > 1 };
  }

  function bestEnd(text, from, to, pattern, maxErrors, target) {
    var m = pattern.length;
    var previous = new Int32Array(m + 1);
    var current = new Int32Array(m + 1);
    for (var i = 0; i <= m; i++) previous[i] = i;
    var best = { errors: maxErrors + 1, end: -1 };
    for (var j = from; j < to; j++) {
      var ch = text.charCodeAt(j);
      current[0] = 0;
      for (var k = 1; k <= m; k++) {
        var cost = pattern.charCodeAt(k - 1) === ch ? 0 : 1;
        var value = previous[k - 1] + cost;
        if (previous[k] + 1 < value) value = previous[k] + 1;
        if (current[k - 1] + 1 < value) value = current[k - 1] + 1;
        current[k] = value;
      }
      var errors = current[m];
      if (errors < best.errors || (errors === best.errors && best.end >= 0 && target >= 0 &&
          Math.abs(j + 1 - target) < Math.abs(best.end - target))) {
        best = { errors: errors, end: j + 1 };
      }
      var swap = previous;
      previous = current;
      current = swap;
    }
    return best.end < 0 ? null : best;
  }

  function reverse(value) {
    return value.split('').reverse().join('');
  }

  function fuzzySpan(text, from, to, pattern, target) {
    var maxErrors = Math.floor(pattern.length * (1 - FUZZY_THRESHOLD));
    from = Math.max(0, from);
    to = Math.min(text.length, to);
    if (to - from < pattern.length - maxErrors) return null;
    var endHit = bestEnd(text, from, to, pattern, maxErrors, target < 0 ? -1 : target + pattern.length);
    if (!endHit) return null;
    var lo = Math.max(from, endHit.end - pattern.length - maxErrors);
    var segment = reverse(text.slice(lo, endHit.end));
    var startHit = bestEnd(segment, 0, segment.length, reverse(pattern), maxErrors, -1);
    if (!startHit) return null;
    var start = endHit.end - startHit.end;
    return { start: start, end: endHit.end, score: 1 - endHit.errors / pattern.length };
  }

  function trimSpan(text, span) {
    var start = span.start;
    var end = span.end;
    while (start < end && text.charAt(start) === ' ') start++;
    while (end > start && text.charAt(end - 1) === ' ') end--;
    span.start = start;
    span.end = end;
    return span;
  }

  function words(value) {
    var counts = {};
    var total = 0;
    var list = String(value).toLowerCase().split(/[^a-z0-9\u00c0-\uffff]+/);
    function count(token) {
      counts[token] = (counts[token] || 0) + 1;
      total++;
    }
    for (var i = 0; i < list.length; i++) {
      var token = list[i];
      if (!token) continue;
      if (!CJK.test(token)) {
        count(token);
        continue;
      }
      var plain = '';
      for (var j = 0; j < token.length; j++) {
        var ch = token.charAt(j);
        if (CJK.test(ch)) {
          if (plain) count(plain);
          plain = '';
          count(ch);
        } else {
          plain += ch;
        }
      }
      if (plain) count(plain);
    }
    return { counts: counts, total: total };
  }

  function tokenOverlap(a, b) {
    var left = words(a);
    var right = words(b);
    if (!left.total || !right.total) return 0;
    var common = 0;
    for (var word in left.counts) {
      if (Object.prototype.hasOwnProperty.call(right.counts, word)) common += Math.min(left.counts[word], right.counts[word]);
    }
    return (2 * common) / (left.total + right.total);
  }

  function fuzzyLong(text, from, to, exact, target) {
    var headPattern = exact.slice(0, FUZZY_EDGE);
    var tailPattern = exact.slice(-FUZZY_EDGE);
    var minLength = Math.floor(exact.length * LONG_MIN_RATIO);
    var maxLength = Math.ceil(exact.length * LONG_MAX_RATIO);
    function fits(head, tail) {
      return head && tail && tail.end > head.start && tail.end - head.start >= minLength && tail.end - head.start <= maxLength;
    }
    var tailTarget = target >= 0 ? target + exact.length - FUZZY_EDGE : -1;
    var head = fuzzySpan(text, from, to, headPattern, target);
    var tail = fuzzySpan(text, from, to, tailPattern, tailTarget);
    if (head && !fits(head, tail)) {
      var tailAfterHead = fuzzySpan(text, head.start + minLength - FUZZY_EDGE, Math.min(to, head.start + maxLength), tailPattern, head.start + exact.length - FUZZY_EDGE);
      if (fits(head, tailAfterHead)) tail = tailAfterHead;
    }
    if (tail && !fits(head, tail)) {
      var headBeforeTail = fuzzySpan(text, Math.max(from, tail.end - maxLength), tail.end - minLength + FUZZY_EDGE, headPattern, tail.end - exact.length);
      if (fits(headBeforeTail, tail)) head = headBeforeTail;
    }
    if (!fits(head, tail)) return null;
    var overlap = tokenOverlap(exact, text.slice(head.start, tail.end));
    return { start: head.start, end: tail.end, score: Math.min(head.score, tail.score, overlap) };
  }

  function fuzzyInRegion(text, exact, from, to, target) {
    if (exact.length <= FUZZY_MAX_PATTERN) {
      var span = fuzzySpan(text, from, to, exact, target);
      if (span && tokenOverlap(exact, text.slice(span.start, span.end)) < MIN_TOKEN_OVERLAP) return null;
      return span;
    }
    return fuzzyLong(text, Math.max(0, from), Math.min(text.length, to), exact, target);
  }

  function contextAgreement(text, span, quote) {
    var prefix = quote.prefix || '';
    var suffix = quote.suffix || '';
    var scores = [];
    if (prefix.trim()) scores.push(tokenOverlap(prefix, text.slice(Math.max(0, span.start - prefix.length - 8), span.start)));
    if (suffix.trim()) scores.push(tokenOverlap(suffix, text.slice(span.end, span.end + suffix.length + 8)));
    if (!scores.length) return 1;
    return scores.reduce(function (a, b) { return a + b; }, 0) / scores.length;
  }

  function locateFuzzy(text, quote, target, regions, wholeText) {
    var exact = quote.exact;
    if (exact.length < FUZZY_MIN_LENGTH) return null;
    var slack = Math.max(2000, exact.length * 4);
    var section = null;
    var tries = [];
    for (var i = 0; i < regions.length; i++) {
      if (regions[i] && regions[i].end > regions[i].start) {
        tries.push(regions[i]);
        if (!section) section = regions[i];
      }
    }
    if (target >= 0) tries.push({ start: target - slack, end: target + exact.length + slack });
    if (wholeText !== false && exact.length >= WHOLE_TEXT_FUZZY_MIN) tries.push({ start: 0, end: text.length });
    for (var j = 0; j < tries.length; j++) {
      var span = fuzzyInRegion(text, exact, tries[j].start - exact.length, tries[j].end + exact.length, target);
      if (!span || span.score < FUZZY_THRESHOLD) continue;
      trimSpan(text, span);
      if (span.end <= span.start) continue;
      var context = contextAgreement(text, span, quote);
      var inSection = !!(section && span.start >= section.start && span.end <= section.end + exact.length);
      if (context < FUZZY_CONTEXT_MIN && !inSection) continue;
      var overlap = tokenOverlap(exact, text.slice(span.start, span.end));
      var confidence = Math.min(1, 0.5 * span.score + 0.3 * overlap + 0.2 * context);
      return { start: span.start, end: span.end, method: 'fuzzy', score: span.score, context: context, inSection: inSection, confidence: Math.round(confidence * 100) / 100 };
    }
    return null;
  }

  function approximate(model, item) {
    var section = sectionById(model, item.section);
    if (!section && item.sectionIndex >= 0 && item.sectionIndex < model.sections.length) section = model.sections[item.sectionIndex];
    if (!section || item.sectionOffset === null || item.sectionOffset === undefined) return null;
    var text = model.text;
    var span = Math.max(1, section.end - section.start);
    var start = section.start + Math.round(span * item.sectionOffset);
    var length = Math.max(1, Math.round(span * (item.sectionSpan || 0.05)));
    var end = Math.min(section.end, start + length);
    var limit = 40;
    var back = 0;
    while (start > section.start && back < limit && !/[\s\u3002\uff0c\uff1b\u3001.,;:!?\uff01\uff1f]/.test(text.charAt(start - 1))) { start--; back++; }
    var forward = 0;
    while (end < section.end && forward < limit && !/[\s\u3002\uff0c\uff1b\u3001.,;:!?\uff01\uff1f]/.test(text.charAt(end))) { end++; forward++; }
    start = safeStart(text, start);
    end = safeEnd(text, end);
    var trimmed = trimSpan(text, { start: start, end: end });
    if (trimmed.end <= trimmed.start) return null;
    return { start: trimmed.start, end: trimmed.end, method: 'approx', score: 0, confidence: 0 };
  }

  function locate(text, selector, options) {
    options = options || {};
    var quote = selector && selector.quote;
    if (!quote || typeof quote.exact !== 'string' || !quote.exact) return null;
    var target = expectedStart(text, selector.position);
    var exact = locateExact(text, quote, target);
    if (exact) {
      exact.confidence = exact.method === 'context' ? 1 : Math.round(exact.score * 100) / 100;
      return exact;
    }
    if (options.exactOnly) return null;
    return locateFuzzy(text, quote, target, options.regions || [], options.wholeText);
  }

  function isElement(node) {
    return node && node.nodeType === 1;
  }

  function attr(el, name) {
    return el.getAttribute ? el.getAttribute(name) : null;
  }

  function tagOf(el) {
    return String(el.tagName || '').toUpperCase();
  }

  function isSkipped(el) {
    var tag = tagOf(el);
    if (SKIP_TAGS[tag]) return true;
    if (hasAnyClass(el, SKIP_CLASSES)) return true;
    if (tag === 'BUTTON' && !hasAnyClass(el, TEXT_BUTTON_CLASSES)) return true;
    if (attr(el, 'aria-hidden') === 'true') return true;
    if (attr(el, 'role') === 'status' || attr(el, 'aria-live')) return true;
    if (tag === 'SUMMARY' && el.parentNode && hasAnyClass(el.parentNode, ['lesson-hints'])) return true;
    return false;
  }

  function isAtomic(el) {
    return hasAnyClass(el, ATOMIC_CLASSES);
  }

  function isUnit(el) {
    return hasAnyClass(el, UNIT_CLASSES);
  }

  function atomicText(el) {
    var annotation = el.querySelector ? el.querySelector('annotation[encoding="application/x-tex"]') : null;
    var tex = annotation ? annotation.textContent : el.textContent;
    return ' ' + String(tex || '').trim() + ' ';
  }

  function shortHash(value) {
    var hash = 2166136261;
    for (var i = 0; i < value.length; i++) {
      hash ^= value.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }

  function unitText(el) {
    if (hasAnyClass(el, ['lesson-figure'])) return ' [figure ' + (attr(el, 'data-figure') || 'unnamed') + '] ';
    if (hasAnyClass(el, ['mermaid-container'])) {
      var source = el.querySelector ? el.querySelector('.mermaid-source') : null;
      return ' [diagram ' + shortHash(normalizeQuote(source ? source.textContent : '')) + '] ';
    }
    var figure = el.parentNode && el.parentNode.parentNode;
    var id = figure && attr(figure, 'id');
    return ' [figure ' + (id || 'unnamed') + '] ';
  }

  function sectionTitle(el) {
    var tag = tagOf(el);
    if (tag !== 'SECTION') return normalizeQuote(el.textContent).slice(0, 120);
    var heading = el.querySelector ? el.querySelector('h1, h2, h3') : null;
    return normalizeQuote(heading ? heading.textContent : '').slice(0, 120);
  }

  function isSectionStart(el) {
    var tag = tagOf(el);
    return !!el.id && (tag === 'H1' || tag === 'H2' || tag === 'H3' || tag === 'SECTION');
  }

  function buildModel(rootNode) {
    var segments = [];
    var sections = [];
    var parts = [];
    var length = 0;

    function push(node, text, kind) {
      if (!text) return;
      segments.push({ node: node, start: length, end: length + text.length, atomic: !!kind, unit: kind === 'unit' });
      parts.push(text);
      length += text.length;
    }

    function boundary() {
      if (parts.length && parts[parts.length - 1] !== ' ') push(null, ' ', '');
    }

    function walkChildren(node, walker) {
      var children = node.childNodes || [];
      for (var i = 0; i < children.length; i++) walker(children[i]);
    }

    function walkSvg(node) {
      if (!isElement(node)) return;
      if (tagOf(node) === 'FOREIGNOBJECT') {
        boundary();
        walkChildren(node, walk);
        boundary();
        return;
      }
      walkChildren(node, walkSvg);
    }

    function walkCaptions(node) {
      if (!isElement(node)) return;
      if (isSkipped(node)) return;
      if (tagOf(node) === 'FIGCAPTION' || hasAnyClass(node, CAPTION_CLASSES)) {
        boundary();
        walkChildren(node, walk);
        boundary();
        return;
      }
      if (tagOf(node) === 'SVG') {
        walkSvg(node);
        return;
      }
      walkChildren(node, walkCaptions);
    }

    function walk(node) {
      if (node.nodeType === 3) {
        push(node, node.nodeValue, '');
        return;
      }
      if (!isElement(node)) return;
      if (isSkipped(node)) {
        boundary();
        return;
      }
      if (isAtomic(node)) {
        push(node, atomicText(node), 'atom');
        return;
      }
      if (isUnit(node)) {
        boundary();
        push(node, unitText(node), 'unit');
        walkChildren(node, walkCaptions);
        boundary();
        return;
      }
      if (tagOf(node) === 'SVG') {
        boundary();
        walkSvg(node);
        boundary();
        return;
      }
      var block = !!BLOCK_TAGS[tagOf(node)] || hasAnyClass(node, BLOCK_CLASSES);
      if (block) boundary();
      if (isSectionStart(node)) {
        sections.push({ id: node.id, rawStart: length, title: sectionTitle(node) });
      }
      walkChildren(node, walk);
      if (block) boundary();
    }

    walkChildren(rootNode, walk);

    var raw = parts.join('');
    var normalized = normalize(raw);
    for (var s = 0; s < sections.length; s++) {
      sections[s].start = lowerBound(normalized.map, sections[s].rawStart);
      sections[s].index = s;
    }
    for (var t = 0; t < sections.length; t++) {
      sections[t].end = t + 1 < sections.length ? sections[t + 1].start : normalized.text.length;
    }
    return { raw: raw, text: normalized.text, normalized: normalized, segments: segments, sections: sections };
  }

  function sectionAt(model, offset) {
    var found = null;
    for (var i = 0; i < model.sections.length; i++) {
      if (model.sections[i].start <= offset) found = model.sections[i];
      else break;
    }
    return found;
  }

  function sectionById(model, id) {
    if (!id) return null;
    for (var i = 0; i < model.sections.length; i++) {
      if (model.sections[i].id === id) return model.sections[i];
    }
    return null;
  }

  function segmentsBetween(model, rawStart, rawEnd) {
    var out = [];
    for (var i = 0; i < model.segments.length; i++) {
      var segment = model.segments[i];
      if (segment.end <= rawStart) continue;
      if (segment.start >= rawEnd) break;
      if (!segment.node) continue;
      out.push({
        segment: segment,
        from: Math.max(0, rawStart - segment.start),
        to: Math.min(segment.end, rawEnd) - segment.start
      });
    }
    return out;
  }

  function isPhrasingParent(node) {
    var parent = node.parentNode;
    if (!parent || !parent.tagName) return false;
    return !/^(UL|OL|TABLE|TBODY|THEAD|TFOOT|TR|DL|SELECT|SVG|G|TEXT|TSPAN)$/.test(tagOf(parent));
  }

  function wrap(model, start, end, createMark) {
    var raw = normalizedToRaw(model.normalized, start, end);
    if (!raw) return { marks: [], atoms: [] };
    var pieces = segmentsBetween(model, raw.start, raw.end);
    var marks = [];
    var atoms = [];
    for (var i = 0; i < pieces.length; i++) {
      var piece = pieces[i];
      var node = piece.segment.node;
      if (piece.segment.atomic) {
        atoms.push(node);
        continue;
      }
      var value = node.nodeValue || '';
      var slice = value.slice(piece.from, piece.to);
      if (!slice || !/\S/.test(slice) || !isPhrasingParent(node)) continue;
      var target = node;
      if (piece.to < value.length) target.splitText(piece.to);
      if (piece.from > 0) target = target.splitText(piece.from);
      var mark = createMark(marks.length);
      target.parentNode.insertBefore(mark, target);
      mark.appendChild(target);
      marks.push(mark);
    }
    return { marks: marks, atoms: atoms };
  }

  function unwrap(mark) {
    var parent = mark.parentNode;
    if (!parent) return;
    while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
    parent.removeChild(mark);
    if (parent.normalize) parent.normalize();
  }

  return {
    CONTEXT_LENGTH: CONTEXT_LENGTH,
    FUZZY_THRESHOLD: FUZZY_THRESHOLD,
    normalize: normalize,
    normalizeQuote: normalizeQuote,
    rawToNormalized: rawToNormalized,
    normalizedToRaw: normalizedToRaw,
    describe: describe,
    describeSection: describeSection,
    locate: locate,
    approximate: approximate,
    tokenOverlap: tokenOverlap,
    buildModel: buildModel,
    sectionAt: sectionAt,
    sectionById: sectionById,
    wrap: wrap,
    unwrap: unwrap
  };
}));
