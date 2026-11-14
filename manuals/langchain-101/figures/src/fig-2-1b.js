'use strict';

const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const { chart, load } = require('../../../_shared/chart.js');

const data = load(path.join(__dirname, '../../capture/lab/summary/import-times-mac.json'));
const order = ['baseline_pass', 'openai', 'langgraph_only', 'langchain_stack'];
const short = { baseline_pass: 'pass', openai: 'openai', langgraph_only: 'langgraph', langchain_stack: 'agent' };
const hue = { baseline_pass: 'grey', openai: 'olive', langgraph_only: 'indigo', langchain_stack: 'blue' };
const t = id => data.targets[id];

module.exports = figure('fig-2-1b', {
  height: 380,
  title: 'Import time of four imports, 10 runs each',
  desc: `A dot chart of import time in seconds on the Mac, 10 runs of each import in a new Python process, with bytecode on disk on the left and without bytecode on the right. Medians with bytecode: pass ${t('baseline_pass').warm_median} s, import openai ${t('openai').warm_median} s, langgraph StateGraph ${t('langgraph_only').warm_median} s, create_agent with ChatOpenAI ${t('langchain_stack').warm_median} s. Medians without bytecode: ${t('baseline_pass').cold_median} s, ${t('openai').cold_median} s, ${t('langgraph_only').cold_median} s, and ${t('langchain_stack').cold_median} s.`,
}, f => {
  const c = chart(f, { x: 70, y: 40, w: 540, h: 260, xDomain: [0, 9], yDomain: [0, 3], yTicks: [0, 0.5, 1, 1.5, 2, 2.5, 3], yLabel: 'seconds' });
  f.kicker(70 + 135, 30, 'bytecode on disk', { anchor: 'middle' });
  f.kicker(70 + 405, 30, 'no bytecode', { anchor: 'middle' });
  f.rule(c.px(4.5), 40, c.px(4.5), 300, { hue: 'ink-mute', dash: 'dashed' });
  ['warm', 'cold'].forEach((kind, k) => {
    order.forEach((id, i) => {
      const slot = 1 + k * 4.5 + i;
      const runs = t(id)[kind];
      runs.forEach((v, j) => f.dot(c.px(slot) + (j - 4.5) * 2.2, c.py(v), { hue: hue[id], r: 2.6 }));
      const med = t(id)[`${kind}_median`];
      f.rule(c.px(slot) - 16, c.py(med), c.px(slot) + 16, c.py(med), { hue: hue[id], width: 2 });
      f.text(c.px(slot), c.py(med) - 9, String(med), { size: 11, anchor: 'middle', hue: hue[id], knock: true });
      f.text(c.px(slot), 318, short[id], { size: 11, anchor: 'middle', hue: 'ink-soft' });
    });
  });
  f.text(70, 346, 'pass: an empty program. agent: create_agent with ChatOpenAI.', { size: 11, serif: true, hue: 'ink-soft' });
  f.text(70, 364, 'Each dot is one run on the Mac. Each short line is the median of 10.', { size: 11, serif: true, hue: 'ink-soft' });
});
