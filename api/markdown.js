const fs = require('node:fs');
const path = require('node:path');
const { PAGES } = require('../lib/agent-content');
const { representation, send, problem } = require('../lib/agent-http');
const notFound = require('./not-found');

module.exports = (req, res) => {
  res.setHeader('Vary', 'Accept, Accept-Encoding');
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=86400, must-revalidate');
  res.setHeader('X-API-Version', '1');
  if (!['GET', 'HEAD'].includes(req.method || 'GET')) {
    res.setHeader('Allow', 'GET, HEAD');
    return problem(req, res, 405, 'method_not_allowed', 'Use GET or HEAD to read public resources.');
  }
  const requested = req.query?.path ?? '/';
  if (typeof requested !== 'string') return problem(req, res, 400, 'invalid_parameter', 'Supply path once as a string.');
  const filename = Object.hasOwn(PAGES, requested) ? PAGES[requested] : null;
  if (!filename) return notFound(req, res, true);
  const type = representation(req.headers.accept);
  if (!type) return problem(req, res, 406, 'representation_not_supported', 'Request text/html or text/markdown.');
  try {
    const root = path.join(__dirname, '../site');
    const body = type === 'text/html'
      ? fs.readFileSync(path.join(root, filename), 'utf8')
      : fs.readFileSync(path.join(root, 'agent-pages', filename.replace('.html', '.md')), 'utf8');
    send(req, res, 200, type, body);
  } catch {
    problem(req, res, 503, 'content_unavailable', 'This page is temporarily unavailable.', 'Retry later or use /llms.txt to find the source on GitHub.');
  }
};
