'use strict';

const { figure } = require('../../../_shared/figkit.js');

module.exports = figure('fig-3-1', {
  height: 320,
  title: 'The inspect-artifact record for ledger-arm64-O1',
  desc: 'One Evidence record from the rea-artifact-graph provider. Its subject is ledger-arm64-O1, a 33872-byte Mach-O whose SHA-256 starts 01b5d08b. One substep, inventory_artifact, produced a manifest with one node, one occurrence and no edges. One unexplored branch says open_binary was not run, and the next probe names open_binary with authority native-analysis-provider.',
}, f => {
  f.kicker(20, 18, 'the record');
  f.kicker(360, 18, 'what it saw');
  const record = f.box({ x: 20, y: 26, w: 280, h: 62, hue: 'teal', title: 'Evidence ev_0e878985', sub: ['operation inspect_artifact', 'confidence observed · no analysis engine'] });
  const subject = f.box({ x: 360, y: 26, w: 260, h: 62, hue: 'green', title: 'subject ledger-arm64-O1', sub: ['format mach-o · 33872 bytes', 'sha256 starts 01b5d08b'] });
  f.arrow(record.right(), [subject.x - 1, record.cy], { style: 'call', label: 'hashes', packet: false });
  const substep = f.box({ x: 20, y: 118, w: 280, h: 62, hue: 'blue', title: 'substep inventory_artifact', sub: ['status completed · its own Evidence', 'manifest agm_8e2e5c4c · 1 node · 0 edges'] });
  f.arrow(record.bottom(), [record.cx, substep.y - 1], { style: 'call', label: 'runs', packet: false });
  const occurrence = f.box({ x: 360, y: 118, w: 260, h: 62, hue: 'green', title: 'occurrence occ_35a9bb48', sub: ['logical_path . · entry_kind file', 'kind executable · hash verified'] });
  f.arrow(substep.right(), [occurrence.x - 1, substep.cy], { style: 'call', label: 'records', packet: false });
  const branch = f.box({ x: 20, y: 210, w: 280, h: 62, hue: 'amber', dash: 'dashed', title: 'unexplored_branches[0]', sub: ['reason format-specific-analysis-required', 'open_binary was not run'] });
  f.arrow(substep.bottom(), [substep.cx, branch.y - 1], { style: 'state', label: 'leaves', packet: false });
  const probe = f.box({ x: 360, y: 210, w: 260, h: 62, hue: 'blue', title: 'next_probe open_binary', sub: ['authority native-analysis-provider', 'bind one deep provider first'] });
  f.arrow(branch.right(), [probe.x - 1, branch.cy], { style: 'state', label: 'next', packet: false });
  f.text(20, 304, 'coverage complete-within-substeps · 1 substep · 1 observation · 1 branch · 1 probe · 0 omitted', { size: 11, serif: true, hue: 'ink-soft' });
});
