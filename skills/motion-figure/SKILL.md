---
name: motion-figure
version: 1.1.0
description: >
  Builds figures that move or respond to the reader, in three tiers: SMIL animations and slider
  widgets inside lessons, interactive mechanism figures that show the named parts of a real
  system with a computed verdict, and ordered dither bands in the course palette. Triggers:
  "animated figure", "add a slider widget", "interactive figure", "show how this system works",
  "make this diagram move", "dither masthead", "mechanism figure", "figure fence".
tags: [figures, svg, smil, animation, interactive, dither]
---

# Motion figure

This skill makes figures that move or respond to input. It has three tiers. Use this skill with Claude, Cursor, Codex, OpenClaw, Hermes, or any agent that reads SKILL.md.

| Tier | What it makes | Where it goes |
|---|---|---|
| 1. Lesson figure | Declarative SMIL animation, or a slider widget that redraws an SVG. Both mount from a ```figure fence. | Course lessons |
| 2. Mechanism figure | An HTML panel that shows the named parts of a system. The reader drives one control and reads a computed verdict. | Standalone pages, READMEs, essays, the course site outside lessons |
| 3. Dither field | A WebGL band of ordered dither dots in the paper, accent, and ink colours, with four seeded motions. | Page mastheads and section breaks |

Tier 1 has the most rules, because the lesson runtime has hard limits. Tiers 2 and 3 have their own reference files.

## When to use

- A lesson explains a process that changes over time: a token that moves through stages, a queue that fills, a loop that repeats.
- A lesson explains a formula where one input changes the output: learning rate, temperature, chunk size, batch size.
- An author writes "animate this figure", "add a slider", or "make the diagram interactive".
- A page needs a demo where the reader changes one thing and sees what the system does: a cache, a queue, a context window, a router. Use tier 2.
- A page needs a slow moving header in the course colours. Use tier 3.

## When not to use

- The idea is a fixed structure with no time axis and no input. Make a static SVG figure. The sibling skill `blueprint-figure` covers static figures.
- The page is a full explainer page with its own state model and machine geometry. The sibling skill `isometric-explainer` covers that.
- You only need palette, fonts, or prose rules. The sibling skill `course-style` holds those. This skill copies the parts it needs into `references/tokens.md`.

## Method

1. Write one sentence that names the single change the figure shows. If you need two sentences, make two figures.
2. Pick the tier. Inside a lesson, use tier 1. For tier 2, read `references/mechanism-figures.md` and start from `templates/mechanism.html`. For tier 3, read `references/dither-fields.md` and copy `templates/dither.js`. The steps below are for tier 1. In tier 1, use an animated figure when time is the variable. Use a slider widget when a number is the variable.
3. Pick a name in kebab case, for example `request-path` or `context-budget`. Search the registry for that name first. A later module that registers the same name replaces the earlier figure.
4. Put the code in a module file named `figures-<topic>.js`. Wrap it in an IIFE, read `window.LF`, and return early if it is missing.
5. Write a figure function `function (host, cfg)`. It appends one `.lf` card to `host` and can return a dispose function.
6. Build the card: `.lf-head` with an uppercase `.lf-label` and a short hint, `.lf-body`, and `.lf-cap` with the caption.
7. Use `viewBox="0 0 520 H"` for the SVG. Most course figures use an H from 200 to 250. A single bar needs less.
8. Add a `<title>` and a `<desc>` with ids that you create once, outside any render function.
9. For an animated figure, add entries first, then one slow loop. Follow `references/smil-rules.md` line by line.
10. For a slider widget, define `state._render` before you call `LF.slider` or `LF.select`. Then call `state._render()` once at the end.
11. Call `LF.register({ 'your-name': fn })` at the end of the module.
12. In the lesson Markdown, add the fence. Put the name on the first line and optional JSON config after it:

    ````markdown
    ```figure
    context-budget {"windowK": 32}
    ```
    ````

13. Run the checks in "Check before you finish". Look at the figure in light theme, dark theme, at 375 px width, and with reduced motion on.

## How the page mounts a figure

- The Markdown parser turns the fence into `<div class="lesson-figure" data-figure="name {json}">`.
- The site build scans lesson Markdown for fence names. It finds the module file that contains the quoted name and writes a manifest. A fence name with no provider stops the build.
- The page loads only the modules that the lesson needs, in a fixed order. New module files go after the listed ones, in alphabetical order.
- The mount function reads the first word as the name and parses the rest as JSON. Bad JSON gives an empty `cfg`.
- If the figure function throws, the runtime empties the host and logs a warning. The rest of the lesson still renders.
- After mount, the runtime adds a title, a description, `role="img"`, and control labels if they are missing. It adds a Pause button when the figure has SMIL animation, and a Replay button when any animation plays once.
- The runtime pauses animation when the figure leaves the viewport, when the tab is hidden, and when the reader presses Pause. With reduced motion or print, it shows the static frame.

`references/toolkit.md` describes every runtime function and has two complete example modules.

## Rules

Animated figures:

1. Use only `<animate>`, `<animateTransform>`, and `<animateMotion>`. Do not use `setInterval` or `requestAnimationFrame` in a figure.
2. Keep each figure at 55 SVG elements or fewer.
3. Entries go from opacity 0 and scale 0.95 to opacity 1 and scale 1. Never start a scale at 0.
4. Entries use `calcMode="spline"` and `keySplines="0.23 1 0.32 1"`. Entry duration is 0.5 to 0.6 s.
5. Stagger entry begins by 0.05 to 0.4 s. Exits are shorter than entries.
6. Loops last 2.5 to 6 s and use `repeatCount="indefinite"`. Do not set `fill="freeze"` on a loop, because the runtime then plays it once.
7. Each `keyTimes` list has as many entries as `values`. It starts at 0, ends at 1, and never decreases.
8. Each `keySplines` list has one entry fewer than `keyTimes`. Use it only with `calcMode="spline"`.
9. An `animateMotion` with `keyPoints` uses `calcMode="linear"`. Its keyPoints count equals its keyTimes count. It has no `values`.
10. Do not put `var()` in an animated `fill` or `stroke` value. Animate the opacity of a second element that has the target colour.
11. Loops animate only opacity, transform, `stroke-dashoffset`, or motion along a path. The runtime makes any animation of x, y, x1, y1, x2, y2, width, height, r, cx, cy, rx, or ry play once.
12. The frame at the host's `data-static-time` (default 1.5 s) is complete and readable. Set the attribute on the host when a later moment shows the full state.
13. Scale an element around its centre. Draw the content of a group around (0, 0) and move the group with `translate`. Add the scale with `additive="sum"`.

Slider widgets:

14. Write ES5 only: `var`, function expressions, string concatenation. No arrow functions, `let`, `const`, or template literals.
15. Define `state._render` before the first `LF.slider` or `LF.select` call. The slider wraps the render function when you create it.
16. In `state._render`, remove all SVG children and add them again. Do not edit nodes in place.
17. Create ids once, outside `state._render`. The runtime removes attributes that the new nodes do not have, ids included.
18. Grow bars by length or by `stroke-dasharray` on a path. Do not grow bars with scale, because reconciled nodes scale from their centre.
19. Keep each slider label short and lowercase with the unit in brackets, for example `chunk size (tokens)`.

Both kinds:

20. Take every colour from a CSS variable with the light theme value as its default, for example `var(--blueprint,#3553ff)`. Use literal hex only when no variable works.
21. Use at most one accent colour (`--blueprint`) for the main subject and `--warn` for one second state. Use ink and rule tokens for the rest.
22. Set SVG text at 12 units or larger, in `var(--font-mono)`. If labels must be smaller, give the SVG a minimum width of 500 px and let it scroll sideways.
23. Measure label size on a phone. On a 375 px screen, a 520-unit SVG inside the card drew 279 px wide. A 12-unit label then drew at about 6.4 px.
24. Write the caption in plain technical English. Name what each colour means. Keep sentences at 25 words or fewer.
25. Give the label in `.lf-label` in uppercase, two to four words.

Mechanism figures (tier 2):

26. Show real names and real numbers: file names, keys, token counts. Never `item 1` or a grey bar with no name.
27. Give the reader one control: step, slider, toggle, play, or stop a part.
28. End with a verdict line in text, computed from the numbers in the body. Never write a fixed outcome.
29. Run once when 35 percent of the figure is visible, add a Replay button, and never loop.
30. Animate `transform` and `opacity` only, with `cubic-bezier(0.23, 1, 0.32, 1)`. Press 120 to 160 ms, reveal 200 to 300 ms, fold 380 to 500 ms.
31. Stagger lists by 30 to 70 ms per item, for the first 8 items only.
32. Keep every label whole at every frame: no ellipsis, no overlap, no text on dots. Text 11 px or more, verdict 12.5 px or more.
33. At 320 px, stack the panels in one column and give each control a 40 px touch target.
34. Use a mechanism that no other page on the site uses, and add it to the site's mechanism table.

Dither fields (tier 3):

35. Read the colours from `--bg`, `--blueprint`, and `--ink`, and redraw when `data-theme` changes.
36. Draw at 30 frames per second at most, and only while the band is visible.
37. With reduced motion, draw one static frame. Without WebGL, show a static hatch.
38. Mark the band `aria-hidden="true"` and put no text on the dots except the label chip.

## Check before you finish

- [ ] The fence name matches the registered name exactly, and no other module registers it.
- [ ] The module has no `=>`, `let`, `const`, or backtick strings.
- [ ] The module has no `setInterval` and no `requestAnimationFrame`.
- [ ] The validator in `references/smil-rules.md` returns an empty list for the mounted host.
- [ ] Each animated figure has 55 SVG elements or fewer.
- [ ] Every loop has a duration from 2.5 to 6 s.
- [ ] No loop animates a geometry attribute from rule 11.
- [ ] With reduced motion on, the figure shows a complete picture and no element is missing.
- [ ] In dark theme, every line and label is visible.
- [ ] At 375 px width, every label is readable and the page has no sideways scroll outside the figure.
- [ ] For a widget, moving each slider to its minimum and maximum gives no `NaN`, no negative widths, and no console errors.
- [ ] The SVG has one title and one description, and their ids stay the same after a slider moves.
- [ ] The caption names every colour that the figure uses.
- [ ] Tier 2: every item in the checklist at the end of `references/mechanism-figures.md` passes.
- [ ] Tier 3: every item in the checklist at the end of `references/dither-fields.md` passes.

## Files

- `references/smil-rules.md`: the twelve SMIL rules in full, what each rule prevents, and a validator you can run in the browser console.
- `references/toolkit.md`: the `LF` functions and the mount sequence. It also has a complete slider widget, a complete SMIL figure, and a preview page for use outside the course site.
- `references/tokens.md`: colour tokens for light and dark themes, fonts, and motion timing values.
- `references/mechanism-figures.md`: tier 2. Real names, rejected figures, mechanism shapes, anatomy, verdict, motion budget, and checks.
- `references/dither-fields.md`: tier 3. How the shader draws, the four motions, markup, rules, dithered bars, and checks.
- `templates/mechanism.html`: a complete tier 2 figure, an LRU cache with a size control, that opens in any browser.
- `templates/dither.js`: a complete tier 3 script. Load it and add `<div class="dither" data-seed="...">`.

Inside the AI Engineering from Scratch repo, also see `site/lesson-figures.js` for the runtime and `site/figures-*.js` for more figures.
