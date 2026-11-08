---
id: mobile-ui-agent-vlm
title: Design a VLM for an on-device UI agent
card: multimodal
kind: design
level: 4
roles: [applied-ai-engineer, agentic-ai-engineer]
rounds: [system-design]
tags: [vlm-design, ui-agent, resolution, grounding]
minutes: 20
lessons: [phases/12-multimodal-ai/07-open-weight-vlm-recipes, phases/04-computer-vision/25-vision-language-models, phases/12-multimodal-ai/05-llava-visual-instruction-tuning]
manuals: []
practice: []
cheatsheet: [vlm-model-families, vlm-architectures]
related: [multimodal/which-knob-first, multimodal/spatial-reasoning-limit]
updated: 2026-11-03
---

Design a vision-language model for an on-device mobile assistant that reads the phone screen and taps, types and scrolls. Keep the language model at about 2B parameters. Choose the encoder, the bridge, the resolution plan and the data mix, justify each choice with the ablation evidence, and name the capability you would guard against over-promising.

## Short answer

Encoder: the stronger contrastive encoder at native resolution, with a self-supervised encoder's features concatenated for a dense spatial signal, because the encoder explains about 20 percent of the variance and self-supervised features lead vision-centric tests. Bridge: a two-layer MLP, since the connector explains about 5 percent, with features from several encoder depths stacked so that fine position reaches the language model. Resolution: a ramp from low to high, with dynamic resolution up to about 1280 pixels on the long side, because screens are text-dense and reading gains most from pixels. Data: dense human descriptions of screens plus grounded action traces, not distilled captions; and guard the promise on spatial relations, where general models score 50 to 60 percent and the agent must hit the right element every time.

## Full answer

### Constraints first

A 2B language model sets a low reasoning ceiling: a larger language model adds points on reasoning benchmarks, and this design cannot grow it. So every other axis must carry more, and the task must be framed as perception plus short actions, not long reasoning.

### Encoder

| Choice | Why |
|---|---|
| The strong contrastive encoder at native resolution | adds 3 or more points over the common one in the ablations; native resolution keeps screen text legible |
| Concatenated self-supervised features | lead vision-centric benchmarks by 5 to 7 points over the contrastive one; UI grounding is vision-centric |
| Features from several encoder depths | deep layers carry semantics and shallow layers carry fine position; stacking both tightens grounding, which an agent that taps needs |

### Bridge

A two-layer MLP. The connector explains about 5 percent of the variance at a fixed token count, and the MLP is the simplest to retrain when the encoder or the language model changes. The token count is the knob that matters: screens are documents, so budget toward the upper end of the 576 to 1024 sweet spot, and above it for dense screens.

### Resolution schedule

Start low and ramp. Flat low-resolution training plateaus; a ramp trains faster and ends higher. Dynamic resolution with a minimum of 256 and a maximum near 1280 pixels on the long side handles the range of screen densities, and the document-reading gains of 3 to 5 points from splitting apply to screens.

### Data mix

- Dense human descriptions of screens: what is on the screen, where, and what is interactive. Dense human captions beat distillation across the board in the reference comparison.
- Grounded action traces: screenshot, instruction, the element and the action, with coordinates. The visual-agent benchmark that frontier models lead has this shape.
- Task-specific instruction data for the app families you ship to.
- Synthetic data only where a human description anchors it, filtered for grounding.

### The capability to guard

Spatial relations. General models score 50 to 60 percent on above, below, left, right and counting, and an agent that taps the wrong element fails the task. Build the eval from real screens with the exact element-selection questions, measure it before any promise, and keep a verification step in the agent loop: read the screen back after the action and check the state.

### Serving on the device

A 2B language model and a strong encoder at a high resolution still need the visual token budget counted per screen; measure the latency per step at your resolution before you set the schedule.

## Follow-ups

- **Level 3:** Why stack shallow and deep encoder layers for an agent and not for a captioner? Expected: a captioner needs semantics; an agent needs where exactly, which the shallow layers carry and the last layer blurs.
- **Level 4:** The language model is fixed at 2B. Which axis do you lean on hardest, and what is its limit? Expected: resolution and token count, because screens are text-dense; the limit is the latency per step on the device, which the token count sets.
- **Level 4:** How do you make the agent robust to being wrong about an element? Expected: a read-back after each action that compares the new screen with the expected state, and a stop when they do not match; the model's own confidence is not a safe signal.
- **Level 4:** What does the ablation evidence not tell you about this design? Expected: it comes from general benchmarks on datacenter GPUs; the device latency, the UI domain and the action format need your own ablation, one axis per run.

## Wrong answers

- "Use a query-based bridge to save tokens on the device." It caps the tokens at a count too low for dense screen text, and the ablations put 64 tokens as too few for reading; spend tokens here and save elsewhere.
- "Generate the screen descriptions with a strong proprietary model." Distilled descriptions inherit hallucinations, and an agent that taps a hallucinated element fails; dense human descriptions won the reference comparison.
- "A 2B model with a great encoder matches a 70B agent." The language model sets the reasoning ceiling; frame the task as perception plus short actions and verify each step, instead of promising long reasoning.

## Taught in

The [open-weight recipes lesson](../../../phases/12-multimodal-ai/07-open-weight-vlm-recipes/) supplies the ablation evidence for each axis and sets this exercise, and the [vision-language models lesson](../../../phases/04-computer-vision/25-vision-language-models/) covers multi-level features, visual agents and the spatial reasoning limit.
