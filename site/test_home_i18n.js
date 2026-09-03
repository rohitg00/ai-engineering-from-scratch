const assert = require('node:assert/strict');
const test = require('node:test');

const { applyHomeLanguage, translateText } = require('./home-i18n.js');

function textNode(value) {
  return {
    nodeValue: value,
  };
}

function documentFor(nodes) {
  return {
    body: {},
    documentElement: { lang: 'en', dir: 'ltr' },
    createTreeWalker(body, nodeType) {
      let index = 0;
      assert.equal(body, this.body);
      assert.equal(nodeType, 4);
      return {
        nextNode() {
          return nodes[index++] || null;
        },
      };
    },
  };
}

function browserRootFor(nodes) {
  let observerCallback;
  const document = documentFor(nodes);
  document.addEventListener = () => {};

  function MutationObserver(callback) {
    observerCallback = callback;
  }

  MutationObserver.prototype.observe = () => {};

  return {
    document,
    root: {
      AIFS_currentLang: () => 'zh',
      MutationObserver,
      document,
    },
    notifyMutation() {
      observerCallback();
    },
  };
}

function loadBrowserApi(root) {
  const modulePath = require.resolve('./home-i18n.js');
  const previousWindow = global.window;
  delete require.cache[modulePath];
  global.window = root;
  const api = require('./home-i18n.js');
  delete require.cache[modulePath];
  if (previousWindow === undefined) delete global.window;
  else global.window = previousWindow;
  return api;
}

test('Chinese homepage language selection localizes the primary navigation and masthead', () => {
  const nodes = [
    textNode('Contents'),
    textNode('AI Engineering'),
    textNode('from Scratch'),
    textNode('Start the Course'),
  ];
  const document = documentFor(nodes);

  applyHomeLanguage('zh', document);

  assert.deepEqual(nodes.map(node => node.nodeValue), ['目录', 'AI 工程', '从零开始', '开始学习']);
  assert.equal(document.documentElement.lang, 'zh');
  assert.equal(document.documentElement.dir, 'ltr');
});

test('English homepage language selection restores canonical copy', () => {
  const node = textNode('Start the Course');
  const document = documentFor([node]);

  applyHomeLanguage('zh', document);
  applyHomeLanguage('en', document);

  assert.equal(node.nodeValue, 'Start the Course');
  assert.equal(document.documentElement.lang, 'en');
});

test('Chinese homepage copy covers navigation injected by the shared header', () => {
  assert.equal(translateText('Learning Paths', 'zh'), '学习路径');
  assert.equal(translateText('LEARNING PATHS', 'zh'), '学习路径');
  assert.equal(
    translateText('. Every algorithm built from raw math before a single framework gets imported.', 'zh'),
    '。在引入任何框架之前，先从原始数学推导并实现每一个算法。'
  );
  assert.equal(translateText('LEARNING PATHS', 'en'), 'LEARNING PATHS');
});

test('Chinese translation ignores inherited dictionary properties', () => {
  assert.equal(translateText('toString', 'zh'), 'toString');
  assert.equal(translateText('constructor', 'zh'), 'constructor');
});

test('unsupported homepage languages use English document metadata', () => {
  const document = documentFor([textNode('Start the Course')]);

  applyHomeLanguage('fr', document);

  assert.equal(document.documentElement.lang, 'en');
  assert.equal(document.documentElement.dir, 'ltr');
});

test('delayed shared-header nodes translate and restore through the observer', () => {
  const nodes = [];
  const browser = browserRootFor(nodes);
  const { applyHomeLanguage } = loadBrowserApi(browser.root);
  const delayedNode = textNode('Learning Paths');

  nodes.push(delayedNode);
  browser.notifyMutation();

  assert.equal(delayedNode.nodeValue, '学习路径');
  applyHomeLanguage('en', browser.document);
  assert.equal(delayedNode.nodeValue, 'Learning Paths');
});
