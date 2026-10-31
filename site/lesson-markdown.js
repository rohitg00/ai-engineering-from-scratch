(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.AIFSLessonMarkdown = api;
  }
}(this, function () {
  'use strict';

  function escapeHtml(str) {
    return String(str == null ? '' : str).replace(/&/g, '&amp;').replace(/\u00a0/g, '&nbsp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function escapeAttr(str) {
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function parseMd(md) {
    var lines = md.split(/\r?\n/);
    var out = '';
    var inCodeBlock = false;
    var codeLang = '';
    var codeLines = [];
    var inTable = false;
    var tableRows = [];
    var inList = false;
    var listType = '';
    var listItems = [];
    var listStart = 1;
    var firstBlockquoteDone = false;
    var firstParaAfterMottoDone = false;
    var inBlockquote = false;
    var blockquoteLines = [];
    var mermaidBlocks = 0;
    var inLabChallenge = false;
    var inMathBlock = false;
    var mathLines = [];
    var usedHeadingIds = Object.create(null);

    function uniqueHeadingId(base) {
      if (!usedHeadingIds[base]) { usedHeadingIds[base] = 1; return base; }
      var n = 2;
      while (usedHeadingIds[base + '-' + n]) n++;
      usedHeadingIds[base + '-' + n] = 1;
      return base + '-' + n;
    }

    function flushLabChallenge() {
      if (!inLabChallenge) return '';
      inLabChallenge = false;
      return '</div>';
    }

    function flushList() {
      if (!inList) return '';
      inList = false;
      var tag = listType === 'ol' ? 'ol' : 'ul';
      var h = tag === 'ol' && listStart > 1
        ? '<ol start="' + listStart + '" style="counter-reset: ol-counter ' + (listStart - 1) + '">'
        : '<' + tag + '>';
      for (var li = 0; li < listItems.length; li++) {
        h += '<li>' + inlineFormat(listItems[li]) + '</li>';
      }
      h += '</' + tag + '>';
      listItems = [];
      return h;
    }

    function flushTable() {
      if (!inTable) return '';
      inTable = false;
      if (tableRows.length < 2) return '';
      var headers = tableRows[0];
      var isKeyTerms = false;
      for (var th = 0; th < headers.length; th++) {
        if (headers[th].toLowerCase().indexOf('what people say') >= 0 || headers[th].toLowerCase().indexOf('people say') >= 0) {
          isKeyTerms = true;
        }
      }
      var h = '<div class="table-wrap' + (isKeyTerms ? ' key-terms-table' : '') + '"><table><thead><tr>';
      for (var ti = 0; ti < headers.length; ti++) {
        h += '<th>' + inlineFormat(headers[ti].trim()) + '</th>';
      }
      h += '</tr></thead><tbody>';
      for (var ri = 2; ri < tableRows.length; ri++) {
        var cells = tableRows[ri];
        h += '<tr>';
        for (var ci = 0; ci < headers.length; ci++) {
          var cls = '';
          if (isKeyTerms) {
            var headerLower = (headers[ci] || '').toLowerCase();
            if (headerLower.indexOf('say') >= 0) cls = ' class="col-says"';
          }
          h += '<td' + cls + '>' + inlineFormat((cells[ci] || '').trim()) + '</td>';
        }
        h += '</tr>';
      }
      h += '</tbody></table></div>';
      tableRows = [];
      return h;
    }

    function flushBlockquote() {
      if (!inBlockquote) return '';
      inBlockquote = false;
      var text = blockquoteLines.join(' ');
      blockquoteLines = [];
      if (!firstBlockquoteDone) {
        firstBlockquoteDone = true;
        return '<div class="motto">' + inlineFormat(text) + '</div>';
      }
      return '<blockquote><p>' + inlineFormat(text) + '</p></blockquote>';
    }

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];

      if (inCodeBlock) {
        if (line.match(/^```\s*$/)) {
          inCodeBlock = false;
          var raw = codeLines.join('\n');
          if (codeLang === 'math') {
            out += mathBlock(raw);
          } else if (codeLang === 'figure') {
            out += '<div class="lesson-figure" data-figure="' + escapeHtml(raw.trim()) + '"></div>';
          } else if (codeLang === 'mermaid') {
            mermaidBlocks++;
            out += '<div class="mermaid-container">';
            out += '<div class="mermaid-block" data-mermaid-index="' + mermaidBlocks + '">';
            out += '<div class="mermaid-toolbar">';
            out += '<button type="button" class="mermaid-btn mermaid-expand" data-mermaid-index="' + mermaidBlocks + '">Expand</button>';
            out += '</div>';
            out += '<pre class="mermaid mermaid-source" id="mermaid-' + mermaidBlocks + '">' + escapeHtml(raw) + '</pre>';
            out += '<div class="mermaid-render" id="mermaid-render-' + mermaidBlocks + '"></div>';
            out += '</div>';
            out += '</div>';
          } else {
            out += renderCodeBlock(raw, codeLang);
          }
          codeLines = [];
          codeLang = '';
        } else {
          codeLines.push(line);
        }
        continue;
      }

      if (inMathBlock) {
        if (line.trim() === '$$') {
          inMathBlock = false;
          out += mathBlock(mathLines.join('\n'));
          mathLines = [];
        } else {
          mathLines.push(line);
        }
        continue;
      }

      var displayMath = line.match(/^\s*\$\$(.*?)(\$\$)?\s*$/);
      if (displayMath && (displayMath[2] ? displayMath[1].trim() : !displayMath[1].trim())) {
        out += flushList();
        out += flushTable();
        out += flushBlockquote();
        if (displayMath[2]) {
          out += mathBlock(displayMath[1]);
        } else {
          inMathBlock = true;
          mathLines = [];
        }
        continue;
      }

      var codeStart = line.match(/^```(\w*)/);
      if (codeStart) {
        out += flushList();
        out += flushTable();
        out += flushBlockquote();
        inCodeBlock = true;
        codeLang = codeStart[1] || '';
        codeLines = [];
        continue;
      }

      if (line.match(/^\s*\|.*\|\s*$/)) {
        out += flushList();
        out += flushBlockquote();
        if (!inTable) inTable = true;
        tableRows.push(splitTableRow(line));
        continue;
      } else if (inTable) {
        out += flushTable();
      }

      if (line.match(/^>\s/)) {
        out += flushList();
        out += flushTable();
        if (!inBlockquote) inBlockquote = true;
        blockquoteLines.push(line.replace(/^>\s?/, ''));
        continue;
      } else if (inBlockquote) {
        out += flushBlockquote();
      }

      var h1 = line.match(/^# (.+)/);
      if (h1) {
        out += flushList();
        out += flushLabChallenge();
        var slug = uniqueHeadingId(slugify(h1[1]));
        out += '<h1 id="' + slug + '">' + inlineFormat(h1[1]) + '</h1>';
        continue;
      }

      var h2 = line.match(/^## (.+)/);
      if (h2) {
        out += flushList();
        var slug2 = slugify(h2[1]);
        var sectionClass = '';
        var txt = h2[1].toLowerCase();
        if (txt.indexOf('build it') >= 0 || txt.indexOf('build ') === 0) sectionClass = ' section-build';
        else if (txt.indexOf('use it') >= 0 || txt.indexOf('use ') === 0) sectionClass = ' section-use';
        else if (txt.indexOf('ship it') >= 0 || txt.indexOf('ship ') === 0) sectionClass = ' section-ship';
        else if (txt.indexOf('summary') === 0) sectionClass = ' section-summary';
        if (txt.indexOf('learning objectives') >= 0) {
          var objItems = [];
          for (var lo = i + 1; lo < lines.length; lo++) {
            var loLine = lines[lo];
            if (loLine.match(/^[-*]\s+(.+)/)) {
              objItems.push(loLine.replace(/^[-*]\s+/, ''));
            } else if (loLine.trim() === '') {
              continue;
            } else {
              break;
            }
          }
          out += '<div class="learning-objectives"><div class="learning-objectives-title">&#127919; Learning Objectives</div><ul>';
          for (var oi = 0; oi < objItems.length; oi++) {
            out += '<li>' + inlineFormat(objItems[oi]) + '</li>';
          }
          out += '</ul></div>';
          i = lo - 1;
          continue;
        }
        if (txt.indexOf('lab challenge') >= 0) {
          out += flushLabChallenge();
          inLabChallenge = true;
          out += '<div class="lab-challenge">';
          out += '<h2 id="' + uniqueHeadingId(slug2) + '">&#128171; Lab Challenge</h2>';
          continue;
        }
        out += flushLabChallenge();
        out += '<h2 id="' + uniqueHeadingId(slug2) + '" class="' + sectionClass + '">' + inlineFormat(h2[1]) + '</h2>';
        continue;
      }

      var h3 = line.match(/^### (.+)/);
      if (h3) {
        out += flushList();
        var slug3 = slugify(h3[1]);
        out += '<h3 id="' + uniqueHeadingId(slug3) + '">' + inlineFormat(h3[1]) + '</h3>';
        continue;
      }

      var h4 = line.match(/^#### (.+)/);
      if (h4) {
        out += flushList();
        var slug4 = slugify(h4[1]);
        out += '<h4 id="' + uniqueHeadingId(slug4) + '">' + inlineFormat(h4[1]) + '</h4>';
        continue;
      }

      if (line.match(/^---+$/)) {
        out += flushList();
        out += '<hr>';
        continue;
      }

      var ulMatch = line.match(/^[-*]\s+(.+)/);
      if (ulMatch) {
        out += flushTable();
        out += flushBlockquote();
        if (!inList || listType !== 'ul') {
          out += flushList();
          inList = true;
          listType = 'ul';
        }
        listItems.push(ulMatch[1]);
        continue;
      }

      var olMatch = line.match(/^(\d+)\.\s+(.+)/);
      if (olMatch) {
        out += flushTable();
        out += flushBlockquote();
        if (!inList || listType !== 'ol') {
          out += flushList();
          inList = true;
          listType = 'ol';
          listStart = parseInt(olMatch[1], 10) || 1;
        }
        listItems.push(olMatch[2]);
        continue;
      }

      if (inList) {
        out += flushList();
      }

      if (line.trim() === '') {
        continue;
      }

      var paraClass = '';
      if (firstBlockquoteDone && !firstParaAfterMottoDone) {
        var isMetaLine = line.match(/^\*\*[^*]+\*\*\s*:/);
        if (!isMetaLine) {
          paraClass = ' class="drop-cap"';
          firstParaAfterMottoDone = true;
        }
      }

      var metaMatch = line.match(/^\*\*([^*]+)\*\*:\s*(.+)/);
      if (metaMatch && !firstParaAfterMottoDone) {
        out += '<div class="lesson-meta-tag"><strong>' + escapeHtml(metaMatch[1]) + ':</strong> ' + inlineFormat(metaMatch[2]) + '</div>';
        continue;
      }

      out += '<p' + paraClass + '>' + inlineFormat(line) + '</p>';
    }

    if (inMathBlock) out += mathBlock(mathLines.join('\n'));
    out += flushList();
    out += flushTable();
    out += flushBlockquote();
    out += flushLabChallenge();

    return out;
  }

  function mathBlock(tex) {
    return '<div class="math-display" data-math="display">' + escapeHtml(tex.trim()) + '</div>';
  }

  function isSpace(ch) {
    return ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r' || ch === '\u00a0';
  }

  function isWordChar(ch) {
    return /[A-Za-z0-9_]/.test(ch);
  }

  function closingDollar(text, start) {
    for (var j = start; j < text.length; j++) {
      var ch = text.charAt(j);
      if (ch === '\\') {
        j++;
        continue;
      }
      if (ch !== '$') continue;
      if (j > start && !isSpace(text.charAt(j - 1)) && !isWordChar(text.charAt(j + 1))) return j;
      return -1;
    }
    return -1;
  }

  function splitInlineMath(text) {
    var parts = [];
    var plain = '';
    for (var i = 0; i < text.length; i++) {
      var ch = text.charAt(i);
      if (ch === '\\' && text.charAt(i + 1) === '$') {
        plain += '$';
        i++;
        continue;
      }
      if (ch === '$' && text.charAt(i + 1) === '$') {
        plain += '$$';
        i++;
        continue;
      }
      if (ch === '$' && i + 1 < text.length && !isSpace(text.charAt(i + 1)) && !isWordChar(text.charAt(i - 1))) {
        var end = closingDollar(text, i + 1);
        if (end > 0) {
          if (plain) parts.push({ text: plain });
          plain = '';
          parts.push({ math: text.slice(i + 1, end) });
          i = end;
          continue;
        }
      }
      plain += ch;
    }
    if (plain) parts.push({ text: plain });
    return parts;
  }

  function extractMath(md) {
    var found = [];
    var lines = md.split(/\r?\n/);
    var inCode = false;
    var mathFence = [];
    var mathStart = 0;
    var block = null;
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (block) {
        if (line.trim() === '$$') {
          found.push({ display: true, tex: block.join('\n').trim(), line: i + 1 });
          block = null;
        } else {
          block.push(line);
        }
        continue;
      }
      var fence = line.match(/^```(\w*)/);
      if (fence) {
        if (inCode === 'math') found.push({ display: true, tex: mathFence.join('\n').trim(), line: mathStart });
        if (inCode) {
          inCode = false;
        } else {
          inCode = fence[1] || 'code';
          mathFence = [];
          mathStart = i + 1;
        }
        continue;
      }
      if (inCode === 'math') {
        mathFence.push(line);
        continue;
      }
      if (inCode) continue;
      if (line.trim() === '$$') {
        block = [];
        continue;
      }
      var single = line.match(/^\s*\$\$(.+?)\$\$\s*$/);
      if (single) {
        found.push({ display: true, tex: single[1].trim(), line: i + 1 });
        continue;
      }
      var masked = line.replace(/`[^`]+`/g, function (m) { return new Array(m.length + 1).join(' '); });
      splitInlineMath(masked).forEach(function (part) {
        if (part.math != null) found.push({ display: false, tex: part.math, line: i + 1 });
      });
    }
    return found;
  }

  function splitTableRow(line) {
    var cells = [];
    var cur = '';
    var inCode = false;
    for (var i = 0; i < line.length; i++) {
      var ch = line.charAt(i);
      if (ch === '\\' && line.charAt(i + 1) === '|') {
        cur += '|';
        i++;
        continue;
      }
      if (ch === '`') {
        inCode = !inCode;
        cur += ch;
        continue;
      }
      if (ch === '|' && !inCode) {
        cells.push(cur);
        cur = '';
        continue;
      }
      cur += ch;
    }
    cells.push(cur);
    if (cells.length && cells[0].trim() === '') cells.shift();
    if (cells.length && cells[cells.length - 1].trim() === '') cells.pop();
    return cells.map(function (c) { return c.trim(); });
  }

  function escapeInline(text) {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function inlineFormat(text) {
    var kept = [];
    function keep(html) {
      kept.push(html);
      return '\u0000' + (kept.length - 1) + '\u0000';
    }
    text = text.replace(/`([^`]+)`/g, function (m, code) {
      return keep('<code>' + escapeInline(code) + '</code>');
    });
    text = splitInlineMath(text).map(function (part) {
      if (part.math == null) return part.text;
      return keep('<span class="math-inline" data-math="inline">' + escapeHtml(part.math) + '</span>');
    }).join('');
    text = escapeInline(text);
    text = text.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/\*(.+?)\*/g, '<em>$1</em>');
    // Parse inline links by balancing parentheses in the destination.
    // URLs such as DOI links may contain their own parentheses.
    var out = '';
    for (var i = 0; i < text.length;) {
      if (text.charAt(i) === '\\' && text.charAt(i + 1) === '[') {
        out += '[';
        i += 2;
        continue;
      }
      if (text.charAt(i) !== '[') {
        out += text.charAt(i++);
        continue;
      }

      var labelEnd = -1;
      for (var labelCursor = i + 1; labelCursor < text.length; labelCursor++) {
        if (text.charAt(labelCursor) === '\\') {
          labelCursor++;
          continue;
        }
        if (text.charAt(labelCursor) === ']') {
          labelEnd = labelCursor;
          break;
        }
      }
      if (labelEnd === -1 || text.charAt(labelEnd + 1) !== '(') {
        out += text.charAt(i++);
        continue;
      }

      var hrefStart = labelEnd + 2;
      var depth = 1;
      var hrefEnd = hrefStart;
      while (hrefEnd < text.length && depth > 0) {
        var hrefChar = text.charAt(hrefEnd);
        if (hrefChar === '\\') {
          hrefEnd += 2;
          continue;
        }
        if (hrefChar === '(') depth++;
        if (hrefChar === ')') depth--;
        hrefEnd++;
      }

      if (depth !== 0) {
        out += text.charAt(i++);
        continue;
      }

      var label = unescapeMarkdownPunctuation(text.slice(i + 1, labelEnd));
      var href = unescapeMarkdownPunctuation(text.slice(hrefStart, hrefEnd - 1));
      if (/^https?:\/\/|^mailto:/i.test(href)) {
        out += '<a href="' + href + '" target="_blank" rel="noopener">' + label + '</a>';
      } else {
        out += label;
      }
      i = hrefEnd;
    }
    return out.replace(/\u0000(\d+)\u0000/g, function (m, index) { return kept[Number(index)]; });
  }

  function unescapeMarkdownPunctuation(value) {
    var unescaped = '';
    for (var i = 0; i < value.length; i++) {
      var current = value.charAt(i);
      var next = value.charAt(i + 1);
      if (current === '\\' && (next === '[' || next === ']' || next === '(' || next === ')' || next === '\\')) {
        unescaped += next;
        i++;
      } else {
        unescaped += current;
      }
    }
    return unescaped;
  }

  function slugify(text) {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }

  function renderCodeBlock(code, lang) {
    var highlighted = highlightSyntax(escapeHtml(code), lang);
    var langLabel = lang ? '<span class="code-lang">' + escapeHtml(lang) + '</span>' : '';
    return '<pre>' + langLabel + '<button class="code-copy" data-code="' + escapeAttr(code) + '">Copy</button><code>' + highlighted + '</code></pre>';
  }

  function highlightSyntax(code, lang) {
    var keywords, commentPattern;

    if (lang === 'python' || lang === 'py') {
      keywords = /\b(def|class|return|if|elif|else|for|while|in|import|from|as|with|try|except|finally|raise|yield|lambda|not|and|or|is|None|True|False|print|self|pass|break|continue|assert|global)\b/g;
      commentPattern = /(#[^\n]*)/g;
    } else if (lang === 'julia') {
      keywords = /\b(function|end|if|elseif|else|for|while|in|using|import|return|struct|mutable|abstract|type|module|export|let|const|begin|do|try|catch|finally|throw|true|false|nothing|println)\b/g;
      commentPattern = /(#[^\n]*)/g;
    } else if (lang === 'javascript' || lang === 'js' || lang === 'typescript' || lang === 'ts') {
      keywords = /\b(function|const|let|var|return|if|else|for|while|class|new|this|import|export|from|async|await|try|catch|throw|typeof|instanceof|true|false|null|undefined|console)\b/g;
      commentPattern = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)/g;
    } else if (lang === 'rust') {
      keywords = /\b(fn|let|mut|struct|enum|impl|trait|pub|use|mod|self|super|crate|return|if|else|for|while|loop|match|async|await|true|false|None|Some|Ok|Err|println)\b/g;
      commentPattern = /(\/\/[^\n]*)/g;
    } else {
      keywords = /\b(function|def|class|return|if|else|for|while|import|from|const|let|var|true|false|null|None|print|println)\b/g;
      commentPattern = /(#[^\n]*|\/\/[^\n]*)/g;
    }

    var tokens = [];
    function stash(match) {
      var id = '\x00TOK' + tokens.length + '\x00';
      tokens.push(match);
      return id;
    }

    code = code.replace(commentPattern, function (m) { return stash('<span class="syn-comment">' + m + '</span>'); });
    code = code.replace(/(&quot;(?:[^&]|&(?!quot;))*?&quot;|&#39;(?:[^&]|&(?!#39;))*?&#39;|&quot;&quot;&quot;[\s\S]*?&quot;&quot;&quot;)/g, function (m) { return stash('<span class="syn-string">' + m + '</span>'); });
    code = code.replace(/"([^"]*?)"/g, function (m) { return stash('<span class="syn-string">' + m + '</span>'); });

    code = code.replace(keywords, '<span class="syn-keyword">$1</span>');
    code = code.replace(/\b(\d+\.?\d*)\b/g, '<span class="syn-number">$1</span>');

    for (var ti = 0; ti < tokens.length; ti++) {
      code = code.replace('\x00TOK' + ti + '\x00', tokens[ti]);
    }
    return code;
  }

  var QUIZ_ANCHORS = {
    pre: ['the-concept', 'concept', 'build-it', 'build'],
    check: ['use-it', 'use', 'ship-it', 'ship'],
    post: ['key-terms']
  };

  function headingIds(html) {
    var ids = [];
    var pattern = /<h2 id="([^"]*)"/g;
    var match;
    while ((match = pattern.exec(html)) !== null) ids.push(match[1]);
    return ids;
  }

  function anchorIndex(ids, keys) {
    for (var k = 0; k < keys.length; k++) {
      for (var i = 0; i < ids.length; i++) {
        if (ids[i] === keys[k] || ids[i].indexOf(keys[k] + '-') === 0) return i;
      }
    }
    return -1;
  }

  function sectionIds(markdown) {
    var ids = [];
    var fence = false;
    var lines = String(markdown || '').split('\n');
    for (var i = 0; i < lines.length; i++) {
      if (/^\s*```/.test(lines[i])) { fence = !fence; continue; }
      if (fence) continue;
      var h2 = lines[i].match(/^## (.+)/);
      if (h2) ids.push(slugify(h2[1]));
    }
    return ids;
  }

  function quizPlacement(ids, referenceIds) {
    var n = ids.length;
    var source = referenceIds && referenceIds.length ? referenceIds : ids;
    var m = source.length;
    var pre = anchorIndex(source, QUIZ_ANCHORS.pre);
    var post = anchorIndex(source, QUIZ_ANCHORS.post);
    var check = anchorIndex(source, QUIZ_ANCHORS.check);
    var first = m && source[0].indexOf('learning-objectives') === 0 ? 1 : 0;
    if (pre < 0) pre = m - first >= 2 ? first + 1 : first;
    if (post < 0) post = m;
    if (post < pre) post = pre;
    if (check < 0 || check > post) {
      check = post - 1 > pre ? post - 1 : post;
    }
    if (check < pre) check = pre;
    function toPage(index) {
      return index >= m ? n : Math.min(index, n);
    }
    return { pre: toPage(pre), check: toPage(check), post: toPage(post), count: n };
  }

  function quizPanelQuestions(data) {
    var source = data && (data.questions || data);
    if (!Array.isArray(source)) return null;
    var shownInline = source.some(function (q) {
      return q && q.question && Array.isArray(q.options) &&
        typeof q.correct === 'number' && q.correct >= 0 && q.correct < q.options.length;
    });
    return shownInline ? [] : null;
  }

  return {
    parseMd: parseMd,
    headingIds: headingIds,
    sectionIds: sectionIds,
    quizPlacement: quizPlacement,
    quizPanelQuestions: quizPanelQuestions,
    extractMath: extractMath,
    splitInlineMath: splitInlineMath,
    slugify: slugify,
    escapeAttr: escapeAttr,
    inlineFormat: inlineFormat,
    splitTableRow: splitTableRow,
    highlightSyntax: highlightSyntax
  };
}));
