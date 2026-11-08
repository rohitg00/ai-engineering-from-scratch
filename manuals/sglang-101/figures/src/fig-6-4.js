'use strict';

const { figure } = require('../../../_shared/figkit.js');

module.exports = figure('fig-6-4', {
  height: 336,
  title: 'How cache_aware picks a server',
  desc: 'A decision flow. First the gateway tests whether loads are imbalanced: the busiest minus the lightest is more than 64 and the busiest is more than 1.5 times the lightest. If yes, the request goes to the least-loaded server. If no, the gateway computes the match rate against its character tree. Above 0.3 the request goes to the server with the longest match. At 0.3 or below it goes to the least-loaded server. Every outcome inserts the request text into the tree.',
}, f => {
  const request = f.box({ x: 230, y: 12, w: 180, h: 32, hue: 'olive', title: 'request text' });
  const balance = f.box({ x: 150, y: 74, w: 290, h: 50, hue: 'amber', title: 'imbalanced?', sub: ['max - min > 64 and max > 1.5 x min'] });
  const match = f.box({ x: 150, y: 168, w: 340, h: 50, hue: 'amber', title: 'match rate > 0.3?', sub: ['matched characters / request characters'] });
  const leastA = f.box({ x: 500, y: 74, w: 130, h: 50, hue: 'blue', title: 'least-loaded', sub: ['server'] });
  const longest = f.box({ x: 150, y: 262, w: 200, h: 50, hue: 'blue', title: 'longest match', sub: ['server in the tree'] });
  const leastB = f.box({ x: 410, y: 262, w: 220, h: 50, hue: 'blue', title: 'least-loaded', sub: ['random among ties'] });
  f.arrow([320, request.y + request.h], [320, balance.y - 1], { style: 'call' });
  f.arrow(balance.right(), [leastA.x - 1, balance.cy], { style: 'call', label: 'yes', labelX: 470 });
  f.arrow([320, balance.y + balance.h], [320, match.y - 1], { style: 'call', label: 'no' });
  f.arrow([250, match.y + match.h], [250, longest.y - 1], { style: 'call', label: 'yes' });
  f.arrow([470, match.y + match.h], [470, leastB.y - 1], { style: 'call', label: 'no' });
  f.text(20, 98, 'step 1', { size: 11, hue: 'ink-mute' });
  f.text(20, 192, 'step 2', { size: 11, hue: 'ink-mute' });
  f.text(20, 286, 'step 3', { size: 11, hue: 'ink-mute' });
  f.text(20, 330, 'every outcome inserts the request text under the chosen server', { size: 11, serif: true, hue: 'ink-soft' });
});
