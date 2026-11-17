'use strict';

const path = require('path');
const { figure, color } = require('../../../_shared/figkit.js');
const { chart, load } = require('../../../_shared/chart.js');

const data = load(path.join(__dirname, '../../capture/lab/summary/long-threads-x86-real.json'));
const variants = [
  { key: 'none', hue: 'plum', name: 'no summarization' },
  { key: 'tok6000_keep1500', hue: 'blue', name: '6,000 tokens, keep 1,500' },
  { key: 'msgs60_keep7', hue: 'teal', name: '60 messages, keep 7' },
  { key: 'msgs20_keep1', hue: 'green', name: '20 messages, keep 1' },
];
const v = key => data.variants[key];
const s = ms => ms / 1000;
const mid = block => { const [a, b] = block.turns.split('-').map(Number); return (a + b) / 2; };
const medians = key => v(key).blocks.map(block => s(block.turn_p50_ms));
const triggered = variants.filter(variant => variant.key !== 'none');
const low = Math.min(...triggered.flatMap(variant => medians(variant.key)));
const high = Math.max(...triggered.flatMap(variant => medians(variant.key)));
const full = v('none').full_context_turns;
const slow = full.map(turn => turn.turn_s);

module.exports = figure('fig-5-5', {
  height: 380,
  title: 'Turn time over 200 turns on Qwen3 4B, with and without summarization',
  desc: `A dot chart of the median turn time of each block of 25 turns, on a log scale from 1 to 1,000 seconds, for one run per variant on the x86 server guest. Without summarization the median grows from ${s(v('none').blocks[0].turn_p50_ms).toFixed(1)} s to ${s(v('none').blocks[v('none').blocks.length - 1].turn_p50_ms).toFixed(1)} s, and the run stops after turn ${v('none').turns}. Open rings mark its turns ${full[0].turn} to ${full[full.length - 1].turn}, after the prompt reached ${v('none').prompt_tokens_max.toLocaleString('en-US')} tokens, which took ${Math.min(...slow).toFixed(0)} to ${Math.max(...slow).toFixed(0)} s each. With a trigger, every block median stays between ${low.toFixed(1)} and ${high.toFixed(1)} s over 200 turns. A shaded band behind each line spans the 10th to the 90th percentile of the turns in each block, and its top holds the turns with a summary call.`,
}, f => {
  const c = chart(f, { x: 70, y: 40, w: 380, h: 250, yScale: 'log10', xDomain: [0, 200], yDomain: [1, 1000], xTicks: [0, 25, 50, 75, 100, 125, 150, 175, 200], yTicks: [1, 3, 10, 30, 100, 300, 1000], yLabel: 'median turn, seconds', xLabel: 'turn number', yFormat: t => String(t) });
  variants.forEach(variant => c.band(v(variant.key).blocks.map(block => [mid(block), s(block.turn_p10_ms)]), v(variant.key).blocks.map(block => [mid(block), s(block.turn_p90_ms)]), { hue: variant.hue, opacity: 0.12 }));
  const ends = [];
  variants.forEach(variant => {
    const points = v(variant.key).blocks.map(block => [mid(block), s(block.turn_p50_ms)]);
    c.series(points, { hue: variant.hue, r: 2.8 });
    if (variant.key !== 'none') ends.push({ ...variant, y: c.py(points[points.length - 1][1]) });
  });
  full.forEach(turn => f.emit(`<circle cx="${c.px(turn.turn).toFixed(1)}" cy="${c.py(turn.turn_s).toFixed(1)}" r="3.2" fill="${color('paper')}" stroke="${color('plum-ink')}" stroke-width="1.4"/>`));
  f.text(c.px(full[full.length - 1].turn) + 10, c.py(Math.max(...slow)) + 4, `no summarization, turns ${full[0].turn} to ${full[full.length - 1].turn}`, { size: 11, hue: 'plum', knock: true });
  f.text(c.px(full[full.length - 1].turn) + 10, c.py(Math.max(...slow)) + 18, `context full, run stopped`, { size: 11, hue: 'plum', knock: true });
  ends.sort((a, b) => a.y - b.y);
  for (let i = 1; i < ends.length; i += 1) if (ends[i].y - ends[i - 1].y < 14) ends[i].y = ends[i - 1].y + 14;
  ends.forEach(end => f.text(c.px(200) + 10, end.y + 4, end.name, { size: 11, hue: end.hue }));
  f.text(20, 340, 'One run per variant on PostgresSaver with Qwen3 4B on CPU. Each dot is the median of 25 turns,', { size: 11, serif: true, hue: 'ink-soft' });
  f.text(20, 356, 'and each open ring is one turn. The band spans the 10th to the 90th percentile of each block.', { size: 11, serif: true, hue: 'ink-soft' });
});
