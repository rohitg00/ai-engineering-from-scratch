'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const Anchor = require('./highlights-anchor');
const { parseMd } = require('./lesson-markdown');

class TextNode {
  constructor(value) { this.nodeType = 3; this.nodeValue = value; this.parentNode = null; }
  get textContent() { return this.nodeValue; }
  splitText(offset) {
    const rest = new TextNode(this.nodeValue.slice(offset));
    this.nodeValue = this.nodeValue.slice(0, offset);
    const parent = this.parentNode;
    const at = parent.childNodes.indexOf(this);
    parent.childNodes.splice(at + 1, 0, rest);
    rest.parentNode = parent;
    return rest;
  }
}

class ElementNode {
  constructor(tag, attrs = {}) {
    this.nodeType = 1;
    this.tagName = tag.toUpperCase();
    this.attributes = { ...attrs };
    this.childNodes = [];
    this.parentNode = null;
  }
  get id() { return this.attributes.id || ''; }
  set id(value) { this.attributes.id = value; }
  getAttribute(name) { return Object.prototype.hasOwnProperty.call(this.attributes, name) ? this.attributes[name] : null; }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  get firstChild() { return this.childNodes[0] || null; }
  get textContent() { return this.childNodes.map(child => child.textContent).join(''); }
  appendChild(child) { return this.insertBefore(child, null); }
  insertBefore(child, before) {
    if (child.parentNode) child.parentNode.removeChild(child);
    const at = before ? this.childNodes.indexOf(before) : this.childNodes.length;
    this.childNodes.splice(at, 0, child);
    child.parentNode = this;
    return child;
  }
  removeChild(child) {
    this.childNodes.splice(this.childNodes.indexOf(child), 1);
    child.parentNode = null;
    return child;
  }
  normalize() {
    const merged = [];
    for (const child of this.childNodes) {
      const last = merged[merged.length - 1];
      if (child.nodeType === 3 && last && last.nodeType === 3) last.nodeValue += child.nodeValue;
      else if (child.nodeType !== 3 || child.nodeValue) merged.push(child);
    }
    this.childNodes = merged;
  }
  matchesSimple(selector) {
    const match = selector.trim().match(/^([a-zA-Z0-9]*)(?:\.([a-zA-Z0-9_-]+))?(?:\[([a-z-]+)="([^"]*)"\])?$/);
    if (!match) throw new Error('unsupported selector ' + selector);
    const [, tag, cls, name, value] = match;
    if (tag && this.tagName !== tag.toUpperCase()) return false;
    if (cls && !(this.getAttribute('class') || '').split(/\s+/).includes(cls)) return false;
    if (name && this.getAttribute(name) !== value) return false;
    return true;
  }
  querySelector(selector) {
    const parts = selector.split(',');
    const stack = [...this.childNodes];
    while (stack.length) {
      const node = stack.shift();
      if (node.nodeType !== 1) continue;
      if (parts.some(part => node.matchesSimple(part))) return node;
      stack.unshift(...node.childNodes);
    }
    return null;
  }
  findAll(predicate, out = []) {
    for (const child of this.childNodes) {
      if (child.nodeType === 1) {
        if (predicate(child)) out.push(child);
        child.findAll(predicate, out);
      }
    }
    return out;
  }
}

const VOID = new Set(['br', 'hr', 'img', 'input', 'meta', 'link']);

function decode(text) {
  return text.replace(/&(#\d+|#x[0-9a-f]+|amp|lt|gt|quot|apos);/gi, (match, code) => {
    const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[code.toLowerCase()];
    if (named) return named;
    return String.fromCodePoint(code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10));
  });
}

function parseHtml(html) {
  const root = new ElementNode('article', { class: 'lesson-article' });
  const stack = [root];
  const pattern = /<!--[\s\S]*?-->|<\/([a-zA-Z0-9]+)\s*>|<([a-zA-Z0-9]+)((?:\s+[^\s=>]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>|([^<]+)/g;
  let match;
  while ((match = pattern.exec(html))) {
    const top = stack[stack.length - 1];
    if (match[0].startsWith('<!--')) continue;
    if (match[1]) {
      const tag = match[1].toUpperCase();
      for (let i = stack.length - 1; i > 0; i--) {
        if (stack[i].tagName === tag) { stack.length = i; break; }
      }
      continue;
    }
    if (match[2]) {
      const attrs = {};
      const attrPattern = /([^\s=>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
      let attr;
      while ((attr = attrPattern.exec(match[3] || ''))) attrs[attr[1]] = decode(attr[2] ?? attr[3] ?? attr[4] ?? '');
      const element = new ElementNode(match[2], attrs);
      top.appendChild(element);
      if (!match[4] && !VOID.has(match[2].toLowerCase())) stack.push(element);
      continue;
    }
    top.appendChild(new TextNode(decode(match[5])));
  }
  return root;
}

function lessonDom(md) {
  return parseHtml(parseMd(md));
}

function modelOf(md) {
  return Anchor.buildModel(lessonDom(md));
}

function select(text, exact, occurrence = 0) {
  let at = -1;
  for (let i = 0; i <= occurrence; i++) at = text.indexOf(exact, at + 1);
  assert.ok(at >= 0, `"${exact}" is in the text`);
  return Anchor.describe(text, at, at + exact.length);
}

const LESSON = [
  '# Gradient Descent',
  '',
  '## The Problem',
  '',
  'A model has parameters. Training moves the parameters so that the loss gets smaller on every step.',
  '',
  'The gradient points in the direction of steepest increase, so we step the other way.',
  '',
  '## Build It',
  '',
  'Start with one parameter and a learning rate that is small enough to stay stable.',
  '',
  '```python',
  'def step(w, grad, lr):',
  '    return w - lr * grad',
  '```',
  '',
  'The update rule is $w \\leftarrow w - \\eta \\nabla L$ for every parameter.',
  '',
  '## Summary',
  '',
  'Small steps converge. Large steps can overshoot and diverge.',
].join('\n');

test('normalization collapses whitespace and maps back to raw offsets', () => {
  const normalized = Anchor.normalize('  one \n\t two\u00a0three\u200b four  ');
  assert.equal(normalized.text, 'one two three four');
  const span = Anchor.rawToNormalized(normalized, 2, 13);
  assert.equal(normalized.text.slice(span.start, span.end), 'one two');
  const raw = Anchor.normalizedToRaw(normalized, span.start, span.end);
  assert.equal('  one \n\t two\u00a0three'.slice(raw.start, raw.end), 'one \n\t two');
});

test('an unchanged lesson re-anchors by quote and context', () => {
  const model = modelOf(LESSON);
  const selector = select(model.text, 'steepest increase');
  const hit = Anchor.locate(model.text, selector);
  assert.equal(hit.method, 'context');
  assert.equal(model.text.slice(hit.start, hit.end), 'steepest increase');
});

test('text inserted before the quote moves the anchor but keeps the context match', () => {
  const before = modelOf(LESSON);
  const selector = select(before.text, 'the loss gets smaller');
  const edited = LESSON.replace('## The Problem\n\n', '## The Problem\n\nThis paragraph is new and pushes everything down the page by a lot of characters.\n\n');
  const after = modelOf(edited);
  const hit = Anchor.locate(after.text, selector);
  assert.equal(hit.method, 'context');
  assert.ok(hit.start > selector.position.start);
  assert.equal(after.text.slice(hit.start, hit.end), 'the loss gets smaller');
});

test('text inserted after the quote keeps the anchor in place', () => {
  const before = modelOf(LESSON);
  const selector = select(before.text, 'one parameter and a learning rate');
  const edited = LESSON.replace('Small steps converge.', 'Small steps converge, slowly but surely.');
  const after = modelOf(edited);
  const hit = Anchor.locate(after.text, selector);
  assert.equal(hit.method, 'context');
  assert.equal(hit.start, selector.position.start);
});

test('text inserted inside the quote falls back to a bounded fuzzy match', () => {
  const before = modelOf(LESSON);
  const selector = select(before.text, 'Training moves the parameters so that the loss gets smaller');
  const edited = LESSON.replace('Training moves the parameters', 'Training slowly moves the parameters');
  const after = modelOf(edited);
  const hit = Anchor.locate(after.text, selector);
  assert.equal(hit.method, 'fuzzy');
  assert.ok(hit.score >= Anchor.FUZZY_THRESHOLD);
  assert.equal(after.text.slice(hit.start, hit.end), 'Training slowly moves the parameters so that the loss gets smaller');
});

test('a context edit around the quote still finds the exact quote alone', () => {
  const before = modelOf(LESSON);
  const selector = select(before.text, 'steepest increase');
  const edited = LESSON.replace('The gradient points in the direction of steepest increase, so we step the other way.', 'Gradients aim toward steepest increase; we walk downhill instead.');
  const after = modelOf(edited);
  const hit = Anchor.locate(after.text, selector);
  assert.equal(hit.method, 'quote');
  assert.equal(after.text.slice(hit.start, hit.end), 'steepest increase');
});

test('deleted text orphans the highlight instead of matching something else', () => {
  const before = modelOf(LESSON);
  const selector = select(before.text, 'Large steps can overshoot and diverge.');
  const edited = LESSON.replace(' Large steps can overshoot and diverge.', '');
  const after = modelOf(edited);
  assert.equal(Anchor.locate(after.text, selector), null);
});

test('a partly deleted quote still re-anchors when most of it survives', () => {
  const before = modelOf(LESSON);
  const selector = select(before.text, 'a learning rate that is small enough to stay stable');
  const edited = LESSON.replace('small enough to stay stable', 'small enough to stay');
  const after = modelOf(edited);
  const hit = Anchor.locate(after.text, selector);
  assert.equal(hit.method, 'fuzzy');
  assert.match(after.text.slice(hit.start, hit.end), /^a learning rate that is small enough to stay/);
});

test('short quotes never fuzzy match, so a changed short quote is orphaned', () => {
  const before = modelOf(LESSON);
  const selector = select(before.text, 'stable');
  const after = modelOf(LESSON.replace('stay stable', 'stay calm'));
  assert.equal(Anchor.locate(after.text, selector), null);
});

test('duplicate quotes resolve to the right copy by context, then by position', () => {
  const md = [
    '## One', '', 'Always check the shapes before you multiply.', '',
    '## Two', '', 'In the second pass, always check the shapes before you multiply.', '',
    '## Three', '', 'At the end, always check the shapes before you multiply.',
  ].join('\n');
  const before = modelOf(md);
  const selector = select(before.text, 'check the shapes before you multiply', 1);
  const hit = Anchor.locate(before.text, selector);
  assert.equal(hit.method, 'context');
  assert.equal(hit.start, selector.position.start);

  const edited = md.replace('In the second pass, always', 'Next, you should always').replace('multiply.\n\n## Three', 'multiply them.\n\n## Three');
  const after = modelOf(edited);
  const moved = Anchor.locate(after.text, selector);
  assert.equal(moved.method, 'quote');
  const second = after.text.indexOf('check the shapes', after.text.indexOf('Next, you should'));
  assert.equal(moved.start, second);
});

test('whitespace and line wrapping changes are invisible to the anchor', () => {
  const before = modelOf(LESSON);
  const selector = select(before.text, 'direction of steepest increase, so we step');
  const edited = LESSON.replace('The gradient points in the direction of steepest increase, so we step the other way.', 'The gradient points in the direction\nof   steepest increase,\nso we step the other way.');
  const after = modelOf(edited);
  const hit = Anchor.locate(after.text, selector);
  assert.equal(hit.method, 'context');
});

test('markdown emphasis and link changes keep the rendered text anchored', () => {
  const before = modelOf(LESSON);
  const selector = select(before.text, 'The gradient points in the direction of steepest increase');
  const edited = LESSON.replace('The gradient points in the direction of steepest increase', '**The gradient** points in the [direction](https://example.com) of `steepest` increase');
  const after = modelOf(edited);
  const hit = Anchor.locate(after.text, selector);
  assert.equal(hit.method, 'context');
  assert.equal(after.text.slice(hit.start, hit.end), 'The gradient points in the direction of steepest increase');
});

test('code blocks anchor on code text and skip the copy button and language label', () => {
  const model = modelOf(LESSON);
  assert.doesNotMatch(model.text, /Copy def/);
  assert.doesNotMatch(model.text, /python def/);
  const selector = select(model.text, 'return w - lr * grad');
  const edited = LESSON.replace('def step(w, grad, lr):', 'def step(w, grad, lr=0.1):');
  const after = modelOf(edited);
  const hit = Anchor.locate(after.text, selector);
  assert.equal(after.text.slice(hit.start, hit.end), 'return w - lr * grad');
});

test('math is one atomic span whose text is the same before and after KaTeX renders', () => {
  const plain = lessonDom(LESSON);
  const rendered = lessonDom(LESSON);
  for (const math of rendered.findAll(node => (node.getAttribute('class') || '').includes('math-inline'))) {
    const tex = math.textContent;
    math.childNodes = [];
    const katex = new ElementNode('span', { class: 'katex' });
    const mathml = new ElementNode('span', { class: 'katex-mathml' });
    const annotation = new ElementNode('annotation', { encoding: 'application/x-tex' });
    annotation.appendChild(new TextNode(tex));
    mathml.appendChild(annotation);
    const visual = new ElementNode('span', { class: 'katex-html', 'aria-hidden': 'true' });
    visual.appendChild(new TextNode('w \u2190 w \u2212 \u03b7 \u2207 L'));
    katex.appendChild(mathml);
    katex.appendChild(visual);
    math.appendChild(katex);
  }
  const before = Anchor.buildModel(plain);
  const after = Anchor.buildModel(rendered);
  assert.equal(after.text, before.text);
  const selector = select(before.text, 'The update rule is w \\leftarrow w - \\eta \\nabla L for every');
  const hit = Anchor.locate(after.text, selector);
  assert.equal(hit.method, 'context');
  const painted = Anchor.wrap(after, hit.start, hit.end, () => new ElementNode('mark', { class: 'aifs-hl' }));
  assert.equal(painted.atoms.length, 1);
  assert.ok(painted.marks.length >= 2);
  for (const mark of painted.marks) assert.equal(mark.parentNode.getAttribute('class'), null);
  assert.equal(painted.atoms[0].findAll(node => node.tagName === 'MARK').length, 0);
});

test('long quotes re-anchor through head and tail matches after an inner edit', () => {
  const md = '## Loop\n\nIntro sentence before the loop.\n\nEach training step reads a batch of examples from the loader, computes the loss for that batch, takes the gradient of the loss with respect to every parameter, and moves each parameter a small amount against its gradient. Repeat this until the validation loss stops falling for several epochs in a row, then keep the best checkpoint.\n\nClosing sentence after the loop.';
  const before = modelOf(md);
  const start = before.text.indexOf('Each training');
  const end = before.text.indexOf('best checkpoint.') + 'best checkpoint.'.length;
  assert.ok(end - start > 256);
  const selector = Anchor.describe(before.text, start, end);
  const edited = md.replace('computes the loss for that batch', 'computes the cross-entropy loss for that batch');
  const after = modelOf(edited);
  const hit = Anchor.locate(after.text, selector);
  assert.equal(hit.method, 'fuzzy');
  assert.equal(after.text.slice(hit.start, hit.end), after.text.slice(after.text.indexOf('Each training'), after.text.indexOf('best checkpoint.') + 16));

  const rewritten = md.replace(/reads a batch[\s\S]*?validation loss/, 'is replaced by a closed-form solve because the problem is convex, so no loop over data or optimiser state is needed, and the validation loss');
  assert.equal(Anchor.locate(modelOf(rewritten).text, selector), null);
});

test('a quote that only resembles unrelated text stays orphaned', () => {
  const before = modelOf(LESSON);
  const selector = select(before.text, 'Training moves the parameters so that the loss gets smaller');
  const unrelated = modelOf('## Other\n\nA tokenizer splits raw text into pieces that a model can index.');
  assert.equal(Anchor.locate(unrelated.text, selector), null);
});

test('skipped regions add no text and never join words across blocks', () => {
  const dom = lessonDom('## Build It\n\nFirst paragraph ends here.\n\nSecond paragraph starts here.');
  const heading = dom.findAll(node => node.tagName === 'H2')[0];
  const guide = new ElementNode('p', { class: 'lesson-section-guide' });
  guide.appendChild(new TextNode('Type this code in your own file.'));
  dom.insertBefore(guide, heading.parentNode === dom ? dom.childNodes[dom.childNodes.indexOf(heading) + 1] : null);
  const model = Anchor.buildModel(dom);
  assert.doesNotMatch(model.text, /Type this code/);
  assert.match(model.text, /ends here\. Second paragraph/);
});

test('sections report the nearest preceding heading id and title', () => {
  const model = modelOf(LESSON);
  const at = model.text.indexOf('one parameter');
  const section = Anchor.sectionAt(model, at);
  assert.equal(section.id, 'build-it');
  assert.equal(section.title, 'Build It');
  assert.equal(Anchor.sectionById(model, 'summary').title, 'Summary');
  assert.equal(Anchor.sectionById(model, 'missing'), null);
});

test('wrapping marks text across inline and block elements and unwrapping restores the DOM', () => {
  const dom = lessonDom('## A\n\nOne **two three** four.\n\nFive six seven.');
  const original = dom.textContent;
  let model = Anchor.buildModel(dom);
  const start = model.text.indexOf('three');
  const end = model.text.indexOf('six') + 3;
  const painted = Anchor.wrap(model, start, end, () => new ElementNode('mark', { class: 'aifs-hl' }));
  assert.equal(painted.marks.map(mark => mark.textContent).join('|'), 'three| four.|Five six');
  assert.equal(dom.textContent, original);
  model = Anchor.buildModel(dom);
  assert.equal(model.text.slice(start, end), 'three four. Five six');
  for (const mark of painted.marks) Anchor.unwrap(mark);
  assert.equal(dom.textContent, original);
  assert.equal(dom.findAll(node => node.tagName === 'MARK').length, 0);
  const paragraphs = dom.findAll(node => node.tagName === 'P');
  assert.ok(paragraphs.every(p => p.childNodes.every((child, i, all) => !(child.nodeType === 3 && all[i + 1] && all[i + 1].nodeType === 3))));
});


test('a short quote with hundreds of copies keeps its own place', () => {
  const md = '## Cats\n\n' + Array.from({ length: 700 }, (_, i) => `the cat number ${i} sat.`).join(' ');
  const model = modelOf(md);
  const at = model.text.indexOf('number 650 sat') - 4;
  const selector = Anchor.describe(model.text, at, at + 3);
  assert.equal(selector.quote.exact, 'cat');
  const hit = Anchor.locate(model.text, selector);
  assert.equal(hit.method, 'context');
  assert.equal(hit.start, at);
});

test('a deleted medium quote does not jump to a similar phrase far away', () => {
  const filler = Array.from({ length: 80 }, (_, i) => `Filler sentence ${i} keeps the two passages apart.`).join(' ');
  const md = `## A\n\nWe minimise the loss function here with care.\n\n${filler}\n\n## B\n\nLater we revisit the loss function in detail.`;
  const before = modelOf(md);
  const selector = select(before.text, 'the loss function here');
  const after = modelOf(md.replace(' the loss function here', ''));
  assert.equal(Anchor.locate(after.text, selector), null);
});

test('overlapping highlights wrap from the end with one model and nest cleanly', () => {
  const dom = lessonDom('## A\n\nalpha beta gamma delta epsilon zeta.');
  const original = dom.textContent;
  let model = Anchor.buildModel(dom);
  const text = model.text;
  const ranges = [
    [text.indexOf('gamma'), text.indexOf('zeta') + 4],
    [text.indexOf('beta'), text.indexOf('delta') + 5],
  ];
  let wrappedFrom = Infinity;
  const all = [];
  for (const [start, end] of ranges) {
    if (end > wrappedFrom) model = Anchor.buildModel(dom);
    wrappedFrom = Math.min(wrappedFrom, start);
    all.push(Anchor.wrap(model, start, end, () => new ElementNode('mark', { class: 'aifs-hl' })).marks.map(m => m.textContent).join(''));
  }
  assert.deepEqual(all, ['gamma delta epsilon zeta', 'beta gamma delta']);
  assert.equal(dom.textContent, original);
});

function el(tag, attrs = {}, children = []) {
  const node = new ElementNode(tag, attrs);
  for (const child of children) node.appendChild(typeof child === 'string' ? new TextNode(child) : child);
  return node;
}

function articleOf(...children) {
  return el('article', { class: 'lesson-article' }, children);
}

const markOf = () => new ElementNode('mark', { class: 'aifs-hl' });

test('quiz questions and option text are highlightable, controls and status text are not', () => {
  const quiz = el('div', { class: 'quiz-section', id: 'quiz-pre' }, [
    el('div', { class: 'quiz-title' }, ['Pre-lesson check']),
    el('div', { class: 'quiz-reset-status', role: 'status', 'aria-live': 'polite' }, ['Answers cleared']),
    el('div', { class: 'quiz-question-text' }, ['1. What does the derivative tell you?']),
    el('div', { class: 'quiz-options', role: 'group' }, [
      el('button', { class: 'quiz-option', type: 'button' }, [el('span', { class: 'quiz-marker', 'aria-hidden': 'true' }, ['A']), el('span', { class: 'quiz-option-text' }, ['The slope of the tangent line'])]),
    ]),
    el('button', { class: 'quiz-reset', type: 'button' }, ['Reset answers']),
  ]);
  const dom = articleOf(el('p', {}, ['Intro text.']), quiz);
  const model = Anchor.buildModel(dom);
  assert.match(model.text, /What does the derivative tell you\? The slope of the tangent line/);
  assert.doesNotMatch(model.text, /Answers cleared|Reset answers|\bA The slope/);
  const start = model.text.indexOf('slope of the tangent');
  const painted = Anchor.wrap(model, start, start + 'slope of the tangent'.length, markOf);
  assert.equal(painted.marks.length, 1);
  assert.equal(painted.marks[0].parentNode.getAttribute('class'), 'quiz-option-text');
});

test('the action panel keeps its stable copy and drops the changing run command and status', () => {
  const panel = el('aside', { class: 'lesson-action-panel' }, [
    el('h2', { class: 'lesson-action-title', id: 'lessonActionTitle' }, ['Act on this lesson']),
    el('div', { class: 'lesson-action-status', role: 'status' }, ['0 of 5 checkpoints']),
    el('button', { class: 'lesson-action-step', type: 'button' }, [el('span', { class: 'lesson-action-step-title' }, ['Read']), el('span', { class: 'lesson-action-step-copy' }, ['Understand the claim and constraints.'])]),
    el('div', { class: 'lesson-action-run' }, [el('code', {}, ['Checking for a standalone runnable file'])]),
    el('div', { class: 'lesson-action-tags' }, [el('span', {}, ['Local progress'])]),
  ]);
  const model = Anchor.buildModel(articleOf(panel));
  assert.match(model.text, /Act on this lesson Read Understand the claim and constraints\./);
  assert.doesNotMatch(model.text, /checkpoints|Checking for|Local progress/);
});

test('mermaid diagrams are a unit and their HTML labels are text, while SVG text and the source are skipped', () => {
  const svg = el('svg', {}, [
    el('g', {}, [el('foreignObject', {}, [el('div', {}, [el('span', { class: 'nodeLabel' }, [el('p', {}, ['Tokenizer'])])])])]),
    el('g', {}, [el('foreignObject', {}, [el('div', {}, [el('span', { class: 'nodeLabel' }, [el('p', {}, ['Embedding table'])])])])]),
    el('text', {}, ['axis label']),
  ]);
  const container = el('div', { class: 'mermaid-container' }, [
    el('div', { class: 'mermaid-block' }, [
      el('div', { class: 'mermaid-toolbar' }, [el('button', { class: 'mermaid-btn' }, ['Expand'])]),
      el('pre', { class: 'mermaid mermaid-source' }, ['graph LR; A[Tokenizer] --> B[Embedding table]']),
      el('div', { class: 'mermaid-render' }, [svg]),
    ]),
  ]);
  const model = Anchor.buildModel(articleOf(el('p', {}, ['Before.']), container, el('p', {}, ['After.'])));
  assert.match(model.text, /Before\. \[diagram [a-z0-9]+\] Tokenizer Embedding table After\./);
  assert.doesNotMatch(model.text, /axis label|graph LR|Expand/);
  const unit = model.segments.find(segment => segment.unit);
  assert.equal(unit.node, container);
  const start = model.text.indexOf('Embedding');
  const painted = Anchor.wrap(model, start, start + 'Embedding'.length, markOf);
  assert.equal(painted.marks[0].parentNode.tagName, 'P');
  const whole = Anchor.wrap(Anchor.buildModel(articleOf(container)), 0, 20, markOf);
  assert.deepEqual(whole.atoms, [container]);
});

test('interactive lesson figures are one unit with a highlightable caption, and their live readouts are ignored', () => {
  const figure = el('div', { class: 'lesson-figure', 'data-figure': 'lr-sweep' }, [
    el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, ['Learning rate sweep'])]),
      el('div', { class: 'lf-body' }, [el('div', { class: 'lf-meta' }, ['lr too large: each step overshoots'])]),
      el('div', { class: 'lf-cap' }, ['Drag the slider to change the learning rate.']),
    ]),
  ]);
  const model = Anchor.buildModel(articleOf(figure));
  assert.equal(model.text, '[figure lr-sweep] Learning rate sweep Drag the slider to change the learning rate.');
  figure.childNodes[0].childNodes[1].childNodes[0].childNodes[0].nodeValue = 'balanced';
  assert.equal(Anchor.buildModel(articleOf(figure)).text, model.text);
});

test('manual pages: sections come from section ids, figures are units, captions, listings and takeaways are text', () => {
  const html = '<section class="m-section" id="s-2-1"><header class="m-section-head"><div class="m-section-num">2.1</div><h1 class="m-section-title">Reading a sequence</h1></header>'
    + '<p>A request opens a task.</p>'
    + '<figure class="m-fig" id="fig-reading-a-sequence"><div class="m-fig-box"><div class="m-fig-head"><span class="m-fig-num">Fig 2</span><span class="m-fig-title">The task loop</span></div><div class="m-fig-art"><svg><text>client</text></svg></div></div><figcaption class="m-fig-cap">Each message moves the task forward.</figcaption></figure>'
    + '<figure class="m-listing"><div class="m-listing-head"><span class="m-listing-title">Send</span></div><pre><code>curl -X POST /tasks</code></pre><figcaption class="m-listing-note">The server answers with a task id.</figcaption></figure>'
    + '<aside class="m-takeaways"><div class="m-box-label">Takeaways</div><ul><li>Tasks have states.</li><li>Messages carry parts.</li></ul></aside>'
    + '<div class="m-dither" aria-hidden="true"><span class="m-dither-label">Part 2</span></div></section>';
  const dom = parseHtml(html);
  const model = Anchor.buildModel(dom);
  assert.match(model.text, /Fig 2 The task loop \[figure fig-reading-a-sequence\] Each message moves the task forward\./);
  assert.match(model.text, /curl -X POST \/tasks The server answers with a task id\./);
  assert.match(model.text, /Tasks have states\. Messages carry parts\./);
  assert.doesNotMatch(model.text, /client|Part 2/);
  assert.equal(model.sections[0].id, 's-2-1');
  assert.equal(model.sections[0].title, 'Reading a sequence');
  const at = model.text.indexOf('Messages carry');
  assert.equal(Anchor.sectionAt(model, at).id, 's-2-1');
});

test('emoji and other surrogate pairs are never split by the quote or its context', () => {
  const text = 'a'.repeat(31) + '\ud83d\ude80 launch the \ud83e\udde0 model now' + '\ud83d\udd25'.repeat(20);
  const start = text.indexOf('launch') - 1;
  const described = Anchor.describe(text, start, text.indexOf('model'));
  for (const value of [described.quote.exact, described.quote.prefix, described.quote.suffix]) {
    assert.doesNotThrow(() => encodeURIComponent(value));
  }
  const inside = Anchor.describe(text, text.indexOf('\ud83e') + 1, text.indexOf(' now'));
  assert.ok(inside.quote.exact.startsWith('\ud83e\udde0'));
  const hit = Anchor.locate(text, described);
  assert.equal(hit.method, 'context');
});

test('zero-width characters, soft hyphens and no-break spaces do not change the anchor', () => {
  const before = Anchor.buildModel(articleOf(el('p', {}, ['The opti\u00admizer takes a\u00a0step\u200b toward lower loss.'])));
  const after = Anchor.buildModel(articleOf(el('p', {}, ['The optimizer takes a step toward lower loss.'])));
  assert.equal(before.text, after.text);
  const selector = select(before.text, 'optimizer takes a step');
  assert.equal(Anchor.locate(after.text, selector).method, 'context');
  const painted = Anchor.wrap(before, before.text.indexOf('optimizer'), before.text.indexOf(' toward'), markOf);
  assert.equal(painted.marks[0].textContent, 'opti\u00admizer takes a\u00a0step');
});

test('Chinese (zh-TW) text re-anchors exactly and by fuzzy match after a one-character edit', () => {
  const md = '## \u68af\u5ea6\n\n\u6a21\u578b\u6709\u8a31\u591a\u53c3\u6578\u3002\u8a13\u7df4\u6703\u79fb\u52d5\u9019\u4e9b\u53c3\u6578\uff0c\u8b93\u640d\u5931\u5728\u6bcf\u4e00\u6b65\u8b8a\u5c0f\u3002\u68af\u5ea6\u6307\u5411\u589e\u52a0\u6700\u5feb\u7684\u65b9\u5411\u3002';
  const before = modelOf(md);
  const selector = select(before.text, '\u8a13\u7df4\u6703\u79fb\u52d5\u9019\u4e9b\u53c3\u6578\uff0c\u8b93\u640d\u5931\u5728\u6bcf\u4e00\u6b65\u8b8a\u5c0f');
  assert.equal(Anchor.locate(before.text, selector).method, 'context');
  const after = modelOf(md.replace('\u8b93\u640d\u5931', '\u8b93\u6574\u9ad4\u640d\u5931'));
  const hit = Anchor.locate(after.text, selector);
  assert.equal(hit.method, 'fuzzy');
  assert.ok(Anchor.tokenOverlap('\u8a13\u7df4\u53c3\u6578', '\u53c3\u6578\u8a13\u7df4') === 1);
  assert.match(after.text.slice(hit.start, hit.end), /^\u8a13\u7df4.*\u8b8a\u5c0f$/);
});

test('right-to-left Arabic text anchors by context and by fuzzy match', () => {
  const md = '## \u0627\u0644\u062a\u062f\u0631\u062c\n\n\u064a\u062d\u062a\u0648\u064a \u0627\u0644\u0646\u0645\u0648\u0630\u062c \u0639\u0644\u0649 \u0645\u0639\u0627\u0645\u0644\u0627\u062a \u0643\u062b\u064a\u0631\u0629 \u0648\u0627\u0644\u062a\u062f\u0631\u064a\u0628 \u064a\u063a\u064a\u0631\u0647\u0627 \u0641\u064a \u0643\u0644 \u062e\u0637\u0648\u0629.';
  const before = modelOf(md);
  const selector = select(before.text, '\u0627\u0644\u0646\u0645\u0648\u0630\u062c \u0639\u0644\u0649 \u0645\u0639\u0627\u0645\u0644\u0627\u062a \u0643\u062b\u064a\u0631\u0629');
  assert.equal(Anchor.locate(before.text, selector).method, 'context');
  const after = modelOf(md.replace('\u0643\u062b\u064a\u0631\u0629', '\u0643\u062b\u064a\u0631\u0629 \u062c\u062f\u0627'));
  assert.ok(Anchor.locate(after.text, selector));
});

test('short quotes anchor by quote, context and position, and fail cleanly when all three move', () => {
  const md = '## A\n\n' + Array.from({ length: 60 }, (_, i) => `Line ${i} mentions the loss once.`).join(' ');
  const before = modelOf(md);
  const at = before.text.indexOf('Line 30 mentions the loss') + 'Line 30 mentions the '.length;
  const selector = Anchor.describe(before.text, at, at + 4);
  assert.equal(selector.quote.exact, 'loss');
  const shifted = modelOf(md.replace('Line 30 mentions the loss once.', 'Line 30 talks about the loss once.'));
  const near = Anchor.locate(shifted.text, selector);
  assert.ok(near);
  assert.ok(Math.abs(near.start - selector.position.start) < 40);
  const lonely = modelOf('## A\n\n' + 'Intro words without the term. '.repeat(40) + 'At the very end the loss appears.');
  const far = { quote: { exact: 'loss', prefix: 'zzzz unrelated words ', suffix: ' qqqq other' }, position: { start: 10, end: 14, length: lonely.text.length } };
  assert.equal(Anchor.locate(lonely.text, far), null);
});

test('a rewritten paragraph only re-anchors with context agreement or inside its section, and reports confidence', () => {
  const md = '## One\n\nThe optimizer updates every weight with the gradient and the learning rate.\n\n## Two\n\n' + 'Filler words keep the sections apart. '.repeat(30) + '\n\nA different text: the optimizer updates every weight using momentum and the learning rate.';
  const before = modelOf(md);
  const selector = select(before.text, 'The optimizer updates every weight with the gradient and the learning rate.');
  const section = Anchor.sectionById(before, 'one');
  assert.equal(Anchor.locate(before.text, selector, { regions: [section] }).confidence, 1);
  const removed = modelOf(md.replace('The optimizer updates every weight with the gradient and the learning rate.', 'Weights move.'));
  assert.equal(Anchor.locate(removed.text, selector, { regions: [Anchor.sectionById(removed, 'one')] }), null);
  const edited = modelOf(md.replace('with the gradient and', 'with its gradient and'));
  const hit = Anchor.locate(edited.text, selector, { regions: [Anchor.sectionById(edited, 'one')] });
  assert.equal(hit.method, 'fuzzy');
  assert.ok(hit.inSection);
  assert.ok(hit.confidence > 0.8 && hit.confidence < 1, String(hit.confidence));
});

test('another language version gets a best-effort place by section id or section index', () => {
  const en = modelOf('## Build It\n\nFirst sentence here. The key step is to subtract the gradient. Last sentence here.');
  const start = en.text.indexOf('The key step');
  const end = en.text.indexOf('gradient.') + 9;
  const info = Anchor.describeSection(en, start, end);
  const item = { section: info.section, sectionIndex: info.sectionIndex, sectionOffset: info.sectionOffset, sectionSpan: info.sectionSpan };
  const fr = modelOf('## Build It\n\nPremi\u00e8re phrase ici. L\u2019\u00e9tape cl\u00e9 consiste \u00e0 soustraire le gradient. Derni\u00e8re phrase ici.');
  const byId = Anchor.approximate(fr, item);
  assert.equal(byId.method, 'approx');
  assert.ok(byId.start > fr.sections[0].start && byId.end <= fr.text.length);
  const zh = Anchor.buildModel(articleOf(el('h2', { id: 'section-1' }, ['\u5be6\u4f5c']), el('p', {}, ['\u7b2c\u4e00\u53e5\u3002\u95dc\u9375\u6b65\u9a5f\u662f\u6e1b\u53bb\u68af\u5ea6\u3002\u6700\u5f8c\u4e00\u53e5\u3002'])));
  const byIndex = Anchor.approximate(zh, item);
  assert.ok(byIndex && byIndex.end > byIndex.start);
  assert.equal(Anchor.approximate(zh, { section: 'nope', sectionIndex: 9, sectionOffset: 0.5, sectionSpan: 0.1 }), null);
});

test('a very long selection (15,000 characters) anchors exactly and survives an inner edit', () => {
  const paragraph = Array.from({ length: 300 }, (_, i) => `Sentence ${i} explains step ${i} of training.`).join(' ');
  const md = '## Long\n\n' + paragraph;
  const before = modelOf(md);
  const start = before.text.indexOf('Sentence 0');
  const selector = Anchor.describe(before.text, start, before.text.length);
  assert.ok(selector.quote.exact.length > 12000);
  assert.equal(Anchor.locate(before.text, selector).method, 'context');
  const after = modelOf(md.replace('Sentence 150 explains', 'Sentence 150 clearly explains'));
  assert.equal(Anchor.locate(after.text, selector).method, 'fuzzy');
});

test('selections across list items, table cells, a heading and code into text wrap only phrasing text', () => {
  const md = '## Steps\n\n- first item\n- second item\n\n| a | b |\n|---|---|\n| cell one | cell two |\n\n### Code\n\n```python\nx = 1\n```\n\nAfter the code.';
  const dom = lessonDom(md);
  const original = dom.textContent;
  const model = Anchor.buildModel(dom);
  const painted = Anchor.wrap(model, model.text.indexOf('second'), model.text.indexOf('After the') + 9, markOf);
  const parents = painted.marks.map(mark => mark.parentNode.tagName);
  for (const tag of parents) assert.ok(!/^(UL|OL|TABLE|TBODY|THEAD|TR)$/.test(tag), tag);
  assert.ok(parents.includes('LI') && parents.includes('TD') && parents.includes('H3') && parents.includes('CODE') && parents.includes('P'), parents.join(','));
  assert.equal(dom.textContent, original);
  for (const mark of painted.marks) Anchor.unwrap(mark);
  assert.equal(dom.textContent, original);
});

test('a highlight inside a link keeps the link element and its href', () => {
  const dom = lessonDom('See [the chain rule](https://example.com/chain) for details.');
  const model = Anchor.buildModel(dom);
  const painted = Anchor.wrap(model, model.text.indexOf('chain'), model.text.indexOf('rule') + 4, markOf);
  const link = dom.findAll(node => node.tagName === 'A')[0];
  assert.equal(painted.marks[0].parentNode, link);
  assert.equal(link.getAttribute('href'), 'https://example.com/chain');
});

test('two highlights on the same range and nested ranges layer as separate marks', () => {
  const dom = lessonDom('alpha beta gamma delta.');
  let model = Anchor.buildModel(dom);
  const start = model.text.indexOf('beta');
  const end = model.text.indexOf('gamma') + 5;
  const outer = Anchor.wrap(model, start, end, () => new ElementNode('mark', { class: 'aifs-hl', 'data-hl-id': 'one' }));
  model = Anchor.buildModel(dom);
  const inner = Anchor.wrap(model, start, end, () => new ElementNode('mark', { class: 'aifs-hl', 'data-hl-id': 'two' }));
  assert.equal(outer.marks.length, 1);
  assert.equal(inner.marks.length, 1);
  assert.equal(inner.marks[0].parentNode, outer.marks[0]);
  assert.equal(dom.textContent, 'alpha beta gamma delta.');
});

test('decorative and live regions are skipped', () => {
  const model = Anchor.buildModel(articleOf(el('p', {}, ['Visible text.']), el('span', { 'aria-hidden': 'true' }, ['decoration']), el('div', { 'aria-live': 'polite' }, ['Saved!'])));
  assert.equal(model.text, 'Visible text.');
});

test('locating 500 highlights on the longest lesson stays fast', () => {
  const longest = fs.readdirSync(path.join(__dirname, '..', 'phases')).flatMap(phase => {
    const dir = path.join(__dirname, '..', 'phases', phase);
    if (!fs.statSync(dir).isDirectory()) return [];
    return fs.readdirSync(dir).map(lesson => path.join(dir, lesson, 'docs', 'en.md')).filter(file => fs.existsSync(file));
  }).sort((a, b) => fs.statSync(b).size - fs.statSync(a).size)[0];
  const model = modelOf(fs.readFileSync(longest, 'utf8'));
  const selectors = [];
  for (let i = 0; i < 500; i++) {
    const start = Math.floor((model.text.length - 80) * i / 500);
    selectors.push(Anchor.describe(model.text, start, start + 40));
  }
  const began = process.hrtime.bigint();
  let found = 0;
  for (const selector of selectors) if (Anchor.locate(model.text, selector)) found++;
  const ms = Number(process.hrtime.bigint() - began) / 1e6;
  assert.equal(found, 500);
  assert.ok(ms < 2000, `${ms} ms`);
  console.log(`# locate 500 highlights on ${path.basename(path.dirname(path.dirname(longest)))} (${model.text.length} chars): ${ms.toFixed(1)} ms`);
});

test('the lesson page loads the highlight scripts and mounts after the table of contents', () => {
  const html = fs.readFileSync(path.join(__dirname, 'lesson.html'), 'utf8');
  const order = ['progress.js', 'highlights-anchor.js', 'highlights-store.js', 'highlights.js'].map(name => html.indexOf(`<script src="${name}?v=`));
  assert.ok(order.every(at => at > 0));
  assert.deepEqual([...order].sort((a, b) => a - b), order);
  assert.match(html, /<link rel="stylesheet" href="highlights\.css\?v=/);
  const render = html.slice(html.indexOf('function renderLesson('), html.indexOf('function currentFocusedPathEntry()'));
  assert.ok(render.indexOf('buildTOC();') < render.indexOf('AIFSHighlights.mount('));
  assert.ok(render.indexOf('AIFSHighlights.mount(') < render.indexOf('restoreHeadingHash();'));
  const dispose = html.slice(html.indexOf('function disposeRenderedLesson(root)'), html.indexOf('function restoreHeadingHash()'));
  assert.match(dispose, /AIFSHighlights\.unmount\(\)/);
});

test('the highlight scripts stay dependency free and comment free', () => {
  for (const name of ['highlights-anchor.js', 'highlights-store.js', 'highlights.js']) {
    const source = fs.readFileSync(path.join(__dirname, name), 'utf8');
    assert.doesNotMatch(source, /\brequire\(|^\s*import\s/m, name);
    assert.doesNotMatch(source, /^\s*\/\/|\/\*/m, name);
  }
});

test('ambiguous exact matches are flagged, and exact-only or no-whole-text searches skip fuzzy work', () => {
  const md = '## A\n\nWe compute the gradient here. Filler text that changes. We compute the gradient here.';
  const before = modelOf(md);
  const selector = select(before.text, 'compute the gradient', 0);
  const edited = modelOf(md.replace('We compute the gradient here. Filler', 'Then we compute the gradient again. Filler'));
  const hit = Anchor.locate(edited.text, { quote: { exact: 'compute the gradient', prefix: 'zz ', suffix: ' qq' }, position: selector.position });
  assert.equal(hit.method, 'quote');
  assert.equal(hit.ambiguous, true);
  const longQuote = 'The optimizer updates every weight with the gradient and the learning rate value.';
  const far = modelOf('## A\n\n' + 'Filler words. '.repeat(400) + longQuote.replace('every', 'each'));
  const selector2 = { quote: { exact: longQuote, prefix: 'Filler words. ', suffix: '' }, position: { start: 0, end: longQuote.length, length: far.text.length } };
  assert.ok(Anchor.locate(far.text, selector2));
  assert.equal(Anchor.locate(far.text, selector2, { wholeText: false }), null);
  assert.equal(Anchor.locate(far.text, selector2, { exactOnly: true }), null);
});

const vm = require('node:vm');
const StoreModule = require('./highlights-store');

const UI_PATH = 'phases/01-math-foundations/04-gradient-descent';
const STORE_KEY = 'aifs:highlights:v2';

function parseCompound(text) {
  const parts = { tag: '', classes: [], attrs: [], nots: [] };
  const pattern = /^([a-zA-Z]+)|\.([\w-]+)|\[([\w-]+)(?:="([^"]*)")?\]|:not\(([^)]*)\)/g;
  let match;
  while ((match = pattern.exec(text))) {
    if (match[1]) parts.tag = match[1].toUpperCase();
    else if (match[2]) parts.classes.push(match[2]);
    else if (match[3]) parts.attrs.push([match[3], match[4]]);
    else if (match[5]) parts.nots.push(parseCompound(match[5]));
  }
  return parts;
}

function matchCompound(node, parts) {
  if (!node || node.nodeType !== 1) return false;
  if (parts.tag && node.tagName !== parts.tag) return false;
  const classes = node.className.split(/\s+/);
  if (!parts.classes.every(name => classes.includes(name))) return false;
  for (const [name, value] of parts.attrs) {
    const actual = node.getAttribute(name);
    if (actual === null || (value !== undefined && actual !== value)) return false;
  }
  return !parts.nots.some(inner => matchCompound(node, inner));
}

function matchSelector(node, selector) {
  return selector.split(',').some(single => {
    const chain = single.trim().split(/\s+/).filter(token => token !== '>').map(parseCompound);
    if (!matchCompound(node, chain[chain.length - 1])) return false;
    let at = node.parentNode;
    for (let i = chain.length - 2; i >= 0; i--) {
      while (at && !matchCompound(at, chain[i])) at = at.parentNode;
      if (!at) return false;
      at = at.parentNode;
    }
    return true;
  });
}

class UiText {
  constructor(value) { this.nodeType = 3; this.nodeValue = String(value); this.parentNode = null; }
  get textContent() { return this.nodeValue; }
}

class UiElement {
  constructor(doc, tag) {
    this.ownerDocument = doc;
    this.nodeType = 1;
    this.tagName = tag.toUpperCase();
    this.childNodes = [];
    this.parentNode = null;
    this.attributes = {};
    this.listeners = {};
    this.className = '';
    this.hidden = false;
    this.disabled = false;
    this.readOnly = false;
    this.value = '';
    this.title = '';
    this.style = {};
    this.offsetWidth = 100;
    this.offsetHeight = 20;
    const self = this;
    this.classList = {
      add: (...names) => names.forEach(name => { if (!self.classList.contains(name)) self.className = (self.className + ' ' + name).trim(); }),
      remove: (...names) => { self.className = self.className.split(/\s+/).filter(name => name && !names.includes(name)).join(' '); },
      contains: name => self.className.split(/\s+/).includes(name),
    };
  }
  get id() { return this.attributes.id || ''; }
  set id(value) { this.attributes.id = String(value); }
  getAttribute(name) {
    if (name === 'class') return this.className || null;
    if (name === 'hidden') return this.hidden ? '' : null;
    if (name === 'disabled') return this.disabled ? '' : null;
    return Object.prototype.hasOwnProperty.call(this.attributes, name) ? this.attributes[name] : null;
  }
  setAttribute(name, value) {
    if (name === 'class') this.className = String(value);
    else this.attributes[name] = String(value);
  }
  hasAttribute(name) { return this.getAttribute(name) !== null; }
  removeAttribute(name) { delete this.attributes[name]; }
  get textContent() { return this.childNodes.map(child => child.textContent).join(''); }
  set textContent(value) {
    this.childNodes.forEach(child => { child.parentNode = null; });
    this.childNodes = [];
    if (value !== '' && value !== null && value !== undefined) this.appendChild(new UiText(value));
  }
  appendChild(child) {
    if (child.parentNode) child.parentNode.removeChild(child);
    this.childNodes.push(child);
    child.parentNode = this;
    return child;
  }
  removeChild(child) {
    this.childNodes.splice(this.childNodes.indexOf(child), 1);
    child.parentNode = null;
    return child;
  }
  remove() { if (this.parentNode) this.parentNode.removeChild(this); }
  contains(node) {
    for (let at = node; at; at = at.parentNode) if (at === this) return true;
    return false;
  }
  get isConnected() { return this.ownerDocument.documentElement.contains(this); }
  addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); }
  descendants(out = []) {
    for (const child of this.childNodes) {
      if (child.nodeType !== 1) continue;
      out.push(child);
      child.descendants(out);
    }
    return out;
  }
  querySelectorAll(selector) { return this.descendants().filter(node => matchSelector(node, selector)); }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  matches(selector) { return matchSelector(this, selector); }
  closest(selector) {
    for (let at = this; at && at.nodeType === 1; at = at.parentNode) if (matchSelector(at, selector)) return at;
    return null;
  }
  focus() { this.ownerDocument.activeElement = this; }
  getBoundingClientRect() { return { top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0 }; }
  click() {
    const event = { type: 'click', target: this, detail: 1, preventDefault() {}, stopPropagation() {} };
    for (let at = this; at; at = at.parentNode) (at.listeners.click || []).forEach(fn => fn.call(at, event));
    (this.ownerDocument.listeners.click || []).forEach(fn => fn(event));
  }
}

class UiDocument {
  constructor() {
    this.listeners = {};
    this.readyState = 'complete';
    this.documentElement = new UiElement(this, 'html');
    this.body = this.documentElement.appendChild(new UiElement(this, 'body'));
    this.activeElement = this.body;
  }
  createElement(tag) { return new UiElement(this, tag); }
  createRange() { return {}; }
  addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); }
  querySelector(selector) { return this.documentElement.querySelector(selector); }
  querySelectorAll(selector) { return this.documentElement.querySelectorAll(selector); }
  getElementById(id) { return this.documentElement.descendants().find(node => node.id === id) || null; }
}

const anchorStub = {
  buildModel: () => ({ text: '', segments: [], sections: [] }),
  locate: () => null,
  sectionById: () => null,
  approximate: () => null,
  wrap: () => ({ marks: [], atoms: [] }),
  unwrap() {},
};

function uiStorage() {
  const data = new Map();
  return { data, getItem: key => (data.has(key) ? data.get(key) : null), setItem: (key, value) => { data.set(key, String(value)); }, removeItem: key => { data.delete(key); } };
}

function uiPage({ hash = '', readyState = 'complete' } = {}) {
  const storage = uiStorage();
  const storeListeners = [];
  const store = StoreModule.create({ localStorage: storage, addEventListener: (name, fn) => { if (name === 'storage') storeListeners.push(fn); } });
  const doc = new UiDocument();
  doc.readyState = readyState;
  const listeners = {};
  const win = {
    document: doc,
    console,
    navigator: {},
    AIFSHighlightAnchor: anchorStub,
    AIFSHighlightStore: store,
    innerWidth: 1280,
    pageXOffset: 0,
    pageYOffset: 0,
    location: { hash, pathname: '/lesson.html', search: '', origin: 'https://example.test' },
    history: { replaceState() {} },
    getSelection: () => ({ isCollapsed: true, rangeCount: 0, removeAllRanges() {} }),
    matchMedia: () => ({ matches: false }),
    setTimeout: () => 0,
    clearTimeout() {},
    addEventListener: (name, fn) => { (listeners[name] = listeners[name] || []).push(fn); },
  };
  win.window = win;
  vm.createContext(win);
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'highlights.js'), 'utf8'), win);
  const article = doc.body.appendChild(doc.createElement('article'));
  const otherTab = () => StoreModule.create({ localStorage: storage, addEventListener() {} });
  const page = {
    win, doc, store, storage, article, listeners, otherTab,
    mount: () => win.AIFSHighlights.mount(article, { path: UI_PATH, lang: 'en', title: 'GD' }),
    fire: name => (listeners[name] || []).forEach(fn => fn({ type: name })),
    syncFromOtherTab: () => storeListeners.forEach(fn => fn({ key: STORE_KEY })),
    find: selector => doc.querySelector(selector),
    openPanel: () => doc.querySelector('.aifs-hl-launch').click(),
    rowButton: (id, action) => doc.querySelector(`.aifs-hl-item[data-hl-id="${id}"] button[data-action="${action}"]`),
    note: () => doc.getElementById('aifsHlNote'),
    editor: () => doc.querySelector('.aifs-hl-editor'),
  };
  return page;
}

function uiItem(exact, note = '') {
  return { lang: 'en', color: 'yellow', note, quote: { exact, prefix: '', suffix: '' }, position: { start: exact.length, end: exact.length * 2, length: 100 } };
}

test('opening the editor on another highlight saves the note typed for the first one', () => {
  const page = uiPage();
  const a = page.store.add(UI_PATH, uiItem('first passage', 'old a'));
  const b = page.store.add(UI_PATH, uiItem('second passage', 'note b'));
  page.mount();
  page.openPanel();
  page.rowButton(a.id, 'edit').click();
  assert.equal(page.note().value, 'old a');
  page.note().value = 'typed for a';
  page.rowButton(b.id, 'edit').click();
  assert.equal(page.store.items(UI_PATH).find(item => item.id === a.id).note, 'typed for a');
  assert.equal(page.note().value, 'note b');
  assert.equal(page.editor().hidden, false);
});

test('a note that cannot be saved keeps its editor open with the typed text and says why', () => {
  const page = uiPage();
  const a = page.store.add(UI_PATH, uiItem('first passage', 'old a'));
  const b = page.store.add(UI_PATH, uiItem('second passage', 'note b'));
  page.mount();
  page.openPanel();
  page.rowButton(a.id, 'edit').click();
  page.note().value = 'typed for a';
  const realUpdate = page.store.update;
  page.store.update = () => null;
  page.rowButton(b.id, 'edit').click();
  assert.equal(page.note().value, 'typed for a');
  assert.equal(page.editor().hidden, false);
  assert.match(page.find('.aifs-hl-editor-status').textContent, /could not be saved/);
  page.store.update = realUpdate;
  page.rowButton(b.id, 'edit').click();
  assert.equal(page.store.items(UI_PATH).find(item => item.id === a.id).note, 'typed for a');
  assert.equal(page.note().value, 'note b');
});

test('a note kept only in memory after a quota failure moves on and says the tab must stay open', () => {
  const page = uiPage();
  const a = page.store.add(UI_PATH, uiItem('first passage', 'old a'));
  const b = page.store.add(UI_PATH, uiItem('second passage', 'note b'));
  page.mount();
  page.openPanel();
  page.win.setTimeout = fn => { fn(); return 0; };
  page.rowButton(a.id, 'edit').click();
  page.note().value = 'typed for a';
  page.storage.setItem = () => { const error = new Error('full'); error.name = 'QuotaExceededError'; throw error; };
  page.rowButton(b.id, 'edit').click();
  assert.equal(page.store.items(UI_PATH).find(item => item.id === a.id).note, 'typed for a');
  assert.equal(page.note().value, 'note b');
  assert.equal(page.store.info().lastError, 'quota');
  assert.match(page.find('.aifs-hl-sr').textContent, /Browser storage is full/);
});

test('saving a dirty note before showing the toolbar puts back the selection the repaint dropped', () => {
  const saved = { buildModel: anchorStub.buildModel, normalizedToRaw: anchorStub.normalizedToRaw, rawToNormalized: anchorStub.rawToNormalized };
  const page = uiPage();
  const textNode = page.article.appendChild(new UiText('select these words please'));
  const segments = [{ node: textNode, start: 0, end: textNode.nodeValue.length, atomic: false, unit: false }];
  anchorStub.buildModel = () => ({ text: textNode.nodeValue, normalized: { text: textNode.nodeValue }, segments, sections: [] });
  anchorStub.normalizedToRaw = (_, start, end) => ({ start, end });
  anchorStub.rawToNormalized = (_, start, end) => ({ start, end });
  try {
    const makeRange = (startOffset, endOffset) => ({
      startContainer: textNode, startOffset, endContainer: textNode, endOffset, commonAncestorContainer: textNode,
      intersectsNode: node => node === textNode,
      getBoundingClientRect: () => ({ top: 200, bottom: 220, left: 0, right: 10, width: 10, height: 20 }),
    });
    let current = makeRange(7, 12);
    const selection = {
      get isCollapsed() { return !current || current.startOffset === current.endOffset; },
      get rangeCount() { return current ? 1 : 0; },
      getRangeAt: () => current,
      removeAllRanges() { current = null; },
      addRange(range) { current = range; },
    };
    page.win.getSelection = () => selection;
    page.doc.createRange = () => {
      const range = makeRange(0, 0);
      range.setStart = (node, offset) => { range.startContainer = node; range.startOffset = offset; };
      range.setEnd = (node, offset) => { range.endContainer = node; range.endOffset = offset; };
      return range;
    };
    const a = page.store.add(UI_PATH, uiItem('first passage', 'old a'));
    page.mount();
    page.openPanel();
    page.rowButton(a.id, 'edit').click();
    page.note().value = 'typed for a';
    page.store.onChange(() => { current = makeRange(0, 0); });
    page.doc.listeners.keydown.forEach(fn => fn({ altKey: true, ctrlKey: false, metaKey: false, code: 'KeyH', key: 'h', target: page.article, preventDefault() {} }));
    assert.equal(page.store.items(UI_PATH)[0].note, 'typed for a');
    assert.deepEqual([current.startOffset, current.endOffset], [7, 12]);
    assert.equal(page.find('.aifs-hl-toolbar').hidden, false);
  } finally {
    Object.assign(anchorStub, saved);
  }
});

test('closing an untouched editor keeps a note another tab changed, and typed text still wins', () => {
  const page = uiPage();
  const a = page.store.add(UI_PATH, uiItem('first passage', 'base'));
  page.mount();
  page.openPanel();
  page.rowButton(a.id, 'edit').click();
  page.otherTab().update(UI_PATH, a.id, { note: 'from the other tab' });
  page.syncFromOtherTab();
  assert.equal(page.note().value, 'from the other tab');
  page.find('.aifs-hl-editor .aifs-hl-btn:not(.aifs-hl-btn-primary):not(.aifs-hl-btn-danger)').click();
  assert.equal(page.editor().hidden, true);
  assert.equal(page.store.items(UI_PATH)[0].note, 'from the other tab');

  page.rowButton(a.id, 'edit').click();
  page.note().value = 'my words';
  page.otherTab().update(UI_PATH, a.id, { note: 'remote again' });
  page.syncFromOtherTab();
  assert.equal(page.note().value, 'my words');
  page.find('.aifs-hl-editor .aifs-hl-btn:not(.aifs-hl-btn-primary):not(.aifs-hl-btn-danger)').click();
  assert.equal(page.store.items(UI_PATH)[0].note, 'my words');
});

test('the editor closes without saving when its highlight is deleted here or in another tab', () => {
  const page = uiPage();
  const a = page.store.add(UI_PATH, uiItem('first passage', 'a'));
  const b = page.store.add(UI_PATH, uiItem('second passage', 'b'));
  page.mount();
  page.openPanel();
  page.rowButton(a.id, 'edit').click();
  page.note().value = 'unsaved';
  page.otherTab().remove(UI_PATH, a.id);
  page.syncFromOtherTab();
  assert.equal(page.editor().hidden, true);
  assert.deepEqual(page.store.items(UI_PATH).map(item => item.id), [b.id]);

  page.rowButton(b.id, 'edit').click();
  assert.equal(page.editor().hidden, false);
  page.rowButton(b.id, 'delete').click();
  assert.equal(page.editor().hidden, true);
  assert.deepEqual(page.store.items(UI_PATH), []);
});

test('find again is cancelled with a message when its highlight is deleted, and when the panel opens again', () => {
  const page = uiPage();
  const a = page.store.add(UI_PATH, uiItem('first passage'));
  const b = page.store.add(UI_PATH, uiItem('second passage'));
  page.mount();
  page.openPanel();
  page.win.AIFSHighlights.settle();
  page.rowButton(a.id, 'find').click();
  page.otherTab().remove(UI_PATH, a.id);
  page.syncFromOtherTab();
  assert.match(page.find('.aifs-hl-toast').textContent, /deleted.*cancelled/);

  page.rowButton(b.id, 'find').click();
  assert.match(page.find('.aifs-hl-toast').textContent, /Select the text/);
  page.find('.aifs-hl-launch').click();
  page.find('.aifs-hl-launch').click();
  page.otherTab().remove(UI_PATH, b.id);
  page.syncFromOtherTab();
  assert.match(page.find('.aifs-hl-toast').textContent, /Select the text/);
});

test('removing the share fragment from the address ends share-link mode', () => {
  const owner = StoreModule.create({ localStorage: uiStorage(), addEventListener() {} });
  owner.add(UI_PATH, uiItem('shared passage', 'from a friend'), { title: 'GD' });
  const page = uiPage({ hash: '#aifs-share=' + owner.share(UI_PATH) });
  page.mount();
  assert.equal(page.find('.aifs-hl-sharebar').hidden, false);
  page.win.location.hash = '';
  page.fire('hashchange');
  assert.equal(page.find('.aifs-hl-sharebar').hidden, true);
  page.win.location.hash = '#aifs-share=' + owner.share(UI_PATH);
  page.fire('hashchange');
  assert.equal(page.find('.aifs-hl-sharebar').hidden, false);
});

test('closing the panel clears the share link notice so storage warnings can show again', () => {
  const page = uiPage();
  page.store.add(UI_PATH, uiItem('first passage'));
  page.mount();
  page.openPanel();
  page.find('.aifs-hl-panel-foot').querySelectorAll('button')[3].click();
  assert.ok(page.find('.aifs-hl-notice').querySelector('input'));
  page.find('.aifs-hl-panel-head button').click();
  assert.equal(page.find('.aifs-hl-notice').hidden, true);
  assert.equal(page.find('.aifs-hl-notice').querySelector('input'), null);
});

test('remounting while the page loads does not stack load listeners for the deep link', () => {
  const page = uiPage({ hash: '#hl-abc', readyState: 'loading' });
  page.mount();
  page.mount();
  page.mount();
  assert.ok((page.listeners.load || []).length <= 1);
});
