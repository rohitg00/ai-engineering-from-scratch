'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const appSource = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');

function runApp(localStorageValue, options = {}) {
  const attributes = {};
  const documentHandlers = {};
  const buttonHandlers = {};
  const themeIcon = { textContent: '' };
  const themeToggle = {
    addEventListener(type, handler) {
      buttonHandlers[type] = handler;
    }
  };
  const document = {
    documentElement: {
      getAttribute(name) {
        return attributes[name] || null;
      },
      setAttribute(name, value) {
        attributes[name] = value;
      }
    },
    addEventListener(type, handler) {
      documentHandlers[type] = handler;
    },
    getElementById(id) {
      if (id === 'themeToggle') return themeToggle;
      if (id === 'themeIcon') return themeIcon;
      return null;
    },
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    }
  };
  const window = {
    matchMedia(query) {
      return { matches: query === '(prefers-color-scheme: dark)' && options.prefersDark };
    }
  };
  const context = vm.createContext({
    document,
    window,
    PHASES: [],
    GLOSSARY: []
  });
  Object.defineProperty(context, 'localStorage', {
    configurable: true,
    get() {
      if (options.storageGetter) return options.storageGetter();
      return localStorageValue;
    }
  });

  vm.runInContext(appSource, context, { filename: 'app.js' });
  return { attributes, buttonHandlers, documentHandlers, themeIcon };
}

test('a SecurityError localStorage getter does not block DOM-ready initialization', () => {
  const error = new Error('Storage is unavailable');
  error.name = 'SecurityError';
  const app = runApp(undefined, {
    prefersDark: true,
    storageGetter() {
      throw error;
    }
  });

  assert.equal(app.attributes['data-theme'], 'dark');
  assert.equal(typeof app.documentHandlers.DOMContentLoaded, 'function');
  app.documentHandlers.DOMContentLoaded();
  assert.equal(typeof app.buttonHandlers.click, 'function');
  assert.equal(app.themeIcon.textContent, 'D');
});

test('a throwing setItem leaves the in-memory theme toggle and icon update working', () => {
  const app = runApp({
    getItem() {
      return null;
    },
    setItem() {
      throw new Error('Storage is unavailable');
    }
  });

  app.documentHandlers.DOMContentLoaded();
  app.buttonHandlers.click();

  assert.equal(app.attributes['data-theme'], 'dark');
  assert.equal(app.themeIcon.textContent, 'D');
});
