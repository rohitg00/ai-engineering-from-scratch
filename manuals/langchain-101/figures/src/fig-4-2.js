'use strict';

const fs = require('fs');
const path = require('path');
const { figure, color } = require('../../../_shared/figkit.js');
const { flat } = require('../../../_shared/forms.js');

const text = fs.readFileSync(path.join(__dirname, '../../capture/out/29-checkpoint-sqlite.txt'), 'utf8');
const arrayAfter = (heading, from = 0) => {
  const at = text.indexOf('[', text.indexOf(heading, from));
  return JSON.parse(text.slice(at, text.indexOf('\n]', at) + 2));
};
const rows = arrayAfter('checkpoints rows: thread_id, checkpoint_ns, type, step, source:').map(([thread, ns, type, step, source]) => ({ thread, type, step, source }));
const table = name => Number(new RegExp(`^${name}: (\\d+) rows`, 'm').exec(text)[1]);
const turn2 = arrayAfter('messages after turn 2:');
const turn3 = arrayAfter('## a new process opens the same file');
const humans = turn3.filter(line => line.startsWith('human: ')).map(line => line.slice(7));
const counts = [turn2.indexOf(turn2.filter(line => line.startsWith('human: '))[1]), turn2.length, turn3.length];
if (rows.length !== table('checkpoints')) throw new Error('fig-4-2: the listed rows and the row count disagree');

const turns = [];
for (const row of rows) {
  if (row.source === 'input') turns.push([]);
  turns[turns.length - 1].push(row);
}
const px = step => 80 + (step + 1) * 42;
const restart = (turns[1][turns[1].length - 1].step + turns[2][0].step) / 2;

module.exports = figure('fig-4-2', {
  height: 300,
  title: 'Three turns of one thread in the SQLite file',
  desc: `${rows.length} rows of the checkpoints table of SqliteSaver for the thread ${rows[0].thread}, on one step axis from ${rows[0].step} to ${rows[rows.length - 1].step}. ${turns.map((turn, i) => `Turn ${i + 1}, "${humans[i]}", has an input checkpoint at step ${turn[0].step} and loop checkpoints at steps ${turn.slice(1).map(r => r.step).join(', ')}, and leaves ${counts[i]} messages in the state`).join('. ')}. Between turn 2 and turn 3 the connection was closed and a new process opened the same file. The file holds ${table('checkpoints')} checkpoint rows and ${table('writes')} rows of pending writes.`,
}, f => {
  f.kicker(20, 18, `thread ${rows[0].thread}, one row per checkpoint`);
  turns.forEach((turn, i) => {
    const x1 = px(turn[0].step) - 19;
    const x2 = px(turn[turn.length - 1].step) + 19;
    f.beat(i + 1);
    f.rule(x1, 62, x2, 62, { hue: 'violet' });
    f.rule(x1, 58, x1, 66, { hue: 'violet' });
    f.rule(x2, 58, x2, 66, { hue: 'violet' });
    f.text(x1 + 6, 38, `turn ${i + 1}`, { size: 11, hue: 'violet', weight: 700 });
    f.text(x1 + 6, 52, humans[i], { size: 11, serif: true, hue: 'violet' });
    turn.forEach(row => {
      const hue = row.source === 'input' ? 'amber' : 'teal';
      f.rect(px(row.step) - 19, 82, 38, 34, { fill: color(`${hue}-fill`), stroke: color(`${hue}-ink`), strokeWidth: 1.3 });
      f.text(px(row.step), 104, row.source, { size: 11, anchor: 'middle', hue });
      f.rule(px(row.step), 116, px(row.step), 150, { hue: 'ink-mute', opacity: 0.5 });
    });
    f.text((x1 + x2) / 2, 210, `${counts[i]} messages`, { size: 11, anchor: 'middle', hue: 'teal', weight: 700 });
    f.text((x1 + x2) / 2, 224, 'in the state after', { size: 11, serif: true, anchor: 'middle', hue: 'ink-soft' });
  });
  f.beat(0);
  f.rule(px(rows[0].step) - 20, 150, px(rows[rows.length - 1].step) + 20, 150, { hue: 'ink' });
  for (const row of rows) {
    f.rule(px(row.step), 150, px(row.step), 155, { hue: 'ink' });
    f.text(px(row.step), 170, String(row.step), { size: 11, anchor: 'middle', hue: 'ink-soft' });
  }
  f.text(px(rows[0].step) - 20, 188, 'metadata.step', { size: 11, serif: true, hue: 'ink-soft' });
  f.rule(px(restart), 66, px(restart), 236, { hue: 'grey', dash: 'dashed' });
  f.text(px(restart) + 6, 252, 'connection closed, a new', { size: 11, serif: true, hue: 'grey' });
  f.text(px(restart) + 6, 266, 'process opens the same file', { size: 11, serif: true, hue: 'grey' });

  const db = flat.cylinder(f, 584, 74, 'teal', { w: 48, h: 60 });
  f.text(584, db.y + db.h + 18, 'checkpoints.db', { size: 11, weight: 700, anchor: 'middle', hue: 'teal' });
  f.text(584, db.y + db.h + 34, `checkpoints ${table('checkpoints')}`, { size: 11, anchor: 'middle', hue: 'ink-soft' });
  f.text(584, db.y + db.h + 50, `writes ${table('writes')}`, { size: 11, anchor: 'middle', hue: 'ink-soft' });

  const legend = [['amber', 'input', 'the new message is in'], ['teal', 'loop', 'saved after a step']];
  legend.forEach(([hue, mark, name], i) => {
    const y = 252 + i * 20;
    f.rect(20, y - 12, 40, 16, { fill: color(`${hue}-fill`), stroke: color(`${hue}-ink`) });
    f.text(40, y, mark, { size: 11, anchor: 'middle', hue });
    f.text(68, y, name, { size: 11, serif: true, hue: 'ink-soft' });
  });
});
