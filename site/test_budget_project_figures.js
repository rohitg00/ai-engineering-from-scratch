'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');

const registry = new Map();
vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'figures/projects/agent-budget-planner.js'), 'utf8'), {
  window: { AIFSProjectFigures: { register: (id, config) => registry.set(id, config) } },
});
const config = stage => registry.get('pj-agent-budget-planner-' + stage).lab;
const defaults = stage => Object.fromEntries(config(stage).controls.map(control => [control.key, control.value]));
const plain = value => JSON.parse(JSON.stringify(value));
const calculate = (stage, overrides = {}) => plain(config(stage).calculate(Object.freeze({ ...defaults(stage), ...overrides })));
const ledger = (limit, spent, holds) => ({ limit, spent, holds, closed: [] });
const itemLane = (frame, id) => frame.lanes.find(lane => lane.items.some(item => item.id === id))?.id;

function python(cases) {
  const result = spawnSync('python3', ['-c', [
    'import json, sys',
    'from main import estimate, reserve, settle, schedule',
    'from cli import execute_jobs',
    'results = []',
    'for case in json.load(sys.stdin):',
    ' try:',
    '  if case["op"] == "estimate": value = estimate(*case["args"])',
    '  elif case["op"] == "reserve": value = reserve(*case["args"])',
    '  elif case["op"] == "settle": value = settle(*case["args"])',
    '  elif case["op"] == "repeat": value = settle(settle(*case["args"]), case["args"][1], case["args"][2])',
    '  elif case["op"] == "schedule": value = schedule(*case["args"])',
    '  elif case["op"] == "execute":',
    '   def invoke(job):',
    '    if job["id"] == "prior": return (None, 20)',
    '    if case.get("missing"): raise TimeoutError("missing receipt")',
    '    return (None, case["actual"])',
    '   value = execute_jobs([{"id":"prior","cost":20},{"id":"A","cost":70}], 100, 100000, invoke)',
    '  results.append({"value": value})',
    ' except ValueError as error: results.append({"error": str(error)})',
    'print(json.dumps(results))',
  ].join('\n')], { cwd: path.join(__dirname, '../projects/agent-budget-planner/solution'), input: JSON.stringify(cases), encoding: 'utf8', timeout: 10000 });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

test('the four stages have distinct questions and controls', () => {
  assert.equal(registry.size, 4);
  assert.equal(new Set([...registry.values()].map(value => value.lab.question)).size, 4);
  assert.deepEqual(plain(config(1).controls.map(value => value.key)), ['inputTokens', 'outputLimit', 'inputRate', 'outputRate']);
  assert.ok(config(2).controls.some(value => value.key === 'requestId'));
  assert.ok(config(3).controls.some(value => value.key === 'missing'));
  assert.ok(config(4).controls.some(value => value.key === 'deadline'));
});

test('all presets produce valid independent causal frames with visible link endpoints', () => {
  const tones = new Set(['neutral', 'active', 'good', 'warn', 'bad']);
  for (let stage = 1; stage <= 4; stage++) {
    for (const scenario of config(stage).scenarios) {
      const result = calculate(stage, scenario.values);
      assert.ok(result.frames.length > 1, scenario.label);
      for (const frame of result.frames) {
        assert.ok(frame.label && frame.explanation);
        assert.equal(new Set(frame.lanes.map(lane => lane.id)).size, frame.lanes.length);
        const items = frame.lanes.flatMap(lane => lane.items), ids = new Set(items.map(item => item.id));
        assert.equal(ids.size, items.length, frame.label);
        for (const item of items) assert.ok(tones.has(item.tone));
        for (const link of frame.links || []) assert.ok(ids.has(link.from) && ids.has(link.to), JSON.stringify(link));
        for (const bar of frame.bars || []) assert.ok(bar.value >= 0 && bar.value <= bar.max, JSON.stringify(bar));
      }
    }
  }
});

test('estimation reveals the two actual products before their sum', () => {
  const result = calculate(1);
  assert.equal(result.frames[0].receipt, undefined);
  assert.equal(result.frames[0].lanes.flatMap(lane => lane.items).some(item => item.id === 'total'), false);
  assert.match(result.frames[1].formula, /120 × 2 = 240/);
  assert.match(result.frames[2].formula, /40 × 5 = 200/);
  assert.equal(result.receipt.estimate, 440);
  assert.equal(calculate(1, { outputLimit: 0 }).receipt.estimate, 240);
  assert.equal(calculate(1, { outputLimit: 400 }).receipt.estimate, 2240);
});

test('costs and validation agree with the Python estimation contract', () => {
  const cases = [[120, 40, 2, 5], [120, 0, 2, 5], [0, 0, 0, 0], [13, 57, 7, 11], [-1, 0, 1, 1], [1.2, 0, 1, 1], [true, 0, 1, 1]];
  const results = python(cases.map(args => ({ op: 'estimate', args })));
  cases.forEach((args, index) => {
    const values = Object.fromEntries(['inputTokens', 'outputLimit', 'inputRate', 'outputRate'].map((key, i) => [key, args[i]]));
    if (results[index].error) assert.throws(() => calculate(1, values), /nonnegative safe integer/);
    else assert.equal(calculate(1, values).receipt.estimate, results[index].value);
  });
});

test('every numeric field rejects negatives, fractions and booleans without coercion', () => {
  for (let stage = 1; stage <= 4; stage++) {
    for (const control of config(stage).controls.filter(control => control.type === 'number')) {
      for (const invalid of [-1, 1.5, true, null, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
        assert.throws(() => calculate(stage, { [control.key]: invalid }), /nonnegative safe integer/, `${stage}: ${control.key}`);
      }
    }
  }
  assert.throws(() => calculate(1, { inputTokens: Number.MAX_SAFE_INTEGER, inputRate: 2 }), /Input product/);
  assert.throws(() => calculate(2, { limit: 10 }), /must fit the limit/);
});

test('reservation counts existing holds, preserves rejected state and moves accepted request identity', () => {
  const rejected = calculate(2);
  assert.equal(rejected.receipt.reason, 'budget exceeded');
  assert.deepEqual(rejected.receipt.before, rejected.receipt.after);
  assert.deepEqual(rejected.receipt.after, ledger(100, 20, { A: 30 }));
  const accepted = calculate(2, { amount: 50 });
  assert.deepEqual(accepted.receipt.after.holds, { A: 30, B: 50 });
  assert.equal(accepted.bars.find(bar => bar.label === 'Available').value, 0);
  assert.equal(itemLane(accepted.frames[0], 'new-request'), 'pending');
  assert.equal(itemLane(accepted.frames.at(-1), 'new-request'), 'held');
  assert.deepEqual(accepted.frames[0].receipt.holds, { A: 30 });
  assert.equal(calculate(2, { requestId: 'A', amount: 1 }).receipt.reason, 'new request id required');
});

test('reservation decisions match Python including empty, duplicate and zero reservations', () => {
  const cases = [{ requestId: 'B', amount: 60 }, { requestId: 'B', amount: 50 }, { requestId: 'A', amount: 1 }, { requestId: '', amount: 0 }, { requestId: 'B', amount: 0 }, { requestId: '__proto__', amount: 1 }];
  const results = python(cases.map(value => ({ op: 'reserve', args: [ledger(100, 20, { A: 30 }), value.requestId, value.amount] })));
  cases.forEach((value, index) => {
    const result = calculate(2, value).receipt;
    if (results[index].error) assert.equal(result.reason, results[index].error);
    else assert.deepEqual(result.after, results[index].value);
  });
});

test('settlement moves identified actual and unused portions to persistent destinations', () => {
  const result = calculate(3);
  assert.equal(result.frames[0].receipt.spent, 20);
  assert.deepEqual(result.frames[0].receipt.holds, { A: 70 });
  assert.equal(itemLane(result.frames[2], 'hold-A'), 'held');
  assert.equal(itemLane(result.frames.at(-1), 'hold-A'), 'spent');
  assert.equal(itemLane(result.frames[2], 'unused-A'), 'held');
  assert.equal(itemLane(result.frames.at(-1), 'unused-A'), 'available');
  assert.deepEqual(result.receipt.after, { limit: 100, spent: 40, holds: {}, closed: ['A'] });
  assert.equal(result.receipt.released, 50);
  assert.equal(result.bars.find(bar => bar.label === 'Available').value, 60);
  assert.equal(calculate(3, { actual: 0 }).receipt.released, 70);
  assert.equal(calculate(3, { actual: 70 }).receipt.released, 0);
});

test('settlement and exactly-once receipt handling match Python', () => {
  const before = ledger(100, 20, { A: 70 });
  const cases = [0, 20, 70, 71];
  const results = python([...cases.map(actual => ({ op: 'settle', args: [before, 'A', actual] })), { op: 'repeat', args: [before, 'A', 20] }]);
  cases.forEach((actual, index) => {
    const receipt = calculate(3, { actual }).receipt;
    if (results[index].error) {
      assert.equal(receipt.reason, results[index].error);
      assert.deepEqual(receipt.ledger, before);
    } else assert.deepEqual(receipt.after, results[index].value);
  });
  const duplicate = calculate(3, { duplicate: true }).receipt;
  assert.equal(duplicate.second_receipt.reason, results.at(-1).error);
  assert.deepEqual(duplicate.second_receipt.before, duplicate.second_receipt.after);
  assert.deepEqual(duplicate.after.closed, ['A']);
});

test('missing and over-ceiling receipts retain the same unresolved capacity as execute_jobs', () => {
  const cases = [{ missing: true, actual: 20 }, { missing: false, actual: 71 }];
  const results = python(cases.map(value => ({ op: 'execute', ...value })));
  cases.forEach((value, index) => {
    const result = calculate(3, value).receipt;
    assert.equal(result.status, 'needs_reconciliation');
    assert.equal(result.ledger.spent, results[index].value.ledger.spent);
    assert.deepEqual(result.ledger.holds, results[index].value.ledger.holds);
    assert.equal(results[index].value.events.at(-1).status, result.status);
  });
});

test('ordered replay exposes deadline then budget, preserves rejected state and separates units', () => {
  const result = calculate(4);
  assert.deepEqual(result.frames[0].receipt.events, []);
  assert.equal(result.receipt.ledger.spent, 80);
  assert.equal(result.receipt.elapsed_ms, 60);
  assert.deepEqual(result.receipt.events.map(event => [event.id, event.status, event.reason]), [['A', 'completed', undefined], ['B', 'rejected', 'budget exceeded'], ['C', 'rejected', 'deadline'], ['D', 'completed', undefined]]);
  assert.equal(result.frames.some(frame => frame.label === 'C: check budget'), false);
  for (let index = 1; index < result.frames.length; index++) {
    const frame = result.frames[index];
    if (frame.label.includes('reject for')) {
      assert.deepEqual(frame.receipt.ledger, result.frames[index - 1].receipt.ledger);
      assert.equal(frame.receipt.elapsed_ms, result.frames[index - 1].receipt.elapsed_ms);
    }
  }
  const separate = calculate(4, { deadline: 200 });
  assert.ok(separate.bars.filter(bar => bar.unit === 'teaching units').every(bar => bar.max === 100));
  assert.equal(separate.bars.find(bar => bar.unit === 'ms').max, 200);
  assert.equal(calculate(4, { deadline: 60 }).receipt.events.at(-1).status, 'completed');
  assert.equal(calculate(4, { deadline: 10, limit: 10 }).receipt.events[0].reason, 'deadline');
});

test('all scheduler presets match the Python replay, including exact deadlines and job order', () => {
  const values = [...config(4).scenarios.map(scenario => ({ ...defaults(4), ...scenario.values })), { ...defaults(4), limit: 0, deadline: 0, costA: 0, durationA: 0 }];
  const cases = values.map(v => ({ op: 'schedule', args: [[...v.order].map(id => ({ id, cost: v['cost' + id], duration_ms: v['duration' + id] })), v.limit, v.deadline] }));
  const results = python(cases);
  values.forEach((value, index) => assert.deepEqual(calculate(4, value).receipt, results[index].value));
});
