'use strict';

const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const { chart, load } = require('../../../_shared/chart.js');

const data = load(path.join(__dirname, '../../capture/lab/summary/streaming-mac.json'));
const text = data.phases.text.variants;
const rows = [
  ['plain_openai', 'plain openai loop', 'grey'],
  ['chatopenai_stream', 'ChatOpenAI.stream', 'blue'],
  ['agent_messages', 'messages mode', 'indigo'],
  ['agent_messages_updates', 'messages and updates', 'indigo'],
  ['astream_events_v2', 'astream_events v2', 'indigo'],
  ['stream_events_v3', 'v3, docs loop', 'indigo'],
  ['stream_events_v3_raw', 'v3, raw events', 'indigo'],
  ['astream_events_v3', 'async v3, text loop', 'indigo'],
  ['astream_events_v3_gather', 'async v3, reasoning first', 'rose'],
];
const fmt = v => (v >= 100 ? String(Math.round(v)) : String(v));

module.exports = figure('fig-4-1c', {
  height: 420,
  title: 'First-token delivery delay of each run, by stream API',
  desc: `A dot chart on a log scale of the time between the stub sending the first token and the consumer seeing it, on the Mac, ${text.plain_openai.n} runs per API. Medians: plain openai ${text.plain_openai.first_delay_ms_median} ms, ChatOpenAI ${text.chatopenai_stream.first_delay_ms_median} ms, messages mode ${text.agent_messages.first_delay_ms_median} ms, v3 docs loop ${text.stream_events_v3.first_delay_ms_median} ms, and the async v3 consumer that reads reasoning first ${text.astream_events_v3_gather.first_delay_ms_median} ms.`,
}, f => {
  const c = chart(f, { x: 196, y: 40, w: 352, h: 288, xScale: 'log10', yDomain: [0, 9], xDomain: [0.1, 2000], xTicks: [0.1, 1, 10, 100, 1000], xFormat: String, xLabel: 'milliseconds from send to the consumer, log scale' });
  f.text(20, 28, 'stream API', { size: 11.5, serif: true, hue: 'ink-soft' });
  f.text(630, 28, 'median', { size: 11.5, serif: true, hue: 'ink-soft', anchor: 'end' });
  rows.forEach(([key, label, hue], i) => {
    const cy = c.py(8.5 - i);
    const entry = text[key];
    const d = entry.first_delay_ms.map((v, j) => `M${Math.round(c.px(v)) - 2} ${Math.round(cy + ((j * 37) % 13 - 6) * 1.4)}a2 2 0 1 0 4 0a2 2 0 1 0-4 0`).join('');
    f.mark(d, { hue });
    const mx = c.px(entry.first_delay_ms_median);
    f.rule(mx, cy - 13, mx, cy + 13, { hue: 'ink', width: 2 });
    f.text(20, cy + 4, label, { size: 11, hue: hue === 'rose' ? 'rose' : 'ink' });
    f.text(630, cy + 4, `${fmt(entry.first_delay_ms_median)} ms`, { size: 11, hue: hue === 'rose' ? 'rose' : 'ink', anchor: 'end', weight: 700 });
  });
  f.text(20, 392, `Each dot is one run of 40 tokens from the stub, ${text.plain_openai.n} runs per API. The tall tick is the median.`, { size: 11, serif: true, hue: 'ink-soft' });
  f.text(20, 408, 'The rose row loops over message.reasoning before message.text, so the text waits for the end.', { size: 11, serif: true, hue: 'ink-soft' });
});
