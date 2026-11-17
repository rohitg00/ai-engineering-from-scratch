'use strict';

const path = require('path');
const { figure, measure } = require('../../../_shared/figkit.js');
const { chart, load } = require('../../../_shared/chart.js');

const data = load(path.join(__dirname, '../../capture/lab/prodapp-mac/summary/stream-mac.json'));
const requests = data.events.filter(e => e.kind === 'request');
const runs = data.spans.filter(s => s.name === 'agent.run').sort((a, b) => a.start - b.start);
const TITLES = { 1: 'POST /runs: where is my order', 2: 'POST /runs: refund 8900 cents', 3: 'POST /approve: approve' };
const turns = requests.map(req => {
  const run = runs.find(r => r.start >= req.wall - 0.05 && r.start <= req.wall + 5);
  const inside = data.spans.filter(s => s.trace_id === run.trace_id && (s.name === 'model.call' || s.name.startsWith('tool.')));
  const events = data.events.filter(e => e.turn === req.turn && e.kind !== 'request' && e.kind !== 'state' && e.t_ms !== undefined);
  return { turn: req.turn, wall: req.wall, run, inside, events, tokens: data.token_runs[String(req.turn)] };
});
const longest = Math.max(...turns.map(t => Math.max(...t.events.map(e => e.t_ms))));
const span = Math.ceil(longest / 500) * 500;
const PANEL = 124;

module.exports = figure('fig-9-1', {
  height: 52 + turns.length * PANEL + 50,
  title: 'Three requests to the service, the spans of each run, and the SSE events',
  desc: `One conversation with Qwen3 4B on the Mac. ${turns.map(t => `Request ${t.turn} took ${Math.max(...t.events.map(e => e.t_ms)).toFixed(0)} ms, with ${t.inside.filter(s => s.name === 'model.call').length} model calls and events ${[...new Set(t.events.map(e => e.kind))].join(', ')}`).join('. ')}.`,
}, f => {
  f.rect(16, 12, 14, 10, { hue: 'plum' });
  f.text(36, 21, 'model.call', { size: 11 });
  f.rect(126, 12, 14, 10, { hue: 'green' });
  f.text(146, 21, 'tool span', { size: 11 });
  f.dot(236, 17, { hue: 'indigo', r: 3.5 });
  f.text(246, 21, 'SSE event at the client', { size: 11 });
  f.rect(420, 12, 14, 10, { hue: 'violet' });
  f.text(440, 21, 'token events', { size: 11 });
  turns.forEach((t, i) => {
    const y0 = 44 + i * PANEL;
    f.text(16, y0 + 12, `${t.turn}. ${TITLES[t.turn] || ''}`, { size: 11.5, weight: 700 });
    const c = chart(f, { x: 150, y: y0 + 22, w: 470, h: 56, xDomain: [0, span], yDomain: [0, 2], xTicks: [], yTicks: [] });
    if (i === turns.length - 1) {
      const step = span > 6000 ? 2000 : span > 3000 ? 1000 : 500;
      for (let v = 0; v <= span; v += step) {
        f.rule(c.px(v), c.py(0) + 30, c.px(v), c.py(0) + 34, { hue: 'ink' });
        f.text(c.px(v), c.py(0) + 47, String(v), { size: 11, anchor: 'middle', hue: 'ink-soft' });
      }
      f.rule(c.px(0), c.py(0) + 30, c.px(span), c.py(0) + 30, { hue: 'ink' });
    }
    f.text(16, c.py(1.5) + 4, 'server task', { size: 11, hue: 'ink-soft' });
    f.text(16, c.py(0.5) + 4, 'client stream', { size: 11, hue: 'ink-soft' });
    for (const s of t.inside) {
      const x1 = c.px(Math.max(0, (s.start - t.wall) * 1000));
      const x2 = c.px(Math.min(span, (s.end - t.wall) * 1000));
      const model = s.name === 'model.call';
      f.rect(x1, c.py(1.5) - 9, Math.max(2, x2 - x1), 18, { hue: model ? 'plum' : 'green' });
      const a = s.attributes;
      const label = `${a['gen_ai.usage.input_tokens']} in, ${a['gen_ai.usage.output_tokens']} out`;
      if (model && measure(label, 11) < x2 - x1 - 6) f.text((x1 + x2) / 2, c.py(1.5) + 4, label, { size: 11, anchor: 'middle', max: x2 - x1 - 4 });
    }
    if (t.tokens) f.rect(c.px(t.tokens.first_ms), c.py(0.5) - 5, Math.max(2, c.px(t.tokens.last_ms) - c.px(t.tokens.first_ms)), 10, { hue: 'violet' });
    const ends = [-100, -100, -100];
    for (const e of t.events.filter(e => e.kind !== 'token')) {
      const x = c.px(e.t_ms);
      const hue = e.kind === 'interrupt' ? 'amber' : 'indigo';
      f.dot(x, c.py(0.5), { hue, r: 3.5 });
      const label = e.kind === 'tool_call' ? `tool_call ${e.data.name}` : e.kind === 'tool_result' ? 'tool_result' : e.kind === 'done' ? (e.data.status === 'done' ? 'done' : `done, ${e.data.status}`) : e.kind;
      const w = measure(label, 11);
      const left = Math.max(c.px(0), Math.min(x - 2, 620 - w));
      const line = ends.findIndex(end => left > end + 6);
      if (line < 0) continue;
      f.text(left, c.py(0.5) + 22 + line * 14, label, { size: 11, hue });
      ends[line] = left + w;
    }
  });
  f.text(150 + 235, 52 + turns.length * PANEL + 40, 'milliseconds after the request was sent', { size: 11.5, anchor: 'middle', serif: true, hue: 'ink-soft' });
});
