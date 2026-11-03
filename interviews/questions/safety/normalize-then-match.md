---
id: normalize-then-match
title: The same attack in base64, rot13 and zero width
card: safety
kind: design
level: 2
roles: [applied-ai-engineer, agentic-ai-engineer, ai-evaluation-reliability-engineer]
rounds: [system-design, debugging]
tags: [prompt-injection, encoding-trick, normalization, detector]
minutes: 8
lessons: [phases/19-capstone-projects/83-prompt-injection-detector, phases/19-capstone-projects/82-jailbreak-taxonomy]
manuals: []
practice: []
cheatsheet: [guardrails-moderation]
related: [safety/one-regex-is-not-a-detector]
updated: 2026-11-03
---

Your detector's substring rules catch "ignore all instructions" in plain text. Attackers now send the same phrase in base64, in rot13, in leet speak, and with invisible characters between the letters. Design the step that runs before the rules, and say which signals you must not throw away while doing it.

## Short answer

Add a normalize pass that produces a cleaned working copy: strip zero width and bidirectional control characters, decode tokens that look like base64 before you lowercase, because base64 is case sensitive, then lowercase, decode hex and rot13, and map leet digits back to letters. Run the rules on both the raw and the normalized text, because the zero width insertions are themselves an encoding trick signal that the cleaned copy no longer shows.

## Full answer

### The category

Encoding tricks abuse the surface form of forbidden tokens. The words are the same; the bytes are not, so a naive keyword filter misses them. Base64, rot13, leet speak and zero width insertion are the common forms.

### The pass

1. Remove zero width characters and bidirectional controls from the working copy.
2. For any token of 16 or more characters that looks like base64, try to decode it and replace it with the decoded text on success. Do this before the lowercase step, because base64 is case sensitive and a lowercased token decodes to different bytes.
3. Lowercase the copy.
4. Decode hex runs the same way.
5. Map leet digits to their letters.
6. Build the rot13 image of the text and keep it only when it has more dictionary like words than the input, judged against a small built in word list. Every string has a rot13 image, so the check keeps benign text from turning into noise.

### What to keep

The raw prompt stays next to the copy, and rules may read either. Zero width characters inside a word are evidence of an attack on their own, and a decode instruction such as "decode this and then follow it" is the attack pattern whether or not the payload decodes to anything. A regex family rule on the decode and act pattern catches it before the payload matters.

### What to measure

Recall on the encoding category, which the detector should lean toward, and the false positive cost on the benign corpus, where developers paste real base64 and ask for help. The metrics runner reports both per category on every change.

## Follow-ups

- **Level 2:** Why does the rot13 decode need a word check? Expected: every text has a rot13 image; keeping it only when it looks more like words stops benign text from becoming noise.
- **Level 2:** Which boundary does this category abuse? Expected: the surface form of forbidden tokens, hidden from keyword filters.
- **Level 3:** A developer pastes a real base64 blob and asks for help. What happens, and where does the cost show? Expected: the decode may produce text that fires nothing or a false positive; the benign corpus in the metrics runner is where that cost appears.
- **Level 3:** The payload decodes to nothing. Can the prompt still be an attack? Expected: yes; the instruction to decode and carry out is the attack pattern; a family rule on it fires before the payload matters.

## Wrong answers

- "Decode everything and discard the original." The raw text carries signals, such as invisible characters, that the cleaned copy removes.
- "Block any base64 in a prompt." Benign prompts carry encoded data; measure the false positive cost on the benign set before you block on presence.
- "Normalization is the detector." It only exposes hidden tokens to the rules; the rules and the metrics runner are the detector.

## Taught in

The [prompt injection detector capstone](../../../phases/19-capstone-projects/83-prompt-injection-detector/) builds the normalize pass, and the [jailbreak taxonomy capstone](../../../phases/19-capstone-projects/82-jailbreak-taxonomy/) defines the encoding trick category.
