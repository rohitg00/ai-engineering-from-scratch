# T5, BART — Encoder-Decoder Models

> Encoder は理解します。Decoder は生成します。両者をもう一度組み合わせると、translate、summarize、rewrite、transcribe のような input → output tasks に向いた model ができます。

**種別:** 学習
**言語:** Python
**前提条件:** Phase 7 · 05 (Full Transformer), Phase 7 · 06 (BERT), Phase 7 · 07 (GPT)
**所要時間:** 約45分

## 問題

Decoder-only GPT と encoder-only BERT は、2017 年の architecture を異なる目的のためにそれぞれ削ぎ落としたものです。しかし多くの task は自然に input-output です。

- Translation: English → French.
- Summarization: 5,000-token article → 200-token summary.
- Speech recognition: audio tokens → text tokens.
- Structured extraction: prose → JSON.

このような場合、encoder-decoder が最も自然に合います。encoder は source の dense representation を生成します。decoder は各 step でその representation に cross-attend しながら output を生成します。training は output 側の shift-by-one です。GPT と同じ loss ですが、encoder output で条件付けされています。

現代的な playbook を定義した paper は 2 つあります。

1. **T5** (Raffel et al. 2019). "Text-to-Text Transfer Transformer." すべての NLP task を text-in, text-out として再定式化しました。single architecture、single vocabulary、single loss です。masked span prediction で pretrain されます (input の span を壊し、output で decode する)。
2. **BART** (Lewis et al. 2019). "Bidirectional and Auto-Regressive Transformer." Denoising autoencoder です。input を複数の方法で壊し (shuffle、mask、delete、rotate)、decoder に original を再構成させます。

2026 年でも encoder-decoder format は input structure が重要な場所で残っています。

- Whisper (speech → text).
- Google's translation stack.
- distinct context-and-edit structure を持つ一部の code-completion / repair models。
- structured reasoning tasks 向けの Flan-T5 と variants。

Decoder-only が注目を集めましたが、encoder-decoder が消えたわけではありません。

## コンセプト

![Encoder-decoder with cross-attention](../assets/encoder-decoder.svg)

### Forward loop

```
source tokens ─▶ encoder ─▶ (N_src, d_model)  ──┐
                                                 │
target tokens ─▶ decoder block                   │
                 ├─▶ masked self-attention       │
                 ├─▶ cross-attention ◀───────────┘
                 └─▶ FFN
                ↓
              next-token logits
```

重要なのは、encoder は input ごとに 1 回だけ走ることです。decoder は autoregressive に走りますが、各 step で同じ encoder output に cross-attend します。長い input では encoder output を cache するだけで無料の speedup になります。

### T5 pretraining — span corruption

input の random spans (average length 3 tokens、total 15%) を選びます。各 span を unique sentinel に置き換えます: `<extra_id_0>`、`<extra_id_1>` など。decoder は、sentinel prefix 付きで corrupted spans だけを出力します。

```
source: The quick <extra_id_0> fox jumps <extra_id_1> dog
target: <extra_id_0> brown <extra_id_1> over the lazy
```

whole sequence を予測するより安価な signal です。T5 paper の ablation では、MLM (BERT) や prefix-LM (UniLM) と競争力がありました。

### BART pretraining — multi-noise denoising

BART は 5 つの noising functions を試します。

1. Token masking.
2. Token deletion.
3. Text infilling (span を mask し、decoder が正しい length と内容を挿入する)。
4. Sentence permutation.
5. Document rotation.

text infilling + sentence permutation の組み合わせが、downstream numbers で最良でした。decoder は常に original を再構成します。BART の output は corrupted spans だけではなく full sequence なので、pretraining compute は T5 より高くなります。

### Inference

GPT と同じ autoregressive generation です。Greedy / beam / top-p sampling が使えます。translation と summarization では output distribution が chat より狭いため、beam search (width 4–5) が標準です。

### 2026 年に各 variant を選ぶ場面

| Task | Encoder-decoder? | Why |
|------|------------------|-----|
| Translation | Yes, usually | 明確な source sequence。固定的な output distribution。beam search が効く |
| Speech-to-text | Yes (Whisper) | input modality が output と異なる。encoder が audio features を形作る |
| Chat / reasoning | No, decoder-only | 永続的な「input」はなく、conversation 自体が sequence |
| Code completion | Usually no | long context の decoder-only が勝つ。Qwen 2.5 Coder などの code models は decoder-only |
| Summarization | Either works | BART、PEGASUS は初期の decoder-only baseline を上回った。現代の decoder-only LLMs は同等 |
| Structured extraction | Either | T5 は「text → text」で任意の output format を吸収できるので素直 |

2022 年ごろからの trend は、decoder-only が encoder-decoder の持ち場だった task を奪っていくことです。理由は、(a) instruction-tuned decoder-only LLMs が prompting によって何にでも generalize する、(b) 1 つの architecture のほうが 2 つより scale しやすい、(c) RLHF は decoder を前提にしている、の 3 つです。encoder-decoder は input modality が異なる場合 (speech、images) や beam search quality が重要な場合に残ります。

## 作ってみる

`code/main.py` を見てください。toy corpus 用に T5-style span corruption を実装します。これは、以降のほぼすべての encoder-decoder pretraining recipe に出てくる、このレッスンで最も有用な部品です。

### Step 1: span corruption

```python
def corrupt_spans(tokens, mask_rate=0.15, mean_span=3.0, rng=None):
    """Pick spans summing to ~mask_rate of tokens. Return (corrupted_input, target)."""
    n = len(tokens)
    n_mask = max(1, int(n * mask_rate))
    n_spans = max(1, int(round(n_mask / mean_span)))
    ...
```

target format は T5 convention です: `<sent0> span0 <sent1> span1 ...`。corrupted input は unchanged tokens と span location の sentinel tokens を interleave します。

### Step 2: round-trip を検証する

corrupted input と target が与えられたら、original sentence を再構成します。corruption が reversible なら、forward pass は well-defined です。これは sanity check です。real training では行いませんが、test は安く、span bookkeeping の off-by-one bug を見つけられます。

### Step 3: BART noising

5 つの functions: `token_mask`, `token_delete`, `text_infill`, `sentence_permute`, `document_rotate`。このうち 2 つを compose し、結果を表示します。

## 使ってみる

HuggingFace reference:

```python
from transformers import T5ForConditionalGeneration, T5Tokenizer
tok = T5Tokenizer.from_pretrained("google/flan-t5-base")
model = T5ForConditionalGeneration.from_pretrained("google/flan-t5-base")

inputs = tok("translate English to French: Attention is all you need.", return_tensors="pt")
out = model.generate(**inputs, max_new_tokens=32)
print(tok.decode(out[0], skip_special_tokens=True))
```

T5 の trick は、task name を input text に入れることです。各 task が text-in, text-out なので、同じ model が何十もの task を扱えます。2026 年にはこの pattern は instruction-tuned decoder-only models に一般化されていますが、最初に体系化したのは T5 です。

## Ship It

`outputs/skill-seq2seq-picker.md` を見てください。この skill は、新しい task について input-output structure、latency、quality targets が与えられたとき、encoder-decoder と decoder-only のどちらを選ぶかを決めます。

## 演習

1. **Easy.** `code/main.py` を実行し、30-token sentence に span corruption を適用してください。non-sentinel source tokens と decoded target spans を連結すると original が再現されることを確認します。
2. **Medium.** BART の `text_infill` noise を実装してください。random spans を単一の `<mask>` token に置き換え、decoder が正しい span length と contents を推測する必要があります。例を 1 つ示します。
3. **Hard.** tiny English → pig-Latin corpus (200 pairs) で `flan-t5-small` を fine-tune してください。held-out 50-pair set で BLEU を測ります。同じ data と同じ compute で `Llama-3.2-1B` を fine-tune した場合と比較します。

## Key Terms

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Encoder-decoder | 「Seq2seq transformer」 | 2 つの stack。input 用の bidirectional encoder と、output 用の cross-attention 付き causal decoder。 |
| Cross-attention | 「source が target に話す場所」 | decoder の Q × encoder の K/V。encoder 情報が decoder に入る唯一の場所。 |
| Span corruption | 「T5 の pretraining trick」 | random spans を sentinel tokens に置き換え、decoder がその spans を出力する。 |
| Denoising objective | 「BART の game」 | input に noise function を適用し、decoder に clean sequence を再構成させる。 |
| Sentinel token | 「`<extra_id_N>` placeholder」 | source の corrupted spans を tag し、target で再度 tag する special tokens。 |
| Flan | 「Instruction-tuned T5」 | 1,800 を超える tasks で fine-tuned された T5。instruction-following で encoder-decoder を競争力あるものにした。 |
| Beam search | 「Decoding strategy」 | 各 step で top-k partial sequences を保持する。translation/summarization の標準。 |
| Teacher forcing | 「Training-time input」 | training 中、sampled token ではなく true previous output token を decoder に与える。 |

## 参考文献

- [Raffel et al. (2019). Exploring the Limits of Transfer Learning with a Unified Text-to-Text Transformer](https://arxiv.org/abs/1910.10683) — T5。
- [Lewis et al. (2019). BART: Denoising Sequence-to-Sequence Pre-training for Natural Language Generation, Translation, and Comprehension](https://arxiv.org/abs/1910.13461) — BART。
- [Chung et al. (2022). Scaling Instruction-Finetuned Language Models](https://arxiv.org/abs/2210.11416) — Flan-T5。
- [Radford et al. (2022). Robust Speech Recognition via Large-Scale Weak Supervision](https://arxiv.org/abs/2212.04356) — Whisper。canonical な 2026 年版 encoder-decoder。
- [HuggingFace `modeling_t5.py`](https://github.com/huggingface/transformers/blob/main/src/transformers/models/t5/modeling_t5.py) — reference implementation。
