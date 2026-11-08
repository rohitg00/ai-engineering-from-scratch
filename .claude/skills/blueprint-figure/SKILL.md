---
name: blueprint-figure
version: 1.0.0
description: >
  Draws static SVG figures for lessons, READMEs and manuals in the AI Engineering
  from Scratch look: paper panel, blueprint accent, nine figure kinds, fixed hue
  meanings, eight arrow styles, and checks for legibility and markup.
  Trigger phrases: "draw a figure", "blueprint figure", "sequence figure",
  "state machine figure", "figure for this lesson", "add a diagram to the manual".
tags: [svg, figures, diagrams, accessibility, documentation]
---

# Blueprint Figure

This skill draws one static SVG figure that explains one mechanism of a real system. The figure uses the real names from the system: ids, field names, method names, status codes and sequence numbers. It sits on a light paper panel and uses a small set of hues with fixed meanings. It stays readable at 640 units wide on screen and in print. Claude, Cursor, Codex, OpenClaw, Hermes, or any agent that reads SKILL.md can use it. The sibling skill `course-style` holds the full course tokens. This skill copies the tokens it needs, so it works alone.

## When to use

- A lesson, README or manual needs a picture of how parts of a system talk, store data, or change state.
- You have a capture, a log, a spec or source code that gives the real names.
- The claim fits one of the nine kinds below.

## When not to use

- The figure must move or respond to a slider. Use the sibling skill `motion-figure`.
- The subject is a physical machine explainer with depth and controls. Use the sibling skill `isometric-explainer`.
- The data is a chart of numbers over many points. Use a chart tool.
- You do not have real names for the parts. Get a capture or a source first.

## Method

1. Write the claim first. One sentence, at most 28 words, that the figure proves.
2. Pick one kind from the table below. If two kinds fit, draw two figures.
3. Collect the real names from the source: parties, fields, methods, codes, sequence numbers.
4. Write the hue table for the figure set before you draw (see "Colour").
5. Sketch the layout on the 640-unit grid. Keep content between x 20 and x 620.
6. Draw the figure with a script. Start from `templates/figure.mjs`. Do not edit the SVG by hand.
7. Run the script. It stops on a label that is too small, too wide, or outside the figure.
8. Run the checks in `references/checks.md`. Fix every finding.
9. Render the SVG to PNG and look at it at 100% and at 50% width.
10. Write the caption: the bold claim, how to read the figure, then the source.

## The nine kinds

| Kind | Use it for |
|---|---|
| `sequence` | parties on lifelines, time running down, numbered exchanges |
| `structure` | the anatomy of one record, object, or schema |
| `flow` | stages that data passes through, with who writes and who reads |
| `comparison` | two answers to one question, side by side |
| `timeline` | tracks over a numbered axis such as commit sequence or time |
| `tree` | ownership, containment, or delegation |
| `state` | a state machine with its transitions |
| `decision` | where something fails and what each outcome means |
| `layers` | a stack of layers with the parts each one owns |

Layout numbers for each kind are in `references/kinds.md`.

## What a figure shows

- Show the real system with real names. Never draw generic boxes such as "Component A".
- Never draw stat cards, progress bars, or decorative icons.
- Make one claim per figure.
- Compare two behaviours of the subject. Never compare with an earlier build of your own project.
- Number the exchanges in a sequence in the order they happen in the capture.

## Colour

Ten hues: `grey`, `blue`, `teal`, `violet`, `green`, `amber`, `plum`, `olive`, `indigo`, `rose`. Each hue has an ink and a fill token. A hue means the same thing in every figure of one set.

Four meanings are fixed:

| Hue | Fixed meaning |
|---|---|
| `rose` | failure: errors, crashes, aborts, lost work |
| `grey` | outside the subject: the host, the operator, out of scope |
| `amber` | lifecycle: tasks, phases, state machines |
| `teal` | durable state: storage and committed records |

Assign the other six hues once per set and write the table in the page or the manual front matter.

Write every colour as `var(--m-<token>, <light hex>)`, for example `var(--m-rose-ink, #b0344d)`. The host page supplies dark values. A README shows the light hex. All light and dark values are in `references/grammar.md`.

## Arrows

| Style | Means |
|---|---|
| solid ink | a call or request |
| dashed ink | a reply |
| solid teal | a durable write |
| dashed amber | a state change |
| solid plum | a model call or compute |
| dashed olive | an effect outside the system |
| dotted indigo | a stream or an event |
| dashed rose | a failure |

- Line width is 1.2. Dashed is `5 4`. Dotted is `1.5 3.5` with round caps.
- Use one arrowhead marker per hue, with the id `<figure-id>-head-<hue>`.
- End each arrow 1 unit before the target border.
- Figure 0.1, the first figure of a set, shows each arrow style that the set uses.

## Borders

- Solid border in the hue ink: a normal part or state.
- Dashed border: interrupted, optional, or not present.
- Double border (a second rect inset 3 units): a terminal state.
- Hatched fill: waiting time on a timeline bar. Never put text on it.

## Legibility rules

- Text is at least 11 units at the 640-unit width. That is 11 pixels on screen and about 8 points in print.
- Box titles are 12.5 bold mono. Sub lines are 11 serif. Arrow labels are 11.5. Notes are 11 serif.
- Every serif line carries its own font: `class="m-serif"` and `font-family="Source Serif 4, Georgia, serif"`. Then the figure looks the same inline on any page, in a README image, and in a manual.
- Kickers are 11, upper case, letter spacing 1.2, in ink-mute.
- No ellipsis in labels. No text over text. No text on a hatched fill. No line through text.
- A label that does not fit goes outside with a leader line or into a numbered key. Never reduce the font size.
- Put each arrow label on a knock patch in the panel colour, with `class="m-knock"`.
- Draw the knock patch after the line and before the label.
- A knock patch hides a line. It never counts as the box that a label must fit inside.
- Measure text before you place it: mono width is `characters × size × 0.6`, serif width is `characters × size × 0.54`.

## Technical rules

- Root: `viewBox="0 0 640 H"` with H at most 760, `role="img"`, `aria-labelledby="<id>-title <id>-desc"`.
- Root font and ink: `font-family="JetBrains Mono, ui-monospace, monospace"` and `fill="var(--m-ink, #1a1a1a)"`. Serif lines set their own `font-family` as above.
- A `<title>` and a `<desc>` of at least 40 characters, as direct children of the root.
- The `desc` names every part and every exchange in reading order.
- Every `id` starts with the figure id, such as `fig-4-1-head-amber`.
- Figure ids are lowercase words and digits joined by hyphens, such as `fig-4-1`.
- Use only the elements and attributes listed in `references/checks.md`.
- No `style`, no scripts, no event handlers, no links, no images.
- `transform` only as `translate()` on `<g>`.
- One `<text>` element per line of text.
- The file is at most 40 KB and has at most 450 drawn elements.

## The caption

Put the caption in the page around the SVG. Do not put it inside the SVG.

1. Start with the claim in bold: one sentence, at most 28 words, ending with a period.
2. Say how to read the figure, such as "Read top to bottom."
3. Name the source, such as the capture file.

In a manual, declare the figure in a fenced block:

````text
```figure
id: fig-4-1
kind: state
title: the task lifecycle
claim: A task ends in one of four terminal states and never leaves one.
caption: Read left to right. Dashed borders are interrupted states. From capture/out/task-states.txt.
```
````

In a lesson or README, put the SVG in an image tag or inline, then the caption as a paragraph under it.

## Keep source and output together

- Save the figure script beside the SVG, such as `figures/src/fig-4-1.js` and `figures/fig-4-1.svg`.
- Build the SVG from the script every time. Never edit the SVG by hand after a build.
- Before you commit, build again and confirm that the committed SVG equals the script output.

## Check before you finish

- [ ] The claim is one sentence of at most 28 words.
- [ ] Every label is a real name from the source. No "Component A".
- [ ] The figure uses one of the nine kinds.
- [ ] Rose means failure, grey means outside, amber means lifecycle, teal means durable state.
- [ ] Every arrow uses one of the eight styles and means what the table says.
- [ ] `viewBox` width is 640 and height is at most 760.
- [ ] `role="img"`, `aria-labelledby`, `<title>` and a `<desc>` of 40 or more characters are present.
- [ ] Every `id` starts with the figure id.
- [ ] Every colour is `var(--m-<token>, <light hex>)` with the correct hex.
- [ ] No text is below 11 units, outside the viewBox, over other text, or crossed by a line.
- [ ] No ellipsis in any label.
- [ ] Every serif line has a `font-family` attribute and the root has the ink `fill`, so the figure needs no host stylesheet.
- [ ] No `style`, script, link, image, or transform other than `translate()` on `<g>`.
- [ ] The file is at most 40 KB.
- [ ] The PNG render is readable at 50% width.
- [ ] The caption has the bold claim, the reading order, and the source.
- [ ] The committed SVG equals the script output.

## Files

- `references/kinds.md`: layout numbers for each of the nine kinds, and figure 0.1.
- `references/grammar.md`: light and dark tokens, hue meanings, arrow strokes, markers, text sizes and metrics, shapes, optional beats.
- `references/checks.md`: every check with its test, the allowed elements and attributes, and the caption rules.
- `templates/figure.mjs`: a self-contained Node script with a small figure kit and one `sequence` figure. Run `node templates/figure.mjs out.svg` to write the SVG, or omit the path to print it.

Inside the AI Engineering from Scratch repo, also see `manuals/_shared/figkit.js` (the full kit), `manuals/_shared/templates/` (one script per kind), and `scripts/audit_manuals.js` (the figure lint).
