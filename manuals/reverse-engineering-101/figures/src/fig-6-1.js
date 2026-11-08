'use strict';

const { figure } = require('../../../_shared/figkit.js');

module.exports = figure('fig-6-1', {
  height: 456,
  title: 'The application graph of ledger-desk',
  desc: 'The graph that analyze_javascript_application returns for the js-app fixture, drawn as boxes with the relation names on the arrows. Row one: the package ledger-desk loads the electron-main main.js, which contains the BrowserWindow at lines 8 to 16. Row two: main.js loads the electron-renderer index.html, the BrowserWindow loads the electron-preload preload.js, and preload.js exposes the context-bridge-api ledger with three members. Row three: preload.js invokes the ipc-channels ledger:percent-change and ledger:grade-label and sends on ledger:log. Row four: three ipc-handlers in main.js handle those channels. Row five: index.html loads the javascript-asset renderer.js, which calls the network endpoint /api/ledger/latest with fetch and persists_to the storage ledger:latest with localStorage.setItem.',
}, f => {
  const a1 = f.box({ x: 20, y: 28, w: 180, h: 52, hue: 'olive', title: 'ledger-desk', titleSize: 12, sub: ['package, package.json'] });
  const b1 = f.box({ x: 230, y: 28, w: 180, h: 52, hue: 'olive', title: 'main.js', titleSize: 12, sub: ['electron-main'] });
  const c1 = f.box({ x: 440, y: 28, w: 180, h: 52, hue: 'olive', title: 'BrowserWindow@8:17-16:4', titleSize: 11, sub: ['browser-window'] });
  f.arrow(a1.right(), [b1.x - 1, a1.cy], { style: 'call' });
  f.arrow(b1.right(), [c1.x - 1, b1.cy], { style: 'call' });
  f.text(215, 22, 'loads', { size: 11, anchor: 'middle', hue: 'ink-soft' });
  f.text(425, 22, 'contains', { size: 11, anchor: 'middle', hue: 'ink-soft' });

  const a2 = f.box({ x: 20, y: 112, w: 180, h: 52, hue: 'olive', title: 'index.html', titleSize: 12, sub: ['electron-renderer'] });
  const b2 = f.box({ x: 230, y: 112, w: 180, h: 52, hue: 'olive', title: 'ledger', titleSize: 12, sub: ['context bridge, 3 members'] });
  const c2 = f.box({ x: 440, y: 112, w: 180, h: 52, hue: 'olive', title: 'preload.js', titleSize: 12, sub: ['electron-preload'] });
  f.path('M250 80 V96 H110 V111', { style: 'call' });
  f.text(180, 92, 'loads', { size: 11, anchor: 'middle', hue: 'ink-soft', knock: true });
  f.arrow([c1.cx, 80], [c1.cx, c2.y - 1], { style: 'call', label: 'loads' });
  f.arrow(c2.left(), [b2.x + b2.w + 1, c2.cy], { style: 'call' });
  f.text(425, 106, 'exposes', { size: 11, anchor: 'middle', hue: 'ink-soft' });

  const a3 = f.box({ x: 20, y: 196, w: 180, h: 52, hue: 'olive', title: 'ledger:percent-change', titleSize: 12, sub: ['ipc-channel'] });
  const b3 = f.box({ x: 230, y: 196, w: 180, h: 52, hue: 'olive', title: 'ledger:grade-label', titleSize: 12, sub: ['ipc-channel'] });
  const c3 = f.box({ x: 440, y: 196, w: 180, h: 52, hue: 'olive', title: 'ledger:log', titleSize: 12, sub: ['ipc-channel'] });
  f.arrow([560, 164], [560, c3.y - 1], { style: 'call', label: 'sends' });
  f.path('M520 164 V182 H320 V195', { style: 'call' });
  f.text(430, 178, 'invokes', { size: 11, anchor: 'middle', hue: 'ink-soft', knock: true });
  f.path('M480 164 V188 H110 V195', { style: 'call' });

  const a4 = f.box({ x: 20, y: 280, w: 180, h: 52, hue: 'olive', title: 'ledger:percent-change', titleSize: 12, sub: ['handler, ipcMain.handle'] });
  const b4 = f.box({ x: 230, y: 280, w: 180, h: 52, hue: 'olive', title: 'ledger:grade-label', titleSize: 12, sub: ['handler, ipcMain.handle'] });
  const c4 = f.box({ x: 440, y: 280, w: 180, h: 52, hue: 'olive', title: 'ledger:log', titleSize: 12, sub: ['handler, ipcMain.on'] });
  [[a4, a3], [b4, b3], [c4, c3]].forEach(([handler, channel]) => f.arrow([handler.cx, handler.y - 1], [channel.cx, channel.y + channel.h + 1], { style: 'call', label: 'handles' }));

  const a5 = f.box({ x: 20, y: 364, w: 180, h: 52, hue: 'olive', title: 'renderer.js', titleSize: 12, sub: ['javascript-asset'] });
  const b5 = f.box({ x: 230, y: 364, w: 180, h: 52, hue: 'grey', title: '/api/ledger/latest', titleSize: 12, sub: ['endpoint, fetch'] });
  const c5 = f.box({ x: 440, y: 364, w: 180, h: 52, hue: 'teal', title: 'ledger:latest', titleSize: 12, sub: ['storage, localStorage'] });
  f.path('M20 150 H12 V390 H19', { style: 'call' });
  f.text(14, 266, 'loads', { size: 11, hue: 'ink-soft', knock: true });
  f.arrow(a5.right(), [b5.x - 1, a5.cy], { style: 'effect' });
  f.text(215, 358, 'calls', { size: 11, anchor: 'middle', hue: 'olive' });
  f.path('M110 416 V430 H530 V417', { style: 'write' });
  f.text(320, 444, 'persists_to', { size: 11, anchor: 'middle', hue: 'teal' });
  void b4;
  void a2;
});
