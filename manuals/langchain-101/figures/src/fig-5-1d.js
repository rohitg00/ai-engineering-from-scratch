'use strict';

const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const { chart, load } = require('../../../_shared/chart.js');

const data = load(path.join(__dirname, '../../capture/lab/summary/streaming-mac-real.json'));
const live = data.timeline.astream_events_v3;
const batched = data.timeline.astream_events_v3_gather;
const last = run => run.tokens[run.tokens.length - 1];
const tracks = [
  [live, 0, 'model sends', 'olive', 'text loop only'],
  [live, 1, 'consumer sees', 'indigo', ''],
  [batched, 0, 'model sends', 'olive', 'reasoning loop, then text'],
  [batched, 1, 'consumer sees', 'rose', ''],
];

module.exports = figure('fig-5-1d', {
  height: 330,
  title: 'When each token was sent and seen, in two async v3 consumers',
  desc: `A timeline of one run of each consumer on the Mac, with ${live.tokens.length} tokens of Qwen3 4B. In the text loop, each token is seen within a few milliseconds of the send, from ${live.tokens[0][1]} ms to ${last(live)[1]} ms after the run starts. In the loop that reads reasoning first, the model sends from ${batched.tokens[0][0]} ms to ${last(batched)[0]} ms, and the consumer sees all ${batched.tokens.length} tokens at ${batched.tokens[0][1]} to ${last(batched)[1]} ms.`,
}, f => {
  const c = chart(f, { x: 214, y: 44, w: 396, h: 200, xDomain: [0, 4500], yDomain: [0, 4], xTicks: [0, 1000, 2000, 3000, 4000], xFormat: String, xLabel: 'milliseconds since the run started' });
  tracks.forEach(([run, column, label, hue, group], i) => {
    const cy = c.py(3.5 - i);
    if (group) f.text(20, cy - 18, group, { size: 11.5, weight: 700, hue: 'ink' });
    f.text(20, cy + 4, label, { size: 11, hue: 'ink-soft' });
    const d = run.tokens.map(token => `M${(c.px(token[column]) - 1).toFixed(1)} ${cy - 10}h2v20h-2z`).join('');
    f.mark(d, { hue });
  });
  const seen = batched.tokens[0][1];
  f.text(c.px(seen) - 8, c.py(0.5) + 4, `all ${batched.tokens.length} at ${Math.round(seen)} ms`, { size: 11, hue: 'rose', anchor: 'end', weight: 700, knock: true });
  f.text(20, 298, `Each tick is one of ${live.tokens.length} tokens in one run. Olive ticks are sends by Qwen3 4B on Ollama.`, { size: 11, serif: true, hue: 'ink-soft' });
  f.text(20, 314, 'The others are the moments the consumer saw a token. The lower loop sees text at the end.', { size: 11, serif: true, hue: 'ink-soft' });
});
