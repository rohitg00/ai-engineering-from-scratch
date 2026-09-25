# T5、BART — 编码器-解码器模型

> 编码器负责理解。解码器负责生成。把它们重新组合起来，你得到一个为输入 → 输出任务而生的模型：翻译、摘要、改写、转写。

**Type:** Learn
**Languages:** Python
**Prerequisites:** 阶段 7 · 05（完整 Transformer）、阶段 7 · 06（BERT）、阶段 7 · 07（GPT）
**Time:** 约 45 分钟

## 问题所在

仅解码器的 GPT 和仅编码器的 BERT 各自为了不同目标对 2017 年的架构做了裁剪。但很多任务天然就是输入-输出形式的：

- 翻译：英语 → 法语。
- 摘要：5,000 token 的文章 → 200 token 的摘要。
- 语音识别：音频 token → 文本 token。
- 结构化抽取：散文 → JSON。

对于这些任务，编码器-解码器是最契合的结构。编码器为源文本生成一个稠密表示。解码器生成输出，并在每一步对该表示进行交叉注意力。训练是在输出侧进行的 shift-by-one。损失函数与 GPT 相同，只是以编码器输出为条件。

两篇论文定义了现代玩法：

1. **T5**（Raffel 等，2019）。"Text-to-Text Transfer Transformer。" 每个 NLP 任务都被重构为文本进、文本出。单一架构、单一词表、单一损失。在掩码片段预测上进行预训练（破坏输入中的片段，在输出中将其还原）。
2. **BART**（Lewis 等，2019）。"Bidirectional and Auto-Regressive Transformer。" 去噪自编码器：以多种方式破坏输入（打乱、掩码、删除、旋转），要求解码器重建原文。

到 2026 年，编码器-解码器格式仍然在输入结构很重要的场景中活跃：

- Whisper（语音 → 文本）。
- Google 的翻译系统。
- 一些具有独立的上下文与编辑结构的代码补全 / 修复模型。
- 用于结构化推理任务的 Flan-T5 及其变体。

仅解码器模型抢走了聚光灯，但编码器-解码器从未消失。

## 核心概念

![Encoder-decoder with cross-attention](../assets/encoder-decoder.svg)

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

关键在于，编码器对每个输入只运行一次。解码器自回归地运行，但在每一步都对*同一份*编码器输出做交叉注意力。缓存编码器输出对长输入来说是免费的加速。

### T5 预训练 — 片段破坏

从输入中随机选取片段（平均长度 3 个 token，总计 15%）。用唯一的哨兵标记替换每个片段：`<extra_id_0>`、`<extra_id_1>` 等。解码器只输出被破坏的片段及其哨兵前缀：

```
source: The quick <extra_id_0> fox jumps <extra_id_1> dog
target: <extra_id_0> brown <extra_id_1> over the lazy
```

比预测整个序列的信号成本更低。在 T5 论文的消融实验中，与 MLM（BERT）和 prefix-LM（UniLM）相当。

### BART 预训练 — 多噪声去噪

BART 尝试了五种加噪函数：

1. Token 掩码。
2. Token 删除。
3. 文本填充（掩码一个片段，解码器插入正确长度的内容）。
4. 句子置换。
5. 文档旋转。

文本填充 + 句子置换的组合产生了最好的下游指标。解码器始终重建原始序列。BART 的输出是完整序列，而不仅仅是被破坏的片段 — 因此其预训练计算量高于 T5。

### 推理

与 GPT 相同的自回归生成。贪婪 / 集束 / top-p 采样均适用。集束搜索（宽度 4–5）是翻译和摘要的标准做法，因为其输出分布比聊天更窄。

### 2026 年各变体的适用场景

| 任务 | 用编码器-解码器？ | 原因 |
|------|------------------|-----|
| 翻译 | 通常用 | 清晰的源序列；固定的输出分布；集束搜索有效 |
| 语音转文本 | 用（Whisper） | 输入模态与输出不同；编码器塑造音频特征 |
| 聊天 / 推理 | 不用，仅解码器 | 没有固定的"输入" — 对话本身就是序列 |
| 代码补全 | 通常不用 | 长上下文的仅解码器模型占优；Qwen 2.5 Coder 等代码模型都是仅解码器的 |
| 摘要 | 都可以 | BART、PEGASUS 曾胜过早期仅解码器基线；现代仅解码器 LLM 已与之持平 |
| 结构化抽取 | 都可以 | T5 很干净，因为"文本 → 文本"能吸收任何输出格式 |

约 2022 年以来的趋势是：仅解码器接管了编码器-解码器曾经擅长的任务，因为（a）经指令微调的仅解码器 LLM 可以通过提示泛化到任何任务，（b）单一架构比双架构更容易扩展，（c）RLHF 假设的是解码器。编码器-解码器在输入模态不同（语音、图像）或集束搜索质量至关重要的场景中得以留存。

```figure
encoder-decoder
```

## 动手构建

参见 `code/main.py`。我们为一个玩具语料库实现 T5 风格的片段破坏 — 这是本课中最有用的单个部分，因为自那时起它出现在每一个编码器-解码器预训练方案中。

### 步骤 1：片段破坏

```python
def corrupt_spans(tokens, mask_rate=0.15, mean_span=3.0, rng=None):
    """Pick spans summing to ~mask_rate of tokens. Return (corrupted_input, target)."""
    n = len(tokens)
    n_mask = max(1, int(n * mask_rate))
    n_spans = max(1, int(round(n_mask / mean_span)))
    ...
```

目标格式遵循 T5 约定：`<sent0> span0 <sent1> span1 ...`。被破坏的输入将未改变的 token 与片段位置上的哨兵 token 交错排列。

### 步骤 2：验证往返

给定被破坏的输入和目标，重建原始句子。如果你的破坏是可逆的，那么前向传播就是良定义的。这是一个健全性检查 — 真实训练从不这样做，但这个测试很廉价，能捕捉片段记录中的 off-by-one 错误。

### 步骤 3：BART 加噪

五个函数：`token_mask`、`token_delete`、`text_infill`、`sentence_permute`、`document_rotate`。组合其中两个并展示结果。

## 使用它

HuggingFace 参考实现：

```python
from transformers import T5ForConditionalGeneration, T5Tokenizer
tok = T5Tokenizer.from_pretrained("google/flan-t5-base")
model = T5ForConditionalGeneration.from_pretrained("google/flan-t5-base")

inputs = tok("translate English to French: Attention is all you need.", return_tensors="pt")
out = model.generate(**inputs, max_new_tokens=32)
print(tok.decode(out[0], skip_special_tokens=True))
```

T5 的技巧：任务名称进入输入文本。同一个模型处理几十种任务，因为每个任务都是文本进、文本出。到 2026 年，这一模式已被指令微调的仅解码器模型推广，但 T5 最先将其固化。

## 上线

参见 `outputs/skill-seq2seq-picker.md`。该技能在给定输入-输出结构、延迟和质量目标的情况下，为新任务在编码器-解码器与仅解码器之间做出选择。

## 练习

1. **简单。** 运行 `code/main.py`，对一个 30 token 的句子应用片段破坏，验证将非哨兵的源 token 与解码得到的目标片段拼接后能还原原句。
2. **中等。** 实现 BART 的 `text_infill` 加噪：用单个 `<mask>` token 替换随机片段，解码器必须推断出正确的片段长度和内容。展示一个示例。
3. **困难。** 在一个微型英语 → 儿童黑话（pig-Latin）语料库（200 对）上微调 `flan-t5-small`。在留出的 50 对测试集上测量 BLEU。与在相同数据、相同计算量下微调 `Llama-3.2-1B` 的结果进行比较。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|-----------------------|
| 编码器-解码器 | "Seq2seq transformer" | 两个堆栈：用于输入的双向编码器，以及带交叉注意力、用于输出的因果解码器。 |
| 交叉注意力 | "源与目标交互的地方" | 解码器的 Q × 编码器的 K/V。编码器信息进入解码器的唯一途径。 |
| 片段破坏 | "T5 的预训练技巧" | 用哨兵 token 替换随机片段；解码器输出这些片段。 |
| 去噪目标 | "BART 的玩法" | 对输入施加噪声函数，训练解码器重建干净序列。 |
| 哨兵 token | "`<extra_id_N>` 占位符" | 特殊 token，在源中标记被破坏的片段，并在目标中重新标记它们。 |
| Flan | "指令微调的 T5" | 在超过 1,800 个任务上微调的 T5；使编码器-解码器在指令遵循上具备竞争力。 |
| 集束搜索 | "解码策略" | 每一步保留 top-k 个部分序列；翻译/摘要的标准做法。 |
| Teacher forcing | "训练时的输入" | 训练期间，将真实的上一个输出 token 而非采样得到的 token 喂给解码器。 |

## 延伸阅读

- [Raffel 等 (2019). Exploring the Limits of Transfer Learning with a Unified Text-to-Text Transformer](https://arxiv.org/abs/1910.10683) — T5。
- [Lewis 等 (2019). BART: Denoising Sequence-to-Sequence Pre-training for Natural Language Generation, Translation, and Comprehension](https://arxiv.org/abs/1910.13461) — BART。
- [Chung 等 (2022). Scaling Instruction-Finetuned Language Models](https://arxiv.org/abs/2210.11416) — Flan-T5。
- [Radford 等 (2022). Robust Speech Recognition via Large-Scale Weak Supervision](https://arxiv.org/abs/2212.04356) — Whisper，2026 年标志性的编码器-解码器。
- [HuggingFace `modeling_t5.py`](https://github.com/huggingface/transformers/blob/main/src/transformers/models/t5/modeling_t5.py) — 参考实现。