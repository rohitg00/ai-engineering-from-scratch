#!/usr/bin/env node
/**
 * Zero-dependency static server for the workbench.
 *
 *   node scripts/serve.mjs          http://localhost:5173
 *   PORT=8080 node scripts/serve.mjs
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 5173);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

function resolveFile(urlPath) {
  const clean = decodeURIComponent(urlPath.split('?')[0]);
  const candidates = [];

  if (clean === '/' || clean === '') candidates.push('index.html');
  else {
    const relative = clean.replace(/^\/+/, '');
    candidates.push(relative);
    if (clean.startsWith('/content/')) {
      candidates.push(path.join('public', relative));
    }
    if (clean === '/favicon.svg' || clean === '/favicon.ico') {
      candidates.push(path.join('public', path.basename(clean)));
    }
  }

  for (const candidate of candidates) {
    const full = path.resolve(ROOT, candidate);
    if (!full.startsWith(ROOT)) continue;
    if (fs.existsSync(full) && fs.statSync(full).isFile()) return full;
  }
  return null;
}

const server = http.createServer((request, response) => {
  const file = resolveFile(request.url || '/');

  if (!file) {
    // Hash routing means deep links never hit the server. Anything else 404s.
    if (!path.extname(request.url || '')) {
      const index = path.join(ROOT, 'index.html');
      response.writeHead(200, { 'content-type': TYPES['.html'] });
      fs.createReadStream(index).pipe(response);
      return;
    }
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Not found');
    return;
  }

  const type = TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';
  response.writeHead(200, {
    'content-type': type,
    'cache-control': 'no-cache',
  });
  fs.createReadStream(file).pipe(response);
});

server.listen(PORT, () => {
  console.log(`workbench: http://localhost:${PORT}`);
});
