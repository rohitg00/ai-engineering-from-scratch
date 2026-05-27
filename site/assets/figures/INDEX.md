# Figure Index

Every figure shipped under `site/assets/figures/` is listed below. FIG numbers are global, monotonically increasing, and never reused.

The aesthetic is documented in the `blueprint-diagram` Claude Code skill, which is distributed separately from this repo (per the project's "no vendor/tooling artifacts in repos" rule). The skill source lives under `~/.claude/skills/blueprint-diagram/` once installed; ask a maintainer for the install path or follow the [How to add](#how-to-add) section below for a manual workflow that does not require the skill.

| FIG | slug | phase | lesson | added | notes |
|---|---|---|---|---|---|
| 000 | (curriculum stack — embedded in the README banner) | — | — | 2026-05-09 | hero, lives in `assets/banner.svg` not this dir |
| 001 | exploded-view-floppy | — | — | 2026-05-09 | reference example for the skill, lives under `~/.claude/skills/blueprint-diagram/references/examples/` |
| 001.A | prompts | — | — | 2026-05-13 | README "every lesson ships something" card — prompt artifact icon |
| 001.B | skills | — | — | 2026-05-13 | README card — SKILL.md drop-in icon |
| 001.C | agents | — | — | 2026-05-13 | README card — ReAct-style agent loop icon |
| 001.D | mcp-servers | — | — | 2026-05-13 | README card — MCP server rack with tools/resources/prompts icon |
| 002 | kernel-surface-gaussian | — | — | 2026-05-09 | reference example for the skill |
| 003 | pixel-vector-bezier | — | — | 2026-05-09 | reference example for the skill |
| 004 | gaussian-kernel-blur | 1 | 8 | 2026-05-09 | gaussian blur visualization for "Optimization: Gradient Descent Family" lesson |
| 005 | transformer-attention-heads | 7 | 1 | 2026-05-09 | exploded view of multi-head attention block |

## Numbering

- `001`–`099`: reserved for early curriculum figures (Phases 0–7).
- `100`+: assigned in order of authoring.
- Sub-figures use letter suffixes: `004.A`, `004.B`. They share the parent's row.

## How to add

If you have the `blueprint-diagram` skill installed:

1. Run the skill with a description of the concept.
2. The skill writes the SVG to `site/assets/figures/NNN-slug.svg`, appends a row here with the next available number, and (if asked) wires the figure into the relevant lesson markdown via `![FIG_NNN](path)`.

If you don't have the skill, do it manually:

1. Author an SVG in the cream + blueprint aesthetic (cream `#fafaf5` paper, `#3553ff` blueprint blue strokes, JetBrains Mono uppercase labels with leader lines, no other chromatic accents).
2. Save as `site/assets/figures/<NNN>-<slug>.svg` using the next available FIG number from the table above.
3. Add a row to the table here with the FIG number, slug, target phase + lesson, today's date, and a one-line note.
4. Reference the figure from the lesson markdown as `![FIG_NNN](../../site/assets/figures/<NNN>-<slug>.svg)`.
5. Verify at 480 / 720 / 1200 px viewport widths — labels must not overlap geometry, leader lines must reach their targets.

## License

Figures are released under the repo's MIT license. The MIT license requires preserving the copyright notice in distributions of the source SVG; visual reuse of the rendered image (e.g. embedding in a blog post or slide deck) is fine without further attribution.
