# Evidence: cheatsheets/inference-optimization.md

Abbreviations: P07 = phases/07-transformers-deep-dive/12-kv-cache-flash-attention, P10 = phases/10-llms-from-scratch/12-inference-optimization, Q11 = phases/10-llms-from-scratch/11-quantization, P04 = phases/17-infrastructure-and-production/04-vllm-serving-internals, P08 = phases/17-infrastructure-and-production/08-inference-metrics-goodput, c = code/main.py.

## Architecture: Inference pipeline (6 nodes, 6 edges)
- Request queue and arrival: P04/c:125
- PrefixCache shared prompt trie: P10/c:184-190
- Admit free KV blocks: P04/c:134
- KVCache K and V per token: P10/c:5-19, 21-29
- Prefill chunked prompt: P04/c:150
- Decode one token per step: P10/c:150-151

## One decode step (flow, 4 steps)
1. Write new K and V: P10/c:73
2. Read cache slices up to length: P10/c:21-29
3. Attend over cached prefix: P10/c:79
4. Advance on one-token decode: P10/c:76-77

## Core softmax update (annotated-code, 3 facts)
- Running max: P07/c:46
- Rescale old sums: P07/c:47-50
- Running sum: P07/c:51-52

## Task reference (task-table, 6)
- kv_cache_bytes signature: P07/c:100
- tiled_softmax_dot signature: P07/c:35
- simulate_continuous_batching signature: P10/c:122
- PrefixCache max_entries: P10/c:185
- speculative_decode signature: P10/c:260
- memory_budget signature: P10/c:347

## Defaults (defaults, 8)
- dtype=2 in kv_cache_bytes: P07/c:100
- tile=4: P07/c:35
- max_entries=1000: P10/c:185
- num_speculative=5: P10/c:260
- acceptance_rate=0.8: P10/c:239
- CHUNK_SIZE = 512: P04/c:25
- KV_BLOCK_SIZE = 16: P04/c:26
- KV_BLOCKS_AVAILABLE = 1800: P04/c:27

## Formulas (concepts, 5)
- KV cache bytes: P07/c:100-102
- Per token KV: P10/c:38-39
- Running max softmax: P07/c:46-52
- Block count ceiling: P04/c:52
- Quantization scale: Q11/c:88

## Troubleshooting (troubleshooting, 6)
- Prefix lookup misses: P10/c:202-218
- Trie stops inserting: P10/c:224-225
- Static batch idle slots: P10/c:112-116
- Unchunked prefill stall: P04/c:150
- Speculation slower at low acceptance: P10/c:282-290, 305
- Model does not fit: P10/c:352-353

## Glossary (glossary, 5)
- KV cache: P10/c:5-19
- Prefill: P04/c:80
- Decode: P04/c:89-91
- TTFT: P04/c:87
- ITL: P04/c:93

## Questions (qa, 4)
- Why store K and V: P10/c:73
- Static batching waste: P10/c:112
- Chunk prefill: P04/c:150
- TPOT tool disagreement: P08/c:30-38

## Tips (tips, 4)
- P99 and three limits per request: P08/c:85-91
- Derive chunk size and block count: P04/c:25-27
- Shared prompt prefix: P10/c:202-203
- Check KV memory against budget: P10/c:347-358
