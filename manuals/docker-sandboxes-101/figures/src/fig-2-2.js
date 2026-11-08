'use strict';

const { figure } = require('../../../_shared/figkit.js');

module.exports = figure('fig-2-2', {
  height: 292,
  title: 'From a stopped sandbox to a template, a tar, and a new sandbox',
  desc: 'Top row, left to right: the stopped sandbox m101-demo with its marker file, sbx template save writes the image library/m101-tpl:v1 into the runtime image store, and --output exports it as the tar file m101-tpl.tar in OCI layout. Bottom row: sbx create --pull never -t m101-tpl:v1 makes m101-from-tpl from the store, with the marker file present, and a copy of the tar reaches another host where sbx template load imports it.',
}, f => {
  f.kicker(20, 40, 'on the recording Mac');
  const demo = f.box({ x: 20, y: 60, w: 150, h: 65, hue: 'blue', title: 'm101-demo', sub: ['sbx stop m101-demo', '/opt/marker-from-demo'] });
  const store = f.box({ x: 260, y: 60, w: 170, h: 65, hue: 'green', title: 'runtime image store', sub: ['library/m101-tpl:v1', 'flavor shell'] });
  const tar = f.box({ x: 490, y: 60, w: 130, h: 65, hue: 'green', title: 'm101-tpl.tar', sub: ['OCI layout', 'blobs/sha256/'] });
  const fresh = f.box({ x: 260, y: 200, w: 170, h: 65, hue: 'blue', title: 'm101-from-tpl', sub: ['no workspace mount', '/opt/marker-from-demo'] });
  const other = f.box({ x: 490, y: 200, w: 130, h: 65, hue: 'grey', title: 'another host', sub: ['sbx template load', 'm101-tpl.tar'] });
  f.arrow(demo.right(), [store.x - 1, demo.cy], { style: 'write', label: 'template save', labelSize: 11, note: 'stop first' });
  f.arrow(store.right(), [tar.x - 1, store.cy], { style: 'write', label: '--output', labelSize: 11, note: 'tar file' });
  f.arrow(store.bottom(), [store.cx, fresh.y - 1], { style: 'call', label: 'sbx create shell', note: '--pull never -t m101-tpl:v1' });
  f.arrow(tar.bottom(), [tar.cx, other.y - 1], { style: 'effect', label: 'copy', note: 'by hand' });
  f.text(20, 284, 'the load on another host follows the help text and is not recorded', { size: 11, serif: true, hue: 'ink-soft' });
});
