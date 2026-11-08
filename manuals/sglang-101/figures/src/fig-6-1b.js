'use strict';

const { figure } = require('../../../_shared/figkit.js');

module.exports = figure('fig-6-1b', {
  height: 300,
  title: 'Two data parallel copies of one model',
  desc: 'A data parallel controller receives requests and gives them to two model worlds in turn, because load-balance-method auto resolves to round_robin outside prefill-decode disaggregation. World 0 uses GPUs g0 to g3 and world 1 uses g4 to g7, and each world has its own scheduler and its own KV cache.',
}, f => {
  const controller = f.box({ x: 170, y: 20, w: 300, h: 48, hue: 'blue', title: 'data parallel controller', sub: ['--load-balance-method auto: round_robin'] });
  const worlds = [
    { x: 20, name: 'world 0 · --tp-size 4', first: 0, reqs: 'requests 1, 3, 5' },
    { x: 340, name: 'world 1 · --tp-size 4', first: 4, reqs: 'requests 2, 4, 6' },
  ];
  for (const world of worlds) {
    f.rect(world.x, 150, 280, 136, { hue: 'blue' });
    f.text(world.x + 12, 170, world.name, { size: 12, weight: 700, hue: 'blue' });
    for (let i = 0; i < 4; i += 1) {
      f.box({ x: world.x + 12 + i * 66, y: 182, w: 58, h: 26, hue: 'grey', title: `g${world.first + i}`, titleSize: 12 });
    }
    f.box({ x: world.x + 12, y: 220, w: 256, h: 50, hue: 'green', title: 'its own KV cache', sub: ['the other world never sees it'] });
  }
  f.arrow([controller.x + 60, controller.y + controller.h], [160, 149], { style: 'call', label: worlds[0].reqs });
  f.arrow([controller.x + 240, controller.y + controller.h], [480, 149], { style: 'call', label: worlds[1].reqs });
});
