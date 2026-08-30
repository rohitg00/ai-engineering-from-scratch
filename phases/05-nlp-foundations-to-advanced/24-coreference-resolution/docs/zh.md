# 24 · 指代消解

> "She called him. He did not answer. The doctor was at lunch."（她给他打了电话。他没有接。医生当时正在吃午饭。）三处指称对应两个人，且没有任何一处直接点名。指代消解（coreference resolution）就是要弄清楚谁是谁。

**类型：** 学习
**语言：** Python
**前置：** 阶段 5 · 06（NER）、阶段 5 · 07（词性标注与句法分析）
**时长：** 约 60 分钟

## 问题所在

从一篇 300 词的文章里抽取出对 Apple Inc. 的每一处提及。当文章直接写「Apple」时很简单；但当它写「the company（这家公司）」「they（他们）」「Cupertino's technology giant（库比蒂诺的科技巨头）」或「Jobs's firm（乔布斯的公司）」时就很难了。如果不把这些提及（mention）都归并到同一个实体，你的 NER 流水线会漏掉 60%-80% 的提及。

指代消解把所有指向同一现实世界实体的表达式链接进一个簇（cluster）。它是表层 NLP（NER、句法分析）与下游语义任务（信息抽取、问答、摘要、知识图谱）之间的黏合剂。

为什么它在 2026 年依然重要：

- 摘要：「The CEO announced...（这位 CEO 宣布……）」对比「Tim Cook announced...（蒂姆·库克宣布……）」——摘要应当点明这位 CEO 是谁。
- 问答：「Who did she call?（她给谁打了电话？）」需要先消解「she」。
- 信息抽取：知识图谱里把「PER1 founded Apple」和「Jobs founded Apple」当成两条独立条目就是错的。
- 跨文档信息抽取：合并多篇文章中针对同一事件的提及，属于跨文档指代（cross-document coreference）。

## 核心概念

〔图：指代聚类——把提及归并到实体〕

**任务定义。** 输入：一篇文档。输出：对提及（span，文本跨度）的一种聚类，其中每个簇指向一个实体。

**提及类型。**

- **命名实体（Named entity）。** 「Tim Cook」
- **名词性（Nominal）。** 「the CEO」「the company」
- **代词性（Pronominal）。** 「he」「she」「they」「it」
- **同位语（Appositive）。** 「Tim Cook, Apple's CEO,」

**架构。**

1. **基于规则（Hobbs，1978）。** 基于句法树、用语法规则进行代词消解。是个不错的基线，并且在代词消解上出人意料地难以超越。
2. **提及对分类器（Mention-pair classifier）。** 对每一对提及 (m_i, m_j)，预测它们是否共指。再通过传递闭包（transitive closure）聚类。是 2016 年之前的标准做法。
3. **提及排序（Mention-ranking）。** 对每个提及，对候选先行词（antecedent，包括「无先行词」）进行排序，取排名最高的。
4. **基于跨度的端到端模型（span-based end-to-end，Lee 等人，2017）。** 用 Transformer 编码器，枚举所有长度不超过上限的候选跨度，预测提及得分，再为每个跨度预测先行词概率，最后贪心聚类。是当下的默认方案。
5. **生成式（2024 年起）。** 给 LLM 一个提示词：「列出本文中的每个代词及其先行词。」在简单情形下表现不错，但在长文档和罕见指称对象上表现吃力。

**评估指标。** 共有五个标准指标（MUC、B³、CEAF、BLANC、LEA），因为没有任何单一指标能完整刻画聚类质量。通常把前三者的平均值作为 CoNLL F1 上报。2026 年 CoNLL-2012 上的最先进水平：约 83 F1。

**已知的困难案例。**

- 指向数页之前才引入的实体的定指描述（definite description）。
- 桥接照应（bridging anaphora）：「the wheels」→ 之前提到的某辆车。
- 中文、日文等语言中的零照应（zero anaphora）。
- 后指（cataphora，代词出现在指称对象之前）：「When **she** walked in, Mary smiled.（当**她**走进来时，玛丽笑了。）」

## 动手实现

### 第 1 步：预训练神经指代模型（AllenNLP / spaCy-experimental）

```python
import spacy
nlp = spacy.load("en_coreference_web_trf")   # 实验性模型
doc = nlp("Apple announced new products. The company said they would ship soon.")
for cluster in doc._.coref_clusters:
    print(cluster, "->", [m.text for m in cluster])
```

在一篇较长的文档上，你会得到类似这样的结果：
- 簇 1：[Apple, The company, they]
- 簇 2：[new products]

### 第 2 步：基于规则的代词消解器（教学用途）

参见 `code/main.py`，那是一个仅依赖标准库（stdlib-only）的实现：

1. 抽取提及：命名实体（首字母大写的跨度）、代词（字典查表）、定指描述（「the X」）。
2. 对每个代词，查看其前面的 K 个提及，并按如下因素打分：
   - 性别/数的一致性（启发式）
   - 就近性（越近越优）
   - 句法角色（优先选主语）
3. 链接到得分最高的先行词。

它无法与神经模型竞争，但它展示了搜索空间，以及端到端模型必须做出的各种决策。

### 第 3 步：用 LLM 做指代消解

```python
prompt = f"""Text: {text}

List every pronoun and noun phrase that refers to a person or company.
Cluster them by what they refer to. Output JSON:
[{{"entity": "Apple", "mentions": ["Apple", "the company", "it"]}}, ...]
"""
```

要留意两种失败模式。其一，LLM 会过度合并（把指向两个不同人的「him」和「her」并到一起）。其二，LLM 在长文档中会悄悄漏掉一些提及。务必用跨度偏移（span-offset）校验来核对。

### 第 4 步：评估

标准的 conll-2012 脚本会计算 MUC、B³、CEAF-φ4 并上报其平均值。如果要做内部评估，可先从带标注测试集上的跨度级（span-level）精确率与召回率入手，再加上提及链接 F1（mention-linking F1）。

## 常见陷阱

- **单例爆炸（Singleton explosion）。** 有些系统会把每个提及都报告为各自独立的簇。B³ 对此较为宽容，而 MUC 会严厉惩罚。务必同时检查这三个指标。
- **长上下文中的代词。** 在超过 2000 个 token 的文档上，性能会下降约 15 F1。要谨慎分块（chunk）。
- **性别假设。** 硬编码的性别规则在非二元（non-binary）指称对象、组织机构、动物上会失效。请使用学习得到的模型或中性打分。
- **LLM 在长文档上的漂移。** 单次 API 调用无法可靠地在 50 多个段落间聚类提及。请使用滑动窗口（sliding-window）+ 合并的方式。

## 实战运用

2026 年的技术栈：

| 场景 | 选型 |
|-----------|------|
| 英文、单文档 | `en_coreference_web_trf`（spaCy-experimental）或 AllenNLP 神经指代模型 |
| 多语言 | 在 OntoNotes 或 Multilingual CoNLL 上训练的 SpanBERT / XLM-R |
| 跨文档事件指代 | 专用的端到端模型（2025–26 年 SOTA） |
| 快速 LLM 基线 | GPT-4o / Claude 配结构化输出指代提示词 |
| 生产级对话系统 | 基于规则的兜底 + 神经模型为主 + 关键槽位的人工复核 |

2026 年实际落地的集成模式：先跑 NER，再跑指代消解，然后把指代簇合并进 NER 实体。下游任务看到的是每个簇一个实体，而不是每个提及一个实体。

## 交付产物

保存为 `outputs/skill-coref-picker.md`：

```markdown
---
name: coref-picker
description: Pick a coreference approach, evaluation plan, and integration strategy.
version: 1.0.0
phase: 5
lesson: 24
tags: [nlp, coref, information-extraction]
---

Given a use case (single-doc / multi-doc, domain, language), output:

1. Approach. Rule-based / neural span-based / LLM-prompted / hybrid. One-sentence reason.
2. Model. Named checkpoint if neural.
3. Integration. Order of operations: tokenize → NER → coref → downstream task.
4. Evaluation. CoNLL F1 (MUC + B³ + CEAF-φ4 average) on held-out set + manual cluster review on 20 documents.

Refuse LLM-only coref for documents over 2,000 tokens without sliding-window merge. Refuse any pipeline that runs coref without a mention-level precision-recall report. Flag gender-heuristic systems deployed in demographically diverse text.
```

## 练习

1. **简单。** 在 5 个手工编写的段落上运行 `code/main.py` 中的基于规则的消解器。对照真实标注（ground truth）测量提及链接准确率。
2. **中等。** 在一篇新闻文章上使用预训练神经指代模型。把其聚类结果与你自己的人工标注作对比。它在哪里出错了？
3. **困难。** 构建一条由指代增强的 NER 流水线：先做 NER，再通过指代簇合并。在 100 篇文章上测量相对于纯 NER 的实体覆盖率提升。

## 关键术语

| 术语 | 人们怎么说 | 它实际指什么 |
|------|-----------------|-----------------------|
| 提及（Mention） | 一处指称 | 指向某个实体的一段文本跨度（名称、代词、名词短语）。 |
| 先行词（Antecedent） | 「它」指的是谁 | 后出现的提及所共指的那个更早出现的提及。 |
| 簇（Cluster） | 该实体的诸提及 | 全部指向同一现实世界实体的提及集合。 |
| 前指/照应（Anaphora） | 向后指称 | 后出现的提及指向先出现的（「he」→「John」）。 |
| 后指（Cataphora） | 向前指称 | 先出现的提及指向后出现的（「When he arrived, John...」）。 |
| 桥接（Bridging） | 隐式指称 | 「I bought a car. The wheels were bad.」（指那辆车的轮子。） |
| CoNLL F1 | 排行榜上的那个数字 | MUC、B³、CEAF-φ4 三个 F1 分数的平均值。 |

## 延伸阅读

- [Jurafsky & Martin, SLP3 第 26 章 — 指代消解与实体链接](https://web.stanford.edu/~jurafsky/slp3/26.pdf) — 权威教科书章节。
- [Lee 等人（2017）。End-to-end Neural Coreference Resolution](https://arxiv.org/abs/1707.07045) — 基于跨度的端到端方法。
- [Joshi 等人（2020）。SpanBERT](https://arxiv.org/abs/1907.10529) — 能改善指代消解的预训练方法。
- [Pradhan 等人（2012）。CoNLL-2012 Shared Task](https://aclanthology.org/W12-4501/) — 基准数据集。
- [Hobbs（1978）。Resolving Pronoun References](https://www.sciencedirect.com/science/article/pii/0024384178900064) — 基于规则的经典之作。
