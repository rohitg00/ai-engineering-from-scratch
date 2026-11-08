'use strict';

const { figure } = require('../../../_shared/figkit.js');

const left = [
  '5d: subl $0x4, %eax',
  '60: ja 0x9a',
  '66: leaq (%rip), %rcx',
  '    R_X86_64_PC32 .rodata-0x4',
  '6d: movslq (%rcx,%rax,4), %rax',
  '71: addq %rcx, %rax',
  '74: jmpq *%rax',
];
const right = [
  '0x534: cmp w8, #0x4',
  '0x538: b.hi 0x10000054c',
  '0x53c: adrp x9, 0x100000000',
  '0x540: add x9, x9, #0x7d0',
  '0x544: ldr w0, [x9, w8, UXTW #0x2]',
  '0x548: ret',
  '0x54c: mov w0, #0x0',
];

module.exports = figure('fig-4-5', {
  height: 322,
  title: 'A jump table at -O0 and a value table at -O1',
  desc: 'Two columns. Left, grade in the lesson 33 fixture ledger-x86_64-O0.o: a bounds check, a leaq with a relocation against .rodata, a scaled load, an add and jmpq through rax; the table in .rela.rodata holds five relocations whose targets are 0x91, 0x88, 0x7f, 0x76 and 0x76, so the graph has 8 blocks and 11 edges. Right, _grade in the arm64 -O1 capture: a compare and b.hi, an adrp and add that form 0x1000007d0, and one ldr that returns one of the five values 1, 2, 3, 4, 4; the dossier has 3 blocks, 2 edges and an empty jump_tables list.',
}, f => {
  f.kicker(20, 18, 'A · grade at -O0, x86-64 object');
  f.kicker(336, 18, 'B · _grade at -O1, arm64 executable');
  f.rule(320, 8, 320, 314, { dash: 'dashed' });
  f.box({ x: 20, y: 28, w: 284, h: 40, hue: 'green', title: 'lesson 33 fixture ledger-x86_64-O0.o', titleSize: 11.5, weight: 400 });
  f.box({ x: 336, y: 28, w: 284, h: 40, hue: 'green', title: 'capture 06-function-grade.json', titleSize: 11.5, weight: 400 });
  left.forEach((line, index) => f.text(20, 90 + index * 14, line, { size: 11 }));
  right.forEach((line, index) => f.text(336, 90 + index * 14, line, { size: 11 }));
  f.box({ x: 20, y: 200, w: 284, h: 50, hue: 'green', title: '.rela.rodata: five relocations', sub: 'targets 0x91 0x88 0x7f 0x76 0x76' });
  f.box({ x: 336, y: 200, w: 284, h: 50, hue: 'green', title: '__const at 0x1000007d0', sub: 'u32 values 1 2 3 4 4 · file offset 2000' });
  f.box({ x: 20, y: 262, w: 284, h: 50, hue: 'violet', title: 'jmpq *%rax reaches 5 blocks', sub: '8 blocks and 11 edges with the table' });
  f.box({ x: 336, y: 262, w: 284, h: 50, hue: 'violet', title: 'ldr returns one value', sub: '3 blocks · 2 edges · jump_tables []' });
});
