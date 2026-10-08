(function () {
  'use strict';

  var root = document.documentElement;
  var reducedQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  var theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  try {
    var stored = localStorage.getItem('theme');
    if (stored === 'light' || stored === 'dark') theme = stored;
  } catch (_) {}
  root.setAttribute('data-theme', theme);

  function putText(node, text) {
    if (node.textContent !== text) node.textContent = text;
  }

  function vector(values) {
    return '(' + values.map(function (value) { return value.toFixed(2); }).join(', ') + ')';
  }

  function metricRenderer(section, kind) {
    var fields = {};
    section.querySelectorAll('[data-metric]').forEach(function (node) { fields[node.getAttribute('data-metric')] = node; });
    var rate = section.querySelector('[data-parameter="learningRate"]');
    var temperature = section.querySelector('[data-parameter="temperature"]');
    var tokenButtons = Array.from(section.querySelectorAll('[data-token]'));
    var weights = Array.from(section.querySelectorAll('[data-weight]'));
    var bars = Array.from(section.querySelectorAll('[data-weight-bar]'));
    var queries = Array.from(section.querySelectorAll('[data-query]'));
    var keys = Array.from(section.querySelectorAll('[data-key]'));
    var values = Array.from(section.querySelectorAll('[data-value]'));
    var selectedToken = null;
    var matricesReady = false;

    return function (metrics) {
      if (!metrics) return;
      if (kind === 'signal') {
        putText(fields.loss, metrics.loss.toFixed(4));
        putText(fields.step, String(metrics.step));
        putText(fields.weights, vector([metrics.w1, metrics.w2]));
        if (rate.value !== String(metrics.learningRate)) rate.value = String(metrics.learningRate);
        return;
      }
      if (selectedToken !== metrics.tokenIndex) {
        tokenButtons.forEach(function (button, index) { button.setAttribute('aria-pressed', String(index === metrics.tokenIndex)); });
        selectedToken = metrics.tokenIndex;
      }
      if (temperature.value !== String(metrics.temperature)) temperature.value = String(metrics.temperature);
      metrics.weights.forEach(function (weight, index) {
        putText(weights[index], weight.toFixed(3));
        var width = (weight * 100).toFixed(2) + '%';
        if (bars[index].style.width !== width) bars[index].style.width = width;
      });
      putText(fields.weightSum, metrics.weights.reduce(function (sum, weight) { return sum + weight; }, 0).toFixed(3));
      putText(fields.output, vector(metrics.output));
      if (!matricesReady) {
        metrics.queries.forEach(function (query, index) {
          putText(queries[index], vector(query));
          putText(keys[index], vector(metrics.keys[index]));
          putText(values[index], vector(metrics.values[index]));
        });
        matricesReady = true;
      }
    };
  }

  function init() {
    var themeButton = document.getElementById('preview-theme');
    var themeLabel = themeButton.querySelector('[data-theme-label]');
    var reducedToggle = document.getElementById('preview-reduced');
    var motionNote = document.getElementById('preview-motion-note');
    var userReduced = false;
    var controllers = [];

    function updateTheme() {
      var next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      putText(themeLabel, next === 'dark' ? 'Dark theme' : 'Light theme');
      themeButton.setAttribute('aria-label', 'Switch to ' + next + ' theme');
    }

    themeButton.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('theme', next); } catch (_) {}
      updateTheme();
    });
    updateTheme();

    function syncReduced() {
      var reduced = reducedQuery.matches || userReduced;
      reducedToggle.checked = reduced;
      reducedToggle.disabled = reducedQuery.matches;
      root.setAttribute('data-preview-reduced', String(reduced));
      if (reducedQuery.matches) {
        putText(motionNote, 'System preference: still frames. Use Next step.');
      } else if (reduced) {
        putText(motionNote, 'Still frames. Change an input or use Next step.');
      } else {
        putText(motionNote, 'Pause or use Next step to inspect the computation.');
      }
      controllers.forEach(function (controller) { controller.setReducedMotion(reduced); });
    }

    reducedToggle.addEventListener('change', function () {
      userReduced = reducedToggle.checked;
      syncReduced();
    });
    if (reducedQuery.addEventListener) reducedQuery.addEventListener('change', syncReduced);
    else reducedQuery.addListener(syncReduced);

    if (window.AsciiMotion) {
      document.querySelectorAll('[data-study]').forEach(function (section) {
        var kind = section.getAttribute('data-study');
        var title = section.querySelector('h2').textContent;
        var host = section.querySelector('[data-motion-host]');
        var toolbar = section.querySelector('[data-study-controls]');
        var playButton = section.querySelector('[data-action="play"]');
        var replayButton = section.querySelector('[data-action="replay"]');
        var stepButton = section.querySelector('[data-action="step"]');
        var speed = section.querySelector('[data-study-speed]');
        var status = section.querySelector('[data-study-status]');
        var renderMetrics = metricRenderer(section, kind);
        var controlsSignature = '';

        function render(state) {
          renderMetrics(state.metrics);
          var signature = [state.playing, state.reduced, state.complete, state.destroyed, state.speed, state.suspended].join(':');
          if (signature === controlsSignature) return;
          controlsSignature = signature;
          putText(playButton, state.playing ? 'Pause' : 'Play');
          playButton.setAttribute('aria-label', (state.playing ? 'Pause ' : 'Play ') + title);
          playButton.disabled = state.reduced || state.complete || state.destroyed;
          replayButton.disabled = state.destroyed;
          stepButton.disabled = state.complete || state.destroyed;
          speed.disabled = state.reduced || state.destroyed;
          speed.value = String(state.speed);
          var label = 'Paused';
          if (state.complete) label = 'Settled';
          else if (state.reduced) label = 'Still';
          else if (state.playing) label = 'Playing';
          else if (state.suspended) label = 'Offscreen';
          putText(status, label);
        }

        host.addEventListener('ascii-motion-change', function (event) { render(event.detail); });
        var controller = window.AsciiMotion.mount(host, { kind: kind });
        controllers.push(controller);
        playButton.addEventListener('click', function () {
          if (controller.getState().playing) controller.pause();
          else controller.play();
        });
        replayButton.addEventListener('click', function () { controller.replay(); });
        stepButton.addEventListener('click', function () { controller.step(); });
        speed.addEventListener('change', function () { controller.setSpeed(Number(speed.value)); });
        section.querySelectorAll('[data-parameter]').forEach(function (input) {
          input.disabled = false;
          input.addEventListener('change', function () { controller.setParameter(input.getAttribute('data-parameter'), Number(input.value)); });
        });
        section.querySelectorAll('[data-token]').forEach(function (button) {
          button.disabled = false;
          button.addEventListener('click', function () { controller.setParameter('token', Number(button.getAttribute('data-token'))); });
        });
        toolbar.hidden = false;
        render(controller.getState());
      });
    }
    syncReduced();

    window.addEventListener('pagehide', function (event) {
      if (event.persisted) return;
      controllers.forEach(function (controller) { controller.destroy(); });
      if (reducedQuery.removeEventListener) reducedQuery.removeEventListener('change', syncReduced);
      else reducedQuery.removeListener(syncReduced);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
