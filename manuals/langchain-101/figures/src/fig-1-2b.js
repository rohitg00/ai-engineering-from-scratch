'use strict';

const fs = require('fs');
const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const { flat } = require('../../../_shared/forms.js');

const text = fs.readFileSync(path.join(__dirname, '../../capture/out/42-langsmith.txt'), 'utf8');
const section = text.slice(text.indexOf('## a create_agent run inside a local trace'));
const requests = JSON.parse(/by method and path:\n(\{[\s\S]*?\})/.exec(section)[1]);
const posts = requests['POST /runs'];
const patches = requests['PATCH /runs/<run-id>'];
const runs = /\n\n((?:chain|llm|tool) [\s\S]*?)\n\n/.exec(section)[1].split('\n').map(line => {
  const [, indent, type, name] = /^( *)(\w+) (.+)$/.exec(line);
  return { depth: indent.length / 2, type, name };
});
if (runs.length - 1 !== posts || posts !== patches) throw new Error('fig-1-2b: the tree and the request counts disagree');

const hueOf = run => {
  if (run.depth === 0) return 'violet';
  if (run.type === 'llm') return 'plum';
  if (run.type === 'tool') return 'green';
  return 'indigo';
};
const CLIENT = 566;
const TOP = 92;
const PITCH = 40;

module.exports = figure('fig-1-2b', {
  height: 480,
  title: 'The runs of one traced agent turn',
  desc: `An indented tree of ${runs.length} runs in the order they started, one row each: ${runs.map(run => `${run.type} ${run.name}`).join(', ')}. The root agent_turn is the traceable function of the kit, inside tracing_context with enabled local, and it stayed in memory. Each of the ${posts} runs below it has a dashed olive arrow to a client lane on the right, because the client got one POST /runs when the run started and one PATCH when it ended: ${posts} POST and ${patches} PATCH in all. Each graph node is a chain run, the two model calls are llm leaves, and the tool call is a tool leaf.`,
}, f => {
  flat.gateway(f, CLIENT, 6, 'olive', { w: 52, h: 36, ports: 4 });
  f.text(CLIENT, 58, 'the client', { size: 11, weight: 700, hue: 'olive', anchor: 'middle' });
  f.text(CLIENT, 72, 'records each request', { size: 11, serif: true, hue: 'ink-soft', anchor: 'middle' });
  f.lifeline(CLIENT, 78, TOP + runs.length * PITCH - 10);
  f.kicker(20, 20, 'run tree, in the order the runs started');
  f.text(20, 38, 'name above its run type', { size: 11, serif: true, hue: 'ink-soft' });

  const parents = [];
  runs.forEach((run, index) => {
    const y = TOP + index * PITCH;
    const x = 20 + run.depth * 40;
    const hue = hueOf(run);
    f.beat(index + 1);
    parents[run.depth] = { x, y };
    if (run.depth) {
      const parent = parents[run.depth - 1];
      f.path(`M${parent.x + 12} ${parent.y + 14} V${y} H${x - 1}`, { hue: 'ink-mute', head: false, packet: false });
    }
    const w = Math.max(run.name.length, run.type.length + 4) * 7.2 + 20;
    f.rect(x, y - 14, w, 30, { hue });
    f.text(x + 10, y, run.name, { size: 11.5, weight: 700, hue });
    f.text(x + 10, y + 12, `${run.type} run`, { size: 11, serif: true, hue: 'ink-soft' });
    if (run.depth === 0) {
      f.text(x + w + 12, y + 4, "kept in memory: tracing_context(enabled='local')", { size: 11, serif: true, hue: 'ink-mute' });
      return;
    }
    f.arrow([x + w, y], [CLIENT - 1, y], { style: 'effect', label: index === 1 ? 'POST, then PATCH' : undefined, labelX: 440 });
  });

  f.beat(0);
  const bottom = TOP + runs.length * PITCH + 8;
  f.rule(20, bottom, 620, bottom, { opacity: 0.4 });
  f.text(20, bottom + 22, `${runs.length - 1} runs below the root, ${posts} POST /runs and ${patches} PATCH at the client.`, { size: 11, serif: true, hue: 'ink-soft' });
  const key = [['indigo', 'a graph node'], ['plum', 'a model call'], ['green', 'a tool call']];
  key.forEach(([hue, name], i) => {
    f.rect(20 + i * 150, bottom + 36, 14, 12, { hue });
    f.text(40 + i * 150, bottom + 46, name, { size: 11, serif: true, hue: 'ink-soft' });
  });
});
