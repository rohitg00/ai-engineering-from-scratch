# 002 - Follow one query through self-attention

- Status: DONE in local preview
- Base commit: d8b29c52
- Relevant lesson: `phases/07-transformers-deep-dive/02-self-attention-from-scratch/docs/en.md`
- Dependency: plan 001 shared playback and canvas painter

## Purpose and implementation

`site/motion-lessons/attention.js` uses the six tokens `The robot lifted the red box` and explicit two-dimensional toy Q/K/V vectors. Compute every query-key score as `q dot k / sqrt(2)`, apply a score temperature of 0.5, 1 or 2, normalize with stable softmax, and sum the weighted value vectors. This is full one-head attention without a causal mask, using hand-chosen vectors rather than trained embeddings.

Draw six original shaded monochrome streams merging into one output in a 128 by 40 character frame with a native 2:1 character cell. The sources follow sentence order from top to bottom. Stream radius and brightness depend on the selected query's computed attention weights, with a minimum radius so very small contributions stay visible. Moving packets illustrate the flow of weighted values. This is a schematic of the calculation, not a literal transformer architecture. The normal HTML UI exposes token buttons, score temperature, normalized weights and their sum, the exact output vector, an expandable Q/K/V table, and the lesson link.

Selecting a token or changing temperature recomputes the actual calculation and redraws immediately. Do not animate text selection or input feedback. Reuse pause, replay, slow motion, single stepping, visibility and reduced-motion policy. Fit the text-free art to the viewport on small screens; all selected-query values remain readable in wrapping normal HTML below it.

## Verification

Verify stable softmax under large scores, normalization for every token and temperature, exact weighted sums, parameter effects, and deterministic changing frames. Test real browser token selection and compare displayed output to the calculation. Inspect desktop and mobile screenshots in both themes; ensure no page-level overflow, readable normal text, no duplicate canvas, and frozen pixels under pause/system reduction.

Do not alter the registered lesson figure, curriculum Markdown, mirrored articles, or production navigation. The deliverable is a noindex pilot for the user to assess before choosing a rollout.
