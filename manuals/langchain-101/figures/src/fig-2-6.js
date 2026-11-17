'use strict';

const path = require('path');
const { figure, color } = require('../../../_shared/figkit.js');
const { chart, load } = require('../../../_shared/chart.js');

const data = load(path.join(__dirname, '../../capture/lab/internals/09-growth/growth.json'));
const plainRow = data.rows.sqlite;
const deltaRow = data.rows['sqlite-delta'];
const plain = plainRow.row_bytes;
const delta = deltaRow.row_bytes;
if (plain.length !== delta.length) throw new Error('fig-2-6: the two runs have different row counts');
const snapshots = delta.map((b, i) => [i, b]).filter(([, b]) => b > 10 * Math.min(...delta.slice(1)));
const typical = [...delta].sort((a, b) => a - b)[Math.floor(delta.length / 2)];
const mb = v => `${(v / 1e6).toFixed(2)} MB`;
const thread = r => Number(r.checkpoint_bytes_total) + Number(r.writes_bytes);
const ratio = thread(plainRow) / thread(deltaRow);

module.exports = figure('fig-2-6', {
  height: 380,
  title: 'Bytes of each checkpoint row, plain messages against DeltaChannel',
  desc: `Bytes of every row of the SqliteSaver checkpoints table, in order, for one create_agent run of ${plainRow.tool_round_trips} real tool round trips with Qwen3 4B on the x86 server guest, once with the plain add_messages channel and once with a state_schema whose messages use DeltaChannel. Each dot is one row, ${plain.length} rows per run. The plain rows grow in a straight line from ${plain[1]} to ${plain[plain.length - 1]} bytes, ${plainRow.checkpoint_bytes_total} bytes in all. The DeltaChannel rows stay near ${typical} bytes, except ${snapshots.length} snapshot rows at positions ${snapshots.map(s => s[0]).join(' and ')} of ${snapshots.map(s => s[1]).join(' and ')} bytes, ${deltaRow.checkpoint_bytes_total} bytes in all. With the writes table, the plain thread holds ${ratio.toFixed(1)} times the bytes of the DeltaChannel thread.`,
}, f => {
  const c = chart(f, { x: 70, y: 44, w: 420, h: 250, xDomain: [0, 210], yDomain: [0, 100000], xTicks: [0, 50, 100, 150, 200], yTicks: [0, 20000, 40000, 60000, 80000, 100000], yFormat: v => `${v / 1000} KB`, xLabel: 'checkpoint row, in order', yLabel: 'bytes of the row' });
  f.beat(1);
  plain.forEach((b, i) => f.dot(c.px(i), c.py(b), { hue: 'teal', r: 1.5 }));
  f.beat(2);
  delta.forEach((b, i) => f.dot(c.px(i), c.py(b), { hue: 'indigo', r: 1.5 }));
  f.beat(3);
  const last = plain.length - 1;
  f.text(c.px(last) + 12, c.py(plain[last]) + 16, 'plain messages', { size: 11.5, weight: 700, hue: 'teal' });
  f.text(c.px(last) + 12, c.py(plain[last]) + 31, `${mb(Number(plainRow.checkpoint_bytes_total))} in all`, { size: 11, serif: true, hue: 'ink-soft' });
  f.text(c.px(last) + 12, c.py(typical) - 30, 'DeltaChannel', { size: 11.5, weight: 700, hue: 'indigo' });
  f.text(c.px(last) + 12, c.py(typical) - 15, `${mb(Number(deltaRow.checkpoint_bytes_total))} in all`, { size: 11, serif: true, hue: 'ink-soft' });
  const lx = c.px(64);
  const ly = c.py(13000);
  f.text(lx, ly, 'DeltaChannel snapshot rows', { size: 11, hue: 'indigo' });
  f.text(lx, ly + 15, 'one per 100 updates', { size: 11, serif: true, hue: 'ink-soft' });
  snapshots.forEach(([i, b]) => {
    f.emit(`<circle cx="${c.px(i).toFixed(1)}" cy="${c.py(b).toFixed(1)}" r="4" fill="none" stroke="${color('indigo-ink')}" stroke-width="1.5"/>`);
    f.leader([lx + 40, ly - 12], [c.px(i) + (i > 150 ? -2 : 3), c.py(b) + 4], { hue: 'indigo' });
  });
  f.beat(0);
  f.text(70, 356, `whole thread with writes: ${mb(thread(plainRow))} plain, ${mb(thread(deltaRow))} DeltaChannel, ${ratio.toFixed(1)} times less`, { size: 11, serif: true, hue: 'ink-soft' });
});
