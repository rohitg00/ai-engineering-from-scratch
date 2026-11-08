'use strict';

const { figure, color } = require('../../../_shared/figkit.js');

const block = [
  ['provider.id', 'ghidra', 'the engine of the block'],
  ['shared_limitations', '4 strings', 'they apply to every group'],
];
const rows = [
  ['operations', '1 name', 'analyze_function'],
  ['effects', 'launches_process,', 'the 2 flags that are true'],
  ['', 'may_write_filesystem', 'the other 5 flags are false'],
  ['limitations', '5 strings', 'they follow the 4 shared strings'],
  ['available', 'true', 'false carries reason and code'],
  ['reason', 'null', 'text when available is false'],
  ['availability_code', 'null', 'a code when available is false'],
];

module.exports = figure('fig-2-3', {
  height: 356,
  title: 'One capability group: analyze_function under ghidra',
  desc: 'The capability group for analyze_function in the ghidra candidate of rea capabilities, drawn as two tables. The first table is the provider block: provider.id is ghidra, and shared_limitations holds 4 strings that apply to every group of the block. The second table is the group: operations holds the one name analyze_function, effects names the 2 true flags launches_process and may_write_filesystem, so the other 5 flags are false, limitations holds 5 strings that follow the 4 shared strings, available is true, and reason and availability_code are null.',
}, f => {
  f.kicker(20, 18, 'the provider block');
  f.kicker(396, 18, 'what the value means');
  f.box({ x: 20, y: 26, w: 360, h: 28, hue: 'violet', title: 'analysis_provider_candidates[0].capabilities[0]', align: 'left', titleSize: 11, pad: 10 });
  const line = (field, value, note, y) => {
    f.rect(20, y, 360, 26, { fill: color('paper'), stroke: color('panel-edge') });
    if (field) f.text(30, y + 17, field, { size: 12, hue: 'ink-soft' });
    f.text(200, y + 17, value, { size: 12 });
    f.rule(380, y + 13, 390, y + 13, { hue: 'violet' });
    f.text(396, y + 17, note, { size: 11, serif: true, hue: 'ink-soft' });
  };
  block.forEach(([field, value, note], index) => line(field, value, note, 54 + index * 26));
  f.kicker(20, 132, 'one group of the block');
  f.box({ x: 20, y: 140, w: 360, h: 28, hue: 'violet', title: 'groups[2]', align: 'left', titleSize: 11, pad: 10 });
  rows.forEach(([field, value, note], index) => line(field, value, note, 168 + index * 26));
});
