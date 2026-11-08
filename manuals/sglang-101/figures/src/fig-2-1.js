'use strict';

const { figure } = require('../../../_shared/figkit.js');

module.exports = figure('fig-2-1', {
  height: 420,
  title: 'The three processes of one SGLang server',
  desc: 'A client sends POST /generate to the main process, pid 5782, which holds the HTTP server and the TokenizerManager. A TokenizedGenerateReqInput goes over ZMQ to scheduler_0, pid 5909, which runs the MLX model. A BatchTokenIDOutput goes to the detokenizer, which sends a BatchStrOutput back to the main process, and the main process answers the client.',
}, f => {
  const client = f.box({ x: 20, y: 16, w: 170, h: 40, hue: 'olive', title: 'client', sub: ['curl or the benchmark'] });
  const main = f.box({ x: 20, y: 90, w: 170, h: 80, hue: 'blue', title: 'main · pid 5782', sub: ['HTTP server', 'TokenizerManager'] });
  const sched = f.box({ x: 235, y: 90, w: 190, h: 80, hue: 'blue', title: 'scheduler_0 · pid 5909', titleSize: 12, sub: ['queue and batches', 'KV pool and radix tree'] });
  const detok = f.box({ x: 470, y: 90, w: 150, h: 80, hue: 'blue', title: 'detokenizer', sub: ['token ids to text'] });
  const model = f.box({ x: 235, y: 214, w: 190, h: 48, hue: 'violet', title: 'MLX model', sub: ['Qwen3-0.6B-4bit'] });

  f.arrow([70, client.y + client.h], [70, main.y - 1], { style: 'call' });
  f.step(52, 73, 1);
  f.arrow([main.x + main.w, 115], [sched.x - 1, 115], { style: 'event' });
  f.step(212, 101, 2);
  f.arrow([330, sched.y + sched.h], [330, model.y - 1], { style: 'model' });
  f.step(348, 192, 3);
  f.arrow([sched.x + sched.w, 115], [detok.x - 1, 115], { style: 'event' });
  f.step(447, 101, 4);
  f.path(`M545 ${detok.y + detok.h} L545 300 L105 300 L105 ${main.y + main.h + 1}`, { style: 'event' });
  f.step(470, 286, 5);
  f.arrow([150, main.y - 1], [150, client.y + client.h + 1], { style: 'reply' });
  f.step(168, 73, 6);

  f.kicker(20, 340, 'the numbered steps');
  const key = [
    ['POST /generate over HTTP', 20, 362],
    ['TokenizedGenerateReqInput over ZMQ', 20, 384],
    ['forward pass and sampling', 20, 406],
    ['BatchTokenIDOutput over ZMQ', 330, 362],
    ['BatchStrOutput over ZMQ', 330, 384],
    ['HTTP response with the text', 330, 406],
  ];
  key.forEach(([label, x, y], index) => {
    f.step(x + 9, y - 4, index + 1);
    f.text(x + 26, y, label, { size: 11, serif: true, hue: 'ink-soft' });
  });
});
