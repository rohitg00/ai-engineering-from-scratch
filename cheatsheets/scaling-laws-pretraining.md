---
id: scaling-laws-pretraining
title: Scaling Laws and Pre-Training
code: SL
subtitle: Chinchilla math, over-training, the data pipeline from raw text to packed batches, and a mini GPT training loop.
hue: 12
sources: phases/07-transformers-deep-dive/13-scaling-laws, phases/10-llms-from-scratch/03-data-pipelines, phases/10-llms-from-scratch/04-pre-training-mini-gpt
source_hash: b09c039a81d2efa9
---

## Data pipeline
type: architecture
from: phases/10-llms-from-scratch/03-data-pipelines/docs/en.md

```arch
node | raw | 1,1 | Raw text | Common Crawl ~250 TB raw | store
node | html | 2,1 | HTML strip | visible text only | process
node | lang | 3,1 | Language detection | lid.176.bin, 0.8 confidence | process
node | qual | 4,1 | Quality filter | perplexity or heuristics | process
node | dedup | 4,2 | Deduplication | MinHash + LSH | process
node | pii | 3,2 | PII removal | regex and NER | process
node | pack | 2,2 | Tokenize + pack | EOS between docs | process
node | load | 1,2 | DataLoader | shuffled batches | queue
edge | raw | html |
edge | html | lang |
edge | lang | qual |
edge | qual | dedup |
edge | dedup | pii |
edge | pii | pack |
edge | pack | load | sequences, masks
```

## Formulas
type: concepts
from: phases/07-transformers-deep-dive/13-scaling-laws/docs/en.md, phases/10-llms-from-scratch/03-data-pipelines/docs/en.md, phases/10-llms-from-scratch/04-pre-training-mini-gpt/docs/en.md

- **Compute**: $C \approx 6 \times N \times D$ FLOPs for a standard transformer.
- **Hoffmann loss**: $L(N, D) = \frac{A}{N^\alpha} + \frac{B}{D^\beta} + E$
- **Fitted constants**: $\alpha \approx 0.34$, $\beta \approx 0.28$, $E \approx 1.69$, $A \approx 406$, $B \approx 411$.
- **Compute-optimal**: $N_{\text{opt}} \sim C^{0.5}$, $D_{\text{opt}} \sim C^{0.5}$, $D/N \approx 20$.
- **Jaccard**: shared shingles over all shingles. Remove a copy above 0.8.
- **Compression ratio**: characters per token. English is about 3-4.
- **Start loss**: about $\ln(V)$. A 256-token byte vocab starts at 5.55.
- **Attention scale**: divide by $\sqrt{d_k}$. For 64 dims that is 8.

## Models against Chinchilla
type: comparison
from: phases/07-transformers-deep-dive/13-scaling-laws/docs/en.md, phases/10-llms-from-scratch/03-data-pipelines/docs/en.md

| Factor | GPT-3 | Chinchilla | Llama 3 8B |
|---|---|---|---|
| Parameters | 175B | 70B | 8B |
| Tokens | ~300B | 1.4T | 15T |
| Tokens per param | About 1.7 | About 20 | 1,875 |
| Verdict | Undertrained | Compute-optimal by design | 94× past optimal |
| Why | Kaplan laws: push N hard | Minimize loss per FLOP | Cheap to serve at scale |

## Compute-optimal against over-trained
type: comparison
from: phases/07-transformers-deep-dive/13-scaling-laws/docs/en.md, phases/07-transformers-deep-dive/13-scaling-laws/code/main.py

| Factor | Chinchilla-optimal | Over-trained |
|---|---|---|
| Minimizes | Training loss per training FLOP | Total cost with inference |
| Tokens per param | About 20 | 100 to 500, by serving volume |
| Cost paid | Once, at training | Extra pretrain FLOPs once |
| Inference cost | Higher, N is larger | Lower, N is smaller |
| Code check | `compute_optimal(C)` | `chinchilla_loss(N_under, D_over)` |
| Example | Chinchilla 70B on 1.4T | Llama 3 8B on 15T |

## Run the data pipeline
type: annotated-code
lang: python
from: phases/10-llms-from-scratch/03-data-pipelines/code/main.py

```python
raw_docs = generate_sample_corpus()
cleaned_docs = [clean_text(doc) for doc in raw_docs]   # strip HTML, URLs, spaces
filtered_docs = [doc for doc in cleaned_docs if quality_filter(doc)]   # length, caps, symbols
deduped_docs, num_removed = deduplicate(filtered_docs, threshold=0.8)   # MinHash + LSH
tokenizer = SimpleTokenizer()
tokenizer.train_bpe(all_text, num_merges=100)
token_ids = tokenize_corpus(deduped_docs, tokenizer)   # adds eos_id after each doc
sequences, masks = pack_sequences(token_ids, seq_length, pad_id=0)   # seq_length 128
loader = PreTrainingDataLoader(sequences, masks, batch_size)   # batch_size 4, shuffled
stats = compute_statistics(deduped_docs, token_ids, sequences, tokenizer.vocab_size())
```

## One training step
type: flow
from: phases/10-llms-from-scratch/04-pre-training-mini-gpt/docs/en.md, phases/10-llms-from-scratch/04-pre-training-mini-gpt/code/main.py

1. **Batch**: take `seq_len + 1` tokens. Inputs drop the last token. Targets drop the first.
2. **Mask**: `np.triu(np.full((seq_len, seq_len), -1e9), k=1)` blocks future positions.
3. **Forward**: embeddings, all blocks, final LayerNorm. Logits use `token_embed.T`.
4. **Loss**: `cross_entropy_loss(logits, target_ids)` with a max-subtracted log-softmax.
5. **Backward**: compute gradients for all parameters.
6. **Update**: `block.ffn.W1 -= lr * gW1` and the same for each tensor.
7. **Schedule**: GPT-2 warms up over 2,000 steps, then cosine decay.

## Functions in the lessons
type: task-table
from: phases/07-transformers-deep-dive/13-scaling-laws/code/main.py, phases/10-llms-from-scratch/03-data-pipelines/code/main.py, phases/10-llms-from-scratch/04-pre-training-mini-gpt/code/main.py, phases/10-llms-from-scratch/04-pre-training-mini-gpt/docs/en.md

| Task | Code |
|---|---|
| Predict the loss | `chinchilla_loss(N, D)` |
| Find the optimal N and D | `compute_optimal(C_flops, n_grid=200)` |
| Word shingles | `get_shingles(text, k=5)` |
| Bucket a signature | `lsh_buckets(signature, bands=16)` |
| Train the tiny GPT | `train_mini_gpt(corpus, num_steps=200)` |
| GPT-2 family counts | `parameter_breakdown()` |
| Weights and KV memory | `memory_estimate()` |

## Defaults
type: defaults
from: phases/10-llms-from-scratch/03-data-pipelines/code/main.py, phases/10-llms-from-scratch/04-pre-training-mini-gpt/code/main.py

| Setting | Default | Note |
|---|---|---|
| `min_words` | 50 | Drops stub pages |
| `max_ratio_caps` | 0.3 | Drops ALL CAPS spam |
| `max_ratio_special` | 0.1 | Drops symbol noise |
| `num_hashes` | 128 | MinHash signature length |
| `bands` | 16 | More bands give more recall |
| `threshold` | 0.8 | Jaccard cut for a duplicate |
| `vocab_size` | 50257 | `MiniGPT` with 768 dims, 12 heads, 12 layers |
| `max_seq_len` | 1024 | GPT-2 context window |

## Troubleshooting
type: troubleshooting
from: phases/10-llms-from-scratch/03-data-pipelines/docs/en.md, phases/10-llms-from-scratch/04-pre-training-mini-gpt/docs/en.md

| Symptom | Cause | Fix |
|---|---|---|
| Model repeats passages verbatim | Duplicates in the data | MinHash dedup, about 38% of web data |
| Output has HTML tags | Raw web text | Strip HTML before training |
| Docs leak into each other | Packed docs share attention | Use a block-diagonal mask |
| Sequence utilization below 90% | Padding waste | Pack docs with EOS between them |
| English score below 0.8 confidence | Not clean English | Filter the document out |
| Model diverges early | High learning rate at start | Warm up the learning rate |
| `exp` overflows to infinity | Large logits | Subtract the max before exp |
| Gradients vanish near block 1 | No residual path | Add `x + sublayer(x)` |

## GPT-2 Small numbers
type: concepts
from: phases/10-llms-from-scratch/04-pre-training-mini-gpt/docs/en.md

- **Total**: 124,438,272 parameters with weight tying.
- **Token embeddings**: (50257, 768) is 38,597,376.
- **Per block**: 7,080,960. Attention 2,359,296 and FFN 4,718,592.
- **Heads**: 12 heads of 64 dims. FFN goes 768 to 3,072.
- **Weight tying**: the head reuses the token embedding. Saves 38M.
- **KV cache**: 18,432 values per token. About 75MB at 1024 tokens in FP32.
- **Init**: weights use a 0.02 standard deviation.

## Use scaling laws to decide
type: tips
from: phases/07-transformers-deep-dive/13-scaling-laws/docs/en.md, phases/10-llms-from-scratch/03-data-pipelines/docs/en.md

- Below 20 tokens per base-model param, expect a fine-tune to saturate.
- When inference takes most of the budget, pick a smaller model trained longer.
- Beyond 1000× Chinchilla-optimal, log-loss changes become noise.
- Plan budgets against continuous loss. Benchmark jumps are often scorer artifacts.
- Better data, Muon and MoE shift the constants, not the shape.
- Expect a data ceiling: ~5 to 10 trillion high-quality English tokens.
- Llama 3 mix: 50% web, 25% code, 13% books and papers, 8% math, 4% multilingual.

## Questions
type: qa
from: phases/07-transformers-deep-dive/13-scaling-laws/docs/en.md, phases/10-llms-from-scratch/03-data-pipelines/docs/en.md, phases/10-llms-from-scratch/04-pre-training-mini-gpt/docs/en.md

- **What is $E$?** The irreducible loss. The entropy of the data itself.
- **Why over-train?** You pay training cost once and inference cost forever.
- **Why not pad each doc?** Padding wastes compute. Pack docs and mask.
- **Why is decode slow?** It is memory-bound. Prefill is compute-bound.
