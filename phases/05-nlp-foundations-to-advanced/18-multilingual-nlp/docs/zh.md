# 多语言 NLP（Multilingual NLP）

> 一个模型，100+种语言，其中大多数语言零训练数据。跨语言迁移（Cross-lingual transfer）是2020年代实用的奇迹。

**类型：** 学习
**语言：** Python
**先决条件：** 阶段5 · 04（GloVe、FastText、子词（Subword）），阶段5 · 11（机器翻译（Machine Translation））
**时间：** ~45分钟

## 问题所在

英语有数十亿个标注样本。乌尔都语有数千个。迈蒂利语几乎没有。任何服务于全球受众的实用NLP系统都必须处理那些没有任务特定训练数据的语言长尾。

多语言模型通过同时训练一个模型在多种语言上解决这一问题。共享表示让模型能够将在高资源语言中学到的技能迁移到低资源语言。在英语情感分析上微调模型，它在乌尔都语上开箱即用地产生了令人惊讶的良好情感预测。这就是零样本跨语言迁移（Zero-shot cross-lingual transfer），它重塑了NLP面向世界交付的方式。

本课程列举了权衡、经典模型以及一个让初次从事多语言工作的团队陷入困境的关键决策：为迁移选择源语言（Source language）。

## 概念

![通过共享多语言嵌入空间进行跨语言迁移](../assets/multilingual.svg)

**共享词汇表（Shared vocabulary）。** 多语言模型使用一个在来自所有目标语言的文本上训练的SentencePiece或WordPiece分词器。词汇表是共享的：相同的子词单元表示相关语言中相同的语素。英语和意大利语中的`anti-`获得相同的token。

**共享表示（Shared representation）。** 一个预训练了掩码语言建模（Masked Language Modeling）的transformer在许多语言上学习到：不同语言中语义相似的句子会产生相似的隐藏状态。mBERT、XLM-R和NLLB都展现出这一特性。英语中"cat"的嵌入与法语中"chat"和西班牙语中"gato"的嵌入聚集在一起，完整句子的嵌入也是如此。

**零样本迁移（Zero-shot transfer）。** 在一种语言（通常是英语）的标注数据上微调模型。推理时，在模型支持的任何其他语言上运行。不需要目标语言标签。对于类型学上相近的语言，结果很强；对于相距较远的语言，结果较弱。

**少样本微调（Few-shot fine-tuning）。** 在目标语言中添加100-500个标注样本。在分类任务上，准确率跃升至英文基线的95-98%。这是多语言NLP中性价比最高的杠杆。

## 模型

| 模型 | 年份 | 覆盖范围 | 备注 |
|------|------|----------|------|
| mBERT | 2018 | 104种语言 | 在维基百科上训练。第一个实用的多语言LM。低资源语言上弱。 |
| XLM-R | 2019 | 100种语言 | 在CommonCrawl上训练（比维基百科大得多）。设定跨语言基线。Base 270M，Large 550M。 |
| XLM-V | 2023 | 100种语言 | XLM-R，词汇表1M tokens（相对于250k）。在低资源语言上更好。 |
| mT5 | 2020 | 101种语言 | 用于多语言生成的T5架构。 |
| NLLB-200 | 2022 | 200种语言 | Meta的翻译模型；包含55种低资源语言。 |
| BLOOM | 2022 | 46种语言 + 13种编程语言 | 以多语言方式训练的开源176B LLM。 |
| Aya-23 | 2024 | 23种语言 | Cohere的多语言LLM。在阿拉伯语、印地语、斯瓦希里语上表现强劲。 |

根据使用场景选择。分类任务使用XLM-R-base作为合理的默认选择。生成任务根据翻译还是开放式生成，选择mT5或NLLB。LLM风格的工作与Aya-23或Claude配合，使用明确的多语言提示。

## 源语言决策（2026年研究）

大多数团队默认使用英语作为微调源语言。近期的研究（2026）表明这通常是错误的。

语言相似性比原始语料库规模更能预测迁移质量。对于斯拉夫语族目标，德语或俄语通常优于英语。对于印度语族目标，印地语通常优于英语。**qWALS** 相似性度量（2026，基于《世界语言结构图集》特征）量化了这一点。**LANGRANK**（Lin等人，ACL 2019）是一种独立的、更早的方法，它根据语言相似性、语料库规模和遗传关系等组合对候选源语言进行排名。

实用规则：如果你的目标语言有一个类型学上相近的高资源亲属，尝试先在该语言上进行微调，然后与英语微调进行比较。

## 动手构建

### 步骤1：零样本跨语言分类

```python
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import torch

tok = AutoTokenizer.from_pretrained("joeddav/xlm-roberta-large-xnli")
model = AutoModelForSequenceClassification.from_pretrained("joeddav/xlm-roberta-large-xnli")


def classify(text, candidate_labels, hypothesis_template="本段文字关于 {}。"):
    scores = {}
    for label in candidate_labels:
        hypothesis = hypothesis_template.format(label)
        inputs = tok(text, hypothesis, return_tensors="pt", truncation=True)
        with torch.no_grad():
            logits = model(**inputs).logits[0]
        entail_score = torch.softmax(logits, dim=-1)[2].item()
        scores[label] = entail_score
    return dict(sorted(scores.items(), key=lambda x: -x[1]))


print(classify("I love this product!", ["positive", "negative", "neutral"]))
print(classify("मुझे यह उत्पाद पसंद है!", ["positive", "negative", "neutral"]))
print(classify("J'adore ce produit !", ["positive", "negative", "neutral"]))
```

一个模型，三种语言，相同的API。在NLI数据上训练的XLM-R通过蕴含技巧（entailment trick）很好地迁移到分类任务。

### 步骤2：多语言嵌入空间

```python
from sentence_transformers import SentenceTransformer
import numpy as np

model = SentenceTransformer("sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2")

pairs = [
    ("The cat is sleeping.", "Le chat dort."),
    ("The cat is sleeping.", "El gato está durmiendo."),
    ("The cat is sleeping.", "Die Katze schläft."),
    ("The cat is sleeping.", "The dog is barking."),
]

for eng, other in pairs:
    emb_eng = model.encode([eng], normalize_embeddings=True)[0]
    emb_other = model.encode([other], normalize_embeddings=True)[0]
    sim = float(np.dot(emb_eng, emb_other))
    print(f"  {eng!r} <-> {other!r}: cos={sim:.3f}")
```

翻译在嵌入空间中彼此靠近。一个不同的英语句子则距离更远。这就是跨语言检索、聚类和相似性得以工作的基础。

### 步骤3：少样本微调策略

```python
from transformers import TrainingArguments, Trainer
from datasets import Dataset


def few_shot_finetune(base_model, base_tokenizer, examples):
    ds = Dataset.from_list(examples)

    def tokenize_fn(ex):
        out = base_tokenizer(ex["text"], truncation=True, max_length=128)
        out["labels"] = ex["label"]
        return out

    ds = ds.map(tokenize_fn)
    args = TrainingArguments(
        output_dir="out",
        per_device_train_batch_size=8,
        num_train_epochs=5,
        learning_rate=2e-5,
        save_strategy="no",
    )
    trainer = Trainer(model=base_model, args=args, train_dataset=ds)
    trainer.train()
    return base_model
```

对于100-500个目标语言样本，`num_train_epochs=5`和`learning_rate=2e-5`是安全默认值。更高的学习率会导致多语言对齐崩溃，你只会得到一个仅限英语的模型。

## 真正有效的评估

- **在每个语言保留集上的逐语言准确率。** 不要聚合。聚合会隐藏长尾问题。
- **与单语言基线对比。** 对于数据充足的语言，从头开始训练的单语言模型有时会击败多语言模型。要进行测试。
- **实体级测试。** 目标语言中的命名实体。多语言模型对于远离拉丁字母的文字通常具有弱分词能力。
- **跨语言一致性。** 两种语言中相同的含义应产生相同的预测。衡量差距。

## 使用它

2026年技术栈：

| 任务 | 推荐 |
|-----|------|
| 分类，100种语言 | XLM-R-base（~270M）微调版 |
| 零样本文本分类 | `joeddav/xlm-roberta-large-xnli` |
| 多语言句子嵌入 | `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` |
| 翻译，200种语言 | `facebook/nllb-200-distilled-600M`（见第11课） |
| 生成式多语言 | Claude、GPT-4、Aya-23、mT5-XXL |
| 低资源语言NLP | XLM-V 或对相关高资源语言进行领域特定微调 |

如果性能重要，始终为目标语言微调预留预算。零样本只是一个起点，不是最终答案。

### 分词代价（低资源语言的问题所在）

多语言模型在所有语言之间共享一个分词器。该词汇表是在以英语、法语、西班牙语、中文、德语为主的语料库上训练的。对于任何不属于主导集合的语言，有三个代价会无声地累积：

- **生育代价（Fertility tax）。** 低资源语言文本分词后，每个词的token数量远多于英语。一个印地语句子所需token可能是等效英语句子的3-5倍。这3-5倍会消耗你的上下文窗口、训练效率和延迟。
- **变体恢复代价（Variant recovery tax）。** 每一个拼写错误、变音符号变体、Unicode归一化不匹配或大小写变化，都会在嵌入空间中变成一个冷启动的不相关序列。模型无法学习母语者认为显而易见的正字法对应关系。
- **容量溢出代价（Capacity spillover tax）。** 代价1和2消耗了上下文位置、层深度和嵌入维度。留给实际推理的空间系统地小于高资源语言从同一模型中获得的。

实际症状：你的模型在印地语上正常训练，损失曲线看起来正确，评估困惑度看起来很合理，但生产输出却在微妙地出错。形态学在句子中间崩溃。罕见的屈折变化仍然无法恢复。**你无法通过增加数据量来解决一个破损的分词器。**

缓解措施：选择一个对你的目标语言有良好覆盖的分词器（XLM-V的100万token词汇表是一个直接修复）；在训练前，在保留的目标文本上验证分词生育度；对于真正长尾的文字，使用字节级回退（SentencePiece `byte_fallback=True`、GPT-2风格的字节级BPE），这样就不会有任何OOV。

## 交付它

保存为 `outputs/skill-multilingual-picker.md`：

```markdown
---
name: multilingual-picker
description: 为多语言NLP任务选择源语言、目标模型和评估计划。
version: 1.0.0
phase: 5
lesson: 18
tags: [nlp, multilingual, cross-lingual]
---

给定需求（目标语言、任务类型、每种语言可用的标注数据），输出：

1. 用于微调的源语言。默认英语；如果目标语言有类型学上相近的高资源语言，检查LANGRANK或qWALS。
2. 基础模型。XLM-R（分类）、mT5（生成）、NLLB（翻译）、Aya-23（生成式LLM）。
3. 少样本预算。如果可能，从100-500个目标语言样本开始。仅当标注不可行时才使用零样本。
4. 评估计划。逐语言准确率（不是聚合）、跨语言一致性、非拉丁文字上的实体级F1。

拒绝交付没有逐语言评估的多语言模型——汇总指标会隐藏长尾失败。标记分词覆盖较低的文字（阿姆哈拉语、提格利尼亚语、许多非洲语言）为需要具有字节回退的模型（SentencePiece with byte_fallback=True，或类似GPT-2的字节级分词器）。
```

## 练习

1. **简单。** 在英语、法语、印地语和阿拉伯语上，每种语言运行10个句子的零样本分类流程。报告每种语言的准确率。你应该会看到法语很强、印地语一般、阿拉伯语波动。
2. **中等。** 使用`paraphrase-multilingual-MiniLM-L12-v2`在一个小型混合语言语料库上构建一个跨语言检索器。用英文查询，检索任何语言的文档。测量recall@5。
3. **困难。** 针对印地语分类任务，比较英语源和印地语源的微调效果。在两种方案下，使用500个目标语言样本进行少样本微调。报告哪种源会产生更好的印地语准确率以及高出多少。这就是LANGRANK论点的微缩版。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------|----------|
| 多语言模型（Multilingual model） | 一个模型，多种语言 | 跨语言共享词汇表和参数。 |
| 跨语言迁移（Cross-lingual transfer） | 在一种语言上训练，在另一种语言上运行 | 在源语言上微调，在目标语言上评估，无需目标语言标签。 |
| 零样本（Zero-shot） | 没有目标语言标签 | 无需在目标语言上进行微调的迁移。 |
| 少样本（Few-shot） | 少量目标标签 | 使用100-500个目标语言样本进行微调。 |
| mBERT | 第一个多语言LM | 104种语言，在维基百科上预训练的BERT。 |
| XLM-R | 标准跨语言基线 | 100种语言，在CommonCrawl上预训练的RoBERTa。 |
| NLLB | Meta的200种语言机器翻译 | 不让任何语言掉队（No Language Left Behind）。包含55种低资源语言。 |

## 延伸阅读

- [Conneau et al. (2019). Unsupervised Cross-lingual Representation Learning at Scale](https://arxiv.org/abs/1911.02116) —— XLM-R论文。
- [Pires, Schlinger, Garrette (2019). How Multilingual is Multilingual BERT?](https://arxiv.org/abs/1906.01502) —— 开启了跨语言迁移研究路线的分析论文。
- [Costa-jussà et al. (2022). No Language Left Behind](https://arxiv.org/abs/2207.04672) —— NLLB-200论文。
- [Üstün et al. (2024). Aya Model: An Instruction Finetuned Open-Access Multilingual Language Model](https://arxiv.org/abs/2402.07827) —— Aya，Cohere的多语言LLM。
- [Language Similarity Predicts Cross-Lingual Transfer Learning Performance (2026)](https://www.mdpi.com/2504-4990/8/3/65) —— qWALS / LANGRANK源语言的论文。