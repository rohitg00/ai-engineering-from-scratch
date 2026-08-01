/* figures-setup.js: animated lesson figures for Phase 00 (Setup and Tooling),
   dev environments, git, GPUs, keys, notebooks, envs, docker, editors, data,
   shell, linux, profiling. Loads after lesson-figures.js and registers through
   window.LF.register. Vanilla ES5, no deps, theme via CSS vars. Animation is
   SMIL only (animate / animateMotion / animateTransform). Authoring is the
   same fenced block:
       ```figure
       s0-commit-dag
       ``` */
(function () {
  'use strict';
  var LF = window.LF;
  if (!LF) { return; }
  var el = LF.el, svgEl = LF.svgEl;

  var BP = 'var(--blueprint,#3553ff)';
  var SOFT = 'var(--rule-soft,#ddd)';
  var MUTE = 'var(--ink-mute,#777)';
  var INKS = 'var(--ink-soft,#555)';
  var WARN = 'var(--warn,#b8870f)';
  var INK = 'var(--ink,#1a1a1a)';
  var BG = 'var(--bg,#fafaf5)';
  var SURF = 'var(--bg-surface,#eee)';
  var EASE = '0.23 1 0.32 1';

  function shell(host, label, sub, svg, cap) {
    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, [label]), el('span', {}, [sub])]),
      el('div', { class: 'lf-body' }, [el('div', { class: 'lf-out' }, [svg])]),
      el('div', { class: 'lf-cap' }, [cap])
    ]));
  }
  function box(x, y, w, h, fill, stroke) {
    return svgEl('rect', { x: x, y: y, width: w, height: h, rx: 3, fill: fill || 'none', stroke: stroke || SOFT, 'stroke-width': 1.4 });
  }
  function txt(x, y, s, size, fill, anchor) {
    return svgEl('text', { x: x, y: y, 'font-family': 'var(--font-mono,monospace)', 'font-size': size || 11, fill: fill || MUTE, 'text-anchor': anchor || 'middle' }, [document.createTextNode(s)]);
  }
  function grp(x, y, kids) {
    var g = svgEl('g', { transform: 'translate(' + x + ' ' + y + ')' });
    (kids || []).forEach(function (k) { g.appendChild(k); });
    return g;
  }
  // Entry: fade + grow from 95%, hold, exit faster than entry, shared loop.
  // `at` is the entry start as a fraction of `dur`.
  function pop(g, dur, at) {
    var kt = '0;' + at + ';' + (at + 0.08) + ';0.93;1';
    var ks = '0 0 1 1;' + EASE + ';0 0 1 1;0.4 0 1 1';
    g.setAttribute('opacity', '0');
    g.appendChild(svgEl('animate', { attributeName: 'opacity', values: '0;0;1;1;0', keyTimes: kt, dur: dur, repeatCount: 'indefinite', calcMode: 'spline', keySplines: ks }));
    g.appendChild(svgEl('animateTransform', { attributeName: 'transform', type: 'scale', additive: 'sum', values: '0.95;0.95;1;1;0.95', keyTimes: kt, dur: dur, repeatCount: 'indefinite', calcMode: 'spline', keySplines: ks }));
    return g;
  }
  // Edge that draws on at `at`, un-draws quickly at loop end.
  function wire(x1, y1, x2, y2, dur, at, len, col) {
    var L = len || 300;
    var p = svgEl('path', { d: 'M' + x1 + ' ' + y1 + ' L' + x2 + ' ' + y2, fill: 'none', stroke: col || INKS, 'stroke-width': 1.5, 'stroke-dasharray': L + ' ' + L, 'stroke-dashoffset': L });
    p.appendChild(svgEl('animate', { attributeName: 'stroke-dashoffset', values: L + ';' + L + ';0;0;' + L, keyTimes: '0;' + at + ';' + (at + 0.07) + ';0.93;1', dur: dur, repeatCount: 'indefinite', calcMode: 'spline', keySplines: '0 0 1 1;' + EASE + ';0 0 1 1;0.4 0 1 1' }));
    return p;
  }
  // Windowed travel along a path: hidden, appears, moves a..b, hides again.
  function travel(node, path, dur, a, b) {
    node.setAttribute('opacity', '0');
    node.appendChild(svgEl('animateMotion', { path: path, dur: dur, repeatCount: 'indefinite', calcMode: 'linear', keyPoints: '0;0;1;1', keyTimes: '0;' + a + ';' + b + ';1' }));
    node.appendChild(svgEl('animate', { attributeName: 'opacity', values: '0;0;1;1;0;0', keyTimes: '0;' + a + ';' + (a + 0.02) + ';' + (b - 0.02) + ';' + b + ';1', dur: dur, repeatCount: 'indefinite' }));
    return node;
  }

  // ── s0-env-stack: the four-layer dev stack assembles bottom-up ────────────
  // 01-dev-environment
  function envStack(host) {
    var svg = svgEl('svg', { viewBox: '0 0 520 250' });
    var D = '5.5s';
    var layers = [
      { y: 208, t: '1 · system', s: 'OS, drivers, CUDA / Metal', at: 0.04 },
      { y: 166, t: '2 · package managers', s: 'uv, pnpm, cargo', at: 0.13 },
      { y: 124, t: '3 · language runtimes', s: 'Python 3.11+, Node 20+, Rust', at: 0.22 },
      { y: 82, t: '4 · AI libraries', s: 'torch, jax, transformers', at: 0.31 }
    ];
    layers.forEach(function (L, i) {
      svg.appendChild(pop(grp(260, L.y, [
        box(-160, -17, 320, 34, i === 3 ? SURF : BG, i === 3 ? BP : INKS),
        txt(-148, 4, L.t, 10, i === 3 ? BP : INK, 'start'),
        txt(148, 4, L.s, 9, MUTE, 'end')
      ]), D, L.at));
    });
    svg.appendChild(pop(grp(260, 42, [
      txt(0, 0, 'python -c "import torch"  ·  ok', 10, BP)
    ]), D, 0.5));
    svg.appendChild(txt(260, 242, 'each layer stands on the one below it', 9, MUTE));
    shell(host, 'THE FOUR-LAYER STACK', 'system, managers, runtimes, libraries assemble in order', svg,
      'The environment builds bottom-up: the OS and GPU driver first, then package managers, then language runtimes, then the AI libraries that depend on all three. When import torch fails, walk the stack downward, the broken layer is almost never the one that raised the error.');
  }

  // ── s0-commit-dag: a commit DAG grows, a branch merges back to main ───────
  // 02-git-and-collaboration
  function commitDag(host) {
    var svg = svgEl('svg', { viewBox: '0 0 520 210' });
    var D = '6s';
    function commit(x, y, at, hot) {
      return pop(grp(x, y, [
        svgEl('circle', { cx: 0, cy: 0, r: 9, fill: hot ? SURF : BG, stroke: hot ? BP : INK, 'stroke-width': 1.6 })
      ]), D, at);
    }
    svg.appendChild(txt(46, 149, 'main', 9, MUTE, 'end'));
    svg.appendChild(txt(285, 58, 'feature/lr-sweep', 9, MUTE));
    svg.appendChild(wire(99, 145, 161, 145, D, 0.1, 70));
    svg.appendChild(wire(179, 145, 251, 145, D, 0.2, 80));
    svg.appendChild(wire(177, 138, 243, 87, D, 0.3, 90, BP));
    svg.appendChild(wire(259, 80, 311, 80, D, 0.4, 60, BP));
    svg.appendChild(wire(269, 145, 391, 145, D, 0.52, 130));
    svg.appendChild(wire(327, 87, 393, 138, D, 0.6, 90, BP));
    svg.appendChild(commit(90, 145, 0.05));
    svg.appendChild(commit(170, 145, 0.15));
    svg.appendChild(commit(260, 145, 0.25));
    svg.appendChild(commit(250, 80, 0.35, true));
    svg.appendChild(commit(320, 80, 0.45, true));
    svg.appendChild(commit(400, 145, 0.68, true));
    svg.appendChild(pop(grp(400, 175, [txt(0, 0, 'merge commit', 9, BP)]), D, 0.72));
    svg.appendChild(txt(260, 200, 'experiment on a branch, merge when it works', 9, MUTE));
    shell(host, 'COMMIT DAG', 'main advances while a branch diverges, then merges back', svg,
      'Every commit points at its parent, so history is a graph, not a list. A branch is just a diverging path of commits: main keeps moving while the experiment grows on its own line, and the merge commit joins both parents. This is why you can try a risky change without ever touching main.');
  }

  // ── s0-gpu-dispatch: the same matmul batch on CPU vs GPU lanes ────────────
  // 03-gpu-setup-and-cloud
  function gpuDispatch(host) {
    var svg = svgEl('svg', { viewBox: '0 0 520 230' });
    var D = '6s';
    svg.appendChild(pop(grp(75, 115, [
      box(-48, -24, 96, 48, BG, INK),
      txt(0, -3, 'matmul', 10, INK),
      txt(0, 12, 'batch', 9, MUTE)
    ]), D, 0.03));
    svg.appendChild(svgEl('path', { d: 'M127 105 L366 70', fill: 'none', stroke: SOFT, 'stroke-width': 1, 'stroke-dasharray': '3 4' }));
    svg.appendChild(svgEl('path', { d: 'M127 125 L366 165', fill: 'none', stroke: SOFT, 'stroke-width': 1, 'stroke-dasharray': '3 4' }));
    var cpuBar = svgEl('rect', { x: -48, y: 6, width: 0, height: 8, fill: MUTE });
    cpuBar.appendChild(svgEl('animate', { attributeName: 'width', values: '0;0;96', keyTimes: '0;0.08;1', dur: D, repeatCount: 'indefinite' }));
    svg.appendChild(pop(grp(430, 70, [
      box(-60, -26, 120, 52, BG, MUTE),
      txt(0, -8, 'CPU', 10, INK),
      svgEl('rect', { x: -48, y: 6, width: 96, height: 8, fill: SURF }),
      cpuBar
    ]), D, 0.08));
    var gpuBar = svgEl('rect', { x: -48, y: 6, width: 0, height: 8, fill: BP });
    gpuBar.appendChild(svgEl('animate', { attributeName: 'width', values: '0;96', dur: '1.2s', repeatCount: 'indefinite', calcMode: 'spline', keySplines: EASE, keyTimes: '0;1' }));
    svg.appendChild(pop(grp(430, 165, [
      box(-60, -26, 120, 52, BG, BP),
      txt(0, -8, 'GPU', 10, BP),
      svgEl('rect', { x: -48, y: 6, width: 96, height: 8, fill: SURF }),
      gpuBar
    ]), D, 0.13));
    var slow = svgEl('circle', { cx: 0, cy: 0, r: 5, fill: MUTE });
    slow.appendChild(svgEl('animateMotion', { path: 'M127 105 L360 70', dur: D, repeatCount: 'indefinite' }));
    svg.appendChild(slow);
    for (var i = 0; i < 4; i++) {
      var d = svgEl('circle', { cx: 0, cy: 0, r: 5, fill: BP });
      d.appendChild(svgEl('animateMotion', { path: 'M127 125 L360 165', dur: '1.2s', begin: (i * 0.3) + 's', repeatCount: 'indefinite' }));
      svg.appendChild(d);
    }
    svg.appendChild(txt(430, 112, 'one epoch: ~8 hours', 9, MUTE));
    svg.appendChild(txt(430, 207, '~10 minutes · 48x', 9, BP));
    svg.appendChild(txt(255, 30, 'same jobs, two backends', 9, MUTE));
    shell(host, 'DISPATCH TO THE ACCELERATOR', 'one lane crawls on CPU, the other streams through the GPU', svg,
      'The GPU wins because matmuls are thousands of independent multiply-adds, exactly what its cores parallelize. The same batch trickles through the CPU one chunk at a time but streams through the GPU, which is why a training run that takes 8 hours on CPU takes about 10 minutes on a T4. Verify the lane exists first: nvidia-smi, then torch.cuda.is_available().');
  }

  // ── s0-secret-inject: the key flows from .env into the request header ─────
  // 04-apis-and-keys
  function secretInject(host) {
    var svg = svgEl('svg', { viewBox: '0 0 520 240' });
    var D = '6s';
    svg.appendChild(pop(grp(105, 62, [
      box(-80, -28, 160, 56, BG, INKS),
      txt(0, -10, 'app.py (in git)', 9, INK),
      txt(0, 8, 'key = os.environ[...]', 8, MUTE)
    ]), D, 0.03));
    svg.appendChild(pop(grp(105, 188, [
      box(-80, -26, 160, 52, BG, WARN),
      txt(0, -8, '.env (gitignored)', 9, INK),
      txt(0, 9, 'ANTHROPIC_API_KEY=sk-...', 8, WARN)
    ]), D, 0.07));
    svg.appendChild(pop(grp(285, 125, [
      box(-58, -25, 116, 50, BG, INK),
      txt(0, 3, 'python process', 9, INK)
    ]), D, 0.11));
    svg.appendChild(pop(grp(455, 125, [
      box(-58, -25, 116, 50, BG, BP),
      txt(0, -3, 'api.anthropic', 9, BP),
      txt(0, 11, '.com', 9, BP)
    ]), D, 0.15));
    svg.appendChild(svgEl('path', { d: 'M140 94 L240 112', fill: 'none', stroke: SOFT, 'stroke-width': 1, 'stroke-dasharray': '3 4' }));
    var key = grp(0, 0, [
      svgEl('rect', { x: -16, y: -9, width: 32, height: 18, rx: 4, fill: SURF, stroke: WARN, 'stroke-width': 1.4 }),
      txt(0, 4, 'sk', 9, WARN)
    ]);
    travel(key, 'M140 172 L245 138', D, 0.24, 0.36);
    svg.appendChild(key);
    var req = svgEl('circle', { cx: 0, cy: 0, r: 5, fill: BP });
    travel(req, 'M345 117 L395 117', D, 0.44, 0.56);
    svg.appendChild(req);
    var res = svgEl('circle', { cx: 0, cy: 0, r: 5, fill: BG, stroke: BP, 'stroke-width': 1.5 });
    travel(res, 'M395 134 L345 134', D, 0.62, 0.74);
    svg.appendChild(res);
    svg.appendChild(pop(grp(370, 100, [txt(0, 0, 'Authorization: Bearer sk-...', 8, MUTE)]), D, 0.42));
    svg.appendChild(pop(grp(370, 155, [txt(0, 0, '200 · json', 9, BP)]), D, 0.72));
    svg.appendChild(txt(260, 228, 'the key exists only in .env and in the runtime header', 9, MUTE));
    shell(host, 'SECRET INJECTION', 'the key is loaded from .env at runtime, never written in code', svg,
      'The code that gets committed only names the variable; the value lives in a gitignored .env file and is injected into the process environment at runtime, then sent as an Authorization header. If the key ever appears in the source, it ships with every clone of the repo, and a leaked key bills to your account.');
  }

  // ── s0-cell-order: cells run in order until a re-run leaves stale state ───
  // 05-jupyter-notebooks
  function cellOrder(host) {
    var svg = svgEl('svg', { viewBox: '0 0 520 260' });
    var D = '6s';
    var cells = [
      { y: 55, code: 'df = load("train.csv")' },
      { y: 120, code: 'df = clean(df)' },
      { y: 185, code: 'model.fit(df)' }
    ];
    cells.forEach(function (c) {
      svg.appendChild(box(120, c.y - 22, 330, 44, BG, INKS));
      svg.appendChild(txt(140, c.y + 4, c.code, 10, INK, 'start'));
    });
    svg.appendChild(pop(grp(95, 55, [txt(0, 4, '[1]', 10, BP)]), D, 0.05));
    var b2 = pop(grp(95, 120, [txt(0, 4, '[2]', 10, BP)]), D, 0.15);
    svg.appendChild(b2);
    var hide2 = svgEl('animate', { attributeName: 'opacity', values: '1;1;0;0', keyTimes: '0;0.53;0.56;1', dur: D, repeatCount: 'indefinite' });
    b2.firstChild.appendChild(hide2);
    svg.appendChild(pop(grp(95, 185, [txt(0, 4, '[3]', 10, BP)]), D, 0.25));
    svg.appendChild(pop(grp(95, 120, [txt(0, 4, '[4]', 10, WARN)]), D, 0.56));
    svg.appendChild(pop(grp(285, 185, [box(-165, -22, 330, 44, null, WARN)]), D, 0.64));
    svg.appendChild(pop(grp(400, 152, [txt(0, 0, 'ran against old df: stale', 9, WARN)]), D, 0.68));
    svg.appendChild(txt(285, 244, 'run top to bottom; a re-run above breaks the story below', 9, MUTE));
    shell(host, 'EXECUTION ORDER', 'run counters climb in order, then a re-run poisons the state', svg,
      'The bracket number records when a cell ran, not where it sits. Re-running cell 2 turns [2] into [4], but cell 3 still holds the result of the old order, hidden state the file on disk never shows. When the counters stop reading top to bottom, Restart and Run All is the only honest check.');
  }

  // ── s0-env-isolation: per-project envs stay calm, global site-packages collides ─
  // 06-python-environments
  function envIsolation(host) {
    var svg = svgEl('svg', { viewBox: '0 0 520 240' });
    var D = '6s';
    [{ x: 135, name: 'project-a', chip: 'torch 2.4 · cu124', at: 0.04 },
     { x: 385, name: 'project-b', chip: 'torch 2.1 · cu118', at: 0.1 }].forEach(function (p) {
      svg.appendChild(pop(grp(p.x, 75, [
        box(-105, -45, 210, 90, BG, INKS),
        txt(-92, -26, p.name, 10, INK, 'start'),
        txt(92, -26, '.venv', 9, BP, 'end'),
        box(-90, -12, 180, 44, SURF, SOFT)
      ]), D, p.at));
      svg.appendChild(pop(grp(p.x, 75, [
        box(-80, -4, 160, 26, BG, BP),
        txt(0, 13, p.chip, 9, BP)
      ]), D, p.at + 0.18));
    });
    svg.appendChild(pop(grp(260, 192, [
      box(-150, -26, 300, 52, BG, MUTE),
      txt(0, -10, 'global site-packages', 9, INK)
    ]), D, 0.16));
    var cA = grp(0, 0, [box(-52, -11, 104, 22, BG, MUTE), txt(0, 4, 'torch 2.4', 9, MUTE)]);
    travel(cA, 'M40 226 L232 199', D, 0.42, 0.54);
    svg.appendChild(cA);
    var cB = grp(0, 0, [box(-52, -11, 104, 22, BG, MUTE), txt(0, 4, 'torch 2.1', 9, MUTE)]);
    travel(cB, 'M480 226 L288 199', D, 0.48, 0.6);
    svg.appendChild(cB);
    var clash = grp(260, 199, [
      box(-66, -13, 132, 26, SURF, WARN),
      txt(0, 4, 'torch 2.? · both broken', 9, WARN)
    ]);
    pop(clash, D, 0.62);
    svg.appendChild(clash);
    svg.appendChild(txt(260, 30, 'one interpreter per project, packages resolved inside it', 9, MUTE));
    shell(host, 'DEPENDENCY ISOLATION', 'each project keeps its own torch; the global install collides', svg,
      'Both pins are correct, they just cannot share one interpreter. Installed globally, the second pip install overwrites the first and both projects break. A per-project virtual environment gives each its own site-packages, so torch 2.4 and torch 2.1 coexist on the same machine without ever meeting.');
  }

  // ── s0-image-layers: layers stack into an image, identical containers everywhere ─
  // 07-docker-for-ai
  function imageLayers(host) {
    var svg = svgEl('svg', { viewBox: '0 0 520 250' });
    var D = '6s';
    var layers = [
      { y: 196, t: 'FROM cuda:12.4', at: 0.04 },
      { y: 166, t: 'python 3.12', at: 0.12 },
      { y: 136, t: 'pip: torch 2.3', at: 0.2 },
      { y: 106, t: 'COPY train.py', at: 0.28 }
    ];
    svg.appendChild(txt(115, 78, 'image', 9, MUTE));
    layers.forEach(function (L, i) {
      svg.appendChild(pop(grp(115, L.y, [
        box(-80, -13, 160, 26, i === 3 ? SURF : BG, i === 3 ? BP : INKS),
        txt(0, 4, L.t, 9, i === 3 ? BP : INK)
      ]), D, L.at));
    });
    svg.appendChild(wire(200, 120, 320, 75, D, 0.4, 130));
    svg.appendChild(wire(200, 165, 320, 185, D, 0.4, 130));
    svg.appendChild(pop(grp(255, 128, [txt(0, 0, 'docker run', 9, BP)]), D, 0.42));
    [{ y: 70, t: 'your laptop' }, { y: 182, t: 'cloud GPU box' }].forEach(function (h, i) {
      svg.appendChild(pop(grp(400, h.y, [
        box(-78, -34, 156, 68, BG, MUTE),
        txt(0, -19, h.t, 9, MUTE)
      ]), D, 0.34 + i * 0.05));
      svg.appendChild(pop(grp(400, h.y + 8, [
        box(-66, -14, 132, 28, SURF, BP),
        txt(0, 4, 'container · identical', 8, BP)
      ]), D, 0.55));
    });
    svg.appendChild(txt(260, 240, 'one image, byte-identical runtime on every host', 9, MUTE));
    shell(host, 'IMAGE LAYERS', 'the Dockerfile stacks layers once, containers run them anywhere', svg,
      'Each Dockerfile instruction adds a read-only layer: CUDA base, Python, torch, then your code on top. The finished image is the whole stack frozen, so docker run produces the same container on your laptop and on a rented GPU box, and the works-on-my-machine failure mode disappears with it.');
  }

  // ── s0-lsp-roundtrip: a keystroke round-trips through the language server ─
  // 08-editor-setup
  function lspRoundtrip(host) {
    var svg = svgEl('svg', { viewBox: '0 0 520 220' });
    var D = '4.5s';
    svg.appendChild(pop(grp(140, 110, [
      box(-105, -62, 210, 124, BG, INKS),
      txt(-92, -44, 'editor', 9, MUTE, 'start'),
      svgEl('rect', { x: -90, y: -28, width: 130, height: 7, rx: 2, fill: SURF }),
      svgEl('rect', { x: -90, y: -12, width: 96, height: 7, rx: 2, fill: SURF }),
      txt(-90, 16, 'model.fit(X, y', 10, INK, 'start'),
      svgEl('rect', { x: -90, y: 36, width: 150, height: 7, rx: 2, fill: SURF })
    ]), D, 0.03));
    svg.appendChild(pop(grp(420, 110, [
      box(-72, -40, 144, 80, BG, BP),
      txt(0, -20, 'pyright', 10, BP),
      txt(0, -6, 'language server', 8, MUTE)
    ]), D, 0.08));
    var pulse = svgEl('circle', { cx: 420, cy: 122, r: 6, fill: BP, opacity: 0 });
    pulse.appendChild(svgEl('animate', { attributeName: 'opacity', values: '0;0;0.9;0.2;0.9;0;0', keyTimes: '0;0.32;0.36;0.4;0.44;0.5;1', dur: D, repeatCount: 'indefinite' }));
    svg.appendChild(pulse);
    var req = svgEl('circle', { cx: 0, cy: 0, r: 5, fill: INK });
    travel(req, 'M250 96 L344 96', D, 0.16, 0.3);
    svg.appendChild(req);
    var res = svgEl('circle', { cx: 0, cy: 0, r: 5, fill: BG, stroke: BP, 'stroke-width': 1.5 });
    travel(res, 'M344 128 L250 128', D, 0.5, 0.64);
    svg.appendChild(res);
    svg.appendChild(pop(grp(297, 86, [txt(0, 0, 'didChange', 8, MUTE)]), D, 0.16));
    svg.appendChild(pop(grp(297, 148, [txt(0, 0, 'diagnostics', 8, MUTE)]), D, 0.5));
    var squig = svgEl('path', { d: 'M-36 0 q4 -4 8 0 t8 0 t8 0 t8 0 t8 0 t8 0 t8 0 t8 0 t8 0', fill: 'none', stroke: WARN, 'stroke-width': 1.6 });
    svg.appendChild(pop(grp(86, 132, [squig]), D, 0.68));
    svg.appendChild(pop(grp(140, 160, [txt(0, 0, '"(" was never closed', 8, WARN)]), D, 0.74));
    shell(host, 'LSP ROUND TRIP', 'every squiggle is a request and a reply, not editor magic', svg,
      'The editor does not understand Python; the language server does. Each edit ships a didChange notification across the wire, the server re-checks the file, and diagnostics come back to be drawn as squiggles and hovers. Install the Python and Pylance extensions and this loop runs on every keystroke; skip them and the editor is a text box.');
  }

  // ── s0-data-pipeline: raw file to typed format to seeded, versioned splits ─
  // 09-data-management
  function dataPipeline(host) {
    var svg = svgEl('svg', { viewBox: '0 0 520 230' });
    var D = '6s';
    var stages = [
      { x: 90, t: 'raw', s: 'data.csv', at: 0.04 },
      { x: 255, t: 'typed', s: 'data.parquet', at: 0.1 },
      { x: 425, t: 'versioned', s: 'splits @ seed 42', at: 0.16 }
    ];
    stages.forEach(function (st) {
      svg.appendChild(pop(grp(st.x, 100, [
        box(-62, -30, 124, 60, BG, INKS),
        txt(0, -8, st.t, 10, INK),
        txt(0, 10, st.s, 8, MUTE)
      ]), D, st.at));
    });
    var chip = grp(0, 0, [svgEl('rect', { x: -10, y: -10, width: 20, height: 20, rx: 3, fill: BP })]);
    travel(chip, 'M152 100 L193 100', D, 0.26, 0.36);
    svg.appendChild(chip);
    var chip2 = grp(0, 0, [svgEl('rect', { x: -10, y: -10, width: 20, height: 20, rx: 3, fill: BP })]);
    travel(chip2, 'M317 100 L363 100', D, 0.44, 0.54);
    svg.appendChild(chip2);
    svg.appendChild(pop(grp(172, 78, [txt(0, 0, 'cast + dedupe', 8, MUTE)]), D, 0.28));
    svg.appendChild(pop(grp(340, 78, [txt(0, 0, 'split(seed=42)', 8, MUTE)]), D, 0.46));
    [{ dx: -40, t: 'train' }, { dx: 0, t: 'val' }, { dx: 40, t: 'test' }].forEach(function (s, i) {
      svg.appendChild(pop(grp(425 + s.dx, 165, [
        box(-18, -12, 36, 24, SURF, BP),
        txt(0, 4, s.t, 8, BP)
      ]), D, 0.6 + i * 0.05));
    });
    svg.appendChild(pop(grp(425, 198, [txt(0, 0, 'same seed, same rows, every run', 8, BP)]), D, 0.78));
    svg.appendChild(txt(180, 198, 'raw stays untouched; every step is re-runnable', 9, MUTE));
    shell(host, 'DATA PIPELINE', 'raw file, typed artifact, then seeded splits you can reproduce', svg,
      'The raw CSV is never edited in place: it flows into a typed, compressed Parquet artifact, then into train, val, and test splits cut with a fixed seed. Because each arrow is a script and the seed is pinned, anyone can regenerate the exact rows your metrics were computed on, and that is what makes an experiment comparable.');
  }

  // ── s0-shell-pipeline: a stream narrows as it passes through each pipe ────
  // 10-terminal-and-shell
  function shellPipeline(host) {
    var svg = svgEl('svg', { viewBox: '0 0 520 200' });
    var cmds = [
      { x: 85, t: 'tail -f train.log' },
      { x: 255, t: 'grep loss' },
      { x: 430, t: "awk '{print $8}'" }
    ];
    cmds.forEach(function (c, i) {
      svg.appendChild(box(c.x - 62, 62, 124, 44, BG, i === 1 ? BP : INKS));
      svg.appendChild(txt(c.x, 88, c.t, 9, i === 1 ? BP : INK));
    });
    svg.appendChild(txt(170, 78, '|', 14, MUTE));
    svg.appendChild(txt(342, 78, '|', 14, MUTE));
    for (var i = 0; i < 3; i++) {
      var keep = svgEl('circle', { cx: 0, cy: 0, r: 4, fill: BP });
      keep.appendChild(svgEl('animateMotion', { path: 'M20 84 L500 84', dur: '3s', begin: (i * 1.0) + 's', repeatCount: 'indefinite' }));
      svg.appendChild(keep);
    }
    for (var j = 0; j < 3; j++) {
      var dropped = svgEl('circle', { cx: 0, cy: 0, r: 4, fill: MUTE });
      dropped.appendChild(svgEl('animateMotion', { path: 'M20 84 L235 84 Q255 84 255 104 L255 140', dur: '3s', begin: (j * 1.0 + 0.5) + 's', repeatCount: 'indefinite' }));
      dropped.appendChild(svgEl('animate', { attributeName: 'opacity', values: '1;1;0', keyTimes: '0;0.78;1', dur: '3s', begin: (j * 1.0 + 0.5) + 's', repeatCount: 'indefinite' }));
      svg.appendChild(dropped);
    }
    svg.appendChild(txt(255, 160, 'non-matching lines dropped', 8, MUTE));
    svg.appendChild(txt(497, 60, '0.342', 9, BP, 'end'));
    svg.appendChild(txt(85, 130, 'every line', 8, MUTE));
    svg.appendChild(txt(430, 130, 'just the number', 8, MUTE));
    shell(host, 'PIPES NARROW THE STREAM', 'each command reads the last one\'s output and passes on less', svg,
      'A pipe hands one command\'s stdout to the next command\'s stdin, no temp files in between. The log stream enters whole, grep drops every line without "loss", and awk keeps only column 8, so a firehose of training output becomes a clean series of numbers you can watch or plot live.');
  }

  // ── s0-process-fork: the process tree forks down to your training run ─────
  // 11-linux-for-ai
  function processFork(host) {
    var svg = svgEl('svg', { viewBox: '0 0 520 250' });
    var D = '6s';
    var nodes = [
      { x: 85, y: 45, t: 'systemd · pid 1', at: 0.04 },
      { x: 185, y: 100, t: 'sshd', at: 0.14 },
      { x: 285, y: 155, t: 'bash', at: 0.24 },
      { x: 405, y: 210, t: 'python train.py', at: 0.34 }
    ];
    svg.appendChild(wire(120, 55, 152, 90, D, 0.1, 60));
    svg.appendChild(wire(218, 110, 252, 145, D, 0.2, 60));
    svg.appendChild(wire(320, 165, 355, 200, D, 0.3, 60));
    nodes.forEach(function (n, i) {
      var last = i === 3;
      var g;
      if (last) {
        g = grp(n.x, n.y, [
          box(-60, -15, 120, 30, SURF, BP),
          txt(0, 4, n.t, 9, BP)
        ]);
        g.setAttribute('opacity', '0');
        g.appendChild(svgEl('animate', { attributeName: 'opacity', values: '0;0;1;1;0;0', keyTimes: '0;0.34;0.42;0.72;0.76;1', dur: D, repeatCount: 'indefinite', calcMode: 'spline', keySplines: '0 0 1 1;' + EASE + ';0 0 1 1;0.4 0 1 1;0 0 1 1' }));
        g.appendChild(svgEl('animateTransform', { attributeName: 'transform', type: 'scale', additive: 'sum', values: '0.95;0.95;1;1;1;1', keyTimes: '0;0.34;0.42;0.72;0.76;1', dur: D, repeatCount: 'indefinite', calcMode: 'spline', keySplines: '0 0 1 1;' + EASE + ';0 0 1 1;0 0 1 1;0 0 1 1' }));
      } else {
        g = pop(grp(n.x, n.y, [
          box(-60, -15, 120, 30, BG, INKS),
          txt(0, 4, n.t, 9, INK)
        ]), D, n.at);
      }
      svg.appendChild(g);
    });
    nodes.slice(0, 3).forEach(function (n, i) {
      svg.appendChild(pop(grp(n.x + 70, n.y, [txt(0, 3, 'fork', 8, MUTE, 'start')]), D, n.at + 0.06));
    });
    svg.appendChild(pop(grp(285, 128, [txt(0, 0, 'Ctrl-C · SIGINT', 8, WARN)]), D, 0.56));
    var sig = svgEl('circle', { cx: 0, cy: 0, r: 5, fill: WARN });
    travel(sig, 'M320 165 L385 202', D, 0.6, 0.7);
    svg.appendChild(sig);
    svg.appendChild(pop(grp(405, 235, [txt(0, 0, 'exited (130) · GPU freed', 8, WARN)]), D, 0.74));
    svg.appendChild(txt(140, 220, 'ps aux shows this tree; kill sends the same signal', 8, MUTE));
    shell(host, 'PROCESSES FORK', 'every program on the box descends from pid 1, signals walk back down', svg,
      'On a Linux GPU box everything is a process forked from a parent: init spawns sshd, your login spawns bash, bash spawns the training run. SIGINT from Ctrl-C, or kill against the pid you find with ps aux, ends the leaf and frees its GPU memory, which is how you reclaim a box a dead run is still holding.');
  }

  // ── s0-flame-hot: the profile widens on the real bottleneck ───────────────
  // 12-debugging-and-profiling
  function flameHot(host) {
    var svg = svgEl('svg', { viewBox: '0 0 520 230' });
    var D = '5.5s';
    var KT = '0;0.35;0.55;1';
    function w(node, attr, v1, v2) {
      node.appendChild(svgEl('animate', { attributeName: attr, values: v1 + ';' + v1 + ';' + v2 + ';' + v2, keyTimes: KT, dur: D, repeatCount: 'indefinite', calcMode: 'spline', keySplines: '0 0 1 1;' + EASE + ';0 0 1 1' }));
      return node;
    }
    svg.appendChild(pop(grp(260, 185, [
      box(-220, -15, 440, 30, SURF, INK),
      txt(0, 4, 'train_step · 100%', 9, INK)
    ]), D, 0.04));
    var data = box(-220, -15, 150, 30, BG, WARN);
    w(data, 'width', 150, 270);
    var dataT = txt(-145, 4, 'data loading', 9, INK);
    w(dataT, 'x', -145, -85);
    var fwd = box(-65, -15, 150, 30, BG, INKS);
    w(fwd, 'x', -65, 55); w(fwd, 'width', 150, 90);
    var fwdT = txt(10, 4, 'forward', 9, MUTE);
    w(fwdT, 'x', 10, 100);
    var bwd = box(90, -15, 130, 30, BG, INKS);
    w(bwd, 'x', 90, 150); w(bwd, 'width', 130, 70);
    var bwdT = txt(155, 4, 'bwd', 9, MUTE);
    w(bwdT, 'x', 155, 185);
    svg.appendChild(pop(grp(260, 150, [data, dataT, fwd, fwdT, bwd, bwdT]), D, 0.12));
    var hot = box(-220, -15, 130, 30, SURF, WARN);
    w(hot, 'width', 130, 250);
    var hotT = txt(-155, 4, 'DataLoader.__next__', 8, WARN);
    w(hotT, 'x', -155, -95);
    svg.appendChild(pop(grp(260, 115, [hot, hotT]), D, 0.2));
    svg.appendChild(pop(grp(330, 80, [txt(0, 0, '62% of the step is fetching batches', 9, WARN)]), D, 0.6));
    svg.appendChild(pop(grp(330, 98, [txt(0, 0, 'fix: num_workers, pin_memory', 8, MUTE)]), D, 0.7));
    svg.appendChild(txt(260, 222, 'cProfile, cumulative time per call, drawn as a flame', 9, MUTE));
    shell(host, 'WHERE THE TIME GOES', 'profiling widens the flame over the function actually burning it', svg,
      'The GPU math you suspected is not the bottleneck; the profiler shows the step spending most of its wall time inside the DataLoader. Each bar is cumulative time in a call, stacked on its caller, so the widest tower marks the function to fix, here by adding loader workers and pinned memory instead of optimizing the model.');
  }

  LF.register({
    's0-env-stack': envStack,
    's0-commit-dag': commitDag,
    's0-gpu-dispatch': gpuDispatch,
    's0-secret-inject': secretInject,
    's0-cell-order': cellOrder,
    's0-env-isolation': envIsolation,
    's0-image-layers': imageLayers,
    's0-lsp-roundtrip': lspRoundtrip,
    's0-data-pipeline': dataPipeline,
    's0-shell-pipeline': shellPipeline,
    's0-process-fork': processFork,
    's0-flame-hot': flameHot
  });
})();
