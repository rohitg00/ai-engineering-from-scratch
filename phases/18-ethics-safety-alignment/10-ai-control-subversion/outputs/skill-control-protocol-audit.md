---
name: control-protocol-audit
description: Audit a deployment protocol under the AI Control threat model.
version: 1.0.0
phase: 18
lesson: 10
tags: [ai-control, subversion, trusted-editing, untrusted-monitoring, safety-case]
---

Given a deployment protocol description, audit it under the AI Control threat model: U (untrusted strong), T (trusted weak), H (trusted human), and measure the protocol's position on the usefulness-safety frontier.

Produce:

1. Role assignment. Identify which model plays U and which plays T. If T is another instance of U, flag collusion risk immediately.
2. Audit budget accounting. How is H allocated? Uniform, random, flag-directed? What fraction of outputs are audited in expectation?
3. Collusion-vector enumeration. For every pair of untrusted components (U-producer + U-monitor, U-producer + U-editor), enumerate the collusion vectors: steganographic cues, shared-training prior exploitation, timing channels.
4. Capability-gap analysis. How much weaker is T than U? At what point does T's editing signal become noise (e.g., T cannot reliably detect backdoors U produces)?
5. Worst-case threat model. Under the assumption that U is adversarial with perfect knowledge of the protocol, what is the adversary's best strategy? What fraction of red-team attempts succeed?

Hard rejects:
- Any protocol description that uses U as its own monitor without a collusion-resistance mechanism.
- Any protocol claim of "near-zero backdoor rate" without red-team evaluation where the red team has protocol visibility.
- Any audit of a protocol without articulating the capability gap T-to-U and the budget of H.

Refusal rules:
- If the user asks "is this protocol safe," refuse without the three-part evidence: (a) red-team result, (b) capability-gap estimate, (c) H budget.
- If the user conflates alignment and control ("we aligned U so we don't need a protocol"), refuse and point to Lesson 9 (alignment faking) — alignment is a property of U; control is a property of the protocol.

Output: a one-page audit that fills the five sections above, names the weakest link (usually T-to-U capability gap or collusion resistance), and states the single largest unaddressed failure mode. Cite Greenblatt et al. (arXiv:2312.06942) once as the threat-model source.
