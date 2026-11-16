'use strict';

const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const { load } = require('../../../_shared/chart.js');

const data = load(path.join(__dirname, '../../capture/lab/summary/retries-x86.json'));
const cell = data.cells['t_timeout_always tool_retry_mw'];
const arrivals = cell.ledger_rows[0];
if (!cell.ledger_rows.every(n => n === arrivals) || !cell.tool_executions.every(n => n === arrivals)) throw new Error('fig-4-7: runs differ');

const lanes = [
  { title: 'tools node', sub: 'tool call', hue: 'indigo' },
  { title: 'ToolRetry', sub: 'Middleware()', hue: 'blue' },
  { title: 'remote_action', sub: 'the tool', hue: 'green' },
  { title: 'PostgreSQL ledger', sub: 'INSERT, pg_sleep(3)', hue: 'olive' },
];
const cx = index => 80 + index * 160;

module.exports = figure('fig-4-7', {
  height: 500,
  title: 'A tool call that times out three times',
  desc: `A sequence with four lifelines: the tools node, ToolRetryMiddleware, the remote_action tool, and a ledger table in PostgreSQL. The tool inserts a row, then runs pg_sleep(3) under a statement timeout of 1 s. Each of ${arrivals} attempts writes its row, and each ends with QueryCanceled. The middleware waits 1 s, then 2 s, between attempts. After the last attempt it returns an error ToolMessage, and the ledger holds ${arrivals} rows, in each of ${cell.ledger_rows.length} runs with Qwen3 4B on the x86 server guest.`,
}, f => {
  lanes.forEach((lane, i) => {
    f.box({ x: cx(i), y: 8, w: 140, h: 40, hue: lane.hue, title: lane.title, sub: lane.sub, titleSize: 11.5, anchor: 'middle', pad: 4 });
    f.lifeline(cx(i), 48, 490);
  });
  let y = 76;
  let n = 1;
  const row = (from, to, style, label) => {
    f.step(16, y, n++, { hue: style === 'fail' ? 'rose' : undefined });
    f.arrow([cx(from), y], [cx(to) + (cx(to) > cx(from) ? -1 : 1), y], { style, label });
    y += 34;
  };
  row(0, 1, 'call', 'remote_action(item)');
  for (let a = 1; a <= arrivals; a += 1) {
    row(1, 2, 'call', `attempt ${a}`);
    row(2, 3, 'effect', `INSERT ${a}`);
    row(2, 1, 'fail', 'QueryCanceled after 1 s');
    if (a < arrivals) {
      f.text(cx(1) - 8, y - 10, `wait ${a === 1 ? 1 : 2} s`, { size: 11, hue: 'amber', anchor: 'end', knock: true });
      y += 6;
    }
  }
  row(1, 0, 'reply', 'error ToolMessage');
  f.text(cx(3), y - 4, `${arrivals} ledger rows`, { size: 12, anchor: 'middle', hue: 'rose', weight: 700, knock: true });
});
