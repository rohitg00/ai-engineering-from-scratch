/* figures-re-44.js - lesson 44: function matches between two builds and the path tree of grade.
   DATA is the output of python3 code/main.py figure-data in the lesson folder.
   Every match, stage, displacement, path condition, and solved input below comes from the
   differ and the symbolic executor in that lesson, run over the committed ledger objects.
   The test suite checks that this copy matches. */
(function () {
  'use strict';

  var LF = window.LF;
  if (!LF) return;

  var el = LF.el;
  var svgEl = LF.svgEl;
  var INK = 'var(--ink,#1a1a1a)';
  var MUTE = 'var(--ink-mute,#7a7a78)';
  var BP = 'var(--blueprint,#3553ff)';
  var SURF = 'var(--bg-surface,#f3f1e8)';
  var RULE = 'var(--rule-soft,rgba(26,26,26,0.16))';
  var WARN = 'var(--warn,#b8870f)';
  var BG = 'var(--bg,#fafaf5)';
  var MONO = 'var(--font-mono,monospace)';

  var DATA = {"stages":[{"id":"exact-bytes","label":"exact function bytes","quality":"very good","ghidra":"Exact Function Bytes Match"},{"id":"masked-bytes","label":"bytes with relocation fields masked","quality":"very good","ghidra":"Exact Function Instructions Match"},{"id":"mnemonics","label":"mnemonic sequence","quality":"good","ghidra":"Exact Function Mnemonics Match"},{"id":"cfg-shape","label":"flow-graph shape","quality":"medium","ghidra":"none"},{"id":"name","label":"symbol name","quality":"very good","ghidra":"Exact Symbol Name Match"}],"left":{"object":"ledger-x86_64-O1.o","functions":[{"name":"percent_change","start":0,"size":16,"insns":9,"blocks":3,"edges":2},{"name":"grade","start":16,"size":46,"insns":14,"blocks":3,"edges":3},{"name":"total","start":64,"size":31,"insns":13,"blocks":5,"edges":5},{"name":"grade_label","start":96,"size":63,"insns":18,"blocks":4,"edges":4}]},"right":{"object":"ledger-x86_64-O2.o","functions":[{"name":"percent_change","start":0,"size":16,"insns":9,"blocks":3,"edges":2},{"name":"grade","start":16,"size":46,"insns":14,"blocks":3,"edges":3},{"name":"total","start":64,"size":140,"insns":41,"blocks":10,"edges":13},{"name":"grade_label","start":208,"size":63,"insns":18,"blocks":4,"edges":4}]},"views":{"object":{"matches":[{"left":"percent_change","right":"percent_change","stage":"exact-bytes","agreeing":["exact-bytes","masked-bytes","mnemonics","cfg-shape","name"],"similarity":1.0},{"left":"grade","right":"grade","stage":"exact-bytes","agreeing":["exact-bytes","masked-bytes","mnemonics","cfg-shape","name"],"similarity":1.0},{"left":"total","right":"total","stage":"name","agreeing":["name"],"similarity":0.171},{"left":"grade_label","right":"grade_label","stage":"exact-bytes","agreeing":["exact-bytes","masked-bytes","mnemonics","cfg-shape","name"],"similarity":1.0}],"unmatchedLeft":[],"unmatchedRight":[]},"image":{"matches":[{"left":"percent_change","right":"percent_change","stage":"exact-bytes","agreeing":["exact-bytes","masked-bytes","mnemonics","cfg-shape","name"],"similarity":1.0},{"left":"grade","right":"grade","stage":"masked-bytes","agreeing":["masked-bytes","mnemonics","cfg-shape","name"],"similarity":0.978},{"left":"total","right":"total","stage":"name","agreeing":["name"],"similarity":0.171},{"left":"grade_label","right":"grade_label","stage":"exact-bytes","agreeing":["exact-bytes","masked-bytes","mnemonics","cfg-shape","name"],"similarity":1.0}],"unmatchedLeft":[],"unmatchedRight":[]}},"relocation":{"shift":112,"displacements":{"ledger-x86_64-O1.o":122,"ledger-x86_64-O2.o":234},"field":54},"tree":{"function":"grade","object":"ledger-x86_64-O0.o","entry":"0x30","domain":[-200,1200],"labels":{"0x30":["local_10 = score / 10 - 6"],"0x62":["switch local_10"],"0x76":["local_4 = 4"],"0x7f":["local_4 = 3"],"0x88":["local_4 = 2"],"0x91":["local_4 = 1"],"0x9a":["local_4 = 0"],"0xa1":["return local_4"]},"edges":[{"from":"0x30","to":"0x9a","cond":"local_10 >u 4"},{"from":"0x30","to":"0x62","cond":"!(local_10 >u 4)"},{"from":"0x62","to":"0x91","cond":"local_10 == 0"},{"from":"0x62","to":"0x88","cond":"local_10 == 1"},{"from":"0x62","to":"0x7f","cond":"local_10 == 2"},{"from":"0x62","to":"0x76","cond":"local_10 == 3 || local_10 == 4"},{"from":"0x76","to":"0xa1","cond":""},{"from":"0x7f","to":"0xa1","cond":""},{"from":"0x88","to":"0xa1","cond":""},{"from":"0x91","to":"0xa1","cond":""},{"from":"0x9a","to":"0xa1","cond":""}],"leaves":[{"leaf":"0xa1","case":"0x76","returns":4,"condition":"!(score / 10 - 6 >u 4) && (score / 10 - 6 == 3 || score / 10 - 6 == 4)","trace":["0x30","0x62","0x76","0xa1"],"bounded":{"count":20,"min":90,"max":109,"sample":90},"angr":{"min":90,"max":109},"z3":{"min":90,"max":109}},{"leaf":"0xa1","case":"0x7f","returns":3,"condition":"!(score / 10 - 6 >u 4) && score / 10 - 6 == 2","trace":["0x30","0x62","0x7f","0xa1"],"bounded":{"count":10,"min":80,"max":89,"sample":80},"angr":{"min":80,"max":89},"z3":{"min":80,"max":89}},{"leaf":"0xa1","case":"0x88","returns":2,"condition":"!(score / 10 - 6 >u 4) && score / 10 - 6 == 1","trace":["0x30","0x62","0x88","0xa1"],"bounded":{"count":10,"min":70,"max":79,"sample":70},"angr":{"min":70,"max":79},"z3":{"min":70,"max":79}},{"leaf":"0xa1","case":"0x91","returns":1,"condition":"!(score / 10 - 6 >u 4) && score / 10 - 6 == 0","trace":["0x30","0x62","0x91","0xa1"],"bounded":{"count":10,"min":60,"max":69,"sample":60},"angr":{"min":60,"max":69},"z3":{"min":60,"max":69}},{"leaf":"0xa1","case":"0x9a","returns":0,"condition":"score / 10 - 6 >u 4","trace":["0x30","0x9a","0xa1"],"bounded":{"count":1351,"min":-200,"max":1200,"sample":-200},"angr":{"min":-2147483648,"max":2147483647},"z3":{"min":-2147483648,"max":2147483647}}],"pathCount":5}};

  var STYLES = {
    'exact-bytes': { stroke: BP, width: '2.2', dash: 'none', short: 'exact bytes' },
    'masked-bytes': { stroke: WARN, width: '2.2', dash: 'none', short: 'masked bytes' },
    'mnemonics': { stroke: INK, width: '1.6', dash: '6 3', short: 'mnemonics' },
    'cfg-shape': { stroke: MUTE, width: '1.6', dash: '3 3', short: 'cfg shape' },
    'name': { stroke: MUTE, width: '1.2', dash: '1.5 3', short: 'name only' }
  };

  var VIEWS = [
    { id: 'object', label: 'object files', note: 'relocation fields hold zero, so exact and masked bytes agree' },
    { id: 'image', label: 'loaded images', note: 'relocations applied at 0x100000, .rodata moves by 0x' + DATA.relocation.shift.toString(16) }
  ];

  var W = 560;
  var COL_W = 168;
  var LEFT_X = 24;
  var RIGHT_X = W - 24 - COL_W;
  var BOX_H = 40;
  var PITCH = 50;
  var COLS_Y = 34;
  var TREE_Y = COLS_Y + 4 * PITCH + 34;
  var LEVEL_PITCH = 78;
  var NODE_W = 96;
  var NODE_H = 34;
  var LEAF_H = 58;

  function ensureStyles() {
    if (document.getElementById('re44-styles')) return;
    var style = document.createElement('style');
    style.id = 're44-styles';
    style.textContent = [
      '.re44 *{box-sizing:border-box}',
      '.re44__note{margin:0 0 12px!important;color:var(--ink-soft,#555)!important;font-family:var(--font-body,serif)!important;font-size:.96rem!important;line-height:1.55!important;text-align:left!important}',
      '.re44__controls{display:grid;gap:10px;margin-bottom:12px}',
      '.re44__group-label{font-family:var(--font-mono,monospace);font-size:.72rem;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-mute,#777);margin-bottom:6px}',
      '.re44__row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}',
      '.re44 button{min-height:40px;padding:8px 12px;border:1px solid var(--rule-soft,#ddd);background:var(--bg,#fafaf5);color:var(--ink,#1a1a1a);font-family:var(--font-mono,monospace);font-size:.76rem;line-height:1.35;cursor:pointer;transition:transform 150ms cubic-bezier(.23,1,.32,1),border-color 180ms ease,background-color 180ms ease}',
      '.re44 button:active{transform:scale(.96)}',
      '.re44 button:focus-visible{outline:2px solid var(--blueprint,#3553ff);outline-offset:2px}',
      '.re44 button[aria-pressed="true"]{border-color:var(--blueprint,#3553ff);background:var(--blueprint,#3553ff);color:var(--bg,#fafaf5)}',
      '.re44__legend{display:flex;flex-wrap:wrap;gap:6px 14px;font-family:var(--font-mono,monospace);font-size:.72rem;color:var(--ink-soft,#555)}',
      '.re44__legend span{display:inline-flex;align-items:center;gap:6px}',
      '.re44__legend svg{width:28px;height:8px;display:block}',
      '.re44__scroll{overflow-x:auto;-webkit-overflow-scrolling:touch;border:1px solid var(--rule-soft,#ddd);background:var(--bg,#fafaf5)}',
      '.re44__scroll svg{display:block;min-width:520px;width:100%;height:auto}',
      '.re44 .re44__pick{cursor:pointer}',
      '.re44 .re44__pick:focus{outline:none}',
      '.re44__detail{margin-top:10px;padding:10px 12px;border:1px solid var(--blueprint,#3553ff);font-family:var(--font-mono,monospace);font-size:.78rem;line-height:1.55;color:var(--ink,#1a1a1a);background:var(--blueprint-tint,rgba(53,83,255,.08));white-space:pre-wrap;word-break:break-word}',
      '.re44__detail[data-tone="warn"]{border-color:var(--warn,#b8870f)}',
      '@media (hover:hover) and (pointer:fine){.re44 button:hover{border-color:var(--blueprint,#3553ff)}}',
      '@media (max-width:640px){.re44 button{font-size:.78rem}}',
      '@media (prefers-reduced-motion:reduce){.re44 button{transition:none!important}.re44 button:active{transform:none!important}}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function text(x, y, s, fill, anchor, size, weight) {
    var attrs = { x: x, y: y, 'text-anchor': anchor || 'start', 'font-family': MONO, 'font-size': String(size || 11.5), fill: fill || INK };
    if (weight) attrs['font-weight'] = weight;
    return svgEl('text', attrs, [document.createTextNode(s)]);
  }

  function byName(list) {
    var out = {};
    var i;
    for (i = 0; i < list.length; i++) out[list[i].name] = i;
    return out;
  }

  var LEFT_INDEX = byName(DATA.left.functions);
  var RIGHT_INDEX = byName(DATA.right.functions);

  function boxY(index) { return COLS_Y + index * PITCH; }

  function functionLines(fn) {
    return [fn.name, fn.size + ' B, ' + fn.insns + ' insn, ' + fn.blocks + 'b/' + fn.edges + 'e'];
  }

  function matchFor(view, side, name) {
    var matches = DATA.views[view].matches;
    var i;
    for (i = 0; i < matches.length; i++) {
      if ((side === 'left' && matches[i].left === name) || (side === 'right' && matches[i].right === name)) return matches[i];
    }
    return null;
  }

  function drawColumns(svg, state, onPick) {
    var view = state.view;
    svg.appendChild(text(LEFT_X, COLS_Y - 12, DATA.left.object, MUTE, 'start', 11));
    svg.appendChild(text(RIGHT_X + COL_W, COLS_Y - 12, DATA.right.object, MUTE, 'end', 11));
    var i;
    for (i = 0; i < DATA.views[view].matches.length; i++) {
      var match = DATA.views[view].matches[i];
      var li = LEFT_INDEX[match.left];
      var ri = RIGHT_INDEX[match.right];
      var style = STYLES[match.stage];
      var y1 = boxY(li) + BOX_H / 2;
      var y2 = boxY(ri) + BOX_H / 2;
      var x1 = LEFT_X + COL_W;
      var x2 = RIGHT_X;
      var mid = (x1 + x2) / 2;
      var selected = state.pick && state.pick.kind === 'match' && state.pick.left === match.left;
      var attrs = {
        d: 'M' + x1 + ' ' + y1 + ' C' + mid + ' ' + y1 + ' ' + mid + ' ' + y2 + ' ' + x2 + ' ' + y2,
        fill: 'none', stroke: style.stroke, 'stroke-width': selected ? String(parseFloat(style.width) + 1.2) : style.width,
        'class': 're44__pick', tabindex: '0', role: 'button'
      };
      if (style.dash !== 'none') attrs['stroke-dasharray'] = style.dash;
      var path = svgEl('path', attrs);
      path.appendChild(svgEl('title', {}, [document.createTextNode(match.left + ' to ' + match.right + ': ' + style.short)]));
      (function (m) {
        path.addEventListener('click', function () { onPick({ kind: 'match', left: m.left }); });
        path.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); onPick({ kind: 'match', left: m.left }); } });
      })(match);
      svg.appendChild(path);
      var labelY = (y1 + y2) / 2 - 5;
      svg.appendChild(svgEl('rect', { x: mid - 38, y: labelY - 10, width: 76, height: 14, fill: BG, opacity: '0.9' }));
      svg.appendChild(text(mid, labelY + 1, style.short, style.stroke, 'middle', 10));
    }
    drawColumn(svg, state, 'left', DATA.left.functions, LEFT_X, onPick);
    drawColumn(svg, state, 'right', DATA.right.functions, RIGHT_X, onPick);
  }

  function drawColumn(svg, state, side, functions, x, onPick) {
    var i;
    for (i = 0; i < functions.length; i++) {
      var fn = functions[i];
      var match = matchFor(state.view, side, fn.name);
      var y = boxY(i);
      var stroke = match ? STYLES[match.stage].stroke : RULE;
      var selected = state.pick && ((state.pick.kind === 'function' && state.pick.side === side && state.pick.name === fn.name) || (state.pick.kind === 'match' && match && match.left === state.pick.left));
      var g = svgEl('g', { 'class': 're44__pick', tabindex: '0', role: 'button' });
      g.appendChild(svgEl('title', {}, [document.createTextNode(fn.name + ' in ' + (side === 'left' ? DATA.left.object : DATA.right.object))]));
      g.appendChild(svgEl('rect', {
        x: x, y: y, width: COL_W, height: BOX_H, rx: 3, fill: SURF, stroke: stroke,
        'stroke-width': selected ? '2.4' : '1.4', 'stroke-dasharray': match ? 'none' : '4 3'
      }));
      var lines = functionLines(fn);
      g.appendChild(text(x + 8, y + 16, lines[0], INK, 'start', 12, '600'));
      g.appendChild(text(x + 8, y + 31, lines[1], MUTE, 'start', 10.5));
      (function (f, s) {
        g.addEventListener('click', function () { onPick({ kind: 'function', side: s, name: f.name }); });
        g.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); onPick({ kind: 'function', side: s, name: f.name }); } });
      })(fn, side);
      svg.appendChild(g);
    }
  }

  function treeChildren(id) {
    var out = [];
    var i;
    for (i = 0; i < DATA.tree.edges.length; i++) {
      var e = DATA.tree.edges[i];
      if (e.from === id && e.cond !== '') out.push(e);
    }
    return out;
  }

  function leafRecord(id) {
    var i;
    for (i = 0; i < DATA.tree.leaves.length; i++) if (DATA.tree.leaves[i]['case'] === id) return DATA.tree.leaves[i];
    return null;
  }

  function layoutTree() {
    var positions = {};
    var leaves = [];
    function walk(id, depth) {
      var kids = treeChildren(id);
      if (!kids.length) { leaves.push(id); positions[id] = { depth: depth, slot: leaves.length - 1 }; return; }
      var i;
      var first = null;
      var last = null;
      for (i = 0; i < kids.length; i++) {
        walk(kids[i].to, depth + 1);
        if (first === null) first = positions[kids[i].to].slot;
        last = positions[kids[i].to].slot;
      }
      positions[id] = { depth: depth, slot: (first + last) / 2 };
    }
    walk(DATA.tree.entry, 0);
    var slotW = (W - 32) / leaves.length;
    var id;
    var maxDepth = 0;
    for (id in positions) {
      if (!Object.prototype.hasOwnProperty.call(positions, id)) continue;
      positions[id].x = 16 + slotW * (positions[id].slot + 0.5);
      positions[id].y = TREE_Y + 22 + positions[id].depth * LEVEL_PITCH;
      positions[id].leaf = leaves.indexOf(id) >= 0;
      if (positions[id].depth > maxDepth) maxDepth = positions[id].depth;
    }
    return { positions: positions, leaves: leaves, height: TREE_Y + 22 + maxDepth * LEVEL_PITCH + LEAF_H + 16 };
  }

  var TREE = layoutTree();

  function rangeText(leaf) {
    if (!leaf.bounded) return 'no input in the bound';
    if (leaf.bounded.min === DATA.tree.domain[0] && leaf.bounded.max === DATA.tree.domain[1]) return leaf.bounded.count + ' inputs across the bound';
    return 'score ' + leaf.bounded.min + '..' + leaf.bounded.max + ' (' + leaf.bounded.count + ')';
  }

  function drawTree(svg, state, onPick) {
    svg.appendChild(text(16, TREE_Y + 2, 'path tree of ' + DATA.tree.function + ' in ' + DATA.tree.object + ', ' + DATA.tree.pathCount + ' paths, score searched in ' + DATA.tree.domain[0] + '..' + DATA.tree.domain[1], MUTE, 'start', 11));
    var i;
    for (i = 0; i < DATA.tree.edges.length; i++) {
      var e = DATA.tree.edges[i];
      if (e.cond === '') continue;
      var from = TREE.positions[e.from];
      var to = TREE.positions[e.to];
      if (!from || !to) continue;
      var x1 = from.x;
      var y1 = from.y + NODE_H / 2;
      var x2 = to.x;
      var y2 = to.y - (to.leaf ? LEAF_H : NODE_H) / 2;
      var midY = (y1 + y2) / 2;
      svg.appendChild(svgEl('path', { d: 'M' + x1 + ' ' + y1 + ' C' + x1 + ' ' + midY + ' ' + x2 + ' ' + midY + ' ' + x2 + ' ' + y2, fill: 'none', stroke: BP, 'stroke-width': '1.4' }));
      var label = e.cond.length > 24 ? e.cond.replace(/local_10/g, 'q') : e.cond;
      var lx = (x1 + x2) / 2;
      svg.appendChild(svgEl('rect', { x: lx - label.length * 3.1, y: midY - 9, width: label.length * 6.2, height: 13, fill: BG, opacity: '0.92' }));
      svg.appendChild(text(lx, midY + 1, label, INK, 'middle', 9.8));
    }
    var id;
    for (id in TREE.positions) {
      if (!Object.prototype.hasOwnProperty.call(TREE.positions, id)) continue;
      var p = TREE.positions[id];
      var labels = DATA.tree.labels[id] || [];
      var leaf = p.leaf ? leafRecord(id) : null;
      var h = p.leaf ? LEAF_H : NODE_H;
      var selected = state.pick && state.pick.kind === 'leaf' && state.pick.id === id;
      var g = svgEl('g', p.leaf ? { 'class': 're44__pick', tabindex: '0', role: 'button' } : {});
      g.appendChild(svgEl('rect', { x: p.x - NODE_W / 2, y: p.y - h / 2, width: NODE_W, height: h, rx: 3, fill: p.leaf ? SURF : BG, stroke: p.leaf ? BP : RULE, 'stroke-width': selected ? '2.4' : '1.3' }));
      g.appendChild(text(p.x, p.y - h / 2 + 13, id, p.leaf ? BP : MUTE, 'middle', 10.5));
      if (labels.length) g.appendChild(text(p.x, p.y - h / 2 + 26, labels[0].replace('local_10', 'q').replace('local_4', 'r'), INK, 'middle', 10));
      if (leaf) {
        g.appendChild(text(p.x, p.y - h / 2 + 40, 'returns ' + leaf.returns, INK, 'middle', 10, '600'));
        g.appendChild(text(p.x, p.y - h / 2 + 52, rangeText(leaf), MUTE, 'middle', 9.2));
        g.appendChild(svgEl('title', {}, [document.createTextNode('leaf ' + id + ': ' + leaf.condition)]));
        (function (leafId) {
          g.addEventListener('click', function () { onPick({ kind: 'leaf', id: leafId }); });
          g.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); onPick({ kind: 'leaf', id: leafId }); } });
        })(id);
      }
      svg.appendChild(g);
    }
  }

  function stageLabel(id) { return STYLES[id] ? STYLES[id].short : id; }

  function detailText(state) {
    var view = DATA.views[state.view];
    var pick = state.pick;
    if (!pick) {
      var counts = {};
      var i;
      for (i = 0; i < view.matches.length; i++) counts[view.matches[i].stage] = (counts[view.matches[i].stage] || 0) + 1;
      var parts = [];
      var k;
      for (k in STYLES) if (counts[k]) parts.push(counts[k] + ' by ' + stageLabel(k));
      return VIEWS[viewIndex(state.view)].label + ': ' + view.matches.length + ' of ' + DATA.left.functions.length + ' functions matched (' + parts.join(', ') + '). Click a line, a box, or a leaf.';
    }
    if (pick.kind === 'match' || pick.kind === 'function') {
      var match = pick.kind === 'match' ? matchFor(state.view, 'left', pick.left) : matchFor(state.view, pick.side, pick.name);
      if (!match) return pick.name + ' has no match in this view.';
      var lines = [match.left + ' (' + DATA.left.object + ') matched ' + match.right + ' (' + DATA.right.object + ')'];
      lines.push('stage: ' + stageLabel(match.stage) + '; signatures that agree: ' + match.agreeing.map(stageLabel).join(', '));
      lines.push('similarity 1 - levenshtein / max(len) = ' + match.similarity.toFixed(3));
      if (match.left === 'grade' && state.view === 'image') {
        lines.push('the leaq displacement at offset 0x' + DATA.relocation.field.toString(16) + ' is ' + DATA.relocation.displacements[DATA.left.object] + ' in the first image and ' + DATA.relocation.displacements[DATA.right.object] + ' in the second, a difference of 0x' + DATA.relocation.shift.toString(16) + ', so exact bytes fail and masked bytes pass');
      }
      if (match.left === 'total') lines.push('total grew from ' + DATA.left.functions[LEFT_INDEX.total].size + ' to ' + DATA.right.functions[RIGHT_INDEX.total].size + ' bytes at -O2; only the symbol name links the two');
      return lines.join('\n');
    }
    var leaf = leafRecord(pick.id);
    if (!leaf) return '';
    var out = ['leaf ' + pick.id + ' returns ' + leaf.returns];
    out.push('path: ' + leaf.trace.join(' > '));
    out.push('condition: ' + leaf.condition);
    if (leaf.bounded) out.push('bounded search in ' + DATA.tree.domain[0] + '..' + DATA.tree.domain[1] + ': ' + leaf.bounded.count + ' inputs, min ' + leaf.bounded.min + ', max ' + leaf.bounded.max + ', sample ' + leaf.bounded.sample);
    if (leaf.angr) out.push('angr 10.0.3 on the same object: min ' + leaf.angr.min + ', max ' + leaf.angr.max);
    if (leaf.z3) out.push('z3 5.1.0 model of the listing: min ' + leaf.z3.min + ', max ' + leaf.z3.max);
    return out.join('\n');
  }

  function viewIndex(id) {
    var i;
    for (i = 0; i < VIEWS.length; i++) if (VIEWS[i].id === id) return i;
    return 0;
  }

  function legend() {
    var row = el('div', { 'class': 're44__legend' });
    var k;
    for (k in STYLES) {
      if (!Object.prototype.hasOwnProperty.call(STYLES, k)) continue;
      var sample = svgEl('svg', { viewBox: '0 0 28 8', 'aria-hidden': 'true' });
      var attrs = { x1: 1, y1: 4, x2: 27, y2: 4, stroke: STYLES[k].stroke, 'stroke-width': STYLES[k].width };
      if (STYLES[k].dash !== 'none') attrs['stroke-dasharray'] = STYLES[k].dash;
      sample.appendChild(svgEl('line', attrs));
      row.appendChild(el('span', {}, [sample, STYLES[k].short]));
    }
    return row;
  }

  function matchesAndPaths(host) {
    ensureStyles();
    var state = { view: 'object', pick: null };
    var titleId = LF.uid('lf-re44-title');
    var descId = LF.uid('lf-re44-desc');
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + TREE.height, role: 'img', 'aria-labelledby': titleId + ' ' + descId });
    var detail = el('div', { 'class': 're44__detail', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' });
    var viewButtons = [];

    function pick(p) {
      state.pick = (state.pick && JSON.stringify(state.pick) === JSON.stringify(p)) ? null : p;
      render();
    }

    function render() {
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      svg.appendChild(svgEl('title', { id: titleId }, [document.createTextNode('Function matches between the -O1 and -O2 builds of ledger.c and the path tree of grade at -O0')]));
      svg.appendChild(svgEl('desc', { id: descId }, [document.createTextNode(detailText({ view: state.view, pick: null }))]));
      drawColumns(svg, state, pick);
      svg.appendChild(svgEl('line', { x1: 16, y1: TREE_Y - 16, x2: W - 16, y2: TREE_Y - 16, stroke: RULE, 'stroke-width': '1' }));
      drawTree(svg, state, pick);
      var i;
      for (i = 0; i < viewButtons.length; i++) viewButtons[i].button.setAttribute('aria-pressed', viewButtons[i].id === state.view ? 'true' : 'false');
      detail.textContent = detailText(state);
      var grade = matchFor(state.view, 'left', 'grade');
      detail.setAttribute('data-tone', grade && grade.stage !== 'exact-bytes' ? 'warn' : 'pass');
    }

    var viewRow = el('div', { 'class': 're44__row', role: 'group', 'aria-label': 'What the differ compared' });
    VIEWS.forEach(function (view) {
      var button = el('button', { type: 'button', 'aria-pressed': 'false', title: view.note }, [view.label]);
      button.addEventListener('click', function () { state.view = view.id; state.pick = null; render(); });
      viewButtons.push({ id: view.id, button: button });
      viewRow.appendChild(button);
    });

    var controls = el('div', { 'class': 're44__controls' }, [
      el('div', {}, [el('div', { 'class': 're44__group-label' }, ['compared bytes']), viewRow]),
      el('div', {}, [el('div', { 'class': 're44__group-label' }, ['match line by signature']), legend()])
    ]);

    host.appendChild(el('div', { 'class': 'lf re44' }, [
      el('div', { 'class': 'lf-head' }, [el('span', { 'class': 'lf-label' }, ['MATCHES AND PATHS']), el('span', {}, ['ledger.c at -O1 and -O2, grade at -O0'])]),
      el('div', { 'class': 'lf-body' }, [
        el('p', { 'class': 're44__note' }, ['The upper panel lists the four functions of the -O1 build on the left and the -O2 build on the right. A line joins two functions the matcher paired, drawn in the style of the first signature that agreed. Switch to loaded images to see the grade line change from exact bytes to masked bytes. The lower panel is the path tree the symbolic executor enumerated for grade at -O0, with the inputs the bounded search found for each leaf.']),
        controls,
        el('div', { 'class': 're44__scroll' }, [svg]),
        detail
      ]),
      el('div', { 'class': 'lf-cap' }, ['Solid blue lines are exact byte matches, amber lines are matches that needed the relocation fields masked, dashed lines are mnemonic or flow-graph shape matches, dotted lines are matches by symbol name only. Dashed boxes are functions without a match in the current view. In the tree, q is score / 10 - 6 and r is the returned value; every leaf ends in the shared return block 0xa1.'])
    ]));
    render();
  }

  LF.register({ 're-44-matches-and-paths': matchesAndPaths });
})();
