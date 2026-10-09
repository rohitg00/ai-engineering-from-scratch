'use strict';

const { figure } = require('../../../_shared/figkit.js');

const rows = [
  { y: 50, hue: 'olive', question: 'preempt_yolo hook', ask: 'log-hook.sh, on every call', style: 'reply', outHue: 'grey', out: 'allow, as advice only', detail: ['pre_tool_use_pre_yolo, allowed: true', 'a deny or ask here would end the call'], next: 'go on' },
  { y: 122, hue: 'teal', question: 'a deny pattern matches?', ask: 'shell:cmd=rm*', style: 'fail', outHue: 'rose', out: 'rm -rf work/m101-nothing', detail: ['Tool \'shell\' is denied by', 'permissions configuration.'], next: 'no' },
  { y: 194, hue: 'teal', question: 'an allow pattern matches?', ask: 'shell:cmd=echo*', style: 'effect', outHue: 'olive', out: 'echo m101-ok runs', detail: ['result m101-ok in both modes'], next: 'no' },
  { y: 266, hue: 'teal', question: 'an ask pattern matches?', ask: 'guarded.yaml has none', next: 'no' },
  { y: 338, hue: 'amber', question: 'safety mode on the label', ask: 'pwd has the label safe', style: 'effect', outHue: 'olive', out: 'restricted: pwd runs', detail: ['result $CAPTURE'], next: 'strict' },
  { y: 410, hue: 'amber', question: 'strict: ask the user', ask: 'default hooks first, none here', style: 'fail', outHue: 'rose', out: 'no terminal under --exec', detail: ['The user rejected the tool call.'] },
];

module.exports = figure('fig-5-5', {
  height: 482,
  title: 'Three shell calls through the approval order',
  desc: 'The approval order for the shell calls of capture/fixtures/agents/guarded.yaml, top down. The preempt_yolo hook log-hook.sh runs on every call and returns allow, which is advice only. A deny pattern shell:cmd=rm* blocks rm -rf work/m101-nothing with Tool shell is denied by permissions configuration. An allow pattern shell:cmd=echo* runs echo m101-ok in both modes. The file has no ask patterns. The safety mode then decides pwd, which has the label safe: restricted runs it and prints the capture directory, and strict asks the user, which under exec with no terminal ends as The user rejected the tool call.',
}, f => {
  f.kicker(20, 18, 'shell calls of guarded.yaml, --safety strict and restricted');
  f.kicker(20, 36, '20-strict.ndjson, 20-restricted.ndjson');
  rows.forEach((row, index) => {
    const ask = f.box({ x: 20, y: row.y, w: 250, h: 52, hue: row.hue, title: row.question, sub: row.ask, titleSize: 12 });
    if (row.out) {
      const out = f.box({ x: 300, y: row.y, w: 320, h: 52, hue: row.outHue, title: row.out, sub: row.detail, titleSize: 12 });
      f.arrow(ask.right(), [out.x - 1, ask.cy], { style: row.style });
    }
    if (index < rows.length - 1) f.arrow([80, row.y + 52], [80, row.y + 71], { style: 'call', label: row.next, labelSize: 11 });
  });
});
