---
id: constrained-decoding-how
title: How a grammar edits the logits and why it can be faster
card: tokenization-decoding
kind: concept
level: 2
roles: [applied-ai-engineer, agentic-ai-engineer, forward-deployed-ai-engineer]
rounds: [ml-depth, system-design]
tags: [constrained-decoding, logit-processor, json-schema, finite-state-machine, structured-output]
minutes: 8
lessons: [phases/05-nlp-foundations-to-advanced/20-structured-outputs-constrained-decoding]
manuals: []
practice: []
cheatsheet: [structured-outputs]
related: []
updated: 2026-11-03
---

A classifier prompt asks for one of three labels and the model answers with a paragraph, so the parser crashes. Three layers of fix exist. Explain how the strongest one works at the level of the logits, and why it is often faster than free generation, not slower.

## Short answer

Prompting asks nicely, a vendor's structured-output API does it on the server, and constrained decoding does it locally by editing the logits. At each step a logit processor computes which vocabulary tokens can advance the target grammar, a JSON schema, a regex or a context-free grammar compiled to a state machine, and sets every other logit to minus infinity, so the softmax puts probability only on valid continuations and an invalid output is unreachable. It can be faster because the search space shrinks and because tokens that the grammar forces, such as a fixed key name, are emitted without a model step.

## Full answer

### The three layers

1. **Prompting.** "Return only the JSON object." The lesson puts this at about 80 percent compliance on strong models and lower on small ones. Not a contract.
2. **Native structured output.** The provider runs the constraint on its side. Reliable for supported schemas; locked to that provider.
3. **Constrained decoding.** The constraint runs in your own decoding loop and works with any local model.

### The loop

```python
def generate_constrained(model, tokenizer, prompt, fsm):
    ids = tokenizer.encode(prompt)
    state = fsm.initial_state
    while not fsm.is_accept(state):
        logits = model.next_token_logits(ids)
        valid = fsm.valid_tokens(state, tokenizer)
        logits = mask_logits(logits, valid)
        tok = sample(logits)
        ids.append(tok)
        state = fsm.transition(state, tok)
    return tokenizer.decode(ids)
```

The state machine tracks how much of the grammar is satisfied. `valid_tokens` returns the vocabulary tokens that keep the machine on an accepting path; the mask sets the rest to minus infinity. The vocabulary is about 100k tokens, so the mask is computed per state ahead of time.

### State machine or grammar engine

A regex or a flat JSON schema compiles to a finite-state machine with a constant-time lookup of valid tokens per state. Recursive schemas, nested comments or a syntax tree, need a context-free grammar engine, which handles recursion at near-zero decoding overhead in current implementations. Inference servers expose both as guided decoding.

### Why it can be faster

Fewer candidate tokens means a smaller effective search at each step. More important, long stretches of the output are fully determined by the grammar: the opening brace, a quoted key, the colon. A good implementation skips the model for those tokens and only calls it where the grammar leaves a choice.

### The library that does not touch logits

A retry-based client formats the schema into the prompt, parses the output, and retries on a validation failure, 3 times by default. It works across providers, and each retry costs latency and money. It is a different mechanism, not a weaker version of the same one.

## Follow-ups

- **Level 2:** When does a finite-state machine not suffice? Expected: for recursive schemas; the machine flattens recursion to a fixed depth, and a context-free grammar engine is needed.
- **Level 3:** What does a provider's plain JSON mode guarantee, and what does it not? Expected: valid JSON syntax, not conformance to your schema; always send a full schema.
- **Level 3:** How does the retry library differ from the logit processor? Expected: it never changes the model's distribution; it validates after the fact and retries, which adds latency and cost per failure.
- **Level 4:** The schema has an enum with 10,000 options and compilation times out. What do you do? Expected: predict a short list of candidates with a retriever first, then constrain the decode to those.

## Wrong answers

- "Constrained decoding makes the answer correct." It makes the answer valid for the grammar; a well-formed wrong answer still passes.
- "Checking the grammar at every token makes generation slower." The valid-token sets are precomputed per state, and forced tokens skip the model, so it is often faster.
- "Enough examples in the prompt reach full compliance." The lesson's figure for prompting alone is about 80 percent; a contract needs the logits or the server.

## Taught in

The [structured outputs lesson](../../../phases/05-nlp-foundations-to-advanced/20-structured-outputs-constrained-decoding/) builds the logit processor and compares the three layers.
