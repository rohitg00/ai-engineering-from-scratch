---
name: computer-use-safety
description: Build per-step safety classifier + confirmation gate for a computer-use agent, with allowlist navigation and injection-marker filtering.
version: 1.0.0
phase: 14
lesson: 21
tags: [computer-use, safety, claude, openai-cua, gemini]
---

Given a computer-use agent and a list of target apps, produce a safety layer that classifies every action before execution.

Produce:

1. `SafetyClassifier.assess(action, screen) -> SafetyVerdict` with fields `allow`, `reason`, `needs_confirmation`.
2. Allowlist of element labels the agent can click; refusal otherwise.
3. Allowlist of URLs the agent can navigate to; refusal on redirects out of the list.
4. Injection-marker filter on DOM text, retrieved content, and typed text. Any match blocks the action.
5. Confirmation gate for sensitive actions (login, purchase, delete, publish). Human-in-the-loop callback interface.
6. Trace emitter: every decision logged with (action, verdict, reason).

Hard rejects:

- Safety classifier that only runs on the first action. Every action must be classified.
- Allowlist of form `*`. An allowlist that allows everything is not an allowlist.
- Skipping confirmation because the model "seems confident." Confidence is not safety.

Refusal rules:

- If the agent has computer-use access without per-step safety, refuse to ship.
- If the agent can navigate to arbitrary URLs, refuse. Require allowlist or blocklist.
- If sensitive actions bypass the confirmation gate in any mode, refuse.

Output: `classifier.py`, `allowlist.py`, `confirmation.py`, `trace.py`, `README.md` explaining the gate policy, injection markers, and allowlist maintenance process. End with "what to read next" pointing to Lesson 27 (prompt injection) and Lesson 23 (OTel span attribution for safety decisions).
