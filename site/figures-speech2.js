/* figures-speech2.js — animated lesson figures for Phase 6 (speech & audio).
   Loads after lesson-figures.js and registers widgets through window.LF.
   Vanilla ES5, no deps, theme via CSS vars. SMIL-animated SVG, no JS loops.
   Authoring is the same fenced block in docs/en.md:
       ```figure
       sp-ctc-alignment
       ``` */
(function () {
  'use strict';
  var LF = window.LF;
  if (!LF) { return; }
  var el = LF.el, svgEl = LF.svgEl;

  function shell(label, hint, svg, caption) {
    return el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, [label]), el('span', {}, [hint])]),
      el('div', { class: 'lf-body' }, [el('div', { class: 'lf-out' }, [svg])]),
      el('div', { class: 'lf-cap' }, [caption])
    ]);
  }
  function tx(t) { return document.createTextNode(t); }
  function anim(attrs) { return svgEl('animate', attrs); }
  function label(x, y, t, anchor) {
    return svgEl('text', { x: x, y: y, fill: 'var(--ink-mute,#777)', 'font-size': '10', 'font-family': 'monospace', 'text-anchor': anchor || 'start' }, [tx(t)]);
  }

  // ── sp-asr-attention: decoder cross-attends over encoder audio frames ──────
  function asrAttention(host) {
    var svg = svgEl('svg', { viewBox: '0 0 520 230' });
    // encoder audio frames along the top, decoder tokens emitted below,
    // each new token lights a soft diagonal band of cross-attention weights.
    var frames = 12, fw = 38, x0 = 22, ftop = 44, fh = 26;
    svg.appendChild(label(x0, 28, 'encoder: 30 s log-mel frames'));
    var i;
    for (i = 0; i < frames; i++) {
      var energy = (0.35 + 0.5 * Math.abs(Math.sin(i * 0.7))).toFixed(2);
      svg.appendChild(svgEl('rect', { x: x0 + i * fw, y: ftop, width: fw - 5, height: fh, fill: 'var(--blueprint,#3553ff)', opacity: energy, rx: '2' }));
    }
    // decoder tokens emitted left to right
    var toks = ['<sot>', 'the', 'cat', 'sat'];
    var dy = 168;
    svg.appendChild(label(x0, 150, 'decoder: cross-attends, emits one token at a time'));
    toks.forEach(function (t, k) {
      var tcx = x0 + k * 70;
      var g = svgEl('text', { x: tcx, y: dy, fill: 'var(--blueprint,#3553ff)', 'font-size': '13', 'font-family': 'monospace', opacity: '0' }, [tx(t)]);
      g.appendChild(anim({ attributeName: 'opacity', values: '0;0;1;1', keyTimes: ['0', (0.12 + k * 0.2).toFixed(2), (0.2 + k * 0.2).toFixed(2), '1'].join(';'), dur: '6s', repeatCount: 'indefinite' }));
      svg.appendChild(g);
      // a soft attention band over the frames it focuses on (monotonic drift)
      var focus = Math.round(k / (toks.length - 1) * (frames - 3)) + 1;
      var band = svgEl('rect', { x: x0 + focus * fw - 3, y: ftop - 4, width: fw * 2.4, height: fh + 8, fill: 'var(--warn,#b8870f)', opacity: '0', rx: '3' });
      var bandVals = ['0', '0', '0.28', '0.28', '0'];
      var bandTimes = ['0', (0.12 + k * 0.2).toFixed(2), (0.22 + k * 0.2).toFixed(2), (0.3 + k * 0.2).toFixed(2), (0.4 + k * 0.2).toFixed(2)];
      if (0.4 + k * 0.2 < 1) { bandVals.push('0'); bandTimes.push('1'); }
      band.appendChild(anim({ attributeName: 'opacity', values: bandVals.join(';'), keyTimes: bandTimes.join(';'), dur: '6s', repeatCount: 'indefinite' }));
      svg.appendChild(band);
    });
    svg.appendChild(label(x0, 208, 'attention drifts left-to-right: a learned, soft alignment (no blank token)'));
    host.appendChild(shell('ASR CROSS-ATTENTION', 'decoder attends over audio',
      svg,
      'Whisper is an encoder-decoder. The encoder turns the 30-second log-mel window into a row of audio frames, and the decoder emits tokens one at a time, each step cross-attending over those frames. The highlighted band shows attention drifting left to right as the transcript advances, a soft learned alignment rather than the fixed per-frame labels a CTC model uses.'));
  }

  // ── sp-eer-crossover: FAR and FRR curves crossing at the EER threshold ─────
  function eerCrossover(host) {
    var W = 520, H = 230, PAD = 34;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    function px(t) { return PAD + t * (W - 2 * PAD); }
    function py(v) { return H - PAD - v * (H - 2 * PAD); }
    // FRR rises with threshold, FAR falls; they cross near t=0.5 -> EER.
    function far(t) { return Math.exp(-3.2 * t); }
    function frr(t) { return Math.exp(-3.2 * (1 - t)); }
    function path(fn) { var d = '', i; for (i = 0; i <= 60; i++) { var t = i / 60; d += (i ? 'L' : 'M') + px(t).toFixed(1) + ' ' + py(fn(t)).toFixed(1) + ' '; } return d; }
    svg.appendChild(svgEl('line', { x1: PAD, y1: H - PAD, x2: W - PAD, y2: H - PAD, stroke: 'var(--rule-soft,#ddd)', 'stroke-width': '1' }));
    svg.appendChild(label(PAD, 22, 'error rate vs decision threshold'));
    svg.appendChild(svgEl('path', { d: path(far), fill: 'none', stroke: 'var(--ink-mute,#999)', 'stroke-width': '2' }));
    svg.appendChild(svgEl('path', { d: path(frr), fill: 'none', stroke: 'var(--blueprint,#3553ff)', 'stroke-width': '2' }));
    svg.appendChild(label(px(0.06), py(far(0.06)) - 6, 'FAR'));
    svg.appendChild(label(px(0.82), py(frr(0.82)) - 6, 'FRR'));
    // sliding threshold line
    var thr = svgEl('line', { x1: px(0.2), y1: PAD, x2: px(0.2), y2: H - PAD, stroke: 'var(--warn,#b8870f)', 'stroke-width': '1.5' });
    thr.appendChild(anim({ attributeName: 'x1', values: [px(0.15), px(0.85), px(0.5), px(0.5)].join(';'), keyTimes: '0;0.45;0.75;1', dur: '6s', repeatCount: 'indefinite' }));
    thr.appendChild(anim({ attributeName: 'x2', values: [px(0.15), px(0.85), px(0.5), px(0.5)].join(';'), keyTimes: '0;0.45;0.75;1', dur: '6s', repeatCount: 'indefinite' }));
    svg.appendChild(thr);
    // EER crossover marker, pulses when threshold settles there
    var cy = py(far(0.5));
    var dot = svgEl('circle', { cx: px(0.5), cy: cy, r: '5', fill: 'var(--warn,#b8870f)', opacity: '0' });
    dot.appendChild(anim({ attributeName: 'opacity', values: '0;0;1;1', keyTimes: '0;0.7;0.78;1', dur: '6s', repeatCount: 'indefinite' }));
    dot.appendChild(anim({ attributeName: 'r', values: '5;5;7;5', keyTimes: '0;0.78;0.88;1', dur: '6s', repeatCount: 'indefinite' }));
    svg.appendChild(dot);
    svg.appendChild(label(px(0.5) + 10, cy - 8, 'EER: FAR = FRR'));
    host.appendChild(shell('EER CROSSOVER', 'slide the threshold',
      svg,
      'Raise the threshold and you reject more genuine speakers (false reject rate climbs); lower it and you accept more impostors (false accept rate climbs). The orange line sweeps the threshold and settles where the two curves cross. That single crossover point is the Equal Error Rate, the one number every speaker-verification leaderboard quotes.'));
  }

  // ── sp-tts-stack: text -> mel spectrogram -> waveform, three stages ────────
  function ttsStack(host) {
    var svg = svgEl('svg', { viewBox: '0 0 520 240' });
    // stage 1: text tokens
    svg.appendChild(label(18, 22, 'text -> tokens'));
    ['hel', 'lo', 'wor', 'ld'].forEach(function (t, i) {
      var bx = 18 + i * 36;
      svg.appendChild(svgEl('rect', { x: bx, y: 32, width: 32, height: 22, fill: 'var(--blueprint,#3553ff)', opacity: '0.25', rx: '2' }));
      svg.appendChild(svgEl('text', { x: bx + 16, y: 47, fill: 'var(--ink,#222)', 'font-size': '10', 'font-family': 'monospace', 'text-anchor': 'middle' }, [tx(t)]));
    });
    // stage 2: mel grid, cells fade in
    svg.appendChild(label(18, 90, 'acoustic model -> mel spectrogram'));
    var cols = 7, rows = 3, cw = 40, ch = 14, gx = 18, gy = 100;
    var r, c;
    for (r = 0; r < rows; r++) for (c = 0; c < cols; c++) {
      var energy = (Math.sin(c * 0.6 + r * 0.9) * 0.4 + 0.5) * (1 - r / rows * 0.5);
      var cell = svgEl('rect', { x: gx + c * cw, y: gy + r * ch, width: cw - 1, height: ch - 1, fill: 'var(--blueprint,#3553ff)', opacity: '0' });
      cell.appendChild(anim({ attributeName: 'opacity', values: ['0', '0', energy.toFixed(2), energy.toFixed(2)].join(';'), keyTimes: ['0', (0.15 + c / cols * 0.35).toFixed(2), (0.25 + c / cols * 0.35).toFixed(2), '1'].join(';'), dur: '5s', repeatCount: 'indefinite' }));
      svg.appendChild(cell);
    }
    // stage 3: vocoder -> waveform morph
    svg.appendChild(label(18, 178, 'vocoder -> waveform'));
    var wy = 205, wx0 = 18, wlen = 484;
    function wavePath(amp, freq) { var d = '', i; for (i = 0; i <= 80; i++) { var x = wx0 + wlen * i / 80; var y = wy + amp * Math.sin(i * freq) * (0.4 + 0.6 * Math.sin(i * 0.15)); d += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1) + ' '; } return d; }
    var flat = ''; var k; for (k = 0; k <= 80; k++) { flat += (k ? 'L' : 'M') + (wx0 + wlen * k / 80).toFixed(1) + ' ' + wy + ' '; }
    var wave = svgEl('path', { d: flat, fill: 'none', stroke: 'var(--blueprint,#3553ff)', 'stroke-width': '1.6' });
    wave.appendChild(anim({ attributeName: 'd', values: [flat, flat, wavePath(16, 0.9), wavePath(13, 1.3)].join(';'), keyTimes: '0;0.55;0.8;1', dur: '5s', repeatCount: 'indefinite' }));
    svg.appendChild(wave);
    host.appendChild(shell('TTS STACK', 'text to mel to waveform',
      svg,
      'Modern text-to-speech runs three stages. The frontend turns the string into tokens, the acoustic model paints a mel spectrogram column by column, and the vocoder turns that mel into an audible waveform. End-to-end flow-matching models blur the last two stages, but this three-part picture is still how you reason about and debug a synthesised voice.'));
  }

  // ── sp-codec-tokens: RVQ codebook stack feeds an autoregressive decoder ────
  function codecTokens(host) {
    var svg = svgEl('svg', { viewBox: '0 0 520 240' });
    svg.appendChild(label(18, 22, 'residual vector quantization: 4 codebooks per frame'));
    var rows = 4, steps = 5, x0 = 30, y0 = 36, cw = 48, ch = 26, gap = 12;
    // codebook level labels
    var lv;
    for (lv = 0; lv < rows; lv++) {
      svg.appendChild(label(0, y0 + lv * (ch + gap) + 17, 'q' + lv, 'start'));
    }
    var r, c;
    for (r = 0; r < rows; r++) for (c = 0; c < steps; c++) {
      var bx = x0 + c * (cw + gap), by = y0 + r * (ch + gap);
      var fill = r === 0 ? 'var(--warn,#b8870f)' : 'var(--blueprint,#3553ff)';
      var rect = svgEl('rect', { x: bx, y: by, width: cw, height: ch, fill: fill, opacity: '0', rx: '2' });
      var t = 0.1 + c / steps * 0.6 + r * 0.02;
      rect.appendChild(anim({ attributeName: 'opacity', values: ['0', '0', (r === 0 ? 0.85 : 0.55).toFixed(2), (r === 0 ? 0.85 : 0.55).toFixed(2)].join(';'), keyTimes: ['0', t.toFixed(2), (t + 0.06).toFixed(2), '1'].join(';'), dur: '5s', repeatCount: 'indefinite' }));
      svg.appendChild(rect);
    }
    svg.appendChild(label(x0, y0 + rows * (ch + gap) + 6, 'q0 = semantic (linguistic content)   q1..q3 = acoustic detail'));
    // sum -> waveform out
    svg.appendChild(label(18, 210, 'decoder sums codes ->'));
    var wy = 222, wx0 = 150, wlen = 350;
    function wavePath(amp) { var d = '', i; for (i = 0; i <= 70; i++) { var x = wx0 + wlen * i / 70; var y = wy + amp * Math.sin(i * 1.1) * (0.5 + 0.5 * Math.cos(i * 0.2)); d += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1) + ' '; } return d; }
    var flat = ''; var k; for (k = 0; k <= 70; k++) { flat += (k ? 'L' : 'M') + (wx0 + wlen * k / 70).toFixed(1) + ' ' + wy + ' '; }
    var wave = svgEl('path', { d: flat, fill: 'none', stroke: 'var(--blueprint,#3553ff)', 'stroke-width': '1.6' });
    wave.appendChild(anim({ attributeName: 'd', values: [flat, flat, wavePath(14), wavePath(11)].join(';'), keyTimes: '0;0.7;0.88;1', dur: '5s', repeatCount: 'indefinite' }));
    svg.appendChild(wave);
    host.appendChild(shell('NEURAL CODEC TOKENS', 'RVQ codebooks to waveform',
      svg,
      'A neural audio codec discretizes sound with residual vector quantization: the first codebook captures the signal, each later one quantizes the leftover residual. Splitting the first codebook as semantic (the linguistic content, gold) from the acoustic remainder lets a transformer predict speech tokens the way it predicts words. The decoder sums the chosen codes per frame back into a waveform.'));
  }

  // ── sp-vad-cascade: waveform gated by speech/silence with hangover timer ───
  function vadCascade(host) {
    var W = 520, H = 230, PAD = 18;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var wy = 70, wlen = W - 2 * PAD;
    svg.appendChild(label(PAD, 28, 'is this 20 ms frame speech? Silero VAD per frame'));
    // segments: silence, speech, brief pause, speech, long silence (turn end)
    var segs = [[0, 0.12, 0], [0.12, 0.42, 1], [0.42, 0.5, 0], [0.5, 0.74, 1], [0.74, 1, 0]];
    segs.forEach(function (s) {
      var sx = PAD + s[0] * wlen, ex = PAD + s[1] * wlen;
      var d = '', i, npts = Math.max(2, Math.round((s[1] - s[0]) * 90));
      for (i = 0; i <= npts; i++) { var x = sx + (ex - sx) * i / npts; var amp = s[2] ? 22 * Math.sin(i * 1.4) * (0.6 + 0.4 * Math.sin(i * 0.3)) : 1.5 * Math.sin(i * 2.0); d += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + (wy + amp).toFixed(1) + ' '; }
      svg.appendChild(svgEl('path', { d: d, fill: 'none', stroke: s[2] ? 'var(--blueprint,#3553ff)' : 'var(--rule-soft,#bbb)', 'stroke-width': s[2] ? '1.6' : '1' }));
    });
    // VAD decision lane
    svg.appendChild(label(PAD, 128, 'VAD decision'));
    segs.forEach(function (s) {
      var sx = PAD + s[0] * wlen;
      svg.appendChild(svgEl('rect', { x: sx, y: 136, width: (s[1] - s[0]) * wlen - 2, height: 16, fill: s[2] ? 'var(--blueprint,#3553ff)' : 'var(--rule-soft,#eee)', opacity: s[2] ? '0.8' : '0.6' }));
    });
    // hangover timer filling during final silence, then turn-end fires
    svg.appendChild(label(PAD, 178, 'silence hangover -> turn end fires'));
    var hbX = PAD + 0.74 * wlen, hbW = 0.26 * wlen - 4;
    svg.appendChild(svgEl('rect', { x: hbX, y: 186, width: hbW, height: 14, fill: 'none', stroke: 'var(--rule-soft,#ccc)', 'stroke-width': '1' }));
    var fill = svgEl('rect', { x: hbX, y: 186, width: '0', height: 14, fill: 'var(--warn,#b8870f)', opacity: '0.7' });
    fill.appendChild(anim({ attributeName: 'width', values: ['0', '0', hbW.toFixed(0), hbW.toFixed(0)].join(';'), keyTimes: '0;0.74;0.95;1', dur: '5s', repeatCount: 'indefinite' }));
    svg.appendChild(fill);
    var fire = svgEl('circle', { cx: hbX + hbW + 8, cy: 193, r: '5', fill: 'var(--warn,#b8870f)', opacity: '0' });
    fire.appendChild(anim({ attributeName: 'opacity', values: '0;0;1;0', keyTimes: '0;0.94;0.96;1', dur: '5s', repeatCount: 'indefinite' }));
    svg.appendChild(fire);
    host.appendChild(shell('VAD + TURN-TAKING', 'speech, pause, hangover, turn end',
      svg,
      'The detector labels every 20 ms frame as speech or silence. A brief mid-sentence pause must not end the turn, so a silence hangover timer has to fill all the way before end-pointing fires. Set the hangover too short and you cut users off; too long and the assistant never stops waiting. The turn ends only when sustained silence outlasts the timer.'));
  }

  // ── sp-fullduplex: two parallel audio streams + inner-monologue text ───────
  function fullDuplex(host) {
    var W = 520, H = 230, PAD = 18;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var wlen = W - 2 * PAD;
    function wavePath(yc, amp, freq, phase) { var d = '', i; for (i = 0; i <= 90; i++) { var x = PAD + wlen * i / 90; var y = yc + amp * Math.sin(i * freq + phase) * (0.55 + 0.45 * Math.sin(i * 0.12 + phase)); d += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1) + ' '; } return d; }
    // user input stream (always arriving)
    svg.appendChild(label(PAD, 26, 'user audio in (Mimi tokens, constantly arriving)'));
    var inW = svgEl('path', { d: wavePath(54, 16, 1.0, 0), fill: 'none', stroke: 'var(--ink-mute,#999)', 'stroke-width': '1.6' });
    inW.appendChild(anim({ attributeName: 'd', values: [wavePath(54, 16, 1.0, 0), wavePath(54, 16, 1.0, 1.6), wavePath(54, 16, 1.0, 3.2)].join(';'), keyTimes: '0;0.5;1', dur: '4s', repeatCount: 'indefinite' }));
    svg.appendChild(inW);
    // inner monologue text lane (the intermediate)
    svg.appendChild(label(PAD, 110, 'inner-monologue text (intermediate, not a separate stage)'));
    ['the', 'weather', 'is', 'sunny', 'today'].forEach(function (w, i) {
      var bx = PAD + i * 96;
      var g = svgEl('text', { x: bx, y: 134, fill: 'var(--blueprint,#3553ff)', 'font-size': '13', 'font-family': 'monospace', opacity: '0' }, [tx(w)]);
      g.appendChild(anim({ attributeName: 'opacity', values: '0;0;1;1', keyTimes: ['0', (0.1 + i * 0.13).toFixed(2), (0.2 + i * 0.13).toFixed(2), '1'].join(';'), dur: '4s', repeatCount: 'indefinite' }));
      svg.appendChild(g);
    });
    // model's own output stream, generated simultaneously
    svg.appendChild(label(PAD, 176, "model audio out (generated at the same time, full-duplex)"));
    var outW = svgEl('path', { d: wavePath(202, 0, 1.3, 0), fill: 'none', stroke: 'var(--blueprint,#3553ff)', 'stroke-width': '1.6' });
    outW.appendChild(anim({ attributeName: 'd', values: [wavePath(202, 0, 1.3, 0), wavePath(202, 0, 1.3, 0), wavePath(202, 18, 1.3, 1.2), wavePath(202, 14, 1.3, 2.4)].join(';'), keyTimes: '0;0.3;0.65;1', dur: '4s', repeatCount: 'indefinite' }));
    svg.appendChild(outW);
    host.appendChild(shell('FULL-DUPLEX SPEECH', 'listen and speak at once',
      svg,
      'A pipelined voice agent has a latency floor because each stage waits on the one before it. A full-duplex model collapses the pipeline: it consumes the incoming user stream and emits its own audio stream simultaneously, with a text inner monologue as an intermediate rather than a required stage. Listening and speaking overlap, which is how 200 ms response latency becomes possible.'));
  }

  // ── sp-wer-align: edit-distance alignment of reference vs hypothesis ───────
  function werAlign(host) {
    var svg = svgEl('svg', { viewBox: '0 0 520 220' });
    // ref vs hyp with one substitution, one deletion, one insertion
    var cols = [
      { ref: 'turn', hyp: 'turn', op: 'ok' },
      { ref: 'on', hyp: 'on', op: 'ok' },
      { ref: 'the', hyp: '', op: 'del' },
      { ref: 'kitchen', hyp: 'chicken', op: 'sub' },
      { ref: '', hyp: 'now', op: 'ins' },
      { ref: 'lights', hyp: 'lights', op: 'ok' }
    ];
    var n = cols.length, cw = 80, x0 = 14;
    svg.appendChild(label(x0, 26, 'reference'));
    svg.appendChild(label(x0, 150, 'hypothesis (ASR output)'));
    var colors = { ok: 'var(--blueprint,#3553ff)', sub: 'var(--warn,#b8870f)', del: 'var(--ink-mute,#999)', ins: 'var(--warn,#b8870f)' };
    cols.forEach(function (c, i) {
      var cx = x0 + i * cw;
      if (c.ref) {
        svg.appendChild(svgEl('rect', { x: cx, y: 36, width: cw - 8, height: 26, fill: 'var(--rule-soft,#eee)', rx: '2' }));
        svg.appendChild(svgEl('text', { x: cx + (cw - 8) / 2, y: 54, fill: 'var(--ink,#222)', 'font-size': '11', 'font-family': 'monospace', 'text-anchor': 'middle' }, [tx(c.ref)]));
      }
      if (c.hyp) {
        svg.appendChild(svgEl('rect', { x: cx, y: 160, width: cw - 8, height: 26, fill: c.op === 'ok' ? 'var(--rule-soft,#eee)' : 'rgba(184,135,15,0.18)', rx: '2' }));
        svg.appendChild(svgEl('text', { x: cx + (cw - 8) / 2, y: 178, fill: 'var(--ink,#222)', 'font-size': '11', 'font-family': 'monospace', 'text-anchor': 'middle' }, [tx(c.hyp)]));
      }
      // alignment link, drawn in sequence
      var lk = svgEl('line', { x1: cx + (cw - 8) / 2, y1: 64, x2: cx + (cw - 8) / 2, y2: 158, stroke: colors[c.op], 'stroke-width': c.op === 'ok' ? '1.5' : '2', 'stroke-dasharray': c.op === 'ok' ? '0' : '4 3', opacity: '0' });
      lk.appendChild(anim({ attributeName: 'opacity', values: '0;0;1;1', keyTimes: ['0', (0.1 + i * 0.12).toFixed(2), (0.2 + i * 0.12).toFixed(2), '1'].join(';'), dur: '5s', repeatCount: 'indefinite' }));
      svg.appendChild(lk);
      if (c.op !== 'ok') {
        var tag = svgEl('text', { x: cx + (cw - 8) / 2, y: 116, fill: colors[c.op], 'font-size': '9', 'font-family': 'monospace', 'text-anchor': 'middle', opacity: '0' }, [tx(c.op.toUpperCase())]);
        tag.appendChild(anim({ attributeName: 'opacity', values: '0;0;1;1', keyTimes: ['0', (0.2 + i * 0.12).toFixed(2), (0.3 + i * 0.12).toFixed(2), '1'].join(';'), dur: '5s', repeatCount: 'indefinite' }));
        svg.appendChild(tag);
      }
    });
    svg.appendChild(label(x0, 210, 'WER = (S + D + I) / N = (1 + 1 + 1) / 5 = 60%'));
    host.appendChild(shell('WORD ERROR RATE', 'align ref to hypothesis',
      svg,
      'Word error rate is an edit distance. The transcript is aligned to the reference word by word, and every mismatch is counted as a substitution, deletion, or insertion. Their sum divided by the number of reference words is the WER. Here one substitution (kitchen to chicken), one deletion (the), and one insertion (now) over five reference words give sixty percent.'));
  }

  // ── sp-voice-factorize: split content + speaker, swap speaker, recombine ───
  function voiceFactorize(host) {
    var svg = svgEl('svg', { viewBox: '0 0 520 240' });
    var wlen = 150;
    function wavePath(x0, yc, amp, freq, phase) { var d = '', i; for (i = 0; i <= 50; i++) { var x = x0 + wlen * i / 50; var y = yc + amp * Math.sin(i * freq + phase) * (0.5 + 0.5 * Math.sin(i * 0.18)); d += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1) + ' '; } return d; }
    // source clip on the left
    svg.appendChild(label(18, 24, 'source: person A says "hello"'));
    svg.appendChild(svgEl('path', { d: wavePath(18, 56, 16, 1.1, 0), fill: 'none', stroke: 'var(--ink-mute,#999)', 'stroke-width': '1.6' }));
    // factorize into content token + speaker A embedding
    svg.appendChild(label(210, 24, 'factorize'));
    var cTok = svgEl('rect', { x: 210, y: 40, width: 92, height: 22, fill: 'var(--blueprint,#3553ff)', opacity: '0', rx: '2' });
    cTok.appendChild(anim({ attributeName: 'opacity', values: '0;0;0.7;0.7', keyTimes: '0;0.18;0.3;1', dur: '6s', repeatCount: 'indefinite' }));
    svg.appendChild(cTok);
    var cLab = svgEl('text', { x: 256, y: 55, fill: 'var(--bg,#fff)', 'font-size': '10', 'font-family': 'monospace', 'text-anchor': 'middle', opacity: '0' }, [tx('content')]);
    cLab.appendChild(anim({ attributeName: 'opacity', values: '0;0;1;1', keyTimes: '0;0.18;0.3;1', dur: '6s', repeatCount: 'indefinite' }));
    svg.appendChild(cLab);
    var spkA = svgEl('circle', { cx: 256, cy: 92, r: '14', fill: 'var(--ink-mute,#999)', opacity: '0' });
    spkA.appendChild(anim({ attributeName: 'opacity', values: '0;0;0.8;0.8;0.25;0.25', keyTimes: '0;0.18;0.3;0.45;0.55;1', dur: '6s', repeatCount: 'indefinite' }));
    svg.appendChild(spkA);
    svg.appendChild(label(238, 120, 'spk A (dropped)'));
    // reference speaker B embedding swapped in
    svg.appendChild(label(18, 150, 'reference: 5 s of person B'));
    var spkB = svgEl('circle', { cx: 256, cy: 92, r: '14', fill: 'var(--warn,#b8870f)', opacity: '0' });
    spkB.appendChild(anim({ attributeName: 'opacity', values: '0;0;0;0.85;0.85', keyTimes: '0;0.45;0.5;0.6;1', dur: '6s', repeatCount: 'indefinite' }));
    svg.appendChild(spkB);
    var swap = svgEl('path', { d: 'M 110 168 Q 200 150 244 100', fill: 'none', stroke: 'var(--warn,#b8870f)', 'stroke-width': '1.5', 'stroke-dasharray': '4 3', opacity: '0' });
    swap.appendChild(anim({ attributeName: 'opacity', values: '0;0;0.9;0.9;0;0', keyTimes: '0;0.45;0.55;0.7;0.8;1', dur: '6s', repeatCount: 'indefinite' }));
    svg.appendChild(swap);
    // recombine -> output waveform in B's voice
    svg.appendChild(label(330, 24, 'recombine -> B says "hello"'));
    var out = svgEl('path', { d: wavePath(338, 92, 0, 1.4, 0), fill: 'none', stroke: 'var(--blueprint,#3553ff)', 'stroke-width': '1.6' });
    out.appendChild(anim({ attributeName: 'd', values: [wavePath(338, 92, 0, 1.4, 0), wavePath(338, 92, 0, 1.4, 0), wavePath(338, 92, 17, 1.4, 0.5)].join(';'), keyTimes: '0;0.65;1', dur: '6s', repeatCount: 'indefinite' }));
    svg.appendChild(out);
    svg.appendChild(label(18, 220, 'same content, swapped speaker identity; an inaudible watermark is required'));
    host.appendChild(shell('VOICE FACTORIZE', 'split, swap speaker, recombine',
      svg,
      'Cloning and conversion rest on one decomposition: separate what was said from who said it. The source clip is factorized into a content representation and a speaker embedding; the source speaker is dropped and a reference embedding from a five-second clip of person B is swapped in. Recombining content with the new speaker yields B saying the same words, which is why a consent gate and watermark are mandatory.'));
  }

  LF.register({
    'sp-asr-attention': asrAttention,
    'sp-eer-crossover': eerCrossover,
    'sp-tts-stack': ttsStack,
    'sp-codec-tokens': codecTokens,
    'sp-vad-cascade': vadCascade,
    'sp-fullduplex': fullDuplex,
    'sp-wer-align': werAlign,
    'sp-voice-factorize': voiceFactorize
  });
})();
