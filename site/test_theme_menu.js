const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const menu = require('./theme-menu.js');

const { MODES, LABELS, modeFrom, resolve, storageValue } = menu;
const read = (name) => fs.readFileSync(path.join(__dirname, name), 'utf8');

test('the menu offers system, light, and dark in that order', () => {
  assert.deepEqual(MODES, ['system', 'light', 'dark']);
  assert.deepEqual(LABELS, { system: 'System', light: 'Light', dark: 'Dark' });
});

test('a stored theme maps to a mode and anything else means system', () => {
  assert.equal(modeFrom('light'), 'light');
  assert.equal(modeFrom('dark'), 'dark');
  for (const value of [null, '', 'system', 'auto', 'DARK', undefined]) assert.equal(modeFrom(value), 'system');
});

test('system follows the operating system and explicit modes ignore it', () => {
  assert.equal(resolve('system', true), 'dark');
  assert.equal(resolve('system', false), 'light');
  assert.equal(resolve('light', true), 'light');
  assert.equal(resolve('dark', false), 'dark');
  assert.equal(resolve('bogus', true), 'dark');
});

test('system removes the stored theme so every page script falls back to the OS', () => {
  assert.equal(storageValue('system'), null);
  assert.equal(storageValue('light'), 'light');
  assert.equal(storageValue('dark'), 'dark');
});

test('the shared header loads the theme menu on every page', () => {
  const header = read('header.js');
  assert.match(header, /script\.src = 'theme-menu\.js\?v=' \+ THEME_MENU_VERSION/);
  assert.match(header, /ensureThemeMenu\(\);/);
  const pages = fs.readdirSync(__dirname).filter((name) => name.endsWith('.html') && read(name).includes('id="themeToggle"'));
  assert.ok(pages.length >= 20, `found ${pages.length} pages with the theme button`);
  for (const page of pages) assert.match(read(page), /header\.js/, `${page} loads header.js`);
  for (const builder of ['build-hubs.js', 'build-practice.js', 'build-manuals.js', 'build-cheatsheets.js', 'build-skills.js']) {
    const source = read(builder);
    if (source.includes('themeToggle')) assert.match(source, /header\.js/, `${builder} pages load header.js`);
  }
});

test('the menu is an accessible popup that takes over the old toggle', () => {
  const source = read('theme-menu.js');
  assert.match(source, /'aria-haspopup', 'menu'/);
  assert.match(source, /'role', 'menuitemradio'/);
  assert.match(source, /aria-checked/);
  assert.match(source, /stopImmediatePropagation/);
  assert.match(source, /Escape/);
  assert.match(source, /ArrowDown/);
  assert.match(source, /prefers-color-scheme: dark/);
  assert.match(source, /addEventListener\('storage'/);
  assert.match(source, /prefers-reduced-motion/);
  assert.match(source, /hover:hover\) and \(pointer:fine/);
  assert.match(source, /aifs:themechange/);
  assert.doesNotMatch(source, /id="themeIcon"/, 'the old N and D glyph target is removed');
});

test('the lesson page redraws its diagrams when the theme changes from the menu', () => {
  assert.match(read('lesson.html'), /addEventListener\('aifs:themechange', function \(\) \{\s*updateMermaidThemeAndRerender\(\);/);
});

test('the menu strings are listed for translation', () => {
  const keys = JSON.parse(read('ui-strings.json')).keys;
  for (const key of ['Change theme', 'Theme', 'System', 'Light', 'Dark']) assert.ok(keys.includes(key), key);
});

test('a page theme in the URL and a blocked storage both keep the visible choice', () => {
  const source = read('theme-menu.js');
  assert.doesNotMatch(source, /\n    apply\(stored\(\)\);\n    sync\(\);\n  \}/, 'load keeps the theme the page already chose');
  assert.match(source, /catch \(e\) \{\s*session = mode;/);
  assert.match(source, /var inside = panel\.contains\(doc\.activeElement\) \|\| doc\.activeElement === button;/);
});
