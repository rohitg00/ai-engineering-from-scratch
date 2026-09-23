const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SITE = __dirname;
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(SITE, 'ui-strings.js'), 'utf8'), sandbox);
const STRINGS = sandbox.window.AIFS_UI_STRINGS;
const i18n = require('./ui-i18n.js');
const registry = JSON.parse(fs.readFileSync(path.join(SITE, '..', 'languages.json'), 'utf8')).languages;
const CI_LANGS = registry.filter((lang) => lang.ci && !lang.source).map((lang) => lang.code);
const LANGS = Object.keys(STRINGS);
const KEYS = Object.keys(STRINGS[LANGS[0]]);

function decodeEntities(text) {
  return text
    .replace(/&larr;/g, '←')
    .replace(/&rarr;/g, '→')
    .replace(/&middot;/g, '·')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/\\'/g, "'");
}

function siteSource() {
  const skip = /^(ui-strings\.js|ui-i18n\.js|test_.*\.js|data\.js|langs\.js|certification-data\.js|figure.*\.js|figures-.*\.js|lesson-figures\.js|build\.js)$/;
  const files = fs.readdirSync(SITE).filter((name) => /\.(html|js)$/.test(name) && !skip.test(name));
  return files.map((name) => decodeEntities(fs.readFileSync(path.join(SITE, name), 'utf8'))).join('\n');
}

test('every CI language has a chrome dictionary', () => {
  for (const code of CI_LANGS) {
    assert.ok(STRINGS[code], `missing ui-strings.js dictionary for ${code}`);
  }
});

test('every dictionary covers the same keys with non-empty strings', () => {
  for (const code of LANGS) {
    const keys = Object.keys(STRINGS[code]);
    assert.deepEqual(keys, KEYS, `${code} key set differs from ${LANGS[0]}`);
    for (const key of keys) {
      const value = STRINGS[code][key];
      assert.equal(typeof value, 'string', `${code}: ${key} is not a string`);
      assert.ok(value.trim().length > 0, `${code}: ${key} is empty`);
      assert.equal(value, value.trim(), `${code}: ${key} has surrounding whitespace`);
    }
  }
});

test('every key still appears in the site pages or scripts', () => {
  const source = siteSource().replace(/\s+/g, ' ');
  for (const key of KEYS) {
    assert.ok(source.includes(key), `orphaned ui-strings.js key: ${JSON.stringify(key)}`);
  }
});

test('translateText swaps only the trimmed core and keeps surrounding whitespace', () => {
  const dict = { Contents: '目录', 'On this page': '本页内容' };
  assert.equal(i18n.translateText('\n  Contents\n', dict), '\n  目录\n');
  assert.equal(i18n.translateText('On  this\n page', dict), '本页内容');
  assert.equal(i18n.translateText('Unknown label', dict), 'Unknown label');
  assert.equal(i18n.translateText('   ', dict), '   ');
  assert.equal(i18n.translateText('Contents', null), 'Contents');
});

test('dictionaryFor returns null for English and unknown languages', () => {
  global.AIFS_UI_STRINGS = STRINGS;
  try {
    assert.equal(i18n.dictionaryFor('en'), null);
    assert.equal(i18n.dictionaryFor('xx'), null);
    assert.equal(i18n.dictionaryFor(''), null);
    assert.equal(i18n.dictionaryFor('zh'), STRINGS.zh);
  } finally {
    delete global.AIFS_UI_STRINGS;
  }
});
