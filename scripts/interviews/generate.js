'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const bankLib = require('./validate');
const writer = require('../cheatsheets/generate');

const ROOT = path.resolve(__dirname, '..', '..');
const { MODELS, DEFAULT_MODEL, callCost, requestFor } = writer;
const MAX_ITEMS = 5;
const DEFAULT_TOKEN_BUDGET = 600000;
const MAX_FILE_CHARS = 60000;
const MAX_BUNDLE_CHARS = 300000;
const BOT_BRANCH = 'interviews/auto-';
const EXEMPLARS = ['interviews/questions/inference-serving/prefix-cache-order.md', 'interviews/questions/agents/the-agent-loops-forever.md'];
const LINKED = ['phases', 'manuals', 'practice', 'cheatsheets', 'learning-paths'];
const STOP_WORDS = new Set('the and for with from that this what when why how your you are does not into than then them they its can one two which who will was were has have but out all any our use used uses about after before over under only each more most some why'.split(' '));
const TITLE_DUPLICATE = 0.6;
const PROMPT_DUPLICATE = 0.5;

function readText(root, rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function plain(md) {
  return String(md || '').replace(/```[\s\S]*?```/g, ' ').replace(/`([^`]*)`/g, '$1').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[*_#>|]/g, '').replace(/\s+/g, ' ').trim();
}

function visible(md) {
  return String(md || '').replace(/^\s*(?:```|~~~).*$/gm, ' ').replace(/`([^`]*)`/g, '$1').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[*_#>|]/g, '').replace(/\s+/g, ' ').trim();
}

const FENCED = /^\s*(```|~~~)[^\n]*\n[\s\S]*?^\s*\1[^\n]*$/gm;

function prose(md) {
  return plain(String(md || '').replace(FENCED, ' '));
}

function hasCode(md) {
  return new RegExp(FENCED.source, 'm').test(String(md || ''));
}

function promptScore(a, b) {
  const full = jaccard(a, b);
  return hasCode(a) && hasCode(b) ? full : Math.max(full, jaccard(a, b, prose));
}

function words(text, flatten = visible) {
  return new Set(flatten(text).toLowerCase().split(/[^a-z0-9]+/).filter(word => word.length > 2 && !STOP_WORDS.has(word)));
}

function jaccard(a, b, flatten = visible) {
  const left = words(a, flatten);
  const right = words(b, flatten);
  if (!left.size || !right.size) return 0;
  let shared = 0;
  for (const word of left) if (right.has(word)) shared += 1;
  return shared / (left.size + right.size - shared);
}

function cardSources(card, root = ROOT, cache = new Map()) {
  const groups = [card.lessons.map(lesson => ({ ref: lesson, file: `${lesson}/docs/en.md`, kind: 'lesson' }))];
  for (const id of card.manuals) {
    const manual = bankLib.manualSections(root, id, cache);
    if (manual) groups.push(Array.from(manual.sections, ([slug, file]) => ({ ref: `${id}#${slug}`, file, kind: 'manual' })));
  }
  const files = [];
  for (let index = 0; groups.some(group => index < group.length); index++) for (const group of groups) if (index < group.length) files.push(group[index]);
  return files.filter(entry => fs.existsSync(path.join(root, entry.file)));
}

function sourceBundle(card, root = ROOT) {
  const kept = [];
  const omitted = [];
  let total = 0;
  const entries = cardSources(card, root).map(entry => ({ ...entry, text: readText(root, entry.file) }));
  const full = entries.reduce((sum, entry) => sum + entry.text.length, 0);
  for (const entry of entries) {
    const text = full > MAX_BUNDLE_CHARS && entry.kind === 'manual' ? writer.trimMarkdown(entry.text) : entry.text;
    if (text.length > MAX_FILE_CHARS || total + text.length > MAX_BUNDLE_CHARS) {
      omitted.push(entry);
      continue;
    }
    kept.push({ ...entry, text });
    total += text.length;
  }
  const text = kept.map(entry => `=== ${entry.kind} ${entry.ref} (${entry.file}) ===\n${entry.text}`).join('\n\n');
  return { text, sources: kept.map(({ ref, file, kind }) => ({ ref, file, kind })), omitted: omitted.map(entry => entry.ref), chars: total };
}

function systemPrompt(card, bundle, root = ROOT) {
  const denylist = readText(root, 'scripts/interviews/denylist.txt').split('\n').map(line => line.trim()).filter(Boolean);
  const parts = [
    readText(root, 'scripts/interviews/prompt.md'),
    `## The denylist\n\n${denylist.join(', ')}`,
    `## The authoring guide (interviews/AUTHORING.md)\n\n${readText(root, 'interviews/AUTHORING.md')}`,
  ];
  for (const file of EXEMPLARS) if (fs.existsSync(path.join(root, file))) parts.push(`## Example question (${file})\n\n${readText(root, file)}`);
  const omitted = bundle.omitted.length ? `\nThese sources were too large to include. Do not name them and do not cite facts from them: ${bundle.omitted.join(', ')}\n` : '';
  parts.push(`## The source files of the card ${card.id}\n${omitted}\n${bundle.text}`);
  return parts.join('\n\n');
}

function existingItems(bank, cardId) {
  return bank.questions.filter(item => item.card === cardId && item.data).map(item => ({ id: item.id, title: item.data.title, prompt: item.parsed ? item.parsed.preamble : '' }));
}

function userPrompt(card, { roles, existing, bundle, date }) {
  const allowed = bundle.sources.map(source => `- ${source.kind === 'lesson' ? 'lesson' : 'manual section'}: ${source.ref}`).join('\n');
  const list = existing.length ? existing.map(item => `- ${item.id}: ${item.title}. ${plain(item.prompt).slice(0, 300)}`).join('\n') : '- none';
  return `Write one new question for this card.

card: ${card.id}
title: ${card.title}
summary: ${card.summary}
roles for this card: ${roles.join(', ')}
updated: ${date}

The allowed sources:
${allowed}

The existing questions of the card. Do not repeat one of them:
${list}`;
}

function replyText(message) {
  return message.content.filter(block => block.type === 'text').map(block => block.text).join('\n');
}

function parseReply(text) {
  const match = /<item>\s*([\s\S]*?)\s*<\/item>/.exec(text);
  if (!match) return { error: 'The reply must hold one <item> part.' };
  return { text: match[1].replace(/^```[a-z]*\n/, '').replace(/\n```$/, '') };
}

function normalizeItem(text, card, date = today()) {
  const normal = text.replace(/\r\n/g, '\n');
  let parsed;
  try {
    parsed = bankLib.splitFrontMatter(normal, 'draft');
  } catch (error) {
    return { error: error.message.replace(/^draft: /, '') };
  }
  const id = String(parsed.data.id || '');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) return { error: 'id must be lower case words joined by hyphens' };
  const end = normal.indexOf('\n---\n', 4);
  const head = normal.slice(4, end).split('\n').map(line => line.replace(/^card:.*$/, `card: ${card.id}`).replace(/^updated:.*$/, `updated: ${date}`)).join('\n');
  const body = normal.slice(end + 5).replace(/^\n*/, '\n').replace(/\s*$/, '\n');
  return { id, file: `interviews/questions/${card.id}/${id}.md`, text: `---\n${head}\n---\n${body}` };
}

function duplicateProblems(draft, others) {
  const problems = [];
  for (const other of others) {
    if (other.id === draft.id) problems.push(`the id ${draft.id} is taken by an existing question. Pick a new subject and a new id`);
    else if (jaccard(draft.title, other.title) >= TITLE_DUPLICATE) problems.push(`the title is too close to the existing question ${other.id} ("${other.title}"). Ask a different question`);
    else if (promptScore(draft.prompt, other.prompt) >= PROMPT_DUPLICATE) problems.push(`the prompt is too close to the existing question ${other.id}. Ask a different question`);
  }
  return problems;
}

function answerText(item) {
  const s = item.sections || {};
  if (item.kind === 'scenario') return [s.Walkthrough, s.Resolution].join('\n');
  return [s['Short answer'], s['Full answer']].concat((item.followUps || []).filter(entry => entry.expected).map(entry => entry.expected)).join('\n');
}

function shownText(item) {
  const s = item.sections || {};
  return plain(`${item.data.title}\n${item.kind === 'scenario' ? s.Situation : item.parsed.preamble}`);
}

function siteProblems(item, bank) {
  const problems = [];
  const s = item.sections;
  if (/^`/.test(item.parsed.preamble)) problems.push('the prompt must start with plain words, not with a code span');
  if (/^`/.test(s['Short answer'] || '')) problems.push('the Short answer must start with plain words, not with a code span');
  const answers = answerText(item);
  const asked = (item.followUps || []).filter(entry => entry.question).map(entry => entry.question);
  const own = bankLib.sharedSpans(answers, visible([item.data.title, item.data.tags.join(' '), item.parsed.preamble].concat(asked, s['Taught in']).join('\n')));
  if (own.length) problems.push(`the title, the tags, the prompt, a follow-up question or the Taught in line shows an answer span: "${own[0]}"`);
  const cards = plain(bank.cards.map(card => `${card.title}\n${card.summary}`).join('\n'));
  const listed = bankLib.sharedSpans(answers, cards);
  if (listed.length) problems.push(`a card summary shows an answer span: "${listed[0]}"`);
  for (const other of bank.questions.concat(bank.scenarios)) {
    if (other === item || !other.data || !other.sections || !other.parsed) continue;
    const out = bankLib.sharedSpans(answers, shownText(other));
    if (out.length) problems.push(`the search record of ${other.card}/${other.id} shows an answer span of this item: "${out[0]}". Write the answer in other words`);
    const back = bankLib.sharedSpans(answerText(other), shownText(item));
    if (back.length) problems.push(`the title or the prompt shows an answer span of ${other.card}/${other.id}: "${back[0]}". Ask it in other words`);
  }
  return problems;
}

function makeSandbox(root) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'aiefs-interview-gen-'));
  for (const name of LINKED) if (fs.existsSync(path.join(root, name))) fs.symlinkSync(fs.realpathSync(path.join(root, name)), path.join(temp, name));
  fs.cpSync(path.join(root, 'interviews'), path.join(temp, 'interviews'), { recursive: true });
  fs.mkdirSync(path.join(temp, 'scripts', 'interviews'), { recursive: true });
  fs.copyFileSync(path.join(root, 'scripts', 'interviews', 'denylist.txt'), path.join(temp, 'scripts', 'interviews', 'denylist.txt'));
  const baseline = new Set(bankLib.loadBank(temp).errors);
  return { root: temp, baseline, remove: () => fs.rmSync(temp, { recursive: true, force: true }) };
}

function checkDraft(draft, sandbox) {
  const full = path.join(sandbox.root, draft.file);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, draft.text);
  const bank = bankLib.loadBank(sandbox.root);
  const problems = bank.errors.filter(error => !sandbox.baseline.has(error)).map(error => error.replace(`${draft.file}: `, ''));
  const item = bank.questions.find(entry => entry.file === draft.file);
  if (!problems.length && item) problems.push(...siteProblems(item, bank));
  if (problems.length) fs.unlinkSync(full);
  return { problems, item };
}

function evaluateReply(message, card, others, sandbox, date) {
  if (message.stop_reason === 'refusal') return { problems: ['the model declined the request'], refused: true };
  if (message.stop_reason === 'max_tokens') return { problems: ['the reply reached the token limit before it finished. Write a shorter file.'] };
  const reply = parseReply(replyText(message));
  if (reply.error) return { problems: [reply.error] };
  const draft = normalizeItem(reply.text, card, date);
  if (draft.error) return { problems: [draft.error] };
  let parsed;
  try {
    parsed = bankLib.splitFrontMatter(draft.text, draft.file);
  } catch (error) {
    return { problems: [error.message], draft };
  }
  const sections = bankLib.splitSections(parsed.body);
  draft.title = String(parsed.data.title || '');
  draft.prompt = sections.preamble;
  const dupes = duplicateProblems(draft, others);
  if (dupes.length) return { problems: dupes, draft };
  const checked = checkDraft(draft, sandbox);
  return { problems: checked.problems, draft, item: checked.item };
}

function emptyUsage() {
  return { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, calls: 0, cost: 0 };
}

function addCall(total, usage, model) {
  if (!usage) return total;
  total.input += usage.input_tokens || 0;
  total.output += usage.output_tokens || 0;
  total.cacheRead += usage.cache_read_input_tokens || 0;
  total.cacheWrite += usage.cache_creation_input_tokens || 0;
  total.calls += 1;
  total.cost += callCost(usage, model);
  return total;
}

function addUsage(total, usage) {
  for (const key of Object.keys(total)) total[key] += usage[key] || 0;
  return total;
}

function usageTokens(usage) {
  return usage.input + usage.output + usage.cacheRead + usage.cacheWrite;
}

async function callModel(client, { model, system, messages }) {
  return client.beta.messages.stream(requestFor(model, system, messages)).finalMessage();
}

async function generateItem({ card, client, model, system, prompt, others, sandbox, date, budgetLeft = Infinity, log = () => {} }) {
  const usage = emptyUsage();
  const steps = [];
  const call = async (messages, step) => {
    const message = await callModel(client, { model, system, messages });
    addCall(usage, message.usage, model);
    steps.push(step);
    return message;
  };
  const finish = (result, evaluation) => ({ usage, steps, model, id: evaluation.draft ? evaluation.draft.id : '', ...result });
  const messages = [{ role: 'user', content: prompt }];
  let evaluation = {};
  try {
    let message = await call(messages, 'draft');
    evaluation = evaluateReply(message, card, others, sandbox, date);
    if (!evaluation.problems.length) return finish({ ok: true, problems: [], draft: evaluation.draft, item: evaluation.item }, evaluation);
    if (evaluation.refused) return finish({ ok: false, problems: evaluation.problems }, evaluation);
    if (usageTokens(usage) >= budgetLeft) return finish({ ok: false, problems: evaluation.problems.concat(['the token budget ran out before the repair']) }, evaluation);
    log(`${card.id}: repair ${evaluation.draft ? evaluation.draft.id : 'draft'} for ${evaluation.problems.length} problems`);
    messages.push({ role: 'assistant', content: message.content });
    messages.push({ role: 'user', content: `The checks found these problems:\n\n${evaluation.problems.map(problem => `- ${problem}`).join('\n')}\n\nFix every problem. Remove a number or a fact that no named source holds. Reply with the complete file in the <item> part.` });
    message = await call(messages, 'repair');
    evaluation = evaluateReply(message, card, others, sandbox, date);
    if (!evaluation.problems.length) return finish({ ok: true, problems: [], draft: evaluation.draft, item: evaluation.item }, evaluation);
    return finish({ ok: false, problems: evaluation.problems }, evaluation);
  } catch (error) {
    return finish({ ok: false, problems: [String(error && error.message || error)] }, evaluation);
  }
}

function itemSources(item) {
  if (!item || !item.data) return [];
  return item.data.lessons.concat(item.data.manuals);
}

function guard({ hasKey, openPrs, count }) {
  if (Number(openPrs) > 0) return { run: false, code: 0, reason: 'An interview bank pull request from this generator is already open. Merge or close it before the next run.' };
  if (!hasKey) return { run: false, code: 2, reason: 'ANTHROPIC_API_KEY is not set.' };
  const asked = count === '' || count === undefined ? 1 : Number(count);
  if (!Number.isInteger(asked) || asked < 1) return { run: false, code: 0, reason: 'The count is 0. Nothing to do.' };
  return { run: true, count: Math.max(1, Math.min(MAX_ITEMS, asked)), capped: asked > MAX_ITEMS };
}

function stagedPaths(summary) {
  return (summary.files || []).filter(file => /^interviews\/questions\/[a-z0-9-]+\/[a-z0-9-]+\.md$/.test(file) && !/\/README\.md$/.test(file));
}

function resolveModel(name) {
  return MODELS[name] || name || DEFAULT_MODEL;
}

function createClient() {
  const sdk = require('@anthropic-ai/sdk');
  const Anthropic = sdk.default || sdk;
  return new Anthropic();
}

async function main(argv, { client, root = ROOT, out = console, date = today() } = {}) {
  const value = name => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : '');
  const valueFlags = new Set(['--model', '--count', '--summary', '--token-budget', '--open-prs']);
  const named = argv.filter((arg, index) => !arg.startsWith('--') && !valueFlags.has(argv[index - 1]));
  const bank = bankLib.loadBank(root);
  if (bank.errors.length) {
    for (const error of bank.errors) out.error(error);
    return 1;
  }
  const cards = new Map(bank.cards.map(card => [card.id, card]));
  if (named.length !== 1 || !cards.has(named[0]) || named[0] === bankLib.SCENARIO_CARD) {
    out.error(`Give one question card: ${bank.cards.filter(card => card.id !== bankLib.SCENARIO_CARD).map(card => card.id).join(', ')}`);
    return 1;
  }
  const card = cards.get(named[0]);
  const bundle = sourceBundle(card, root);
  if (argv.includes('--dry-run')) {
    const count = value('--count') === '' ? 1 : Math.max(0, Math.min(MAX_ITEMS, Number(value('--count')) || 0));
    out.log(`${card.id}: ${count} items, ${bundle.sources.length} sources, ${bundle.chars} characters${bundle.omitted.length ? `, ${bundle.omitted.length} left out` : ''}, ${existingItems(bank, card.id).length} existing questions`);
    return 0;
  }
  const gate = guard({ hasKey: Boolean(client || process.env.ANTHROPIC_API_KEY), openPrs: value('--open-prs'), count: value('--count') });
  if (!gate.run) {
    out.error(gate.reason);
    return gate.code;
  }
  if (gate.capped) out.log(`The count is capped at ${MAX_ITEMS} items for one run.`);
  const budget = value('--token-budget') === '' ? DEFAULT_TOKEN_BUDGET : Number(value('--token-budget'));
  if (!Number.isInteger(budget) || budget < 0) {
    out.error('--token-budget must be a whole number of 0 or more.');
    return 1;
  }
  const api = client || createClient();
  const model = resolveModel(value('--model'));
  const roles = bank.roles.filter(role => role.cards.includes(card.id)).map(role => role.id);
  const system = systemPrompt(card, bundle, root);
  const others = existingItems(bank, card.id);
  const sandbox = makeSandbox(root);
  const total = emptyUsage();
  const results = [];
  let skipped = 0;
  try {
    for (let slot = 0; slot < gate.count; slot++) {
      if (usageTokens(total) >= budget) {
        skipped = gate.count - slot;
        break;
      }
      try {
        const prompt = userPrompt(card, { roles, existing: others, bundle, date });
        const result = await generateItem({ card, client: api, model, system, prompt, others, sandbox, date, budgetLeft: budget - usageTokens(total), log: line => out.log(line) });
        addUsage(total, result.usage);
        if (result.ok) {
          fs.mkdirSync(path.dirname(path.join(root, result.draft.file)), { recursive: true });
          fs.writeFileSync(path.join(root, result.draft.file), result.draft.text);
          others.push({ id: result.draft.id, title: result.draft.title, prompt: result.draft.prompt });
          out.log(`${card.id}: wrote ${result.draft.file} after ${result.steps.join(', ')}`);
        }
        results.push({ ...result, sources: itemSources(result.item), file: result.ok ? result.draft.file : '' });
      } catch (error) {
        results.push({ id: '', ok: false, model, steps: [], problems: [String(error && error.message || error)], usage: emptyUsage(), sources: [], file: '' });
        out.error(`${card.id}: ${error && error.message || error}`);
      }
    }
  } finally {
    sandbox.remove();
  }
  const summary = {
    card: card.id,
    model,
    budget,
    requested: gate.count,
    usage: total,
    tokens: usageTokens(total),
    cost: total.cost,
    written: results.filter(result => result.ok).map(result => result.id),
    files: results.filter(result => result.ok).map(result => result.file),
    failed: results.filter(result => !result.ok).map(({ id, steps, problems }) => ({ id, steps, problems })),
    skipped,
    items: results.map(({ id, ok, model: producer, steps, usage, sources }) => ({ id, ok, model: producer, steps, sources, tokens: usageTokens(usage), cost: usage.cost })),
  };
  if (value('--summary')) fs.writeFileSync(value('--summary'), `${JSON.stringify(summary, null, 2)}\n`);
  out.log(`Wrote ${summary.written.length} of ${gate.count} questions for ${card.id}. ${summary.failed.length} dropped. Tokens: ${summary.tokens}, estimated cost $${summary.cost.toFixed(2)}.`);
  for (const failure of summary.failed) out.error(`${failure.id || 'draft'}: ${failure.problems.slice(0, 5).join(' | ')}`);
  return summary.failed.length ? 1 : 0;
}

if (require.main === module) {
  main(process.argv.slice(2)).then(code => {
    process.exitCode = code;
  }, error => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = { MAX_ITEMS, DEFAULT_TOKEN_BUDGET, BOT_BRANCH, plain, visible, jaccard, cardSources, sourceBundle, systemPrompt, userPrompt, parseReply, normalizeItem, duplicateProblems, siteProblems, makeSandbox, checkDraft, generateItem, guard, stagedPaths, main };
