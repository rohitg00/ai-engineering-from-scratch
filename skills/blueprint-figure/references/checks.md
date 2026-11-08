# Checks a figure must pass

Each check below has a rule name and a test that a script or a reviewer can run on the SVG file. Inside the AI Engineering from Scratch repo, `scripts/audit_manuals.js` runs all of them. Outside the repo, run the checks in `templates/figure.mjs` and read the list below by hand.

## Root and accessibility

| Rule | Test |
|---|---|
| viewBox | `viewBox="0 0 640 H"`, with H at most 760 |
| role | the root has `role="img"` |
| labels | the root has `aria-labelledby="<id>-title <id>-desc"` |
| title | a `<title id="<id>-title">` with text, as a direct child of the root |
| desc | a `<desc id="<id>-desc">` of at least 40 characters, as a direct child of the root |
| ids | every `id` starts with `<id>-`, because all figures share one page |
| font | the root has the mono `font-family`, and every `m-serif` text has the serif `font-family` |
| ink | the root has `fill="var(--m-ink, #1a1a1a)"`, so text with no `fill` is visible on a dark page |

The `desc` lists the real parts and what happens between them, in reading order. A screen reader user gets the full figure from it.

## Allowed markup

Elements:

```text
svg title desc defs g rect line path polyline polygon
circle ellipse text tspan marker pattern animate animateTransform animateMotion
```

Attributes:

```text
xmlns viewBox role aria-labelledby font-family id class x
y x1 y1 x2 y2 cx cy r
rx ry width height d points fill stroke
stroke-width stroke-dasharray stroke-linecap stroke-linejoin stroke-opacity fill-opacity opacity transform
font-size font-weight font-style text-anchor letter-spacing marker-start marker-end refX
refY markerWidth markerHeight markerUnits orient patternUnits patternTransform data-beat
attributeName type values keyTimes keySplines keyPoints calcMode dur
begin path
```

Classes: `m-serif`, `m-knock`, `m-packet`. No other class.

Not allowed: `style` elements or attributes, scripts, event handlers, links, images, `foreignObject`.

## Size and structure

| Rule | Test |
|---|---|
| figure-size | the file is at most 40 KB and has at most 450 drawn elements |
| figure-transform | `transform` only on `<g>`, and only as `translate(x, y)` |
| figure-tspan | one `<text>` per line, no positioned `<tspan>` (no x, y, dx, dy, rotate) |
| figure-text | nothing but text and plain `<tspan>` inside `<text>` |
| figure-color | every `fill` and `stroke` is `none`, `transparent`, `currentColor`, `url(#<id>-...)`, or `var(--m-<token>, #hex)` |
| figure-color | the hex in each `var()` equals the light value of that token |

## Legibility

| Rule | Test |
|---|---|
| figure-font | every text has a font size of at least 11 units |
| figure-bounds | every text box sits at least 1 unit inside the viewBox |
| figure-ellipsis | no `…` and no `...` in any label |
| figure-spill | a text inside a box keeps 2 units from each side and 1 unit from top and bottom |
| figure-overlap | no two text boxes overlap by more than 0.5 units |
| figure-crossing | no line or path crosses a text box, unless a knock patch or an opaque rect is drawn between the line and the text |
| figure-hatch | no text sits on a hatched fill |
| figure-lexicon | no figurative or stock AI word in labels, title, or desc |

Measure a text box with the metrics in `grammar.md`: mono `0.6 × size` per character, serif `0.54 × size`, top at `y − 0.78 × size`, bottom at `y + 0.22 × size`. The crossing test shrinks the text box by 1.5 units on each side before it tests a line.

When a label does not fit:

1. Shorten it to the real name, without an ellipsis.
2. If it is still too long, put it outside the box with a leader rule.
3. If there are many, put a number in the box and the text in a numbered key.

Never reduce the font size below 11 to make a label fit.

## Animation (only when the figure has beats)

| Rule | Test |
|---|---|
| begin | `begin="indefinite"` |
| fill | `fill="freeze"` |
| dur | a positive number of seconds, such as `0.45s` |
| values | no `var()` inside `values` |
| keyTimes | starts at 0, ends at 1, never decreases, and has one entry per value (or per key point) |
| keySplines | one entry fewer than keyTimes, four numbers from 0 to 1 each, only with `calcMode="spline"` |
| keyPoints | only with `calcMode="linear"` |
| beat group | every `<g data-beat>` holds an opacity `<animate>` |

## Caption

Put the caption in the page. Do not put it inside the SVG.

| Rule | Test |
|---|---|
| figure-claim | the caption starts with the claim in bold: one sentence, at most 28 words, ending with a period |
| reading | the next sentence says how to read the figure |
| source | the last sentence names the source file or capture |

## Sources

| Rule | Test |
|---|---|
| figure-drift | when a script draws the figure, the committed SVG equals the script output |
| figure-orphan | every SVG file in the figures folder is used by a page |
