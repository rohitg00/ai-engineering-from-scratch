# Tokens

The course has two token sets. Pages and site components use the site tokens. Static manual figures use the `--m-` figure tokens, so a figure renders the same inside any page.

Put light values on `:root`. Put dark values on `[data-theme="dark"]`. A token that has no dark value is a defect.

## Site tokens

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | `#fafaf5` | `#0a0d1a` | page paper |
| `--bg-surface` | `#f3f1e8` | `#131830` | panels, buttons at rest |
| `--bg-surface-hover` | `#ece9dc` | `#1b2244` | panel hover |
| `--ink` | `#1a1a1a` | `#e8e6dc` | body text, hard shadows |
| `--ink-soft` | `#4a4a4a` | `#a8a6a0` | secondary text, labels |
| `--ink-mute` | `#7a7a78` | `#7a7878` | meta text at large sizes only |
| `--rule` | `#1a1a1a` | `#e8e6dc` | strong borders |
| `--rule-soft` | `rgba(26, 26, 26, 0.16)` | `rgba(232, 230, 220, 0.18)` | default borders |
| `--paper-rule` | `rgba(26, 26, 26, 0.08)` | `rgba(232, 230, 220, 0.08)` | paper dot grid |
| `--blueprint` | `#3553ff` | `#6b8eff` | the one accent |
| `--blueprint-tint` | `rgba(53, 83, 255, 0.08)` | `rgba(107, 142, 255, 0.12)` | hover and selected fill |
| `--blueprint-tint-strong` | `rgba(53, 83, 255, 0.18)` | `rgba(107, 142, 255, 0.22)` | bars, ready card shadow |
| `--status-complete` | `#3553ff` | `#6b8eff` | done |
| `--status-in-progress` | `#4a4a4a` | `#c8c6c0` | in progress |
| `--status-planned` | `#b8b6ad` | `#4a4a48` | planned, non-text only |
| `--warn` | `#b8870f` | `#d4a83d` | warning marks, capstone tag |
| `--code-bg` | `#efece0` | `#131830` | code blocks |
| `--modal-bg` | `#fafaf5` | `#0f1424` | modal and menu panels |
| `--overlay-bg` | `rgba(26, 26, 26, 0.55)` | `rgba(10, 13, 26, 0.78)` | modal backdrop |
| `--header-bg` | `rgba(250, 250, 245, 0.94)` | `rgba(10, 13, 26, 0.94)` | fixed header with 10px blur |
| `--accent-hover` | `#2840d6` | `#8aa5ff` | accent hover |

These tokens have one value for both themes, because they point to other tokens:

```css
--text: var(--ink);
--text-muted: var(--ink-soft);
--border: var(--rule-soft);
--accent: var(--blueprint);
--secondary: var(--blueprint);
--complete: var(--status-complete);
--planned: var(--status-planned);
--shadow-color: var(--ink);
--shadow-hard: 3px 3px 0 var(--ink);
--shadow-hard-lg: 5px 5px 0 var(--ink);
--dot-color: var(--paper-rule);
--header-offset: 92px;
```

The paper is a dot grid on `body`:

```css
background-color: var(--bg);
background-image: radial-gradient(var(--paper-rule) 1px, transparent 1px);
background-size: 16px 16px;
background-attachment: fixed;
```

Shadows are hard offsets with no blur. Use `--shadow-hard` for menus and `--shadow-hard-lg` for modals.

## Motion tokens

| Token | Value | Use |
|---|---|---|
| `--motion-press` | `160ms` | press feedback, `scale(0.97)` |
| `--motion-feedback` | `180ms` | colour, border, and background changes |
| `--motion-enter` | `220ms` | reveals, progress bars, title entrance |
| `--motion-drawer` | `250ms` | modals and drawers |
| `--ease-out` | `cubic-bezier(0.23, 1, 0.32, 1)` | default for every entrance |
| `--ease-in-out` | `cubic-bezier(0.77, 0, 0.175, 1)` | movement between two positions |
| `--ease-drawer` | `cubic-bezier(0.32, 0.72, 0, 1)` | modals and drawers |

Motion values seen on the site:

- Reveal: from `opacity: 0` and `translateY(8px)` to `opacity: 1` and no transform. A left reveal uses `translateX(-8px)`.
- Stagger: set `--stagger-delay` on each item and add it as the transition delay.
- Modal: from `translateY(14px) scale(0.985)` to `translateY(0) scale(1)` over `--motion-drawer` with `--ease-drawer`.
- Title entrance: from `opacity: 0.82` and `translateY(6px)`, once.
- SMIL figures use the same curve as `keySplines="0.23 1 0.32 1"`.

## Figure tokens

Manual figures write each colour as `var(--m-<token>, #hex)`. The hex is always the light value below.

| Token | Light | Dark |
|---|---|---|
| `--m-paper` | `#fafaf5` | `#0a0d1a` |
| `--m-panel` | `#f3f1e8` | `#121729` |
| `--m-panel-edge` | `#e4e1d4` | `#232a45` |
| `--m-ink` | `#1a1a1a` | `#e8e6dc` |
| `--m-ink-soft` | `#4a4a4a` | `#b4b2aa` |
| `--m-ink-mute` | `#6f6f6a` | `#8a8882` |
| `--m-rule` | `rgba(26, 26, 26, 0.16)` | `rgba(232, 230, 220, 0.18)` |
| `--m-rule-strong` | `rgba(26, 26, 26, 0.42)` | `rgba(232, 230, 220, 0.45)` |
| `--m-accent` | `#3553ff` | `#6b8eff` |
| `--m-code-bg` | `#efece0` | `#131830` |

Each hue has an ink for strokes and text and a fill for box backgrounds.

| Hue | Ink light | Fill light | Ink dark | Fill dark |
|---|---|---|---|---|
| grey | `#5e5e59` | `#ecebe3` | `#b9b7ae` | `rgba(232, 230, 220, 0.08)` |
| blue | `#2f5d9a` | `#e6edf6` | `#8fb3e8` | `rgba(110, 150, 220, 0.16)` |
| teal | `#18696a` | `#e1efee` | `#6cc4c2` | `rgba(80, 180, 175, 0.15)` |
| violet | `#5b4fa3` | `#ebe8f5` | `#b3a8ec` | `rgba(150, 135, 230, 0.16)` |
| green | `#336b40` | `#e5f0e4` | `#8fcf98` | `rgba(110, 190, 120, 0.15)` |
| amber | `#85590c` | `#f5ecd9` | `#e0b45c` | `rgba(220, 170, 70, 0.15)` |
| plum | `#8a3d72` | `#f4e6ef` | `#e29ccb` | `rgba(220, 130, 190, 0.15)` |
| olive | `#515f26` | `#eef0dc` | `#c3cf7e` | `rgba(180, 190, 100, 0.15)` |
| indigo | `#4b4f9e` | `#e9e9f6` | `#a9adf0` | `rgba(140, 145, 235, 0.16)` |
| rose | `#b0344d` | `#f7e4e7` | `#f08aa0` | `rgba(235, 110, 135, 0.16)` |

The token names are `--m-<hue>-ink` and `--m-<hue>-fill`, such as `--m-teal-ink`.

### Hue meanings

Four hues have one meaning in every manual:

| Hue | Meaning |
|---|---|
| rose | failure: errors, crashes, aborts, lost work |
| grey | outside the subject: the host, the operator, out of scope |
| amber | lifecycle: tasks, phases, state machines |
| teal | durable state: storage and committed records |

Each manual gives one meaning to each of the other six hues: blue, violet, green, plum, olive, indigo. A hue keeps that meaning in every figure of the manual.

### Line styles

| Style | Dash array |
|---|---|
| solid | none |
| dashed | `5 4` |
| dotted | `1.5 3.5` |

## Measured contrast

Ratios are computed with the WCAG 2.x relative luminance formula against `--bg`. WCAG AA asks for 4.5:1 for normal text and 3:1 for large text.

| Pair | Light | Dark |
|---|---|---|
| `--ink` | 16.62 | 15.46 |
| `--ink-soft` | 8.46 | 7.95 |
| `--ink-mute` | 4.11 | 4.41 |
| `--blueprint` | 5.23 | 6.39 |
| `--warn` | 3.08 | 8.72 |
| `--m-ink-mute` | 4.82 | 5.46 |
| `--status-planned` | 1.94 | not measured |
| white on `--blueprint` | 5.48 | not used |

Rules that follow from the table:

- Set body text in `--ink` or `--ink-soft`.
- Use `--ink-mute` only for text of 24px or more, or 18.66px bold, or for marks that are not text.
- Use `--warn` for marks and tags, and pair each with a text label in `--ink` or `--ink-soft`.
- Use `--status-planned` for borders and dots only.
