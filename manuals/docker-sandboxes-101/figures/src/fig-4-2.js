'use strict';

const { figure, color } = require('../../../_shared/figkit.js');

const kits = [
  { x: 20, title: 'hello-kit, workload', sub: ['fixtures/kits/hello-kit', 'network-policy@2, runtime:', 'allow example.com'] },
  { x: 220, title: 'gh, mixin', sub: ['kitspec 2 example', 'network-policy@1 runtime allow', 'github.com, api.github.com,', 'uploads.github.com', 'credential@1: github, runtime,', 'GH_TOKEN proxyManaged'] },
  { x: 420, title: 'bounds, mixin', sub: ['kitcap network-policy@2 config', 'install: registry.npmjs.org', 'runtime: allow api.github.com', 'GET and HEAD on /repos/**', 'deny api.github.com DELETE', 'deny telemetry.example.com'] },
];

const grants = [
  ['runtime allow', 'example.com, github.com, uploads.github.com'],
  ['runtime allow', 'api.github.com, every method and path (bounded entry dropped, kitspec 9.5)'],
  ['runtime deny', 'api.github.com DELETE, telemetry.example.com (deny wins, kitcap)'],
  ['install allow', 'registry.npmjs.org (closed again before the agent starts, kitspec 12)'],
  ['credential', 'github at runtime, GH_TOKEN proxyManaged, inject on api.github.com'],
];

module.exports = figure('fig-4-2', {
  height: 606,
  title: 'Three kits resolve into one grant set',
  desc: 'Top: three kits, the captured hello-kit workload with one network-policy@2 allow for example.com, the gh mixin from the specification example with network-policy@1 allows and a GitHub credential, and a mixin that carries the network-policy@2 config example with a bounded allow and two deny entries. Middle: sbx resolves the closed set with exactly one workload. Below: the merged grant set stored in the lock, five rows of allow, deny, install, and credential entries. Bottom: two branches for the next version of a kit. A version whose grants stay inside the stored set applies silently. A version that removes the deny on DELETE widens the set and stops for approval.',
}, f => {
  f.kicker(20, 18, 'the declared kits');
  const boxes = kits.map(kit => f.box({ x: kit.x, y: 26, w: 200, h: 118, hue: 'green', title: kit.title, sub: kit.sub, pad: 8, titleSize: 12 }));

  const resolver = f.box({ x: 120, y: 190, w: 400, h: 48, hue: 'blue', title: 'sbx resolves the set (kitspec 5.3)', sub: 'closed set, one workload, one provider per name, deny wins' });
  boxes.forEach(box => f.path(`M${box.cx} 144 V166 H${resolver.cx} V189`, { style: 'call', hue: 'ink-mute', head: false }));
  f.arrow([resolver.cx, 238], [resolver.cx, 269], { style: 'write', label: 'the lock records the grant set' });

  f.rect(20, 270, 600, 170, { fill: color('teal-fill'), stroke: color('teal-ink') });
  f.rect(23, 273, 594, 164, { fill: 'none', stroke: color('teal-ink') });
  f.text(32, 292, 'the merged grant set for the sandbox (kitspec 7.4)', { size: 12, weight: 700, hue: 'teal' });
  grants.forEach(([kind, value], index) => {
    const y = 300 + index * 26;
    f.rect(32, y, 576, 24, { fill: color('paper'), stroke: color('panel-edge') });
    f.text(40, y + 16, kind, { size: 11, hue: 'teal' });
    f.text(142, y + 16, value, { size: 11, serif: true });
  });

  f.text(330, 464, 'the next version of a kit', { size: 11, serif: true, hue: 'ink-soft', anchor: 'middle' });
  f.box({ x: 20, y: 482, w: 280, h: 64, hue: 'amber', title: 'stays inside the set', sub: ['a bounded allow on a host already granted', 'applies silently (kitspec 7.4)'] });
  f.box({ x: 340, y: 482, w: 280, h: 64, hue: 'rose', title: 'removes deny api.github.com DELETE', sub: ['a removed deny entry is a widening', 'stops and asks before it applies'], titleSize: 12 });
  f.arrow([160, 440], [160, 481], { style: 'state', label: 'same grants' });
  f.arrow([480, 440], [480, 481], { style: 'fail', label: 'wider grants' });
  f.text(20, 572, 'A kit grants itself nothing: each row is a request the host answered. The lock judges the next version.', { size: 11, serif: true, hue: 'ink-soft' });
  f.text(20, 590, 'From hello-kit/kit.yaml, kitspec 2, 5.3, 7.4 and 9.5, and kitcap network-policy@2 and credential@1.', { size: 11, serif: true, hue: 'ink-soft' });
});
