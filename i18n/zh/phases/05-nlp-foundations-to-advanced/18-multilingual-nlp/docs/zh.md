# 多语言NLP

> 一个模型,100多种语言,大多数语言的训练数据是零的.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 04 (GloVe, FastText, Subword), Phase 5 · 11 (Machine Translation)
**Time:** ~45 minutes

## 问题

英语有数十亿个标签的例子.乌尔都有数千个.马提利几乎没有任何一个.任何为全球观众服务的实用NLP系统都必须在没有任务特定培训数据的长尾语言上工作.

多语言模型通过同时训练一个模型在多种语言来解决这一问题. 共同的代表性使得模型能够将高资源语言中学习的技能转移到低资源语言中. 通过英语情感分析进行细节调整, 这就是零射击跨语言传输,它已经改变了NLP如何传递到世界.

这一课列出了交易,规范模式,以及一个决定,

## 概念

![Cross-lingual transfer via shared multilingual embedding space](../assets/multilingual.svg)

**Shared vocabulary.**多语言模型使用了从所有目标语言中训练的SentencePiece或WordPiece标记器.词汇库是共享的:相同的子词单元在相关语言中代表着相同的形态. `anti-`在英语和意大利语中,得到了相同的代币.

**Shared representation.**通过面具语言模拟,在许多语言中预先训练的变压器学会了不同语言中的语义相似句子产生类似的隐藏状态. mBERT,XLM-R和NLLB都显示出这一点.英语中的"猫"嵌入式集群在法语的"聊天"和西班牙语的"gato"附近,以及全句嵌入式.

**Zero-shot transfer.**根据一个语言 (通常是英语) 的标签数据进行细节调整.在推断时,运行在模型支持的任何其他语言上.不需要标签目标语言.对类型相关语言来说,结果是强的,对于远方语言来说是弱的.

**Few-shot fine-tuning.**添加100-500个标记的例子. 准确度在分类任务上跳到英语基线的95-98%.这是多语言NLP中最具成本效益的单一杆.

## 模型

| Model | Year | Coverage | Notes |
|-------|------|----------|-------|
| mBERT | 2018 | 104 languages | Trained on Wikipedia. First practical multilingual LM. Weak on low-resource. |
| XLM-R | 2019 | 100 languages | Trained on CommonCrawl (much larger than Wikipedia). Sets the cross-lingual baseline. Base 270M, Large 550M. |
| XLM-V | 2023 | 100 languages | XLM-R with 1M-token vocabulary (vs 250k). Better on low-resource. |
| mT5 | 2020 | 101 languages | T5 architecture for multilingual generation. |
| NLLB-200 | 2022 | 200 languages | Meta's translation model; includes 55 low-resource languages. |
| BLOOM | 2022 | 46 languages + 13 programming | Open 176B LLM trained multilingually. |
| Aya-23 | 2024 | 23 languages | Cohere's multilingual LLM. Strong on Arabic, Hindi, Swahili. |

根据使用情况选择. 类别与XLM-R-base作为正常默认功能很好. 代代任务需要mT5或NLLB,取决于翻译与开放代代. 基于Aya-23或Claude的LLM类型工作对,使用明确的多语言提示.

## 源语言决定 (2026年研究)

据悉,在2026年,英国的研究人员发现,英语是最好的调整源.

语言相似性预测传输质量比原材料大小更好.对于斯拉夫人目标,德国或俄罗斯人通常超过英语.对于印第安人目标,印度语通常超过英语.**qWALS**根据世界语言结构图表的2026年,**LANGRANK**(Lin et al., ACL 2019) 是一种单独的早期方法,从语言相似性,体积和遗传相关性组合中排名候选源语言.

实际规则:如果你的目标语言具有典型的近距离高资源的亲戚,

```figure
n5-crosslingual-bridge
```

## 建立它

### 阶段1:零截图跨语言分类

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

基于NLI训练的XLM-R通过"结"技巧将数据转移到分类.

### 步骤2:多语言嵌入空间

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

翻译在嵌入空间中接近. 另一个英语句子在更远的地方. 这就是使跨语言检索,集群和相似性工作的原因.

### 步骤3:少量调整策略

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

对于100-500个目标语言的例子,`num_train_epochs=5`其他`learning_rate=2e-5`提高学习率会导致多语言的调整崩,

## 实际上有效的评估

- **Per-language accuracy on held-out sets.**总结不合,总结隐藏着长尾.
- **Benchmark against monolingual baseline.**在具有足够数据的语言中,从零开始训练的单语言模型有时比多语言模型更好.
- **Entity-level tests.**标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签:
- **Cross-lingual consistency.**两个语言的含义应该产生相同的预测.

## 用它

现在,我们要做什么?

| Task | Recommended |
|-----|-------------|
| Classification, 100 languages | XLM-R-base (~270M) fine-tuned |
| Zero-shot text classification | `joeddav/xlm-roberta-large-xnli` |
| Multilingual sentence embeddings | `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` |
| Translation, 200 languages | `facebook/nllb-200-distilled-600M` (see lesson 11) |
| Generative multilingual | Claude, GPT-4, Aya-23, mT5-XXL |
| Low-resource language NLP | XLM-V or a domain-specific fine-tune on related high-resource language |

总是预算调整目标语言,如果表现有意义.零射击是起点,而不是最终答案.

### 代币化税 (低资源语言的情况是什么)

多语言模型在所有语言中都具有一个代码符号.该词汇是由英语,法语,西班牙语,中国,德国主导的组成部分训练.对于任何语言以外的主导组,三个税收都默默地组合:

- **Fertility tax.**低资源语言文本每字的代码比英语要多得多.一个印度语句可能需要相当于英语句子的代码的3-5倍.这3-5倍就消耗了你的文本窗口,训练效率和延迟.
- **Variant recovery tax.**每个字体错误,二重变体,Unicode规范化不匹配或案例变化都会成为嵌入空间中的冷启动无关的序列.模型无法学习母语发音者看作明显的拼写对应.
- **Capacity spillover tax.**税收1和2消耗了语境位置,层深度和嵌入维度.实际推理所剩下的东西系统地比高资源语言从同一个模型中得到的东西小.

实际症状:你的模型通常用印度语训练,损失曲线看起来正确,评估困难看起来合理,生产输出显然错误. 语句中间的形态崩. 罕见的曲线仍然无法恢复. **You cannot data-scale your way out of a broken tokenizer.**

减轻:选择一个对目标语言有良好的代币化器 (XLM-V的1M代币词汇库是直接的解决方案);在训练前检查保留的目标文本的代币化生育能力;使用字节级的反弹 (SentencePiece `byte_fallback=True`对于真正的长尾脚本来说,从来没有什么是OOV.

## 运送它

保存如`outputs/skill-multilingual-picker.md`其他:

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

## 运动

1. **Easy.**运行零射击分类管道,每种语言每句10句,包括英语,法语,印度语和阿拉伯语. 每个文都报告准确性.你应该看到强大的法国,有道德的印度语,可变的阿拉伯语.
2. **Medium.**使用`paraphrase-multilingual-MiniLM-L12-v2`通过使用不同语言的语言,建立一个跨语言检索器.
3. **Hard.**为了实现印度语分类任务,比较英语源和印度语源细节调整.在两种制度下使用500个目标语言例子进行几次细节调整.报告哪个来源产生更好的印度语精确性,以及多少.这是缩小中的LANGRANK论文.

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Multilingual model | One model, many languages | Shared vocabulary and parameters across languages. |
| Cross-lingual transfer | Train on one language, run on another | Fine-tune on source, evaluate on target without target-language labels. |
| Zero-shot | No target-language labels | Transfer without fine-tuning on the target language. |
| Few-shot | Small target labels | 100-500 target-language examples used for fine-tuning. |
| mBERT | First multilingual LM | 104-language BERT pretrained on Wikipedia. |
| XLM-R | Standard cross-lingual baseline | 100-language RoBERTa pretrained on CommonCrawl. |
| NLLB | Meta's 200-language MT | No Language Left Behind. Includes 55 low-resource languages. |

## 进一步阅读

- [Conneau et al. (2019). Unsupervised Cross-lingual Representation Learning at Scale](https://arxiv.org/abs/1911.02116)XLM-R纸.
- [Pires, Schlinger, Garrette (2019). How Multilingual is Multilingual BERT?](https://arxiv.org/abs/1906.01502)跨语言转移研究线的分析论文.
- [Costa-jussà et al. (2022). No Language Left Behind](https://arxiv.org/abs/2207.04672) NLLB-200 论文
- [Üstün et al. (2024). Aya Model: An Instruction Finetuned Open-Access Multilingual Language Model](https://arxiv.org/abs/2402.07827)亚亚,科赫的多语言法学士.
- [Language Similarity Predicts Cross-Lingual Transfer Learning Performance (2026)](https://www.mdpi.com/2504-4990/8/3/65)QWALS/LANGRANK源语言论文.
