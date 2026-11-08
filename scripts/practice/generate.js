'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const MODELS = { haiku: 'claude-haiku-5-5', sonnet: 'claude-sonnet-5-5', opus: 'claude-opus-5-5' };
const DEFAULT_MODEL = MODELS.haiku;
const ESCALATION_MODEL = MODELS.sonnet;
const PRICES = {
  'claude-haiku-5-5': { input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite: 0.125, longFrom: 100000, longInput: 0.5, longOutput: 2.5 },
  'claude-sonnet-5-5': { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
  'claude-opus-5-5': { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
};
const FALLBACK_MODELS = new Set([MODELS.sonnet, MODELS.opus]);
const DEFAULT_TOKEN_BUDGET = 1500000;
const MAX_RETRIES = 2;
const MAX_TOKENS = 20000;
const MAX_FILE_CHARS = 60000;
const MAX_BUNDLE_CHARS = 300000;
const GATE_TIMEOUT_MS = 600000;
const BUNDLE_SKIP = /(?:^|\/)(?:tests?|__tests__|fixtures?|samples?|__pycache__|node_modules)\/|(?:^|\/)test_[^/]*$|_test\.py$|\.(?:test|spec)\.[jt]sx?$|\.(?:jsonl|csv|log|pyc|png|jpe?g|gif|svg|pdf|zip|gz|npy|npz|pt|bin|wav|mp3|mp4)$|(?:^|\/)package(?:-lock)?\.json$/;
const EXEMPLAR = 'softmax-cross-entropy';
const LESSON_PATTERN = /^phases\/\d\d-[a-z0-9-]+\/\d\d-[a-z0-9-]+$/;
const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const FIXED_FILES = ['meta.json', 'problem.md', 'starter.py', 'solution.py', 'tests.py', 'hints.md', 'notes.md'];
const MUTANT_PATH = /^mutants\/[a-z0-9_]+\.py$/;
const OPTIONAL_FILES = ['support.py'];
const MIN_MUTANTS = 3;
const MAX_MUTANTS = 6;
const VALIDATOR_FILES = ['scripts/practice/validate.py', 'scripts/practice/run.py'];

function readText(root, rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function listFiles(dir, base = dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const item of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) out.push(...listFiles(full, base));
    else if (item.isFile()) out.push(path.relative(base, full).split(path.sep).join('/'));
  }
  return out;
}

function normalLesson(lesson) {
  return String(lesson || '').replace(/\/+$/, '');
}

function lessonProblem(lesson, root = ROOT) {
  if (!LESSON_PATTERN.test(lesson)) return `${lesson} is not a lesson path like phases/NN-phase/MM-lesson`;
  if (!fs.existsSync(path.join(root, lesson, 'docs', 'en.md'))) return `${lesson} has no docs/en.md`;
  return '';
}

function filePriority(file) {
  if (/\/docs\/en\.md$/.test(file)) return 0;
  if (/\/code\/[^/]+\.py$/.test(file)) return 1;
  if (/\/code\//.test(file)) return 2;
  return 3;
}

function isText(text) {
  return !text.includes('\u0000');
}

function sourceBundle(lesson, root = ROOT) {
  const code = listFiles(path.join(root, lesson, 'code')).map(file => `${lesson}/code/${file}`);
  const files = [`${lesson}/docs/en.md`, ...code].filter(file => !BUNDLE_SKIP.test(file));
  const ranked = files.map((file, index) => ({ file, index, text: readText(root, file) })).sort((a, b) => filePriority(a.file) - filePriority(b.file) || a.index - b.index);
  const kept = [];
  const omitted = [];
  let total = 0;
  for (const item of ranked) {
    if (!isText(item.text) || item.text.length > MAX_FILE_CHARS || total + item.text.length > MAX_BUNDLE_CHARS) {
      omitted.push(item.file);
      continue;
    }
    kept.push(item);
    total += item.text.length;
  }
  kept.sort((a, b) => a.index - b.index);
  const text = kept.map(item => `=== ${item.file} ===\n${item.text}`).join('\n\n');
  return { text, files: kept.map(item => item.file), omitted, chars: total };
}

function problemIds(root = ROOT) {
  const dir = path.join(root, 'practice');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).filter(item => item.isDirectory() && !item.name.startsWith('_') && fs.existsSync(path.join(dir, item.name, 'meta.json'))).map(item => item.name).sort();
}

function collectionIds(root = ROOT) {
  const file = path.join(root, 'practice', 'collections.json');
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file, 'utf8')).map(item => item.id);
}

function cheatsheetIds(root = ROOT) {
  const dir = path.join(root, 'cheatsheets');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(name => /\.md$/.test(name) && !/^[A-Z]/.test(name)).map(name => name.replace(/\.md$/, '')).sort();
}

function exemplarFiles(root = ROOT) {
  const dir = path.join(root, 'practice', EXEMPLAR);
  return listFiles(dir).filter(file => file !== 'fixtures.json' && !/(?:^|\/)__pycache__\//.test(file) && !/\.pyc$/.test(file));
}

function systemPrompt(root = ROOT, taken = problemIds(root)) {
  const parts = [
    readText(root, 'scripts/practice/prompt.md'),
    `## The authoring guide (practice/AUTHORING.md)\n\n${readText(root, 'practice/AUTHORING.md')}`,
  ];
  const example = exemplarFiles(root).map(file => `<file path="${file}">\n${readText(root, `practice/${EXEMPLAR}/${file}`).replace(/\s*$/, '')}\n</file>`);
  if (example.length) parts.push(`## Example problem (practice/${EXEMPLAR})\n\nThe example is a finished problem that passes the validator. It is in the reply format.\n\n${example.join('\n')}`);
  parts.push(`## Collection ids\n\nUse only these ids in \`collections\`: ${collectionIds(root).map(id => `\`${id}\``).join(', ')}.`);
  parts.push(`## Cheat sheet ids\n\nUse one of these ids in \`cheatsheet\`, or \`null\`: ${cheatsheetIds(root).map(id => `\`${id}\``).join(', ')}.`);
  parts.push(`## Existing problem ids\n\nThese ids are taken. Do not use one of them and do not write a problem that does the same task: ${taken.map(id => `\`${id}\``).join(', ') || 'none'}.`);
  return parts.join('\n\n');
}

function userPrompt(lesson, bundle, id) {
  const omitted = bundle.omitted.length ? `\nThese source files were too large to include. Do not use code from them: ${bundle.omitted.join(', ')}\n` : '';
  const name = id ? `id: ${id}\n` : 'id: pick a new id, lower case words joined by hyphens\n';
  return `Write one practice problem for this lesson. Match the example problem in depth and in the number of checks.

lesson: ${lesson}
${name}${omitted}
The source files of the lesson follow.

${bundle.text}`;
}

function safePath(file) {
  if (!file || file.startsWith('/') || file.includes('\\') || file.split('/').includes('..') || file.split('/').includes('.')) return false;
  return FIXED_FILES.includes(file) || OPTIONAL_FILES.includes(file) || MUTANT_PATH.test(file);
}

function stripFence(text) {
  return text.replace(/^\n/, '').replace(/^```[a-z]*\n([\s\S]*?)\n```\s*$/, '$1');
}

function parseReply(text) {
  const files = {};
  const pattern = /<file path="([^"]*)">([\s\S]*?)<\/file>/g;
  let match;
  while ((match = pattern.exec(text))) {
    const file = match[1].trim();
    if (!safePath(file)) return { error: `The reply has the file "${file}". Write only ${FIXED_FILES.join(', ')}, an optional ${OPTIONAL_FILES.join(', ')} and mutants/<name>.py, with a path inside the problem folder.` };
    if (files[file] !== undefined) return { error: `The reply has the file "${file}" two times.` };
    files[file] = `${stripFence(match[2]).replace(/\s*$/, '')}\n`;
  }
  if (!Object.keys(files).length) return { error: 'The reply must hold each file in a <file path="..."> part.' };
  const missing = FIXED_FILES.filter(file => files[file] === undefined);
  if (missing.length) return { error: `The reply has no ${missing.join(', ')}. Reply with every file.` };
  const mutants = Object.keys(files).filter(file => MUTANT_PATH.test(file)).length;
  if (mutants < MIN_MUTANTS || mutants > MAX_MUTANTS) return { error: `The reply has ${mutants} mutants. Write ${MIN_MUTANTS} to ${MAX_MUTANTS} files in mutants/.` };
  return { files };
}

function draftText(files) {
  return Object.keys(files).filter(file => file !== 'fixtures.json').map(file => `<file path="${file}">\n${files[file].replace(/\s*$/, '')}\n</file>`).join('\n');
}

function metaProblems(files, { lesson, id, taken }) {
  let meta;
  try {
    meta = JSON.parse(files['meta.json']);
  } catch (error) {
    return { problems: [`meta.json is not valid JSON: ${error.message}`] };
  }
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return { problems: ['meta.json must hold one JSON object'] };
  const problems = [];
  const name = id || meta.id;
  if (typeof name !== 'string' || !ID_PATTERN.test(name)) problems.push('the id in meta.json must be lower case words joined by hyphens');
  else if (id && meta.id !== id) problems.push(`the id in meta.json must be "${id}"`);
  else if (taken.has(name)) problems.push(`the id "${name}" is taken. Pick a new id`);
  if (meta.lesson !== lesson) problems.push(`the lesson in meta.json must be "${lesson}"`);
  return { problems, id: name };
}

function pythonBin() {
  return process.env.PRACTICE_PYTHON || 'python3';
}

function validatorProblems(output) {
  const lines = output.split('\n');
  const found = lines.filter(line => /^\s{2,}\S/.test(line)).map(line => line.trim());
  for (const line of lines) {
    const global = /^FAIL (?!\S+\s+\d+ mutants caught)(.+)$/.exec(line);
    if (global) found.push(global[1].trim());
  }
  return found;
}

function stage(files, id, root) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'practice-gen-'));
  for (const rel of VALIDATOR_FILES) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.copyFileSync(path.join(root, rel), path.join(dir, rel));
  }
  fs.cpSync(path.join(root, 'practice', '_harness'), path.join(dir, 'practice', '_harness'), { recursive: true, filter: source => !/__pycache__/.test(source) });
  fs.copyFileSync(path.join(root, 'practice', 'collections.json'), path.join(dir, 'practice', 'collections.json'));
  if (fs.existsSync(path.join(root, 'research', 'methods.json'))) {
    fs.mkdirSync(path.join(dir, 'research'), { recursive: true });
    fs.copyFileSync(path.join(root, 'research', 'methods.json'), path.join(dir, 'research', 'methods.json'));
  }
  for (const link of ['phases', 'cheatsheets']) {
    if (fs.existsSync(path.join(root, link))) fs.symlinkSync(path.join(root, link), path.join(dir, link), 'dir');
  }
  const folder = path.join(dir, 'practice', id);
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(folder, rel)), { recursive: true });
    fs.writeFileSync(path.join(folder, rel), text);
  }
  return { dir, folder };
}

function gateDraft({ files, id, root = ROOT, python = pythonBin() }) {
  const { dir, folder } = stage(files, id, root);
  try {
    const done = spawnSync(python, [path.join(dir, 'scripts', 'practice', 'validate.py'), id, '--write'], { cwd: dir, encoding: 'utf8', timeout: GATE_TIMEOUT_MS, env: { PATH: process.env.PATH || '', HOME: process.env.HOME || '', PYTHONDONTWRITEBYTECODE: '1' } });
    const output = `${done.stdout || ''}${done.stderr || ''}`;
    if (done.error) return { ok: false, problems: [`the validator did not run: ${done.error.message}`], output };
    if (done.status === 0) {
      const passed = {};
      for (const rel of listFiles(folder).filter(file => !/(?:^|\/)__pycache__\//.test(file) && !/\.pyc$/.test(file))) passed[rel] = fs.readFileSync(path.join(folder, rel), 'utf8');
      return { ok: true, problems: [], output, files: passed };
    }
    const problems = validatorProblems(done.stdout || '');
    return { ok: false, problems: problems.length ? problems : [`the validator stopped with an error: ${output.trim().slice(-600)}`], output };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function replyText(message) {
  return message.content.filter(block => block.type === 'text').map(block => block.text).join('\n');
}

function evaluateReply(message, context) {
  if (message.stop_reason === 'refusal') return { problems: ['the model declined the request'], refused: true };
  if (message.stop_reason === 'max_tokens') return { problems: ['the reply reached the token limit before it finished. Write shorter files.'] };
  const reply = parseReply(replyText(message));
  if (reply.error) return { problems: [reply.error] };
  const meta = metaProblems(reply.files, context);
  if (meta.problems.length) return { problems: meta.problems, files: reply.files };
  const gate = context.gate({ files: reply.files, id: meta.id, root: context.root });
  return { problems: gate.problems, files: reply.files, id: meta.id, passed: gate.ok ? gate.files : null };
}

function requestFor(model, system, messages) {
  const request = {
    model,
    max_tokens: MAX_TOKENS,
    output_config: { effort: model === MODELS.haiku ? 'medium' : 'high' },
    system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
    messages,
  };
  if (FALLBACK_MODELS.has(model)) {
    request.betas = ['server-side-fallback-2026-07-01'];
    request.fallbacks = 'default';
  }
  return request;
}

async function callModel(client, { model, system, messages }) {
  return client.beta.messages.stream(requestFor(model, system, messages)).finalMessage();
}

function emptyUsage() {
  return { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, calls: 0, cost: 0 };
}

function callCost(usage, model) {
  const price = PRICES[model];
  if (!price) return 0;
  const input = usage.input_tokens || 0;
  const read = usage.cache_read_input_tokens || 0;
  const write = usage.cache_creation_input_tokens || 0;
  const long = price.longFrom && input + read + write > price.longFrom;
  const inputRate = long ? price.longInput : price.input;
  const outputRate = long ? price.longOutput : price.output;
  return (input * inputRate + (usage.output_tokens || 0) * outputRate + read * price.cacheRead + write * price.cacheWrite) / 1e6;
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

function problemList(problems) {
  return problems.map(problem => `- ${problem}`).join('\n');
}

function writeProblem(root, id, files) {
  const folder = path.join(root, 'practice', id);
  if (fs.existsSync(folder)) throw new Error(`practice/${id} already exists`);
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(folder, rel)), { recursive: true });
    fs.writeFileSync(path.join(folder, rel), text);
  }
}

async function generateProblem({ lesson, id = '', client, model = DEFAULT_MODEL, escalation = ESCALATION_MODEL, root = ROOT, log = () => {}, write = true, budgetLeft = Infinity, gate = gateDraft, taken = new Set(problemIds(root)), system = systemPrompt(root, [...taken]) }) {
  const usage = emptyUsage();
  const bundle = sourceBundle(lesson, root);
  if (bundle.omitted.length) log(`${lesson}: left out ${bundle.omitted.length} source files: ${bundle.omitted.join(', ')}`);
  const steps = [];
  const context = { lesson, id, taken, root, gate };
  const call = async (callModelName, messages, step) => {
    const message = await callModel(client, { model: callModelName, system, messages });
    addCall(usage, message.usage, callModelName);
    steps.push(step);
    return message;
  };
  const finish = (result, extra) => ({ lesson, usage, steps, ...result, ...extra });
  const accept = (evaluation, producer) => {
    if (write) writeProblem(root, evaluation.id, evaluation.passed);
    taken.add(evaluation.id);
    log(`${lesson}: practice/${evaluation.id} passed with ${producer} after ${steps.join(', ')}.`);
    return finish({ ok: true, id: evaluation.id, model: producer, problems: [] });
  };
  const failed = (evaluation, producer) => finish({ ok: false, id: evaluation.id || id || '', model: producer, problems: evaluation.problems });
  const messages = [{ role: 'user', content: userPrompt(lesson, bundle, id) }];
  let message = await call(model, messages, `draft:${model}`);
  let evaluation = evaluateReply(message, context);
  if (evaluation.refused) return failed(evaluation, model);
  if (!evaluation.problems.length) return accept(evaluation, model);
  for (let round = 1; round <= MAX_RETRIES; round++) {
    if (usageTokens(usage) >= budgetLeft) return finish({ ok: false, id: evaluation.id || id || '', model, problems: ['the token budget ran out before the next retry'] });
    log(`${lesson}: round ${round} fixes ${evaluation.problems.length} problems`);
    messages.push({ role: 'assistant', content: message.content });
    messages.push({ role: 'user', content: `The validator found these problems:\n\n${problemList(evaluation.problems)}\n\nCritique your draft. Compare it with the example problem and with the authoring guide. For each problem, name the file, the lines to change and the new text. When a mutant passes every check, add a check that rejects it. Do not remove the mutant. When a typed value does not match the solution, use an input with a value that you can prove, or remove the value. Do not write the files yet.` });
    const critique = await call(model, messages, `critique:${model}`);
    messages.push({ role: 'assistant', content: critique.content });
    messages.push({ role: 'user', content: 'Apply every edit in your critique. Reply with every file of the problem, complete, each in a <file path="..."> part.' });
    message = await call(model, messages, `revise:${model}`);
    evaluation = evaluateReply(message, context);
    if (evaluation.refused) return failed(evaluation, model);
    if (!evaluation.problems.length) return accept(evaluation, model);
  }
  if (escalation && escalation !== model && usageTokens(usage) < budgetLeft) {
    log(`${lesson}: escalated to ${escalation}`);
    const draft = evaluation.files ? `\n\nThe last draft follows.\n\n${draftText(evaluation.files)}` : '';
    const escalated = await call(escalation, [{ role: 'user', content: `${userPrompt(lesson, bundle, id)}\n\nA smaller model wrote a draft that failed these checks:\n\n${problemList(evaluation.problems)}${draft}\n\nWrite every file again so that the validator passes.` }], `escalate:${escalation}`);
    const final = evaluateReply(escalated, context);
    if (!final.problems.length) return accept(final, escalation);
    evaluation = final;
  }
  return failed(evaluation, model);
}

function resolveModel(name) {
  return MODELS[name] || name || DEFAULT_MODEL;
}

function createClient() {
  const sdk = require('@anthropic-ai/sdk');
  const Anthropic = sdk.default || sdk;
  return new Anthropic();
}

async function main(argv, { client, root = ROOT, out = console, gate = gateDraft } = {}) {
  const flag = name => argv.includes(name);
  const value = name => (argv.includes(name) ? argv[argv.indexOf(name) + 1] || '' : '');
  const valueFlags = new Set(['--model', '--escalate', '--limit', '--summary', '--token-budget', '--id']);
  let lessons = Array.from(new Set(argv.filter((arg, index) => !arg.startsWith('--') && !valueFlags.has(argv[index - 1])).map(normalLesson)));
  const id = value('--id');
  if (!lessons.length) {
    out.error('Give one or more lesson paths, for example phases/03-deep-learning-core/05-loss-functions.');
    return 1;
  }
  const bad = lessons.map(lesson => lessonProblem(lesson, root)).filter(Boolean);
  if (bad.length) {
    for (const problem of bad) out.error(problem);
    return 1;
  }
  const taken = new Set(problemIds(root));
  if (id) {
    if (lessons.length !== 1) {
      out.error('--id works with one lesson only.');
      return 1;
    }
    if (!ID_PATTERN.test(id)) {
      out.error('--id must be lower case words joined by hyphens.');
      return 1;
    }
    if (taken.has(id)) {
      out.error(`practice/${id} already exists.`);
      return 1;
    }
  }
  const limitText = value('--limit');
  const limit = limitText === '' ? lessons.length : Number(limitText);
  const notStarted = lessons.slice(limit);
  lessons = lessons.slice(0, limit);
  if (flag('--dry-run')) {
    for (const lesson of lessons) {
      const bundle = sourceBundle(lesson, root);
      out.log(`${lesson}: ${bundle.files.length} files, ${bundle.chars} characters${bundle.omitted.length ? `, ${bundle.omitted.length} left out` : ''}`);
    }
    out.log(`System prompt: ${systemPrompt(root, [...taken]).length} characters.`);
    return 0;
  }
  if (!client && !process.env.ANTHROPIC_API_KEY) {
    out.error('ANTHROPIC_API_KEY is not set.');
    return 2;
  }
  const api = client || createClient();
  const model = resolveModel(value('--model'));
  const escalation = flag('--no-escalate') ? '' : resolveModel(value('--escalate') || 'sonnet');
  const budget = Number(value('--token-budget')) || DEFAULT_TOKEN_BUDGET;
  const system = systemPrompt(root, [...taken]);
  const total = emptyUsage();
  const results = [];
  const skipped = notStarted.slice();
  for (const lesson of lessons) {
    if (usageTokens(total) >= budget) {
      skipped.push(lesson);
      continue;
    }
    try {
      const result = await generateProblem({ lesson, id, client: api, model, escalation, root, log: line => out.log(line), budgetLeft: budget - usageTokens(total), gate, taken, system });
      addUsage(total, result.usage);
      results.push(result);
    } catch (error) {
      results.push({ lesson, id, ok: false, model, steps: [], problems: [String((error && error.message) || error)], usage: emptyUsage() });
      out.error(`${lesson}: ${(error && error.message) || error}`);
    }
  }
  if (skipped.length) out.log(`Not started because of the problem cap or the token budget: ${skipped.join(', ')}`);
  const summary = {
    model,
    escalation,
    budget,
    usage: total,
    tokens: usageTokens(total),
    cost: total.cost,
    written: results.filter(result => result.ok).map(result => result.id),
    escalated: results.filter(result => result.ok && result.model !== model).map(result => result.id),
    failed: results.filter(result => !result.ok).map(({ lesson, id: name, steps, problems }) => ({ lesson, id: name, steps, problems })),
    skipped,
    drafts: results.map(({ lesson, id: name, ok, model: producer, steps, usage }) => ({ lesson, id: name, ok, model: producer, steps, tokens: usageTokens(usage), cost: usage.cost })),
  };
  if (value('--summary')) fs.writeFileSync(value('--summary'), `${JSON.stringify(summary, null, 2)}\n`);
  out.log(`Wrote ${summary.written.length} problems (${summary.escalated.length} escalated). ${summary.failed.length} lessons failed. Tokens: ${summary.tokens}, estimated cost $${summary.cost.toFixed(2)}.`);
  for (const failure of summary.failed) out.error(`${failure.lesson}: ${failure.problems.slice(0, 5).join(' | ')}`);
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

module.exports = { MODELS, DEFAULT_MODEL, ESCALATION_MODEL, MAX_RETRIES, PRICES, DEFAULT_TOKEN_BUDGET, EXEMPLAR, callCost, requestFor, sourceBundle, systemPrompt, userPrompt, parseReply, safePath, draftText, metaProblems, validatorProblems, gateDraft, generateProblem, main };
