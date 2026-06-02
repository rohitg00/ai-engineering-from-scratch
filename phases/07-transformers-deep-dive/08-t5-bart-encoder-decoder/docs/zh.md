# T5、BART —— Encoder-Decoder 模型

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> Encoder 负责理解，decoder 负责生成。把它们重新拼回去，就得到一个为「输入 → 输出」任务而生的模型：翻译、摘要、改写、转写。

**Type:** Learn
**Languages:** Python
**Prerequisites:** Phase 7 · 05 (Full Transformer), Phase 7 · 06 (BERT), Phase 7 · 07 (GPT)
**Time:** ~45 minutes

## 问题（The Problem）

Decoder-only 的 GPT 和 encoder-only 的 BERT，都是把 2017 年的原始架构按各自目标砍掉一半。但很多任务天生就是输入-输出形态：

- 翻译：英文 → 法文。
- 摘要：5,000-token 的长文 → 200-token 的摘要。
- 语音识别：音频 token → 文本 token。
- 结构化抽取：自然语言 → JSON。

这些任务里，encoder-decoder 是最贴合的形态。Encoder 把源序列压成一份稠密表示，decoder 一边生成输出，一边在每一步对这份表示做 cross-attention。训练时输出端依旧是 shift-by-one，loss 跟 GPT 一模一样，只是多了一个「以 encoder 输出为条件」。

两篇论文奠定了现代套路：

1. **T5**（Raffel et al. 2019）。"Text-to-Text Transfer Transformer"。把所有 NLP 任务都重写成「文本进、文本出」。一套架构、一套词表、一种 loss。预训练目标是 masked span 预测（在输入里损坏若干 span，让 decoder 输出这些 span）。
2. **BART**（Lewis et al. 2019）。"Bidirectional and Auto-Regressive Transformer"。一个去噪 autoencoder：用多种方式损坏输入（打乱、mask、删除、旋转），让 decoder 重建原始序列。

到 2026 年，encoder-decoder 这套范式仍然活跃在「输入结构很重要」的领域：

- Whisper（语音 → 文本）。
- Google 的翻译技术栈。
- 一些上下文与编辑结构泾渭分明的代码补全 / 修复模型。
- 用于结构化推理任务的 Flan-T5 及其衍生。

虽然 decoder-only 抢走了聚光灯，但 encoder-decoder 从未消失。

## 概念（The Concept）

![Encoder-decoder with cross-attention](../assets/encoder-decoder.svg)

### 前向流程（The forward loop）

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

关键点：encoder 对一份输入只跑一次。Decoder 是 autoregressive 的，但每一步都在 cross-attend *同一份* encoder 输出。把 encoder 输出缓存起来，在长输入场景下就是免费的提速。

### T5 的预训练 —— span corruption（span 损坏）

随机挑选输入里的若干 span（平均长度 3 个 token，总共占 15%）。每个 span 替换成一个独立的 sentinel token：`<extra_id_0>`、`<extra_id_1>`，以此类推。Decoder 只输出被损坏的 span，并带上对应的 sentinel 前缀：

```
source: The quick <extra_id_0> fox jumps <extra_id_1> dog
target: <extra_id_0> brown <extra_id_1> over the lazy
```

比预测整段序列便宜得多。在 T5 论文的消融实验（ablation）里，这个目标和 MLM（BERT）、prefix-LM（UniLM）打成平手。

### BART 的预训练 —— 多种噪声去噪（multi-noise denoising）

BART 试了五种加噪函数：

1. Token masking。
2. Token deletion。
3. Text infilling（mask 一整个 span，让 decoder 自己推断正确长度）。
4. Sentence permutation。
5. Document rotation。

把 text infilling 和 sentence permutation 组合起来，下游指标最好。Decoder 永远要重建原始序列。BART 的输出是整段完整序列，不像 T5 只输出被损坏的部分 —— 因此预训练算力开销比 T5 大。

### 推理（Inference）

跟 GPT 一样的 autoregressive 生成。Greedy / beam / top-p sampling 都能用。翻译和摘要场景里 beam search（宽度 4–5）是标配，因为这些任务的输出分布比聊天窄得多。

### 2026 年怎么挑（When to pick each variant in 2026）

| 任务 | 用 encoder-decoder？ | 为什么 |
|------|------------------|-----|
| 翻译 | 通常用 | 源序列清晰；输出分布固定；beam search 有效 |
| 语音转文字 | 用（Whisper） | 输入模态和输出不同；encoder 负责塑形音频特征 |
| 聊天 / 推理 | 不用，decoder-only 更好 | 没有持久的「输入」—— 整段对话本身就是序列 |
| 代码补全 | 通常不用 | 长 context 的 decoder-only 占优；像 Qwen 2.5 Coder 这类代码模型都是 decoder-only |
| 摘要 | 都行 | BART、PEGASUS 当年压过早期 decoder-only；现代 decoder-only LLM 已经追平 |
| 结构化抽取 | 都行 | T5 很顺手，因为「文本 → 文本」可以吞下任何输出格式 |

2022 年以来的趋势：decoder-only 正在接管原本属于 encoder-decoder 的任务，原因有三：(a) 经过 instruction tuning 的 decoder-only LLM 通过 prompting 就能泛化到任何任务；(b) 一种架构比两种架构更好规模化；(c) RLHF 默认是基于 decoder 的。Encoder-decoder 仍守得住那些「输入模态不同」（语音、图像）或「beam search 质量很关键」的领域。

## 动手实现（Build It）

见 `code/main.py`。我们对一个玩具语料实现 T5 风格的 span corruption —— 这是这一课里最有用的单一组件，因为之后的每一个 encoder-decoder 预训练 recipe（配方）里都能见到它。

### 第 1 步：span corruption

```python
def corrupt_spans(tokens, mask_rate=0.15, mean_span=3.0, rng=None):
    """Pick spans summing to ~mask_rate of tokens. Return (corrupted_input, target)."""
    n = len(tokens)
    n_mask = max(1, int(n * mask_rate))
    n_spans = max(1, int(round(n_mask / mean_span)))
    ...
```

目标格式是 T5 的惯例：`<sent0> span0 <sent1> span1 ...`。损坏后的输入则是把 sentinel token 插到原 span 的位置，跟未改动的 token 交错排列。

### 第 2 步：验证可逆（verify round-trip）

给定损坏输入和目标，把原句重建出来。如果你的损坏过程是可逆的，那前向计算就是良定义的。这只是一个 sanity check —— 真正训练时不会做这一步，但这个测试很便宜，能抓住 span 簿记里的 off-by-one bug。

### 第 3 步：BART 加噪

五个函数：`token_mask`、`token_delete`、`text_infill`、`sentence_permute`、`document_rotate`。任选两个组合一下，把结果打印出来看看。

## 用起来（Use It）

HuggingFace 参考用法：

```python
from transformers import T5ForConditionalGeneration, T5Tokenizer
tok = T5Tokenizer.from_pretrained("google/flan-t5-base")
model = T5ForConditionalGeneration.from_pretrained("google/flan-t5-base")

inputs = tok("translate English to French: Attention is all you need.", return_tensors="pt")
out = model.generate(**inputs, max_new_tokens=32)
print(tok.decode(out[0], skip_special_tokens=True))
```

T5 的小心机：把任务名直接塞进输入文本里。同一个模型可以处理几十种任务，因为每个任务都是文本进、文本出。2026 年这种范式已经被 instruction-tuned 的 decoder-only 模型推广开来，但 T5 是第一个把它写成范式的。

## 上线部署（Ship It）

见 `outputs/skill-seq2seq-picker.md`。这个 skill 会根据输入-输出结构、延迟和质量目标，在 encoder-decoder 与 decoder-only 之间帮你挑一个。

## 练习（Exercises）

1. **简单。** 跑 `code/main.py`，对一个 30-token 的句子做 span corruption，确认把源序列里非 sentinel 的 token 与解码出的目标 span 拼起来后能复原原句。
2. **中等。** 实现 BART 的 `text_infill` 噪声：把随机 span 替换成一个 `<mask>` token，让 decoder 去推断正确的 span 长度和内容。给一个示例。
3. **困难。** 在一个 200 对的 英文 → pig-Latin 小语料上微调 `flan-t5-small`。在 50 对的 held-out 集合上算 BLEU。在相同算力预算下，用同样的数据微调 `Llama-3.2-1B`，对比两者。

## 关键术语（Key Terms）

| 术语 | 大家怎么说 | 实际含义 |
|------|-----------------|-----------------------|
| Encoder-decoder | 「Seq2seq transformer」 | 两个 stack：双向 encoder 处理输入，带 cross-attention 的因果 decoder 处理输出。 |
| Cross-attention | 「源序列跟目标序列对话的地方」 | Decoder 的 Q × encoder 的 K/V。Encoder 信息进入 decoder 的唯一通道。 |
| Span corruption | 「T5 的预训练小心机」 | 用 sentinel token 替换随机 span，让 decoder 输出这些 span。 |
| Denoising objective | 「BART 玩的把戏」 | 对输入施加一个噪声函数，训练 decoder 重建干净序列。 |
| Sentinel token | 「`<extra_id_N>` 这种占位符」 | 特殊 token，在源序列里标记被损坏的 span，并在目标里重新标记。 |
| Flan | 「Instruction-tuned T5」 | 在超过 1,800 个任务上微调过的 T5；让 encoder-decoder 在指令跟随上重新具备竞争力。 |
| Beam search | 「一种解码策略」 | 在每一步保留 top-k 个候选部分序列；翻译 / 摘要的标准做法。 |
| Teacher forcing | 「训练时的输入方式」 | 训练时把真实的上一个输出 token 喂给 decoder，而不是它自己采样出来的那个。 |

## 延伸阅读（Further Reading）

- [Raffel et al. (2019). Exploring the Limits of Transfer Learning with a Unified Text-to-Text Transformer](https://arxiv.org/abs/1910.10683) —— T5。
- [Lewis et al. (2019). BART: Denoising Sequence-to-Sequence Pre-training for Natural Language Generation, Translation, and Comprehension](https://arxiv.org/abs/1910.13461) —— BART。
- [Chung et al. (2022). Scaling Instruction-Finetuned Language Models](https://arxiv.org/abs/2210.11416) —— Flan-T5。
- [Radford et al. (2022). Robust Speech Recognition via Large-Scale Weak Supervision](https://arxiv.org/abs/2212.04356) —— Whisper，2026 年最具代表性的 encoder-decoder。
- [HuggingFace `modeling_t5.py`](https://github.com/huggingface/transformers/blob/main/src/transformers/models/t5/modeling_t5.py) —— 参考实现。
