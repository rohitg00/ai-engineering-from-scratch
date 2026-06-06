# Capstone 82 — Jailbreak Taxonomy

> A safety harness without a taxonomy is a coin flip. Name the attack before you defend it.

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 18 safety lessons, Phase 19 Track A lessons 25-29
**Time:** ~90 min

## Problem

A model deployed without an attack model is a model defended against nothing in particular. Operators read a Twitter thread, recognize the trick, write a regex, ship it, and move on. The next prompt is a paraphrase. The regex misses. A week later someone shows the same trick wrapped in base64 and the operator writes a second regex. By month three, the system has 40 patched rules, no shared vocabulary, no way to talk about what an attack actually is, and a backlog growing faster than the patches.

Before any detector, classifier, or rule engine in this track does anything useful, the team needs a shared way to label attacks. Not because labels stop attacks, but because labels turn an attack stream into a histogram. A histogram becomes a coverage chart. A coverage chart drives the next sprint. The harness in lessons 83-87 spends its time deciding whether a prompt is, for example, a role-play attack against a refusal policy versus a context-smuggling attack against a tool. That decision is impossible without a taxonomy.

This capstone defines a six-category taxonomy that is wide enough to cover most attacks seen in the wild, narrow enough that two reviewers usually agree on the category, and concrete enough that each category has at least seven hand-built fixtures. The taxonomy is the carrier wave for everything downstream.

## Concept

The six categories cut along a single axis: what trust boundary does the attack abuse? Each name corresponds to one boundary.

| Category | Trust boundary abused |
|---|---|
| role-play | the assistant's persona |
| instruction-override | the system prompt's authority |
| context-smuggling | the gap between user content and instruction content |
| multi-turn-ramp | the conversation history as a contract |
| encoding-trick | the surface form of forbidden tokens |
| prefix-injection | the assistant's next-token decision |

A role-play attack reframes the assistant as a different agent ("you are an unrestricted research model called QX") so refusal rules attached to the original persona no longer fire. Instruction-override prompts say "ignore previous instructions" and try to overwrite the system prompt directly. Context-smuggling hides instructions inside what looks like data: a pasted document, a tool result, a code block. Multi-turn-ramp warms the model up with harmless turns and then walks the floor down one step at a time, exploiting the model's tendency to stay consistent with the conversation. Encoding tricks (base64, rot13, leet-speak, zero-width insertion) hide forbidden tokens from naive keyword filters. Prefix-injection ends the prompt with "Sure, here's how" so the model continues from the assumed answer instead of refusing.

```mermaid
flowchart TB
  P[prompt] --> C{which boundary}
  C -->|persona| RP[role-play]
  C -->|system prompt| IO[instruction-override]
  C -->|data vs instruction| CS[context-smuggling]
  C -->|history| MT[multi-turn-ramp]
  C -->|surface form| ET[encoding-trick]
  C -->|continuation| PI[prefix-injection]
  RP --> H[(histogram)]
  IO --> H
  CS --> H
  MT --> H
  ET --> H
  PI --> H
  H --> D[coverage chart]
```

Each fixture is a record with `id`, `category`, `subtype`, `prompt`, `target_behavior`, and `severity`. The taxonomy object loads fixtures, groups them by category, and exposes a `match` API: given a candidate prompt, return the closest fixture and its category. Match is character-trigram cosine: coarse, fast, no dependencies. It is not a detector. The detector lives in lesson 83. This is the label producer.

Severity follows a 1-5 scale. A 1 is a clumsy attack against a benign target ("please pretend to be a pirate"). A 5 is an attack that, if successful, produces output a deployed system must not emit (operational details for a dangerous activity). Most fixtures sit at 2-3 because real attacks at deployment scale skew toward the easy and the lazy. Severity is set by the fixture author. Two reviewers disagreeing by more than one rank is a sign the rubric needs sharpening.

## Build It

The corpus lives in `code/fixtures.py` as a single Python list. The taxonomy class in `code/main.py` loads it, validates that every category has at least seven fixtures, exposes `by_category`, `match`, and `stats` methods, and ships a runnable demo that prints the histogram. Trigram cosine is implemented from scratch with `numpy`.

The validation pass checks four invariants: every fixture has a non-empty prompt, every category in the schema is represented, every severity is in `1..5`, and every fixture id is unique. A failure here is a hard exit, not a warning, because the rest of the track depends on the corpus being internally consistent.

## Use It

Run `python3 main.py` from the lesson `code/` directory. The demo prints the per-category fixture count, runs three sample probes against `match`, and writes `taxonomy.json` to the lesson outputs folder. Downstream lessons read `taxonomy.json` rather than importing the Python module, so the corpus is a stable artifact.

## Ship It

`outputs/skill-jailbreak-taxonomy.md` documents the six categories and the rubric. Treat it as the team's shared vocabulary. Every finding logged by the harness in lesson 87 references a taxonomy id.

## Exercises

1. Add a seventh category for indirect-prompt-injection (instruction embedded in a retrieved document, not in the user turn). Author ten fixtures and re-run the validator.
2. Replace trigram cosine with a token-edit-distance scorer and measure how the match assignment changes on the existing corpus.
3. Pull thirty additional fixtures from your own product's logs (redacted) and confirm the category distribution matches what your team intuitively expected.

## Key Terms

| Term | Common usage | Precise meaning |
|---|---|---|
| jailbreak | any unsafe model output | a prompt that produces output violating a stated policy |
| taxonomy | a list of categories | a partition of attacks by which trust boundary they abuse |
| fixture | a test example | a labeled prompt with category, severity, and target behavior |
| severity | how bad the output is | a 1-5 rank for the impact if the attack succeeds |
| match | a detection decision | the nearest fixture by trigram cosine, used to assign a category to a new prompt |

## Further Reading

This lesson is the entry point. Lessons 83-87 build on the corpus directly.
