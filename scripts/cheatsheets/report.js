'use strict';

const fs = require('node:fs');

function money(value) {
  return `$${(value || 0).toFixed(3)}`;
}

function shortModel(model) {
  return String(model || '').replace(/^claude-/, '');
}

function table(summary) {
  const rows = summary.topics.map(topic => `| \`${topic.id}\` | ${topic.ok ? 'written' : 'skipped'} | ${shortModel(topic.model)} | ${topic.score} | ${topic.steps.length} | ${topic.tokens} | ${money(topic.cost)} |`);
  return ['| Topic | Result | Model | Rubric score | Calls | Tokens | Cost |', '|---|---|---|---|---|---|---|', ...rows].join('\n');
}

function report(summary, mode = 'summary') {
  const escalated = summary.escalated.length ? `Escalated to ${shortModel(summary.escalation)}: ${summary.escalated.map(id => `\`${id}\``).join(', ')}.` : 'No topic needed escalation.';
  const failed = summary.failed.length ? ['Skipped, because the checks still failed after the retries and the escalation. Nothing was committed for these topics:', ...summary.failed.map(item => `- \`${item.id}\`: ${item.problems.slice(0, 3).join(' | ')}`)].join('\n') : 'Every requested topic passed the checks.';
  const later = summary.skipped.length ? `Not started because of the topic cap or the token budget: ${summary.skipped.map(id => `\`${id}\``).join(', ')}. The next run takes them.` : '';
  if (mode === 'commit') return `chore(cheatsheets): write ${summary.written.length} sheets\n\nWritten by scripts/cheatsheets/generate.js with ${shortModel(summary.model)}. ${summary.escalated.length} escalated to ${shortModel(summary.escalation)}.\n`;
  const head = mode === 'pr'
    ? `Cheat sheets written by \`scripts/cheatsheets/generate.js\`. The draft model is ${shortModel(summary.model)}.`
    : `## Cheat sheet generation`;
  return [
    head,
    '',
    `Tokens: ${summary.tokens} of a budget of ${summary.budget}. Estimated cost: ${money(summary.cost)}.`,
    '',
    table(summary),
    '',
    escalated,
    '',
    failed,
    later ? `\n${later}` : '',
    '',
    mode === 'pr' ? 'Each written sheet passed the literal fact check, the quality rubric, the two-page limit and the cheat sheet tests. Read each sheet and its evidence file before you merge.' : '',
  ].join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

if (require.main === module) {
  const summary = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  let mode = 'summary';
  if (process.argv.includes('--pr')) mode = 'pr';
  if (process.argv.includes('--commit')) mode = 'commit';
  process.stdout.write(report(summary, mode));
}

module.exports = { report };
