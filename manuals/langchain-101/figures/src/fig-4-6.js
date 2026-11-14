'use strict';

const { figure } = require('../../../_shared/figkit.js');

const rows = [
  ['tuple', '(1, 2)', 'list', '[1, 2]', 'amber'],
  ['set of tuples', '{(1, 2), (3, 4)}', 'list of lists', '[[1, 2], [3, 4]]', 'amber'],
  ['frozenset of tuples', 'frozenset({(1, 2)})', 'list of lists', '[[1, 2]]', 'amber'],
  ['defaultdict', "{'k': [1]}", 'dict', 'no default factory', 'amber'],
  ['Counter', "Counter('abca')", 'dict', 'no Counter methods', 'amber'],
  ['OrderedDict', 'two keys', 'dict', 'same keys and order', 'amber'],
  ['datetime, ZoneInfo', 'Asia/Kolkata', 'datetime, fixed offset', '+05:30, no zone rules', 'amber'],
  ['datetime, fold=1', 'America/New_York', 'datetime, fixed offset', 'fold 0, not equal', 'amber'],
  ['plain class', 'Plain(3)', 'TypeError', 'not msgpack serializable', 'rose'],
];

module.exports = figure('fig-4-6', {
  height: 470,
  title: 'What a checkpoint gives back for nine values',
  desc: 'Nine rows, each from a value put in the state on the left to what get_state on SqliteSaver gave back on the right. A tuple came back as a list. A set and a frozenset of tuples came back as lists of lists. A defaultdict, a Counter, and an OrderedDict came back as a plain dict. A datetime with a ZoneInfo zone came back with a fixed offset, and one with fold 1 lost the fold. An instance of a plain class raised TypeError and was not saved.',
}, f => {
  f.kicker(20, 20, 'put in the state');
  f.kicker(372, 20, 'what get_state gave back');
  rows.forEach(([kind, example, result, after, hue], i) => {
    const y = 32 + i * 46;
    const left = f.box({ x: 20, y, w: 250, h: 38, hue: 'violet', title: kind, sub: example, align: 'left', titleSize: 12, pad: 10 });
    const right = f.box({ x: 372, y, w: 248, h: 38, hue, title: result, sub: after, align: 'left', titleSize: 12, pad: 10 });
    f.arrow(left.right(), [right.x - 1, left.cy], { style: hue === 'rose' ? 'fail' : 'reply' });
  });
  f.text(20, 460, 'Twenty other values came back with the same type and value. The Mac, one run each.', { size: 11, serif: true, hue: 'ink-soft' });
});
