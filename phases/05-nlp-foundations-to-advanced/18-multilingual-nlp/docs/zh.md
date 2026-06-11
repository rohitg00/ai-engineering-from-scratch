# Multilingual NLP

> 一个模型，100多种语言，大多数语言的训练数据为零。跨语言迁移是2020年代的实际奇迹。

** 类型：** 学习
** 语言：** Python
** 先决条件：** 阶段5 · 04（GloVe、Fasttext、Subword）、阶段5 · 11（机器翻译）
** 时间：** ~45分钟

## The Problem

英语有数十亿个标签示例。乌尔都语有数千个。迈特利几乎没有。任何为全球受众提供服务的实用NLP系统都必须处理不存在特定任务训练数据的语言长尾问题。

多语言模型通过同时在多种语言上训练一个模型来解决这个问题。共享的表示使模型能够将用高资源语言学习的技能转移到低资源语言中。对英语情感分析模型进行微调，它就会对乌尔都语产生令人惊讶的良好情感预测。这是零镜头的跨语言转移，它重塑了NLP向世界传播的方式。

本课列出了权衡、规范模型以及让刚接触多语言工作的团队遇到困难的一个决定：选择要迁移的源语言。

## The Concept

![Cross-lingual transfer via shared multilingual embedding space](../assets/multilingual.svg)

** 共享词汇。**多语言模型使用针对所有目标语言的文本训练的SentencePiece或WordPiece标记器。词汇是共享的：相同的子词单位代表相关语言中相同的词素。英语和意大利语中的“anti-”有同样的含义。

** 共享代表。**预先训练过多种语言的掩蔽语言建模的Transformer会学习到不同语言中语义相似的句子会产生相似的隐藏状态。mBERT、XLM-R和NLLB都表现出这一点。英语中的“cat”嵌入在法语中的“chat”和西班牙语中的“gato”附近，整句嵌入也是如此。

** 零射门转会。**对一种语言（通常是英语）的标记数据进行微调。在推理时，在模型支持的任何其他语言上运行它。不需要目标语言标签。类型相关语言的结果较强，而远程语言的结果较弱。

** 少量微调。**添加100-500个目标语言的带标签的示例。分类任务的准确率跃升至英语基线的95-98%。这是多语言NLP中最具成本效益的杠杆。

## The models

| 模型 | 年 | 覆盖 | 注意到 |
|-------|------|----------|-------|
| mBERT | 2018 | 104种语言 | 在维基百科上接受培训。第一个实用的多语言LM。资源不足。 |
| XLM-R | 2019 | 100种语言 | 在CommonCrawl上接受过培训（比维基百科大得多）。设置跨语言基线。底座270 M，大号550 M。 |
| XLM-V | 2023 | 100种语言 | XLM-R，具有1 M令牌词汇量（vs 250 k）。资源较少更好。 |
| MT5 | 2020 | 101种语言 | 适合多语言生成的T5架构。 |
| NLLB-200 | 2022 | 200种语言 | Meta的翻译模型;包括55种低资源语言。 |
| 布鲁姆 | 2022 | 46种语言+13种编程 | Open 176 B LLM接受多语言培训。 |
| 阿亚-23 | 2024 | 23种语言 | Cohere的多语言法学硕士。精通阿拉伯语、印地语、斯瓦希里语。 |

按用例选择。将XLM-R-base作为正常默认设置，分类效果良好。生成任务需要mT5或NLLB，具体取决于翻译与开放生成。LLM风格的作品使用明确的多语言提示与Aya-23或Claude配对。

## The source-language decision (2026 research)

大多数团队默认使用英语作为微调来源。最近的研究（2026年）表明，这往往是错误的。

语言相似性比原始数据库大小更能预测传输质量。对于斯拉夫目标来说，德语或俄语往往胜过英语。对于印度目标来说，印地语往往胜过英语。**qWALS** 相似性指标（2026年，基于世界语言结构地图集功能）量化了这一点。**LANGRANK**（林等人，ACL 2019）是一种单独的、早期的方法，根据语言相似性、文集大小和遗传相关性的组合对候选源语言进行排名。

实用规则：如果您的目标语言有一种类型上接近的高资源亲戚，请首先尝试对该语言进行微调，然后与英语微调进行比较。

## Build It

### Step 1: zero-shot cross-lingual classification

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

一个模型、三种语言、相同的API。在NLI数据上训练的XLM-R通过蕴含技巧很好地转移到分类。

### Step 2: multilingual embedding space

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

翻译接近嵌入空间。另一个不同的英语句子落得更远。这就是跨语言检索、集群和相似性发挥作用的原因。

### Step 3: few-shot fine-tuning strategy

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

对于100-500个目标语言示例，“num_train_epochs=5”和“learning_rate= 2 e-5”是安全默认值。更高的学习率会导致多语言一致崩溃，并获得纯英语模式。

## Evaluation that actually works

- ** 按语言计算的准确性。**未汇总。聚集体隐藏着长尾。
- ** 相对于单语基线的基准。**对于具有足够数据的语言，从头开始训练的单语模型有时会比多语言模型更好。Test.
- ** 初中水平测试。**目标语言中的命名实体。多语言模型对于远离拉丁语的脚本通常具有较弱的标记化。
- ** 跨语言一致性。**两种语言中相同的含义应该产生相同的预测。测量差距。

## Use It

2026年堆栈：

| 任务 | 建议 |
|-----|-------------|
| 分类，100种语言 | XLM-R-base（~ 270 M）微调 |
| 零镜头文本分类 | ' joeddav/xlm-roberta-large-xnli ' |
| 多语言句子嵌入 | '商业-变形者/转述-多语言-MiniLM-L12-v2 ' |
| 翻译，200种语言 | “Facebook/nllb-200-蒸馏-600 M”（见第11课） |
| 生成多语言 | Claude，GPT-4，Aya-23，mT5-XXL |
| 低资源语言NLP | XLM-V或对相关高资源语言的特定领域微调 |

如果性能很重要，请务必为目标语言的微调预算。零射击只是起点，而不是最终答案。

### The tokenization tax (what goes wrong for low-resource languages)

多语言模型在其所有语言中共享一个标记器。这些词汇是在以英语、法语、西班牙语、汉语和德语为主的语料库上训练的。对于任何非主导语言，有三种税默默地复合在一起：

- ** 生育税。**低资源语言文本每个单词的标记化程度远高于英语。印地语句子可能需要相当于英语句子的3- 5倍的标记。这3- 5倍消耗了您的上下文窗口、训练效率和延迟。
- ** 变体追回税。**每个拼写错误、变音变体、Unicode规范化不匹配或大小写变体都会成为嵌入空间中的冷启动无关序列。该模型无法学习母语者认为明显的正字对应关系。
- ** 产能溢出税。**税1和税2消耗上下文位置、层深度和嵌入维度。实际推理所剩下的内容系统性地小于高资源语言从同一模型中获得的内容。

实际症状：您的模型正常使用印地语训练，损失曲线看起来正确，评估困惑看起来合理，并且生产产出略有错误。形态在句子中途崩溃。罕见的拐点无法恢复。** 您无法通过数据扩展来摆脱故障的代币化器。**

缓解措施：选择一个对目标语言具有良好覆盖率的标记器（XLM-V的1 M标记词汇是一个直接修复）;在训练前验证持有的目标文本上的标记化有效性;使用字节级回退（SentencePiece ' byte_fallback=True '，GPT-2风格字节级BPE）来实现真正的长尾脚本，这样就没有什么是OOV。

## Ship It

另存为“输出/skill-multilingual-picker.md”：

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

## Exercises

1. ** 简单。**对英语、法语、印地语和阿拉伯语中每种语言的10个句子运行零镜头分类管道。报告每项的准确性。你应该看到浓重的法语、像样的印地语、多变的阿拉伯语。
2. ** 中等。**使用“转述-多语言-MiniLM-L12-v2”在小型混合语言库上构建跨语言检索器。用英语查询，检索任何语言的文档。测量recall@5。
3. ** 很难。**比较印地语分类任务的英语源和印地语源微调。使用500个目标语言示例在两种机制下进行少量微调。报告哪个来源能产生更好的印地语准确性以及准确程度。这是兰格克论文的缩影。

## Key Terms

| Term | 别人怎么说 | 它实际上意味着什么 |
|------|-----------------|-----------------------|
| 多语言模型 | 一种模式，多种语言 | 跨语言共享词汇和参数。 |
| 跨语言迁移 | 训练一种语言，跑步另一种语言 | 对源进行微调，在没有目标语言标签的情况下对目标进行评估。 |
| Zero-shot | 无目标语言标签 | 无需对目标语言进行微调即可进行传输。 |
| 少样本 | 小目标标签 | 100-500个用于微调的目标语言示例。 |
| mBERT | 首个多语言LM | 104-BERT在维基百科上预先训练过的语言。 |
| XLM-R | 标准跨语言基线 | 100-语言RoberTa在CommonCrawl上预训练。 |
| NLLB | Meta的200种语言MT | 没有语言落后。包括55种低资源语言。 |

## Further Reading

- [Conneau等人（2019）。无监督跨语言代表学习规模]（https：//arxiv.org/ab/1911.02116）-XLM-R论文。
- [皮雷斯、施林格、加雷特（2019）。多语言BERT有多语言？]（https：//arxiv.org/ab/1906.01502）-开启跨语言迁移研究系列的分析论文。
- [Costa-jussà等人（2022）。不让语言掉队]（https：//arxiv.org/abs/2207.04672）- NLLB-200论文。
- [Üstün et al.（2024）. Aya Model：An Instruction Finetuned Open-Access Multilingual Language Model]（https：//arxiv.org/abs/2402.07827）- Aya，Cohere's multilingual LLM.
- [语言相似性预测跨语言迁移学习绩效（2026）]（https：//www.mdpi.com/2504-4990/8/3/65）-qWALS / LANGRANK源语言论文。
