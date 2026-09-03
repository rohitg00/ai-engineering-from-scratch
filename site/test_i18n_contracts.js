#!/usr/bin/env node

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { publishedLanguages } = require('./build.js');

const ROOT = path.resolve(__dirname, '..');

function runBookTransformFixture(canonical, localized) {
  const result = spawnSync(
    'python3',
    [path.join(ROOT, 'scripts', 'build_book.py'), '--test-transform-fixture'],
    {
      cwd: ROOT,
      encoding: 'utf8',
      input: JSON.stringify({ canonical, localized }),
    }
  );

  assert.ifError(result.error);
  assert.equal(
    result.status,
    0,
    `book transform fixture failed:\n${result.stderr || result.stdout}`
  );
  return JSON.parse(result.stdout);
}

test('human-maintained Chinese remains published but is excluded from NLLB', () => {
  const registry = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8')
  );
  const chinese = registry.languages.find(language => language.code === 'zh');
  const automatic = registry.languages
    .filter(language => language.ci === true && language.manual !== true)
    .map(language => language.code);

  assert.equal(chinese.manual, true);
  assert.equal(chinese.ci, undefined);
  assert.ok(publishedLanguages(registry).some(language => language.code === 'zh'));
  assert.ok(!automatic.includes('zh'));
});

test('translation workflow excludes manual locales from automatic and requested jobs', () => {
  const workflow = fs.readFileSync(
    path.join(ROOT, '.github', 'workflows', 'translate.yml'),
    'utf8'
  );

  assert.ok(workflow.includes(
    'select(.source != true and .manual != true) | .code'
  ));
  assert.ok(workflow.includes(
    'select(.ci == true and .manual != true) | .code'
  ));
  assert.ok(workflow.includes('no machine-managed languages selected'));
});

test('GitHub Pages mirror deploys only main with least-privilege jobs', () => {
  const workflow = fs.readFileSync(
    path.join(ROOT, '.github', 'workflows', 'deploy-pages.yml'),
    'utf8'
  );

  assert.match(workflow, /branches: \[main\]/);
  assert.equal((workflow.match(/if: github\.ref == 'refs\/heads\/main'/g) || []).length, 2);
  assert.match(workflow, /build:[\s\S]*?permissions:\n      contents: read/);
  assert.match(workflow, /deploy:[\s\S]*?permissions:\n      pages: write\n      id-token: write/);
  assert.match(workflow, /AIFS_TRANSLATION_REPOSITORY: \${{ vars\.AIFS_TRANSLATION_REPOSITORY \|\| github\.repository }}/);
  assert.match(workflow, /AIFS_TRANSLATION_REF: \${{ vars\.AIFS_TRANSLATION_REF \|\| 'translations' }}/);
  assert.match(workflow, /name: Validate the configured translation branch/);
  assert.match(workflow, /git check-ref-format "refs\/heads\/\$AIFS_TRANSLATION_REF"/);
  assert.match(workflow, /run: node site\/build\.js/);
  assert.match(workflow, /path: site/);
  assert.doesNotMatch(workflow, /^permissions:/m);
});

test('curriculum audit and site share configurable translation source names', () => {
  const workflow = fs.readFileSync(
    path.join(ROOT, '.github', 'workflows', 'curriculum.yml'),
    'utf8'
  );
  const buildSource = fs.readFileSync(path.join(__dirname, 'build.js'), 'utf8');

  assert.match(
    workflow,
    /AIFS_TRANSLATION_REPOSITORY: \${{ vars\.AIFS_TRANSLATION_REPOSITORY \|\| github\.repository }}/
  );
  assert.match(
    workflow,
    /AIFS_TRANSLATION_REF: \${{ vars\.AIFS_TRANSLATION_REF \|\| 'translations' }}/
  );
  assert.ok(buildSource.includes('environment.AIFS_TRANSLATION_REPOSITORY'));
  assert.ok(buildSource.includes('environment.AIFS_TRANSLATION_REF'));
  assert.ok(buildSource.includes('serializeBuildMeta(environment)'));
  assert.ok(buildSource.includes('window.__AIFS_TRANSLATION_REPOSITORY'));
  assert.ok(buildSource.includes('window.__AIFS_TRANSLATION_REF'));
});

test('curriculum audit skips only an unpublished translation branch', () => {
  const workflow = fs.readFileSync(
    path.join(ROOT, '.github', 'workflows', 'curriculum.yml'),
    'utf8'
  );

  const probe = workflow.indexOf(
    'git ls-remote --exit-code "$translation_remote" "$translation_remote_ref"'
  );
  const fetch = workflow.indexOf(
    'git fetch --no-tags "$translation_remote"'
  );
  const audit = workflow.indexOf(
    '--translation-ref "$translation_audit_ref"'
  );

  assert.ok(probe >= 0, 'translation branch must be probed before fetch');
  assert.ok(fetch > probe, 'translation fetch must happen after a successful probe');
  assert.ok(audit > fetch, 'the auditor must read the fetched translation source');
  assert.ok(workflow.includes('[ "$translation_status" -eq 2 ]'));
  assert.ok(workflow.includes('translation branch has not been published yet'));
  assert.ok(workflow.includes('[ "$translation_status" -ne 0 ]'));
  assert.ok(workflow.includes('exit "$translation_status"'));
  assert.ok(!workflow.includes('--translation-ref origin/translations'));
});

test('i18n docs explain shared source configuration and first-publish fallback', () => {
  const documentation = fs.readFileSync(
    path.join(ROOT, 'docs', 'i18n.md'),
    'utf8'
  );

  assert.ok(documentation.includes('AIFS_TRANSLATION_REPOSITORY'));
  assert.ok(documentation.includes('AIFS_TRANSLATION_REF'));
  assert.ok(documentation.includes('GitHub Actions repository variables'));
  assert.ok(documentation.includes('deployment environment variables'));
  assert.match(documentation, /Before a fork publishes its configured translation branch/);
  assert.match(documentation, /falls back to English from the active repository\/ref/);
});

test('translation CLI refuses to overwrite human-maintained locales before loading a model', () => {
  const source = fs.readFileSync(
    path.join(ROOT, 'scripts', 'translate_lessons.py'),
    'utf8'
  );

  const guardDefinition = source.indexOf(
    'if entry.get("manual") and not allow_manual:'
  );
  const guardUse = source.indexOf('args.lang = validate_language(args.lang)');
  const modelUse = source.indexOf('out = translate_doc(src, args.lang, args.provider)');
  assert.ok(guardDefinition >= 0, 'manual-language guard is missing');
  assert.ok(guardUse > guardDefinition, 'CLI must invoke the language guard');
  assert.ok(modelUse > guardUse, 'manual-language guard must run before translation');
});

test('book production transform maps legacy and full-parity sections', () => {
  const cases = [
    {
      name: 'legacy',
      artifact: 'Ship It',
      practice: 'Exercises',
      order: ['artifact', 'practice'],
      expectedKinds: [null, 'artifact', 'practice', null],
    },
    {
      name: 'full parity',
      artifact: 'Shipped Artifact',
      practice: 'Practice Lab',
      order: ['practice', 'artifact'],
      expectedKinds: [null, 'practice', 'artifact', null],
    },
  ];
  for (const headings of cases) {
    const canonicalSections = {
      artifact: [
        `## ${headings.artifact}`,
        'Artifact instructions.',
        '   ```text',
        `## ${headings.practice}`,
        '   ```',
        'Artifact details after the fenced heading.',
      ],
      practice: [
        `## ${headings.practice}`,
        'Practice instructions.',
      ],
    };
    const localizedSections = {
      artifact: [
        '## 交付物',
        '应从书中删除的交付说明。',
        '   ```text',
        '## 不应提前结束跳过',
        '   ```',
        '也应从书中删除的交付详情。',
      ],
      practice: [
        '## 动手练习',
        '应保留的练习说明。',
      ],
    };
    const canonical = [
      '# Lesson',
      '## Introduction',
      '   ```text',
      `## ${headings.artifact}`,
      '   ```',
      ...headings.order.flatMap(kind => canonicalSections[kind]),
      '## Verify It',
      'Verification instructions.',
    ].join('\n');
    const localized = [
      '# 课程',
      '## 简介',
      '   ```text',
      '## 代码块里的伪标题',
      '   ```',
      ...headings.order.flatMap(kind => localizedSections[kind]),
      '## 验证',
      '应保留的验证说明。',
    ].join('\n');

    const result = runBookTransformFixture(canonical, localized);
    const transformed = result.transformed;
    assert.deepEqual(result.canonicalH2Kinds, headings.expectedKinds, headings.name);
    assert.equal(
      transformed.match(/\*\*This chapter ships an artifact\.\*\*/g)?.length,
      1
    );
    assert.equal(
      transformed.match(/Starter code and the lesson's working implementation:/g)?.length,
      1
    );
    assert.ok(transformed.includes('## 代码块里的伪标题'));
    assert.ok(!transformed.includes('应从书中删除的交付说明。'));
    assert.ok(!transformed.includes('也应从书中删除的交付详情。'));
    assert.ok(transformed.includes('应保留的练习说明。'));
    assert.ok(transformed.includes('应保留的验证说明。'));

    const practiceLink = transformed.indexOf(
      "Starter code and the lesson's working implementation:"
    );
    const artifactLink = transformed.indexOf(
      '**This chapter ships an artifact.**'
    );
    const nextH2 = transformed.indexOf('## 验证');
    if (headings.name === 'full parity') {
      assert.ok(practiceLink < artifactLink, 'Practice Lab must precede Shipped Artifact');
    }
    assert.ok(artifactLink < nextH2, 'artifact replacement must stop at the next H2');
  }
});
