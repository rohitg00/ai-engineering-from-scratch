// Builds data.js for the Daily Drill app from this repo's lessons.
// Usage: node apps/daily-drill/build-data.mjs [--standalone] [--pages] [--data-url=URL] [repo-root]
// Reads phases/*/*/docs/en.md, quiz.json and code/, plus learning-paths/*.json.
// --standalone also writes dist/daily-drill.html: one file with the data inlined.
// --pages also writes dist/pages/{index.html,data.js,.nojekyll} for a GitHub Pages branch.
// --data-url=URL also writes dist/gist/{index.html,drill-data.json}, a page that fetches its JSON from URL.
import { readFileSync, readdirSync, existsSync, writeFileSync, statSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ARGS = process.argv.slice(2);
const STANDALONE = ARGS.includes('--standalone');
const REPO = ARGS.find((a) => !a.startsWith('--')) || join(HERE, '..', '..');
const OUT = join(HERE, 'data.js');
const STANDALONE_OUT = join(HERE, 'dist', 'daily-drill.html');
const DATA_URL = (ARGS.find((a) => a.startsWith('--data-url=')) || '').slice('--data-url='.length);
const GIST_DIR = join(HERE, 'dist', 'gist');
const PAGES = ARGS.includes('--pages');
const PAGES_DIR = join(HERE, 'dist', 'pages');
const DATA_TAG = '<script src="data.js"></script>';
const DOC_HEAD = '<!doctype html>\n<html lang="en">\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n';

const WEB = 'https://aiengineeringfromscratch.com/lesson?path=';
const GITHUB = 'https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/';
const MAX_TERMS = 6;
const MAX_READING = 5;
const MAX_BRIEF = 360;

const VOLUMES = [
  { n: 1, file: 'aiefs-vol1-foundations.pdf', title: 'Foundations', phases: [0, 1, 2] },
  { n: 2, file: 'aiefs-vol2-deep-learning.pdf', title: 'Deep Learning', phases: [3, 4, 6] },
  { n: 3, file: 'aiefs-vol3-language.pdf', title: 'Language', phases: [5, 7] },
  { n: 4, file: 'aiefs-vol4-llms.pdf', title: 'Large Language Models', phases: [8, 9, 10, 11] },
  { n: 5, file: 'aiefs-vol5-agents.pdf', title: 'Agents', phases: [12, 13, 14, 15, 16] },
  { n: 6, file: 'aiefs-vol6-production.pdf', title: 'Production', phases: [17, 18, 19] },
];

const RUNNERS = {
  py: (f) => `python3 ${f}`,
  ts: (f) => `npx tsx ${f}`,
  js: (f) => `node ${f}`,
  rs: (f) => `rustc --edition 2021 ${f} -o main && ./main`,
  jl: (f) => `julia ${f}`,
};

const TITLE_FIXES = { ai: 'AI', ml: 'ML', llm: 'LLM', llms: 'LLMs', nlp: 'NLP', gpu: 'GPU', and: '&', to: 'to' };

function slugTitle(slug) {
  return slug
    .replace(/^\d+-/, '')
    .split('-')
    .map((w) => TITLE_FIXES[w] || w[0].toUpperCase() + w.slice(1))
    .join(' ');
}

function plain(s) {
  return s
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/(^|\W)\*([^*]+)\*(?=\W|$)/g, '$1$2')
    .replace(/\$([^$]+)\$/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function section(md, heading) {
  const re = new RegExp(`^## ${heading}\\s*$([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, 'm');
  const m = md.match(re);
  return m ? m[1] : '';
}

function bullets(text) {
  return text
    .split('\n')
    .filter((l) => /^\s*(?:[-*]|\d+\.)\s+/.test(l))
    .map((l) => l.replace(/^\s*(?:[-*]|\d+\.)\s+/, ''));
}

function field(md, name) {
  const m = md.match(new RegExp(`^\\*\\*${name}:\\*\\*\\s*(.+)$`, 'm'));
  return m ? plain(m[1]) : '';
}

function splitRow(line) {
  const cells = [];
  let cell = '';
  let inCode = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '\\' && line[i + 1] === '|') { cell += '|'; i++; continue; }
    if (ch === '`') inCode = !inCode;
    if (ch === '|' && !inCode) { cells.push(cell); cell = ''; continue; }
    cell += ch;
  }
  cells.push(cell);
  return cells.slice(1, -1).map((c) => plain(c));
}

function parseTerms(md) {
  const rows = section(md, 'Key Terms')
    .split('\n')
    .filter((l) => l.trim().startsWith('|') && !/^\s*\|\s*:?-/.test(l))
    .map((l) => splitRow(l.trim()));
  if (rows.length < 2) return [];
  const width = rows[0].length;
  return rows
    .slice(1)
    .filter((cells) => cells.length === width && width >= 2 && cells[0])
    .map((cells) => ({ term: cells[0], says: width > 2 ? cells[1].replace(/^"|"$/g, '') : '', means: cells[width - 1] }))
    .slice(0, MAX_TERMS);
}

function parseReading(md) {
  return bullets(section(md, 'Further Reading'))
    .map((raw) => {
      const link = raw.match(/\[([^\]]+)\]\((https?:[^)\s]+)\)/);
      const bare = raw.match(/\(?(https?:\/\/[^\s)]+)\)?/);
      const url = link ? link[2] : bare ? bare[1] : '';
      const text = raw.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\(?https?:\/\/[^\s)]+\)?/, '');
      const [what, why = ''] = plain(text).split(/\s+(?:--|—|–)\s+/);
      return { what: what.replace(/[\s,:]+$/, ''), why, url };
    })
    .filter((r) => r.what)
    .slice(0, MAX_READING);
}

function validQuiz(q) {
  return (
    q && typeof q.question === 'string' && Array.isArray(q.options) && q.options.length >= 2 &&
    Number.isInteger(q.correct) && q.correct >= 0 && q.correct < q.options.length
  );
}

function readQuiz(dir) {
  const file = join(dir, 'quiz.json');
  if (!existsSync(file)) return [];
  try {
    const raw = JSON.parse(readFileSync(file, 'utf8'));
    const qs = Array.isArray(raw) ? raw : raw.questions || [];
    return qs.filter(validQuiz).map((q) => ({
      s: q.stage || 'check',
      q: plain(q.question),
      o: q.options.map((o) => plain(String(o))),
      c: q.correct,
      e: plain(q.explanation || ''),
    }));
  } catch (err) {
    console.warn(`skip quiz ${file}: ${err.message}`);
    return [];
  }
}

function problemBrief(md) {
  const para = section(md, 'The Problem')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .find((p) => p && !/^(```|[-*|>#!]|\d+\.)/.test(p));
  if (!para) return '';
  const text = plain(para);
  if (text.length <= MAX_BRIEF) return text;
  const cut = text.slice(0, MAX_BRIEF);
  const end = cut.lastIndexOf('. ');
  return end > MAX_BRIEF / 2 ? cut.slice(0, end + 1) : `${cut.replace(/\s+\S*$/, '')}…`;
}

function runCommand(dir, path) {
  const codeDir = join(dir, 'code');
  if (!existsSync(codeDir)) return '';
  const main = readdirSync(codeDir).find((f) => /^main\.(py|ts|js|rs|jl)$/.test(f));
  if (!main) return '';
  return `cd ${path}/code && ${RUNNERS[main.split('.').pop()](main)}`;
}

function readLesson(phaseDir, lessonSlug, phaseNum, phaseSlug) {
  const dir = join(phaseDir, lessonSlug);
  const docFile = join(dir, 'docs', 'en.md');
  if (!existsSync(docFile)) return null;
  const md = readFileSync(docFile, 'utf8');
  const path = `phases/${phaseSlug}/${lessonSlug}`;
  const minutes = parseInt((field(md, 'Time').match(/\d+/) || ['0'])[0], 10);
  const exercises = bullets(section(md, 'Exercises')).map(plain);
  return {
    id: path,
    p: phaseNum,
    n: parseInt(lessonSlug, 10),
    t: plain((md.match(/^# (.+)$/m) || [, slugTitle(lessonSlug)])[1]),
    h: plain((md.match(/^> (.+)$/m) || [, ''])[1]),
    ty: field(md, 'Type'),
    lang: field(md, 'Languages'),
    pre: field(md, 'Prerequisites'),
    min: minutes,
    why: problemBrief(md),
    obj: bullets(section(md, 'Learning Objectives')).map(plain),
    terms: parseTerms(md),
    read: parseReading(md),
    ex: exercises[0] || '',
    run: runCommand(dir, path),
    quiz: readQuiz(dir),
  };
}

function readPaths(repo, known) {
  const dir = join(repo, 'learning-paths');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      try {
        const j = JSON.parse(readFileSync(join(dir, f), 'utf8'));
        const lessons = (j.lessons || [])
          .slice()
          .sort((a, b) => (a.order || 0) - (b.order || 0))
          .map((l) => l.path)
          .filter((p) => known.has(p));
        return lessons.length ? { id: j.id || f.replace('.json', ''), t: j.title || slugTitle(f), sum: j.summary || '', lessons } : null;
      } catch (err) {
        console.warn(`skip path ${f}: ${err.message}`);
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => a.t.localeCompare(b.t));
}

function main() {
  const phasesDir = join(REPO, 'phases');
  if (!existsSync(phasesDir)) {
    console.error(`No phases/ directory in ${REPO}. Pass the repo path as the first argument.`);
    process.exit(1);
  }
  const phases = [];
  const lessons = [];
  for (const phaseSlug of readdirSync(phasesDir).sort()) {
    const phaseDir = join(phasesDir, phaseSlug);
    if (!statSync(phaseDir).isDirectory() || !/^\d+-/.test(phaseSlug)) continue;
    const num = parseInt(phaseSlug, 10);
    const vol = VOLUMES.find((v) => v.phases.includes(num));
    phases.push({ p: num, t: slugTitle(phaseSlug), vol: vol ? vol.n : 0 });
    for (const lessonSlug of readdirSync(phaseDir).sort()) {
      if (!/^\d+-/.test(lessonSlug)) continue;
      const lesson = readLesson(phaseDir, lessonSlug, num, phaseSlug);
      if (lesson) lessons.push(lesson);
    }
  }
  const paths = readPaths(REPO, new Set(lessons.map((l) => l.id)));
  const data = {
    built: new Date().toISOString().slice(0, 10),
    links: { web: WEB, github: GITHUB },
    volumes: VOLUMES.map(({ n, file, title }) => ({ n, file, t: title })),
    phases,
    paths,
    lessons,
  };
  const script = `window.DRILL_DATA = ${JSON.stringify(data).replace(/</g, '\\u003c')};\n`;
  writeFileSync(OUT, script);
  const quizzes = lessons.filter((l) => l.quiz.length).length;
  console.log(`${lessons.length} lessons, ${quizzes} with quizzes, ${phases.length} phases, ${paths.length} paths -> ${OUT}`);
  if (STANDALONE) writeStandalone(script);
  if (DATA_URL) writeGist(data);
  if (PAGES) writePages(script);
}

function writePages(script) {
  mkdirSync(PAGES_DIR, { recursive: true });
  writeFileSync(join(PAGES_DIR, 'index.html'), DOC_HEAD + readPage());
  writeFileSync(join(PAGES_DIR, 'data.js'), script);
  writeFileSync(join(PAGES_DIR, '.nojekyll'), '');
  console.log(`pages site -> ${PAGES_DIR}`);
}

function readPage() {
  const page = readFileSync(join(HERE, 'index.html'), 'utf8');
  if (!page.includes(DATA_TAG)) throw new Error(`index.html no longer contains ${DATA_TAG}`);
  return page;
}

function writeStandalone(script) {
  mkdirSync(dirname(STANDALONE_OUT), { recursive: true });
  writeFileSync(STANDALONE_OUT, DOC_HEAD + readPage().replace(DATA_TAG, () => `<script>${script}</script>`));
  console.log(`standalone -> ${STANDALONE_OUT}`);
}

function writeGist(data) {
  if (!/^https:\/\//.test(DATA_URL)) throw new Error('--data-url must be an https:// URL');
  const meta = `<meta name="drill-data" content="${DATA_URL.replace(/"/g, '&quot;')}">`;
  mkdirSync(GIST_DIR, { recursive: true });
  writeFileSync(join(GIST_DIR, 'index.html'), DOC_HEAD + readPage().replace(DATA_TAG, () => meta));
  writeFileSync(join(GIST_DIR, 'drill-data.json'), JSON.stringify(data));
  console.log(`gist page + data -> ${GIST_DIR}`);
}

main();
