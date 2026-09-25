# 自然语言推理 — 文本蕴含

> “t 蕴含 h” 意味着阅读 t 的人会得出 h 为真的结论。NLI 是预测蕴含 / 矛盾 / 中立的任务。表面上乏味，但在生产环境中至关重要。

**Type:** Learn
**Languages:** Python
**Prerequisites:** 阶段 5 · 05（情感分析），阶段 5 · 13（问答）
**Time:** ~60 分钟

## 问题所在

你构建了一个摘要器。它生成了一份摘要。你如何知道摘要中不包含幻觉内容？

你构建了一个聊天机器人。它回答了“是”。你如何知道该答案有检索到的段落作为支撑？

你需要按主题对 10,000 篇新闻文章进行分类。你没有训练标签。能复用模型吗？

这三个问题都归结为自然语言推理。NLI 的问题是：给定前提 `t` 和假设 `h`，`h` 是被 `t` 蕴含、与之矛盾，还是中立（无关）？

- **幻觉检查：** `t` = 源文档，`h` = 摘要声明。不是蕴含 = 幻觉。
- **有据问答（Grounded QA）：** `t` = 检索到的段落，`h` = 生成的答案。不是蕴含 = 捏造。
- **零样本分类：** `t` = 文档，`h` = 以文字表述的标签（“这是关于体育的”）。蕴含 = 预测出的标签。

一个任务，三种生产用途。这就是为什么每个 RAG 评估框架底层都内置一个 NLI 模型的原因。

## 概念

![NLI: three-way classification, premise vs hypothesis](../assets/nli.svg)

**三个标签。**

- **蕴含（Entailment）。** `t` → `h`。“The cat is on the mat” 蕴含 “There is a cat.”。
- **矛盾（Contradiction）。** `t` → ¬`h`。“The cat is on the mat” 与 “There is no cat.” 矛盾。
- **中立（Neutral）。** 两个方向都不能推理。“The cat is on the mat” 相对于 “The cat is hungry.” 是中立的。

**不是逻辑蕴含。** NLI 是*自然*语言推理——一个典型的人类读者会推断出什么，而不是严格的逻辑。“John walked his dog” 在 NLI 中蕴含 “John has a dog”，但严格的一阶逻辑只有在将“拥有”关系公理化的情况下才会承认这一点。

**数据集。**

- **SNLI**（2015）。57 万个人工标注的对，以图像说明作为前提。领域较窄。
- **MultiNLI**（2017）。涵盖 10 种文体的 43.3 万个对。2026 年的标准训练语料库。
- **ANLI**（2019）。对抗性 NLI。人类专门撰写了旨在击溃现有模型的样本。更难。
- **DocNLI、ConTRoL**（2020–21）。文档级长度的前提。测试多跳和长程推理。

**架构。** 一个 Transformer 编码器（BERT、RoBERTa、DeBERTa）读取 `[CLS] premise [SEP] hypothesis [SEP]`。`[CLS]` 表示输入到一个三分类 softmax。在 MNLI 上训练，在保留的基准上评估，在分布内的样本上可获得 90% 以上的准确率。

**基于 NLI 的零样本分类。** 给定一个文档和候选标签，将每个标签转化为一个假设（“这段文本是关于体育的”）。计算每个假设的蕴含概率。取最大值。这就是 Hugging Face 的 `zero-shot-classification` 流水线背后的机制。

```figure
nli-router
```

## 动手构建

### 第 1 步：运行一个预训练的 NLI 模型

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

对于生产级 NLI，`facebook/bart-large-mnli` 和 `microsoft/deberta-v3-large-mnli` 是开源的默认选择。DeBERTa-v3 位居排行榜榜首。

### 第 2 步：零样本分类

```python
zs = pipeline("zero-shot-classification", model="facebook/bart-large-mnli")

text = "The stock market rallied after the central bank cut interest rates."
labels = ["finance", "sports", "politics", "technology"]

result = zs(text, candidate_labels=labels)
print(result)
# {'labels': ['finance', 'politics', 'technology', 'sports'],
#  'scores': [0.92, 0.05, 0.02, 0.01]}
```

默认模板为 “This example is about {label}.”。可以通过 `hypothesis_template` 进行自定义。无需训练数据。无需微调。开箱即用。

### 第 3 步：RAG 的忠实度检查

```python
def is_faithful(answer, context, threshold=0.5):
    result = nli({"text": context, "text_pair": answer})[0]
    entail = next(s for s in result if s["label"] == "entailment")
    return entail["score"] > threshold
```

这是 RAGAS 忠实度的核心。将生成的答案拆分为原子声明。针对检索到的上下文检查每个声明。报告蕴含的比例。

### 第 4 步：手写的 NLI 分类器（概念性）

参见 `code/main.py`，这是一个仅使用标准库的玩具实现：前提和假设通过词汇重叠 + 否定检测进行比较。与 Transformer 模型相比不具竞争力——但它展示了该任务的形态：输入两段文本，输出一个三分类标签，损失 = 在 `{entail, contradict, neutral}` 上的交叉熵。

## 陷阱

- **仅假设捷径（Hypothesis-only shortcuts）。** 模型可以仅凭假设预测标签，在 SNLI 上达到约 60% 的准确率，因为 “not”、“nobody”、“never” 与矛盾相关。这是检测标签泄露的有力基线。
- **词汇重叠启发式。** 子序列启发式（“每个子序列都被蕴含”）可以通过 SNLI，但在 HANS/ANLI 上会失败。请使用对抗性基准。
- **文档长度退化。** 单句 NLI 模型在文档级前提上 F1 下降 20 分以上。对于长上下文，请使用在 DocNLI 上训练的模型。
- **零样本模板敏感性。** “This example is about {label}” 对比 “{label}” 对比 “The topic is {label}” 可能使准确率波动 10 分以上。请调优模板。
- **领域不匹配。** MNLI 在通用英语上训练。法律、医学和科学文本需要特定领域的 NLI 模型（例如 SciNLI、MedNLI）。

## 应用

2026 年的技术栈：

| 用例 | 模型 |
|---------|-------|
| 通用 NLI | `microsoft/deberta-v3-large-mnli` |
| 快速 / 边缘 | `cross-encoder/nli-deberta-v3-base` |
| 零样本分类（轻量级） | `facebook/bart-large-mnli` |
| 文档级 NLI | `MoritzLaurer/DeBERTa-v3-large-mnli-fever-anli-ling-wanli` |
| 多语言 | `MoritzLaurer/multilingual-MiniLMv2-L6-mnli-xnli` |
| RAG 中的幻觉检测 | RAGAS / DeepEval 内置的 NLI 层 |

2026 年的元模式：NLI 是文本理解的万能胶。每当你需要回答 “A 是否支持 B？” 或 “A 是否与 B 矛盾？” 时——在调用另一个 LLM 之前，请优先选择 NLI。

## 上线部署

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

## 练习

1. **简单。** 在 20 个手工制作的覆盖所有三个类别的（前提、假设、标签）三元组上运行 `facebook/bart-large-mnli`。测量准确率。加入对抗性的“子序列启发式”陷阱（“I did not eat the cake” 对比 “I ate the cake”），看看它是否会失效。
2. **中等。** 在 100 条 AG News 标题上，对比零样本模板 `"This text is about {label}"` 与 `"The topic is {label}"` 和 `"{label}"`。报告准确率波动。
3. **困难。** 构建一个 RAG 忠实度检查器：原子声明分解 + 每个声明的 NLI。在 50 个带有标准（gold）上下文的 RAG 生成答案上进行评估。对照人工标注测量假阳性率和假阴性率。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|-----------------|-----------------------|
| NLI | 自然语言推理 | 对前提-假设关系进行三分类。 |
| RTE | 识别文本蕴含（Recognizing Textual Entailment） | NLI 的旧称；任务相同。 |
| 蕴含 | “t 推出 h” | 给定 t，典型读者会得出 h 为真的结论。 |
| 矛盾 | “t 排除 h” | 给定 t，典型读者会得出 h 为假的结论。 |
| 中立 | “未定” | 无法从 t 向 h 进行任何方向的推理。 |
| 零样本分类 | NLI 作为分类器 | 将标签表述为假设，取最大蕴含概率。 |
| 忠实度 | 答案是否有支撑？ | 对（检索到的上下文，生成的答案）进行 NLI。 |

## 延伸阅读

- [Bowman et al. (2015). A large annotated corpus for learning natural language inference](https://arxiv.org/abs/1508.05326) — SNLI。
- [Williams, Nangia, Bowman (2017). A Broad-Coverage Challenge Corpus for Sentence Understanding through Inference](https://arxiv.org/abs/1704.05426) — MultiNLI。
- [Nie et al. (2019). Adversarial NLI](https://arxiv.org/abs/1910.14599) — ANLI 基准。
- [Yin, Hay, Roth (2019). Benchmarking Zero-shot Text Classification](https://arxiv.org/abs/1909.00161) — NLI 作为分类器。
- [He et al. (2021). DeBERTa: Decoding-enhanced BERT with Disentangled Attention](https://arxiv.org/abs/2006.03654) — 2026 年的 NLI 主力模型。