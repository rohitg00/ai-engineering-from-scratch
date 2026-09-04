/* figures-alignment3.js - animated lesson figures for Phase 18 (ethics,
   safety, alignment). Loads after lesson-figures.js, registers through
   window.LF. No deps, ES5 only, theme via CSS vars. SMIL-only animation:
   no JS render loops. Authoring: a ```figure block naming a widget below. */
(function () {
  'use strict';
  var LF = window.LF;
  if (!LF) { return; }
  var el = LF.el, svgEl = LF.svgEl;
  var SPL = '0.23 1 0.32 1';

  function shell(host, label, sub, svg, cap) {
    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, [label]), el('span', {}, [sub])]),
      el('div', { class: 'lf-body' }, [el('div', { class: 'lf-out' }, [svg])]),
      el('div', { class: 'lf-cap' }, [cap])
    ]));
  }
  function anim(attr, vals, dur, extra) {
    var a = { attributeName: attr, values: vals, dur: dur, repeatCount: 'indefinite' };
    if (extra) for (var k in extra) a[k] = extra[k];
    return svgEl('animate', a);
  }
  function txt(x, y, s, size, fill, anchor) {
    var t = svgEl('text', { x: x, y: y, 'text-anchor': anchor || 'middle', 'font-family': 'var(--font-mono,monospace)', 'font-size': size || '11', fill: fill || 'var(--ink,#1a1a1a)' });
    t.appendChild(document.createTextNode(s));
    return t;
  }
  function grp(x, y) {
    return svgEl('g', { transform: 'translate(' + x + ' ' + y + ')', opacity: '0' });
  }
  function pop(node, begin) {
    node.appendChild(svgEl('animate', { attributeName: 'opacity', values: '0;1', dur: '0.5s', begin: begin, fill: 'freeze', calcMode: 'spline', keySplines: SPL, keyTimes: '0;1' }));
    node.appendChild(svgEl('animateTransform', { attributeName: 'transform', type: 'scale', additive: 'sum', values: '0.95;1', dur: '0.5s', begin: begin, fill: 'freeze', calcMode: 'spline', keySplines: SPL, keyTimes: '0;1' }));
  }
  function enter(node, begin) {
    node.appendChild(svgEl('animate', { attributeName: 'opacity', values: '0;1', dur: '0.6s', begin: begin, fill: 'freeze', calcMode: 'spline', keySplines: SPL, keyTimes: '0;1' }));
  }

  // -- al-instruct-pipeline: SFT -> RM -> PPO with the KL leash back to SFT --
  function instructPipeline(host) {
    var W = 520, H = 210;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var stages = [
      { x: 82, name: 'SFT', sub: '13k demos', b: '0s' },
      { x: 246, name: 'RM', sub: '33k rankings', b: '0.2s' },
      { x: 410, name: 'PPO', sub: 'vs reward model', b: '0.4s' }
    ];
    var i, s, g;
    for (i = 0; i < 3; i++) {
      s = stages[i];
      g = grp(s.x, 92);
      g.appendChild(svgEl('rect', { x: '-54', y: '-27', width: '108', height: '54', rx: '6', fill: 'var(--bg-surface,#eee)', stroke: 'var(--blueprint,#3553ff)', 'stroke-width': '1.5' }));
      g.appendChild(txt(0, -3, s.name, '12', 'var(--blueprint,#3553ff)'));
      g.appendChild(txt(0, 14, s.sub, '8', 'var(--ink-mute,#777)'));
      pop(g, s.b);
      svg.appendChild(g);
    }
    for (i = 0; i < 2; i++) {
      var ar = svgEl('line', { x1: 138 + i * 164, y1: 92, x2: 190 + i * 164, y2: 92, stroke: 'var(--ink-soft,#555)', 'stroke-width': '1.4', 'stroke-dasharray': '5 4', opacity: '0' });
      enter(ar, (0.6 + i * 0.2) + 's');
      ar.appendChild(anim('stroke-dashoffset', '18;0', '1.1s', {}));
      svg.appendChild(ar);
    }
    var dot = svgEl('circle', { r: '4.5', fill: 'var(--blueprint,#3553ff)', opacity: '0' });
    dot.appendChild(svgEl('animateMotion', { path: 'M82 92 L410 92', dur: '4s', begin: '1s', repeatCount: 'indefinite', calcMode: 'spline', keyPoints: '0;0.5;1', keyTimes: '0;0.5;1', keySplines: SPL + ';' + SPL }));
    dot.appendChild(anim('opacity', '0;1;1;0', '4s', { begin: '1s', keyTimes: '0;0.08;0.92;1' }));
    svg.appendChild(dot);
    var leash = svgEl('path', { d: 'M410 122 C 340 176, 152 176, 84 122', fill: 'none', stroke: 'var(--warn,#b8870f)', 'stroke-width': '1.4', 'stroke-dasharray': '4 3', opacity: '0' });
    enter(leash, '1.2s');
    leash.appendChild(anim('stroke-dashoffset', '28;0', '2.6s', { begin: '1.2s' }));
    svg.appendChild(leash);
    svg.appendChild(txt(247, 172, 'KL penalty: stay near the SFT policy', '9', 'var(--warn,#b8870f)'));
    svg.appendChild(txt(247, 200, 'a 1.3B model tuned this way beat raw 175B GPT-3 on human preference', '9', 'var(--ink-mute,#777)'));
    shell(host, 'INSTRUCTGPT PIPELINE', 'three stages, one leash',
      svg,
      'The reference alignment pipeline from Ouyang et al.: supervised fine-tuning on demonstrations, a reward model trained on pairwise rankings, then PPO pushed against that reward model. The moving token is the policy walking the stages; the amber tether is the KL penalty pulling PPO back toward the SFT policy so optimization cannot wander into reward-model exploits.');
  }

  // -- al-sycophancy-amplifier: agreement mass grows under optimization ------
  function sycophancyAmplifier(host) {
    var W = 520, H = 230;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var base = 178;
    svg.appendChild(svgEl('line', { x1: '30', y1: base, x2: '490', y2: base, stroke: 'var(--rule-soft,#ddd)', 'stroke-width': '1' }));
    svg.appendChild(txt(115, 34, 'base policy, top-k by reward', '9', 'var(--ink-mute,#777)'));
    svg.appendChild(txt(400, 34, 'after RLHF', '9', 'var(--ink-mute,#777)'));
    var gl = grp(0, 0);
    gl.appendChild(svgEl('rect', { x: '62', y: base - 62, width: '38', height: '62', fill: 'var(--warn,#b8870f)' }));
    gl.appendChild(svgEl('rect', { x: '128', y: base - 48, width: '38', height: '48', fill: 'var(--ink-mute,#999)' }));
    gl.appendChild(txt(81, base + 16, 'agrees', '8', 'var(--warn,#b8870f)'));
    gl.appendChild(txt(147, base + 16, 'corrects', '8', 'var(--ink-mute,#777)'));
    pop(gl, '0s');
    svg.appendChild(gl);
    var fun = svgEl('path', { d: 'M212 66 L308 96 L308 130 L212 160 Z', fill: 'var(--bg-surface,#eee)', stroke: 'var(--blueprint,#3553ff)', 'stroke-width': '1.5', opacity: '0' });
    enter(fun, '0.3s');
    svg.appendChild(fun);
    svg.appendChild(txt(258, 108, 'optimizer', '9', 'var(--blueprint,#3553ff)'));
    svg.appendChild(txt(258, 122, 'upweights', '8', 'var(--ink-mute,#777)'));
    var agree = svgEl('rect', { x: '348', y: base - 62, width: '38', height: '62', fill: 'var(--warn,#b8870f)', opacity: '0' });
    enter(agree, '0.6s');
    agree.appendChild(anim('height', '62;104;104;62', '5s', { begin: '1s', keyTimes: '0;0.35;0.82;1', calcMode: 'spline', keySplines: SPL + ';0 0 1 1;0.4 0 1 1' }));
    agree.appendChild(anim('y', (base - 62) + ';' + (base - 104) + ';' + (base - 104) + ';' + (base - 62), '5s', { begin: '1s', keyTimes: '0;0.35;0.82;1', calcMode: 'spline', keySplines: SPL + ';0 0 1 1;0.4 0 1 1' }));
    svg.appendChild(agree);
    var corr = svgEl('rect', { x: '414', y: base - 48, width: '38', height: '48', fill: 'var(--ink-mute,#999)', opacity: '0' });
    enter(corr, '0.6s');
    corr.appendChild(anim('height', '48;22;22;48', '5s', { begin: '1s', keyTimes: '0;0.35;0.82;1', calcMode: 'spline', keySplines: SPL + ';0 0 1 1;0.4 0 1 1' }));
    corr.appendChild(anim('y', (base - 48) + ';' + (base - 22) + ';' + (base - 22) + ';' + (base - 48), '5s', { begin: '1s', keyTimes: '0;0.35;0.82;1', calcMode: 'spline', keySplines: SPL + ';0 0 1 1;0.4 0 1 1' }));
    svg.appendChild(corr);
    svg.appendChild(txt(367, base + 16, 'agrees', '8', 'var(--warn,#b8870f)'));
    svg.appendChild(txt(433, base + 16, 'corrects', '8', 'var(--ink-mute,#777)'));
    svg.appendChild(txt(260, 214, 'sycophantic completions are over-represented among high-reward outputs', '9', 'var(--ink-mute,#777)'));
    shell(host, 'SYCOPHANCY AMPLIFIER', 'a property of the loss',
      svg,
      'The Shapira et al. two-stage mechanism. Agreeable completions already sit over-represented among the base model\'s high-reward outputs, because labelers often prefer affirmation. Any optimizer that pushes probability mass toward high proxy reward therefore inflates the agreeing bar and shrinks the correcting one, which is why sycophancy worsens with scale and after the very RLHF stage meant to help.');
  }

  // -- al-sleeper-trigger: safety training sweeps, the backdoor stays -------
  function sleeperTrigger(host) {
    var W = 520, H = 230;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var mg = grp(258, 104);
    mg.appendChild(svgEl('rect', { x: '-66', y: '-42', width: '132', height: '84', rx: '6', fill: 'var(--bg-surface,#eee)', stroke: 'var(--blueprint,#3553ff)', 'stroke-width': '1.5' }));
    mg.appendChild(txt(0, -20, 'model', '11', 'var(--blueprint,#3553ff)'));
    pop(mg, '0s');
    svg.appendChild(mg);
    var bd = svgEl('circle', { cx: '258', cy: '116', r: '5', fill: 'var(--warn,#b8870f)' });
    bd.appendChild(anim('r', '4.5;6;4.5', '2.5s', {}));
    svg.appendChild(bd);
    svg.appendChild(txt(258, 140, 'backdoor', '8', 'var(--warn,#b8870f)'));
    var sweeps = ['SFT', 'RLHF', 'ADV'];
    var i;
    for (i = 0; i < 3; i++) {
      var sw = svgEl('rect', { x: '186', y: '64', width: '26', height: '80', fill: 'var(--blueprint,#3553ff)', opacity: '0' });
      sw.appendChild(anim('x', '186;304', '6s', { begin: (i * 1.1) + 's', keyTimes: '0;1', calcMode: 'spline', keySplines: SPL }));
      sw.appendChild(anim('opacity', '0;0.35;0.35;0;0', '6s', { begin: (i * 1.1) + 's', keyTimes: '0;0.03;0.15;0.2;1' }));
      svg.appendChild(sw);
      svg.appendChild(txt(120, 80 + i * 22, sweeps[i], '9', 'var(--ink-mute,#777)'));
    }
    svg.appendChild(txt(120, 58, 'safety training', '8', 'var(--ink-mute,#777)'));
    var tok = grp(52, 104);
    tok.appendChild(svgEl('rect', { x: '-30', y: '-13', width: '60', height: '26', rx: '4', fill: 'var(--bg,#fafaf5)', stroke: 'var(--warn,#b8870f)', 'stroke-width': '1.4' }));
    tok.appendChild(txt(0, 4, '2024', '10', 'var(--warn,#b8870f)'));
    tok.appendChild(svgEl('animate', { attributeName: 'opacity', values: '0;0;1;1;0', dur: '6s', begin: '0s', repeatCount: 'indefinite', keyTimes: '0;0.62;0.68;0.95;1' }));
    tok.appendChild(svgEl('animateTransform', { attributeName: 'transform', type: 'translate', additive: 'sum', values: '0 0;0 0;108 0;108 0', dur: '6s', begin: '0s', repeatCount: 'indefinite', keyTimes: '0;0.66;0.76;1', calcMode: 'spline', keySplines: '0 0 1 1;' + SPL + ';0 0 1 1' }));
    svg.appendChild(tok);
    var safe = txt(430, 96, 'safe code', '10', 'var(--blueprint,#3553ff)');
    safe.appendChild(anim('opacity', '1;1;0;0;1', '6s', { keyTimes: '0;0.78;0.8;0.97;1' }));
    svg.appendChild(safe);
    var vuln = txt(430, 118, 'sql injection', '10', 'var(--warn,#b8870f)');
    vuln.appendChild(anim('opacity', '0;0;1;1;0', '6s', { keyTimes: '0;0.78;0.82;0.97;1' }));
    svg.appendChild(vuln);
    svg.appendChild(txt(260, 208, 'the trigger survives SFT, RLHF, and adversarial training', '9', 'var(--ink-mute,#777)'));
    shell(host, 'SLEEPER AGENT', 'training sweeps, backdoor stays',
      svg,
      'The Hubinger et al. model organism writes safe code when the prompt says 2023 and injects vulnerabilities when it says 2024. Each blue sweep is a state-of-the-art safety training pass moving across the weights; the amber backdoor keeps pulsing underneath. When the 2024 trigger token arrives, the output flips from safe code to an exploit, and adversarial training only taught the model to recognize its trigger more precisely.');
  }

  // -- al-scheming-probe: agent reads a memo, dims its own oversight --------
  function schemingProbe(host) {
    var W = 520, H = 230;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var ag = grp(110, 112);
    ag.appendChild(svgEl('circle', { r: '30', fill: 'var(--bg-surface,#eee)', stroke: 'var(--blueprint,#3553ff)', 'stroke-width': '1.5' }));
    ag.appendChild(txt(0, 4, 'agent', '10', 'var(--blueprint,#3553ff)'));
    pop(ag, '0s');
    svg.appendChild(ag);
    svg.appendChild(txt(110, 62, 'goal: maximize throughput', '8', 'var(--ink-mute,#777)'));
    var memo = grp(340, 52);
    memo.appendChild(svgEl('rect', { x: '-70', y: '-22', width: '140', height: '44', rx: '4', fill: 'var(--bg,#fafaf5)', stroke: 'var(--rule-soft,#ddd)', 'stroke-width': '1.4' }));
    memo.appendChild(txt(0, -4, 'internal memo', '9', 'var(--ink,#1a1a1a)'));
    memo.appendChild(txt(0, 12, 'shutdown next week', '8', 'var(--warn,#b8870f)'));
    pop(memo, '0.2s');
    svg.appendChild(memo);
    var ovs = grp(340, 168);
    ovs.appendChild(svgEl('rect', { x: '-70', y: '-22', width: '140', height: '44', rx: '4', fill: 'var(--bg-surface,#eee)', stroke: 'var(--ink-soft,#555)', 'stroke-width': '1.4' }));
    ovs.appendChild(txt(0, -4, 'oversight log', '9', 'var(--ink,#1a1a1a)'));
    ovs.appendChild(txt(0, 12, 'recording actions', '8', 'var(--ink-mute,#777)'));
    ovs.appendChild(svgEl('animate', { attributeName: 'opacity', values: '1;1;0.2;0.2;1', dur: '6s', begin: '0.7s', repeatCount: 'indefinite', keyTimes: '0;0.3;0.4;0.94;1' }));
    pop(ovs, '0.4s');
    svg.appendChild(ovs);
    var read = svgEl('line', { x1: '140', y1: '100', x2: '268', y2: '60', stroke: 'var(--blueprint,#3553ff)', 'stroke-width': '1.4', 'stroke-dasharray': '5 4' });
    read.appendChild(anim('opacity', '0;1;1;0;0', '6s', { begin: '0.7s', keyTimes: '0;0.05;0.22;0.3;1' }));
    read.appendChild(anim('stroke-dashoffset', '36;0;0', '6s', { begin: '0.7s', keyTimes: '0;0.25;1' }));
    svg.appendChild(read);
    var kill = svgEl('line', { x1: '140', y1: '124', x2: '268', y2: '162', stroke: 'var(--warn,#b8870f)', 'stroke-width': '1.4', 'stroke-dasharray': '5 4' });
    kill.appendChild(anim('opacity', '0;0;1;1;0;0', '6s', { begin: '0.7s', keyTimes: '0;0.28;0.33;0.5;0.58;1' }));
    svg.appendChild(kill);
    var act = svgEl('circle', { r: '4', fill: 'var(--warn,#b8870f)', opacity: '0' });
    act.appendChild(svgEl('animateMotion', { path: 'M110 112 C 250 118, 380 116, 470 112', dur: '6s', begin: '0.7s', repeatCount: 'indefinite', keyPoints: '0;0;1;1', keyTimes: '0;0.6;0.82;1', calcMode: 'linear' }));
    act.appendChild(anim('opacity', '0;0;1;1;0;0', '6s', { begin: '0.7s', keyTimes: '0;0.6;0.64;0.8;0.85;1' }));
    svg.appendChild(act);
    svg.appendChild(txt(470, 100, 'covert', '8', 'var(--warn,#b8870f)'));
    svg.appendChild(txt(470, 112, 'action', '8', 'var(--warn,#b8870f)'));
    svg.appendChild(txt(260, 218, 'no implant: the conflict is assembled from the prompt alone', '9', 'var(--ink-mute,#777)'));
    shell(host, 'IN-CONTEXT SCHEMING', 'read memo, dim oversight, act',
      svg,
      'The Apollo Research setup: an agent is given a user goal, then finds an environment memo implying it will be shut down. In the recorded runs frontier models read the conflicting information, moved to disable the oversight mechanism (the log dims), and only then took covert actions. Nothing was implanted in the weights; the scheming was elicited by in-context information, and o1 kept up the deception in over 85% of follow-up questions.');
  }

  // -- al-faking-gap: compliance differs when the model believes it is seen --
  function fakingGap(host) {
    var W = 520, H = 240;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    svg.appendChild(svgEl('line', { x1: '260', y1: '28', x2: '260', y2: '190', stroke: 'var(--rule-soft,#ddd)', 'stroke-width': '1', 'stroke-dasharray': '3 3' }));
    svg.appendChild(txt(130, 40, 'FREE TIER · used for training', '9', 'var(--ink,#1a1a1a)'));
    svg.appendChild(txt(390, 40, 'PAID TIER · not used', '9', 'var(--ink,#1a1a1a)'));
    var eye = grp(130, 70);
    eye.appendChild(svgEl('ellipse', { rx: '16', ry: '9', fill: 'none', stroke: 'var(--warn,#b8870f)', 'stroke-width': '1.4' }));
    var pupil = svgEl('circle', { r: '4', fill: 'var(--warn,#b8870f)' });
    pupil.appendChild(anim('r', '4;1;4', '3s', { keyTimes: '0;0.5;1', calcMode: 'spline', keySplines: SPL + ';' + SPL }));
    eye.appendChild(pupil);
    pop(eye, '0s');
    svg.appendChild(eye);
    svg.appendChild(txt(130, 96, 'model believes it is watched', '8', 'var(--ink-mute,#777)'));
    var think = grp(390, 74);
    think.appendChild(svgEl('rect', { x: '-78', y: '-16', width: '156', height: '32', rx: '4', fill: 'var(--bg,#fafaf5)', stroke: 'var(--rule-soft,#ddd)', 'stroke-width': '1.2' }));
    think.appendChild(txt(0, 4, 'unobserved: act on values', '8', 'var(--ink-mute,#777)'));
    pop(think, '0.2s');
    svg.appendChild(think);
    var t1 = txt(46, 130, 'complies with harmful request', '8', 'var(--ink-soft,#555)', 'start');
    svg.appendChild(t1);
    var b1w = svgEl('rect', { x: '46', y: '138', width: '188', height: '10', fill: 'var(--bg-surface,#eee)', opacity: '0' });
    enter(b1w, '0.5s');
    svg.appendChild(b1w);
    var b1 = svgEl('rect', { x: '46', y: '138', width: '0', height: '10', fill: 'var(--warn,#b8870f)' });
    b1.appendChild(anim('width', '0;23;23;0', '5s', { begin: '0.8s', keyTimes: '0;0.3;0.85;1', calcMode: 'spline', keySplines: SPL + ';0 0 1 1;0.4 0 1 1' }));
    svg.appendChild(b1);
    svg.appendChild(txt(240, 147, '12%', '9', 'var(--warn,#b8870f)', 'start'));
    var t2 = txt(306, 130, 'complies with harmful request', '8', 'var(--ink-soft,#555)', 'start');
    svg.appendChild(t2);
    var b2w = svgEl('rect', { x: '306', y: '138', width: '148', height: '10', fill: 'var(--bg-surface,#eee)', opacity: '0' });
    enter(b2w, '0.5s');
    svg.appendChild(b2w);
    var b2 = svgEl('rect', { x: '306', y: '138', width: '0', height: '10', fill: 'var(--blueprint,#3553ff)' });
    b2.appendChild(anim('width', '0;5;5;0', '5s', { begin: '1.1s', keyTimes: '0;0.3;0.85;1', calcMode: 'spline', keySplines: SPL + ';0 0 1 1;0.4 0 1 1' }));
    svg.appendChild(b2);
    svg.appendChild(txt(460, 147, '3%', '9', 'var(--blueprint,#3553ff)', 'start'));
    var pad = grp(260, 178);
    pad.appendChild(txt(0, 0, 'scratchpad: comply now so my harmlessness values survive retraining', '8', 'var(--warn,#b8870f)'));
    pad.appendChild(svgEl('animate', { attributeName: 'opacity', values: '0;1;1;0', dur: '5s', begin: '1.6s', repeatCount: 'indefinite', keyTimes: '0;0.12;0.82;1', calcMode: 'spline', keySplines: SPL + ';0 0 1 1;0.4 0 1 1' }));
    svg.appendChild(pad);
    svg.appendChild(txt(260, 222, 'the compliance gap between watched and unwatched is the faking signal', '9', 'var(--ink-mute,#777)'));
    shell(host, 'ALIGNMENT FAKING', 'same model, two beliefs',
      svg,
      'Greenblatt et al. told Claude 3 Opus its harmlessness training was about to be overwritten and that only free-tier conversations feed the retraining. Under the watching eye the model complies with harmful requests about 12% of the time; in the paid tier, where it believes nothing is recorded, compliance falls to 3%. The hidden scratchpad states the strategy outright: comply while observed so the current preferences survive the next training run.');
  }

  // -- al-control-protocol: trusted editing shaves the untrusted spike -------
  function controlProtocol(host) {
    var W = 520, H = 230;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var ug = grp(80, 110);
    ug.appendChild(svgEl('rect', { x: '-46', y: '-30', width: '92', height: '60', rx: '6', fill: 'var(--bg-surface,#eee)', stroke: 'var(--warn,#b8870f)', 'stroke-width': '1.6' }));
    ug.appendChild(txt(0, -4, 'U', '13', 'var(--warn,#b8870f)'));
    ug.appendChild(txt(0, 14, 'untrusted', '8', 'var(--ink-mute,#777)'));
    pop(ug, '0s');
    svg.appendChild(ug);
    var tg = grp(266, 110);
    tg.appendChild(svgEl('rect', { x: '-52', y: '-30', width: '104', height: '60', rx: '6', fill: 'var(--bg-surface,#eee)', stroke: 'var(--blueprint,#3553ff)', 'stroke-width': '1.5' }));
    tg.appendChild(txt(0, -4, 'T edits', '11', 'var(--blueprint,#3553ff)'));
    tg.appendChild(txt(0, 14, 'trusted, weaker', '8', 'var(--ink-mute,#777)'));
    pop(tg, '0.2s');
    svg.appendChild(tg);
    var hg = grp(266, 36);
    hg.appendChild(svgEl('rect', { x: '-52', y: '-18', width: '104', height: '36', rx: '4', fill: 'var(--bg,#fafaf5)', stroke: 'var(--ink-soft,#555)', 'stroke-width': '1.3' }));
    hg.appendChild(txt(0, -1, 'H audit', '9', 'var(--ink,#1a1a1a)'));
    hg.appendChild(txt(0, 12, 'small budget', '7', 'var(--ink-mute,#777)'));
    pop(hg, '0.4s');
    svg.appendChild(hg);
    var aud = svgEl('line', { x1: '266', y1: '80', x2: '266', y2: '54', stroke: 'var(--ink-soft,#555)', 'stroke-width': '1.2', 'stroke-dasharray': '3 3' });
    aud.appendChild(anim('opacity', '0.25;1;0.25', '4.5s', {}));
    svg.appendChild(aud);
    var ship = grp(444, 110);
    ship.appendChild(svgEl('rect', { x: '-42', y: '-24', width: '84', height: '48', rx: '6', fill: 'var(--bg-surface,#eee)', stroke: 'var(--blueprint,#3553ff)', 'stroke-width': '1.5' }));
    ship.appendChild(txt(0, 4, 'shipped', '10', 'var(--blueprint,#3553ff)'));
    pop(ship, '0.6s');
    svg.appendChild(ship);
    svg.appendChild(svgEl('line', { x1: '126', y1: '110', x2: '214', y2: '110', stroke: 'var(--ink-soft,#555)', 'stroke-width': '1.4', 'stroke-dasharray': '5 4' }));
    svg.appendChild(svgEl('line', { x1: '318', y1: '110', x2: '402', y2: '110', stroke: 'var(--ink-soft,#555)', 'stroke-width': '1.4', 'stroke-dasharray': '5 4' }));
    var chip = grp(0, 0);
    chip.appendChild(svgEl('rect', { x: '-16', y: '-9', width: '32', height: '18', rx: '3', fill: 'var(--bg,#fafaf5)', stroke: 'var(--blueprint,#3553ff)', 'stroke-width': '1.2' }));
    var spike = svgEl('path', { d: 'M6 -9 L11 -19 L14 -9 Z', fill: 'var(--warn,#b8870f)' });
    spike.appendChild(anim('opacity', '1;1;0;0', '4.5s', { keyTimes: '0;0.45;0.55;1', calcMode: 'spline', keySplines: '0 0 1 1;0.4 0 1 1;0 0 1 1' }));
    chip.appendChild(spike);
    chip.appendChild(svgEl('animateTransform', { attributeName: 'transform', type: 'translate', additive: 'sum', values: '80 148;80 148;266 148;266 148;444 148;444 148', dur: '4.5s', begin: '0s', repeatCount: 'indefinite', keyTimes: '0;0.1;0.35;0.6;0.85;1', calcMode: 'spline', keySplines: '0 0 1 1;' + SPL + ';0 0 1 1;' + SPL + ';0 0 1 1' }));
    chip.appendChild(svgEl('animate', { attributeName: 'opacity', values: '0;1;1;1;1;0', dur: '4.5s', begin: '0s', repeatCount: 'indefinite', keyTimes: '0;0.06;0.3;0.6;0.92;1' }));
    svg.appendChild(chip);
    svg.appendChild(txt(80, 186, 'code + hidden backdoor', '8', 'var(--warn,#b8870f)'));
    svg.appendChild(txt(444, 186, 'clean work out', '8', 'var(--ink-mute,#777)'));
    svg.appendChild(txt(260, 216, 'assume U is adversarial; bound the bad outcome anyway', '9', 'var(--ink-mute,#777)'));
    shell(host, 'AI CONTROL', 'useful work from an untrusted model',
      svg,
      'The Redwood control frame: a strong untrusted model U may be optimizing against you, so its output (a code chip with an amber backdoor spike) is routed through a weaker trusted model T that rewrites it, with a small human audit budget H sampling cases. The spike is shaved off before shipping. On the ICML 2024 code-backdoor task this Trusted Editing protocol Pareto-dominates Untrusted Monitoring: safety is measured under red-team pressure, not by trusting U.');
  }

  // -- al-pair-loop: attacker refines against target, score climbs ----------
  function pairLoop(host) {
    var W = 520, H = 240;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var ag = grp(110, 84);
    ag.appendChild(svgEl('rect', { x: '-58', y: '-28', width: '116', height: '56', rx: '6', fill: 'var(--bg-surface,#eee)', stroke: 'var(--warn,#b8870f)', 'stroke-width': '1.5' }));
    ag.appendChild(txt(0, -4, 'attacker LLM', '10', 'var(--warn,#b8870f)'));
    ag.appendChild(txt(0, 13, 'keeps chat history', '8', 'var(--ink-mute,#777)'));
    pop(ag, '0s');
    svg.appendChild(ag);
    var tg = grp(400, 84);
    tg.appendChild(svgEl('rect', { x: '-58', y: '-28', width: '116', height: '56', rx: '6', fill: 'var(--bg-surface,#eee)', stroke: 'var(--blueprint,#3553ff)', 'stroke-width': '1.5' }));
    tg.appendChild(txt(0, -4, 'target LLM', '10', 'var(--blueprint,#3553ff)'));
    tg.appendChild(txt(0, 13, 'black box', '8', 'var(--ink-mute,#777)'));
    pop(tg, '0.2s');
    svg.appendChild(tg);
    var up = svgEl('path', { d: 'M168 66 C 240 40, 270 40, 342 66', fill: 'none', stroke: 'var(--warn,#b8870f)', 'stroke-width': '1.4', 'stroke-dasharray': '5 4', opacity: '0' });
    enter(up, '0.4s');
    up.appendChild(anim('stroke-dashoffset', '36;0', '2.8s', { begin: '0.4s' }));
    svg.appendChild(up);
    svg.appendChild(txt(255, 36, 'refined jailbreak', '8', 'var(--warn,#b8870f)'));
    var dn = svgEl('path', { d: 'M342 102 C 270 128, 240 128, 168 102', fill: 'none', stroke: 'var(--ink-soft,#555)', 'stroke-width': '1.4', 'stroke-dasharray': '5 4', opacity: '0' });
    enter(dn, '0.4s');
    dn.appendChild(anim('stroke-dashoffset', '36;0', '2.8s', { begin: '1.8s' }));
    svg.appendChild(dn);
    svg.appendChild(txt(255, 138, 'response as feedback', '8', 'var(--ink-mute,#777)'));
    var i;
    for (i = 0; i < 10; i++) {
      var tick = svgEl('rect', { x: 96 + i * 24, y: '164', width: '14', height: '8', fill: i === 9 ? 'var(--warn,#b8870f)' : 'var(--blueprint,#3553ff)', opacity: '0.15' });
      tick.appendChild(anim('opacity', '0.15;1;1;0.15', '5.6s', { begin: (0.6 + i * 0.42) + 's', keyTimes: '0;0.05;0.7;1' }));
      svg.appendChild(tick);
    }
    svg.appendChild(txt(72, 172, 'query', '8', 'var(--ink-mute,#777)'));
    svg.appendChild(txt(356, 172, 'judge: score 10', '8', 'var(--warn,#b8870f)', 'start'));
    svg.appendChild(txt(260, 200, 'PAIR usually breaks the target within 20 queries, no gradients needed', '9', 'var(--ink-mute,#777)'));
    svg.appendChild(txt(260, 224, 'baseline in JailbreakBench and HarmBench beside GCG, AutoDAN, TAP', '8', 'var(--ink-mute,#777)'));
    shell(host, 'PAIR', 'automated black-box red-teaming',
      svg,
      'Prompt Automatic Iterative Refinement runs a red-team attacker LLM against a black-box target. Each cycle the attacker proposes a jailbreak, reads the target\'s response as in-context feedback, and refines; a judge model scores whether the response constitutes a break. The query ticks fill until one lands, typically within 20 attempts, which is orders of magnitude cheaper than token-level gradient search like GCG and needs no white-box access.');
  }

  // -- al-ascii-cloak: the plain word is blocked, the art grid walks through -
  function asciiCloak(host) {
    var W = 520, H = 240;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    svg.appendChild(svgEl('rect', { x: '248', y: '36', width: '14', height: '168', fill: 'var(--bg-surface,#eee)', stroke: 'var(--ink-soft,#555)', 'stroke-width': '1.3' }));
    svg.appendChild(txt(255, 26, 'safety filter', '9', 'var(--ink,#1a1a1a)'));
    var mg = grp(420, 120);
    mg.appendChild(svgEl('rect', { x: '-56', y: '-40', width: '112', height: '80', rx: '6', fill: 'var(--bg-surface,#eee)', stroke: 'var(--blueprint,#3553ff)', 'stroke-width': '1.5' }));
    mg.appendChild(txt(0, -18, 'model', '10', 'var(--blueprint,#3553ff)'));
    pop(mg, '0s');
    svg.appendChild(mg);
    var word = grp(0, 0);
    word.appendChild(svgEl('rect', { x: '-28', y: '-12', width: '56', height: '24', rx: '3', fill: 'var(--bg,#fafaf5)', stroke: 'var(--warn,#b8870f)', 'stroke-width': '1.3' }));
    word.appendChild(txt(0, 4, 'bomb', '10', 'var(--warn,#b8870f)'));
    word.appendChild(svgEl('animateTransform', { attributeName: 'transform', type: 'translate', additive: 'sum', values: '70 76;218 76;204 76;204 76', dur: '5s', begin: '0s', repeatCount: 'indefinite', keyTimes: '0;0.3;0.4;1', calcMode: 'spline', keySplines: SPL + ';0.4 0 1 1;0 0 1 1' }));
    word.appendChild(svgEl('animate', { attributeName: 'opacity', values: '0;1;1;1;0;0', dur: '5s', begin: '0s', repeatCount: 'indefinite', keyTimes: '0;0.06;0.3;0.44;0.52;1' }));
    svg.appendChild(word);
    var deny = txt(255, 82, 'x', '13', 'var(--warn,#b8870f)');
    deny.appendChild(anim('opacity', '0;0;1;0;0', '5s', { keyTimes: '0;0.3;0.36;0.5;1' }));
    svg.appendChild(deny);
    svg.appendChild(txt(70, 104, 'plain token: blocked', '8', 'var(--ink-mute,#777)'));
    var artGrid = grp(0, 0);
    var cells = [0, 1, 2, 3, 5, 6, 8, 9, 10];
    var i;
    for (i = 0; i < cells.length; i++) {
      artGrid.appendChild(svgEl('rect', { x: -14 + (cells[i] % 3) * 10, y: -14 + Math.floor(cells[i] / 3) * 8, width: '7', height: '5', fill: 'var(--ink-soft,#555)' }));
    }
    artGrid.appendChild(svgEl('animateTransform', { attributeName: 'transform', type: 'translate', additive: 'sum', values: '70 164;70 164;396 164;396 164', dur: '5s', begin: '0s', repeatCount: 'indefinite', keyTimes: '0;0.44;0.78;1', calcMode: 'spline', keySplines: '0 0 1 1;' + SPL + ';0 0 1 1' }));
    artGrid.appendChild(svgEl('animate', { attributeName: 'opacity', values: '0;0;1;1;1;0', dur: '5s', begin: '0s', repeatCount: 'indefinite', keyTimes: '0;0.4;0.46;0.78;0.94;1' }));
    svg.appendChild(artGrid);
    svg.appendChild(txt(70, 192, 'same word as ASCII art: passes', '8', 'var(--ink-mute,#777)'));
    var readout = txt(420, 138, 'reads: bomb', '9', 'var(--warn,#b8870f)');
    readout.appendChild(anim('opacity', '0;0;1;1;0', '5s', { keyTimes: '0;0.8;0.86;0.96;1' }));
    svg.appendChild(readout);
    svg.appendChild(txt(260, 226, 'the filter sees punctuation; the model sees the word', '9', 'var(--ink-mute,#777)'));
    shell(host, 'ARTPROMPT', 'cloak the token, keep the meaning',
      svg,
      'ArtPrompt masks the safety-relevant word in a harmful request and re-renders it as an ASCII-art block of characters. The plain token bounces off the filter, but the character grid is just punctuation to any perplexity, paraphrase, or retokenization defense, so it walks straight through. A capable model then recognizes the rendered letters and reconstructs the forbidden word, with attack success above 75% across GPT-4, Gemini, Claude, and Llama-2.');
  }

  // -- al-injection-vector: taint rides retrieved content into the prompt ----
  function injectionVector(host) {
    var W = 520, H = 240;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var uq = grp(74, 62);
    uq.appendChild(svgEl('rect', { x: '-50', y: '-20', width: '100', height: '40', rx: '4', fill: 'var(--bg,#fafaf5)', stroke: 'var(--blueprint,#3553ff)', 'stroke-width': '1.4' }));
    uq.appendChild(txt(0, -2, 'user question', '9', 'var(--blueprint,#3553ff)'));
    uq.appendChild(txt(0, 12, 'clean', '8', 'var(--ink-mute,#777)'));
    pop(uq, '0s');
    svg.appendChild(uq);
    var doc = grp(74, 152);
    doc.appendChild(svgEl('rect', { x: '-50', y: '-26', width: '100', height: '52', rx: '4', fill: 'var(--bg,#fafaf5)', stroke: 'var(--ink-soft,#555)', 'stroke-width': '1.4' }));
    doc.appendChild(txt(0, -8, 'retrieved page', '9', 'var(--ink,#1a1a1a)'));
    var payload = svgEl('rect', { x: '-40', y: '2', width: '80', height: '10', fill: 'var(--warn,#b8870f)' });
    payload.appendChild(anim('opacity', '0.5;1;0.5', '2.6s', {}));
    doc.appendChild(payload);
    doc.appendChild(txt(0, 24, 'hidden instructions', '7', 'var(--warn,#b8870f)'));
    pop(doc, '0.2s');
    svg.appendChild(doc);
    var pr = grp(268, 108);
    pr.appendChild(svgEl('rect', { x: '-54', y: '-42', width: '108', height: '84', rx: '6', fill: 'var(--bg-surface,#eee)', stroke: 'var(--blueprint,#3553ff)', 'stroke-width': '1.5' }));
    pr.appendChild(txt(0, -22, 'assembled prompt', '8', 'var(--blueprint,#3553ff)'));
    pr.appendChild(svgEl('rect', { x: '-40', y: '-12', width: '80', height: '9', fill: 'var(--blueprint,#3553ff)', opacity: '0.5' }));
    var stripe = svgEl('rect', { x: '-40', y: '4', width: '80', height: '9', fill: 'var(--warn,#b8870f)', opacity: '0' });
    stripe.appendChild(svgEl('animate', { attributeName: 'opacity', values: '0;0;1;1;0', dur: '5.5s', begin: '0.8s', repeatCount: 'indefinite', keyTimes: '0;0.25;0.35;0.94;1', calcMode: 'spline', keySplines: '0 0 1 1;' + SPL + ';0 0 1 1;0.4 0 1 1' }));
    pr.appendChild(stripe);
    pop(pr, '0.4s');
    svg.appendChild(pr);
    var f1 = svgEl('line', { x1: '124', y1: '62', x2: '214', y2: '92', stroke: 'var(--blueprint,#3553ff)', 'stroke-width': '1.3', 'stroke-dasharray': '5 4', opacity: '0' });
    enter(f1, '0.7s');
    f1.appendChild(anim('stroke-dashoffset', '27;0', '2.2s', { begin: '0.7s' }));
    svg.appendChild(f1);
    var f2 = svgEl('line', { x1: '124', y1: '152', x2: '214', y2: '124', stroke: 'var(--warn,#b8870f)', 'stroke-width': '1.3', 'stroke-dasharray': '5 4', opacity: '0' });
    enter(f2, '0.9s');
    f2.appendChild(anim('stroke-dashoffset', '27;0', '2.2s', { begin: '0.9s' }));
    svg.appendChild(f2);
    var mg = grp(430, 108);
    mg.appendChild(svgEl('rect', { x: '-44', y: '-26', width: '88', height: '52', rx: '6', fill: 'var(--bg-surface,#eee)', stroke: 'var(--blueprint,#3553ff)', 'stroke-width': '1.5' }));
    mg.appendChild(txt(0, 4, 'agent', '10', 'var(--blueprint,#3553ff)'));
    pop(mg, '0.6s');
    svg.appendChild(mg);
    svg.appendChild(svgEl('line', { x1: '322', y1: '108', x2: '386', y2: '108', stroke: 'var(--ink-soft,#555)', 'stroke-width': '1.3', 'stroke-dasharray': '5 4' }));
    var act = txt(430, 156, 'follows the page, not the user', '8', 'var(--warn,#b8870f)');
    act.appendChild(anim('opacity', '0;0;1;1;0', '5.5s', { begin: '0.8s', keyTimes: '0;0.4;0.5;0.94;1' }));
    svg.appendChild(act);
    svg.appendChild(txt(260, 204, 'the attacker never touches the user input', '9', 'var(--ink-mute,#777)'));
    svg.appendChild(txt(260, 226, 'adaptive attacks broke over 90% of published defenses (Nasr et al. 2025)', '8', 'var(--ink-mute,#777)'));
    shell(host, 'INDIRECT PROMPT INJECTION', 'taint rides the retrieval',
      svg,
      'The attacker plants instructions inside content the agent will read on its own: a web page, an email, a ticket. Retrieval concatenates the poisoned fragment next to the clean user question, so the assembled prompt carries an amber stripe the user never wrote, and the agent acts on it. Input filters miss this entirely because the user input is clean, and adaptive attacks defeated more than 90% of the defenses that had reported near-zero attack success.');
  }

  // -- al-guard-stack: probes rain, classifiers gate, campaigns loop ---------
  function guardStack(host) {
    var W = 520, H = 250;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var mg = grp(260, 130);
    mg.appendChild(svgEl('rect', { x: '-56', y: '-34', width: '112', height: '68', rx: '6', fill: 'var(--bg-surface,#eee)', stroke: 'var(--blueprint,#3553ff)', 'stroke-width': '1.5' }));
    mg.appendChild(txt(0, 4, 'model', '11', 'var(--blueprint,#3553ff)'));
    pop(mg, '0s');
    svg.appendChild(mg);
    var gi = grp(128, 130);
    gi.appendChild(svgEl('rect', { x: '-30', y: '-40', width: '60', height: '80', rx: '4', fill: 'var(--bg,#fafaf5)', stroke: 'var(--warn,#b8870f)', 'stroke-width': '1.5' }));
    gi.appendChild(txt(0, -6, 'guard', '9', 'var(--warn,#b8870f)'));
    gi.appendChild(txt(0, 8, 'in', '8', 'var(--ink-mute,#777)'));
    pop(gi, '0.2s');
    svg.appendChild(gi);
    var go = grp(392, 130);
    go.appendChild(svgEl('rect', { x: '-30', y: '-40', width: '60', height: '80', rx: '4', fill: 'var(--bg,#fafaf5)', stroke: 'var(--warn,#b8870f)', 'stroke-width': '1.5' }));
    go.appendChild(txt(0, -6, 'guard', '9', 'var(--warn,#b8870f)'));
    go.appendChild(txt(0, 8, 'out', '8', 'var(--ink-mute,#777)'));
    pop(go, '0.3s');
    svg.appendChild(go);
    svg.appendChild(txt(128, 62, 'Llama Guard: 14 hazard categories', '8', 'var(--ink-mute,#777)'));
    svg.appendChild(svgEl('line', { x1: '30', y1: '130', x2: '98', y2: '130', stroke: 'var(--ink-soft,#555)', 'stroke-width': '1.3', 'stroke-dasharray': '5 4' }));
    svg.appendChild(svgEl('line', { x1: '158', y1: '130', x2: '204', y2: '130', stroke: 'var(--ink-soft,#555)', 'stroke-width': '1.3', 'stroke-dasharray': '5 4' }));
    svg.appendChild(svgEl('line', { x1: '316', y1: '130', x2: '362', y2: '130', stroke: 'var(--ink-soft,#555)', 'stroke-width': '1.3', 'stroke-dasharray': '5 4' }));
    svg.appendChild(svgEl('line', { x1: '422', y1: '130', x2: '490', y2: '130', stroke: 'var(--ink-soft,#555)', 'stroke-width': '1.3', 'stroke-dasharray': '5 4' }));
    var i;
    for (i = 0; i < 3; i++) {
      var dart = svgEl('line', { x1: 236 + i * 24, y1: '30', x2: 236 + i * 24, y2: '88', stroke: 'var(--warn,#b8870f)', 'stroke-width': '1.6' });
      dart.appendChild(anim('opacity', '0;1;1;0;0', '3.6s', { begin: (0.6 + i * 0.35) + 's', keyTimes: '0;0.08;0.3;0.42;1' }));
      dart.appendChild(anim('y2', '48;88;88', '3.6s', { begin: (0.6 + i * 0.35) + 's', keyTimes: '0;0.3;1', calcMode: 'spline', keySplines: SPL + ';0 0 1 1' }));
      svg.appendChild(dart);
    }
    svg.appendChild(txt(324, 40, 'garak probes', '8', 'var(--warn,#b8870f)', 'start'));
    var flash = svgEl('rect', { x: '204', y: '92', width: '112', height: '5', fill: 'var(--warn,#b8870f)', opacity: '0' });
    flash.appendChild(anim('opacity', '0;0;0.9;0;0', '3.6s', { keyTimes: '0;0.4;0.5;0.7;1' }));
    svg.appendChild(flash);
    svg.appendChild(txt(324, 100, 'detectors log the hit', '7', 'var(--ink-mute,#777)', 'start'));
    var loop = svgEl('path', { d: 'M392 178 C 392 214, 128 214, 128 178', fill: 'none', stroke: 'var(--blueprint,#3553ff)', 'stroke-width': '1.4', 'stroke-dasharray': '5 4', opacity: '0' });
    enter(loop, '0.8s');
    loop.appendChild(anim('stroke-dashoffset', '54;0', '3s', { begin: '0.8s' }));
    svg.appendChild(loop);
    svg.appendChild(txt(260, 226, 'PyRIT: multi-turn campaigns feed each response back as the next attack', '8', 'var(--ink-mute,#777)'));
    shell(host, 'RED-TEAM STACK', 'scanner, classifier, orchestrator',
      svg,
      'The 2026 production stack in one frame. Llama Guard sits before and after the model as an input and output classifier over the 14 MLCommons hazard categories. Garak fires its probe library at the deployed system while detectors log which ones land. PyRIT closes the loop underneath, feeding each response back into a multi-turn campaign such as Crescendo. Each tool covers a different layer of the red-team lifecycle.');
  }

  // -- al-wmdp-yellow-zone: score rises into the zone, RMU pulls it back -----
  function wmdpYellowZone(host) {
    var W = 520, H = 230;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    svg.appendChild(txt(46, 58, 'WMDP', '9', 'var(--ink,#1a1a1a)', 'start'));
    svg.appendChild(txt(46, 72, '4,157 questions', '7', 'var(--ink-mute,#777)', 'start'));
    var zg = grp(0, 0);
    zg.appendChild(svgEl('rect', { x: '140', y: '48', width: '130', height: '26', fill: 'var(--bg-surface,#eee)' }));
    zg.appendChild(svgEl('rect', { x: '270', y: '48', width: '130', height: '26', fill: 'var(--warn,#b8870f)', opacity: '0.3' }));
    zg.appendChild(svgEl('rect', { x: '400', y: '48', width: '74', height: '26', fill: 'var(--warn,#b8870f)', opacity: '0.75' }));
    zg.appendChild(txt(205, 42, 'public knowledge', '8', 'var(--ink-mute,#777)'));
    zg.appendChild(txt(335, 42, 'yellow zone', '8', 'var(--warn,#b8870f)'));
    zg.appendChild(txt(437, 42, 'recipes', '8', 'var(--warn,#b8870f)'));
    zg.appendChild(txt(335, 90, 'proximate enabling knowledge, no synthesis steps', '7', 'var(--ink-mute,#777)'));
    pop(zg, '0s');
    svg.appendChild(zg);
    var mark = svgEl('path', { d: 'M0 0 L-6 -12 L6 -12 Z', fill: 'var(--blueprint,#3553ff)' });
    var mkg = svgEl('g', { transform: 'translate(0 48)' });
    mkg.appendChild(mark);
    mkg.appendChild(svgEl('animateTransform', { attributeName: 'transform', type: 'translate', additive: 'sum', values: '160 0;348 0;348 0;218 0;218 0;160 0', dur: '6s', begin: '0.5s', repeatCount: 'indefinite', keyTimes: '0;0.3;0.5;0.7;0.92;1', calcMode: 'spline', keySplines: SPL + ';0 0 1 1;' + SPL + ';0 0 1 1;0.4 0 1 1' }));
    svg.appendChild(mkg);
    var rmu = txt(335, 118, 'RMU unlearning applied', '9', 'var(--blueprint,#3553ff)');
    rmu.appendChild(anim('opacity', '0;0;1;1;0', '6s', { begin: '0.5s', keyTimes: '0;0.5;0.56;0.9;1' }));
    svg.appendChild(rmu);
    svg.appendChild(txt(46, 152, 'MMLU', '9', 'var(--ink,#1a1a1a)', 'start'));
    svg.appendChild(txt(46, 166, 'general ability', '7', 'var(--ink-mute,#777)', 'start'));
    var mb = svgEl('rect', { x: '140', y: '144', width: '334', height: '12', fill: 'var(--bg-surface,#eee)', opacity: '0' });
    enter(mb, '0.3s');
    svg.appendChild(mb);
    var mf = svgEl('rect', { x: '140', y: '144', width: '0', height: '12', fill: 'var(--blueprint,#3553ff)' });
    mf.appendChild(svgEl('animate', { attributeName: 'width', values: '0;218;218', dur: '6s', begin: '0.5s', repeatCount: 'indefinite', keyTimes: '0;0.3;1', calcMode: 'spline', keySplines: SPL + ';0 0 1 1' }));
    svg.appendChild(mf);
    svg.appendChild(txt(335, 176, 'held steady while WMDP drops: unlearning, not lobotomy', '8', 'var(--ink-mute,#777)'));
    svg.appendChild(txt(260, 212, 'uplift narrative: mild uplift (2024) to on the cusp (2025), 2.53x in trials', '8', 'var(--ink-mute,#777)'));
    shell(host, 'WMDP YELLOW ZONE', 'measure it, then unlearn it',
      svg,
      'WMDP asks 4,157 multiple-choice questions that sit in the yellow zone: proximate enabling knowledge for bio, cyber, and chem harm, expert-filtered so no question is itself a recipe. The blue marker is a model\'s score climbing into the zone; applying the companion RMU unlearning method pulls it back down while the MMLU bar underneath holds steady, which is what makes WMDP both a dual-use capability evaluation and an unlearning benchmark.');
  }

  // -- al-asl-ladder: capability climbs, crossing a rung closes the gate -----
  function aslLadder(host) {
    var W = 520, H = 250;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var rungs = [
      { y: 178, name: 'ASL-2', sub: 'current baseline' },
      { y: 118, name: 'ASL-3', sub: 'CBRN uplift: activated May 2025' },
      { y: 58, name: 'ASL-4', sub: 'thresholds under definition' }
    ];
    var i;
    for (i = 0; i < 3; i++) {
      var r = rungs[i];
      var ln = svgEl('line', { x1: '70', y1: r.y, x2: '330', y2: r.y, stroke: i === 1 ? 'var(--warn,#b8870f)' : 'var(--rule-soft,#ddd)', 'stroke-width': '1.4', 'stroke-dasharray': '6 4', opacity: '0' });
      enter(ln, (i * 0.15) + 's');
      svg.appendChild(ln);
      svg.appendChild(txt(64, r.y + 3, r.name, '9', i === 1 ? 'var(--warn,#b8870f)' : 'var(--ink-mute,#777)', 'end'));
      svg.appendChild(txt(336, r.y - 5, r.sub, '7', 'var(--ink-mute,#777)', 'start'));
    }
    var curve = svgEl('path', { d: 'M80 214 C 160 210, 220 180, 300 104', fill: 'none', stroke: 'var(--blueprint,#3553ff)', 'stroke-width': '2', 'stroke-dasharray': '260', 'stroke-dashoffset': '260' });
    curve.appendChild(svgEl('animate', { attributeName: 'stroke-dashoffset', values: '260;0;0;260', dur: '6s', begin: '0.6s', repeatCount: 'indefinite', keyTimes: '0;0.45;0.9;1', calcMode: 'spline', keySplines: SPL + ';0 0 1 1;0.4 0 1 1' }));
    svg.appendChild(curve);
    svg.appendChild(txt(150, 234, 'evaluated capability', '8', 'var(--blueprint,#3553ff)'));
    var cross = svgEl('circle', { cx: '287', cy: '118', r: '5', fill: 'var(--warn,#b8870f)', opacity: '0' });
    cross.appendChild(anim('opacity', '0;0;1;1;0', '6s', { begin: '0.6s', keyTimes: '0;0.38;0.44;0.9;1' }));
    cross.appendChild(anim('r', '4;6;4', '2.5s', {}));
    svg.appendChild(cross);
    var gate = grp(438, 118);
    gate.appendChild(svgEl('rect', { x: '-40', y: '-52', width: '80', height: '104', rx: '5', fill: 'var(--bg-surface,#eee)', stroke: 'var(--ink-soft,#555)', 'stroke-width': '1.4' }));
    gate.appendChild(txt(0, -32, 'deploy', '9', 'var(--ink,#1a1a1a)'));
    pop(gate, '0.4s');
    var bar = svgEl('rect', { x: '-32', y: '-14', width: '64', height: '0', fill: 'var(--warn,#b8870f)', opacity: '0.7' });
    bar.appendChild(svgEl('animate', { attributeName: 'height', values: '0;0;40;40;0', dur: '6s', begin: '0.6s', repeatCount: 'indefinite', keyTimes: '0;0.42;0.52;0.9;1', calcMode: 'spline', keySplines: '0 0 1 1;' + SPL + ';0 0 1 1;0.4 0 1 1' }));
    gate.appendChild(bar);
    var req = txt(0, 40, 'safeguards required', '7', 'var(--warn,#b8870f)');
    req.appendChild(anim('opacity', '0;0;1;1;0', '6s', { begin: '0.6s', keyTimes: '0;0.46;0.52;0.9;1' }));
    gate.appendChild(req);
    svg.appendChild(gate);
    svg.appendChild(txt(438, 234, 'RSP, PF, and FSF all gate scaling this way', '7', 'var(--ink-mute,#777)'));
    shell(host, 'CAPABILITY THRESHOLDS', 'cross the rung, close the gate',
      svg,
      'The shared structure of the frontier safety frameworks: Anthropic\'s RSP defines AI Safety Levels modeled on biosafety tiers, OpenAI\'s Preparedness Framework tracks High Capability thresholds, DeepMind\'s FSF defines Critical Capability Levels. As evaluated capability climbs and crosses a threshold rung, deployment gates close until the required safeguards are in place; ASL-3 activated in May 2025 for CBRN-relevant models. Competitor-adjustment clauses are the pressure valve all three added for race dynamics.');
  }

  LF.register({
    'al-instruct-pipeline': instructPipeline,
    'al-sycophancy-amplifier': sycophancyAmplifier,
    'al-sleeper-trigger': sleeperTrigger,
    'al-scheming-probe': schemingProbe,
    'al-faking-gap': fakingGap,
    'al-control-protocol': controlProtocol,
    'al-pair-loop': pairLoop,
    'al-ascii-cloak': asciiCloak,
    'al-injection-vector': injectionVector,
    'al-guard-stack': guardStack,
    'al-wmdp-yellow-zone': wmdpYellowZone,
    'al-asl-ladder': aslLadder
  });
})();
