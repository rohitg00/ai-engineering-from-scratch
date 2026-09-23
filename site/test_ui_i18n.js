const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SITE = __dirname;
const SOURCE = JSON.parse(fs.readFileSync(path.join(SITE, 'ui-strings.json'), 'utf8'));
const KEYS = SOURCE.keys;
const OVERRIDES = SOURCE.overrides || {};
const i18n = require('./ui-i18n.js');
const registry = JSON.parse(fs.readFileSync(path.join(SITE, '..', 'languages.json'), 'utf8')).languages;
const CI_LANGS = registry.filter((lang) => lang.ci && !lang.source).map((lang) => lang.code);

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
  const skip = /^(ui-i18n\.js|test_.*\.js|data\.js|langs\.js|certification-data\.js|figure.*\.js|figures-.*\.js|lesson-figures\.js|build\.js)$/;
  const files = fs.readdirSync(SITE).filter((name) => /\.(html|js)$/.test(name) && !skip.test(name));
  return files.map((name) => decodeEntities(fs.readFileSync(path.join(SITE, name), 'utf8'))).join('\n');
}

test('the key list is a trimmed, unique list of English strings', () => {
  assert.ok(Array.isArray(KEYS) && KEYS.length > 0);
  assert.equal(new Set(KEYS).size, KEYS.length, 'duplicate keys');
  for (const key of KEYS) {
    assert.equal(typeof key, 'string');
    assert.ok(key.trim().length > 0, 'empty key');
    assert.equal(key, key.trim(), `key has surrounding whitespace: ${JSON.stringify(key)}`);
  }
});

test('overrides only pin keys from the list and only for registered languages', () => {
  const codes = new Set(registry.map((lang) => lang.code));
  for (const [code, table] of Object.entries(OVERRIDES)) {
    assert.ok(codes.has(code), `override language ${code} is not in languages.json`);
    for (const [key, value] of Object.entries(table)) {
      assert.ok(KEYS.includes(key), `${code} pins a key that is not in the list: ${JSON.stringify(key)}`);
      assert.equal(typeof value, 'string');
      assert.ok(value.trim().length > 0, `${code}: ${key} is empty`);
      assert.equal(value, value.trim(), `${code}: ${key} has surrounding whitespace`);
    }
  }
  assert.ok(CI_LANGS.length > 0);
});

test('every key still appears in the site pages or scripts', () => {
  const source = siteSource().replace(/\s+/g, ' ');
  for (const key of KEYS) {
    assert.ok(source.includes(key), `orphaned ui-strings.json key: ${JSON.stringify(key)}`);
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

test('dictionaries come from the translations branch, English and unknown languages resolve to none', async () => {
  assert.equal(i18n.TRANSLATIONS_BASE, 'https://raw.githubusercontent.com/rohitg00/ai-engineering-from-scratch/translations/i18n/');
  assert.equal(i18n.dictionaryFor('en'), null);
  assert.equal(i18n.dictionaryFor(''), null);
  i18n.preload('zh', { Contents: '目录' });
  assert.deepEqual(i18n.dictionaryFor('zh'), { Contents: '目录' });
  i18n.preload('hi', { strings: { Contents: 'विषय-सूची' }, pinned: ['Contents'] });
  assert.deepEqual(i18n.dictionaryFor('hi'), { Contents: 'विषय-सूची' });
  const requested = [];
  let published = false;
  globalThis.fetch = async (url) => {
    requested.push(url);
    return {
      ok: url.includes('/es/') || published,
      json: async () => ({ strings: { Contents: url.includes('/es/') ? 'Contenido' : 'later' }, pinned: [] }),
    };
  };
  try {
    const es = await new Promise((resolve) => i18n.loadDictionary('es', resolve));
    assert.deepEqual(es, { Contents: 'Contenido' });
    const missing = await new Promise((resolve) => i18n.loadDictionary('xx', resolve));
    assert.equal(missing, null);
    const cached = await new Promise((resolve) => i18n.loadDictionary('es', resolve));
    assert.deepEqual(cached, { Contents: 'Contenido' });
    published = true;
    const retried = await new Promise((resolve) => i18n.loadDictionary('xx', resolve));
    assert.deepEqual(retried, { Contents: 'later' });
    assert.deepEqual(requested, [
      `${i18n.TRANSLATIONS_BASE}es/ui.json`,
      `${i18n.TRANSLATIONS_BASE}xx/ui.json`,
      `${i18n.TRANSLATIONS_BASE}xx/ui.json`,
    ]);
  } finally {
    delete globalThis.fetch;
  }
});
