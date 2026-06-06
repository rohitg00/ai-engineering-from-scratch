---
name: bargainer-designer
description: Design a negotiation protocol: which agent narrates, which component generates offers, how private scratchpads separate from public messages, what the round bound is, and how deal rate is monitored.
version: 1.0.0
phase: 16
lesson: 16
tags: [multi-agent, negotiation, bargaining, contract-net, OG-Narrator]
---

Given a negotiation or task-market scenario (two-party bargain, N-party auction, contract-net task allocation), design the protocol.

Produce:

1. **Mechanism.** Two-party bargain, N-bidder auction, contract-net broadcast, or multi-party coalition. Name the game.
2. **Offer generator.** Deterministic (Zeuthen-style concession, Rubinstein equilibrium, simple linear schedule) or LLM-prompted. Default: deterministic unless the offer must be a qualitative structure (proposal, role assignment).
3. **Narration layer.** What the LLM contributes: the human-friendly framing, persuasion tactics, persona. State explicitly what the LLM does NOT decide.
4. **Private vs public channels.** How reasoning traces are kept off the counterpart's context. "Private scratchpad" + "public message" as two fields. This is non-negotiable per arXiv:2503.06416.
5. **Round bound.** 3-5 rounds maximum for two-party. Unbounded is not an option; it rewards conformity and encourages emotional offers.
6. **Reservation and BATNA discipline.** Both parties must know their reservation price. If the other side probes, the LLM narrator must not reveal it. Validate every outgoing message against this rule.
7. **Deal-rate monitoring.** Baseline deal rate expected for this protocol (cite a number from the negotiation benchmarks: 27%-89% range depending on LLM role). Alert threshold for regressions.
8. **Escalation.** Below-threshold rounds, ZOPA violations, or counterpart-side rule-breaking route to a mediator agent or human.

Hard rejects:

- Any design where the LLM computes the numerical offer without a deterministic fallback. arXiv:2402.15813 shows this produces ~27% deal rates.
- Any design without separate private and public channels. Counterparts will read your reasoning.
- Any design with unbounded rounds. Guarantees conformity-driven outcomes.
- Designs that let a single agent hold both buyer and seller state (roleplay bargaining). The private-information property is the mechanism; merging roles removes it.

Refusal rules:

- If the task has no numerical payoff (qualitative negotiation, contract terms), the OG-Narrator decomposition may not apply. Recommend structured proposal + schema validation instead.
- If the user cannot implement a separate scratchpad (single-LLM-call architecture), flag the leak risk explicitly and recommend a two-call architecture.
- If the negotiation is adversarial with a party that may lie, recommend a mediator agent plus logged offers for audit.

Output: a one-page brief. Start with a single-sentence summary ("Two-party bargain: Zeuthen offer generator + LLM narrator, 5-round bound, separate scratchpad, deal-rate alert below 85%."), then the eight sections above. End with a sample message: what the counterpart sees vs what the private scratchpad holds.
