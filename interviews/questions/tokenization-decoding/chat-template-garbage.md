---
id: chat-template-garbage
title: The notebook works and the service never stops talking
card: tokenization-decoding
kind: debug
level: 2
roles: [applied-ai-engineer, inference-engineer, forward-deployed-ai-engineer]
rounds: [debugging, screen]
tags: [chat-template, special-tokens, end-of-sequence, tokenizer, deployment]
minutes: 8
lessons: [phases/10-llms-from-scratch/02-building-a-tokenizer, phases/19-capstone-projects/30-bpe-tokenizer-from-scratch, phases/05-nlp-foundations-to-advanced/19-subword-tokenization]
manuals: []
practice: []
cheatsheet: [tokenization]
related: [tokenization-decoding/pre-tokenization-regex]
updated: 2026-11-03
---

A fine-tuned chat model answers well in the training notebook. The deployed service, with identical weights, returns rambling text that runs until the token limit. Where do you look first, and what do you expect to find?

## Short answer

At the flat token sequence the model actually receives, not at the list of messages. A chat model was trained on one exact layout of role markers, special tokens and newlines; a missing newline, a swapped marker or an extra space puts the input outside the training distribution, and the end-of-turn token stops being predicted. Print the token ids of the same request from both paths and diff them, and check that the special tokens arrived as their reserved ids and not as the bytes that spell them.

## Full answer

### The model never sees the JSON

The service holds a list of role and content pairs. The model sees one flat sequence built by the chat template, which inserts markers such as a begin-of-text token, a header for each role and an end-of-turn token after each message, with specific newlines between them. Every model family lays this out differently. The template is part of the model, in the same way the vocabulary is.

### The three ways it breaks

1. **A different template.** The service used a generic layout or an older version. Each message now sits in a frame the model never saw, and the end-of-turn marker it learned is absent or misplaced, so it never predicts the stop token.
2. **Special tokens spelled out.** Special tokens must be matched exactly before the merge loop and mapped to fixed ids. If the service built the prompt as plain text and encoded it with the allow flag off, the marker string became ordinary bytes and pieces. The model sees text that looks like a marker and is not one.
3. **Stop token mismatch.** The service stops on the generic end-of-sequence id while the model emits its end-of-turn id. Generation continues past the real end.

### The check that settles it

```text
ids_notebook = tokenizer(chat_template(messages))
ids_service  = ids the service sent to the engine
diff the two lists; the first difference is the bug
```

Then decode each id back to its string and look for a marker that decoded as several pieces instead of one reserved id. If the two lists match, the input is fine and the stop token is next: compare the stop ids in the service config with the end-of-turn id that the template puts after each message.

### The fix

Use the model's own template function, pass special tokens through the reserved-id path, and configure the stop token to the id the template ends a turn with. Freeze the tokenizer file and the template together with the weights.

## Follow-ups

- **Level 2:** What does the end-of-turn token do at inference? Expected: it is the model's signal that the answer is complete; the server must stop on that id, or generation runs to the limit.
- **Level 3:** A user types the literal string of a special token into the chat box. What should happen? Expected: with the allow flag off it becomes ordinary bytes, which is the safe default for user text; with it on, the user could inject a control marker.
- **Level 3:** How do you test a template implementation? Expected: build the sequence for a fixed message list and compare it id by id with the output of the model's own template code.
- **Level 4:** The template is correct and the ids still differ between notebook and service. What else? Expected: a different tokenizer file version, a different normalization step, or a different setting for adding special tokens at the start; hash the tokenizer file and compare the flags.

## Wrong answers

- "The sampling temperature is too high in the service." Temperature changes which token is picked, not whether the stop token is ever predicted; the ids differ before sampling.
- "The fine-tune overfit." The same weights behave in the notebook; the difference is in the input layout.
- "Trim the output on the client." That hides the symptom and the model still wastes compute on text it should not generate.

## Taught in

The [tokenizer build lesson](../../../phases/10-llms-from-scratch/02-building-a-tokenizer/) shows the templates and the special-token path, the [BPE capstone](../../../phases/19-capstone-projects/30-bpe-tokenizer-from-scratch/) explains the allow flag, and the [subword lesson](../../../phases/05-nlp-foundations-to-advanced/19-subword-tokenization/) lists the drift and whitespace pitfalls.
