'use strict';

const markdown = require('../lesson-markdown');

const LANGS = ['python', 'shellscript', 'json', 'jsonc', 'jsonl', 'yaml', 'toml', 'ini', 'typescript', 'javascript', 'tsx', 'html', 'css', 'xml', 'markdown', 'http', 'go', 'c', 'cpp', 'rust', 'julia', 'java', 'sql', 'diff', 'docker', 'make', 'hcl', 'proto', 'powershell', 'asm'];
const THEME = 'aiefs';
const PREFIX = '--sh-';
const CLASSES = {
  'token-keyword': 'k',
  'token-string': 's',
  'token-string-expression': 's',
  'token-comment': 'c',
  'token-constant': 'n',
  'token-function': 'f',
  'token-parameter': 'v',
  'token-punctuation': 'p',
  'token-link': 'u',
};
const ANSI_COLORS = ['black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white'];
for (const name of ANSI_COLORS) {
  CLASSES[`ansi-${name}`] = `a-${name}`;
  CLASSES[`ansi-bright-${name}`] = `a-${name}`;
}

const state = { highlighter: null, aliases: null, loading: null };

async function load() {
  let modules;
  try {
    modules = await Promise.all([import('shiki/core'), import('shiki/engine/javascript'), import('shiki/langs')]);
  } catch (error) {
    if (error && error.code === 'ERR_MODULE_NOT_FOUND') return null;
    throw error;
  }
  const [{ createHighlighterCore, createCssVariablesTheme }, { createJavaScriptRegexEngine }, { bundledLanguagesInfo }] = modules;
  const theme = createCssVariablesTheme({ name: THEME, variablePrefix: PREFIX, variableDefaults: {}, fontStyle: true });
  theme.tokenColors.push(
    { scope: ['string.unquoted.argument'], settings: { foreground: `var(${PREFIX}foreground)` } },
    { scope: ['constant.other.option'], settings: { foreground: `var(${PREFIX}token-parameter)` } },
  );
  const info = bundledLanguagesInfo.filter(item => LANGS.includes(item.id));
  const highlighter = await createHighlighterCore({ themes: [theme], langs: info.map(item => item.import()), engine: createJavaScriptRegexEngine() });
  const aliases = new Map();
  for (const item of info) {
    aliases.set(item.id, item.id);
    for (const alias of item.aliases || []) aliases.set(alias, item.id);
  }
  state.highlighter = highlighter;
  state.aliases = aliases;
  return highlighter;
}

async function init() {
  if (!state.loading) state.loading = load();
  await state.loading;
  return engine();
}

function engine() {
  return state.highlighter ? 'shiki' : 'regex';
}

function tokenClass(token) {
  const match = /^var\(--sh-([a-z-]+)\)$/.exec(token.color || '');
  const names = [];
  if (match && CLASSES[match[1]]) names.push(CLASSES[match[1]]);
  if (token.fontStyle & 1) names.push('i');
  if (token.fontStyle & 2) names.push('b');
  return names.join(' ');
}

function lineHtml(tokens) {
  let out = '';
  let open = '';
  let text = '';
  const flush = () => {
    if (!text) return;
    out += open ? `<span class="${open}">${text}</span>` : text;
    text = '';
  };
  for (const token of tokens) {
    const name = tokenClass(token);
    if (name !== open) {
      flush();
      open = name;
    }
    text += markdown.escapeHtml(token.content);
  }
  flush();
  return out;
}

function tokenLines(code, lang) {
  return state.highlighter.codeToTokens(code, { lang, theme: THEME }).tokens.map(lineHtml);
}

const shikiHighlighter = {
  block(code, lang) {
    const id = state.aliases.get(lang);
    return id ? tokenLines(code, id).join('\n') : markdown.escapeHtml(code);
  },
  lines(lines, lang) {
    const id = state.aliases.get(lang);
    if (!id) return lines.map(markdown.escapeHtml);
    const out = tokenLines(lines.join('\n'), id);
    return lines.map((line, index) => out[index] || '');
  },
  ansi(code) {
    return tokenLines(code, 'ansi').join('\n');
  },
};

function highlighter() {
  return state.highlighter ? shikiHighlighter : null;
}

function render(code, lang, options) {
  const active = highlighter();
  if (!active) return markdown.renderCodeBlock(code, lang, options);
  return markdown.renderCodeWith(active, code, lang, options);
}

function lines(list, lang) {
  const active = highlighter();
  const key = String(lang || '').toLowerCase();
  if (active) return active.lines(list, key);
  return list.map(line => markdown.highlightSyntax(markdown.escapeHtml(line), key));
}

module.exports = { init, render, lines, engine, LANGS };
