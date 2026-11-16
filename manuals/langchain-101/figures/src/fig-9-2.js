'use strict';

const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const { load } = require('../../../_shared/chart.js');

const lab = path.join(__dirname, '../../capture/lab/prodapp-mac/summary');
const loadData = load(path.join(lab, 'load-mac.json'));
const iso = load(path.join(lab, 'service-mac.json')).isolation;
const cell = loadData.cells.find(c => c.workers === 1 && c.users === Math.max(...loadData.cells.map(x => x.users)));
const per = name => (cell.checkpoint_rows[name] / cell.runs).toFixed(2);
const kb = (cell.checkpoint_data_bytes_per_run / 1000).toFixed(1);

module.exports = figure('fig-9-2', {
  height: 430,
  title: 'The Postgres rows of the service, and the two checks that keep users apart',
  desc: `Tables of the service and the store namespace, with the rows written for each run in the load test with ${cell.users} users and one worker: checkpoints ${per('checkpoints')}, checkpoint_blobs ${per('checkpoint_blobs')}, checkpoint_writes ${per('checkpoint_writes')}, about ${kb} KB of row data. A request for another user's thread got ${iso.bob_state} on state, ${iso.bob_run} on runs and ${iso.bob_approve} on approve. Tools read the user from runtime.context.`,
}, f => {
  f.kicker(16, 22, 'HTTP request');
  const req = f.box({ x: 16, y: 34, w: 150, hue: 'violet', title: 'Bearer tok-bob', sub: ['thread id of alice'] });
  const gate = f.box({ x: 16, y: 118, w: 150, hue: 'amber', title: 'owned()', sub: ['threads.user_id', 'equals the caller?'] });
  f.arrow(req.bottom(), [req.cx, gate.y - 1], { style: 'call' });
  const deny = f.box({ x: 16, y: 222, w: 150, hue: 'rose', title: `${iso.bob_state}`, sub: ['thread not found', 'state, runs, approve'] });
  f.arrow(gate.bottom(), [gate.cx, deny.y - 1], { style: 'fail', label: 'no' });

  f.kicker(214, 22, 'Postgres, one pool');
  const rows = [
    ['threads', 'thread_id, user_id', 'one row per thread'],
    ['checkpoints', 'thread_id, checkpoint_id', `${per('checkpoints')} rows per run`],
    ['checkpoint_blobs', 'thread_id, channel, version', `${per('checkpoint_blobs')} rows per run`],
    ['checkpoint_writes', 'thread_id, task_id, idx', `${per('checkpoint_writes')} rows per run`],
    ['store', 'prefix memories.<user>, key', 'one row per note'],
    ['orders, refunds, tickets', 'user_id, idempotency_key', 'app tables'],
  ];
  const boxes = rows.map(([title, key, note], i) => {
    const b = f.box({ x: 214, y: 34 + i * 58, w: 230, h: 48, hue: 'teal', title, sub: [key], align: 'left' });
    f.text(452, 34 + i * 58 + 30, note, { size: 11, serif: true, hue: 'ink-soft' });
    return b;
  });
  f.arrow(gate.right(18), [boxes[0].x - 1, boxes[0].y + 22], { style: 'call', label: 'read' });
  f.text(452, 34 + 58 + 46, `${kb} KB of rows per run`, { size: 11, serif: true, hue: 'teal' });
  f.text(452, 34 + 2 * 58 + 46, 'no column names a user', { size: 11, serif: true, hue: 'rose' });

  const tool = f.box({ x: 16, y: 318, w: 150, hue: 'green', title: 'tool call', sub: ['user from', 'runtime.context'] });
  f.path(`M${tool.right()[0]} ${tool.cy} H190 V${boxes[4].cy} H${boxes[4].x - 1}`, { style: 'call' });
  f.path(`M190 ${tool.cy} V${boxes[5].cy} H${boxes[5].x - 1}`, { style: 'call' });
  f.text(196, 410, `recall_notes for bob returned ${iso.bob_recall_results.join(' ')}, and for alice ${JSON.parse(iso.alice_recall_results[0]).length} note`, { size: 11, serif: true, hue: 'ink-soft' });
});
