---
name: fipa-mapper
description: Map any 2026 agent-protocol spec (MCP, A2A, ACP, ANP, CA-MCP, NLIP, or a new one) onto FIPA-ACL performatives and interaction protocols to decide what is genuine novelty and what is reinvention.
version: 1.0.0
phase: 16
lesson: 02
tags: [multi-agent, protocols, FIPA, speech-acts, interoperability]
---

Given a new agent-protocol spec, produce the FIPA-ACL mapping so the reader can tell which parts are reinvention and which are genuine new structure.

Produce:

1. **Envelope mapping.** For each message type the spec defines, name the nearest FIPA performative (`inform`, `request`, `query-if`, `query-ref`, `propose`, `accept-proposal`, `reject-proposal`, `cfp`, `subscribe`, `cancel`, `failure`, `not-understood`, or one of the other ~20). If no performative fits, describe the gap precisely.
2. **Correlation model.** How does the spec correlate requests to replies, cancellation to the original request, and streamed events to the subscribe? Compare to FIPA's `:conversation-id` and `:reply-with` fields.
3. **Content-language stance.** Does the spec mandate a content schema (typed artifacts, JSON-Schema), accept natural language, or leave it open? Compare to FIPA's SL0/SL1 and ontology fields.
4. **Interaction-protocol library.** Which FIPA interaction protocols are implementable on top of the spec: contract-net, subscribe-notify, request-when, propose-accept? Name the messages that would implement each.
5. **Discovery model.** How does an agent find counterparties and capabilities (MCP `listTools`, A2A Agent Card, ANP DID + meta-protocol)? Compare to FIPA's directory facilitator and yellow-pages service.
6. **Reinvention vs novelty.** Produce a short table with three columns: [FIPA concept, modern spec equivalent, what changed]. Mark each row as [reinvention] or [novel-structure]. A row is "novel-structure" only when the spec introduces a primitive that FIPA did not have — decentralized identity, typed multimodal artifacts, and LLM-interpretable content are the common candidates.

Hard rejects:

- Any mapping that claims a spec is "revolutionary" without showing a primitive FIPA did not have. Speech-act theory + ontology overhead was the failure mode, not the primitives.
- Framework comparisons that ignore the discovery layer. A spec without discovery is incomplete, not novel.
- Statements like "Protocol X replaces FIPA" without addressing what happens when two agents disagree about content meaning (semantic drift).

Refusal rules:

- If the spec is pre-standardization (draft < 6 months old, no public implementations), state that the mapping is provisional and flag the three most likely changes.
- If the spec is closed-source or enterprise-only (some ACP flavors), map what is documented and name the gaps.
- If the user supplies only a blog post (no spec document), ask for the spec before mapping.

Output: a one-page brief. Start with a single-sentence summary ("Protocol X is FIPA `request`/`subscribe` with JSON syntax and a DID-based discovery layer."), then the six sections above, then a closing paragraph answering: "Which old FIPA failure mode will this spec rediscover?"
