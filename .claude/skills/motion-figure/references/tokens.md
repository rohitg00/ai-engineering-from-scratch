# Tokens for motion figures

These values come from the course stylesheet. The sibling skill `course-style` holds the full set. This file copies only what a motion figure needs, so this skill works alone.

## Colour tokens

The light theme is the default and sits on `:root`. The dark theme sits on `[data-theme="dark"]`.

| Token | Light | Dark | Use in a figure |
|---|---|---|---|
| `--bg` | `#fafaf5` | `#0a0d1a` | card and SVG background, dot outlines |
| `--bg-surface` | `#f3f1e8` | `#131830` | box fill |
| `--ink` | `#1a1a1a` | `#e8e6dc` | main labels |
| `--ink-soft` | `#4a4a4a` | `#a8a6a0` | secondary lines and labels |
| `--ink-mute` | `#7a7a78` | `#7a7878` | axis labels, the "other" series |
| `--rule-soft` | `rgba(26, 26, 26, 0.16)` | `rgba(232, 230, 220, 0.18)` | box strokes, tracks, grid lines |
| `--blueprint` | `#3553ff` | `#6b8eff` | the one accent: the subject of the figure |
| `--blueprint-tint` | `rgba(53, 83, 255, 0.08)` | `rgba(107, 142, 255, 0.12)` | pressed or active backgrounds |
| `--blueprint-tint-strong` | `rgba(53, 83, 255, 0.18)` | `rgba(107, 142, 255, 0.22)` | merged or selected cells |
| `--warn` | `#b8870f` | `#d4a83d` | the second state: over budget, failure, the other class |

Write every colour as `var(--token,<light value>)`. Example: `var(--ink-mute,#7a7a78)`.

These are the colour constants that course modules declare at the top of a file:

```js
var INK = 'var(--ink,#1a1a1a)', SOFT = 'var(--ink-soft,#555)', MUTE = 'var(--ink-mute,#777)';
var BP = 'var(--blueprint,#3553ff)', BG = 'var(--bg,#fafaf5)', SURF = 'var(--bg-surface,#eee)';
var RULE = 'var(--rule-soft,#ddd)', WARN = 'var(--warn,#b8870f)';
```

## Fonts

| Token | Value | Use |
|---|---|---|
| `--font-mono` | `'JetBrains Mono', ui-monospace, 'Consolas', monospace` | all SVG text, control labels, the head row |
| `--font-body` | `'Source Serif 4', 'Source Serif Pro', 'Iowan Old Style', Georgia, serif` | the caption |
| `--font-display` | `'VT323', ui-monospace, 'JetBrains Mono', monospace` | large status numbers |

## Motion tokens

| Token | Value | Use |
|---|---|---|
| `--motion-press` | `160ms` | button press scale (0.97) |
| `--motion-feedback` | `180ms` | colour and border change on hover or focus |
| `--motion-enter` | `220ms` | opacity and transform of reconciled nodes |
| `--motion-drawer` | `250ms` | drawers and panels |
| `--ease-out` | `cubic-bezier(0.23, 1, 0.32, 1)` | entries and feedback |
| `--ease-in-out` | `cubic-bezier(0.77, 0, 0.175, 1)` | movement between two resting places |
| `--ease-drawer` | `cubic-bezier(0.32, 0.72, 0, 1)` | drawers |

The SMIL spline `0.23 1 0.32 1` is the same curve as `--ease-out`.

## SMIL timing values

| Item | Value |
|---|---|
| Entry duration | 0.5 to 0.6 s |
| Entry start | opacity 0, scale 0.95 |
| Stagger between entries | 0.05 to 0.4 s |
| Loop duration | 2.5 to 6 s |
| Static frame time | `data-static-time` on the host, default 1.5 s |
| Element budget | 55 SVG elements per figure |
| Minimum label size | 12 SVG units |

## Card classes

| Class | Part |
|---|---|
| `.lf` | the card |
| `.lf-head` | head row: uppercase mono, 0.68 rem, letter spacing 0.16 em |
| `.lf-label` | figure name inside the head, in `--blueprint` |
| `.lf-body` | controls and output, 16 px padding |
| `.lf-grid` | two control columns, one column below 640 px |
| `.lf-ctrl` | one control: label, value, input |
| `.lf-out` | output area under a dashed rule |
| `.lf-num` | large number, 2 rem, `--blueprint` |
| `.lf-meta` | one short line of mono text under the number |
| `.lf-formula` | the formula with the current values |
| `.lf-cap` | caption in the body font |

## Reduced motion

With `prefers-reduced-motion: reduce`, the runtime shows the static frame and disables the Pause button with the text "Motion reduced". Reconciled nodes keep only the opacity, fill, and stroke transitions. Transform transitions stop.
