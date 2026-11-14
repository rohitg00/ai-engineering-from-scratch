# Contributing Figures

This guide covers how to create, register, embed, and maintain figures in the curriculum. Two figure systems exist:

- **Interactive widgets** — slider-driven, theme-aware, vanilla JS (134+ across 13 modules)
- **Animated SVG explainers** — auto-looping, hover-pause, SVG-based (10 core figures)
- **Static SVGs** — hand-crafted, standalone diagrams in `assets/figures/`

---

## Quick Start: Embed an Existing Figure

Open any lesson's `docs/en.md` and add a fenced block:

````markdown
```figure
attention-matrix
```
````

The lesson renderer (`lesson.html:2268`) converts this into a `<div class="lesson-figure" data-figure="attention-matrix">`, and the mount system hydrates it on page load.

To pass configuration:

````markdown
```figure
kv-cache
{"layers": 32, "kvHeads": 8, "headDim": 128}
```
````

---

## Interactive Widgets (140+ existing)

These are slider/select-driven tools embedded inside a styled card (`.lf` container). Users drag parameters and see the output update in real time.

### File Organization

Pick the right module file based on the target lesson's phase:

| Module file | Phases |
|-------------|--------|
| `figures-math.js` | P1 (math foundations) |
| `figures-ml.js` | P2 (ML fundamentals) |
| `figures-dl.js` | P3 (deep learning core) |
| `figures-vision-speech.js` | P4 (vision), P6 (speech) |
| `figures-transformers.js` | P5 (NLP), P7 (transformers) |
| `figures-genai-rl.js` | P8 (generative AI), P9 (RL) |
| `figures-llms-systems.js` | P10 (LLMs), P12 (multimodal), P13 (tools) |
| `figures-agents-alignment.js` | P11 (LLM eng), P14 (agents), P16 (swarms), P18 (alignment) |
| `figures-math2.js` | P1 (advanced math) |
| `figures-nlp2.js` | P5 (advanced NLP) |
| `figures-llms2.js` | P10 (LLM internals) |
| `figures-infra.js` | P17 (infrastructure) |
| `figures-frontier.js` | P15 (autonomy), P19 (capstones) |

If your concept spans phases not covered by an existing module, create a new file named `figures-<topic>.js`.

### Anatomy of a Widget

```javascript
(function () {
  'use strict';
  var LF = window.LF;
  if (!LF) { return; }
  var el = LF.el, svgEl = LF.svgEl, slider = LF.slider, clamp = LF.clamp;

  // ── widget-name: one-line description ──────────────────────────────
  function widgetName(host) {
    // 1. State object — all mutable parameters live here
    var state = { param: 1.0, count: 5 };

    // 2. SVG surface
    var W = 520, H = 240, PAD = 28;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var num = el('span', { class: 'lf-num' });
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });

    // 3. Coordinate helpers
    function px(x) { return PAD + x / maxX * (W - 2 * PAD); }
    function py(y) { return H - PAD - y / maxY * (H - 2 * PAD); }

    // 4. Render function — called on every slider change
    state._render = function () {
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      // Rebuild SVG content deterministically from state
      // Update text nodes: num.innerHTML, meta.textContent, formula.textContent
    };

    // 5. Controls
    var grid = el('div', { class: 'lf-grid' }, [
      slider(state, 'param', 'label', 0, 10, 0.1),
    ]);

    // 6. Assemble the card
    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [
        el('span', { class: 'lf-label' }, ['UPPERCASE NAME']),
        el('span', {}, ['interaction hint'])
      ]),
      el('div', { class: 'lf-body' }, [
        grid,
        el('div', { class: 'lf-out' }, [svg, num, meta, formula])
      ]),
      el('div', { class: 'lf-cap' }, ['Educational caption explaining the concept.'])
    ]));

    // 7. Initial render
    state._render();
  }

  // 8. Register the widget
  LF.register({ 'widget-name-slug': widgetName });
})();
```

### State Contract

- All mutable parameters in a `state` object.
- `state._render` clears and fully rebuilds the SVG on each call (deterministic).
- Controls (`slider`/`select`) call `state._render()` automatically.
- No randomness in `_render` — use pre-computed or seeded data.

### Available Controls

```javascript
// Slider: range input with live value display
slider(state, key, label, min, max, step, formatFn?)
// Example:
slider(state, 'layers', 'layers', 1, 128, 1, fmtInt)
slider(state, 'lr', 'learning rate', 0.01, 1.2, 0.01)

// Select: dropdown
select(state, key, label, [['Display Name', value], ...])
// Example:
select(state, 'kernel', 'kernel', [['Edge', 'edge'], ['Blur', 'blur']])

// Text: raw text node
el('text', { x: 100, y: 50, 'font-family': 'monospace' }, [txt('label')])
```

### Output Elements

```html
<span class="lf-num">3.14 <small>GiB</small></span>   <!-- Large highlighted number -->
<div class="lf-bar"><i></i></div>                        <!-- Progress/usage bar -->
<div class="lf-meta">context line of text</div>         <!-- Secondary description -->
<div class="lf-formula">f(x) = x + 1</div>             <!-- Math formula -->
```

---

## Animated SVG Explainers (10 existing)

These are auto-looping, hover-pause SVG animations that live in `figures.js`. They work well for processes with a natural temporal flow (tokenization, attention, embedding arithmetic).

### Adding a New Animated Explainer

1. Define a function in `figures.js` that takes a `host` DOM element.
2. Inside, create an SVG element and append it to `host`.
3. Use the `loop(host, fn, period, opts)` utility:

```javascript
function myNewFigure(host) {
  var W = 760, H = 540;
  var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, width: '100%',
    role: 'img', 'aria-label': 'Description' });
  host.appendChild(svg);

  // ... build static SVG elements ...

  loop(host, function (t) {
    // t floats 0→1 over the period
    // Update element attributes based on t
  }, 10000); // period in ms
}
```

4. Register in the `FIGURES` map at the bottom of `figures.js`.

### loop() API

```javascript
loop(host, fn, period = 6000, opts = {})
// fn(localT) — called every frame. localT is 0→1 over the period.
// opts.staticT — frame to show when motion is reduced (default: 0.62)
// Hover-pause: built in (mouseenter pauses, mouseleave resumes)
// Reduced-motion: renders one static frame and stops
```

### Animation Patterns

- **Staged progress**: `var stage = Math.floor(t * stages)` to divide animation into discrete steps.
- **Sub-stage timing**: `var tInStage = (t * stages) - stage` for progress within a step.
- **Easing**: use `easeIO(t)` for smooth multi-segment motion.
- **Softmax for attention**: `softmax(scores, temperature)` for attention weight visualization.

---

## Static SVG Figures (6 existing)

Standalone SVGs in `site/assets/figures/`. These are not interactive — they are embedded in lesson markdown as standard images.

### Adding a Static SVG

1. Author an SVG following the style guide (`STYLE.md`).
2. Save as `site/assets/figures/<NNN>-<slug>.svg` using the next available FIG number from `INDEX.md`.
3. Add a row to the table in `INDEX.md`.
4. Reference in lesson markdown:
   ```markdown
   ![FIG_NNN](../../site/assets/figures/NNN-slug.svg)
   ```
5. Verify at 480px, 720px, 1200px viewport widths.

---

## Embedding in Lessons

### Interactive or Animated Figure

```markdown
```figure
widget-name-slug
```

```figure
widget-name-slug
{"configKey": "configValue"}
```
```

### Static SVG

```markdown
![FIG_005](../../site/assets/figures/005-transformer-attention-heads.svg)
```

---

## Testing

### Interactive Widgets

1. Open the lesson on the deployed site or locally via `site/lesson.html?path=phases/XX-phase/YY-lesson`.
2. Verify the figure mounts with no console errors.
3. Drag every slider — output should update in real time.
4. Test both light and dark themes (toggle top-right).
5. Test at 320px, 768px, and 1200px viewport widths.

### Animated Explainers

1. Open the target lesson page.
2. Verify the animation loops smoothly at 60 fps.
3. Hover over the figure — animation should pause.
4. Enable `prefers-reduced-motion` in browser DevTools — figure should show a static frame.

---

## Convention Summary

| Rule | Details |
|------|---------|
| Language | Vanilla ES5 for module files, ES6+ for `figures.js` |
| Dependencies | None — stdlib only |
| Theming | CSS custom properties (`var(--blueprint, #3553ff)`) |
| Reduced motion | Required — every entry point must check |
| Coordinates | Always `.toFixed(1)` |
| Figure naming | `kebab-case-slug` matching the concept |
| Registration | `LF.register({...})` for interactive, `FIGURES` map for animated |
| Embedding | ` ```figure ` fence in `docs/en.md` |
| Caption | Every figure needs an educational `.lf-cap` |
