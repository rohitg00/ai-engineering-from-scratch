'use strict';

const { figure } = require('../../../_shared/figkit.js');

module.exports = figure('fig-5-8', {
  height: 420,
  title: 'The path of a failed node attempt',
  desc: 'A decision figure. A node attempt raises, or runs past its timeout and fails with NodeTimeoutError. The first check is retry_on with attempts left: yes runs the node again, as flaky did for tries 1 to 3 with retry_on ValueError. With no attempt left, or an exception that retry_on refuses, the next check is an error_handler. With a handler, the node __error_handler__flaky runs and its Command goes to report. With no handler, invoke raises, as ValueError upstream failed on try 1 did with the default retry_on.',
}, f => {
  const attempt = f.box({ x: 170, y: 14, w: 300, h: 44, hue: 'indigo', title: 'a node attempt fails', sub: 'an exception, or NodeTimeoutError' });
  f.box({ x: 500, y: 14, w: 126, h: 44, hue: 'grey', title: 'timeout', sub: 'slow, 0.05 s', titleSize: 12, pad: 6 });
  f.arrow([499, 36], [attempt.x + attempt.w + 1, 36], { style: 'fail' });
  const retry = f.box({ x: 170, y: 100, w: 300, h: 44, hue: 'grey', title: 'retry_on matches, attempts left?', sub: 'RetryPolicy of the node' });
  f.arrow([320, 58], [320, 99], { style: 'fail' });
  f.path('M170 122 H150 V36 H169', { style: 'call' });
  f.text(20, 74, 'yes: run again', { size: 11.5, weight: 700 });
  f.text(20, 90, 'flaky, tries 1 to 3', { size: 11, serif: true, hue: 'ink-soft' });
  f.box({ x: 170, y: 196, w: 300, h: 44, hue: 'grey', title: 'error_handler set?', sub: 'on the node or by set_node_defaults' });
  f.arrow([320, 144], [320, 195], { style: 'call', label: 'no', note: 'ValueError with the default retry_on' });
  const node = f.box({ x: 20, y: 296, w: 280, h: 44, hue: 'indigo', title: '__error_handler__flaky', sub: "Command(goto='report')" });
  f.path(`M260 240 V268 H160 V${node.y - 1}`, { style: 'call' });
  f.text(150, 262, 'yes', { size: 11.5, weight: 700, anchor: 'end' });
  const raise = f.box({ x: 340, y: 296, w: 280, h: 44, hue: 'rose', title: 'invoke raises', sub: 'ValueError: upstream failed on try 1' });
  f.path(`M380 240 V268 H480 V${raise.y - 1}`, { style: 'fail' });
  f.text(490, 262, 'no', { size: 11.5, weight: 700 });
  f.box({ x: 20, y: 364, w: 280, h: 44, hue: 'indigo', title: 'report', sub: 'status: recovered from flaky' });
  f.arrow([160, 340], [160, 363], { style: 'call' });
  f.text(340, 392, 'The run goes on only on the left path.', { size: 11, serif: true, hue: 'ink-soft' });
  f.text(340, 408, 'The right path ends the run.', { size: 11, serif: true, hue: 'ink-soft' });
});
