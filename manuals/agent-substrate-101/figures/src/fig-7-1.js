'use strict';

const fs = require('fs');
const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const { load } = require('../../../_shared/chart.js');
const { flat } = require('../../../_shared/forms.js');

const lab = path.join(__dirname, '../../capture/lab');
const summary = load(path.join(lab, 'summary/kagent-turns-x86.json'));
const TURN = 'A-spaced-02';
const rows = rel => fs.readFileSync(path.join(lab, rel), 'utf8').split('\n').filter(Boolean).map(line => line.split('\t'));
const stamp = text => {
  const [head, frac = ''] = text.replace(/Z$/, '').split('.');
  return Date.parse(`${head}Z`) / 1000 + Number(`0.${frac || 0}`);
};

const client = rows('K-kagent/latency/timings.tsv').find(row => row[1] === TURN);
const server = rows('K-kagent/latency/server-times.tsv').find(row => row[0] === `${TURN}.json`);
const answered = stamp(client[0]);
const sent = answered - Number(client[3]);
const recorded = stamp(server[1]);
const completed = stamp(server[2]);
const changes = rows('K-kagent/logs/actor-state-changes.tsv')
  .filter(row => row[1] === `session-${client[2]}`)
  .map(row => ({ t: stamp(row[0]), state: row[3] }))
  .filter(change => change.t > recorded && change.t < answered + 1);
const at = state => changes.find(change => change.state === state).t;
const plus = t => `+${(t - sent).toFixed(2)} s`;
const span = (a, b) => `${(b - a).toFixed(2)} s`;

const BASE = 58;
const lanes = [
  { x: 142, name: 'client', sub: 'kagent CLI', hue: 'olive', draw: (f, x) => flat.terminal(f, x, BASE - 34, 'olive') },
  { x: 252, name: 'kagent', sub: 'controller :8083', hue: 'plum', draw: (f, x) => flat.tower(f, x, BASE - 48, 'plum', { mark: 'kagent' }) },
  { x: 362, name: 'atenet-router', sub: 'agentgateway', hue: 'indigo', draw: (f, x) => flat.gateway(f, x, BASE - 44, 'indigo', { h: 44, mark: 'agentgateway' }) },
  { x: 472, name: 'ate-api-server', sub: 'ate-system', hue: 'blue', draw: (f, x) => flat.tower(f, x, BASE - 48, 'blue', { mark: 'substrate' }) },
  { x: 582, name: 'actor', sub: 'session-<uuid>', hue: 'green', draw: (f, x) => flat.stack(f, x, BASE - 38, 'green', { w: 42, h: 38 }) },
];
const steps = [
  { t: sent, from: 0, to: 1, style: 'call', label: 'message', note: 'A2A, with the Session id' },
  { t: recorded, from: 1, to: 2, style: 'call', label: 'ate-target-actor', note: 'mTLS, port 443' },
  { t: at('resuming'), from: 2, to: 3, style: 'call', label: 'ResumeActor', note: 'the router asks' },
  { t: at('running'), from: 3, to: 4, style: 'state', label: 'RUNNING', note: `resumed in ${span(at('resuming'), at('running'))}`, bold: true },
  { from: 2, to: 4, style: 'call', label: 'the turn', note: 'gRPC to port 80 of the actor' },
  { t: completed, from: 4, to: 1, style: 'reply', label: 'TASK_STATE_COMPLETED', note: `the turn ran ${span(at('running'), completed)}` },
  { t: at('suspending'), from: 1, to: 3, style: 'call', label: 'SuspendActor', note: 'synchronous, files only' },
  { t: answered, from: 1, to: 0, style: 'reply', label: 'answer', note: `${span(sent, answered)} at the client` },
  { t: at('suspended'), from: 3, to: 4, style: 'state', label: 'SUSPENDED', note: `suspended in ${span(at('suspending'), at('suspended'))}`, bold: true },
];
const ROW = 42;
const FIRST = 134;
const END = FIRST + (steps.length - 1) * ROW + 30;

module.exports = figure('fig-7-1', {
  height: END + 46,
  title: 'One recorded kagent turn resumes the Session actor, runs, and suspends it again',
  desc: `Five lifelines, each under a small drawing of its party: the client as a terminal, the kagent controller as a server with the kagent mark, atenet-router as a gateway with the agentgateway mark, ate-api-server as a server with the Agent Substrate mark, and the actor named session-uuid as three layers. Nine numbered exchanges show one recorded turn, each with its time from the moment the client sent the message. The router asks for ResumeActor and the actor is RUNNING ${span(at('resuming'), at('running'))} later. The turn runs. kagent calls SuspendActor, the client has its answer after ${span(sent, answered)}, and the actor is SUSPENDED after ${span(sent, at('suspended'))}.`,
}, f => {
  f.kicker(30, BASE + 30, 'time', { hue: 'ink-mute' });
  for (const lane of lanes) {
    lane.draw(f, lane.x);
    f.text(lane.x, BASE + 16, lane.name, { size: 11, weight: 700, hue: lane.hue, anchor: 'middle' });
    f.text(lane.x, BASE + 30, lane.sub, { size: 11, serif: true, hue: 'ink-soft', anchor: 'middle' });
    f.lifeline(lane.x, BASE + 36, END);
  }
  steps.forEach((step, index) => {
    const y = FIRST + index * ROW;
    f.step(14, y, index + 1, { hue: step.style === 'state' ? 'amber' : 'ink' });
    if (step.t !== undefined) f.text(30, y + 4, plus(step.t), { size: 11, hue: step.style === 'state' ? 'amber' : 'ink-soft', weight: step.bold ? 700 : undefined });
    const x1 = lanes[step.from].x;
    const x2 = lanes[step.to].x;
    f.arrow([x1, y], [x2 + (x2 > x1 ? -1 : 1), y], { style: step.style, label: step.label, note: step.note, labelX: (x1 + x2) / 2, bold: step.bold });
  });
  f.text(20, END + 18, `One recorded turn of 98. Over all of them the resume took ${summary.resume_seconds.turns_only.median.toFixed(3)} s at the median,`, { size: 11, serif: true, hue: 'ink-soft' });
  f.text(20, END + 34, `and the suspend took ${summary.suspend_seconds.median.toFixed(3)} s. The model was a mock server.`, { size: 11, serif: true, hue: 'ink-soft' });
});
