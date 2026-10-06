'use strict';

const ELEMENTS = new Set(['svg', 'title', 'desc', 'defs', 'g', 'rect', 'line', 'path', 'polyline', 'polygon', 'circle', 'ellipse', 'text', 'tspan', 'marker', 'pattern']);
const ATTRIBUTES = new Set([
  'xmlns', 'viewBox', 'role', 'aria-labelledby', 'font-family', 'id', 'class',
  'x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'width', 'height', 'd', 'points',
  'fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'stroke-linecap', 'stroke-linejoin', 'stroke-opacity', 'fill-opacity', 'opacity',
  'transform', 'font-size', 'font-weight', 'font-style', 'text-anchor', 'letter-spacing',
  'marker-start', 'marker-end', 'refX', 'refY', 'markerWidth', 'markerHeight', 'markerUnits', 'orient', 'patternUnits', 'patternTransform',
]);

function decode(text) {
  return text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#(\d+);/g, (m, code) => String.fromCodePoint(Number(code))).replace(/&#x([0-9a-f]+);/gi, (m, code) => String.fromCodePoint(parseInt(code, 16))).replace(/&amp;/g, '&');
}

function parseSvg(source) {
  const root = { name: '#root', attrs: {}, children: [] };
  const stack = [root];
  const pattern = /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<(\/?)([a-zA-Z][\w:-]*)((?:\s+[\w:-]+\s*=\s*"[^"]*")*)\s*(\/?)>|([^<]+)/g;
  let match;
  while ((match = pattern.exec(source))) {
    if (match[0].startsWith('<!--') || match[0].startsWith('<?')) continue;
    if (match[5] !== undefined) {
      if (match[5].trim()) stack[stack.length - 1].children.push({ name: '#text', text: decode(match[5]) });
      continue;
    }
    if (match[1]) {
      const node = stack.pop();
      if (!node || node.name !== match[2]) throw new Error(`mismatched </${match[2]}>`);
      continue;
    }
    const attrs = {};
    for (const attr of match[3].matchAll(/([\w:-]+)\s*=\s*"([^"]*)"/g)) attrs[attr[1]] = attr[2];
    const node = { name: match[2], attrs, children: [] };
    stack[stack.length - 1].children.push(node);
    if (!match[4]) stack.push(node);
  }
  if (stack.length !== 1) throw new Error(`unclosed <${stack[stack.length - 1].name}>`);
  const svg = root.children.find(child => child.name === 'svg');
  if (!svg) throw new Error('no <svg> root');
  return svg;
}

function textContent(node) {
  if (node.name === '#text') return node.text;
  return (node.children || []).map(textContent).join('');
}

function validateSvg(source, id, width) {
  const issues = [];
  let svg;
  try { svg = parseSvg(source); } catch (error) { return { svg: null, issues: [error.message] }; }
  const viewBox = /^0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)$/.exec(svg.attrs.viewBox || '');
  if (!viewBox || Number(viewBox[1]) !== width) issues.push(`viewBox must be "0 0 ${width} H"`);
  if (svg.attrs.role !== 'img') issues.push('the root needs role="img"');
  if (svg.attrs['aria-labelledby'] !== `${id}-title ${id}-desc`) issues.push(`the root needs aria-labelledby="${id}-title ${id}-desc"`);
  const title = svg.children.find(child => child.name === 'title');
  const desc = svg.children.find(child => child.name === 'desc');
  if (!title || title.attrs.id !== `${id}-title` || !textContent(title).trim()) issues.push(`a <title id="${id}-title"> with text is required as a direct child`);
  if (!desc || desc.attrs.id !== `${id}-desc` || textContent(desc).trim().length < 40) issues.push(`a <desc id="${id}-desc"> of at least 40 characters is required as a direct child`);
  const walk = node => {
    if (node.name === '#text') return;
    if (!ELEMENTS.has(node.name)) issues.push(`<${node.name}> is not allowed`);
    for (const [key, value] of Object.entries(node.attrs)) {
      if (!ATTRIBUTES.has(key)) issues.push(`attribute ${key} on <${node.name}> is not allowed`);
      if (key === 'id' && !value.startsWith(`${id}-`)) issues.push(`id "${value}" must start with "${id}-"`);
      if (key === 'font-family' && node !== svg) issues.push('font-family is only allowed on the root');
    }
    node.children.forEach(walk);
  };
  walk(svg);
  return { svg, width: viewBox ? Number(viewBox[1]) : 0, height: viewBox ? Number(viewBox[2]) : 0, issues };
}

module.exports = { ATTRIBUTES, ELEMENTS, parseSvg, textContent, validateSvg };
