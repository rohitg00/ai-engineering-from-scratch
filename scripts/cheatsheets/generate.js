'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const sheets = require('../../site/build-cheatsheets');
const topicMap = require('../../site/cheatsheet-topics');
const evidenceCheck = require('../../site/cheatsheet-evidence');

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
const BUNDLE_SKIP = /(?:^|\/)(?:tests?|__tests__|fixtures?|samples?)\/|(?:^|\/)test_[^/]*$|\.(?:test|spec)\.[jt]sx?$|\.(?:jsonl|csv|log)$|(?:^|\/)package\.json$/;
const EXEMPLARS = { concept: 'agent-harness', commands: 'rag', comparison: 'serving-engines-compared' };
const EVIDENCE_EXEMPLAR = 'rag';
const FRONT_KEYS = ['id', 'title', 'code', 'subtitle', 'hue', 'sources', 'source_hash'];
const KEEP_LINE = /`|\d|\b(?:default|error|fails?|failure|fix|use|when|must|never|always|returns?|raises?|flag|option|limit|timeout|retry|cost|latency)\b/i;

function readText(root, rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function filePriority(file) {
  if (/\/docs\/en\.md$/.test(file) || /\/README\.md$/.test(file)) return 0;
  if (/\/sections\//.test(file) || /\/API\.md$/.test(file)) return 1;
  if (/\.md$/.test(file)) return 2;
  if (/\/(?:code|solution)\//.test(file)) return 3;
  return 4;
}

function trimMarkdown(text) {
  const out = [];
  let fence = false;
  for (const line of text.replace(/\r\n/g, '\n').split('\n')) {
    if (/^\s*(?:```|~~~)/.test(line)) {
      fence = !fence;
      out.push(line);
      continue;
    }
    if (fence || /^#{1,6}\s/.test(line) || /^\s*\|/.test(line) || /^\s*(?:[-*+]|\d+\.)\s/.test(line) || /^>\s/.test(line)) {
      out.push(line);
      continue;
    }
    if (!line.trim()) {
      if (out.length && out[out.length - 1] !== '') out.push('');
      continue;
    }
    const kept = line.split(/(?<=[.!?])\s+/).filter(sentence => KEEP_LINE.test(sentence));
    if (kept.length) out.push(kept.join(' '));
  }
  return out.join('\n');
}

function sourceText(root, file) {
  const text = readText(root, file);
  return /\.md$/.test(file) ? trimMarkdown(text) : text;
}

function sourceBundle(entry, root = ROOT) {
  const files = entry.sources.flatMap(source => topicMap.sourceFiles(source, root)).filter(file => !BUNDLE_SKIP.test(file));
  const ranked = files.map((file, index) => ({ file, index, text: sourceText(root, file) })).sort((a, b) => filePriority(a.file) - filePriority(b.file) || a.index - b.index);
  const kept = [];
  const omitted = [];
  let total = 0;
  for (const item of ranked) {
    if (item.text.length > MAX_FILE_CHARS || total + item.text.length > MAX_BUNDLE_CHARS) {
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

function rubricText() {
  const lines = Object.entries(sheets.QUALITY_RULES).map(([kind, rule]) => `- \`${kind}\`: at least ${rule.doRows} task or command rows and ${rule.troubleRows} troubleshooting rows${rule.code ? ', and an annotated-code block' : ''}${rule.compare ? ', and a comparison table' : ''}.`);
  return `## The quality rubric

The build scores every poster with these rules. A poster must pass all of them.

- 10 to 14 blocks, with at least 6 block types.
- A flow or architecture diagram.
- A qa or tips block.
- Every defaults row has a real value. "Not given" and similar text are not values.
- No thin block: a table or list has at least 2 rows. A code block, a diagram or a flow has at least 3 lines, nodes or steps.
- No row or bullet appears two times.
- Learner content only. No capture kit, \`run.py\`, fixture build, build script, audit script, \`manual.json\`, CI workflow or capture environment variable.
- Every table row is complete. No cell is empty, "-", "TBD" or "...".
- A diagram has no edge that crosses a node, and no edge label that overlaps a node or another label.
- The poster fits on 2 printed pages.
- Per kind:
${lines.join('\n')}`;
}

function systemPrompt(root = ROOT) {
  const parts = [
    readText(root, 'scripts/cheatsheets/prompt.md'),
    rubricText(),
    `## The authoring guide (cheatsheets/AUTHORING.md)\n\n${readText(root, 'cheatsheets/AUTHORING.md')}`,
  ];
  for (const [kind, id] of Object.entries(EXEMPLARS)) {
    const file = `cheatsheets/${id}.md`;
    if (fs.existsSync(path.join(root, file))) parts.push(`## Example poster for the kind \`${kind}\` (${file})\n\n${readText(root, file)}`);
  }
  const evidence = `cheatsheets/evidence/${EVIDENCE_EXEMPLAR}.md`;
  if (fs.existsSync(path.join(root, evidence))) parts.push(`## Example evidence file (${evidence})\n\n${readText(root, evidence)}`);
  return parts.join('\n\n');
}

function userPrompt(entry, bundle) {
  const omitted = bundle.omitted.length ? `\nThese source files were too large to include. Do not cite facts from them: ${bundle.omitted.join(', ')}\n` : '';
  return `Write the poster and the evidence file for this topic. Match the example poster for its kind.

id: ${entry.id}
title: ${entry.title}
kind: ${entry.kind}
sources: ${entry.sources.join(', ')}
${omitted}
The source files follow. Long prose paragraphs are trimmed to the sentences that hold code, numbers, defaults, errors and rules.

${bundle.text}`;
}

function parseReply(text) {
  const topic = /<topic>\s*([\s\S]*?)\s*<\/topic>/.exec(text);
  const evidence = /<evidence>\s*([\s\S]*?)\s*<\/evidence>/.exec(text);
  if (!topic || !evidence) return { error: 'The reply must hold one <topic> part and one <evidence> part.' };
  return { topic: topic[1].replace(/^```[a-z]*\n/, '').replace(/\n```$/, ''), evidence: evidence[1] };
}

function splitFrontMatter(text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  if (lines[0] !== '---') return null;
  const end = lines.indexOf('---', 1);
  if (end < 0) return null;
  const meta = {};
  for (const line of lines.slice(1, end)) {
    const match = /^([a-z_]+):\s*(.*)$/.exec(line);
    if (match) meta[match[1]] = match[2].trim();
  }
  return { meta, body: lines.slice(end + 1).join('\n') };
}

function codeCandidates(title) {
  const words = title.replace(/[^A-Za-z0-9 ]+/g, ' ').split(/\s+/).filter(word => word && !/^(?:and|with|the|of|for|to|a|an|in|on|from|against)$/i.test(word)).map(word => word.toUpperCase());
  const out = [];
  for (let i = 0; i < words.length; i++) {
    for (let j = i + 1; j < words.length; j++) out.push(words[i][0] + words[j][0]);
    for (let k = 1; k < words[i].length; k++) out.push(words[i][0] + words[i][k]);
  }
  for (const a of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') for (const b of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789') out.push(a + b);
  return out.filter(code => /^[A-Z][A-Z0-9]$/.test(code));
}

function pickCode(entry, current, taken) {
  if (current && /^[A-Z][A-Z0-9]$/.test(current) && !taken.has(current)) return current;
  return codeCandidates(entry.title).find(code => !taken.has(code));
}

function takenCodes(root, exceptId) {
  const taken = new Set();
  for (const topic of sheets.loadTopics(root)) if (topic.id !== exceptId) taken.add(topic.code);
  return taken;
}

function normalizeTopic(text, entry, root = ROOT, taken = takenCodes(root, entry.id)) {
  const split = splitFrontMatter(text);
  if (!split) return { error: 'The poster must start with a front matter block between two "---" lines.' };
  const meta = {
    id: entry.id,
    title: entry.title,
    code: pickCode(entry, split.meta.code, taken),
    subtitle: split.meta.subtitle || '',
    hue: split.meta.hue || '222',
    sources: entry.sources.join(', '),
    source_hash: topicMap.sourceHash(entry.sources, root),
  };
  const head = FRONT_KEYS.map(key => `${key}: ${meta[key]}`).join('\n');
  return { text: `---\n${head}\n---\n${split.body.replace(/^\n*/, '\n').replace(/\s*$/, '\n')}` };
}

function parsedTopic(text, entry) {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'cheatsheet-')), `${entry.id}.md`);
  fs.writeFileSync(file, text);
  const topic = sheets.parseTopic(text, file);
  topic.file = `cheatsheets/${entry.id}.md`;
  topic.kind = entry.kind;
  return topic;
}

function checkText(text, entry, root = ROOT) {
  const topic = parsedTopic(text, entry);
  const problems = sheets.checkTopic(topic, root).map(problem => problem.replace(`${topic.file}: `, ''));
  return problems;
}

function qualityOf(text, entry) {
  const topic = parsedTopic(text, entry);
  if (topic.errors.length) return { score: 0, pass: false, failures: [] };
  return sheets.qualityReport(topic);
}

function scopeProblems(topic, entry) {
  const problems = [];
  for (const block of topic.blocks) {
    for (const source of block.from) {
      const plainPath = path.posix.normalize(source) === source && !source.split('/').includes('..');
      if (!plainPath || !entry.sources.some(allowed => source === allowed || source.startsWith(`${allowed}/`))) problems.push(`block "${block.title}" names ${source}, which is not a source of this topic`);
    }
  }
  return problems;
}

function evidenceProblems(evidence, topicText, entry, root = ROOT) {
  const topic = sheets.parseTopic(topicText, `${entry.id}.md`);
  return evidenceCheck.evidenceProblems(evidence, entry, topic.blocks, root);
}

function evaluateReply(message, entry, root) {
  if (message.stop_reason === 'refusal') return { problems: ['the model declined the request'], refused: true };
  if (message.stop_reason === 'max_tokens') return { problems: ['the reply reached the token limit before it finished. Write shorter files.'] };
  const reply = parseReply(replyText(message));
  if (reply.error) return { problems: [reply.error] };
  const normal = normalizeTopic(reply.topic, entry, root);
  if (normal.error) return { problems: [normal.error] };
  const problems = checkText(normal.text, entry, root).concat(evidenceProblems(reply.evidence, normal.text, entry, root));
  const quality = problems.some(problem => /unknown type|needs|no blocks|front matter/.test(problem)) ? { score: 0, pass: false, failures: [] } : qualityOf(normal.text, entry);
  return { problems: problems.concat(quality.failures.map(failure => `rubric ${failure}`)), quality, text: normal.text, evidence: reply.evidence };
}

function replyText(message) {
  return message.content.filter(block => block.type === 'text').map(block => block.text).join('\n');
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

async function generateTopic({ entry, client, model = DEFAULT_MODEL, escalation = ESCALATION_MODEL, root = ROOT, log = () => {}, write = true, budgetLeft = Infinity }) {
  const usage = emptyUsage();
  const bundle = sourceBundle(entry, root);
  if (bundle.omitted.length) log(`${entry.id}: left out ${bundle.omitted.length} large source files: ${bundle.omitted.join(', ')}`);
  const system = systemPrompt(root);
  const steps = [];
  const call = async (callModelName, messages, step) => {
    const message = await callModel(client, { model: callModelName, system, messages });
    addCall(usage, message.usage, callModelName);
    steps.push(step);
    return message;
  };
  const finish = (result, extra) => ({ id: entry.id, usage, steps, ...result, ...extra });
  const accept = (evaluation, producer) => {
    if (write) {
      fs.writeFileSync(path.join(root, 'cheatsheets', `${entry.id}.md`), evaluation.text);
      fs.mkdirSync(path.join(root, 'cheatsheets', 'evidence'), { recursive: true });
      fs.writeFileSync(path.join(root, 'cheatsheets', 'evidence', `${entry.id}.md`), `${evaluation.evidence.replace(/\s*$/, '')}\n`);
    }
    log(`${entry.id}: passed with ${producer} after ${steps.join(', ')}. Rubric score ${evaluation.quality.score}.`);
    return finish({ ok: true, model: producer, score: evaluation.quality.score, problems: [] });
  };
  const messages = [{ role: 'user', content: userPrompt(entry, bundle) }];
  let message = await call(model, messages, `draft:${model}`);
  let evaluation = evaluateReply(message, entry, root);
  if (evaluation.refused) return finish({ ok: false, model, score: 0, problems: evaluation.problems });
  if (!evaluation.problems.length) return accept(evaluation, model);
  for (let round = 1; round <= MAX_RETRIES; round++) {
    if (usageTokens(usage) >= budgetLeft) return finish({ ok: false, model, score: evaluation.quality ? evaluation.quality.score : 0, problems: ['the token budget ran out before the next retry'] });
    log(`${entry.id}: round ${round} fixes ${evaluation.problems.length} problems`);
    messages.push({ role: 'assistant', content: message.content });
    messages.push({ role: 'user', content: `The checks found these problems:\n\n${problemList(evaluation.problems)}\n\nCritique your draft. Compare it with the example poster for the kind "${entry.kind}" and with the rubric. List the specific edits that fix each problem: which block, which row, what to remove and what to write. Remove a fact that is not in the from files. Do not write the files yet.` });
    const critique = await call(model, messages, `critique:${model}`);
    messages.push({ role: 'assistant', content: critique.content });
    messages.push({ role: 'user', content: 'Apply every edit in your critique. Reply with both complete files in the <topic> and <evidence> parts.' });
    message = await call(model, messages, `revise:${model}`);
    evaluation = evaluateReply(message, entry, root);
    if (evaluation.refused) return finish({ ok: false, model, score: 0, problems: evaluation.problems });
    if (!evaluation.problems.length) return accept(evaluation, model);
  }
  if (escalation && escalation !== model && usageTokens(usage) < budgetLeft) {
    log(`${entry.id}: escalated to ${escalation}`);
    const draft = evaluation.text ? `\n\nThe last draft follows.\n\n<topic>\n${evaluation.text}\n</topic>\n<evidence>\n${evaluation.evidence || ''}\n</evidence>` : '';
    const escalated = await call(escalation, [{ role: 'user', content: `${userPrompt(entry, bundle)}\n\nA smaller model wrote a draft that failed these checks:\n\n${problemList(evaluation.problems)}${draft}\n\nWrite both files again so that every check passes.` }], `escalate:${escalation}`);
    const final = evaluateReply(escalated, entry, root);
    if (!final.problems.length) return accept(final, escalation);
    evaluation = final;
  }
  return finish({ ok: false, model, score: evaluation.quality ? evaluation.quality.score : 0, problems: evaluation.problems });
}

function stampTopic(entry, root = ROOT) {
  const file = path.join(root, 'cheatsheets', `${entry.id}.md`);
  const normal = normalizeTopic(fs.readFileSync(file, 'utf8'), entry, root);
  if (normal.error) throw new Error(`${entry.id}: ${normal.error}`);
  const scope = scopeProblems(sheets.parseTopic(normal.text, file), entry);
  if (scope.length) throw new Error(`${entry.id}: ${scope.join('. ')}. Change the from lines first.`);
  fs.writeFileSync(file, normal.text);
}

function resolveModel(name) {
  return MODELS[name] || name || DEFAULT_MODEL;
}

function createClient() {
  const sdk = require('@anthropic-ai/sdk');
  const Anthropic = sdk.default || sdk;
  return new Anthropic();
}

function status(root = ROOT) {
  return topicMap.mapStatus(topicMap.loadTopicMap(root), sheets.loadTopics(root), root);
}

async function main(argv, { client, root = ROOT, out = console } = {}) {
  const flag = name => argv.includes(name);
  const value = name => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : '');
  const map = topicMap.loadTopicMap(root);
  if (map.errors.length) {
    for (const error of map.errors) out.error(error);
    return 1;
  }
  const byId = new Map(map.topics.map(entry => [entry.id, entry]));
  const current = status(root);
  if (flag('--status')) {
    out.log(JSON.stringify(current, null, 2));
    return 0;
  }
  const valueFlags = new Set(['--model', '--escalate', '--limit', '--summary', '--token-budget']);
  const named = argv.filter((arg, index) => !arg.startsWith('--') && !valueFlags.has(argv[index - 1]));
  let ids = named.length ? named : [];
  if (flag('--missing')) ids = ids.concat(current.missing);
  if (flag('--stale')) ids = ids.concat(current.stale);
  ids = Array.from(new Set(ids));
  const unknown = ids.filter(id => !byId.has(id));
  if (unknown.length) {
    out.error(`Unknown topics: ${unknown.join(', ')}`);
    return 1;
  }
  const limit = Number(value('--limit')) || ids.length;
  const notStarted = ids.slice(limit);
  ids = ids.slice(0, limit);
  if (flag('--stamp')) {
    for (const id of ids) stampTopic(byId.get(id), root);
    out.log(`Stamped ${ids.length} sheets.`);
    return 0;
  }
  if (!ids.length) {
    out.log('No topic to write.');
    return 0;
  }
  if (flag('--dry-run')) {
    for (const id of ids) {
      const bundle = sourceBundle(byId.get(id), root);
      out.log(`${id}: ${bundle.files.length} files, ${bundle.chars} characters${bundle.omitted.length ? `, ${bundle.omitted.length} left out` : ''}`);
    }
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
  const total = emptyUsage();
  const results = [];
  const skipped = notStarted.slice();
  for (const id of ids) {
    if (usageTokens(total) >= budget) {
      skipped.push(id);
      continue;
    }
    try {
      const result = await generateTopic({ entry: byId.get(id), client: api, model, escalation, root, log: line => out.log(line), budgetLeft: budget - usageTokens(total) });
      addUsage(total, result.usage);
      results.push(result);
    } catch (error) {
      results.push({ id, ok: false, model, score: 0, steps: [], problems: [String(error && error.message || error)], usage: emptyUsage() });
      out.error(`${id}: ${error && error.message || error}`);
    }
  }
  if (skipped.length) out.log(`Not started because of the topic cap or the token budget: ${skipped.join(', ')}`);
  const summary = {
    model,
    escalation,
    budget,
    usage: total,
    tokens: usageTokens(total),
    cost: total.cost,
    written: results.filter(result => result.ok).map(result => result.id),
    escalated: results.filter(result => result.ok && result.model !== model).map(result => result.id),
    failed: results.filter(result => !result.ok).map(({ id, steps, problems }) => ({ id, steps, problems })),
    skipped,
    topics: results.map(({ id, ok, model: producer, score, steps, usage }) => ({ id, ok, model: producer, score, steps, tokens: usageTokens(usage), cost: usage.cost })),
  };
  if (value('--summary')) fs.writeFileSync(value('--summary'), `${JSON.stringify(summary, null, 2)}\n`);
  out.log(`Wrote ${summary.written.length} sheets (${summary.escalated.length} escalated). ${summary.failed.length} topics failed. Tokens: ${summary.tokens}, estimated cost $${summary.cost.toFixed(2)}.`);
  for (const failure of summary.failed) out.error(`${failure.id}: ${failure.problems.slice(0, 5).join(' | ')}`);
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

module.exports = { MODELS, DEFAULT_MODEL, ESCALATION_MODEL, MAX_RETRIES, PRICES, DEFAULT_TOKEN_BUDGET, EXEMPLARS, callCost, requestFor, trimMarkdown, sourceBundle, systemPrompt, userPrompt, parseReply, normalizeTopic, checkText, qualityOf, evidenceProblems, scopeProblems, generateTopic, stampTopic, codeCandidates, main };
