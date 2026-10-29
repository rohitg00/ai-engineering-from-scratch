# Visual Style Guide — Blueprint Diagram Aesthetic

This guide defines the visual language for all diagrams and figures across the curriculum. Every figure — interactive or static, animated or still — follows these conventions so the course feels like one coherent manual, not a collage.

---

## 1. Color Palette

All colors are exposed as CSS custom properties. Interactive figures reference them via `var(--name, fallback)`. Static SVGs hardcode light-theme values.

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `--blueprint` | `#3553ff` | `#6b8eff` | Primary accent — active elements, strokes, links, labels, bar fills |
| `--blueprint-tint` | `rgba(53,83,255,0.08)` | `rgba(107,142,255,0.12)` | Subtle fill — inactive cells, backgrounds |
| `--blueprint-tint-strong` | `rgba(53,83,255,0.18)` | `rgba(107,142,255,0.22)` | Stronger tint — hovered cells, merged tokens |
| `--ink` | `#1a1a1a` | `#e8e6dc` | Primary text |
| `--ink-soft` | `#4a4a4a` | `#a8a6a0` | Secondary text, labels |
| `--ink-mute` | `#7a7a78` | `#7a7878` | Muted labels, annotations, section markers |
| `--rule-soft` | `rgba(26,26,26,0.16)` | `rgba(232,230,220,0.18)` | Grid lines, borders, neutral SVG strokes |
| `--bg` | `#fafaf5` | `#0a0d1a` | Page / figure background |
| `--bg-surface` | `#f3f1e8` | `#131830` | Card / inactive box fill |
| `--warn` | `#b8870f` | `#d4a83d` | Warning / overflow / emphasis — animated beam, trail dots |
| `--paper-rule` | `rgba(26,26,26,0.08)` | `rgba(232,230,220,0.08)` | Subtle background dot grid |

### Rules
- Never use chromatic accents beyond blueprint blue and warn amber. No reds, greens, or purples.
- Interactive figures **must** use CSS variable references (`var(--blueprint)`) so they adapt to dark mode.
- Static SVGs hardcode light values but follow the same palette.

---

## 2. Typography

### Font Stack

| Role | CSS Variable | Font | Fallback |
|------|-------------|------|----------|
| Body | `--font-body` | `Source Serif 4` | `Georgia, serif` |
| Monospace | `--font-mono` | `JetBrains Mono` | `Consolas, monospace` |
| Display | `--font-display` | `VT323` | `JetBrains Mono, monospace` |

### Sizes (Interactive Figures)

| Context | Size | Weight | Transform |
|---------|------|--------|-----------|
| Figure header (`lf-head`) | `0.68rem` | normal | uppercase, `0.16em` letter-spacing |
| Control label (`lf-ctrl label`) | `0.7rem` | normal | uppercase, `0.08em` letter-spacing |
| Large number (`lf-num`) | `2rem` | normal | tabular-nums |
| Unit annotation (`lf-num small`) | `0.9rem` | normal | `0.04em` letter-spacing |
| Meta line (`lf-meta`) | `0.7rem` | normal | `0.04em` letter-spacing |
| Formula (`lf-formula`) | `0.72rem` | normal | normal case |
| Caption (`lf-cap`) | `0.92rem` | normal | normal case |
| Select dropdown (`lf-ctrl select`) | `0.82rem` | normal | normal case |

### Sizes (Animated SVG Figures)

| Context | Size | Letter-spacing |
|---------|------|----------------|
| Section labels | 11 | `0.16em` or `0.14em` |
| Axis / token labels | 10 | `0.14em` |
| Bar / tiny labels | 9 | none |
| Formula / emphasis | 13 | `0.06em` |
| Compact figure labels | 9–10 | `0.16em` |

### Sizes (Static SVG Figures)

| Context | Size | Letter-spacing |
|---------|------|----------------|
| Figure ID (top-left) | 6.5–7 | `1.5px` |
| Section headings | 9 | `2px` |
| Body / labels | 11 | `1.4–1.6px` |
| Bottom markers | 10 | `2px` |
| Phase/lesson (top-right) | 11 | `2.4px` |

---

## 3. Line Weights

| `stroke-width` | When to use |
|---------------|-------------|
| `0.5` | Fine grid cells, decorative |
| `0.6` | Background grid lines |
| `0.8` | Dashed leader lines |
| `1` | Standard grid lines, minor borders |
| `1.2` | Structural lines, secondary borders |
| `1.4` | Arrows, primary connection lines |
| `1.5` | Box borders, important structure |
| `1.6` | Chart data curves |
| `2` | Emphasis lines, scan brackets, main data |

### Dash Patterns

| Pattern | Usage |
|---------|-------|
| `2 4` | Initial / light dashes |
| `3 3` | Standard dashes (grid markers) |
| `4 3` | Gradient descent / step paths |
| `4 4` | Residual / trail arcs |

---

## 4. Spacing & Layout

### Interactive Figure Container

```
.lf                    margin: 28px 0; border: 1px solid var(--rule-soft)
.lf-head               padding: 12px 16px; border-bottom: 1px solid var(--rule-soft)
.lf-body               padding: 16px
.lf-grid               display: grid; 2 columns; gap: 12px 24px
.lf-ctrl               flex column; gap: 4px
.lf-out                margin-top: 18px; padding-top: 14px; dashed top border
.lf-bar                height: 10px; margin-top: 12px
.lf-cap                padding: 12px 16px; border-top: 1px solid var(--rule-soft)
```

- Grid collapses to 1 column at `640px` viewport width.
- Animated SVG max-width: `760px`. Interactive widget SVG max-width: `560px`.

### Chart Padding (`PAD`)

| Figure type | PAD |
|-------------|-----|
| Interactive widgets | 28–36 |
| Animated explainers | 56–60 |
| Compact figures | 18 |

### SVG ViewBox

| Type | Dimensions | Notes |
|------|-----------|-------|
| Animated explainers | `760 × 540`, `760 × 460`, `820 × 620` | Full-width auto-height via `width: 100%; height: auto` |
| Compact animated | `720 × 220..280` | Smaller panel figures |
| Interactive SVG area | `520 × 200..280` | Inside `.lf-out`, scrolls on overflow |
| Static figure icons | `120 × 120` | README card icons |
| Static large diagrams | `1200 × 700..820` | Full-page technical diagrams |

---

## 5. Animation Principles

### Two Animation Systems

**System A — Auto-animated** (`figures.js`): Continuous loop with hover-pause.
- A single `t` parameter floats `0 → 1` over a fixed period (6–14 seconds).
- `mouseenter` pauses the loop. `mouseleave` resumes.
- Respects `prefers-reduced-motion`: renders one static frame and stops.

**System B — Interactive widgets** (`lesson-figures.js` + module files): Slider-driven, no auto-animation.
- State object drives deterministic re-render on slider/select change.
- `raf(step)` provides a `dt` (seconds elapsed) or `reduced` flag for optional micro-animations.

### Key Rules
- Animations must be **subtle and purposeful** — reveal structure or flow, never just decorate.
- **Hover interaction** can pause, highlight, or reveal — never hide critical information.
- **Easing**: use `easeIO` (cubic ease-in-out) for multi-segment motion:
  ```js
  function easeIO(t) { return t < .5 ? 2*t*t : 1 - Math.pow(-2*t+2, 2) / 2; }
  ```
- **Coordinate precision**: always `.toFixed(1)` on SVG coordinate values.
- **Deterministic**: no randomness — use seeded or pre-computed data.

### Reduced Motion Contract
1. **CSS**: `@media (prefers-reduced-motion: reduce)` disables all transitions and animations.
2. **JS**: Every animation entry point checks `matchMedia('(prefers-reduced-motion: reduce)').matches`.
3. If reduced motion is preferred, render one complete static frame and stop.

---

## 6. Figure Types & DOM Structure

### Interactive Widgets (slider-based)

```html
<div class="lf">
  <div class="lf-head">
    <span class="lf-label">UPPERCASE LABEL</span>
    <span>interaction hint</span>
  </div>
  <div class="lf-body">
    <div class="lf-grid"><!-- controls --></div>
    <div class="lf-out">
      <!-- SVG or output elements -->
    </div>
  </div>
  <div class="lf-cap">Educational caption explaining the concept.</div>
</div>
```

### Animated SVG Figures (auto-loop)

```html
<div class="lesson-figure lf-animated">
  <svg viewBox="0 0 760 540" width="100%" role="img" aria-label="...">
    <!-- animated SVG content -->
  </svg>
</div>
```

### Static SVG Figures (`site/assets/figures/`)

```html
<svg viewBox="0 0 1200 700" role="img" aria-label="...">
  <rect width="1200" height="700" fill="#fafaf5"/>
  <!-- paper dot pattern overlay -->
  <!-- blueprint strokes with .bp class -->
  <!-- JetBrains Mono labels with .mono class -->
</svg>
```

---

## 7. Helper Conventions

### LF Toolkit (`window.LF`)

| Method | Purpose | Signature |
|--------|---------|-----------|
| `el` | Create HTML element | `el(tag, attrs, kids)` |
| `svgEl` | Create SVG element | `svgEl(tag, attrs, kids)` |
| `slider` | Range input | `slider(state, key, label, min, max, step, fmt?)` |
| `select` | Dropdown | `select(state, key, label, options)` |
| `fmtInt` | Locale integer | `fmtInt(n)` → `"1,234"` |
| `fmtSeq` | Human-readable count | `fmtSeq(2048)` → `"2K"` |
| `clamp` | Clamp value | `clamp(x, lo, hi)` |
| `lerp` | Linear interpolation | `lerp(a, b, t)` |
| `raf` | Animation frame loop | `raf(step)` |
| `register` | Register figure widget | `register({'name': fn})` |

### Box + Arrow Pattern (for flow diagrams)

```js
// Box with rounded rect + centered text
box(x, y, w, h, label, isActive) → <g>

// Line with arrowhead marker
arrow(x1, y1, x2, y2, dash?) → <line>

// Arrowhead defs — module-scoped to avoid ID collisions
arrowDefs() → <defs>
```

### State Object Convention

```js
var state = { param1: default1, param2: default2 };
state._render = function () {
  // 1. Clear SVG: while (svg.firstChild) svg.removeChild(svg.firstChild);
  // 2. Rebuild all visual elements from state
  // 3. Update text nodes for status, meta, formula
};
// Controls call state._render() automatically via slider/select
state._render(); // initial render
```

---

## 8. Accessibility

- Every top-level SVG needs `role="img"` and `aria-label`.
- Interactive controls use native `<label>` elements.
- Figures are keyboard-navigable — sliders respond to arrow keys by default.
- Reduced-motion detection is required (see §5).
- Captions provide context that screen readers can access.

---

## 9. File Organization

```
site/
  figures.js                   — 10 core animated SVG explainers
  lesson-figures.js            — LF toolkit + 3 interactive widgets (mount system)
  figures-math.js              — Phase 1 (math) widgets
  figures-ml.js                — Phase 2 (ML) widgets
  figures-dl.js                — Phase 3 (deep learning) widgets
  figures-vision-speech.js     — Phases 4, 6 (vision, audio) widgets
  figures-transformers.js      — Phases 5, 7 (NLP, transformers) widgets
  figures-genai-rl.js          — Phases 8, 9 (generative AI, RL) widgets
  figures-llms-systems.js      — Phases 10, 12, 13 (LLMs, multimodal, tools) widgets
  figures-agents-alignment.js  — Phases 11, 14, 16, 18 (agents, alignment) widgets
  figures-math2.js             — Phase 1 (advanced math) widgets
  figures-nlp2.js              — Phase 5 (advanced NLP) widgets
  figures-llms2.js             — Phase 10 (LLM internals) widgets
  figures-infra.js             — Phase 17 (infrastructure) widgets
  figures-frontier.js          — Phases 15, 19 (autonomy, capstones) widgets
  assets/figures/              — Static SVG figures (FIG-NNN-slug.svg)
    INDEX.md                   — Figure catalog
    STYLE.md                   — This file
```

---

## 10. Review Checklist

Before submitting a figure PR, verify:

- [ ] Colors use CSS variables, not hardcoded values (interactive figures)
- [ ] `prefers-reduced-motion` is handled
- [ ] SVG has `role="img"` and `aria-label`
- [ ] All text uses the correct `font-family` (JetBrains Mono for labels)
- [ ] Figure renders in both light and dark themes
- [ ] No external dependencies
- [ ] Coordinates use `.toFixed(1)`
- [ ] Caption explains the educational concept
- [ ] Figure self-terminates (no infinite loops, no API calls)
- [ ] Works on mobile (grid collapses to 1 column)
