'use strict';

const fs = require('fs');
const path = require('path');
const { figure, color } = require('../../../_shared/figkit.js');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, '../../capture/lab/summary/install-steps.json'), 'utf8'));
const pick = (group, step) => data[group].steps.find(row => row.step === step);
const release = [
  ['kind cluster', pick('release_images', '10-kind-cluster'), 'grey'],
  ['deploy ate-system', pick('release_images', '20-deploy-ate-system-prebuilt'), 'blue'],
  ['deploy demo counter', pick('release_images', '30-deploy-counter'), 'violet'],
];
const source = [
  ['kind cluster', pick('source_build', '10-kind-cluster'), 'grey'],
  ['deploy ate-system', pick('source_build', '20-deploy-ate-system'), 'rose'],
  ['the same step again', pick('source_build', '22-deploy-ate-system-retry'), 'blue'],
  ['deploy demo counter', pick('source_build', '30-deploy-counter'), 'violet'],
];
const total = rows => rows.reduce((sum, [, row]) => sum + row.seconds, 0);

module.exports = figure('fig-2-1', {
  height: 330,
  title: 'Install steps from the release images and from source',
  desc: `Two groups of horizontal bars with the seconds of each install step. From the release images on an x86 guest with 16 vCPU: ${release.map(([name, row]) => `${name} ${row.seconds} s`).join(', ')}, ${total(release)} s in all. Built from source on an x86 guest with 24 vCPU: ${source.map(([name, row]) => `${name} ${row.seconds} s${row.exit ? ' and failed' : ''}`).join(', ')}, ${total(source)} s in all. The failed step is rose and stopped on the missing Docker buildx plugin.`,
}, f => {
  const x0 = 190;
  const scale = 1.25;
  const draw = (rows, top) => {
    rows.forEach(([name, row, hue], index) => {
      const y = top + index * 28;
      f.text(180, y + 13, name, { size: 11.5, anchor: 'end' });
      f.rect(x0, y, row.seconds * scale, 18, { fill: color(`${hue}-ink`), stroke: 'none' });
      f.text(x0 + row.seconds * scale + 8, y + 13, row.exit ? `${row.seconds} s, exit 1: no buildx` : `${row.seconds} s`, { size: 11.5, hue: hue === 'grey' ? 'ink-soft' : hue });
    });
    f.rule(x0, top - 6, x0, top + rows.length * 28 - 4, { hue: 'ink' });
  };
  f.kicker(20, 18, 'from the release images · x86 guest, 16 vCPU');
  f.text(620, 18, `${total(release)} s in all`, { size: 11.5, anchor: 'end', weight: 700 });
  draw(release, 34);
  f.rule(20, 132, 620, 132, { dash: 'dashed' });
  f.kicker(20, 156, 'built from source · x86 guest, 24 vCPU');
  f.text(620, 156, `${total(source)} s in all`, { size: 11.5, anchor: 'end', weight: 700 });
  draw(source, 172);
  f.text(20, 304, 'The source build made the Envoy image with docker buildx and compiled a Rust module.', { size: 11, serif: true, hue: 'ink-soft' });
  f.text(20, 320, 'In both installs the demo step built the worker and counter images with ko.', { size: 11, serif: true, hue: 'ink-soft' });
});
