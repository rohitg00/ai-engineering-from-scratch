'use strict';

const { figure, color } = require('../../../_shared/figkit.js');

const plan = [
  ['+', 'kits: source $CAPTURE/fixtures/kits/hello-mixin'],
  [' ', 'workspace: $CAPTURE/fixtures/env (not recorded as applied, needs your approval)'],
  ['+', 'env: GREETING: hello'],
  ['+', 'sandbox: name m101-env, agent shell'],
  ['+', 'ports: sandbox 8080, protocol tcp4, host 18083'],
  ['+', 'lifecycle: initialize: command echo init, workdir $CAPTURE/fixtures/env'],
  [' ', 'Plan: + 5 to add, ~ 0 to change, - 0 to destroy.'],
  [' ', 'runs commands on this machine, outside the sandbox, with your own privileges'],
];

module.exports = figure('fig-4-4', {
  height: 600,
  title: 'An environment file becomes a plan, an approval, and a state record',
  desc: 'Top: the captured sbxenv.yaml with its agent, workspace, args, kits, env, lifecycle, and ports keys. An arrow for sbx env plan leads to the plan it printed, eight rows with a plus sign in the margin for each addition, the workspace row that needs approval, the totals line, and the warning that host commands run outside the sandbox. Below, two branches. Left: approval on sbx env create writes the state record under the sbx state directory, and a later plan prints only the rows that moved. Right: the same plan with the env-arg greeting set to servus still prints every row as an addition because nothing was applied.',
}, f => {
  f.kicker(20, 18, 'the file (capture/fixtures/env/sbxenv.yaml)');
  const file = f.box({ x: 20, y: 26, w: 600, h: 80, hue: 'green', title: 'sbxenv.yaml', sub: ['schemaVersion 1, name m101-env, agent shell, workspace ., args greeting (default hello),', 'kits ../kits/hello-mixin, env GREETING: ${{ env.args.greeting }},', 'lifecycle initialize echo init, ports sandbox 8080 host 18083'], align: 'left' });
  f.arrow([file.cx, 106], [file.cx, 137], { style: 'call', label: 'sbx env plan ./fixtures/env' });

  f.rect(20, 138, 600, 222, { fill: color('teal-fill'), stroke: color('teal-ink') });
  f.text(32, 158, 'ENVIRONMENT PLAN m101-env (14-env-plan.txt)', { size: 12, weight: 700, hue: 'teal' });
  plan.forEach(([sign, text], index) => {
    const y = 166 + index * 22;
    f.rect(32, y, 576, 20, { fill: color('paper'), stroke: color('panel-edge') });
    if (sign !== ' ') f.text(40, y + 14, sign, { size: 11, weight: 700, hue: 'teal' });
    f.text(54, y + 14, text, { size: 11 });
  });
  f.text(32, 354, 'margin symbols: + add, ~ change, - destroy, > run, ! forget (help-sbx sbx env)', { size: 11, serif: true, hue: 'ink-soft' });

  f.kicker(60, 392, 'after approval (not captured)');
  f.kicker(380, 392, 'one argument changed (captured)');
  f.box({ x: 20, y: 402, w: 280, h: 48, hue: 'grey', title: 'you answer y on sbx env create', sub: 'host commands are asked on every invocation', titleSize: 12, pad: 8 });
  const state = f.box({ x: 20, y: 480, w: 280, h: 48, hue: 'teal', title: 'state record, per environment', sub: 'in the sbx state directory, not by the file', titleSize: 12, pad: 8 });
  f.box({ x: 20, y: 536, w: 280, h: 48, hue: 'teal', dash: 'dashed', title: 'a later plan shows what moved', sub: '~ GREETING: hello -> servus, nothing else', titleSize: 12, pad: 8 });
  f.arrow([40, 360], [40, 401], { style: 'call', label: 'sbx env create' });
  f.arrow([40, 450], [40, 479], { style: 'write', label: 'records the plan' });
  f.path(`M${state.cx} 528 V535`, { style: 'state', head: false });
  f.box({ x: 340, y: 402, w: 280, h: 48, hue: 'blue', title: 'sbx env plan --env-arg greeting=servus', sub: 'the arg replaces the default hello', titleSize: 11.5, pad: 8 });
  f.box({ x: 340, y: 480, w: 280, h: 48, hue: 'teal', title: '+ env: GREETING: servus', sub: 'still + 5 to add: nothing was applied', titleSize: 12, pad: 8 });
  f.arrow([360, 360], [360, 401], { style: 'call', label: 'one argument' });
  f.arrow([360, 450], [360, 479], { style: 'reply', packet: false });
});
