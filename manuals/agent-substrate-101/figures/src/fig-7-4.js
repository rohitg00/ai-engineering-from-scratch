'use strict';

const path = require('path');
const { figure, color } = require('../../../_shared/figkit.js');
const { load } = require('../../../_shared/chart.js');

const summary = name => load(path.join(__dirname, '../../capture/lab/summary', name));
const loss = summary('dependency-loss-x86.json').outages.postgres;
const idle = summary('failures-x86.json').idle_watch;
const resume = summary('resume-x86.json').node_local.points;
const kagent = summary('kagent-turns-x86.json');
const running = loss.summary.running;
const failed = Object.entries(running.codes).filter(([code]) => code !== '200').reduce((sum, [, count]) => sum + count, 0);
const at = mib => resume.find(point => point.x === mib).seconds.median.toFixed(2);
const stillRunning = idle.states.ACTOR_STATE_RUNNING === idle.samples_after_last_request;
if (!stillRunning) throw new Error('fig-7-4: the idle watch has a sample that is not RUNNING');
const actors = Math.max(...kagent.parallel_workers.map(sample => sample.actors));
const overhead = (kagent.resume_seconds.turns_only.median + kagent.suspend_seconds.median).toFixed(2);

const questions = [
  { ask: 'Does the agent run on CPU only?', proof: 'an actor cannot use a GPU at v1.0.0', choice: 'a pod for each agent', why: 'on a GPU node', hue: 'grey' },
  { ask: 'Is the agent idle most of the time?', proof: 'a busy actor holds its worker all day', choice: 'a pod for each agent', why: 'you free no capacity', hue: 'grey' },
  { ask: 'Must state outlive the idle time?', proof: `a resume took ${at(200)} s at 200 MiB, ${at(1000)} s at 1000 MiB`, choice: 'a sandbox for each session', why: 'no snapshot, no object store', hue: 'grey' },
  { ask: 'Can you operate Postgres?', proof: `Postgres away for ${loss.outage_seconds} s: ${failed} requests failed`, choice: 'a hosted sandbox', why: 'an API and no cluster', hue: 'grey' },
  { ask: 'Does something call SuspendActor?', proof: `idle for ${idle.seconds} s: still RUNNING in every sample`, choice: 'a harness first', why: 'kagent suspends after each turn', hue: 'plum' },
];
const LEFT = 20;
const WIDE = 356;
const RIGHT = 420;
const TOP = 34;
const TALL = 52;
const PITCH = 76;

module.exports = figure('fig-7-4', {
  height: 500,
  title: 'Five questions that decide if Agent Substrate fits',
  desc: `Five questions in a column, each with the fact or the run behind it. A no on any question leads right to a simpler choice: a pod for each agent on a GPU node, a pod for each agent, a sandbox for each session, a hosted sandbox, or a harness that must come first. Five yes answers lead to Agent Substrate, where one worker ran ${actors} actors at one time and a kagent turn paid ${overhead} seconds of resume and suspend.`,
}, f => {
  f.kicker(LEFT, 20, 'answer in this order');
  f.kicker(RIGHT, 20, 'on the first no, choose');
  questions.forEach((question, index) => {
    const y = TOP + index * PITCH;
    f.rect(LEFT, y, WIDE, TALL, { fill: color('paper'), stroke: color('ink') });
    f.step(LEFT + 22, y + TALL / 2, index + 1);
    f.text(LEFT + 44, y + 22, question.ask, { size: 12.5, weight: 700 });
    f.text(LEFT + 44, y + 40, question.proof, { size: 11, serif: true, hue: 'ink-soft' });
    f.arrow([LEFT + WIDE, y + TALL / 2], [RIGHT - 1, y + TALL / 2], { style: 'call', label: 'no' });
    f.box({ x: RIGHT, y: y + 3, w: 200, h: TALL - 6, hue: question.hue, title: question.choice, titleSize: 11.5, sub: question.why, pad: 6 });
    f.arrow([LEFT + 22, y + TALL], [LEFT + 22, y + PITCH - 1], { style: 'call', label: 'yes' });
  });
  const y = TOP + questions.length * PITCH;
  f.rect(LEFT, y, 600, 76, { hue: 'blue', strokeWidth: 2.4 });
  f.text(LEFT + 20, y + 30, 'Choose Agent Substrate', { size: 16, weight: 700, hue: 'blue' });
  f.text(LEFT + 20, y + 50, 'many stateful actors on few worker pods', { size: 12, serif: true });
  f.text(LEFT + 20, y + 66, `one worker ran ${actors} actors at one time, and a kagent turn paid ${overhead} s of resume and suspend`, { size: 11, serif: true, hue: 'ink-soft' });
});
