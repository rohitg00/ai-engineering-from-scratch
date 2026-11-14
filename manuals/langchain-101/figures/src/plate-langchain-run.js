'use strict';

const { figure } = require('../../../_shared/figkit.js');
const forms = require('../../../_shared/forms.js');

module.exports = figure('plate-langchain-run', {
  height: 524,
  title: 'One invoke, two model calls, one tool call',
  desc: 'An isometric drawing of one agent run inside one Python process, drawn as a grey slab. Your code, a violet terminal, calls invoke with What is 2 + 3? on the agent graph from create_agent, an indigo unit. The graph calls the chat model, a plum tower, twice, and runs the add tool, a small green unit, once, which returns 5. After the input and after each of the four steps, the graph writes a checkpoint to InMemorySaver, a teal cylinder, five checkpoints in all, steps -1 to 3. Off the slab, LangSmith is a dashed olive tower that gets runs only when tracing is on. The reply is The sum is 5.',
}, f => {
  const V = forms.isoView(f, { ox: 300, oy: 190, angle: 'true' });
  const tag = (x, y, title, sub, hue, anchor = 'start') => {
    f.text(x, y, title, { size: 12, weight: 700, hue, anchor });
    if (sub) f.text(x, y + 15, sub, { size: 11, serif: true, hue: 'ink-soft', anchor });
  };
  f.kicker(20, 20, 'one agent run · langchain 1.5.0 · langgraph 1.2.22');
  forms.slab(f, V, [-30, -130, 0], 'grey', { w: 250, d: 330 });
  forms.tower(f, V, [70, -250, 0], 'olive', { h: 44, w: 36, d: 36 });
  forms.tower(f, V, [70, -110, 0], 'plum', { h: 62 });
  forms.unit(f, V, [20, 20, 0], 'indigo', { w: 70, d: 70, h: 40 });
  forms.unit(f, V, [190, 30, 0], 'green', { w: 30, d: 30, h: 22 });
  forms.terminal(f, V, [-10, 150, 0], 'violet');
  const saver = forms.cylinder(f, V, [150, 160, 0], 'teal', { r: 22, h: 44 });

  f.beat(1);
  f.isoFlow(V, [[24, 148, 14], [24, 92, 14]], { style: 'call' });
  f.beat(2);
  f.isoFlow(V, [[86, 18, 30], [86, -64, 30]], { style: 'model' });
  f.beat(3);
  f.isoFlow(V, [[92, 45, 6], [188, 45, 6]], { style: 'call' });
  f.beat(4);
  f.isoFlow(V, [[80, 92, 4], [126, 140, 4]], { style: 'write' });

  tag(20, 196, 'your code', 'agent.invoke', 'violet');
  f.leader([112, 207], V.P(10, 156, 30), { hue: 'violet' });
  tag(20, 120, 'agent graph', 'create_agent, four steps', 'indigo');
  f.leader([172, 131], V.P(30, 30, 40), { hue: 'indigo' });
  tag(20, 56, 'chat model', '2 model calls', 'plum');
  f.leader([110, 64], V.P(70, -100, 62), { hue: 'plum' });
  tag(620, 30, 'LangSmith', 'runs only with tracing on', 'olive', 'end');
  tag(620, 300, 'tool add', '1 call, returns 5', 'green', 'end');
  f.leader([540, 308], V.P(220, 50, 22), { hue: 'green' });
  tag(620, 430, 'InMemorySaver', '5 checkpoints, steps -1 to 3', 'teal', 'end');
  f.leader([470, 426], saver.right, { hue: 'teal' });
  tag(20, 440, 'one Python process', 'Python 3.13 in the kit', 'grey');
  f.text(20, 490, 'reply: The sum is 5.', { size: 13, weight: 700, hue: 'violet' });
  f.text(20, 512, 'two model calls, one tool call, five checkpoints, seven trace runs', { size: 11, serif: true, hue: 'ink-soft' });
});
