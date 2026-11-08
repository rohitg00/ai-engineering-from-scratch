---
id: tokenization
title: Tokenization and BPE
code: TB
subtitle: Train, encode and decode a byte-level BPE tokenizer, then slice the id stream into training windows.
hue: 45
sources: phases/05-nlp-foundations-to-advanced/19-subword-tokenization, phases/10-llms-from-scratch/01-tokenizers, phases/10-llms-from-scratch/02-building-a-tokenizer, phases/19-capstone-projects/30-bpe-tokenizer-from-scratch, phases/19-capstone-projects/31-tokenized-dataset-sliding-window
source_hash: 61eb8b567821c32e
---

## Tasks
type: task-table
from: phases/19-capstone-projects/30-bpe-tokenizer-from-scratch/code/main.py, phases/10-llms-from-scratch/01-tokenizers/docs/en.md, phases/10-llms-from-scratch/02-building-a-tokenizer/docs/en.md, phases/05-nlp-foundations-to-advanced/19-subword-tokenization/docs/en.md

| Task | Code |
|---|---|
| Train byte-level BPE | `train(tokenizer, <corpus>, target_vocab_size=320)` |
| Encode with special tokens | `encode(tokenizer, text, allow_special=True)` |
| Decode ids to text | `decode(tokenizer, ids)` |
| Normalize Unicode first | `unicodedata.normalize("NFKC", text)` |
| Encode with tiktoken | `enc = tiktoken.get_encoding("cl100k_base")` then `enc.encode(text)` |
| Train with HF tokenizers | `tokenizer.train(["corpus.txt"], trainer)` |
| Train SentencePiece | `spm.SentencePieceTrainer.train(input="corpus.txt", vocab_size=8000)` |
| Load a model tokenizer | `AutoTokenizer.from_pretrained("meta-llama/Llama-3.1-8B")` |

## Tokenizer and data pipeline
type: architecture
from: phases/10-llms-from-scratch/02-building-a-tokenizer/docs/en.md, phases/19-capstone-projects/31-tokenized-dataset-sliding-window/docs/en.md

```arch
node | raw | 1,1 | Raw Text |
node | norm | 2,1 | Normalize | NFKC
node | pre | 3,1 | Pre-Tokenize | split into chunks
node | bpe | 4,1 | BPE Merge | merge table
node | spec | 4,2 | Special Tokens | fixed IDs
node | ids | 3,2 | Token IDs | flat list of ids
node | ds | 2,2 | PyTorch Dataset | windows of T+1 ids
node | dl | 1,2 | DataLoader | seeded shuffle, B x T
edge | raw | norm |
edge | norm | pre |
edge | pre | bpe |
edge | bpe | spec |
edge | spec | ids |
edge | ids | ds | slice
edge | ds | dl | batch
```

## Train BPE merges
type: annotated-code
lang: python
from: phases/19-capstone-projects/30-bpe-tokenizer-from-scratch/code/main.py

```python
tokenizer.initialize(specials)                 # 256 bytes, then specials
units = _build_initial_units(corpus)           # byte tuple -> word count
while tokenizer.vocab_size < target_vocab_size:
    pairs = _count_pairs(units)                # weighted by word count
    max_count = max(pairs.values())
    candidates = sorted(p for p, c in pairs.items() if c == max_count)
    best = candidates[0]                       # tie break on the pair
    if pairs[best] < 2:
        break                                  # no pair repeats
    new_id = tokenizer._add_token(
        tokenizer.vocab[best[0]] + tokenizer.vocab[best[1]]
    )                                          # next free id
    tokenizer.merges[best] = new_id            # order is the rank
    units = _apply_merge_to_corpus(units, best, new_id)
```

## Encode fresh text
type: flow
from: phases/19-capstone-projects/30-bpe-tokenizer-from-scratch/docs/en.md, phases/19-capstone-projects/30-bpe-tokenizer-from-scratch/code/main.py

1. **Specials**: with `allow_special=True`, literal special strings get reserved ids.
2. **Pre-tokenize**: `_pretokenize` splits text into whitespace and word runs.
3. **Bytes**: each chunk becomes its UTF-8 byte ids.
4. **Rank**: find the lowest-ranked merge that applies to the chunk.
5. **Merge**: replace that pair with its merged id.
6. **Repeat**: stop when no merge in the table applies.
7. **Join**: concatenate the ids of all chunks in order.

## Sliding window dataset
type: annotated-code
lang: python
from: phases/19-capstone-projects/31-tokenized-dataset-sliding-window/code/main.py

```python
usable = num_ids - (context_length + 1)        # count_windows
return 1 + usable // stride                    # 0 when usable < 0
start = index * self.stride                    # __getitem__
end = start + self.context_length + 1          # T+1 ids
window = self.ids[start:end]
return window[:-1].clone(), window[1:].clone()  # input, target
generator = torch.Generator()
generator.manual_seed(base_seed + epoch)       # same order on rerun
inputs, targets = next(iter(loader))           # (B, T) and (B, T)
```

## Algorithms and formulas
type: concepts
from: phases/10-llms-from-scratch/01-tokenizers/docs/en.md, phases/05-nlp-foundations-to-advanced/19-subword-tokenization/docs/en.md, phases/19-capstone-projects/31-tokenized-dataset-sliding-window/docs/en.md

- **BPE**: merge the most frequent adjacent pair until the target vocabulary size.
- **Byte-level BPE**: base vocabulary of exactly 256 bytes. No unknown token.
- **WordPiece**: merges by `count(AB) / (count(A) * count(B))`. Continuation pieces get `##`.
- **Unigram**: start large, prune tokens whose removal least increases corpus log-likelihood.
- **SentencePiece**: trains BPE or Unigram on raw Unicode. Space is `▁`.
- **tiktoken**: fast encoder for pre-built vocabularies. It does not train.
- **Naive encode cost**: $O(n \cdot \lvert \text{merges} \rvert)$ for one word.
- **Window count**: `max(0, 1 + (N - (T + 1)) // S)` for N ids, context T, stride S.

## Defaults and numbers
type: defaults
from: phases/19-capstone-projects/30-bpe-tokenizer-from-scratch/docs/en.md, phases/05-nlp-foundations-to-advanced/19-subword-tokenization/docs/en.md, phases/10-llms-from-scratch/01-tokenizers/docs/en.md, phases/19-capstone-projects/31-tokenized-dataset-sliding-window/code/main.py

| Setting | Default | Note |
|---|---|---|
| Byte alphabet | 256 | ids for bytes 0x00 to 0xFF |
| GPT-2 vocabulary | 50,257 | 256 bytes, 50,000 merges, 1 special |
| BERT WordPiece vocabulary | 30,522 | `##` continuation prefix |
| Llama 3 vocabulary | 128,256 | byte-level BPE |
| GPT-4o vocabulary | 200,019 | `o200k_base` encoding |
| SentencePiece character_coverage | 0.9995 | 0.995 for Japanese |
| SlidingWindowDataset stride | context_length | used when stride is None |
| make_dataloader num_workers | 0 | slices an in-memory tensor |

## Troubleshooting
type: troubleshooting
from: phases/05-nlp-foundations-to-advanced/19-subword-tokenization/docs/en.md, phases/10-llms-from-scratch/02-building-a-tokenizer/docs/en.md, phases/19-capstone-projects/30-bpe-tokenizer-from-scratch/docs/en.md, phases/19-capstone-projects/30-bpe-tokenizer-from-scratch/code/main.py, phases/19-capstone-projects/31-tokenized-dataset-sliding-window/docs/en.md

| Symptom | Cause | Fix |
|---|---|---|
| Model outputs garbage after deploy | trained on vocab A, deployed with vocab B | check the tokenizer file hash in CI |
| "hello" and " hello" get different ids | whitespace ambiguity | set `add_special_tokens` and `add_prefix_space` explicitly |
| Chat model gives garbage | chat template differs from training | match the training format exactly |
| Non-Latin text costs 5-10x more tokens | English-heavy vocabulary | train a larger multilingual vocabulary |
| `\p{L}` pattern fails | stdlib `re` has no Unicode property escapes | install `regex` |
| Special token encodes as bytes | `allow_special` is off | pass `allow_special=True` |
| `KeyError` unknown token id | id is not in the vocabulary | decode only ids this tokenizer made |
| Last window missing | tail shorter than T+1 ids | expected. The slicer drops it |

## Terms
type: glossary
from: phases/10-llms-from-scratch/01-tokenizers/docs/en.md, phases/10-llms-from-scratch/02-building-a-tokenizer/docs/en.md, phases/05-nlp-foundations-to-advanced/19-subword-tokenization/docs/en.md

- **BPE**: Byte Pair Encoding. Iterative merge of the most frequent pair.
- **NFKC**: Unicode normalization. The "fi" ligature becomes "fi".
- **Merge table**: ordered list of pair merges. It is the tokenizer.
- **Pre-tokenization**: splitting rules before BPE, so merges stay inside words.
- **Fertility**: average tokens per word. 1.0 is perfect.
- **Compression ratio**: tokens produced divided by input bytes. Lower is better.
- **Chat template**: model-specific format from messages to a flat token sequence.
- **Special tokens**: reserved ids that bypass BPE, such as [BOS], [EOS], [PAD].

## Questions
type: qa
from: phases/19-capstone-projects/30-bpe-tokenizer-from-scratch/docs/en.md, phases/10-llms-from-scratch/01-tokenizers/docs/en.md, phases/19-capstone-projects/31-tokenized-dataset-sliding-window/docs/en.md

- **Why a byte alphabet?** Every UTF-8 input fits the vocabulary before any merge. No unknown token.
- **Why pre-tokenize?** Without it, merges cross word boundaries and fill the vocabulary with phrases.
- **Why apply merges in rank order?** Encoding is then deterministic and matches training.
- **Large or small vocabulary?** Large gives shorter sequences but a larger embedding matrix.
- **Why seed the shuffle?** Two runs that differ in one hyperparameter then see the same data order.

## Tips
type: tips
from: phases/19-capstone-projects/30-bpe-tokenizer-from-scratch/docs/en.md, phases/10-llms-from-scratch/01-tokenizers/docs/en.md, phases/19-capstone-projects/31-tokenized-dataset-sliding-window/docs/en.md, phases/05-nlp-foundations-to-advanced/19-subword-tokenization/docs/en.md

- Test the round trip on unseen text, an emoji and a literal <|endoftext|>.
- Measure the compression ratio on held-out text, not on the training corpus.
- Encode the corpus once at build time, then slice the id stream.
- Insert <|endoftext|> ids between documents.
- Use a stride equal to the context length for a large corpus.
- Size the vocabulary to the model: 32k for under 1B params, 50-100k for 1-10B.
