# Labels and layout

## FIG_ labels for course figures

Course figures for lessons, the README, and the home page use one global number.

| Form | Example | Where |
|---|---|---|
| figure | `FIG_005` | top left of a figure, file name, alt text |
| sub-figure | `FIG_005.A` | one panel or one card of a set |
| label with title | `FIG_001 · FORWARD PASS` | figure head on a page |
| caption under an image | `FIG_001 · A` | README card caption in `<sub>` |
| named simulation | `FIG_AGT · An interactive simulation` | interactive explainers |
| footer line | `© FIG_005 · MULTI-HEAD ATTENTION · MIT` | bottom right of a hero figure |
| meta line | `PHASE 07 · LESSON 01 · MULTI-HEAD ATTENTION` | top right of a hero figure |

Rules:

- The number is three digits with leading zeros. It never changes and it is never reused.
- Numbers `001` to `099` belong to early curriculum figures, Phases 0 to 7. Numbers from `100` go in the order you write them.
- A sub-figure uses a capital letter suffix: `.A`, `.B`, `.C`. A narrow-screen variant uses `.M`.
- The separator is a middle dot `·` with one space on each side. Do not use an em dash or a colon as the separator.
- The title part is uppercase. A named simulation uses sentence case after the dot.
- The README caption must match `FIG_\d{3}\s*·\s*[A-Z]`. Translated READMEs keep it byte for byte, with a Latin capital letter.
- The file name is `<NNN>-<slug>.svg`, such as `005-transformer-attention-heads.svg`. A sub-figure file is `<NNN>-<letter>-<slug>.svg`, such as `001-a-prompts.svg`.
- The root `aria-label` or `alt` text starts with the label, then a colon, then a plain description: `FIG_001.A: a prompt, an instruction document sent to a model`.
- Add one row per figure to the figure index table: FIG number, slug, phase, lesson, date added, one-line note.

Hero figure head, at a 1200-unit width:

```svg
<text class="mono bp" x="40" y="44" font-size="11" letter-spacing="2.4">FIG_005</text>
<text class="mono mute" x="1160" y="44" font-size="11" letter-spacing="2.4" text-anchor="end">PHASE 07 · LESSON 01 · MULTI-HEAD ATTENTION</text>
<line x1="40" y1="64" x2="1160" y2="64" stroke="#3553ff" stroke-width="0.6" stroke-opacity="0.35"/>
```

## Manual figure labels

Manuals number figures by part, not by the global FIG_ number.

| Item | Format | Example |
|---|---|---|
| figure number shown | `Fig. <part>.<n>` | `Fig. 4.1` |
| figure id | `fig-<part>-<n>` | `fig-4-1` |
| front matter figure | `Fig. 0.<n>` | `Fig. 0.1` teaches the arrow and colour grammar |
| reference part figure | `Fig. R.<n>` | `Fig. R.2` |
| cover figure | `Plate I` | one per manual |
| figure index column | `Fig.` | beside the claim each figure makes |

The figure head shows three parts in order: the number, the title in lowercase, and the kind. The nine kinds are `sequence`, `structure`, `flow`, `comparison`, `timeline`, `tree`, `state`, `decision`, and `layers`.

The caption starts with the claim in bold. The claim is one sentence of at most 28 words that ends with a period. Then the caption says how to read the figure and names its source file.

Every `id` inside a manual figure starts with the figure id, because all figures share one page.

## Widget labels

An interactive lesson widget has a head row with two parts:

- The name, uppercase, in `--blueprint`: `KV-CACHE SIZER`, `GRADIENT DESCENT`, `RAG CHUNKING`.
- The action, lowercase, in `--ink-soft`: `drag the learning rate`, `pick a schedule`.

Keep the name to four words or fewer. Start the action with a verb.

## Cards

Cards sit in a grid and use square corners.

```css
.cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
  gap: 12px;
  padding: 14px;
}
.card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 170px;
  padding: 16px;
  border: 1px solid var(--rule-soft);
  background: var(--bg);
  color: var(--ink);
}
.card h3 { margin: 0; font-size: 1.45rem; line-height: 1.05; }
.card p { margin: 0; font-size: 0.92rem; color: var(--ink-soft); }
```

Card states:

| State | Border | Shadow | Text |
|---|---|---|---|
| default | `1px solid var(--rule-soft)` | none | `--ink`, body in `--ink-soft` |
| ready (a link) | `2px solid var(--blueprint)` | `4px 4px 0 var(--blueprint-tint-strong)` | as default |
| ready on hover | as ready | `6px 6px 0 var(--blueprint)`, with `translate(-2px, -2px)` | as default |
| planned | `1px dashed`, transparent background | none | title and body in `--ink-mute` |

- The top row holds the meta line and a badge, with `justify-content: space-between` and a 6px gap.
- The foot row uses `margin-top: auto`, so it stays at the bottom of every card.
- A progress bar in a foot is 6px tall on `--blueprint-tint-strong`.
- Below 560px the grid is one column.
- The hover change uses `--motion-feedback` with `--ease-out`. Remove it under reduced motion.

## Figure frames

A lesson figure frame:

| Part | Value |
|---|---|
| frame | `1px solid var(--rule-soft)`, background `--bg`, margin `28px 0`, no padding |
| head | flex row, `padding: 12px 16px`, bottom border `1px solid var(--rule-soft)` |
| body | `padding: 16px` |
| controls | two columns with a gap of `12px 24px`, one column below 640px |
| output | top border `1px dashed var(--rule-soft)`, `margin-top: 18px`, `padding-top: 14px` |
| big number | mono `2rem`, `--blueprint`, tabular numbers |
| caption | serif `0.92rem`, `--ink-soft`, `line-height: 1.5`, `padding: 12px 16px`, top border |
| animated SVG | maximum width 760px |

## Page layout

- Content container: `max-width: 1200px`, side padding `32px`.
- Header: fixed, 64px tall, inner width up to 1360px, bottom border `1px solid var(--rule-soft)`.
- Anchored headings clear the header with `scroll-padding-top: 96px`.
- Modal: up to 820px wide, `1px solid var(--ink)` border, `--shadow-hard-lg`.
- Section break: the dashed rule, a 6px band of 4px blueprint dashes over a row of tint dashes.
