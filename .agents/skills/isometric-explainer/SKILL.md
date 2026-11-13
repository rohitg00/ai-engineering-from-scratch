---
name: isometric-explainer
version: 1.0.0
description: >
  Builds an interactive isometric machine page. Each station of one invented machine stands for one step of a process.
  A pure, tested state model drives the motion, the readouts and the copy. The page has controls and a verification loop.
  Trigger phrases: "isometric explainer", "machine explainer", "explain this as a machine",
  "interactive isometric figure", "explorable explainer", "show how it works inside".
tags: [isometric, svg, interactive, explainer, simulation]
---

# Isometric Explainer

This skill makes a single-page interactive figure. The figure is a solid isometric machine on a bench. Each station of the machine stands for one step of a process. For example, a request card moves on a carriage, a probe drops, and a press stamps the card. A pure state model decides every move, so the picture, the numbers and the words match. The `templates/` folder holds a working starter, and `kit/` holds the geometry library it uses.

## When to use

- The concept is a process with stations, order and failure modes: a loop, a pipeline, a cache, a queue, a retry policy.
- The reader can break one part and see what fails.
- The figure is the main content of a page.

## When not to use

- A static diagram explains the idea. Make a flat SVG figure instead.
- The concept has no order or state change. Make a static figure instead.
- The figure is a small diagram inside a lesson or a README. Use the sibling skill `blueprint-figure`.
- You cannot write a deterministic model of the behavior. Do not animate a guess.
- The job needs more than 150 parts and the user has not approved the size.

## Method

1. Invent the machine. Write one sentence: "X moves through Y, and that motion means Z." If you cannot write it, pick another machine. See `references/concept.md`.
2. Count the parts on paper before you draw, and pick a tier.

   | Tier | Parts | Approval |
   |---|---|---|
   | Figure | 40 to 80 | not needed |
   | Hero | 80 to 150 | not needed |
   | Larger | more than 150 | get the user's approval first |

3. Write the state model first. Make `model.mjs` pure and deterministic, with no DOM and no clock. `simulate(config)` returns an event list and totals. Test it before any geometry. See `references/state-model.md`.
4. Map each concept to a station. Write a table: station, concept word for its label, what it does, what fails without it.
5. Write the parts list. List each part with its assembly, size in world units, tone and whether it moves. Geometry comes after the list.
6. Set the camera. Use world units and one isometric camera. Set elevation to 30 degrees. Pick the azimuth so the working faces point at the viewer. Fit the projection over the assembled and the exploded pose.
7. Build the static geometry once. Each part becomes one SVG group with a depth key. Movers get a `data-live` hook. See `references/geometry.md`.
8. Animate by translation. Move a part by changing its `transform` only. Rebuild a path only when its shape changes, such as a rod that gets longer.
9. Paint from back to front. Sort groups by depth key plus the depth of their current offset. Reorder the DOM only when the order changes.
10. Paint with colour and ink. Each material has three flat tones, the main bodies have a heavy ink silhouette, and each body casts a short, flat, warm grey shadow on the bench. Exactly one accent colour marks the active part and its pill label. See `references/colour-and-ink.md`.
11. Add controls that change the model. Run, step, break, repair, reset and the config switches all act on a real `simulate` run. Write the config to the URL. See `references/live.md`.
12. Verify the page in a headless browser. Take screenshots at desktop and phone width in both themes. Add 4x close-ups, a line-end check, a scenario sweep with zero console errors and a contact sheet. See `references/verify.md`.

## Rules

Truth:
- The state model is the single source of truth. Motion, readouts, trace lines and outcome text all come from its events.
- `simulate` with the same config returns the same events. A test proves this for every config combination.
- Never fake a real model, a real service or real metrics. A scripted part says "fixed script" in the page copy.
- Every page with simulated timing shows a sentence that starts "This is a simulation." and says that times are fixed costs, not measurements.
- Use real arithmetic in the model. Tests assert the exact numbers that the page prints.

Geometry:
- All coordinates are world units. Pixels appear only in the projection.
- Elevation is 30 degrees. The azimuth is one fixed value for the whole page. The reference page uses 60.
- Solids use `inkSolid` from `kit/ink.mjs`: three flat tones for each material, an ink outline, and a heavier silhouette round each main body.
- Every line ends on a solid or on another line. A line with a deliberate loose end carries `data-free="start"`, `"end"` or `""`.
- Each station carries a pill label with a leader line to its working part, with its concept word in capitals, such as `CACHE` or `VERIFIER`. The page has a Labels switch and reads `?labels=0`.
- Status lights show the state the model gives each station: green when it finished, red when it failed or left a gap.
- Glass covers show what is inside a station: a light tint and one or two streaks.
- A part that rests on another part gets a depth bias so it paints after its support.

Motion:
- Movers change `transform` only. A path that changes shape is rebuilt from cached results where it can be.
- One beat lasts 0.1 to 1.3 seconds. Travel time grows with distance.
- Explode uses a spring with stiffness 64, damping 14.2 and a 0.04 s stagger per assembly.
- Clamp the frame step to 1/20 s so a slow frame never skips a beat.
- With reduced motion, runs advance 40 times faster and explode snaps to its end pose.
- The animation loop stops when the stage is off screen and when nothing moves.

Page:
- The workbench fits one screen at desktop width: toolbar, stage and readouts in `100svh`.
- At phone width the page stacks and never scrolls sideways.
- Buttons are at least 44 px tall. The stage takes focus and has keyboard keys for run, step, explode, break and repair.
- The SVG has `role="img"` and an `aria-label` that names every station.
- An `aria-live="polite"` region announces the outcome when a run ends.

## Check before you finish

- [ ] The one-sentence machine statement is written in the page copy or the build notes.
- [ ] The part count matches the approved tier.
- [ ] Model tests pass, including a sweep over every config combination.
- [ ] The page is the output of the build script. Rebuilding produces no diff.
- [ ] Every config control calls `simulate` and updates the URL.
- [ ] Opening the URL with `?` parameters restores the same config.
- [ ] Exactly one accent colour shows at any moment, and it follows the active part.
- [ ] Every station shows a readable pill label in both themes and at phone width, and no pill covers a mover or another pill.
- [ ] The wobble slider, the colour swatches and the Labels switch work, and `?labels=0` starts with the labels off.
- [ ] A "The big idea" line under the figure says the point in plain words.
- [ ] The line-end check reports zero loose ends.
- [ ] The scenario sweep runs every config to the end with zero console errors.
- [ ] Desktop and phone screenshots in light and dark show no clipping and no horizontal scroll.
- [ ] The exploded pose stays inside the stage.
- [ ] The simulation sentence is on the page.

## Files

- `references/concept.md`: invent the machine, the one-sentence test, concept mapping, sizing.
- `references/state-model.md`: the model contract, event shape, tests, URL state.
- `references/geometry.md`: units, camera, parts list, kit functions, shading, depth keys, labels.
- `references/colour-and-ink.md`: materials, tones, ink weights, cast shadows, glass, status lights, pill labels, wobble and the dark theme.
- `references/live.md`: the beat timeline, the draw loop, sorting, accent, controls, accessibility, layout.
- `references/verify.md`: the headless verification loop with a script.
- `templates/model.mjs`, `templates/model.test.mjs`, `templates/build.mjs`, `templates/live.js`: a working cache machine. Run `node templates/build.mjs` to write `templates/out.html`. Run `node --test templates/model.test.mjs` for the model tests.
- `kit/iso-kit.mjs`, `kit/lathe.mjs`, `kit/tube.mjs`: projection, solids, lathe bodies, tubes and the base CSS. Keep `kit/LICENSE` with the kit.
- `kit/ink.mjs`: the colour and ink layer: `inkSolid`, `silhouetteSvg`, `castShadowSvg`, `glassSvg`, `pillSvg`, `wobbleFilter`, `PALETTES` and `INK_CSS`.

Inside the AI Engineering from Scratch repo, also see `scripts/decompiler-machine/` and `site/test_decompiler_machine.js` for a full hero build in the colour and ink look, and `scripts/agent-machine/` for the older grey look.
