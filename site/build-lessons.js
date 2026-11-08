'use strict';

const fs = require('fs');
const path = require('path');
const markdown = require('./lesson-markdown');
const code = require('./lib/code');

const REPO_ROOT = path.join(__dirname, '..');
const OUTPUT_DIR = 'lesson-code';

function subdirs(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => entry.name).sort();
}

function lessonPaths(root = REPO_ROOT) {
  const found = [];
  for (const phase of subdirs(path.join(root, 'phases'))) {
    for (const lesson of subdirs(path.join(root, 'phases', phase))) found.push(`phases/${phase}/${lesson}`);
  }
  for (const program of subdirs(path.join(root, 'certifications'))) {
    for (const lesson of subdirs(path.join(root, 'certifications', program, 'lessons'))) found.push(`certifications/${program}/lessons/${lesson}`);
  }
  return found.filter(lessonPath => fs.existsSync(path.join(root, lessonPath, 'docs', 'en.md')));
}

function lessonBlocks(md) {
  const blocks = {};
  markdown.parseMd(md, {
    renderCode(source, lang) {
      blocks[markdown.codeKey(source, lang)] = code.render(source, lang);
      return '';
    },
  });
  return blocks;
}

function buildLessonCode({ root = REPO_ROOT } = {}) {
  const files = new Map();
  let blocks = 0;
  for (const lessonPath of lessonPaths(root)) {
    const rendered = lessonBlocks(fs.readFileSync(path.join(root, lessonPath, 'docs', 'en.md'), 'utf8'));
    blocks += Object.keys(rendered).length;
    files.set(`${lessonPath}.json`, `${JSON.stringify({ engine: code.engine(), lang: 'en', blocks: rendered })}\n`);
  }
  return { files, blocks };
}

function writeLessonCode({ root = REPO_ROOT, siteDir = __dirname } = {}) {
  const outDir = path.join(siteDir, OUTPUT_DIR);
  if (code.engine() !== 'shiki') {
    if (fs.existsSync(outDir)) fs.rmSync(outDir, { recursive: true, force: true });
    return { files: new Map(), blocks: 0, skipped: true };
  }
  const built = buildLessonCode({ root });
  const targets = new Map(Array.from(built.files, ([file, body]) => [path.join(outDir, file), body]));
  const walk = dir => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        if (!fs.readdirSync(full).length) fs.rmdirSync(full);
      } else if (!targets.has(full)) {
        fs.unlinkSync(full);
      }
    }
  };
  if (fs.existsSync(outDir)) walk(outDir);
  for (const [file, body] of targets) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, body);
  }
  return built;
}

if (require.main === module) {
  code.init().then(() => {
    const started = Date.now();
    const built = writeLessonCode();
    if (built.skipped) console.log('Shiki is not installed; lessons use the browser highlighter.');
    else console.log(`Wrote ${built.blocks} code blocks for ${built.files.size} lessons in ${Date.now() - started} ms.`);
  }).catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = { OUTPUT_DIR, lessonPaths, lessonBlocks, buildLessonCode, writeLessonCode };
