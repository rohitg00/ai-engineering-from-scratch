# 多语言 NLP

> 一个模型，100+ 种语言，其中大多数语言零训练数据。跨语言迁移是 2020 年代的实用奇迹。

**Type:** Learn
**Languages:** Python
**Prerequisites:** Phase 5 · 04 (GloVe、FastText、Subword),Phase 5 · 11(机器翻译)
**Time:** ~45 分钟

## 问题

英语有数十亿条标注样本。乌尔都语只有数千条。迈蒂利语几乎没有。任何服务全球受众的实用 NLP 系统，都必须在缺乏任务专用训练数据的长尾语言上正常工作。

多语言模型的解决方案是同时在多种语言上训练一个模型。共享表示使模型能够把从高资源语言学到的技能迁移到低资源语言。只需在英语情感分析上微调模型，它就能在乌尔都语上开箱即用地给出相当不错的情感预测。这就是零样本跨语言迁移，它彻底改变了 NLP 走向世界的方式。

本课点明其中的权衡、经典模型，以及一个让初次接触多语言工作的团队容易踩坑的决策：选择迁移的源语言。

## 概念

![Cross-lingual transfer via shared multilingual embedding space](../assets/multilingual.svg)

**共享词表。** 多语言模型使用在所有目标语言文本上训练的 SentencePiece 或 WordPiece 分词器。词表是共享的：同一个子词单元在相关语言中表示同一个语素。英语和意大利语中的 `anti-` 会得到相同的 token。

**共享表示。** 在多种语言上以掩码语言模型任务预训练的 Transformer 会学到：不同语言中语义相似的句子会产生相似的隐藏状态。mBERT、XLM-R 和 NLLB 都表现出这一点。"cat"（英语）的嵌入与法语中的 "chat" 和西班牙语中的 "gato" 聚在一起，整句嵌入也是如此。

**零样本迁移。** 在一种语言（通常是英语）的标注数据上微调模型。推理时直接在模型支持的任何其他语言上运行。不需要目标语言的标注。对于类型学上相近的语言，结果很强；对差异较大的语言则较弱。

**少样本微调。** 在目标语言上补充 100–500 条标注样本。分类任务的准确率即可跃升至英语基线的 95–98%。这是多语言 NLP 中性价比最高的单一杠杆。

## 模型

| 模型 | 年份 | 覆盖范围 | 备注 |
|-------|------|----------|-------|
| mBERT | 2018 | 104 种语言 | 在维基百科上训练。首个实用多语言 LM。低资源语言表现弱。 |
| XLM-R | 2019 | 100 种语言 | 在 CommonCrawl 上训练（远大于维基百科）。树立了跨语言基线。Base 270M,Large 550M。 |
| XLM-V | 2023 | 100 种语言 | XLM-R 配备 100 万 token 词表（对比 25 万）。低资源语言表现更好。 |
| mT5 | 2020 | 101 种语言 | 用于多语言生成的 T5 架构。 |
| NLLB-200 | 2022 | 200 种语言 | Meta 的翻译模型；包含 55 种低资源语言。 |
| BLOOM | 2022 | 46 种语言 + 13 种编程语言 | 开放的 176B LLM,多语言训练。 |
| Aya-23 | 2024 | 23 种语言 | Cohere 的多语言 LLM。在阿拉伯语、印地语、斯瓦希里语上表现强。 |

按用例选择。分类任务用 XLM-R-base 作为合理默认即可。生成任务视翻译还是开放生成选择 mT5 或 NLLB。LLM 风格的工作搭配 Aya-23 或 Claude，使用显式的多语言提示。

## 源语言决策（2026 研究）

大多数团队默认用英语作为微调源语言。近期研究（2026）表明这往往是错的。

语言相似度比语料库原始规模更能预测迁移质量。对于斯拉夫语目标，德语或俄语常常胜过英语。对于印度语系目标，印地语常常胜过英语。**qWALS** 相似度指标（2026，基于 World Atlas of Language Structures 特征）对此进行了量化。**LANGRANK**（Lin et al., ACL 2019）是另一个更早的方法，它从语言学相似度、语料库规模和谱系亲缘关系的组合中对候选源语言进行排序。

实用规则：如果你的目标语言在类型学上有一个高资源的近亲语言，先尝试用那个语言微调，再与英语微调的结果对比。

```figure
n5-crosslingual-bridge
```

## 动手实现

### 步骤 1：零样本跨语言分类

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

一个模型，三种语言，同一套 API。在 NLI 数据上训练的 XLM-R 通过蕴含技巧可以很好地迁移到分类任务。

### 步骤 2：多语言嵌入空间

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

互为翻译的句子在嵌入空间中落点相近。另一个不同的英语句子落点更远。这正是跨语言检索、聚类和相似度计算得以成立的原因。

### 步骤 3：少样本微调策略

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

对于 100–500 条目标语言样本，`num_train_epochs=5` 和 `learning_rate=2e-5` 是安全默认值。过高的学习率会导致多语言对齐崩溃，你会得到一个只会英语的模型。

## 真正有效的评估

- **按语言在留出集上的准确率。** 不要看聚合指标。聚合会掩盖长尾。
- **与单语基线对标。** 对于数据充足的语言，从零训练的单语模型有时会胜过多语言模型。要实测。
- **实体级测试。** 测试目标语言中的命名实体。多语言模型对远离拉丁字母的文字，分词往往较弱。
- **跨语言一致性。** 同一含义在两种语言中应产生相同的预测。测量这个差距。

## 应用

2026 年的技术栈：

| 任务 | 推荐 |
|-----|-------------|
| 100 种语言的分类 | XLM-R-base（约 270M）微调 |
| 零样本文本分类 | `joeddav/xlm-roberta-large-xnli` |
| 多语言句子嵌入 | `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` |
| 200 种语言的翻译 | `facebook/nllb-200-distilled-600M`（见第 11 课） |
| 生成式多语言 | Claude、GPT-4、Aya-23、mT5-XXL |
| 低资源语言 NLP | XLM-V，或在相关高资源语言上做领域微调 |

如果性能重要，永远要为目标语言的微调预留预算。零样本是起点，不是最终答案。

### 分词税（低资源语言会出什么问题）

多语言模型在所有语言间共享一个分词器。这个词表是在以英语、法语、西班牙语、中文、德语为主导的语料库上训练的。对于主导集合之外的任何语言，三种“税”会悄然叠加：

- **繁衍率税。** 低资源语言文本每个词分出的 token 数远多于英语。一句印地语可能需要等效英语句子的 3–5 倍 token。这 3–5 倍会吞噬你的上下文窗口、训练效率和延迟。
- **变体恢复税。** 每一个拼写错误、变音符号变体、Unicode 规范化不匹配或大小写差异，都会在嵌入空间中变成一个冷启动的无关序列。模型无法学到母语者视为显而易见的正字法对应关系。
- **容量溢出税。** 前两种税消耗上下文位置、层深度和嵌入维度。留给真正推理的容量，系统性地小于高资源语言从同一模型中获得的容量。

实际症状是：你的模型在印地语上训练正常，loss 曲线看起来没问题，评估困惑度也合理，但生产输出却微妙地出错。形态在中途崩溃。罕见屈折形式始终无法恢复。**分词器坏了，靠堆数据是救不回来的。**

缓解措施：为目标语言选择覆盖良好的分词器（XLM-V 的 100 万 token 词表就是直接的解法）；训练前在留出的目标文本上验证分词繁衍率；对真正的长尾文字使用字节级回退（SentencePiece `byte_fallback=True`、GPT-2 风格的字节级 BPE），确保永远不会出现 OOV。

## 交付

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

1. **简单。** 在英语、法语、印地语和阿拉伯语上，每种语言各取 10 个句子，运行零样本分类流水线。分别报告准确率。你应该会看到法语很强、印地语尚可、阿拉伯语表现波动。
2. **中等。** 使用 `paraphrase-multilingual-MiniLM-L12-v2` 在一个小型混合语言语料库上构建跨语言检索器。用英语查询，检索任意语言的文档。测量 recall@5。
3. **困难。** 针对一个印地语分类任务，对比英语源微调和印地语源微调。两种方案下都用 500 条目标语言样本做少样本微调。报告哪种源语言带来更好的印地语准确率，以及差距多大。这就是 LANGRANK 论点的缩影。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|-----------------|-----------------------|
| 多语言模型 | 一个模型，多种语言 | 跨语言共享词表和参数。 |
| 跨语言迁移 | 在一种语言上训练，在另一种语言上运行 | 在源语言上微调，在目标语言上评估，无需目标语言标注。 |
| 零样本 | 无目标语言标注 | 不在目标语言上微调的直接迁移。 |
| 少样本 | 少量目标语言标注 | 用 100–500 条目标语言样本做微调。 |
| mBERT | 首个多语言 LM | 在维基百科上预训练的 104 语言 BERT。 |
| XLM-R | 标准跨语言基线 | 在 CommonCrawl 上预训练的 100 语言 RoBERTa。 |
| NLLB | Meta 的 200 语言机器翻译 | No Language Left Behind。包含 55 种低资源语言。 |

## 延伸阅读

- [Conneau et al. (2019). Unsupervised Cross-lingual Representation Learning at Scale](https://arxiv.org/abs/1911.02116) — XLM-R 论文。
- [Pires, Schlinger, Garrette (2019). How Multilingual is Multilingual BERT?](https://arxiv.org/abs/1906.01502) — 开创跨语言迁移研究方向的论文。
- [Costa-jussà et al. (2022). No Language Left Behind](https://arxiv.org/abs/2207.04672) — NLLB-200 论文。
- [Üstün et al. (2024). Aya Model: An Instruction Finetuned Open-Access Multilingual Language Model](https://arxiv.org/abs/2402.07827) — Aya,Cohere 的多语言 LLM。
- [Language Similarity Predicts Cross-Lingual Transfer Learning Performance (2026)](https://www.mdpi.com/2504-4990/8/3/65) — qWALS / LANGRANK 源语言论文。