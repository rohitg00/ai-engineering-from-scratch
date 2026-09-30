const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const config = require('../vercel.json');
const SITE = path.join(__dirname, '../site');
const handlers = {
  '/api/markdown': require('../api/markdown'), '/api/v1/markdown': require('../api/v1/markdown'),
  '/api/v1/catalog': require('../api/v1/catalog'), '/api/v1/resource': require('../api/v1/resource'),
  '/api/mcp': require('../api/mcp'), '/api/not-found': require('../api/not-found'),
  '/api/lesson': require('../api/lesson'), '/api/certification': require('../api/certification'),
};

function queryObject(params) {
  const result = Object.create(null);
  for (const key of new Set(params.keys())) {
    const values = params.getAll(key);
    result[key] = values.length === 1 ? values[0] : values;
  }
  return result;
}

function createServer() {
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://127.0.0.1');
      for (const rule of config.redirects || []) {
        const pattern = rule.source.replace(/:page\(([^)]+)\)/, '($1)').replace(/\.html$/, '\\.html');
        const match = url.pathname.match(new RegExp('^' + pattern + '$'));
        if (!match || (rule.missing || []).some(condition => url.searchParams.has(condition.key))) continue;
        const destination = rule.destination.replace(':page', match[1] || '');
        res.writeHead(rule.permanent ? 308 : 307, { Location: destination + url.search });
        return res.end();
      }
      for (const rule of config.headers) if (new RegExp('^' + rule.source + '$').test(url.pathname)) {
        for (const header of rule.headers) res.setHeader(header.key, header.value);
      }
      let destination = url.pathname;
      let routed = false;
      for (const rule of config.routes) {
        const match = url.pathname.match(new RegExp('^' + rule.src + '$'));
        if (match && (!rule.methods || rule.methods.includes(req.method))) {
          destination = rule.dest.replace(/\$(\d+)/g, (_, n) => match[Number(n)]);
          routed = true;
          break;
        }
      }
      const isFile = name => {
        const filename = path.resolve(SITE, '.' + name);
        return filename.startsWith(SITE + path.sep) && fs.existsSync(filename) && fs.statSync(filename).isFile();
      };
      if (!routed && !handlers[destination] && !isFile(destination)) {
        const rule = config.rewrites.find(rule => rule.source === url.pathname
          || (rule.source === '/api/:missing*' && url.pathname.startsWith('/api/'))
          || rule.source === '/:missing*');
        if (rule) destination = rule.destination;
      }
      const target = new URL(destination, 'http://127.0.0.1');
      for (const [key, value] of target.searchParams) url.searchParams.append(key, value);
      req.query = queryObject(url.searchParams);
      if (handlers[target.pathname]) return await handlers[target.pathname](req, res);
      if (!isFile(target.pathname)) return handlers['/api/not-found'](req, res);
      const type = ({'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.md':'text/markdown','.txt':'text/markdown','.xml':'application/xml','.png':'image/png','.svg':'image/svg+xml','.webp':'image/webp','.woff2':'font/woff2'})[path.extname(target.pathname)] || 'application/octet-stream';
      res.setHeader('Content-Type', type);
      if (req.method === 'HEAD') return res.end();
      fs.createReadStream(path.join(SITE, target.pathname)).pipe(res);
    } catch {
      if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Local preview failed.');
    }
  });
}

if (require.main === module) {
  const port = Number(process.argv[2] || 8795);
  createServer().listen(port, '127.0.0.1', () => console.log(`Agent site preview: http://127.0.0.1:${port}`));
}
module.exports = { createServer };
