'use strict';

const { figure, color } = require('../../../_shared/figkit.js');

module.exports = figure('fig-4-1', {
  height: 346,
  title: 'From a WorkerPool to two registered workers',
  desc: 'The WorkerPool ballast in namespace lab-c asks for two replicas with a limit of 2 CPUs and 3 GiB. ate-controller reads it, writes a Deployment, and creates one Worker record in ate-api-server for each pod. atelet on the node registers each worker, and the record becomes WORKER_STATE_ACTIVE. Each of the two worker pods then reports 2 of 1000 actors, 2000 of 2000 millicores and 512Mi of 3008Mi.',
}, f => {
  f.kicker(20, 18, 'You write');
  f.kicker(260, 18, 'Substrate reconciles');
  const pool = f.box({ x: 20, y: 28, w: 170, h: 62, hue: 'grey', pad: 8, title: 'WorkerPool ballast', sub: ['replicas: 2', 'limits: cpu 2, memory 3Gi'] });
  const ctrl = f.box({ x: 260, y: 28, w: 140, h: 62, hue: 'blue', title: 'ate-controller', sub: 'one replica' });
  const api = f.box({ x: 470, y: 28, w: 150, h: 62, hue: 'blue', title: 'ate-api-server', sub: ['Worker b17a6492', 'Worker ee4ba8b4'] });
  f.arrow(pool.right(), [ctrl.x - 1, pool.cy], { style: 'call', label: '1 reads' });
  f.arrow(ctrl.right(), [api.x - 1, ctrl.cy], { style: 'write', label: '2 creates' });

  const dep = f.box({ x: 240, y: 128, w: 180, h: 44, hue: 'grey', title: 'Deployment ballast', sub: 'label ate.dev/worker-pool' });
  f.arrow(ctrl.bottom(), [ctrl.cx, dep.y - 1], { style: 'call', label: '1 writes' });

  f.rect(20, 212, 600, 122, { fill: 'none', stroke: color('grey-ink'), dash: 'dashed' });
  f.kicker(32, 230, 'One node');
  const p1 = f.box({ x: 32, y: 240, w: 186, h: 82, hue: 'violet', title: 'worker pod bzgjd', sub: ['ACTORS 2/1000', 'CPU 2000/2000', 'MEMORY 512Mi/3008Mi'] });
  const p2 = f.box({ x: 230, y: 240, w: 186, h: 82, hue: 'violet', title: 'worker pod f65dl', sub: ['ACTORS 2/1000', 'CPU 2000/2000', 'MEMORY 512Mi/3008Mi'] });
  const atelet = f.box({ x: 458, y: 248, w: 150, h: 66, hue: 'violet', title: 'atelet', sub: ['registers each worker', 'reports its runtimes'] });
  f.path(`M${dep.x} ${dep.cy} H${p1.cx} V${p1.y - 1}`, { style: 'call' });
  f.arrow([p2.cx, dep.y + dep.h], [p2.cx, p2.y - 1], { style: 'call' });
  f.text(p2.cx + 8, 196, 'two pods', { size: 11, serif: true, hue: 'ink-soft', knock: true });
  f.arrow([api.cx, atelet.y], [api.cx, api.y + api.h + 1], { style: 'write', label: '3 registers' });
  f.text(api.cx - 8, 122, '4 WORKER_STATE_ACTIVE', { size: 11, hue: 'amber', anchor: 'end' });
});
