'use strict';

const { figure, color } = require('../../../_shared/figkit.js');

const LANE_TOP = [32, 236, 440];
const AGENT_X = 270;
const TRAY = [380, 612];
const TOWER = { cx: 80, oy: 594, size: 44 };

function pill(f, x, y, w, title, lines, hue, laterBeat) {
  const h = 26 + lines.length * 15;
  f.rect(x, y, w, h, { hue });
  f.text(x + 10, y + 18, title, { size: 12.5, weight: 700, max: w - 20 });
  const now = f.current;
  lines.forEach(([kind, content], index) => {
    const tone = { done: 'green', wait: 'amber' }[kind];
    if (laterBeat) f.beat(kind === 'wait' ? now : laterBeat);
    f.text(x + 10, y + 34 + index * 15, content, { size: 11, serif: !tone, hue: tone || 'ink-soft', max: w - 20 });
  });
  if (laterBeat) f.beat(now);
  return { x, y, w, h, bottom: y + h };
}

module.exports = figure('plate-planner-run', {
  height: 756,
  title: 'One planner, three remote agents',
  desc: 'The planner of the kit is a tall machine on the left with a slot for each of three lanes, in the order that the planner log records. In each lane the planner calls a remote agent, drawn as a machine with its port and skills, and the agent puts its task on a tray, one slip per state. test-runner completes with 13 passed, drawn as 13 cells on its top. code-reviewer asks which base branch to use, the planner answers main, and the task completes with one finding. deployer waits in TASK_STATE_AUTH_REQUIRED, the planner follows the task with SubscribeToTask, an operator outside A2A approves, and the task completes.',
}, f => {
  const face = (part, points, hue, opacity) => f.polygon(points.map(([u, v, k]) => part.P(u, v, k)), { fill: color(hue), fillOpacity: opacity });

  f.kicker(20, 18, 'client agent');
  f.kicker(196, 18, 'remote agent');
  f.kicker(380, 18, 'the task it runs');

  const planner = f.box({ x: 20, y: 32, w: 130, hue: 'violet', title: 'planner', sub: ['client agent', 'reads 3 cards'] });
  const towerView = f.isoView({ ox: 0, oy: TOWER.oy, angle: 'true' });
  const [tx, ty] = towerView.at(TOWER.cx, 0);
  const s = TOWER.size;
  const towerH = TOWER.oy - s / 2 - 112;
  const tower = f.isoBlock(towerView, { x: tx - s / 2, y: ty - s / 2, w: s, d: s, h: towerH, hue: 'violet' });
  face(tower, [[6, s, towerH - 12], [38, s, towerH - 12], [38, s, towerH - 62], [6, s, towerH - 62]], 'violet-ink', 0.85);
  for (const k of [towerH - 22, towerH - 36, towerH - 50]) face(tower, [[11, s, k], [33, s, k], [33, s, k - 8], [11, s, k - 8]], 'paper', 0.95);
  f.leader([planner.cx, planner.y + planner.h], [tower.top[0], tower.top[1] - 2], { hue: 'violet' });

  const slotOf = y => {
    const k = TOWER.oy + 3.5 - y;
    face(tower, [[s, 2, k - 14], [s, 12, k - 14], [s, 12, k + 14], [s, 2, k + 14]], 'violet-ink', 0.8);
    return tower.P(s, 0, k)[0] + 2;
  };

  const lanes = LANE_TOP.map((top, index) => {
    const oy = top + 150;
    const view = f.isoView({ ox: 0, oy, angle: 'true' });
    f.isoBeam(view, { sx0: 214, sx1: 626, c: 30, back: 64, h: 6, hue: 'paper', inkHue: 'ink-mute', ink: 1, shadow: false });
    return { index, top, oy, view, start: slotOf(oy - 21) };
  });

  const unit = (view, cx, size, h, hue, z) => {
    const [xc, yc] = view.at(cx, 0);
    return f.isoBlock(view, { x: xc - size / 2, y: yc - size / 2, w: size, d: size, h, z, hue, edges: h > 6 });
  };

  const agent = (lane, title, sub, hue) => {
    const label = f.box({ x: AGENT_X, anchor: 'middle', y: lane.top, w: 150, hue: 'blue', title, sub });
    const machine = unit(lane.view, AGENT_X, 46, 30, hue, 6);
    f.leader([AGENT_X, label.y + label.h], [machine.top[0], machine.top[1]], { hue: 'blue' });
    return machine;
  };

  const call = (lane, machine, dy, label) => {
    const left = machine.P(0, 46, 0)[0] - 2;
    f.arrow([lane.start, lane.oy + dy], [left, lane.oy + dy], { style: 'call', label });
  };

  const task = (lane, machine, id, lines, slips, doneBeat) => {
    f.arrow([machine.P(46, 0, 0)[0] + 2, lane.oy - 20], [TRAY[0] - 2, lane.oy - 20], { style: 'state' });
    f.isoBeam(lane.view, { sx0: TRAY[0], sx1: TRAY[1], c: 22, back: 44, h: 3, z: 6, hue: 'paper', inkHue: 'amber', ink: 1, shadow: false });
    const placed = [unit(lane.view, slips[0][0], 30, 4, slips[0][1], 9)];
    const label = pill(f, TRAY[0], lane.top, TRAY[1] - TRAY[0], `task ${id}`, lines, 'amber', doneBeat);
    f.leader([slips[0][0], label.bottom], [placed[0].top[0], placed[0].top[1]], { hue: slips[0][1] });
    if (doneBeat) f.beat(doneBeat);
    if (slips[1]) {
      placed.push(unit(lane.view, slips[1][0], 30, 4, slips[1][1], 9));
      f.leader([slips[1][0], label.bottom], [placed[1].top[0], placed[1].top[1]], { hue: slips[1][1] });
      f.arrow([slips[0][0] + 28, lane.oy - 11], [slips[1][0] - 28, lane.oy - 11], { style: 'state' });
    }
    return placed;
  };

  const [one, two, three] = lanes;

  f.beat(1);
  const tests = agent(one, 'test-runner', ['port 41241', 'skill run-tests'], 'blue');
  [5, 5, 3].forEach((count, row) => {
    for (let i = 0; i < count; i += 1) {
      const u = 5 + i * 8;
      const v = 7 + row * 12;
      face(tests, [[u, v, 30], [u + 5, v, 30], [u + 5, v + 8, 30], [u, v + 8, 30]], 'green-ink', 0.75);
    }
  });
  call(one, tests, -20, 'SendMessage');
  f.beat(2);
  task(one, tests, '954267b7', [['done', 'TASK_STATE_COMPLETED'], ['note', 'summary.json: 13 passed']], [[500, 'green']]);

  f.beat(3);
  const review = agent(two, 'code-reviewer', ['port 41242', 'skills review-diff,', 'answer-question'], 'blue');
  face(review, [[6, 46, 6], [40, 46, 6], [40, 46, 26], [6, 46, 26]], 'blue-ink', 0.85);
  [[21, 'paper', 26], [16, 'rose-fill', 18], [11, 'paper', 22]].forEach(([k, hue, end]) => face(review, [[10, 46, k], [10 + end, 46, k], [10 + end, 46, k - 2.4], [10, 46, k - 2.4]], hue, 0.95));
  call(two, review, -30, 'SendMessage');
  f.beat(4);
  task(two, review, '80bc7784', [['wait', 'TASK_STATE_INPUT_REQUIRED'], ['done', 'TASK_STATE_COMPLETED'], ['note', 'review.json: 1 finding']], [[450, 'amber'], [550, 'green']], 6);
  f.beat(5);
  call(two, review, -12, 'answer: main');

  f.beat(7);
  const deploy = agent(three, 'deployer', ['port 41243', 'skill deploy', 'bearer token required'], 'blue');
  face(deploy, [[15, 46, 8], [31, 46, 8], [31, 46, 22], [15, 46, 22]], 'amber-fill', 0.95);
  face(deploy, [[21.5, 46, 12], [24.5, 46, 12], [24.5, 46, 18], [21.5, 46, 18]], 'amber-ink', 0.9);
  call(three, deploy, -30, 'SendMessage');
  f.beat(8);
  const [auth] = task(three, deploy, 'a31361b3', [['wait', 'TASK_STATE_AUTH_REQUIRED'], ['done', 'TASK_STATE_COMPLETED'], ['note', 'build live on staging']], [[450, 'amber'], [550, 'green']], 10);
  f.beat(8);
  call(three, deploy, -12, 'SubscribeToTask');

  f.beat(9);
  const yard = f.isoView({ ox: 0, oy: 694, angle: 'true' });
  const operator = unit(yard, 450, 34, 22, 'grey', 0);
  const person = f.box({ x: 250, y: 652, w: 140, hue: 'grey', title: 'operator', sub: 'outside A2A' });
  f.leader([person.x + person.w, person.cy], operator.P(0, 34, 11), { hue: 'ink-mute' });
  f.arrow([450, operator.top[1] - 22], [450, three.oy + 18], { style: 'effect', label: 'approves' });

  f.beat(0);
  f.text(20, 744, 'Task ids shortened to 8 characters', { size: 11, serif: true, hue: 'ink-mute' });
});
