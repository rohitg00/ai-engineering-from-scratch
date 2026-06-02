# 自然语言推理 —— 文本蕴含（Natural Language Inference — Textual Entailment）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> "t entails h" 意思是：人类读完 t 之后，会得出 h 为真的结论。NLI 这个任务就是预测「蕴含 / 矛盾 / 中立」三选一。表面上无聊，工程上承重。

**Type:** Learn
**Languages:** Python
**Prerequisites:** Phase 5 · 05（情感分析）, Phase 5 · 13（问答）
**Time:** ~60 minutes

## 问题（The Problem）

你做了一个摘要器。它产出了一段摘要。你怎么知道这段摘要里没有 hallucination（幻觉）？

你做了一个聊天机器人。它回答「是」。你怎么知道这个答案有检索到的段落作支撑？

你需要把 10,000 篇新闻按主题分类。你没有任何训练标签。能不能复用一个已有模型？

这三个问题都可以归约成自然语言推理（Natural Language Inference, NLI）。NLI 问的是：给定前提 `t` 和假设 `h`，`h` 是被 `t` 蕴含、被矛盾、还是中立（无关）？

- **Hallucination 检测：** `t` = 源文档，`h` = 摘要中的断言。非蕴含 = hallucination。
- **有据问答（Grounded QA）：** `t` = 检索到的段落，`h` = 生成的答案。非蕴含 = 编造。
- **Zero-shot 分类：** `t` = 文档，`h` = 标签的自然语言化表达（"This is about sports"）。蕴含 = 预测标签。

一个任务，三种生产用途。这就是为什么每一个 RAG 评估框架底层都内置了一个 NLI 模型。

## 概念（The Concept）

![NLI: 三分类，premise vs hypothesis](../assets/nli.svg)

**三种标签。**

- **Entailment（蕴含）。** `t` → `h`。"The cat is on the mat" 蕴含 "There is a cat"。
- **Contradiction（矛盾）。** `t` → ¬`h`。"The cat is on the mat" 与 "There is no cat" 矛盾。
- **Neutral（中立）。** 两个方向都推不出。"The cat is on the mat" 对 "The cat is hungry" 是中立的。

**不是逻辑蕴含。** NLI 是 *自然* 语言推理 —— 关注的是一个普通人类读者会怎么推断，而不是严格的形式逻辑。"John walked his dog" 在 NLI 里蕴含 "John has a dog"，但严格的一阶逻辑只有在你把「拥有」公理化之后才会承认这一点。

**数据集。**

- **SNLI**（2015）。570k 条人工标注的句对，前提是图像 caption。领域窄。
- **MultiNLI**（2017）。433k 句对，覆盖 10 种文体。2026 年的标准训练语料。
- **ANLI**（2019）。Adversarial NLI（对抗式 NLI）。人类专门写出能击穿现有模型的样例。更难。
- **DocNLI, ConTRoL**（2020–21）。前提为文档长度。考察多跳和长距离推理。

**架构。** 一个 transformer encoder（BERT、RoBERTa、DeBERTa）读入 `[CLS] premise [SEP] hypothesis [SEP]`。`[CLS]` 表示送入一个 3 路 softmax。在 MNLI 上训练，在留出的基准上评估，分布内句对可以拿到 90%+ 准确率。

**用 NLI 做 zero-shot。** 给定一篇文档和候选标签，把每个标签变成假设（"This text is about sports"），逐个算 entailment 概率，取最大值。这就是 Hugging Face `zero-shot-classification` pipeline 背后的机制。

## 动手实现（Build It）

### Step 1: 跑一个预训练 NLI 模型

```python
from transformers import pipeline

nli = pipeline("text-classification",
               model="facebook/bart-large-mnli",
               top_k=None)  # return all labels; replaces deprecated return_all_scores=True

premise = "The cat is sleeping on the couch."
hypothesis = "There is a cat in the room."

result = nli({"text": premise, "text_pair": hypothesis})[0]
print(result)
# [{'label': 'entailment', 'score': 0.97},
#  {'label': 'neutral', 'score': 0.02},
#  {'label': 'contradiction', 'score': 0.01}]
```

生产级 NLI 的开源默认选择是 `facebook/bart-large-mnli` 和 `microsoft/deberta-v3-large-mnli`。DeBERTa-v3 在榜单上排第一。

### Step 2: zero-shot 分类

```python
zs = pipeline("zero-shot-classification", model="facebook/bart-large-mnli")

text = "The stock market rallied after the central bank cut interest rates."
labels = ["finance", "sports", "politics", "technology"]

result = zs(text, candidate_labels=labels)
print(result)
# {'labels': ['finance', 'politics', 'technology', 'sports'],
#  'scores': [0.92, 0.05, 0.02, 0.01]}
```

模板默认是 "This example is about {label}."，可以通过 `hypothesis_template` 自定义。不需要训练数据。不需要微调。开箱即用。

### Step 3: RAG 的忠实度检查

```python
def is_faithful(answer, context, threshold=0.5):
    result = nli({"text": context, "text_pair": answer})[0]
    entail = next(s for s in result if s["label"] == "entailment")
    return entail["score"] > threshold
```

这就是 RAGAS 忠实度（faithfulness）的核心：把生成的答案拆成原子断言（atomic claims），逐条对照检索上下文做 NLI 判定，报告蕴含的比例。

### Step 4: 手搓一个 NLI 分类器（概念演示）

参见 `code/main.py`：一个仅依赖标准库的玩具版本，premise 和 hypothesis 之间通过词面重叠 + 否定词检测来判定。完全打不过 transformer 模型 —— 但它能呈现这个任务的形状：两段文本输入，3 路标签输出，loss 是 `{entail, contradict, neutral}` 上的 cross-entropy。

## 坑（Pitfalls）

- **只看 hypothesis 的捷径。** 模型仅凭假设就能在 SNLI 上拿到 ~60% 的准确率，因为 "not"、"nobody"、"never" 这类词与矛盾标签相关。这是检测标签泄漏的强 baseline（基线）。
- **词面重叠启发式。** "每一个子序列都被蕴含" 这条子序列启发式能在 SNLI 上蒙混过关，但在 HANS/ANLI 上直接翻车。要用对抗式基准。
- **文档级别下的退化。** 单句 NLI 模型在文档长度的前提上 F1 直降 20+。长上下文要用 DocNLI 训练过的模型。
- **Zero-shot 模板敏感。** "This example is about {label}" vs "{label}" vs "The topic is {label}"，准确率可能差出 10+ 个点。模板要调。
- **领域不匹配。** MNLI 训在通用英语上。法律、医疗、科研文本需要领域专用的 NLI 模型（比如 SciNLI、MedNLI）。

## 用起来（Use It）

2026 年的工具栈：

| 用途 | 模型 |
|---------|-------|
| 通用 NLI | `microsoft/deberta-v3-large-mnli` |
| 快 / 端侧 | `cross-encoder/nli-deberta-v3-base` |
| Zero-shot 分类（轻量） | `facebook/bart-large-mnli` |
| 文档级 NLI | `MoritzLaurer/DeBERTa-v3-large-mnli-fever-anli-ling-wanli` |
| 多语言 | `MoritzLaurer/multilingual-MiniLMv2-L6-mnli-xnli` |
| RAG hallucination 检测 | RAGAS / DeepEval 内嵌的 NLI 层 |

2026 的元模式：NLI 是文本理解的万能胶带。任何时候你需要回答「A 是否支持 B？」或「A 是否与 B 矛盾？」—— 先伸手去拿 NLI，再考虑多调一次 LLM。

## 上线部署（Ship It）

保存为 `outputs/skill-nli-picker.md`：

```markdown
---
name: nli-picker
description: Pick an NLI model, label template, and evaluation setup for a classification / faithfulness / zero-shot task.
version: 1.0.0
phase: 5
lesson: 21
tags: [nlp, nli, zero-shot]
---

Given a use case (faithfulness check, zero-shot classification, document-level inference), output:

1. Model. Named NLI checkpoint. Reason tied to domain, length, language.
2. Template (if zero-shot). Verbalization pattern. Example.
3. Threshold. Entailment cutoff for the decision rule. Reason based on calibration.
4. Evaluation. Accuracy on held-out labeled set, hypothesis-only baseline, adversarial subset.

Refuse to ship zero-shot classification without a 100-example labeled sanity check. Refuse to use a sentence-level NLI model on document-length premises. Flag any claim that NLI solves hallucination — it reduces it; it does not eliminate it.
```

## 练习（Exercises）

1. **Easy.** 在 20 条手工编写的 (premise, hypothesis, label) 三元组上跑 `facebook/bart-large-mnli`，三种类别都覆盖。统计准确率。再加几条针对「子序列启发式」的对抗陷阱（"I did not eat the cake" vs "I ate the cake"），看模型会不会翻车。
2. **Medium.** 在 100 条 AG News 标题上比较 zero-shot 模板 `"This text is about {label}"` 与 `"The topic is {label}"`、`"{label}"`，给出准确率波动。
3. **Hard.** 做一个 RAG 忠实度检查器：原子断言拆解 + 逐断言 NLI。在 50 条带 gold 上下文的 RAG 生成答案上评估，报告相对人工标签的假阳率与假阴率。

## 关键术语（Key Terms）

| 术语 | 大家怎么说 | 实际含义 |
|------|-----------------|-----------------------|
| NLI | Natural Language Inference | 对前提-假设关系的 3 路分类。 |
| RTE | Recognizing Textual Entailment | NLI 的旧名；同一个任务。 |
| Entailment | "t 蕴含 h" | 普通读者读完 t 会认定 h 为真。 |
| Contradiction | "t 排除 h" | 普通读者读完 t 会认定 h 为假。 |
| Neutral | "无法判定" | 从 t 到 h 两个方向都没有推断。 |
| Zero-shot classification | 把 NLI 当分类器用 | 把标签自然语言化为假设，取蕴含概率最大的。 |
| Faithfulness | 答案是否有支撑 | 在 (检索上下文, 生成答案) 上跑 NLI。 |

## 延伸阅读（Further Reading）

- [Bowman et al. (2015). A large annotated corpus for learning natural language inference](https://arxiv.org/abs/1508.05326) — SNLI。
- [Williams, Nangia, Bowman (2017). A Broad-Coverage Challenge Corpus for Sentence Understanding through Inference](https://arxiv.org/abs/1704.05426) — MultiNLI。
- [Nie et al. (2019). Adversarial NLI](https://arxiv.org/abs/1910.14599) — ANLI 基准。
- [Yin, Hay, Roth (2019). Benchmarking Zero-shot Text Classification](https://arxiv.org/abs/1909.00161) — NLI 当分类器。
- [He et al. (2021). DeBERTa: Decoding-enhanced BERT with Disentangled Attention](https://arxiv.org/abs/2006.03654) — 2026 年的 NLI 主力。
