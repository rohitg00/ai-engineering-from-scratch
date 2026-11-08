const assert = require('node:assert/strict');
const test = require('node:test');
const { withDiscovery } = require('./build-agents');

const HEADING = '## API and MCP';
const source = [
  '# AI Engineering from Scratch',
  '',
  '> A free, open-source curriculum.',
  '',
  'Canonical site: https://aiengineeringfromscratch.com',
  'Source: https://github.com/rohitg00/ai-engineering-from-scratch',
  '',
  '## Developer resources',
  '- [Developer documentation](https://aiengineeringfromscratch.com/developer.html)',
  '',
].join('\n');

const lines = (text) => text.split('\n');
const count = (text, line) => lines(text).filter((value) => value === line).length;

test('the discovery section follows the summary and precedes the first file list', () => {
  const out = withDiscovery(source);
  const all = lines(out);
  assert.equal(all[0], '# AI Engineering from Scratch');
  assert.equal(all.findIndex((line) => line.startsWith('## ')), all.indexOf(HEADING));
  assert.ok(all.findIndex((line) => line.startsWith('> ')) < all.indexOf(HEADING));
  assert.ok(all.indexOf('Source: https://github.com/rohitg00/ai-engineering-from-scratch') < all.indexOf(HEADING));
  assert.ok(all.indexOf(HEADING) < all.indexOf('## Developer resources'));
  assert.equal(count(out, HEADING), 1);
  assert.match(out, /\]\(https:\/\/aiengineeringfromscratch\.com\/docs\)/);
  assert.match(out, /\]\(https:\/\/aiengineeringfromscratch\.com\/openapi\.json\)/);
  assert.match(out, /\]\(https:\/\/aiengineeringfromscratch\.com\/server\.json\)/);
  assert.equal(out.replace(/## API and MCP\n\n(?:- .*\n)+\n/, ''), source);
});

test('a second agent build leaves llms.txt unchanged', () => {
  const once = withDiscovery(source);
  assert.equal(withDiscovery(once), once);
  assert.equal(count(withDiscovery(withDiscovery(once)), HEADING), 1);
});

test('a file without file lists gets the section at the end', () => {
  const out = withDiscovery('# Title\n\n> Summary.\n');
  assert.ok(out.startsWith('# Title\n\n> Summary.\n\n' + HEADING + '\n'));
  assert.equal(withDiscovery(out), out);
});
