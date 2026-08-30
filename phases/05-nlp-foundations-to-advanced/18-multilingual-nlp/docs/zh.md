# 18 · 多语言 NLP

> 一个模型，100+ 种语言，其中绝大多数语言零训练数据。跨语言迁移是 2020 年代真正落地的奇迹。

**类型：** 学习
**语言：** Python
**前置：** 第 5 阶段 · 04（GloVe、FastText、子词），第 5 阶段 · 11（机器翻译）
**时长：** 约 45 分钟

## 问题所在

英语有数十亿条带标注样本。乌尔都语只有数千条。迈蒂利语几乎没有。任何面向全球受众的实用 NLP 系统，都必须能在那些没有任务专用训练数据的「长尾语言」上工作。

多语言模型的解法是：用一个模型同时在多种语言上训练。共享的表示让模型能把在高资源语言上学到的能力，迁移到低资源语言上。在英语情感分析上微调模型，它对乌尔都语也能开箱即用地给出出人意料地好的情感预测。这就是「零样本跨语言迁移（zero-shot cross-lingual transfer）」，它重塑了 NLP 走向世界的方式。

本课会点明其中的权衡、几个经典模型，以及一个让多语言新手团队栽跟头的关键决策：为迁移挑选源语言（source language）。

## 核心概念

〔图：通过共享多语言嵌入空间实现跨语言迁移〕

**共享词表。** 多语言模型使用在所有目标语言文本上训练的 SentencePiece 或 WordPiece 分词器。词表是共享的：同一个子词单元在相关语言之间代表同一个词素。英语和意大利语中的 `anti-` 会得到同一个 token。

**共享表示。** 一个在多种语言上做掩码语言建模（masked language modeling）预训练的 transformer 会学到：不同语言中语义相似的句子会产生相似的隐藏状态。mBERT、XLM-R 和 NLLB 都表现出这一点。英语 "cat" 的嵌入会聚集在法语 "chat" 和西班牙语 "gato" 附近，整句嵌入同样如此。

**零样本迁移。** 在某一种语言（通常是英语）的带标注数据上微调模型。推理时，把它跑在模型支持的任何其他语言上。无需目标语言标注。对类型学上相近的语言效果很强，对差异较大的语言则较弱。

**少样本微调。** 在目标语言上加入 100-500 条带标注样本。在分类任务上，准确率会跃升到英语基线的 95-98%。这是多语言 NLP 中性价比最高的单一杠杆。

## 模型一览

| 模型 | 年份 | 覆盖范围 | 备注 |
|-------|------|----------|-------|
| mBERT | 2018 | 104 种语言 | 在 Wikipedia 上训练。第一个实用的多语言 LM。在低资源语言上较弱。 |
| XLM-R | 2019 | 100 种语言 | 在 CommonCrawl 上训练（比 Wikipedia 大得多）。确立了跨语言基线。Base 270M，Large 550M。 |
| XLM-V | 2023 | 100 种语言 | 词表为 100 万 token 的 XLM-R（对比 25 万）。在低资源语言上更好。 |
| mT5 | 2020 | 101 种语言 | 用于多语言生成的 T5 架构。 |
| NLLB-200 | 2022 | 200 种语言 | Meta 的翻译模型；包含 55 种低资源语言。 |
| BLOOM | 2022 | 46 种语言 + 13 种编程语言 | 多语言训练的开源 176B LLM。 |
| Aya-23 | 2024 | 23 种语言 | Cohere 的多语言 LLM。在阿拉伯语、印地语、斯瓦希里语上很强。 |

按用例选择。分类任务用 XLM-R-base 作为合理的默认值就很好。生成类任务则取决于是翻译还是开放式生成，选 mT5 或 NLLB。LLM 风格的工作搭配 Aya-23，或用显式多语言提示的 Claude。

## 源语言决策（2026 年研究）

大多数团队默认拿英语作为微调的源语言。近期研究（2026）表明这往往是错的。

语言相似度对迁移质量的预测能力，强于单纯的语料规模。对于斯拉夫语系的目标语言，德语或俄语往往胜过英语。对于印度语系（Indic）的目标语言，印地语往往胜过英语。**qWALS** 相似度度量（2026，基于世界语言结构地图集 World Atlas of Language Structures 的特征）对此进行了量化。**LANGRANK**（Lin 等人，ACL 2019）是一个独立且更早的方法，它综合语言相似度、语料规模和谱系亲缘关系，对候选源语言进行排名。

实用法则：如果你的目标语言有一个类型学上相近的高资源「亲戚」，先试着在那门语言上微调，再与英语微调做对比。

## 动手构建

### 第 1 步：零样本跨语言分类

```python
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import torch

tok = AutoTokenizer.from_pretrained("joeddav/xlm-roberta-large-xnli")
model = AutoModelForSequenceClassification.from_pretrained("joeddav/xlm-roberta-large-xnli")


def classify(text, candidate_labels, hypothesis_template="This text is about {}."):
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

一个模型，三种语言，同一套 API。在 NLI 数据上训练的 XLM-R，借助蕴含（entailment）技巧能很好地迁移到分类任务。

### 第 2 步：多语言嵌入空间

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

译文在嵌入空间中落得很近。一个不同的英语句子则落得更远。正是这一点让跨语言检索、聚类和相似度计算成为可能。

### 第 3 步：少样本微调策略

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

对于 100-500 条目标语言样本，`num_train_epochs=5` 和 `learning_rate=2e-5` 是安全的默认值。学习率过高会导致多语言对齐崩溃，最终你只会得到一个仅支持英语的模型。

## 真正有效的评估

- **在留出集上做逐语言准确率。** 不要做聚合。聚合会掩盖长尾。
- **与单语基线对比。** 对于数据足够的语言，从头训练的单语模型有时会胜过多语言模型。要测。
- **实体级测试。** 测目标语言中的命名实体。多语言模型对远离拉丁文字的书写系统往往分词能力较弱。
- **跨语言一致性。** 两种语言中表达相同含义时，应当产生相同的预测。要度量其差距。

## 应用它

2026 年的技术栈：

| 任务 | 推荐方案 |
|-----|-------------|
| 分类，100 种语言 | 微调后的 XLM-R-base（约 270M） |
| 零样本文本分类 | `joeddav/xlm-roberta-large-xnli` |
| 多语言句子嵌入 | `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` |
| 翻译，200 种语言 | `facebook/nllb-200-distilled-600M`（见第 11 课） |
| 生成式多语言 | Claude、GPT-4、Aya-23、mT5-XXL |
| 低资源语言 NLP | XLM-V，或在相关高资源语言上做领域专用微调 |

只要性能重要，永远要为目标语言的微调预留预算。零样本是起点，不是终点。

### 分词税（低资源语言会出什么问题）

多语言模型在其所有语言间共享同一个分词器。那个词表是在一个由英语、法语、西班牙语、中文、德语主导的语料上训练出来的。对于主导集合之外的任何语言，三种「税」会悄无声息地叠加：

- **繁殖税（fertility tax）。** 低资源语言的文本会比英语切出多得多的「每词 token 数」。一个印地语句子可能需要等价英语句子 3-5 倍的 token。这 3-5 倍会吞噬你的上下文窗口、训练效率和延迟。
- **变体恢复税（variant recovery tax）。** 每一个拼写错误、变音符号变体、Unicode 归一化不匹配或大小写变化，都会在嵌入空间里变成一个无关联的冷启动序列。模型学不到那些母语者一眼就懂的正字法对应关系。
- **容量溢出税（capacity spillover tax）。** 上面两种税会消耗上下文位置、层深和嵌入维度。留给真正推理的部分，会系统性地小于高资源语言从同一模型中得到的部分。

实际症状是：你的模型在印地语上训练得很正常，损失曲线看起来没问题，评估困惑度看起来也合理，但生产环境的输出却有微妙的错误。形态学（morphology）会在句子中途崩坏。罕见的屈折变化始终无法恢复。**靠扩大数据规模，你无法摆脱一个有缺陷的分词器。**

缓解措施：为你的目标语言挑一个覆盖良好的分词器（XLM-V 的 100 万 token 词表就是一个直接的修复）；在训练前，在留出的目标语言文本上验证分词繁殖率；对真正的长尾书写系统使用字节级回退（SentencePiece 的 `byte_fallback=True`、GPT-2 风格的字节级 BPE），这样就永远不会出现 OOV（未登录词）。

## 交付它

保存为 `outputs/skill-multilingual-picker.md`：

```markdown
---
name: multilingual-picker
description: Pick source language, target model, and evaluation plan for a multilingual NLP task.
version: 1.0.0
phase: 5
lesson: 18
tags: [nlp, multilingual, cross-lingual]
---

Given requirements (target languages, task type, available labeled data per language), output:

1. Source language for fine-tuning. Default English; check LANGRANK or qWALS if target language has a typologically close high-resource language.
2. Base model. XLM-R (classification), mT5 (generation), NLLB (translation), Aya-23 (generative LLM).
3. Few-shot budget. Start with 100-500 target-language examples if available. Zero-shot only if labeling is infeasible.
4. Evaluation plan. Per-language accuracy (not aggregate), cross-lingual consistency, entity-level F1 on non-Latin scripts.

Refuse to ship a multilingual model without per-language evaluation — aggregate metrics hide long-tail failures. Flag scripts with low tokenization coverage (Amharic, Tigrinya, many African languages) as needing a model with byte-fallback (SentencePiece with byte_fallback=True, or byte-level tokenizer like GPT-2).
```

## 练习

1. **简单。** 在英语、法语、印地语和阿拉伯语上，每种语言用 10 个句子跑一遍零样本分类流水线。报告每种语言的准确率。你应当会看到法语很强、印地语尚可、阿拉伯语波动较大。
2. **中等。** 用 `paraphrase-multilingual-MiniLM-L12-v2` 在一个小型混合语言语料上构建一个跨语言检索器。用英语查询，检索任意语言的文档。度量 recall@5。
3. **困难。** 针对一个印地语分类任务，对比「英语源」和「印地语源」两种微调方案。两种方案都用 500 条目标语言样本做少样本微调。报告哪个源能产生更好的印地语准确率，以及高出多少。这是 LANGRANK 论点的微缩版。

## 关键术语

| 术语 | 大家怎么说 | 它实际的含义 |
|------|-----------------|-----------------------|
| 多语言模型 | 一个模型，多种语言 | 在多种语言间共享词表和参数。 |
| 跨语言迁移 | 在一种语言上训练，在另一种上运行 | 在源语言上微调，在目标语言上评估，无需目标语言标注。 |
| 零样本 | 没有目标语言标注 | 不在目标语言上微调即可迁移。 |
| 少样本 | 少量目标语言标注 | 用 100-500 条目标语言样本做微调。 |
| mBERT | 第一个多语言 LM | 在 Wikipedia 上预训练的 104 语言 BERT。 |
| XLM-R | 标准的跨语言基线 | 在 CommonCrawl 上预训练的 100 语言 RoBERTa。 |
| NLLB | Meta 的 200 语言机器翻译 | No Language Left Behind（一种语言都不落下）。包含 55 种低资源语言。 |

## 延伸阅读

- [Conneau et al. (2019). Unsupervised Cross-lingual Representation Learning at Scale](https://arxiv.org/abs/1911.02116) —— XLM-R 论文。
- [Pires, Schlinger, Garrette (2019). How Multilingual is Multilingual BERT?](https://arxiv.org/abs/1906.01502) —— 开启跨语言迁移研究路线的分析论文。
- [Costa-jussà et al. (2022). No Language Left Behind](https://arxiv.org/abs/2207.04672) —— NLLB-200 论文。
- [Üstün et al. (2024). Aya Model: An Instruction Finetuned Open-Access Multilingual Language Model](https://arxiv.org/abs/2402.07827) —— Aya，Cohere 的多语言 LLM。
- [Language Similarity Predicts Cross-Lingual Transfer Learning Performance (2026)](https://www.mdpi.com/2504-4990/8/3/65) —— qWALS / LANGRANK 源语言论文。
