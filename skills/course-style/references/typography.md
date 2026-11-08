# Typography

The course uses three families. The display face is a pixel font for headings. The serif carries reading text. The mono carries labels, meta lines, figure text, and code.

## Font stacks

Copy these stacks exactly. The site and the figure tokens use the same lists.

```css
--font-display: 'VT323', ui-monospace, 'JetBrains Mono', monospace;
--font-body: 'Source Serif 4', 'Source Serif Pro', 'Iowan Old Style', Georgia, serif;
--font-mono: 'JetBrains Mono', ui-monospace, 'Consolas', monospace;
--font-heading: var(--font-display);
```

Inside a figure, use the `--m-` names: `--m-font-display`, `--m-font-body`, `--m-font-mono`. They hold the same lists.

## Loading

Load all three families with one request in the document head:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=VT323&family=Source+Serif+4:ital,opsz,wght@0,8..60,400..700;1,8..60,400..700&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
```

Use mono weights 400, 500, and 700 only. Use serif weights from 400 to 700. VT323 has one weight, so headings use `font-weight: 400`.

An SVG shown with `<img>` cannot use the web fonts of the page. Give it the full stack, so the browser picks a local face.

## Type scale

| Element | Family | Size | Other |
|---|---|---|---|
| `body` | body | `18px` | `line-height: 1.62`, `hyphens: none` |
| `p` | body | `1rem` | `line-height: 1.62` |
| `h1` | display | `clamp(min(2.4rem, 12vw), 6vw, 4.4rem)` | all headings below |
| `h2` | display | `clamp(min(1.8rem, 9vw), 4vw, 2.6rem)` | |
| `h3` | display | `clamp(min(1.2rem, 6vw), 2.6vw, 1.6rem)` | |
| `h4` | display | `1.1rem` | |
| drop cap | display | `4.2rem` | `line-height: 0.85`, colour `--blueprint` |
| logo | display | `1.6rem` | uppercase, `letter-spacing: 0.04em` |
| code, kbd, samp | mono | inherits | |

All headings `h1` to `h4` share these values:

```css
font-family: var(--font-display);
font-weight: 400;
line-height: 1;
letter-spacing: 0.02em;
text-transform: uppercase;
color: var(--blueprint);
overflow-wrap: break-word;
```

## Label styles

Labels are mono, uppercase, and tracked. Use one of these classes and do not invent a new size.

| Class | Size | Weight | Letter spacing | Colour |
|---|---|---|---|---|
| `.label` | `0.72rem` | 500 | `0.12em` | `--ink-soft` |
| `.fig-label` | `0.7rem` | 500 | `0.16em` | `--blueprint` |
| widget head (`.lf-head`) | `0.68rem` | inherits | `0.16em` | `--ink-soft`, with the name in `--blueprint` |
| widget control label | `0.7rem` | inherits | `0.08em` | `--ink-soft`, with the value in `--blueprint` |
| card meta | `0.64rem` | inherits | `0.1em` | `--ink-mute` |
| card foot | `0.68rem` | inherits | `0.08em` | `--blueprint` |
| footer text and links | `0.78rem` | inherits | `0.06em` | `--ink-mute` or `--ink-soft` |
| part number in a modal | `0.78rem` | 500 | `0.16em` | `--blueprint` |

Numbers that change, such as counts, values, and percentages, use `font-variant-numeric: tabular-nums`.

## Figure text

- Figure text is mono, or serif with the `m-serif` class. The minimum is 11 units in a 640-unit-wide viewBox. On screen this is 11px. In print it is about 8pt.
- Wide hero figures at 1200 units use 11 units for the FIG_ label and 10 units for the footer line.
- Use one `<text>` element per line. Do not position `<tspan>` children.
- Shorten a label that does not fit, or move it outside with a leader line. Never shrink it below the minimum and never add an ellipsis.
