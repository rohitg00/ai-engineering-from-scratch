'use strict';

const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const { load } = require('../../../_shared/chart.js');

const runs = load(path.join(__dirname, '../../capture/lab/summary/node-loss-x86.json'));
const one = value => value.toFixed(1);
const two = value => value.toFixed(2);
const byCase = key => runs.cases.find(item => item.case === key);
const back = key => runs.node_return.runs.find(item => item.case === key);
const down = runs.detection.workers_unavailable_t;
const rescue = runs.tag_rescue;
const quiet = byCase('a');
const pending = byCase('c-return');
const pendingOk = pending.served.find(item => item.event === 'w1-request-without-revert');
const pendingReverted = pending.served.find(item => item.event === 'v3-request-after-revert');
const crashed = back('b');
const running = back('d');
const last = runs.second_revert[runs.second_revert.length - 1];
const lastOk = byCase('a2').served[0];
const failed = runs.second_revert.filter(item => !item.ok).length;
const stuck = runs.node_return.runs.filter(item => item.actor_state_at_end === 'ACTOR_STATE_REVERTING');
const stuckFrom = Math.floor(Math.min(...stuck.map(item => item.watched_seconds)) / 10) * 10;

const rows = [
  {
    hue: 'teal',
    state: ['any state, with a tag', 'made before the stop'],
    act: 'create actor --tag',
    how: ['a new actor from the tag,', 'then send requests to it'],
    result: `200 after ${one(rescue[0].seconds_after_create)} s`,
    cost: [`${rescue.length} of ${rescue.length} rescues, on the`, 'other node. New actor name'],
  },
  {
    hue: 'amber',
    state: ['SUSPENDED, --mode sync,', 'no request since the stop'],
    act: 'wait, then one revert',
    how: ['for workers UNAVAILABLE,', `${Math.round(down.min)} to ${Math.round(down.max)} s after the stop`],
    result: `revert ${one(quiet.commands.runs[0].seconds)} s, 200 in ${two(quiet.served[0].seconds)} s`,
    cost: ['on the other node', 'nothing lost'],
  },
  {
    hue: 'amber',
    state: ['SUSPENDED in the default', 'mode, snapshot PENDING'],
    act: 'send no command',
    how: ['wait for the node, then', 'send the request only'],
    result: `200 in ${two(pendingOk.seconds)} s`,
    cost: [`${Math.round(pendingOk.t - pending.node_start_t)} s after the node start.`, `A revert first loses ${pendingOk.count - 1 - (pendingReverted.count - 1)} calls`],
  },
  {
    hue: 'rose',
    state: ['got a request: RESUMING,', 'then CRASHED. Or RUNNING'],
    act: 'no revert, no delete',
    how: ['wait for the node, then', 'one revert'],
    result: `revert ${one(crashed.revert_after_return[0].seconds)} s, 200 in ${two(crashed.served_after_return[0].seconds)} s`,
    cost: [`RUNNING: 200 in ${two(running.served_after_return[0].seconds)} s, work`, 'since the snapshot is lost'],
  },
  {
    hue: 'rose',
    dash: 'dashed',
    state: ['REVERTING or DELETING,', 'from an earlier command'],
    act: 'wait for the node',
    how: [`${failed} of ${failed} reverts failed.`, 'With atelet back: revert'],
    result: `revert ${one(last.seconds)} s, 200 in ${two(lastOk.seconds)} s`,
    cost: ['in 1 run. In 4 runs: still', `REVERTING ${stuckFrom} s after return`],
  },
];

module.exports = figure('fig-8-2d', {
  height: 498,
  title: 'A node stopped: what to do with one actor',
  desc: `A decision figure with five rows, from the node-stop runs on a cluster with two worker nodes. Row one: with a tag made before the stop, a new actor from the tag served its first request ${one(rescue[0].seconds_after_create)} seconds after the create command, in ${rescue.length} of ${rescue.length} rescues. Row two: an actor suspended with mode sync that got no request can be reverted after the workers show UNAVAILABLE, ${Math.round(down.min)} to ${Math.round(down.max)} seconds after the stop, and the revert took ${one(quiet.commands.runs[0].seconds)} seconds. Row three: an actor suspended in the default mode with a pending snapshot needs no command and served a request ${Math.round(pendingOk.t - pending.node_start_t)} seconds after the node start. Row four: an actor that got a request or was running needs the node back and then one revert. Row five: an actor left in REVERTING or DELETING by a command during the outage stays there until the node returns.`,
}, f => {
  f.kicker(20, 18, 'The actor at the stop');
  f.kicker(212, 18, 'What to do');
  f.kicker(404, 18, 'What we measured');
  rows.forEach((row, index) => {
    const y = 28 + index * 90;
    const state = f.box({ x: 20, y, w: 178, h: 72, hue: row.hue, dash: row.dash, align: 'left', pad: 9, sub: row.state });
    const act = f.box({ x: 212, y, w: 178, h: 72, hue: index === 0 ? 'teal' : 'grey', align: 'left', pad: 9, title: row.act, titleSize: 11.5, sub: row.how });
    const result = f.box({ x: 404, y, w: 216, h: 72, hue: index === 4 ? 'rose' : 'green', align: 'left', pad: 8, title: row.result, titleSize: 11, sub: row.cost });
    f.arrow(state.right(), [act.x - 1, state.cy], { style: 'call' });
    f.arrow(act.right(), [result.x - 1, act.cy], { style: index === 4 ? 'fail' : 'state' });
  });
  f.text(20, 484, 'One run for each case on two worker nodes, Envoy dataplane, default timers.', { size: 11, serif: true, hue: 'ink-soft' });
});
