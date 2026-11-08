'use strict';

const fs = require('node:fs');

function money(value) {
  return `$${(value || 0).toFixed(3)}`;
}

function shortModel(model) {
  return String(model || '').replace(/^claude-/, '');
}

function table(summary) {
  const rows = summary.drafts.map(draft => `| \`${draft.lesson}\` | ${draft.id ? `\`${draft.id}\`` : '-'} | ${draft.ok ? 'written' : 'skipped'} | ${shortModel(draft.model)} | ${draft.steps.length} | ${draft.tokens} | ${money(draft.cost)} |`);
  return ['| Lesson | Problem | Result | Model | Calls | Tokens | Cost |', '|---|---|---|---|---|---|---|', ...rows].join('\n');
}

function commitMessage(summary) {
  const lines = summary.drafts.filter(draft => draft.ok).map(draft => `- practice/${draft.id} from ${draft.lesson}`);
  return `chore(practice): draft ${summary.written.length} problems\n\nDrafted by scripts/practice/generate.js. Each problem passed scripts/practice/validate.py.\n\n${lines.join('\n')}\n`;
}

function report(summary, mode = 'summary') {
  if (mode === 'commit') return commitMessage(summary);
  const escalated = summary.escalated.length ? `Escalated to ${shortModel(summary.escalation)}: ${summary.escalated.map(id => `\`${id}\``).join(', ')}.` : 'No problem needed escalation.';
  const failed = summary.failed.length ? ['Skipped, because the validator still failed after the retries and the escalation. Nothing was committed for these lessons:', ...summary.failed.map(item => `- \`${item.lesson}\`: ${item.problems.slice(0, 3).join(' | ')}`)].join('\n') : 'Every requested lesson gave a problem that passed the validator.';
  const later = summary.skipped.length ? `Not started because of the problem cap or the token budget: ${summary.skipped.map(lesson => `\`${lesson}\``).join(', ')}. Start them in the next run.` : '';
  const head = mode === 'pr'
    ? 'Practice problems drafted by `scripts/practice/generate.js`.'
    : '## Practice problem drafts';
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
    mode === 'pr' ? 'Each written problem passed `scripts/practice/validate.py`: the solution passes, the starter and every mutant fail, the fixtures are current and the statement does not show the solution. Read each statement, the checks and the hints before you merge.' : '',
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
