'use strict';

const { figure, color } = require('../../../_shared/figkit.js');

const rows = [
  { lines: ['# syntax=docker/sandbox-kit:3'], note: 'dispatches the frontend, sandbox-kit 3.0.0-m.8' },
  { lines: ['schemaVersion: "3"'], note: 'REQUIRED, exactly the string "3" (kitspec 4)' },
  { lines: ['kind: workload'], note: 'workload, mixin, or set (kitspec 4)' },
  { lines: ['displayName: hello-kit'], note: 'becomes org.opencontainers.image.title' },
  { lines: ['description: A shell workload with one', '  network grant, in the v3 descriptor form.'], note: 'becomes org.opencontainers.image.description' },
  { lines: ['version: "1.0.0"'], note: 'becomes org.opencontainers.image.version' },
  { lines: ['licenses: [Apache-2.0]'], note: 'becomes org.opencontainers.image.licenses' },
  { lines: ['build: |', '  FROM docker/sandbox-templates:shell', '  COPY HELLO.md /home/agent/HELLO.md'], note: 'the recipe of the layers (kitspec 3.2)' },
  { lines: ['capabilities:', '  - type: com.docker.sandbox/network-policy@2', '    config:', '      runtime:', '        allow:', '          - example.com'], note: 'a list of type and config (kitspec 7)' },
];

const annotations = [
  { key: 'vnd.docker.sandbox.kit.descriptor', value: 'kit.yaml as JSON, plus 402 deb/ provides' },
  { key: 'vnd.docker.sandbox.kit.schema-version', value: '"3"' },
  { key: 'vnd.docker.sandbox.kit.capabilities', value: 'com.docker.sandbox/network-policy@2' },
  { key: 'vnd.docker.sandbox.kit.built-by', value: 'docker/sandbox-kit 3.0.0-m.8, 129be2ff' },
];

module.exports = figure('fig-4-1', {
  height: 612,
  title: 'A v3 descriptor and the image manifest that carries it',
  desc: 'Left: the nine top-level entries of capture/fixtures/kits/hello-kit/kit.yaml, from the syntax line to the capabilities list, each with a note on what it becomes. Right: what the local registry returned for m101/hello-kit:v1, an OCI image index with no annotations and the linux/arm64 image manifest. The manifest carries four vnd.docker.sandbox.kit annotations, the descriptor as JSON with 402 derived deb provides, schema-version 3, the network-policy@2 capability, and built-by sandbox-kit 3.0.0-m.8, plus four org.opencontainers.image keys, the OCI config, and 16 layers with the sources staged at /usr/share/sandbox/kit/kit. Teal lines connect each descriptor row to the annotation or layer it becomes.',
}, f => {
  f.kicker(20, 18, 'kit.yaml of hello-kit, as written');
  f.kicker(356, 18, 'what the registry returned');
  f.box({ x: 20, y: 28, w: 306, h: 26, hue: 'green', title: 'capture/fixtures/kits/hello-kit/kit.yaml', titleSize: 11.5, align: 'left', pad: 8 });

  const rowTops = [];
  let y = 54;
  rows.forEach(row => {
    const h = row.lines.length * 15 + 24;
    rowTops.push(y);
    f.rect(20, y, 306, h, { fill: color('paper'), stroke: color('panel-edge') });
    row.lines.forEach((line, index) => {
      const indent = line.length - line.trimStart().length;
      f.text(26 + indent * 6.6, y + 15 + index * 15, line.trimStart(), { size: 11 });
    });
    f.text(26, y + h - 7, row.note, { size: 11, serif: true, hue: 'ink-soft' });
    y += h;
  });

  const right = 356;
  f.rect(right, 28, 264, 72, { fill: color('panel'), stroke: color('grey-ink') });
  f.text(right + 8, 45, 'OCI image index, tag v1', { size: 12, weight: 700 });
  f.text(right + 8, 61, 'application/vnd.oci.image.index.v1+json', { size: 11, serif: true, hue: 'ink-soft' });
  f.text(right + 8, 76, 'linux/arm64 and an attestation manifest', { size: 11, serif: true, hue: 'ink-soft' });
  f.text(right + 8, 91, 'annotations: none', { size: 11, serif: true, hue: 'ink-soft' });

  f.rect(right, 108, 264, 414, { fill: color('panel'), stroke: color('grey-ink') });
  f.text(right + 8, 125, 'platform manifest, linux/arm64', { size: 12, weight: 700 });
  f.text(right + 8, 141, 'application/vnd.oci.image.manifest.v1+json', { size: 11, serif: true, hue: 'ink-soft' });
  f.text(right + 8, 162, 'annotations', { size: 11, hue: 'ink-soft' });
  const annCenters = annotations.map((annotation, index) => {
    const top = 168 + index * 46;
    f.rect(right + 8, top, 252, 42, { fill: color('teal-fill'), stroke: color('teal-ink') });
    f.text(right + 10, top + 16, annotation.key, { size: 11, hue: 'teal' });
    f.text(right + 10, top + 33, annotation.value, { size: 11, serif: true, hue: 'ink-soft' });
    return top + 21;
  });
  f.rect(right + 8, 352, 252, 58, { fill: color('teal-fill'), stroke: color('teal-ink') });
  f.text(right + 10, 368, 'org.opencontainers.image.*', { size: 11, hue: 'teal' });
  f.text(right + 10, 384, 'title hello-kit, version 1.0.0,', { size: 11, serif: true, hue: 'ink-soft' });
  f.text(right + 10, 399, 'licenses Apache-2.0, description', { size: 11, serif: true, hue: 'ink-soft' });
  f.rect(right + 8, 416, 252, 40, { fill: color('paper'), stroke: color('panel-edge') });
  f.text(right + 12, 432, 'config', { size: 11, hue: 'ink-soft' });
  f.text(right + 12, 448, 'application/vnd.oci.image.config.v1+json', { size: 11, serif: true, hue: 'ink-soft' });
  f.rect(right + 8, 462, 252, 54, { fill: color('green-fill'), stroke: color('green-ink') });
  f.text(right + 12, 478, '16 layers', { size: 11, hue: 'green' });
  f.text(right + 12, 494, 'shell template, HELLO.md, and sources', { size: 11, serif: true, hue: 'ink-soft' });
  f.text(right + 12, 509, 'staged at /usr/share/sandbox/kit/kit', { size: 11, serif: true, hue: 'ink-soft' });

  const link = (fromY, toY, lane) => f.path(`M326 ${fromY} H${lane} V${toY} H${right + 7}`, { style: 'write', packet: false });
  link(rowTops[7] + 18, 489, 331);
  link(rowTops[3] + 34, 381, 335);
  link(rowTops[0] + 12, annCenters[3], 339);
  link(rowTops[1] + 19, annCenters[1], 343);
  link(41, annCenters[0], 347);
  link(rowTops[8] + 50, annCenters[2], 351);

  f.text(20, 548, 'docker buildx build -f fixtures/kits/hello-kit/kit.yaml --builder m101-builder', { size: 11 });
  f.text(33.2, 564, '-t m101-registry:5000/m101/hello-kit:v1 --push fixtures/kits/hello-kit', { size: 11 });
  f.text(20, 584, 'With the default docker driver, the same push kept no annotation (28-manifest-docker-driver.json).', { size: 11, serif: true, hue: 'ink-soft' });
  f.text(20, 600, 'The index carries none of the eight, although kitspec 9.3 promotes them there (28-index.json).', { size: 11, serif: true, hue: 'ink-soft' });
});
