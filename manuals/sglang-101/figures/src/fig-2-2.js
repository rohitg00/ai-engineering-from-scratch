'use strict';

const { figure } = require('../../../_shared/figkit.js');

module.exports = figure('fig-2-2', {
  height: 400,
  title: 'One turn of the scheduler loop',
  desc: 'ingest_requests drains new requests, calc_priority orders the waiting queue with the fcfs default, PrefillAdder.add_one_req admits requests while the KV budget allows. If anything is admitted the turn runs a prefill batch, otherwise one decode step for every running request. process_batch_result then appends tokens and checks stops, and the next turn starts.',
}, f => {
  f.beat(1);
  const ingest = f.box({ x: 100, y: 16, w: 300, h: 48, hue: 'amber', title: 'ingest_requests', sub: ['drain ZMQ, add to the waiting queue'] });
  f.beat(2);
  f.arrow([250, 64], [250, 85], { style: 'state' });
  const order = f.box({ x: 100, y: 86, w: 300, h: 48, hue: 'amber', title: 'calc_priority', sub: ['order the queue: fcfs by default'] });
  f.beat(3);
  f.arrow([250, order.y + order.h], [250, 155], { style: 'state' });
  const adder = f.box({ x: 100, y: 156, w: 300, h: 48, hue: 'green', title: 'PrefillAdder.add_one_req', sub: ['admit while the KV budget allows'] });
  f.beat(4);
  f.arrow([170, adder.y + adder.h], [170, 247], { style: 'model', label: 'admitted' });
  f.arrow([340, adder.y + adder.h], [340, 247], { style: 'model', label: 'nothing admitted' });
  const prefill = f.box({ x: 20, y: 248, w: 250, h: 48, hue: 'plum', title: 'prefill batch', sub: ['EXTEND forward of admitted requests'] });
  const decode = f.box({ x: 300, y: 248, w: 300, h: 48, hue: 'plum', title: 'decode step', sub: ['one token for every running request'] });
  f.beat(5);
  f.arrow([170, prefill.y + prefill.h], [170, 335], { style: 'call' });
  f.arrow([340, decode.y + decode.h], [340, 335], { style: 'call' });
  const done = f.box({ x: 100, y: 336, w: 300, h: 48, hue: 'amber', title: 'process_batch_result', sub: ['append tokens, check stops, send results'] });
  f.beat(6);
  f.path(`M${done.x + done.w} 360 L620 360 L620 40 L${ingest.x + ingest.w + 1} 40`, { style: 'state' });
  f.text(520, 33, 'next turn', { size: 11, hue: 'amber', anchor: 'middle', knock: true });
});
