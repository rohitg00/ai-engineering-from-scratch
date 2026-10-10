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
    var firstBlockquoteDone = false;
    var firstParaAfterMottoDone = false;
    var inBlockquote = false;
    var blockquoteLines = [];
    var mermaidBlocks = 0;
    var inLabChallenge = false;

    function flushLabChallenge() {
      if (!inLabChallenge) return '';
      inLabChallenge = false;
      return '</div>';
    }

    function flushList() {
      if (!inList) return '';
      inList = false;
      var tag = listType === 'ol' ? 'ol' : 'ul';
      var h = '<' + tag + '>';
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
          if (codeLang === 'figure') {
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
        var slug = slugify(h1[1]);
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
          out += '<h2 id="' + slug2 + '">&#128171; Lab Challenge</h2>';
          continue;
        }
        out += flushLabChallenge();
        out += '<h2 id="' + slug2 + '" class="' + sectionClass + '">' + inlineFormat(h2[1]) + '</h2>';
        continue;
      }

      var h3 = line.match(/^### (.+)/);
      if (h3) {
        out += flushList();
        var slug3 = slugify(h3[1]);
        out += '<h3 id="' + slug3 + '">' + inlineFormat(h3[1]) + '</h3>';
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

      var olMatch = line.match(/^\d+\.\s+(.+)/);
      if (olMatch) {
        out += flushTable();
        out += flushBlockquote();
        if (!inList || listType !== 'ol') {
          out += flushList();
          inList = true;
          listType = 'ol';
        }
        listItems.push(olMatch[1]);
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

    out += flushList();
    out += flushTable();
    out += flushBlockquote();
    out += flushLabChallenge();

    return out;
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

  function inlineFormat(text) {
    text = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    text = text.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/\*(.+?)\*/g, '<em>$1</em>');
    text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
    text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, function (m, label, href) {
      if (/^https?:\/\/|^mailto:/i.test(href)) {
        return '<a href="' + href + '" target="_blank" rel="noopener">' + label + '</a>';
      }
      return label;
    });
    return text;
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

  return {
    parseMd: parseMd,
    slugify: slugify
  };
}));
