const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { parseMd, extractMath, splitInlineMath } = require('./lesson-markdown');

const root = path.resolve(__dirname, '..');

function inlineMath(md) {
  return [...parseMd(md).matchAll(/<span class="math-inline" data-math="inline">([^<]*)<\/span>/g)].map(match => match[1]);
}

function lessonDocs() {
  const docs = [];
  const phases = path.join(root, 'phases');
  for (const phase of fs.readdirSync(phases).sort()) {
    const phaseDir = path.join(phases, phase);
    if (!fs.statSync(phaseDir).isDirectory()) continue;
    for (const lesson of fs.readdirSync(phaseDir).sort()) {
      const doc = path.join(phaseDir, lesson, 'docs', 'en.md');
      if (fs.existsSync(doc)) docs.push(doc);
    }
  }
  return docs;
}

test('money and shell dollars stay text', () => {
  for (const md of [
    'The run cost $5 and the retry cost $10.',
    'Bedrock costs $21-$50 per hour.',
    'Spend went from $1,200 to $4,800.',
    'Pricing is quoted in $/1M tokens, about $0.15 here.',
    'Use $HOME or ~ to reach your home folder.',
    'Prompt: $ python3 main.py, then $ ls.',
    'A price of $ 5 and $ 6 is not math.',
  ]) {
    assert.deepEqual(inlineMath(md), [], md);
    assert.doesNotMatch(parseMd(md), /math-/, md);
  }
});

test('an escaped dollar renders as a plain dollar sign', () => {
  const html = parseMd('Budget \\$5 per task and \\$7 per retry.');
  assert.equal(html, '<p>Budget $5 per task and $7 per retry.</p>');
});

test('inline math renders and keeps emphasis markers literal', () => {
  assert.deepEqual(inlineMath('The update is $w \\leftarrow w - \\eta \\nabla L$ each step.'), ['w \\leftarrow w - \\eta \\nabla L']);
  assert.deepEqual(inlineMath('Scale by $a*b*c$ and $x_i^2$.'), ['a*b*c', 'x_i^2']);
  assert.deepEqual(inlineMath('Compare $p < q$ with **bold** text.'), ['p &lt; q']);
  assert.match(parseMd('Compare $p < q$ with **bold** text.'), /<strong>bold<\/strong>/);
  assert.deepEqual(inlineMath('| Term | Formula |\n|---|---|\n| MSE | $\\frac{1}{n}\\sum_i e_i^2$ |'), ['\\frac{1}{n}\\sum_i e_i^2']);
});

test('display math renders as a block in both the fenced and the single-line form', () => {
  const block = parseMd('Text.\n\n$$\nf\'(x) = \\lim_{h \\to 0} \\frac{f(x + h) - f(x)}{h}\n$$\n\nMore text.');
  assert.match(block, /<div class="math-display" data-math="display">f&#39;\(x\)|<div class="math-display" data-math="display">f'\(x\)/);
  assert.match(block, /\\lim_\{h \\to 0\}/);
  assert.match(block, /<p>More text\.<\/p>$/);
  assert.match(parseMd('$$a^2 + b^2 = c^2$$'), /^<div class="math-display" data-math="display">a\^2 \+ b\^2 = c\^2<\/div>$/);
  assert.match(parseMd('$$\nx < y\n$$'), /x &lt; y/);
  const fence = parseMd('```math\n\\begin{aligned} a &= b \\\\ c &= d \\, e \\end{aligned}\n```');
  assert.equal(fence, '<div class="math-display" data-math="display">\\begin{aligned} a &amp;= b \\\\ c &amp;= d \\, e \\end{aligned}</div>');
  assert.deepEqual(extractMath('```math\nq^2\n```\n```python\nx = "$a$"\n```\nThen $y$.'), [
    { display: true, tex: 'q^2', line: 1 },
    { display: false, tex: 'y', line: 7 },
  ]);
});

test('code spans, code blocks and figures never render math', () => {
  assert.equal(parseMd('Run `echo $x$ and $y$` here.'), '<p>Run <code>echo $x$ and $y$</code> here.</p>');
  const block = parseMd('```bash\necho "$HOME" $x$\n```');
  assert.doesNotMatch(block, /math-/);
  assert.match(block, /\$x\$/);
  const fenced = parseMd('```text\n$$\nx^2\n$$\n```');
  assert.doesNotMatch(fenced, /math-/);
  const figure = parseMd('```figure\nloss-$x$\n```');
  assert.doesNotMatch(figure, /math-/);
  assert.match(figure, /class="lesson-figure"/);
});

test('the scanner follows the GitHub rule for opening and closing dollars', () => {
  assert.deepEqual(splitInlineMath('$x$5'), [{ text: '$x$5' }]);
  assert.deepEqual(splitInlineMath('the $k$th row'), [{ text: 'the $k$th row' }]);
  assert.deepEqual(splitInlineMath('US$5 or A$x$'), [{ text: 'US$5 or A$x$' }]);
  assert.deepEqual(splitInlineMath('a $k$th b, then $x$ c'), [{ text: 'a $k$th b, then ' }, { math: 'x' }, { text: ' c' }]);
  assert.deepEqual(splitInlineMath('($x$) and $y$-th'), [{ text: '(' }, { math: 'x' }, { text: ') and ' }, { math: 'y' }, { text: '-th' }]);
  assert.deepEqual(splitInlineMath('$x $'), [{ text: '$x $' }]);
  assert.deepEqual(splitInlineMath('$ x$'), [{ text: '$ x$' }]);
  assert.deepEqual(splitInlineMath('a $x$ b'), [{ text: 'a ' }, { math: 'x' }, { text: ' b' }]);
  assert.deepEqual(splitInlineMath('$\\$5$'), [{ math: '\\$5' }]);
});

test('the lesson page loads a pinned KaTeX build with integrity hashes and renders after parsing', () => {
  const html = fs.readFileSync(path.join(__dirname, 'lesson.html'), 'utf8');
  assert.match(html, /https:\/\/cdn\.jsdelivr\.net\/npm\/katex@\d+\.\d+\.\d+\/dist\//);
  assert.match(html, /KATEX_JS_SRI = 'sha384-[A-Za-z0-9+/=]{64}'/);
  assert.match(html, /KATEX_CSS_SRI = 'sha384-[A-Za-z0-9+/=]{64}'/);
  assert.match(html, /crossOrigin = 'anonymous'/);
  assert.match(html, /renderMermaidBlocks\(article\);\s*renderMathBlocks\(article\);/);
  assert.match(html, /\.lesson-article \.math-inline,\s*\.lesson-article \.math-display \{\s*color: var\(--ink\);/);
});

test('lesson math stays portable to GitHub, the book and the translation pipeline', () => {
  const problems = [];
  for (const doc of lessonDocs()) {
    const rel = path.relative(root, doc);
    const md = fs.readFileSync(doc, 'utf8');
    const lines = md.split(/\r?\n/);
    let inCode = false;
    lines.forEach((line, index) => {
      if (/^```/.test(line)) inCode = !inCode;
      if (inCode) return;
      if (/^\s*\$\$.+\$\$\s*$/.test(line)) problems.push(`${rel}:${index + 1}: write display math as a $$ block on its own lines`);
      const prose = line.replace(/`[^`]+`/g, ' ').replace(/\\\$/g, ' ');
      if (/[)\]]\$[)\]"]|"\$[^\s$][^$]*\$"/.test(prose)) {
        problems.push(`${rel}:${index + 1}: GitHub does not render math closed as ")$)" or wrapped in quotes; rephrase the punctuation around the span`);
      }
      const parts = splitInlineMath(prose);
      let emphasis = 0;
      let stars = 0;
      parts.forEach((part, at) => {
        if (part.math == null) return;
        emphasis += (part.math.match(/[}\])]_[{(\\[]/g) || []).length;
        stars += (part.math.match(/\^\*/g) || []).length;
        const before = at > 0 ? parts[at - 1].text || '' : '';
        if (/\w-$/.test(before)) problems.push(`${rel}:${index + 1}: GitHub does not render math opened right after a hyphen as in rank-$k$`);
      });
      if (stars > 1) problems.push(`${rel}:${index + 1}: GitHub pairs two "^*" in one line as emphasis; write ^{\\ast}`);
      if (emphasis > 1) problems.push(`${rel}:${index + 1}: GitHub pairs two "}_{" in one line as emphasis; write "} _{" with a space`);
    });
    for (const item of extractMath(md)) {
      const where = `${rel}:${item.line}`;
      if (!item.tex.trim()) problems.push(`${where}: empty math`);
      if (!item.display && /^\s*\|/.test(lines[item.line - 1]) && /(?<!\\)\|/.test(item.tex)) {
        problems.push(`${where}: a | inside table math splits the cell; use \\lvert, \\rvert or \\mid`);
      }
      if (!item.display && /^[\d.,]+[kKmMbB]?$/.test(item.tex.trim())) problems.push(`${where}: a money amount reads as math; escape it as \\$`);
      if (/\$/.test(item.tex.replace(/\\\$/g, ''))) problems.push(`${where}: nested dollar inside math`);
      if (/\\operatorname(?![A-Za-z])/.test(item.tex)) problems.push(`${where}: GitHub does not allow \\operatorname; write \\mathop{\\mathrm{name}}`);
      if (/\\phantom(?![A-Za-z])/.test(item.tex)) problems.push(`${where}: GitHub does not allow \\phantom; repeat the text or align with &`);
      const fencedDisplay = item.display && !/^\s*\$\$/.test(lines[item.line - 1]);
      if (!fencedDisplay && /\\[!-\/:-@\[-`{-~]/.test(item.tex)) {
        problems.push(`${where}: GitHub drops a backslash before punctuation inside $ math; use a math fence or a named command such as \\lbrace`);
      }
    }
  }
  assert.deepEqual(problems, []);
});
test('## Summary headings get a section-summary class for the cheat-sheet section', () => {
  assert.match(parseMd('## Summary\n\nRecall the key formulas here.'), /<h2 id="summary" class=" section-summary">Summary<\/h2>/);
  assert.doesNotMatch(parseMd('## The Concept\n\nText.'), /section-summary/);
});
