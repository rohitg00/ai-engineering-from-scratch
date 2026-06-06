---
name: skill-physical-plausibility-checks
description: Automated checks for object permanence, gravity, and continuity on any generated video before shipping
version: 1.0.0
phase: 4
lesson: 28
tags: [video-generation, quality, physics, evaluation]
---

# Physical Plausibility Checks

Production deployments of generated video need automated guardrails. Human review does not scale; physics checks catch the classic failure modes.

## When to use

- Any product that generates video from text or image prompts.
- Automating QA on a video generation API endpoint.
- Monitoring a video model's quality drift after fine-tuning or a base-model update.

## Inputs

- `video`: a tensor `(T, H, W, 3)` or a path to an mp4.
- Optional reference info: expected number of objects, initial scene description.

## Checks

### 1. Object permanence
Track every detection across frames with SAM 3.1 Object Multiplex. Flag when a stable track disappears for <=3 frames and reappears — the model lost the object temporarily. Hard fail when an object disappears near the frame centre (not at an edge); soft fail at edges.

### 2. Motion smoothness
Optical flow between consecutive frames should be mostly continuous. Sudden per-pixel flow spikes indicate teleportation. Compute flow with RAFT; flag frames where the 99th-percentile flow magnitude exceeds the median by a factor > 10.

### 3. Gravity / support
For objects detected as solid (food, balls, tools), check that their vertical position is non-increasing in the absence of a lifting action. Flag upward drift unless a "grasping hand" is detected near the object.

### 4. Identity consistency
For people or characters, use a face-recognition embedding across frames. Cosine similarity should stay > 0.8 across 5-frame windows for a persistent identity. Below threshold means the character morphed.

### 5. Hands and limbs
Run a pose estimator (Lesson 21). Flag frames where a hand has > 5 or < 4 visible fingers; where an arm length doubles between frames; where limbs intersect the body through a surface.

### 6. Text rendering (if prompt asked for text)
If the user prompt included a string in quotes, OCR the generated frames and compute CER against the requested string. Flag > 20% CER.

## Report

```
[plausibility]
  video frames:           <T>
  permanence violations:  <N>
  smoothness violations:  <N>
  gravity violations:     <N>
  identity drift:         <N of 5-frame windows>
  limb anomalies:         <N>
  OCR CER vs requested:   <float>

[verdict]
  ship | hold | reject

[samples for review]
  frame ranges where each failure occurred
```

## Rules

- Do not hard-block on any single check; aggregate scores and hold the video for review when total anomalies exceed a threshold.
- Weight identity drift and permanence violations highest — users notice them first.
- Log per-check failure rates over time; a rising trend usually means the base model was updated or the prompt distribution shifted.
- Never delete the flagged video; keep it for model debugging and post-mortems.
- For sensitive content (people, children, public figures), require human review of every video regardless of score.
