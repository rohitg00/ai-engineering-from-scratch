'use strict';

const fs = require('node:fs');
const { stagedPaths } = require('./generate');

function money(value) {
  return `$${(value || 0).toFixed(3)}`;
}

function shortModel(model) {
  return String(model || '').replace(/^claude-/, '');
}

function table(summary) {
  const rows = summary.items.map(item => `| ${item.id ? `\`${item.id}\`` : 'draft'} | \`${summary.card}\` | ${item.ok ? 'written' : 'dropped'} | ${shortModel(item.model)} | ${item.steps.length} | ${item.tokens} | ${money(item.cost)} | ${item.sources.length ? item.sources.map(source => `\`${source}\``).join(', ') : 'none'} |`);
  return ['| Item | Card | Result | Model | Calls | Tokens | Cost | Sources |', '|---|---|---|---|---|---|---|---|', ...rows].join('\n');
}

function report(summary, mode = 'summary') {
  if (mode === 'commit') return `feat(interviews): add ${summary.written.length} questions to ${summary.card}\n\nWritten by scripts/interviews/generate.js with ${shortModel(summary.model)}.\n`;
  if (mode === 'paths') return stagedPaths(summary).map(file => `${file}\n`).join('');
  const failed = summary.failed.length ? ['Dropped, because the checks still failed. A draft gets one repair at most, and a refusal or a spent token budget stops it before the repair. Nothing was committed for these drafts:', ...summary.failed.map(item => `- ${item.id ? `\`${item.id}\`` : 'draft'}: ${item.problems.slice(0, 3).join(' | ')}`)].join('\n') : 'Every draft passed the checks.';
  const later = summary.skipped ? `Not started because of the token budget: ${summary.skipped} items.` : '';
  const head = mode === 'pr'
    ? `Interview questions for the card \`${summary.card}\`, written by \`scripts/interviews/generate.js\`. The model is ${shortModel(summary.model)}.`
    : '## Interview bank generation';
  return [
    head,
    '',
    `Items: ${summary.written.length} of ${summary.requested} written. Tokens: ${summary.tokens} of a budget of ${summary.budget}. Estimated cost: ${money(summary.cost)}.`,
    '',
    table(summary),
    '',
    failed,
    later ? `\n${later}` : '',
    '',
    mode === 'pr' ? 'Each written item passed the interview bank validator, the number rule, the denylist and the 24-character answer leak rule. Read each item and its named sources before you merge.' : '',
  ].join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

if (require.main === module) {
  const summary = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  let mode = 'summary';
  if (process.argv.includes('--pr')) mode = 'pr';
  if (process.argv.includes('--commit')) mode = 'commit';
  if (process.argv.includes('--paths')) mode = 'paths';
  process.stdout.write(report(summary, mode));
}

module.exports = { report };
