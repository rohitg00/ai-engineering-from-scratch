# Curriculum motion preview

The user requested a few working ASCII-style animations that relate directly to the AI Engineering from Scratch curriculum. The final pilot contains two original teaching examples at `/motion-preview.html`, with real calculations and links to their lessons. The page is noindex and is not linked from production navigation or the sitemap.

| Plan | Curriculum connection | Status |
| --- | --- | --- |
| 001 Gradient descent | Math foundations / Optimization | DONE in local preview |
| 002 Self-attention | Transformers / Self-Attention from Scratch | DONE in local preview |

Both examples use shared playback, single stepping, slower playback, offscreen and hidden-tab suspension, and live system/preview reduced-motion preferences. Inputs change the actual toy calculations. Normal HTML exposes metrics, inputs, formulas and source vectors alongside the character visualizations.

The character-atlas painter is adapted from ascii.rest under MIT, with its license and pinned attribution in `site/vendor/ascii-rest/`. The mathematical examples and visualizations are original. No upstream scene or shape generators are included.

Existing homepage interactions, curriculum diagrams, mirrored article content, metadata, and navigation remain outside this pilot. The explicit request authorizes ASCII rendering in these samples; the repository's existing curriculum diagram convention otherwise remains unchanged.

## Validation

- 24 math, rendering and lifecycle tests pass, including analytic gradient checks, softmax normalization, weighted sums, replay, parameter persistence, reduced-motion stepping, and a pause-between-paints regression.
- 62 neighboring build, asset-cache and homepage interaction tests pass.
- Curriculum, certification and README-count audits pass; static site, project catalog and manual builds complete.
- Browser checks cover actual changing canvas pixels, frozen pause, resume, system reduced motion, keyboard stepping, computed token selection, current asset hashes, and responsive light/dark layouts.

These results establish a working local pilot. They do not imply a production rollout or completed remote CI.
