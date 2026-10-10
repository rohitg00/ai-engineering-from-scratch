const SOURCE_ORIGIN = 'https://rohitghumare.com';
const COURSE_ORIGIN = 'https://aiengineeringfromscratch.com';
const COURSE_NAME = 'AI Engineering from Scratch';
const ARTICLE_PATH = /^\/(?:blog|guides)\/[a-z0-9]+(?:-[a-z0-9]+)*\/$/;
const VOID_ELEMENTS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
const ATTRIBUTE = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
const TAG = /<!--[\s\S]*?-->|<![^>]*>|<\/?[a-z][a-z\d:-]*(?:[^"'<>]|"[^"]*"|'[^']*')*>/gi;
const READER_STYLE = '<style data-aiefs-reader>\n'
  + '.aiefs-reader-nav{display:flex;justify-content:space-between;align-items:center;gap:18px;margin-bottom:40px;padding-bottom:20px;border-bottom:1px solid var(--hairline);font-family:var(--mono),monospace}'
  + '.aiefs-reader-brand{color:var(--ink);font-size:15px;line-height:1.35;letter-spacing:-.4px;text-decoration:none;max-width:190px}'
  + '.aiefs-reader-links{display:flex;align-items:center;gap:14px;flex-shrink:0}'
  + '.aiefs-reader-links>a{color:var(--muted);font-size:12px;line-height:1.5;text-align:right;max-width:90px}'
  + '.aiefs-reader-nav .toggle{width:40px;height:40px}'
  + '.aiefs-reader-nav a:focus-visible{outline:2px solid var(--accent);outline-offset:4px}'
  + '.aiefs-reader-nav[data-aiefs-fallback]{max-width:900px;margin:0 auto 28px;padding:22px}'
  + '@media(max-width:380px){.aiefs-reader-nav{gap:10px}.aiefs-reader-brand{font-size:13px;max-width:140px}.aiefs-reader-links{gap:10px}.aiefs-reader-links>a{font-size:11px;max-width:76px}}'
  + '\n</style>';

function decodeAttribute(value) {
  return String(value || '').replace(/&(?:amp|quot|apos|lt|gt|#\d+|#x[\da-f]+);/gi, entity => {
    const named = { '&amp;': '&', '&quot;': '"', '&apos;': "'", '&lt;': '<', '&gt;': '>' };
    if (named[entity.toLowerCase()]) return named[entity.toLowerCase()];
    const code = entity[2].toLowerCase() === 'x' ? parseInt(entity.slice(3, -1), 16) : parseInt(entity.slice(2, -1), 10);
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '\ufffd';
  });
}

function escapeAttribute(value) {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function attributes(tag) {
  const start = tag.match(/^<\/?[\w:-]+/);
  const found = new Map();
  if (!start) return found;
  const source = tag.slice(start[0].length);
  for (const match of source.matchAll(ATTRIBUTE)) {
    const name = match[1].toLowerCase();
    if (name === '/' || found.has(name)) continue;
    found.set(name, decodeAttribute(match[2] ?? match[3] ?? match[4] ?? ''));
  }
  return found;
}

function tokenize(html) {
  const tokens = [];
  const pattern = new RegExp(TAG.source, TAG.flags);
  let previous = 0;
  let match;
  while ((match = pattern.exec(html))) {
    if (match.index > previous) tokens.push({ type: 'text', raw: html.slice(previous, match.index) });
    const raw = match[0];
    const opening = raw.match(/^<([a-z][a-z\d:-]*)\b/i);
    const closing = raw.match(/^<\/([a-z][a-z\d:-]*)\s*>/i);
    const name = (opening?.[1] || closing?.[1] || '').toLowerCase();
    const token = { type: name ? 'tag' : 'opaque', raw, name, closing: !!closing, attrs: opening ? attributes(raw) : new Map() };
    if (opening && /^(script|style|textarea|title)$/.test(name)) {
      const endPattern = new RegExp(`</${name}\\s*>`, 'ig');
      endPattern.lastIndex = pattern.lastIndex;
      const end = endPattern.exec(html);
      if (!end) throw new Error('Article contains an unclosed raw-text element');
      token.type = 'raw';
      token.body = html.slice(pattern.lastIndex, end.index);
      token.end = end[0];
      pattern.lastIndex = endPattern.lastIndex;
    }
    tokens.push(token);
    previous = pattern.lastIndex;
  }
  if (previous < html.length) tokens.push({ type: 'text', raw: html.slice(previous) });
  return tokens;
}

function serialize(token) {
  return token.raw + (token.type === 'raw' ? token.body + token.end : '');
}

function classIncludes(token, name) {
  return (token.attrs.get('class') || '').split(/\s+/).includes(name);
}

function elementEnd(tokens, start) {
  const name = tokens[start].name;
  let depth = 0;
  for (let index = start; index < tokens.length; index++) {
    const token = tokens[index];
    if (token.type !== 'tag' || token.name !== name) continue;
    depth += token.closing ? -1 : 1;
    if (!depth) return index;
  }
  throw new Error('Article contains an unclosed navigation element');
}

function canonicalUrl(item) {
  if (!item || typeof item.id !== 'string' || !ARTICLE_PATH.test(item.id)) throw new Error('Invalid article path');
  if (item.url !== SOURCE_ORIGIN + item.id) throw new Error('Invalid article canonical URL');
  return item.url;
}

function rewriteAttributes(token, rewrite) {
  const start = token.raw.match(/^<[\w:-]+/);
  if (!start) return token.raw;
  return start[0] + token.raw.slice(start[0].length).replace(ATTRIBUTE, (match, name, double, single, bare) => {
    if (double === undefined && single === undefined && bare === undefined) return match;
    const current = decodeAttribute(double ?? single ?? bare);
    const next = rewrite(name.toLowerCase(), current);
    return next === current ? match : `${name}="${escapeAttribute(next)}"`;
  });
}

function readerNavigation(themeButton = '', fallback = false) {
  const fallbackAttribute = fallback ? ' data-aiefs-fallback' : '';
  return '<nav class="aiefs-reader-nav" aria-label="Primary"' + fallbackAttribute + '><a class="aiefs-reader-brand" href="/">AI / FROM SCRATCH</a><div class="aiefs-reader-links"><a href="/blogs">Blogs &amp; Guides</a>' + themeButton + '</div></nav>';
}

function rewriteBreadcrumbs(body, item) {
  let data;
  try {
    data = JSON.parse(body);
  } catch {
    return body;
  }
  let changed = false;
  function visit(node) {
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (!node || typeof node !== 'object') return;
    const types = [].concat(node['@type'] || []);
    if (types.includes('BreadcrumbList')) {
      node.itemListElement = [
        { '@type': 'ListItem', position: 1, name: 'Home', item: COURSE_ORIGIN + '/' },
        { '@type': 'ListItem', position: 2, name: 'Blogs & Guides', item: COURSE_ORIGIN + '/blogs' },
        { '@type': 'ListItem', position: 3, name: item.title, item: COURSE_ORIGIN + item.id },
      ];
      changed = true;
      return;
    }
    if (types.some(type => ['Article', 'BlogPosting', 'TechArticle', 'HowTo'].includes(type))) return;
    Object.values(node).forEach(visit);
  }
  visit(data);
  return changed ? JSON.stringify(data).replace(/</g, '\\u003c') : body;
}

/**
 * Adapt a catalog article for the course reader while preserving its source canonical URL.
 * Validate the source HTML and catalog entry before rewriting navigation, assets, and metadata.
 */
function mirrorArticle(html, item, items) {
  const sourceUrl = canonicalUrl(item);
  if (typeof html !== 'string' || !html.trim()) throw new Error('Article HTML is missing');
  if (!Array.isArray(items)) throw new Error('Article catalog is missing');
  if (!items.some(entry => entry && entry.id === item.id && entry.url === sourceUrl)) throw new Error('Article is not published in the catalog');

  const tokens = tokenize(html);
  const canonicals = [];
  let hasSiteName = false;
  for (const token of tokens) {
    if (token.type !== 'tag' || token.closing) continue;
    if (token.name === 'base') throw new Error('Article base URL is unsupported');
    if (token.name === 'meta') {
      if ((token.attrs.get('property') || token.attrs.get('name') || '').toLowerCase() === 'og:site_name') hasSiteName = true;
      if ((token.attrs.get('http-equiv') || '').toLowerCase().trim() === 'refresh') throw new Error('Article redirects with a meta refresh');
      const name = (token.attrs.get('name') || '').toLowerCase();
      if (/^(robots|googlebot|bingbot)$/.test(name) && /(?:^|[\s,;:])(noindex|none)(?:$|[\s,;])/.test((token.attrs.get('content') || '').toLowerCase())) {
        throw new Error('Article excludes indexing');
      }
    }
    if (token.name === 'link' && (token.attrs.get('rel') || '').toLowerCase().split(/\s+/).includes('canonical')) canonicals.push(token.attrs.get('href'));
  }
  if (canonicals.length !== 1 || canonicals[0] !== sourceUrl) throw new Error('Article canonical does not match the catalog');
  if (!tokens.some(token => token.name === 'body' && !token.closing)) throw new Error('Article body is missing');
  const primaryNavigationIndex = tokens.findIndex(token => token.type === 'tag' && !token.closing && (
    (token.name === 'nav' && classIncludes(token, 'nav')) || (token.name === 'div' && classIncludes(token, 'topbar'))
  ));

  function assetUrl(value) {
    if (!value || value.startsWith('#') || /^[a-z][a-z\d+.-]*:/i.test(value)) return value;
    return new URL(value, sourceUrl).href;
  }

  function navigationUrl(value) {
    if (!value || value.startsWith('#') || /^(?:mailto|tel|javascript|data):/i.test(value)) return value;
    const resolved = new URL(value, sourceUrl);
    if (resolved.origin !== SOURCE_ORIGIN) return value;
    if (resolved.pathname === '/') return '/';
    if (/^\/(blog|guides)\/?$/.test(resolved.pathname)) return '/blogs';
    const articlePath = resolved.pathname.endsWith('/') ? resolved.pathname : resolved.pathname + '/';
    if (ARTICLE_PATH.test(articlePath)) return articlePath + resolved.search + resolved.hash;
    return resolved.href;
  }

  const output = [];
  const ancestors = [];
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    if (token.type === 'raw') {
      if (token.name === 'script' && token.attrs.has('src')) {
        const resolved = new URL(token.attrs.get('src'), sourceUrl);
        if (resolved.origin === SOURCE_ORIGIN && resolved.pathname === '/search.js') continue;
        output.push(rewriteAttributes(token, (name, value) => name === 'src' ? assetUrl(value) : value) + token.body + token.end);
      } else if (token.name === 'script' && (token.attrs.get('type') || '').toLowerCase() === 'application/ld+json') {
        output.push(token.raw + rewriteBreadcrumbs(token.body, item) + token.end);
      } else {
        output.push(serialize(token));
      }
      continue;
    }
    if (token.type !== 'tag') {
      output.push(token.raw);
      continue;
    }
    if (token.closing) {
      if (token.name === 'head') {
        if (!hasSiteName) output.push('<meta property="og:site_name" content="' + COURSE_NAME + '">');
        output.push(READER_STYLE);
      }
      const matching = ancestors.findLastIndex(ancestor => ancestor.name === token.name);
      if (matching >= 0) ancestors.splice(matching);
      output.push(token.raw);
      continue;
    }
    if (index === primaryNavigationIndex) {
      const end = elementEnd(tokens, index);
      const theme = tokens.findIndex((candidate, candidateIndex) => candidateIndex > index && candidateIndex < end && candidate.name === 'button' && candidate.attrs?.get('id') === 'theme');
      let themeButton = '';
      if (theme >= 0) themeButton = tokens.slice(theme, elementEnd(tokens, theme) + 1).map(serialize).join('');
      output.push(readerNavigation(themeButton));
      index = end;
      continue;
    }
    if (token.name === 'footer') {
      index = elementEnd(tokens, index);
      output.push('<footer><a href="/blogs">Blogs &amp; Guides</a> · <a href="/">AI Engineering from Scratch</a></footer>');
      continue;
    }
    if (token.name === 'a' && ancestors.some(ancestor => ancestor.name === 'nav' && classIncludes(ancestor, 'crumb'))) {
      const target = token.attrs.get('href') || '';
      const mapped = navigationUrl(target);
      if (mapped === '/' || mapped === '/blogs') {
        const end = elementEnd(tokens, index);
        output.push(rewriteAttributes(token, (name, value) => name === 'href' ? mapped : value));
        output.push(mapped === '/' ? 'Home' : 'Blogs &amp; Guides', tokens[end].raw);
        index = end;
        continue;
      }
    }
    output.push(rewriteAttributes(token, (name, value) => {
      if (token.name === 'meta' && name === 'content') {
        const property = (token.attrs.get('property') || token.attrs.get('name') || '').toLowerCase();
        if (property === 'og:url' || property === 'twitter:url') return sourceUrl;
        if (property === 'og:site_name') return COURSE_NAME;
      }
      if (name === 'href') {
        if (token.name === 'a' || token.name === 'area') return navigationUrl(value);
        if (token.name === 'link' && (token.attrs.get('rel') || '').toLowerCase().split(/\s+/).includes('canonical')) return value;
        return assetUrl(value);
      }
      if (['src', 'poster', 'action', 'xlink:href'].includes(name)) return assetUrl(value);
      if (name === 'srcset' && !value.includes('data:')) return value.split(',').map(candidate => candidate.trim().replace(/^\S+/, assetUrl)).join(', ');
      return value;
    }));
    if (token.name === 'body' && primaryNavigationIndex < 0) output.push(readerNavigation('', true));
    if (!VOID_ELEMENTS.has(token.name) && !/\/\s*>$/.test(token.raw)) ancestors.push(token);
  }
  return output.join('');
}

module.exports = { mirrorArticle };
