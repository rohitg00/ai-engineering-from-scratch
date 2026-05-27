# 自然语言推理——文本蕴含（Natural Language Inference — Textual Entailment）

> "t 蕴含 h" 意味着人类阅读 t 后能推断出 h 为真。自然语言推理（NLI）就是预测蕴含/矛盾/中性的任务。表面看似简单，生产环境中却至关重要。

**类型：** 学习
**语言：** Python
**先修知识：** 阶段5 · 05（情感分析），阶段5 · 13（问答）
**时间：** 约60分钟

## 问题

你构建了一个摘要器，它生成了一个摘要。你如何知道摘要中没有幻觉？

你构建了一个聊天机器人，它回答了"是"。你如何知道这个答案得到了检索段落的支持？

你需要按主题分类10,000篇新闻文章，但没有训练标签。你能重复使用一个模型吗？

这三个问题都归结为自然语言推理（NLI）。NLI 提出：给定前提 `t` 和假设 `h`，`h` 是否被 `t` 蕴含、是否与 `t` 矛盾，或是中性（无关）？

- **幻觉检测：** `t` = 源文档，`h` = 摘要中的声明。不是蕴含 = 幻觉。
- **基于上下文的问答：** `t` = 检索到的段落，`h` = 生成的答案。不是蕴含 = 捏造。
- **零样本分类：** `t` = 文档，`h` = 用语言表述的标签（"这篇是关于体育的"）。蕴含 = 预测的标签。

一个任务，三个生产用途。这就是为什么每个RAG评估框架都在底层内置了一个NLI模型。

## 概念

![NLI：三路分类，前提 vs. 假设](../assets/nli.svg)

**三种标签。**

- **蕴含（Entailment）。** `t` → `h`。"猫在垫子上"蕴含"有一只猫"。
- **矛盾（Contradiction）。** `t` → ¬`h`。"猫在垫子上"与"没有猫"矛盾。
- **中性（Neutral）。** 无法推断。"猫在垫子上"与"猫饿了"是中性关系。

**不是逻辑蕴含。** NLI 是*自然*语言推理——典型人类读者会推断出的东西，而不是严格的逻辑。"约翰遛狗了"在NLI中蕴含"约翰有一条狗"，但严格的一阶逻辑只有在你将"拥有"公理化后才会承认这一点。

**数据集。**

- **SNLI**（2015）。57万个人工标注对，使用图片标题作为前提。领域较窄。
- **MultiNLI**（2017）。43.3万个对，跨越10种体裁。2026年的标准训练语料。
- **ANLI**（2019）。对抗性NLI（Adversarial NLI）。人类专门编写了旨在打破现有模型的示例。难度更大。
- **DocNLI, ConTRoL**（2020–21）。文档长度的前提。测试多跳和长距离推理。

**架构。** 一个Transformer编码器（BERT, RoBERTa, DeBERTa）读取 `[CLS] 前提 [SEP] 假设 [SEP]`。`[CLS]` 的表示送入一个3路softmax。在MNLI上训练，在保留的基准上评估，在分布内对上可获得90%以上的准确率。

**通过NLI进行零样本分类。** 给定一个文档和候选标签，将每个标签转化为一个假设（"本文是关于体育的"）。计算每个标签的蕴含概率。选取最大值。这就是Hugging Face的 `zero-shot-classification` 管线的底层机制。

## 动手构建

### 步骤 1：运行预训练的NLI模型

```python
from transformers import pipeline

nli = pipeline("text-classification",
               model="facebook/bart-large-mnli",
               top_k=None)  # 返回所有标签；替代已弃用的 return_all_scores=True

premise = "The cat is sleeping on the couch."
hypothesis = "There is a cat in the room."

result = nli({"text": premise, "text_pair": hypothesis})[0]
print(result)
# [{'label': 'entailment', 'score': 0.97},
#  {'label': 'neutral', 'score': 0.02},
#  {'label': 'contradiction', 'score': 0.01}]
```

对于生产环境的NLI，`facebook/bart-large-mnli` 和 `microsoft/deberta-v3-large-mnli` 是默认的开源选择。DeBERTa-v3 在排行榜上领先。

### 步骤 2：零样本分类

```python
zs = pipeline("zero-shot-classification", model="facebook/bart-large-mnli")

text = "The stock market rallied after the central bank cut interest rates."
labels = ["finance", "sports", "politics", "technology"]

result = zs(text, candidate_labels=labels)
print(result)
# {'labels': ['finance', 'politics', 'technology', 'sports'],
#  'scores': [0.92, 0.05, 0.02, 0.01]}
```

默认模板是 "This example is about {label}。" 可以通过 `hypothesis_template` 自定义。无需训练数据，无需微调。开箱即用。

### 步骤 3：RAG 的忠实性检查

```python
def is_faithful(answer, context, threshold=0.5):
    result = nli({"text": context, "text_pair": answer})[0]
    entail = next(s for s in result if s["label"] == "entailment")
    return entail["score"] > threshold
```

这是 RAGAS 忠实性（faithfulness）的核心。将生成的答案分解为原子声明（atomic claims）。针对每个声明检查其是否被检索到的上下文蕴含。报告蕴含的比例。

### 步骤 4：手工实现的NLI分类器（概念性）

参见 `code/main.py`，这是一个仅使用标准库的玩具示例：前提和假设通过词汇重叠 + 否定检测进行比较。虽然无法与Transformer模型竞争，但它展示了任务的基本模式：输入两个文本，输出三个标签，损失函数是 `{蕴含, 矛盾, 中性}` 上的交叉熵。

## 陷阱

- **仅依赖假设的捷径。** 模型可以在 SNLI 上仅根据假设预测标签，准确率高达约60%，因为"not"、"nobody"、"never"等词与矛盾相关。这是检测标签泄漏的强基线。
- **词汇重叠启发式。** 子序列启发式（"每个子序列都被蕴含"）能通过 SNLI，但在 HANS/ANLI 上会失败。请使用对抗性基准。
- **文档长度退化。** 单句 NLI 模型在处理文档长度前提时F1分数会下降20以上。对于长上下文，请使用在 DocNLI 上训练的模型。
- **零样本模板敏感性。** "This example is about {label}" 与 "{label}" 与 "The topic is {label}" 相比，准确率可能相差10个点以上。请调整模板。
- **领域不匹配。** MNLI 训练于通用英语。法律、医学和科学文本需要领域特定的NLI模型（例如 SciNLI, MedNLI）。

## 使用它

2026年的技术栈：

| 使用场景 | 模型 |
|---------|------|
| 通用NLI | `microsoft/deberta-v3-large-mnli` |
| 快速/边缘计算 | `cross-encoder/nli-deberta-v3-base` |
| 零样本分类（轻量级） | `facebook/bart-large-mnli` |
| 文档级NLI | `MoritzLaurer/DeBERTa-v3-large-mnli-fever-anli-ling-wanli` |
| 多语言 | `MoritzLaurer/multilingual-MiniLMv2-L6-mnli-xnli` |
| RAG中的幻觉检测 | RAGAS / DeepEval 内部的NLI层 |

2026年的元模式：NLI是文本理解的万能胶。每当你需要回答"A支持B吗？"或"A与B矛盾吗？"时，先考虑NLI，而不是再调用一次LLM。

## 发布它

保存为 `outputs/skill-nli-picker.md`：

```markdown
---
name: nli-picker
description: 为分类/忠实性/零样本任务选择NLI模型、标签模板和评估设置。
version: 1.0.0
phase: 5
lesson: 21
tags: [nlp, nli, zero-shot]
---

给定一个使用场景（忠实性检查、零样本分类、文档级推理），输出：

1. 模型。命名的NLI检查点。理由需与领域、长度、语言相关。
2. 模板（如果是零样本）。语言表述模式。示例。
3. 阈值。决策规则中的蕴含截断值。基于校准的理由。
4. 评估。在保留的标注集上的准确率，仅依赖假设的基线，对抗性子集。

在没有100个示例的标注版本进行检查之前，拒绝发布零样本分类。拒绝在文档长度前提上使用句子级NLI模型。对于任何声称NLI能解决幻觉的说法，都要提出质疑——NLI只能减少幻觉，不能消除它。
```

## 练习

1. **简单。** 运行 `facebook/bart-large-mnli` 在20个手工构造的（前提，假设，标签）三元组上，覆盖三个类别。计算准确率。添加对抗性的"子序列启发式"陷阱（如"I did not eat the cake" vs "I ate the cake"），看它是否会出错。
2. **中等。** 在100个AG新闻标题上，比较零样本模板 `"This text is about {label}"` vs `"The topic is {label}"` vs `"{label}"`。报告准确率波动。
3. **困难。** 构建一个RAG忠实性检查器：原子声明分解 + 每个声明的NLI。在50个RAG生成的答案（含黄金上下文）上进行评估。与人工标签对比，衡量假阳性和假阴性率。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------|---------|
| NLI | 自然语言推理（Natural Language Inference） | 对前提-假设关系进行三路分类。 |
| RTE | 识别文本蕴含（Recognizing Textual Entailment） | NLI的旧称；同一任务。 |
| 蕴含（Entailment） | "t 蕴含 h" | 给定 t，典型读者会推断 h 为真。 |
| 矛盾（Contradiction） | "t 排除 h" | 给定 t，典型读者会推断 h 为假。 |
| 中性（Neutral） | "未决定" | 从 t 到 h 无法进行任何推断。 |
| 零样本分类（Zero-shot classification） | 将NLI用作分类器 | 将标签表述为假设，选取最大蕴含概率。 |
| 忠实性（Faithfulness） | 答案是否得到支持？ | 对（检索到的上下文，生成的答案）进行NLI。 |

## 延伸阅读

- [Bowman等人 (2015). 用于学习自然语言推理的大规模标注语料库](https://arxiv.org/abs/1508.05326) — SNLI。
- [Williams, Nangia, Bowman (2017). 通过推理进行句子理解的广泛覆盖挑战语料库](https://arxiv.org/abs/1704.05426) — MultiNLI。
- [Nie等人 (2019). 对抗性NLI](https://arxiv.org/abs/1910.14599) — ANLI基准。
- [Yin, Hay, Roth (2019). 零样本文本分类的基准测试](https://arxiv.org/abs/1909.00161) — NLI作为分类器。
- [He等人 (2021). DeBERTa：使用解耦注意力增强解码的BERT](https://arxiv.org/abs/2006.03654) — 2026年NLI的主力模型。