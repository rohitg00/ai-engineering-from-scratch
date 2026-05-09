# Figure Index

Every figure shipped under `site/assets/figures/` is listed below. FIG numbers are global, monotonically increasing, and never reused.

The aesthetic is documented in the [`blueprint-diagram` skill](https://github.com/rohitg00/ai-engineering-from-scratch/blob/main/.claude/skills/blueprint-diagram/SKILL.md). To author a new figure, run the skill and append a row here.

| FIG | slug | phase | lesson | added | notes |
|---|---|---|---|---|---|
| 000 | (curriculum stack — embedded in the README banner) | — | — | 2026-05-09 | hero, lives in `assets/banner.svg` not this dir |
| 001 | exploded-view-floppy | — | — | 2026-05-09 | reference example for the skill, lives under `~/.claude/skills/blueprint-diagram/references/examples/` |
| 002 | kernel-surface-gaussian | — | — | 2026-05-09 | reference example for the skill |
| 003 | pixel-vector-bezier | — | — | 2026-05-09 | reference example for the skill |
| 004 | gaussian-kernel-blur | 1 | 8 | 2026-05-09 | gaussian blur visualization for "Optimization: Gradient Descent Family" lesson |
| 005 | transformer-attention-heads | 7 | 1 | 2026-05-09 | exploded view of multi-head attention block |

## Numbering

- `001`–`099`: reserved for early curriculum figures (Phases 0–7).
- `100`+: assigned in order of authoring.
- Sub-figures use letter suffixes: `004.A`, `004.B`. They share the parent's row.

## How to add

1. Run the `blueprint-diagram` skill with a description of the concept.
2. The skill writes the SVG to `site/assets/figures/NNN-slug.svg`.
3. The skill appends a row here with the next available number.
4. The skill (or you) wires the figure into the relevant lesson markdown via `![FIG_NNN](path)`.
5. Verify at multiple widths (480 / 720 / 1200 px) that labels do not overlap geometry.

## License

Figures inherit the repo's MIT license. They are CC-0 in spirit — copy them, modify them, ship them in your own work. Attribution appreciated, not required.
