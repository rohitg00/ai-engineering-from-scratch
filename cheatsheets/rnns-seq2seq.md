---
id: rnns-seq2seq
title: RNNs, Seq2Seq and N-gram Models
code: RS
subtitle: TextCNN, LSTM and GRU, encoder-decoder with teacher forcing, beam search, BLEU, Kneser-Ney and why attention won.
hue: 330
sources: phases/05-nlp-foundations-to-advanced/08-cnns-rnns-for-text, phases/05-nlp-foundations-to-advanced/09-sequence-to-sequence, phases/05-nlp-foundations-to-advanced/11-machine-translation, phases/05-nlp-foundations-to-advanced/16-text-generation-pre-transformer, phases/07-transformers-deep-dive/01-why-transformers
source_hash: 534e047c38ab5109
---

## Seq2seq encoder-decoder
type: architecture
from: phases/05-nlp-foundations-to-advanced/09-sequence-to-sequence/docs/en.md

```arch
node | src | 1,1 | Source tokens | src ids | client
node | enc | 2,1 | Encoder GRU | outputs, hidden | model
node | ctx | 3,1 | Context vector | final hidden state | store
node | bos | 1,2 | bos_id token | then the last token | client
node | dec | 2,2 | Decoder GRU | one step at a time | model
node | out | 3,2 | Vocabulary logits | argmax or beam | process
edge | src | enc |
edge | enc | ctx | bottleneck
edge | ctx | dec | init hidden
edge | bos | dec | input_token
edge | dec | out |
edge | out | bos | feed back
```

## Core formulas
type: concepts
from: phases/05-nlp-foundations-to-advanced/08-cnns-rnns-for-text/docs/en.md, phases/05-nlp-foundations-to-advanced/16-text-generation-pre-transformer/docs/en.md, phases/05-nlp-foundations-to-advanced/11-machine-translation/docs/en.md, phases/07-transformers-deep-dive/01-why-transformers/docs/en.md

- **RNN**: $h_t = f(W x_t + U h_{t-1} + b)$. W, U and b are shared across time.
- **LSTM**: input, forget and output gates plus a cell state. Stable gradients.
- **GRU**: two gates. Similar accuracy, fewer parameters.
- **TextCNN**: a width-k filter is a learnable k-gram. Global max-pool per filter.
- **N-gram**: $P(w \mid \mathrm{ctx}) = \mathrm{count}(\mathrm{ctx}, w) / \mathrm{count}(\mathrm{ctx})$
- **Perplexity**: $\exp(-\frac{1}{N} \sum_i \log P(w_i \mid \mathrm{ctx}_i))$. Lower is better.
- **Kneser-Ney**: absolute discount plus continuation probability for the lower order.
- **BLEU**: n-gram precision for n of 1 to 4, geometric mean, brevity penalty. 0 to 100.

## Tasks in code
type: task-table
span: 2
from: phases/05-nlp-foundations-to-advanced/08-cnns-rnns-for-text/code/main.py, phases/05-nlp-foundations-to-advanced/09-sequence-to-sequence/docs/en.md, phases/05-nlp-foundations-to-advanced/11-machine-translation/code/main.py, phases/05-nlp-foundations-to-advanced/16-text-generation-pre-transformer/docs/en.md, phases/07-transformers-deep-dive/01-why-transformers/code/main.py

| Task | Code |
|---|---|
| Gradient left after N steps | `vanishing_gradient_sim(seq_len, recurrent_weight=0.9)` |
| Decode without a teacher | `greedy_decode(encoder, decoder, src, bos_id, eos_id, max_len=50)` |
| Toy BLEU | `simple_bleu(hypothesis, reference, max_n=4)` |
| Character F-score | `chrf(hypothesis, reference, n=6, beta=2)` |
| Count trigrams | `train_ngram(corpus_tokens, n=3)` |
| Smoothed bigram model | `kneser_ney_bigram_model(corpus_tokens, discount=0.75)` |
| Score held-out text | `perplexity(prob_fn, sentences)` |
| Serial vs parallel depth | `rnn_style(xs, decay=0.9)` vs `attention_style(xs)` |

## Train with teacher forcing
type: annotated-code
lang: python
from: phases/05-nlp-foundations-to-advanced/09-sequence-to-sequence/docs/en.md

```python
_, hidden = encoder(src)                        # context vector
input_token = torch.full((batch_size, 1), bos_id, dtype=torch.long)
loss_fn = nn.CrossEntropyLoss(ignore_index=0)   # skip padding
for t in range(tgt_len):
    logits, hidden = decoder(input_token, hidden)
    loss += loss_fn(logits.squeeze(1), tgt[:, t])
    use_teacher = torch.rand(1).item() < teacher_forcing_ratio
    if use_teacher:
        input_token = tgt[:, t].unsqueeze(1)    # ground truth at t-1
    else:
        input_token = logits.argmax(dim=-1)     # own prediction
loss.backward()
```

## TextCNN forward pass
type: annotated-code
lang: python
from: phases/05-nlp-foundations-to-advanced/08-cnns-rnns-for-text/docs/en.md

```python
x = self.embed(token_ids).transpose(1, 2)  # [batch, embed_dim, seq_len]
for conv in self.convs:                    # one per width in (2, 3, 4)
    c = F.relu(conv(x))
    p = F.max_pool1d(c, c.size(2)).squeeze(2)  # strongest activation
    pooled.append(p)
h = torch.cat(pooled, dim=1)               # fixed size for any length
out, _ = self.lstm(x)                      # LSTM classifier instead
pooled = out.max(dim=1).values             # max-pool beats last state
```

## Translate and score
type: annotated-code
lang: python
from: phases/05-nlp-foundations-to-advanced/11-machine-translation/docs/en.md

```python
model_id = "facebook/nllb-200-distilled-600M"
tok = AutoTokenizer.from_pretrained(model_id, src_lang="eng_Latn")
out = model.generate(**inputs,
    forced_bos_token_id=tok.convert_tokens_to_ids("fra_Latn"),  # target
    num_beams=5, length_penalty=1.0, max_new_tokens=64)
print(tok.batch_decode(out, skip_special_tokens=True)[0])
bleu = sacrebleu.corpus_bleu(hypotheses, references)
chrf = sacrebleu.corpus_chrf(hypotheses, references)
```

## Defaults and numbers
type: defaults
from: phases/05-nlp-foundations-to-advanced/09-sequence-to-sequence/docs/en.md, phases/05-nlp-foundations-to-advanced/08-cnns-rnns-for-text/docs/en.md, phases/05-nlp-foundations-to-advanced/11-machine-translation/docs/en.md, phases/05-nlp-foundations-to-advanced/16-text-generation-pre-transformer/docs/en.md

| Setting | Default | Note |
|---|---|---|
| `teacher_forcing_ratio` | 0.9 | Start at 1.0, anneal to ~0.5 |
| Beam width | 3-5 | MT uses 4-5 for general content |
| KN `discount` | 0.75 | Subtracted from every bigram count |
| TextCNN filters | 64 | Widths (2, 3, 4), dropout 0.3 |
| `0.9 ^ 100` | 2.7e-5 | Gradient left after 100 steps |
| Copy accuracy at length 40 | 23% | 98% at length 5. The bottleneck |
| BLEU bands | 30 | 40 is good, 50 exceptional, under 1 is noise |
| 4-gram KN perplexity, Brown | 140 | A transformer LM gets 15-30 |

## Troubleshooting
type: troubleshooting
from: phases/05-nlp-foundations-to-advanced/09-sequence-to-sequence/docs/en.md, phases/05-nlp-foundations-to-advanced/08-cnns-rnns-for-text/docs/en.md, phases/05-nlp-foundations-to-advanced/11-machine-translation/docs/en.md, phases/05-nlp-foundations-to-advanced/16-text-generation-pre-transformer/docs/en.md

| Symptom | Cause | Fix |
|---|---|---|
| Drift on long outputs | Exposure bias | Scheduled sampling, anneal the ratio |
| Long inputs lose detail | One fixed context vector | Attention over all encoder states |
| Plain RNN learns no long range | Vanishing gradient | Use an LSTM or GRU |
| Greedy output repeats and loops | Commits to each token | Beam search, width 4-5 |
| Output in the wrong language | Off-target generation | Check `forced_bos_token_id`, run language ID |
| Short input gives long output | Length penalty under ~5 tokens | Cap length by source length |
| Fluent output with new facts | Hallucination | Constrained decoding, human review |
| N-gram gives probability 0 | Unseen n-gram | Smooth with Kneser-Ney |

## Use X when
type: qa
from: phases/05-nlp-foundations-to-advanced/08-cnns-rnns-for-text/docs/en.md, phases/05-nlp-foundations-to-advanced/09-sequence-to-sequence/docs/en.md, phases/05-nlp-foundations-to-advanced/16-text-generation-pre-transformer/docs/en.md, phases/07-transformers-deep-dive/01-why-transformers/docs/en.md, phases/05-nlp-foundations-to-advanced/11-machine-translation/docs/en.md

- **TextCNN?** Edge and on-device. It is 10-100x smaller than a transformer.
- **LSTM?** Streaming text, one token at a time. BiLSTM-CRF for 1k-10k labeled sentences.
- **RNN seq2seq?** Almost never. Streaming translation or on-device generation only.
- **N-gram LM?** On-device autocomplete, rescoring, and a baseline before any neural LM.
- **Transformer?** Everything else. Serial depth is 1, not N. Memory is $O(N^2)$.
- **BLEU or chrF?** Report both. chrF counts better on morphologically rich languages.

## Abbreviations
type: glossary
from: phases/05-nlp-foundations-to-advanced/08-cnns-rnns-for-text/docs/en.md, phases/05-nlp-foundations-to-advanced/09-sequence-to-sequence/docs/en.md, phases/05-nlp-foundations-to-advanced/11-machine-translation/docs/en.md, phases/07-transformers-deep-dive/01-why-transformers/docs/en.md

- **LSTM**: gated RNN with input, forget and output gates and a cell state.
- **GRU**: gated RNN with two gates.
- **NMT**: neural MT. Transformer encoder-decoder trained on parallel text.
- **NLLB**: No Language Left Behind. A 200-language MT model family.
- **chrF**: character-level F-score.
- **SSM**: state-space model. Recurrence with parallel training.

## Tips
type: tips
from: phases/05-nlp-foundations-to-advanced/11-machine-translation/docs/en.md, phases/05-nlp-foundations-to-advanced/16-text-generation-pre-transformer/docs/en.md

- Always use `sacrebleu`. Your own BLEU code gives scores you cannot compare.
- Ship at least two metric families. COMET is the default where quality matters.
- Calibrate each metric on 50-100 human-labeled examples.
- Compare perplexity only under identical tokenization.
- A few thousand clean parallel pairs beat a few hundred thousand noisy ones.
