# Build a figure on the fly

A built figure is one page that a tutor makes for one lesson while the lesson runs. This page holds the stages of a build, the contract that every built page follows, the craft rules, and the rules for 3D.

## Stages

Every build passes the same six stages. The building screen shows them, and you update it at the end of each stage.

| Stage | Done when |
|---|---|
| Concept | one sentence names what moves and what the motion means |
| Truth | the numbers come from the lesson run, and the state model has passing tests |
| Parts | a written parts list maps each concept to a part and each station to a label |
| Draw | the page builds and opens with zero console errors |
| Check | you looked at `CLI shot` images in both themes, at desktop and phone width |
| Ready | `CLI publish` put the page on the screen |

Keep each build in its own folder: `.lesson-screen/builds/<phase>-<lesson>-<form>/`. Put the source, the tests, the built page, and the shots there.

## The building screen

Write it when the learner accepts the build. Rewrite it with a new file name at the end of each stage.

```html
<p class="ls-eyebrow">Phase 07 · Lesson 16 · Building</p>
<p class="ls-lead">Building an isometric machine of speculative decoding.</p>
<ol class="ls-building">
  <li class="is-done">Concept: draft tokens ride past a verifier that stamps or rejects them</li>
  <li class="is-done">Truth: acceptance numbers from the lesson run, 6 model tests pass</li>
  <li class="is-now">Parts</li>
  <li>Draw</li>
  <li>Check</li>
  <li>Ready</li>
</ol>
<p class="ls-note">Keep going in the terminal. The figure appears here when it is ready.</p>
```

## Page contract

A built page is a full HTML page. It works in the lesson screen and from disk.

- Use the course tokens for both themes and the course fonts. The course-style skill holds both.
- Read the theme from `localStorage.theme`, else from the system setting. Listen for `storage` events, so that the top bar theme switch reaches the page.
- Load scripts only from the page itself, aiengineeringfromscratch.com, or cdn.jsdelivr.net. Pin exact versions. The lesson screen blocks every network request to any other origin.
- Send clicks with `window.lessonScreen.send(event)` when that object exists. Use the event types from SKILL.md. From disk the object does not exist, so show a short note in place of the ask button.
- Fit the figure, its controls, and its readouts in a 1440 by 900 window without vertical scroll. At 390 px wide, stack the parts and never scroll sideways.
- Show the lesson path and a line with "The big idea".
- Show the line that says your tutor built the figure and the course authors did not review it.
- Stop motion when the page is hidden. Under reduced motion, show the end state of each step.
- Put a plain `<title>` in the page. The top bar of the lesson screen shows it.

## Craft rules

These rules decide whether a figure teaches or only decorates. Apply them to every form.

1. **The object is the explanation.** Invent a real, well-made physical thing whose working is the concept. A cache key is a lock whose pins must all match. A queue is a rack of trays. Attention is a switchboard that patches every token to every earlier token.
2. **Never draw labelled boxes or loose shapes.** Stacked plates, floating slabs, and scattered cubes and cones do not read as anything.
3. **Build from many small parts that do a job.** Group them as base, structure, mechanism, controls, and the subject. Each part sits on another part. Add the real details of the object: bevels, screws, seams, label plates, ruler ticks, and cables with connectors.
4. **Use one accent.** The accent marks the part to watch at this step. Every other part uses ink, paper, and metal tones.
5. **Teach in steps.** Show a numbered rail with one change per step, and Auto and Manual modes. The state model moves the parts and writes the readouts, so the picture and the numbers always agree.
6. **Label every station.** Each label has a leader line to its working part. No label covers a moving part or another label.
7. **Frame the subject.** The subject fills 55 to 70 percent of the stage. Nothing floats without support unless the lesson says that it floats.
8. **Move calmly.** Use eased or spring motion, and stop the loop when nothing moves.

A figure that fails rule 1 or rule 2 is not ready, however clean it looks.

## Forms

- **Blueprint.** Follow the blueprint-figure skill: one figure kind, the paper panel, the blueprint accent, and its legibility checks. Wrap the SVG in a full page that follows the page contract.
- **Mechanism.** Follow tier 2 of the motion-figure skill: real names and numbers, one control, and a computed verdict.
- **Isometric machine.** Follow the isometric-explainer skill from its state model to its verification loop. Its kit draws solid isometric parts with ink outlines, shading, and explode. An installed isometric illustration skill can add finer parts, WebGL effects, or a 3D mode. Keep the page contract.
- **3D model.** Use an installed figure skill with a 3D mode when the host has one. Otherwise write a three.js page with the rules below.

## 3D rules

The learner turns a 3D model to see depth. Each rule below fixes a fault that made earlier 3D figures look cheap.

- Pin three.js to one exact version with an import map from cdn.jsdelivr.net, and load addons from the same version.
- Model the object from crafted parts: rounded solids, lathe profiles for round parts, tubes for cables, screws, seams, and label plates with engraved text. Never publish a scene of plain primitives.
- Use a studio floor in the background colour, with fog of the same colour, so that no horizon edge shows.
- Light the scene with an environment map and one key light at about 65 degrees elevation. Fit soft shadows tightly to the model, so that each part sits on its shadow.
- Use physical materials: brushed metal, glass, ceramic, rubber, and painted plastic.
- Draw thin outlines with an inverted hull that has smooth normals and a constant screen width. Edge detection by angle finds no edges on rounded and smooth parts.
- Fit the camera to the projected bounds of the model, so that the subject fills 55 to 70 percent of the stage.
- Show the steps, the readouts, and the labels as in every other form.
- Offer a blueprint view of the same parts: an orthographic isometric camera, paper fills, blueprint lines, and callouts outside the model.
- Render only while something moves. Without WebGL, show the steps, the parts, and the readouts as text.

## Check a build

1. Run `CLI shot <page.html> --theme light` and `--theme dark`, at the default 1440 by 900 size.
2. Run both again with `--width 390 --height 844`.
3. Take one more image at a middle step. Give the page a query that jumps to a step, such as `CLI shot "page.html?step=3"`.
4. Look at each image. Ask three questions. Is it at once a real object? Does every label read without overlap? Do the numbers match the lesson run?
5. Fix each fault and take the images again. Publish only after all three answers are yes.

Without a local Chrome, Chromium, or Edge, `CLI shot` fails with a clear error. Tell the learner that the build was not checked by eye, then publish it.
