'use strict';

const { figure } = require('../../../_shared/figkit.js');

module.exports = figure('fig-4-1', {
  height: 330,
  title: 'From a WorkerPool to two registered workers',
  desc: 'The WorkerPool ballast in namespace lab-c asks for two replicas with a limit of 2 CPUs and 3 GiB. ate-controller reads it, writes a Deployment, and creates one Worker record in ate-api-server for each pod. atelet registers each worker. Each of the two worker pods then reports 2 of 1000 actors, 2000 of 2000 millicores and 512Mi of 3008Mi.',
}, f => {
  f.kicker(20, 18, 'You write');
  f.kicker(250, 18, 'Substrate reconciles');
  const pool = f.box({ x: 20, y: 28, w: 190, h: 62, hue: 'grey', title: 'WorkerPool ballast', sub: ['replicas: 2', 'limits: cpu 2, memory 3Gi'] });
  const ctrl = f.box({ x: 250, y: 28, w: 150, h: 62, hue: 'blue', title: 'ate-controller', sub: 'one replica' });
  const api = f.box({ x: 450, y: 28, w: 170, h: 62, hue: 'blue', title: 'ate-api-server', sub: ['Worker b17a6492', 'Worker ee4ba8b4'] });
  f.arrow(pool.right(), [ctrl.x - 1, pool.cy], { style: 'call', label: '1 reads' });
  f.arrow(ctrl.right(), [api.x - 1, ctrl.cy], { style: 'write', label: '2 creates' });

  const dep = f.box({ x: 235, y: 132, w: 180, h: 44, hue: 'grey', title: 'Deployment ballast', sub: 'label ate.dev/worker-pool' });
  f.arrow(ctrl.bottom(), [ctrl.cx, dep.y - 1], { style: 'call', label: 'writes' });

  f.kicker(20, 206, 'One node');
  const p1 = f.box({ x: 20, y: 216, w: 200, h: 96, hue: 'violet', title: 'worker pod bzgjd', sub: ['ACTORS 2/1000', 'CPU 2000/2000', 'MEMORY 512Mi/3008Mi'] });
  const p2 = f.box({ x: 235, y: 216, w: 200, h: 96, hue: 'violet', title: 'worker pod f65dl', sub: ['ACTORS 2/1000', 'CPU 2000/2000', 'MEMORY 512Mi/3008Mi'] });
  const atelet = f.box({ x: 470, y: 232, w: 150, h: 64, hue: 'violet', title: 'atelet', sub: ['registers each worker', 'reports its runtimes'] });
  f.path(`M${dep.x} ${dep.cy} H${p1.cx} V${p1.y - 1}`, { style: 'call' });
  f.arrow([dep.cx + 10, dep.y + dep.h], [dep.cx + 10, p2.y - 1], { style: 'call' });
  f.arrow([atelet.cx, atelet.y], [atelet.cx, api.y + api.h + 1], { style: 'write', label: '3 registers' });
  f.text(atelet.cx, 318, 'WORKER_STATE_ACTIVE', { size: 11, hue: 'amber', anchor: 'middle' });
});
