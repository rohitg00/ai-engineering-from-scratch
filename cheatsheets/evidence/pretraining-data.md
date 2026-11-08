# Evidence: cheatsheets/pretraining-data.md

Abbreviations: L03 = phases/10-llms-from-scratch/03-data-pipelines, L31 = phases/19-capstone-projects/31-tokenized-dataset-sliding-window, L42 = phases/19-capstone-projects/42-large-corpus-downloader, L43 = phases/19-capstone-projects/43-hdf5-tokenized-corpus. d = docs/en.md, c = code/main.py, t = code/tests.

## Tasks (task-table, 8)
- python3 code/main.py: L31/c:9, L42/c:10, L43/c:14
- python3 -m unittest discover code/tests -v: L42/t/test_downloader.py:3, L43/t/test_hdf5_corpus.py:3
- deduplicate(filtered_docs, threshold=0.8): L03/c:353
- pack_sequences(token_ids, seq_length, pad_id=0): L03/c:167
- process_shard(plan, downloader, dedup, manifest): L42/c:459-464, 526
- pipeline.write_corpus(shards): L43/c:517
- validate_corpus(entries): L43/c:523
- store.get_slice(start, stop): L43/c:303

## Corpus to batch (architecture, 8 nodes, 7 edges)
- Shard URLs, ShardPlanner: L42/d:29, 70
- StreamingDownloader, Range resume: L42/d:71
- ZstdDocIterator, one document per line: L42/d:72
- Dedup with MinHasher and LSHIndex: L42/d:73-75
- manifest.json with shard sha256: L42/d:60, 76
- HDF5ShardWriter, one HDF5 per source shard: L43/d:68, 99
- MmapTokenStore, swmr reads: L43/d:53, 70
- SlidingWindowDataloader, input and target: L43/d:57, 71
- edge get_slice: L43/d:70. edge shards.json: L43/d:49, 101. edge JSONL shards: L43/d:29, 49

## Clean and filter (annotated-code, 9 lines)
- clean_text regex lines: L03/c:8-14, L03/d:197-203
- quality_filter signature and defaults: L03/c:17, L03/d:205
- stubs, ALL CAPS spam, special character noise: L03/d:218

## Cleaning stages (flow, 6)
1. HTML strip, visible text: L03/d:83
2. fastText lid.176.bin, 0.8 confidence: L03/d:85
3. perplexity filter with a Wikipedia model: L03/d:87
4. MinHash plus LSH, threshold 0.8: L03/d:97, 125
5. PII regex and NER: L03/d:91
6. tokenizer.eos_id after each document: L03/d:301

## Sliding window dataset (annotated-code, 5 lines)
- SlidingWindowDataset(ids, context_length=16, stride=8): L31/c:252-253, 265
- stride None means context_length: L31/c:168-169
- count_windows, 1 + usable // stride: L31/c:177-181
- window[:-1], window[1:]: L31/c:194
- make_dataloader(ds, batch_size=4, base_seed=7, epoch=0): L31/c:254-255, 280
- generator.manual_seed(base_seed + epoch): L31/c:207

## Resume a download (flow, 6)
1. .partial.json and .zst paths: L42/c:278-279
2. _verify_partial size and sha256_prefix_hex: L42/c:295-310
3. mismatch deletes and restarts from zero: L42/c:332-336, L42/d:50
4. Range bytes={resume_from}- and ab mode: L42/c:340, 364
5. status 206 and Content-Range, else full GET: L42/c:349-363
6. _write_checkpoint with os.replace before out.write(buf): L42/c:290-293, 378-379

## Dedup and filter defaults (defaults, 8)
- min_words 50, stub pages fail: L03/c:17, 19
- max_ratio_caps 0.3, ALL CAPS spam fails: L03/c:17, 22
- max_ratio_special 0.1, symbol noise fails: L03/c:17, 25
- threshold 0.8, Jaccard to drop a copy: L03/c:61, 90
- num_hashes 128, signature length: L03/c:61, 37
- bands 16: L03/c:61, 50. DEFAULT_BANDS = 32: L42/c:40
- DEFAULT_SHINGLE_WIDTH 5: L42/c:41. shingle_width=3 in demo: L42/c:521
- CHUNK_BYTES 1 << 16: L42/c:38

## Storage defaults (defaults, 6)
- DEFAULT_CHUNK_SIZE 8192: L43/c:39. chunk_size=512 in demo: L43/c:515
- DEFAULT_WINDOW_SIZE 64: L43/c:40. window_size + 1 read: L43/d:57
- BOUNDARY_TOKEN_ID 0: L43/c:41
- TOKEN_DTYPE np.uint16: L43/c:42. byte offset by one: L43/c:80, 87
- maxshape (None,): L43/c:133, L43/d:45
- libver "latest" for SWMR: L43/c:129, L43/d:93

## Numbers and formulas (concepts, 8)
- window count formula: L31/d:90
- stride T // 2 doubles, 1 by factor T: L31/d:53
- 1 - (1 - s^r)^b, k = b * r: L42/d:56
- threshold (1/b)^(1/r), b=32 r=4 near 0.42: L42/c:170-172
- 3-4 characters per token: L03/d:389
- below 90% sequence utilization: L03/d:391
- approximately 38% removed by the Llama team: L03/d:127
- Chinchilla scale roughly equally: L03/d:173

## Troubleshooting (troubleshooting, 8)
- garbage on resume, offset and file diverge: L42/d:21. sha256 prefix check: L42/d:50
- Range ignored, status not 206, full GET: L42/c:349-363
- power loss reverses order, checkpoint first: L42/d:92
- reader walks into zero padding, truncate at token_count: L43/d:89
- "file is locked", libver="latest", SWMR after structural changes: L43/d:93, swmr_mode: L43/c:137
- chunk mismatch halves throughput, multiple of window_size: L43/d:87
- loss curves diverge without a seed, base seed per epoch: L31/d:78-80
- bands must divide num_hashes ValueError: L42/c:176-177

## Q&A (qa, 6)
- padding wastes compute: L03/d:133
- block-diagonal mask: L03/d:158
- slicer drops the short tail: L31/d:47
- dedup before tokenization: L42/d:105
- tombstone keeps the link to the keeper: L42/d:96
- one HDF5 per source shard, crash loses at most one shard: L43/d:23, 99

## Tips (tips, 5)
- shards.json, not directory listing: L43/d:101
- manifest sha256 and manifest.lock: L42/d:98, 118
- dataset.flush() after each resize: L43/d:93
- buffer-then-extend, not one document at a time: L43/d:23
- stride equal to context length: L31/d:53
