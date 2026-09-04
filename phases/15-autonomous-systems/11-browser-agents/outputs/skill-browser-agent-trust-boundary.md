---
name: browser-agent-trust-boundary
description: Scope a proposed browser-agent deployment — trust zones, authorized writes, required defenses — before the agent touches a real site.
version: 1.0.0
phase: 15
lesson: 11
tags: [browser-agents, prompt-injection, trust-boundary, osworld, webarena]
---

Given a proposed browser-agent workflow, produce a trust-boundary scoping document that enumerates every read, every write, and the minimum defense stack required for first run.

Produce:

1. **Read surface.** List every origin the agent will fetch. Classify each as in-trust (first-party sites operated by the user's organization) or out-of-trust (any third-party, any user-generated content, any search result). All out-of-trust reads must be treated as potential prompt-injection channels.
2. **Write surface.** List every consequential action the agent is authorized to take (submit form, post content, call a backend tool, write to memory). For each, state the blast radius and whether the action is reversible.
3. **Required defenses.** Minimum stack: content sanitizer, read/write boundary (writes require fresh approval when content_origin is out-of-trust), tool allowlist per task, session isolation with scoped credentials, canary tokens on persistent memory, HITL on irreversible actions.
4. **Benchmark-to-distribution fit.** If the agent reports a BrowseComp, OSWorld, or WebArena-Verified score, name the distribution overlap between the benchmark and the real task. A high BrowseComp score does not predict booking-flow reliability.
5. **Known-attack checklist.** Confirm the deployment is hardened against (a) visible-text injection, (b) URL-fragment / query injection, (c) memory-binding attacks (Tainted Memories class), (d) CSRF-shaped attacks on authenticated sessions, (e) one-click hijacks. For each, name the specific defense and where it fires.

Hard rejects:
- Browser agents with access to production credentials and no session isolation.
- Any deployment where a write initiated from out-of-trust content does not require fresh HITL approval.
- Any deployment relying solely on a content sanitizer (sanitizers catch easy attacks; sophisticated payloads pass).
- Persistent memory with no canary entries.
- Workflows that touch financial transactions or customer data with no HITL on writes.

Refusal rules:
- If the user cannot name the blast radius of an injection-driven wrong write, refuse and require an explicit sentence.
- If the user proposes a browser agent on a stack where scoped credentials are not available, refuse and require a separate identity first.
- If the user cites a benchmark score (BrowseComp, OSWorld, WebArena) as evidence the agent "can" do a production task, refuse and require internal evals on the real distribution.

Output format:

Return a trust-boundary memo with:
- **Read surface table** (origin, in-trust / out-of-trust)
- **Write surface table** (action, blast radius, reversible y/n)
- **Defense stack** (bulleted list of configured layers)
- **Benchmark-fit note** (if applicable)
- **Known-attack checklist** (five rows, defense named per row)
- **Deployment verdict** (production / staging / research-only)
