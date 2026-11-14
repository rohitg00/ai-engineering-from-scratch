'use strict';

const fs = require('fs');
const path = require('path');
const { figure, color } = require('../../../_shared/figkit.js');

const out = name => fs.readFileSync(path.join(__dirname, '../../capture/out', name), 'utf8');
const section = (text, heading) => {
  const start = text.indexOf(heading);
  if (start < 0) throw new Error(`fig-4-1: no section ${heading}`);
  const end = text.indexOf('\n## ', start + heading.length);
  return text.slice(start, end < 0 ? undefined : end);
};
const chunks = body => body.split(/\nchunk \d+:\n/).slice(1).map(part => JSON.parse(part.slice(0, part.indexOf('\n}') + 2)));
const counted = body => Number(/\n(\d+) chunks\n/.exec(body)[1]);
const perTask = (body, printed) => {
  const n = counted(body);
  if (n !== 2 * nodes.length) throw new Error('fig-4-1: expected one start and one result for each task');
  return Array.from({ length: n }, (_, i) => ({ col: Math.floor(i / 2) + 1, kind: i % 2 ? 'end' : 'start', printed: i < printed.length }));
};

const updates = chunks(section(out('21-stream-updates-values.txt'), "## stream_mode='updates'"));
const nodes = updates.map(chunk => Object.keys(chunk)[0]);
const values = chunks(section(out('21-stream-updates-values.txt'), "## stream_mode='values'"));
const messages = chunks(section(out('22-stream-messages.txt'), "## stream_mode='messages'"));
const tasksText = section(out('23-stream-tasks-custom-debug.txt'), "## stream_mode='tasks'");
const tasks = chunks(tasksText);
const custom = Number(/(\d+) chunks/.exec(section(out('23-stream-tasks-custom-debug.txt'), "## stream_mode='custom'"))[1]);
const debugText = section(out('23-stream-tasks-custom-debug.txt'), "## stream_mode='debug'");
const debug = chunks(debugText);
const tools = chunks(section(out('26-stream-tools-mode.txt'), "## stream_mode='tools'"));
const events = JSON.parse(out('25-stream-events-v3.events.json'));

const v3 = [];
let column = 0;
for (const event of events) {
  v3.push({ col: column, kind: event.method === 'values' ? 'state' : event.method === 'tools' ? 'tool' : 'model' });
  if (event.method === 'values') column += 1;
}
const rows = [
  ['updates', updates.map((chunk, i) => ({ col: i + 1, kind: nodes[i] === 'tools' ? 'tool' : 'model' }))],
  ['values', values.map((chunk, i) => ({ col: i, kind: 'state' }))],
  ['messages', messages.map(chunk => ({ col: chunk.metadata.langgraph_step, kind: chunk.message.type === 'ToolMessage' ? 'tool' : 'model' }))],
  ['tasks', perTask(tasksText, tasks)],
  ['debug', perTask(debugText, debug)],
  ['custom', Array.from({ length: custom }, () => ({ col: 0, kind: 'state' }))],
  ['tools', tools.map(chunk => ({ col: 2, kind: chunk.event === 'tool-started' ? 'start' : 'tool' }))],
  ['v3 events', v3],
];
const STYLE = {
  state: { hue: 'indigo', filled: true },
  model: { hue: 'plum', filled: true },
  tool: { hue: 'green', filled: true },
  start: { hue: 'amber', filled: false },
  end: { hue: 'amber', filled: true },
};
const bands = [
  { x: 112, w: 52, label: 'input' },
  { x: 176, w: 132, label: `${nodes[0]}, step 1` },
  { x: 320, w: 96, label: `${nodes[1]}, step 2` },
  { x: 428, w: 150, label: `${nodes[2]}, step 3` },
];
const total = name => rows.find(row => row[0] === name)[1].length;

module.exports = figure('fig-4-1', {
  height: 404,
  title: 'The chunks of one agent run in each stream mode',
  desc: `Eight rows, one for each stream of the same agent run, over four columns: the input, the ${nodes[0]} node at step 1, the ${nodes[1]} node at step 2, and the ${nodes[2]} node at step 3. Each mark is one chunk read from the capture, coloured by what it carries: indigo a whole state, plum model output, green tool output, amber a task that starts or ends. updates has ${total('updates')}, values ${total('values')}, messages ${total('messages')}, tasks ${total('tasks')}, debug ${total('debug')}, custom ${total('custom')}, the tools mode ${total('tools')} on the slow_sum agent, and stream_events v3 has ${total('v3 events')} events. The v3 stream closes each step with a values event.`,
}, f => {
  bands.forEach(band => {
    const hue = band.label === 'input' ? 'violet' : band.label.startsWith('tools') ? 'green' : 'indigo';
    f.text(band.x + band.w / 2, 24, band.label, { size: 11, anchor: 'middle', hue });
    f.rule(band.x - 6, 34, band.x - 6, 300, { hue: 'ink-mute', dash: 'dashed' });
  });
  f.rule(584, 34, 584, 300, { hue: 'ink-mute', dash: 'dashed' });
  f.kicker(20, 24, 'stream');
  f.kicker(606, 24, 'n', { anchor: 'middle' });
  rows.forEach(([name, marks], i) => {
    const y = 52 + i * 32;
    f.beat(i + 1);
    f.text(20, y + 4, name, { size: 11.5, hue: 'indigo' });
    bands.forEach((band, b) => {
      const here = marks.filter(mark => mark.col === b);
      const step = here.length ? Math.min(12, (band.w - 8) / here.length) : 0;
      const start = band.x + band.w / 2 - (step * (here.length - 1)) / 2 - 3;
      here.forEach((mark, k) => {
        const style = STYLE[mark.kind];
        f.rect(start + k * step, y - 7, 6, 14, { fill: style.filled ? color(`${style.hue}-ink`) : color('paper'), stroke: color(`${style.hue}-ink`), strokeWidth: 1.2 });
      });
    });
    f.text(606, y + 4, String(marks.length), { size: 12, anchor: 'middle', weight: 700, hue: marks.length ? 'indigo' : 'ink-mute' });
  });
  f.beat(0);
  const key = [['state', 'whole state'], ['model', 'model output'], ['tool', 'tool output'], ['start', 'task starts'], ['end', 'task ends']];
  key.forEach(([kind, name], i) => {
    const style = STYLE[kind];
    const x = 20 + i * 122;
    f.rect(x, 318, 6, 14, { fill: style.filled ? color(`${style.hue}-ink`) : color('paper'), stroke: color(`${style.hue}-ink`), strokeWidth: 1.2 });
    f.text(x + 12, 330, name, { size: 11, serif: true, hue: 'ink-soft' });
  });
  f.text(20, 362, 'Each mark is one chunk. tasks and debug ran with no checkpointer.', { size: 11, serif: true, hue: 'ink-soft' });
  f.text(20, 380, 'The tools row is the slow_sum agent: started, two deltas, finished.', { size: 11, serif: true, hue: 'ink-soft' });
  f.text(20, 398, 'A v3 values event closes each column.', { size: 11, serif: true, hue: 'ink-soft' });
});
