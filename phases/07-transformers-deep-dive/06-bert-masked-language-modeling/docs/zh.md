# BERT — 掩码语言建模（Masked Language Modeling）

> GPT 预测下一个词。BERT 预测缺失的词。一句话的差异——却带来了半个世纪的嵌入形态变革。

**类型：** 构建（Build）
**编程语言：** Python
**前置知识：** 阶段 7 · 05（完整 Transformer），阶段 5 · 02（文本表示）
**预计时间：** ~45 分钟

## 问题

2018 年，每一个 NLP 任务——情感分析、命名实体识别（NER）、问答（QA）、文本蕴含——都使用自己的标注数据从头训练自己的模型。那时还没有一个预训练好的“理解英语”检查点可以直接微调。ELMo（2018）展示了可以用双向 LSTM 预训练上下文嵌入；这虽有帮助，但未能泛化。

BERT（Devlin 等人，2018）提出：如果我们采用 Transformer 编码器，在互联网上的每个句子上训练它，并强制它根据上下文（两侧）预测缺失的词，会怎样？然后在下游任务上微调一个输出头。参数效率令人惊叹。

结果：18 个月内，BERT 及其变体（RoBERTa、ALBERT、ELECTRA）主导了所有存在的 NLP 排行榜。到 2020 年，地球上的每个搜索引擎、内容审核管道和语义搜索系统中都藏着一个 BERT。

在 2026 年，编码器专用模型仍然是分类、检索和结构化提取的正确工具——它们每 token 的运行速度比解码器快 5–10 倍，并且它们的嵌入是现代每个检索栈的骨干。ModernBERT（2024 年 12 月）将该架构扩展到 8K 上下文，采用了 Flash Attention + RoPE + GeGLU。

## 概念

![掩码语言建模：选取 token，掩码，预测原文](../assets/bert-mlm.svg)

### 训练信号

取一个句子：`the quick brown fox jumps over the lazy dog`。

随机掩码 15% 的 token：

```
输入：  the [MASK] brown fox jumps [MASK] the lazy dog
目标：  the  quick brown fox jumps  over  the lazy dog
```

训练模型预测掩码位置处的原始 token。由于编码器是双向的，预测位置 1 的 `[MASK]` 可以使用位置 2 及之后的 `brown fox jumps`。这正是 GPT 做不到的事情。

### BERT 掩码规则

在选中的 15% 的 token 中：

- 80% 替换为 `[MASK]`。
- 10% 替换为随机 token。
- 10% 保持不变。

为什么不是始终用 `[MASK]`？因为在推理时 `[MASK]` 永远不会出现。如果训练模型在 100% 的掩码位置都期望 `[MASK]`，就会在预训练和微调之间造成分布偏移。10% 随机 + 10% 保持不变能让模型保持诚实。

### 下一句预测（Next Sentence Prediction, NSP）——以及为何被舍弃

原始 BERT 还在 NSP 上训练：给定两个句子 A 和 B，预测 B 是否紧接 A 之后。RoBERTa（2019）消融实验表明 NSP 有害无益。现代编码器已弃用。

### 2026 年的变化：ModernBERT

2024 年的 ModernBERT 论文用 2026 年的原语重建了块结构：

| 组件 | 原始 BERT (2018) | ModernBERT (2024) |
|-----------|----------------------|-------------------|
| 位置编码 | 可学习绝对位置 | RoPE |
| 激活函数 | GELU | GeGLU |
| 归一化 | LayerNorm | 预归一化 RMSNorm |
| 注意力 | 全密集 | 交替局部 (128) + 全局 |
| 上下文长度 | 512 | 8192 |
| 分词器 | WordPiece | BPE |

与 2018 年的栈不同，它原生支持 Flash Attention。在序列长度 8K 下，推理速度是 DeBERTa-v3 的 2–3 倍，且 GLUE 得分更高。

### 2026 年仍选择编码器的用例

| 任务 | 编码器为何优于解码器 |
|------|---------------------------|
| 检索 / 语义搜索嵌入 | 双向上下文 = 每个 token 的嵌入质量更高 |
| 分类（情感、意图、毒性） | 一次前向传播；无生成开销 |
| 命名实体识别 / token 标注 | 每个位置输出，天然双向 |
| 零样本蕴含（NLI） | 编码器之上的分类器头 |
| RAG 的重排序器 | 交叉编码器评分，比 LLM 重排序器快 10 倍 |

## 构建项目

### 步骤 1：掩码逻辑

见 `code/main.py`。函数 `create_mlm_batch` 接收一组 token ID、词汇表大小和掩码概率。返回输入 ID（已应用掩码）和标签（仅在掩码位置有值，其余为 -100——PyTorch 的忽略索引约定）。

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
            # else: 保留原始
    return input_ids, labels
```

### 步骤 2：在小型语料库上运行 MLM 预测

在包含 20 个单词、200 个句子的词汇表上训练一个 2 层编码器 + MLM 头。不需要梯度——我们做前向传播的正确性检查。完整训练需要 PyTorch。

### 步骤 3：比较掩码类型

展示三种掩码规则如何使模型在没有 `[MASK]` 的情况下仍然可用。在未掩码的句子和掩码的句子上都进行预测。由于模型在训练中同时看到了两种模式，两者都应产生合理的 token 分布。

### 步骤 4：微调输出头

在一个玩具情感数据集上，将 MLM 头替换为分类头。只训练头；编码器冻结。这是所有 BERT 应用遵循的模式。

## 使用

```python
from transformers import AutoModel, AutoTokenizer

tok = AutoTokenizer.from_pretrained("answerdotai/ModernBERT-base")
model = AutoModel.from_pretrained("answerdotai/ModernBERT-base")

text = "Attention is all you need."
inputs = tok(text, return_tensors="pt")
out = model(**inputs).last_hidden_state   # (1, N, 768)
```

**嵌入模型是微调过的 BERT。** 像 `all-MiniLM-L6-v2` 这样的 `sentence-transformers` 模型是用对比损失训练的 BERT。编码器相同，损失函数变了。

**交叉编码器重排序器也是微调过的 BERT。** 在 `[CLS] query [SEP] doc [SEP]` 上进行对分类。查询和文档之间的双向注意力正是交叉编码器质量优于双编码器的原因。

**2026 年何时不应选择 BERT。** 任何生成任务。编码器没有合理的方式来自回归生成 token。此外，任何参数少于 1B 的场景中，小型解码器可以以更多灵活性达到相同质量（如 Phi-3-Mini、Qwen2-1.5B）。

## 交付

见 `outputs/skill-bert-finetuner.md`。该技能定义了针对新分类或提取任务的 BERT 微调范围（骨干选择、输出头规格、数据、评估、停止条件）。

## 练习

1. **简单。** 运行 `code/main.py`，打印 10,000 个 token 上的掩码分布。确认约 15% 被选中，其中约 80% 变为 `[MASK]`。
2. **中等。** 实现整词掩码：如果一个词被切分成多个子词，要么全部掩码，要么都不掩码。测量这在 500 句语料上是否提升了 MLM 准确率。
3. **困难。** 在来自公开数据集的 10,000 个句子上训练一个微型 BERT（2 层，d=64）。针对 SST-2 情感分类微调 `[CLS]` token。与参数匹配的解码器基线对比——谁胜出？

## 关键术语

| 术语 | 人们说的 | 实际含义 |
|------|-----------------|-----------------------|
| MLM | “掩码语言建模” | 训练信号：随机用 `[MASK]` 替换 15% 的 token，预测原始 token。 |
| 双向（Bidirectional） | “看两边” | 编码器注意力没有因果掩码——每个位置能看到所有其他位置。 |
| `[CLS]` | “汇聚 token” | 一个特殊 token，添加到每个序列的开头；其最终嵌入用作句子级表示。 |
| `[SEP]` | “分隔符” | 分隔成对序列（例如 query/doc、句子 A/B）。 |
| NSP | “下一句预测” | BERT 的第二个预训练任务；RoBERTa 证明其无用，2019 年后被弃用。 |
| 微调（Fine-tuning） | “适应任务” | 保持编码器基本冻结；在其上训练一个小型输出头用于下游任务。 |
| 交叉编码器（Cross-encoder） | “重排序器” | 一个 BERT，将查询和文档同时作为输入，输出相关性得分。 |
| ModernBERT | “2024 年刷新” | 使用 RoPE、RMSNorm、GeGLU、交替局部/全局注意力、8K 上下文重建的编码器。 |

## 延伸阅读

- [Devlin et al. (2018). BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding](https://arxiv.org/abs/1810.04805) — 原始论文。
- [Liu et al. (2019). RoBERTa: A Robustly Optimized BERT Pretraining Approach](https://arxiv.org/abs/1907.11692) — 如何正确训练 BERT；弃用 NSP。
- [Clark et al. (2020). ELECTRA: Pre-training Text Encoders as Discriminators Rather Than Generators](https://arxiv.org/abs/2003.10555) — 替换 token 检测在同等计算量下优于 MLM。
- [Warner et al. (2024). Smarter, Better, Faster, Longer: A Modern Bidirectional Encoder](https://arxiv.org/abs/2412.13663) — ModernBERT 论文。
- [HuggingFace `modeling_bert.py`](https://github.com/huggingface/transformers/blob/main/src/transformers/models/bert/modeling_bert.py) — 权威编码器参考。