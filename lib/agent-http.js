const { STATUS_CODES } = require('node:http');

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

function createLimiter({ limit = 120, windowSeconds = 60, now = Date.now } = {}) {
  let start = now();
  let used = 0;
  return (req, res) => {
    const time = now();
    if (time - start >= windowSeconds * 1000 || time < start) { start = time; used = 0; }
    const reset = Math.max(1, Math.ceil((start + windowSeconds * 1000 - time) / 1000));
    const allowed = used < limit;
    if (allowed) used += 1;
    res.setHeader('RateLimit-Policy', `"instance";q=${limit};w=${windowSeconds}`);
    res.setHeader('RateLimit', `"instance";r=${Math.max(0, limit - used)};t=${reset}`);
    if (!allowed) {
      res.setHeader('Retry-After', String(reset));
      problem(req, res, 429, 'rate_limit_exceeded', 'This function instance has reached its request quota.', 'Wait for Retry-After seconds, then retry.');
    }
    return allowed;
  };
}

module.exports = { quality, representation, send, problem, apiHeaders, createLimiter };
