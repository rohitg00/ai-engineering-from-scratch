/* figures-claude-certifications.js: interactive mechanism labs for the Claude
   certification curriculum. Loads after lesson-figures.js and topic figure
   modules, then registers through window.LF. Vanilla ES5, no dependencies. */
(function () {
  'use strict';

  var LF = window.LF;
  if (!LF) return;

  var el = LF.el;
  var svgEl = LF.svgEl;
  var slider = LF.slider;
  var select = LF.select;
  var clamp = LF.clamp;
  var INK = 'var(--ink,#1a1a1a)';
  var MUTE = 'var(--ink-mute,#777)';
  var BP = 'var(--blueprint,#3553ff)';
  var BG = 'var(--bg,#fafaf5)';
  var SURF = 'var(--bg-surface,#eee)';
  var RULE = 'var(--rule-soft,#ddd)';
  var WARN = 'var(--warn,#b8870f)';
  var STRONG = { 'text-anchor': 'middle', 'font-weight': 700 };
  var SMALL = { 'font-size': 10 };
  var VALUE = { 'text-anchor': 'end', 'font-weight': 700 };

  function ensureStyles() {
    if (document.getElementById('cert-figure-styles')) return;
    var style = document.createElement('style');
    style.id = 'cert-figure-styles';
    style.textContent = [
      '.cf-status{font-family:var(--font-display,monospace);font-size:clamp(2rem,7vw,3.4rem);line-height:1;color:var(--blueprint,#3553ff)}',
      '.cf-status small{display:block;margin-top:8px;font-family:var(--font-mono,monospace);font-size:.68rem;line-height:1.45;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-soft,#555)}',
      '.cf-lanes{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:14px}',
      '.cf-lane{padding:10px;border:1px solid var(--rule-soft,#ddd);font-family:var(--font-mono,monospace);font-size:.68rem;text-align:center;color:var(--ink-mute,#777)}',
      '.cf-lane.is-active{border-color:var(--blueprint,#3553ff);background:var(--blueprint-tint,rgba(53,83,255,.08));color:var(--blueprint,#3553ff)}',
      '.lesson-figure .lf-out svg.cf-strip{max-width:460px;margin:0 auto 14px}',
      '@media(max-width:640px){.cf .lf-head{flex-direction:column;align-items:flex-start;gap:4px}.cf-lanes{grid-template-columns:1fr}.lesson-figure .lf-out svg.cf-strip{width:calc(100% + 24px);max-width:none;margin:0 -12px 14px}}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function shell(host, config, controls, output) {
    ensureStyles();
    host.setAttribute('data-static-time', '3.2');
    host.appendChild(el('div', { class: 'lf cf' }, [
      el('div', { class: 'lf-head' }, [
        el('span', { class: 'lf-label' }, [config.title]),
        el('span', {}, [config.hint])
      ]),
      el('div', { class: 'lf-body' }, [controls, output]),
      el('div', { class: 'lf-cap' }, [config.caption])
    ]));
  }

  function anim(attr, values, dur, extra) {
    var attrs = { attributeName: attr, values: values, dur: dur + 's', repeatCount: 'indefinite' };
    for (var key in extra) attrs[key] = extra[key];
    return svgEl(extra && extra.type ? 'animateTransform' : 'animate', attrs);
  }

  function add(svg, tag, attrs) {
    return svg.appendChild(svgEl(tag, attrs));
  }

  function txt(svg, x, y, s, fill, extra) {
    var attrs = { x: x, y: y, fill: fill || MUTE };
    for (var key in extra) attrs[key] = extra[key];
    return svg.appendChild(svgEl('text', attrs, [document.createTextNode(s)]));
  }

  function packet(svg, d, a, b, dur) {
    var t = '0;' + a + ';' + b + ';1';
    var dot = add(svg, 'circle', { r: 4, fill: BP, stroke: BG, 'stroke-width': 1.5, opacity: '0' });
    dot.appendChild(anim('opacity', '0;1;0;0', dur, { calcMode: 'discrete', keyTimes: t }));
    dot.appendChild(svgEl('animateMotion', { path: d, dur: dur + 's', repeatCount: 'indefinite', calcMode: 'linear', keyPoints: '0;0;1;1', keyTimes: t }));
  }

  function link(svg, d, a, b) {
    add(svg, 'path', { d: d, fill: 'none', stroke: RULE, 'stroke-width': 1.4 });
    packet(svg, d, a, b, 4);
  }

  function flowIn(svg, values, cy) {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    values.forEach(function (value, i) {
      var y = cy + (i - (values.length - 1) / 2) * 24;
      add(svg, 'rect', { x: 2, y: y - 10, width: 70, height: 20, rx: 10, fill: SURF, stroke: RULE });
      txt(svg, 37, y + 4, String(value), INK, STRONG);
      link(svg, 'M72 ' + y + 'C96 ' + y + ' 94 ' + cy + ' 118 ' + cy, (0.06 + i * 0.06).toFixed(2), (0.26 + i * 0.06).toFixed(2));
    });
    add(svg, 'circle', { cx: 132, cy: cy, r: 14, fill: BG, stroke: BP, 'stroke-width': 1.6 });
    txt(svg, 132, cy + 4, 'f', BP, STRONG);
  }

  function fill(svg, y, w, h, color, a) {
    add(svg, 'path', { d: 'M160 ' + (y + h / 2) + 'h' + w, stroke: color, 'stroke-width': h, 'stroke-dasharray': w + ' 999' })
      .appendChild(anim('stroke-dashoffset', w + ';' + w + ';0;0;' + w, 4, {
        calcMode: 'spline', keyTimes: '0;' + a + ';' + (a + 0.2).toFixed(2) + ';0.94;1',
        keySplines: '0 0 1 1;0.23 1 0.32 1;0 0 1 1;0.4 0 1 1'
      }));
  }

  function gauge(svg, name, percent, color, marks, zones) {
    var value = clamp(Math.round(percent), 0, 100);
    link(svg, 'M146 36H160', 0.34, 0.4);
    txt(svg, 160, 20, name, MUTE, SMALL);
    txt(svg, 318, 40, value + '%', color, VALUE);
    add(svg, 'rect', { x: 160, y: 28, width: 126, height: 16, fill: RULE, 'fill-opacity': 0.6 });
    (zones || []).forEach(function (zone) {
      add(svg, 'rect', { x: 160 + zone[0] * 1.26, y: 28, width: (zone[1] - zone[0]) * 1.26, height: 16, fill: zone[2], 'fill-opacity': 0.3 });
    });
    fill(svg, 32, value * 1.26, 8, color, 0.42);
    marks.forEach(function (mark) {
      add(svg, 'path', { d: 'M' + (160 + mark * 1.26) + ' 24V48', stroke: INK });
      txt(svg, 160 + mark * 1.26, 62, String(mark), MUTE, { 'text-anchor': 'middle' });
    });
  }

  function stageRail(svg, steps, step) {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    var gap = 272 / (steps.length - 1);
    var end = 24 + step * gap;
    add(svg, 'path', { d: 'M24 30H296', stroke: RULE, 'stroke-width': 2 });
    add(svg, 'path', { d: 'M24 30H' + end, stroke: BP, 'stroke-width': 2 });
    steps.forEach(function (item, i) {
      var x = 24 + i * gap;
      var edge = i === 0 ? 'start' : i === steps.length - 1 ? 'end' : 'middle';
      add(svg, 'circle', { cx: x, cy: 30, r: 9, fill: i <= step ? BP : SURF, stroke: i <= step ? BP : RULE });
      txt(svg, x, 34, String(i + 1), i <= step ? BG : MUTE, STRONG);
      txt(svg, edge === 'start' ? 6 : edge === 'end' ? 314 : x, i % 2 ? 58 : 12, item.name, i === step ? BP : MUTE, { 'text-anchor': edge, 'font-weight': i === step ? 700 : 400 });
    });
    var ring = svgEl('circle', { r: 11, fill: 'none', stroke: BP, 'stroke-width': 2 });
    ring.appendChild(anim('transform', '1;1.9', 1.8, { type: 'scale' }));
    ring.appendChild(anim('opacity', '0.8;0', 1.8));
    svg.appendChild(svgEl('g', { transform: 'translate(' + end + ' 30)' }, [ring]));
    if (step) packet(svg, 'M24 30H' + end, 0.05, 0.55, 2.4);
  }

  function lab(host, config, state, controls, parts, render, height) {
    var svg = svgEl('svg', { class: 'cf-strip', viewBox: '0 0 320 ' + height, 'font-family': 'var(--font-mono,monospace)', 'font-size': 11 });
    var status = el('div', { class: 'cf-status', 'aria-live': 'polite' });
    var out = {
      meta: el('div', { class: 'lf-meta' }),
      formula: el('div', { class: 'lf-formula' }),
      say: function (main, detail) { status.innerHTML = main + '<small>' + detail + '</small>'; }
    };
    state._render = function () { render(svg, out); };
    shell(host, config,
      el('div', { class: controls.length > 1 ? 'lf-grid' : '' }, controls.map(function (c) { return slider(state, c[0], c[1], c[2], c[3], c[4]); })),
      el('div', { class: 'lf-out' }, [svg, status].concat(parts, [out.meta, out.formula])));
    state._render();
  }

  function makeDecision(config) {
    return function (host) {
      var state = { a: config.a.defaultValue, b: config.b.defaultValue };
      lab(host, config, state, [['a', config.a.label, 0, 100, 1], ['b', config.b.label, 0, 100, 1]], [], function (svg, out) {
        var scores = config.choices.map(function (choice) {
          return clamp(choice.base + choice.a * ((state.a - 50) / 50) + choice.b * ((state.b - 50) / 50), 0, 100);
        });
        var best = scores.indexOf(Math.max.apply(null, scores));
        flowIn(svg, [state.a, state.b], 42);
        link(svg, 'M146 42C154 42 152 ' + (21 + best * 26) + ' 160 ' + (21 + best * 26), 0.34, 0.42);
        config.choices.forEach(function (choice, i) {
          var value = Math.round(scores[i]);
          var color = i === best ? BP : MUTE;
          txt(svg, 160, 13 + i * 26, choice.name, MUTE, SMALL);
          txt(svg, 310, 13 + i * 26, value + '%', color, { 'text-anchor': 'end', 'font-size': 10, 'font-weight': 700 });
          add(svg, 'rect', { x: 160, y: 18 + i * 26, width: 150, height: 6, fill: RULE, 'fill-opacity': 0.6 });
          fill(svg, 18 + i * 26, value * 1.5, 6, color, 0.42 + i * 0.05);
        });
        out.say(config.choices[best].name, config.choices[best].why);
        out.meta.textContent = config.a.label + ' ' + state.a + '  ·  ' + config.b.label + ' ' + state.b + '  ·  fit ' + Math.round(scores[best]) + '%';
        out.formula.textContent = config.formula;
      }, 84);
    };
  }

  function makeThreshold(config) {
    return function (host) {
      var state = { signal: config.signal.defaultValue, impact: config.impact.defaultValue, cut: config.cut };
      var lanes = config.decisions.map(function (name) { return el('div', { class: 'cf-lane' }, [name]); });
      lab(host, config, state, [
        ['signal', config.signal.label, 0, 100, 1],
        ['impact', config.impact.label, 0, 100, 1],
        ['cut', config.thresholdLabel, 20, 80, 1]
      ], [el('div', { class: 'cf-lanes' }, lanes)], function (svg, out) {
        var value = Math.round(state.signal * config.signalWeight + state.impact * (1 - config.signalWeight));
        var band = state.cut + config.escalationBand;
        var top = Math.min(100, band);
        var index = value < state.cut ? 0 : value < band ? 1 : 2;
        lanes.forEach(function (lane, laneIndex) { lane.classList.toggle('is-active', laneIndex === index); });
        flowIn(svg, [state.signal, state.impact], 36);
        gauge(svg, config.scoreLabel, value, index === 2 ? WARN : BP, [state.cut, top], [[0, state.cut, RULE], [state.cut, top, BP], [top, 100, WARN]]);
        out.say(config.decisions[index], config.reasons[index]);
        out.meta.textContent = config.signal.label + ' ' + state.signal + '  ·  ' + config.impact.label + ' ' + state.impact + '  ·  score ' + value + '  ·  threshold ' + state.cut;
        out.formula.textContent = config.formula;
      }, 68);
    };
  }

  function makePipeline(config) {
    return function (host) {
      var state = { step: 0 };
      var id = LF.uid('cf-stages');
      lab(host, config, state, [['step', config.controlLabel, 0, config.steps.length - 1, 1]], [], function (svg, out) {
        stageRail(svg, config.steps, state.step);
        add(svg, 'desc', { id: id }).appendChild(document.createTextNode(config.steps.map(function (item, i) {
          return (i + 1) + '. ' + item.name + (i < state.step ? ' (verified)' : i === state.step ? ' (active)' : '');
        }).join(', ')));
        out.say(config.steps[state.step].name, config.steps[state.step].detail);
        out.meta.textContent = 'stage ' + (state.step + 1) + ' of ' + config.steps.length + '  ·  ' + config.formula;
      }, 64);
    };
  }

  function makeEquation(config) {
    return function (host) {
      var state = { a: config.a.defaultValue, b: config.b.defaultValue };
      lab(host, config, state, ['a', 'b'].map(function (key) {
        return [key, config[key].label, config[key].min, config[key].max, config[key].step];
      }), [], function (svg, out) {
        var result = config.calculate(state.a, state.b);
        flowIn(svg, [state.a, state.b], 36);
        gauge(svg, config.meterLabel, result.percent, result.warning ? WARN : BP, []);
        out.say(result.value, result.status);
        out.meta.textContent = result.meta;
        out.formula.textContent = result.formula;
      }, 56);
    };
  }

  function makeReadiness(config) {
    return function (host) {
      var keys = ['knowledge', 'practice', 'evidence'];
      var state = { knowledge: 55, practice: 35, evidence: 25 };
      lab(host, config, state, keys.map(function (key, i) { return [key, config.labels[i], 0, 100, 1]; }), [], function (svg, out) {
        var values = keys.map(function (key) { return state[key]; });
        var value = Math.round(values[0] * config.weights[0] + values[1] * config.weights[1] + values[2] * config.weights[2]);
        flowIn(svg, values, 36);
        gauge(svg, 'route readiness', value, value < 60 ? WARN : BP, [60, 80]);
        out.say(value + '%', value >= 80 ? config.ready : value >= 60 ? config.near : config.build);
        out.meta.textContent = config.formula + '  ·  weakest dimension: ' + keys[values.indexOf(Math.min.apply(null, values))];
      }, 72);
    };
  }

  function contextCache(host) {
    var state = { mode: 'prefix' };
    var stage = el('div');
    state._render = function () {
      while (stage.firstChild) stage.removeChild(stage.firstChild);
      var figure = window.LESSON_FIGURES && window.LESSON_FIGURES[state.mode === 'prefix' ? 'prompt-cache-hit' : 'semantic-cache'];
      if (figure) figure(stage, {});
    };
    shell(host, {
      title: 'CONTEXT CACHE LAB',
      hint: 'switch mechanisms, then drag the controls',
      caption: 'Prefix caching skips repeated prompt computation. Semantic caching reuses a previous answer for a similar query. One is exact and provider-side; the other is approximate and application-side, so its threshold is a safety decision.'
    }, el('div', { class: 'lf-grid' }, [
      select(state, 'mode', 'cache mechanism', [['provider prefix cache', 'prefix'], ['application semantic cache', 'semantic']])
    ]), el('div', { class: 'lf-out' }, [stage]));
    state._render();
  }

  var decisions = {
    '01-claude-model-fit': {
      title: 'MODEL FIT CALCULATOR', hint: 'change latency and reasoning demand',
      a: { label: 'latency pressure', defaultValue: 65 }, b: { label: 'reasoning complexity', defaultValue: 55 },
      choices: [
        { name: 'Haiku', base: 60, a: 34, b: -28, why: 'Use the fastest tier when latency dominates and the task is bounded.' },
        { name: 'Sonnet', base: 76, a: 4, b: 8, why: 'Use the balanced tier when both speed and reasoning matter.' },
        { name: 'Opus', base: 58, a: -24, b: 36, why: 'Use the strongest reasoning tier only when task complexity earns the cost.' }
      ],
      formula: 'fit = baseline + latency coefficient + reasoning coefficient',
      caption: 'Model selection is a workload decision, not a leaderboard decision. Move the constraints and watch the best fit change.'
    },
    '16-multi-agent-topology': {
      title: 'ORCHESTRATION TOPOLOGY', hint: 'change coupling and parallelism',
      a: { label: 'task coupling', defaultValue: 55 }, b: { label: 'parallel work', defaultValue: 60 },
      choices: [
        { name: 'Single agent', base: 72, a: 22, b: -30, why: 'Keep one context when steps depend heavily on each other.' },
        { name: 'Supervisor', base: 74, a: 5, b: 10, why: 'Use a supervisor when work can split but decisions still need one owner.' },
        { name: 'Peer swarm', base: 55, a: -28, b: 36, why: 'Use peers only for independent work with explicit merge contracts.' }
      ],
      formula: 'topology fit balances dependency cost against available parallelism',
      caption: 'More agents add coordination cost. Parallelism helps only when tasks are independent enough to merge safely.'
    },
    '18-tool-discovery-contract': {
      title: 'TOOL DISCOVERY BUDGET', hint: 'change tool count and ambiguity',
      a: { label: 'available tools', defaultValue: 45 }, b: { label: 'request ambiguity', defaultValue: 50 },
      choices: [
        { name: 'Expose all', base: 70, a: -36, b: -12, why: 'Expose all only when the registry is small and the intent is clear.' },
        { name: 'Progressive discovery', base: 78, a: 20, b: 16, why: 'Reveal a small relevant set, then expand only when necessary.' },
        { name: 'Fixed workflow', base: 60, a: -8, b: 26, why: 'Use a fixed sequence when ambiguity is high but the process is known.' }
      ],
      formula: 'selection quality falls as irrelevant tools and ambiguous intent increase',
      caption: 'A model cannot choose well from an unlimited tool list. Progressive discovery makes the selection surface smaller before execution.'
    },
    '22-sla-value-tradeoff': {
      title: 'SLA VALUE TRADEOFF', hint: 'change business impact and reliability demand',
      a: { label: 'business impact', defaultValue: 65 }, b: { label: 'reliability demand', defaultValue: 70 },
      choices: [
        { name: 'Assistive workflow', base: 74, a: -12, b: -20, why: 'Keep a human in control when value is moderate or uncertainty stays high.' },
        { name: 'Guarded automation', base: 78, a: 8, b: 12, why: 'Automate the common path with measurable gates and explicit fallback.' },
        { name: 'Deterministic service', base: 54, a: 20, b: 32, why: 'Move critical invariants outside the model when reliability dominates.' }
      ],
      formula: 'architecture fit = business value captured minus failure exposure',
      caption: 'The best AI architecture is the smallest probabilistic surface that still captures the desired value.'
    },
    '23-architecture-tradeoff': {
      title: 'ARCHITECTURE CHOICE', hint: 'change freshness and workflow complexity',
      a: { label: 'knowledge freshness', defaultValue: 70 }, b: { label: 'workflow complexity', defaultValue: 55 },
      choices: [
        { name: 'Prompt only', base: 70, a: -28, b: -18, why: 'Keep it prompt-only for stable knowledge and a bounded transformation.' },
        { name: 'RAG service', base: 68, a: 36, b: -5, why: 'Retrieve when answers depend on changing or private knowledge.' },
        { name: 'Agent workflow', base: 58, a: 4, b: 38, why: 'Add an agent only when the system must choose and sequence actions.' }
      ],
      formula: 'start with the simplest architecture that satisfies freshness and action needs',
      caption: 'Prompting, retrieval, and agents solve different problems. Complexity should enter only when the requirement demands it.'
    }
  };

  var thresholds = {
    '02-responsible-ai-risk': ['RESPONSIBLE AI RISK', 'model uncertainty', 'user impact', ['allow', 'human review', 'block and escalate'], ['Low-risk use stays inside policy.', 'A reviewer must resolve uncertainty before release.', 'High-impact uncertainty crosses the stop boundary.']],
    '06-data-analysis-confidence': ['ANALYSIS CONFIDENCE', 'evidence gaps', 'decision impact', ['publish with caveat', 'verify source', 'stop analysis'], ['The evidence supports a bounded conclusion.', 'Recalculate or retrieve the missing evidence.', 'Do not convert weak evidence into a confident decision.']],
    '07-human-review-threshold': ['HUMAN HANDOFF', 'model uncertainty', 'reversibility cost', ['auto-complete', 'request review', 'escalate owner'], ['The action is low-risk and reversible.', 'A human should confirm the proposed action.', 'The accountable owner must decide.']],
    '11-mcp-permission-boundary': ['MCP PERMISSION BOUNDARY', 'requested privilege', 'resource sensitivity', ['allow scoped call', 'require approval', 'deny request'], ['The call stays within the least-privilege contract.', 'A person must approve the expanded scope.', 'The requested capability exceeds the server boundary.']],
    '13-secrets-threat-model': ['SECRET EXPOSURE RISK', 'exposure likelihood', 'credential blast radius', ['continue safely', 'rotate and investigate', 'contain incident'], ['No secret crosses the model or log boundary.', 'Treat possible exposure as an incident signal.', 'Revoke access before doing anything else.']],
    '20-batch-review-confidence': ['BATCH REVIEW GATE', 'extraction uncertainty', 'record criticality', ['accept batch', 'sample and review', 'quarantine batch'], ['The batch meets the quality floor.', 'Inspect a risk-weighted sample before release.', 'Stop propagation until the failure mode is understood.']],
    '21-provenance-escalation': ['PROVENANCE GATE', 'unsupported claims', 'decision consequence', ['answer with citations', 'retrieve evidence', 'escalate uncertainty'], ['Every material claim has traceable evidence.', 'The system must retrieve or request missing support.', 'The consequence is too high for an unsupported answer.']],
    '27-governance-approval-flow': ['GOVERNANCE APPROVAL', 'policy deviation', 'affected population', ['standard release', 'risk approval', 'executive stop'], ['Normal controls cover this release.', 'The deviation needs recorded risk acceptance.', 'The change exceeds delegated authority.']]
  };

  var pipelines = {
    '03-prompt-contract': ['PROMPT CONTRACT', 'contract stage', ['Intent', 'Inputs', 'Constraints', 'Output', 'Tests'], ['Define the decision the model must support.', 'Name required context and reject missing fields.', 'State boundaries, refusal rules, and invariants.', 'Declare the exact shape downstream code consumes.', 'Run normal, edge, adversarial, and missing-data cases.']],
    '05-document-vision-pipeline': ['DOCUMENT AND VISION PIPELINE', 'pipeline stage', ['Ingest', 'Segment', 'Extract', 'Validate', 'Route'], ['Preserve page and image identity.', 'Split by semantic and visual boundaries.', 'Return fields with source coordinates.', 'Check schema, totals, and cross-page consistency.', 'Send low-confidence cases to the right owner.']],
    '08-messages-lifecycle': ['MESSAGES API LIFECYCLE', 'request stage', ['Compose', 'Send', 'Inspect', 'Continue', 'Record'], ['Build ordered roles, content blocks, and limits.', 'Submit one explicit request boundary.', 'Read stop reason, usage, and returned blocks.', 'Append tool results or the next user turn.', 'Persist the trace needed for debugging and cost.']],
    '09-structured-output-recovery': ['STRUCTURED OUTPUT RECOVERY', 'recovery stage', ['Generate', 'Parse', 'Validate', 'Repair', 'Escalate'], ['Ask for the declared schema.', 'Treat the response as untrusted bytes.', 'Check types, ranges, and business invariants.', 'Retry with the exact validation error once.', 'Return a typed failure instead of guessing.']],
    '12-agent-hook-lifecycle': ['AGENT HOOK LIFECYCLE', 'hook stage', ['Start', 'Pre-tool', 'Execute', 'Post-tool', 'Stop'], ['Create trace and policy context.', 'Authorize arguments before side effects.', 'Run the bounded operation.', 'Record output, cost, and changed state.', 'Close resources and publish the terminal result.']],
    '14-eval-observability-loop': ['EVAL AND OBSERVABILITY LOOP', 'feedback stage', ['Dataset', 'Run', 'Score', 'Trace', 'Improve'], ['Version representative cases and failure slices.', 'Execute the exact candidate configuration.', 'Measure task, safety, latency, and cost.', 'Connect aggregate failures to individual traces.', 'Change one hypothesis, then rerun the same set.']],
    '15-team-agent-loop': ['TEAM AGENT LOOP', 'team stage', ['Plan', 'Assign', 'Execute', 'Review', 'Merge'], ['Write acceptance criteria and ownership.', 'Give each agent a bounded non-overlapping surface.', 'Produce inspectable work and verification evidence.', 'Check correctness, conflicts, and missing scope.', 'Integrate only after all contracts agree.']],
    '19-memory-rule-precedence': ['MEMORY AND RULE PRECEDENCE', 'resolution stage', ['Current request', 'Repository rules', 'Live code', 'Project memory', 'Global defaults'], ['The newest explicit instruction wins within authority.', 'Apply the closest maintained project contract.', 'Verify behavior against the current implementation.', 'Use durable context only after checking for drift.', 'Fall back to general preferences last.']],
    '25-identity-permission-path': ['IDENTITY AND PERMISSION PATH', 'authorization stage', ['Authenticate', 'Resolve actor', 'Authorize', 'Execute', 'Audit'], ['Verify the presented identity.', 'Bind user, tenant, and delegated service identity.', 'Evaluate resource and action at least privilege.', 'Perform only the authorized operation.', 'Record actor, decision, target, and result.']],
    '28-adr-lifecycle': ['ADR LIFECYCLE', 'decision stage', ['Context', 'Options', 'Decision', 'Consequences', 'Revisit'], ['State the constraint and why a decision is needed.', 'Compare viable alternatives using the same criteria.', 'Name the chosen option and accountable owner.', 'Record benefits, costs, risks, and follow-ups.', 'Reopen when an assumption or metric changes.']]
  };

  var figures = {
    '00-certification-route-map': makeReadiness({
      title: 'CERTIFICATION ROUTE READINESS', hint: 'score evidence, not confidence', labels: ['exam knowledge', 'timed practice', 'shipped evidence'], weights: [0.35, 0.3, 0.35],
      ready: 'ready for a timed full mock', near: 'close the weakest dimension, then retest', build: 'return to lessons and produce evidence',
      formula: '35% knowledge + 30% timed practice + 35% artifacts',
      caption: 'Readiness is not how familiar the blueprint feels. It is what you can explain, do under time pressure, and prove with an artifact.'
    }),
    '04-context-cache': contextCache,
    '10-tool-loop-budget': makeEquation({
      title: 'TOOL LOOP BUDGET', hint: 'change call limit and success rate', meterLabel: 'successful completion',
      a: { label: 'maximum tool calls', min: 1, max: 20, step: 1, defaultValue: 8 }, b: { label: 'success per call (%)', min: 10, max: 95, step: 1, defaultValue: 65 },
      calculate: function (calls, success) { var p = 1 - Math.pow(1 - success / 100, calls); return { value: (p * 100).toFixed(1) + '%', status: calls > 12 ? 'Completion rises, but runaway-loop exposure is now high.' : 'Bound the loop and inspect every stop reason.', percent: p * 100, warning: calls > 12, meta: calls + ' calls maximum  ·  ' + success + '% chance each call advances the task', formula: 'P(at least one success) = 1 - (1 - p)^calls' }; },
      caption: 'A tool loop needs an explicit call budget, terminal conditions, and a typed failure. More retries can raise completion while also raising latency, cost, and side-effect risk.'
    }),
    '17-session-context-budget': makeEquation({
      title: 'SESSION CONTEXT BUDGET', hint: 'change history and compaction', meterLabel: 'context consumed',
      a: { label: 'raw history tokens', min: 1000, max: 200000, step: 1000, defaultValue: 80000 }, b: { label: 'compaction retained (%)', min: 5, max: 100, step: 1, defaultValue: 35 },
      calculate: function (tokens, retained) { var used = Math.round(tokens * retained / 100); var pct = used / 100000 * 100; return { value: used.toLocaleString('en-US') + ' tokens', status: pct > 80 ? 'Compact again or retrieve on demand before continuing.' : 'The session preserves decisions while leaving room for new work.', percent: pct, warning: pct > 80, meta: tokens.toLocaleString('en-US') + ' raw tokens  ·  ' + retained + '% retained after compaction', formula: 'active context = history tokens × retained fraction' }; },
      caption: 'Session memory should preserve decisions, constraints, and unresolved state, not replay every token. Compaction is an information-design problem.'
    }),
    '24-rag-ranking': makeEquation({
      title: 'RAG RANKING THRESHOLD', hint: 'change relevance and evidence coverage', meterLabel: 'answer support',
      a: { label: 'retrieval relevance (%)', min: 0, max: 100, step: 1, defaultValue: 72 }, b: { label: 'evidence coverage (%)', min: 0, max: 100, step: 1, defaultValue: 68 },
      calculate: function (relevance, coverage) { var support = relevance * 0.55 + coverage * 0.45; return { value: Math.round(support) + '% support', status: support >= 75 ? 'Generate with citations and preserve the ranked evidence.' : support >= 55 ? 'Retrieve again or narrow the question.' : 'Abstain because the corpus does not support the answer.', percent: support, warning: support < 55, meta: relevance + '% relevance  ·  ' + coverage + '% claim coverage', formula: 'support = 0.55 × relevance + 0.45 × evidence coverage' }; },
      caption: 'Retrieval quality is not just nearest-neighbor similarity. The selected evidence must also cover the claims the answer intends to make.'
    }),
    '26-latency-cost-slo': makeEquation({
      title: 'LATENCY AND COST SLO', hint: 'change cache hit rate and model latency', meterLabel: 'latency budget used',
      a: { label: 'cache hit rate (%)', min: 0, max: 100, step: 1, defaultValue: 60 }, b: { label: 'uncached latency (ms)', min: 200, max: 6000, step: 100, defaultValue: 2400 },
      calculate: function (hit, latency) { var effective = hit / 100 * 80 + (1 - hit / 100) * latency; var pct = effective / 2000 * 100; return { value: Math.round(effective) + ' ms', status: effective <= 2000 ? 'The blended path meets the 2 second target.' : 'Reduce model work, raise safe cache hits, or change the SLO.', percent: pct, warning: effective > 2000, meta: hit + '% hits at 80 ms  ·  misses at ' + latency + ' ms', formula: 'blended latency = hit rate × 80 ms + miss rate × uncached latency' }; },
      caption: 'Averages hide the architecture. Model latency, cache behavior, and the allowed service objective must be measured as one system.'
    })
  };

  Object.keys(decisions).forEach(function (id) { figures[id] = makeDecision(decisions[id]); });
  Object.keys(thresholds).forEach(function (id) {
    var item = thresholds[id];
    figures[id] = makeThreshold({
      title: item[0], hint: 'move risk and threshold', signal: { label: item[1], defaultValue: 45 }, impact: { label: item[2], defaultValue: 60 },
      cut: 50, signalWeight: 0.55, escalationBand: 20, decisions: item[3], reasons: item[4],
      scoreLabel: 'combined decision score', thresholdLabel: 'review threshold', formula: 'score = 55% signal + 45% impact; thresholds choose the control path',
      caption: 'A reliable system converts uncertainty and consequence into an explicit control path. Moving the review threshold changes automation policy, not model truth.'
    });
  });
  Object.keys(pipelines).forEach(function (id) {
    var item = pipelines[id];
    figures[id] = makePipeline({
      title: item[0], hint: 'drag through the mechanism', controlLabel: item[1],
      steps: item[2].map(function (name, index) { return { name: name, short: item[3][index], detail: item[3][index] }; }),
      formula: 'each verified stage becomes the contract for the next stage',
      caption: 'Move through the stages and inspect the contract at each boundary. Reliability comes from explicit state transitions, not from hoping one long prompt handles the whole workflow.'
    });
  });

  [
    ['29-associate-capstone-readiness', 'ASSOCIATE CAPSTONE', ['workflow decisions', 'scenario practice', 'handoff evidence'], [0.35, 0.35, 0.3]],
    ['30-developer-capstone-readiness', 'DEVELOPER CAPSTONE', ['API mechanics', 'tested implementation', 'operations packet'], [0.3, 0.4, 0.3]],
    ['31-architect-foundation-readiness', 'ARCHITECT FOUNDATIONS CAPSTONE', ['pattern selection', 'tradeoff practice', 'architecture packet'], [0.35, 0.3, 0.35]],
    ['32-architect-professional-readiness', 'ARCHITECT PROFESSIONAL CAPSTONE', ['system judgment', 'failure rehearsal', 'governance evidence'], [0.3, 0.35, 0.35]]
  ].forEach(function (item) {
    figures[item[0]] = makeReadiness({
      title: item[1], hint: 'measure what you can prove', labels: item[2], weights: item[3],
      ready: 'capstone evidence is ready for rubric review', near: 'repair the weakest evidence, then rerun the verifier', build: 'complete the missing artifact before claiming readiness',
      formula: Math.round(item[3][0] * 100) + '% knowledge + ' + Math.round(item[3][1] * 100) + '% practice + ' + Math.round(item[3][2] * 100) + '% evidence',
      caption: 'A capstone is complete when another engineer can inspect the decisions, run the verifier, and operate the result without reconstructing your intent.'
    });
  });

  LF.register(figures);
})();
