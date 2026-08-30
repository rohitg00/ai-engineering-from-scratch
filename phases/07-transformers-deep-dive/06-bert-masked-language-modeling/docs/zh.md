# 06 · BERT — 掩码语言建模

> GPT 预测下一个词，BERT 预测缺失的词。一句话之差——却撑起了此后近五年里一切与嵌入相关的东西。

**类型：** 构建
**语言：** Python
**前置：** 阶段 7 · 05（完整 Transformer），阶段 5 · 02（文本表示）
**时长：** 约 45 分钟

## 问题所在

2018 年，每一项 NLP 任务——情感分析、命名实体识别（NER）、问答、文本蕴含——都要在各自的标注数据上从零训练自己的模型。当时没有一个预训练好的「理解英语」检查点供你微调。ELMo（2018）证明了可以用双向 LSTM 预训练上下文嵌入；它有帮助，但泛化能力不足。

BERT（Devlin 等人，2018）提出了一个设想：如果我们拿一个「Transformer 编码器（transformer encoder）」，在互联网上的每一个句子上训练它，并强迫它根据两侧的上下文预测缺失的词，会怎样？然后你只需在下游任务上微调一个「输出头（head）」。其参数效率堪称一次启示。

结果是：在 18 个月内，BERT 及其变体（RoBERTa、ALBERT、ELECTRA）统治了当时存在的每一个 NLP 排行榜。到 2020 年，地球上每一个搜索引擎、内容审核管线和语义检索系统内部都装着一个 BERT。

到 2026 年，「仅编码器（encoder-only）」模型仍是分类、检索和结构化抽取的正确工具——它们每个 token 的运行速度比解码器快 5–10 倍，其嵌入是每一套现代检索栈的支柱。ModernBERT（2024 年 12 月）借助 Flash Attention + RoPE + GeGLU，将该架构的上下文长度推进到了 8K。

## 核心概念

〔图：掩码语言建模——选取 token、掩盖它们、预测原词〕

### 训练信号

取一个句子：`the quick brown fox jumps over the lazy dog`。

随机掩盖 15% 的 token：

```
input:  the [MASK] brown fox jumps [MASK] the lazy dog
target: the  quick brown fox jumps  over  the lazy dog
```

训练模型在被掩盖的位置预测原始 token。由于编码器是双向的，预测位置 1 处的 `[MASK]` 可以利用位置 2 及之后的 `brown fox jumps`。这正是 GPT 做不到的事。

### BERT 的掩码规则

在被选中用于预测的那 15% 的 token 中：

- 80% 被替换为 `[MASK]`。
- 10% 被替换为一个随机 token。
- 10% 保持原样不变。

为什么不总是用 `[MASK]`？因为 `[MASK]` 在推理时从不出现。如果训练时让模型在 100% 的被掩盖位置都期待 `[MASK]`，就会在预训练和微调之间制造「分布偏移（distribution shift）」。那 10% 随机替换 + 10% 保持不变的做法让模型保持「诚实」。

### 下一句预测（NSP）——以及它为何被弃用

最初的 BERT 还在「下一句预测（Next Sentence Prediction，NSP）」上训练：给定两个句子 A 和 B，预测 B 是否紧接在 A 之后。RoBERTa（2019）通过消融实验证明 NSP 有害无益。现代编码器都跳过了它。

### 2026 年的变化：ModernBERT

2024 年的 ModernBERT 论文用 2026 年的基础组件重建了 Transformer 块：

| 组件 | 原始 BERT（2018） | ModernBERT（2024） |
|-----------|----------------------|-------------------|
| 位置编码 | 可学习的绝对位置 | RoPE |
| 激活函数 | GELU | GeGLU |
| 归一化 | LayerNorm | Pre-norm RMSNorm |
| 注意力 | 全稠密注意力 | 交替的局部（128）+ 全局 |
| 上下文长度 | 512 | 8192 |
| 分词器 | WordPiece | BPE |

而且与 2018 年的技术栈不同，它是「Flash-Attention 原生（Flash-Attention-native）」的。在序列长度 8K 下，其推理速度比 DeBERTa-v3 快 2–3 倍，且 GLUE 得分更高。

### 2026 年仍会选用编码器的应用场景

| 任务 | 为何编码器胜过解码器 |
|------|---------------------------|
| 检索 / 语义搜索的嵌入 | 双向上下文 = 每个 token 的嵌入质量更优 |
| 分类（情感、意图、毒性） | 一次前向传播；没有生成开销 |
| NER / token 标注 | 逐位置输出，天然双向 |
| 零样本蕴含（NLI） | 在编码器之上加一个分类头 |
| RAG 的重排器 | 交叉编码器打分，比 LLM 重排器快 10 倍 |

## 动手构建

### 第 1 步：掩码逻辑

参见 `code/main.py`。函数 `create_mlm_batch` 接收一个 token ID 列表、一个词表大小和一个掩码概率。返回 input IDs（已应用掩码）和 labels（仅在被掩盖位置有值，其余处为 -100——这是 PyTorch 的忽略索引约定）。

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
            # else: 保持原样
    return input_ids, labels
```

### 第 2 步：在微型语料上运行 MLM 预测

在一个含 20 个词的词表、200 个句子上训练一个 2 层编码器 + MLM 头。无梯度——我们做的是前向传播的健全性检查。完整训练需要 PyTorch。

### 第 3 步：对比掩码类型

展示三路规则如何让模型在没有 `[MASK]` 的情况下依然可用。分别在一个未掩盖的句子和一个被掩盖的句子上做预测。两者都应产生合理的 token 分布，因为模型在训练中两种模式都见过。

### 第 4 步：微调输出头

在一个玩具情感数据集上，用一个分类头替换掉 MLM 头。只有这个头参与训练；编码器被冻结。这正是每个 BERT 应用都遵循的模式。

## 上手使用

```python
from transformers import AutoModel, AutoTokenizer

tok = AutoTokenizer.from_pretrained("answerdotai/ModernBERT-base")
model = AutoModel.from_pretrained("answerdotai/ModernBERT-base")

text = "Attention is all you need."
inputs = tok(text, return_tensors="pt")
out = model(**inputs).last_hidden_state   # (1, N, 768)
```

**嵌入模型就是微调后的 BERT。** 像 `all-MiniLM-L6-v2` 这样的 `sentence-transformers` 模型，是用「对比损失（contrastive loss）」训练出来的 BERT。编码器是同一个，变的是损失函数。

**交叉编码器重排器也是微调后的 BERT。** 在 `[CLS] query [SEP] doc [SEP]` 上做成对分类。query 与 doc 之间的双向注意力，正是交叉编码器相对双编码器的质量优势所在。

**2026 年何时不该选 BERT。** 任何生成类任务。编码器没有合理的方式来自回归地产生 token。此外：任何参数量低于 1B 的场景——此时一个小型解码器能以更高的灵活性匹敌其质量（Phi-3-Mini、Qwen2-1.5B）。

## 交付落地

参见 `outputs/skill-bert-finetuner.md`。该技能为一项新的分类或抽取任务界定一次 BERT 微调的范围（骨干网络选择、输出头规格、数据、评估、停止条件）。

## 练习

1. **简单。** 运行 `code/main.py`，打印 10,000 个 token 上的掩码分布。确认约 15% 被选中，且其中约 80% 变成了 `[MASK]`。
2. **中等。** 实现「整词掩码（whole-word masking）」：如果一个词被分成多个子词，要么把所有子词一起掩盖，要么一个都不掩。在一个 500 句的语料上衡量这是否提升了 MLM 准确率。
3. **困难。** 在一个公开数据集的 10,000 个句子上训练一个微型（2 层，d=64）BERT。在 SST-2 情感任务上微调 `[CLS]` token。在参数量相当的条件下与一个仅解码器基线对比——谁会胜出？

## 关键术语

| 术语 | 人们怎么说 | 它实际指什么 |
|------|-----------------|-----------------------|
| MLM | 「掩码语言建模」 | 训练信号：随机将 15% 的 token 替换为 `[MASK]`，预测原词。 |
| 双向 | 「双向都看」 | 编码器注意力没有因果掩码——每个位置都能看到其他每个位置。 |
| `[CLS]` | 「池化 token」 | 加在每个序列开头的特殊 token；其最终嵌入被用作句子级表示。 |
| `[SEP]` | 「段分隔符」 | 分隔成对的序列（如 query/doc、句子 A/B）。 |
| NSP | 「下一句预测」 | BERT 的第二个预训练任务；在 RoBERTa 中被证明无用，2019 年后弃用。 |
| 微调 | 「适配到某个任务」 | 大体冻结编码器；在其上为下游任务训练一个小的输出头。 |
| 交叉编码器 | 「一个重排器」 | 一个同时接收 query 和 doc 作为输入、输出相关性得分的 BERT。 |
| ModernBERT | 「2024 年的翻新版」 | 用 RoPE、RMSNorm、GeGLU、交替的局部/全局注意力、8K 上下文重建的编码器。 |

## 延伸阅读

- [Devlin et al. (2018). BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding](https://arxiv.org/abs/1810.04805) —— 原始论文。
- [Liu et al. (2019). RoBERTa: A Robustly Optimized BERT Pretraining Approach](https://arxiv.org/abs/1907.11692) —— 如何正确训练 BERT；干掉了 NSP。
- [Clark et al. (2020). ELECTRA: Pre-training Text Encoders as Discriminators Rather Than Generators](https://arxiv.org/abs/2003.10555) —— 在算力相当的条件下，「被替换 token 检测」胜过 MLM。
- [Warner et al. (2024). Smarter, Better, Faster, Longer: A Modern Bidirectional Encoder](https://arxiv.org/abs/2412.13663) —— ModernBERT 论文。
- [HuggingFace `modeling_bert.py`](https://github.com/huggingface/transformers/blob/main/src/transformers/models/bert/modeling_bert.py) —— 权威的编码器参考实现。
