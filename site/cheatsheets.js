(function () {
  'use strict';

  var KATEX_BASE = 'https://cdn.jsdelivr.net/npm/katex@0.16.47/dist/';
  var KATEX_JS_SRI = 'sha384-CwjPRVHTvLiMBFjEoij+QZViMV5rhTOIp7CJzl24JEqpRDA1sJFHVXXLURktbYYp';
  var KATEX_CSS_SRI = 'sha384-nH0MfJ44wi1dd7w6jinlyBgljjS8EJAh2JBoRad8a3VDw2K69vfaaqm4WnR+gXtA';
  var root = document.documentElement;

  function done() {
    root.setAttribute('data-math', 'ready');
  }

  function loadKatex() {
    return new Promise(function (resolve, reject) {
      if (window.katex) {
        resolve(window.katex);
        return;
      }
      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = KATEX_BASE + 'katex.min.css';
      link.integrity = KATEX_CSS_SRI;
      link.crossOrigin = 'anonymous';
      document.head.appendChild(link);
      var script = document.createElement('script');
      script.src = KATEX_BASE + 'katex.min.js';
      script.integrity = KATEX_JS_SRI;
      script.crossOrigin = 'anonymous';
      script.onload = function () {
        if (window.katex) resolve(window.katex);
        else reject(new Error('katex loaded without defining window.katex'));
      };
      script.onerror = function () {
        reject(new Error('katex failed to load'));
      };
      document.head.appendChild(script);
    });
  }

  function renderMath() {
    var nodes = document.querySelectorAll('.math-inline:not([data-math-rendered]), .math-display:not([data-math-rendered])');
    if (!nodes.length) {
      done();
      return;
    }
    loadKatex().then(function (katex) {
      Array.prototype.forEach.call(nodes, function (node) {
        var tex = node.textContent;
        try {
          katex.render(tex, node, {
            displayMode: node.classList.contains('math-display'),
            throwOnError: true,
            strict: 'ignore',
            trust: false
          });
          node.setAttribute('data-math-rendered', '');
        } catch (error) {
          node.textContent = tex;
          node.setAttribute('title', String(error && error.message || error));
        }
      });
    }).catch(function () {}).then(done);
  }

  function copyText(text, target, label) {
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(text).then(function () {
      target.classList.add('is-copied');
      if (label) target.textContent = 'Copied';
      setTimeout(function () {
        target.classList.remove('is-copied');
        if (label) target.textContent = label;
      }, 1200);
    }, function () {});
  }

  function bindCopy() {
    Array.prototype.forEach.call(document.querySelectorAll('.cs-cmd'), function (code) {
      code.addEventListener('click', function () {
        copyText(code.textContent, code, '');
      });
      code.addEventListener('keydown', function (event) {
        if (event.key === 'Enter') copyText(code.textContent, code, '');
      });
    });
  }

  function bindPrint() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-print]'), function (button) {
      button.addEventListener('click', function () {
        window.print();
      });
    });
  }

  function element(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function bindSearch() {
    var input = document.getElementById('cs-q');
    if (!input) return;
    var list = document.querySelector('.cs-results');
    var count = document.querySelector('.cs-search-count');
    var entries = null;
    var loading = null;

    function load() {
      if (!loading) {
        loading = fetch(input.getAttribute('data-index')).then(function (response) {
          return response.json();
        }).then(function (topics) {
          entries = [];
          topics.forEach(function (topic) {
            entries.push({ topic: topic, title: topic.t, meta: 'Cheat sheet', href: '/cheatsheets/' + topic.i, text: (topic.t + ' ' + topic.i.replace(/-/g, ' ') + ' ' + (topic.k || '')).toLowerCase(), rank: 0 });
            topic.r.forEach(function (row) {
              entries.push({ topic: topic, title: row[0], meta: topic.t + (row[1] ? ' · ' + row[1] : ''), href: '/cheatsheets/' + topic.i + '#' + (topic.b ? topic.b[row[2]] : row[2]), text: (row[0] + ' ' + row[1] + ' ' + (row[3] || '') + ' ' + topic.t).toLowerCase(), rank: 1 });
            });
          });
          return entries;
        }).catch(function () {
          loading = null;
          return [];
        });
      }
      return loading;
    }

    function render() {
      var words = input.value.toLowerCase().split(/\s+/).filter(Boolean);
      while (list.firstChild) list.removeChild(list.firstChild);
      if (!words.length || !entries) {
        list.hidden = true;
        count.textContent = '';
        return;
      }
      var found = entries.filter(function (entry) {
        return words.every(function (word) { return entry.text.indexOf(word) >= 0; });
      }).sort(function (a, b) {
        return a.rank - b.rank;
      });
      found.slice(0, 40).forEach(function (entry) {
        var item = element('li');
        var link = element('a');
        link.href = entry.href;
        link.style.setProperty('--h', entry.topic.h);
        link.appendChild(element('span', 'cs-code', entry.topic.c));
        link.appendChild(element('b', '', entry.title));
        link.appendChild(element('small', '', entry.meta.length > 160 ? entry.meta.slice(0, 157) + '...' : entry.meta));
        item.appendChild(link);
        list.appendChild(item);
      });
      list.hidden = !found.length;
      count.textContent = found.length ? found.length + (found.length === 1 ? ' match' : ' matches') + (found.length > 40 ? ', first 40 shown' : '') : 'No match. Try a shorter word.';
    }

    input.addEventListener('focus', load);
    input.addEventListener('input', function () {
      load().then(render);
    });
    input.addEventListener('keydown', function (event) {
      if (event.key !== 'Enter') return;
      var first = list.querySelector('a');
      if (first) window.location.href = first.href;
    });
  }

  function bindFilters() {
    var buttons = document.querySelectorAll('.cs-filter-kinds button');
    if (!buttons.length) return;
    var count = document.querySelector('.cs-filter-count');
    function apply(kind) {
      var shown = 0;
      Array.prototype.forEach.call(buttons, function (button) {
        button.setAttribute('aria-pressed', button.getAttribute('data-kind') === kind ? 'true' : 'false');
      });
      Array.prototype.forEach.call(document.querySelectorAll('.cs-track'), function (section) {
        var visible = 0;
        Array.prototype.forEach.call(section.querySelectorAll('.cs-tile'), function (tile) {
          var show = !kind || tile.getAttribute('data-kind') === kind;
          tile.hidden = !show;
          if (show) visible += 1;
        });
        section.hidden = !visible;
        shown += visible;
        var link = document.querySelector('.cs-track-nav a[href$="#' + section.id + '"]');
        if (link) link.hidden = !visible;
      });
      if (count) count.textContent = kind ? shown + (shown === 1 ? ' sheet shown' : ' sheets shown') : '';
    }
    Array.prototype.forEach.call(buttons, function (button) {
      button.addEventListener('click', function () {
        apply(button.getAttribute('data-kind'));
      });
    });
  }

  function start() {
    bindFilters();
    bindPrint();
    bindCopy();
    bindSearch();
    renderMath();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
}());
