(function () {
  'use strict';
  var LF = window.LF;
  if (!LF) { return; }

  var el = LF.el, svgEl = LF.svgEl;
  var INK = 'var(--ink,#1a1a1a)', SOFT = 'var(--ink-soft,#555)', MUTE = 'var(--ink-mute,#777)';
  var BP = 'var(--blueprint,#3553ff)', BG = 'var(--bg,#fafaf5)', SURF = 'var(--bg-surface,#eee)';
  var RULE = 'var(--rule-soft,#ddd)', WARN = 'var(--warn,#b8870f)';

  function anim(attr, vals, dur, extra) {
    var a = { attributeName: attr, values: vals, dur: dur, repeatCount: 'indefinite' };
    if (extra) for (var k in extra) a[k] = extra[k];
    return svgEl('animate', a);
  }
  function animT(type, vals, dur, extra) {
    var a = { attributeName: 'transform', type: type, values: vals, dur: dur, repeatCount: 'indefinite' };
    if (extra) for (var k in extra) a[k] = extra[k];
    return svgEl('animateTransform', a);
  }
  function card(host, label, hint, svg, caption) {
    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, [label]), el('span', {}, [hint])]),
      el('div', { class: 'lf-body' }, [el('div', { class: 'lf-out' }, [svg])]),
      el('div', { class: 'lf-cap' }, [caption])
    ]));
  }
  function txt(x, y, s, fill, size, anchor) {
    return svgEl('text', {
      x: x, y: y, fill: fill || SOFT, 'font-size': size || 11,
      'font-family': 'var(--font-mono,monospace)', 'text-anchor': anchor || 'middle'
    }, [svgEl('tspan', {}, [document.createTextNode(s)])]);
  }

  // ── 32: embedding lookup — an id selects a row, sum with position vector ────
  function embeddingLookup(host) {
    var svg = svgEl('svg', { viewBox: '0 0 520 240' });
    var tx = 40, ty = 28, rw = 96, rh = 26, rows = 6;
    svg.appendChild(txt(tx + rw / 2, ty - 8, 'token table  (V, D)', MUTE, 10));
    var i;
    for (i = 0; i < rows; i++) {
      var ry = ty + i * rh;
      svg.appendChild(svgEl('rect', { x: tx, y: ry, width: rw, height: rh - 3, rx: 3, fill: i === 3 ? 'none' : BG, stroke: RULE, 'stroke-width': '1' }));
      svg.appendChild(txt(tx - 8, ry + 16, 'id ' + i, MUTE, 8, 'end'));
    }
    // the highlight box that lands on the selected row (id 3)
    var sel = svgEl('rect', { x: tx - 2, y: ty - 2, width: rw + 4, height: rh - 1, rx: 4, fill: BP, opacity: '0.14', stroke: BP, 'stroke-width': '2.4' });
    sel.appendChild(anim('y', (ty - 2) + ';' + (ty - 2 + 3 * rh) + ';' + (ty - 2 + 3 * rh), '3s', { keyTimes: '0;0.45;1' }));
    svg.appendChild(sel);
    svg.appendChild(txt(tx + rw / 2, ty + 3 * rh + 16, 'row 3', BP, 9));
    // arrow: selected row flows right to the dense vector
    var flow = svgEl('path', { d: 'M' + (tx + rw + 4) + ' ' + (ty + 3 * rh + 11) + ' H300', fill: 'none', stroke: BP, 'stroke-width': '2', 'stroke-dasharray': '6 5' });
    flow.appendChild(anim('stroke-dashoffset', '22;0', '1s', { begin: '1.2s' }));
    svg.appendChild(flow);
    // the token vector (D cells)
    var vx = 308, vy = ty + 3 * rh - 4, cell = 18;
    var tg = svgEl('g', {});
    for (i = 0; i < 5; i++) tg.appendChild(svgEl('rect', { x: vx + i * cell, y: vy, width: cell - 2, height: 22, rx: 2, fill: BP, opacity: (0.3 + i * 0.12).toFixed(2) }));
    tg.appendChild(txt(vx + 5 * cell / 2, vy - 6, 'token vec (D)', BP, 9));
    tg.appendChild(anim('opacity', '0;0;1;1', '3s', { keyTimes: '0;0.55;0.75;1', fill: 'freeze' }));
    svg.appendChild(tg);
    // position vector below it, then plus sign and sum
    var py = vy + 64;
    var pg = svgEl('g', {});
    for (i = 0; i < 5; i++) pg.appendChild(svgEl('rect', { x: vx + i * cell, y: py, width: cell - 2, height: 22, rx: 2, fill: WARN, opacity: (0.3 + i * 0.12).toFixed(2) }));
    pg.appendChild(txt(vx + 5 * cell / 2, py + 36, 'position vec (D)', WARN, 9));
    svg.appendChild(pg);
    svg.appendChild(txt(vx + 5 * cell + 16, (vy + py) / 2 + 16, '+', INK, 18, 'middle'));
    var sumg = svgEl('g', {});
    for (i = 0; i < 5; i++) sumg.appendChild(svgEl('rect', { x: vx + 5 * cell + 30 + i * cell, y: (vy + py) / 2 + 4, width: cell - 2, height: 22, rx: 2, fill: INK, opacity: (0.25 + i * 0.13).toFixed(2) }));
    sumg.appendChild(txt(vx + 5 * cell + 30 + 5 * cell / 2, (vy + py) / 2 - 4, 'input (B,T,D)', INK, 9));
    sumg.appendChild(anim('opacity', '0;0;1;1', '3s', { keyTimes: '0;0.7;0.9;1', fill: 'freeze' }));
    svg.appendChild(sumg);
    card(host, 'EMBEDDING LOOKUP', 'select row · add position',
      svg,
      'A token id is not arithmetic; it is an index. The id selects one row of the token table, returning a dense vector the model treats as the meaning of that id. Position has no inherent vector either, so a parallel positional embedding is looked up by slot and summed elementwise. The result is the (B, T, D) tensor the first attention block consumes.');
  }

  // ── 34: transformer block — two residual bypasses skip the sublayers ────────
  function transformerBlock(host) {
    var svg = svgEl('svg', { viewBox: '0 0 520 250' });
    var sx = 200, w = 120;
    function block(y, h, label, sub, fill, stroke) {
      var g = svgEl('g', {});
      g.appendChild(svgEl('rect', { x: sx, y: y, width: w, height: h, rx: 5, fill: fill, stroke: stroke, 'stroke-width': '1.8' }));
      g.appendChild(txt(sx + w / 2, y + (sub ? h / 2 - 2 : h / 2 + 4), label, stroke === BP ? BP : SOFT, 11));
      if (sub) g.appendChild(txt(sx + w / 2, y + h / 2 + 12, sub, MUTE, 8));
      return g;
    }
    svg.appendChild(txt(sx + w / 2, 16, 'input  (B, T, D)', INK, 10));
    var ln1 = block(28, 26, 'LayerNorm 1', '', SURF, MUTE);
    var attn = block(64, 40, 'attention', 'causal · multi-head', BG, BP);
    var add1 = block(116, 24, 'add residual', '', BG, MUTE);
    var ln2 = block(150, 24, 'LayerNorm 2', '', SURF, MUTE);
    var mlp = block(182, 38, 'MLP  D→4D→D', '', BG, BP);
    [ln1, attn, add1, ln2, mlp].forEach(function (g) { svg.appendChild(g); });
    // vertical spine flowing down
    var spine = svgEl('line', { x1: sx + w / 2, y1: 28, x2: sx + w / 2, y2: 220, stroke: RULE, 'stroke-width': '2' });
    svg.appendChild(spine);
    // first residual bypass: from input around attention into add1
    var rp1 = svgEl('path', { d: 'M' + sx + ' 30 C 120 30, 120 128, ' + sx + ' 128', fill: 'none', stroke: BP, 'stroke-width': '2', 'stroke-dasharray': '7 5' });
    rp1.appendChild(anim('stroke-dashoffset', '120;0', '2.2s'));
    svg.appendChild(rp1);
    svg.appendChild(txt(96, 80, 'residual', BP, 9, 'middle'));
    // second residual bypass: from add1 around mlp into output
    var rp2 = svgEl('path', { d: 'M' + sx + ' 132 C 120 132, 120 232, ' + sx + ' 232', fill: 'none', stroke: BP, 'stroke-width': '2', 'stroke-dasharray': '7 5' });
    rp2.appendChild(anim('stroke-dashoffset', '120;0', '2.2s', { begin: '0.5s' }));
    svg.appendChild(rp2);
    // a signal token riding the spine down through the block
    var dot = svgEl('circle', { r: 5, fill: WARN });
    dot.appendChild(anim('cy', '28;220', '2.6s'));
    dot.setAttribute('cx', sx + w / 2);
    svg.appendChild(dot);
    svg.appendChild(txt(sx + w / 2, 238, 'output  (B, T, D)', INK, 10));
    // pre-LN annotation on the right
    svg.appendChild(txt(420, 60, 'pre-LN:', INK, 10, 'middle'));
    svg.appendChild(txt(420, 76, 'norm sits', SOFT, 9, 'middle'));
    svg.appendChild(txt(420, 90, 'inside the', SOFT, 9, 'middle'));
    svg.appendChild(txt(420, 104, 'bypass, so', SOFT, 9, 'middle'));
    svg.appendChild(txt(420, 118, 'the residual', SOFT, 9, 'middle'));
    svg.appendChild(txt(420, 132, 'path stays', SOFT, 9, 'middle'));
    svg.appendChild(txt(420, 146, 'clean to depth', BP, 9, 'middle'));
    card(host, 'TRANSFORMER BLOCK', 'two residual bypasses',
      svg,
      'The block has exactly two sublayers and two residual paths. The input forks: one copy flows through LayerNorm then attention, the other skips straight to the add. The same fork repeats around the MLP. The clean bypass is what lets gradients reach the bottom of a deep stack, and placing the norm inside the bypass (pre-LN) is why the stack trains without a warmup crutch.');
  }

  // ── 35: GPT assembly — stack of blocks, head tied back to the token table ──
  function gptAssembly(host) {
    var svg = svgEl('svg', { viewBox: '0 0 520 250' });
    var cx = 200, w = 150;
    svg.appendChild(txt(cx + w / 2, 16, 'token ids  (B, T)', INK, 10));
    // token + position embedding merge
    svg.appendChild(svgEl('rect', { x: cx, y: 24, width: 66, height: 30, rx: 4, fill: BG, stroke: BP, 'stroke-width': '1.8' }));
    svg.appendChild(txt(cx + 33, 43, 'tok emb', BP, 9));
    svg.appendChild(svgEl('rect', { x: cx + 84, y: 24, width: 66, height: 30, rx: 4, fill: BG, stroke: WARN, 'stroke-width': '1.8' }));
    svg.appendChild(txt(cx + 117, 43, 'pos emb', WARN, 9));
    svg.appendChild(txt(cx + 75, 70, '⊕', INK, 14));
    // the stack of 12 blocks as compressed bars, lighting up top to bottom
    var by = 84, bh = 11, n = 12, i;
    for (i = 0; i < n; i++) {
      var yy = by + i * (bh + 1);
      var r = svgEl('rect', { x: cx + 20, y: yy, width: w - 40, height: bh, rx: 2, fill: BP, opacity: '0.16', stroke: BP, 'stroke-width': '0.8' });
      r.appendChild(anim('opacity', '0.16;0.9;0.16', '3.2s', { begin: (i * 0.14) + 's' }));
      svg.appendChild(r);
    }
    svg.appendChild(txt(cx - 6, by + 6 * (bh + 1), '12 blocks', MUTE, 9, 'end'));
    var ly = by + n * (bh + 1) + 6;
    svg.appendChild(svgEl('rect', { x: cx + 20, y: ly, width: w - 40, height: 22, rx: 3, fill: SURF, stroke: MUTE, 'stroke-width': '1.4' }));
    svg.appendChild(txt(cx + w / 2, ly + 15, 'final LayerNorm', SOFT, 9));
    // LM head
    var hy = ly + 32;
    svg.appendChild(svgEl('rect', { x: cx + 20, y: hy, width: w - 40, height: 26, rx: 4, fill: BG, stroke: BP, 'stroke-width': '1.8' }));
    svg.appendChild(txt(cx + w / 2, hy + 17, 'LM head → logits', BP, 9));
    // weight-tying arc: head reuses the token table
    var tie = svgEl('path', { d: 'M' + (cx + 20) + ' ' + (hy + 13) + ' C 90 ' + (hy + 13) + ', 90 39, ' + cx + ' 39', fill: 'none', stroke: BP, 'stroke-width': '1.8', 'stroke-dasharray': '6 5' });
    tie.appendChild(anim('stroke-dashoffset', '200;0', '2.6s'));
    svg.appendChild(tie);
    svg.appendChild(txt(78, (hy + 39) / 2 + 20, 'weights', BP, 9, 'middle'));
    svg.appendChild(txt(78, (hy + 39) / 2 + 32, 'tied', BP, 9, 'middle'));
    // param tally on the right
    svg.appendChild(txt(440, 70, '124M total', INK, 11, 'middle'));
    svg.appendChild(txt(440, 88, '50257 × 768', SOFT, 9, 'middle'));
    svg.appendChild(txt(440, 102, '+ 1024 × 768', SOFT, 9, 'middle'));
    svg.appendChild(txt(440, 116, '+ 12 blocks', SOFT, 9, 'middle'));
    svg.appendChild(txt(440, 132, 'head free', BP, 9, 'middle'));
    svg.appendChild(txt(440, 146, '(tied)', BP, 9, 'middle'));
    card(host, 'GPT ASSEMBLY', 'embed · stack · tie',
      svg,
      'The whole 124M model is four pieces: a token table, a position table summed into it, twelve identical blocks lit in sequence, a final LayerNorm, and a language-model head. The head is not new weights; it reuses the token-embedding matrix transposed, which is why tying saves roughly 38M parameters at this scale and makes the count land exactly on the reference.');
  }

  // ── 37: weight remapping — pretrained names rewired into local names ────────
  function weightRemap(host) {
    var svg = svgEl('svg', { viewBox: '0 0 520 240' });
    var lx = 30, rx = 330, w = 168, rh = 34, gap = 10, y0 = 40;
    var src = ['wte', 'h.0.attn.c_attn', 'h.0.mlp.c_fc'];
    var dst = ['tok_embed', 'blocks.0.attn.qkv', 'blocks.0.mlp.fc1'];
    svg.appendChild(txt(lx + w / 2, 24, 'pretrained names', MUTE, 10));
    svg.appendChild(txt(rx + w / 2, 24, 'local model', BP, 10));
    var i;
    for (i = 0; i < src.length; i++) {
      var y = y0 + i * (rh + gap);
      svg.appendChild(svgEl('rect', { x: lx, y: y, width: w, height: rh, rx: 4, fill: BG, stroke: RULE, 'stroke-width': '1.4' }));
      svg.appendChild(txt(lx + w / 2, y + 21, src[i], SOFT, 10));
      svg.appendChild(svgEl('rect', { x: rx, y: y, width: w, height: rh, rx: 4, fill: BP, opacity: '0.1', stroke: BP, 'stroke-width': '1.6' }));
      svg.appendChild(txt(rx + w / 2, y + 21, dst[i], BP, 10));
      // a tensor packet that travels the mapper wire and only lands after a shape check
      var midY = y + rh / 2;
      var wire = svgEl('path', { d: 'M' + (lx + w) + ' ' + midY + ' H' + (lx + w + 60) + ' L' + (rx - 60) + ' ' + midY + ' H' + rx, fill: 'none', stroke: RULE, 'stroke-width': '1.2', 'stroke-dasharray': '4 4' });
      svg.appendChild(wire);
      var pkt = svgEl('rect', { x: lx + w, y: midY - 6, width: 14, height: 12, rx: 2, fill: i === 2 ? WARN : BP });
      pkt.appendChild(anim('x', (lx + w) + ';' + (rx - 14) + ';' + (rx - 14), '3s', { begin: (i * 0.5) + 's', keyTimes: '0;0.7;1' }));
      if (i === 2) pkt.appendChild(anim('opacity', '1;1;0.15', '3s', { begin: '1s', keyTimes: '0;0.7;1' }));
      svg.appendChild(pkt);
    }
    // shape-check gate in the middle
    svg.appendChild(svgEl('rect', { x: 248, y: y0, width: 24, height: 3 * (rh + gap) - gap, rx: 4, fill: SURF, stroke: MUTE, 'stroke-width': '1.4' }));
    svg.appendChild(txt(260, y0 - 6, 'shape', MUTE, 8));
    svg.appendChild(txt(260, y0 + (3 * (rh + gap) - gap) / 2, 'check', MUTE, 8, 'middle'));
    svg.appendChild(txt(rx + w / 2 + 16, y0 + 2 * (rh + gap) + 21, '✗ mismatch logged', WARN, 8, 'start'));
    card(host, 'WEIGHT REMAP', 'rename · shape-check · assign',
      svg,
      'A published checkpoint carries the original implementation\'s parameter names, not yours. The loader is a string-to-string mapper feeding a single shape check: matching tensors copy under no_grad into the local name, mismatches are logged and refused rather than copied blindly. Every assignment is recorded so a misload shows up in the report instead of as silent gibberish at generation time.');
  }

  // ── 39: SFT loss masking — instruction tokens get -100, only response scored ─
  function sftMasking(host) {
    var svg = svgEl('svg', { viewBox: '0 0 520 220' });
    var toks = ['<INST>', 'capital', 'of', 'France', '<RESP>', 'Paris', 'is', 'it'];
    var mask = [0, 0, 0, 0, 0, 1, 1, 1]; // 1 = response, scored
    var bw = 56, gap = 4, x0 = 24, y = 56;
    svg.appendChild(txt(x0, 38, 'one causal sequence', MUTE, 10, 'start'));
    var i;
    for (i = 0; i < toks.length; i++) {
      var x = x0 + i * (bw + gap);
      var scored = mask[i] === 1;
      svg.appendChild(svgEl('rect', { x: x, y: y, width: bw, height: 30, rx: 3, fill: scored ? BG : SURF, stroke: scored ? BP : MUTE, 'stroke-width': scored ? '1.8' : '1.2' }));
      svg.appendChild(txt(x + bw / 2, y + 20, toks[i], scored ? BP : MUTE, 9));
      // loss label below each token
      var ly = y + 56;
      if (scored) {
        svg.appendChild(txt(x + bw / 2, ly, 'CE', BP, 9));
      } else {
        svg.appendChild(txt(x + bw / 2, ly, '-100', MUTE, 9));
      }
    }
    // bracket marking the masked instruction region
    var instW = 5 * (bw + gap) - gap;
    svg.appendChild(svgEl('path', { d: 'M' + x0 + ' ' + (y - 8) + ' V' + (y - 14) + ' H' + (x0 + instW) + ' V' + (y - 8), fill: 'none', stroke: MUTE, 'stroke-width': '1.4' }));
    svg.appendChild(txt(x0 + instW / 2, y - 20, 'instruction · masked, zero gradient', MUTE, 9));
    var respX = x0 + 5 * (bw + gap);
    var respW = 3 * (bw + gap) - gap;
    svg.appendChild(svgEl('path', { d: 'M' + respX + ' ' + (y - 8) + ' V' + (y - 14) + ' H' + (respX + respW) + ' V' + (y - 8), fill: 'none', stroke: BP, 'stroke-width': '1.6' }));
    svg.appendChild(txt(respX + respW / 2, y - 20, 'response · scored', BP, 9));
    // gradient flowing only into the response region
    var gy = y + 78;
    var grad = svgEl('path', { d: 'M' + (respX + respW / 2) + ' ' + gy + ' V' + (gy + 24), fill: 'none', stroke: BP, 'stroke-width': '2', 'stroke-dasharray': '5 4' });
    grad.appendChild(anim('stroke-dashoffset', '0;18', '1s'));
    svg.appendChild(grad);
    svg.appendChild(svgEl('polygon', { points: (respX + respW / 2 - 4) + ',' + (gy + 24) + ' ' + (respX + respW / 2 + 4) + ',' + (gy + 24) + ' ' + (respX + respW / 2) + ',' + (gy + 32), fill: BP }));
    svg.appendChild(txt(respX + respW / 2, gy + 46, 'update', BP, 9));
    card(host, 'SFT LOSS MASK', 'instruction off · response scored',
      svg,
      'Instruction tuning packs each example into one sequence with boundary tokens, but the instruction is given, not learned. The collate function sets those positions to ignore_index -100 so cross-entropy skips them entirely. Only the tokens after the response boundary contribute loss, so the gradient teaches the model to produce the answer rather than to memorize the prompt.');
  }

  // ── 43: HDF5 buffer-then-extend — buffer fills, dataset resizes, range written ─
  function hdf5Buffer(host) {
    var svg = svgEl('svg', { viewBox: '0 0 520 230' });
    // incoming token stream on the left
    svg.appendChild(txt(60, 36, 'tokenized docs', MUTE, 10));
    var fy = 50;
    var b;
    for (b = 0; b < 4; b++) {
      var dot = svgEl('circle', { r: 4, fill: BP });
      dot.appendChild(svgEl('animateMotion', { dur: '2.4s', repeatCount: 'indefinite', path: 'M30 ' + (fy + 14) + ' H150', begin: (b * 0.6) + 's' }));
      svg.appendChild(dot);
    }
    // the in-memory buffer that fills to chunk size
    var bx = 156, by = 50, bw = 110, bh = 28;
    svg.appendChild(svgEl('rect', { x: bx, y: by, width: bw, height: bh, rx: 3, fill: 'none', stroke: MUTE, 'stroke-width': '1.6' }));
    svg.appendChild(txt(bx + bw / 2, by - 8, 'buffer (= chunk)', MUTE, 9));
    var fill = svgEl('rect', { x: bx + 1, y: by + 1, width: 0, height: bh - 2, rx: 2, fill: BP, opacity: '0.45' });
    fill.appendChild(anim('width', '0;' + (bw - 2) + ';' + (bw - 2) + ';0;0', '3.2s', { keyTimes: '0;0.5;0.6;0.62;1' }));
    svg.appendChild(fill);
    // flush arrow appears when full
    var flush = svgEl('path', { d: 'M' + (bx + bw) + ' ' + (by + bh / 2) + ' H' + (bx + bw + 40), fill: 'none', stroke: BP, 'stroke-width': '2', 'stroke-dasharray': '6 4' });
    flush.appendChild(anim('stroke-dashoffset', '20;0', '0.8s', { begin: '1.6s' }));
    flush.appendChild(anim('opacity', '0;0;1;1;0', '3.2s', { keyTimes: '0;0.48;0.52;0.9;1' }));
    svg.appendChild(flush);
    svg.appendChild(txt(bx + bw + 20, by - 8, 'flush', BP, 8));
    // the HDF5 dataset that resizes by one chunk each flush
    var hx = 320, hy = 46, ch = 36, chunks = 4, cyc;
    svg.appendChild(txt(hx + (chunks * (ch + 4)) / 2, hy - 12, 'HDF5 resizable dataset', SOFT, 9));
    for (cyc = 0; cyc < chunks; cyc++) {
      var cxp = hx + cyc * (ch + 4);
      var c = svgEl('rect', { x: cxp, y: hy, width: ch, height: 40, rx: 3, fill: BP, opacity: '0.12', stroke: BP, 'stroke-width': '1.4' });
      if (cyc === chunks - 1) {
        c.setAttribute('stroke-dasharray', '4 3');
        c.appendChild(anim('opacity', '0;0.12;0.5;0.5', '3.2s', { keyTimes: '0;0.55;0.7;1', fill: 'freeze' }));
      }
      svg.appendChild(c);
    }
    svg.appendChild(txt(hx + (chunks - 1) * (ch + 4) + ch / 2, hy + 58, 'new range', BP, 8));
    // mmap read marker at training time
    svg.appendChild(svgEl('rect', { x: hx, y: 150, width: chunks * (ch + 4) - 4, height: 26, rx: 3, fill: SURF, stroke: MUTE, 'stroke-width': '1.4' }));
    svg.appendChild(txt(hx + (chunks * (ch + 4)) / 2 - 2, 167, 'mmap slice → batch buffer', SOFT, 9));
    var rd = svgEl('rect', { x: hx, y: 151, width: 30, height: 24, rx: 2, fill: WARN, opacity: '0.4' });
    rd.appendChild(anim('x', hx + ';' + (hx + chunks * (ch + 4) - 34) + ';' + hx, '4s'));
    svg.appendChild(rd);
    card(host, 'HDF5 CORPUS', 'buffer · resize · mmap read',
      svg,
      'Writing one document at a time fragments the file; writing everything at once loses the shard on a crash. The honest discipline is buffer-then-extend: accumulate tokens until the buffer matches the chunk size, resize the dataset by exactly that chunk, and write the new range. At training time a memory-mapped slice copies a hyperslab straight from the page cache into the batch buffer.');
  }

  // ── 46: gradient accumulation — micro-batches pile grads, step on the last ──
  function gradAccum(host) {
    var svg = svgEl('svg', { viewBox: '0 0 520 230' });
    var n = 4, bw = 70, gap = 22, x0 = 36, y = 40;
    svg.appendChild(txt(260, 22, 'one effective batch = 4 micro-batches', MUTE, 10));
    // a gradient buffer bar that fills across the micro-batches
    var gy = 150, gx = x0, gw = n * (bw + gap) - gap;
    svg.appendChild(svgEl('rect', { x: gx, y: gy, width: gw, height: 24, rx: 3, fill: 'none', stroke: MUTE, 'stroke-width': '1.6' }));
    svg.appendChild(txt(gx, gy - 8, 'accumulated grad buffer', MUTE, 9, 'start'));
    var fill = svgEl('rect', { x: gx + 1, y: gy + 1, width: 0, height: 22, rx: 2, fill: BP, opacity: '0.4' });
    fill.appendChild(anim('width', '0;' + (gw / 4) + ';' + (gw / 2) + ';' + (3 * gw / 4) + ';' + (gw - 2) + ';0;0', '4s', { keyTimes: '0;0.2;0.4;0.6;0.85;0.9;1' }));
    svg.appendChild(fill);
    var i;
    for (i = 0; i < n; i++) {
      var x = x0 + i * (bw + gap);
      var last = i === n - 1;
      var g = svgEl('g', {});
      g.appendChild(svgEl('rect', { x: x, y: y, width: bw, height: 40, rx: 4, fill: BG, stroke: BP, 'stroke-width': '1.6' }));
      g.appendChild(txt(x + bw / 2, y + 18, 'micro ' + (i + 1), BP, 9));
      g.appendChild(txt(x + bw / 2, y + 32, 'loss / 4', SOFT, 8));
      g.appendChild(anim('opacity', '0.35;1;0.35', '4s', { begin: (i * 0.5) + 's', keyTimes: '0;0.5;1' }));
      svg.appendChild(g);
      // scaled-backward arrow down into the buffer
      var arr = svgEl('line', { x1: x + bw / 2, y1: y + 40, x2: x + bw / 2, y2: gy, stroke: last ? WARN : BP, 'stroke-width': '1.6', 'stroke-dasharray': '5 4' });
      arr.appendChild(anim('stroke-dashoffset', '0;18', '0.9s', { begin: (i * 0.5) + 's' }));
      svg.appendChild(arr);
      if (last) svg.appendChild(txt(x + bw / 2, y + 54, 'sync', WARN, 8));
    }
    // optimizer step fires once, after the buffer is full
    var sx = gx + gw + 18;
    var stepg = svgEl('g', {});
    stepg.appendChild(svgEl('rect', { x: sx, y: gy - 4, width: 86, height: 32, rx: 5, fill: WARN, opacity: '0.16', stroke: WARN, 'stroke-width': '2' }));
    stepg.appendChild(txt(sx + 43, gy + 16, 'optimizer step', WARN, 9));
    stepg.appendChild(anim('opacity', '0.15;0.15;1;0.15', '4s', { keyTimes: '0;0.82;0.88;1' }));
    svg.appendChild(stepg);
    svg.appendChild(txt(sx + 43, gy + 44, 'once per', MUTE, 8));
    svg.appendChild(txt(sx + 43, gy + 56, 'effective batch', MUTE, 8));
    card(host, 'GRADIENT ACCUMULATION', 'pile grads · step on last',
      svg,
      'When the accelerator holds 32 examples but the loss curve wants 512, run the backward pass micro-batch by micro-batch and let the gradients sum inside the parameter buffers. Each loss is divided by the accumulation count so the running sum matches a single full-batch backward, and the optimizer steps exactly once when the buffer is full, with synchronization deferred to the last micro-batch.');
  }

  // ── 47: atomic checkpoint — write temp, fsync, rename over the good file ────
  function atomicCheckpoint(host) {
    var svg = svgEl('svg', { viewBox: '0 0 520 240' });
    // payload buckets gathering into one file on the left
    var px = 30, py = 36, bw = 116, bh = 18, gap = 5;
    var parts = ['model', 'optimizer', 'scheduler', 'step + losses', 'RNG state'];
    svg.appendChild(txt(px + bw / 2, py - 10, 'checkpoint payload', MUTE, 9));
    var i;
    for (i = 0; i < parts.length; i++) {
      var yy = py + i * (bh + gap);
      var r = svgEl('rect', { x: px, y: yy, width: bw, height: bh, rx: 2, fill: BP, opacity: '0.12', stroke: BP, 'stroke-width': '1' });
      r.appendChild(anim('opacity', '0.12;0.6;0.12', '3.5s', { begin: (i * 0.2) + 's' }));
      svg.appendChild(r);
      svg.appendChild(txt(px + bw / 2, yy + 13, parts[i], SOFT, 8));
    }
    // flow into a temp file
    var tx = 220, ty = 70;
    var flow = svgEl('path', { d: 'M' + (px + bw) + ' ' + (py + 50) + ' H' + tx, fill: 'none', stroke: BP, 'stroke-width': '2', 'stroke-dasharray': '6 5' });
    flow.appendChild(anim('stroke-dashoffset', '22;0', '1s'));
    svg.appendChild(flow);
    svg.appendChild(svgEl('rect', { x: tx, y: ty, width: 96, height: 46, rx: 5, fill: 'none', stroke: MUTE, 'stroke-width': '1.6', 'stroke-dasharray': '4 4' }));
    svg.appendChild(txt(tx + 48, ty + 20, 'ckpt.tmp', MUTE, 10));
    svg.appendChild(txt(tx + 48, ty + 36, 'write + fsync', MUTE, 8));
    // the atomic rename arc onto the final filename
    var fx = 400, fy = 70;
    var ren = svgEl('path', { d: 'M' + (tx + 96) + ' ' + (ty + 23) + ' C ' + (fx - 20) + ' ' + (ty + 23) + ', ' + (fx - 20) + ' ' + (fy + 23) + ', ' + fx + ' ' + (fy + 23), fill: 'none', stroke: BP, 'stroke-width': '2', 'stroke-dasharray': '7 5' });
    ren.appendChild(anim('stroke-dashoffset', '40;0', '1.4s', { begin: '1s' }));
    svg.appendChild(ren);
    svg.appendChild(txt((tx + fx) / 2 + 48, ty + 6, 'os.replace', BP, 9, 'middle'));
    svg.appendChild(txt((tx + fx) / 2 + 48, ty - 8, 'atomic', BP, 8, 'middle'));
    var fin = svgEl('g', {});
    fin.appendChild(svgEl('rect', { x: fx, y: fy, width: 96, height: 46, rx: 5, fill: BP, opacity: '0.14', stroke: BP, 'stroke-width': '2.2' }));
    fin.appendChild(txt(fx + 48, fy + 20, 'ckpt.pt', BP, 10));
    fin.appendChild(txt(fx + 48, fy + 36, 'always valid', SOFT, 8));
    fin.appendChild(anim('opacity', '0.2;0.2;1;1', '2.4s', { keyTimes: '0;0.55;0.75;1', fill: 'freeze' }));
    svg.appendChild(fin);
    // a crash bolt that strikes the temp file but never the final one
    var bolt = svgEl('g', {});
    bolt.appendChild(svgEl('polygon', { points: (tx + 48) + ',150 ' + (tx + 40) + ',172 ' + (tx + 52) + ',172 ' + (tx + 44) + ',192', fill: 'none', stroke: WARN, 'stroke-width': '2' }));
    bolt.appendChild(txt(tx + 48, 206, 'crash here?', WARN, 8));
    bolt.appendChild(txt(tx + 48, 218, 'old file safe', WARN, 8));
    bolt.appendChild(anim('opacity', '0;1;0', '2.4s'));
    svg.appendChild(bolt);
    card(host, 'ATOMIC CHECKPOINT', 'write temp · rename over',
      svg,
      'A resume needs the entire training state, model, optimizer, scheduler, step counters, and the RNG state for every randomness source, or the post-resume loss curve diverges from the uninterrupted one. The save writes into a temporary file, fsyncs, then renames over the final name. Because POSIX rename is atomic, a crash mid-write leaves the previous good checkpoint untouched rather than a half-written corpse.');
  }

  LF.register({
    'cc-embedding-lookup': embeddingLookup,
    'cc-transformer-block': transformerBlock,
    'cc-gpt-assembly': gptAssembly,
    'cc-weight-remap': weightRemap,
    'cc-sft-loss-mask': sftMasking,
    'cc-hdf5-corpus': hdf5Buffer,
    'cc-grad-accumulation': gradAccum,
    'cc-atomic-checkpoint': atomicCheckpoint
  });
})();
