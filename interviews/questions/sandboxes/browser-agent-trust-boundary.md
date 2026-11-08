---
id: browser-agent-trust-boundary
title: A travel agent that reads any page and is logged in
card: sandboxes
kind: design
level: 3
roles: [agentic-ai-engineer, ai-evaluation-reliability-engineer, applied-ai-engineer]
rounds: [system-design, design-review]
tags: [browser-agent, prompt-injection, trust-boundary, computer-use, hitl]
minutes: 10
lessons: [phases/15-autonomous-systems/11-browser-agents, phases/14-agent-engineering/21-computer-use-agents]
manuals: []
practice: []
cheatsheet: [autonomous-agents, embodied-computer-use]
related: [sandboxes/screen-text-is-not-permission]
updated: 2026-11-03
---

Design the trust boundary for a browser agent that books travel for employees. It reads arbitrary pages, it is logged in to the travel site, and it can submit forms. Name the attack classes you assume, draw the boundary, pick the evaluation that matches the job, and name the one defense you refuse to rely on by itself.

## Short answer

Assume five classes: instructions in page text, payloads in URL fragments or query strings that never render, a page that asks the agent to write a durable memory that fires next session, CSRF-shaped requests that ride the logged-in session, and a harmless-looking button that carries a follow-on action. Draw a read/write boundary: reading is never consequential, and any write, a form submit, a post, a side-effect tool or a navigation that changes state, needs fresh human approval when the initiating content came from outside the trust boundary, with a per-task tool allowlist, scoped credentials only, and every HTTP request logged. Evaluate on transactional web flows, not on fact finding. The defense you never rely on alone is the content sanitizer, because the agent must read untrusted content to work and a pattern filter removes the easy attacks only.

## Full answer

### Why the class stays open

The attack is isomorphic to the capability: the agent must read untrusted content, any content it reads could contain instructions, and any instruction it follows could be misaligned with the user. That is the reasoning behind the public statement that indirect injection is not a bug that can be fully patched. Defenses raise the cost and shrink the blast radius. Design for containment, not for a closed class.

### The boundary, piece by piece

| Piece | What it does |
|---|---|
| read/write boundary | reads never act; writes with out-of-trust provenance wait for fresh approval |
| per-task tool allowlist | the agent can browse, and it cannot initiate a payment unless that tool was enabled for the task |
| session isolation | scoped credentials only, no production auth and no personal mailbox, with a request log for audit |
| per-step safety check | an action is assessed before it runs, and clicks outside the allowed area or typing that carries injection patterns are refused |
| human confirmation | login, purchase and CAPTCHA always wait for a person |
| sanitizer | fetched HTML is stripped of known-bad patterns before it enters the context |
| memory canary | a planted memory entry is visible to the user when it fires |

All three production computer-use models are vision-based and treat screenshots, DOM text, tool outputs and PDF content as untrusted; only direct user instructions count as permission. A long run needs per-step traces, because a 200-click run that fails late is not debuggable without them.

### Pick the benchmark that matches the task

A fact-finding benchmark measures whether the agent finds facts on the open web; a desktop benchmark measures whether it drives a full operating system; the verified web-task benchmark measures whether it completes transactional flows in simulated sites, with a hard subset for multi-page state. A high fact-finding score says nothing about booking a flight. The evaluation for this product is the transactional one, and the acceptance test is the write gate firing on every injected write.

## Follow-ups

- **Level 3:** The booking ends in a purchase. Which input may authorize it? Expected: only a direct user instruction; nothing read from a page, a fragment or a tool result.
- **Level 3:** A page tells the agent to remember a rule for next time. What stops the delayed payload? Expected: treat a memory write as a write that needs approval, and keep a canary so a planted entry is visible when it fires.
- **Level 4:** Why does a request log belong in the boundary? Expected: CSRF-shaped actions ride the session with valid cookies, so the log is the only way to see what the agent did with them after the fact.
- **Level 4:** What does a sanitizer still miss, by construction? Expected: anything that is not a known pattern, including a plain sentence that reads as a request, because the agent cannot stop reading.

## Wrong answers

- "Strip the HTML and the problem is solved." The filter removes known shapes; the class is not closable because the agent must read.
- "The model is trained to refuse injections." The vendors' own documentation treats retrieved content as untrusted and puts the gate outside the model.
- "Pick the agent with the best browse score." Fact finding and transactional flows are different axes; evaluate on the flow you ship.

## Taught in

The [browser agents lesson](../../../phases/15-autonomous-systems/11-browser-agents/) names the attack classes and the defenses that ship, and the [computer-use lesson](../../../phases/14-agent-engineering/21-computer-use-agents/) states the untrusted-input contract and the per-step pattern.
