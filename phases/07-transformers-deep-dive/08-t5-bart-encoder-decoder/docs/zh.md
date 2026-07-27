# T5、BART — 编码器-解码器模型

> 编码器理解。解码器生成。把它们放回一起，你就得到了一个专为输入→输出任务构建的模型：翻译、摘要、重写、转录。

**Type:** Learn
**Languages:** Python
**Prerequisites:** Phase 7 · 05 (Full Transformer), Phase 7 · 06 (BERT), Phase 7 · 07 (GPT)
**Time:** ~45 分钟

## 问题

Decoder-only GPT 和 encoder-only BERT 各自为不同目标裁剪了 2017 年的架构。但许多任务天然是输入-输出的：

- 翻译：英语 → 法语。
- 摘要：5,000 token 的文章 → 200 token 的摘要。
- 语音识别：音频 token → 文本 token。
- 结构化提取：散文 → JSON。

对于这些任务，encoder-decoder 提供了最干净的适配。编码器产生源的稠密表示。解码器生成输出，每一步交叉关注该表示。训练是在输出侧的移位一位。与 GPT 相同的损失，只是以编码器输出为条件。

两篇论文定义了现代操作手册：

1. **T5**（Raffel et al. 2019）。"Text-to-Text Transfer Transformer。"每个 NLP 任务都被重新定义为文本输入、文本输出。单一架构、单一词汇表、单一损失。在掩码跨度预测（在输入中损坏跨度，在输出中解码它们）上预训练。
2. **BART**（Lewis et al. 2019）。"Bidirectional and Auto-Regressive Transformer。"去噪自编码器：以多种方式损坏输入（打乱、掩码、删除、旋转），要求解码器重建原文。

到 2026 年，编码器-解码器格式在输入结构重要时仍然存在：

- Whisper（语音→文本）。
- Google 的翻译堆栈。
- 一些具有不同上下文和编辑结构的代码补全/修复模型。
- Flan-T5 及其变体用于结构化推理任务。

Decoder-only 赢得了聚光灯，但 encoder-decoder 从未消失。

## 概念

![带有交叉注意力的编码器-解码器](../assets/encoder-decoder.svg)

### 前向循环

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

关键是，编码器每个输入只运行一次。解码器自回归运行，但每一步都交叉关注*相同的*编码器输出。缓存编码器输出对于长输入是一个免费的加速。

### T5 预训练——跨度破坏

选取输入的随机跨度（平均长度 3 个 token，总计 15%）。用唯一的哨兵 token 替换每个跨度：`<extra_id_0>`、`<extra_id_1>` 等。解码器仅输出破坏的跨度及其哨兵前缀：

```
source: The quick <extra_id_0> fox jumps <extra_id_1> dog
target: <extra_id_0> brown <extra_id_1> over the lazy
```

比预测整个序列更便宜的信号。在 T5 论文的消融中与 MLM（BERT）和 prefix-LM（UniLM）具有竞争力。

### BART 预训练——多噪声去噪

BART 尝试了五种噪声函数：

1. Token masking。
2. Token deletion。
3. Text infilling（掩码一个跨度，解码器插入正确的长度）。
4. Sentence permutation。
5. Document rotation。

结合 text infilling + sentence permutation 产生了最佳下游指标。解码器始终重建原文。BART 的输出是整个序列，而不仅仅是损坏的跨度——所以预训练计算量大于 T5。

### 推理

与 GPT 相同的自回归生成。Greedy / beam / top-p 采样均适用。Beam search（宽度 4–5）是翻译和摘要的标准，因为输出分布比聊天更窄。

### 2026 年如何选择每种变体

| 任务 | 编码器-解码器？ | 为什么 |
|------|------------------|-----|
| 翻译 | 通常是的 | 清晰的源序列；固定的输出分布；beam search 有效 |
| 语音转文本 | 是（Whisper） | 输入模态与输出不同；编码器塑造音频特征 |
| 聊天 / 推理 | 否，decoder-only | 没有持久的"输入"——对话本身就是序列 |
| 代码补全 | 通常不 | Decoder-only 搭配长上下文胜出；Qwen 2.5 Coder 等代码模型是 decoder-only |
| 摘要 | 两者皆可 | BART、PEGASUS 超越了早期的 decoder-only 基线；现代 decoder-only LLM 与它们相当 |
| 结构化提取 | 两者皆可 | T5 很干净，因为"文本→文本"吸收了任何输出格式 |

大约 2022 年以来的趋势：decoder-only 接管了 encoder-decoder 曾经拥有的任务，因为（a）指令微调的 decoder-only LLM 通过 prompt 泛化到任何任务，（b）一种架构比两种更容易扩展，（c）RLHF 假设一个解码器。Encoder-decoder 在输入模态不同（语音、图像）或 beam search 质量重要时仍然存在。

## 动手构建

参见 `code/main.py`。我们为一个玩具语料库实现 T5 风格的跨度破坏——这是本课程中最有用的一件内容，因为它出现在此后的每个 encoder-decoder 预训练配方中。

### 步骤 1：跨度破坏

```python
def corrupt_spans(tokens, mask_rate=0.15, mean_span=3.0, rng=None):
    """Pick spans summing to ~mask_rate of tokens. Return (corrupted_input, target)."""
    n = len(tokens)
    n_mask = max(1, int(n * mask_rate))
    n_spans = max(1, int(round(n_mask / mean_span)))
    ...
```

目标格式是 T5 约定：`<sent0> span0 <sent1> span1 ...`。损坏的输入将未改变的 token 与跨度位置的哨兵 token 交织在一起。

### 步骤 2：验证往返

给定损坏的输入和目标，重建原始句子。如果你的损坏是可逆的，前向传播就是良好定义的。这是一个合理性检查——真正的训练从不这样做，但这个测试成本低廉，并能捕获跨度记账中的 off-by-one 错误。

### 步骤 3：BART 噪声

五个函数：`token_mask`、`token_delete`、`text_infill`、`sentence_permute`、`document_rotate`。组合其中两个并展示结果。

## 实际应用

HuggingFace 参考：

```python
from transformers import T5ForConditionalGeneration, T5Tokenizer
tok = T5Tokenizer.from_pretrained("google/flan-t5-base")
model = T5ForConditionalGeneration.from_pretrained("google/flan-t5-base")

inputs = tok("translate English to French: Attention is all you need.", return_tensors="pt")
out = model.generate(**inputs, max_new_tokens=32)
print(tok.decode(out[0], skip_special_tokens=True))
```

T5 的技巧：任务名称被放入输入文本。同一个模型处理数十个任务，因为每个任务都是文本输入、文本输出。到 2026 年，这种模式已被指令微调的 decoder-only 模型泛化，但 T5 首先将其规范化。

## 交付

参见 `outputs/skill-seq2seq-picker.md`。该 skill 根据输入-输出结构、延迟和质量目标，为新任务在 encoder-decoder 和 decoder-only 之间进行选择。

## 练习

1. **简单。** 运行 `code/main.py`，对 30 token 的句子应用跨度破坏，验证拼接非哨兵源 token 与解码的目标跨度可以重现原文。
2. **中等。** 实现 BART 的 `text_infill` 噪声：用单个 `<mask>` token 替换随机跨度，解码器必须推断正确的跨度长度和内容。展示一个示例。
3. **困难。** 在小型英语→猪拉丁语语料库（200 对）上微调 `flan-t5-small`。在保留的 50 对集合上测量 BLEU。与在相同数据上用相同计算微调 `Llama-3.2-1B` 进行比较。

## 关键术语

| 术语 | 人们说的 | 实际含义 |
|------|-----------------|-----------------------|
| Encoder-decoder | "Seq2seq transformer" | 两个堆栈：用于输入的双向编码器，带交叉注意力的因果解码器用于输出。 |
| Cross-attention | "源传给目标的地方" | 解码器的 Q × 编码器的 K/V。编码器信息进入解码器的唯一位置。 |
| Span corruption | "T5 的预训练技巧" | 用哨兵 token 替换随机跨度；解码器输出跨度。 |
| Denoising objective | "BART 的游戏" | 对输入应用噪声函数，训练解码器重建干净序列。 |
| Sentinel token | "`<extra_id_N>` 占位符" | 标记源中损坏跨度的特殊 token，并在目标中重新标记它们。 |
| Flan | "指令微调的 T5" | 在 >1,800 个任务上微调的 T5；使 encoder-decoder 在指令遵循上具有竞争力。 |
| Beam search | "解码策略" | 每一步保留 top-k 部分序列；翻译/摘要的标准。 |
| Teacher forcing | "训练时输入" | 训练时向解码器输入真实的前一个输出 token，而非采样的那个。 |

## 延伸阅读

- [Raffel et al. (2019). Exploring the Limits of Transfer Learning with a Unified Text-to-Text Transformer](https://arxiv.org/abs/1910.10683) — T5。
- [Lewis et al. (2019). BART: Denoising Sequence-to-Sequence Pre-training for Natural Language Generation, Translation, and Comprehension](https://arxiv.org/abs/1910.13461) — BART。
- [Chung et al. (2022). Scaling Instruction-Finetuned Language Models](https://arxiv.org/abs/2210.11416) — Flan-T5。
- [Radford et al. (2022). Robust Speech Recognition via Large-Scale Weak Supervision](https://arxiv.org/abs/2212.04356) — Whisper，2026 年典范的 encoder-decoder。
- [HuggingFace `modeling_t5.py`](https://github.com/huggingface/transformers/blob/main/src/transformers/models/t5/modeling_t5.py) — 参考实现。
