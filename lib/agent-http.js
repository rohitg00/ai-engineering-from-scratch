const { STATUS_CODES } = require('node:http');
const { isIP } = require('node:net');

function quality(header, mediaType) {
  const ranges = String(header || '*/*').toLowerCase().split(',').map(part => {
    const [type, ...parameters] = part.trim().split(';');
    const parameter = parameters.find(value => /^\s*q\s*=/.test(value));
    const value = parameter ? parameter.split('=')[1].trim() : '1';
    const q = /^(?:0(?:\.\d{0,3})?|1(?:\.0{0,3})?)$/.test(value) ? Number(value) : 0;
    return { type: type.trim(), q };
  });
  for (const type of [mediaType, mediaType.split('/')[0] + '/*', '*/*']) {
    const matches = ranges.filter(range => range.type === type);
    if (matches.length) return Math.max(...matches.map(range => range.q));
  }
  return 0;
}

function representation(header) {
  const html = quality(header, 'text/html');
  const markdown = quality(header, 'text/markdown');
  const explicitMarkdown = /(?:^|,)\s*text\/markdown\s*(?:;|,|$)/i.test(header || '');
  if (markdown > html || (markdown > 0 && markdown === html && explicitMarkdown)) return 'text/markdown';
  return html > 0 ? 'text/html' : null;
}

function send(req, res, status, type, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', `${type}; charset=utf-8`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(req.method === 'HEAD' ? undefined : body);
}

function problem(req, res, status, code, detail, hint = 'See /docs and /openapi.json for supported requests.') {
  res.setHeader('Cache-Control', 'no-store');
  send(req, res, status, 'application/problem+json', JSON.stringify({
    type: 'about:blank', title: STATUS_CODES[status], status, code, detail, hint,
  }) + '\n');
}

function apiHeaders(res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Vary', 'Accept, Accept-Encoding');
  res.setHeader('X-API-Version', '1');
  res.setHeader('Link', '</openapi.json>; rel="service-desc", </docs>; rel="service-doc"');
}

function cacheable(res) {
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=86400');
  res.removeHeader('RateLimit');
  res.removeHeader('RateLimit-Policy');
}

function clientAddress(req, vercel) {
  const address = vercel ? req.headers?.['x-vercel-forwarded-for'] : req.socket?.remoteAddress;
  if (typeof address !== 'string' || address.includes('%') || !isIP(address)) return 'unknown';
  if (isIP(address) === 6) return ipv6Client(new URL(`http://[${address}]/`).hostname.slice(1, -1));
  return address;
}

function ipv6Client(address) {
  const mapped = address.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (mapped) {
    const high = parseInt(mapped[1], 16);
    const low = parseInt(mapped[2], 16);
    return [high >> 8, high & 255, low >> 8, low & 255].join('.');
  }
  const [head, tail] = address.split('::');
  const leading = head ? head.split(':') : [];
  const trailing = tail ? tail.split(':') : [];
  const groups = leading.concat(Array(8 - leading.length - trailing.length).fill('0'), trailing);
  return `${groups.slice(0, 4).join(':')}::/64`;
}

function createLimiter({ limit = 120, windowSeconds = 60, maxClients = 10000, now = Date.now, vercel = process.env.VERCEL === '1' } = {}) {
  let start = now();
  const clients = new Map();
  return (req, res) => {
    const time = now();
    if (time - start >= windowSeconds * 1000 || time < start) { start = time; clients.clear(); }
    const reset = Math.max(1, Math.ceil((start + windowSeconds * 1000 - time) / 1000));
    const client = clientAddress(req, vercel);
    if (!clients.has(client) && clients.size >= maxClients) {
      for (const [key, count] of clients) {
        if (count < limit) { clients.delete(key); break; }
      }
    }
    let used = clients.get(client) || 0;
    const allowed = used < limit && (clients.has(client) || clients.size < maxClients);
    if (allowed) { used += 1; clients.set(client, used); }
    res.setHeader('RateLimit-Policy', `"client-instance";q=${limit};w=${windowSeconds}`);
    res.setHeader('RateLimit', `"client-instance";r=${allowed ? Math.max(0, limit - used) : 0};t=${reset}`);
    if (!allowed) {
      res.setHeader('Retry-After', String(reset));
      problem(req, res, 429, 'rate_limit_exceeded', 'This client has reached its request quota on this function instance.', 'Wait for Retry-After seconds, then retry.');
    }
    return allowed;
  };
}

module.exports = { quality, representation, send, problem, apiHeaders, cacheable, createLimiter };
