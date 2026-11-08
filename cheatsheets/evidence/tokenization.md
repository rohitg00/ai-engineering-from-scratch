# Evidence: cheatsheets/tokenization.md

Abbreviations: N19 = phases/05-nlp-foundations-to-advanced/19-subword-tokenization, T1 = phases/10-llms-from-scratch/01-tokenizers, T2 = phases/10-llms-from-scratch/02-building-a-tokenizer, C30 = phases/19-capstone-projects/30-bpe-tokenizer-from-scratch, C31 = phases/19-capstone-projects/31-tokenized-dataset-sliding-window.

## Tasks (task-table, 8)
- train(tokenizer, <corpus>, target_vocab_size=320): C30/code/main.py:303,305
- encode(tokenizer, text, allow_special=True): C30/code/main.py:182-186,333
- decode(tokenizer, ids): C30/code/main.py:220,315
- unicodedata.normalize("NFKC", text): T2/docs/en.md:291
- tiktoken.get_encoding("cl100k_base"), enc.encode(text): T1/docs/en.md:389,392
- tokenizer.train(["corpus.txt"], trainer): T1/docs/en.md:411-412
- spm.SentencePieceTrainer.train(input="corpus.txt", vocab_size=8000): N19/docs/en.md:89-92 (other arguments dropped)
- AutoTokenizer.from_pretrained("meta-llama/Llama-3.1-8B"): T1/docs/en.md:426

## Tokenizer and data pipeline (architecture, 8 nodes, 7 edges)
- Raw Text: T2/docs/en.md:37
- Normalize, NFKC: T2/docs/en.md:37, 55
- Pre-Tokenize, split into chunks: T2/docs/en.md:38, 56
- BPE Merge, merge table: T2/docs/en.md:39, 57
- Special Tokens, fixed IDs: T2/docs/en.md:40, 58
- Token IDs, flat list of ids: T2/docs/en.md:41; C31/docs/en.md:34
- PyTorch Dataset, windows of T+1 ids: C31/docs/en.md:39, 68
- DataLoader seeded shuffle, B x T: C31/docs/en.md:42-43, 78

## Train BPE merges (annotated-code, 14 lines)
- initialize, _build_initial_units, while loop: C30/code/main.py:116-118
- _count_pairs weighted by count: C30/code/main.py:80-85,119
- max_count, candidates, best (tie break): C30/code/main.py:112-114,122-124
- pairs[best] < 2 break: C30/code/main.py:125-126
- _add_token, merges[best], _apply_merge_to_corpus: C30/code/main.py:127-131
- 256 bytes then specials: C30/code/main.py:56-63. "if not pairs: break" (120-121) omitted for length.

## Encode fresh text (flow, 7)
1. allow_special maps literal strings to ids: C30/docs/en.md:85, code/main.py:192-210
2. _pretokenize whitespace and non-whitespace runs: C30/code/main.py:66-73
3. chunk to UTF-8 byte ids: C30/code/main.py:76-77,156
4. lowest-ranked merge: C30/docs/en.md:74, code/main.py:160-174
5. replace pair with merged id: C30/code/main.py:177-178
6. stop when no merge applies: C30/docs/en.md:74, code/main.py:175-176
7. concatenate chunk ids: C30/code/main.py:213-217

## Sliding window dataset (annotated-code, 9 lines)
- usable, return 1 + usable // stride: C31/code/main.py:178-181
- start, end, window, return input/target: C31/code/main.py:191-194
- torch.Generator, manual_seed(base_seed + epoch): C31/code/main.py:206-207
- inputs, targets = next(iter(loader)), (B, T): C31/code/main.py:281,286-287

## Algorithms and formulas (concepts, 8)
- BPE: T1/docs/en.md:57
- Byte-level 256, no unknown: T1/docs/en.md:126
- WordPiece criterion, ##: T1/docs/en.md:139-140,145
- Unigram prune: N19/docs/en.md:26
- SentencePiece raw Unicode, ▁: N19/docs/en.md:30
- tiktoken does not train: N19/docs/en.md:30
- O(n · |merges|): N19/docs/en.md:82
- window count formula: C31/docs/en.md:90

## Defaults and numbers (defaults, 8)
- 256, 0x00 to 0xFF: C30/docs/en.md:27,49
- 50,257 = 256 + 50,000 + 1: N19/docs/en.md:24
- 30,522 WordPiece: T1/docs/en.md:152
- 128,256 Llama 3: T1/docs/en.md:162,196
- 200,019 o200k_base: T1/docs/en.md:132
- character_coverage 0.9995, 0.995 Japanese: N19/docs/en.md:94
- stride defaults to context_length: C31/code/main.py:168-169
- num_workers 0: C31/code/main.py:214, docs/en.md:86

## Troubleshooting (8)
- tokenizer drift, hash in CI: N19/docs/en.md:118
- whitespace ambiguity, add_special_tokens, add_prefix_space: N19/docs/en.md:119
- chat template mismatch: T2/docs/en.md:139
- multilingual undertraining 5-10x: N19/docs/en.md:120, T1/docs/en.md:203
- \p{L} needs regex module: T2/docs/en.md:207
- specials as bytes when flag off: C30/docs/en.md:85
- KeyError unknown token id: C30/code/main.py:227-228
- last window dropped: C31/docs/en.md:47

## Terms (glossary, 8)
- BPE: T1/docs/en.md:463
- NFKC: T2/docs/en.md:55,434
- Merge table: T1/docs/en.md:469
- Pre-tokenization: T2/docs/en.md:433, C30/docs/en.md:51
- Fertility 1.0 perfect: T1/docs/en.md:467
- Compression ratio: T1/docs/en.md:471
- Chat template: T2/docs/en.md:435
- Special tokens: T2/docs/en.md:436

## Questions (qa, 5)
- byte alphabet: C30/docs/en.md:27,49
- pre-tokenize: C30/docs/en.md:51
- rank order: C30/docs/en.md:76
- vocab size: T1/docs/en.md:184-186, T2/docs/en.md:416
- seeded shuffle: C31/docs/en.md:78

## Tips (6)
- round trip tests: C30/docs/en.md:91
- compression ratio on held-out text: T1/docs/en.md:320
- encode once at build time: C31/docs/en.md:71
- <|endoftext|> between documents: C31/docs/en.md:96
- stride equal to context length: C31/docs/en.md:53
- vocab size heuristic: N19/docs/en.md:135
