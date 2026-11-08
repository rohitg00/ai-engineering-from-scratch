# Evidence: cheatsheets/scaling-laws-pretraining.md

Abbreviations: L13 = phases/07-transformers-deep-dive/13-scaling-laws, L03 = phases/10-llms-from-scratch/03-data-pipelines, L04 = phases/10-llms-from-scratch/04-pre-training-mini-gpt. d = docs/en.md, c = code/main.py.

## Data pipeline (architecture, 8 nodes, 7 edges)
- Raw text, Common Crawl ~250 TB raw: L03/d:37, L03/d:65
- HTML strip, keep visible text: L03/d:66, L03/d:83
- Language detection, lid.176.bin, 0.8 confidence: L03/d:67, L03/d:85
- Quality filter, perplexity-based or heuristics: L03/d:68, L03/d:87, L03/d:218
- Deduplication, MinHash + LSH: L03/d:69, L03/d:97
- PII removal, regex and NER: L03/d:70, L03/d:91
- Tokenize + pack with EOS between docs: L03/d:135, L03/d:296-302
- DataLoader, randomized batches; sequences and masks: L03/d:321, L03/d:326-344

## Formulas (concepts, 8)
- C ≈ 6 × N × D: L13/d:17, L13/d:148
- L(N, D) = A/N^α + B/D^β + E: L13/d:33-35
- α ≈ 0.34, β ≈ 0.28, E ≈ 1.69, A ≈ 406, B ≈ 411: L13/d:39-41
- N_opt ~ C^0.5, D_opt ~ C^0.5: L03/d:166-171. D/N ≈ 20: L13/d:49, L13/d:53
- Jaccard, threshold 0.8: L03/d:125, L03/d:282-283
- Compression ratio 3-4 characters per token: L03/d:389
- Start loss ln(256) = 5.55: L04/d:435
- sqrt(64) = 8 scaling: L04/d:144

## Models against Chinchilla (comparison, 5 rows)
- GPT-3 175B on ~300B, about 1.7 tokens per param: L13/d:19
- Chinchilla 70B, 1.4T, Yes (by design): L13/d:21, L03/d:178. 20 tokens per param: L13/d:21
- Llama 3 8B on 15T, 1,875 tokens per param, 94× past: L13/d:23
- GPT-3 undertrained: L03/d:177, L13/d:21
- Kaplan laws backed pushing N: L13/d:19. Chinchilla minimizes loss per FLOP: L13/d:57, L13/d:149. Smaller model cheaper to serve: L13/d:23, L03/d:182

## Compute-optimal against over-trained (comparison, 6 rows)
- Minimizes training loss per training FLOP; inference dominates total cost: L13/d:57-59
- 20 vs 100–500 tokens per param by serving volume: L13/d:53, L13/d:65
- Training paid once, inference forever; over-training spends extra pretrain FLOPs: L13/d:57, L13/d:150
- Inference cost scales with N: L13/c:89, L13/c:70
- compute_optimal(C) and chinchilla_loss(N_under, D_over): L13/c:62-65
- Chinchilla 70B on 1.4T, Llama 3 8B on 15T: L13/d:21, L13/d:59

## Run the data pipeline (annotated-code, 10 lines)
- generate_sample_corpus: L03/c:338
- clean_text: L03/c:342. Strips HTML, URLs, collapses spaces: L03/c:8-14
- quality_filter: L03/c:346. Length, caps, special chars: L03/d:218
- deduplicate(filtered_docs, threshold=0.8): L03/c:353
- SimpleTokenizer, train_bpe(all_text, num_merges=100): L03/c:360-362
- tokenize_corpus appends tokenizer.eos_id: L03/c:367, L03/c:163
- pack_sequences(token_ids, seq_length, pad_id=0), seq_length = 128: L03/c:372-373
- PreTrainingDataLoader(sequences, masks, batch_size), batch_size = 4, shuffle=True default: L03/c:377-378, L03/c:183
- compute_statistics(...): L03/c:395

## One training step (flow, 7 steps)
1. seq_len + 1 tokens, input_ids drop last, target_ids drop first: L04/c:202-208
2. np.triu(np.full((seq_len, seq_len), -1e9), k=1): L04/c:210
3. embeddings, blocks, ln_f, logits with token_embed.T: L04/c:211-218
4. cross_entropy_loss(logits, target_ids), max-subtracted log-softmax: L04/c:220, L04/c:120-131
5. Backward pass for all parameters: L04/d:203
6. block.ffn.W1 -= lr * gW1: L04/c:256-261
7. Warmup over 2,000 steps, cosine decay: L04/d:206

## Functions in the lessons (task-table, 7)
- chinchilla_loss(N, D): L13/c:16
- compute_optimal(C_flops, n_grid=200): L13/c:20
- get_shingles(text, k=5): L03/c:30
- lsh_buckets(signature, bands=16): L03/c:50
- train_mini_gpt(corpus, num_steps=200): L04/d:489
- parameter_breakdown(): L04/c:273
- memory_estimate(): L04/c:300

## Defaults (defaults, 8)
- min_words 50: L03/c:17. Stub pages: L03/d:218
- max_ratio_caps 0.3: L03/c:17. ALL CAPS: L03/d:218
- max_ratio_special 0.1: L03/c:17. Symbol noise: L03/d:218
- num_hashes 128: L03/c:37, L03/c:61
- bands 16: L03/c:50, L03/c:61. More bands increase recall: L03/d:289
- threshold 0.8: L03/c:61
- vocab_size 50257, MiniGPT 768 dims, 12 heads, 12 layers: L04/c:82-83
- max_seq_len=1024: L04/c:83. Context window 1024 for GPT-2: L04/d:465

## Troubleshooting (troubleshooting, 8)
- Duplicates cause memorization and regurgitation; Llama removed ~38%: L03/d:89, L03/d:127
- Model outputs HTML tags without cleaning: L03/d:61
- Tokens from Document A should not attend to Document B; block-diagonal mask: L03/d:158
- Utilization below 90% means padding waste: L03/d:391, L03/d:133-135
- English with less than 0.8 confidence probably not clean English: L03/d:85
- High learning rate at start causes divergence; warmup: L04/d:206
- exp(large_number) overflows, subtract the max: L04/d:261
- Gradients vanish without residual connections: L04/d:85, L04/d:526

## GPT-2 Small numbers (concepts, 7)
- 124,438,272 with weight tying: L04/d:23, L04/d:219
- Token embeddings (50257, 768) 38,597,376: L04/d:212
- Per block 7,080,960; attention 2,359,296; FFN 4,718,592: L04/d:214-218
- 12 heads of 64 dims, FFN 768 to 3,072: L04/d:109, L04/d:339
- Weight tying saves 38M: L04/d:221, L04/d:525
- KV cache 18,432 values per token, about 75MB at 1024 in FP32: L04/d:152
- 0.02 standard deviation init: L04/d:244

## Use scaling laws to decide (tips, 7)
- Below 20 tokens per param, saturation: L13/d:122
- Inference budget, smaller longer-trained model: L13/d:123
- Beyond 1000× Chinchilla-optimal, noise: L13/d:124
- Continuous loss reliable, benchmark jumps scorer artifacts: L13/d:73
- Muon, MoE, data curation shift constants, not the asymptote: L13/d:87, L13/d:129
- ~5–10 trillion English tokens after filtering: L13/d:128
- Llama 3 mix 50/25/13/8/4: L03/d:45

## Questions (qa, 4)
- E is irreducible loss, entropy of the data: L13/d:151
- Training cost once, inference forever: L13/d:57
- Padding wastes compute; pack and mask: L03/d:133-135, L03/d:158
- Decode memory-bound, prefill compute-bound: L04/d:158-160
