'use strict';

const { figure } = require('../../../_shared/figkit.js');

const NODE = 121.69;
const parts = [
  { gb: 36.77, hue: 'blue', title: 'trainer process', sub: '36.8 GB' },
  { gb: 2.73 + 1.33, hue: 'violet', title: 'engine', sub: '4.1 GB' },
  { gb: 115.86 - 36.77 - 2.73 - 1.33, hue: 'grey', title: 'the rest of the used memory', sub: '75.0 GB' },
  { gb: NODE - 115.86, hue: 'green', title: 'free', sub: '5.8 GB' },
];

module.exports = figure('fig-2-3', {
  height: 300,
  title: 'Ray reads one memory for the whole GB10',
  desc: 'The memory Ray read when it stopped the first 4B run, as one bar of 121.69 GB. The trainer process used 36.77 GB and the engine processes 4.06 GB. The rest of the 115.86 GB in use was not in the process list. Our reading is that most of it is GPU allocations. 5.83 GB was free.',
}, f => {
  const x0 = 20;
  const w = 600;
  const scale = w / NODE;
  let x = x0;
  f.kicker(20, 30, 'node memory when Ray stopped the trainer, 121.7 GB');
  parts.forEach((p, i) => {
    const pw = p.gb * scale;
    f.rect(x, 48, pw, 56, { hue: p.hue, dash: p.hue === 'green' ? 'dashed' : undefined });
    const labelY = i % 2 ? 154 : 132;
    f.leader([x + pw / 2, 104], [x + pw / 2, labelY - 13]);
    f.text(Math.min(Math.max(x + pw / 2, 70), 570), labelY, `${p.title}, ${p.sub}`, { size: 11.5, anchor: 'middle', hue: p.hue === 'grey' ? 'ink-soft' : p.hue });
    x += pw;
  });
  const limit = x0 + 0.95 * NODE * scale;
  f.line(limit, 40, limit, 112, { style: 'fail', head: false, packet: false });
  f.text(limit - 4, 40, 'kill above 95 percent', { size: 11, anchor: 'end', hue: 'rose' });
  f.text(20, 210, 'On a GB10 the GPU and the CPU share this memory.', { size: 12, serif: true });
  f.text(20, 234, 'Our reading: GPU allocations count as used memory, so a Ray kill is real.', { size: 12, serif: true });
  f.text(20, 270, 'Process sizes are the resident memory that Ray listed for its top processes.', { size: 11, serif: true, hue: 'ink-soft' });
});
