---
id: system-user-prefill
title: The three parts of a chat call and the prefill trick
card: prompting-structured-output
kind: concept
level: 1
roles: [applied-ai-engineer, ai-developer-relations-engineer, forward-deployed-ai-engineer]
rounds: [screen, ml-breadth]
tags: [system-prompt, prefill, prompt-anatomy, constraints]
minutes: 6
lessons: [phases/11-llm-engineering/01-prompt-engineering]
manuals: []
practice: []
cheatsheet: [prompt-engineering]
related: [prompting-structured-output/json-mode-is-not-a-schema]
updated: 2026-11-03
---

Walk me through the three parts of a chat API call and what each one is for. Then tell me how you would get a model to return a JSON object with no preamble, without a structured output API.

## Short answer

The system message sets identity, rules and output constraints and persists across turns. The user message carries the task and changes every turn. The assistant prefill starts the model's reply for it, so a prefill of an opening brace makes the model continue as JSON with no preamble, on the providers that accept a partial assistant turn.

## Full answer

### The three parts

| Part | Role | Lifetime |
|---|---|---|
| System message | identity, behavioral rules, output rules; the model treats it as the highest-priority context | persists across turns |
| User message | the task or the question | changes every turn |
| Assistant prefill | the first characters of the reply, written by you | one turn |

Without a system message, the user message is under-constrained and the model fills the gaps with guesses.

### The prefill

Send a final message with the assistant role and the content `{`. The model continues from there, so the reply is the rest of the object, and your code puts the brace back in front. No preamble, no code fence. Where the provider does not accept a partial assistant turn, use its structured output mode instead.

### Write the instruction, not the wish

The lesson's rules for a clear instruction: name the format, the length, the audience, what to include and what to exclude, and give one example of the output. Three kinds of constraint work: negative ones that remove regions of the output space, positive ones that guarantee a structure in every reply, and conditional ones that handle edge cases.

### Do not over-constrain

A system prompt of 2,000 words of rules leaves the model less room for the task. The lesson keeps most system prompts under 500 tokens, and checks them for contradictions, because when two rules conflict the model picks one at random.

## Follow-ups

- **Level 1:** Why does the system message come first? Expected: the model gives it the highest priority, and it stays constant while user turns change.
- **Level 2:** What does the prefill save compared with an instruction to respond in JSON? Expected: the preamble and the code fence; the reply starts inside the object, so the parser sees JSON from the first character.
- **Level 2:** Your system prompt has grown to 2,000 words of rules. What does the lesson say? Expected: over-constraining; the model spends its capacity on the rules instead of the task, and most tasks want a system prompt under 500 tokens.
- **Level 3:** How do you write one prompt that behaves the same on several providers? Expected: plain English, an explicit format, XML style delimiters, the instructions at the start and the end, temperature zero while testing, and two or three examples.

## Wrong answers

- "The system message is just the first user message." It is processed with a higher priority and persists while user turns change.
- "A prefill works on every provider." Only some accept a partial assistant turn; elsewhere use the structured output mode.
- "More rules in the system prompt means more control." Past a point the model spends its capacity on the rules; the lesson keeps most system prompts under 500 tokens.

## Taught in

The lesson [prompt engineering](../../../phases/11-llm-engineering/01-prompt-engineering/) gives the anatomy of a call, the prefill and the rules for clear instructions.
