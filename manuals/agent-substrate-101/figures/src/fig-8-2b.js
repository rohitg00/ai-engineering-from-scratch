'use strict';

const { figure, color } = require('../../../_shared/figkit.js');

const main = s => 40 + s * 2.2;
const zoom = t => 40 + t * 40;

module.exports = figure('fig-8-2b', {
  height: 338,
  title: 'One node restart, and what the actor r1 returned',
  desc: 'A timeline of a kind node restart. The Kubernetes API answers again after 8 seconds and all pods run after 147 seconds. The first request to the actor r1 then returns 500, the second returns 503 because the actor is crashed, and after a revert the third waits 5.06 seconds and returns 503 because no worker has room. A request 78 seconds later returns 200.',
}, f => {
  f.kicker(20, 20, 'the node, by clock time');
  f.rect(main(0), 52, main(159.1) - main(0), 12, { hue: 'grey' });
  f.rect(main(159.1), 52, main(249.3) - main(159.1), 12, { hue: 'rose' });
  f.rule(main(19.4), 44, main(19.4), 72, { hue: 'ink' });
  f.text(main(19.4) + 5, 44, 'kube-api-back: 8 s', { size: 11, hue: 'ink-soft' });
  f.rule(main(159.1), 44, main(159.1), 72, { hue: 'ink' });
  f.text(main(159.1) - 5, 44, 'pods-ready: 147 s', { size: 11, anchor: 'end', hue: 'ink-soft' });
  f.dot(main(249.3), 58, { hue: 'green', r: 4 });
  f.text(main(249.3) + 8, 44, '200, count=4', { size: 11, anchor: 'end', hue: 'green' });
  f.text(main(204), 82, 'r1 not served', { size: 11, serif: true, anchor: 'middle', hue: 'rose' });
  f.text(main(80), 82, 'docker restart kind-control-plane', { size: 11, serif: true, anchor: 'middle', hue: 'ink-soft' });
  f.rule(main(0), 96, main(250), 96, { hue: 'ink' });
  [['11:42', 40.3], ['11:43', 100.3], ['11:44', 160.3], ['11:45', 220.3]].forEach(([label, s]) => {
    f.rule(main(s), 92, main(s), 100, { hue: 'ink' });
    f.text(main(s), 114, label, { size: 11, anchor: 'middle', hue: 'ink-soft' });
  });

  f.rule(main(159.1), 120, zoom(0), 150, { hue: 'ink-mute', dash: 'dotted' });
  f.rule(main(172), 120, zoom(14), 150, { hue: 'ink-mute', dash: 'dotted' });
  f.kicker(20, 172, 'the 14 seconds after all pods ran');

  f.text(zoom(1.39), 196, '500 error resuming actor lab-c/r1', { size: 11, hue: 'rose' });
  f.text(zoom(7.03) + 15, 196, '503 AssignWorker prerequisite not met', { size: 11, hue: 'rose' });
  f.rule(zoom(1.6), 200, zoom(1.6), 214, { hue: 'rose' });
  f.rule(zoom(7.07), 200, zoom(7.07), 214, { hue: 'rose' });
  f.rect(zoom(1.39), 214, zoom(1.8) - zoom(1.39), 12, { fill: color('rose-ink'), stroke: 'none' });
  f.rect(zoom(7.03), 214, 4, 12, { fill: color('rose-ink'), stroke: 'none' });
  f.rect(zoom(7.74), 214, zoom(12.8) - zoom(7.74), 12, { fill: color('rose-ink'), stroke: 'none' });
  f.rule(zoom(2.0), 226, zoom(2.0), 242, { hue: 'amber' });
  f.text(zoom(2.0) + 5, 252, 'ACTOR_STATE_CRASHED', { size: 11, hue: 'amber' });
  f.rule(zoom(7.72), 226, zoom(7.72), 242, { hue: 'amber' });
  f.text(zoom(7.72) + 5, 252, 'revert actor: SUSPENDED', { size: 11, hue: 'amber' });
  f.text(zoom(7.72) + 5, 270, '503 after 5.06 s: no worker has room', { size: 11, hue: 'rose' });

  f.rule(zoom(0), 290, zoom(14), 290, { hue: 'ink' });
  for (let t = 0; t <= 14; t += 2) {
    f.rule(zoom(t), 286, zoom(t), 294, { hue: 'ink' });
    f.text(zoom(t), 308, `+${t} s`, { size: 11, anchor: 'middle', hue: 'ink-soft' });
  }
  f.text(20, 328, 'rose bar: one request, from sent to answered', { size: 11, serif: true, hue: 'ink-soft' });
});
