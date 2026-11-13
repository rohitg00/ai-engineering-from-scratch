'use strict';

const { figure } = require('../../../_shared/figkit.js');

module.exports = figure('fig-3-6', {
  height: 330,
  title: 'An atespace and a Kubernetes namespace hold different objects',
  desc: 'Two trees side by side. On the left, in the Substrate API and stored in Postgres, the atespace lab-c holds the ActorTemplate ballast-200, the actor b200-1 and the golden tag of the template. On the right, in Kubernetes, the namespace lab-c holds the WorkerPool ballast with the label workload: ballast and its two worker pods. A dotted line joins the workerSelector of the template to the label of the pool, because pool selection uses labels and does not check the namespace.',
}, f => {
  f.kicker(20, 18, 'Substrate API, rows in Postgres');
  f.kicker(350, 18, 'Kubernetes, objects in etcd');
  f.rule(320, 8, 320, 268, { dash: 'dashed' });

  const space = f.box({ x: 20, y: 28, w: 280, h: 44, hue: 'blue', title: 'Atespace lab-c', sub: 'kubectl ate create atespace lab-c' });
  const tmpl = f.box({ x: 50, y: 96, w: 250, h: 58, hue: 'green', align: 'left', title: 'ActorTemplate ballast-200', sub: ['workerSelector:', 'matchLabels workload: ballast'] });
  const actor = f.box({ x: 50, y: 166, w: 250, h: 44, hue: 'green', align: 'left', title: 'Actor b200-1', sub: 'addressed as lab-c/b200-1' });
  const tag = f.box({ x: 50, y: 222, w: 250, h: 44, hue: 'teal', align: 'left', title: 'Tag b9f97b82', titleSize: 12, sub: 'golden tag, named by the template uid' });
  [tmpl, actor, tag].forEach(child => f.path(`M34 ${space.y + space.h} V${child.cy} H49`, { style: 'call', head: false }));

  const ns = f.box({ x: 350, y: 28, w: 270, h: 44, hue: 'grey', title: 'Namespace lab-c', sub: 'kubectl create namespace lab-c' });
  const pool = f.box({ x: 380, y: 96, w: 240, h: 58, hue: 'violet', align: 'left', title: 'WorkerPool ballast', sub: ['labels workload: ballast', 'replicas 2, class gvisor'] });
  const podA = f.box({ x: 410, y: 166, w: 210, h: 44, hue: 'violet', align: 'left', titleSize: 11.5, title: 'ballast-65cf95d875-bzgjd', sub: 'worker pod, 2 CPU, 3 GiB' });
  const podB = f.box({ x: 410, y: 222, w: 210, h: 44, hue: 'violet', align: 'left', titleSize: 11.5, title: 'ballast-65cf95d875-f65dl', sub: 'worker pod, 2 CPU, 3 GiB' });
  f.path(`M364 ${ns.y + ns.h} V${pool.cy} H379`, { style: 'call', head: false });
  [podA, podB].forEach(pod => f.path(`M394 ${pool.y + pool.h} V${pod.cy} H409`, { style: 'call', head: false }));

  f.arrow([tmpl.x + tmpl.w, tmpl.cy], [pool.x - 1, pool.cy], { style: 'event' });

  f.text(20, 292, 'The dotted line is the only link: the selector of the template matches the labels of the pool.', { size: 11, serif: true, hue: 'ink-soft' });
  f.text(20, 310, 'The two names lab-c are equal because we chose them so. Substrate does not compare them.', { size: 11, serif: true, hue: 'ink-soft' });
});
