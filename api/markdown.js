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
  '/sponsors': 'sponsors.html',
};

function parseAccept(header) {
  if (!header) return [{ type: 'text/html', q: 1 }];
  return header.split(',').map((part, index) => {
    const [rawType, ...params] = part.trim().toLowerCase().split(';');
    const qParam = params.find((param) => param.trim().startsWith('q='));
    const q = qParam ? Number.parseFloat(qParam.trim().slice(2)) : 1;
    return { type: rawType.trim(), q: Number.isFinite(q) ? Math.max(0, Math.min(1, q)) : 0, index };
  }).filter((entry) => entry.type).sort((a, b) => {
    if (b.q !== a.q) return b.q - a.q;
    const specificity = (type) => type === '*/*' ? 0 : type.endsWith('/*') ? 1 : 2;
    return specificity(b.type) - specificity(a.type) || a.index - b.index;
  });
}

function qualityFor(accepted, mediaType) {
  const exact = accepted.find((entry) => entry.type === mediaType);
  if (exact) return exact.q;
  const wildcard = accepted.find((entry) => entry.type === `${mediaType.split('/')[0]}/*`)
    || accepted.find((entry) => entry.type === '*/*');
  return wildcard ? wildcard.q : 0;
}

function markdownFor(requestPath) {
  const llms = fs.readFileSync(path.join(SITE_ROOT, 'llms.txt'), 'utf8');
  if (requestPath === '/') return llms;
  return `# AI Engineering from Scratch\n\nCanonical page: https://aiengineeringfromscratch.com${requestPath}\n\nThe agent-oriented curriculum index is available at https://aiengineeringfromscratch.com/llms.txt.\n\n${llms}`;
}

module.exports = (req, res) => {
  const method = req.method || 'GET';
  function send(status, contentType, body) {
    res.statusCode = status;
    res.setHeader('Content-Type', `${contentType}; charset=utf-8`);
    res.end(method === 'HEAD' ? undefined : body);
  }
  function problem(status, title, code, detail) {
    res.setHeader('Cache-Control', 'no-store');
    send(status, 'application/problem+json', JSON.stringify({
      type: 'about:blank', title, status, code, detail,
    }) + '\n');
  }

  const requestPath = String((req.query && req.query.path) || '/').split('?')[0] || '/';
  const accepted = parseAccept(req.headers.accept || '');
  const markdownQ = qualityFor(accepted, 'text/markdown');
  const htmlQ = qualityFor(accepted, 'text/html');
  res.setHeader('Vary', 'Accept, Accept-Encoding');
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=86400, stale-while-revalidate=604800');
  res.setHeader('X-API-Version', '1');

  if (method !== 'GET' && method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    problem(405, 'Method Not Allowed', 'method_not_allowed', 'Use GET or HEAD to read public resources.');
    return;
  }

  const file = Object.hasOwn(HTML_BY_PATH, requestPath) ? HTML_BY_PATH[requestPath] : null;
  if (!file) {
    res.setHeader('Cache-Control', 'no-store');
    if (markdownQ >= htmlQ && markdownQ > 0) {
      send(404, 'text/markdown', '# Page not found\n\nThis path does not exist.\n\nTry the [curriculum index](/llms.txt), [sitemap](/sitemap.xml), or [catalog](/catalog.html).\n');
    } else if (htmlQ > 0) {
      send(404, 'text/html', fs.readFileSync(path.join(SITE_ROOT, '404.html'), 'utf8'));
    } else {
      problem(404, 'Not Found', 'resource_not_found', 'Use /llms.txt or /sitemap.xml to discover public resources.');
    }
    return;
  }

  if (!markdownQ && !htmlQ) {
    problem(406, 'Not Acceptable', 'representation_not_supported', 'Request text/html or text/markdown.');
    return;
  }

  if (markdownQ >= htmlQ && markdownQ > 0) {
    send(200, 'text/markdown', markdownFor(requestPath));
    return;
  }

  send(200, 'text/html', fs.readFileSync(path.join(SITE_ROOT, file), 'utf8'));
};
