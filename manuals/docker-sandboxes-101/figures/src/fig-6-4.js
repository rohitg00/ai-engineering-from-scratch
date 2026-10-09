'use strict';

const { figure, color } = require('../../../_shared/figkit.js');

function rows(f, y, entries) {
  entries.forEach(([key, value], index) => {
    const top = y + index * 24;
    f.rect(20, top, 600, 24, { fill: color('paper'), stroke: color('panel-edge') });
    f.text(30, top + 16, key, { size: 11, hue: 'ink-soft' });
    f.text(280, top + 16, value, { size: 11 });
  });
  return y + entries.length * 24;
}

module.exports = figure('fig-6-4', {
  height: 488,
  title: 'The agent file as an OCI artifact',
  desc: 'Top: docker-agent share push sends fixtures/agents/files.yaml to the local registry localhost:15000 as m101/agent:v1. share pull writes an identical copy named localhost:15000_m101_agent:v1.yaml into the current directory, and docker-agent run with the reference answers README.md has 1 line. Bottom: the manifest the registry serves. Its mediaType is the OCI image manifest, its artifactType is application/vnd.docker.agent.config.v1+json, and the config and the one layer keep Docker image media types. Four annotations: io.docker.agent.version and io.docker.cagent.version, both v1.149.0, and the OCI created and description keys. With --key, the proof is recorded as more annotations, which this capture did not do.',
}, f => {
  const file = f.box({ x: 20, y: 30, w: 140, h: 56, hue: 'violet', title: 'files.yaml', sub: ['agent root', 'filesystem, shell'] });
  const registry = f.box({ x: 240, y: 30, w: 150, h: 120, hue: 'grey', title: 'localhost:15000', sub: ['m101/agent:v1', 'plain HTTP', 'registry:2'] });
  const pulled = f.box({ x: 470, y: 30, w: 150, h: 56, hue: 'violet', title: 'share pull', sub: ['identical YAML', 'in the current dir'] });
  const run = f.box({ x: 470, y: 100, w: 150, h: 50, hue: 'violet', title: 'run by reference', titleSize: 11.5, sub: 'README.md has 1 line.' });
  f.arrow(file.right(), [registry.x - 1, file.cy], { style: 'call', label: 'share push', labelSize: 11 });
  f.arrow([registry.x + registry.w, pulled.cy], [pulled.x - 1, pulled.cy], { style: 'reply', label: 'share pull', labelSize: 11 });
  f.arrow([registry.x + registry.w, run.cy], [run.x - 1, run.cy], { style: 'reply', label: 'run', labelSize: 11 });

  f.box({ x: 20, y: 170, w: 600, h: 26, hue: 'grey', title: 'manifest of m101/agent:v1, as the registry serves it', titleSize: 12, align: 'left' });
  rows(f, 196, [
    ['mediaType', 'application/vnd.oci.image.manifest.v1+json'],
    ['artifactType', 'application/vnd.docker.agent.config.v1+json'],
    ['config', 'application/vnd.docker.container.image.v1+json'],
    ['layers[0]', 'application/vnd.docker.image.rootfs.diff.tar.gzip'],
  ]);
  f.box({ x: 20, y: 300, w: 600, h: 26, hue: 'violet', title: 'annotations', titleSize: 12, align: 'left' });
  rows(f, 326, [
    ['io.docker.agent.version', 'v1.149.0'],
    ['io.docker.cagent.version', 'v1.149.0, the legacy key'],
    ['org.opencontainers.image.created', '<ts>'],
    ['org.opencontainers.image.description', 'OCI artifact containing files.yaml'],
  ]);
  f.box({ x: 20, y: 434, w: 600, h: 40, hue: 'grey', dash: 'dashed', title: 'with --key: a signature or MAC is added as annotations, not in this capture', titleSize: 11.5, weight: 400 });
});
