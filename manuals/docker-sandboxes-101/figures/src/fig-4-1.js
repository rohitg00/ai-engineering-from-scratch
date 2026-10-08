'use strict';

const { figure, color } = require('../../../_shared/figkit.js');

const rows = [
  { lines: ['# syntax=docker/sandbox-kit:3'], note: 'dispatches the BuildKit frontend (kitspec 1.1)' },
  { lines: ['schemaVersion: "3"'], note: 'REQUIRED, exactly the string "3" (kitspec 4)' },
  { lines: ['kind: workload'], note: 'workload or mixin (kitspec 1 and 4)' },
  { lines: ['name: hello-kit'], note: 'no such top-level field, refused (kitspec 1.2)', refused: true },
  { lines: ['description: A shell workload with', 'one network grant, in the v3 form.'], note: 'optional display metadata (kitspec 4)' },
  { lines: ['capabilities:', '  com.docker.sandbox/network-policy@2:', '    allow: [example.com]'], note: 'kitspec 7 wants a list of type and config', refused: true },
];

const annotations = [
  { key: 'vnd.docker.sandbox.kit.descriptor', value: 'the published descriptor as compact JSON' },
  { key: 'vnd.docker.sandbox.kit.schema-version', value: '"3", equal to the field inside' },
  { key: 'vnd.docker.sandbox.kit.capabilities', value: 'com.docker.sandbox/network-policy@2' },
  { key: 'vnd.docker.sandbox.kit.built-by', value: 'name docker/sandbox-kit, version 3.0.0' },
];

module.exports = figure('fig-4-1', {
  height: 452,
  title: 'A v3 descriptor and the image manifest that carries it',
  desc: 'Left: the six top-level entries of capture/fixtures/kits/hello-kit/kit.yaml, from the syntax line to the capabilities block, each with the rule that applies to it. Two rows are marked refused: name is not a top-level field, and the capabilities block is written as a map where the grammar wants a list. Right: the OCI image manifest the frontend would publish, with its four vnd.docker.sandbox.kit annotations, the config blob, and the layers that stage kit.yaml at /usr/share/sandbox/kit/hello-kit/kit.yaml. Teal lines connect each descriptor row to the annotation it becomes.',
}, f => {
  f.kicker(20, 18, 'kit.yaml of hello-kit (captured)');
  f.kicker(356, 18, 'the image, kitspec 9.3 and 10');
  f.box({ x: 20, y: 28, w: 306, h: 26, hue: 'green', title: 'capture/fixtures/kits/hello-kit/kit.yaml', titleSize: 11.5, align: 'left', pad: 8 });

  const rowTops = [];
  let y = 54;
  rows.forEach(row => {
    const h = row.lines.length * 15 + 24;
    rowTops.push(y + h / 2);
    f.rect(20, y, 306, h, { fill: row.refused ? color('rose-fill') : color('paper'), stroke: row.refused ? color('rose-ink') : color('panel-edge') });
    row.lines.forEach((line, index) => f.text(28, y + 15 + index * 15, line, { size: 11, hue: row.refused ? 'rose' : undefined }));
    f.text(28, y + h - 7, row.note, { size: 11, serif: true, hue: row.refused ? 'rose' : 'ink-soft' });
    y += h;
  });

  const right = 356;
  f.rect(right, 28, 264, 362, { fill: color('panel'), stroke: color('grey-ink') });
  f.text(right + 8, 45, 'OCI image manifest', { size: 12, weight: 700 });
  f.text(right + 8, 60, 'application/vnd.oci.image.manifest.v1+json', { size: 11, serif: true, hue: 'ink-soft' });
  f.text(right + 8, 82, 'annotations', { size: 11, hue: 'ink-soft' });
  const annTops = [];
  annotations.forEach((annotation, index) => {
    const top = 88 + index * 46;
    annTops.push(top + 23);
    f.rect(right + 8, top, 252, 42, { fill: color('teal-fill'), stroke: color('teal-ink') });
    f.text(right + 10, top + 16, annotation.key, { size: 11, hue: 'teal' });
    f.text(right + 10, top + 33, annotation.value, { size: 11, serif: true, hue: 'ink-soft' });
  });
  f.rect(right + 8, 278, 252, 44, { fill: color('paper'), stroke: color('panel-edge') });
  f.text(right + 12, 295, 'config', { size: 11, hue: 'ink-soft' });
  f.text(right + 12, 311, 'entrypoint, cmd, env, user, workdir', { size: 11, serif: true, hue: 'ink-soft' });
  f.rect(right + 8, 328, 252, 56, { fill: color('green-fill'), stroke: color('green-ink') });
  f.text(right + 12, 345, 'layers 1..n', { size: 11, hue: 'green' });
  f.text(right + 12, 361, 'the workload root filesystem, plus', { size: 11, serif: true, hue: 'ink-soft' });
  f.text(right + 12, 376, '/usr/share/sandbox/kit/<stem>/kit.yaml', { size: 11, serif: true, hue: 'ink-soft' });

  const link = (fromY, toY, x) => f.path(`M326 ${fromY} H${x} V${toY} H${right - 1}`, { style: 'write', packet: false });
  link(41, annTops[0], 334);
  link(rowTops[1], annTops[1], 340);
  link(rowTops[5], annTops[2], 346);
  link(rowTops[0], annTops[3], 352);

  f.text(20, 412, 'docker buildx build ./hello-kit -f ./hello-kit/kit.yaml -t NAMESPACE/hello-kit:1.0.0 --push', { size: 11 });
  f.text(20, 430, 'One manifest GET gives the descriptor and the runtime contract. Layers are pulled at run (kitspec 10).', { size: 11, serif: true, hue: 'ink-soft' });
  f.text(20, 445, 'The build did not run on the recording host (13-kit-v3-inspect.txt), so the right side follows the spec.', { size: 11, serif: true, hue: 'ink-soft' });
});
