'use strict';

const { figure } = require('../../../_shared/figkit.js');

const agents = [
  { title: 'test-runner :41241', skills: ['run-tests'], tool: ['Git, CI runner', 'check out, run the suite'] },
  { title: 'code-reviewer :41242', skills: ['review-diff', 'answer-question'], tool: ['Git', 'fetch the base branch'] },
  { title: 'deployer :41243', skills: ['deploy'], tool: ['deploy API', 'roll out to staging'] },
];

const colW = 186;
const xs = [20, 227, 434];

module.exports = figure('fig-a2a-and-tools', {
  height: 414,
  title: 'A2A between agents, tools inside each one',
  desc: 'The planner, the client agent, sends SendMessage over A2A to three remote agents: test-runner on port 41241 with skill run-tests, code-reviewer on port 41242 with skills review-diff and answer-question, and deployer on port 41243 with skill deploy. The planner sees only these cards and endpoints. Below a dashed line, hidden from the planner, each agent runs its own logic and calls its own systems as tools: Git and a CI runner for test-runner, Git for code-reviewer, and a deploy API for deployer.',
}, f => {
  f.kicker(20, 18, 'Client agent');
  const planner = f.box({ x: 170, y: 26, w: 300, h: 44, hue: 'violet', title: 'planner', sub: 'delivers payments-api: tests, review, deploy' });

  f.kicker(20, 96, 'A2A · what the planner sees');
  f.rule(20, 102, 620, 102, { dash: 'dashed' });
  f.kicker(20, 230, 'Hidden from the planner');
  f.rule(20, 236, 620, 236, { dash: 'dashed' });
  f.text(320, 404, 'The kit simulates these systems in Python. A real agent calls them through MCP or any API.', { size: 11, serif: true, hue: 'ink-soft', anchor: 'middle' });

  f.beat(1);
  agents.forEach((agent, index) => {
    const x = xs[index];
    const mid = x + colW / 2;
    f.path(`M${planner.cx} ${planner.y + planner.h} V112 H${mid} V139`, { style: 'call' });
    f.text(mid + 6, 132, 'SendMessage', { size: 11.5 });
    f.box({ x, y: 140, w: colW, h: 62, hue: 'blue', title: agent.title, sub: agent.skills, titleSize: 12 });
  });

  f.beat(2);
  const logic = agents.map((agent, index) => f.box({ x: xs[index], y: 248, w: colW, h: 44, hue: 'plum', title: 'its own logic', sub: 'model and code', titleSize: 12 }));

  f.beat(3);
  agents.forEach((agent, index) => {
    const x = xs[index];
    const mid = x + colW / 2;
    f.arrow([mid, logic[index].y + logic[index].h], [mid, 335], { style: 'call', label: 'tool call', knock: true });
    f.box({ x, y: 336, w: colW, h: 46, hue: 'olive', title: agent.tool[0], sub: agent.tool[1], titleSize: 12 });
  });
});
