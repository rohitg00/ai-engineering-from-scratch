import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
// build.js assigns module.exports at runtime, so Node's CJS-interop can't see
// named exports statically — default-import then destructure.
import bjs from '../site/build.js';
const { extractLessonMetaForLang } = bjs;

// extractLessonMetaForLang resolves docs under REPO_ROOT (the repo root, one
// level above site/). Create a self-contained fixture lesson there so this
// test passes in any checkout — it validates the extraction LOGIC, not the
// presence of any particular translated lesson.
const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..');
const FIXTURE_REL = '.i18n-test-fixture/lesson';
const FIXTURE_DOCS = path.join(REPO_ROOT, FIXTURE_REL, 'docs');

fs.mkdirSync(FIXTURE_DOCS, { recursive: true });
fs.writeFileSync(path.join(FIXTURE_DOCS, 'en.md'),
  '# Matrix Transformations\n\n' +
  '> A matrix is a machine that reshapes space.\n\n' +
  '### Rotation\n### Scaling\n');
// zh.md: first blockquote is a translator note that MUST be skipped; the real
// motto is the second blockquote.
fs.writeFileSync(path.join(FIXTURE_DOCS, 'zh.md'),
  '# 矩阵变换（Matrix Transformations）\n\n' +
  '> 译注：本文译自同目录 en.md。\n\n' +
  '> 矩阵是重塑空间的机器。\n\n' +
  '### 旋转（Rotation）\n### 缩放（Scaling）\n');

try {
  const zh = extractLessonMetaForLang(FIXTURE_REL, 'zh');
  assert.ok(zh.summary && !zh.summary.includes('译注'),
    'zh summary should skip the 译注 note and take the next blockquote; got: ' + zh.summary);
  assert.strictEqual(zh.summary, '矩阵是重塑空间的机器。',
    'zh summary should be the second blockquote; got: ' + zh.summary);
  assert.ok(zh.keywords.includes('旋转'),
    'zh keywords should contain the Chinese H3; got: ' + zh.keywords);

  const en = extractLessonMetaForLang(FIXTURE_REL, 'en');
  assert.ok(en.summary.startsWith('A matrix'),
    'en summary unchanged; got: ' + en.summary);
  assert.ok(en.keywords.includes('Rotation'),
    'en keywords from H3; got: ' + en.keywords);

  // Missing file degrades to empty (planned/untranslated lessons).
  const missing = extractLessonMetaForLang('phases/does-not-exist/lesson', 'zh');
  assert.strictEqual(missing.summary, '', 'missing zh.md → empty summary');
  assert.strictEqual(missing.keywords, '', 'missing zh.md → empty keywords');

  console.log('PASS: extractLessonMetaForLang zh/en (self-contained fixture)');
} finally {
  fs.rmSync(path.join(REPO_ROOT, '.i18n-test-fixture'), { recursive: true, force: true });
}
