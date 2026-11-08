'use strict';

const { figure, color } = require('../../../_shared/figkit.js');

const rows = [
  ['header load commands', '0x100000404, 0x100000490', '2', '/usr/lib/dyld', false],
  ['__TEXT,__cstring', '0x100000770 to 0x1000007cf', '10', 'score %d grade %s', true],
  ['chained fixups imports', '0x100008069 to 0x1000080a7', '6', '___stack_chk_fail', false],
  ['exports trie edges', '0x1000080b2 to 0x100008111', '7', '_label', false],
  ['LC_SYMTAB string table', '0x10000821a to 0x1000082a5', '13', '_grade_label', false],
  ['code signature', '0x10000831c', '1', 'ledger-arm64-O1', false],
];

module.exports = figure('fig-4-7', {
  height: 276,
  title: 'The 39 strings of ledger-arm64-O1 by load command',
  desc: 'Six rows sorted by address. Two load command strings in the header, the dyld and libSystem paths. Ten strings in __TEXT,__cstring from 0x100000770, the labels, the format strings and one empty pad. Six import names in the chained fixups from 0x100008069. Seven edge labels of the exports trie from 0x1000080b2. Thirteen names in the LC_SYMTAB string table from 0x10000821a. One code signature identifier, ledger-arm64-O1, at 0x10000831c. The total is 39, the string_count of the overview.',
}, f => {
  f.kicker(20, 18, 'where');
  f.kicker(250, 18, 'addresses');
  f.kicker(450, 18, 'count');
  f.kicker(500, 18, 'example');
  rows.forEach(([where, addresses, count, example, program], index) => {
    const y = 28 + index * 34;
    f.rect(20, y, 600, 34, { fill: program ? color('green-fill') : color('paper'), stroke: color('green-ink') });
    f.text(28, y + 21, where, { size: 11, weight: 700 });
    f.text(250, y + 21, addresses, { size: 11 });
    f.text(450, y + 21, count, { size: 11 });
    f.text(500, y + 21, example, { size: 11, serif: true, hue: 'ink-soft' });
  });
  f.text(20, 262, 'string_count 39 · encoding US-ASCII on every item · 10 program strings, 29 names and paths', { size: 11, serif: true, hue: 'ink-soft' });
});
