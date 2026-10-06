#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const manuals = require('../site/build-manuals.js');
const figkit = require('../manuals/_shared/figkit.js');
const { parseSvg, textContent } = require('../manuals/_shared/svg.js');

const ROOT = path.resolve(__dirname, '..');
const CONTRACTION = /\b(\w+n['’]t|it['’]s|that['’]s|there['’]s|here['’]s|what['’]s|who['’]s|let['’]s|\w+['’]re|\w+['’]ve|\w+['’]ll|\w+['’]d|I['’]m)\b/gi;
const TELLS = [
  [/\bnot (just |only |merely )?[^.,;]{1,40}[,.]? (but|it is|it's)\b/i, 'not X but Y'],
  [/\b(crucially|importantly|notably|ultimately|essentially|fundamentally)\b/i, 'intensifier'],
  [/\b(game[- ]chang\w*|paradigm|pivotal|groundbreaking|revolutionary|unprecedented|cutting[- ]edge)\b/i, 'inflation'],
  [/\b(serves as|stands as|acts as a testament|underscores|highlights the)\b/i, 'avoids is/has'],
  [/\bhere'?s (the thing|why|what)\b/i, 'staged run-up'],
];
const LIMITS = { sentence: 25, thesis: 30, claim: 28 };
const COLOR_ATTRS = ['fill', 'stroke', 'stop-color', 'color', 'flood-color', 'lighting-color'];
const ALLOWED_CLASSES = new Set(['m-serif', 'm-knock']);
const TEXT_POSITION = ['x', 'y', 'dx', 'dy', 'rotate', 'transform'];

function rel(file) { return path.relative(ROOT, file).split(path.sep).join('/'); }

function plain(text) {
  return String(text)
    .replace(/`[^`]*`/g, 'code')
    .replace(/\{\{[^}]*\}\}/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[“"][^”"]*[”"]/g, 'quote')
    .replace(/\*\*?/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function sentences(text) {
  let s = text.replace(/\b(e\.g|i\.e|vs|etc|approx|Fig|No|U\.S|Inc|Dr|Mr|Ms|p)\./g, match => match.replace(/\./g, '<dot>'));
  s = s.replace(/([.!?]["”)])\s+(?=[A-Z0-9"(“])/g, '$1<split>').replace(/([.!?])\s+(?=[A-Z0-9"(“])/g, '$1<split>');
  return s.split('<split>').map(part => part.replace(/<dot>/g, '.').trim()).filter(Boolean);
}

function wordCount(sentence) { return (sentence.match(/[\w$%.'/-]+/g) || []).length; }

function proseIssues(span, add) {
  const raw = String(span.text);
  const stripped = raw.replace(/`[^`]*`/g, '').replace(/\{\{[^}]*\}\}/g, '').replace(/[“"][^”"]*[”"]/g, '');
  if (/[—–]/.test(stripped)) add(span.where, 'dash', 'em or en dash in prose: use a colon, comma, or period');
  if (stripped.includes(';')) add(span.where, 'semicolon', 'semicolon in prose: split the sentence');
  if (/\bmay\b/i.test(stripped)) add(span.where, 'may', '"may" as a verb: use "can" or state the condition');
  for (const match of stripped.matchAll(CONTRACTION)) add(span.where, 'contraction', `contraction "${match[0]}"`);
  const parts = sentences(plain(raw));
  const rule = span.kind === 'claim' ? 'figure-claim' : span.kind === 'thesis' ? 'thesis' : 'long-sentence';
  if (span.kind === 'claim' && !/\.$/.test(raw.trim())) add(span.where, rule, 'a figure claim is one sentence that ends with a period');
  if ((span.kind === 'claim' || span.kind === 'thesis') && parts.length !== 1) add(span.where, rule, `a ${span.kind} must be one sentence`);
  for (const sentence of parts) {
    const limit = LIMITS[span.kind];
    const count = wordCount(sentence);
    if (limit && count > limit) add(span.where, rule, `${count} words (limit ${limit}): "${sentence.slice(0, 90)}"`);
    for (const [pattern, name] of TELLS) if (pattern.test(sentence)) add(span.where, 'tell', `${name}: "${sentence.slice(0, 90)}"`);
  }
}

function pathSegments(d) {
  const tokens = d.match(/[MLHVZmlhvz]|-?\d*\.?\d+(?:e-?\d+)?/g) || [];
  const segments = [];
  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;
  let command = null;
  let i = 0;
  while (i < tokens.length) {
    if (/[A-Za-z]/.test(tokens[i])) {
      command = tokens[i];
      i += 1;
      if (/[Zz]/.test(command)) { segments.push([x, y, startX, startY]); x = startX; y = startY; }
      continue;
    }
    const read = () => Number(tokens[i++]);
    const relative = command === command.toLowerCase();
    const upper = command.toUpperCase();
    if (upper === 'M') { x = (relative ? x : 0) + read(); y = (relative ? y : 0) + read(); startX = x; startY = y; command = relative ? 'l' : 'L'; continue; }
    if (upper === 'L') { const nx = (relative ? x : 0) + read(); const ny = (relative ? y : 0) + read(); segments.push([x, y, nx, ny]); x = nx; y = ny; continue; }
    if (upper === 'H') { const nx = (relative ? x : 0) + read(); segments.push([x, y, nx, y]); x = nx; continue; }
    if (upper === 'V') { const ny = (relative ? y : 0) + read(); segments.push([x, y, x, ny]); y = ny; continue; }
    i += 1;
  }
  return segments;
}

function crosses(segment, left, top, right, bottom) {
  if (right <= left || bottom <= top) return false;
  let t0 = 0;
  let t1 = 1;
  const dx = segment.x2 - segment.x1;
  const dy = segment.y2 - segment.y1;
  for (const [p, q] of [[-dx, segment.x1 - left], [dx, right - segment.x1], [-dy, segment.y1 - top], [dy, bottom - segment.y1]]) {
    if (p === 0) { if (q < 0) return false; continue; }
    const r = q / p;
    if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; } else { if (r < t0) return false; if (r < t1) t1 = r; }
  }
  return t0 <= t1;
}

function translate(value, where, add) {
  if (!value) return [0, 0];
  const match = /^\s*translate\(\s*(-?[\d.]+)(?:[\s,]+(-?[\d.]+))?\s*\)\s*$/.exec(value);
  if (!match) { add(where, 'figure-transform', `only translate(x, y) is allowed on <g>, got "${value}"`); return [0, 0]; }
  return [Number(match[1]), Number(match[2] || 0)];
}

function lintFigure(file, id, add) {
  const where = rel(file);
  const source = fs.readFileSync(file, 'utf8');
  if (Buffer.byteLength(source) > 40 * 1024) add(where, 'figure-size', 'SVG larger than 40 KB');
  let svg;
  try { svg = parseSvg(source); } catch (error) { add(where, 'figure-parse', error.message); return; }
  const [vbWidth, vbHeight] = (svg.attrs.viewBox || '').split(/\s+/).map(Number).slice(2);
  if (vbHeight > 760) add(where, 'figure-viewbox', `viewBox height ${vbHeight} is taller than one page allows (760)`);
  const texts = [];
  const rects = [];
  const segments = [];
  let nodes = 0;
  let order = 0;
  const walk = (node, inherited) => {
    if (node.name === '#text' || ['defs', 'marker', 'pattern', 'title', 'desc'].includes(node.name)) return;
    nodes += 1;
    order += 1;
    const attrs = node.attrs;
    const label = `${where} <${node.name}${attrs.id ? ` id=${attrs.id}` : ''}>`;
    if (attrs.class) for (const name of attrs.class.split(/\s+/)) if (!ALLOWED_CLASSES.has(name)) add(label, 'figure-class', `class "${name}" is not allowed`);
    for (const key of COLOR_ATTRS) {
      const value = attrs[key];
      if (value === undefined || ['none', 'transparent', 'currentColor'].includes(value)) continue;
      if (key === 'fill' && new RegExp(`^url\\(#${id}-[a-z0-9-]+\\)$`).test(value)) continue;
      const token = /^var\(--(m-[a-z-]+),\s*(#[0-9a-fA-F]{6})\)$/.exec(value);
      if (!token) add(label, 'figure-color', `${key}="${value}" must be var(--m-token, #hex)`);
      else if (figkit.TOKENS.get(token[1]) !== token[2].toLowerCase()) add(label, 'figure-color', `--${token[1]} fallback ${token[2]} should be ${figkit.TOKENS.get(token[1]) || 'a known token'}`);
    }
    if (attrs.transform !== undefined && node.name !== 'g') add(label, 'figure-transform', 'transform is only allowed on <g>');
    const [dx, dy] = node.name === 'g' ? translate(attrs.transform, label, add) : [0, 0];
    const state = {
      tx: inherited.tx + dx,
      ty: inherited.ty + dy,
      size: attrs['font-size'] !== undefined ? Number(attrs['font-size']) : inherited.size,
      anchor: attrs['text-anchor'] || inherited.anchor,
      spacing: attrs['letter-spacing'] !== undefined ? Number(attrs['letter-spacing']) : inherited.spacing,
      serif: inherited.serif || /\bm-serif\b/.test(attrs.class || ''),
    };
    if (node.name === 'rect') {
      const fill = attrs.fill || '';
      const rect = {
        x: Number(attrs.x || 0) + state.tx,
        y: Number(attrs.y || 0) + state.ty,
        w: Number(attrs.width || 0),
        h: Number(attrs.height || 0),
        knock: /\bm-knock\b/.test(attrs.class || ''),
        hatch: /hatch/.test(fill),
        box: (fill && !['none', 'transparent'].includes(fill)) || (attrs.stroke && attrs.stroke !== 'none'),
        opaque: !!fill && !['none', 'transparent'].includes(fill) && !fill.startsWith('url(') && attrs['fill-opacity'] === undefined,
        order,
      };
      if (rect.w > 0 && rect.h > 0) rects.push(rect);
    }
    if (node.name === 'line' && attrs.stroke && attrs.stroke !== 'none') segments.push({ x1: Number(attrs.x1 || 0) + state.tx, y1: Number(attrs.y1 || 0) + state.ty, x2: Number(attrs.x2 || 0) + state.tx, y2: Number(attrs.y2 || 0) + state.ty, order });
    if (node.name === 'path' && attrs.stroke && attrs.stroke !== 'none' && attrs.d) for (const s of pathSegments(attrs.d)) segments.push({ x1: s[0] + state.tx, y1: s[1] + state.ty, x2: s[2] + state.tx, y2: s[3] + state.ty, order });
    if (node.name === 'text') {
      for (const child of node.children) {
        if (child.name === 'tspan') for (const key of TEXT_POSITION) if (child.attrs[key] !== undefined) add(label, 'figure-tspan', `positioned tspan (${key}) is not allowed: use one <text> per line`);
        if (child.name !== '#text' && child.name !== 'tspan') add(label, 'figure-text', `<${child.name}> inside <text> is not allowed`);
      }
      const content = textContent(node).replace(/\s+/g, ' ').trim();
      if (!content) return;
      if (/…|\.\.\./.test(content)) add(label, 'figure-ellipsis', `ellipsis in figure text "${content}": shorten the label or move it outside`);
      if (!Number.isFinite(state.size)) { add(label, 'figure-font', `no font-size for "${content}"`); return; }
      if (state.size < figkit.MIN_FONT) add(label, 'figure-font', `font-size ${state.size} below ${figkit.MIN_FONT} for "${content}"`);
      const box = figkit.textBox(content, Number(attrs.x || 0) + state.tx, Number(attrs.y || 0) + state.ty, state.size, { serif: state.serif, spacing: state.spacing || 0, anchor: state.anchor });
      texts.push({ content, label, ...box, cx: (box.left + box.right) / 2, cy: (box.top + box.bottom) / 2, order });
      return;
    }
    for (const child of node.children) walk(child, state);
  };
  walk(svg, { tx: 0, ty: 0, size: NaN, anchor: 'start', spacing: 0, serif: false });
  if (nodes > 450) add(where, 'figure-size', `${nodes} elements: simplify the figure`);
  const inside = (text, rect) => text.left >= rect.x - 0.5 && text.right <= rect.x + rect.w + 0.5 && text.top >= rect.y - 0.5 && text.bottom <= rect.y + rect.h + 0.5;
  for (const text of texts) {
    if (text.left < 1 || text.top < 1 || text.right > vbWidth - 1 || text.bottom > vbHeight - 1) add(text.label, 'figure-bounds', `"${text.content}" runs outside the viewBox`);
    const containers = rects.filter(rect => rect.box && !rect.hatch && !rect.knock && text.cx > rect.x && text.cx < rect.x + rect.w && text.cy > rect.y && text.cy < rect.y + rect.h);
    if (containers.length) {
      const box = containers.reduce((best, rect) => (rect.w * rect.h < best.w * best.h ? rect : best));
      if (text.left < box.x + 2 || text.right > box.x + box.w - 2 || text.top < box.y + 1 || text.bottom > box.y + box.h - 1) add(text.label, 'figure-spill', `"${text.content}" spills out of its box`);
    }
    for (const rect of rects.filter(r => r.hatch)) {
      if (text.left < rect.x + rect.w && text.right > rect.x && text.top < rect.y + rect.h && text.bottom > rect.y) add(text.label, 'figure-hatch', `"${text.content}" sits on a hatched fill`);
    }
    for (const segment of segments) {
      if (!crosses(segment, text.left + 1.5, text.top + 1.5, text.right - 1.5, text.bottom - 1.5)) continue;
      const masked = segment.order < text.order && rects.some(rect => (rect.knock || rect.opaque) && rect.order > segment.order && rect.order < text.order && inside(text, rect));
      if (!masked) add(text.label, 'figure-crossing', `a line ${segment.order > text.order ? 'is drawn over' : 'crosses'} "${text.content}"`);
    }
  }
  for (let i = 0; i < texts.length; i += 1) {
    for (let j = i + 1; j < texts.length; j += 1) {
      const a = texts[i];
      const b = texts[j];
      if (a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5) add(a.label, 'figure-overlap', `"${a.content}" overlaps "${b.content}"`);
    }
  }
}

function normalizeQuote(text) {
  return String(text).replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[*`]/g, '').replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/\s+/g, ' ').trim();
}

function auditManual(manual, add) {
  const corpus = new Map();
  const corpusFor = key => {
    if (!corpus.has(key)) corpus.set(key, normalizeQuote(fs.readFileSync(manual.quoteSources[key], 'utf8')));
    return corpus.get(key);
  };
  const checkQuote = (quote, cite, where) => {
    const key = String(cite).trim().split(/\s+/)[0];
    if (!(key in manual.quoteSources)) { add(where, 'quote-key', `quoted text cites "${key}", which manual.json quoteSources does not declare`); return; }
    if (manual.quoteSources[key] === null) return;
    const text = normalizeQuote(quote.replace(/^["“]|["”]$/g, ''));
    if (!corpusFor(key).includes(text)) add(where, 'quote', `quote not found verbatim in ${key}: "${text.slice(0, 80)}"`);
  };
  const sources = new Map();
  const sourceFor = file => {
    if (!sources.has(file)) {
      const content = fs.readFileSync(file, 'utf8');
      sources.set(file, { content, lines: new Set(content.split('\n').map(line => line.trim())) });
    }
    return sources.get(file);
  };
  const stats = { documents: manual.documents.length, words: 0, figures: manual.figures.size, listings: 0, takeaways: 0 };
  for (const span of manuals.proseSpans(manual)) {
    proseIssues(span, add);
    if (span.kind === 'sentence') stats.words += plain(span.text).split(' ').filter(Boolean).length;
    for (const match of String(span.text).matchAll(/[“"]([^”"]{24,}?)[”"]\s*\{\{([^}]+)\}\}/g)) checkQuote(match[1], match[2], span.where);
  }
  for (const doc of manual.documents) {
    if (!doc.thesis) add(doc.label, 'thesis', 'a one-sentence thesis blockquote is required under the title');
    const paragraphs = doc.blocks.filter(block => block.type === 'paragraph');
    if (doc.kind === 'section' && !paragraphs.slice(0, 2).some(block => block.text.includes(manuals.OUTCOME_PHRASE))) add(doc.label, 'outcome', `the first two paragraphs must contain "${manuals.OUTCOME_PHRASE} ..."`);
    const takeaways = doc.blocks.filter(block => block.type === 'takeaways').length;
    stats.takeaways += takeaways;
    if (doc.kind === 'section' && takeaways !== 1) add(doc.label, 'takeaways', `sections need exactly one takeaways block (found ${takeaways})`);
    const last = doc.blocks[doc.blocks.length - 1];
    if (!last || last.type !== 'paragraph' || !/^Sources:\s\S/.test(last.text)) add(doc.label, 'sources', 'the last block must be a "Sources: ..." paragraph');
    for (const block of doc.blocks) {
      const where = `${doc.label}:${block.line}`;
      if (block.type === 'code' && manuals.WIRE_LANGS.has(block.lang)) add(where, 'wire-fence', `a ${block.lang} block must be a listing with a capture source`);
      if (block.type === 'rule') checkQuote(block.quote, block.source, where);
      if (block.type === 'listing') {
        stats.listings += 1;
        const source = sourceFor(block.sourceFile);
        block.code.split('\n').forEach((line, index) => {
          const trimmed = line.trim();
          if (!trimmed || trimmed === '…') return;
          const fragments = trimmed.includes('…') ? trimmed.split('…').map(part => part.trim()).filter(part => part.length >= 3) : null;
          const missing = fragments ? fragments.filter(part => !source.content.includes(part)) : (source.lines.has(trimmed) || source.content.includes(trimmed) ? [] : [trimmed]);
          for (const part of missing) add(`${doc.label}:${block.line + index + 1}`, 'provenance', `listing line not in ${block.source}: "${part.slice(0, 80)}"`);
        });
      }
    }
  }
  const figureDir = path.join(manual.dir, 'figures');
  const used = new Set([...manual.figures.keys(), ...(manual.plate ? [manual.plate.figure] : [])]);
  if (fs.existsSync(figureDir)) {
    for (const name of fs.readdirSync(figureDir).filter(file => file.endsWith('.svg'))) {
      const id = name.slice(0, -4);
      if (used.has(id)) lintFigure(path.join(figureDir, name), id, add);
      else add(rel(path.join(figureDir, name)), 'figure-orphan', 'figure file is not used by any document');
    }
  }
  try {
    for (const id of figkit.build(manual.dir, true)) add(rel(path.join(figureDir, `${id}.svg`)), 'figure-drift', `out of date with figures/src/${id}.js: run node manuals/_shared/figkit.js build ${rel(manual.dir)}`);
  } catch (error) {
    add(rel(path.join(figureDir, 'src')), 'figure-drift', error.message);
  }
  return stats;
}

function checkCapture(manual, add) {
  if (!manual.capture) return;
  const [command, ...args] = manual.capture.check;
  const result = spawnSync(command, args, { cwd: manual.dir, encoding: 'utf8', timeout: 300000 });
  if (result.status !== 0) {
    const tail = `${result.stdout || ''}${result.stderr || ''}`.trim().split('\n').slice(-6).join(' | ');
    add(rel(manual.dir), 'capture-drift', `capture check failed (${result.error ? result.error.message : `exit ${result.status}`}): ${tail}`);
  }
}

function main(argv) {
  const args = argv.slice(2);
  const only = args.includes('--manual') ? args[args.indexOf('--manual') + 1] : undefined;
  const issues = [];
  const add = (where, rule, message) => issues.push({ where, rule, message });
  let loaded;
  try {
    loaded = manuals.loadAll({ only, strict: true });
  } catch (error) {
    console.error(`audit-manuals: ${error.message}`);
    return 1;
  }
  const counts = new Map();
  let total = 0;
  const flush = () => {
    for (const issue of issues.splice(0)) {
      counts.set(issue.rule, (counts.get(issue.rule) || 0) + 1);
      total += 1;
      console.log(`  ${issue.rule}: ${issue.where}: ${issue.message}`);
    }
  };
  for (const manual of loaded) {
    const stats = auditManual(manual, add);
    console.log(`${manual.id}: ${stats.documents} documents, ${stats.words} prose words, ${stats.figures} figures, ${stats.listings} listings, ${stats.takeaways} takeaways`);
  }
  flush();
  if (!args.includes('--skip-capture')) {
    for (const manual of loaded) checkCapture(manual, add);
    flush();
  }
  console.log(`TOTAL ${total}${counts.size ? ` (${[...counts].map(([rule, count]) => `${rule} ${count}`).join(', ')})` : ''}`);
  return total ? 1 : 0;
}

if (require.main === module) process.exit(main(process.argv));

module.exports = { auditManual, checkCapture, lintFigure, normalizeQuote, proseIssues, sentences, wordCount };
