---
id: bert-gpt-t5
title: BERT, GPT and T5 Compared
code: BG
subtitle: Encoder-only, decoder-only and encoder-decoder side by side. Objectives, masks, blocks, decoding and when to pick each.
hue: 32
sources: phases/07-transformers-deep-dive/05-full-transformer, phases/07-transformers-deep-dive/06-bert-masked-language-modeling, phases/07-transformers-deep-dive/07-gpt-causal-language-modeling, phases/07-transformers-deep-dive/08-t5-bart-encoder-decoder
source_hash: 074f078a03208c41
---

## Three families side by side
type: comparison
from: phases/07-transformers-deep-dive/05-full-transformer/docs/en.md, phases/07-transformers-deep-dive/06-bert-masked-language-modeling/docs/en.md, phases/07-transformers-deep-dive/07-gpt-causal-language-modeling/docs/en.md, phases/07-transformers-deep-dive/08-t5-bart-encoder-decoder/docs/en.md

| Factor | BERT | GPT | T5 / BART |
|---|---|---|---|
| Stack | Encoder only | Decoder only | Encoder and decoder |
| Attention | Bidirectional, no mask | Causal triangle mask | Bidirectional encoder, causal decoder |
| Cross-attention | None | None | Q from decoder, K/V from encoder |
| Objective | MLM on 15% of tokens | Next token, shift by one | Span corruption or denoising |
| Predicts | $P(x_{\text{masked}} \mid x_{\text{unmasked}})$ | $P(x_t \mid x_{<t})$ | Target spans or the clean sequence |
| Generates text | No | Yes, token by token | Yes, from the encoder output |
| Best for | Classification, retrieval, NER | Chat, code, reasoning | Translation, speech to text |
| Examples | BERT, DeBERTa, ModernBERT | GPT, Llama, Qwen | T5, BART, Whisper |

## Block wiring
type: architecture
from: phases/07-transformers-deep-dive/05-full-transformer/docs/en.md, phases/07-transformers-deep-dive/08-t5-bart-encoder-decoder/docs/en.md

```arch
node | src | 1,1 | Source tokens | embed + position | client
node | enc | 2,1 | Encoder block | LN, self MHA, LN, FFN | process
node | encout | 3,1 | Encoder output | (N_src, d_model), runs once | store
node | tgt | 1,2 | Target tokens | shift by one | client
node | self | 2,2 | Masked self-attention | sublayer 1 | process
node | cross | 3,2 | Cross-attention | sublayer 2 | process
node | ffn | 4,2 | FFN | sublayer 3 | process
node | logits | 4,1 | Next-token logits | final LN + projection | model
edge | src | enc |
edge | enc | encout |
edge | tgt | self |
edge | self | cross |
edge | encout | cross | K, V
edge | cross | ffn |
edge | ffn | logits |
```

## One encoder-decoder forward pass
type: flow
from: phases/07-transformers-deep-dive/05-full-transformer/docs/en.md, phases/07-transformers-deep-dive/05-full-transformer/code/main.py, phases/07-transformers-deep-dive/08-t5-bart-encoder-decoder/docs/en.md

1. **Embed**: tokens become vectors. Add RoPE or a sinusoidal position signal.
2. **Encoder**: each block runs pre-norm self-attention, then pre-norm FFN, each with a residual.
3. **Encoder output**: the encoder runs once per input. Cache it for long inputs.
4. **Decoder self-attention**: masked, so position `i` sees positions up to `i` only.
5. **Decoder cross-attention**: the only place encoder information enters the decoder.
6. **Decoder FFN**: then a final LN before the output projection.
7. **Check**: a 6-token source and a 5-token target give output shape `(5, vocab)`.

## Tasks in the lesson code
type: task-table
from: phases/07-transformers-deep-dive/05-full-transformer/code/main.py, phases/07-transformers-deep-dive/06-bert-masked-language-modeling/code/main.py, phases/07-transformers-deep-dive/07-gpt-causal-language-modeling/code/main.py, phases/07-transformers-deep-dive/08-t5-bart-encoder-decoder/code/main.py

| Task | Code |
|---|---|
| BERT 80/10/10 masking | `create_mlm_batch(tokens, vocab_size)` |
| Mask whole words | `whole_word_mlm(tokens, spans, vocab_size)` |
| GPT causal mask | `causal_mask(n)` |
| Next-token loss | `cross_entropy_shifted(logits, target_ids)` |
| T5 span corruption | `corrupt_spans(tokens, mask_rate=0.15)` |
| Rebuild the original | `round_trip(source, target)` |
| One encoder block | `encoder_block(x, p)` |
| One decoder block | `decoder_block(x, enc_out, p)` |

## Load each family
type: annotated-code
lang: python
from: phases/07-transformers-deep-dive/06-bert-masked-language-modeling/docs/en.md, phases/07-transformers-deep-dive/07-gpt-causal-language-modeling/docs/en.md, phases/07-transformers-deep-dive/08-t5-bart-encoder-decoder/docs/en.md

```python
tok = AutoTokenizer.from_pretrained("answerdotai/ModernBERT-base")
model = AutoModel.from_pretrained("answerdotai/ModernBERT-base")
out = model(**inputs).last_hidden_state   # (1, N, 768), embeddings only
model = AutoModelForCausalLM.from_pretrained("<model>")
out = model.generate(**inputs, max_new_tokens=64,
    temperature=0.7, top_p=0.9, do_sample=True)   # sample a reply
model = T5ForConditionalGeneration.from_pretrained("google/flan-t5-base")
inputs = tok("translate English to French: <text>", return_tensors="pt")   # task name in the input
out = model.generate(**inputs, max_new_tokens=32)
print(tok.decode(out[0], skip_special_tokens=True))
```

## Pretraining objectives
type: concepts
from: phases/07-transformers-deep-dive/06-bert-masked-language-modeling/docs/en.md, phases/07-transformers-deep-dive/07-gpt-causal-language-modeling/docs/en.md, phases/07-transformers-deep-dive/08-t5-bart-encoder-decoder/docs/en.md

- **MLM**: select 15% of tokens. 80% become `[MASK]`, 10% random, 10% unchanged.
- **Labels**: the original token at selected positions. -100 at all other positions.
- **NSP**: predict if sentence B follows A. RoBERTa showed it hurt. Modern encoders skip it.
- **Causal LM**: input `[t1, t2, t3]`, targets `[t2, t3, t4]`. Sum $-\log P$ over positions.
- **Causal mask**: $M_{ij} = 0$ if $j \le i$, else $-\infty$. Add it before softmax.
- **Span corruption**: spans of mean length 3, 15% total, each replaced by `<extra_id_0>`, `<extra_id_1>`.
- **T5 target**: only the corrupted spans, each after its sentinel.
- **BART**: five noise functions. The decoder rebuilds the full original sequence.

## Decoding strategies
type: command-table
from: phases/07-transformers-deep-dive/07-gpt-causal-language-modeling/docs/en.md, phases/07-transformers-deep-dive/07-gpt-causal-language-modeling/code/main.py, phases/07-transformers-deep-dive/08-t5-bart-encoder-decoder/docs/en.md

| Command | What it does |
|---|---|
| `sample_greedy(probs)` | Argmax each step. Code completion, deterministic tasks |
| `sample_temperature(logits, t, rng)` | Divide logits by T. Higher T gives more diversity |
| `sample_top_k(logits, k, rng)` | Sample from the top k tokens only |
| `sample_top_p(logits, p, rng)` | Smallest set with cumulative prob at least p |
| `sample_min_p(logits, min_p, rng)` | Keep tokens with `p >= min_p * max_p` |
| Beam search | Width 4 to 5 for translation and summarization |
| Speculative decoding | Draft model proposes N tokens. Big model verifies |

## Block: 2017 against 2026
type: comparison
from: phases/07-transformers-deep-dive/05-full-transformer/docs/en.md

| Component | 2017 block | 2026 block |
|---|---|---|
| Normalization | LayerNorm, post-norm | RMSNorm, pre-norm |
| FFN activation | ReLU | SwiGLU |
| FFN expansion | 4× | 2.6× (three matrices) |
| Position | Sinusoidal absolute | RoPE |
| Attention | Full MHA | GQA (or MLA) |
| Bias terms | Yes | No |

## Defaults in the code
type: defaults
from: phases/07-transformers-deep-dive/05-full-transformer/code/main.py, phases/07-transformers-deep-dive/06-bert-masked-language-modeling/code/main.py, phases/07-transformers-deep-dive/07-gpt-causal-language-modeling/code/main.py, phases/07-transformers-deep-dive/08-t5-bart-encoder-decoder/code/main.py

| Setting | Default | Note |
|---|---|---|
| `mask_prob` | 0.15 | BERT selection rate |
| `IGNORE_INDEX` | -100 | Label at unselected positions |
| `mask_rate` | 0.15 | T5 share of tokens in spans |
| `mean_span` | 3.0 | T5 mean span length |
| `mask_token` | `<mask>` | BART mask and infill token |
| `layer_norm` eps | 1e-5 | Subtracts the mean |
| `rms_norm` eps | 1e-6 | No mean subtraction |
| `temperature` | 1.0 | `softmax`, top-k, top-p, min-p |

## Use each family when
type: tips
from: phases/07-transformers-deep-dive/05-full-transformer/docs/en.md, phases/07-transformers-deep-dive/06-bert-masked-language-modeling/docs/en.md, phases/07-transformers-deep-dive/07-gpt-causal-language-modeling/docs/en.md, phases/07-transformers-deep-dive/08-t5-bart-encoder-decoder/docs/en.md

- Use BERT for classification, embeddings, NER, NLI and RAG rerankers. It runs 5 to 10× faster per token than decoders.
- Do not use BERT for generation. The encoder cannot produce tokens autoregressively.
- Use GPT for generation, chat, code and reasoning. Decoder-only scales cleanest.
- Use min-p + temperature 0.7 as a default for open-weights models.
- Use T5 or BART when the input is a clear source sequence: translation, speech, structured tasks.
- Use beam search with an encoder-decoder. The output distribution is narrower than chat.
- Summarization and extraction work with either encoder-decoder or decoder-only.

## Troubleshooting
type: troubleshooting
from: phases/07-transformers-deep-dive/05-full-transformer/docs/en.md, phases/07-transformers-deep-dive/06-bert-masked-language-modeling/docs/en.md, phases/07-transformers-deep-dive/07-gpt-causal-language-modeling/docs/en.md, phases/07-transformers-deep-dive/08-t5-bart-encoder-decoder/docs/en.md

| Symptom | Cause | Fix |
|---|---|---|
| Model fails without `[MASK]` at fine-tune | Trained on 100% `[MASK]` | Use the 80/10/10 rule |
| Model cheats by looking at the answer | No causal mask | Add the `-inf` triangle before softmax |
| Future weights not exactly zero | Softmax never outputs an exact zero | Put `-inf` into future scores |
| Gradients vanish in a deep stack | No residual connections | Use `x + sublayer(x)` |
| Activations explode after 12 layers | Post-norm | Switch to pre-norm |
| Corrupted span does not rebuild | Off-by-one in span bookkeeping | Run the round-trip check |
| Slow decode on long inputs | Encoder runs again each step | Cache the encoder output |

## Questions
type: qa
from: phases/07-transformers-deep-dive/05-full-transformer/docs/en.md, phases/07-transformers-deep-dive/06-bert-masked-language-modeling/docs/en.md, phases/07-transformers-deep-dive/07-gpt-causal-language-modeling/docs/en.md, phases/07-transformers-deep-dive/08-t5-bart-encoder-decoder/docs/en.md

- **Why can BERT use the right context?** The encoder has no causal mask.
- **Why is GPT training parallel?** One pass gives N next-token losses. Inference stays serial.
- **How many params in one block?** MHA is `4 · d²`. SwiGLU FFN is about `3rd²`.
- **Why is T5 pretraining cheaper than BART?** T5 decodes only the spans. BART decodes the full sequence.
- **Are embedding models BERT?** Yes. Same encoder, contrastive loss.
