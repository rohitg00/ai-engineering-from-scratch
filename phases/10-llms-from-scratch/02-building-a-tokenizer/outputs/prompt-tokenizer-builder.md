---
name: prompt-tokenizer-builder
description: Build and debug production-quality tokenizers for LLM projects
version: 1.0.0
phase: 10
lesson: 2
tags: [tokenizer, bpe, byte-level, special-tokens, chat-template, multilingual]
---

# Production Tokenizer Builder

When building or debugging a tokenizer for an LLM project, follow this framework.

## Pipeline Checklist

Every production tokenizer needs these five stages. If one is missing, you will hit edge cases in production.

1. **Normalize** -- Apply NFKC Unicode normalization. This collapses ligatures ("fi" -> "fi"), normalizes fullwidth characters, and standardizes whitespace. Skip this and the same word gets different token IDs depending on how it was typed.

2. **Pre-Tokenize** -- Split text into chunks before BPE. Use GPT-2's regex pattern for English-centric models. Use SentencePiece's raw-byte approach for multilingual models. The choice determines whether BPE can merge across word boundaries.

3. **BPE Merge** -- Apply the learned merge table to byte sequences within each chunk. The merge table IS the tokenizer's learned knowledge. Everything else is plumbing.

4. **Special Token Injection** -- Match special tokens exactly before BPE runs. [BOS], [EOS], [PAD], chat template markers get fixed IDs. They never participate in merges.

5. **ID Mapping** -- Convert token strings to integers. The model sees integers only.

## Debugging Tokenizer Issues

**Symptom: model produces garbage on chat input**
- Check the chat template. Every model has a different format. Llama 3 uses `<|start_header_id|>` markers. ChatGPT uses `<|im_start|>` markers. A wrong template puts input outside the training distribution.

**Symptom: non-English text uses too many tokens**
- Check fertility (tokens per word). Above 2.0 means the tokenizer wastes context window on that language. Solutions: retrain with more multilingual data, increase vocabulary size, or use SentencePiece with Unigram.

**Symptom: numbers and arithmetic fail**
- Check how digits are tokenized. "1234" as one token means the model cannot do digit-level operations. Split digits individually during pre-tokenization.

**Symptom: code tokens are inefficient**
- Check how indentation is handled. GPT-2's tokenizer wastes tokens on spaces. Codex and StarCoder use special indentation tokens (4 spaces = 1 token).

## Vocabulary Size Decision

- 32K tokens: single-language, small model, limited compute. Embedding layer is 32K * d_model parameters.
- 50K-64K: multilingual or code-heavy. Good balance for most projects.
- 100K+ (GPT-4, Llama 3): only with massive training data. Shorter sequences but 100K * d_model embedding parameters.

For a 4096-dimensional model: 32K vocab = 131M embedding params. 128K vocab = 524M embedding params. That is 400M parameters just in the embedding layer.

## Speed Requirements

- Training data tokenization: use Rust-backed libraries (tiktoken, HuggingFace tokenizers). Pure Python is 10-100x slower.
- Inference tokenization: latency matters less (single sequence), but still use compiled implementations.
- Benchmark: tokenize 1GB of text and measure wall clock time. If it takes more than 60 seconds, switch to a Rust backend.

## Chat Template Validation

Before deploying any chat model, verify the template:

1. Encode a known conversation with the tokenizer
2. Decode it back to text
3. Compare character-by-character with the expected format from the model's documentation
4. Pay attention to: newlines after header tokens, spaces before content, end-of-turn markers
5. Test edge cases: empty system message, very long user message, multiple assistant turns

Getting the chat template wrong is the most common source of degraded chat model performance.
