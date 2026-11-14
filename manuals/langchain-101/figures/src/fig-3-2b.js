'use strict';

const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const { load } = require('../../../_shared/chart.js');

const data = load(path.join(__dirname, '../../capture/lab/summary/structured-output-mac.json'));
const models = [['qwen3:0.6b', '0.6B, n=20'], ['qwen3:1.7b', '1.7B, n=10'], ['qwen3:4b-instruct-2507-q4_K_M', '4B, n=10'], ['qwen3:8b', '8B, n=10']];
const schemas = ['flat', 'nested', 'union', 'enum'];
const strategies = [['tool', 'ToolStrategy'], ['provider', 'ProviderStrategy']];
const hueOf = { valid: 'blue', retried_valid: 'amber', raised: 'rose', missing: 'rose' };
const count = (key, outcome) => data.cells[key].outcomes.filter(o => o === outcome).length;

module.exports = figure('fig-3-2b', {
  height: 400,
  title: 'The outcome of each structured output run',
  desc: `A dot matrix of ${data.runs} runs on the Mac with four Qwen3 models on Ollama. Rows are the flat, nested, union, and enum schemas under ToolStrategy and ProviderStrategy, and columns are the 0.6B, 1.7B, 4B, and 8B models. Blue dots are valid on the first call, amber dots are valid after a retry, and rose dots raised. ProviderStrategy raised on every union run at build time and on ${count('qwen3:4b-instruct-2507-q4_K_M enum provider', 'raised')} enum runs on the 4B model, and was valid otherwise. ToolStrategy raised on ${count('qwen3:0.6b nested tool', 'raised')} of 20 nested runs on 0.6B and ${count('qwen3:8b nested tool', 'raised')} of 10 on 8B.`,
}, f => {
  const x0 = 170;
  const colW = 112;
  models.forEach(([, label], c) => f.text(x0 + c * colW + 48, 26, label, { size: 11, anchor: 'middle', hue: 'ink-soft' }));
  let y = 42;
  strategies.forEach(([strategy, strategyLabel], s) => {
    f.kicker(20, y + 12, strategyLabel, { hue: 'ink-soft' });
    y += 20;
    schemas.forEach(schema => {
      f.text(30, y + 14, schema, { size: 11.5 });
      f.rule(x0 - 8, y + 30, 620, y + 30, { hue: 'ink-mute', opacity: 0.25 });
      models.forEach(([model], c) => {
        const outcomes = data.cells[`${model} ${schema} ${strategy}`].outcomes;
        outcomes.forEach((outcome, i) => {
          const dx = (i % 10) * 10;
          const dy = outcomes.length > 10 ? (i < 10 ? 5 : 17) : 11;
          f.dot(x0 + c * colW + dx, y + dy, { hue: hueOf[outcome], r: 3.4 });
        });
      });
      y += 32;
    });
    y += 4;
  });
  const legend = [['valid on the first call', 'blue'], ['valid after a retry', 'amber'], ['raised', 'rose']];
  let lx = 20;
  legend.forEach(([label, hue]) => {
    f.dot(lx + 4, y + 16, { hue, r: 3.8 });
    const box = f.text(lx + 14, y + 20, label, { size: 11.5, hue });
    lx = box.right + 24;
  });
  f.text(20, y + 42, 'Each dot is one run on the Mac. Every ProviderStrategy union run raised in create_agent.', { size: 11, serif: true, hue: 'ink-soft' });
});
