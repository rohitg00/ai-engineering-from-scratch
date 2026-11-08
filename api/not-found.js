const fs = require('node:fs');
const path = require('node:path');
const { representation, send, problem } = require('../lib/agent-http');

module.exports = (req, res, negotiated = false) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Vary', 'Accept, Accept-Encoding');
  const requested = String(req.url || '').split('?')[0];
  const type = representation(req.headers.accept);
  if ((!negotiated && (requested.startsWith('/api/') || req.query?.api === '1')) || !type) {
    return problem(req, res, 404, 'resource_not_found', 'This endpoint does not exist.', 'Start at /docs, /openapi.json, or /api/v1/catalog.');
  }
  if (type === 'text/html') return send(req, res, 404, type, fs.readFileSync(path.join(__dirname, '../site/404.html'), 'utf8'));
  send(req, res, 404, type, '# Page not found\n\nThis path does not exist.\n\nTry the [curriculum index](/llms.txt), [sitemap](/sitemap.xml), [catalog](/catalog.html), or [API docs](/docs).\n');
};
