(function () {
  'use strict';
  var serial = 0;
  var tones = ['neutral', 'active', 'good', 'warn', 'bad'];
  function text(value) { return value == null ? '' : String(value); }
  function tone(value) { return tones.indexOf(value) === -1 ? 'neutral' : value; }

  function lab(host, config, step) {
    var LF = window.LF;
    var inputs = [];
    var listeners = [];
    var observers = [];
    var animations = [];
    var frames = [];
    var index = 0;
    var revision = 0;
    var disposed = false;
    var timer = null;
    var offscreen = false;
    var printing = false;
    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    var metricNodes = new Map();
    var barNodes = new Map();
    var laneNodes = new Map();
    var itemNodes = new Map();
    var rowNodes = new Map();
    var form = LF.el('div', { class: 'pj-lab-inputs' });
    var presets = LF.el('div', { class: 'pj-lab-presets', 'aria-label': 'Example inputs' });
    var message = LF.el('p', { class: 'pj-lab-message', 'aria-live': 'polite', 'aria-atomic': 'true' });
    var summary = LF.el('p', { class: 'pj-lab-summary' });
    var metrics = LF.el('dl', { class: 'pj-lab-metrics' });
    var chart = LF.el('div', { class: 'pj-lab-bars', 'aria-label': 'Computed comparisons' });
    var table = LF.el('table');
    var tableHead = LF.el('tr');
    var tableBody = LF.el('tbody');
    table.append(LF.el('thead', {}, [tableHead]), tableBody);
    var tableHost = LF.el('div', { class: 'pj-lab-table' }, [table]);
    var lanes = LF.el('div', { class: 'pj-trace-lanes' });
    var links = LF.el('ul', { class: 'pj-trace-links', 'aria-label': 'Connections between records' });
    var formula = LF.el('pre', { class: 'pj-trace-formula' });
    var receiptBody = LF.el('pre');
    var receipt = LF.el('details', { class: 'pj-trace-receipt' }, [LF.el('summary', {}, ['Inspect the receipt']), receiptBody]);
    var label = LF.el('h3', { class: 'pj-trace-label' });
    var explanation = LF.el('p', { class: 'pj-trace-explanation' });
    var steps = LF.el('div', { class: 'pj-trace-steps', 'aria-label': 'Computation steps' });
    var previous = LF.el('button', { type: 'button', class: 'pj-chip' }, ['Previous']);
    var next = LF.el('button', { type: 'button', class: 'pj-chip' }, ['Next step']);
    var play = LF.el('button', { type: 'button', class: 'pj-chip', 'aria-pressed': 'false' }, ['Play steps']);
    var count = LF.el('span', { class: 'pj-small' });
    var motionHint = LF.el('p', { class: 'pj-small' }, ['Reduced motion is on. Use the step buttons to explore each state.']);
    var controls = LF.el('div', { class: 'pj-trace-controls' }, [steps, LF.el('div', { class: 'pj-figure-controls' }, [previous, play, next, count]), motionHint]);
    var state = LF.el('div', { class: 'pj-trace-state' }, [label, explanation, lanes, links, summary, formula, metrics, chart, tableHost, receipt]);
    var reset = LF.el('button', { type: 'button', class: 'pj-chip' }, ['Reset inputs']);
    var root = LF.el('section', { class: 'pj-mechanism-lab', 'aria-label': 'Interactive mechanism' }, [
      LF.el('p', { class: 'pj-lab-question' }, [config.question || 'Change an input and inspect what the calculation produces.']),
      presets, form, reset, message, controls, state
    ]);

    function on(target, event, handler) {
      target.addEventListener(event, handler);
      listeners.push(function () { target.removeEventListener(event, handler); });
    }
    function cancelMotion() {
      animations.forEach(function (animation) { animation.cancel(); });
      animations = [];
    }
    function updateControls() {
      controls.hidden = !frames.length;
      previous.disabled = !frames.length || index === 0;
      next.disabled = !frames.length || index === frames.length - 1;
      play.disabled = frames.length < 2 || reduced.matches || offscreen || printing || document.hidden;
      play.textContent = timer ? 'Pause' : index === frames.length - 1 && frames.length > 1 ? 'Replay steps' : 'Play steps';
      play.setAttribute('aria-pressed', String(!!timer));
      motionHint.hidden = !reduced.matches;
      count.textContent = frames.length ? 'Step ' + (index + 1) + ' of ' + frames.length : '';
      Array.from(steps.children).forEach(function (button, n) {
        if (n === index) button.setAttribute('aria-current', 'step');
        else button.removeAttribute('aria-current');
      });
    }
    function stop() {
      if (timer !== null) window.clearInterval(timer);
      timer = null;
      updateControls();
    }
    function sync(container, data, cache, create, update, keyFor) {
      var keep = new Set();
      data.forEach(function (entry, n) {
        var key = keyFor ? keyFor(entry, n) : text(entry.label) + ':' + n;
        var node = cache.get(key);
        if (!node) { node = create(entry, n); cache.set(key, node); }
        update(node, entry, n);
        if (container.children[n] !== node) container.insertBefore(node, container.children[n] || null);
        keep.add(node);
      });
      Array.from(container.children).forEach(function (node) { if (!keep.has(node)) node.remove(); });
    }
    function renderLanes(data) {
      var before = new Map();
      itemNodes.forEach(function (node, id) { if (node.isConnected) before.set(id, node.getBoundingClientRect()); });
      cancelMotion();
      var activeItems = new Set();
      sync(lanes, data, laneNodes, function () {
        return LF.el('section', { class: 'pj-trace-lane' }, [LF.el('h4'), LF.el('div', { class: 'pj-trace-items' })]);
      }, function (node, lane) {
        node.setAttribute('data-lane-id', text(lane.id));
        node.children[0].textContent = text(lane.label);
        var list = node.children[1];
        (lane.items || []).forEach(function (item, n) {
          var id = text(item.id);
          var card = itemNodes.get(id);
          if (!card) {
            card = LF.el('article', { class: 'pj-trace-item', 'data-item-id': id }, [LF.el('strong'), LF.el('span', { class: 'pj-trace-value' }), LF.el('p')]);
            itemNodes.set(id, card);
          }
          card.setAttribute('data-tone', tone(item.tone));
          card.children[0].textContent = text(item.label);
          card.children[1].textContent = text(item.value);
          card.children[1].hidden = item.value == null;
          card.children[2].textContent = text(item.detail);
          card.children[2].hidden = !item.detail;
          if (list.children[n] !== card) list.insertBefore(card, list.children[n] || null);
          activeItems.add(id);
        });
      }, function (lane) { return text(lane.id); });
      itemNodes.forEach(function (node, id) {
        if (!activeItems.has(id)) { node.remove(); return; }
        if (reduced.matches || offscreen || printing || document.hidden || typeof node.animate !== 'function') return;
        var old = before.get(id);
        var now = node.getBoundingClientRect();
        var keyframes = old
          ? [{ transform: 'translate(' + (old.left - now.left) + 'px,' + (old.top - now.top) + 'px)' }, { transform: 'translate(0,0)' }]
          : [{ opacity: 0 }, { opacity: 1 }];
        if (!old || old.left !== now.left || old.top !== now.top) {
          animations.push(node.animate(keyframes, { duration: 240, easing: LF.motion && LF.motion.easeOut || 'cubic-bezier(0.23,1,0.32,1)' }));
        }
      });
      lanes.hidden = !data.length;
    }
    function render(result) {
      state.hidden = false;
      label.textContent = text(result.label);
      label.hidden = !result.label;
      explanation.textContent = text(result.explanation);
      explanation.hidden = !result.explanation;
      summary.textContent = text(result.summary);
      summary.hidden = !result.summary;
      formula.textContent = text(result.formula);
      formula.hidden = !result.formula;
      var laneData = result.lanes || [];
      renderLanes(laneData);
      var names = new Map();
      laneData.forEach(function (lane) { (lane.items || []).forEach(function (item) { names.set(text(item.id), text(item.label)); }); });
      links.replaceChildren();
      (result.links || []).forEach(function (link) {
        function endpoint(id) {
          var name = names.get(text(id));
          return name && name !== text(id) ? name + ' (' + text(id) + ')' : text(id);
        }
        links.appendChild(LF.el('li', { 'data-tone': tone(link.tone) }, [
          LF.el('strong', {}, [endpoint(link.from)]), ' → ', LF.el('strong', {}, [endpoint(link.to)]), ': ' + text(link.label)
        ]));
      });
      links.hidden = !links.children.length;
      sync(metrics, result.metrics || [], metricNodes, function () { return LF.el('div', {}, [LF.el('dt'), LF.el('dd')]); }, function (node, metric) {
        node.children[0].textContent = text(metric.label);
        node.children[1].textContent = text(metric.value);
      });
      metrics.hidden = !metrics.children.length;
      var bars = (result.bars || []).filter(function (bar) { return Number.isFinite(bar.value); });
      sync(chart, bars, barNodes, function () {
        return LF.el('div', { class: 'pj-lab-bar' }, [LF.el('div', { class: 'pj-lab-bar-label' }, [LF.el('span'), LF.el('output')]), LF.el('div', { class: 'pj-lab-track', role: 'meter' }, [LF.el('span')])]);
      }, function (node, bar) {
        var declaredMaximum = bar.max == null ? NaN : Number(bar.max);
        var maximum = Number.isFinite(declaredMaximum) && declaredMaximum >= 0 ? declaredMaximum : Math.max(Math.abs(bar.value), 1);
        var unit = bar.unit ? ' ' + bar.unit : '';
        var value = String(Math.round(bar.value * 1000) / 1000);
        var description = value + unit + ' / ' + maximum + unit;
        node.children[0].children[0].textContent = text(bar.label);
        node.children[0].children[1].textContent = description;
        var track = node.children[1];
        track.setAttribute('aria-label', text(bar.label));
        track.setAttribute('aria-valuemin', bar.value < 0 ? -maximum : 0);
        track.setAttribute('aria-valuemax', maximum);
        track.setAttribute('aria-valuenow', Math.max(-maximum, Math.min(maximum, bar.value)));
        track.setAttribute('aria-valuetext', description);
        var fraction = maximum === 0 ? 0 : Math.min(1, Math.abs(bar.value) / maximum);
        track.children[0].style.transform = 'scaleX(' + fraction + ')';
      });
      chart.hidden = !bars.length;
      var columns = result.columns || [];
      while (tableHead.children.length > columns.length) tableHead.lastChild.remove();
      columns.forEach(function (column, n) {
        if (!tableHead.children[n]) tableHead.appendChild(LF.el('th', { scope: 'col' }));
        tableHead.children[n].textContent = text(column);
      });
      sync(tableBody, result.rows || [], rowNodes, function () { return LF.el('tr'); }, function (node, row) {
        while (node.children.length > row.length) node.lastChild.remove();
        row.forEach(function (cell, n) {
          if (!node.children[n]) node.appendChild(LF.el('td'));
          node.children[n].textContent = text(cell);
        });
      }, function (_, n) { return n; });
      tableHost.hidden = !columns.length;
      receipt.hidden = !result.receipt;
      receiptBody.textContent = result.receipt ? JSON.stringify(result.receipt, null, 2) : '';
    }
    function showFrame(n, announce) {
      index = n;
      render(frames[index]);
      updateControls();
      if (steps.scrollWidth > steps.clientWidth) {
        var stripBounds = steps.getBoundingClientRect();
        var activeBounds = steps.children[index].getBoundingClientRect();
        if (activeBounds.left < stripBounds.left) steps.scrollLeft += activeBounds.left - stripBounds.left;
        else if (activeBounds.right > stripBounds.right) steps.scrollLeft += activeBounds.right - stripBounds.right;
      }
      if (announce) {
        message.setAttribute('data-announcement', 'true');
        message.textContent = 'Step ' + (index + 1) + ': ' + text(frames[index].label) + '. ' + text(frames[index].explanation);
      }
    }
    function select(n) { stop(); showFrame(n, true); }
    function read(control, input) {
      if (control.type === 'checkbox') return input.checked;
      if (!control.type || control.type === 'range' || control.type === 'number') {
        if (input.value.trim() === '') throw new Error(control.label + ' needs a number.');
        var n = Number(input.value);
        if (!Number.isFinite(n)) throw new Error(control.label + ' needs a finite number.');
        if (control.min !== undefined && n < control.min || control.max !== undefined && n > control.max) throw new Error(control.label + ' is outside the declared range.');
        return n;
      }
      return input.value;
    }
    function validateTrace(trace) {
      trace.forEach(function (frame) {
        if (!frame || !frame.label || !frame.explanation) throw new Error('Each computation step needs a label and explanation.');
        var ids = new Set();
        var laneIds = new Set();
        (frame.lanes || []).forEach(function (lane) {
          if (!lane.id || laneIds.has(text(lane.id))) throw new Error('Each lane needs a unique identity.');
          laneIds.add(text(lane.id));
          (lane.items || []).forEach(function (item) {
            if (!item.id || ids.has(text(item.id))) throw new Error('Each record needs a unique identity.');
            ids.add(text(item.id));
          });
        });
        (frame.links || []).forEach(function (link) {
          if (!ids.has(text(link.from)) || !ids.has(text(link.to))) throw new Error('A connection must identify two records in this step.');
        });
      });
    }
    function draw() {
      if (disposed) return;
      stop();
      cancelMotion();
      var current = ++revision;
      frames = [];
      index = 0;
      steps.replaceChildren();
      updateControls();
      state.hidden = true;
      message.textContent = 'Computing the state…';
      message.removeAttribute('data-error');
      message.removeAttribute('data-announcement');
      root.setAttribute('aria-busy', 'true');
      function failed(error) {
        if (disposed || current !== revision) return;
        frames = [];
        steps.replaceChildren();
        updateControls();
        state.hidden = true;
        message.textContent = 'Check the input: ' + error.message;
        message.setAttribute('data-error', 'true');
        root.setAttribute('aria-busy', 'false');
      }
      function complete(result) {
        if (disposed || current !== revision) return;
        try {
          result = result || {};
          var trace = Array.isArray(result.frames) ? result.frames : [];
          validateTrace(trace);
          frames = trace;
          steps.replaceChildren();
          frames.forEach(function (frame, n) {
            var button = LF.el('button', { type: 'button', class: 'pj-chip', 'data-frame': n }, [String(n + 1) + '. ' + text(frame.label)]);
            steps.appendChild(button);
          });
          if (frames.length) showFrame(0, false);
          else render(result);
          message.textContent = '';
          root.setAttribute('aria-busy', 'false');
          updateControls();
        } catch (error) { failed(error); }
      }
      try {
        var values = {};
        inputs.forEach(function (field) {
          var value = read(field.control, field.input);
          values[field.control.key] = value;
          field.output.textContent = text(value) + (field.control.unit ? ' ' + field.control.unit : '');
          if (field.control.type === 'range') field.input.setAttribute('aria-valuetext', field.output.textContent);
        });
        var result = config.calculate(values, step ? step() : 0);
        if (result && typeof result.then === 'function') Promise.resolve(result).then(complete, failed);
        else complete(result);
      } catch (error) { failed(error); }
    }
    function apply(values) {
      inputs.forEach(function (field) {
        var value = Object.prototype.hasOwnProperty.call(values, field.control.key) ? values[field.control.key] : field.control.value;
        field.input.value = text(value);
        if (field.control.type === 'checkbox') field.input.checked = !!value;
      });
      draw();
    }
    (config.controls || []).forEach(function (control) {
      var id = 'pj-lab-' + (++serial);
      var input;
      if (control.type === 'select') {
        input = LF.el('select', { id: id }, (control.options || []).map(function (option) { return LF.el('option', { value: option.value }, [text(option.label)]); }));
      } else {
        var attrs = { id: id, type: control.type || 'number' };
        ['min', 'max', 'step'].forEach(function (key) { if (control[key] !== undefined) attrs[key] = control[key]; });
        input = LF.el('input', attrs);
      }
      input.value = text(control.value);
      if (control.type === 'checkbox') input.checked = !!control.value;
      var output = LF.el('output', { for: id });
      output.hidden = control.type !== 'range';
      inputs.push({ control: control, input: input, output: output });
      on(input, control.type === 'select' || control.type === 'checkbox' ? 'change' : 'input', draw);
      form.appendChild(LF.el('div', { class: 'pj-lab-field' }, [LF.el('label', { for: id }, [control.label]), input, output]));
    });
    (config.scenarios || []).forEach(function (scenario) {
      var button = LF.el('button', { type: 'button', class: 'pj-chip' }, [text(scenario.label)]);
      on(button, 'click', function () { apply(scenario.values || {}); });
      presets.appendChild(button);
    });
    presets.hidden = !presets.children.length;
    on(reset, 'click', function () { apply({}); });
    on(previous, 'click', function () { if (index > 0) select(index - 1); });
    on(next, 'click', function () { if (index + 1 < frames.length) select(index + 1); });
    on(steps, 'click', function (event) {
      var button = event.target.closest('[data-frame]');
      if (button && steps.contains(button)) select(Number(button.getAttribute('data-frame')));
    });
    on(play, 'click', function () {
      if (timer !== null) return stop();
      if (play.disabled || !root.isConnected) return;
      if (index === frames.length - 1) showFrame(0, true);
      timer = window.setInterval(function () {
        if (!root.isConnected) return dispose();
        if (document.hidden || reduced.matches || offscreen || printing) return stop();
        showFrame(index + 1, true);
        if (index === frames.length - 1) stop();
      }, 1800);
      updateControls();
    });
    function pauseMotion() { stop(); cancelMotion(); }
    on(document, 'visibilitychange', pauseMotion);
    on(window, 'beforeprint', function () { printing = true; pauseMotion(); });
    on(window, 'afterprint', function () { printing = false; updateControls(); });
    if (reduced.addEventListener) on(reduced, 'change', pauseMotion);
    else if (reduced.addListener) {
      reduced.addListener(pauseMotion);
      listeners.push(function () { reduced.removeListener(pauseMotion); });
    }
    if (window.IntersectionObserver) {
      var visibility = new window.IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.target !== root) return;
          offscreen = !entry.isIntersecting;
          if (offscreen) pauseMotion();
          else updateControls();
        });
      }, { threshold: 0.02 });
      visibility.observe(root);
      observers.push(visibility);
    }
    if (window.MutationObserver) {
      var detached = new window.MutationObserver(function () { if (!root.isConnected) dispose(); });
      detached.observe(document.body, { childList: true, subtree: true });
      observers.push(detached);
    }
    function dispose() {
      if (disposed) return;
      disposed = true;
      revision++;
      pauseMotion();
      listeners.forEach(function (remove) { remove(); });
      observers.forEach(function (observer) { observer.disconnect(); });
      listeners = [];
      observers = [];
    }
    host.appendChild(root);
    var figure = host.closest('.lesson-figure');
    if (figure && LF.registerDisposer) LF.registerDisposer(figure, dispose);
    draw.dispose = dispose;
    draw();
    return draw;
  }

  function register(id, config) {
    var providers = {};
    providers[id] = function (host) {
      var LF = window.LF;
      var body = LF.el('div', { class: 'lf-body' });
      host.appendChild(LF.el('div', { class: 'lf' }, [
        LF.el('div', { class: 'lf-head' }, [LF.el('span', { class: 'lf-label' }, [config.title || id])]), body,
        LF.el('div', { class: 'lf-cap' }, [config.caption || 'Inspect the result and explain which input caused it.'])
      ]));
      if ((config.steps || []).length) {
        body.appendChild(LF.el('details', { class: 'pj-method' }, [LF.el('summary', {}, ['Method at a glance']), LF.el('ol', {}, config.steps.map(function (step) {
          return LF.el('li', {}, [LF.el('strong', {}, [text(step.label) + '. ']), text(step.detail)]);
        }))]));
      }
      if (config.lab && typeof config.lab.calculate === 'function') {
        var draw = lab(body, config.lab);
        return draw.dispose;
      }
    };
    window.LF.register(providers);
  }
  window.AIFSProjectFigures = { register: register, mountLab: lab };
}());
