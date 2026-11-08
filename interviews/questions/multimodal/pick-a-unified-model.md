---
id: pick-a-unified-model
title: One open model to answer, edit and generate
card: multimodal
kind: design
level: 4
roles: [applied-ai-engineer, forward-deployed-ai-engineer]
rounds: [system-design]
tags: [unified-models, image-editing, latency, open-weights]
minutes: 15
lessons: [phases/12-multimodal-ai/14-show-o-discrete-diffusion-unified, phases/12-multimodal-ai/13-transfusion-autoregressive-diffusion, phases/12-multimodal-ai/12-emu3-next-token-for-generation, phases/12-multimodal-ai/11-chameleon-early-fusion-tokens]
manuals: []
practice: []
cheatsheet: [unified-multimodal]
related: [multimodal/show-o-parallel-decoding, multimodal/vq-tokenizer-ceiling]
updated: 2026-11-03
---

A design tool wants to ship, with open weights it can host, one model that answers questions about a user's image, edits a region of it on request, and generates a new image from text. The latency per image must stay in seconds, not minutes. Lay out the families you would consider, pick one, and state the test that would make you change the pick.

## Short answer

Three open families cover understanding and generation in one model: next-token prediction over discrete codes, which does everything with one loss but spends one pass per code and minutes per image; continuous patches with a diffusion loss next to the text loss, which gives the best fidelity in about 20 passes but trains two losses; and masked discrete decoding, which keeps one loss, fills an image in about 16 passes, and gets region editing free from its masking objective. For a tool that needs editing and a seconds-level latency with open weights, start with the masked discrete family. Change the pick if a fidelity eval on your own prompts shows the quantizer ceiling hurting, or if the latency budget cannot afford sixteen full passes; the continuous two-loss family then takes over, with editing done through conditioned denoising of the region.

## Full answer

### The requirements, mapped

| Requirement | Next-token over codes | Continuous two-loss | Masked discrete |
|---|---|---|---|
| Visual question answering | yes | yes | yes |
| Region edit | possible, slow: regenerate codes | possible through conditioned denoising | native: mask the region's codes |
| Text to image | yes, minutes per image | yes, about 20 passes | yes, about 16 passes |
| Training | one loss | two losses to balance | one cross-entropy on masked positions |
| Fidelity ceiling | the quantizer, at 30.5 dB in the best reference | no quantizer, about 32 dB and above | the quantizer |
| Open weights to host | yes | yes | yes |

### Why masked discrete first

Editing is the feature that distinguishes the product, and the masked objective is editing: mask a region, keep the rest, add the prompt, predict. A latency in the low tens of passes fits a seconds budget. One loss means one training recipe to operate. The reference open model ships text generation, question answering, text-to-image and inpainting from one checkpoint.

### Why not the other two first

Next-token over codes spends thousands of passes per image; the reference puts a 512 by 512 image at about 2 minutes at a typical decode rate, and a region edit means regenerating codes in sequence. The continuous design has the best fidelity and no quantizer ceiling, but two losses on different scales need a weight search, and editing needs a conditioned denoising sampler that you build yourself.

### The eval that decides

1. Fidelity: your own prompt set, judged against the continuous reference at matched passes; if the quantizer ceiling shows, as lost fine texture or unreadable text in images, the pick changes.
2. Edit quality: masked region edits judged for seam quality and prompt adherence.
3. Latency at your resolution and pass count on your hardware; sixteen full passes of a large transformer can still exceed a budget.
4. Understanding: the question-answering eval you already run, because the unified model must not fall behind the adapter model it replaces.

### Operational notes

Keep the tokenizer fixed and version it with the model; a tokenizer change invalidates every stored code. Log the mask schedule and the pass count as deployment parameters, because they trade latency for quality at serve time without retraining.

## Follow-ups

- **Level 3:** Which of the three tasks does the masked objective give for free, and why? Expected: region editing; training predicts masked codes from the rest, which is what an edit asks for.
- **Level 4:** How do you do a region edit in the continuous design? Expected: keep the patches outside the region fixed across the denoising steps and denoise only the region, conditioned on the text and the context; it works, but it is a sampler you write, not a training objective.
- **Level 4:** Why does the pass count become a serving parameter in the masked design? Expected: more passes commit fewer codes each and raise quality, fewer passes cut latency; the schedule is set at inference, so the product can trade them per request.
- **Level 4:** What single measurement tells you that the quantizer is the bottleneck? Expected: the tokenizer's reconstruction of your real images; if the reconstruction already loses the detail your users care about, no generator on those codes can recover it.

## Wrong answers

- "Ship the next-token model; one loss, one stack, no compromise." Minutes per image at the reference decode rate breaks the latency requirement, and a region edit regenerates codes in sequence.
- "Fidelity decides, so take the continuous design." Fidelity is one requirement; editing and operational simplicity favor the masked design until an eval shows the ceiling hurting.
- "Pick the model with the best benchmark score." The product needs three tasks, an edit path and a latency budget; a benchmark covers one of those at best.

## Taught in

The [Show-o lesson](../../../phases/12-multimodal-ai/14-show-o-discrete-diffusion-unified/) places the three families and names the tasks one checkpoint covers, the [Transfusion lesson](../../../phases/12-multimodal-ai/13-transfusion-autoregressive-diffusion/) gives the continuous design, and the [Emu3 lesson](../../../phases/12-multimodal-ai/12-emu3-next-token-for-generation/) gives the per-code cost of next-token generation.
