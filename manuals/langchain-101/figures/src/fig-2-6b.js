'use strict';

const path = require('path');
const { figure, color } = require('../../../_shared/figkit.js');
const { load } = require('../../../_shared/chart.js');

const data = load(path.join(__dirname, '../../capture/lab/internals/08-costs/breakdown.json'));
const ROWS = ['none/async', 'memory/async', 'memory/sync', 'memory/exit', 'sqlite/async', 'sqlite/sync', 'sqlite/exit'];
const NAME = { none: 'no saver', memory: 'InMemorySaver', sqlite: 'SqliteSaver' };
const LOOP = ['prepare_next_tasks', 'apply_writes', 'loop._put_checkpoint', 'loop.put_writes'];
const bars = ROWS.map(key => {
  const row = data.rows[key];
  if (!row) throw new Error(`fig-2-6b: no row ${key}`);
  const [saver, mode] = key.split('/');
  const S = row.supersteps_median;
  return {
    saver: NAME[saver],
    mode,
    total: row.framework_ms_per_superstep_median,
    loop: LOOP.reduce((a, k) => a + (row[k] ? row[k].total_ms : 0), 0) / S,
    share: row.framework_share_pct_median,
    wall: row.wall_s.median,
  };
});
const lo = Math.min(...bars.map(b => b.total));
const hi = Math.max(...bars.map(b => b.total));
const shareLo = Math.min(...bars.map(b => b.share));
const shareHi = Math.max(...bars.map(b => b.share));

const X0 = 200;
const W = 320;
const MAXV = 6;
const X = v => X0 + (v / MAXV) * W;
const Y0 = 64;
const RH = 34;

module.exports = figure('fig-2-6b', {
  height: 400,
  title: 'Framework time per superstep, by saver and durability mode',
  desc: `Seven horizontal bars, one per saver and durability mode, for one create_agent run of ${data.k} tool round trips with Qwen3 4B on the x86 server guest, 22 supersteps, ${data.n} runs per row, medians. The guest was loaded, so read the share and the order of the bars, not the milliseconds. The framework time is the wall time minus the time inside the Ollama call and the tool function. Each bar gives milliseconds per superstep: ${bars.map(b => `${b.saver} ${b.mode} ${b.total.toFixed(2)}`).join(', ')}. The indigo part is the loop functions: planning, applying, building the checkpoint, and recording task writes. The grey part is the rest: node wrappers and the saver work that the loop waits for. The right column is the framework share of the wall time, ${shareLo} to ${shareHi} percent, in runs of about ${bars[0].wall.toFixed(1)} s that the model filled.`,
}, f => {
  f.kicker(20, 24, 'saver, mode');
  f.text(X0, 24, 'framework ms per superstep', { size: 11, serif: true, hue: 'ink-soft' });
  f.kicker(620, 24, 'share', { anchor: 'end' });
  f.text(620, 40, 'of wall', { size: 11, serif: true, hue: 'ink-soft', anchor: 'end' });
  for (let t = 0; t <= MAXV; t += 2) {
    f.rule(X(t), Y0 - 14, X(t), Y0 + ROWS.length * RH - 10, { hue: 'ink-mute', opacity: 0.25 });
    f.text(X(t), Y0 + ROWS.length * RH + 6, `${t} ms`, { size: 11, anchor: 'middle', hue: 'ink-soft' });
  }
  bars.forEach((b, r) => {
    const y = Y0 + r * RH;
    f.beat(r + 1);
    f.text(20, y + 4, b.saver, { size: 11.5, hue: 'teal' });
    f.text(134, y + 4, b.mode, { size: 11.5, hue: 'amber' });
    f.rect(X(0), y - 8, X(b.loop) - X(0), 14, { hue: 'indigo' });
    f.rect(X(b.loop), y - 8, X(b.total) - X(b.loop), 14, { hue: 'grey' });
    f.text(X(b.total) + 6, y + 4, `${b.total.toFixed(2)} ms`, { size: 11, hue: 'ink-soft', knock: true });
    f.text(620, y + 4, `${b.share.toFixed(3)} %`, { size: 11.5, anchor: 'end', weight: 700, hue: 'ink' });
  });
  f.beat(0);
  const ky = Y0 + ROWS.length * RH + 40;
  f.rect(20, ky - 11, 22, 14, { hue: 'indigo' });
  f.text(48, ky, 'loop: plan, apply, checkpoint, task writes', { size: 11, serif: true, hue: 'ink-soft' });
  f.rect(20, ky + 11, 22, 14, { hue: 'grey' });
  f.text(48, ky + 22, 'rest: node wrappers, saver waits on the loop', { size: 11, serif: true, hue: 'ink-soft' });
  f.text(20, ky + 50, `the model filled the other ${(100 - shareHi).toFixed(2)} percent or more of each ${bars[0].wall.toFixed(1)} s run`, { size: 11, hue: 'plum' });
});
