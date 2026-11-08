---
id: pretraining-data
title: Pre-Training Data Pipelines
code: PP
subtitle: Clean, dedup, download, tokenize, shard and window a pretraining corpus. Python from the lessons.
hue: 28
sources: phases/10-llms-from-scratch/03-data-pipelines, phases/19-capstone-projects/31-tokenized-dataset-sliding-window, phases/19-capstone-projects/42-large-corpus-downloader, phases/19-capstone-projects/43-hdf5-tokenized-corpus
source_hash: 4e29cc278516394f
---

## Tasks
type: task-table
from: phases/10-llms-from-scratch/03-data-pipelines/code/main.py, phases/19-capstone-projects/31-tokenized-dataset-sliding-window/code/main.py, phases/19-capstone-projects/42-large-corpus-downloader/code, phases/19-capstone-projects/43-hdf5-tokenized-corpus/code

| Task | Code |
|---|---|
| Run a lesson demo | `python3 code/main.py` |
| Run the tests | `python3 -m unittest discover code/tests -v` |
| Drop near duplicates | `deduplicate(filtered_docs, threshold=0.8)` |
| Pack ids into sequences | `pack_sequences(token_ids, seq_length, pad_id=0)` |
| Download one shard | `process_shard(plan, downloader, dedup, manifest)` |
| Write HDF5 shards | `pipeline.write_corpus(shards)` |
| Check shard hashes | `validate_corpus(entries)` |
| Read a token range | `store.get_slice(start, stop)` |

## Corpus to batch
type: architecture
from: phases/19-capstone-projects/42-large-corpus-downloader/docs/en.md, phases/19-capstone-projects/43-hdf5-tokenized-corpus/docs/en.md

```arch
node | url | 1,1 | Shard URLs | ShardPlanner | client
node | dl | 2,1 | StreamingDownloader | Range resume | process
node | zst | 3,1 | ZstdDocIterator | one doc per line | process
node | dedup | 4,1 | Dedup | MinHasher + LSHIndex | process
node | man | 4,2 | manifest.json | shard sha256 | store
node | h5 | 3,2 | HDF5ShardWriter | one .h5 per shard | store
node | store | 2,2 | MmapTokenStore | swmr reads | store
node | win | 1,2 | SlidingWindowDataloader | input, target | gpu
edge | url | dl | GET
edge | dl | zst | bytes
edge | zst | dedup | docs
edge | dedup | man | verdicts
edge | man | h5 | JSONL shards
edge | h5 | store | shards.json
edge | store | win | get_slice
```

## Clean and filter
type: annotated-code
lang: python
from: phases/10-llms-from-scratch/03-data-pipelines/code/main.py, phases/10-llms-from-scratch/03-data-pipelines/docs/en.md

```python
def clean_text(text):
    text = re.sub(r"<[^>]+>", "", text)  # strip HTML tags
    text = re.sub(r"http\S+", "", text)  # drop URLs
    text = re.sub(r"[^\x20-\x7E\n]", "", text)  # printable ASCII only
    text = re.sub(r"\n{3,}", "\n\n", text)  # collapse blank lines
    text = re.sub(r" {2,}", " ", text)  # collapse spaces
    return text.strip()

def quality_filter(text, min_words=50, max_ratio_caps=0.3, max_ratio_special=0.1):
    ...  # False for stubs, ALL CAPS spam, symbol noise
```

## Cleaning stages
type: flow
from: phases/10-llms-from-scratch/03-data-pipelines/docs/en.md

1. **HTML strip**: keep only the visible text.
2. **Language detection**: fastText lid.176.bin. Below 0.8 confidence is not clean English.
3. **Quality filter**: high perplexity against a Wikipedia model means spam.
4. **Deduplication**: MinHash plus LSH. Remove one copy above 0.8 Jaccard.
5. **PII removal**: regex for structured PII, NER models for names.
6. **Tokenize and pack**: append `tokenizer.eos_id` after each document.

## Sliding window dataset
type: annotated-code
lang: python
from: phases/19-capstone-projects/31-tokenized-dataset-sliding-window/code/main.py

```python
ds = SlidingWindowDataset(ids, context_length=16, stride=8)  # stride None means context_length
SlidingWindowDataset.count_windows(num_ids, context_length, stride)  # 1 + usable // stride
x, y = ds[0]  # window[:-1], window[1:]
loader = make_dataloader(ds, batch_size=4, base_seed=7, epoch=0)
generator.manual_seed(base_seed + epoch)  # same seed, same order
```

## Resume a download
type: flow
from: phases/19-capstone-projects/42-large-corpus-downloader/code/main.py, phases/19-capstone-projects/42-large-corpus-downloader/docs/en.md

1. **StreamingDownloader**: reads `<shard_id>.partial.json` next to `<shard_id>.zst`.
2. **_verify_partial**: file size must equal `verified_bytes`. The sha256 must equal `sha256_prefix_hex`.
3. **Mismatch**: delete the shard and checkpoint. Restart from byte zero.
4. **Match**: send `Range` as `bytes={resume_from}-` and open the shard in `ab` mode.
5. **Response check**: status must be 206 with a matching `Content-Range`. Else do a full GET.
6. **Each chunk**: `_write_checkpoint` with `os.replace`, then `out.write(buf)`.

## Dedup and filter defaults
type: defaults
from: phases/10-llms-from-scratch/03-data-pipelines/code/main.py, phases/19-capstone-projects/42-large-corpus-downloader/code/main.py

| Setting | Default | Note |
|---|---|---|
| `min_words` | 50 | Stub pages fail |
| `max_ratio_caps` | 0.3 | ALL CAPS spam fails |
| `max_ratio_special` | 0.1 | Symbol noise fails |
| `threshold` | 0.8 | Jaccard to drop a copy |
| `num_hashes` | 128 | Signature length |
| `bands` | 16 | Lesson 03. Lesson 42 uses `DEFAULT_BANDS = 32` |
| `DEFAULT_SHINGLE_WIDTH` | 5 | Demo uses `shingle_width=3` |
| `CHUNK_BYTES` | `1 << 16` | Download read size |

## Storage defaults
type: defaults
from: phases/19-capstone-projects/43-hdf5-tokenized-corpus/code/main.py, phases/19-capstone-projects/43-hdf5-tokenized-corpus/docs/en.md

| Setting | Default | Note |
|---|---|---|
| `DEFAULT_CHUNK_SIZE` | 8192 | Demo uses `chunk_size=512` |
| `DEFAULT_WINDOW_SIZE` | 64 | Reads `window_size + 1` tokens |
| `BOUNDARY_TOKEN_ID` | 0 | Separator between documents |
| `TOKEN_DTYPE` | `np.uint16` | Byte ids offset by one |
| `maxshape` | `(None,)` | Resizable dataset |
| `libver` | `"latest"` | Required on the writer for SWMR |

## Numbers and formulas
type: concepts
from: phases/10-llms-from-scratch/03-data-pipelines/docs/en.md, phases/19-capstone-projects/31-tokenized-dataset-sliding-window/docs/en.md, phases/19-capstone-projects/42-large-corpus-downloader/docs/en.md, phases/19-capstone-projects/42-large-corpus-downloader/code/main.py

- **Window count**: `max(0, 1 + (N - (T + 1)) // S)` for N ids, context T, stride S.
- **Stride**: `T // 2` doubles the dataset. `1` grows it by a factor of `T`.
- **LSH collision**: `1 - (1 - s^r)^b` with `k = b * r`.
- **LSH threshold**: near `(1/b)^(1/r)`. For b=32, r=4 it is near s = 0.42.
- **Compression**: English is about 3-4 characters per token.
- **Sequence utilization**: below 90% means packing wastes compute.
- **Dedup yield**: the Llama team removed approximately 38% of web data.
- **Chinchilla**: scale parameters and tokens roughly equally.

## Troubleshooting
type: troubleshooting
from: phases/19-capstone-projects/42-large-corpus-downloader/docs/en.md, phases/19-capstone-projects/42-large-corpus-downloader/code/main.py, phases/19-capstone-projects/43-hdf5-tokenized-corpus/docs/en.md, phases/19-capstone-projects/31-tokenized-dataset-sliding-window/docs/en.md, phases/10-llms-from-scratch/03-data-pipelines/docs/en.md

| Symptom | Cause | Fix |
|---|---|---|
| Resumed shard holds garbage | Offset and file differ | Check the sha256 prefix first |
| Server ignores `Range` | Status is not 206 | Close it and do a full GET |
| Duplicated suffix after power loss | Bytes written before checkpoint | Checkpoint first, then write |
| Model learns to predict zero | Reader reads zero padding | Truncate at `token_count` |
| "file is locked" | No `libver="latest"` or late SWMR | Create datasets, then set `swmr_mode` |
| Throughput halves | Chunk does not match window | Chunk a multiple of `window_size` |
| Runs diverge for no reason | No shuffle seed | Pass `base_seed` per epoch |
| `ValueError` from `LSHIndex` | `bands` does not divide `num_hashes` | Pick bands that divide 128 |

## Q&A
type: qa
from: phases/10-llms-from-scratch/03-data-pipelines/docs/en.md, phases/19-capstone-projects/31-tokenized-dataset-sliding-window/docs/en.md, phases/19-capstone-projects/42-large-corpus-downloader/docs/en.md, phases/19-capstone-projects/43-hdf5-tokenized-corpus/docs/en.md

- **Why pack instead of pad?** Padding wastes compute on tokens that teach nothing.
- **Why a block-diagonal mask?** Doc A tokens must not attend to Doc B tokens.
- **What does the slicer do with a short tail?** It drops the last window.
- **Why dedup before tokenization?** Tokenization is expensive. Do not pay it twice.
- **Why tombstone duplicates?** The manifest keeps the link to the keeper.
- **Why one HDF5 per source shard?** A crash loses at most one shard.

## Tips
type: tips
from: phases/19-capstone-projects/42-large-corpus-downloader/docs/en.md, phases/19-capstone-projects/43-hdf5-tokenized-corpus/docs/en.md, phases/19-capstone-projects/31-tokenized-dataset-sliding-window/docs/en.md

- Trainers read `shards.json`, not the directory listing.
- Verify the manifest sha256 in `manifest.lock` before you trust shard rows.
- Call `dataset.flush()` after each resize in SWMR mode.
- Buffer tokens to chunk size, then resize. Never write one document at a time.
- Most runs use a stride equal to the context length.
