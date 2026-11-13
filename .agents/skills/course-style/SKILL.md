---
name: course-style
version: 1.0.0
description: >
  The shared visual and writing reference for AI Engineering from Scratch pages, figures, and manuals.
  Use it for light and dark colour tokens, font stacks, FIG_ label formats, and card layout.
  Use it for the plain technical English rules and the accessibility and reduced motion defaults.
  Trigger phrases: "course style", "blueprint palette", "course tokens", "FIG label",
  "plain technical English", "check my prose", "course fonts", "dark mode tokens"
tags: [design-system, tokens, typography, writing, accessibility]
---

# Course style

This skill is the reference layer for the AI Engineering from Scratch look and voice. Other craft skills point here for exact values: blueprint-figure, motion-figure, isometric-explainer, and write-manual. Use it with Claude, Cursor, Codex, OpenClaw, Hermes, or any agent that reads SKILL.md. It holds no drawing method of its own. It tells you which colour, font, label, spacing, and word to use, and how to check each one.

## When to use

- You write or review a page, a card, a figure, or a manual for the course.
- You need a token value for light or dark mode.
- You need the label format for a figure, a sub-figure, or a widget.
- You need to check prose against the plain technical English rules.
- You add motion and need the timing, the easing, and the reduced motion behaviour.

## When not to use

- You draw a static SVG figure. Use blueprint-figure, which cites this skill.
- You build an animated or slider figure. Use motion-figure.
- You build an isometric machine explainer. Use isometric-explainer.
- You write a full manual. Use write-manual for the structure and the audit.
- The page belongs to a different product with its own brand.

## Method

1. Set the theme. Put the light tokens on `:root` and the dark tokens on `[data-theme="dark"]`. Copy them from `references/tokens.md`.
2. Pick the token set. Pages use the site tokens. Manual figures use the `--m-` tokens.
3. Load the three fonts with the exact link in `references/typography.md`. Use the stacks as given.
4. Give each figure a label in the format from `references/labels-and-layout.md`.
5. Build cards and figure frames with the measurements in `references/labels-and-layout.md`.
6. Add motion only with the motion tokens. Add the reduced motion block from `references/accessibility.md`.
7. Write the prose. Then check every line against `references/plain-english.md`.
8. Run the checklist below. Fix each failure before you finish.

## Rules

### Colour

- Use one accent per page: `--blueprint` (`#3553ff` light, `#6b8eff` dark). Status tokens and manual figure hues are the only other colours.
- Write every colour as a CSS variable. A hex value is allowed only as the default inside `var()`.
- Define every token in both themes. A token without a dark value is a defect.
- Put body text in `--ink` or `--ink-soft` only.
- Do not use `--ink-mute` or `--warn` for body text. Their contrast on the paper is below 4.5:1.
- Keep the four fixed figure hues: rose for failure, grey for outside, amber for lifecycle, teal for durable state.
- Use no gradients except the paper dot grid and the dashed rule. Use no rounded corners on cards or frames.

### Type

- Headings use the display font, weight 400, uppercase, letter spacing 0.02em, colour `--blueprint`.
- Body text uses the serif at 18px with line height 1.62.
- Labels, meta lines, and code use the mono font, uppercase for labels, letter spacing 0.06em to 0.16em.
- Figure text is at least 11 units at a 640-unit width.

### Labels

- A course figure number is `FIG_` plus three digits, such as `FIG_005`. Numbers are never reused.
- A sub-figure adds a dot and a capital letter: `FIG_005.A`.
- Separate label parts with a middle dot and one space on each side: `FIG_001 · FORWARD PASS`.
- A manual figure is `Fig. <part>.<n>`, such as `Fig. 4.1`. Its id is `fig-4-1`.

### Prose

- Sentences have at most 25 words. Instructions have at most 20 words and use the imperative.
- A paragraph has one topic and at most six sentences.
- Use no em dashes, no en dashes, no semicolons, and no contractions.
- Never write "may". Write "can", or state the condition.
- Use none of the banned words in `references/plain-english.md`.
- Code spans, fenced code, quotes, and citations are exempt.

### Motion and access

- Use only the four durations: 160, 180, 220, and 250 ms.
- Page reveals start 8px away at opacity 0 and use `--ease-out`. Modals start 14px lower at scale 0.985.
- Pressed buttons scale to 0.97.
- Under `prefers-reduced-motion: reduce`, remove transitions and animations and show the final state.
- Every focusable control shows a 2px solid `--blueprint` outline at a 2px offset.
- Touch targets in menus and figure controls are at least 44px tall.

## Check before you finish

- [ ] Every colour is a `var(--token)`, and each token has a light and a dark value.
- [ ] The page uses one accent colour.
- [ ] No body text uses `--ink-mute` or `--warn`.
- [ ] Fonts load from the one Google Fonts link, and the stacks match `references/typography.md`.
- [ ] Every figure has a label in a format from `references/labels-and-layout.md`.
- [ ] No label uses an em dash as a separator.
- [ ] Every transition uses a motion token, and a reduced motion block exists.
- [ ] Every control has a visible focus outline. Menu rows and figure controls are 44px tall or more.
- [ ] The prose check in `references/plain-english.md` reports zero hits.
- [ ] You switched the theme to dark and read the page again.

## Files

- `references/tokens.md`: site and figure tokens for light and dark, hue meanings, motion tokens, measured contrast.
- `references/typography.md`: font stacks, the font link, type scale, and label styles.
- `references/labels-and-layout.md`: FIG_ formats, file names, card layout, and figure frames.
- `references/plain-english.md`: the full prose rule list, the banned words, and a checker.
- `references/accessibility.md`: focus, targets, figure markup, theme start-up, and reduced motion.

Inside the AI Engineering from Scratch repo, the source values live in `site/style.css`, `manuals/_shared/tokens.css`, and `scripts/audit_manuals.js`.
