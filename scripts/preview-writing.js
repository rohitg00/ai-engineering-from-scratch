const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { createHandler } = require('../api/blogs');
const { createPortfolioSource } = require('../site/portfolio-source');

async function main() {
  if (!process.argv[2]) throw new Error('Usage: node scripts/preview-writing.js /path/to/portfolio [port]');
  const portfolio = path.resolve(process.argv[2]);
  const { default: contentHandler } = await import(pathToFileURL(path.join(portfolio, 'api/content.js')).href);
  const sourceServer = http.createServer((req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    if (pathname === '/api/content') return contentHandler(req, res);
    if (!/^\/(blog|guides)\/[a-z0-9][a-z0-9-]*\/$/.test(pathname)) {
      res.writeHead(404).end();
      return;
    }
    try {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(fs.readFileSync(path.join(portfolio, pathname, 'index.html')));
    } catch (_) { res.writeHead(404).end(); }
  });
  await new Promise((resolve, reject) => {
    sourceServer.once('error', reject);
    sourceServer.listen(0, '127.0.0.1', resolve);
  });
  const sourceOrigin = `http://127.0.0.1:${sourceServer.address().port}`;
  const source = createPortfolioSource({ fetchImpl: (url, options) => fetch(sourceOrigin + new URL(url).pathname, options) });
  const handler = createHandler({ source });
  const reader = createHandler({ source, article: true });
  const site = path.resolve(__dirname, '..', 'site');
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };
  const server = http.createServer(async (req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    if (/^\/blogs(?:\.html)?\/?$/.test(pathname)) return handler(req, res);
    if (/^\/(blog|guides)\/[a-z0-9][a-z0-9-]*\/?$/.test(pathname)) {
      req.query = { path: pathname.replace(/\/?$/, '/') };
      return reader(req, res);
    }
    try {
      const filename = path.resolve(site, '.' + decodeURIComponent(pathname === '/' ? '/index.html' : pathname));
      if (!filename.startsWith(site + path.sep)) throw new Error('Outside site');
      const data = fs.readFileSync(filename);
      res.setHeader('Content-Type', (types[path.extname(filename)] || 'application/octet-stream') + '; charset=utf-8');
      res.end(req.method === 'HEAD' ? undefined : data);
    } catch (_) { res.writeHead(404).end('Not found'); }
  });
  server.on('error', error => { console.error(error.message); sourceServer.close(); process.exitCode = 1; });
  const port = Number(process.argv[3] || 4178);
  server.listen(port, '127.0.0.1', () => console.log(`Writing preview: http://127.0.0.1:${port}/blogs`));
  function stop() { server.close(); sourceServer.close(); }
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
