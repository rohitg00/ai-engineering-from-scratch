# 多语言 NLP（Multilingual NLP）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 一个模型，100+ 语言，其中绝大多数语言连训练数据都没有。跨语言迁移（cross-lingual transfer）是 2020 年代落地最实用的奇迹。

**Type:** Learn
**Languages:** Python
**Prerequisites:** Phase 5 · 04 (GloVe, FastText, Subword), Phase 5 · 11 (Machine Translation)
**Time:** ~45 minutes

## 问题（Problem）

英语有数十亿条带标注样本，乌尔都语只有几千条，迈蒂利语几乎没有。任何要服务全球用户的 NLP 系统，都得在那些根本没有任务级训练数据的「长尾语言」上跑得起来。

多语言模型的解法是：把许多语言放在一起、同时训练同一个模型。共享表示让模型可以把高资源语言里学到的本事，迁移到低资源语言上去。在英文情感分析上微调（fine-tune）一下，开箱就能给出意外不错的乌尔都语情感预测。这就是 zero-shot 跨语言迁移，它已经重塑了 NLP 在全球范围内交付产品的方式。

这一课要讲清楚的是：取舍在哪里、有哪些标杆模型，以及一个让多语言新手最容易翻车的决策——挑哪门语言作为迁移源（source language）。

## 概念（Concept）

![通过共享多语言 embedding 空间实现跨语言迁移](../assets/multilingual.svg)

**共享词表。** 多语言模型用一个 SentencePiece 或 WordPiece tokenizer，在所有目标语言的语料上训练。词表是共享的：相关语言里同一个语素（morpheme）会落在同一个 subword 单元上。英语和意大利语里的 `anti-` 拿到的是同一个 token。

**共享表示。** 一个 transformer 在多种语言上做 masked language modeling 预训练，会逐渐学到：不同语言里语义相近的句子，会产出相近的隐藏状态。mBERT、XLM-R、NLLB 都展现了这一点。英语 "cat" 的 embedding 与法语 "chat"、西班牙语 "gato" 在空间里聚在一起，整句的 embedding 同样如此。

**Zero-shot 迁移。** 在某一种语言（通常是英语）的标注数据上微调，然后在推理（inference）时直接跑模型支持的任何其他语言，不需要目标语言的标签。对于类型学上接近的语言效果很强，对于差得远的语言效果就弱。

**Few-shot 微调。** 在目标语言上加 100–500 条标注样本。在分类任务上，准确率能跳到英文基线的 95%–98%。这是多语言 NLP 里性价比最高的一根杠杆。

## 模型清单（The models）

| 模型 | 年份 | 覆盖范围 | 备注 |
|-------|------|----------|-------|
| mBERT | 2018 | 104 种语言 | 在 Wikipedia 上训练。第一个真正能用的多语言 LM。低资源语言上偏弱。 |
| XLM-R | 2019 | 100 种语言 | 在 CommonCrawl 上训练（语料远大于 Wikipedia）。立起了跨语言基线。Base 270M、Large 550M。 |
| XLM-V | 2023 | 100 种语言 | XLM-R 的 1M token 词表版本（vs 250k）。低资源语言上更好。 |
| mT5 | 2020 | 101 种语言 | T5 架构，做多语言生成。 |
| NLLB-200 | 2022 | 200 种语言 | Meta 的翻译模型；包含 55 种低资源语言。 |
| BLOOM | 2022 | 46 种语言 + 13 种编程语言 | 开源 176B 多语言 LLM。 |
| Aya-23 | 2024 | 23 种语言 | Cohere 的多语言 LLM。在阿拉伯语、印地语、斯瓦希里语上表现强。 |

按用例选。分类任务，XLM-R-base 是稳妥默认值。生成任务则看是翻译还是开放生成，对应选 mT5 或 NLLB。LLM 风格的工作，搭 Aya-23，或者搭 Claude 并用明确的多语言 prompt。

## 源语言怎么选（2026 研究结论）

大多数团队默认拿英语作为微调的源语言。2026 年的研究表明，这种默认往往是错的。

**语言相似度比纯语料规模更能预测迁移质量。** 对斯拉夫语系的目标，德语或俄语常常比英语更好。对印度语系的目标，印地语常常比英语更好。**qWALS** 相似度指标（2026，基于 World Atlas of Language Structures 特征）把这件事量化了下来。**LANGRANK**（Lin et al., ACL 2019）则是另一种更早的方法，它综合语言学相似度、语料规模、亲缘关系来排序候选源语言。

实操规则：如果你的目标语言有一个类型学上接近的高资源亲戚，先在那门语言上做微调试一遍，再跟英文微调对比。

## 动手实现（Build It）

### Step 1：zero-shot 跨语言分类

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

一个模型、三种语言、同一个 API。XLM-R 在 NLI 数据上训练完，借蕴含（entailment）这个小技巧就能很好地迁移到分类任务上。

### Step 2：多语言 embedding 空间

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

互为翻译的句子在 embedding 空间里离得很近。换一句意思不同的英语句子，则离得更远。这正是跨语言检索、聚类、相似度能跑得通的原因。

### Step 3：few-shot 微调策略

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

在 100–500 条目标语言样本的规模下，`num_train_epochs=5`、`learning_rate=2e-5` 是稳妥的默认值。学习率（learning rate）再高，多语言对齐就崩了，最后你拿到的会是一个只会英文的模型。

## 真正有效的评估（Evaluation that actually works）

- **逐语言看保留集（held-out）准确率。** 不要总数。总数会把长尾藏起来。
- **跟单语言基线对比。** 数据量够的语言上，从零训练的单语言模型有时反而能赢过多语言模型。要测。
- **实体级测试。** 目标语言里的命名实体。多语言模型在远离拉丁文的脚本上，tokenization 经常很弱。
- **跨语言一致性。** 同一个意思在两种语言里，应该给出同样的预测结果。把这两者的差距测出来。

## 用起来（Use It）

2026 年的栈：

| 任务 | 推荐方案 |
|-----|-------------|
| 分类，100 种语言 | 微调过的 XLM-R-base（~270M） |
| Zero-shot 文本分类 | `joeddav/xlm-roberta-large-xnli` |
| 多语言句向量 embedding | `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` |
| 翻译，200 种语言 | `facebook/nllb-200-distilled-600M`（见 lesson 11） |
| 多语言生成 | Claude、GPT-4、Aya-23、mT5-XXL |
| 低资源语言 NLP | XLM-V，或拿一门相关的高资源语言做领域微调 |

只要性能重要，就一定预留预算在目标语言上做微调。Zero-shot 是起点，不是终点。

### Tokenization 税（低资源语言会怎么坑你）

多语言模型把一个 tokenizer 共享给所有语言。这个词表是在英语、法语、西班牙语、中文、德语主导的语料上训练出来的。任何不在这些主导语言里的语言，都会无声无息地同时被三种「税」吞掉：

- **Fertility 税（切片膨胀税）。** 低资源语言的文本切出的 token 数远多于英文，每个词所需的 token 数能多 3–5 倍。一个印地语句子要花掉等价英文句子 3–5 倍的 token 数。这 3–5 倍会同时吃掉你的 context window、训练效率、推理延迟。
- **变体回收税（variant recovery tax）。** 每一个错别字、每个变音符号变体、每个 Unicode 归一化不匹配、每个大小写差异，都会在 embedding 空间里成为一段毫无关联的、冷启动的新序列。模型学不到母语者一眼就明白的拼写对应关系。
- **容量挤占税（capacity spillover tax）。** 第 1 和第 2 种税会消耗位置编码、网络深度和 embedding 维度。剩下能用于真正推理的容量，从同一个模型里高资源语言能拿到的额度，就被系统性地砍掉了一截。

实际症状是这样的：你的模型在印地语上训练得「正常」，loss 曲线看起来挺对，eval 困惑度也挺合理，结果上线之后输出有种说不清的诡异感。句子中段形态学突然崩掉、罕见词形永远找不回来。**坏掉的 tokenizer，不是靠堆数据能解决的。**

缓解办法：挑一个对你目标语言覆盖度好的 tokenizer（XLM-V 的 1M token 词表就是一个直接的修复方案）；训练前先在保留集目标语言文本上验证一下 tokenization 的 fertility；对于真正长尾的脚本，使用字节级回退（SentencePiece 的 `byte_fallback=True`、GPT-2 风格的字节级 BPE），这样就再也不会有 OOV。

## 上线部署（Ship It）

存为 `outputs/skill-multilingual-picker.md`：

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

## 练习（Exercises）

1. **Easy.** 在英语、法语、印地语、阿拉伯语四种语言上各跑 10 个句子，过一遍 zero-shot 分类管道，逐语言报准确率。预期是法语很强、印地语凑合、阿拉伯语忽好忽坏。
2. **Medium.** 用 `paraphrase-multilingual-MiniLM-L12-v2` 在一份小型混合语言语料上搭一个跨语言检索器。用英文 query，从任意语言里检索文档。测一下 recall@5。
3. **Hard.** 在一个印地语分类任务上，对比「英文源」与「印地语源」两种微调路径。两种 regime 都用 500 条目标语言样本做 few-shot 微调，报告哪种源在印地语上准确率更高、高出多少。这就是 LANGRANK 论点的微缩复现。

## 关键术语（Key Terms）

| 术语 | 大家口头怎么说 | 实际是什么意思 |
|------|-----------------|-----------------------|
| Multilingual model（多语言模型） | 一个模型，多门语言 | 各语言之间共享词表与参数。 |
| Cross-lingual transfer（跨语言迁移） | 拿一种语言训，跑另一种语言 | 在源语言上微调，在目标语言上不带标签直接评估。 |
| Zero-shot | 目标语言没有标签 | 不在目标语言上做任何微调就直接迁移。 |
| Few-shot | 目标语言只有少量标签 | 用 100–500 条目标语言样本做微调。 |
| mBERT | 第一个多语言 LM | 在 Wikipedia 上预训练的 104 语言 BERT。 |
| XLM-R | 标准跨语言基线 | 在 CommonCrawl 上预训练的 100 语言 RoBERTa。 |
| NLLB | Meta 的 200 语言 MT | No Language Left Behind。包含 55 种低资源语言。 |

## 延伸阅读（Further Reading）

- [Conneau et al. (2019). Unsupervised Cross-lingual Representation Learning at Scale](https://arxiv.org/abs/1911.02116) —— XLM-R 论文。
- [Pires, Schlinger, Garrette (2019). How Multilingual is Multilingual BERT?](https://arxiv.org/abs/1906.01502) —— 开启跨语言迁移这条研究路线的分析论文。
- [Costa-jussà et al. (2022). No Language Left Behind](https://arxiv.org/abs/2207.04672) —— NLLB-200 论文。
- [Üstün et al. (2024). Aya Model: An Instruction Finetuned Open-Access Multilingual Language Model](https://arxiv.org/abs/2402.07827) —— Aya，Cohere 的多语言 LLM。
- [Language Similarity Predicts Cross-Lingual Transfer Learning Performance (2026)](https://www.mdpi.com/2504-4990/8/3/65) —— qWALS / LANGRANK 源语言论文。
