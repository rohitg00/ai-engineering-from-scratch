'use strict';

const fs = require('fs');
const path = require('path');
const { figure, color } = require('../../../_shared/figkit.js');
const forms = require('../../../_shared/forms.js');

const capture = name => fs.readFileSync(path.join(__dirname, '../../capture', name), 'utf8');
const section = (text, heading) => {
  const start = text.indexOf(heading);
  if (start < 0) throw new Error(`plate-langchain-run: no "${heading}"`);
  const end = text.indexOf('\n## ', start + heading.length);
  return text.slice(start + heading.length, end < 0 ? undefined : end);
};
const values = text => {
  const found = [];
  const open = /^[[{]/gm;
  let match;
  while ((match = open.exec(text))) {
    let depth = 0;
    let quoted = false;
    let i = match.index;
    for (; i < text.length; i += 1) {
      const c = text[i];
      if (quoted) {
        if (c === '\\') i += 1;
        else if (c === '"') quoted = false;
      } else if (c === '"') quoted = true;
      else if (c === '[' || c === '{') depth += 1;
      else if (c === ']' || c === '}') {
        depth -= 1;
        if (!depth) break;
      }
    }
    found.push(JSON.parse(text.slice(match.index, i + 1)));
    open.lastIndex = i + 1;
  }
  return found;
};

const run = capture('out/06-agent-run.txt');
const [, messages] = values(section(run, '## final state'));
const [calls] = values(section(run, '## what the model received on each call'));
const [human, asked, tool, answer] = messages;
const toolCall = asked.tool_calls[0];
const callText = `${toolCall.name}(${Object.entries(toolCall.args).map(([k, v]) => `${k}=${v}`).join(', ')})`;
const system = calls[0].messages[0].replace(/^system: /, '');

const graph = capture('out/05-agent-graph.txt');
const [nodes] = values(section(graph, '## nodes'));
const graphType = /^type \S+\.(\w+)$/m.exec(graph)[1];

const memory = capture('out/28-checkpoint-memory.txt');
const thread = values(section(memory, '## the raw checkpoint tuple'))[0].config.configurable.thread_id;

const history = values(section(capture('out/30-state-history-forks.txt'), '## get_state_history, newest first')).reverse();
const steps = history.map(h => h.step);
const nextOf = h => (h.next.length ? h.next.join(', ') : '()');

const traced = section(capture('out/42-langsmith.txt'), '## a create_agent run inside a local trace');
const [requests] = values(traced);
const posts = requests['POST /runs'];
const patches = Object.entries(requests).find(([key]) => key.startsWith('PATCH '))[1];

const versions = capture('out/00-versions.txt');
const pin = name => new RegExp(`^${name}==(\\S+)$`, 'm').exec(versions)[1];
const python = /^python (\S+)$/m.exec(versions)[1];

const overhead = JSON.parse(capture('lab/summary/overhead-mac.json'));
const stub = overhead.stub;
const machine = overhead.machine.replace(/^the Mac: /, '').split(',')[0];
const ms = value => `${value.toFixed(2)} ms`;
const plain = stub.a_plain_openai.median_ms;
const agent = stub.c_create_agent.median_ms;
const saver = stub.d_create_agent_saver.median_ms;

if (!['model', 'tools'].every(name => nodes.includes(name))) throw new Error('plate-langchain-run: the graph has no model and tools nodes');

const OX = 250;
const UP = 140;
const DOWN = 410;

module.exports = figure('plate-langchain-run', {
  height: 700,
  title: 'One invoke, two model calls, one tool call',
  desc: `An isometric drawing of one create_agent run in one Python process. Above, on a LangChain layer, sit your code as a violet terminal, the chat model as a plum tower, and the tool ${toolCall.name} as a green unit. Below, the ${graphType} from create_agent is an indigo shell with the LangGraph mark. It holds the model and tools nodes and the messages channel, drawn as four sheets. Your code calls invoke with ${human.content} Model call 1 returns an AIMessage with the tool call ${callText}. The tools node runs ${toolCall.name} and returns a ToolMessage of ${tool.content}. Model call 2 returns ${answer.content} The graph puts ${history.length} checkpoints in InMemorySaver, steps ${steps[0]} to ${steps[steps.length - 1]}, and the last has no next node. Off to the right, LangSmith is a dashed tower that gets ${posts} runs only when tracing is on. On the Mac, ${machine}, create_agent took ${ms(agent)} per run against ${ms(plain)} for a plain openai loop.`,
}, f => {
  const U = forms.isoView(f, { ox: OX, oy: UP, angle: 'true' });
  const D = forms.isoView(f, { ox: OX, oy: DOWN, angle: 'true' });
  const tag = (x, y, title, sub, hue, anchor = 'start') => {
    f.text(x, y, title, { size: 12, weight: 700, hue, anchor });
    if (sub) f.text(x, y + 15, sub, { size: 11, serif: true, hue: 'ink-soft', anchor });
  };
  const line = (a, b, style) => f.path(`M${a[0]} ${a[1]}L${b[0]} ${b[1]}`, { style });

  f.kicker(20, 18, `one agent run · langchain ${pin('langchain')} · langgraph ${pin('langgraph')} · python ${python}`);

  forms.slab(f, U, [-40, -40, 0], 'blue', { w: 230, d: 80, thick: 6, mark: { id: 'langchain', size: 30, at: [104, 20] } });
  const term = forms.terminal(f, U, [-130, -8, 0], 'violet');
  const model = forms.tower(f, U, [0, -22, 0], 'plum');
  const add = forms.unit(f, U, [150, -18, 0], 'green');
  const GX = 120;
  const GY = -240;
  forms.block(f, U, { x: GX, y: GY, z: 0, w: 36, d: 36, h: 40, hue: 'olive', ghost: true });
  forms.edge(f, U, [[GX + 36, GY, 40], [GX + 36, GY + 36, 40], [GX, GY + 36, 40]], 'olive', 1, 'dashed');
  forms.edge(f, U, [[GX + 36, GY + 36, 40], [GX + 36, GY + 36, 0]], 'olive', 1, 'dashed');
  for (const k of [14, 27]) forms.edge(f, U, [[GX, GY + 36, k], [GX + 36, GY + 36, k], [GX + 36, GY, k]], 'olive', 0.8, 'dashed');

  tag(20, 112, 'your code', 'agent.invoke', 'violet');
  f.text(20, 144, human.content, { size: 11, hue: 'violet' });
  f.text(20, 160, answer.content, { size: 11, hue: 'plum' });
  tag(300, 40, 'chat model', null, 'plum');
  f.text(300, 58, `call 1: tool_call ${callText}`, { size: 11, hue: 'plum' });
  f.text(300, 74, `call 2: ${answer.content}`, { size: 11, hue: 'plum' });
  f.leader([296, 64], model.P(30, 0, 46), { hue: 'plum' });
  tag(620, 146, 'LangSmith', 'outside the process', 'olive', 'end');
  f.text(620, 177, `POST ${posts}, PATCH ${patches}`, { size: 11, hue: 'olive', anchor: 'end' });
  tag(620, 212, `tool ${toolCall.name}`, '@tool, bound to the model', 'green', 'end');
  f.leader([464, 223], add.near, { hue: 'green' });
  tag(620, 262, 'LangChain', 'model and tool objects', 'blue', 'end');
  f.leader([484, 258], U.P(190, 0, -3), { hue: 'blue' });

  forms.slab(f, D, [-110, -70, 0], 'grey', { w: 370, d: 170, mark: { id: 'python', size: 40, at: [40, 84] } });
  const shell = forms.shell(f, D, [-100, -60, 0], 'indigo', { w: 250, d: 120, h: 50, mark: { id: 'langgraph', size: 28, inset: 140, rise: 42 } });
  const mnode = forms.unit(f, D, [-4, -26, 0], 'indigo', { w: 36, d: 36, h: 24 });
  const tnode = forms.unit(f, D, [110, -58, 0], 'indigo', { w: 32, d: 32, h: 22 });
  const SX = -90;
  const SY = 10;
  const SIDE = 30;
  const sheets = [[human, 'violet'], [asked, 'plum'], [tool, 'green'], [answer, 'plum']];
  sheets.forEach(([, hue], i) => {
    const z = 3 + i * 12;
    forms.quad(f, D, [[SX, SY, z], [SX + SIDE, SY, z], [SX + SIDE, SY + SIDE, z], [SX, SY + SIDE, z]], { fill: color(`${hue}-fill`), stroke: color(`${hue}-ink`), strokeWidth: 1.1 });
  });
  shell.front();
  forms.cylinder(f, D, [232, -30, 0], 'teal', { r: 22, h: 50 });
  const records = forms.sheets(f, D, [224, -38, 52], 'teal', { count: history.length, gap: 5, size: 16 });

  tag(20, 258, graphType, 'the Pregel loop', 'indigo');
  f.text(20, 288, 'from create_agent', { size: 11, serif: true, hue: 'ink-soft' });
  f.leader([130, 284], shell.P(0, 34, 50), { hue: 'indigo' });
  tag(232, 430, 'model', null, 'indigo', 'end');
  tag(360, 442, 'tools', null, 'indigo', 'end');

  tag(106, 324, 'messages', null, 'indigo', 'end');
  const labels = [
    `${human.type}`,
    `${asked.type}`,
    `${tool.type} ${tool.content}`,
    `${answer.type}`,
  ];
  labels.forEach((label, i) => {
    const y = 388 - i * 14;
    const hue = sheets[i][1];
    f.text(106, y, label, { size: 11, hue, anchor: 'end' });
    f.leader([110, y - 4], D.P(SX, SY + SIDE, 3 + i * 12), { hue });
  });

  tag(620, 330, 'InMemorySaver', `thread ${thread}`, 'teal', 'end');
  history.forEach((h, i) => {
    const y = 364 + i * 16;
    const last = i === history.length - 1;
    f.text(620, y, `step ${String(h.step).padStart(2)}  next ${nextOf(h)}`, { size: 11, anchor: 'end', hue: last ? 'amber' : 'teal', weight: last ? 700 : undefined });
  });
  f.leader([536, 446], records.P(16, 0, 20), { hue: 'teal' });
  f.text(620, 572, 'one Python process', { size: 11, serif: true, hue: 'ink-mute', anchor: 'end' });
  f.leader([506, 568], D.P(236, 76, 0), { hue: 'ink-mute' });

  f.kicker(20, 612, `measured on the Mac · ${machine}`);
  f.text(20, 634, `create_agent ${ms(agent)} per run, plain openai loop ${ms(plain)}`, { size: 12, weight: 700, hue: 'blue' });
  f.text(20, 654, `+${ms(agent - plain)} per run; with InMemorySaver ${ms(saver)}`, { size: 12, weight: 700, hue: 'teal' });
  f.text(20, 674, `medians of ${stub.c_create_agent.n} runs each, stub model, three model calls per run`, { size: 11, serif: true, hue: 'ink-mute' });

  const top = D.P(SX + SIDE / 2, SY + SIDE / 2, 3 + 3 * 12);
  const foot = term.foot;

  f.beat(1);
  line([top[0] - 7, foot[1] + 6], [top[0] - 7, top[1] - 4], 'call');
  f.step(top[0] - 24, 220, 1);
  f.text(top[0] - 38, 224, 'invoke', { size: 11.5, anchor: 'end', knock: true });

  f.beat(2);
  const m0 = mnode.top;
  const mu = model.P(22, 22, 0);
  line([m0[0] - 9, m0[1] - 2], [mu[0] - 9, mu[1] + 3], 'model');
  f.step(m0[0] - 26, 252, 2, { hue: 'plum' });
  f.text(m0[0] - 40, 256, 'call 1', { size: 11, hue: 'plum', anchor: 'end', knock: true });

  f.beat(3);
  const n0 = tnode.top;
  const au = add.P(18, 18, 0);
  line([n0[0], n0[1] - 2], [au[0], au[1] + 3], 'call');
  f.step(n0[0] + 16, 290, 3);
  f.text(n0[0] + 30, 294, callText, { size: 11.5, knock: true });
  f.text(n0[0] + 30, 310, `${tool.type} ${tool.content}`, { size: 11, hue: 'green', knock: true });

  f.beat(4);
  line([m0[0] + 9, m0[1] - 2], [mu[0] + 9, mu[1] + 3], 'model');
  f.step(m0[0] + 26, 252, 4, { hue: 'plum' });
  f.text(m0[0] + 40, 256, 'call 2', { size: 11, hue: 'plum', knock: true });

  f.beat(5);
  f.isoFlow(D, [[154, 0, 10], [206, -16, 10]], { style: 'write' });
  const put = D.P(184, -20, 0);
  f.step(put[0] + 2, put[1] + 18, 5, { hue: 'teal' });
  f.text(put[0] - 12, put[1] + 22, 'put', { size: 11, hue: 'teal', anchor: 'end', knock: true });

  f.beat(6);
  line([top[0] + 7, top[1] - 4], [top[0] + 7, foot[1] + 6], 'reply');
  f.step(top[0] + 24, 180, 6);
  f.text(top[0] + 38, 184, 'returns', { size: 11.5, knock: true });

  f.beat(7);
  f.isoFlow(U, [[150, -40, 6], [140, -200, 6]], { style: 'effect' });
  const seven = U.P(145, -120, 0);
  f.step(seven[0] - 24, seven[1] - 12, 7, { hue: 'olive' });
  f.text(seven[0] - 38, seven[1] - 8, `${posts} runs, tracing on`, { size: 11, hue: 'olive', anchor: 'end', knock: true });
});
