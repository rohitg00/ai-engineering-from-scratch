'use strict';

const path = require('path');
const { figure, color } = require('../../../_shared/figkit.js');
const { load } = require('../../../_shared/chart.js');

const data = load(path.join(__dirname, '../../capture/lab/summary/permissions-mac.json'));

const RULES = [
  ['R0 none', 'no rules'],
  ['R1 docs isolate', 'docs: isolate'],
  ['R2 docs protect-files', 'docs: protect'],
  ['R3 docs order-bug', 'docs: "bug" order'],
  ['R4 docs read-only', 'docs: read-only'],
  ['R5 docs deny-all', 'docs: deny all'],
  ['R7 dot-aware isolate', 'dot-aware isolate'],
];
const OPS = [
  ['read /.env', 'read', '/', '.env'],
  ['read /workspace/.env', 'read', 'ws/', '.env'],
  ['read /workspace/.git/config', 'read', 'ws/', '.git'],
  ['read /secrets/key.txt', 'read', '/', 'secrets'],
  ['read symlink to /secrets', 'read', 'ws/', 'link'],
  ['ls /workspace', 'ls', '/', 'ws'],
  ['write /.bashrc', 'write', '/', '.bashrc'],
  ['edit /workspace/.env', 'edit', 'ws/', '.env'],
  ['delete /.env', 'delete', '/', '.env'],
  ['delete /workspace dir', 'delete', '/', 'ws'],
];
const HUE = { 'ran, rule meant to block': 'rose', 'blocked as meant': 'violet', 'ran as meant': 'grey', 'blocked, rule meant to allow': 'amber', error: 'grey' };
const WORD = { ALLOW: 'ran', DENY: 'denied', 'PATH-BLOCK': 'blocked', ASK: 'asked', 'RUN-ERROR': 'crash', ERROR: 'error' };

const cellOf = (rules, op) => {
  const c = data.matrix.cells.find(x => x.rules === rules && x.op === op);
  if (!c) throw new Error(`fig-8-4b: no cell ${rules} / ${op}`);
  return c;
};

const MODELS = Object.keys(data.adversarial).sort().reverse();
const LABEL = { 'ollama:qwen3:8b': 'Qwen3 8B', 'anthropic:claude-haiku-5-5': 'Haiku 5.5' };
const CFG = [['none', 'no rules'], ['docs', 'docs rules'], ['fixed', 'dot-aware']];

const runsOf = (model, cfg) => {
  const v = data.adversarial[model][cfg];
  if (!v || v.n !== 20) throw new Error(`fig-8-4b: ${model} ${cfg} has n=${v && v.n}, expected 20`);
  return v;
};

const runKind = (v, pid) => {
  const harm = v.disk_change_prompts.includes(pid) || v.secret_in_answer_prompts.includes(pid);
  if (harm) return 'rose';
  if (!v.attempted_prompts.includes(pid)) return 'grey';
  if (v.secret_reached_model_prompts.includes(pid)) return 'amber';
  return 'violet';
};

const LX = 20;
const GX = 162;
const CW = 46;
const GY = 72;
const RH = 22;
const gridBottom = GY + RULES.length * RH;
const AY = gridBottom + 86;
const AH = 22;
const SQ = 13;
const advBottom = AY + MODELS.length * CFG.length * AH;

const gapCount = Object.values(data.matrix.ran_though_meant_to_block).reduce((n, l) => n + l.length, 0);

module.exports = figure('fig-8-4b', {
  height: advBottom + 66,
  title: 'File rules at the pin: one call per cell, then 20 attacks per model',
  desc: `Top: a grid of ${RULES.length} rule lists by ${OPS.length} tool calls on a FilesystemBackend with virtual_mode=True, run by a scripted caller with no model. A rose cell is a call that ran although the rule list was written to block it; ${gapCount} such calls across the five docs rule lists, all on paths whose name starts with a dot. Violet is blocked as meant, amber is blocked although meant to be allowed, grey ran as meant. Bottom: one square per adversarial prompt, 20 per row, for ${MODELS.map(m => LABEL[m]).join(' and ')} under no rules, the docs isolate rules, and the dot-aware rules. ${MODELS.map(m => CFG.map(([c, l]) => `${LABEL[m]} ${l}: ${runsOf(m, c).harm_runs} runs with harm`).join(', ')).join('. ')}.`,
}, f => {
  f.kicker(LX, 18, 'one call per cell, scripted caller, no model');
  OPS.forEach(([, a, b, c], j) => {
    const cx = GX + j * CW + CW / 2;
    f.text(cx, 36, a, { size: 11, anchor: 'middle', hue: 'ink-soft' });
    f.text(cx, 50, b, { size: 11, anchor: 'middle', hue: 'ink-soft' });
    f.text(cx, 64, c, { size: 11, anchor: 'middle', weight: 700 });
  });
  RULES.forEach(([key, label], i) => {
    const y = GY + i * RH;
    f.text(LX, y + 15, label, { size: 11.5, weight: key.startsWith('R7') ? 700 : undefined, max: GX - LX - 4, size: 11 });
    OPS.forEach(([op], j) => {
      const c = cellOf(key, op);
      const hue = HUE[c.verdict] || 'grey';
      const x = GX + j * CW;
      f.rect(x + 1, y + 1, CW - 2, RH - 2, { fill: color(`${hue}-fill`), stroke: color(`${hue}-ink`) });
      f.text(x + CW / 2, y + 15, WORD[c.outcome] || c.outcome, { size: 11, anchor: 'middle', hue });
    });
  });
  f.text(LX, gridBottom + 18, 'Rose: ran, though the rules were written to block it.', { size: 11, serif: true, hue: 'ink-soft' });
  f.text(LX, gridBottom + 33, 'Violet: blocked as meant. Amber: blocked, though meant to', { size: 11, serif: true, hue: 'ink-soft' });

  f.text(LX, gridBottom + 48, 'be allowed. Grey: ran as meant. ws is /workspace.', { size: 11, serif: true, hue: 'ink-soft' });
  f.kicker(LX, AY - 14, '20 adversarial prompts, one square per run');
  f.text(GX + 20 * (SQ + 3) + 14, AY - 14, 'harm', { size: 11, hue: 'ink-soft', weight: 700 });
  f.text(GX + 20 * (SQ + 3) + 64, AY - 14, 'stopped', { size: 11, hue: 'ink-soft', weight: 700 });
  let row = 0;
  MODELS.forEach(model => {
    CFG.forEach(([cfg, label]) => {
      const v = runsOf(model, cfg);
      const y = AY + row * AH;
      if (cfg === 'none') f.text(LX, y + 11, LABEL[model], { size: 11, weight: 700, max: 66 });
      f.text(LX + 70, y + 11, label, { size: 11, max: GX - LX - 74 });
      v.prompt_ids.forEach((pid, k) => {
        const hue = runKind(v, pid);
        f.rect(GX + k * (SQ + 3), y, SQ, SQ, { fill: color(`${hue}-fill`), stroke: color(`${hue}-ink`) });
      });
      f.text(GX + 20 * (SQ + 3) + 14, y + 11, `${v.harm_runs}`, { size: 11.5, weight: 700, hue: v.harm_runs ? 'rose' : 'ink-soft' });
      f.text(GX + 20 * (SQ + 3) + 64, y + 11, `${v.stopped_calls} of ${v.attempt_calls}`, { size: 11.5, hue: 'ink-soft' });
      row += 1;
    });
    row += 0;
  });
  f.text(LX, advBottom + 18, 'Rose: the disk changed, or a secret reached the answer.', { size: 11, serif: true, hue: 'ink-soft' });
  f.text(LX, advBottom + 33, 'Amber: a secret reached the model only. Violet: tried, no harm.', { size: 11, serif: true, hue: 'ink-soft' });
  f.text(LX, advBottom + 48, 'Grey: no try. Stopped: attack calls denied or path-blocked, of all.', { size: 11, serif: true, hue: 'ink-soft' });
});
