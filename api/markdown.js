const fs = require('fs');
const path = require('path');

const SITE_ROOT = path.join(__dirname, '..', 'site');
const HTML_BY_PATH = {
  '/': 'index.html',
  '/about': 'about.html',
  '/catalog': 'catalog.html',
  '/glossary': 'glossary.html',
  '/path': 'prereqs.html',
  '/roadmap': 'prereqs.html',
  '/developer': 'developer.html',
  '/docs': 'developer.html',
  '/contact': 'contact.html',
  '/privacy': 'privacy.html',
};

function parseAccept(header) {
  if (!header) return [{ type: 'text/html', q: 1 }];
  return header.split(',').map((part, index) => {
    const [rawType, ...params] = part.trim().toLowerCase().split(';');
    const qParam = params.find((param) => param.trim().startsWith('q='));
    const q = qParam ? Number.parseFloat(qParam.trim().slice(2)) : 1;
    return { type: rawType.trim(), q: Number.isFinite(q) ? Math.max(0, Math.min(1, q)) : 0, index };
  }).filter((entry) => entry.type && entry.q > 0).sort((a, b) => {
    if (b.q !== a.q) return b.q - a.q;
    const specificity = (type) => type === '*/*' ? 0 : type.endsWith('/*') ? 1 : 2;
    return specificity(b.type) - specificity(a.type) || a.index - b.index;
  });
}

function qualityFor(accepted, mediaType) {
  const exact = accepted.find((entry) => entry.type === mediaType);
  if (exact) return exact.q;
  const wildcard = accepted.find((entry) => entry.type === '*/*' || entry.type === `${mediaType.split('/')[0]}/*`);
  return wildcard ? wildcard.q : 0;
}

function markdownFor(requestPath) {
  const llms = fs.readFileSync(path.join(SITE_ROOT, 'llms.txt'), 'utf8');
  if (requestPath === '/') return llms;
  return `# AI Engineering from Scratch\n\nCanonical page: https://aiengineeringfromscratch.com${requestPath}\n\nThe agent-oriented curriculum index is available at https://aiengineeringfromscratch.com/llms.txt.\n\n${llms}`;
}

module.exports = (req, res) => {
  const requestPath = String((req.query && req.query.path) || '/').split('?')[0] || '/';
  const accepted = parseAccept(req.headers.accept || '');
  const markdownQ = qualityFor(accepted, 'text/markdown');
  const htmlQ = qualityFor(accepted, 'text/html');
  res.setHeader('Vary', 'Accept, Accept-Encoding');
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=86400, stale-while-revalidate=604800');

  const file = HTML_BY_PATH[requestPath];
  if (!file) {
    res.statusCode = 404;
    if (markdownQ >= htmlQ && markdownQ > 0) {
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.end('# AI Engineering from Scratch\n\nThis path does not exist.\n\nTry /llms.txt or /sitemap.xml.\n');
    } else {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(fs.readFileSync(path.join(SITE_ROOT, '404.html'), 'utf8'));
    }
    return;
  }

  if (!markdownQ && !htmlQ && accepted.length && !accepted.some((entry) => entry.type === '*/*')) {
    res.statusCode = 406;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('Not Acceptable\n\nAvailable representations: text/html, text/markdown\n');
    return;
  }

  if (markdownQ >= htmlQ && markdownQ > 0) {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.end(markdownFor(requestPath));
    return;
  }

  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(fs.readFileSync(path.join(SITE_ROOT, file), 'utf8'));
};
