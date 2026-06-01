# 21 · 自然语言推理——文本蕴含

> 「t 蕴含 h」意味着，一个阅读 t 的人会得出 h 为真的结论。自然语言推理（NLI）就是预测蕴含 / 矛盾 / 中立这三种关系的任务。表面平平无奇，在生产环境里却是承重梁。

**类型：** 学习
**语言：** Python
**前置：** 第 5 阶段 · 05（情感分析），第 5 阶段 · 13（问答）
**时长：** 约 60 分钟

## 问题所在

你做了一个摘要器，它生成了一段摘要。你怎么知道这段摘要里没有夹带幻觉（hallucination）？

你做了一个聊天机器人，它回答了「是」。你怎么知道这个答案是被检索到的段落所支持的？

你需要把 10,000 篇新闻文章按主题分类，但你没有任何训练标签。你能复用一个现成的模型吗？

这三个问题都可以归约为自然语言推理（Natural Language Inference，NLI）。NLI 要问的是：给定一个前提（premise）`t` 和一个假设（hypothesis）`h`，`h` 是被 `t` 所蕴含、与之矛盾，还是中立（互不相关）？

- **幻觉检测：** `t` = 源文档，`h` = 摘要中的论断。不构成蕴含 = 幻觉。
- **有据问答（Grounded QA）：** `t` = 检索到的段落，`h` = 生成的答案。不构成蕴含 = 凭空捏造。
- **零样本分类（Zero-shot classification）：** `t` = 文档，`h` = 语言化的标签（「这是关于体育的」）。构成蕴含 = 预测出的标签。

一个任务，三种生产用途。这正是为什么每一个 RAG 评估框架的底层都内置了一个 NLI 模型。

## 核心概念

〔图：NLI 三分类示意，前提对比假设〕

**三种标签。**

- **蕴含（Entailment）。** `t` → `h`。「猫趴在垫子上」蕴含「有一只猫」。
- **矛盾（Contradiction）。** `t` → ¬`h`。「猫趴在垫子上」与「没有猫」相矛盾。
- **中立（Neutral）。** 任何方向都无法推断。「猫趴在垫子上」对「猫饿了」是中立的。

**不是逻辑蕴含。** NLI 是*自然*语言推理——它关注一个普通人类读者会推断出什么，而非严格的逻辑。在 NLI 中，「John 遛了他的狗」蕴含「John 有一只狗」；但严格的一阶逻辑只有在你把「拥有」公理化之后才会承认这一点。

**数据集。**

- **SNLI**（2015）。57 万条人工标注的句对，以图像描述作为前提。领域较窄。
- **MultiNLI**（2017）。43.3 万条句对，覆盖 10 种文体（genre）。是 2026 年的标准训练语料。
- **ANLI**（2019）。对抗式 NLI。由人类专门撰写、旨在击垮现有模型的样本。难度更高。
- **DocNLI、ConTRoL**（2020–21）。前提为文档级长度。考查多跳（multi-hop）和长程推理能力。

**模型架构。** 一个 Transformer 编码器（BERT、RoBERTa、DeBERTa）读入 `[CLS] premise [SEP] hypothesis [SEP]`。`[CLS]` 的表征送入一个三分类 softmax。在 MNLI 上训练，在留出的基准集上评估，在同分布句对上可达到 90% 以上的准确率。

**借助 NLI 实现零样本。** 给定一个文档和若干候选标签，把每个标签都转化为一个假设（「这段文本是关于体育的」）。为每个假设计算蕴含概率。取最大值。这正是 Hugging Face 的 `zero-shot-classification` 流水线背后的机制。

## 动手构建

### 第 1 步：运行一个预训练的 NLI 模型

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

在生产环境的 NLI 中，`facebook/bart-large-mnli` 和 `microsoft/deberta-v3-large-mnli` 是开源的默认之选。DeBERTa-v3 在排行榜上名列前茅。

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

默认模板是 "This example is about {label}."。可通过 `hypothesis_template` 自定义。无需训练数据，无需微调，开箱即用。

### 第 3 步：为 RAG 做忠实度（faithfulness）检查

```python
def is_faithful(answer, context, threshold=0.5):
    result = nli({"text": context, "text_pair": answer})[0]
    entail = next(s for s in result if s["label"] == "entailment")
    return entail["score"] > threshold
```

这就是 RAGAS 忠实度的核心。把生成的答案拆分成一个个原子论断（atomic claim）。逐一对照检索到的上下文核查每条论断。报告其中构成蕴含的比例。

### 第 4 步：手写一个 NLI 分类器（概念演示）

参见 `code/main.py`，那是一个仅依赖标准库的玩具实现：通过词汇重叠（lexical overlap）+ 否定检测来比较前提和假设。它在性能上无法与 Transformer 模型抗衡——但它展示了这个任务的基本形态：输入两段文本，输出三分类标签，损失 = 在 `{entail, contradict, neutral}` 上的交叉熵（cross-entropy）。

## 易踩的坑

- **仅凭假设的捷径（Hypothesis-only shortcuts）。** 在 SNLI 上，模型仅凭假设这一项就能以约 60% 的准确率预测标签，因为「not」「nobody」「never」与矛盾标签相关。可用作检测标签泄漏（label leakage）的强基线。
- **词汇重叠启发式（Lexical overlap heuristic）。** 子序列启发式（「每个子序列都构成蕴含」）能通过 SNLI，却在 HANS/ANLI 上失效。请使用对抗式基准。
- **文档长度带来的退化。** 单句 NLI 模型在文档级前提上会掉 20 分以上的 F1。长上下文请使用经 DocNLI 训练的模型。
- **零样本模板的敏感性。** "This example is about {label}" 与 "{label}" 与 "The topic is {label}" 之间，准确率可能相差 10 分以上。请调优模板。
- **领域不匹配。** MNLI 在通用英语上训练。法律、医疗和科学文本需要领域专用的 NLI 模型（例如 SciNLI、MedNLI）。

## 实践运用

2026 年的技术栈：

| 使用场景 | 模型 |
|---------|-------|
| 通用 NLI | `microsoft/deberta-v3-large-mnli` |
| 快速 / 边缘部署 | `cross-encoder/nli-deberta-v3-base` |
| 零样本分类（轻量） | `facebook/bart-large-mnli` |
| 文档级 NLI | `MoritzLaurer/DeBERTa-v3-large-mnli-fever-anli-ling-wanli` |
| 多语言 | `MoritzLaurer/multilingual-MiniLMv2-L6-mnli-xnli` |
| RAG 中的幻觉检测 | RAGAS / DeepEval 内部的 NLI 层 |

2026 年的元模式（meta-pattern）：NLI 是文本理解领域的万能胶带。每当你需要判断「A 是否支持 B？」或「A 是否与 B 矛盾？」时——先考虑用 NLI，再考虑发起又一次 LLM 调用。

## 交付落地

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

1. **简单。** 在 20 条手工构造的（前提，假设，标签）三元组上运行 `facebook/bart-large-mnli`，覆盖全部三个类别。测量准确率。加入对抗式的「子序列启发式」陷阱（「I did not eat the cake」对「I ate the cake」），看它会不会被攻破。
2. **中等。** 在 100 条 AG News 标题上，比较零样本模板 `"This text is about {label}"` 与 `"The topic is {label}"` 以及 `"{label}"` 的表现。报告准确率的波动幅度。
3. **困难。** 构建一个 RAG 忠实度检查器：原子论断分解 + 逐条论断做 NLI。在 50 条带黄金（gold）上下文的 RAG 生成答案上评估。相对人工标注，测量假阳性率和假阴性率。

## 关键术语

| 术语 | 人们怎么说 | 它实际的含义 |
|------|-----------------|-----------------------|
| NLI | 自然语言推理（Natural Language Inference） | 对前提-假设关系的三分类。 |
| RTE | 文本蕴含识别（Recognizing Textual Entailment） | NLI 的旧称；同一个任务。 |
| 蕴含（Entailment） | 「t 推出 h」 | 给定 t，一个普通读者会得出 h 为真的结论。 |
| 矛盾（Contradiction） | 「t 排除了 h」 | 给定 t，一个普通读者会得出 h 为假的结论。 |
| 中立（Neutral） | 「无法判定」 | 从 t 到 h 任何方向都无法推断。 |
| 零样本分类 | 把 NLI 当作分类器 | 把标签语言化为假设，取蕴含概率最大者。 |
| 忠实度（Faithfulness） | 答案有没有依据？ | 在（检索到的上下文，生成的答案）上做 NLI。 |

## 延伸阅读

- [Bowman et al. (2015). A large annotated corpus for learning natural language inference](https://arxiv.org/abs/1508.05326) —— SNLI。
- [Williams, Nangia, Bowman (2017). A Broad-Coverage Challenge Corpus for Sentence Understanding through Inference](https://arxiv.org/abs/1704.05426) —— MultiNLI。
- [Nie et al. (2019). Adversarial NLI](https://arxiv.org/abs/1910.14599) —— ANLI 基准。
- [Yin, Hay, Roth (2019). Benchmarking Zero-shot Text Classification](https://arxiv.org/abs/1909.00161) —— 把 NLI 当作分类器。
- [He et al. (2021). DeBERTa: Decoding-enhanced BERT with Disentangled Attention](https://arxiv.org/abs/2006.03654) —— 2026 年的 NLI 主力模型。
