---
name: skill-concept-prompt-designer
description: Turn user utterances into well-formed SAM 3 concept prompts with splitting, disambiguation, and fallbacks
version: 1.0.0
phase: 4
lesson: 24
tags: [sam3, open-vocab, prompt-engineering, segmentation]
---

# Concept Prompt Designer

SAM 3's accuracy depends heavily on how the concept prompt is phrased. This skill normalises free-form user utterances into prompts that SAM 3 handles well.

## When to use

- Building a UI that accepts natural-language object queries.
- Exposing SAM 3 through an API where upstream callers send sentences.
- Debugging poor SAM 3 matches — often the prompt is malformed, not the model.

## Inputs

- `utterance`: raw user string.
- `context`: optional domain hint (e.g. "surveillance", "medical", "retail").
- `max_concepts`: maximum concepts to extract per utterance; default 5.

## Rules SAM 3 prefers

- **Short noun phrases, not sentences.** `"cat"` wins over `"there is a cat"`.
- **Concrete nouns.** `"skateboard"` wins over `"thing to ride on"`.
- **Modifiers immediately before the noun.** `"red car"` wins over `"car that is red"`.
- **Lowercase.** SAM 3 is robust but empirically slightly better on lowercase inputs.
- **Singular or plural.** Both work; plural helps when multiple instances are expected.

## Steps

1. **Tokenise by common separators** — comma, semicolon, "and", "or", "&".
2. **Drop filler prefixes** — "find", "show me", "segment", "detect", "locate", "a", "an", "the".
3. **Keep prepositional modifiers** only if they are visual — `"striped red umbrella"` yes, `"umbrella from yesterday"` no (the `"from yesterday"` is not in-image).
4. **Disambiguate collisions** using the optional `context`:
   - `"window"` in surveillance context -> `"building window"`.
   - `"window"` in medical context -> often error; suggest user clarify.
5. **Fallback** to exact string if splitting fails or yields zero concepts.

## Output format

```
[designed prompts]
  utterance:    <original>
  concepts:     ["concept_1", "concept_2", ...]
  dropped:      ["filler_1", ...]
  warnings:     ["concept too abstract", "may match many classes", ...]

[sam3 calls]
  For each concept run: sam3.detect(image, concept)
  Merge outputs with distinct concept tags per detection.
```

## Examples

```
in:  "can you find me a cat or two dogs?"
out: ["cat", "dog"]
dropped: ["can you find me", "a", "or two", "?"]

in:  "segment the big red truck and the blue sedan"
out: ["big red truck", "blue sedan"]
dropped: ["segment", "the", "and"]

in:  "thing near the door"
out: ["door"]
warnings: ["'thing' is too abstract for SAM 3; fell back to 'door'"]

in:  "striped red umbrella, green hat, pink balloon"
out: ["striped red umbrella", "green hat", "pink balloon"]
```

## Rules

- Never pass sentences longer than 8 words to SAM 3 — accuracy drops above that.
- When an utterance contains no extractable concrete nouns, do not run SAM 3; return the warnings and ask for clarification.
- Do not split on punctuation inside quoted strings; preserve `"black and white cat"` as one concept if it is quoted.
- Always log the original utterance and the derived concepts for production debugging.
