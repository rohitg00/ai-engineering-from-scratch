'use strict';

const { figure } = require('../../../_shared/figkit.js');

const checks = [
  ['node', ['22.22.0', 'ok true, healthy']],
  ['ghidra', ['GHIDRA_INSTALL_DIR', 'ghidra/12.1.4/libexec']],
  ['ghidra-platform', ['darwin', 'ok true, healthy']],
  ['ghidra-architecture', ['arm64', 'ok true, healthy']],
  ['ghidra-installation', ['application.properties', 'ok true, healthy']],
  ['ghidra-version', ['12.1.4', 'policy: 12.1.x, JDK 21']],
  ['ghidra-headless', ['support/analyzeHeadless', 'ok true, healthy']],
  ['ghidra-native_decompiler', ['os/mac_arm_64/decompile', 'mach-o arm64 matches']],
  ['ghidra-java', ['21.0.12.1, 64-bit JDK', 'ok true, healthy']],
];

module.exports = figure('fig-2-2', {
  height: 360,
  title: 'The nine checks of rea doctor for the Ghidra scope',
  desc: 'Nine boxes in three rows, read left to right then down, each with the detail the capture Mac returned: node 22.22.0, ghidra with GHIDRA_INSTALL_DIR at ghidra/12.1.4/libexec, ghidra-platform darwin, ghidra-architecture arm64, ghidra-installation application.properties, ghidra-version 12.1.4 against the policy 12.1.x with JDK 21, ghidra-headless support/analyzeHeadless, ghidra-native_decompiler os/mac_arm_64/decompile which reports mach-o arm64 and matches, and ghidra-java 21.0.12.1 as a 64-bit JDK. Arrows connect the checks in order. Two result boxes at the bottom read healthy true for the explicit scope with providers ghidra and exit 0, and environment_healthy false for the audit-wide set that the capture filtered out.',
}, f => {
  f.kicker(20, 18, 'rea doctor --provider ghidra · in order');
  const boxes = checks.map(([title, sub], index) => {
    const col = index % 3;
    const row = Math.floor(index / 3);
    return f.box({ x: 20 + col * 205, y: 30 + row * 84, w: 190, h: 64, hue: 'violet', title, sub, titleSize: 11 });
  });
  boxes.forEach((box, index) => {
    const next = boxes[index + 1];
    if (!next) return;
    if (next.y === box.y) f.arrow(box.right(), [next.x - 1, box.cy], { style: 'call' });
    else f.path(`M${box.cx} ${box.y + box.h} V${box.y + box.h + 10} H${next.cx} V${next.y - 1}`, { style: 'call' });
  });
  f.path('M525 262 V276 H165 V289', { style: 'state' });
  f.path('M525 262 V276 H475 V289', { style: 'reply' });
  f.box({ x: 20, y: 290, w: 290, h: 56, hue: 'amber', title: 'healthy: true', sub: ['scope explicit, providers [ghidra]', 'exit 0, under one second'], titleSize: 12 });
  f.box({ x: 330, y: 290, w: 290, h: 56, hue: 'grey', title: 'environment_healthy: false', sub: ['the audit-wide set, outside this scope', 'filtered out of the capture'], titleSize: 12 });
});
