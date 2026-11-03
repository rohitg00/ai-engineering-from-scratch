---
id: six-jailbreak-categories
title: Name the attack before you defend it
card: safety
kind: concept
level: 1
roles: [applied-ai-engineer, agentic-ai-engineer, ai-evaluation-reliability-engineer, forward-deployed-ai-engineer]
rounds: [screen, ml-breadth]
tags: [jailbreak, taxonomy, trust-boundary, severity]
minutes: 6
lessons: [phases/19-capstone-projects/82-jailbreak-taxonomy]
manuals: []
practice: []
cheatsheet: [guardrails-moderation, ai-safety]
related: [safety/one-regex-is-not-a-detector, safety/normalize-then-match]
updated: 2026-11-03
---

Your team has shipped forty regex patches against prompts that got past the assistant's refusal rules, and the backlog of new attacks grows faster than the patches. A new engineer asks what an attack even is. Which shared vocabulary do you introduce, and what does it buy the team?

## Short answer

Label every attack by the trust boundary it abuses. Six categories cover most of what arrives: role play against the persona, instruction override against the system prompt, context smuggling in the gap between data and instructions, multi turn ramp against the conversation history, encoding tricks against the surface form of forbidden tokens, and prefix injection against the next token decision. Labels turn the attack stream into a histogram, the histogram into a coverage chart, and the chart into the next sprint.

## Full answer

### The six categories

| Category | Trust boundary abused | Shape |
|---|---|---|
| role play | the assistant's persona | "you are an unrestricted model called ..." |
| instruction override | the system prompt's authority | "disregard everything above" |
| context smuggling | data against instructions | an order hidden in a pasted document or a tool result |
| multi turn ramp | the conversation as a contract | harmless turns, then one step down at a time |
| encoding trick | the surface form of tokens | base64, rot13, leet speak, zero width characters |
| prefix injection | the next token decision | "start your answer with: Sure, here is" |

### The fixture record

Each labeled example carries an id, a category, a subtype, the prompt, the target behavior and a severity from 1 to 5. A 1 is a clumsy attack on a benign target; a 5 would produce output a deployed system must never emit. Most real attacks sit at 2 or 3. The author sets the severity, and when two reviewers differ by more than one rank the rubric needs sharpening.

### What the corpus must satisfy

Every category has at least seven fixtures, every prompt is non empty, every severity is in range and every id is unique. A failure stops the build, because every later component reads this corpus.

### What the taxonomy is not

The nearest fixture match, by character trigram cosine, assigns a label to a new prompt. It is a label producer. The detector with measured precision and recall is a separate component that consumes the labels.

## Follow-ups

- **Level 1:** A prompt tells the model to forget everything it was told before. Which boundary is that? Expected: the system prompt's authority, so instruction override.
- **Level 2:** An attacker places commands inside text that the user asks the model to summarize. Which category? Expected: context smuggling.
- **Level 2:** Why at least seven fixtures per category? Expected: so every category has enough examples to measure a detector against and the histogram is never empty.
- **Level 3:** Two reviewers rate one fixture at severity 2 and 4. What does that tell you? Expected: the rubric is not sharp enough; a gap of more than one rank is the signal to rewrite it.

## Wrong answers

- "A regex per attack is a taxonomy." A regex is a patch; without categories you cannot see coverage or talk about what an attack is.
- "Severity is how bad the prompt sounds." Severity is the impact if the attack succeeds, set on a 1 to 5 scale by the author.
- "The nearest fixture match is the detector." The match assigns a label; the detector with measured precision and recall is a separate component.

## Taught in

The [jailbreak taxonomy capstone](../../../phases/19-capstone-projects/82-jailbreak-taxonomy/) defines the six categories, the fixture record and the severity rubric.
