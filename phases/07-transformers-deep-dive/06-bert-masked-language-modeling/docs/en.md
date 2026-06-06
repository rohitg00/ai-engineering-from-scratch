# BERT — Masked Language Modeling

> GPT predicts the next word. BERT predicts a missing word. One sentence of difference — and half a decade of everything embedding-shaped.

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 7 · 05 (Full Transformer), Phase 5 · 02 (Text Representation)
**Time:** ~45 minutes

## The Problem

In 2018 every NLP task — sentiment, NER, QA, entailment — trained its own model from scratch on its own labeled data. There was no pre-trained "understand English" checkpoint you could fine-tune. ELMo (2018) showed you could pre-train contextual embeddings with a bidirectional LSTM; it helped but did not generalize.

BERT (Devlin et al. 2018) asked: what if we took a transformer encoder, trained it on every sentence on the internet, and forced it to predict missing words from context on both sides? Then you fine-tune one head on your downstream task. Parameter efficiency was a revelation.

The result: within 18 months BERT and its variants (RoBERTa, ALBERT, ELECTRA) dominated every NLP leaderboard that existed. By 2020 every search engine, content moderation pipeline, and semantic-search system on earth had a BERT inside.

In 2026 encoder-only models are still the right tool for classification, retrieval, and structured extraction — they run 5–10× faster per token than decoders and their embeddings are the backbone of every modern retrieval stack. ModernBERT (Dec 2024) pushed the architecture to 8K context with Flash Attention + RoPE + GeGLU.

## The Concept

![Masked language modeling: pick tokens, mask them, predict originals](../assets/bert-mlm.svg)

### The training signal

Take a sentence: `the quick brown fox jumps over the lazy dog`.

Mask 15% of tokens randomly:

```
input:  the [MASK] brown fox jumps [MASK] the lazy dog
target: the  quick brown fox jumps  over  the lazy dog
```

Train the model to predict the original tokens at masked positions. Because the encoder is bidirectional, predicting `[MASK]` at position 1 can use `brown fox jumps` at positions 2+. That is the thing GPT cannot do.

### The BERT mask rules

Of the 15% of tokens selected for prediction:

- 80% are replaced with `[MASK]`.
- 10% are replaced with a random token.
- 10% are left unchanged.

Why not always `[MASK]`? Because `[MASK]` never appears at inference time. Training the model to expect `[MASK]` at 100% of masked positions would create a distribution shift between pretraining and fine-tuning. The 10% random + 10% unchanged keeps the model honest.

### Next Sentence Prediction (NSP) — and why it was dropped

Original BERT also trained on NSP: given two sentences A and B, predict if B follows A. RoBERTa (2019) ablated it and showed NSP hurt, not helped. Modern encoders skip it.

### What changed in 2026: ModernBERT

The 2024 ModernBERT paper rebuilt the block with 2026 primitives:

| Component | Original BERT (2018) | ModernBERT (2024) |
|-----------|----------------------|-------------------|
| Positional | Learned absolute | RoPE |
| Activation | GELU | GeGLU |
| Normalization | LayerNorm | Pre-norm RMSNorm |
| Attention | Full dense | Alternating local (128) + global |
| Context length | 512 | 8192 |
| Tokenizer | WordPiece | BPE |

And unlike the 2018 stack, it is Flash-Attention-native. Inference is 2–3× faster at sequence length 8K than DeBERTa-v3 with better GLUE scores.

### Use cases that still pick an encoder in 2026

| Task | Why encoder beats decoder |
|------|---------------------------|
| Retrieval / semantic search embeddings | Bidirectional context = better embedding quality per token |
| Classification (sentiment, intent, toxicity) | One forward pass; no generation overhead |
| NER / token labeling | Per-position output, natively bidirectional |
| Zero-shot entailment (NLI) | Classifier head on top of encoder |
| Reranker for RAG | Cross-encoder scoring, 10x faster than LLM rerankers |

## Build It

### Step 1: masking logic

See `code/main.py`. The function `create_mlm_batch` takes a list of token IDs, a vocab size, and a mask probability. Returns input IDs (with masks applied) and labels (only at masked positions, -100 elsewhere — PyTorch's ignore index convention).

```python
def create_mlm_batch(tokens, vocab_size, mask_prob=0.15, rng=None):
    input_ids = list(tokens)
    labels = [-100] * len(tokens)
    for i, t in enumerate(tokens):
        if rng.random() < mask_prob:
            labels[i] = t
            r = rng.random()
            if r < 0.8:
                input_ids[i] = MASK_ID
            elif r < 0.9:
                input_ids[i] = rng.randrange(vocab_size)
            # else: keep original
    return input_ids, labels
```

### Step 2: run MLM prediction on a tiny corpus

Train a 2-layer encoder + MLM head on a vocabulary of 20 words, 200 sentences. No gradient — we do forward-pass sanity checks. Full training needs PyTorch.

### Step 3: compare mask types

Show how the three-way rule keeps the model usable without `[MASK]`. Predict on an unmasked sentence and on a masked sentence. Both should produce reasonable token distributions because the model saw both patterns in training.

### Step 4: fine-tune head

Replace the MLM head with a classification head on a toy sentiment dataset. Only the head trains; the encoder is frozen. This is the pattern every BERT application follows.

## Use It

```python
from transformers import AutoModel, AutoTokenizer

tok = AutoTokenizer.from_pretrained("answerdotai/ModernBERT-base")
model = AutoModel.from_pretrained("answerdotai/ModernBERT-base")

text = "Attention is all you need."
inputs = tok(text, return_tensors="pt")
out = model(**inputs).last_hidden_state   # (1, N, 768)
```

**Embedding models are fine-tuned BERT.** `sentence-transformers` models like `all-MiniLM-L6-v2` are BERTs trained with contrastive loss. The encoder is the same. The loss changed.

**Cross-encoder rerankers are also fine-tuned BERT.** Pair-classification on `[CLS] query [SEP] doc [SEP]`. The bidirectional attention between query and doc is exactly what gives cross-encoders their quality edge over biencoders.

**When not to pick BERT in 2026.** Anything generative. The encoder has no sensible way to autoregressively produce tokens. Also: anything under 1B params where a small decoder can match quality with more flexibility (Phi-3-Mini, Qwen2-1.5B).

## Ship It

See `outputs/skill-bert-finetuner.md`. The skill scopes a BERT fine-tune (backbone choice, head spec, data, eval, stopping) for a new classification or extraction task.

## Exercises

1. **Easy.** Run `code/main.py` and print the mask distribution across 10,000 tokens. Confirm ~15% are selected, and of those ~80% become `[MASK]`.
2. **Medium.** Implement whole-word masking: if a word is tokenized into subwords, mask all subwords together or none. Measure whether this improves MLM accuracy on a 500-sentence corpus.
3. **Hard.** Train a tiny (2-layer, d=64) BERT on 10,000 sentences from a public dataset. Fine-tune the `[CLS]` token for SST-2 sentiment. Compare against a decoder-only baseline at matched params — which wins?

## Key Terms

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| MLM | "Masked language modeling" | Training signal: randomly replace 15% of tokens with `[MASK]`, predict the originals. |
| Bidirectional | "Looks both ways" | Encoder attention has no causal mask — every position sees every other position. |
| `[CLS]` | "The pooler token" | A special token prepended to every sequence; its final embedding is used as the sentence-level representation. |
| `[SEP]` | "Segment separator" | Separates paired sequences (e.g. query/doc, sentence A/B). |
| NSP | "Next sentence prediction" | BERT's second pretraining task; shown to be useless in RoBERTa, dropped after 2019. |
| Fine-tuning | "Adapt to a task" | Keep the encoder mostly frozen; train a small head on top for the downstream task. |
| Cross-encoder | "A reranker" | A BERT that takes both query and doc as input, outputs a relevance score. |
| ModernBERT | "2024 refresh" | Encoder rebuilt with RoPE, RMSNorm, GeGLU, alternating local/global attention, 8K context. |

## Further Reading

- [Devlin et al. (2018). BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding](https://arxiv.org/abs/1810.04805) — original paper.
- [Liu et al. (2019). RoBERTa: A Robustly Optimized BERT Pretraining Approach](https://arxiv.org/abs/1907.11692) — how to train BERT right; kills NSP.
- [Clark et al. (2020). ELECTRA: Pre-training Text Encoders as Discriminators Rather Than Generators](https://arxiv.org/abs/2003.10555) — replaced-token detection beats MLM at matched compute.
- [Warner et al. (2024). Smarter, Better, Faster, Longer: A Modern Bidirectional Encoder](https://arxiv.org/abs/2412.13663) — ModernBERT paper.
- [HuggingFace `modeling_bert.py`](https://github.com/huggingface/transformers/blob/main/src/transformers/models/bert/modeling_bert.py) — canonical encoder reference.
