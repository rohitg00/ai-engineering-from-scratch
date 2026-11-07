const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const llmsPath = path.join(__dirname, 'llms.txt');
const readLlms = () => fs.readFileSync(llmsPath, 'utf8');
const run = (...args) => execFileSync(process.execPath, args, { cwd: root, stdio: 'pipe' });

test('agent discovery follows the complete llms.txt introduction and is added once', () => {
  run('site/build.js');
  run('site/build-projects.js', '--strict');
  const before = readLlms();
  const firstSection = before.indexOf('## ');
  assert.ok(firstSection > 0);
  const introduction = before.slice(0, firstSection);
  assert.match(introduction, /^# AI Engineering from Scratch\n\n> .+\n\nCanonical site:/);
  assert.match(introduction, /Source: .+\nGlossary terms: .+\n\n$/);

  run('site/build-agents.js');
  const after = readLlms();
  assert.ok(after.startsWith(introduction), 'the original introduction must precede every section');
  const discovery = after.match(/^## API and MCP\n\n(?:- .+\n)+\n/m);
  assert.ok(discovery, 'the API and MCP discovery section is present');
  assert.equal(discovery.index, introduction.length, 'discovery must immediately follow the introduction');
  for (const url of ['/docs', '/openapi.json', '/server.json', '/mcp']) {
    assert.ok(discovery[0].includes(`https://aiengineeringfromscratch.com${url}`));
  }
  assert.equal(after.replace(discovery[0], ''), before);
  run('site/build-agents.js');
  assert.equal(readLlms(), after, 'rebuilding must not duplicate discovery links');

  const legacy = '## API, MCP, and CLI\n\n- [Old API](https://example.com/api)\n\n';
  fs.writeFileSync(llmsPath, legacy + before + discovery[0]);
  run('site/build-agents.js');
  assert.equal(readLlms(), after, 'old and duplicate discovery sections must be relocated and replaced');
});
