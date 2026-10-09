(function () {
  'use strict';

  var instances = new WeakMap();
  var active = new Set();
  var scheduled = null;

  function schedule() {
    if (active.size && scheduled === null) scheduled = window.requestAnimationFrame(tickAll);
  }

  function tickAll(now) {
    scheduled = null;
    active.forEach(function (controller) { controller.tick(now); });
    schedule();
  }

  function stop(controller) {
    active.delete(controller);
    if (!active.size && scheduled !== null) {
      window.cancelAnimationFrame(scheduled);
      scheduled = null;
    }
  }

  function mount(host, options) {
    options = options || {};
    var kind = options.kind || 'signal';
    var pieces = window.CourseMotionPieces;
    if (!host || !host.appendChild || !pieces || !Object.prototype.hasOwnProperty.call(pieces, kind)) {
      throw new Error('A valid animation host and locally loaded lesson visualization are required');
    }
    if (!window.AsciiRestCanvas) throw new Error('The local ascii.rest canvas renderer is required');
    if (instances.has(host)) instances.get(host).destroy();
    while (host.firstChild) host.removeChild(host.firstChild);
    host.classList.add('ascii-motion');
    host.setAttribute('data-kind', kind);
    var piece = pieces[kind];
    var canvas = document.createElement('canvas');
    canvas.className = 'ascii-motion-art';
    canvas.setAttribute('aria-hidden', 'true');
    host.appendChild(canvas);
    var painter = window.AsciiRestCanvas.create(canvas, piece.meta);
    var frame = piece.create();
    var color = piece.meta.palette ? new Uint8Array(piece.meta.cols * piece.meta.rows) : undefined;
    var parameters = {};
    var text = '';
    var interval = 1000 / Math.min(20, piece.meta.fps || 20);
    var media = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    var forcedReduced = !!options.reducedMotion;
    var reduced = forcedReduced || !!(media && media.matches);
    var elapsed = 0;
    var paintedElapsed = 0;
    var speed = 1;
    var requested = !reduced;
    var visible = typeof window.IntersectionObserver !== 'function';
    var hidden = !!document.hidden;
    var destroyed = false;
    var previousTime = null;
    var lastDraw = -Infinity;
    var observer = null;
    var published = '';
    var publishedMetrics = '';
    var lastMetricEvent = -Infinity;
    var record = { tick: tick };

    function getState() {
      var metrics = frame.getMetrics();
      return {
        kind: kind, elapsed: elapsed, metrics: metrics,
        playing: active.has(record), reduced: reduced, complete: !!metrics.done,
        speed: speed, suspended: !visible || hidden, destroyed: destroyed
      };
    }

    function publish(force) {
      var state = getState();
      var signature = [state.playing, state.reduced, state.speed, state.suspended, state.destroyed, state.complete].join(':');
      var metrics = JSON.stringify(state.metrics);
      var metricDue = metrics !== publishedMetrics && performance.now() - lastMetricEvent >= 200;
      if (!force && signature === published && !metricDue) return;
      published = signature;
      publishedMetrics = metrics;
      lastMetricEvent = performance.now();
      host.dispatchEvent(new CustomEvent('ascii-motion-change', { bubbles: true, detail: state }));
    }

    function updateHost() {
      host.setAttribute('data-playing', active.has(record) ? 'true' : 'false');
      host.setAttribute('data-reduced', reduced ? 'true' : 'false');
    }

    function draw() {
      text = frame(elapsed / 1000, { color: color });
      painter.draw(text, color);
      paintedElapsed = elapsed;
      lastDraw = performance.now();
      if (frame.getMetrics().done) {
        requested = false;
        stop(record);
        previousTime = null;
      }
      updateHost();
    }

    function canPlay() { return !destroyed && requested && !reduced && visible && !hidden; }

    function advance(now) {
      if (previousTime !== null) elapsed += Math.min(100, Math.max(0, now - previousTime)) * speed;
      previousTime = now;
    }

    function sync(force, redraw) {
      if (canPlay() && !active.has(record)) {
        previousTime = performance.now();
        active.add(record);
        schedule();
      } else if (!canPlay()) {
        stop(record);
        previousTime = null;
      }
      updateHost();
      if (redraw) draw();
      publish(force);
    }

    function tick(now) {
      if (destroyed) return;
      advance(now);
      if (now - lastDraw >= interval - 0.1) {
        draw();
        publish(false);
      }
    }

    function pause() {
      if (destroyed) return getState();
      if (active.has(record)) advance(performance.now());
      requested = false;
      sync(false, false);
      return getState();
    }

    function play() {
      if (destroyed || reduced || frame.getMetrics().done) return getState();
      requested = true;
      sync(false, false);
      return getState();
    }

    function resetFrame() {
      stop(record);
      previousTime = null;
      elapsed = 0;
      frame = piece.create();
      Object.keys(parameters).forEach(function (name) { frame[parameterMethod(name)](parameters[name]); });
    }

    function replay() {
      if (destroyed) return getState();
      resetFrame();
      requested = !reduced;
      sync(true, true);
      return getState();
    }

    function step() {
      if (destroyed || frame.getMetrics().done) return getState();
      stop(record);
      previousTime = null;
      requested = false;
      elapsed = paintedElapsed + 125;
      sync(true, true);
      return getState();
    }

    function parameterMethod(name) {
      var methods = { learningRate: 'setLearningRate', token: 'setToken', temperature: 'setTemperature' };
      if (!Object.prototype.hasOwnProperty.call(methods, name) || typeof frame[methods[name]] !== 'function') {
        throw new Error('Unsupported lesson parameter: ' + name);
      }
      return methods[name];
    }

    function setParameter(name, value) {
      if (destroyed) return getState();
      var complete = !!frame.getMetrics().done;
      frame[parameterMethod(name)](value);
      parameters[name] = value;
      resetFrame();
      if (complete) requested = !reduced;
      sync(true, true);
      return getState();
    }

    function setSpeed(value) {
      if (destroyed) return getState();
      value = Number(value);
      if ([0.25, 0.5, 1].indexOf(value) === -1) throw new Error('Speed must be 0.25, 0.5, or 1');
      if (active.has(record)) advance(performance.now());
      speed = value;
      sync(false, false);
      return getState();
    }

    function updateReduction() {
      var next = forcedReduced || !!(media && media.matches);
      if (next === reduced || destroyed) return;
      reduced = next;
      if (reduced) requested = false;
      sync(false, false);
    }

    function setReducedMotion(value) {
      if (destroyed) return getState();
      forcedReduced = !!value;
      updateReduction();
      return getState();
    }

    function onVisibility() {
      hidden = !!document.hidden;
      sync(false, false);
    }

    function destroy() {
      if (destroyed) return;
      destroyed = true;
      requested = false;
      stop(record);
      document.removeEventListener('visibilitychange', onVisibility);
      if (media && media.removeEventListener) media.removeEventListener('change', updateReduction);
      else if (media && media.removeListener) media.removeListener(updateReduction);
      if (observer) observer.disconnect();
      painter.destroy();
      if (canvas.parentNode === host) host.removeChild(canvas);
      host.classList.remove('ascii-motion');
      ['data-kind', 'data-playing', 'data-reduced'].forEach(function (name) { host.removeAttribute(name); });
      instances.delete(host);
      publish(true);
    }

    var controller = {
      play: play, pause: pause, replay: replay, step: step, setSpeed: setSpeed,
      destroy: destroy, getState: getState, setReducedMotion: setReducedMotion, setParameter: setParameter
    };
    instances.set(host, controller);
    document.addEventListener('visibilitychange', onVisibility);
    if (media && media.addEventListener) media.addEventListener('change', updateReduction);
    else if (media && media.addListener) media.addListener(updateReduction);
    if (typeof window.IntersectionObserver === 'function') {
      observer = new window.IntersectionObserver(function (entries) {
        if (destroyed) return;
        entries.forEach(function (entry) { if (entry.target === host) visible = entry.isIntersecting; });
        sync(false, false);
      }, { threshold: 0.15 });
      observer.observe(host);
    }
    sync(true, true);
    return controller;
  }

  window.AsciiMotion = { mount: mount };
})();
