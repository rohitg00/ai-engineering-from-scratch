---
id: acceptance-fell-after-upgrade
title: Mean latency improved and the tail got worse
card: tokenization-decoding
kind: debug
level: 4
roles: [inference-engineer, ai-evaluation-reliability-engineer]
rounds: [debugging, system-design]
tags: [speculative-decoding, acceptance-rate, draft-drift, tail-latency, monitoring]
minutes: 12
lessons: [phases/19-capstone-projects/14-speculative-decoding-server, phases/17-infrastructure-and-production/05-eagle3-speculative-decoding, phases/10-llms-from-scratch/15-speculative-decoding-eagle3]
manuals: []
practice: []
cheatsheet: [speculative-decoding]
related: [tokenization-decoding/choose-the-draft-for-a-new-model, tokenization-decoding/speedup-from-alpha]
updated: 2026-11-03
---

Two changes shipped in one week: the target model moved to its next version, and a new customer whose traffic is mostly code was routed onto the same cluster. Speculative decoding has been on for months. Since then the mean inter-token latency fell 25 percent, the P99 rose 15 percent, and throughput at the usual concurrency is down. Diagnose it.

## Short answer

Both changes attack acceptance. The draft head was trained against the previous target version, so its distribution drifted and more drafts reject; the code traffic shifts the input distribution away from the general chat data the head was trained on, where acceptance falls into the 0.4 to 0.6 band. A rejected draft costs a verify and a re-roll, two passes that serialize under a full batch, which is exactly a tail that worsens while the mean still improves. Read acceptance per traffic slice and per target version from the engine's speculative metrics, retrain or roll back to a head aligned with the new target, and gate speculation per request class.

## Full answer

### Why mean and tail move in opposite directions

Most requests still accept most drafts, so their inter-token latency falls and the mean improves. The requests that reject early pay the draft steps, the verify and a second target pass for the correction, and under a full batch those passes queue behind each other. The tail is where the rejected requests live. Watch P99, not P50.

### Cause one: a draft one version behind

A hidden-state draft is trained to predict a specific target's next token from that target's features. A new target version changes the features and the distribution, and the draft's agreement with it drops. The capstone's first exercise is to measure this degradation and to build the alert for it.

### Cause two: a domain the head never saw

A head trained on general chat sits at 0.6 to 0.8 acceptance there and at 0.4 to 0.6 on code, medical or legal traffic. Code tokens are predictable for a draft trained on code, and poorly predicted by one that was not. Below an acceptance of about 0.55 at high concurrency speculation is net negative, so the new customer may have pushed the cluster under the floor.

### The diagnosis

1. Pull accepted draft tokens and proposed draft tokens per request from the engine, divide the first by the second, and split by target version and by customer or request class. One number for the whole cluster hides both causes.
2. Compare the chat slice before and after the upgrade: if it fell, the version drift is real.
3. Compare the code slice against the chat slice at the same version: if it sits far lower, the domain shift is real.
4. Confirm the tail story by bucketing P99 by acceptance; the slow tail should be the low-acceptance slice.

### The fix

- Retrain the head against the new target version, or roll the target back until the aligned head is ready.
- Route the code customer to a plain decode pool, or train a code-specific head; the training job is light next to fine-tuning the target.
- Gate speculation per request class on measured acceptance, with an n-gram or draft-free fallback below the floor.
- Alert on acceptance per slice so the next version bump cannot ship without the draft.

## Follow-ups

- **Level 3:** Why can the mean improve while throughput falls? Expected: the accepted requests get faster, but the rejected ones consume two target passes each, and at a full batch that extra work displaces other requests.
- **Level 4:** Design the alert in two sentences. Expected: compute acceptance per slice and per target version over a short window and compare against the baseline recorded at rollout; page when a slice crosses the floor or drops a fixed share from its baseline.
- **Level 4:** What is the fallback when acceptance drops on one slice only? Expected: switch that slice to an n-gram draft or to plain decoding while the head is retrained, and keep speculation where it still pays.
- **Level 4:** How does this change your release process? Expected: a target upgrade ships together with a draft trained against it, and the benchmark that gates the release reports acceptance and P99 per slice.

## Wrong answers

- "Increase the draft length to win back throughput." More drafts at low acceptance are mostly rejected and their cost is still paid; the tail gets worse.
- "Turn speculation off everywhere." The chat slice may still pay; gate by slice and fix the head.
- "The new target is just slower; speculation has nothing to do with it." A plain-decode benchmark of the new target settles that in minutes, and the mean improving while the tail worsens points at rejections.

## Taught in

The [speculative decoding server capstone](../../../phases/19-capstone-projects/14-speculative-decoding-server/) sets the drift measurement and the fallback exercises, the [production EAGLE-3 lesson](../../../phases/17-infrastructure-and-production/05-eagle3-speculative-decoding/) explains the tail and the acceptance floor, and the [EAGLE-3 lesson](../../../phases/10-llms-from-scratch/15-speculative-decoding-eagle3/) explains why the draft is tied to one target version.
