# 共指消解（Coreference Resolution）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> "She called him. He did not answer. The doctor was at lunch."（她打电话给他。他没接。医生去吃午饭了。）三次提及涉及两个人，没有一次出现名字。共指消解（coreference resolution）就是要搞清楚谁是谁。

**Type:** Learn
**Languages:** Python
**Prerequisites:** Phase 5 · 06 (NER), Phase 5 · 07 (POS & Parsing)
**Time:** ~60 minutes

## 问题（The Problem）

从一篇 300 词的文章里抽取每一处对 Apple Inc. 的提及。文章直接写 "Apple" 时很容易；但当它写 "the company"、"they"、"Cupertino's technology giant"（库比蒂诺的科技巨头）或 "Jobs's firm"（乔布斯的公司）时，就难了。如果不把这些提及消解到同一个实体，你的 NER 流水线会漏掉 60–80% 的 mention。

共指消解把所有指向同一个真实世界实体的表达链接成一个簇（cluster）。它是表层 NLP（NER、parsing）和下游语义任务（IE、QA、摘要、知识图谱）之间的胶水。

为什么 2026 年这件事仍然重要：

- 摘要：「The CEO announced...」 vs 「Tim Cook announced...」——摘要里应该点出 CEO 的名字。
- 问答：「Who did she call?」需要先消解 "she"。
- 信息抽取：知识图谱里同时存在「PER1 founded Apple」和「Jobs founded Apple」两条独立记录就是错的。
- 多文档 IE：跨多篇报道同一事件的文章合并 mention，属于跨文档共指。

## 概念（The Concept）

![Coreference clustering: mentions → entities](../assets/coref.svg)

**任务定义。** 输入：一篇文档。输出：mention（span）的一个聚类，每个簇指向一个实体。

**Mention 类型。**

- **Named entity（命名实体）。** "Tim Cook"
- **Nominal（名词性）。** "the CEO"、"the company"
- **Pronominal（代词性）。** "he"、"she"、"they"、"it"
- **Appositive（同位语）。** "Tim Cook, Apple's CEO,"

**架构。**

1. **基于规则（Hobbs, 1978）。** 用语法规则在句法树上做代词消解。一个不错的 baseline，在代词上甚至出奇地难被超越。
2. **Mention-pair 分类器。** 对任意两个 mention (m_i, m_j) 预测它们是否共指；再用传递闭包聚类。2016 年之前的标配。
3. **Mention-ranking。** 对每个 mention，对候选先行词（包括「无先行词」）排序，选 top 一个。
4. **基于 span 的端到端模型（Lee et al., 2017）。** 用 transformer encoder，枚举所有不超过长度上限的候选 span；预测 mention 分数；再为每个 span 预测先行词概率；贪心聚类。当代主流默认方案。
5. **生成式（2024+）。** 直接 prompt 一个 LLM：「列出这段文字里每个代词及其先行词。」简单情况能用，但在长文档和稀有指称上会失手。

**评估指标。** 一共五个标准指标（MUC、B³、CEAF、BLANC、LEA），因为没有任何一个单一指标能完整刻画聚类质量。常规做法是把前三个的平均当作 CoNLL F1。2026 年在 CoNLL-2012 上的 SOTA 大约是 ~83 F1。

**已知的硬骨头案例。**

- 指向若干页之前才出现过的实体的有定描述。
- Bridging anaphora（桥接照应，如 "the wheels" → 之前提过的某辆车）。
- 中文、日文这类语言里的零照应（zero anaphora）。
- Cataphora（前指，代词出现在指称对象之前）："When **she** walked in, Mary smiled."

## 动手实现（Build It）

### 第 1 步：预训练神经共指模型（AllenNLP / spaCy-experimental）

```python
import spacy
nlp = spacy.load("en_coreference_web_trf")   # experimental model
doc = nlp("Apple announced new products. The company said they would ship soon.")
for cluster in doc._.coref_clusters:
    print(cluster, "->", [m.text for m in cluster])
```

在更长的文档上，你大致会得到这样的结果：
- Cluster 1: [Apple, The company, they]
- Cluster 2: [new products]

### 第 2 步：基于规则的代词消解器（教学用）

参考 `code/main.py`，里面有一个仅依赖标准库的实现：

1. 抽取 mention：命名实体（首字母大写的 span）、代词（查字典）、有定描述（"the X"）。
2. 对每个代词，查看前 K 个 mention，按以下维度打分：
   - 性别 / 数 一致性（启发式）
   - recency（越近越好）
   - 句法角色（优先选主语）
3. 链接到分数最高的先行词。

效果完全比不上神经模型。但它能让你看清搜索空间，以及一个端到端模型必须做出的那些决策。

### 第 3 步：用 LLM 做共指消解

```python
prompt = f"""Text: {text}

List every pronoun and noun phrase that refers to a person or company.
Cluster them by what they refer to. Output JSON:
[{{"entity": "Apple", "mentions": ["Apple", "the company", "it"]}}, ...]
"""
```

要警惕两种失败模式。第一，LLM 容易过度合并（把指向两个不同的人的 "him" 和 "her" 合到一起）。第二，LLM 在长文档里会悄悄漏掉 mention。永远要用 span 偏移量去校验。

### 第 4 步：评估

标准的 conll-2012 脚本会算 MUC、B³、CEAF-φ4 并给出三者平均值。如果是自家内部评测，先在标注好的测试集上做 span 级 precision 和 recall，再加上 mention-linking F1。

## 常见坑（Pitfalls）

- **Singleton 爆炸。** 一些系统会把每个 mention 都报告为一个独立簇。B³ 对此很宽容，MUC 则会狠狠惩罚。三个指标都要看。
- **长上下文里的代词。** 文档超过 2,000 token 时性能大约掉 15 F1。切片要小心。
- **性别假设。** 硬编码的性别规则在非二元指称、组织、动物上会崩。要用学习型模型或中性打分。
- **LLM 在长文档上的漂移。** 单次 API 调用不可能稳定地在 50+ 段文字之间聚类 mention。用滑动窗口 + 合并。

## 用起来（Use It）

2026 年的技术栈：

| 场景 | 选择 |
|------|------|
| 英文，单文档 | `en_coreference_web_trf`（spaCy-experimental）或 AllenNLP 神经共指模型 |
| 多语言 | 在 OntoNotes 或 Multilingual CoNLL 上训练的 SpanBERT / XLM-R |
| 跨文档事件共指 | 专门的端到端模型（2025–26 SOTA） |
| 快速 LLM baseline | GPT-4o / Claude，配结构化输出的共指 prompt |
| 生产对话系统 | 规则兜底 + 神经为主 + 关键槽位人工复核 |

2026 年真正能上线的集成模式：先跑 NER，再跑 coref，把 coref 簇合并到 NER 实体里。下游任务看到的就是「每个簇一个实体」，而不是「每个 mention 一个实体」。

## 上线部署（Ship It）

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

## 练习（Exercises）

1. **简单。** 在 5 段手工构造的段落上跑 `code/main.py` 的规则版消解器。对比 ground truth，测量 mention-link 准确率。
2. **中等。** 在一篇新闻文章上跑预训练神经共指模型。把它的簇和你自己的人工标注做对比，它在哪里出错？
3. **困难。** 构建一个共指增强的 NER 流水线：先 NER，再用 coref 簇做合并。在 100 篇文章上对比纯 NER 与共指增强后的实体覆盖率提升。

## 关键术语（Key Terms）

| 术语 | 大家平时怎么说 | 它实际是什么 |
|------|---------------|------------|
| Mention | 一个指称 | 一段指向某个实体的文本 span（人名、代词、名词短语）。 |
| Antecedent | "it" 指代的东西 | 后一个 mention 共指的、更早出现的那个 mention（先行词）。 |
| Cluster | 实体的所有 mention | 全部指向同一个真实世界实体的 mention 集合。 |
| Anaphora | 后向指称 | 后面的 mention 指向前面的（"he" → "John"）。 |
| Cataphora | 前向指称 | 前面的 mention 指向后面的（"When he arrived, John..."）。 |
| Bridging | 隐式指称 | "I bought a car. The wheels were bad."（wheels 指那辆车的轮子。） |
| CoNLL F1 | 排行榜上的那个数 | MUC、B³、CEAF-φ4 三个 F1 的平均值。 |

## 延伸阅读（Further Reading）

- [Jurafsky & Martin, SLP3 Ch. 26 — Coreference Resolution and Entity Linking](https://web.stanford.edu/~jurafsky/slp3/26.pdf) — 教科书级章节。
- [Lee et al. (2017). End-to-end Neural Coreference Resolution](https://arxiv.org/abs/1707.07045) — 基于 span 的端到端模型。
- [Joshi et al. (2020). SpanBERT](https://arxiv.org/abs/1907.10529) — 改进 coref 表现的预训练方案。
- [Pradhan et al. (2012). CoNLL-2012 Shared Task](https://aclanthology.org/W12-4501/) — 这个领域的基准。
- [Hobbs (1978). Resolving Pronoun References](https://www.sciencedirect.com/science/article/pii/0024384178900064) — 规则方法的经典。
