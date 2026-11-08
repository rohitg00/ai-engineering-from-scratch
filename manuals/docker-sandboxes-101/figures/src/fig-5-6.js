'use strict';

const { figure, color } = require('../../../_shared/figkit.js');

const left = 116;
const step = 100.8;
const cellX = turn => left + turn * step + 1;
const filesTurns = [
  ['list_directory', 'path .', 'olive'],
  ['answer', '1 file', 'violet'],
  ['shell', 'wc -l rejected', 'olive'],
  ['read_file', 'README.md', 'olive'],
  ['answer', '1 line', 'violet'],
];

const evals = [
  { y: 300, name: ['Count the lines of README.md'], calls: ['expected: shell', 'actual: shell'], f1: '1.0', fail: false },
  { y: 342, name: ['List the files in the', 'working directory'], calls: ['expected: list_directory', 'actual: list_directory, shell'], f1: '0.67', fail: true },
];

function cell(f, x, y, w, h, hue, title, sub, dash) {
  f.rect(x, y, w, h, { fill: color(`${hue}-fill`), stroke: color(`${hue}-ink`), dash });
  f.text(x + w / 2, y + 17, title, { size: 11, weight: 700, anchor: 'middle', hue: hue === 'rose' ? 'rose' : undefined });
  if (sub) f.text(x + w / 2, y + 32, sub, { size: 11, serif: true, hue: 'ink-soft', anchor: 'middle' });
}

module.exports = figure('fig-5-6', {
  height: 418,
  title: 'Two runs on one axis of turns, and two eval scores',
  desc: 'Top: three sessions on an axis of turns 0 to 4, one cell per model reply. Sessions -1 and -2 are two replays of files.yaml and match on every turn: list_directory, an answer naming one file, a shell call with wc -l that was rejected, read_file of README.md, and an answer of one line. Session -3 is the restricted run of guarded.yaml and calls shell with echo m101-ok at turn 0, the first divergence; its later turns are not compared. sessions diff reports identical behaviour for -1 against -2 and exits 1 with fail-on-divergence for -1 against -3. Bottom: the eval of files.yaml. Count the lines of README.md expected and got one shell call, F1 1.0, relevance 1/1, size S. List the files in the working directory expected list_directory and got list_directory and shell, F1 0.67, relevance 1/1, size S.',
}, f => {
  f.kicker(20, 18, 'sessions diff, 21-sessions-diff.txt');
  for (let turn = 0; turn < 5; turn += 1) f.text(cellX(turn) + 49, 40, `turn ${turn}`, { size: 11, hue: 'ink-soft', anchor: 'middle' });

  const tracks = [{ y: 50, name: '-1' }, { y: 96, name: '-2' }];
  for (const track of tracks) {
    f.text(20, track.y + 25, `${track.name} files.yaml`, { size: 11, weight: 700 });
    filesTurns.forEach(([title, sub, hue], turn) => cell(f, cellX(turn), track.y, 98, 40, hue, title, sub));
  }
  f.text(20, 167, '-3 guarded', { size: 11, weight: 700 });
  cell(f, cellX(0), 142, 98, 40, 'rose', 'shell', 'echo m101-ok');
  cell(f, cellX(1), 142, 4 * step - 2, 40, 'grey', 'turns 1 to 5 are not compared', 'downstream of the divergence', 'dashed');
  f.rect(left - 2, 46, step + 2, 140, { stroke: color('rose-ink'), dash: 'dashed' });
  f.text(left, 204, 'first divergence at turn 0: list_directory against shell', { size: 11, hue: 'rose' });
  f.text(20, 226, '-1 against -2: Identical behaviour across all 5 turns, exit 0', { size: 11, serif: true, hue: 'ink-soft' });
  f.text(20, 242, '-1 against -3: sessions diverged, exit 1 with --fail-on-divergence', { size: 11, serif: true, hue: 'ink-soft' });

  f.kicker(20, 274, 'eval of files.yaml, 22-eval-container-env.txt');
  const cols = [{ x: 20, w: 200, head: 'eval session' }, { x: 222, w: 190, head: 'tool calls' }, { x: 414, w: 70, head: 'F1' }, { x: 486, w: 70, head: 'relevance' }, { x: 558, w: 62, head: 'size' }];
  for (const col of cols) f.text(col.x + 6, 294, col.head, { size: 11, hue: 'ink-soft' });
  for (const row of evals) {
    cols.forEach((col, index) => {
      const red = index === 2 && row.fail;
      f.rect(col.x, row.y, col.w, 40, { fill: color(red ? 'rose-fill' : 'paper'), stroke: color(red ? 'rose-ink' : 'panel-edge') });
    });
    row.name.forEach((line, index) => f.text(26, row.y + 16 + index * 15, line, { size: 11 }));
    row.calls.forEach((line, index) => f.text(228, row.y + 16 + index * 15, line, { size: 11, serif: true, hue: 'ink-soft' }));
    f.text(449, row.y + 24, row.f1, { size: 11, weight: 700, anchor: 'middle', hue: row.fail ? 'rose' : undefined });
    f.text(521, row.y + 24, '1/1', { size: 11, anchor: 'middle' });
    f.text(589, row.y + 24, 'S', { size: 11, anchor: 'middle' });
  }
  f.text(20, 406, 'Tool Calls: 83.3% avg F1 (2 evals). Sizes 2/2 and relevance 2/2 passed.', { size: 11, serif: true, hue: 'ink-soft' });
});
