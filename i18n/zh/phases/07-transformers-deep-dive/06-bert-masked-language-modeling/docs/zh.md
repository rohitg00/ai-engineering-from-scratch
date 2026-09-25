# BERT — 掩码语言建模

> GPT 预测下一个词。BERT 预测缺失的词。一句话的差别——却带来了此后五年间所有与嵌入相关的变革。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 7 · 05（完整 Transformer）、Phase 5 · 02（文本表示）
**Time:** ~45 分钟

## 问题所在

2018 年，每个 NLP 任务——情感分析、命名实体识别、问答、蕴含——都在自己的标注数据上从头训练自己的模型。不存在一个可以微调的、预训练好的"理解英语"检查点。ELMo（2018）证明了可以用双向 LSTM 预训练上下文相关的嵌入；它有帮助，但无法泛化。

BERT（Devlin 等人，2018）提出了这样的问题：如果我们取一个 transformer 编码器，用互联网上的所有句子训练它，并强迫它根据两侧的上下文预测缺失的词，会怎样？然后你只需在下游任务上微调一个头。参数效率带来的震撼是革命性的。

结果：在 18 个月内，BERT 及其变体（RoBERTa、ALBERT、ELECTRA）统治了当时存在的所有 NLP 排行榜。到 2020 年，地球上每个搜索引擎、内容审核流水线和语义检索系统内部都有一个 BERT。

在 2026 年，encoder-only 模型仍然是分类、检索和结构化抽取的正确工具——它们每个 token 的运行速度比 decoder 快 5–10 倍，而且它们的嵌入是每个现代检索技术栈的支柱。ModernBERT（2024 年 12 月）通过 Flash Attention + RoPE + GeGLU 将该架构推到了 8K 上下文。

## 核心概念

![Masked language modeling: pick tokens, mask them, predict originals](../assets/bert-mlm.svg)

### 训练信号

取一个句子：`the quick brown fox jumps over the lazy dog`。

随机掩码 15% 的 token：

```
input:  the [MASK] brown fox jumps [MASK] the lazy dog
target: the  quick brown fox jumps  over  the lazy dog
```

训练模型在掩码位置预测原始 token。因为编码器是双向的，在位置 1 预测 `[MASK]` 时可以使用位置 2 及之后的 `brown fox jumps`。这正是 GPT 做不到的事。

### BERT 的掩码规则

在被选中进行预测的 15% token 中：

- 80% 被替换为 `[MASK]`。
- 10% 被替换为随机 token。
- 10% 保持不变。

为什么不总是用 `[MASK]`？因为 `[MASK]` 在推理时从不出现。如果训练模型在 100% 的掩码位置都期望看到 `[MASK]`，会在预训练和微调之间制造分布偏移。10% 随机 + 10% 不变可以让模型保持"诚实"。

### 下一句预测（NSP）——以及它为何被抛弃

原始 BERT 还在 NSP 上训练：给定两个句子 A 和 B，预测 B 是否紧跟 A。RoBERTa（2019）对其做了消融实验，表明 NSP 有害无益。现代编码器都跳过了它。

### 2026 年的变化：ModernBERT

2024 年的 ModernBERT 论文用 2026 年的组件重建了整个 block：

| 组件 | 原始 BERT（2018） | ModernBERT（2024） |
|-----------|----------------------|-------------------|
| 位置编码 | 学习式绝对位置 | RoPE |
| 激活函数 | GELU | GeGLU |
| 归一化 | LayerNorm | Pre-norm RMSNorm |
| 注意力 | 全密集 | 交替的局部（128）+ 全局 |
| 上下文长度 | 512 | 8192 |
| 分词器 | WordPiece | BPE |

而且与 2018 年的技术栈不同，它是 Flash-Attention 原生的。在序列长度 8K 下，其推理速度比 DeBERTa-v3 快 2–3 倍，同时 GLUE 分数更高。

### 2026 年仍然选择编码器的使用场景

| 任务 | 编码器胜过解码器的原因 |
|------|---------------------------|
| 检索 / 语义搜索嵌入 | 双向上下文 = 每个 token 的嵌入质量更高 |
| 分类（情感、意图、毒性） | 一次前向传播；无生成开销 |
| NER / token 标注 | 逐位置输出，天然双向 |
| 零样本蕴含（NLI） | 在编码器之上加分类头 |
| RAG 的重排序器 | 交叉编码器打分，比 LLM 重排序器快 10 倍 |

```figure
transformer-residual
```

## 动手构建

### 第 1 步：掩码逻辑

参见 `code/main.py`。函数 `create_mlm_batch` 接收一个 token ID 列表、词表大小和掩码概率。返回输入 ID（已应用掩码）和标签（仅在掩码位置，其余为 -100——这是 PyTorch 的忽略索引约定）。

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

### 第 2 步：在微型语料库上运行 MLM 预测

在一个 20 个词的词表、200 个句子上训练一个 2 层编码器 + MLM 头。不做梯度更新——我们只做前向传播的健全性检查。完整训练需要 PyTorch。

### 第 3 步：比较掩码类型

展示三路规则如何在没有 `[MASK]` 的情况下保持模型可用。分别在未掩码句子和掩码句子上做预测。两者都应产生合理的 token 分布，因为模型在训练中见过这两种模式。

### 第 4 步：微调分类头

将 MLM 头替换为分类头，在一个玩具情感数据集上训练。只训练头；编码器冻结。这就是每个 BERT 应用遵循的模式。

## 实际应用

```python
from transformers import AutoModel, AutoTokenizer

tok = AutoTokenizer.from_pretrained("answerdotai/ModernBERT-base")
model = AutoModel.from_pretrained("answerdotai/ModernBERT-base")

text = "Attention is all you need."
inputs = tok(text, return_tensors="pt")
out = model(**inputs).last_hidden_state   # (1, N, 768)
```

**嵌入模型就是微调过的 BERT。**像 `all-MiniLM-L6-v2` 这样的 `sentence-transformers` 模型是用对比损失训练的 BERT。编码器相同。损失函数变了。

**交叉编码器重排序器也是微调过的 BERT。**在 `[CLS] query [SEP] doc [SEP]` 上做配对分类。查询与文档之间的双向注意力，正是交叉编码器相比双编码器拥有质量优势的原因。

**2026 年何时不应选择 BERT。**任何生成式任务。编码器没有合理的自回归生成 token 的方式。还有：任何参数量在 1B 以下、小型解码器能以更高灵活性匹敌质量的场景（Phi-3-Mini、Qwen2-1.5B）。

## 上线部署

参见 `outputs/skill-bert-finetuner.md`。该技能为新的分类或抽取任务规划一次 BERT 微调（骨干选择、头规格、数据、评估、停止条件）。

## 练习

1. **简单。**运行 `code/main.py`，打印 10,000 个 token 上的掩码分布。确认约 15% 被选中，且其中约 80% 变成 `[MASK]`。
2. **中等。**实现整词掩码：如果一个词被分词为多个子词，则将所有子词一起掩码或都不掩码。测量这是否提升了 500 句语料库上的 MLM 准确率。
3. **困难。**在来自公开数据集的 10,000 个句子上训练一个微型（2 层，d=64）BERT。针对 SST-2 情感任务微调 `[CLS]` token。与参数量匹配的 decoder-only 基线比较——谁赢？

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|-----------------------|
| MLM | "掩码语言建模" | 训练信号：随机将 15% 的 token 替换为 `[MASK]`，预测原始 token。 |
| Bidirectional | "双向观察" | 编码器注意力没有因果掩码——每个位置可以看到所有其他位置。 |
| `[CLS]` | "池化 token" | 添加在每个序列开头的特殊 token；其最终嵌入被用作句子级表示。 |
| `[SEP]` | "分段分隔符" | 分隔成对的序列（如查询/文档、句子 A/B）。 |
| NSP | "下一句预测" | BERT 的第二个预训练任务；RoBERTa 证明其无用，2019 年后被弃用。 |
| Fine-tuning | "适配任务" | 编码器基本冻结；在其上为下游任务训练一个小头。 |
| Cross-encoder | "重排序器" | 一个同时接收查询和文档作为输入、输出相关性分数的 BERT。 |
| ModernBERT | "2024 年升级版" | 用 RoPE、RMSNorm、GeGLU、交替局部/全局注意力、8K 上下文重建的编码器。 |

## 延伸阅读

- [Devlin 等人（2018）。BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding](https://arxiv.org/abs/1810.04805) — 原始论文。
- [Liu 等人（2019）。RoBERTa: A Robustly Optimized BERT Pretraining Approach](https://arxiv.org/abs/1907.11692) — 如何正确训练 BERT；终结了 NSP。
- [Clark 等人（2020）。ELECTRA: Pre-training Text Encoders as Discriminators Rather Than Generators](https://arxiv.org/abs/2003.10555) — 在同等算力下，替换 token 检测胜过 MLM。
- [Warner 等人（2024）。Smarter, Better, Faster, Longer: A Modern Bidirectional Encoder](https://arxiv.org/abs/2412.13663) — ModernBERT 论文。
- [HuggingFace `modeling_bert.py`](https://github.com/huggingface/transformers/blob/main/src/transformers/models/bert/modeling_bert.py) — 权威的编码器参考。