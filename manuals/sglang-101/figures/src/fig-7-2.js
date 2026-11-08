'use strict';

const { figure } = require('../../../_shared/figkit.js');

const trainer = 110;
const server = 500;
const rows = [
  ['call', 'POST /pause_generation', 'mode retract: running requests return to the queue'],
  ['call', 'POST /begin_weight_update', 'layers prepared for checkpoint-format writes'],
  ['call', 'POST /update_weights_from_distributed', 'one bucket: names, dtypes, and shapes'],
  ['event', 'NCCL broadcast from rank 0', 'repeat rows 3 and 4 for every bucket'],
  ['call', 'POST /end_weight_update', 'quantized layers repacked once'],
  ['call', 'POST /update_weight_version', 'later tokens carry the new version'],
  ['call', 'POST /continue_generation', 'retracted requests prefill again'],
];

module.exports = figure('fig-7-2', {
  height: 400,
  title: 'One weight update between Miles and SGLang',
  desc: 'Miles rank 0 pauses SGLang in retract mode, opens a weight-update session, sends each bucket as an HTTP description followed by an NCCL broadcast, closes the session so quantized layers are repacked once, sets the new weight version, and resumes generation.',
}, f => {
  f.box({ x: trainer, y: 10, w: 150, h: 30, hue: 'grey', title: 'Miles rank 0', titleSize: 12, anchor: 'middle' });
  f.box({ x: server, y: 10, w: 150, h: 30, hue: 'blue', title: 'SGLang server', titleSize: 12, anchor: 'middle' });
  f.lifeline(trainer, 40, 390);
  f.lifeline(server, 40, 390);
  rows.forEach(([style, label, note], index) => {
    const y = 78 + index * 44;
    f.beat(index + 1);
    f.step(24, y, index + 1, { hue: style === 'event' ? 'indigo' : 'ink' });
    f.arrow([trainer, y], [server - 1, y], { style, label, note, labelX: (trainer + server) / 2 });
  });
});
