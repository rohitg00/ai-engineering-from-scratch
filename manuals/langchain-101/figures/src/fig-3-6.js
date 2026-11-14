'use strict';

const fs = require('fs');
const path = require('path');
const { figure, color } = require('../../../_shared/figkit.js');

const text = fs.readFileSync(path.join(__dirname, '../../capture/out/14-mw-pii.txt'), 'utf8');
const sections = text.split('\n## ').slice(1).map(part => ({ heading: part.slice(0, part.indexOf('\n')), body: part }));
const runOf = (type, strategy) => {
  const s = sections.find(item => item.heading.startsWith(`PIIMiddleware('${type}', strategy='${strategy}')`));
  if (!s) throw new Error(`fig-3-6: no run for ${type} ${strategy}`);
  const calls = JSON.parse(s.body.slice(s.body.indexOf('[', s.body.indexOf('model calls seen by the fake:')), s.body.lastIndexOf(']') + 1));
  const raised = /raised [\w.]+\.(\w+): (.+)/.exec(s.body);
  const first = raised ? null : JSON.parse(s.body.slice(s.body.indexOf('['), s.body.indexOf('\n]') + 2))[0].content;
  return { type, strategy, calls: calls.length, raised, content: first };
};
const runs = [runOf('email', 'redact'), runOf('credit_card', 'mask'), runOf('ip', 'hash'), runOf('url', 'redact'), runOf('email', 'block')];
const email = /^Mail (\S+),/.exec(runs[1].content)[1];
const original = runs[0].content.replace('[REDACTED_EMAIL]', email);
const diff = after => {
  let a = 0;
  while (original[a] === after[a]) a += 1;
  let b = 0;
  while (original[original.length - 1 - b] === after[after.length - 1 - b]) b += 1;
  return { from: original.slice(a, original.length - b), to: after.slice(a, after.length - b), at: a };
};
runs.forEach(run => { if (run.content) Object.assign(run, diff(run.content)); });
const split = original.indexOf(' from ') + 1;
const lines = [original.slice(0, split).trimEnd(), original.slice(split)];
const CHAR = 7.2;

module.exports = figure('fig-3-6', {
  height: 468,
  title: 'Four PII strategies on one input',
  desc: `One human message holds an email address, a card number, an IP address, and a URL, each underlined in the hue of the row that matched it. Five rows each ran one PIIMiddleware. ${runs.filter(r => r.content).map(r => `${r.type} with ${r.strategy} replaced "${r.from}" with "${r.to}"`).join('. ')}. email with block raised ${runs[4].raised[1]}, "${runs[4].raised[2]}", and the model got ${runs[4].calls} calls. Each other run made ${runs[0].calls} model call, and only the matched span of the newest human message changed.`,
}, f => {
  f.kicker(20, 18, 'the human message');
  f.rect(20, 28, 600, 76, { hue: 'violet' });
  const spans = runs.filter(r => r.content && r.strategy !== 'block');
  lines.forEach((line, i) => {
    const offset = i ? split : 0;
    const y = 60 + i * 32;
    spans.forEach((run, k) => {
      const start = run.at - offset;
      if (start < 0 || start >= line.length) return;
      const x = 32 + start * CHAR;
      f.rule(x, y + 5, x + run.from.length * CHAR, y + 5, { hue: 'rose', width: 2 });
      f.text(x + (run.from.length * CHAR) / 2, y - 14, String(k + 1), { size: 11, anchor: 'middle', hue: 'rose', weight: 700 });
    });
    f.text(32, y, line, { size: 12 });
  });

  f.kicker(32, 128, 'PIIMiddleware');
  f.kicker(250, 128, 'the matched span becomes');
  f.kicker(620, 128, 'model calls', { anchor: 'end' });
  runs.forEach((run, i) => {
    const y = 140 + i * 56;
    f.beat(i + 1);
    const block = Boolean(run.raised);
    f.step(16, y + 22, i + 1, { hue: block ? 'rose' : 'ink' });
    const left = f.box({ x: 32, y, w: 190, h: 44, hue: 'blue', title: `'${run.type}'`, sub: `strategy='${run.strategy}'`, align: 'left' });
    if (block) {
      f.box({ x: 250, y, w: 324, h: 44, hue: 'rose', title: run.raised[1], sub: run.raised[2], align: 'left', titleSize: 12 });
      f.arrow(left.right(), [249, left.cy], { style: 'fail' });
    } else {
      f.rect(250, y, 324, 44, { hue: 'blue' });
      f.text(262, y + 18, run.from, { size: 11, hue: 'ink-mute', max: 300 });
      f.text(262, y + 35, run.to, { size: 12, weight: 700, hue: 'blue', max: 300 });
      f.arrow(left.right(), [249, left.cy], { style: 'call' });
    }
    f.text(600, y + 27, String(run.calls), { size: 13, weight: 700, anchor: 'middle', hue: run.calls ? 'plum' : 'rose' });
  });
  f.beat(0);
  f.text(20, 442, 'Each row is one run. Grey: what the input held. Bold: what was saved and sent instead.', { size: 11, serif: true, hue: 'ink-soft' });
  f.text(20, 458, 'Only the newest human message changed, because apply_to_input is the default.', { size: 11, serif: true, hue: 'ink-soft' });
});
