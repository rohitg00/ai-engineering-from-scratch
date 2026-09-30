const test = require('node:test');
const assert = require('node:assert/strict');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { once } = require('node:events');
const path = require('node:path');
const { createServer } = require('../../../scripts/serve-agent-site');
const { main } = require('../bin/aiefs');
const exec = promisify(execFile);
const CLI = path.join(__dirname,'../bin/aiefs.js');

test('CLI binary searches, reads, returns schema, and exits nonzero on API and input errors', async t => {
  const server = createServer().listen(0,'127.0.0.1'); await once(server,'listening');t.after(() => server.close());
  const args = ['--base-url',`http://127.0.0.1:${server.address().port}`];
  const search = await exec(process.execPath,[CLI,'search','attention','--limit','1',...args]);
  const item = JSON.parse(search.stdout).items[0];assert.ok(item.path);assert.equal(search.stderr,'');
  const read = await exec(process.execPath,[CLI,'read',item.path,...args]);assert.ok(read.stdout.startsWith('#'));
  const json = await exec(process.execPath,[CLI,'read',item.path,'--json',...args]);assert.ok(JSON.parse(json.stdout).markdown);
  const schema = await exec(process.execPath,[CLI,'schema',...args]);assert.equal(JSON.parse(schema.stdout).openapi,'3.1.0');
  await assert.rejects(exec(process.execPath,[CLI,'read','missing',...args]), error => error.code===1 && /HTTP 404/.test(error.stderr) && error.stdout==='');
  await assert.rejects(exec(process.execPath,[CLI,'search','--limit','51',...args]), error => error.code===1 && /integer/.test(error.stderr));
  const version = await exec(process.execPath,[CLI,'--version']);assert.equal(version.stdout.trim(),'0.1.0');
  const help = await exec(process.execPath,[CLI,'--help']);assert.match(help.stdout,/No API key/);
});

test('CLI reports rate limits, bad response types, redirects, and malformed arguments', async () => {
  const stdout = {write() { throw new Error('Unexpected stdout'); }};
  const rateLimited = async () => new Response(JSON.stringify({code:'rate_limit_exceeded',detail:'Quota reached',hint:'Wait.'}),{status:429,headers:{'content-type':'application/problem+json','retry-after':'23'}});
  await assert.rejects(main(['search','x'],{stdout,fetcher:rateLimited}),/Retry after 23 seconds/);
  await assert.rejects(main(['search'],{stdout,fetcher:async () => new Response('<html>',{headers:{'content-type':'text/html'}})}),/expected JSON/);
  for (const args of [['unknown'],['read'],['schema','extra'],['search','--wat'],['search','--limit'],['search','--limit','1','--limit','2'],['search','--base-url','https://user:password@example.com'],['search','--base-url','http://example.com'],['read','x','--offset','1']]) await assert.rejects(main(args,{stdout}));
  await assert.rejects(main(['schema'],{stdout,fetcher:async (_url,options) => {assert.equal(options.redirect,'error');assert.ok(options.signal);throw new Error('timeout');}}),/timeout/);
});
