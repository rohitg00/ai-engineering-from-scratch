const test = require('node:test');
const assert = require('node:assert/strict');
const { createLimiter, quality } = require('../lib/agent-http');
const { search, readResource, InputError } = require('../lib/agent-content');
const catalog = require('../api/v1/catalog');
const resource = require('../api/v1/resource');
const mcp = require('../api/mcp');

async function invoke(handler, { method = 'GET', accept = 'application/json', query = {}, headers = {}, body } = {}) {
  const output = { headers: {}, body: '' };
  const res = { statusCode: 200, setHeader(name, value) { output.headers[name.toLowerCase()] = value; }, end(value = '') { output.body = value; output.status = this.statusCode; } };
  await handler({ method, headers: { accept, ...headers }, query, body }, res);
  if (output.body && /json/.test(output.headers['content-type'])) output.json = JSON.parse(output.body);
  return output;
}
const rpc = (handler, body, overrides = {}) => invoke(handler, { method: 'POST', accept: 'application/json, text/event-stream', headers: { 'content-type': 'application/json', 'mcp-protocol-version': '2025-11-25' }, body, ...overrides });

test('catalog paginates stable unique paths and validates typed inputs', () => {
  const first = search({ limit: 2 }); const next = search({ limit: 2, offset: first.nextOffset });
  assert.ok(first.total >= 600); assert.equal(first.items.length, 2);
  assert.equal(new Set([...first.items, ...next.items].map(item => item.path)).size, 4);
  assert.equal(search({ q: 'unmatched-term-3c57caa' }).nextOffset, null);
  assert.equal(search({ offset: 10000 }).items.length, 0);
  assert.ok(search({ q: 'attention', kind: 'lesson' }).items.every(item => item.kind === 'lesson'));
  for (const args of [{ q: [] }, { limit: 51 }, { limit: 0 }, { limit: 1.2 }, { offset: -1 }, { q: 'a'.repeat(201) }, { kind: 'unknown' }, { extra: 1 }, null]) assert.throws(() => search(args), InputError);
});

test('resource returns exact source without permitting traversal or URL fetching', () => {
  const fs = require('node:fs');
  const entry = readResource('phases/00-setup-and-tooling/01-dev-environment');
  assert.equal(entry.markdown, fs.readFileSync(require('node:path').join(__dirname, '../', entry.path, 'docs/en.md'), 'utf8'));
  for (const path of ['../../.env', '__proto__', 'constructor', 'https://example.com/', '/etc/passwd']) assert.equal(readResource(path), null);
  for (const path of [undefined, [], '', 'a'.repeat(241)]) assert.throws(() => readResource(path), InputError);
});

test('REST methods, Accept, query errors, HEAD, missing content, and service failures', async () => {
  for (const [handler, query] of [[catalog.createHandler(), { q: 'attention', limit: '2' }], [resource.createHandler(), { path: 'projects/dataset-split-auditor' }]]) {
    const get = await invoke(handler, { query }); assert.equal(get.status, 200); assert.match(get.headers.ratelimit, /r=119/);
    const head = await invoke(handler, { query, method: 'HEAD' }); assert.equal(head.status, 200); assert.equal(head.body, '');
    assert.equal((await invoke(handler, { query, accept: 'text/html' })).status, 406);
    const post = await invoke(handler, { method: 'POST' }); assert.equal(post.status, 405); assert.equal(post.headers.allow, 'GET, HEAD');
  }
  for (const query of [{ limit: ['1','2'] }, { q: ['a','b'] }, { limit: '1.2' }, { offset: '-1' }, { kind: '__proto__' }, { other: 'x' }]) assert.equal((await invoke(catalog.createHandler(), { query })).status, 400);
  assert.equal((await invoke(resource.createHandler(), { query: { path: ['a','b'] } })).status, 400);
  const missing = await invoke(resource.createHandler(), { query: { path: 'missing' } }); assert.equal(missing.status, 404); assert.match(missing.json.hint, /catalog/);
  const unavailable = await invoke(catalog.createHandler({ queryCatalog() { throw new Error('private filesystem detail'); } }));
  assert.equal(unavailable.status, 503); assert.doesNotMatch(unavailable.body, /private filesystem/);
});

test('quota headers reflect enforcement and reset with no cached or negative quotas', async () => {
  let time = 1000;
  const handler = catalog.createHandler({ limit: createLimiter({ limit: 2, windowSeconds: 60, now: () => time }) });
  const first = await invoke(handler); assert.equal(first.headers['ratelimit-policy'], '"instance";q=2;w=60');
  assert.equal(first.headers.ratelimit, '"instance";r=1;t=60');
  await invoke(handler); time += 1500;
  const blocked = await invoke(handler); assert.equal(blocked.status, 429); assert.equal(blocked.headers['retry-after'], '59');
  assert.equal(blocked.headers.ratelimit, '"instance";r=0;t=59'); assert.equal(blocked.json.status, 429); assert.equal(blocked.headers['cache-control'], 'no-store');
  time = 61000; assert.equal((await invoke(handler)).status, 200);
});

test('Accept specificity, explicit rejection and invalid quality values', () => {
  assert.equal(quality('application/json;q=0, */*', 'application/json'), 0);
  for (const value of ['garbage', '1.1', '-1', '0.5bad']) assert.equal(quality(`application/json;q=${value}`, 'application/json'), 0);
  assert.equal(quality('application/*;q=0.3, */*;q=1', 'application/json'), 0.3);
});

test('MCP lifecycle, tool schemas, searches and original Markdown work', async () => {
  const handler = mcp.createHandler();
  const init = await rpc(handler, { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2099-01-01', capabilities: {}, clientInfo: { name: 'contract-test', version: '1' } } });
  assert.equal(init.json.result.protocolVersion, '2025-11-25'); assert.deepEqual(init.json.result.capabilities, { tools: { listChanged: false } });
  assert.equal(init.headers['mcp-session-id'], undefined);
  const notification = await rpc(handler, { jsonrpc: '2.0', method: 'notifications/initialized' });
  assert.equal(notification.status, 202); assert.equal(notification.body, '');
  const tools = await rpc(handler, { jsonrpc: '2.0', id: 'list', method: 'tools/list' }); assert.equal(tools.json.result.tools.length, 2);
  for (const tool of tools.json.result.tools) { assert.equal(tool.inputSchema.type, 'object'); assert.equal(tool.outputSchema.type, 'object'); assert.equal(tool.annotations.readOnlyHint, true); }
  const result = await rpc(handler, { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'search_curriculum', arguments: { q: 'attention', limit: 1 } } });
  assert.equal(result.json.result.structuredContent.items.length, 1);
  const read = await rpc(handler, { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'read_resource', arguments: { path: result.json.result.structuredContent.items[0].path } } });
  assert.ok(read.json.result.structuredContent.markdown.startsWith('#'));
  assert.deepEqual(JSON.parse(read.json.result.content[0].text), read.json.result.structuredContent);
});

test('MCP rejects malformed requests, unsafe origins, unsupported transport and invalid arguments', async () => {
  const handler = mcp.createHandler();
  for (const method of ['GET', 'HEAD', 'DELETE']) assert.equal((await invoke(handler, { method })).status, 405);
  assert.equal((await rpc(handler, '{}', { accept: 'application/json' })).status, 406);
  assert.equal((await rpc(handler, '{}', { headers: { origin: 'https://evil.example' } })).status, 403);
  assert.equal((await rpc(handler, '{}', { headers: { 'content-type': 'text/plain' } })).status, 415);
  assert.equal((await rpc(handler, '{}', { headers: { 'content-type': 'application/json', 'mcp-protocol-version': 'bad' } })).json.error.code, -32600);
  const badVersion = await rpc(handler, { jsonrpc: '2.0', id: 1, method: 'ping' }, { headers: { 'content-type': 'application/json', 'mcp-protocol-version': 'bad' } }); assert.equal(badVersion.json.code, 'unsupported_protocol_version');
  assert.equal((await rpc(handler, '{')).json.error.code, -32700);
  assert.equal((await rpc(handler, ' '.repeat(65537))).status, 413);
  for (const body of [[], null, {}, { jsonrpc: '2.0', id: null, method: 'ping' }, { jsonrpc: '2.0', id: 1, method: 'ping', params: [] }]) assert.equal((await rpc(handler, body)).json.error.code, -32600);
  const missing = await rpc(handler, { jsonrpc: '2.0', id: 1, method: 'unknown' }); assert.equal(missing.json.error.code, -32601);
  for (const params of [{ name: 'unknown' }, { name: 'search_curriculum', arguments: null }, { name: 'search_curriculum', arguments: { limit: '1' } }, { name: 'read_resource', arguments: {} }, { name: 'read_resource', arguments: { path: 'x', extra: true } }]) assert.equal((await rpc(handler, { jsonrpc: '2.0', id: 2, method: 'tools/call', params })).json.error.code, -32602);
  const absent = await rpc(handler, { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'read_resource', arguments: { path: 'missing' } } }); assert.equal(absent.json.result.isError, true);
});

module.exports = { invoke };
