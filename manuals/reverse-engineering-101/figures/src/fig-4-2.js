'use strict';

const { figure } = require('../../../_shared/figkit.js');

const entries = [
  ['project/ home/ tmp/ cache/ config/ data/', 'rea-project imported with -readOnly -deleteProject · private HOME, tmpdir, caches', 'violet'],
  ['target-01b5d08b08fb.bin', 'copy of ledger-arm64-O1, hashed while copied · the Ghidra document', 'green'],
  ['session.json', 'transport, endpoint_path, token, run_id, target_sha256, provider_version, profile_digest', 'violet'],
  ['bridge.sock', 'Unix socket bound by the bridge, mode rw-------, one client accepted', 'violet'],
  ['ownership.json', 'process ownership record for verified cancellation', 'violet'],
  ['ghidra.log · script.log', 'the -log and -scriptlog files of analyzeHeadless', 'violet'],
];

module.exports = figure('fig-4-2', {
  height: 426,
  title: 'The private runtime root of one Ghidra session',
  desc: 'One directory named rea-ghidra- plus a random suffix, created by GhidraClient start() and deleted after close_binary. It holds six Ghidra directories, the hashed copy of the target named target-01b5d08b08fb.bin, the session.json descriptor with seven keys, the bridge.sock Unix socket, ownership.json, and the ghidra.log and script.log files.',
}, f => {
  f.kicker(20, 18, 'session root · one directory per start()');
  f.box({ x: 20, y: 26, w: 600, h: 50, hue: 'violet', title: 'rea-ghidra-<random>', sub: 'created by GhidraClient start(), deleted after close_binary' });
  f.rule(40, 76, 40, 392, { hue: 'violet' });
  entries.forEach(([title, sub, hue], index) => {
    const y = 100 + index * 54;
    f.rule(40, y + 22, 58, y + 22, { hue: 'violet' });
    f.box({ x: 60, y, w: 560, h: 44, hue, title, sub, align: 'left', titleSize: 12 });
  });
});
