# 001 - Gradient descent on an actual loss surface

- Status: DONE in local preview
- Base commit: d8b29c52
- Relevant lesson: `phases/01-math-foundations/08-optimization/docs/en.md`

## Purpose and implementation

Show how the learning rate changes the number and size of gradient updates. `site/motion-lessons/loss-landscape.js` generates a 216 by 108 colored dot surface from the actual toy objective:

`L(w1,w2) = (w1-1)^2 + 0.5(w2+0.8)^2 + 0.2 sin(2w1)^2`

Its analytic gradient is `[2(w1-1)+0.4sin(4w1), w2+0.8]`. Start at `[-1.9,1.7]`; expose learning rates 0.03, 0.08 and 0.18; apply 8 gradient updates per logical second. Stop when gradient norm is below 0.01 or after 200 updates. Height represents this loss. The bright marker and amber trail show actual successive weights.

Keep the terrain camera fixed so learners can follow the trajectory. Rasterize a circular domain with depth testing, smooth shading, and ordered dot coverage; cache the terrain and update the actual trajectory and learner marker during playback. Expose current loss, updates, weights, formula, and a link to the Optimization lesson as normal HTML. Label the function as illustrative; its minimum is not zero. Single-step advances one displayed update, even after pausing between animation paints.

## Shared runtime

`site/ascii-motion.js` owns one RAF queue for visible examples, caps painting at 20 fps, and publishes changing metrics at most five times per second. It exposes play, pause, replay, step, setSpeed, setParameter, setReducedMotion, getState and destroy. Replay preserves chosen parameters. System reduced motion wins over the preview toggle. Hidden or offscreen examples stop scheduling; manual pause survives visibility changes.

Use the MIT-licensed glyph-atlas painter in `site/vendor/ascii-rest/canvas.js`, with the complete local license and pinned provenance. Reuse one canvas and atlas; do not create per-frame DOM. Scope styling to new pilot files. Give the art the full gallery width, place controls and metrics below it, and keep equations in an expandable explanation. Leave production entry points unchanged.

## Verification

Check the analytic gradient against finite differences and each update against `w -= rate * gradient`. Verify decreasing loss and convergence for all supported rates, deterministic replay, and changing bounded character/color frames. Current rates converge in 182, 67, and 28 updates respectively. Verify real browser pixels, pause/resume, slow motion, reduced-motion Next, offscreen suspension, source asset hashes, and responsive screenshots before showing the sample.
