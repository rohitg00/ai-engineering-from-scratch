'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const figures = new Map();
vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'figures/projects/semantic-notes-search.js'), 'utf8'), {
  window: { AIFSProjectFigures: { register: (id, config) => figures.set(id, config) } },
});
const lab = figures.get('pj-semantic-notes-search-3').lab;
const defaults = Object.fromEntries(lab.controls.map(control => [control.key, control.value]));
const calculate = values => JSON.parse(JSON.stringify(lab.calculate({ ...defaults, ...values })));

test('token maps treat JavaScript property names as ordinary search terms', () => {
  for (const term of ['constructor', '__proto__']) {
    const result = calculate({ query: term, notes: `${term} | restore backups` });
    assert.deepEqual(result.rows, [[1, '1.0000', term]]);
    assert.equal(result.metrics.find(metric => metric.label === 'Query terms').value, 1);
  }
});

test('missing property-name terms have zero weight without poisoning other matches', () => {
  const unknown = calculate({ query: 'constructor deploy', notes: 'deploy | restore backups' });
  assert.deepEqual(unknown.rows, [[1, '1.0000', 'deploy']]);
  const partial = calculate({ query: '__proto__ deploy', notes: '__proto__ | deploy' });
  assert.deepEqual(partial.rows, [[1, '0.7071', '__proto__'], [2, '0.7071', 'deploy']]);
});

test('editable default keeps its literal plural match', () => {
  assert.deepEqual(calculate({}).rows, [[1, '1.0000', 'deploy, replicas']]);
});
