---
id: hidden-state-drafts
title: Why a draft that reads hidden states accepts more
card: tokenization-decoding
kind: concept
level: 3
roles: [inference-engineer, applied-ai-engineer]
rounds: [ml-depth, design-review]
tags: [speculative-decoding, eagle, draft-model, tree-attention, exposure-bias]
minutes: 10
lessons: [phases/10-llms-from-scratch/15-speculative-decoding-eagle3, phases/10-llms-from-scratch/25-speculative-decoding, phases/07-transformers-deep-dive/16-speculative-decoding, phases/17-infrastructure-and-production/05-eagle3-speculative-decoding]
manuals: []
practice: []
cheatsheet: [speculative-decoding]
related: [tokenization-decoding/speedup-from-alpha]
updated: 2026-11-03
---

Walk the line from a separate small draft model to the current generation of hidden-state drafts. What limitation did each step remove, and why does feeding the draft the verifier's internal features help so much?

## Short answer

A separate small model from the same family accepts around 0.6 of its tokens, because its distribution drifts from the verifier's. The first hidden-state draft replaces it with a one or two layer network that reads the verifier's last-layer features, so the draft starts from the verifier's own representation and acceptance rises to 0.7 to 0.8. The second generation proposes a tree of candidates and verifies every branch in one pass with a tree-shaped attention mask, lifting acceptance per accepted-path token above 0.85. The third drops the feature-matching loss, trains on direct token prediction, and feeds the draft its own previous outputs during training, which removes exposure bias and reaches 0.88 to 0.92.

## Full answer

### The progression

| Generation | Draft | Acceptance | Training cost |
|---|---|---|---|
| Separate small model | an independently trained smaller model | 0.55 to 0.70 | none |
| Extra heads on the verifier | several output heads predicting positions ahead | 0.65 to 0.75 | about 1B supervised tokens |
| First hidden-state draft | one transformer layer on the verifier's last hidden state | 0.70 to 0.80 | about 60B tokens |
| Dynamic draft tree | the same plus a tree of candidates | 0.80 to 0.88 | about 60B tokens |
| Multi-layer features plus training-time test | fuses several verifier layers; trained on its own outputs | 0.88 to 0.92 | about 60 to 200B tokens |

### Why the hidden state helps

A separate draft re-derives from raw tokens what the verifier has already computed. The verifier's last hidden state at position t is a rich summary of the prefix, and a tiny network that reads it predicts the verifier's next token far better than a small model that reads only the token ids. The draft becomes a reader of the verifier instead of an imitation of it.

### What the tree adds

A linear chain of drafts dies at the first miss. A tree proposes several candidates at each depth, grows wider where the draft is uncertain and stays narrow where it is confident, and the verifier scores every node in one forward pass with a mask that lets each node attend only to its ancestors. The longest accepted path wins. Verification cost barely moves, because it is still one forward pass.

### What the third generation fixes

The earlier hidden-state drafts were trained to match the verifier's features, which capped how much extra data could help. The third generation trains on token prediction directly, and during training it feeds the draft its own previous predictions over several steps, the way it runs at inference. That aligns the training inputs with the inference inputs and stops error accumulation, the same fix that scheduled sampling gave sequence models. The paper reports up to 6.5 times end-to-end on chat and a 38 percent throughput gain at a batch of 64 on a production engine.

### The draft is only as good as its traffic

A general-purpose draft head trained on chat data drops to 0.4 to 0.6 acceptance on code, medical or legal traffic. A domain-specific head recovers it, and training one is a light job next to fine-tuning the verifier.

## Follow-ups

- **Level 3:** Why did matching the verifier's features cap the first generations? Expected: the feature loss asks the draft to reproduce hidden states rather than predict tokens, so more training data stopped helping; the third generation trains on tokens.
- **Level 3:** What is exposure bias in this setting? Expected: the draft was trained on teacher-forced verifier inputs and run on its own outputs; the mismatch compounds over the draft steps.
- **Level 4:** What does the tree cost? Expected: a non-causal attention mask that follows the tree topology, extra stored keys and values for the tree nodes, and scheduler complexity; the verifier still runs once.
- **Level 4:** How do you compare the extra-heads design with the hidden-state draft? Expected: no second model to deploy and simpler serving, against a somewhat lower acceptance and a supervised fine-tuning stage on the verifier.

## Wrong answers

- "A larger separate draft model is the main lever." Alignment with the verifier matters more than size; a one-layer draft on hidden states beats a far larger independent model.
- "The hidden-state draft changes the verifier's output distribution to gain acceptance." The rejection rule keeps the output exact; the draft only changes how often it is right.
- "A tree needs one verifier pass per branch." All branches are verified in one pass under the tree mask.

## Taught in

The [EAGLE-3 lesson](../../../phases/10-llms-from-scratch/15-speculative-decoding-eagle3/) walks the progression and the training-time test, the [Phase 10 speculative decoding lesson](../../../phases/10-llms-from-scratch/25-speculative-decoding/) explains feature reuse and tree verification, the [Phase 7 lesson](../../../phases/07-transformers-deep-dive/16-speculative-decoding/) introduces the draft families, and the [production EAGLE-3 lesson](../../../phases/17-infrastructure-and-production/05-eagle3-speculative-decoding/) covers domain drift.
