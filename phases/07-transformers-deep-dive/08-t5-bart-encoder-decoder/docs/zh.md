# 08 · T5、BART —— 编码器-解码器模型

> 编码器负责理解，解码器负责生成。把两者重新拼回去，你就得到了一个为「输入 → 输出」任务而生的模型：翻译、摘要、改写、转写。

**类型：** 学习
**语言：** Python
**前置：** 第 7 阶段 · 05（完整 Transformer）、第 7 阶段 · 06（BERT）、第 7 阶段 · 07（GPT）
**时长：** 约 45 分钟

## 问题所在

仅解码器（decoder-only）的 GPT 和仅编码器（encoder-only）的 BERT，各自为不同目标精简了 2017 年的原始架构。但很多任务天然就是输入-输出型的：

- 翻译：英语 → 法语。
- 摘要：5,000 个 token 的文章 → 200 个 token 的摘要。
- 语音识别：音频 token → 文本 token。
- 结构化抽取：散文 → JSON。

对这些任务，编码器-解码器（encoder-decoder）是最贴合的形态。编码器为源序列产出一份稠密表示，解码器在生成输出时，每一步都对该表示做交叉注意力（cross-attention）。训练时输出侧采用「错位一位」（shift-by-one）的方式。损失函数与 GPT 完全相同，只是额外以编码器输出为条件。

有两篇论文定义了现代的标准做法：

1. **T5**（Raffel 等人，2019）。「文本到文本迁移 Transformer」（Text-to-Text Transfer Transformer）。把每一个 NLP 任务都重新表述为文本进、文本出。单一架构、单一词表、单一损失。预训练目标是掩码片段预测（在输入中破坏若干片段，在输出中将其解码出来）。
2. **BART**（Lewis 等人，2019）。「双向自回归 Transformer」（Bidirectional and Auto-Regressive Transformer）。一个去噪自编码器（denoising autoencoder）：以多种方式破坏输入（打乱、掩码、删除、旋转），要求解码器重建出原始文本。

到 2026 年，编码器-解码器格式仍然活跃于那些输入结构至关重要的场景：

- Whisper（语音 → 文本）。
- Google 的翻译技术栈。
- 一些具有「上下文-编辑」分离结构的代码补全 / 修复模型。
- 用于结构化推理任务的 Flan-T5 及其变体。

仅解码器模型抢走了聚光灯，但编码器-解码器从未消失。

## 核心概念

〔图：带交叉注意力的编码器-解码器结构〕

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

关键在于：编码器对每条输入只运行一次。解码器是自回归运行的，但每一步都对*同一份*编码器输出做交叉注意力。缓存编码器输出对于长输入来说，是一份免费的提速红利。

### T5 预训练 —— 片段破坏（span corruption）

随机挑选输入中的若干片段（平均长度 3 个 token，总计 15%）。把每个片段替换为一个唯一的哨兵（sentinel）token：`<extra_id_0>`、`<extra_id_1>` 等。解码器只输出被破坏的片段，并带上各自的哨兵前缀：

```
source: The quick <extra_id_0> fox jumps <extra_id_1> dog
target: <extra_id_0> brown <extra_id_1> over the lazy
```

相比预测整条序列，这种信号成本更低。在 T5 论文的消融实验中，它与 MLM（BERT）以及 prefix-LM（UniLM）相比也很有竞争力。

### BART 预训练 —— 多噪声去噪

BART 尝试了五种加噪函数：

1. token 掩码。
2. token 删除。
3. 文本填充（text infilling，掩盖一个片段，由解码器补出正确长度的内容）。
4. 句子置换。
5. 文档旋转。

文本填充 + 句子置换的组合，在下游任务上取得了最好的成绩。解码器始终重建原始文本。BART 的输出是完整序列，而不仅仅是被破坏的片段 —— 因此其预训练算力开销高于 T5。

### 推理

与 GPT 完全相同的自回归生成。贪心（greedy）/ 束搜索（beam）/ top-p 采样都适用。束搜索（宽度 4–5）是翻译和摘要的标准做法，因为这类任务的输出分布比聊天更窄。

### 2026 年如何在各变体之间取舍

| 任务 | 用编码器-解码器？ | 原因 |
|------|------------------|-----|
| 翻译 | 通常用 | 源序列明确；输出分布固定；束搜索有效 |
| 语音转文本 | 用（Whisper） | 输入模态不同于输出；编码器负责塑造音频特征 |
| 聊天 / 推理 | 不用，仅解码器 | 没有持久的「输入」—— 对话本身就是序列 |
| 代码补全 | 通常不用 | 带长上下文的仅解码器更优；像 Qwen 2.5 Coder 这样的代码模型是仅解码器 |
| 摘要 | 都行 | BART、PEGASUS 击败了早期的仅解码器基线；现代仅解码器 LLM 与它们持平 |
| 结构化抽取 | 都行 | T5 很干净，因为「文本 → 文本」能吸纳任何输出格式 |

约 2022 年以来的趋势：仅解码器接管了原本属于编码器-解码器的任务，原因有三：(a) 经过指令微调的仅解码器 LLM 可通过提示泛化到任何任务；(b) 单一架构比两套架构更易扩展；(c) RLHF 默认面向解码器。编码器-解码器在输入模态不同（语音、图像）或束搜索质量重要的场景中仍然占据一席之地。

## 动手构建

参见 `code/main.py`。我们针对一个玩具语料实现 T5 风格的片段破坏 —— 这是本课中最有用的单一组件，因为自那以后每一个编码器-解码器预训练配方里都能见到它。

### 第 1 步：片段破坏

```python
def corrupt_spans(tokens, mask_rate=0.15, mean_span=3.0, rng=None):
    """挑选总和约为 mask_rate 比例的若干片段。返回 (corrupted_input, target)。"""
    n = len(tokens)
    n_mask = max(1, int(n * mask_rate))
    n_spans = max(1, int(round(n_mask / mean_span)))
    ...
```

目标格式遵循 T5 约定：`<sent0> span0 <sent1> span1 ...`。被破坏的输入则把未改动的 token 与片段位置处的哨兵 token 交错排列。

### 第 2 步：验证往返一致性

给定被破坏的输入和目标，重建出原始句子。如果你的破坏过程是可逆的，那么前向过程就是良定义的。这是一个完整性检查 —— 真实训练中绝不会这么做，但这个测试成本很低，能抓出你片段记账中的「差一」（off-by-one）bug。

### 第 3 步：BART 加噪

五个函数：`token_mask`、`token_delete`、`text_infill`、`sentence_permute`、`document_rotate`。组合其中两个并展示结果。

## 上手使用

HuggingFace 参考代码：

```python
from transformers import T5ForConditionalGeneration, T5Tokenizer
tok = T5Tokenizer.from_pretrained("google/flan-t5-base")
model = T5ForConditionalGeneration.from_pretrained("google/flan-t5-base")

inputs = tok("translate English to French: Attention is all you need.", return_tensors="pt")
out = model.generate(**inputs, max_new_tokens=32)
print(tok.decode(out[0], skip_special_tokens=True))
```

T5 的诀窍：把任务名写进输入文本里。同一个模型能处理数十种任务，因为每个任务都是文本进、文本出。到 2026 年，这一模式已被经过指令微调的仅解码器模型推广，但 T5 是最先把它规范化的。

## 部署上线

参见 `outputs/skill-seq2seq-picker.md`。该技能会根据输入-输出结构、延迟和质量目标，为一个新任务在编码器-解码器与仅解码器之间做出选择。

## 练习

1. **简单。** 运行 `code/main.py`，对一个 30 token 的句子施加片段破坏，验证将非哨兵的源 token 与解码出的目标片段拼接后，能重现原始句子。
2. **中等。** 实现 BART 的 `text_infill` 噪声：把随机片段替换为单个 `<mask>` token，解码器必须推断出正确的片段长度和内容。展示一个示例。
3. **困难。** 在一个极小的「英语 → 儿童黑话（pig-Latin）」语料（200 对）上微调 `flan-t5-small`。在留出的 50 对测试集上测量 BLEU。与在相同数据、相同算力下微调 `Llama-3.2-1B` 做对比。

## 关键术语

| 术语 | 人们怎么说 | 它实际指什么 |
|------|-----------------|-----------------------|
| Encoder-decoder（编码器-解码器） | 「Seq2seq transformer」 | 两个堆栈：处理输入的双向编码器，以及带交叉注意力、处理输出的因果解码器。 |
| Cross-attention（交叉注意力） | 「源与目标对话的地方」 | 解码器的 Q × 编码器的 K/V。这是编码器信息进入解码器的唯一入口。 |
| Span corruption（片段破坏） | 「T5 的预训练诀窍」 | 把随机片段替换为哨兵 token；由解码器输出这些片段。 |
| Denoising objective（去噪目标） | 「BART 玩的把戏」 | 对输入施加一个噪声函数，训练解码器重建出干净的序列。 |
| Sentinel token（哨兵 token） | 「`<extra_id_N>` 占位符」 | 一类特殊 token，在源序列中标记被破坏的片段，并在目标序列中重新标记它们。 |
| Flan | 「指令微调版 T5」 | 在超过 1,800 个任务上微调的 T5；使编码器-解码器在指令遵循上具备竞争力。 |
| Beam search（束搜索） | 「一种解码策略」 | 每一步保留 top-k 个部分序列；翻译/摘要的标准做法。 |
| Teacher forcing（教师强制） | 「训练时的输入」 | 训练期间，向解码器喂入真实的上一个输出 token，而非采样得到的那个。 |

## 延伸阅读

- [Raffel 等人（2019）。Exploring the Limits of Transfer Learning with a Unified Text-to-Text Transformer](https://arxiv.org/abs/1910.10683) —— T5。
- [Lewis 等人（2019）。BART: Denoising Sequence-to-Sequence Pre-training for Natural Language Generation, Translation, and Comprehension](https://arxiv.org/abs/1910.13461) —— BART。
- [Chung 等人（2022）。Scaling Instruction-Finetuned Language Models](https://arxiv.org/abs/2210.11416) —— Flan-T5。
- [Radford 等人（2022）。Robust Speech Recognition via Large-Scale Weak Supervision](https://arxiv.org/abs/2212.04356) —— Whisper，2026 年编码器-解码器的典范。
- [HuggingFace `modeling_t5.py`](https://github.com/huggingface/transformers/blob/main/src/transformers/models/t5/modeling_t5.py) —— 参考实现。
