/* figures-tools3.js - animated lesson figures for Phase 13 tools and
   protocols, batch three. Loads after lesson-figures.js and registers
   through window.LF. No deps, ES5 only, theme via CSS vars, SMIL only.
   Authoring: a ```figure block naming one of the t3- widgets below. */
(function () {
  'use strict';
  var LF = window.LF;
  if (!LF) { return; }
  var el = LF.el, svgEl = LF.svgEl;
  var EASE = '0.23 1 0.32 1';

  function out(svg) { return el('div', { class: 'lf-out' }, [svg]); }
  function cap(text) { return el('div', { class: 'lf-cap' }, [text]); }
  function head(label, hint) {
    return el('div', { class: 'lf-head' }, [
      el('span', { class: 'lf-label' }, [label]),
      el('span', {}, [hint])
    ]);
  }
  function txt(x, y, s, size, fill, anchor) {
    var t = svgEl('text', {
      x: x, y: y, 'text-anchor': anchor || 'middle',
      'font-family': 'var(--font-mono,monospace)', 'font-size': size || '11',
      fill: fill || 'var(--ink-soft,#555)'
    });
    t.appendChild(document.createTextNode(s));
    return t;
  }
  function box(x, y, w, h, stroke) {
    return svgEl('rect', {
      x: x, y: y, width: w, height: h, rx: '4',
      fill: 'var(--bg-surface,#eee)',
      stroke: stroke || 'var(--rule-soft,#ddd)', 'stroke-width': '1.4'
    });
  }
  function anim(attr, vals, keyTimes, dur, extra) {
    var a = { attributeName: attr, values: vals, keyTimes: keyTimes, dur: dur, repeatCount: 'indefinite' };
    if (extra) { for (var k in extra) { a[k] = extra[k]; } }
    return svgEl('animate', a);
  }
  // packet: group moving along a path, parked at the ends via keyPoints,
  // visible only during its keyTimes window so loops stay in sync
  function packet(kids, path, dur, moveTimes, opVals, opTimes) {
    var g = svgEl('g', { opacity: '0' }, kids);
    g.appendChild(svgEl('animateMotion', {
      path: path, dur: dur, repeatCount: 'indefinite', calcMode: 'linear',
      keyPoints: '0;0;1;1', keyTimes: moveTimes
    }));
    g.appendChild(anim('opacity', opVals, opTimes, dur));
    return g;
  }
  // entry: fade in from opacity 0 at 95 percent size, eased, frozen once done
  function enter(x, y, begin, kids) {
    var inner = svgEl('g', { opacity: '0' }, kids);
    inner.appendChild(svgEl('animate', {
      attributeName: 'opacity', values: '0;1', keyTimes: '0;1', dur: '0.55s',
      begin: begin, fill: 'freeze', calcMode: 'spline', keySplines: EASE
    }));
    inner.appendChild(svgEl('animateTransform', {
      attributeName: 'transform', type: 'scale', values: '0.95;1', keyTimes: '0;1',
      dur: '0.55s', begin: begin, fill: 'freeze', calcMode: 'spline', keySplines: EASE
    }));
    return svgEl('g', { transform: 'translate(' + x + ' ' + y + ')' }, [inner]);
  }
  function chip(w, label) {
    return [
      svgEl('rect', { x: -w / 2, y: -10, width: w, height: 20, rx: '3', fill: 'var(--blueprint,#3553ff)' }),
      txt(0, 4, label, '9', 'var(--bg,#fafaf5)')
    ];
  }

  // t3-dispatch-loop: JSON-RPC lines in on stdin, matched responses on stdout
  function dispatchLoop(host) {
    var svg = svgEl('svg', { viewBox: '0 0 520 240' });
    svg.appendChild(svgEl('line', { x1: 20, y1: 80, x2: 188, y2: 80, stroke: 'var(--rule-soft,#ccc)', 'stroke-width': '1.4' }));
    svg.appendChild(svgEl('line', { x1: 332, y1: 80, x2: 500, y2: 80, stroke: 'var(--rule-soft,#ccc)', 'stroke-width': '1.4' }));
    svg.appendChild(svgEl('line', { x1: 20, y1: 180, x2: 188, y2: 180, stroke: 'var(--rule-soft,#ccc)', 'stroke-width': '1.4' }));
    svg.appendChild(svgEl('line', { x1: 332, y1: 180, x2: 500, y2: 180, stroke: 'var(--rule-soft,#ccc)', 'stroke-width': '1.4', 'stroke-dasharray': '3 5' }));
    svg.appendChild(txt(20, 66, 'stdin', '9', 'var(--ink-mute,#777)', 'start'));
    svg.appendChild(txt(500, 66, 'stdout', '9', 'var(--ink-mute,#777)', 'end'));
    svg.appendChild(txt(500, 168, 'nothing written', '8', 'var(--ink-mute,#777)', 'end'));
    svg.appendChild(enter(260, 130, '0.1s', [
      box(-72, -60, 144, 120),
      txt(0, -34, 'dispatch', '11', 'var(--ink,#1a1a1a)'),
      txt(0, -16, 'has id: respond', '8', 'var(--ink-mute,#777)'),
      txt(0, 0, 'no id: consume', '8', 'var(--ink-mute,#777)'),
      txt(0, 42, 'logs to stderr', '8', 'var(--warn,#b8870f)')
    ]));
    svg.appendChild(packet(chip(66, 'req id:7'), 'M46 80 L186 80', '6s',
      '0;0.04;0.3;1', '0;1;1;0;0', '0;0.05;0.28;0.33;1'));
    svg.appendChild(packet(chip(70, 'resp id:7'), 'M336 80 L474 80', '6s',
      '0;0.42;0.62;1', '0;0;1;1;0;0', '0;0.42;0.44;0.6;0.64;1'));
    svg.appendChild(packet(chip(84, 'notification'), 'M48 180 L230 180', '6s',
      '0;0.55;0.8;1', '0;0;1;1;0;0', '0;0.55;0.57;0.8;0.88;1'));
    host.appendChild(el('div', { class: 'lf' }, [
      head('DISPATCH LOOP', 'one JSON line in, one matched line out'),
      el('div', { class: 'lf-body' }, [out(svg)]),
      cap('The server reads one JSON object per line from stdin. A message with an id is a request and must produce exactly one response carrying the same id on stdout. A notification has no id and produces nothing. Anything else printed to stdout corrupts the wire, which is why debug output goes to stderr.')
    ]));
  }

  // t3-primitive-sort: a capability routes to tool, resource, or prompt
  function primitiveSort(host) {
    var svg = svgEl('svg', { viewBox: '0 0 520 250' });
    svg.appendChild(txt(260, 20, 'capability', '9', 'var(--ink-mute,#777)'));
    svg.appendChild(enter(260, 110, '0.1s', [
      svgEl('polygon', { points: '0,-28 46,0 0,28 -46,0', fill: 'var(--bg-surface,#eee)', stroke: 'var(--rule-soft,#ddd)', 'stroke-width': '1.4' }),
      txt(0, 4, 'unit?', '10', 'var(--ink,#1a1a1a)')
    ]));
    var bins = [
      { x: 90, t: 'tool', s: 'mutate or search', d: '0.2s' },
      { x: 260, t: 'resource', s: 'attach as context', d: '0.32s' },
      { x: 430, t: 'prompt', s: 're-run workflow', d: '0.44s' }
    ];
    var i;
    for (i = 0; i < 3; i++) {
      svg.appendChild(enter(bins[i].x, 208, bins[i].d, [
        box(-62, -24, 124, 48),
        txt(0, -3, bins[i].t, '11', 'var(--blueprint,#3553ff)'),
        txt(0, 13, bins[i].s, '8', 'var(--ink-mute,#777)')
      ]));
    }
    svg.appendChild(packet(chip(94, 'notes_search'), 'M260 34 L260 100 C260 152 90 140 90 178', '6s',
      '0;0.03;0.29;1', '0;1;1;0;0', '0;0.04;0.28;0.32;1'));
    svg.appendChild(packet(chip(78, 'notes://42'), 'M260 34 L260 178', '6s',
      '0;0.36;0.62;1', '0;0;1;1;0;0', '0;0.36;0.38;0.61;0.65;1'));
    svg.appendChild(packet(chip(94, '/review_note'), 'M260 34 L260 100 C260 152 430 140 430 178', '6s',
      '0;0.69;0.95;1', '0;0;1;1;0;0', '0;0.69;0.71;0.94;0.98;1'));
    host.appendChild(el('div', { class: 'lf' }, [
      head('PRIMITIVE SORT', 'tool, resource, or prompt'),
      el('div', { class: 'lf-body' }, [out(svg)]),
      cap('Not everything is a tool. If the model should decide to call it per query, it is a tool. If the user attaches it as context, it is a resource. If the reusable unit is a whole workflow, it is a prompt. Sorting a notes server this way removes model round-trips for plain reads and gives each capability the UX surface hosts already build for it.')
    ]));
  }

  // t3-sampling-flip: deprecated Sampling expressed through current MRTR
  function samplingFlip(host) {
    var svg = svgEl('svg', { viewBox: '0 0 520 230' });
    svg.appendChild(enter(105, 115, '0.1s', [
      box(-80, -55, 160, 110),
      txt(0, -32, 'client', '11', 'var(--ink,#1a1a1a)'),
      txt(0, -16, 'LLM + billing', '8', 'var(--ink-mute,#777)'),
      txt(12, 38, 'API key', '8', 'var(--warn,#b8870f)', 'start')
    ]));
    svg.appendChild(enter(415, 115, '0.25s', [
      box(-80, -55, 160, 110),
      txt(0, -32, 'server', '11', 'var(--ink,#1a1a1a)'),
      txt(0, -16, 'owns the loop', '8', 'var(--ink-mute,#777)'),
      txt(0, 38, 'no credentials', '8', 'var(--ink-mute,#777)')
    ]));
    var key = svgEl('circle', { cx: 98, cy: 150, r: 5, fill: 'var(--warn,#b8870f)' });
    key.appendChild(anim('opacity', '0.45;1;0.45', '0;0.5;1', '3s'));
    svg.appendChild(key);
    svg.appendChild(txt(260, 74, 'tools/call + request meta', '8', 'var(--ink-mute,#777)'));
    svg.appendChild(txt(260, 116, 'input_required + sampling inputRequest', '8', 'var(--ink-mute,#777)'));
    svg.appendChild(txt(260, 158, 'retry + inputResponses', '8', 'var(--ink-mute,#777)'));
    svg.appendChild(packet(chip(46, 'call'), 'M187 86 L333 86', '5.5s',
      '0;0.02;0.24;1', '0;1;1;0;0', '0;0.03;0.23;0.27;1'));
    svg.appendChild(packet(chip(46, 'ask'), 'M333 128 L187 128', '5.5s',
      '0;0.34;0.56;1', '0;0;1;1;0;0', '0;0.34;0.36;0.55;0.59;1'));
    svg.appendChild(packet(chip(56, 'answer'), 'M187 170 L333 170', '5.5s',
      '0;0.66;0.88;1', '0;0;1;1;0;0', '0;0.66;0.68;0.87;0.92;1'));
    host.appendChild(el('div', { class: 'lf' }, [
      head('DEPRECATED SAMPLING VIA MRTR', 'no unsolicited reverse request'),
      el('div', { class: 'lf-body' }, [out(svg)]),
      cap('Sampling is deprecated for new MCP designs; call a model provider directly instead. A compatibility server does not send a reverse request in the current protocol. It returns resultType input_required with a sampling inputRequest, the client obtains the completion under its own policy, and then retries the original method with inputResponses and the exact requestState.')
    ]));
  }

  // t3-roots-boundary: explicit resource scope replaces Roots in new designs
  function rootsBoundary(host) {
    var svg = svgEl('svg', { viewBox: '0 0 520 240' });
    svg.appendChild(enter(80, 108, '0.1s', [
      box(-58, -30, 116, 60),
      txt(0, -4, 'notes server', '10', 'var(--ink,#1a1a1a)'),
      txt(0, 13, 'validates scope', '8', 'var(--ink-mute,#777)')
    ]));
    svg.appendChild(enter(375, 92, '0.25s', [
      svgEl('rect', { x: -125, y: -66, width: 250, height: 132, rx: '5', fill: 'none', stroke: 'var(--blueprint,#3553ff)', 'stroke-width': '1.6', 'stroke-dasharray': '6 5' }),
      txt(0, -50, 'tool arg: scope=file:///project/Notes', '9', 'var(--blueprint,#3553ff)'),
      box(-52, -16, 104, 34),
      txt(0, 5, 'meeting.md', '9', 'var(--ink,#1a1a1a)')
    ]));
    svg.appendChild(enter(375, 210, '0.4s', [
      txt(0, 0, '~/.ssh/id_rsa', '9', 'var(--ink-mute,#777)')
    ]));
    svg.appendChild(packet(chip(46, 'read'), 'M140 96 C220 96 240 93 318 93', '5s',
      '0;0.04;0.3;1', '0;1;1;0;0', '0;0.05;0.29;0.34;1'));
    var ok = svgEl('circle', { cx: 322, cy: 93, r: 6, fill: 'none', stroke: 'var(--blueprint,#3553ff)', 'stroke-width': '1.6', opacity: '0' });
    ok.appendChild(anim('r', '6;16;6', '0;0.5;1', '5s'));
    ok.appendChild(anim('opacity', '0;0;0.9;0;0', '0;0.3;0.36;0.44;1', '5s'));
    svg.appendChild(ok);
    svg.appendChild(packet(chip(46, 'read'), 'M140 124 C220 160 240 200 302 207', '5s',
      '0;0.52;0.78;1', '0;0;1;1;0;0', '0;0.52;0.54;0.78;0.86;1'));
    var rej = txt(375, 232, 'outside root: rejected', '9', 'var(--warn,#b8870f)');
    rej.setAttribute('opacity', '0');
    rej.appendChild(anim('opacity', '0;0;1;1;0', '0;0.78;0.82;0.94;1', '5s'));
    svg.appendChild(rej);
    host.appendChild(el('div', { class: 'lf' }, [
      head('EXPLICIT RESOURCE SCOPE', 'Roots are deprecated for new designs'),
      el('div', { class: 'lf-body' }, [out(svg)]),
      cap('Pass the authorized directory or resource URI as an explicit tool argument, resource reference, or server configuration. The server resolves and contains every path before access, so the inside read succeeds and the outside path is rejected. MCP Roots remain available only during their deprecation window and never replace authorization or an OS sandbox.')
    ]));
  }

  // t3-ui-sandbox: a ui:// payload renders in an iframe, postMessage hops out
  function uiSandbox(host) {
    var svg = svgEl('svg', { viewBox: '0 0 520 250' });
    svg.appendChild(enter(85, 125, '0.1s', [
      box(-60, -34, 120, 68),
      txt(0, -8, 'MCP server', '10', 'var(--ink,#1a1a1a)'),
      txt(0, 10, 'ui://notes/timeline', '8', 'var(--blueprint,#3553ff)')
    ]));
    svg.appendChild(enter(370, 125, '0.25s', [
      box(-125, -95, 250, 190),
      txt(0, -78, 'host window', '9', 'var(--ink-mute,#777)'),
      txt(0, 82, 'no network unless granted', '8', 'var(--ink-mute,#777)')
    ]));
    svg.appendChild(enter(370, 115, '0.9s', [
      svgEl('rect', { x: -100, y: -55, width: 200, height: 110, rx: '4', fill: 'var(--bg,#fafaf5)', stroke: 'var(--blueprint,#3553ff)', 'stroke-width': '1.6' }),
      txt(0, -38, 'sandboxed iframe', '9', 'var(--blueprint,#3553ff)'),
      svgEl('rect', { x: -80, y: -22, width: 160, height: 12, rx: '2', fill: 'var(--bg-surface,#eee)' }),
      svgEl('rect', { x: -80, y: -2, width: 118, height: 12, rx: '2', fill: 'var(--bg-surface,#eee)' }),
      svgEl('rect', { x: -80, y: 18, width: 140, height: 12, rx: '2', fill: 'var(--bg-surface,#eee)' }),
      txt(0, 47, 'CSP locked', '8', 'var(--warn,#b8870f)')
    ]));
    svg.appendChild(packet(chip(46, 'html'), 'M147 125 L266 125', '5s',
      '0;0.03;0.27;1', '0;1;1;0;0', '0;0.04;0.26;0.31;1'));
    var hop1 = svgEl('circle', { r: 4, fill: 'var(--blueprint,#3553ff)', opacity: '0' }, []);
    hop1.appendChild(svgEl('animateMotion', { path: 'M340 170 C340 196 340 196 340 212', dur: '5s', repeatCount: 'indefinite', calcMode: 'linear', keyPoints: '0;0;1;1', keyTimes: '0;0.45;0.6;1' }));
    hop1.appendChild(anim('opacity', '0;0;1;1;0;0', '0;0.45;0.47;0.58;0.62;1', '5s'));
    svg.appendChild(hop1);
    var hop2 = svgEl('circle', { r: 4, fill: 'var(--ink-soft,#555)', opacity: '0' }, []);
    hop2.appendChild(svgEl('animateMotion', { path: 'M400 212 C400 196 400 196 400 170', dur: '5s', repeatCount: 'indefinite', calcMode: 'linear', keyPoints: '0;0;1;1', keyTimes: '0;0.68;0.83;1' }));
    hop2.appendChild(anim('opacity', '0;0;1;1;0;0', '0;0.68;0.7;0.81;0.85;1', '5s'));
    svg.appendChild(hop2);
    svg.appendChild(txt(485, 196, 'postMessage', '8', 'var(--ink-mute,#777)', 'end'));
    host.appendChild(el('div', { class: 'lf' }, [
      head('MCP APPS SANDBOX', 'ui:// into an iframe, messages over the wall'),
      el('div', { class: 'lf-body' }, [out(svg)]),
      cap('A tool result names a ui:// resource whose HTML the host renders inside a sandboxed iframe. The frame gets a locked-down CSP and no network unless the metadata grants it, so the only way in or out is the tiny postMessage JSON-RPC dialect hopping over the sandbox wall. One HTML bundle renders the same in every compatible client.')
    ]));
  }

  // t3-scope-stepup: 403 with WWW-Authenticate, consent, retry with more scope
  function scopeStepup(host) {
    var svg = svgEl('svg', { viewBox: '0 0 520 250' });
    svg.appendChild(enter(70, 90, '0.1s', [
      box(-50, -30, 100, 60),
      txt(0, 5, 'client', '11', 'var(--ink,#1a1a1a)')
    ]));
    svg.appendChild(enter(450, 90, '0.25s', [
      box(-50, -30, 100, 60),
      txt(0, -3, 'server', '11', 'var(--ink,#1a1a1a)'),
      txt(0, 14, 'needs write', '8', 'var(--ink-mute,#777)')
    ]));
    svg.appendChild(enter(260, 208, '0.4s', [
      box(-70, -24, 140, 48),
      txt(0, -2, 'user consent', '10', 'var(--ink,#1a1a1a)'),
      txt(0, 14, 'grant notes:write?', '8', 'var(--ink-mute,#777)')
    ]));
    svg.appendChild(packet(chip(84, 'notes:read'), 'M122 72 L398 72', '6s',
      '0;0.02;0.2;1', '0;1;1;0;0', '0;0.03;0.19;0.23;1'));
    var deny = svgEl('g', { opacity: '0' }, chip(102, '403 step-up'));
    deny.appendChild(svgEl('animateMotion', { path: 'M398 108 L122 108', dur: '6s', repeatCount: 'indefinite', calcMode: 'linear', keyPoints: '0;0;1;1', keyTimes: '0;0.24;0.42;1' }));
    deny.appendChild(anim('opacity', '0;0;1;1;0;0', '0;0.24;0.26;0.41;0.45;1', '6s'));
    deny.firstChild.setAttribute('fill', 'var(--warn,#b8870f)');
    svg.appendChild(deny);
    svg.appendChild(txt(260, 128, 'WWW-Authenticate: scope=notes:write', '8', 'var(--warn,#b8870f)'));
    svg.appendChild(packet(chip(46, 'ask'), 'M84 120 C84 184 130 202 186 206', '6s',
      '0;0.46;0.6;1', '0;0;1;1;0;0', '0;0.46;0.48;0.59;0.63;1'));
    svg.appendChild(packet(chip(52, 'grant'), 'M334 206 C390 202 436 184 436 120', '6s',
      '0;0.62;0.76;1', '0;0;1;1;0;0', '0;0.62;0.64;0.75;0.79;1'));
    var retry = svgEl('g', { opacity: '0' }, chip(140, 'notes:read+write'));
    retry.appendChild(svgEl('animateMotion', { path: 'M122 40 L398 40', dur: '6s', repeatCount: 'indefinite', calcMode: 'linear', keyPoints: '0;0;1;1', keyTimes: '0;0.8;0.96;1' }));
    retry.appendChild(anim('opacity', '0;0;1;1;0', '0;0.8;0.82;0.97;1', '6s'));
    svg.appendChild(retry);
    host.appendChild(el('div', { class: 'lf' }, [
      head('SCOPE STEP-UP', 'escalate one scope, not the whole flow'),
      el('div', { class: 'lf-body' }, [out(svg)]),
      cap('A token scoped notes:read hits an action that needs notes:write. Instead of failing or re-running the entire OAuth dance, the server answers 403 with a WWW-Authenticate header naming the missing scope. The client asks the user to consent to just that increment, then retries with the upgraded token. Least privilege stays the default because escalation is this cheap.')
    ]));
  }

  // t3-gateway-funnel: many developers, one policy point, many backends
  function gatewayFunnel(host) {
    var svg = svgEl('svg', { viewBox: '0 0 520 250' });
    var dy = [45, 125, 205], i;
    for (i = 0; i < 3; i++) {
      svg.appendChild(enter(58, dy[i], (0.1 + i * 0.12) + 's', [
        box(-38, -18, 76, 36),
        txt(0, 4, 'dev ' + (i + 1), '10', 'var(--ink,#1a1a1a)')
      ]));
      svg.appendChild(enter(462, dy[i], (0.5 + i * 0.12) + 's', [
        box(-38, -18, 76, 36),
        txt(0, 4, ['notes', 'github', 'postgres'][i], '9', 'var(--ink,#1a1a1a)')
      ]));
      svg.appendChild(svgEl('path', { d: 'M96 ' + dy[i] + ' C160 ' + dy[i] + ' 160 125 200 125', fill: 'none', stroke: 'var(--rule-soft,#ccc)', 'stroke-width': '1.3' }));
      svg.appendChild(svgEl('path', { d: 'M320 125 C360 125 360 ' + dy[i] + ' 424 ' + dy[i], fill: 'none', stroke: 'var(--rule-soft,#ccc)', 'stroke-width': '1.3' }));
    }
    svg.appendChild(enter(260, 125, '0.35s', [
      box(-60, -62, 120, 124, 'var(--blueprint,#3553ff)'),
      txt(0, -42, 'gateway', '11', 'var(--blueprint,#3553ff)'),
      txt(0, -22, 'auth', '8', 'var(--ink-soft,#555)'),
      txt(0, -7, 'rbac', '8', 'var(--ink-soft,#555)'),
      txt(0, 8, 'rate limit', '8', 'var(--ink-soft,#555)'),
      txt(0, 23, 'pinned hashes', '8', 'var(--ink-soft,#555)'),
      txt(0, 38, 'audit log', '8', 'var(--ink-soft,#555)')
    ]));
    var starts = [0.02, 0.35, 0.68];
    for (i = 0; i < 3; i++) {
      var s = starts[i];
      var d1 = svgEl('circle', { r: 5, fill: 'var(--blueprint,#3553ff)', opacity: '0' }, []);
      d1.appendChild(svgEl('animateMotion', { path: 'M96 ' + dy[i] + ' C160 ' + dy[i] + ' 160 125 200 125', dur: '6s', repeatCount: 'indefinite', calcMode: 'linear', keyPoints: '0;0;1;1', keyTimes: '0;' + s + ';' + (s + 0.12) + ';1' }));
      d1.appendChild(anim('opacity', '0;0;1;1;0;0', '0;' + s + ';' + (s + 0.01) + ';' + (s + 0.11) + ';' + (s + 0.13) + ';1', '6s'));
      svg.appendChild(d1);
      var d2 = svgEl('circle', { r: 5, fill: 'var(--blueprint,#3553ff)', opacity: '0' }, []);
      d2.appendChild(svgEl('animateMotion', { path: 'M320 125 C360 125 360 ' + dy[i] + ' 424 ' + dy[i], dur: '6s', repeatCount: 'indefinite', calcMode: 'linear', keyPoints: '0;0;1;1', keyTimes: '0;' + (s + 0.16) + ';' + (s + 0.28) + ';1' }));
      d2.appendChild(anim('opacity', '0;0;1;1;0;0', '0;' + (s + 0.16) + ';' + (s + 0.17) + ';' + (s + 0.27) + ';' + (s + 0.29) + ';1', '6s'));
      svg.appendChild(d2);
    }
    host.appendChild(el('div', { class: 'lf' }, [
      head('GATEWAY FUNNEL', 'one endpoint, five responsibilities'),
      el('div', { class: 'lf-body' }, [out(svg)]),
      cap('To every developer the gateway looks like a single MCP server. Inside, each call is authenticated, checked against per-user RBAC, rate limited, compared to the pinned tool-hash manifest, and written to the audit log before routing to the backend that owns the tool. Policy lives in one place instead of five thousand IDE configs.')
    ]));
  }

  // t3-jwks-rotate: keys roll on the auth server, the cache refreshes first
  function jwksRotate(host) {
    var svg = svgEl('svg', { viewBox: '0 0 520 240' });
    svg.appendChild(enter(105, 70, '0.1s', [
      box(-80, -42, 160, 84),
      txt(0, -22, 'authorization server', '9', 'var(--ink,#1a1a1a)'),
      txt(0, 26, '/.well-known/jwks.json', '8', 'var(--ink-mute,#777)')
    ]));
    var kidA = txt(105, 72, 'signing key kid:A', '10', 'var(--blueprint,#3553ff)');
    kidA.appendChild(anim('opacity', '1;1;0;0;1', '0;0.42;0.5;0.92;1', '6s'));
    svg.appendChild(kidA);
    var kidB = txt(105, 72, 'signing key kid:B', '10', 'var(--warn,#b8870f)');
    kidB.setAttribute('opacity', '0');
    kidB.appendChild(anim('opacity', '0;0;1;1;0', '0;0.42;0.5;0.92;1', '6s'));
    svg.appendChild(kidB);
    svg.appendChild(enter(415, 70, '0.25s', [
      box(-80, -42, 160, 84),
      txt(0, -22, 'MCP resource server', '9', 'var(--ink,#1a1a1a)'),
      txt(0, 26, 'refresh before expiry', '8', 'var(--ink-mute,#777)')
    ]));
    var cacheA = txt(415, 72, 'JWKS cache: A', '10', 'var(--blueprint,#3553ff)');
    cacheA.appendChild(anim('opacity', '1;1;0;0;1', '0;0.6;0.68;0.92;1', '6s'));
    svg.appendChild(cacheA);
    var cacheB = txt(415, 72, 'JWKS cache: A+B', '10', 'var(--warn,#b8870f)');
    cacheB.setAttribute('opacity', '0');
    cacheB.appendChild(anim('opacity', '0;0;1;1;0', '0;0.6;0.68;0.92;1', '6s'));
    svg.appendChild(cacheB);
    svg.appendChild(packet(chip(62, 'fetch'), 'M187 90 L333 90', '6s',
      '0;0.5;0.62;1', '0;0;1;1;0;0', '0;0.5;0.52;0.6;0.64;1'));
    svg.appendChild(packet(chip(84, 'token kid:A'), 'M260 210 C300 210 340 180 400 120', '6s',
      '0;0.06;0.26;1', '0;1;1;0;0', '0;0.07;0.25;0.3;1'));
    svg.appendChild(packet(chip(84, 'token kid:B'), 'M260 210 C300 210 340 180 400 120', '6s',
      '0;0.72;0.9;1', '0;0;1;1;0;0', '0;0.72;0.74;0.89;0.94;1'));
    svg.appendChild(txt(180, 214, 'client requests', '8', 'var(--ink-mute,#777)', 'end'));
    var ok = txt(475, 122, 'valid', '9', 'var(--blueprint,#3553ff)');
    ok.setAttribute('opacity', '0');
    ok.appendChild(anim('opacity', '0;0;1;0;0;1;0', '0;0.26;0.31;0.4;0.9;0.95;1', '6s'));
    svg.appendChild(ok);
    host.appendChild(el('div', { class: 'lf' }, [
      head('JWKS ROTATION', 'refresh lands before the keys expire'),
      el('div', { class: 'lf-body' }, [out(svg)]),
      cap('The authorization server rolls its signing key from kid A to kid B on a schedule. A resource server that fetched JWKS once at boot starts rejecting every token at that moment. The production shape is a cached key set with a refresh job that overwrites the cache before the old keys expire, plus a fallback fetch on cache miss, so a token signed by the new key validates at 3 a.m. without a restart.')
    ]));
  }

  // t3-span-waterfall: one trace, nested spans grow in as a waterfall
  function spanWaterfall(host) {
    var svg = svgEl('svg', { viewBox: '0 0 520 260' });
    svg.appendChild(txt(20, 26, 'one trace id', '9', 'var(--blueprint,#3553ff)', 'start'));
    svg.appendChild(txt(500, 26, 'time', '9', 'var(--ink-mute,#777)', 'end'));
    svg.appendChild(svgEl('line', { x1: 20, y1: 34, x2: 500, y2: 34, stroke: 'var(--rule-soft,#ccc)', 'stroke-width': '1' }));
    var rows = [
      { label: 'invoke_agent', ind: 0, x0: 40, w: 440, t0: 0.04, t1: 0.86 },
      { label: 'llm.chat', ind: 1, x0: 60, w: 120, t0: 0.1, t1: 0.3 },
      { label: 'tool.execute', ind: 1, x0: 195, w: 150, t0: 0.34, t1: 0.58 },
      { label: 'mcp.call', ind: 2, x0: 215, w: 110, t0: 0.38, t1: 0.54 },
      { label: 'llm.chat', ind: 1, x0: 360, w: 110, t0: 0.62, t1: 0.8 }
    ];
    var i;
    for (i = 0; i < rows.length; i++) {
      var r = rows[i], y = 52 + i * 40;
      var fill = r.ind === 2 ? 'var(--warn,#b8870f)' : (r.ind === 0 ? 'var(--blueprint,#3553ff)' : 'var(--bg-surface,#eee)');
      var bar = svgEl('rect', { x: r.x0, y: y, width: 0, height: 16, rx: '2', fill: fill, stroke: 'var(--rule-soft,#ddd)', 'stroke-width': r.ind === 1 ? '1.2' : '0' });
      bar.appendChild(svgEl('animate', {
        attributeName: 'width', values: '0;0;' + r.w + ';' + r.w + ';0',
        keyTimes: '0;' + r.t0 + ';' + r.t1 + ';0.92;1', dur: '6s',
        repeatCount: 'indefinite', calcMode: 'spline',
        keySplines: EASE + ';' + EASE + ';' + EASE + ';' + EASE
      }));
      svg.appendChild(bar);
      var lbl = txt(r.x0 + 6, y + 12, r.label, '9', r.ind === 0 ? 'var(--bg,#fafaf5)' : 'var(--ink-soft,#555)', 'start');
      lbl.setAttribute('opacity', '0');
      lbl.appendChild(anim('opacity', '0;0;1;1;0', '0;' + (r.t0 + 0.03) + ';' + (r.t0 + 0.08) + ';0.92;1', '6s'));
      svg.appendChild(lbl);
    }
    svg.appendChild(txt(20, 252, 'gen_ai.operation.name on every span links the levels', '8', 'var(--ink-mute,#777)', 'start'));
    host.appendChild(el('div', { class: 'lf' }, [
      head('SPAN WATERFALL', 'agent, LLM, tool, MCP in one trace'),
      el('div', { class: 'lf-body' }, [out(svg)]),
      cap('One trace id covers the whole turn. The agent span opens first and closes last; inside it, an LLM call, a tool execution, and the MCP dispatch it wraps each get their own span with gen_ai attributes. When a backend cold-starts, the mcp.call bar is the one that stretches, which is exactly the question logs alone cannot answer.')
    ]));
  }

  // t3-skill-layers: three context layers, one bundle, any agent
  function skillLayers(host) {
    var svg = svgEl('svg', { viewBox: '0 0 520 250' });
    var layers = [
      { y: 60, t: 'AGENTS.md', s: 'project conventions, read at start', d: '0.1s' },
      { y: 125, t: 'SKILL.md', s: 'task know-how, loaded on demand', d: '0.28s' },
      { y: 190, t: 'MCP', s: 'the tools the skill invokes', d: '0.46s' }
    ];
    var i;
    for (i = 0; i < 3; i++) {
      svg.appendChild(enter(140, layers[i].y, layers[i].d, [
        box(-115, -26, 230, 52, i === 1 ? 'var(--blueprint,#3553ff)' : 'var(--rule-soft,#ddd)'),
        txt(0, -4, layers[i].t, '11', i === 1 ? 'var(--blueprint,#3553ff)' : 'var(--ink,#1a1a1a)'),
        txt(0, 13, layers[i].s, '8', 'var(--ink-mute,#777)')
      ]));
    }
    var agents = [
      { y: 55, t: 'Claude Code' },
      { y: 125, t: 'Cursor' },
      { y: 195, t: 'Codex' }
    ];
    for (i = 0; i < 3; i++) {
      svg.appendChild(enter(445, agents[i].y, (0.64 + i * 0.12) + 's', [
        box(-55, -20, 110, 40),
        txt(0, 5, agents[i].t, '10', 'var(--ink,#1a1a1a)')
      ]));
      svg.appendChild(svgEl('path', { d: 'M258 125 C330 125 330 ' + agents[i].y + ' 388 ' + agents[i].y, fill: 'none', stroke: 'var(--rule-soft,#ccc)', 'stroke-width': '1.3' }));
      var s = 0.08 + i * 0.3;
      var dot = svgEl('g', { opacity: '0' }, chip(66, 'bundle'));
      dot.appendChild(svgEl('animateMotion', { path: 'M258 125 C330 125 330 ' + agents[i].y + ' 388 ' + agents[i].y, dur: '5.5s', repeatCount: 'indefinite', calcMode: 'linear', keyPoints: '0;0;1;1', keyTimes: '0;' + s + ';' + (s + 0.2) + ';1' }));
      dot.appendChild(anim('opacity', '0;0;1;1;0;0', '0;' + s + ';' + (s + 0.02) + ';' + (s + 0.18) + ';' + (s + 0.22) + ';1', '5.5s'));
      svg.appendChild(dot);
    }
    host.appendChild(el('div', { class: 'lf' }, [
      head('THREE LAYERS', 'context, know-how, tools'),
      el('div', { class: 'lf-body' }, [out(svg)]),
      cap('AGENTS.md tells any agent how the project works. SKILL.md packages one workflow as frontmatter plus a body the runtime discloses progressively. MCP supplies the tools the skill calls. Because each layer is a plain file with an open format, the same bundle drops into Claude Code, Cursor, and Codex instead of being copied three times and drifting.')
    ]));
  }

  // t3-capstone-chain: one request crosses every Phase 13 piece
  function capstoneChain(host) {
    var svg = svgEl('svg', { viewBox: '0 0 520 270' });
    var stops = [
      { x: 55, y: 60, w: 80, t: 'user', s: 'asks', d: '0.1s' },
      { x: 195, y: 60, w: 96, t: 'gateway', s: 'OAuth + RBAC', d: '0.22s' },
      { x: 350, y: 60, w: 120, t: 'MCP server', s: 'discover + tools + task ext', d: '0.34s' },
      { x: 350, y: 165, w: 120, t: 'writer agent', s: 'A2A, opaque', d: '0.46s' }
    ];
    var i;
    for (i = 0; i < 4; i++) {
      var st = stops[i];
      svg.appendChild(enter(st.x, st.y, st.d, [
        box(-st.w / 2, -28, st.w, 56),
        txt(0, -6, st.t, '10', 'var(--ink,#1a1a1a)'),
        txt(0, 11, st.s, '8', 'var(--ink-mute,#777)')
      ]));
    }
    svg.appendChild(enter(120, 165, '0.58s', [
      box(-70, -24, 140, 48),
      txt(0, -2, 'ui:// report', '10', 'var(--blueprint,#3553ff)'),
      txt(0, 14, 'rendered inline', '8', 'var(--ink-mute,#777)')
    ]));
    svg.appendChild(svgEl('line', { x1: 30, y1: 236, x2: 490, y2: 236, stroke: 'var(--rule-soft,#ccc)', 'stroke-width': '1' }));
    svg.appendChild(txt(30, 226, 'OTel trace', '8', 'var(--ink-mute,#777)', 'start'));
    var hops = [
      { p: 'M95 52 L147 52', s: 0.02, tick: 120 },
      { p: 'M243 52 L290 52', s: 0.18, tick: 265 },
      { p: 'M350 88 L350 137', s: 0.34, tick: 350 },
      { p: 'M290 175 C230 180 210 180 190 172', s: 0.52, tick: 420 },
      { p: 'M60 88 C60 120 80 132 100 140', s: 0.72, tick: 470 }
    ];
    for (i = 0; i < hops.length; i++) {
      var h = hops[i];
      var dot = svgEl('circle', { r: 5, fill: 'var(--blueprint,#3553ff)', opacity: '0' }, []);
      dot.appendChild(svgEl('animateMotion', { path: h.p, dur: '6s', repeatCount: 'indefinite', calcMode: 'linear', keyPoints: '0;0;1;1', keyTimes: '0;' + h.s + ';' + (h.s + 0.14) + ';1' }));
      dot.appendChild(anim('opacity', '0;0;1;1;0;0', '0;' + h.s + ';' + (h.s + 0.01) + ';' + (h.s + 0.13) + ';' + (h.s + 0.15) + ';1', '6s'));
      svg.appendChild(dot);
      var tick = svgEl('rect', { x: h.tick, y: 231, width: 3, height: 10, fill: 'var(--warn,#b8870f)', opacity: '0' });
      tick.appendChild(anim('opacity', '0;0;1;1;0', '0;' + (h.s + 0.12) + ';' + (h.s + 0.16) + ';0.94;1', '6s'));
      svg.appendChild(tick);
    }
    svg.appendChild(txt(255, 152, 'A2A SendMessage', '8', 'var(--ink-mute,#777)'));
    host.appendChild(el('div', { class: 'lf' }, [
      head('CAPSTONE CHAIN', 'every Phase 13 piece, one request'),
      el('div', { class: 'lf-body' }, [out(svg)]),
      cap('Every stateless MCP request carries version and capabilities. The gateway authenticates and applies policy, the server may return an official task-extension handle that the client polls with tasks/get, and separate work delegates through A2A SendMessage. The final ui:// report and every boundary span remain linked without relying on a protocol session.')
    ]));
  }

  LF.register({
    't3-dispatch-loop': dispatchLoop,
    't3-primitive-sort': primitiveSort,
    't3-sampling-flip': samplingFlip,
    't3-roots-boundary': rootsBoundary,
    't3-ui-sandbox': uiSandbox,
    't3-scope-stepup': scopeStepup,
    't3-gateway-funnel': gatewayFunnel,
    't3-jwks-rotate': jwksRotate,
    't3-span-waterfall': spanWaterfall,
    't3-skill-layers': skillLayers,
    't3-capstone-chain': capstoneChain
  });
})();
