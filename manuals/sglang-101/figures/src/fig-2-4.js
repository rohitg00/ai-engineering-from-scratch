'use strict';

const { figure } = require('../../../_shared/figkit.js');

function lane(f, y, label) {
  f.kicker(20, y + 15, label);
}

function step(f, x, y, n) {
  f.rect(x, y, 100, 22, { hue: 'plum' });
  f.text(x + 50, y + 15, `step ${n}`, { size: 11, anchor: 'middle' });
}

module.exports = figure('fig-2-4', {
  height: 262,
  title: 'The same three decode steps without and with overlap',
  desc: 'Two timelines with a GPU lane and a CPU lane. Without overlap, each GPU step is followed by a hatched gap while the CPU processes its results, and three steps end at 500. With overlap, the GPU runs steps back to back while the CPU processes the previous step under the next one, and both lanes finish three steps at 420.',
}, f => {
  f.kicker(80, 22, 'without overlap: event_loop_normal');
  lane(f, 32, 'GPU');
  lane(f, 64, 'CPU');
  f.kicker(80, 140, 'with overlap: event_loop_overlap');
  lane(f, 150, 'GPU');
  lane(f, 182, 'CPU');
  f.arrow([80, 246], [600, 246], { style: 'call' });
  f.text(608, 250, 't', { size: 11, hue: 'ink-soft' });

  for (let i = 0; i < 3; i += 1) {
    const x = 80 + i * 140;
    f.beat(i + 1);
    step(f, x, 32, i + 1);
    f.rect(x + 100, 64, 40, 22, { hue: 'blue' });
    if (i < 2) f.hatchRect(x + 100, 32, 40, 22);
  }
  f.beat(4);
  f.text(510, 48, 'three steps by 500', { size: 11, serif: true, hue: 'ink-soft' });
  f.text(200, 112, 'the GPU waits for the CPU', { size: 11, serif: true, hue: 'ink-soft' });

  for (let i = 0; i < 3; i += 1) {
    f.beat(5 + i);
    step(f, 80 + i * 100, 150, i + 1);
    f.rect(180 + i * 100, 182, 40, 22, { hue: 'blue' });
  }
  f.beat(8);
  f.text(430, 166, 'three steps by 420', { size: 11, serif: true, hue: 'ink-soft' });
  f.text(200, 222, 'the CPU processes step N under step N+1', { size: 11, serif: true, hue: 'ink-soft' });
});
