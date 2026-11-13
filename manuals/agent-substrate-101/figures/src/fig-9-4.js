'use strict';

const path = require('path');
const { figure, color } = require('../../../_shared/figkit.js');
const { load } = require('../../../_shared/chart.js');

const cases = load(path.join(__dirname, '../../capture/lab/summary/demos-x86.json')).failure_drill;
const names = ['worker pod deleted', 'local snapshot removed', 'process exits', 'over its memory limit', 'pool is full', 'Postgres away 30 s'];
const fixes = ['revert', 'revert', 'suspend, then revert', 'revert', 'suspend another actor', 'Postgres back'];
const two = value => value.toFixed(2);
const X0 = 218;
const PER_SECOND = 24;
const FIX_X = 368;
const OK_X = 552;

module.exports = figure('fig-9-4', {
  height: 330,
  title: 'Six failures of the drill, from the symptom to the first good answer',
  desc: `Six rows, one for each failure of the drill on the second x86 server guest. Each row shows the time and status code of the first failed request as a rose bar, the fix that we ran with its time, and the time of the first request that returned 200 after the fix. ${cases.map((c, i) => `${names[i]}: ${c.symptoms[0].http} in ${two(c.symptoms[0].seconds)} s, fix ${fixes[i]} in ${c.fix_seconds} s, then 200 in ${two(c.recoveries[0].seconds)} s`).join('. ')}.`,
}, f => {
  f.kicker(16, 28, 'failure');
  f.kicker(X0, 28, 'failed request', { hue: 'rose' });
  f.kicker(FIX_X, 28, 'fix', { hue: 'blue' });
  f.kicker(OK_X, 28, 'first 200', { hue: 'green' });
  cases.forEach((item, index) => {
    const y = 48 + index * 44;
    const symptom = item.symptoms[0];
    const recover = item.recoveries[0];
    f.rule(16, y - 8, 624, y - 8, { hue: 'ink-mute', opacity: 0.25 });
    f.text(16, y + 12, `${item.n}  ${names[index]}`, { size: 12, weight: 700 });
    f.rect(X0, y + 2, Math.max(3, symptom.seconds * PER_SECOND), 12, { fill: color('rose-fill'), stroke: color('rose-ink') });
    f.text(X0, y + 28, `${symptom.http} in ${two(symptom.seconds)} s`, { size: 11, hue: 'rose' });
    f.text(FIX_X, y + 12, fixes[index], { size: 11.5, weight: 700, hue: 'blue' });
    f.text(FIX_X, y + 28, `${item.fix_seconds.toFixed(1)} s`, { size: 11, serif: true, hue: 'ink-soft' });
    f.dot(OK_X + 4, y + 8, { hue: 'green', r: 3.5 });
    f.text(OK_X + 14, y + 12, `${two(recover.seconds)} s`, { size: 12, weight: 700, hue: 'green' });
  });
  const base = 48 + cases.length * 44;
  f.rule(16, base - 8, 624, base - 8, { hue: 'ink-mute', opacity: 0.25 });
  f.text(X0, base + 10, 'bar length is the time to the failed answer, 0 to 5 s', { size: 11, serif: true, hue: 'ink-soft' });
});
