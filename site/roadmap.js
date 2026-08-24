(function () {
  var root = document.documentElement;
  var storedTheme = null;
  try { storedTheme = localStorage.getItem('theme'); } catch (_) {}
  if (storedTheme) {
    root.setAttribute('data-theme', storedTheme);
  } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    root.setAttribute('data-theme', 'dark');
  } else {
    root.setAttribute('data-theme', 'light');
  }

  var PREREQS = typeof ROADMAP_PREREQS !== 'undefined' ? ROADMAP_PREREQS : null;

  var TIER_ORDER = [
    [0],
    [1],
    [2],
    [3],
    [4, 5, 6, 9],
    [7],
    [8, 10],
    [11, 12],
    [13],
    [14],
    [15, 17],
    [16, 18],
    [19]
  ];

  var STAGES = [
    { id: 'foundations', number: '01', name: 'Foundations', startTier: 0, endTier: 3, focusPhase: 0 },
    { id: 'model-disciplines', number: '02', name: 'Model disciplines', startTier: 4, endTier: 6, focusPhase: 7 },
    { id: 'engineering-systems', number: '03', name: 'Engineering systems', startTier: 7, endTier: 11, focusPhase: 11 },
    { id: 'capstone-proof', number: '04', name: 'Capstone proof', startTier: 12, endTier: 12, focusPhase: 19 }
  ];

  var NODE_W = 210;
  var NODE_H = 82;
  var TIER_GAP = 160;
  var COLUMN_GAP = 26;
  var PAD_X = 58;
  var PAD_Y = 60;
  var MAX_COLUMNS = 5;
  var SVG_W = PAD_X * 2 + MAX_COLUMNS * NODE_W + (MAX_COLUMNS - 1) * COLUMN_GAP;
  var SVG_H = PAD_Y * 2 + (TIER_ORDER.length - 1) * TIER_GAP + NODE_H;
  var MIN_ZOOM = 0.7;
  var MAX_ZOOM = 1.3;

  var phaseMap = {};
  var children = {};
  var positions = {};
  var phaseProgress = {};
  var nodeEls = {};
  var edgeEls = [];
  var edgeElsByKey = {};
  var routeNodeStates = {};
  var routeEdgeStates = {};
  var selectedId = null;
  var rovingId = 0;
  var zoom = window.matchMedia && window.matchMedia('(max-width: 760px)').matches ? MIN_ZOOM : 1;
  var draggedSincePointerDown = false;
  var reducedMotionQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  var prefersReducedMotion = !!(reducedMotionQuery && reducedMotionQuery.matches);
  var reducedMotionListener = null;
  var reducedMotionLifecycleBound = false;
  var inspectorAnimation = null;

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    if (typeof PHASES === 'undefined' || !Array.isArray(PHASES) || !PREREQS || !validateRoadmapData()) {
      showDataError();
      return;
    }

    buildLookups();
    computePositions();
    computeProgress();
    renderStageNavigation();
    renderJumpOptions();
    renderHeroStats();
    renderGraph();
    renderEmptyInspector();
    bindReducedMotionPreference();
    bindInteractions();
    updateThemeIcon();

    if (window.AIFSProgress && typeof window.AIFSProgress.onChange === 'function') {
      window.AIFSProgress.onChange(refreshProgress);
    }

    requestAnimationFrame(function () {
      restoreSelectionFromUrl(false);
      if (selectedId === null) centerPhase(0, false);
    });
  }

  function validateRoadmapData() {
    var validIds = {};
    var tierByPhase = {};
    var adjacency = {};
    var roots = [];
    for (var i = 0; i < PHASES.length; i++) {
      validIds[PHASES[i].id] = true;
      adjacency[PHASES[i].id] = [];
    }

    for (var tierIndex = 0; tierIndex < TIER_ORDER.length; tierIndex++) {
      for (var columnIndex = 0; columnIndex < TIER_ORDER[tierIndex].length; columnIndex++) {
        var phaseId = TIER_ORDER[tierIndex][columnIndex];
        if (!validIds[phaseId] || phaseId in tierByPhase) return false;
        tierByPhase[phaseId] = tierIndex;
      }
    }

    for (var graphId in PREREQS) {
      if (!validIds[graphId] || !Array.isArray(PREREQS[graphId])) return false;
    }

    var seenEdges = {};
    for (var id in validIds) {
      if (!(id in tierByPhase) || !Array.isArray(PREREQS[id])) return false;
      if (PREREQS[id].length === 0) roots.push(parseInt(id, 10));
      for (var r = 0; r < PREREQS[id].length; r++) {
        var parentId = PREREQS[id][r];
        if (!validIds[parentId] || parentId === parseInt(id, 10)) return false;
        var edgeKey = parentId + '-' + id;
        if (seenEdges[edgeKey]) return false;
        seenEdges[edgeKey] = true;
        if (tierByPhase[parentId] >= tierByPhase[id]) return false;
        adjacency[parentId].push(parseInt(id, 10));
      }
    }

    if (roots.length !== 1 || roots[0] !== 0) return false;
    var reached = { 0: true };
    var queue = [0];
    while (queue.length) {
      var current = queue.shift();
      for (var childIndex = 0; childIndex < adjacency[current].length; childIndex++) {
        var childId = adjacency[current][childIndex];
        if (reached[childId]) continue;
        reached[childId] = true;
        queue.push(childId);
      }
    }
    return Object.keys(reached).length === PHASES.length;
  }

  function buildLookups() {
    for (var i = 0; i < PHASES.length; i++) {
      var phase = PHASES[i];
      phaseMap[phase.id] = phase;
      children[phase.id] = [];
      if (!(phase.id in PREREQS)) PREREQS[phase.id] = [];
    }

    for (var phaseId in PREREQS) {
      var requirements = PREREQS[phaseId];
      for (var j = 0; j < requirements.length; j++) {
        var parentId = requirements[j];
        if (!children[parentId]) children[parentId] = [];
        children[parentId].push(parseInt(phaseId, 10));
      }
    }
  }

  function computePositions() {
    positions = {};
    for (var tierIndex = 0; tierIndex < TIER_ORDER.length; tierIndex++) {
      var tier = TIER_ORDER[tierIndex];
      var totalWidth = tier.length * NODE_W + (tier.length - 1) * COLUMN_GAP;
      var startX = (SVG_W - totalWidth) / 2;
      var y = PAD_Y + tierIndex * TIER_GAP;
      for (var columnIndex = 0; columnIndex < tier.length; columnIndex++) {
        positions[tier[columnIndex]] = { x: startX + columnIndex * (NODE_W + COLUMN_GAP), y: y, tier: tierIndex };
      }
    }

  }

  function computeProgress() {
    phaseProgress = {};
    for (var i = 0; i < PHASES.length; i++) {
      var phase = PHASES[i];
      var lessons = Array.isArray(phase.lessons) ? phase.lessons : [];
      var urls = [];
      for (var j = 0; j < lessons.length; j++) {
        if (lessons[j].url) urls.push(lessons[j].url);
      }
      var done = 0;
      if (window.AIFSProgress && typeof window.AIFSProgress.countCompletedFromUrls === 'function') {
        done = window.AIFSProgress.countCompletedFromUrls(urls);
      }
      phaseProgress[phase.id] = {
        done: done,
        total: lessons.length,
        percent: lessons.length ? Math.round((done / lessons.length) * 100) : 0
      };
    }
  }

  function renderStageNavigation() {
    var nav = document.getElementById('roadmapStageNav');
    if (!nav) return;
    var html = '';
    for (var i = 0; i < STAGES.length; i++) {
      var stage = STAGES[i];
      html += '<button class="roadmap-stage-jump" type="button" data-stage-target="' + stage.id + '">' +
        '<span>Zone ' + stage.number + '</span><strong>' + escapeHtml(stage.name) + '</strong>' +
      '</button>';
    }
    nav.innerHTML = html;
  }

  function renderJumpOptions() {
    var select = document.getElementById('roadmapJump');
    if (!select) return;
    var html = '<option value="">Jump to a phase</option>';
    for (var i = 0; i < PHASES.length; i++) {
      var phase = PHASES[i];
      html += '<option value="' + phase.id + '">' + formatPhase(phase.id) + ' · ' + escapeHtml(phase.name) + '</option>';
    }
    select.innerHTML = html;
  }

  function renderHeroStats() {
    var totalLessons = 0;
    var completedLessons = 0;
    for (var i = 0; i < PHASES.length; i++) {
      var stats = phaseProgress[PHASES[i].id];
      totalLessons += stats.total;
      completedLessons += stats.done;
    }
    setText('roadmapPhaseCount', String(PHASES.length));
    setText('roadmapLessonCount', String(totalLessons));
    setText('roadmapProgressCount', completedLessons + ' / ' + totalLessons);
    var recommendation = recommendedPhase();
    setText('roadmapNextPhase', recommendation ? 'Phase ' + formatPhase(recommendation.id) : 'Complete');
  }

  function renderGraph() {
    var svg = document.getElementById('roadmapGraph');
    if (!svg) return;
    svg.textContent = '';
    nodeEls = {};
    edgeEls = [];
    edgeElsByKey = {};
    routeNodeStates = {};
    routeEdgeStates = {};

    svg.setAttribute('viewBox', '0 0 ' + SVG_W + ' ' + SVG_H);
    svg.setAttribute('aria-labelledby', 'learningMapTitle roadmapKeyboardHelp');

    var stageLayer = svgEl('g', { class: 'roadmap-stage-layer', 'aria-hidden': 'true' });
    svg.appendChild(stageLayer);
    renderStageBands(stageLayer);

    var edgeLayer = svgEl('g', { class: 'roadmap-edge-layer', 'aria-hidden': 'true' });
    svg.appendChild(edgeLayer);
    for (var targetId in PREREQS) {
      var requirements = PREREQS[targetId];
      for (var r = 0; r < requirements.length; r++) {
        var fromId = requirements[r];
        if (!positions[fromId] || !positions[targetId]) continue;
        var numericTargetId = parseInt(targetId, 10);
        var path = svgEl('path', {
          class: 'roadmap-edge',
          d: edgePath(fromId, numericTargetId),
          'data-from': fromId,
          'data-to': targetId
        });
        var arrow = svgEl('polygon', {
          class: 'roadmap-edge-arrow',
          points: arrowPoints(fromId, numericTargetId),
          'data-from': fromId,
          'data-to': targetId
        });
        edgeLayer.appendChild(path);
        edgeLayer.appendChild(arrow);
        var edgeRecord = { path: path, arrow: arrow, from: parseInt(fromId, 10), to: parseInt(targetId, 10) };
        edgeEls.push(edgeRecord);
        edgeElsByKey[fromId + '-' + targetId] = edgeRecord;
      }
    }

    var nodeLayer = svgEl('g', { class: 'roadmap-node-layer' });
    svg.appendChild(nodeLayer);
    for (var i = 0; i < PHASES.length; i++) {
      var phase = PHASES[i];
      if (!positions[phase.id]) continue;
      var node = buildNode(phase);
      nodeLayer.appendChild(node);
      nodeEls[phase.id] = node;
    }

    applyZoom(zoom, false);
    setRovingFocus(rovingId, false);
    if (selectedId !== null) applyRouteHighlight(selectedId);
  }

  function bindReducedMotionPreference() {
    if (!reducedMotionQuery) return;
    if (!reducedMotionListener) {
      reducedMotionListener = function (event) {
        syncReducedMotionPreference(event.matches);
      };
      if (typeof reducedMotionQuery.addEventListener === 'function') {
        reducedMotionQuery.addEventListener('change', reducedMotionListener);
      } else if (typeof reducedMotionQuery.addListener === 'function') {
        reducedMotionQuery.addListener(reducedMotionListener);
      }
    }
    if (!reducedMotionLifecycleBound) {
      window.addEventListener('pagehide', handleRoadmapPageHide);
      window.addEventListener('pageshow', handleRoadmapPageShow);
      reducedMotionLifecycleBound = true;
    }
    syncReducedMotionPreference(reducedMotionQuery.matches);
  }

  function syncReducedMotionPreference(matches) {
    prefersReducedMotion = !!matches;
    if (!prefersReducedMotion) return;
    finishInspectorTransition();
    var wrap = document.getElementById('roadmapGraphWrap');
    if (wrap) wrap.scrollTo({ left: wrap.scrollLeft, top: wrap.scrollTop, behavior: 'auto' });
    window.scrollTo({ left: window.scrollX, top: window.scrollY, behavior: 'auto' });
  }

  function handleRoadmapPageHide(event) {
    finishInspectorTransition();
    if (!event.persisted) disposeReducedMotionPreference();
  }

  function handleRoadmapPageShow() {
    bindReducedMotionPreference();
  }

  function disposeReducedMotionPreference() {
    if (!reducedMotionQuery || !reducedMotionListener) return;
    if (typeof reducedMotionQuery.removeEventListener === 'function') {
      reducedMotionQuery.removeEventListener('change', reducedMotionListener);
    } else if (typeof reducedMotionQuery.removeListener === 'function') {
      reducedMotionQuery.removeListener(reducedMotionListener);
    }
    reducedMotionListener = null;
    finishInspectorTransition();
  }

  function renderStageBands(layer) {
    for (var i = 0; i < STAGES.length; i++) {
      var stage = STAGES[i];
      var startY = Math.max(18, PAD_Y + stage.startTier * TIER_GAP - 28);
      var endY = Math.min(SVG_H - 18, PAD_Y + stage.endTier * TIER_GAP + NODE_H + 28);
      layer.appendChild(svgEl('rect', {
        class: 'roadmap-stage-band' + (i % 2 ? ' is-alt' : ''),
        x: 18,
        y: startY,
        width: SVG_W - 36,
        height: endY - startY
      }));
      var number = svgEl('text', { class: 'roadmap-stage-band-number', x: 32, y: startY + 18 });
      number.textContent = 'ZONE ' + stage.number;
      layer.appendChild(number);
      var label = svgEl('text', { class: 'roadmap-stage-band-label', x: 90, y: startY + 18 });
      label.textContent = stage.name;
      layer.appendChild(label);
    }
  }

  function buildNode(phase) {
    var pos = positions[phase.id];
    var progress = phaseProgress[phase.id] || { done: 0, total: 0, percent: 0 };
    var state = phaseState(phase.id);
    var narration = phaseNarration(phase, state, progress);
    var group = svgEl('g', {
      class: 'roadmap-node',
      'data-phase': phase.id,
      'data-tts-read': '',
      'data-tts-section': 'Phase ' + formatPhase(phase.id) + ': ' + phase.name,
      'data-tts-label': narration,
      transform: 'translate(' + pos.x + ',' + pos.y + ')',
      tabindex: '-1',
      role: 'button',
      'aria-pressed': 'false',
      'aria-label': narration
    });

    var surface = svgEl('g', { class: 'roadmap-node-surface' });
    group.appendChild(surface);
    surface.appendChild(svgEl('rect', { class: 'roadmap-node-shadow', x: 4, y: 4, width: NODE_W, height: NODE_H }));
    surface.appendChild(svgEl('rect', { class: 'roadmap-node-card', x: 0, y: 0, width: NODE_W, height: NODE_H }));
    surface.appendChild(svgEl('rect', { class: 'roadmap-node-focus', x: -4, y: -4, width: NODE_W + 8, height: NODE_H + 8 }));

    var code = svgEl('text', { class: 'roadmap-node-code', x: 14, y: 18 });
    code.textContent = 'PHASE ' + formatPhase(phase.id);
    surface.appendChild(code);

    var stateText = svgEl('text', {
      class: 'roadmap-node-state',
      x: NODE_W - 14,
      y: 18,
      'text-anchor': 'end',
      'data-default': state.label
    });
    stateText.textContent = state.label;
    surface.appendChild(stateText);

    var lines = splitName(phase.name);
    for (var i = 0; i < lines.length; i++) {
      var title = svgEl('text', {
        class: 'roadmap-node-title',
        x: 14,
        y: lines.length === 1 ? 45 : 38 + i * 16
      });
      title.textContent = lines[i];
      surface.appendChild(title);
    }

    var meta = svgEl('text', { class: 'roadmap-node-meta', x: NODE_W - 14, y: 68, 'text-anchor': 'end' });
    meta.textContent = progress.done + '/' + progress.total + ' COMPLETE';
    surface.appendChild(meta);
    surface.appendChild(svgEl('rect', { class: 'roadmap-node-progress-track', x: 14, y: 74, width: NODE_W - 28, height: 4 }));
    surface.appendChild(svgEl('rect', {
      class: 'roadmap-node-progress-fill',
      x: 14,
      y: 74,
      width: (NODE_W - 28) * (progress.percent / 100),
      height: 4
    }));

    group.addEventListener('pointerdown', function (event) {
      event.stopPropagation();
    });
    group.addEventListener('click', function (event) {
      if (draggedSincePointerDown) {
        draggedSincePointerDown = false;
        return;
      }
      setRovingFocus(phase.id, false);
      togglePhaseSelection(phase.id, { animate: event.detail !== 0 });
    });
    group.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        togglePhaseSelection(phase.id, { animate: false });
        return;
      }
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].indexOf(event.key) !== -1) {
        event.preventDefault();
        moveNodeFocus(phase.id, event.key);
      }
    });
    group.addEventListener('focus', function () { setRovingFocus(phase.id, false); });
    return group;
  }

  function phaseNarration(phase, state, progress) {
    var requirements = (PREREQS[phase.id] || []).map(function (id) {
      return phaseMap[id] ? phaseMap[id].name : 'Phase ' + formatPhase(id);
    });
    var unlocks = (children[phase.id] || []).map(function (id) {
      return phaseMap[id] ? phaseMap[id].name : 'Phase ' + formatPhase(id);
    });
    var text = 'Phase ' + formatPhase(phase.id) + ': ' + phase.name + '. ' + state.label + '. ' +
      progress.done + ' of ' + progress.total + ' lessons completed.';
    text += requirements.length ? ' Direct prerequisites: ' + requirements.join(', ') + '.' : ' This is the starting phase.';
    text += unlocks.length ? ' Immediately unlocks: ' + unlocks.join(', ') + '.' : ' This is a final destination.';
    return text;
  }

  function splitName(name) {
    var value = String(name || '').toUpperCase();
    if (value.length <= 22) return [value];
    var midpoint = Math.ceil(value.length / 2);
    var split = value.lastIndexOf(' ', midpoint);
    if (split < 5) split = value.indexOf(' ', midpoint);
    if (split === -1) return [value.slice(0, 22) + '…'];
    return [value.slice(0, split), value.slice(split + 1)];
  }

  function edgePath(fromId, toId) {
    var edge = edgeGeometry(fromId, toId);
    var tierDistance = positions[toId].tier - positions[fromId].tier;
    if (tierDistance > 1) {
      var channelY = PAD_Y + (positions[fromId].tier + 1) * TIER_GAP - 12;
      var channelControl = Math.max(24, (channelY - edge.y1) * 0.5);
      return 'M' + edge.x1 + ' ' + edge.y1 +
        ' C' + edge.x1 + ' ' + (edge.y1 + channelControl) +
        ' ' + edge.x2 + ' ' + (channelY - channelControl) +
        ' ' + edge.x2 + ' ' + channelY +
        ' L' + edge.x2 + ' ' + edge.y2;
    }
    var control = Math.min(Math.max((edge.y2 - edge.y1) * 0.42, 32), 72);
    return 'M' + edge.x1 + ' ' + edge.y1 + ' C' + edge.x1 + ' ' + (edge.y1 + control) + ' ' + edge.x2 + ' ' + (edge.y2 - control) + ' ' + edge.x2 + ' ' + edge.y2;
  }

  function arrowPoints(fromId, toId) {
    var edge = edgeGeometry(fromId, toId);
    var x = edge.x2;
    var y = edge.y2;
    return (x - 5) + ',' + (y - 8) + ' ' + x + ',' + y + ' ' + (x + 5) + ',' + (y - 8);
  }

  function edgeGeometry(fromId, toId) {
    var from = positions[fromId];
    var to = positions[toId];
    return {
      x1: from.x + NODE_W / 2 + portOffset(children[fromId] || [], toId),
      y1: from.y + NODE_H,
      x2: to.x + NODE_W / 2 + portOffset(PREREQS[toId] || [], fromId),
      y2: to.y
    };
  }

  function portOffset(ids, activeId) {
    if (ids.length < 2) return 0;
    var sorted = ids.slice().sort(function (left, right) {
      var leftX = positions[left] ? positions[left].x : 0;
      var rightX = positions[right] ? positions[right].x : 0;
      return leftX - rightX || left - right;
    });
    var index = sorted.indexOf(activeId);
    if (index === -1) return 0;
    var step = Math.min(22, (NODE_W - 56) / (sorted.length - 1));
    return (index - (sorted.length - 1) / 2) * step;
  }

  function bindInteractions() {
    var themeButton = document.getElementById('themeToggle');
    if (themeButton) {
      themeButton.addEventListener('click', function () {
        var next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
        root.setAttribute('data-theme', next);
        try { localStorage.setItem('theme', next); } catch (_) {}
        updateThemeIcon();
      });
    }

    document.addEventListener('click', function (event) {
      var routeButton = event.target.closest('[data-route-phase]');
      if (routeButton) {
        var routeId = parseInt(routeButton.getAttribute('data-route-phase'), 10);
        var keyboardTriggered = event.detail === 0;
        selectPhase(routeId, { updateHistory: true, animate: !keyboardTriggered });
        focusPhase(routeId, true, !keyboardTriggered && !prefersReducedMotion);
        return;
      }

      var stageButton = event.target.closest('[data-stage-target]');
      if (stageButton) {
        var stage = stageById(stageButton.getAttribute('data-stage-target'));
        if (stage) {
          var animateStage = event.detail !== 0 && !prefersReducedMotion;
          if (selectedId !== null) clearSelection(true, { animate: animateStage });
          centerPhase(stage.focusPhase, animateStage);
        }
        return;
      }

      var nodeButton = event.target.closest('.roadmap-node');
      var focusControl = event.target.closest('#roadmapInspector, .roadmap-toolbar');
      if (selectedId !== null && !nodeButton && !focusControl && !draggedSincePointerDown) clearSelection(true);
    });

    var jump = document.getElementById('roadmapJump');
    if (jump) {
      jump.addEventListener('change', function () {
        if (this.value === '') return;
        var id = parseInt(this.value, 10);
        selectPhase(id, { updateHistory: true, animate: false });
        focusPhase(id, true, false);
      });
    }

    var clear = document.getElementById('roadmapClear');
    if (clear) clear.addEventListener('click', function (event) {
      clearSelection(true, { animate: event.detail !== 0 });
    });

    var zoomOut = document.getElementById('roadmapZoomOut');
    var zoomIn = document.getElementById('roadmapZoomIn');
    if (zoomOut) zoomOut.addEventListener('click', function () { applyZoom(zoom - 0.1, true); });
    if (zoomIn) zoomIn.addEventListener('click', function () { applyZoom(zoom + 0.1, true); });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && selectedId !== null) {
        var previousId = selectedId;
        clearSelection(true, { animate: false });
        focusPhase(previousId, false, false);
      }
    });

    bindGraphPanning();
    window.addEventListener('popstate', function () { restoreSelectionFromUrl(true); });
    window.addEventListener('hashchange', function () { restoreSelectionFromUrl(true); });
  }

  function bindGraphPanning() {
    var wrap = document.getElementById('roadmapGraphWrap');
    if (!wrap) return;
    var pan = null;

    wrap.addEventListener('pointerdown', function (event) {
      if (event.pointerType === 'touch' || event.button !== 0) return;
      if (event.target.closest && event.target.closest('.roadmap-node')) return;
      pan = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        left: wrap.scrollLeft,
        top: wrap.scrollTop,
        moved: false
      };
      wrap.setPointerCapture(event.pointerId);
      wrap.classList.add('is-dragging');
    });

    wrap.addEventListener('pointermove', function (event) {
      if (!pan || pan.id !== event.pointerId) return;
      var dx = event.clientX - pan.x;
      var dy = event.clientY - pan.y;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) pan.moved = true;
      if (!pan.moved) return;
      wrap.scrollLeft = pan.left - dx;
      wrap.scrollTop = pan.top - dy;
      event.preventDefault();
    });

    function finishPan(event) {
      if (!pan || pan.id !== event.pointerId) return;
      draggedSincePointerDown = pan.moved;
      pan = null;
      wrap.classList.remove('is-dragging');
      try { wrap.releasePointerCapture(event.pointerId); } catch (_) {}
      if (draggedSincePointerDown) {
        setTimeout(function () { draggedSincePointerDown = false; }, 80);
      }
    }

    wrap.addEventListener('pointerup', finishPan);
    wrap.addEventListener('pointercancel', finishPan);
  }

  function applyZoom(nextZoom, preserveCenter) {
    var svg = document.getElementById('roadmapGraph');
    var container = document.getElementById('roadmapGraphContainer');
    var wrap = document.getElementById('roadmapGraphWrap');
    if (!svg || !container || !wrap) return;

    var oldZoom = zoom;
    var centerX = (wrap.scrollLeft + wrap.clientWidth / 2) / oldZoom;
    var centerY = (wrap.scrollTop + wrap.clientHeight / 2) / oldZoom;
    zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.round(nextZoom * 10) / 10));
    var width = Math.round(SVG_W * zoom);
    var height = Math.round(SVG_H * zoom);
    svg.setAttribute('width', width);
    svg.setAttribute('height', height);
    container.style.width = Math.max(width, wrap.clientWidth) + 'px';
    container.style.height = Math.max(height, wrap.clientHeight) + 'px';
    setText('roadmapZoomValue', Math.round(zoom * 100) + '%');

    var zoomOut = document.getElementById('roadmapZoomOut');
    var zoomIn = document.getElementById('roadmapZoomIn');
    if (zoomOut) zoomOut.disabled = zoom <= MIN_ZOOM;
    if (zoomIn) zoomIn.disabled = zoom >= MAX_ZOOM;

    if (preserveCenter) {
      wrap.scrollLeft = centerX * zoom - wrap.clientWidth / 2;
      wrap.scrollTop = centerY * zoom - wrap.clientHeight / 2;
    }
  }

  function selectPhase(id, options) {
    if (!phaseMap[id]) return;
    var animate = !(options && options.animate === false);
    selectedId = id;
    setRovingFocus(id, false);
    applyRouteHighlight(id);
    renderInspector(id, animate);
    revealStackedInspector(animate);
    announceSelection(id);

    var clear = document.getElementById('roadmapClear');
    if (clear) clear.hidden = false;
    var jump = document.getElementById('roadmapJump');
    if (jump) jump.value = String(id);

    if (options && options.updateHistory) {
      var nextHash = '#phase-' + formatPhase(id);
      if (window.location.hash !== nextHash) {
        history.pushState({ phase: id }, '', window.location.pathname + window.location.search + nextHash);
      }
    }
  }

  function revealStackedInspector(animate) {
    if (!window.matchMedia || !window.matchMedia('(max-width: 1040px)').matches) return;
    var panel = document.getElementById('roadmapInspector');
    if (!panel) return;
    requestAnimationFrame(function () {
      panel.scrollIntoView({
        behavior: animate && !prefersReducedMotion ? 'smooth' : 'auto',
        block: 'start'
      });
    });
  }

  function togglePhaseSelection(id, options) {
    if (selectedId === id) {
      clearSelection(true, options);
      return;
    }
    selectPhase(id, { updateHistory: true, animate: !(options && options.animate === false) });
  }

  function clearSelection(updateHistory, options) {
    selectedId = null;
    applyRouteHighlight(null);
    var clear = document.getElementById('roadmapClear');
    if (clear) clear.hidden = true;
    var jump = document.getElementById('roadmapJump');
    if (jump) jump.value = '';
    renderEmptyInspector(!(options && options.animate === false));
    setText('roadmapGraphStatus', 'Route focus cleared.');
    if (updateHistory && window.location.hash) {
      history.replaceState({}, '', window.location.pathname + window.location.search);
    }
  }

  function applyRouteHighlight(id) {
    var ancestors = id === null ? {} : getAncestors(id);
    var descendants = id === null ? {} : getDescendants(id);
    var nextNodeStates = {};
    for (var nodeId in nodeEls) {
      var numericId = parseInt(nodeId, 10);
      var nextNodeState = 'default';
      if (numericId === id) {
        nextNodeState = 'selected';
      } else if (ancestors[numericId]) {
        nextNodeState = 'prerequisite';
      } else if (descendants[numericId]) {
        nextNodeState = 'unlock';
      } else if (id !== null) {
        nextNodeState = 'dimmed';
      }
      nextNodeStates[nodeId] = nextNodeState;
      if (routeNodeStates[nodeId] !== nextNodeState) updateNodeRouteState(nodeId, nextNodeState);
    }
    routeNodeStates = nextNodeStates;

    var ancestorEdges = id === null ? {} : buildEdgeSet(id, ancestors, true);
    var descendantEdges = id === null ? {} : buildEdgeSet(id, descendants, false);
    var nextEdgeStates = {};
    for (var i = 0; i < edgeEls.length; i++) {
      var edge = edgeEls[i];
      var key = edge.from + '-' + edge.to;
      var nextEdgeState = 'default';
      if (ancestorEdges[key]) {
        nextEdgeState = 'prerequisite';
      } else if (descendantEdges[key]) {
        nextEdgeState = 'unlock';
      } else if (id !== null) {
        nextEdgeState = 'dimmed';
      }
      nextEdgeStates[key] = nextEdgeState;
      if (routeEdgeStates[key] !== nextEdgeState) updateEdgeRouteState(key, nextEdgeState);
    }
    routeEdgeStates = nextEdgeStates;
  }

  function updateNodeRouteState(nodeId, nextState) {
    var node = nodeEls[nodeId];
    if (!node) return;
    var previousState = routeNodeStates[nodeId] || 'default';
    if (previousState !== 'default') node.classList.remove('is-' + previousState);
    if (nextState !== 'default') node.classList.add('is-' + nextState);
    node.setAttribute('aria-pressed', nextState === 'selected' ? 'true' : 'false');
    restoreNodeState(node);
    if (nextState === 'selected') setNodeState(node, 'Selected', true);
    else if (nextState === 'prerequisite') setNodeState(node, 'Prerequisite', true);
    else if (nextState === 'unlock') setNodeState(node, 'Unlocks', true);
  }

  function updateEdgeRouteState(key, nextState) {
    var edge = edgeElsByKey[key];
    if (!edge) return;
    var previousState = routeEdgeStates[key] || 'default';
    if (previousState !== 'default') {
      edge.path.classList.remove('is-' + previousState);
      edge.arrow.classList.remove('is-' + previousState);
    }
    if (nextState !== 'default') {
      edge.path.classList.add('is-' + nextState);
      edge.arrow.classList.add('is-' + nextState);
    }
  }

  function setNodeState(node, value, relation) {
    var state = node.querySelector('.roadmap-node-state');
    if (!state) return;
    state.textContent = value;
    state.classList.toggle('roadmap-node-relation', !!relation);
  }

  function restoreNodeState(node) {
    var state = node.querySelector('.roadmap-node-state');
    if (!state) return;
    state.textContent = state.getAttribute('data-default') || '';
    state.classList.remove('roadmap-node-relation');
  }

  function buildEdgeSet(id, group, isAncestor) {
    var set = {};
    if (isAncestor) {
      var direct = PREREQS[id] || [];
      for (var i = 0; i < direct.length; i++) set[direct[i] + '-' + id] = true;
      for (var ancestor in group) {
        var requirements = PREREQS[ancestor] || [];
        for (var j = 0; j < requirements.length; j++) {
          if (group[requirements[j]]) set[requirements[j] + '-' + ancestor] = true;
        }
      }
    } else {
      var directChildren = children[id] || [];
      for (var k = 0; k < directChildren.length; k++) set[id + '-' + directChildren[k]] = true;
      for (var descendant in group) {
        var childIds = children[descendant] || [];
        for (var m = 0; m < childIds.length; m++) {
          if (group[childIds[m]]) set[descendant + '-' + childIds[m]] = true;
        }
      }
    }
    return set;
  }

  function setRovingFocus(id, shouldFocus) {
    if (!nodeEls[id]) id = PHASES[0] ? PHASES[0].id : 0;
    rovingId = id;
    for (var nodeId in nodeEls) {
      nodeEls[nodeId].setAttribute('tabindex', parseInt(nodeId, 10) === id ? '0' : '-1');
    }
    if (shouldFocus && nodeEls[id]) nodeEls[id].focus();
  }

  function focusPhase(id, shouldCenter, animate) {
    if (!nodeEls[id]) return;
    setRovingFocus(id, true);
    if (shouldCenter) centerPhase(id, animate);
  }

  function moveNodeFocus(currentId, key) {
    var targetId = currentId;
    if (key === 'Home') targetId = PHASES[0].id;
    else if (key === 'End') targetId = PHASES[PHASES.length - 1].id;
    else targetId = spatialNeighbor(currentId, key);
    focusPhase(targetId, true, false);
  }

  function spatialNeighbor(currentId, key) {
    var current = positions[currentId];
    var bestId = currentId;
    var bestScore = Infinity;
    for (var id in positions) {
      var candidateId = parseInt(id, 10);
      if (candidateId === currentId || !phaseMap[candidateId]) continue;
      var candidate = positions[candidateId];
      var dx = candidate.x - current.x;
      var dy = candidate.y - current.y;
      var primary;
      var secondary;
      if (key === 'ArrowRight' && dx > 0) { primary = dx; secondary = Math.abs(dy); }
      else if (key === 'ArrowLeft' && dx < 0) { primary = -dx; secondary = Math.abs(dy); }
      else if (key === 'ArrowDown' && dy > 0) { primary = dy; secondary = Math.abs(dx); }
      else if (key === 'ArrowUp' && dy < 0) { primary = -dy; secondary = Math.abs(dx); }
      else continue;
      var score = primary + secondary * 1.8;
      if (score < bestScore) {
        bestScore = score;
        bestId = candidateId;
      }
    }
    return bestId;
  }

  function centerPhase(id, animate) {
    var wrap = document.getElementById('roadmapGraphWrap');
    var pos = positions[id];
    if (!wrap || !pos) return;
    var left = (pos.x + NODE_W / 2) * zoom - wrap.clientWidth / 2;
    var top = (pos.y + NODE_H / 2) * zoom - wrap.clientHeight / 2;
    wrap.scrollTo({
      left: Math.max(0, left),
      top: Math.max(0, top),
      behavior: animate && !prefersReducedMotion ? 'smooth' : 'auto'
    });
  }

  function stageById(id) {
    for (var i = 0; i < STAGES.length; i++) if (STAGES[i].id === id) return STAGES[i];
    return null;
  }

  function restoreSelectionFromUrl(shouldCenter) {
    var match = window.location.hash.match(/^#phase-(\d{1,2})$/);
    if (!match) {
      if (selectedId !== null) clearSelection(false);
      return;
    }
    var id = parseInt(match[1], 10);
    if (!phaseMap[id]) {
      if (selectedId !== null) clearSelection(false);
      setText('roadmapGraphStatus', 'No roadmap phase matches this link.');
      return;
    }
    selectPhase(id, { updateHistory: false });
    if (shouldCenter || selectedId === id) centerPhase(id, false);
  }

  function refreshProgress() {
    var wrap = document.getElementById('roadmapGraphWrap');
    var activePhase = document.activeElement && document.activeElement.closest
      ? document.activeElement.closest('.roadmap-node')
      : null;
    var activePhaseId = activePhase ? parseInt(activePhase.getAttribute('data-phase'), 10) : null;
    var left = wrap ? wrap.scrollLeft : 0;
    var top = wrap ? wrap.scrollTop : 0;
    computeProgress();
    renderHeroStats();
    renderGraph();
    if (wrap) { wrap.scrollLeft = left; wrap.scrollTop = top; }
    if (activePhaseId !== null && !isNaN(activePhaseId) && nodeEls[activePhaseId]) {
      setRovingFocus(activePhaseId, true);
    }
    if (selectedId !== null) {
      applyRouteHighlight(selectedId);
      renderInspector(selectedId, false);
    } else {
      renderEmptyInspector(false);
    }
  }

  function inspectorContentRegion(panel) {
    var content = panel.querySelector('.roadmap-inspector-content');
    if (content) return content;
    panel.textContent = '';
    content = document.createElement('div');
    content.className = 'roadmap-inspector-content';
    panel.appendChild(content);
    return content;
  }

  function finishInspectorTransition() {
    if (inspectorAnimation) inspectorAnimation.cancel();
    inspectorAnimation = null;
    var content = document.querySelector('#roadmapInspector .roadmap-inspector-content');
    if (!content) return;
    content.style.opacity = '1';
    content.style.transform = 'none';
  }

  function updateInspector(html, animate) {
    var panel = document.getElementById('roadmapInspector');
    if (!panel) return;
    var content = inspectorContentRegion(panel);
    var fromOpacity = '0';
    var fromTransform = 'translateY(6px)';
    if (inspectorAnimation) {
      var rendered = window.getComputedStyle(content);
      fromOpacity = rendered.opacity;
      fromTransform = rendered.transform === 'none' ? 'translateY(0)' : rendered.transform;
      inspectorAnimation.cancel();
      inspectorAnimation = null;
    }
    content.innerHTML = html;
    content.style.removeProperty('opacity');
    content.style.removeProperty('transform');
    if (!animate || prefersReducedMotion || typeof content.animate !== 'function') return;
    var animation = content.animate([
      { opacity: fromOpacity, transform: fromTransform },
      { opacity: 1, transform: 'translateY(0)' }
    ], {
      duration: 180,
      easing: 'cubic-bezier(0.23, 1, 0.32, 1)',
      fill: 'none'
    });
    inspectorAnimation = animation;
    animation.onfinish = function () {
      if (inspectorAnimation === animation) inspectorAnimation = null;
    };
    animation.oncancel = function () {
      if (inspectorAnimation === animation) inspectorAnimation = null;
    };
  }

  function renderEmptyInspector(animate) {
    var recommendation = recommendedPhase();
    var recommendationHtml = recommendation
      ? '<div class="roadmap-recommendation"><span>Recommended next</span><button type="button" data-route-phase="' + recommendation.id + '">Phase ' + formatPhase(recommendation.id) + ' · ' + escapeHtml(recommendation.name) + '</button></div>'
      : '';
    updateInspector(
      '<span class="roadmap-inspector-eyebrow">Route inspector</span>' +
      '<h2>Choose a phase</h2>' +
      '<p class="roadmap-inspector-copy">Select a node to illuminate the exact route into it, every phase it unlocks, and the best lesson to continue from your local progress.</p>' +
      recommendationHtml,
      !!animate
    );
  }

  function renderInspector(id, animate) {
    var phase = phaseMap[id];
    if (!phase) return;
    var progress = phaseProgress[id];
    var state = phaseState(id);
    var ancestors = getAncestors(id);
    var descendants = getDescendants(id);
    var directPrereqs = PREREQS[id] || [];
    var directUnlocks = children[id] || [];
    var lesson = nextLessonForPhase(phase);
    var lessonLink = lesson ? lessonPageUrl(lesson) : '';
    var actionLabel = progress.done === progress.total && progress.total > 0 ? 'Review phase' : (progress.done > 0 ? 'Continue phase' : 'Start phase');
    updateInspector(
      '<span class="roadmap-inspector-eyebrow">Phase ' + formatPhase(id) + '</span>' +
      '<h2>' + escapeHtml(phase.name) + '</h2>' +
      '<span class="roadmap-inspector-state">' + state.label + '</span>' +
      '<p class="roadmap-inspector-copy">' + escapeHtml(phase.desc || '') + '</p>' +
      '<div class="roadmap-inspector-progress">' +
        '<div class="roadmap-inspector-progress-head"><span>Your progress</span><strong>' + progress.done + ' / ' + progress.total + '</strong></div>' +
        '<div class="roadmap-inspector-progress-bar" aria-hidden="true"><span style="--inspector-progress:' + (progress.percent / 100) + '"></span></div>' +
      '</div>' +
      '<div class="roadmap-inspector-context">' +
        '<div class="roadmap-inspector-stat"><strong>' + Object.keys(ancestors).length + '</strong><span class="roadmap-inspector-stat-label">All prerequisites</span></div>' +
        '<div class="roadmap-inspector-stat"><strong>' + Object.keys(descendants).length + '</strong><span class="roadmap-inspector-stat-label">Phases unlocked</span></div>' +
      '</div>' +
      '<div class="roadmap-route-sections">' +
        renderRouteSection('Direct prerequisites', directPrereqs, 'This is the starting point.') +
        renderRouteSection('Immediately unlocks', directUnlocks, 'This is a final destination.') +
      '</div>' +
      '<div class="roadmap-actions">' +
        (lessonLink ? '<a class="roadmap-action roadmap-action-primary" href="' + lessonLink + '">' + actionLabel + '</a>' : '') +
        '<a class="roadmap-action" href="' + phaseGithubUrl(phase) + '" target="_blank" rel="noopener">View phase on GitHub</a>' +
      '</div>',
      animate !== false
    );
  }

  function renderRouteSection(title, ids, emptyMessage) {
    var html = '<section class="roadmap-route-section"><h3>' + escapeHtml(title) + '</h3>';
    if (!ids.length) return html + '<p class="roadmap-route-empty">' + escapeHtml(emptyMessage) + '</p></section>';
    html += '<div class="roadmap-route-list">';
    for (var i = 0; i < ids.length; i++) {
      var phase = phaseMap[ids[i]];
      if (!phase) continue;
      html += '<button class="roadmap-route-button" type="button" data-route-phase="' + phase.id + '"><span>' + formatPhase(phase.id) + '</span>' + escapeHtml(phase.name) + '</button>';
    }
    return html + '</div></section>';
  }

  function announceSelection(id) {
    var ancestors = Object.keys(getAncestors(id)).length;
    var descendants = Object.keys(getDescendants(id)).length;
    setText('roadmapGraphStatus', 'Phase ' + formatPhase(id) + ' selected. ' + ancestors + ' prerequisite phases and ' + descendants + ' downstream phases highlighted.');
  }

  function phaseState(id) {
    var progress = phaseProgress[id] || { done: 0, total: 0 };
    if (progress.total > 0 && progress.done === progress.total) return { label: 'Complete' };
    if (progress.done > 0) return { label: 'In progress' };
    if (prerequisitesComplete(id)) return { label: 'Ready' };
    return { label: 'Upcoming' };
  }

  function prerequisitesComplete(id) {
    var requirements = PREREQS[id] || [];
    for (var i = 0; i < requirements.length; i++) {
      var progress = phaseProgress[requirements[i]];
      if (!progress || progress.total === 0 || progress.done !== progress.total) return false;
    }
    return true;
  }

  function recommendedPhase() {
    var ordered = PHASES.slice().sort(function (a, b) { return a.id - b.id; });
    for (var i = 0; i < ordered.length; i++) {
      var progress = phaseProgress[ordered[i].id];
      if (progress.done < progress.total && prerequisitesComplete(ordered[i].id)) return ordered[i];
    }
    for (var j = 0; j < ordered.length; j++) {
      if (phaseProgress[ordered[j].id].done < phaseProgress[ordered[j].id].total) return ordered[j];
    }
    return null;
  }

  function getAncestors(id) {
    var result = {};
    var queue = (PREREQS[id] || []).slice();
    while (queue.length) {
      var parent = queue.shift();
      if (result[parent]) continue;
      result[parent] = true;
      var requirements = PREREQS[parent] || [];
      for (var i = 0; i < requirements.length; i++) queue.push(requirements[i]);
    }
    return result;
  }

  function getDescendants(id) {
    var result = {};
    var queue = (children[id] || []).slice();
    while (queue.length) {
      var child = queue.shift();
      if (result[child]) continue;
      result[child] = true;
      var childIds = children[child] || [];
      for (var i = 0; i < childIds.length; i++) queue.push(childIds[i]);
    }
    return result;
  }

  function nextLessonForPhase(phase) {
    var lessons = Array.isArray(phase.lessons) ? phase.lessons : [];
    var firstIncomplete = null;
    var recentIncomplete = null;
    var recentVisit = 0;
    for (var i = 0; i < lessons.length; i++) {
      var lesson = lessons[i];
      var path = lessonPath(lesson.url);
      if (!path) continue;
      var complete = window.AIFSProgress && window.AIFSProgress.isLessonComplete(path);
      if (complete) continue;
      if (!firstIncomplete) firstIncomplete = lesson;
      if (window.AIFSProgress && typeof window.AIFSProgress.getLessonProgress === 'function') {
        var progress = window.AIFSProgress.getLessonProgress(path);
        if (progress && progress.visitedAt > recentVisit) {
          recentVisit = progress.visitedAt;
          recentIncomplete = lesson;
        }
      }
    }
    return recentIncomplete || firstIncomplete || lessons[0] || null;
  }

  function lessonPageUrl(lesson) {
    var path = lessonPath(lesson && lesson.url);
    return path ? 'lesson.html?path=' + encodeURI(path) : '';
  }

  function lessonPath(url) {
    if (!url) return '';
    if (window.AIFSProgress && typeof window.AIFSProgress.extractPath === 'function') return window.AIFSProgress.extractPath(url);
    var match = String(url).match(/(phases\/[^/]+\/[^/]+)\/?/);
    return match ? match[1] : '';
  }

  function phaseGithubUrl(phase) {
    return 'https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/' + extractPhaseSlug(phase);
  }

  function extractPhaseSlug(phase) {
    if (phase.url) {
      var phaseMatch = phase.url.match(/phases\/([^/]+)/);
      if (phaseMatch) return phaseMatch[1];
    }
    if (phase.lessons && phase.lessons.length && phase.lessons[0].url) {
      var lessonMatch = phase.lessons[0].url.match(/phases\/([^/]+)/);
      if (lessonMatch) return lessonMatch[1];
    }
    return formatPhase(phase.id) + '-' + String(phase.name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }

  function updateThemeIcon() {
    var icon = document.getElementById('themeIcon');
    if (icon) icon.textContent = root.getAttribute('data-theme') === 'light' ? 'N' : 'D';
  }

  function formatPhase(id) { return String(id).padStart(2, '0'); }

  function setText(id, value) {
    var element = document.getElementById(id);
    if (element) element.textContent = value;
  }

  function svgEl(tag, attrs) {
    var element = document.createElementNS('http://www.w3.org/2000/svg', tag);
    if (attrs) for (var key in attrs) element.setAttribute(key, attrs[key]);
    return element;
  }

  function showDataError() {
    var wrap = document.getElementById('roadmapGraphWrap');
    if (wrap) wrap.innerHTML = '<p>Roadmap data could not be loaded. Rebuild the site and refresh this page.</p>';
  }

  function escapeHtml(value) {
    var div = document.createElement('div');
    div.textContent = value == null ? '' : String(value);
    return div.innerHTML;
  }
})();
