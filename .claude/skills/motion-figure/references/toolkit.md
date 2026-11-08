# The LF toolkit and two complete examples

The course runtime puts one object on the page: `window.LF`. Figure modules use it to build DOM and SVG nodes, to make controls, and to register figures by name. This file lists each function, the mount sequence, and two complete modules. The last section has a small preview page for work outside the course site.

## Functions on `window.LF`

| Function | What it does |
|---|---|
| `LF.el(tag, attrs, kids)` | Makes an HTML element. The key `class` sets `className`. The key `html` sets `innerHTML`. A string in `kids` becomes a text node. |
| `LF.svgEl(tag, attrs, kids)` | Makes an SVG element. For an animation element with no `repeatCount`, it adds `repeatCount="1"` and `fill="freeze"`. A loop that also has `fill="freeze"` changes to play once. A loop of `<animate>` on a geometry attribute also changes to play once. |
| `LF.smil(tag, attrs, kids)` | The same as `LF.svgEl`. Use it to show that a node is an animation. |
| `LF.slider(state, key, label, min, max, step, fmt)` | Makes a labelled range input. On input it sets `state[key]` to a number, updates the value text and `aria-valuetext`, and calls `state._render()`. `fmt` formats the shown value. |
| `LF.select(state, key, label, options)` | Makes a labelled select. `options` is a list of `[text, value]` pairs. On change it sets `state[key]` to the string value and calls `state._render()`. |
| `LF.register(map)` | Adds each `name: function` pair to the registry. A later call with the same name replaces the earlier function. |
| `LF.uid(prefix)` | Returns a new id such as `lf-3`. Call it once per figure, outside the render function. |
| `LF.clamp(x, lo, hi)` and `LF.lerp(a, b, t)` | Small number helpers. |
| `LF.fmtInt(n)` and `LF.fmtSeq(n)` | Format `12345` as `12,345`, and `8192` as `8K`. |
| `LF.motion` | The motion values `feedback` 180ms, `enter` 220ms, `press` 160ms, and the two easing curves. |
| `LF.autoplay`, `LF.raf` | Script-driven animation helpers for old figures. Do not use them in new figures. Use SMIL. |
| `LF.registerDisposer(host, fn)` | Adds a cleanup function that runs when the lesson unmounts the host. |

## The figure function

A figure function has the signature `function (host, cfg)`.

- `host` is the `div.lesson-figure` element. Append one `.lf` card to it.
- `cfg` is the JSON object after the name in the fence. It is `{}` when the fence has no JSON or bad JSON.
- The function can return a dispose function. The runtime calls it when the lesson changes.
- To change the static frame time, set `host.setAttribute('data-static-time', '3.2')` before the SVG mounts.

## The slider render contract

`LF.slider` and `LF.select` wrap `state._render` the first time you call them. The wrapper keeps the old SVG nodes and copies the new attributes onto them. This lets CSS transitions run between two renders. Three rules follow from this.

1. Define `state._render` before the first control call. A render function that you define later is not wrapped, and every render replaces the nodes.
2. In `state._render`, remove every SVG child and add new ones in the same order every time. The wrapper matches old and new nodes by position and tag.
3. Give every node all of its attributes on every render. The wrapper removes any attribute that the new node does not have. This includes an id that the runtime added.

## Mount sequence

1. The Markdown parser turns a `figure` fence into `<div class="lesson-figure" data-figure="name {json}">`.
2. The site build reads each fence name. It searches each `figures*.js` module for the quoted name and writes a manifest of providers. A name that no file contains stops the build with `Figure IDs have no provider`.
3. The lesson page loads the providers that its figures need, in the fixed order, one after another.
4. `mountLessonFigures` finds each host that is not mounted. It calls the figure function inside a `try` block.
5. It adds missing control labels, a missing SVG title and description, and `role="img"`.
6. If the host contains an SVG, it adds the class `lf-animated`.
7. If the SVG has animation elements, it adds the Pause button. If any animation plays once, it adds the Replay button.
8. It watches reduced motion, print, tab visibility, and viewport position. An IntersectionObserver with a threshold of 0.02 pauses figures that are not on screen.

## Example 1: slider widget

This module registers `context-budget`. It obeys every widget rule. It is ES5 and defines the render function before the sliders. It makes ids once, clears and adds children on each render, and draws bars by length.

````markdown
```figure
context-budget {"windowK": 64}
```
````

```js
(function () {
  'use strict';
  var LF = window.LF;
  if (!LF) { return; }
  var el = LF.el, svgEl = LF.svgEl, slider = LF.slider;
  var INK = 'var(--ink,#1a1a1a)', MUTE = 'var(--ink-mute,#7a7a78)';
  var BP = 'var(--blueprint,#3553ff)', WARN = 'var(--warn,#b8870f)';
  var RULE = 'var(--rule-soft,rgba(26,26,26,0.16))';

  function contextBudget(host, cfg) {
    var WINDOW = (cfg && cfg.windowK) || 128;
    var state = { prompt: 24, reserve: 8 };
    var W = 520, H = 120, X0 = 20, BAR = 480, Y = 56;
    var titleId = LF.uid('lf-context-budget-title');
    var descId = LF.uid('lf-context-budget-desc');
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-labelledby': titleId + ' ' + descId });
    var num = el('span', { class: 'lf-num' });
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });

    function bar(from, len, color) {
      var start = Math.min(from, WINDOW);
      var size = Math.max(0, Math.min(len, WINDOW - start));
      var x = X0 + start / WINDOW * BAR;
      var w = size / WINDOW * BAR;
      return svgEl('path', { d: 'M' + x.toFixed(1) + ' ' + Y + 'h' + w.toFixed(1), stroke: color, 'stroke-width': '18', fill: 'none' });
    }
    function label(x, y, s, fill, anchor) {
      return svgEl('text', { x: x, y: y, 'text-anchor': anchor, 'font-family': 'var(--font-mono,monospace)', 'font-size': '14', fill: fill }, [document.createTextNode(s)]);
    }

    state._render = function () {
      var free = WINDOW - state.prompt - state.reserve;
      var over = free < 0;
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      svg.appendChild(svgEl('title', { id: titleId }, [document.createTextNode('Context window budget')]));
      svg.appendChild(svgEl('desc', { id: descId }, [document.createTextNode('A prompt of ' + state.prompt + 'K tokens and an output reserve of ' + state.reserve + 'K tokens inside a ' + WINDOW + 'K window.')]));
      svg.appendChild(bar(0, WINDOW, RULE));
      svg.appendChild(bar(0, state.prompt, BP));
      svg.appendChild(bar(state.prompt, state.reserve, over ? WARN : MUTE));
      svg.appendChild(label(X0, 34, 'prompt ' + state.prompt + 'K', BP, 'start'));
      svg.appendChild(label(X0 + BAR, 34, 'window ' + WINDOW + 'K', MUTE, 'end'));
      svg.appendChild(label(X0, 94, over ? 'over the window by ' + (-free) + 'K' : free + 'K free for history and tools', over ? WARN : INK, 'start'));
      num.innerHTML = Math.max(0, free) + ' <small>K tokens free</small>';
      meta.textContent = over ? 'the request does not fit: cut the prompt or the reserve' : Math.round(free / WINDOW * 100) + '% of the window is free';
      formula.textContent = 'free = window - prompt - reserve = ' + WINDOW + ' - ' + state.prompt + ' - ' + state.reserve;
    };

    var grid = el('div', { class: 'lf-grid' }, [
      slider(state, 'prompt', 'prompt (K tokens)', 1, 64, 1),
      slider(state, 'reserve', 'output reserve (K tokens)', 1, 32, 1)
    ]);
    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, ['CONTEXT BUDGET']), el('span', {}, ['drag the prompt size'])]),
      el('div', { class: 'lf-body' }, [grid, el('div', { class: 'lf-out' }, [svg, el('div', { style: 'margin-top:10px' }, [num]), meta, formula])]),
      el('div', { class: 'lf-cap' }, ['Blue is the prompt and grey is the space kept for the answer. The rest of the window holds history and tool results. When the two parts do not fit in the window, the reserve turns amber and the line under the bar gives the overflow.'])
    ]));
    state._render();
  }

  LF.register({ 'context-budget': contextBudget });
})();
```

What to see when you test it:

- Move the prompt slider to 64 and the reserve slider to 32. The number shows 0 and the line under the bar gives the overflow.
- Move both sliders to 1. The number shows 62 with a 64K window.
- After each move, the `desc` id stays the same.

## Example 2: SMIL animated figure

This module registers `request-path`. It has 25 SVG elements. The three boxes enter with a 0.2 s stagger. One 4 s loop moves a dot along the path and turns the middle box blue with an overlay. At the default static time of 1.5 s, every box is visible and the dot sits at the left end of the path.

````markdown
```figure
request-path
```
````

```js
(function () {
  'use strict';
  var LF = window.LF;
  if (!LF) { return; }
  var el = LF.el, svgEl = LF.svgEl;
  var SPL = '0.23 1 0.32 1';
  var INK = 'var(--ink,#1a1a1a)', MUTE = 'var(--ink-mute,#7a7a78)';
  var BP = 'var(--blueprint,#3553ff)', SURF = 'var(--bg-surface,#f3f1e8)';
  var RULE = 'var(--rule-soft,rgba(26,26,26,0.16))';

  function txt(x, y, s, fill) {
    return svgEl('text', { x: x, y: y, 'text-anchor': 'middle', 'font-family': 'var(--font-mono,monospace)', 'font-size': '14', fill: fill || INK }, [document.createTextNode(s)]);
  }
  function enter(node, begin) {
    node.appendChild(svgEl('animate', { attributeName: 'opacity', values: '0;1', keyTimes: '0;1', dur: '0.5s', begin: begin, fill: 'freeze', calcMode: 'spline', keySplines: SPL }));
    node.appendChild(svgEl('animateTransform', { attributeName: 'transform', type: 'scale', additive: 'sum', values: '0.95;1', keyTimes: '0;1', dur: '0.5s', begin: begin, fill: 'freeze', calcMode: 'spline', keySplines: SPL }));
  }
  function stage(cx, cy, name) {
    var g = svgEl('g', { transform: 'translate(' + cx + ' ' + cy + ')', opacity: '0' });
    g.appendChild(svgEl('rect', { x: -70, y: -26, width: 140, height: 52, rx: 4, fill: SURF, stroke: RULE, 'stroke-width': '1.5' }));
    g.appendChild(txt(0, 5, name));
    return g;
  }

  function requestPath(host) {
    var svg = svgEl('svg', { viewBox: '0 0 520 160' });
    svg.appendChild(svgEl('title', { id: 'lf-request-path-title' }, [document.createTextNode('One request through a tool call')]));
    svg.appendChild(svgEl('desc', { id: 'lf-request-path-desc' }, [document.createTextNode('A request leaves the model, passes through the tool, and reaches the result. The tool box turns blue while the request is inside it.')]));
    svg.appendChild(svgEl('path', { d: 'M160 70 L360 70', stroke: RULE, 'stroke-width': '1.5', 'stroke-dasharray': '4 3', fill: 'none' }));

    var model = stage(90, 70, 'model');
    var tool = stage(260, 70, 'tool');
    var result = stage(430, 70, 'result');
    var lit = svgEl('rect', { x: -70, y: -26, width: 140, height: 52, rx: 4, fill: BP, 'fill-opacity': '0' });
    lit.appendChild(svgEl('animate', { attributeName: 'fill-opacity', values: '0;0;0.18;0.18;0;0', keyTimes: '0;0.2;0.25;0.65;0.7;1', dur: '4s', begin: '1s', repeatCount: 'indefinite' }));
    tool.insertBefore(lit, tool.lastChild);
    enter(model, '0.1s');
    enter(tool, '0.3s');
    enter(result, '0.5s');
    svg.appendChild(model);
    svg.appendChild(tool);
    svg.appendChild(result);

    var dot = svgEl('circle', { r: 6, fill: BP, opacity: '0' });
    dot.appendChild(svgEl('animateMotion', { path: 'M160 70 L360 70', dur: '4s', begin: '1s', repeatCount: 'indefinite', calcMode: 'linear', keyPoints: '0;0;1;1', keyTimes: '0;0.1;0.8;1' }));
    dot.appendChild(svgEl('animate', { attributeName: 'opacity', values: '0;1;1;0', keyTimes: '0;0.1;0.8;1', dur: '4s', begin: '1s', repeatCount: 'indefinite' }));
    svg.appendChild(dot);
    svg.appendChild(txt(260, 136, 'one request, one tool call, one result', MUTE));

    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, ['REQUEST PATH']), el('span', {}, ['watch one call'])]),
      el('div', { class: 'lf-body' }, [el('div', { class: 'lf-out' }, [svg])]),
      el('div', { class: 'lf-cap' }, ['The blue dot is one request. It leaves the model, passes through the tool, and reaches the result. The tool box turns blue while the request is inside it. The loop repeats every 4 seconds.'])
    ]));
  }

  LF.register({ 'request-path': requestPath });
})();
```

Points to copy from this module:

- Each box group is moved with `translate` and drawn around (0, 0), so the 0.95 scale grows from its centre.
- The blue state is a second rectangle with `fill-opacity` animated from 0 to 0.18. The colour stays `var(--blueprint)`.
- The motion and the opacity of the dot share one `keyTimes` list, so the dot is visible only while it moves.
- The loop begins at 1 s, after the entries finish at 1.0 s.

## Preview outside the course site

The course runtime is not available outside the course repo. To preview a figure module, use this small stand-in. It has the same function names. It does not keep nodes between renders, it does not add Pause or Replay buttons, and it does not change geometry loops. Test the final figure in the course runtime when you can.

Save this as `lf-shim.js`:

```js
(function () {
  'use strict';
  var FIGS = {};
  var n = 0;
  function el(tag, attrs, kids) {
    var e = document.createElement(tag);
    for (var k in attrs || {}) {
      if (k === 'class') e.className = attrs[k];
      else e.setAttribute(k, attrs[k]);
    }
    (kids || []).forEach(function (c) { e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }
  function svgEl(tag, attrs, kids) {
    var e = document.createElementNS('http://www.w3.org/2000/svg', tag);
    var smil = ['animate', 'animateMotion', 'animateTransform'].indexOf(tag) !== -1;
    if (smil && attrs && attrs.repeatCount === undefined) { attrs.repeatCount = '1'; if (attrs.fill === undefined) attrs.fill = 'freeze'; }
    for (var k in attrs || {}) e.setAttribute(k, attrs[k]);
    (kids || []).forEach(function (c) { e.appendChild(c); });
    return e;
  }
  function uid(prefix) { n += 1; return (prefix || 'lf') + '-' + n; }
  function slider(state, key, label, min, max, step, fmt) {
    var id = uid('lf-range');
    var show = function () { return fmt ? fmt(state[key]) : String(state[key]); };
    var val = el('b', {}, [show()]);
    var input = el('input', { id: id, type: 'range', min: min, max: max, step: step, value: state[key] });
    input.addEventListener('input', function () { state[key] = Number(input.value); val.textContent = show(); state._render(); });
    return el('div', { class: 'lf-ctrl' }, [el('div', { class: 'lf-ctrl-head' }, [el('label', { for: id }, [label]), val]), input]);
  }
  function select(state, key, label, options) {
    var id = uid('lf-select');
    var sel = el('select', { id: id });
    options.forEach(function (o) { sel.appendChild(el('option', { value: o[1] }, [o[0]])); });
    sel.value = state[key];
    sel.addEventListener('change', function () { state[key] = sel.value; state._render(); });
    return el('div', { class: 'lf-ctrl' }, [el('label', { for: id }, [label]), sel]);
  }
  function register(obj) { for (var k in obj) FIGS[k] = obj[k]; }
  function mount() {
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    Array.prototype.forEach.call(document.querySelectorAll('.lesson-figure[data-figure]'), function (host) {
      var text = host.getAttribute('data-figure').trim();
      var name = text.split(/\s+/)[0];
      var cfg = {};
      try { cfg = JSON.parse(text.slice(name.length).trim() || '{}'); } catch (e) {}
      if (!FIGS[name]) { console.warn('no figure named ' + name); return; }
      FIGS[name](host, cfg);
      if (!reduce) return;
      var t = Number(host.getAttribute('data-static-time') || 1.5);
      Array.prototype.forEach.call(host.querySelectorAll('svg'), function (svg) { svg.setCurrentTime(t); svg.pauseAnimations(); });
    });
  }
  window.LF = {
    el: el, svgEl: svgEl, uid: uid, slider: slider, select: select, register: register,
    clamp: function (x, lo, hi) { return x < lo ? lo : x > hi ? hi : x; },
    lerp: function (a, b, t) { return a + (b - a) * t; },
    mount: mount
  };
})();
```

Save this as `preview.html` next to `lf-shim.js` and your module, named here `figures-demo.js`:

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Figure preview</title>
<style>
:root { --bg: #fafaf5; --bg-surface: #f3f1e8; --ink: #1a1a1a; --ink-soft: #4a4a4a; --ink-mute: #7a7a78; --rule-soft: rgba(26, 26, 26, 0.16); --blueprint: #3553ff; --warn: #b8870f; --font-mono: 'JetBrains Mono', ui-monospace, monospace; --font-body: Georgia, serif; }
[data-theme="dark"] { --bg: #0a0d1a; --bg-surface: #131830; --ink: #e8e6dc; --ink-soft: #a8a6a0; --ink-mute: #7a7878; --rule-soft: rgba(232, 230, 220, 0.18); --blueprint: #6b8eff; --warn: #d4a83d; }
body { margin: 0; padding: 16px; background: var(--bg); color: var(--ink); font-family: var(--font-body); }
.lf { max-width: 760px; margin: 28px auto; border: 1px solid var(--rule-soft); }
.lf-head { display: flex; justify-content: space-between; gap: 12px; padding: 12px 16px; border-bottom: 1px solid var(--rule-soft); font: 0.68rem var(--font-mono); letter-spacing: 0.16em; text-transform: uppercase; color: var(--ink-mute); }
.lf-label { color: var(--blueprint); }
.lf-body { padding: 16px; }
.lf-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 24px; }
@media (max-width: 640px) { .lf-grid { grid-template-columns: 1fr; } }
.lf-ctrl-head { display: flex; justify-content: space-between; font: 0.7rem var(--font-mono); text-transform: uppercase; color: var(--ink-soft); }
.lf-ctrl-head b { color: var(--blueprint); }
.lf-ctrl input[type=range] { width: 100%; accent-color: var(--blueprint); }
.lf-out { margin-top: 18px; padding-top: 14px; border-top: 1px dashed var(--rule-soft); }
.lf-out svg { display: block; width: 100%; height: auto; }
.lf-num { font: 2rem var(--font-mono); color: var(--blueprint); }
.lf-num small { font-size: 0.9rem; color: var(--ink-soft); }
.lf-meta, .lf-formula { font: 0.72rem var(--font-mono); color: var(--ink-mute); margin-top: 6px; }
.lf-cap { padding: 12px 16px; border-top: 1px solid var(--rule-soft); color: var(--ink-soft); line-height: 1.5; }
</style>
</head>
<body>
<button type="button" onclick="var r = document.documentElement; r.dataset.theme = r.dataset.theme === 'dark' ? 'light' : 'dark';">Theme</button>
<div class="lesson-figure" data-figure="request-path"></div>
<div class="lesson-figure" data-figure='context-budget {"windowK": 64}'></div>
<script src="lf-shim.js"></script>
<script src="figures-demo.js"></script>
<script>LF.mount();</script>
</body>
</html>
```

Open `preview.html` in a browser. Click Theme to check dark mode. Turn on reduced motion in the system settings to check the static frame.
