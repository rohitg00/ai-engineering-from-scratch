'use strict';

const path = require('path');
const { figure, color } = require('../../../_shared/figkit.js');
const { load } = require('../../../_shared/chart.js');

const data = load(path.join(__dirname, '../../capture/lab/internals/05-streaming/v3_38484.json'));
const LABEL = { reasoning_then_text: 'reasoning, then text', text_only: 'text only', raw_events: 'raw events' };
const order = ['text_only', 'raw_events', 'reasoning_then_text'].map(name => {
  const run = data.runs[name][0];
  const sent = run.series.emit.filter(e => e[1] === 'text').map(e => e[0] / 1000);
  const got = run.series.receive.filter(e => e[1] === 'text').map(e => e[0] / 1000);
  if (sent.length !== got.length) throw new Error(`fig-2-5b: ${name} lost deltas`);
  return { name, sent, got, reasoningEnd: run.reasoning_emit_ms[1] / 1000, summary: data.summary[name] };
});
const buffered = order[2];
const lagMax = p => Math.max(...p.got.map((g, i) => g - p.sent[i])) * 1000;
const firstLags = buffered.summary['first text delta lag ms per run'];
const allMax = order.slice(0, 2).map(p => p.summary['text lag ms median, p90, max (all deltas)'][2]);

const T0 = 30;
const T1 = 42.5;
const X0 = 176;
const PX = (612 - X0) / (T1 - T0);
const X = t => X0 + (t - T0) * PX;
const s1 = v => v.toFixed(1);

module.exports = figure('fig-2-5b', {
  height: 432,
  title: 'Text deltas sent and received under three v3 consumer loops',
  desc: `Three pairs of rows on a time axis in seconds, run 0 of five per consumer loop over stream_events version v3 of one create_agent run. The model is Qwen3 8B with reasoning on, on Ollama on the x86 server guest. It sent about 211 reasoning deltas from the first second to about ${s1(buffered.reasoningEnd)} s, then 60 text deltas over about 8.6 s. The upper row of each pair marks when each text delta was sent, and the lower row when the loop got it. The text-only and raw-events loops got each delta within a few milliseconds; over all five runs their largest lags were ${allMax[0]} and ${allMax[1]} ms. The loop that reads message.reasoning first got all 60 text deltas at ${s1(buffered.got[0])} s, up to ${s1(lagMax(buffered))} ms after the send. Over five runs its first text delta was ${Math.min(...firstLags)} to ${Math.max(...firstLags)} ms late.`,
}, f => {
  f.kicker(20, 26, 'consumer loop');
  order.forEach((p, k) => {
    const y = 64 + k * 92;
    f.beat(k + 1);
    const hue = p === buffered ? 'rose' : 'indigo';
    f.text(20, y + 10, LABEL[p.name], { size: 12, weight: 700, hue });
    f.text(20, y + 26, 'sent', { size: 11, serif: true, hue: 'olive' });
    f.text(20, y + 50, 'got', { size: 11, serif: true, hue });
    f.rule(X0, y + 22, 612, y + 22, { hue: 'ink-mute', opacity: 0.3 });
    f.rule(X0, y + 46, 612, y + 46, { hue: 'ink-mute', opacity: 0.3 });
    const ticks = (ts, top) => ts.map(t => `M${X(t).toFixed(1)} ${top}v14`).join('');
    f.path(ticks(p.sent, y + 15), { hue: 'olive', width: 1, head: false, packet: false });
    f.path(ticks(p.got, y + 39), { hue, width: 1, head: false, packet: false });
    if (p === buffered) {
      const a = X(p.sent[0]);
      const b = X(p.got[0]) - 4;
      f.rect(a, y + 60, b - a, 8, { fill: color('rose-fill'), stroke: color('rose-ink'), dash: 'dashed' });
      f.text((a + b) / 2, y + 84, `all 60 deltas wait in the message.text list, up to ${s1(lagMax(p) / 1000)} s`, { size: 11, anchor: 'middle', hue: 'rose' });
    } else {
      f.text(612, y + 72, `largest lag ${lagMax(p).toFixed(1)} ms in this run`, { size: 11, anchor: 'end', serif: true, hue: 'ink-soft' });
    }
  });
  const axisY = 64 + 3 * 92 + 4;
  for (let t = 30; t <= 42; t += 2) {
    f.rule(X(t), axisY, X(t), axisY + 4, { hue: 'ink' });
    f.text(X(t), axisY + 18, String(t), { size: 11, anchor: 'middle', hue: 'ink-soft' });
  }
  f.text(X0 - 24, axisY + 18, 's', { size: 11, anchor: 'end', hue: 'ink-soft' });
  f.beat(0);
  f.text(20, axisY + 44, `reasoning streamed live before ${s1(buffered.reasoningEnd)} s and is not drawn`, { size: 11, serif: true, hue: 'ink-soft' });
  f.text(20, axisY + 66, `first text delta late by ${(Math.min(...firstLags) / 1000).toFixed(2)} to ${(Math.max(...firstLags) / 1000).toFixed(2)} s in 5 of 5 runs`, { size: 11.5, weight: 700, hue: 'rose' });
});
