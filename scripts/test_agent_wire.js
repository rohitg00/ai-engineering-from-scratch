const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { once } = require('node:events');
const { createServer } = require('./serve-agent-site');
const { PAGES } = require('../lib/agent-content');
const spec = require('../site/openapi.json');
const schemas = require('../lib/agent-schemas');

test('served routing preserves HTML, negotiates every navigation page, and recovers unknown routes', async t => {
  const server = createServer().listen(0, '127.0.0.1'); await once(server, 'listening'); t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  for (const [route, filename] of Object.entries(PAGES)) {
    const html = await fetch(base + route); assert.equal(html.status, 200, route); assert.match(html.headers.get('content-type'), /text\/html/, route);
    assert.equal(await html.text(), fs.readFileSync(path.join(__dirname, '../site', filename), 'utf8'), route);
    const markdown = await fetch(base + route, { headers: { Accept: 'text/markdown' } }); assert.equal(markdown.status, 200, route); assert.match(markdown.headers.get('content-type'), /text\/markdown/, route); assert.match(markdown.headers.get('vary'), /Accept/);
    const body = await markdown.text(); assert.ok(body.length > 200, route); assert.doesNotMatch(body, /<script|<!DOCTYPE/i, route);
    const rejected = await fetch(base + route, { headers: { Accept: 'text/html;q=0,text/markdown;q=0' } }); assert.equal(rejected.status, 406, route);
    const head = await fetch(base + route, { method: 'HEAD', headers: { Accept: 'text/markdown' } }); assert.equal(head.status, 200); assert.equal(await head.text(), '');
  }
  for (const route of ['/missing-73ee','/nested/missing.html']) {
    const response = await fetch(base + route, { headers: { Accept: 'text/markdown' } }); assert.equal(response.status, 404); assert.match(response.headers.get('content-type'), /text\/markdown/); assert.match(await response.text(), /sitemap/);
    const html = await fetch(base + route); assert.equal(html.status, 404); assert.match(html.headers.get('content-type'), /text\/html/);
  }
  for (const accept of ['*/*','text/html','application/json']) {
    const response = await fetch(base + '/api/v2/no-such-endpoint', { headers: { Accept: accept } }); assert.equal(response.status, 404); assert.match(response.headers.get('content-type'), /application\/problem\+json/); assert.ok((await response.json()).hint);
  }
  const missing = await fetch(base + '/api/v1/markdown?path=/missing', { headers: { Accept: 'text/markdown' } }); assert.equal(missing.status,404); assert.match(missing.headers.get('content-type'),/text\/markdown/);
  for (const route of ['/server.json','/.well-known/mcp.json','/api/openapi.json','/openapi.json']) {
    const response = await fetch(base + route); assert.equal(response.status,200,route); assert.ok(await response.json());
  }
  for (const route of ['/llms.txt','/developer.md','/sitemap.xml','/style.css?v=old','/header.js?v=old','/projects-data.js']) {
    const response = await fetch(base + route); assert.equal(response.status,200,route); assert.ok((await response.text()).length > 50);
  }
  const lesson = '/lesson?path=phases%2F00-setup-and-tooling%2F01-dev-environment';
  assert.equal((await fetch(base + lesson)).status,200);
  const legacy = await fetch(base + lesson.replace('/lesson?','/lesson.html?'), { redirect:'manual' }); assert.equal(legacy.status,308); assert.match(legacy.headers.get('location'),/^\/lesson\?/);
  const json = await fetch(base + '/api/v1/catalog?q=attention&limit=1'); assert.equal(json.status,200); const catalog = await json.json();
  const source = await fetch(base + '/api/v1/resource?path=' + encodeURIComponent(catalog.items[0].path)); assert.ok((await source.json()).markdown);
  const duplicate = await fetch(base + '/api/v1/catalog?limit=1&limit=2'); assert.equal(duplicate.status,400);
  const rpc = await fetch(base + '/mcp', {method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'wire-test',version:'1'}}})});
  assert.equal(rpc.status,200); assert.equal((await rpc.json()).result.protocolVersion,'2025-11-25');
});

test('OpenAPI and MCP share typed contracts; descriptions, errors, identity and discovery remain truthful', () => {
  const ids = [];
  for (const item of Object.values(spec.paths)) for (const method of ['get','head']) {
    const operation = item[method]; if (!operation) continue;
    assert.ok(operation.description); ids.push(operation.operationId);
    for (const response of Object.values(operation.responses)) {
      if (method === 'head') assert.equal(response.content, undefined);
      else for (const content of Object.values(response.content || {})) assert.ok(content.schema);
    }
  }
  assert.equal(new Set(ids).size,ids.length);
  assert.deepEqual(spec.components.schemas.Resource,schemas.resource);
  assert.deepEqual(spec.components.schemas.CatalogResult,schemas.searchOutput);
  const home = fs.readFileSync(path.join(__dirname,'../site/index.html'),'utf8');
  assert.match(home, /href="developer(?:\.html)?">For devs/);
  const graph = JSON.parse(home.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  const website = graph['@graph'].find(item => item['@type'] === 'WebSite'); assert.match(website.sameAs,/github.com\/rohitg00/);
  assert.ok(!graph['@graph'].some(item => item['@type'] === 'Organization'));
  const llms = fs.readFileSync(path.join(__dirname,'../site/llms.txt'),'utf8'); assert.match(llms,/\/mcp/); assert.match(llms,/\/openapi.json/);
});
