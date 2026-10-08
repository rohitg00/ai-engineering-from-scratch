'use strict';

const { figure, color } = require('../../../_shared/figkit.js');

const ORIGIN = Date.UTC(2025, 8, 1);
const MONTH = 40;
const xOf = iso => {
  const [y, m, d] = iso.split('-').map(Number);
  return Math.round(60 + ((Date.UTC(y, m - 1, d) - ORIGIN) / (30.44 * 86400000)) * MONTH);
};

const events = [
  { n: 1, date: '2025-09-18', track: 'agent', row: 'old', text: '2025-09-18: cagent launch blog, the public repo dates from 2025-09-01' },
  { n: 2, date: '2025-10-23', track: 'agent', row: 'old', text: '2025-10-23: Desktop 4.49.0 bundles the agent, later renamed in the notes' },
  { n: 3, date: '2025-11-06', track: 'sandbox', row: 'old', text: '2025-11-06: Desktop 4.50.0, container-based docker sandbox run (plan timeline)' },
  { n: 4, date: '2026-01-26', track: 'sandbox', row: 'old', removal: true, text: '2026-01-26: Desktop 4.58.0, microVM sandboxes, --mount-docker-socket gone' },
  { n: 5, date: '2026-02-16', track: 'agent', row: 'new', text: '2026-02-16 and 02-19: v1.23.3 docker agent plugin, v1.23.4 restructure' },
  { n: 6, date: '2026-02-18', track: 'sandbox', row: 'old', text: '2026-02-18: Desktop 4.61.0 bundles plugin v0.12.0, the legacy help quoted here' },
  { n: 7, date: '2026-03-09', track: 'agent', row: 'new', text: '2026-03-09: v1.30.0 completes the rename to docker-agent, CAGENT_* still read' },
  { n: 8, date: '2026-03-31', track: 'sandbox', row: 'new', text: '2026-03-31: v0.21.0, the first public standalone sbx tag' },
  { n: 9, date: '2026-06-29', track: 'sandbox', row: 'old', removal: true, text: '2026-06-29: Desktop 4.80.0 removes the docker sandbox plugin' },
  { n: 10, date: '2026-07-06', track: 'agent', row: 'old', removal: true, text: '2026-07-06: Desktop 4.81.0 removes the cagent binary' },
  { n: 11, date: '2026-09-21', track: 'sandbox', row: 'new', text: '2026-09-21: v0.45.0 adds sbx --cloud and v3 kits' },
  { n: 12, date: '2026-10-07', track: 'sandbox', row: 'new', text: '2026-10-05 and 10-07: v0.47.0 and v1.149.0, the pin of this manual' },
];

const tracks = {
  sandbox: { label: 'sandboxes', old: 62, new: 96, oldSpan: ['2025-11-06', '2026-06-29'], newSpan: ['2026-03-31', '2026-10-07'], hue: 'blue', oldName: 'docker sandbox plugin', newName: 'sbx' },
  agent: { label: 'agent', old: 160, new: 194, oldSpan: ['2025-09-18', '2026-07-06'], newSpan: ['2026-02-16', '2026-10-07'], hue: 'violet', oldName: 'cagent', newName: 'docker-agent' },
};

module.exports = figure('fig-7-3', {
  height: 516,
  title: 'Two product tracks from 2025-09 to 2026-10',
  desc: 'Two tracks over one date axis from 2025-09 to 2026-10. The sandboxes track shows the docker sandbox plugin as a grey bar from 2025-11-06 to its removal in Desktop 4.80.0 on 2026-06-29, and sbx as a blue bar from v0.21.0 on 2026-03-31 to v0.47.0 on 2026-10-05. The agent track shows cagent as a grey bar from the 2025-09-18 launch blog to its removal in Desktop 4.81.0 on 2026-07-06, and docker-agent as a violet bar from the v1.23.3 plugin on 2026-02-16 to v1.149.0 on 2026-10-07. Rose lines mark three removals: the socket mount with Desktop 4.58.0, the plugin with 4.80.0, and the cagent binary with 4.81.0. A numbered key lists all twelve events.',
}, f => {
  for (const track of Object.values(tracks)) {
    f.kicker(20, track.old - 18, track.label);
    f.rect(xOf(track.oldSpan[0]), track.old, xOf(track.oldSpan[1]) - xOf(track.oldSpan[0]), 16, { fill: color('grey-fill'), stroke: color('grey-ink') });
    f.rect(xOf(track.newSpan[0]), track.new, xOf(track.newSpan[1]) - xOf(track.newSpan[0]), 16, { fill: color(`${track.hue}-fill`), stroke: color(`${track.hue}-ink`) });
    f.text(xOf(track.oldSpan[0]) - 6, track.old + 12, track.oldName, { size: 11, hue: 'grey', anchor: 'end' });
    f.text(xOf(track.newSpan[0]) + 12, track.new - 7, track.newName, { size: 11, hue: track.hue });
  }
  for (const event of events.filter(item => item.removal)) {
    const track = tracks[event.track];
    const x = xOf(event.date);
    const cy = (event.row === 'old' ? track.old : track.new) + 8;
    f.rule(x, 30, x, cy - 12, { hue: 'rose', dash: 'dashed', width: 1.4 });
    f.rule(x, cy + 12, x, 226, { hue: 'rose', dash: 'dashed', width: 1.4 });
  }
  f.rule(60, 236, 620, 236, { hue: 'ink' });
  for (const [label, date] of [['2025-09', '2025-09-01'], ['2025-12', '2025-12-01'], ['2026-03', '2026-03-01'], ['2026-06', '2026-06-01'], ['2026-09', '2026-09-01']]) {
    const x = xOf(date);
    f.rule(x, 232, x, 240, { hue: 'ink' });
    f.text(x, 254, label, { size: 11, anchor: 'middle', hue: 'ink-soft' });
  }
  for (const event of events) {
    const track = tracks[event.track];
    const y = event.row === 'old' ? track.old + 8 : track.new + 8;
    f.step(xOf(event.date), y, event.n, { hue: event.removal ? 'rose' : track.hue });
  }
  f.kicker(20, 282, 'key');
  events.forEach((event, index) => {
    const y = 302 + index * 18;
    f.step(30, y - 4, event.n, { hue: event.removal ? 'rose' : tracks[event.track].hue });
    f.text(48, y, event.text, { size: 11, serif: true });
  });
});
