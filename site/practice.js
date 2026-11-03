(function () {
  'use strict';

  var KATEX_BASE = 'https://cdn.jsdelivr.net/npm/katex@0.16.47/dist/';
  var KATEX_JS_SRI = 'sha384-CwjPRVHTvLiMBFjEoij+QZViMV5rhTOIp7CJzl24JEqpRDA1sJFHVXXLURktbYYp';
  var KATEX_CSS_SRI = 'sha384-nH0MfJ44wi1dd7w6jinlyBgljjS8EJAh2JBoRad8a3VDw2K69vfaaqm4WnR+gXtA';
  var BOOT_LIMIT_MS = 180000;
  var LAYER_TITLES = { examples: 'Examples', properties: 'Properties', edge: 'Edge cases', reference: 'Reference' };
  var STATUS_LABELS = { 'new': 'Not started', attempted: 'Attempted', solved: 'Solved' };
  var store = window.AIFSPracticeStore || null;

  function $(selector, root) {
    return (root || document).querySelector(selector);
  }

  function $all(selector, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(selector));
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function statusOf(id) {
    if (!store) return 'new';
    try {
      return store.status(id);
    } catch (_) {
      return 'new';
    }
  }

  function paintStatus(node, status) {
    node.setAttribute('data-status', status);
    node.setAttribute('aria-label', STATUS_LABELS[status]);
    node.setAttribute('title', STATUS_LABELS[status]);
    if (node.classList.contains('pr-status-wide')) node.textContent = STATUS_LABELS[status];
  }

  function paintStatuses() {
    $all('[data-status-for]').forEach(function (node) {
      paintStatus(node, statusOf(node.getAttribute('data-status-for')));
    });
    $all('[data-track][data-ids]').forEach(function (node) {
      var ids = node.getAttribute('data-ids').split(' ').filter(Boolean);
      var counts = store ? store.counts(ids) : { solved: 0, total: ids.length };
      var label = $('[data-track-progress]', node);
      var meter = $('[data-track-meter]', node);
      if (label) label.textContent = counts.solved + ' / ' + ids.length + ' solved';
      if (meter) meter.style.transform = 'scaleX(' + (ids.length ? counts.solved / ids.length : 0) + ')';
    });
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
        else reject(new Error('katex did not load'));
      };
      script.onerror = function () { reject(new Error('katex did not load')); };
      document.head.appendChild(script);
    });
  }

  function renderMath(root) {
    var nodes = $all('.math-inline:not([data-math-rendered]), .math-display:not([data-math-rendered])', root);
    if (!nodes.length) return;
    loadKatex().then(function (katex) {
      nodes.forEach(function (node) {
        var tex = node.textContent;
        try {
          katex.render(tex, node, { displayMode: node.classList.contains('math-display'), throwOnError: true, strict: 'ignore', trust: false });
          node.setAttribute('data-math-rendered', '');
        } catch (error) {
          node.textContent = tex;
        }
      });
    }).catch(function () {});
  }

  function initIndex(main) {
    var form = $('[data-filters]', main);
    var rows = $all('[data-list] .pr-row', main);
    var count = $('[data-count]', main);
    var empty = $('[data-empty]', main);
    var ids = rows.map(function (row) { return row.getAttribute('data-id'); });
    var fields = ['q', 'kind', 'difficulty', 'status', 'phase', 'track', 'tag'];

    function values() {
      var data = {};
      fields.forEach(function (name) {
        var input = form.elements[name];
        var value = '';
        if (input && typeof input.value === 'string') value = input.value;
        else if (input && input.length) {
          for (var i = 0; i < input.length; i++) if (input[i].checked) value = input[i].value;
        }
        data[name] = value.trim();
      });
      return data;
    }

    function matches(row, data) {
      if (data.kind && row.getAttribute('data-kind') !== data.kind) return false;
      if (data.difficulty && row.getAttribute('data-difficulty') !== data.difficulty) return false;
      if (data.phase && row.getAttribute('data-phase') !== data.phase) return false;
      if (data.track && (' ' + row.getAttribute('data-tracks') + ' ').indexOf(' ' + data.track + ' ') < 0) return false;
      if (data.tag && (' ' + row.getAttribute('data-tags') + ' ').indexOf(' ' + data.tag + ' ') < 0) return false;
      if (data.status) {
        var status = statusOf(row.getAttribute('data-id'));
        if (data.status === 'unsolved' && status === 'solved') return false;
        if (data.status === 'attempted' && status !== 'attempted') return false;
        if (data.status === 'solved' && status !== 'solved') return false;
      }
      if (data.q) {
        var text = row.getAttribute('data-search');
        var words = data.q.toLowerCase().split(/\s+/);
        for (var i = 0; i < words.length; i++) if (words[i] && text.indexOf(words[i]) < 0) return false;
      }
      return true;
    }

    function apply(push) {
      var data = values();
      var shown = 0;
      rows.forEach(function (row) {
        var ok = matches(row, data);
        row.hidden = !ok;
        if (ok) shown += 1;
      });
      count.textContent = shown === rows.length ? rows.length + ' problems' : shown + ' of ' + rows.length + ' problems';
      empty.hidden = shown > 0;
      if (push) {
        var params = new URLSearchParams();
        fields.forEach(function (name) { if (data[name]) params.set(name, data[name]); });
        var query = params.toString();
        try {
          history.replaceState(null, '', location.pathname + (query ? '?' + query : '') + location.hash);
        } catch (_) {}
      }
    }

    function restore() {
      var params = new URLSearchParams(location.search);
      fields.forEach(function (name) {
        var value = params.get(name);
        if (value === null) return;
        var input = form.elements[name];
        if (!input) return;
        if (typeof input.value === 'string' && !input.length) input.value = value;
        else if (input.length && input.tagName !== 'SELECT') {
          for (var i = 0; i < input.length; i++) input[i].checked = input[i].value === value;
        } else input.value = value;
      });
    }

    function stats() {
      var box = $('[data-practice-stats]', main);
      if (!box || !store) return;
      var counts = store.counts(ids);
      $('[data-stat="solved"]', box).textContent = counts.solved + ' / ' + ids.length;
      $('[data-stat="attempted"]', box).textContent = String(counts.attempted);
      var streak = store.streak();
      $('[data-stat="streak"]', box).textContent = streak + (streak === 1 ? ' day' : ' days');
      ['easy', 'medium', 'hard'].forEach(function (level) {
        var group = rows.filter(function (row) { return row.getAttribute('data-difficulty') === level; }).map(function (row) { return row.getAttribute('data-id'); });
        var node = $('[data-stat="' + level + '"]', box);
        if (node) node.textContent = store.counts(group).solved + ' / ' + group.length;
      });
      var next = store.continueTarget(ids);
      var link = $('[data-continue]', main);
      if (link && next) {
        link.href = '/practice/' + next;
        link.hidden = false;
        var row = rows[ids.indexOf(next)];
        var title = row ? $('.pr-row-title', row).textContent : '';
        link.textContent = 'Continue: ' + title;
      }
    }

    restore();
    apply(false);
    stats();
    form.addEventListener('input', function () { apply(true); });
    form.addEventListener('change', function () { apply(true); });
    form.addEventListener('reset', function () { setTimeout(function () { apply(true); }, 0); });
    var random = $('[data-random]', main);
    if (random) {
      random.addEventListener('click', function () {
        var visible = rows.filter(function (row) { return !row.hidden; }).map(function (row) { return row.getAttribute('data-id'); });
        var pool = visible.length ? visible : ids;
        var pick = store ? store.randomUnsolved(pool) : pool[Math.floor(Math.random() * pool.length)];
        if (!pick) {
          random.textContent = 'All solved';
          return;
        }
        location.href = '/practice/' + pick;
      });
    }
    window.addEventListener('storage', function () {
      paintStatuses();
      stats();
      apply(false);
    });
  }

  function highlight(code) {
    var api = window.AIFSLessonMarkdown;
    var escaped = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    var html = api && api.highlightSyntax ? api.highlightSyntax(escaped, 'python') : escaped;
    return html + '\n';
  }

  function solutionHtml(code) {
    var api = window.AIFSLessonMarkdown;
    if (api && api.renderCodeBlock) return api.renderCodeBlock(code, 'python', { label: 'solution.py' });
    return '<pre class="pr-solution-code"><code>' + highlight(code) + '</code></pre>';
  }

  function lineStart(text, index) {
    return text.lastIndexOf('\n', index - 1) + 1;
  }

  function createEditor(root, onChange, keys) {
    var input = $('[data-editor-input]', root);
    var view = $('[data-editor-view]', root);
    var released = false;

    function syncScroll() {
      view.parentNode.scrollTop = input.scrollTop;
      view.parentNode.scrollLeft = input.scrollLeft;
    }

    function paint() {
      view.innerHTML = highlight(input.value);
      syncScroll();
    }

    function replace(start, end, text, selectStart, selectEnd) {
      input.setRangeText(text, start, end, 'end');
      if (selectStart !== undefined) input.setSelectionRange(selectStart, selectEnd);
      paint();
      onChange(input.value);
    }

    function indent(outdent) {
      var value = input.value;
      var start = input.selectionStart;
      var end = input.selectionEnd;
      var first = lineStart(value, start);
      if (start === end && !outdent) {
        replace(start, end, '    ');
        return;
      }
      var last = end > first && value[end - 1] === '\n' ? end - 1 : end;
      var block = value.slice(first, last);
      var lines = block.split('\n');
      var changed = lines.map(function (line) {
        if (!outdent) return '    ' + line;
        return line.replace(/^ {1,4}/, '');
      });
      var text = changed.join('\n');
      var shift = changed[0].length - lines[0].length;
      replace(first, last, text, Math.max(first, start + shift), first + text.length + (end - last));
    }

    input.addEventListener('keydown', function (event) {
      var mod = event.metaKey || event.ctrlKey;
      if (keys(event)) return;
      if (event.key === 'Escape') {
        released = true;
        return;
      }
      if (event.key === 'Tab' && !mod && !event.altKey) {
        if (released) {
          released = false;
          return;
        }
        event.preventDefault();
        indent(event.shiftKey);
        return;
      }
      released = false;
      if (event.key === 'Enter' && !mod && !event.shiftKey && !event.altKey) {
        var value = input.value;
        var start = input.selectionStart;
        var line = value.slice(lineStart(value, start), start);
        var spaces = (/^ */.exec(line) || [''])[0];
        if (/:\s*$/.test(line)) spaces += '    ';
        event.preventDefault();
        replace(start, input.selectionEnd, '\n' + spaces);
        return;
      }
      if (event.key === 'Backspace' && input.selectionStart === input.selectionEnd) {
        var pos = input.selectionStart;
        var before = input.value.slice(lineStart(input.value, pos), pos);
        if (before.length && /^ +$/.test(before) && before.length % 4 === 0) {
          event.preventDefault();
          replace(pos - 4, pos, '');
        }
      }
    });
    input.addEventListener('input', function () {
      paint();
      onChange(input.value);
    });
    input.addEventListener('scroll', syncScroll);
    paint();
    return {
      value: function () { return input.value; },
      set: function (text) {
        input.value = text;
        paint();
      },
      focus: function () { input.focus(); }
    };
  }

  function createRunner(main, onStatus, onProgress) {
    var worker = null;
    var pending = null;
    var ready = false;
    var seq = 0;
    var timings = window.__practiceTimings = window.__practiceTimings || {};
    var workerUrl = main.getAttribute('data-worker');
    var pyodide = main.getAttribute('data-pyodide');
    var harness = main.getAttribute('data-harness');

    function finish(result) {
      if (!pending) return;
      var done = pending;
      pending = null;
      clearTimeout(done.timer);
      done.resolve(result);
    }

    function spawn() {
      worker = new Worker(workerUrl, { type: 'module' });
      ready = false;
      var started = performance.now();
      worker.onmessage = function (event) {
        var message = event.data || {};
        if (message.type === 'status') {
          if (message.phase === 'ready') {
            ready = true;
            timings.bootMs = Math.round(performance.now() - started);
            timings.workerBootMs = message.ms;
            onStatus('ready', message.ms);
            if (pending) {
              clearTimeout(pending.timer);
              pending.timer = setTimeout(timeout, pending.limit);
            }
          } else {
            onStatus(message.phase, message.ms);
          }
          return;
        }
        if (!pending || message.id !== pending.id) return;
        if (message.type === 'progress') {
          if (onProgress) onProgress(message);
          return;
        }
        if (message.type === 'result') finish({ report: message.report });
        else finish({ error: message.message });
      };
      worker.onerror = function (event) {
        event.preventDefault();
        finish({ error: 'The Python runtime stopped: ' + (event.message || 'unknown error') });
        reset();
      };
      worker.postMessage({ type: 'boot', pyodide: pyodide });
      onStatus('loading');
    }

    function reset() {
      if (worker) worker.terminate();
      worker = null;
      ready = false;
    }

    function timeout() {
      var limit = pending ? pending.limit : 0;
      reset();
      onStatus('stopped');
      finish({ timeout: true, limit: limit });
    }

    return {
      warm: function () {
        if (!worker) spawn();
      },
      run: function (job) {
        if (pending) return Promise.resolve({ busy: true });
        if (!worker) spawn();
        seq += 1;
        var id = seq;
        var limit = Math.max(1, Number(job.limit) || 10) * 1000 + 1500;
        return new Promise(function (resolve) {
          pending = { id: id, resolve: resolve, limit: limit, timer: setTimeout(timeout, ready ? limit : BOOT_LIMIT_MS) };
          worker.postMessage({ type: 'run', id: id, pyodide: pyodide, harness: harness, tests: job.tests, fixtures: job.fixtures, support: job.support || '', code: job.code, layers: job.layers, limit: job.limit });
        });
      },
      busy: function () { return !!pending; }
    };
  }

  function createCurve(figure) {
    var points = [];
    var frame = 0;
    var MAX = 600;
    if (!figure) return { add: function () {}, reset: function () {}, replace: function () {} };
    var line = $('[data-curve-line]', figure);
    var label = $('[data-curve-label]', figure);

    function draw() {
      frame = 0;
      if (!points.length) return;
      figure.hidden = false;
      var maxStep = points[points.length - 1][0] || 1;
      var values = points.map(function (point) { return point[1]; }).filter(function (value) { return typeof value === 'number' && isFinite(value); });
      if (!values.length) return;
      var top = Math.max.apply(null, values);
      var bottom = Math.min.apply(null, values);
      var span = top - bottom || 1;
      line.setAttribute('points', points.filter(function (point) { return typeof point[1] === 'number' && isFinite(point[1]); }).map(function (point) {
        var x = (point[0] / maxStep) * 400;
        var y = 116 - ((point[1] - bottom) / span) * 112;
        return x.toFixed(1) + ',' + y.toFixed(1);
      }).join(' '));
      var last = points[points.length - 1];
      label.textContent = 'step ' + last[0] + ', ' + last[2] + ' ' + (typeof last[1] === 'number' && isFinite(last[1]) ? Number(last[1]).toPrecision(4) : 'not finite');
    }

    function schedule() {
      if (!frame) frame = requestAnimationFrame(draw);
    }

    return {
      add: function (message) {
        if (points.length && points[0][2] !== message.name) return;
        points.push([message.step, message.value, message.name]);
        if (points.length > MAX) points = points.filter(function (_, index) { return index % 2 === 0; });
        schedule();
      },
      reset: function () {
        points = [];
        line.setAttribute('points', '');
        label.textContent = '';
      },
      replace: function (list) {
        points = list.filter(function (point) { return point[2] === (list[0] && list[0][2]); }).slice(-MAX);
        schedule();
      }
    };
  }

  function resultHtml(result) {
    var mark = { pass: 'Pass', fail: 'Fail', error: 'Error', skip: 'Skipped' }[result.status];
    var open = result.status !== 'pass';
    var details = '';
    if (open) {
      details += '<p class="pr-res-msg">' + escapeHtml(result.message) + '</p>';
      if (result.expected !== null && result.expected !== undefined) details += '<div class="pr-res-io"><span>Expected</span><pre>' + escapeHtml(result.expected) + '</pre></div>';
      if (result.actual !== null && result.actual !== undefined) details += '<div class="pr-res-io"><span>Your value</span><pre>' + escapeHtml(result.actual) + '</pre></div>';
    }
    details += '<p class="pr-res-why"><span>What this checks</span>' + escapeHtml(result.explain) + '</p>';
    return '<li class="pr-res pr-res-' + result.status + '"><details' + (open ? ' open' : '') + '><summary><span class="pr-res-mark">' + mark + '</span><span class="pr-res-name">' + escapeHtml(result.name) + '</span></summary>' + details + '</details></li>';
  }

  function reportHtml(report, kind) {
    var sum = report.summary;
    var head;
    if (kind === 'submit' && sum.ok) head = '<p class="pr-verdict pr-verdict-pass" role="status"><strong>Accepted.</strong> All ' + sum.total + ' checks pass. The solution and the notes are open below.</p>';
    else if (kind === 'run' && sum.ok) head = '<p class="pr-verdict pr-verdict-run" role="status"><strong>The examples pass.</strong> Select Submit to run the properties, the hidden edge cases and the reference checks.</p>';
    else head = '<p class="pr-verdict pr-verdict-fail" role="status"><strong>' + sum.passed + ' of ' + sum.total + ' checks pass.</strong> Open a failed check to see the expected value and your value.</p>';
    var groups = {};
    var order = [];
    report.results.forEach(function (result) {
      if (!groups[result.layer]) {
        groups[result.layer] = [];
        order.push(result.layer);
      }
      groups[result.layer].push(result);
    });
    var body = order.map(function (layer) {
      var list = groups[layer];
      var passed = list.filter(function (result) { return result.status === 'pass'; }).length;
      return '<section class="pr-layer"><h3>' + LAYER_TITLES[layer] + ' <span>' + passed + ' / ' + list.length + '</span></h3><ol>' + list.map(resultHtml).join('') + '</ol></section>';
    }).join('');
    var extra = '';
    if (report.load_error) extra += '<p class="pr-res-load">' + escapeHtml(report.load_error) + '</p>';
    if (report.warnings && report.warnings.length) extra += '<div class="pr-res-out"><span>Warnings</span><pre>' + escapeHtml(report.warnings.join('\n')) + '</pre></div>';
    if (report.stdout) extra += '<div class="pr-res-out"><span>Printed output</span><pre>' + escapeHtml(report.stdout) + '</pre></div>';
    return head + extra + body;
  }

  function initProblem(main) {
    var id = main.getAttribute('data-practice-problem');
    var version = main.getAttribute('data-version');
    var limit = Number(main.getAttribute('data-limit')) || 10;
    var results = $('[data-results]', main);
    var runtimeLabel = $('[data-runtime]', main);
    var hintList = $('[data-hints]', main);
    var hintButton = $('[data-hint-next]', main);
    var solutionBox = $('[data-solution]', main);
    var lock = $('[data-lock]', main);
    var lockedNote = $('[data-locked-note]', main);
    var runButton = $('[data-run]', main);
    var submitButton = $('[data-submit]', main);
    var resetButton = $('[data-reset]', main);
    var starter = $('[data-editor-input]', main).value;
    var dataPromise = null;
    var hintsShown = 0;
    var saveTimer = null;

    function data() {
      if (!dataPromise) {
        dataPromise = fetch(main.getAttribute('data-data')).then(function (response) {
          if (!response.ok) throw new Error('The problem data did not load (' + response.status + ').');
          return response.json();
        });
        dataPromise.catch(function () { dataPromise = null; });
      }
      return dataPromise;
    }

    function persist(code) {
      clearTimeout(saveTimer);
      saveTimer = null;
      if (!store) return;
      if (code === starter) store.clearCode(id);
      else store.saveCode(id, code);
    }

    function save(code) {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(function () { persist(code); }, 250);
    }

    function flush() {
      if (saveTimer) persist(editor.value());
    }

    function paintRuntime(phase, ms) {
      var text = {
        loading: 'Downloading Python (about 15 MB the first time)',
        runtime: 'Starting Python',
        numpy: 'Loading numpy',
        ready: 'Python ready' + (ms ? ' in ' + (ms / 1000).toFixed(1) + ' s' : ''),
        stopped: 'Python stopped. It restarts on the next run'
      }[phase] || '';
      runtimeLabel.textContent = text;
      runtimeLabel.setAttribute('data-phase', phase);
    }

    var curve = createCurve($('[data-curve]', main));
    var runner = createRunner(main, paintRuntime, curve.add);

    function setBusy(busy, label) {
      runButton.disabled = busy;
      submitButton.disabled = busy;
      main.toggleAttribute('data-busy', busy);
      if (busy) results.innerHTML = '<p class="pr-results-empty pr-running">' + escapeHtml(label) + '</p>';
    }

    function execute(kind) {
      if (runner.busy()) return;
      var code = editor.value();
      persist(code);
      setBusy(true, kind === 'submit' ? 'Running every check' : 'Running the examples');
      data().then(function (problem) {
        curve.reset();
        return runner.run({ tests: problem.tests, fixtures: problem.fixtures, support: problem.support, code: code, layers: kind === 'submit' ? [] : ['examples'], limit: problem.limit || limit });
      }).then(function (outcome) {
        setBusy(false);
        if (outcome.busy) return;
        if (outcome.timeout) {
          results.innerHTML = '<p class="pr-verdict pr-verdict-fail" role="status"><strong>Time limit.</strong> The checks did not finish in ' + Math.round(outcome.limit / 1000) + ' seconds. Look for a loop that does not end, or for work that grows too fast with the input size.</p>';
          if (store) store.record(id, kind, 0, 1);
          paintStatuses();
          return;
        }
        if (outcome.error) {
          results.innerHTML = '<p class="pr-verdict pr-verdict-fail" role="status"><strong>The run did not complete.</strong> ' + escapeHtml(outcome.error) + '</p>';
          return;
        }
        var report = outcome.report;
        if (report.curve && report.curve.length) curve.replace(report.curve);
        results.innerHTML = reportHtml(report, kind);
        var firstFail = results.querySelector('.pr-res-fail, .pr-res-error');
        results.scrollTop = firstFail && kind === 'submit' ? Math.max(0, firstFail.offsetTop - 48) : 0;
        main.setAttribute('data-last', kind + ':' + (report.summary.ok ? 'pass' : 'fail'));
        if (store) store.record(id, kind, report.summary.passed, report.summary.total);
        paintStatuses();
        if (kind === 'submit' && report.summary.ok) unlock(true);
      }, function (error) {
        setBusy(false);
        results.innerHTML = '<p class="pr-verdict pr-verdict-fail" role="status"><strong>The run did not start.</strong> ' + escapeHtml(error.message) + '</p>';
      });
    }

    function renderHints(problem, count) {
      hintsShown = Math.min(count, problem.hints.length);
      hintList.innerHTML = problem.hints.slice(0, hintsShown).map(function (html, index) {
        return '<li class="pr-hint"><p class="pr-hint-n">Hint ' + (index + 1) + '</p>' + html + '</li>';
      }).join('');
      renderMath(hintList);
      if (hintsShown >= problem.hints.length) {
        hintButton.hidden = true;
      } else {
        hintButton.hidden = false;
        hintButton.textContent = 'Show hint ' + (hintsShown + 1) + ' of ' + problem.hints.length;
      }
    }

    function nextHint() {
      data().then(function (problem) {
        if (hintsShown >= problem.hints.length) return;
        renderHints(problem, hintsShown + 1);
        if (store) store.revealHint(id, hintsShown);
        var last = hintList.lastElementChild;
        if (last) {
          last.setAttribute('tabindex', '-1');
          last.focus({ preventScroll: false });
        }
      });
    }

    function unlock(fresh) {
      var href = main.getAttribute('data-data').replace(/\.json(\?|$)/, '.solution.json$1');
      fetch(href).then(function (response) {
        if (!response.ok) throw new Error(String(response.status));
        return response.json();
      }).then(function (solution) {
        lock.textContent = 'Open';
        lock.setAttribute('data-open', '');
        lockedNote.hidden = true;
        solutionBox.hidden = false;
        solutionBox.innerHTML = '<h3>Reference solution</h3>' + solutionHtml(solution.solution) + '<div class="pr-notes"><h3>Notes</h3>' + solution.notes + '</div>';
        renderMath(solutionBox);
        if (fresh) solutionBox.closest('.pr-solution').classList.add('pr-flash');
      }).catch(function () {});
    }

    function keys(event) {
      var mod = event.metaKey || event.ctrlKey;
      if (mod && event.key === 'Enter') {
        event.preventDefault();
        execute(event.shiftKey ? 'submit' : 'run');
        return true;
      }
      if (mod && (event.key === 's' || event.key === 'S')) {
        event.preventDefault();
        persist(editor.value());
        return true;
      }
      if (event.altKey && event.code === 'KeyH') {
        event.preventDefault();
        nextHint();
        return true;
      }
      return false;
    }

    var editor = createEditor($('[data-editor]', main), save, keys);
    if (store) {
      var saved = store.loadCode(id);
      if (typeof saved === 'string' && saved.length) editor.set(saved);
      store.open(id, version);
    }
    runButton.addEventListener('click', function () { execute('run'); });
    submitButton.addEventListener('click', function () { execute('submit'); });
    resetButton.addEventListener('click', function () {
      if (editor.value() !== starter && !window.confirm('Replace your code with the starter? Your current code is lost.')) return;
      editor.set(starter);
      if (store) store.clearCode(id);
    });
    hintButton.addEventListener('click', nextHint);
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') flush();
    });
    document.addEventListener('keydown', function (event) {
      if (event.target && event.target.matches && event.target.matches('[data-editor-input]')) return;
      keys(event);
    });
    data().then(function (problem) {
      renderHints(problem, store ? store.problem(id).hints : 0);
    }).catch(function () {});
    if (statusOf(id) === 'solved') unlock(false);
    var warm = function () { runner.warm(); };
    runButton.addEventListener('pointerenter', warm, { once: true });
    submitButton.addEventListener('pointerenter', warm, { once: true });
  }

  function init() {
    paintStatuses();
    var main = $('main');
    if (!main) return;
    renderMath(main);
    if (main.hasAttribute('data-practice-index')) initIndex(main);
    if (main.hasAttribute('data-practice-problem')) initProblem(main);
    window.addEventListener('pageshow', function (event) {
      if (event.persisted) paintStatuses();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
