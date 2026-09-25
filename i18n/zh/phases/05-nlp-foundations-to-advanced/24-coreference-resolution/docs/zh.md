# 指代消解

> "She called him. He did not answer. The doctor was at lunch." 两个共三个人称指代，却没有一个名字。指代消解要弄清谁是谁。

**Type:** Learn
**Languages:** Python
**Prerequisites:** Phase 5 · 06（NER）、Phase 5 · 07（POS 与句法分析）
**Time:** ~60 分钟

## 问题所在

从一篇 300 词的文章中提取 Apple Inc. 的每一次提及。当文章直接写 "Apple" 时很简单。但当文章写 "the company"、"they"、"Cupertino's technology giant" 或 "Jobs's firm" 时就难了。如果不能把这些提及解析到同一实体，你的 NER 流水线会漏掉 60-80% 的提及。

指代消解把所有指向同一现实世界实体的表达式链接成一个聚类。它是表层 NLP（NER、句法分析）与下游语义任务（信息抽取、问答、摘要、知识图谱）之间的粘合剂。

为什么它在 2026 年依然重要：

- 摘要："The CEO announced..." 还是 "Tim Cook announced..." — 摘要应该写出 CEO 的名字。
- 问答："Who did she call?" 需要解析 "she"。
- 信息抽取：知识图谱中把 "PER1 founded Apple" 和 "Jobs founded Apple" 作为两条独立条目是错误的。
- 跨文档信息抽取：跨文章合并关于同一事件的提及属于跨文档指代消解。

## 核心概念

![Coreference clustering: mentions → entities](../assets/coref.svg)

**任务定义。** 输入：一篇文档。输出：提及（span）的聚类，每个聚类对应一个实体。

**提及类型。**

- **命名实体。** "Tim Cook"
- **名词性提及。** "the CEO"、"the company"
- **代词性提及。** "he"、"she"、"they"、"it"
- **同位语。** "Tim Cook, Apple's CEO,"

**架构。**

1. **基于规则（Hobbs, 1978）。** 基于句法树和语法规则的代词消解。很好的基线。在代词上出奇地难以超越。
2. **提及对分类器。** 对每一对提及 (m_i, m_j)，预测它们是否共指。通过传递闭包聚类。2016 年前的标准做法。
3. **提及排序。** 对每个提及，对候选先行语排序（包括"无先行语"）。取排名第一者。
4. **基于 span 的端到端方法（Lee et al., 2017）。** Transformer 编码器。枚举长度上限内所有候选 span。预测提及得分。为每个 span 预测先行语概率。贪心聚类。现代默认方案。
5. **生成式方法（2024+）。** 提示 LLM："列出这段文本中的每个代词及其先行语。" 在简单案例上表现良好，在长文档和罕见指称对象上表现挣扎。

**评测指标。** 五个标准指标（MUC、B³、CEAF、BLANC、LEA），因为没有单一指标能刻画聚类质量。通常报告前三个的平均值作为 CoNLL F1。2026 年 CoNLL-2012 上的最先进水平：约 83 F1。

**已知的困难案例。**

- 指称对象在数页之前才引入的定指描述。
- 桥接指代（"the wheels" → 之前提到的某辆车）。
- 中文、日语等语言中的零形指代。
- 前指（代词先于指称对象出现）："When **she** walked in, Mary smiled."

```figure
coref-links
```

## 动手构建

### 步骤 1：预训练神经指代消解（AllenNLP / spaCy-experimental）

```python
import spacy
nlp = spacy.load("en_coreference_web_trf")   # experimental model
doc = nlp("Apple announced new products. The company said they would ship soon.")
for cluster in doc._.coref_clusters:
    print(cluster, "->", [m.text for m in cluster])
```

在更长的文档上，你会得到类似的结果：
- 聚类 1：[Apple, The company, they]
- 聚类 2：[new products]

### 步骤 2：基于规则的代词消解器（教学用途）

见 `code/main.py` 的仅用标准库实现：

1. 提取提及：命名实体（大写开头的 span）、代词（词典查找）、定指描述（"the X"）。
2. 对每个代词，查看前 K 个提及并按以下标准打分：
   - 性别/数一致性（启发式）
   - 位置邻近度（越近越好）
   - 句法角色（主语优先）
3. 链接得分最高的先行语。

无法与神经模型竞争。但它展示了搜索空间以及端到端模型必须做出的决策。

### 步骤 3：用 LLM 做指代消解

```python
prompt = f"""Text: {text}

List every pronoun and noun phrase that refers to a person or company.
Cluster them by what they refer to. Output JSON:
[{{"entity": "Apple", "mentions": ["Apple", "the company", "it"]}}, ...]
"""
```

需要警惕两种失败模式。第一，LLM 过度合并（把指代两个不同的人的 "him" 和 "her" 合并）。第二，LLM 在长文档中会悄悄丢弃提及。务必用 span 偏移校验来核实。

### 步骤 4：评测

标准 conll-2012 脚本计算 MUC、B³、CEAF-φ4 并报告平均值。对于内部评测，先在标注测试集上计算 span 级精确率和召回率，再加入提及链接 F1。

## 常见陷阱

- **单例爆炸。** 某些系统把每个提及都报告为独立聚类。B³ 对此宽松。MUC 会惩罚这种行为。务必检查全部三个指标。
- **长上下文中的代词。** 超过 2,000 token 的文档性能下降约 15 F1。谨慎分块。
- **性别假设。** 硬编码的性别规则在非二元指称对象、组织、动物上会失效。使用学习得到的模型或中性打分。
- **LLM 在长文档上的漂移。** 单次 API 调用无法可靠地对跨 50+ 段落的提及聚类。使用滑动窗口 + 合并。

## 如何选用

2026 年的技术选型：

| 场景 | 选择 |
|-----------|------|
| 英语、单文档 | `en_coreference_web_trf`（spaCy-experimental）或 AllenNLP 神经 coref |
| 多语言 | SpanBERT / XLM-R，在 OntoNotes 或 Multilingual CoNLL 上训练 |
| 跨文档事件指代消解 | 专门的端到端模型（2025–26 SOTA） |
| 快速 LLM 基线 | GPT-4o / Claude，配合结构化输出的 coref 提示 |
| 生产级对话系统 | 规则兜底 + 神经主模型 + 关键槽位人工审核 |

2026 年实际落地的集成模式：先运行 NER，再运行指代消解，把 coref 聚类合并进 NER 实体。下游任务看到的每个聚类只有一个实体，而不是每个提及一个实体。

## 上线部署

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

1. **简单。** 在 5 段手工构造的段落上运行 `code/main.py` 中的基于规则的消解器。对照标准答案测量提及链接准确率。
2. **中等。** 在一篇新闻文章上使用预训练神经 coref 模型。将聚类结果与你自己的手工标注对比。它在哪里失败了？
3. **困难。** 构建一个 coref 增强的 NER 流水线：先 NER，再通过 coref 聚类合并。在 100 篇文章上测量相比纯 NER 的实体覆盖率提升。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|-----------------------|
| 提及（Mention） | 一个指称 | 指向某实体的文本 span（名称、代词、名词短语）。 |
| 先行语（Antecedent） | "it" 指的东西 | 被后续提及共指的较早提及。 |
| 聚类（Cluster） | 实体的所有提及 | 全部指向同一现实世界实体的提及集合。 |
| 后指（Anaphora） | 向后指称 | 较晚的提及指向较早的（"he" → "John"）。 |
| 前指（Cataphora） | 向前指称 | 较早的提及指向较晚的（"When he arrived, John..."）。 |
| 桥接（Bridging） | 隐式指称 | "I bought a car. The wheels were bad."（那辆车的轮子。） |
| CoNLL F1 | 排行榜上的数字 | MUC、B³、CEAF-φ4 F1 分数的平均值。 |

## 延伸阅读

- [Jurafsky & Martin, SLP3 Ch. 26 — Coreference Resolution and Entity Linking](https://web.stanford.edu/~jurafsky/slp3/26.pdf) — 经典教材章节。
- [Lee et al. (2017). End-to-end Neural Coreference Resolution](https://arxiv.org/abs/1707.07045) — 基于 span 的端到端方法。
- [Joshi et al. (2020). SpanBERT](https://arxiv.org/abs/1907.10529) — 提升 coref 性能的预训练。
- [Pradhan et al. (2012). CoNLL-2012 Shared Task](https://aclanthology.org/W12-4501/) — 基准数据集。
- [Hobbs (1978). Resolving Pronoun References](https://www.sciencedirect.com/science/article/pii/0024384178900064) — 基于规则方法的经典之作。