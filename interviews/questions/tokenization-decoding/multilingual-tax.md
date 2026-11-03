---
id: multilingual-tax
title: The same prompt costs more tokens in Korean
card: tokenization-decoding
kind: concept
level: 1
roles: [applied-ai-engineer, ai-data-engineer, forward-deployed-ai-engineer]
rounds: [screen, customer]
tags: [tokenization, multilingual, fertility, context-window, bytes]
minutes: 6
lessons: [phases/10-llms-from-scratch/01-tokenizers, phases/05-nlp-foundations-to-advanced/19-subword-tokenization, phases/10-llms-from-scratch/02-building-a-tokenizer]
manuals: []
practice: []
cheatsheet: [tokenization]
related: [tokenization-decoding/vocab-size-tradeoff]
updated: 2026-11-03
---

A customer in Korea reports that the same prompt uses up far more of the context window than the English version, and the bill is higher too. Why does this happen, and what does a model builder do about it?

## Short answer

The vocabulary was trained on English-heavy text, so its merges cover English and other scripts fall back to short pieces or raw bytes. Korean averages 2 to 3 tokens per word on an older vocabulary, and non-Latin text can cost 5 to 10 times more tokens than English for the same meaning; a Chinese character is 3 bytes in UTF-8, so without merges each character is several tokens. The builder's fix is a larger vocabulary trained on multilingual data, which is why one model family grew its vocabulary from 32K to 128K.

## Full answer

### Where the tokens go

A byte-level tokenizer never fails, but it only compresses what it has merges for. Each Chinese character is 3 bytes, Japanese characters are 3 to 4 bytes, an emoji is 4 bytes and can take 5 tokens. If the training corpus held little of a script, the merge table has few pieces for it, and the text stays close to one token per byte.

### What the customer feels

- The context window is a token budget, so the same document fits less often.
- Pricing is per token, so the same request costs more.
- Latency is per generated token, so answers in that script are slower.

The lesson's phrase is that a user of such a script effectively has a context window half the size of an English user's.

### What the builder does

1. Train the vocabulary on a corpus that mirrors the target language mix.
2. Grow the vocabulary so that more merges serve non-Latin scripts; the move from 32K to 128K in one family was made mainly for this.
3. Train with a library that works on raw text without pre-tokenization, so scripts without spaces segment well.
4. Measure fertility per language and report it with the model.

### How to measure it

Take the same 10 meaning-aligned sentences in English, Spanish, Chinese, Korean and Arabic, from one parallel corpus, tokenize each with the candidate vocabulary, and compare the average tokens per character. The ratios are the tax; with sentences that do not match, report them as a spot check only.

## Follow-ups

- **Level 1:** Define fertility in one sentence. Expected: the average number of tokens the tokenizer produces per word, where higher means the model works harder for the same text.
- **Level 2:** How do you measure the tax for a new vocabulary? Expected: tokenize matched sentences in several languages and compare tokens per character or per word.
- **Level 2:** Why does a larger vocabulary help scripts other than English? Expected: more merges can be spent on their byte patterns, so each character or word needs fewer tokens.
- **Level 3:** What does the tax do to a product's cost model? Expected: per-token pricing and per-token latency scale with the token count, so the same feature costs more and runs slower in affected languages, and the context budget shrinks.

## Wrong answers

- "Korean is harder for the model to understand." The model sees ids; the extra cost comes from the tokenizer's merges, not from the language.
- "Use a character-level tokenizer for Korean." Characters make every sequence longer; the fix is merges that cover the script.
- "The model has a smaller context window for Korean." The window is the same number of tokens; the tokenizer spends more of them per word.

## Taught in

The [tokenizers lesson](../../../phases/10-llms-from-scratch/01-tokenizers/) names the multilingual tax, the [subword lesson](../../../phases/05-nlp-foundations-to-advanced/19-subword-tokenization/) lists the pitfalls, and the [tokenizer build lesson](../../../phases/10-llms-from-scratch/02-building-a-tokenizer/) gives the byte counts per script.
