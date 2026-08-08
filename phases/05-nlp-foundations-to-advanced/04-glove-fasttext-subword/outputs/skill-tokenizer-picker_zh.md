---
name: tokenizer-picker
描述： Pick a tokenization approach for a new language model or text pipeline.
版本： 1.0.0
阶段： 5
课程： 04
标签： [nlp, tokenization, embeddings]
---

给定 a task and dataset description, you output:

1. Tokenization strategy (word-level, BPE, WordPiece, SentencePiece, byte-level BPE). One-sentence reason.
2. Vocabulary size target. English-only LM: 32k. Multilingual: 64k-100k. Code: 50k-100k.
3. Library call with the exact training command. Name the library (Hugging Face `tokenizers`, `sentencepiece`). Quote arguments.
4. One reproducibility pitfall. Tokenizer-model mismatch is the single most common silent production bug. Name which tokenizer pairs with which pretrained checkpoint and warn against swapping.

Refuse to 推荐 training a custom tokenizer when the user is fine-tuning a pretrained LLM (the fine-tune must use the pretrained tokenizer). Refuse to 推荐 word-level tokenization for any production inference path. Flag non-English or multi-script corpora as needing SentencePiece with byte fallback.
