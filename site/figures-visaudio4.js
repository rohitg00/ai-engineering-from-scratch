/* figures-visaudio4.js — animated SVG lesson figures for Phase 4 (vision),
   Phase 6 (speech and audio), and Phase 8 (generative AI), fourth batch.
   Loads after lesson-figures.js and registers widgets through window.LF.
   Every figure is a self-running SMIL animation of one concept: no JS timers,
   no compute loops. Vanilla ES5, no deps, theme via CSS vars.
   Authoring is the same fenced block in docs/en.md:
       ```figure
       v4-video-temporal
       ``` */
(function () {
  'use strict';
  var LF = window.LF;
  if (!LF) { return; }
  var el = LF.el, svgEl = LF.svgEl;

  var BLUE = 'var(--blueprint,#3553ff)', INK = 'var(--ink,#1a1a1a)', SOFT = 'var(--rule-soft,#ddd)',
    WARN = 'var(--warn,#b8870f)', MUTE = 'var(--ink-mute,#777)', BG = 'var(--bg,#fafaf5)', SURF = 'var(--bg-surface,#eee)';
  var EASE = '0.23 1 0.32 1';

  function splines(n) { var a = [], i; for (i = 0; i < n; i++) a.push(EASE); return a.join(';'); }
  function txt(x, y, s, size, anchor, fill) {
    return svgEl('text', { x: x, y: y, fill: fill || MUTE, 'font-size': size || 10, 'font-family': 'monospace', 'text-anchor': anchor || 'start' }, [document.createTextNode(s)]);
  }
  function anim(attr, vals, dur, extra) {
    var a = { attributeName: attr, values: vals, dur: dur, repeatCount: 'indefinite' };
    if (extra) for (var k in extra) a[k] = extra[k];
    return svgEl('animate', a);
  }
  function shell(label, hint, svg, caption) {
    return el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, [label]), el('span', {}, [hint])]),
      el('div', { class: 'lf-body' }, [el('div', { class: 'lf-out' }, [svg])]),
      el('div', { class: 'lf-cap' }, [caption])
    ]);
  }
  // Entry helper: fade in and grow from 95 percent size around (cx, cy),
  // then a fast fade at the loop wrap so exits read quicker than entries.
  function rise(cx, cy, dur, t0, t1, kids) {
    var inner = svgEl('g', { transform: 'translate(' + (-cx) + ' ' + (-cy) + ')' }, kids);
    var g = svgEl('g', { transform: 'translate(' + cx + ' ' + cy + ')' }, [inner]);
    g.appendChild(svgEl('animateTransform', {
      attributeName: 'transform', type: 'scale', additive: 'sum',
      values: '0.95;0.95;1;1', keyTimes: '0;' + t0 + ';' + t1 + ';1',
      calcMode: 'spline', keySplines: splines(3), dur: dur, repeatCount: 'indefinite'
    }));
    g.appendChild(anim('opacity', '0;0;1;1;0', dur, { keyTimes: '0;' + t0 + ';' + t1 + ';0.97;1', calcMode: 'spline', keySplines: splines(4) }));
    return g;
  }
  function fade(node, dur, t0, t1) {
    node.setAttribute('opacity', '0');
    node.appendChild(anim('opacity', '0;0;1;1', dur, { keyTimes: '0;' + t0 + ';' + t1 + ';1', calcMode: 'spline', keySplines: splines(3) }));
    return node;
  }
  function draw(node, len, dur, t0, t1) {
    node.setAttribute('stroke-dasharray', len);
    node.setAttribute('stroke-dashoffset', len);
    node.appendChild(anim('stroke-dashoffset', len + ';' + len + ';0;0', dur, { keyTimes: '0;' + t0 + ';' + t1 + ';1', calcMode: 'spline', keySplines: splines(3) }));
    return node;
  }

  // ── v4-video-temporal (P4/12): the same five frames, two ways to read time ──
  function videoTemporal(host) {
    var svg = svgEl('svg', { viewBox: '0 0 520 240' }), D = '5s';
    svg.appendChild(txt(14, 16, 'same five frames, two ways of reading time'));
    function strip(y) {
      var kids = [], i;
      for (i = 0; i < 5; i++) kids.push(svgEl('rect', { x: 96 + i * 62, y: y, width: 48, height: 44, fill: BLUE, opacity: (0.1 + 0.05 * (i % 3)).toFixed(2), stroke: SOFT, 'stroke-width': '1' }));
      return kids;
    }
    svg.appendChild(txt(14, 58, '2D + pool', 10, 'start', INK));
    svg.appendChild(rise(244, 54, D, 0.04, 0.16, strip(32)));
    var scan = svgEl('rect', { x: 96, y: 32, width: 48, height: 44, fill: 'none', stroke: WARN, 'stroke-width': '2' });
    scan.appendChild(anim('x', '96;96;158;220;282;344;344', D, { keyTimes: '0;0.18;0.27;0.36;0.45;0.54;1', calcMode: 'spline', keySplines: splines(6) }));
    scan.appendChild(anim('opacity', '0;0;1;1;0;0', D, { keyTimes: '0;0.16;0.2;0.56;0.62;1' }));
    svg.appendChild(scan);
    svg.appendChild(rise(458, 54, D, 0.58, 0.7, [
      svgEl('rect', { x: 412, y: 36, width: 92, height: 36, fill: BLUE, opacity: '0.15', stroke: BLUE }),
      txt(458, 58, 'avg over T', 9, 'middle', INK), txt(458, 88, 'motion lost', 8, 'middle')
    ]));
    svg.appendChild(txt(14, 158, '3D conv', 10, 'start', INK));
    svg.appendChild(rise(244, 154, D, 0.1, 0.22, strip(132)));
    var win = svgEl('rect', { x: 96, y: 126, width: 172, height: 56, fill: WARN, stroke: WARN, 'stroke-width': '2', opacity: '0' });
    win.appendChild(anim('x', '96;96;96;220;220', D, { keyTimes: '0;0.24;0.36;0.62;1', calcMode: 'spline', keySplines: splines(4) }));
    win.appendChild(anim('opacity', '0;0;0.18;0.18;0;0', D, { keyTimes: '0;0.22;0.28;0.66;0.72;1' }));
    svg.appendChild(win);
    svg.appendChild(rise(458, 154, D, 0.66, 0.78, [
      svgEl('rect', { x: 412, y: 136, width: 92, height: 36, fill: BLUE, opacity: '0.15', stroke: BLUE }),
      txt(458, 158, 'T x H x W', 9, 'middle', INK), txt(458, 188, 'motion kept', 8, 'middle')
    ]));
    svg.appendChild(fade(txt(14, 226, 'transformers go further: attention over every (t, h, w) token at once', 9), D, 0.8, 0.9));
    host.appendChild(shell('VIDEO · TEMPORAL MODELLING', 'when does time get modelled?', svg,
      'A 2D+pool model runs the same image CNN on each frame and averages the features over time, so "pushing left" and "pushing right" collapse into the same clip vector. A 3D conv slides its kernel through time as well as space: it sees a short window of frames at once and can encode direction. Spatio-temporal transformers finish the idea by attending over every (t, h, w) token jointly, at quadratic cost in clip length.'));
  }

  // ── v4-vision-pipeline (P4/16): one request through the detection chain ─────
  function visionPipeline(host) {
    var svg = svgEl('svg', { viewBox: '0 0 520 220' }), D = '5s';
    svg.appendChild(txt(14, 16, 'one request through the chain'));
    svg.appendChild(svgEl('rect', { x: 16, y: 36, width: 120, height: 84, fill: SURF, stroke: SOFT }));
    svg.appendChild(rise(52, 72, D, 0.08, 0.18, [svgEl('rect', { x: 34, y: 58, width: 36, height: 28, fill: 'none', stroke: WARN, 'stroke-width': '1.6' })]));
    svg.appendChild(rise(102, 91, D, 0.14, 0.24, [svgEl('rect', { x: 82, y: 74, width: 40, height: 34, fill: 'none', stroke: WARN, 'stroke-width': '1.6' })]));
    svg.appendChild(txt(16, 134, 'decode + detect', 9));
    svg.appendChild(draw(svgEl('line', { x1: 122, y1: 91, x2: 170, y2: 77, stroke: MUTE, 'stroke-width': '1.2' }), 50, D, 0.28, 0.36));
    svg.appendChild(rise(187, 75, D, 0.3, 0.4, [
      svgEl('rect', { x: 170, y: 58, width: 34, height: 34, fill: WARN, opacity: '0.2', stroke: WARN })
    ]));
    svg.appendChild(txt(160, 110, 'crop + resize', 9));
    svg.appendChild(rise(278, 74, D, 0.42, 0.52, [
      svgEl('rect', { x: 230, y: 52, width: 96, height: 44, fill: BLUE, opacity: '0.15', stroke: BLUE }),
      txt(278, 78, 'ConvNeXt-T', 9, 'middle', INK)
    ]));
    svg.appendChild(fade(txt(278, 114, 'label: cereal 0.94', 9, 'middle', WARN), D, 0.55, 0.63));
    svg.appendChild(rise(436, 96, D, 0.68, 0.8, [
      svgEl('rect', { x: 368, y: 36, width: 136, height: 120, fill: BG, stroke: SOFT }),
      txt(380, 60, '{', 9, 'start', INK),
      txt(388, 78, '"box": [82,74,..]', 9, 'start', INK),
      txt(388, 96, '"cls": "cereal"', 9, 'start', INK),
      txt(388, 114, '"score": 0.94', 9, 'start', INK),
      txt(380, 132, '}', 9, 'start', INK)
    ]));
    svg.appendChild(txt(368, 172, 'validated JSON out', 9));
    var dot = svgEl('circle', { cx: 0, cy: 0, r: 4, fill: BLUE });
    dot.appendChild(svgEl('animateMotion', { dur: D, repeatCount: 'indefinite', path: 'M 136 78 L 204 75 L 278 74 L 402 96', keyPoints: '0;0;1;1', keyTimes: '0;0.2;0.72;1', calcMode: 'linear' }));
    dot.appendChild(anim('opacity', '0;0;1;1;0;0', D, { keyTimes: '0;0.2;0.24;0.68;0.74;1' }));
    svg.appendChild(dot);
    host.appendChild(shell('VISION CAPSTONE · THE PIPELINE', 'detect, crop, classify, validate', svg,
      'A production vision service is a chain of contracts: decode the bytes, detect boxes, crop each box, classify the crop, then assemble one structured response. Every arrow is an interface that can fail silently (coordinate order, normalisation, resize interpolation), which is why the output passes through a Pydantic schema before it leaves the service. Swap the detector or the classifier freely; the skeleton stays.'));
  }

  // ── v4-vlm-projector (P4/25): patches become tokens the LLM reads inline ────
  function vlmProjector(host) {
    var svg = svgEl('svg', { viewBox: '0 0 520 250' }), D = '5.5s';
    svg.appendChild(txt(14, 16, 'ViT-MLP-LLM: the image enters the LLM as tokens'));
    var patches = [svgEl('rect', { x: 16, y: 32, width: 96, height: 96, fill: SURF, stroke: SOFT })], r, c;
    for (r = 0; r < 3; r++) for (c = 0; c < 3; c++) {
      patches.push(svgEl('rect', { x: 21 + c * 31, y: 37 + r * 31, width: 28, height: 28, fill: BLUE, opacity: (0.12 + 0.14 * ((r * 2 + c) % 4)).toFixed(2) }));
    }
    svg.appendChild(rise(64, 80, D, 0.04, 0.14, patches));
    svg.appendChild(txt(16, 142, 'patches', 8));
    svg.appendChild(fade(svgEl('polygon', { points: '116,50 176,72 176,104 116,126', fill: BLUE, opacity: '0.14', stroke: BLUE }), D, 0.18, 0.26));
    svg.appendChild(txt(112, 142, 'ViT + MLP projector', 8));
    var vtoks = [], i;
    for (i = 0; i < 4; i++) vtoks.push(svgEl('rect', { x: 186 + i * 28, y: 82, width: 24, height: 24, fill: BLUE, opacity: '0.7' }));
    svg.appendChild(rise(240, 94, D, 0.3, 0.42, vtoks));
    var words = ['how', 'many', 'red', 'cars'], ttoks = [txt(352, 76, 'text: "how many red cars?"', 7, 'middle')];
    for (i = 0; i < 4; i++) {
      ttoks.push(svgEl('rect', { x: 298 + i * 28, y: 82, width: 24, height: 24, fill: WARN, opacity: '0.18', stroke: WARN }));
      ttoks.push(txt(310 + i * 28, 97, words[i], 6.5, 'middle', INK));
    }
    svg.appendChild(rise(352, 94, D, 0.46, 0.58, ttoks));
    svg.appendChild(txt(240, 122, 'image tokens', 8, 'middle'));
    svg.appendChild(rise(460, 94, D, 0.64, 0.74, [
      svgEl('rect', { x: 416, y: 72, width: 88, height: 44, fill: BLUE, opacity: '0.15', stroke: BLUE }),
      txt(460, 98, 'LLM decoder', 8, 'middle', INK)
    ]));
    svg.appendChild(rise(460, 143, D, 0.8, 0.9, [txt(460, 146, 'answer: "3"', 10, 'middle', WARN)]));
    svg.appendChild(fade(txt(14, 234, 'one interleaved sequence: [img][img][img][img][how][many][red][cars] -> next-token prediction', 8), D, 0.6, 0.7));
    host.appendChild(shell('VLM · ViT-MLP-LLM', 'image tokens join the text stream', svg,
      'Every production VLM is the same three parts. A ViT slices the image into patches and encodes each one; a small MLP projects those patch embeddings into the LLM token space; the decoder then reads image tokens and text tokens as one interleaved sequence, so "how many red cars?" is answered by ordinary next-token prediction. Swapping the ViT, the projector, or the LLM is mechanical once the pattern is in place.'));
  }

  // ── v4-world-rollout (P4/28): generated frames re-enter the context ─────────
  function worldRollout(host) {
    var svg = svgEl('svg', { viewBox: '0 0 520 230' }), D = '5s';
    svg.appendChild(txt(14, 16, 'a world model rolls the future out of its own predictions'));
    svg.appendChild(svgEl('rect', { x: 24, y: 50, width: 96, height: 78, fill: BLUE, opacity: '0.16', stroke: SOFT }));
    svg.appendChild(svgEl('line', { x1: 30, y1: 102, x2: 114, y2: 102, stroke: MUTE, 'stroke-width': '1' }));
    svg.appendChild(svgEl('circle', { cx: 92, cy: 88, r: 8, fill: 'none', stroke: INK, 'stroke-width': '1.4' }));
    svg.appendChild(txt(24, 142, 'frame t (context)', 8));
    svg.appendChild(rise(162, 90, D, 0.12, 0.2, [
      svgEl('rect', { x: 130, y: 80, width: 64, height: 20, fill: WARN, opacity: '0.14', stroke: WARN }),
      txt(162, 93, 'turn left', 7, 'middle', INK)
    ]));
    var f2 = svgEl('rect', { x: 204, y: 50, width: 96, height: 78, fill: BLUE, stroke: SOFT, opacity: '0' });
    f2.appendChild(anim('opacity', '0;0;0.16;0.16', D, { keyTimes: '0;0.2;0.38;1', calcMode: 'spline', keySplines: splines(3) }));
    svg.appendChild(f2);
    svg.appendChild(fade(svgEl('line', { x1: 210, y1: 102, x2: 294, y2: 102, stroke: MUTE, 'stroke-width': '1' }), D, 0.3, 0.45));
    svg.appendChild(fade(svgEl('circle', { cx: 244, cy: 88, r: 8, fill: 'none', stroke: INK, 'stroke-width': '1.4' }), D, 0.3, 0.45));
    var dots = [[222, 64], [268, 58], [238, 112], [284, 102], [226, 94], [276, 74]], i;
    for (i = 0; i < dots.length; i++) {
      var nz = svgEl('circle', { cx: dots[i][0], cy: dots[i][1], r: 2.2, fill: MUTE, opacity: '0' });
      nz.appendChild(anim('opacity', '0;0.8;0.8;0;0', D, { keyTimes: '0;' + (0.18 + i * 0.02).toFixed(2) + ';0.3;0.44;1' }));
      svg.appendChild(nz);
    }
    svg.appendChild(txt(204, 142, 'frame t+1, denoising', 8));
    svg.appendChild(rise(342, 90, D, 0.46, 0.54, [
      svgEl('rect', { x: 310, y: 80, width: 64, height: 20, fill: WARN, opacity: '0.14', stroke: WARN }),
      txt(342, 93, 'open door', 7, 'middle', INK)
    ]));
    svg.appendChild(rise(432, 89, D, 0.56, 0.66, [
      svgEl('rect', { x: 384, y: 50, width: 96, height: 78, fill: 'none', stroke: MUTE, 'stroke-dasharray': '4 3' }),
      txt(432, 94, '?', 12, 'middle', MUTE)
    ]));
    svg.appendChild(txt(384, 142, 'frame t+2', 8));
    svg.appendChild(draw(svgEl('path', { d: 'M 252 132 C 252 186 72 186 72 132', fill: 'none', stroke: BLUE, 'stroke-width': '1.4', 'stroke-dasharray': '4 3' }), 300, D, 0.6, 0.8));
    svg.appendChild(fade(txt(162, 208, 'each generated frame re-enters the context window', 8, 'middle'), D, 0.74, 0.84));
    host.appendChild(shell('WORLD MODELS · ACTION-CONDITIONED ROLLOUT', 'predict, act, feed back, repeat', svg,
      'Pure video generation predicts frames from a prompt and stops. A world model is the same video DiT run in a loop: each denoised chunk is appended to the context, an action token (turn left, open door) conditions the next prediction, and the model becomes a learned simulator you can steer. Drift is the failure mode, because every hallucinated pixel becomes future input.'));
  }

  // ── v4-alm-tokens (P6/10): three sound events fold into one token stream ────
  function almTokens(host) {
    var svg = svgEl('svg', { viewBox: '0 0 520 240' }), D = '5s';
    svg.appendChild(txt(14, 16, 'five seconds of audio, three events, one token stream'));
    var w1 = svgEl('polyline', { points: '16,64 22,44 28,86 34,48 40,80 46,42 52,84 58,52 64,76 70,46 76,82 82,56 88,72 94,50 100,78 106,58 112,70 120,60 128,68 136,62 144,66 150,64', fill: 'none', stroke: INK, 'stroke-width': '1.3' });
    var w2 = svgEl('polyline', { points: '150,64 158,56 166,72 174,52 182,76 190,58 198,70 206,54 214,74 222,60 230,68 238,56 246,72 254,62 262,66 270,58 278,70 286,62 294,66 300,64', fill: 'none', stroke: INK, 'stroke-width': '1.3' });
    var w3 = svgEl('polyline', { points: '300,64 316,63 332,65 348,64 364,63 380,65 396,64 412,64 430,64', fill: 'none', stroke: INK, 'stroke-width': '1.3' });
    svg.appendChild(fade(w1, D, 0.03, 0.1)); svg.appendChild(fade(w2, D, 0.05, 0.12)); svg.appendChild(fade(w3, D, 0.07, 0.14));
    svg.appendChild(rise(83, 64, D, 0.14, 0.22, [svgEl('rect', { x: 16, y: 36, width: 134, height: 56, fill: BLUE, opacity: '0.06', stroke: SOFT }), txt(83, 32, 'bark', 8, 'middle', INK)]));
    svg.appendChild(rise(225, 64, D, 0.2, 0.28, [svgEl('rect', { x: 150, y: 36, width: 150, height: 56, fill: BLUE, opacity: '0.06', stroke: SOFT }), txt(225, 32, '"stop!"', 8, 'middle', INK)]));
    svg.appendChild(rise(365, 64, D, 0.26, 0.34, [svgEl('rect', { x: 300, y: 36, width: 130, height: 56, fill: BLUE, opacity: '0.06', stroke: SOFT }), txt(365, 32, 'silence', 8, 'middle', INK)]));
    var row = [], words = ['is', 'anyone', 'hurt', '?'], i;
    for (i = 0; i < 4; i++) {
      row.push(svgEl('rect', { x: 76 + i * 46, y: 142, width: 40, height: 24, fill: WARN, opacity: '0.15', stroke: WARN }));
      row.push(txt(96 + i * 46, 157, words[i], 7, 'middle', INK));
    }
    for (i = 0; i < 3; i++) row.push(svgEl('rect', { x: 260 + i * 46, y: 142, width: 40, height: 24, fill: BLUE, opacity: '0.75' }));
    svg.appendChild(rise(234, 154, D, 0.4, 0.52, row));
    svg.appendChild(draw(svgEl('line', { x1: 83, y1: 92, x2: 280, y2: 142, stroke: MUTE, 'stroke-width': '1' }), 210, D, 0.5, 0.6));
    svg.appendChild(draw(svgEl('line', { x1: 225, y1: 92, x2: 326, y2: 142, stroke: MUTE, 'stroke-width': '1' }), 120, D, 0.55, 0.65));
    svg.appendChild(draw(svgEl('line', { x1: 365, y1: 92, x2: 372, y2: 142, stroke: MUTE, 'stroke-width': '1' }), 55, D, 0.6, 0.7));
    svg.appendChild(rise(458, 154, D, 0.66, 0.76, [
      svgEl('rect', { x: 412, y: 142, width: 92, height: 24, fill: BLUE, opacity: '0.15', stroke: BLUE }),
      txt(458, 157, 'LLM', 8, 'middle', INK)
    ]));
    svg.appendChild(rise(260, 202, D, 0.8, 0.9, [txt(260, 205, 'answer: "yes, likely danger: a bark, a shout, then silence"', 8, 'middle', WARN)]));
    host.appendChild(shell('AUDIO-LANGUAGE MODELS · ONE STREAM', 'sound events become tokens the LLM reads', svg,
      'An audio-language model keeps the three-part template: an audio encoder (Whisper, BEATs) turns each stretch of sound into embeddings, a projector maps them into the LLM token space, and the decoder reads them inline with the text prompt. Answering "is anyone hurt?" needs all three events at once, the bark, the shout, and the silence after. That joint read is exactly what a transcript-only ASR pipeline throws away.'));
  }

  // ── v4-voice-latency (P6/12): streamed stages overlap under the 800ms line ──
  function voiceLatency(host) {
    var svg = svgEl('svg', { viewBox: '0 0 520 250' }), D = '5.5s';
    svg.appendChild(txt(14, 16, 'streamed stages overlap; the reply starts before the budget line'));
    svg.appendChild(svgEl('line', { x1: 90, y1: 206, x2: 500, y2: 206, stroke: SOFT, 'stroke-width': '1' }));
    svg.appendChild(txt(90, 222, '0 ms', 8, 'middle'));
    svg.appendChild(txt(223, 222, '400', 8, 'middle'));
    svg.appendChild(txt(356, 222, '800', 8, 'middle'));
    svg.appendChild(txt(490, 222, '1200', 8, 'middle'));
    svg.appendChild(svgEl('line', { x1: 356, y1: 30, x2: 356, y2: 206, stroke: WARN, 'stroke-width': '1.2', 'stroke-dasharray': '4 3', opacity: '0.8' }));
    svg.appendChild(txt(362, 36, '800 ms budget', 8, 'start', WARN));
    var lanes = [['user speech', 42], ['stt', 74], ['llm', 106], ['tts', 138], ['audio out', 170]], i;
    for (i = 0; i < lanes.length; i++) svg.appendChild(txt(84, lanes[i][1] + 11, lanes[i][0], 8, 'end'));
    function bar(x, y, w, fill, op, t0, t1) {
      var b = svgEl('rect', { x: x, y: y, width: 0, height: 13, fill: fill, opacity: op });
      b.appendChild(anim('width', '0;0;' + w + ';' + w, D, { keyTimes: '0;' + t0 + ';' + t1 + ';1', calcMode: 'spline', keySplines: splines(3) }));
      return b;
    }
    svg.appendChild(bar(90, 42, 200, MUTE, '0.55', 0.04, 0.28));
    svg.appendChild(bar(140, 74, 185, BLUE, '0.5', 0.1, 0.36));
    svg.appendChild(bar(297, 106, 127, BLUE, '0.7', 0.3, 0.5));
    var tts = bar(330, 138, 143, BLUE, '1', 0.38, 0.6);
    tts.setAttribute('fill', WARN); tts.setAttribute('opacity', '0.55');
    tts.appendChild(anim('opacity', '0.55;0.55;0.12;0.12', D, { keyTimes: '0;0.76;0.8;1' }));
    svg.appendChild(tts);
    var outb = bar(340, 170, 120, WARN, '0.85', 0.52, 0.68);
    outb.appendChild(anim('opacity', '0.85;0.85;0.12;0.12', D, { keyTimes: '0;0.76;0.8;1' }));
    svg.appendChild(outb);
    svg.appendChild(rise(340, 176, D, 0.5, 0.58, [svgEl('circle', { cx: 340, cy: 176, r: 4.4, fill: WARN })]));
    svg.appendChild(fade(txt(340, 164, 'first audio: 750 ms', 8, 'middle', WARN), D, 0.56, 0.64));
    var barge = svgEl('rect', { x: 440, y: 42, width: 0, height: 13, fill: MUTE, opacity: '0.55' });
    barge.appendChild(anim('width', '0;0;40;40', D, { keyTimes: '0;0.72;0.78;1', calcMode: 'spline', keySplines: splines(3) }));
    svg.appendChild(barge);
    svg.appendChild(fade(txt(460, 36, 'barge-in: cancel tts', 7, 'middle'), D, 0.76, 0.82));
    host.appendChild(shell('VOICE ASSISTANT · LATENCY LANES', 'overlap beats sequential', svg,
      'The 800 ms feel comes from overlap, not from any single fast component. STT starts on partial speech, the LLM starts on the partial transcript, TTS starts after the first few tokens, and the first audio byte lands around 750 ms, inside the budget. When the user barges in, the VAD event cancels TTS and playback immediately: the fastest path in the pipeline is the one that stops it.'));
  }

  // ── v4-audio-watermark (P6/16): the watermark survives the distortion ───────
  function audioWatermark(host) {
    var svg = svgEl('svg', { viewBox: '0 0 520 230' }), D = '5s';
    svg.appendChild(txt(14, 16, 'the watermark rides below hearing and survives the pipeline'));
    svg.appendChild(fade(svgEl('polyline', { points: '16,70 24,56 32,82 40,58 48,78 56,54 64,80 72,60 80,76 88,56 96,78 104,62 112,74 120,58 128,76 136,64 144,70 150,68', fill: 'none', stroke: INK, 'stroke-width': '1.3' }), D, 0.03, 0.1));
    svg.appendChild(fade(svgEl('path', { d: 'M 16 88 Q 26 82 36 88 T 56 88 T 76 88 T 96 88 T 116 88 T 136 88 T 150 88', fill: 'none', stroke: WARN, 'stroke-width': '1.6', 'stroke-dasharray': '3 2' }), D, 0.12, 0.24));
    svg.appendChild(txt(16, 110, 'generated speech', 8));
    svg.appendChild(txt(16, 124, '+ watermark (inaudible)', 8, 'start', WARN));
    svg.appendChild(draw(svgEl('line', { x1: 158, y1: 70, x2: 194, y2: 70, stroke: MUTE, 'stroke-width': '1.2' }), 38, D, 0.26, 0.32));
    svg.appendChild(rise(248, 70, D, 0.3, 0.42, [
      svgEl('rect', { x: 200, y: 48, width: 96, height: 44, fill: SURF, stroke: SOFT }),
      txt(248, 66, 'mp3 · crop', 8, 'middle', INK),
      txt(248, 80, 'resample', 8, 'middle', INK)
    ]));
    svg.appendChild(fade(svgEl('polyline', { points: '306,70 312,52 318,84 324,54 330,82 336,50 342,86 348,56 354,80 360,52 366,84 372,58 378,78 384,56 390,80 396,68', fill: 'none', stroke: INK, 'stroke-width': '1.3' }), D, 0.45, 0.53));
    svg.appendChild(fade(svgEl('path', { d: 'M 306 88 Q 314 82 322 88 T 338 88 T 354 88 T 370 88 T 386 88 T 396 88', fill: 'none', stroke: WARN, 'stroke-width': '1.6', 'stroke-dasharray': '3 2' }), D, 0.5, 0.58));
    svg.appendChild(txt(306, 110, 'distorted copy', 8));
    svg.appendChild(draw(svgEl('line', { x1: 402, y1: 70, x2: 428, y2: 70, stroke: MUTE, 'stroke-width': '1.2' }), 28, D, 0.56, 0.62));
    svg.appendChild(rise(468, 66, D, 0.6, 0.7, [
      svgEl('rect', { x: 432, y: 48, width: 72, height: 36, fill: BLUE, opacity: '0.15', stroke: BLUE }),
      txt(468, 70, 'detector', 8, 'middle', INK)
    ]));
    var bits = ['1', '0', '1', '1', '0'], kids = [], i;
    for (i = 0; i < 5; i++) {
      kids.push(svgEl('rect', { x: 420 + i * 17, y: 108, width: 14, height: 16, fill: BLUE, opacity: '0.85' }));
      kids.push(txt(427 + i * 17, 120, bits[i], 8, 'middle', BG));
    }
    svg.appendChild(rise(462, 116, D, 0.74, 0.86, kids));
    svg.appendChild(fade(txt(462, 142, 'payload recovered', 7, 'middle'), D, 0.84, 0.92));
    host.appendChild(shell('AUDIO WATERMARKING · SURVIVAL', 'embed, distort, still detect', svg,
      'AudioSeal-style watermarking adds a learned, imperceptible signal to every sample of generated speech. The point is not secrecy but survival: after MP3 compression, cropping, and resampling, the detector still recovers the payload bits that mark the clip as synthetic. Detection models like AASIST and RawNet2 handle the uncooperative adversary; the watermark handles your own outputs. Ship voice cloning with both.'));
  }

  // ── v4-controlnet-zero (P8/08): a trainable clone steers a frozen U-Net ─────
  function controlnetZero(host) {
    var svg = svgEl('svg', { viewBox: '0 0 520 250' }), D = '5s';
    svg.appendChild(txt(14, 16, 'a trainable clone steers a frozen U-Net through zero-convs'));
    svg.appendChild(svgEl('rect', { x: 16, y: 44, width: 84, height: 96, fill: SURF, stroke: SOFT }));
    svg.appendChild(svgEl('circle', { cx: 58, cy: 66, r: 7, fill: 'none', stroke: INK, 'stroke-width': '1.6' }));
    svg.appendChild(svgEl('line', { x1: 58, y1: 73, x2: 58, y2: 102, stroke: INK, 'stroke-width': '1.6' }));
    svg.appendChild(svgEl('line', { x1: 40, y1: 86, x2: 76, y2: 86, stroke: INK, 'stroke-width': '1.6' }));
    svg.appendChild(svgEl('line', { x1: 58, y1: 102, x2: 44, y2: 128, stroke: INK, 'stroke-width': '1.6' }));
    svg.appendChild(svgEl('line', { x1: 58, y1: 102, x2: 72, y2: 128, stroke: INK, 'stroke-width': '1.6' }));
    svg.appendChild(txt(16, 154, 'pose map', 8));
    var y = [44, 82, 120], clone = [], i;
    for (i = 0; i < 3; i++) clone.push(svgEl('rect', { x: 116, y: y[i], width: 64, height: 30, fill: WARN, opacity: '0.14', stroke: WARN }));
    svg.appendChild(rise(148, 97, D, 0.16, 0.28, clone));
    svg.appendChild(txt(116, 164, 'trainable clone', 8, 'start', WARN));
    svg.appendChild(fade(svgEl('line', { x1: 100, y1: 92, x2: 116, y2: 92, stroke: MUTE, 'stroke-width': '1.2' }), D, 0.14, 0.2));
    for (i = 0; i < 3; i++) {
      svg.appendChild(svgEl('rect', { x: 210, y: y[i], width: 64, height: 30, fill: BLUE, opacity: '0.15', stroke: BLUE }));
      svg.appendChild(svgEl('rect', { x: 330, y: y[i], width: 64, height: 30, fill: BLUE, opacity: '0.15', stroke: BLUE }));
      svg.appendChild(svgEl('line', { x1: 274, y1: y[i] + 15, x2: 330, y2: y[i] + 15, stroke: SOFT, 'stroke-width': '1' }));
    }
    svg.appendChild(txt(302, 36, 'frozen SD U-Net', 8, 'middle', INK));
    svg.appendChild(txt(242, 164, 'encoder', 8, 'middle'));
    svg.appendChild(txt(362, 164, 'decoder', 8, 'middle'));
    svg.appendChild(draw(svgEl('path', { d: 'M 148 150 C 148 182 362 182 362 150', fill: 'none', stroke: WARN, 'stroke-width': '1.5', 'stroke-dasharray': '4 3' }), 300, D, 0.36, 0.5));
    svg.appendChild(draw(svgEl('path', { d: 'M 148 112 C 148 196 362 196 362 112', fill: 'none', stroke: WARN, 'stroke-width': '1.5', 'stroke-dasharray': '4 3' }), 340, D, 0.42, 0.56));
    svg.appendChild(draw(svgEl('path', { d: 'M 148 74 C 148 210 362 210 362 74', fill: 'none', stroke: WARN, 'stroke-width': '1.5', 'stroke-dasharray': '4 3' }), 390, D, 0.48, 0.62));
    svg.appendChild(fade(txt(255, 228, 'zero-conv links: start as a no-op, learn the nudge', 8, 'middle', WARN), D, 0.56, 0.66));
    svg.appendChild(draw(svgEl('line', { x1: 394, y1: 102, x2: 418, y2: 102, stroke: MUTE, 'stroke-width': '1.2' }), 26, D, 0.64, 0.7));
    svg.appendChild(rise(462, 102, D, 0.68, 0.8, [
      svgEl('rect', { x: 420, y: 74, width: 84, height: 56, fill: BLUE, opacity: '0.1', stroke: BLUE }),
      svgEl('circle', { cx: 452, cy: 92, r: 5, fill: 'none', stroke: BLUE, 'stroke-width': '1.4' }),
      svgEl('line', { x1: 452, y1: 97, x2: 452, y2: 114, stroke: BLUE, 'stroke-width': '1.4' }),
      svgEl('line', { x1: 444, y1: 104, x2: 460, y2: 104, stroke: BLUE, 'stroke-width': '1.4' })
    ]));
    svg.appendChild(txt(420, 146, 'pose-locked output', 7));
    host.appendChild(shell('CONTROLNET · ZERO-CONV STEERING', 'the side branch starts silent', svg,
      'ControlNet clones the encoder half of a pretrained U-Net, feeds the clone a pose map, and wires its features back into the frozen decoder through 1x1 convolutions initialised to zero. At step zero the side branch is exactly a no-op, so training can only improve on the base model; as the zero-convs warm up, the pose starts steering generation. LoRA plays the same trick on the weights themselves: a low-rank delta beside frozen attention matrices.'));
  }

  // ── v4-3d-multiview (P8/12): one photo, an orbit of views, a splat cloud ────
  function multiview3d(host) {
    var svg = svgEl('svg', { viewBox: '0 0 520 250' }), D = '5.5s';
    svg.appendChild(txt(14, 16, 'one photo becomes an orbit of views becomes a cloud of Gaussians'));
    svg.appendChild(svgEl('rect', { x: 16, y: 64, width: 88, height: 70, fill: SURF, stroke: SOFT }));
    svg.appendChild(svgEl('circle', { cx: 60, cy: 94, r: 13, fill: 'none', stroke: INK, 'stroke-width': '1.4' }));
    svg.appendChild(svgEl('line', { x1: 34, y1: 118, x2: 86, y2: 118, stroke: MUTE, 'stroke-width': '1' }));
    svg.appendChild(txt(16, 148, 'single image', 8));
    svg.appendChild(draw(svgEl('line', { x1: 110, y1: 100, x2: 144, y2: 108, stroke: MUTE, 'stroke-width': '1.2' }), 36, D, 0.1, 0.16));
    svg.appendChild(fade(svgEl('circle', { cx: 238, cy: 130, r: 64, fill: 'none', stroke: SOFT, 'stroke-width': '1.2', 'stroke-dasharray': '4 4' }), D, 0.14, 0.22));
    svg.appendChild(fade(svgEl('ellipse', { cx: 238, cy: 130, rx: 14, ry: 18, fill: BLUE, opacity: '0.3', stroke: BLUE }), D, 0.16, 0.24));
    var cams = [[238, 58, 238, 68, 238, 82], [310, 130, 297, 130, 283, 130], [238, 202, 238, 192, 238, 178], [166, 130, 179, 130, 193, 130]], i;
    for (i = 0; i < 4; i++) {
      var cm = cams[i];
      svg.appendChild(rise(cm[0], cm[1], D, (0.22 + i * 0.07).toFixed(2), (0.32 + i * 0.07).toFixed(2), [
        svgEl('rect', { x: cm[0] - 11, y: cm[1] - 8, width: 22, height: 16, fill: BG, stroke: BLUE, 'stroke-width': '1.4' }),
        svgEl('line', { x1: cm[2], y1: cm[3], x2: cm[4], y2: cm[5], stroke: BLUE, 'stroke-width': '1' })
      ]));
    }
    svg.appendChild(txt(238, 232, 'multi-view diffusion', 8, 'middle'));
    svg.appendChild(draw(svgEl('line', { x1: 326, y1: 130, x2: 352, y2: 130, stroke: MUTE, 'stroke-width': '1.2' }), 28, D, 0.56, 0.62));
    var sp = [[432, 118, 16, 9, -18, BLUE, 0.35], [420, 134, 14, 8, 20, BLUE, 0.3], [446, 136, 15, 8, -8, WARN, 0.3],
      [432, 150, 17, 9, 12, BLUE, 0.28], [424, 104, 10, 6, 30, WARN, 0.35], [444, 112, 11, 6, -25, BLUE, 0.4], [432, 166, 12, 6, 6, BLUE, 0.22]];
    var cloud = [];
    for (i = 0; i < sp.length; i++) {
      var e = svgEl('ellipse', { cx: sp[i][0], cy: sp[i][1], rx: sp[i][2], ry: sp[i][3], transform: 'rotate(' + sp[i][4] + ' ' + sp[i][0] + ' ' + sp[i][1] + ')', fill: sp[i][5], opacity: '0' });
      e.appendChild(anim('opacity', '0;0;' + sp[i][6] + ';' + sp[i][6], D, { keyTimes: '0;' + (0.6 + i * 0.03).toFixed(2) + ';' + (0.68 + i * 0.03).toFixed(2) + ';1', calcMode: 'spline', keySplines: splines(3) }));
      cloud.push(e);
    }
    svg.appendChild(rise(432, 134, D, 0.58, 0.68, cloud));
    svg.appendChild(fade(txt(432, 198, '3D Gaussian splats', 7, 'middle'), D, 0.86, 0.93));
    host.appendChild(shell('3D GENERATION · TWO-STAGE STACK', 'views first, geometry second', svg,
      'The 2026 text-to-3D stack splits the problem in two. A multi-view diffusion model (Zero123, MVDream, SV3D) generates a ring of consistent views around the object from one photo or prompt; a reconstruction step then fits a cloud of oriented 3D Gaussians to those views by gradient descent. Rendering the splats is just projection plus alpha-compositing, which is why the result runs at real-time frame rates on a consumer GPU.'));
  }

  LF.register({
    'v4-video-temporal': videoTemporal,
    'v4-vision-pipeline': visionPipeline,
    'v4-vlm-projector': vlmProjector,
    'v4-world-rollout': worldRollout,
    'v4-alm-tokens': almTokens,
    'v4-voice-latency': voiceLatency,
    'v4-audio-watermark': audioWatermark,
    'v4-controlnet-zero': controlnetZero,
    'v4-3d-multiview': multiview3d
  });
})();
