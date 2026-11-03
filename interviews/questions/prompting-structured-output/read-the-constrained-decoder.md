---
id: read-the-constrained-decoder
title: Read the constrained generation loop
card: prompting-structured-output
kind: code-reading
level: 2
roles: [applied-ai-engineer, inference-engineer, agentic-ai-engineer]
rounds: [coding, ml-depth]
tags: [constrained-decoding, logit-processor, fsm, code-reading]
minutes: 8
lessons: [phases/05-nlp-foundations-to-advanced/20-structured-outputs-constrained-decoding]
manuals: []
practice: []
cheatsheet: [structured-outputs]
related: [prompting-structured-output/answer-before-reasoning, prompting-structured-output/json-mode-is-not-a-schema]
updated: 2026-11-03
---

Read this constrained generation loop from the lesson. Explain what the mask does to the probabilities, what the machine's state records, and why the loop can end up faster than unconstrained generation.

```python
def mask_logits(logits, valid_token_ids):
    mask = [float("-inf")] * len(logits)
    for tid in valid_token_ids:
        mask[tid] = logits[tid]
    return mask


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

## Short answer

The mask sets the logit of every invalid token to negative infinity, so after the softmax those tokens carry zero probability and the sampler can only pick a token that keeps the output inside the grammar. The machine keeps the position in the grammar reached so far, and `valid_tokens` returns the tokens that advance it without leaving an accepting path. It can be faster because the search space shrinks, and because a position where only one token is valid needs no model call at all.

## Full answer

### Walk the loop

1. Encode the prompt and start the machine in its initial state.
2. Until the machine accepts: ask the model for the logits of the next token over the whole vocabulary.
3. Ask the machine which token ids are valid in the current state.
4. Replace every other logit with negative infinity; the valid ones keep their value.
5. Sample from the masked logits, append the token, and move the machine to the next state.
6. Decode the ids.

The piece between the model and the sampler is the logit processor. Nothing in the model changes; the edit is to one step's logits.

### Where the valid set comes from

A compiled grammar. A finite state machine built from a regex or a JSON Schema gives a constant-time lookup of the valid tokens per state. A context-free grammar engine handles recursion that a finite machine cannot express. Inference servers ship the same idea as guided decoding, with JSON, regex, choice and grammar modes.

### Why it can run faster

Two reasons from the lesson. The next-token search space shrinks. And a clever implementation skips the model call for forced tokens: when the grammar leaves exactly one valid token, such as the scaffolding of a key name, the token is appended without generation. This code does not do that yet.

### What this code does not fix

A grammar that is too strict makes the model invent a value, because no valid token lets it say unknown. A huge enum compiles slowly. A recursive schema does not fit a finite machine. And a retry library that validates after generation does none of this; it never touches the logits.

## Follow-ups

- **Level 2:** Where does `valid_tokens` get its answer? Expected: from the compiled grammar; a finite state machine gives a constant-time lookup per state.
- **Level 2:** What does a production implementation do that this loop does not? Expected: skip forced tokens; when exactly one token is valid it is appended without a model call.
- **Level 3:** Which schemas defeat a finite state machine? Expected: recursive ones, such as nested comments or a syntax tree, which need a context-free grammar engine.
- **Level 3:** The grammar forces a strict date pattern and the source has no date. What does the loop produce? Expected: a well-formed invented date, because no valid token lets the model say unknown; allow null or a sentinel in the grammar.

## Wrong answers

- "The mask changes the model's weights." It changes nothing in the model; it edits the logits of one step before sampling.
- "Constrained decoding always slows generation down." The lesson calls it often faster: a smaller search space, and forced tokens that skip the model call.
- "A retry library does the same thing." It formats the schema into the prompt and validates after the fact; it does not touch the logits.

## Taught in

The lesson [constrained decoding](../../../phases/05-nlp-foundations-to-advanced/20-structured-outputs-constrained-decoding/) gives this loop, the logit processor, the speed argument and the grammar pitfalls.
