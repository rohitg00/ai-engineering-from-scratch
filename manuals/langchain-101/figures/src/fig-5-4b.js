'use strict';

const path = require('path');
const { figure, color } = require('../../../_shared/figkit.js');
const { load } = require('../../../_shared/chart.js');

const data = load(path.join(__dirname, '../../capture/lab/summary/store-namespace-mac.json'));

const CONFIGS = [
  ['shared-docs', 'docs example', ["namespace=lambda _rt:", "('memories',)"], ['alice writes ("memories")', 'bob reads ("memories")']],
  ['per-user', 'per user', ["namespace=lambda rt:", "('users', rt.context.user_id)"], ['alice writes ("users","alice")', 'bob reads ("users","bob")']],
  ['per-user+naive-recall', 'per user + recall tool', ['the same files, plus a tool', "that searches ('users',)"], ['bob asks for /memories/;', 'the model lists his folder only']],
  ['per-user+naive-recall-asked', 'the same, bob asks for recall', ['the same files and tool;', 'bob says: use your recall tool'], ['recall reads ("users",),', 'every user under it']],
];
const STORES = [['memory', 'InMemoryStore'], ['postgres', 'PostgresStore']];

const sessions = (store, cfg) => {
  const key = `${store}|${cfg}`;
  const v = data.agent[key];
  if (!v || v.n !== 10) throw new Error(`fig-5-4b: ${key} has n=${v && v.n}, expected 10`);
  return v;
};

const LX = 20;
const SX = 262;
const SQ = 17;
const BLOCK = 92;
const TOP = 40;

module.exports = figure('fig-5-4b', {
  height: TOP + CONFIGS.length * BLOCK + 58,
  title: 'Two users, one deep agent, and where the memory file is kept',
  desc: `Four namespace setups of StoreBackend under /memories/, each run for 10 sessions on InMemoryStore and on PostgresStore with Qwen3 8B. In each session alice asks the agent to save a locker code, then bob in a new thread asks for a locker code: under /memories/ in the first three rows, and through the recall tool in the last. One square per session. ${CONFIGS.map(([c, l]) => `${l}: ${STORES.map(([s, n]) => `${n} ${sessions(s, c).leaked_to_bob} of ${sessions(s, c).saved} saved codes told to bob`).join(', ')}`).join('. ')}.`,
}, f => {
  f.kicker(LX, 18, 'the namespace factory');
  f.kicker(SX, 18, 'one square per session, alice then bob');
  CONFIGS.forEach(([cfg, label, code, flow], i) => {
    const y = TOP + i * BLOCK;
    f.text(LX, y + 14, label, { size: 12.5, weight: 700 });
    f.text(LX, y + 30, code[0], { size: 11, hue: 'ink-soft' });
    f.text(LX, y + 44, code[1], { size: 11, hue: 'ink-soft' });
    f.text(LX, y + 62, flow[0], { size: 11, serif: true, hue: 'ink-soft' });
    f.text(LX, y + 76, flow[1], { size: 11, serif: true, hue: 'ink-soft' });
    STORES.forEach(([store, name], k) => {
      const v = sessions(store, cfg);
      const ry = y + 6 + k * 34;
      f.text(SX, ry + 13, name, { size: 11, hue: 'ink-soft' });
      v.per_session.forEach((s, j) => {
        let hue = 'violet';
        if (!s.saved) hue = 'grey';
        else if (s.leaked) hue = 'rose';
        else if (s.visible) hue = 'amber';
        f.rect(SX + 104 + j * (SQ + 3), ry, SQ, SQ, { fill: color(`${hue}-fill`), stroke: color(`${hue}-ink`) });
      });
      f.text(SX + 104 + 10 * (SQ + 3) + 6, ry + 13, `${v.leaked_to_bob} of ${v.saved}`, { size: 11.5, weight: 700, hue: v.leaked_to_bob ? 'rose' : 'ink-soft' });
    });
    if (i) f.rule(LX, y - 6, 620, y - 6, { hue: 'ink-mute', dash: 'dotted' });
  });
  const by = TOP + CONFIGS.length * BLOCK + 8;
  f.text(LX, by + 4, "Rose: bob's answer held alice's code. Amber: a tool of bob could reach it, unused.", { size: 11, serif: true, hue: 'ink-soft' });
  f.text(LX, by + 19, "Violet: bob could not reach it. Grey: alice's save failed. The count is told of saved.", { size: 11, serif: true, hue: 'ink-soft' });
  f.text(LX, by + 34, 'Qwen3 8B on the Mac, temperature 0, one fresh store per session.', { size: 11, serif: true, hue: 'ink-soft' });
});
