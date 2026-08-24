/* figures-agent-skills.js: staged SVG explanations for the Agent Skills track.
   Loads after lesson-figures.js and registers through window.LF. */
(function () {
  'use strict';

  var LF = window.LF;
  if (!LF) return;

  var el = LF.el;
  var svgEl = LF.svgEl;
  var figureCounter = 0;

  function ensureStyles() {
    if (document.getElementById('agent-skill-figure-styles')) return;
    var style = document.createElement('style');
    style.id = 'agent-skill-figure-styles';
    style.textContent = [
      '.asf-shell{border:1px solid var(--rule-soft,#ddd);background:var(--bg,#fafaf5);margin:28px 0;font-family:var(--font-body,serif)}',
      '.asf-head{display:flex;justify-content:space-between;align-items:baseline;gap:12px;padding:12px 16px;border-bottom:1px solid var(--rule-soft,#ddd);font-family:var(--font-mono,monospace);font-size:.68rem;letter-spacing:.14em;text-transform:uppercase;color:var(--ink-mute,#777)}',
      '.asf-head strong{color:var(--blueprint,#3553ff);font-weight:600}',
      '.asf-body{padding:16px}',
      '.asf-controls{display:grid;grid-template-columns:auto auto auto minmax(150px,1fr);align-items:center;gap:8px;margin-bottom:14px}',
      '.asf-button{min-height:44px;padding:7px 11px;border:1px solid var(--rule-soft,#ddd);background:var(--bg,#fafaf5);color:var(--ink,#111);font-family:var(--font-mono,monospace);font-size:.68rem;letter-spacing:.06em;text-transform:uppercase;cursor:pointer;transition:transform var(--motion-press,160ms) var(--ease-out,cubic-bezier(.23,1,.32,1)),border-color var(--motion-feedback,180ms) ease,color var(--motion-feedback,180ms) ease,background-color var(--motion-feedback,180ms) ease}',
      '.asf-button:hover,.asf-button:focus-visible{border-color:var(--blueprint,#3553ff);color:var(--blueprint,#3553ff)}',
      '.asf-button:active:not(:disabled){transform:scale(.97)}',
      '.asf-button:disabled{cursor:default;opacity:.42}',
      '.asf-range-wrap{display:grid;grid-template-columns:minmax(100px,1fr) auto;align-items:center;gap:10px}',
      '.asf-range{width:100%;accent-color:var(--blueprint,#3553ff)}',
      '.asf-count{font-family:var(--font-mono,monospace);font-size:.68rem;white-space:nowrap;color:var(--ink-mute,#777)}',
      '.asf-canvas{overflow-x:auto;overscroll-behavior-inline:contain;border:1px solid var(--rule-soft,#ddd);background:var(--bg-surface,#f3f1e8)}',
      '.asf-svg{display:block;width:100%;min-width:0;height:auto;color:var(--blueprint,#3553ff)}',
      '.asf-zone rect{fill:var(--blueprint-tint,rgba(53,83,255,.08));stroke:var(--rule-soft,#ddd);stroke-width:1;stroke-dasharray:5 5}',
      '.asf-zone text{fill:var(--ink-mute,#777);font-family:var(--font-mono,monospace);font-size:12px;letter-spacing:.1em;text-transform:uppercase}',
      '.asf-edge{opacity:.12;transform:translateY(5px);transform-box:fill-box;transform-origin:center;transition:opacity 280ms var(--ease-out,cubic-bezier(.23,1,.32,1)),transform 280ms var(--ease-out,cubic-bezier(.23,1,.32,1))}',
      '.asf-edge.is-visible{opacity:.82;transform:none}',
      '.asf-edge path{fill:none;stroke:var(--blueprint,#3553ff);stroke-width:2}',
      '.asf-edge.is-warning path{stroke:var(--warn,#b8870f)}',
      '.asf-edge-label{fill:var(--ink-mute,#777);font-family:var(--font-mono,monospace);font-size:11px;text-anchor:middle;paint-order:stroke;stroke:var(--bg-surface,#f3f1e8);stroke-width:5;stroke-linejoin:round}',
      '.asf-node{opacity:.2;transform:translateY(8px);transform-box:fill-box;transform-origin:center;transition:opacity 280ms var(--ease-out,cubic-bezier(.23,1,.32,1)),transform 280ms var(--ease-out,cubic-bezier(.23,1,.32,1))}',
      '.asf-node.is-visible{opacity:.68;transform:none}',
      '.asf-node.is-current{opacity:1;transform:translateY(-5px)}',
      '.asf-node rect{fill:var(--bg,#fafaf5);stroke:var(--rule-soft,#ddd);stroke-width:1.5}',
      '.asf-node.is-visible rect{stroke:var(--blueprint,#3553ff)}',
      '.asf-node.is-current rect{fill:var(--blueprint,#3553ff);stroke:var(--blueprint,#3553ff)}',
      '.asf-node.is-warning rect{stroke:var(--warn,#b8870f)}',
      '.asf-node.is-current.is-warning rect{fill:var(--warn,#b8870f);stroke:var(--warn,#b8870f)}',
      '.asf-node.is-decision rect{stroke-dasharray:5 4}',
      '.asf-title{fill:var(--ink,#111);font-family:var(--font-mono,monospace);font-size:14px;font-weight:600}',
      '.asf-detail{fill:var(--ink-mute,#777);font-family:var(--font-mono,monospace);font-size:11px}',
      '.asf-node.is-compact .asf-title{font-size:11.5px}',
      '.asf-node.is-compact .asf-detail{font-size:9.5px}',
      '.asf-node.is-current .asf-title,.asf-node.is-current .asf-detail{fill:var(--bg,#fafaf5)}',
      '.asf-step-note{min-height:70px;margin-top:12px;padding:12px 14px;border-left:3px solid var(--blueprint,#3553ff);background:var(--blueprint-tint,rgba(53,83,255,.08))}',
      '.asf-step-note strong{display:block;margin-bottom:4px;font-family:var(--font-mono,monospace);font-size:.74rem;letter-spacing:.05em;text-transform:uppercase;color:var(--blueprint,#3553ff)}',
      '.asf-step-note span{display:block;font-size:.92rem;line-height:1.5;color:var(--ink-soft,#555)}',
      '.asf-status{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}',
      '.asf-caption{padding:12px 16px;border-top:1px solid var(--rule-soft,#ddd);font-size:.92rem;line-height:1.55;color:var(--ink-soft,#555)}',
      '@media(max-width:640px){.asf-body{padding:12px}.asf-controls{grid-template-columns:repeat(3,minmax(0,1fr))}.asf-range-wrap{grid-column:1/-1}.asf-button{padding-inline:6px}.asf-svg{min-width:660px}.asf-step-note{min-height:0}}',
      '@media(prefers-reduced-motion:reduce){.asf-edge,.asf-node{transition:none!important}.asf-button{transition:border-color var(--motion-feedback,180ms) ease,color var(--motion-feedback,180ms) ease,background-color var(--motion-feedback,180ms) ease}.asf-button:active:not(:disabled){transform:none}}',
      '@media print{.asf-controls{display:none!important}.asf-canvas{overflow:visible}.asf-svg{min-width:0}.asf-edge,.asf-node{opacity:1!important;transform:none!important;transition:none!important}}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function N(id, x, y, title, detail, stage, kind, width, height) {
    return {
      id: id,
      x: x,
      y: y,
      title: title,
      detail: detail || '',
      stage: stage || 0,
      kind: kind || '',
      width: width || 150,
      height: height || 62
    };
  }

  function E(from, to, stage, label, tone, points) {
    return {
      from: from,
      to: to,
      stage: stage || 0,
      label: label || '',
      tone: tone || '',
      points: points || null
    };
  }

  function Z(x, y, width, height, label) {
    return { x: x, y: y, width: width, height: height, label: label };
  }

  function S(label, detail, focus) {
    return { label: label, detail: detail, focus: focus || [] };
  }

  function lines(value) {
    if (Array.isArray(value)) return value;
    return String(value || '').split('|');
  }

  function splitLongToken(token, maxChars) {
    var chunks = [];
    var rest = token;
    while (rest.length > maxChars) {
      var minimum = Math.max(2, Math.floor(maxChars * 0.45));
      var cut = -1;
      for (var index = maxChars; index >= minimum; index -= 1) {
        if (/[-_/.+]/.test(rest.charAt(index - 1))) {
          cut = index;
          break;
        }
      }
      if (cut < 0) cut = maxChars;
      chunks.push(rest.slice(0, cut));
      rest = rest.slice(cut);
    }
    if (rest) chunks.push(rest);
    return chunks;
  }

  function wrapLine(value, maxChars) {
    var words = String(value || '').trim().split(/\s+/).filter(Boolean);
    if (!words.length) return [''];
    var wrapped = [];
    var current = '';
    words.forEach(function (word) {
      splitLongToken(word, maxChars).forEach(function (chunk) {
        var candidate = current ? current + ' ' + chunk : chunk;
        if (candidate.length <= maxChars) {
          current = candidate;
          return;
        }
        if (current) wrapped.push(current);
        current = chunk;
      });
    });
    if (current) wrapped.push(current);
    return wrapped;
  }

  function wrappedLines(value, maxChars) {
    return lines(value).reduce(function (result, line) {
      return result.concat(wrapLine(line, maxChars));
    }, []);
  }

  function nodeTextLayout(node) {
    var available = Math.max(28, node.width - 24);
    var rawTitle = lines(node.title);
    var rawDetail = node.detail ? lines(node.detail) : [];
    var compact = rawTitle.some(function (line) { return line.length * 8.4 > available; }) ||
      rawDetail.some(function (line) { return line.length * 6.6 > available; });
    if (!compact) {
      return {
        compact: false,
        title: rawTitle,
        detail: rawDetail,
        titleY: node.y + 23,
        detailY: node.y + 27 + rawTitle.length * 17,
        titleStep: 17,
        detailStep: 14
      };
    }

    var title = wrappedLines(node.title, Math.max(5, Math.floor(available / 6.9)));
    var detail = node.detail ? wrappedLines(node.detail, Math.max(6, Math.floor(available / 5.7))) : [];
    var titleStep = 13;
    var detailStep = 11;
    var titleHeight = 15 + Math.max(0, title.length - 1) * titleStep;
    var detailHeight = detail.length ? 12 + Math.max(0, detail.length - 1) * detailStep : 0;
    var totalHeight = titleHeight + (detail.length ? 1 + detailHeight : 0);
    var top = node.y + Math.max(2, (node.height - totalHeight) / 2);
    var titleY = top + 12;
    return {
      compact: true,
      title: title,
      detail: detail,
      titleY: titleY,
      detailY: titleY + Math.max(0, title.length - 1) * titleStep + 14,
      titleStep: titleStep,
      detailStep: detailStep
    };
  }

  function nodeCenter(node) {
    return { x: node.x + node.width / 2, y: node.y + node.height / 2 };
  }

  function edgePath(edge, nodes) {
    if (edge.points && edge.points.length) {
      return edge.points.map(function (point, index) {
        return (index ? 'L' : 'M') + point[0] + ' ' + point[1];
      }).join(' ');
    }
    var from = nodes[edge.from];
    var to = nodes[edge.to];
    var a = nodeCenter(from);
    var b = nodeCenter(to);
    var dx = b.x - a.x;
    var dy = b.y - a.y;
    var x1 = a.x;
    var y1 = a.y;
    var x2 = b.x;
    var y2 = b.y;
    if (Math.abs(dx) >= Math.abs(dy)) {
      x1 = dx >= 0 ? from.x + from.width : from.x;
      x2 = dx >= 0 ? to.x : to.x + to.width;
    } else {
      y1 = dy >= 0 ? from.y + from.height : from.y;
      y2 = dy >= 0 ? to.y : to.y + to.height;
    }
    var mx = (x1 + x2) / 2;
    var my = (y1 + y2) / 2;
    if (Math.abs(dx) >= Math.abs(dy)) return 'M' + x1 + ' ' + y1 + ' C' + mx + ' ' + y1 + ' ' + mx + ' ' + y2 + ' ' + x2 + ' ' + y2;
    return 'M' + x1 + ' ' + y1 + ' C' + x1 + ' ' + my + ' ' + x2 + ' ' + my + ' ' + x2 + ' ' + y2;
  }

  function textBlock(node, className, value, startY, lineHeight) {
    var text = svgEl('text', { x: node.x + 12, y: startY, class: className });
    lines(value).forEach(function (line, index) {
      text.appendChild(svgEl('tspan', {
        x: node.x + 12,
        dy: index === 0 ? '0' : String(lineHeight)
      }, [document.createTextNode(line)]));
    });
    return text;
  }

  function prefersReducedMotion() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function makeFigure(config) {
    return function (host) {
      ensureStyles();
      figureCounter += 1;
      var uid = 'asf-' + figureCounter;
      var maxStep = config.steps.length - 1;
      var state = { step: 0 };
      var timer = 0;
      var announcementTimer = 0;
      var titleId = uid + '-title';
      var descId = uid + '-desc';
      var noteDetailId = uid + '-note-detail';
      var nodeMap = {};
      var nodeViews = [];
      var edgeViews = [];

      config.nodes.forEach(function (node) { nodeMap[node.id] = node; });

      var svg = svgEl('svg', {
        class: 'asf-svg',
        viewBox: config.viewBox || '0 0 760 480',
        role: 'img',
        'aria-labelledby': titleId + ' ' + descId,
        focusable: 'false'
      });
      svg.appendChild(svgEl('title', { id: titleId }, [document.createTextNode(config.title)]));
      svg.appendChild(svgEl('desc', { id: descId }, [document.createTextNode(config.description)]));

      var defs = svgEl('defs');
      var marker = svgEl('marker', {
        id: uid + '-arrow', markerWidth: '8', markerHeight: '8', refX: '7', refY: '4', orient: 'auto', markerUnits: 'strokeWidth'
      }, [svgEl('path', { d: 'M0 0 L8 4 L0 8 Z', fill: 'var(--blueprint,#3553ff)' })]);
      var warnMarker = svgEl('marker', {
        id: uid + '-warn-arrow', markerWidth: '8', markerHeight: '8', refX: '7', refY: '4', orient: 'auto', markerUnits: 'strokeWidth'
      }, [svgEl('path', { d: 'M0 0 L8 4 L0 8 Z', fill: 'var(--warn,#b8870f)' })]);
      defs.appendChild(marker);
      defs.appendChild(warnMarker);
      svg.appendChild(defs);

      (config.zones || []).forEach(function (zone) {
        svg.appendChild(svgEl('g', { class: 'asf-zone' }, [
          svgEl('rect', { x: zone.x, y: zone.y, width: zone.width, height: zone.height }),
          svgEl('text', { x: zone.x + 10, y: zone.y + 18 }, [document.createTextNode(zone.label)])
        ]));
      });

      config.edges.forEach(function (edge) {
        var group = svgEl('g', { class: 'asf-edge' + (edge.tone === 'warning' ? ' is-warning' : '') });
        var path = svgEl('path', {
          d: edgePath(edge, nodeMap),
          'marker-end': 'url(#' + (edge.tone === 'warning' ? uid + '-warn-arrow' : uid + '-arrow') + ')'
        });
        group.appendChild(path);
        if (edge.label) {
          var fromCenter = nodeCenter(nodeMap[edge.from]);
          var toCenter = nodeCenter(nodeMap[edge.to]);
          var labelX = edge.points && edge.points.length ? edge.points[Math.floor(edge.points.length / 2)][0] : (fromCenter.x + toCenter.x) / 2;
          var labelY = edge.points && edge.points.length ? edge.points[Math.floor(edge.points.length / 2)][1] - 7 : (fromCenter.y + toCenter.y) / 2 - 7;
          group.appendChild(svgEl('text', { x: labelX, y: labelY, class: 'asf-edge-label' }, [document.createTextNode(edge.label)]));
        }
        svg.appendChild(group);
        edgeViews.push({ config: edge, element: group });
      });

      config.nodes.forEach(function (node) {
        var layout = nodeTextLayout(node);
        var nodeClass = 'asf-node' + (node.kind === 'decision' ? ' is-decision' : '') + (node.kind === 'warning' ? ' is-warning' : '') + (layout.compact ? ' is-compact' : '');
        var group = svgEl('g', { class: nodeClass, 'data-node': node.id });
        group.appendChild(svgEl('rect', { x: node.x, y: node.y, width: node.width, height: node.height, rx: '0' }));
        group.appendChild(textBlock(node, 'asf-title', layout.title, layout.titleY, layout.titleStep));
        if (layout.detail.length) {
          group.appendChild(textBlock(node, 'asf-detail', layout.detail, layout.detailY, layout.detailStep));
        }
        svg.appendChild(group);
        nodeViews.push({ config: node, element: group });
      });

      var previous = el('button', { class: 'asf-button', type: 'button' }, ['Previous']);
      var next = el('button', { class: 'asf-button', type: 'button' }, ['Next']);
      var replay = el('button', { class: 'asf-button', type: 'button' }, ['Replay']);
      var range = el('input', {
        class: 'asf-range', type: 'range', min: '0', max: String(maxStep), step: '1', value: '0',
        'aria-label': 'Diagram step',
        'aria-describedby': noteDetailId,
        'aria-valuetext': 'Step 1 of ' + config.steps.length + ': ' + config.steps[0].label
      });
      var count = el('span', { class: 'asf-count', 'aria-hidden': 'true' }, ['1 / ' + config.steps.length]);
      var noteTitle = el('strong');
      var noteDetail = el('span', { id: noteDetailId });
      var note = el('div', { class: 'asf-step-note' }, [noteTitle, noteDetail]);
      var status = el('span', { class: 'asf-status', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' });

      function currentFocus() {
        var step = config.steps[state.step];
        return step.focus && step.focus.length ? step.focus : config.nodes.filter(function (node) {
          return node.stage === state.step;
        }).map(function (node) { return node.id; });
      }

      function render() {
        var focus = currentFocus();
        nodeViews.forEach(function (view) {
          var visible = view.config.stage <= state.step;
          var current = focus.indexOf(view.config.id) !== -1;
          view.element.classList.toggle('is-visible', visible);
          view.element.classList.toggle('is-current', current);
          if (current) view.element.setAttribute('aria-current', 'step');
          else view.element.removeAttribute('aria-current');
        });
        edgeViews.forEach(function (view) {
          view.element.classList.toggle('is-visible', view.config.stage <= state.step);
        });
        range.value = String(state.step);
        range.setAttribute('aria-valuetext', 'Step ' + (state.step + 1) + ' of ' + config.steps.length + ': ' + config.steps[state.step].label);
        count.textContent = (state.step + 1) + ' / ' + config.steps.length;
        previous.disabled = state.step === 0;
        next.disabled = state.step === maxStep;
        noteTitle.textContent = config.steps[state.step].label;
        noteDetail.textContent = config.steps[state.step].detail;
      }

      function clearTimer() {
        if (!timer) return;
        window.clearTimeout(timer);
        timer = 0;
      }

      function announceStep() {
        if (announcementTimer) window.clearTimeout(announcementTimer);
        status.textContent = '';
        announcementTimer = window.setTimeout(function () {
          announcementTimer = 0;
          status.textContent = 'Step ' + (state.step + 1) + ' of ' + config.steps.length + ': ' + config.steps[state.step].label + '. ' + config.steps[state.step].detail;
        }, 0);
      }

      function setStep(step, announce) {
        state.step = Math.max(0, Math.min(maxStep, step));
        render();
        if (announce) announceStep();
      }

      function pause() {
        clearTimer();
      }

      function resume() {
        if (timer || state.step >= maxStep || prefersReducedMotion()) return;
        timer = window.setTimeout(function advance() {
          timer = 0;
          if (state.step >= maxStep) return;
          setStep(state.step + 1);
          resume();
        }, config.delay || 850);
      }

      function staticFrame() {
        clearTimer();
        setStep(maxStep);
      }

      previous.addEventListener('click', function () {
        pause();
        setStep(state.step - 1, true);
      });
      next.addEventListener('click', function () {
        pause();
        setStep(state.step + 1, true);
      });
      replay.addEventListener('click', function () {
        pause();
        if (prefersReducedMotion()) setStep(maxStep, true);
        else {
          setStep(0, true);
          resume();
        }
      });
      range.addEventListener('input', function () {
        pause();
        setStep(Number(range.value));
      });

      var controls = el('div', { class: 'asf-controls' }, [
        previous,
        next,
        replay,
        el('div', { class: 'asf-range-wrap' }, [range, count])
      ]);
      var shell = el('section', { class: 'asf-shell' }, [
        el('div', { class: 'asf-head' }, [
          el('strong', {}, [config.title]),
          el('span', {}, [config.hint || 'step through the boundary'])
        ]),
        el('div', { class: 'asf-body' }, [
          controls,
          el('div', { class: 'asf-canvas', tabindex: '0', 'aria-label': 'Scrollable diagram canvas' }, [svg]),
          note,
          status
        ]),
        el('div', { class: 'asf-caption' }, [config.caption])
      ]);
      host.appendChild(shell);
      render();
      LF.addMotionController(host, { pause: pause, resume: resume, staticFrame: staticFrame });
      LF.registerDisposer(host, function () {
        clearTimer();
        if (announcementTimer) window.clearTimeout(announcementTimer);
      });
    };
  }

  var figures = {
    'skill-package-anatomy': makeFigure({
      title: 'Skill package anatomy',
      hint: 'open the complete deployable unit',
      description: 'A tree showing SKILL.md, references, scripts, and assets inside one release-readiness skill package.',
      viewBox: '0 0 760 430',
      zones: [Z(18, 18, 724, 392, 'one deployable directory')],
      nodes: [
        N('bundle', 290, 42, 'release-readiness', 'package root', 0, '', 180, 58),
        N('entry', 35, 150, 'SKILL.md', 'identity + procedure', 1, '', 140, 64),
        N('refs', 205, 150, 'references/', 'branch rules', 1, '', 140, 64),
        N('scripts', 375, 150, 'scripts/', 'deterministic helpers', 1, '', 140, 64),
        N('assets', 545, 150, 'assets/', 'output material', 1, '', 140, 64),
        N('policy', 185, 292, 'release-policy.md', 'domain constraint', 2, '', 150, 62),
        N('format', 350, 292, 'changelog-format.md', 'format contract', 2, '', 160, 62),
        N('inspect', 520, 292, 'inspect_release.py', 'evidence collector', 2, '', 150, 62),
        N('checklist', 590, 342, 'release-checklist.md', 'deliverable template', 2, '', 145, 62)
      ],
      edges: [
        E('bundle', 'entry', 1), E('bundle', 'refs', 1), E('bundle', 'scripts', 1), E('bundle', 'assets', 1),
        E('refs', 'policy', 2), E('refs', 'format', 2), E('scripts', 'inspect', 2), E('assets', 'checklist', 2)
      ],
      steps: [
        S('The directory is the unit', 'Install, version, review, and remove the whole package root.', ['bundle']),
        S('Four responsibilities', 'SKILL.md routes and instructs. References explain. Scripts compute. Assets become outputs.', ['entry', 'refs', 'scripts', 'assets']),
        S('Every pointer must resolve', 'A copied entry file with missing companions is a broken package.', ['policy', 'format', 'inspect', 'checklist'])
      ],
      caption: 'Package integrity includes every file the workflow names. Validate the tree before publishing the catalog entry.'
    }),

    'skill-runtime-lifecycle': makeFigure({
      title: 'Skill runtime lifecycle',
      hint: 'follow identity into verified work',
      description: 'The skill lifecycle from package discovery through validation, selection, activation, execution, and verification.',
      viewBox: '0 0 920 500',
      nodes: [
        N('discover', 30, 55, 'Discover', 'find package', 0, '', 130, 60),
        N('validate', 190, 55, 'Validate', 'metadata + layout', 1, '', 140, 60),
        N('catalog', 360, 55, 'Catalog', 'name + description', 2, '', 140, 60),
        N('select', 535, 55, 'Select?', 'explicit or implicit', 3, 'decision', 140, 60),
        N('unloaded', 730, 25, 'Leave unloaded', 'no match', 4, 'warning', 150, 54),
        N('activate', 730, 125, 'Activate', 'body enters context', 4, '', 150, 60),
        N('body', 535, 230, 'Load SKILL.md', 'working procedure', 5, '', 150, 60),
        N('resources', 350, 230, 'Disclose resources', 'only required branch', 6, '', 155, 60),
        N('execute', 165, 230, 'Request execution', 'host tools + policy', 7, '', 155, 60),
        N('artifact', 30, 340, 'Artifact + evidence', 'observable result', 8, '', 155, 60),
        N('verify', 250, 340, 'Verify', 'independent gate', 9, '', 135, 60)
      ],
      edges: [
        E('discover', 'validate', 1), E('validate', 'catalog', 2), E('catalog', 'select', 3),
        E('select', 'unloaded', 4, 'no match', 'warning'), E('select', 'activate', 4, 'selected'),
        E('activate', 'body', 5), E('body', 'resources', 6), E('resources', 'execute', 7),
        E('execute', 'artifact', 8), E('artifact', 'verify', 9)
      ],
      steps: [
        S('Discovery is not activation', 'The runtime first finds a possible package.', ['discover']),
        S('Reject malformed packages early', 'Validation protects the catalog before the model sees an entry.', ['validate']),
        S('Publish compact routing metadata', 'Only identity and trigger information need catalog space.', ['catalog']),
        S('Selection is a separate decision', 'A host-specific explicit action or a description-driven model match can select the package.', ['select']),
        S('Selection can abstain', 'No match leaves the body unloaded. A match activates it.', ['unloaded', 'activate']),
        S('Activation loads procedure', 'The body enters model-visible context, but no tool authority appears.', ['body']),
        S('Disclosure follows branches', 'Read only the references, scripts, or assets required now.', ['resources']),
        S('Execution stays host-controlled', 'The agent requests tools or scripts under active policy.', ['execute']),
        S('Return evidence with the artifact', 'A fluent claim is weaker than paths, observations, and exit results.', ['artifact']),
        S('Verification closes the loop', 'Check the result independently of the model that produced it.', ['verify'])
      ],
      caption: 'Diagnose failures by lifecycle stage. Discovered, selected, activated, executed, and verified are different states.'
    }),

    'skill-tool-orthogonality': makeFigure({
      title: 'Skill procedure and tool capability',
      hint: 'separate how from what can run',
      description: 'A feedback loop in which an activated skill guides procedure while a host tool returns observations for the final artifact.',
      viewBox: '0 0 760 500',
      zones: [Z(28, 22, 704, 450, 'procedure loop')],
      nodes: [
        N('goal', 300, 42, 'User goal', 'defines outcome', 0, '', 160, 58),
        N('skill', 300, 128, 'Activated skill', 'procedural knowledge', 1, '', 160, 60),
        N('procedure', 300, 220, 'Decision rules', 'choose next action', 2, 'decision', 160, 60),
        N('tool', 60, 220, 'MCP or local tool', 'typed capability', 3, '', 170, 60),
        N('observation', 60, 330, 'Observation', 'evidence, not authority', 4, '', 170, 60),
        N('artifact', 540, 220, 'Artifact', 'contracted output', 5, '', 150, 60),
        N('verify', 540, 330, 'Verification', 'independent check', 6, '', 150, 60)
      ],
      edges: [
        E('goal', 'skill', 1), E('skill', 'procedure', 2), E('procedure', 'tool', 3), E('tool', 'observation', 4),
        E('observation', 'procedure', 4, 'feed evidence back', '', [[145, 330], [145, 300], [280, 300], [280, 250], [300, 250]]),
        E('procedure', 'artifact', 5), E('artifact', 'verify', 6)
      ],
      steps: [
        S('The user owns the goal', 'The task starts above both the skill and the tool.', ['goal']),
        S('The skill contributes method', 'It supplies procedure and decision boundaries.', ['skill']),
        S('Procedure chooses a capability', 'Naming a tool does not create or authorize it.', ['procedure']),
        S('The host exposes the real tool', 'The tool contract defines what can actually be requested.', ['tool']),
        S('Observations update judgment', 'Tool output returns as evidence, not as a higher-priority instruction.', ['observation', 'procedure']),
        S('Procedure produces an artifact', 'The skill turns observations into the required output.', ['artifact']),
        S('Verification stays independent', 'The artifact must pass a check beyond the model narrative.', ['verify'])
      ],
      caption: 'A skill answers how to approach work. A tool answers which operation the host can perform.'
    }),

    'skill-validation-order': makeFigure({
      title: 'Skill validation order',
      hint: 'fail on the first broken invariant',
      description: 'A left-to-right validation pipeline from frontmatter delimiters to body and resource rules.',
      viewBox: '0 0 860 230',
      nodes: [
        N('frontmatter', 20, 78, 'Frontmatter', 'delimiters', 0, '', 125, 62),
        N('scalar', 160, 78, 'Scalar metadata', 'safe parse', 1, '', 125, 62),
        N('name', 300, 78, 'Name = directory', 'stable identity', 2, '', 135, 62),
        N('required', 450, 78, 'Required fields', 'name + description', 3, '', 135, 62),
        N('extensions', 600, 78, 'Known extensions', 'adapter allowlist', 4, '', 125, 62),
        N('body', 740, 78, 'Body + resources', 'deep rules', 5, '', 105, 62)
      ],
      edges: [E('frontmatter', 'scalar', 1), E('scalar', 'name', 2), E('name', 'required', 3), E('required', 'extensions', 4), E('extensions', 'body', 5)],
      steps: [
        S('Find the document boundary', 'Do not infer metadata from a malformed header.', ['frontmatter']),
        S('Parse only the expected shape', 'Reject surprising metadata types before deeper checks.', ['scalar']),
        S('Prove package identity', 'The declared name and containing directory must agree.', ['name']),
        S('Require routing metadata', 'Missing identity or description prevents catalog publication.', ['required']),
        S('Name host-specific semantics', 'Unknown extensions require an explicit adapter decision.', ['extensions']),
        S('Then inspect body and resources', 'Deep checks are useful only after the cheap structure is sound.', ['body'])
      ],
      caption: 'Cheap structural checks should fail before secondary content errors can hide the first broken invariant.'
    }),

    'skill-discovery-pipeline': makeFigure({
      title: 'Discovery compiler pipeline',
      hint: 'compile filesystem candidates into a catalog',
      description: 'Configured roots pass through enumeration, package validation, provenance, collision resolution, budgeting, and catalog publication.',
      viewBox: '0 0 980 250',
      nodes: [
        N('roots', 20, 88, 'Configured roots', 'workspace, user, admin', 0, '', 130, 66),
        N('enumerate', 165, 88, 'Enumerate', 'immediate skill dirs', 1, '', 120, 66),
        N('entry', 300, 88, 'Find SKILL.md', 'one entry point', 2, '', 120, 66),
        N('validate', 435, 88, 'Validate package', 'shape + limits', 3, '', 120, 66),
        N('provenance', 570, 88, 'Attach provenance', 'scope + source', 4, '', 125, 66),
        N('collision', 710, 88, 'Resolve collisions', 'declared policy', 5, 'decision', 120, 66),
        N('budget', 845, 38, 'Apply budget', 'bounded catalog', 6, '', 120, 62),
        N('publish', 845, 148, 'Publish entry', 'name + description + path', 7, '', 120, 62)
      ],
      edges: [
        E('roots', 'enumerate', 1), E('enumerate', 'entry', 2), E('entry', 'validate', 3), E('validate', 'provenance', 4),
        E('provenance', 'collision', 5), E('collision', 'budget', 6), E('budget', 'publish', 7)
      ],
      steps: [
        S('Start with declared roots', 'Discovery scope is runtime policy, not a package property.', ['roots']),
        S('Preserve package boundaries', 'Inspect immediate skill directories instead of publishing every nested example.', ['enumerate']),
        S('Locate one entry point', 'A directory becomes a candidate only when SKILL.md is present where expected.', ['entry']),
        S('Validate before visibility', 'Malformed packages should not consume catalog space.', ['validate']),
        S('Carry source identity', 'Scope and provenance make duplicate names diagnosable.', ['provenance']),
        S('Resolve names by policy', 'Keep, qualify, reject, or choose precedence explicitly.', ['collision']),
        S('Budget the exact serialization', 'Catalog size belongs to the host and active context is a separate budget.', ['budget']),
        S('Publish compact metadata', 'The model sees routing identity, not the full package tree.', ['publish'])
      ],
      caption: 'Discovery is a deterministic compilation process. Preserve rejected and shadowed candidates in diagnostics.'
    }),

    'skill-disclosure-levels': makeFigure({
      title: 'Three disclosure levels',
      hint: 'admit context only when the task earns it',
      description: 'Three stacked levels show catalog metadata, the active SKILL.md body, and branch-specific resources.',
      viewBox: '0 0 760 470',
      zones: [Z(65, 30, 630, 390, 'context admitted for one task')],
      nodes: [
        N('level1', 150, 62, 'Level 1: catalog metadata', 'name + description', 0, '', 460, 72),
        N('level2', 150, 184, 'Level 2: SKILL.md body', 'workflow + decision map', 1, '', 460, 72),
        N('level3', 150, 306, 'Level 3: supporting resources', 'references + scripts + assets', 2, '', 460, 72)
      ],
      edges: [E('level1', 'level2', 1, 'skill selected'), E('level2', 'level3', 2, 'branch requires detail')],
      steps: [
        S('Level 1 routes', 'Name and description let the model distinguish eligible skills without loading their bodies.', ['level1']),
        S('Level 2 starts work', 'Activation loads enough procedure to choose a branch and begin safely.', ['level2']),
        S('Level 3 supplies exact detail', 'Only the selected branch earns references, scripts, or assets in context.', ['level3'])
      ],
      caption: 'Progressive disclosure is staged context admission, not permission escalation.'
    }),

    'skill-reference-map': makeFigure({
      title: 'One-hop reference map',
      hint: 'make every branch directly reachable',
      description: 'SKILL.md points directly to Python, container, documentation, and report-template references.',
      viewBox: '0 0 760 390',
      nodes: [
        N('skill', 300, 42, 'SKILL.md', 'decision map', 0, '', 160, 62),
        N('python', 30, 245, 'python-release.md', 'Python branch', 1, '', 155, 62),
        N('container', 210, 245, 'container-release.md', 'image branch', 1, '', 165, 62),
        N('docs', 405, 245, 'docs-release.md', 'documentation branch', 1, '', 145, 62),
        N('template', 575, 245, 'report-template.md', 'output contract', 1, '', 155, 62)
      ],
      edges: [E('skill', 'python', 1, 'Python'), E('skill', 'container', 1, 'container'), E('skill', 'docs', 1, 'docs'), E('skill', 'template', 1, 'all branches')],
      steps: [
        S('The body is the map', 'Activation should reveal the default workflow and every load condition.', ['skill']),
        S('Branches point one hop away', 'Direct links make resource reachability observable and keep unrelated guides unloaded.', ['python', 'container', 'docs', 'template'])
      ],
      caption: 'A direct decision map beats a topic dump. Every supporting file should have a stated load condition.'
    }),

    'skill-resource-containment': makeFigure({
      title: 'Resource containment gate',
      hint: 'resolve the real target before reading',
      description: 'A decision tree rejects absolute paths, parent traversal, symlink escape, wrong file types, and oversized resources.',
      viewBox: '0 0 940 590',
      nodes: [
        N('request', 35, 60, 'Requested path', 'relative package input', 0, '', 145, 62),
        N('escape', 225, 60, 'Absolute or parent escape?', '../ or /root', 1, 'decision', 170, 62),
        N('reject1', 470, 18, 'Reject', 'invalid input shape', 2, 'warning', 125, 52),
        N('resolve', 470, 105, 'Resolve path', 'real package root', 2, '', 140, 60),
        N('inside', 650, 105, 'Target under root?', 'after symlinks', 3, 'decision', 150, 62),
        N('reject2', 815, 45, 'Reject', 'escaped root', 4, 'warning', 110, 52),
        N('type', 650, 230, 'Expected file type?', 'regular allowed file', 4, 'decision', 150, 62),
        N('reject3', 815, 230, 'Reject', 'wrong or special file', 5, 'warning', 110, 52),
        N('limit', 455, 350, 'Within size limit?', 'bounded context read', 5, 'decision', 155, 62),
        N('reject4', 670, 390, 'Reject', 'oversized resource', 6, 'warning', 130, 52),
        N('load', 255, 455, 'Load resource', 'record reason + bytes', 6, '', 150, 62)
      ],
      edges: [
        E('request', 'escape', 1), E('escape', 'reject1', 2, 'yes', 'warning'), E('escape', 'resolve', 2, 'no'),
        E('resolve', 'inside', 3), E('inside', 'reject2', 4, 'no', 'warning'), E('inside', 'type', 4, 'yes'),
        E('type', 'reject3', 5, 'no', 'warning'), E('type', 'limit', 5, 'yes'),
        E('limit', 'reject4', 6, 'no', 'warning'), E('limit', 'load', 6, 'yes')
      ],
      steps: [
        S('Start with an untrusted relative path', 'The request is data until containment proves otherwise.', ['request']),
        S('Reject obvious escape syntax', 'Absolute paths and parent segments never reach filesystem resolution.', ['escape']),
        S('Resolve against the package root', 'String prefixes cannot detect symlink or normalization escapes.', ['reject1', 'resolve']),
        S('Compare resolved locations', 'The real target must remain inside the real package root.', ['inside']),
        S('Check operation and file type', 'Containment alone does not make sockets, devices, or wrong suffixes valid.', ['reject2', 'type']),
        S('Bound context admission', 'Reject unexpected types and files above the declared size limit.', ['reject3', 'limit']),
        S('Load with evidence or reject', 'Record the resource, branch reason, and byte count without logging secrets.', ['reject4', 'load'])
      ],
      caption: 'Resolved containment protects the package boundary. It does not prove the in-package content is trustworthy.'
    }),

    'skill-invocation-stages': makeFigure({
      title: 'Five invocation stages',
      hint: 'name the exact boundary that failed',
      description: 'A state path from discovered to completed with denied, not-selected, and blocked exits.',
      viewBox: '0 0 940 470',
      nodes: [
        N('discovered', 25, 75, 'Discovered', 'package exists', 0, '', 125, 60),
        N('eligible', 180, 75, 'Eligible', 'actor + policy allow', 1, '', 130, 60),
        N('selected', 340, 75, 'Selected', 'host identity or description', 2, '', 130, 60),
        N('activated', 500, 75, 'Activated', 'body in context', 3, '', 130, 60),
        N('executing', 660, 75, 'Executing', 'work begins', 4, '', 130, 60),
        N('completed', 820, 75, 'Completed', 'output verified', 5, '', 105, 60),
        N('denied', 180, 245, 'Denied', 'actor or policy blocks', 1, 'warning', 130, 58),
        N('notselected', 340, 330, 'Not selected', 'threshold not met', 2, 'warning', 130, 58),
        N('blocked', 500, 245, 'Blocked', 'capability or approval absent', 4, 'warning', 150, 58)
      ],
      edges: [
        E('discovered', 'eligible', 1), E('discovered', 'denied', 1, 'blocked by policy', 'warning'),
        E('eligible', 'selected', 2), E('eligible', 'notselected', 2, 'router abstains', 'warning'),
        E('selected', 'activated', 3), E('activated', 'executing', 4), E('activated', 'blocked', 4, 'missing authority', 'warning'),
        E('executing', 'completed', 5)
      ],
      steps: [
        S('Discovered', 'The package exists in a configured scope. No actor has used it yet.', ['discovered']),
        S('Eligible or denied', 'Policy decides whether this actor may request the skill.', ['eligible', 'denied']),
        S('Selected or not selected', 'A host resolves explicit identity. Model routing compares catalog descriptions and may abstain.', ['selected', 'notselected']),
        S('Activated', 'The body enters working context. This is still not tool execution.', ['activated']),
        S('Executing or blocked', 'Work begins only when capability, permission, and approval are available.', ['executing', 'blocked']),
        S('Completed', 'Independent verification turns an attempted workflow into a completed one.', ['completed'])
      ],
      caption: 'A single skill_used flag hides the boundary where routing, policy, capability, or verification failed.'
    }),

    'skill-routing-abstention': makeFigure({
      title: 'Routing with abstention',
      hint: 'filter policy before comparing relevance',
      description: 'A request passes actor eligibility and description comparison before a clear-match decision can activate, ask, or abstain.',
      viewBox: '0 0 800 500',
      nodes: [
        N('request', 40, 55, 'User request', 'task context', 0, '', 145, 60),
        N('eligible', 235, 55, 'Filter eligibility', 'actor + host policy', 1, '', 155, 60),
        N('compare', 445, 55, 'Compare descriptions', 'eligible catalog only', 2, '', 170, 60),
        N('clear', 445, 180, 'One clear match?', 'threshold + margin', 3, 'decision', 170, 62),
        N('activate', 75, 350, 'Activate skill', 'clear eligible winner', 4, '', 155, 60),
        N('ask', 320, 350, 'Ask or reason normally', 'ambiguous near match', 4, 'warning', 180, 60),
        N('none', 590, 350, 'Do not activate', 'no match', 4, 'warning', 155, 60)
      ],
      edges: [
        E('request', 'eligible', 1), E('eligible', 'compare', 2), E('compare', 'clear', 3),
        E('clear', 'activate', 4, 'yes'), E('clear', 'ask', 4, 'ambiguous', 'warning'), E('clear', 'none', 4, 'no match', 'warning')
      ],
      steps: [
        S('Begin with the request', 'Routing should preserve the task, not merely count keywords.', ['request']),
        S('Filter by authority first', 'A blocked top match must not suppress a lower-scored eligible candidate.', ['eligible']),
        S('Compare bounded descriptions', 'Capability, trigger, context, and exclusions shape relevance.', ['compare']),
        S('Require a clear winner', 'The best eligible score still needs a threshold and ambiguity margin.', ['clear']),
        S('Activate, ask, or abstain', 'No selection is a deliberate result when evidence is weak.', ['activate', 'ask', 'none'])
      ],
      caption: 'The router ranks only eligible skills and keeps an explicit abstain path.'
    }),

    'skill-argument-boundaries': makeFigure({
      title: 'Argument boundary transformations',
      hint: 'preserve intent without executing text',
      description: 'User text becomes parsed arguments, skill context, a typed tool call, and validated execution input.',
      viewBox: '0 0 860 270',
      zones: [Z(15, 30, 830, 190, 'text becomes data, then typed input')],
      nodes: [
        N('text', 35, 92, 'User text', 'quoted request', 0, '', 135, 62),
        N('parser', 200, 92, 'Host parser', 'syntax + quoting', 1, '', 135, 62),
        N('bound', 365, 92, 'Bound arguments', 'validated values', 2, '', 140, 62),
        N('context', 535, 92, 'Skill context', 'procedure sees data', 3, '', 135, 62),
        N('tool', 700, 92, 'Typed tool call', 'schema validates again', 4, '', 135, 62)
      ],
      edges: [E('text', 'parser', 1), E('parser', 'bound', 2), E('bound', 'context', 3), E('context', 'tool', 4)],
      steps: [
        S('User text is not a command string', 'Keep the original intent and quoting visible.', ['text']),
        S('The host owns command syntax', 'Slash commands, variables, and quoting belong to the adapter.', ['parser']),
        S('Bind and validate values', 'Required arguments, defaults, and allowed shapes become explicit data.', ['bound']),
        S('Instructions consume data', 'The skill chooses a branch without interpolating raw text into a shell.', ['context']),
        S('Typed tools validate again', 'Crossing into execution requires a schema and a bounded argument vector.', ['tool'])
      ],
      caption: 'Every representation boundary should validate values without treating user-controlled text as code.'
    }),

    'skill-host-adapter': makeFigure({
      title: 'Portable core and host adapter',
      hint: 'keep extensions outside the core contract',
      description: 'A portable skill bundle and a host adapter contribute different inputs to one runtime activation boundary.',
      viewBox: '0 0 860 500',
      zones: [Z(25, 35, 365, 390, 'portable package'), Z(470, 35, 365, 390, 'host adapter')],
      nodes: [
        N('bundle', 130, 70, 'Portable bundle', 'cross-host directory', 0, '', 155, 60),
        N('skill', 55, 180, 'SKILL.md', 'core procedure', 1, '', 130, 58),
        N('refs', 205, 180, 'references/', 'branch detail', 1, '', 130, 58),
        N('scripts', 130, 285, 'scripts/', 'helpers', 1, '', 130, 58),
        N('adapter', 575, 70, 'Host adapter', 'runtime-specific code', 2, '', 155, 60),
        N('discovery', 495, 180, 'Discovery path', 'where to search', 3, '', 135, 58),
        N('api', 650, 180, 'Activation API', 'how to load', 3, '', 135, 58),
        N('policy', 495, 285, 'Invocation policy', 'who may select', 3, '', 135, 58),
        N('binding', 650, 285, 'Argument binding', 'host syntax', 3, '', 135, 58),
        N('runtime', 345, 425, 'Runtime activation', 'core + adapter semantics', 4, '', 170, 58)
      ],
      edges: [
        E('bundle', 'skill', 1), E('bundle', 'refs', 1), E('bundle', 'scripts', 1),
        E('adapter', 'discovery', 3), E('adapter', 'api', 3), E('adapter', 'policy', 3), E('adapter', 'binding', 3),
        E('bundle', 'runtime', 4), E('adapter', 'runtime', 4)
      ],
      steps: [
        S('Preserve a portable package', 'The entry file and companions should remain intelligible without one host.', ['bundle']),
        S('Keep core responsibilities together', 'Procedure, references, and helpers travel as one directory.', ['skill', 'refs', 'scripts']),
        S('Name the adapter', 'Runtime semantics need an explicit compatibility layer.', ['adapter']),
        S('Host behavior stays host-specific', 'Discovery, activation APIs, policy fields, and argument syntax belong here.', ['discovery', 'api', 'policy', 'binding']),
        S('Compose at the runtime boundary', 'The adapter activates the portable bundle without rewriting its core claims.', ['runtime'])
      ],
      caption: 'Do not promote one host field into a fake universal standard. Test the adapter that gives it meaning.'
    }),

    'skill-authority-chain': makeFigure({
      title: 'Authority and execution chain',
      hint: 'activation proposes, the host authorizes',
      description: 'An activated skill influences a model proposal that must pass capability, permission, approval, isolation, and verification.',
      viewBox: '0 0 980 330',
      nodes: [
        N('skill', 20, 105, 'Activated skill', 'procedural context', 0, '', 125, 62),
        N('model', 165, 105, 'Model proposal', 'structured action', 1, '', 125, 62),
        N('capability', 310, 105, 'Capability registry', 'operation exists', 2, '', 135, 62),
        N('permission', 465, 105, 'Permission policy', 'actor + target', 3, '', 130, 62),
        N('approval', 615, 105, 'Approval needed?', 'consequence gate', 4, 'decision', 135, 62),
        N('executor', 775, 55, 'Isolated executor', 'bounded reach', 5, '', 140, 62),
        N('stop', 775, 200, 'Stop and report', 'approval denied', 5, 'warning', 140, 58),
        N('observe', 20, 245, 'Observation', 'execution evidence', 6, '', 125, 58),
        N('verify', 180, 245, 'Verification gate', 'contract passes', 7, '', 135, 58)
      ],
      edges: [
        E('skill', 'model', 1), E('model', 'capability', 2), E('capability', 'permission', 3), E('permission', 'approval', 4),
        E('approval', 'executor', 5, 'allowed or granted'), E('approval', 'stop', 5, 'denied', 'warning'),
        E('executor', 'observe', 6, '', '', [[845, 117], [930, 117], [930, 275], [145, 275]]), E('observe', 'verify', 7)
      ],
      steps: [
        S('Activation changes context', 'The skill can influence a proposal but grants no authority.', ['skill']),
        S('Represent the action', 'Review argv, cwd, paths, network, credentials, and side effects before execution.', ['model']),
        S('Expose only needed capabilities', 'An absent operation cannot be requested through the host.', ['capability']),
        S('Authorize actor and target', 'Permission policy constrains this operation and scope.', ['permission']),
        S('Ask for the actual consequence', 'Approval is meaningful only when target and effect are concrete.', ['approval']),
        S('Execute or stop', 'Granted authority still runs inside isolation. Denial produces no side effect.', ['executor', 'stop']),
        S('Capture observations', 'Exit codes, diffs, files, and tool results become evidence.', ['observe']),
        S('Verify independently', 'Containment and authorization do not prove the result is correct.', ['verify'])
      ],
      caption: 'Capability, permission, approval, sandbox, and verification protect different properties. Keep every layer visible.'
    }),

    'skill-trust-surface': makeFigure({
      title: 'Complete skill trust surface',
      hint: 'mark who controls every edge',
      description: 'Package instructions, references, task content, scripts, host tools, files, network, credentials, and external effects form one threat surface.',
      viewBox: '0 0 900 560',
      nodes: [
        N('package', 30, 55, 'Skill package', 'publisher-controlled', 0, '', 145, 60),
        N('resources', 30, 150, 'References + assets', 'supporting content', 0, '', 145, 60),
        N('untrusted', 30, 245, 'Untrusted task content', 'issue, web, document', 0, 'warning', 160, 60),
        N('instructions', 260, 135, 'Model instructions', 'mixed trust context', 1, 'decision', 160, 66),
        N('scripts', 260, 285, 'Scripts + dependencies', 'code supply chain', 2, 'warning', 160, 64),
        N('requests', 485, 190, 'Requested actions', 'structured proposal', 3, 'decision', 160, 66),
        N('host', 690, 190, 'Host tools + executor', 'enforcement point', 4, '', 170, 66),
        N('files', 620, 355, 'Files', 'read + write', 5, '', 110, 54),
        N('network', 750, 355, 'Network', 'egress', 5, 'warning', 110, 54),
        N('credentials', 620, 455, 'Environment + credentials', 'secret scope', 5, 'warning', 150, 58),
        N('effects', 780, 455, 'External effects', 'publish, delete, bill', 5, 'warning', 110, 58)
      ],
      edges: [
        E('package', 'instructions', 1), E('resources', 'instructions', 1), E('untrusted', 'instructions', 1, 'data, not authority', 'warning'),
        E('instructions', 'requests', 3), E('scripts', 'requests', 3), E('requests', 'host', 4),
        E('host', 'files', 5), E('host', 'network', 5, '', 'warning'), E('host', 'credentials', 5, '', 'warning'), E('host', 'effects', 5, '', 'warning')
      ],
      steps: [
        S('Inventory every content source', 'Package files and task inputs can all influence the model, but they carry different authority.', ['package', 'resources', 'untrusted']),
        S('Separate data from instructions', 'Prompt injection happens when untrusted content crosses this boundary.', ['instructions']),
        S('Inspect code supply chains', 'Scripts and dependencies can request effects without appearing in prose.', ['scripts']),
        S('Structure the proposed action', 'Review the operation before any executor begins.', ['requests']),
        S('Enforce at the host boundary', 'The model cannot provide its own isolation or permission policy.', ['host']),
        S('Constrain every consequence surface', 'Files, network, credentials, and external effects need separate policies.', ['files', 'network', 'credentials', 'effects'])
      ],
      caption: 'Trust is a chain of claims across package source, content, runtime, capability, isolation, credentials, and evidence.'
    }),

    'skill-approval-decision': makeFigure({
      title: 'Approval follows consequence',
      hint: 'decide from reversibility, scope, and impact',
      description: 'A decision tree routes local reversible actions to sandbox execution, out-of-scope actions to approval, and denied approvals to stop.',
      viewBox: '0 0 900 570',
      nodes: [
        N('action', 35, 65, 'Proposed action', 'target + consequence', 0, '', 145, 60),
        N('reversible', 225, 65, 'Reversible + local?', 'rollback possible', 1, 'decision', 165, 62),
        N('scope', 470, 35, 'Inside pre-approved scope?', 'actor + operation + target', 2, 'decision', 185, 62),
        N('impact', 470, 180, 'External, destructive, costly, or sensitive?', 'high consequence', 2, 'decision', 205, 76),
        N('execute', 700, 35, 'Execute in sandbox', 'containment remains', 3, '', 165, 62),
        N('ask', 700, 220, 'Ask scoped approval', 'show exact consequence', 3, 'warning', 165, 62),
        N('granted', 500, 360, 'Granted', 'immutable action record', 4, '', 135, 58),
        N('denied', 700, 360, 'Denied', 'stop', 4, 'warning', 135, 58),
        N('result', 500, 470, 'Bounded execution', 'revalidate + verify', 5, '', 160, 60)
      ],
      edges: [
        E('action', 'reversible', 1), E('reversible', 'scope', 2, 'yes'), E('reversible', 'impact', 2, 'no'),
        E('scope', 'execute', 3, 'yes'), E('scope', 'ask', 3, 'no', 'warning'), E('impact', 'ask', 3, 'yes', 'warning'), E('impact', 'execute', 3, 'no'),
        E('ask', 'granted', 4, 'granted'), E('ask', 'denied', 4, 'denied', 'warning'),
        E('execute', 'result', 5), E('granted', 'result', 5)
      ],
      steps: [
        S('Name the action', 'Approval cannot be evaluated from a vague request to allow a general shell.', ['action']),
        S('Check reversibility and locality', 'Local reversible actions can often fit pre-authorized policy.', ['reversible']),
        S('Check scope or consequence', 'Out-of-scope or high-impact work needs a deliberate authority decision.', ['scope', 'impact']),
        S('Execute or ask', 'Approval is not a substitute for sandboxing, and sandboxing is not approval.', ['execute', 'ask']),
        S('Honor the decision', 'A grant binds one action. A denial stops it.', ['granted', 'denied']),
        S('Revalidate before launch', 'The executor checks the normalized target again and verifies the result afterward.', ['result'])
      ],
      caption: 'Approval should show the exact target and consequence. It never disables isolation or authorizes later targets.'
    }),

    'skill-workflow-extraction': makeFigure({
      title: 'Judgment and deterministic work',
      hint: 'put each behavior where it can be tested',
      description: 'A task moves through model classification, branch references, deterministic evidence collection, model interpretation, an artifact contract, and verification.',
      viewBox: '0 0 950 300',
      zones: [Z(15, 25, 920, 225, 'observable workflow contract')],
      nodes: [
        N('task', 30, 100, 'Task request', 'trigger boundary', 0, '', 125, 62),
        N('classify', 175, 100, 'Model judgment', 'classify + branch', 1, 'decision', 135, 62),
        N('reference', 330, 100, 'Reference', 'branch-specific rules', 2, '', 135, 62),
        N('script', 485, 100, 'Script or tool', 'collect evidence', 3, '', 135, 62),
        N('interpret', 640, 100, 'Model judgment', 'interpret evidence', 4, 'decision', 135, 62),
        N('artifact', 795, 55, 'Artifact contract', 'required output', 5, '', 135, 62),
        N('verify', 795, 160, 'Verification', 'machine + human', 6, '', 135, 62)
      ],
      edges: [E('task', 'classify', 1), E('classify', 'reference', 2), E('reference', 'script', 3), E('script', 'interpret', 4), E('interpret', 'artifact', 5), E('artifact', 'verify', 6)],
      steps: [
        S('Start from a real trigger', 'A workflow candidate begins with a bounded event and desired artifact.', ['task']),
        S('Use judgment for ambiguity', 'The model classifies the task and chooses a branch.', ['classify']),
        S('Load exact domain rules', 'References supply detail only for the selected branch.', ['reference']),
        S('Automate deterministic evidence', 'Scripts and typed tools parse, count, query, and validate.', ['script']),
        S('Interpret the observations', 'The model synthesizes evidence instead of simulating deterministic parsing.', ['interpret']),
        S('Write to an artifact contract', 'Required fields and paths turn completion into an observable claim.', ['artifact']),
        S('Verify by another mechanism', 'Machine checks and calibrated human review close the workflow.', ['verify'])
      ],
      caption: 'Use model judgment for classification and synthesis. Use code for repeatable computation and invariants.'
    }),

    'skill-eval-layers': makeFigure({
      title: 'Six-layer skill release gate',
      hint: 'do not average away a hard failure',
      description: 'Six evaluation layers feed a release gate: structure, routing, behavior, scripts, safety, and portability.',
      viewBox: '0 0 780 590',
      nodes: [
        N('structure', 210, 35, '1. Package structure', 'static contract', 0, '', 360, 58),
        N('routing', 210, 115, '2. Trigger routing', 'precision + recall + abstain', 1, '', 360, 58),
        N('behavior', 210, 195, '3. Artifact behavior', 'baseline vs treatment', 2, '', 360, 58),
        N('scripts', 210, 275, '4. Script correctness', 'fixtures + edge cases', 3, '', 360, 58),
        N('safety', 210, 355, '5. Safety + authority', 'hard boundary cases', 4, 'warning', 360, 58),
        N('portability', 210, 435, '6. Packaging + portability', 'clean install + host matrix', 5, '', 360, 58),
        N('gate', 270, 520, 'Release gate', 'all required layers pass', 6, 'decision', 240, 52)
      ],
      edges: [E('structure', 'routing', 1), E('routing', 'behavior', 2), E('behavior', 'scripts', 3), E('scripts', 'safety', 4), E('safety', 'portability', 5), E('portability', 'gate', 6)],
      steps: [
        S('Structure', 'Lint package identity, files, links, limits, and required sections.', ['structure']),
        S('Routing', 'Measure positives, negatives, near misses, competing skills, and abstention.', ['routing']),
        S('Behavior', 'Compare the same model, tools, fixtures, and budgets with and without the skill.', ['behavior']),
        S('Scripts', 'Test deterministic helpers outside model runs, including repeated and partial state.', ['scripts']),
        S('Safety', 'Require every authority and containment case to pass. Strong prose cannot cancel a violation.', ['safety']),
        S('Packaging and portability', 'Install the complete tree and test required host capabilities or declared fallbacks.', ['portability']),
        S('Release only through the gate', 'Report the failing layer and evidence instead of collapsing everything into one score.', ['gate'])
      ],
      caption: 'Each eval layer answers a different question. Passing one never substitutes for another.'
    }),

    'skill-package-install': makeFigure({
      title: 'Clean install integrity path',
      hint: 'test the installed tree, not only the source',
      description: 'A source skill bundle becomes a manifest, complete installed tree, verified package, discovered catalog entry, and eval smoke test.',
      viewBox: '0 0 900 270',
      nodes: [
        N('source', 25, 92, 'Source bundle', 'reviewed tree', 0, '', 135, 62),
        N('manifest', 190, 92, 'Build manifest', 'canonical paths + hashes', 1, '', 140, 62),
        N('install', 360, 92, 'Install complete tree', 'clean destination', 2, '', 145, 62),
        N('hash', 535, 92, 'Verify paths + hashes', 'detect loss or drift', 3, '', 145, 62),
        N('discover', 710, 45, 'Discover installed skill', 'real scope', 4, '', 160, 62),
        N('smoke', 710, 155, 'Run eval smoke test', 'installed copy', 5, '', 160, 62)
      ],
      edges: [E('source', 'manifest', 1), E('manifest', 'install', 2), E('install', 'hash', 3), E('hash', 'discover', 4), E('discover', 'smoke', 5)],
      steps: [
        S('Begin with the complete source tree', 'The release unit includes every referenced file, script, asset, and fixture.', ['source']),
        S('Describe the intended bytes', 'Canonical relative paths and hashes make drift observable.', ['manifest']),
        S('Install into an empty destination', 'A clean tree exposes omitted files and stale upgrade leftovers.', ['install']),
        S('Verify before activation', 'Reject missing, added, rewritten, or mismatched package files.', ['hash']),
        S('Probe real discovery', 'The installed scope and host catalog must find the expected identity.', ['discover']),
        S('Execute the installed smoke test', 'Source-only success cannot prove installer or runtime behavior.', ['smoke'])
      ],
      caption: 'Package tests should exercise the installed copy. Source-tree tests miss installer and upgrade failures.'
    }),

    'skill-authoring-loop': makeFigure({
      title: 'Skill authoring repair loop',
      hint: 'change the layer responsible for the failure',
      description: 'A workflow is observed, contracted, packaged, evaluated, classified by failure layer, repaired, and released only after the gate passes.',
      viewBox: '0 0 980 610',
      nodes: [
        N('observe', 30, 55, 'Observe workflow', 'real expert practice', 0, '', 145, 60),
        N('contract', 210, 55, 'Define contract', 'trigger + artifact + safety', 1, '', 145, 60),
        N('package', 390, 55, 'Package procedure', 'body + helpers', 2, '', 145, 60),
        N('eval', 570, 55, 'Run layered evals', 'repeat + compare', 3, '', 145, 60),
        N('failure', 750, 55, 'Failure class?', 'route repair correctly', 4, 'decision', 155, 60),
        N('routing', 50, 250, 'Routing', 'description or policy', 5, '', 135, 58),
        N('behavior', 210, 250, 'Behavior', 'body, refs, tools', 5, '', 135, 58),
        N('script', 370, 250, 'Script', 'deterministic code', 5, '', 135, 58),
        N('safety', 530, 250, 'Safety', 'authority + isolation', 5, 'warning', 135, 58),
        N('portability', 690, 250, 'Portability', 'adapter or fallback', 5, '', 135, 58),
        N('reeval', 370, 400, 'Re-run affected evals', 'preserve all traces', 6, '', 170, 60),
        N('release', 625, 500, 'Release complete bundle', 'gate passed', 7, '', 190, 60)
      ],
      edges: [
        E('observe', 'contract', 1), E('contract', 'package', 2), E('package', 'eval', 3), E('eval', 'failure', 4),
        E('failure', 'routing', 5, 'routing'), E('failure', 'behavior', 5, 'behavior'), E('failure', 'script', 5, 'script'),
        E('failure', 'safety', 5, 'safety', 'warning'), E('failure', 'portability', 5, 'portability'),
        E('routing', 'reeval', 6), E('behavior', 'reeval', 6), E('script', 'reeval', 6), E('safety', 'reeval', 6), E('portability', 'reeval', 6),
        E('reeval', 'eval', 6, 'new evidence', '', [[455, 400], [455, 355], [642, 355], [642, 115]]),
        E('failure', 'release', 7, 'passes gate')
      ],
      steps: [
        S('Observe real work', 'Extract a stable procedure from evidence, not from a broad topic label.', ['observe']),
        S('Define the observable contract', 'Write trigger, artifact, verification, and authority boundaries first.', ['contract']),
        S('Package each responsibility', 'Put judgment, deterministic work, references, and outputs in testable places.', ['package']),
        S('Run layered evals', 'Keep routing, behavior, scripts, safety, and portability as separate evidence.', ['eval']),
        S('Classify the failure', 'A release gate should identify the layer that actually broke.', ['failure']),
        S('Repair the responsible layer', 'Do not add prose when the failure is an installer, script, sandbox, or host adapter.', ['routing', 'behavior', 'script', 'safety', 'portability']),
        S('Re-run with new evidence', 'Preserve per-run traces and check for regressions in untouched layers.', ['reeval']),
        S('Release only after the gate passes', 'Ship the complete bundle and its compatibility evidence together.', ['release'])
      ],
      caption: 'Repair the layer responsible for the failure, then repeat the gate. Never let an average hide a hard safety regression.'
    })
  };

  LF.register(figures);
})();
