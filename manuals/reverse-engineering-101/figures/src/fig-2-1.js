'use strict';

const { figure } = require('../../../_shared/figkit.js');

const gates = [
  ['A lawful copy', 'U.S.C. 1201(f)(1) · 2009/24/EC Art. 6(1)(a)'],
  ['A purpose the law names', 'interoperability, study, error correction, test'],
  ['No other way to the facts', '1201(f)(1), Art. 6(1)(b), Sega: no other means'],
  ['Only the parts you need', 'Art. 6(1)(c) · C-13/20: to the extent necessary'],
  ['Your own expression at the end', 'Art. 6(2)(c), Sega, Connectix: no copied code'],
];

module.exports = figure('fig-2-1', {
  height: 420,
  title: 'Five questions before the first command',
  desc: 'Five questions in a column on the left, each with its statute or decision: a lawful copy under 17 U.S.C. 1201(f)(1) and Directive 2009/24/EC Article 6(1)(a), a purpose the law names such as interoperability, study, error correction, or an authorized test, no other way to the facts under 1201(f)(1), Article 6(1)(b), and Sega, only the parts you need under Article 6(1)(c) and C-13/20, and your own expression at the end under Article 6(2)(c), Sega, and Connectix. A dashed rose arrow from each question leads to the box no: stop, get authorization first, README, Disclaimer. A solid arrow down from the last question leads to the green box yes, five times: analyze, which names ledger.c, ledger-main.c, js-app, and ledger.wat, the programs written for this manual.',
}, f => {
  f.kicker(20, 18, 'five questions, in order');
  const stop = f.box({ x: 440, y: 26, w: 180, h: 300, hue: 'rose', dash: 'dashed', title: 'no: stop', sub: ['get authorization first', 'README, Disclaimer', 'rea does not ask this'] });
  gates.forEach(([title, sub], index) => {
    const y = 26 + index * 64;
    const gate = f.box({ x: 20, y, w: 300, h: 44, hue: 'grey', title, sub, titleSize: 12, pad: 10 });
    f.arrow(gate.right(), [stop.x - 1, gate.cy], { style: 'fail', label: 'no' });
    if (index < gates.length - 1) f.arrow(gate.bottom(), [gate.cx, y + 63], { style: 'call', label: 'yes' });
  });
  f.arrow([170, 326], [170, 349], { style: 'call', label: 'yes' });
  f.box({ x: 20, y: 350, w: 300, h: 56, hue: 'green', title: 'yes, five times: analyze', sub: ['ledger.c, ledger-main.c, js-app, ledger.wat', 'written for this manual'], titleSize: 12 });
});
