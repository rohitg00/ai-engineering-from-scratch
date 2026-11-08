# Figure grammar: tokens, hues, arrows, sizes

This file holds the exact values that a figure uses. The sibling skill `course-style` holds the full course tokens. The values below are copied here so this skill works alone.

## Neutral tokens

| Token | Light | Dark | Use |
|---|---|---|---|
| `--m-paper` | `#fafaf5` | `#0a0d1a` | page, step circle fill, table row fill |
| `--m-panel` | `#f3f1e8` | `#121729` | figure background, label knock patch |
| `--m-panel-edge` | `#e4e1d4` | `#232a45` | table row border, figure frame |
| `--m-ink` | `#1a1a1a` | `#e8e6dc` | default text, call and reply arrows |
| `--m-ink-soft` | `#4a4a4a` | `#b4b2aa` | sub lines, notes, field names |
| `--m-ink-mute` | `#6f6f6a` | `#8a8882` | kickers, lifelines, tree edges, hatch |
| `--m-accent` | `#3553ff` | `#6b8eff` | blueprint accent, outside figure bodies |

## Hue tokens

Each hue has an ink (strokes, arrow lines, coloured text) and a fill (box background).

| Hue | Ink light | Fill light | Ink dark | Fill dark |
|---|---|---|---|---|
| `grey` | `#5e5e59` | `#ecebe3` | `#b9b7ae` | `rgba(232, 230, 220, 0.08)` |
| `blue` | `#2f5d9a` | `#e6edf6` | `#8fb3e8` | `rgba(110, 150, 220, 0.16)` |
| `teal` | `#18696a` | `#e1efee` | `#6cc4c2` | `rgba(80, 180, 175, 0.15)` |
| `violet` | `#5b4fa3` | `#ebe8f5` | `#b3a8ec` | `rgba(150, 135, 230, 0.16)` |
| `green` | `#336b40` | `#e5f0e4` | `#8fcf98` | `rgba(110, 190, 120, 0.15)` |
| `amber` | `#85590c` | `#f5ecd9` | `#e0b45c` | `rgba(220, 170, 70, 0.15)` |
| `plum` | `#8a3d72` | `#f4e6ef` | `#e29ccb` | `rgba(220, 130, 190, 0.15)` |
| `olive` | `#515f26` | `#eef0dc` | `#c3cf7e` | `rgba(180, 190, 100, 0.15)` |
| `indigo` | `#4b4f9e` | `#e9e9f6` | `#a9adf0` | `rgba(140, 145, 235, 0.16)` |
| `rose` | `#b0344d` | `#f7e4e7` | `#f08aa0` | `rgba(235, 110, 135, 0.16)` |

Write every colour in the SVG as `var(--m-<token>, <light hex>)`. Example: `fill="var(--m-teal-fill, #e1efee)"`. The host page sets the dark values on `[data-theme="dark"]`. A file shown without the host stylesheet, such as a README image, uses the light hex.

To add dark mode to a host page, copy the `Dark` column into a `[data-theme="dark"] { ... }` rule with the same `--m-` names.

## Fixed hue meanings

Four hues mean the same thing in every figure set:

| Hue | Meaning |
|---|---|
| `rose` | failure: errors, crashes, aborts, lost work |
| `grey` | outside the subject: the host, the operator, out of scope |
| `amber` | lifecycle: tasks, phases, state machines |
| `teal` | durable state: storage and committed records |

Assign `blue`, `violet`, `green`, `plum`, `olive` and `indigo` once per figure set. Write the table down (hue and meaning) before you draw the first figure. One worked table from a manual about an agent protocol:

| Hue | Meaning |
|---|---|
| `violet` | the client agent and what it sends |
| `blue` | remote agents, their cards, and the messages they send back |
| `green` | parts and artifacts: the content a task produces |
| `indigo` | streams, subscriptions, and push notifications |
| `plum` | the model or logic inside an agent |
| `olive` | tools and systems an agent calls on its own |

## Arrow styles

Eight styles. Use no others.

| Style key | Line | Means |
|---|---|---|
| `call` | solid ink | a call or request |
| `reply` | dashed ink | a reply |
| `write` | solid teal | a durable write |
| `state` | dashed amber | a state change |
| `model` | solid plum | a model call or compute |
| `effect` | dashed olive | an effect outside the system |
| `event` | dotted indigo | a stream or an event |
| `fail` | dashed rose | a failure |

Stroke values:

- Line width `1.2`.
- Dashed: `stroke-dasharray="5 4"`.
- Dotted: `stroke-dasharray="1.5 3.5"` with `stroke-linecap="round"`.
- Paths: `fill="none"` and `stroke-linejoin="round"`.
- Edges in a tree: style `call` with hue `ink-mute` and no arrowhead.

Arrowhead marker, one per hue, with the id `<figure-id>-head-<hue>`:

```xml
<marker id="fig-1-1-head-teal" viewBox="0 0 10 10" refX="9" refY="5"
  markerWidth="8" markerHeight="8" markerUnits="userSpaceOnUse"
  orient="auto-start-reverse">
  <path d="M0 1 L10 5 L0 9 z" fill="var(--m-teal-ink, #18696a)"/>
</marker>
```

End an arrow 1 unit before the target edge: `x2 = target.x - 1` for a box on the right, `target.x + target.w + 1` for a box on the left. The marker tip then touches the border.

In the first figure of a set (figure 0.1), show each arrow style that the set uses. Label each one with its meaning, for example `a durable write · solid teal`.

## Borders

| Border | Means |
|---|---|
| solid, hue ink | a normal part or state |
| dashed (`5 4`) | interrupted, optional, or not present |
| double (second rect inset 3 units) | terminal state |
| hatched fill | waiting time on a timeline bar, never under text |

## Text sizes and metrics

| Element | Size | Weight and face | Colour |
|---|---|---|---|
| box title | 12.5 | 700, mono | ink |
| box sub line | 11 | serif (`class="m-serif"` and `font-family`) | ink-soft |
| kicker (column or group heading) | 11, upper case, `letter-spacing="1.2"` | mono | ink-mute |
| arrow label | 11.5 | mono | the arrow hue, or ink for call and reply |
| arrow note | 11, 15 units below the arrow | serif | ink-soft |
| step number | 11 in a circle of r 9 | mono | ink |
| table cell text | 12 | mono | ink or ink-soft |

Every text element carries its own font and colour. Then the figure looks the same inline on a page, in a README image, and in a manual:

- The root sets `font-family="JetBrains Mono, ui-monospace, monospace"` and `fill="var(--m-ink, #1a1a1a)"`. Text with no `fill` takes the ink colour from the root.
- Each serif line sets `class="m-serif"` and `font-family="Source Serif 4, Georgia, serif"`.
- Keep the explicit `fill` on every shape and on every text that uses another hue.

Measure text width with these factors:

- mono: `characters × size × 0.6`
- serif: `characters × size × 0.54`
- letter spacing adds `(characters − 1) × spacing`
- the text box runs from `y − 0.78 × size` to `y + 0.22 × size`

Without the `font-family` attribute, a serif line renders in mono on a page that has no `.m-serif` rule. Then long lines run past their boxes.

## Shapes

| Shape | Values |
|---|---|
| lifeline | `ink-mute`, width 1, `stroke-dasharray="2 3"` |
| step circle | r 9, fill paper, stroke ink width 1, number at `y + 4` |
| dot | r 2.5 |
| rule | width 1, ink-mute unless the rule carries meaning |
| knock patch | `class="m-knock"`, fill panel, 3 units wider each side, 2 above the text top, height size + 4 |
| hatch pattern | 6 × 6 user units, `patternTransform="rotate(45)"`, ink-mute line at opacity 0.4, rect stroke ink-mute at opacity 0.35 |

## Beats (optional animation)

A figure can reveal its parts in numbered beats. The figure stays complete and readable when nothing plays. Each beat is a `<g data-beat="n">` (n from 1 to 40) that holds:

- an `<animate attributeName="opacity" values="0;0;1">`
- an `<animateTransform type="translate" values="0 4;0 4;0 0">`
- `begin="indefinite"`, `fill="freeze"`, `calcMode="spline"`, `keySplines="0 0 1 1;0.23 1 0.32 1"`

Beat n starts at `(n − 1) × 0.6` s and fades over 0.45 s. The host page script starts the animations. For animation inside lessons, use the sibling skill `motion-figure`.
