# 共指消解 (Coreference Resolution)

> "她打给了他。他没接。医生正在吃午饭。" 三个指代涉及两个人，但没有人被指名道姓。共指消解就是要搞清楚谁是谁。

**类型：** 学习 (Learn)
**语言：** Python
**前置知识：** 阶段 5 · 06 (NER)，阶段 5 · 07 (词性标注与句法分析)
**预计时间：** ~60 分钟

## 问题 (The Problem)

从一篇 300 词的文章中提取所有提及 Apple Inc. 的地方。当文章提到 "Apple" 时很容易。但当它说 "the company"、"they"、"Cupertino's technology giant" 或 "Jobs's firm" 时就很难了。如果不将这些指代链接到同一实体，你的 NER 流水线会漏掉 60-80% 的提及。

共指消解将所有指向同一现实世界实体的表达链接到一个簇中。它是表层 NLP（NER、句法分析）与下游语义（信息抽取、问答、摘要、知识图谱）之间的粘合剂。

为什么它在 2026 年至关重要：

- **摘要生成：** "The CEO announced..." vs "Tim Cook announced..." —— 摘要应该给出 CEO 的名字。
- **问答系统：** "她打给了谁？" 需要解析出 "她"。
- **信息抽取：** 一个知识图谱中同时存在 "PER1 创立了 Apple" 和 "Jobs 创立了 Apple" 作为独立条目是不正确的。
- **多文档信息抽取：** 跨文章合并关于同一事件的指代，这属于跨文档共指。

## 概念 (The Concept)

![共指聚类：指代 → 实体](../assets/coref.svg)

**任务定义。** 输入：一篇文档。输出：指代（文本跨度）的聚类，每个簇指向一个实体。

**指代类型。**

- **命名实体 (Named entity).** "Tim Cook"
- **名词性短语 (Nominal).** "the CEO"、"the company"
- **代词 (Pronominal).** "he"、"she"、"they"、"it"
- **同位语 (Appositive).** "Tim Cook, Apple's CEO,"

**架构体系。**

1. **基于规则 (Hobbs, 1978).** 基于句法树的代词消解，使用语法规则。良好的基线。在代词消解上仍然出人意料地难以超越。
2. **指代对分类器 (Mention-pair classifier).** 对每一对指代 (m_i, m_j) 预测它们是否共指。通过传递闭包聚类。2016 年以前的标准方法。
3. **指代排序 (Mention-ranking).** 对每个指代，对候选先行词（包括"无先行词"）进行排序。选择最靠前的一个。
4. **基于跨度的端到端模型 (Span-based end-to-end, Lee et al., 2017).** Transformer 编码器。枚举所有不超过长度上限的候选跨度。预测指代得分。预测每个跨度的先行词概率。贪心聚类。现代默认方法。
5. **生成式方法 (2024+).** 提示 LLM："列出这篇文章中的每个代词及其先行词。" 在简单案例上效果良好，但在长文档和罕见指代上表现不佳。

**评估指标。** 五个标准指标（MUC、B³、CEAF、BLANC、LEA），因为没有一个单一指标能完全捕捉聚类质量。报告前三个的平均值作为 CoNLL F1。2026 年在 CoNLL-2012 上的最先进水平：约 83 F1。

**已知困难案例。**

- 定指描述指向数页前引入的实体。
-  bridging anaphora（"the wheels" → 之前提到的汽车）。
- 汉语和日语等语言中的零代词 (zero anaphora)。
- 后指 (cataphora，代词出现在指代对象之前)："When **she** walked in, Mary smiled."

## 动手构建 (Build It)

### 第 1 步：预训练神经共指模型 (AllenNLP / spaCy-experimental)

```python
import spacy
nlp = spacy.load("en_coreference_web_trf")   # experimental model
doc = nlp("Apple announced new products. The company said they would ship soon.")
for cluster in doc._.coref_clusters:
    print(cluster, "->", [m.text for m in cluster])
```

在较长文档上，你可能会得到类似这样的结果：
- 簇 1：[Apple, The company, they]
- 簇 2：[new products]

### 第 2 步：基于规则的代词消解器（教学用）

参见 `code/main.py` 中的纯标准库实现：

1. 提取指代：命名实体（大写跨度）、代词（字典查找）、定指描述（"the X"）。
2. 对每个代词，查看前 K 个指代并按以下条件评分：
   - 性别/数的一致性（启发式）
   - 近因性（越近越好）
   - 句法角色（主语优先）
3. 链接得分最高的先行词。

无法与神经模型竞争。但它展示了搜索空间以及端到端模型必须做出的决策。

### 第 3 步：使用 LLM 进行共指消解

```python
prompt = f"""Text: {text}

List every pronoun and noun phrase that refers to a person or company.
Cluster them by what they refer to. Output JSON:
[{{"entity": "Apple", "mentions": ["Apple", "the company", "it"]}}, ...]
"""
```

注意两种失败模式。第一，LLM 容易过度合并（"him" 和 "her" 指代两个不同的人）。第二，LLM 在长文档中会悄悄地遗漏指代。务必使用跨度偏移检查来验证。

### 第 4 步：评估

标准的 conll-2012 脚本计算 MUC、B³、CEAF-φ4 并报告平均值。对于内部评估，先在你标注的测试集上计算跨度级别的精确率和召回率，然后添加指代链接 F1。

## 陷阱 (Pitfalls)

- **单例爆炸 (Singleton explosion).** 有些系统将每个指代都报告为自己的簇。B³ 对此比较宽容。MUC 会严厉惩罚。务必同时检查所有三个指标。
- **长上下文中的代词。** 在超过 2000 个 token 的文档上，性能下降约 15 F1。谨慎分块。
- **性别假设。** 硬编码的性别规则在非二元指代、组织、动物上会失效。使用学习模型或中性评分。
- **长文档上的 LLM 漂移。** 单次 API 调用无法可靠地对超过 50 段文本中的指代进行聚类。使用滑动窗口 + 合并策略。

## 使用方案 (Use It)

2026 年的技术选型：

| 场景 | 选择 |
|-----------|------|
| 英语，单文档 | `en_coreference_web_trf`（spaCy-experimental）或 AllenNLP 神经共指模型 |
| 多语言 | 在 OntoNotes 或多语言 CoNLL 上训练的 SpanBERT / XLM-R |
| 跨文档事件共指 | 专门的端到端模型（2025–26 年最先进方案） |
| 快速 LLM 基线 | GPT-4o / Claude 搭配结构化输出共指提示 |
| 生产对话系统 | 基于规则的后备方案 + 神经主模型 + 关键槽位的人工复核 |

2026 年常用的集成模式：先运行 NER，再运行共指消解，将共指簇合并到 NER 实体中。下游任务看到一个簇对应一个实体，而非一个指代对应一个实体。

## 交付 (Ship It)

保存为 `outputs/skill-coref-picker.md`：

```markdown
---
name: coref-picker
description: 选择共指消解方法、评估计划和集成策略 (Pick a coreference approach, evaluation plan, and integration strategy)
version: 1.0.0
phase: 5
lesson: 24
tags: [nlp, coref, information-extraction]
---

给定一个用例（单文档/多文档、领域、语言），输出：

1. 方法。基于规则/神经跨度模型/LLM 提示/混合。一句话说明理由。
2. 模型。如果是神经模型，给出命名的 checkpoint。
3. 集成。操作顺序：分词 → NER → 共指消解 → 下游任务。
4. 评估。在留出测试集上的 CoNLL F1（MUC + B³ + CEAF-φ4 平均值）+ 在 20 篇文档上进行人工簇审核。

拒绝超过 2000 个 token 且没有滑动窗口合并的纯 LLM 共指方案。拒绝任何没有指代级别精确率-召回率报告的共指流水线。标记在人口多样性文本中部署基于性别启发式规则的系统。
```

## 练习 (Exercises)

1. **简单。** 在 5 个人工编写的段落上运行 `code/main.py` 中的基于规则消解器。测量指代链接准确率并与标准答案对比。
2. **中等。** 在一篇新闻文章上使用预训练的神经共指模型。将得到的簇与你自己的人工标注进行比较。它在哪些地方失败了？
3. **困难。** 构建一个共指增强的 NER 流水线：先做 NER，然后通过共指簇进行合并。在 100 篇文章上测量实体覆盖率的提升，与纯 NER 对比。

## 关键术语 (Key Terms)

| Term | 人们的说法 | 实际含义 |
|------|-----------------|-----------------------|
| Mention (指代) | 一种引用 | 指向实体的文本跨度（名称、代词、名词短语）。 |
| Antecedent (先行词) | "it"所指的内容 | 后面的指代与之共指的较早指代。 |
| Cluster (簇) | 实体的所有指代 | 指向同一现实世界实体的指代集合。 |
| Anaphora (回指) | 向后引用 | 后面的指代指向前面内容（"他" → "John"）。 |
| Cataphora (后指) | 向前引用 | 前面的指代指向后面内容（"When he arrived, John..."）。 |
| Bridging (桥接) | 隐式引用 | "我买了一辆车。轮子坏了。"（那辆车的轮子）。 |
| CoNLL F1 | 排行榜上的数字 | MUC、B³、CEAF-φ4 F1 得分的平均值。 |

## 延伸阅读 (Further Reading)

- [Jurafsky & Martin, SLP3 第 26 章 — 共指消解与实体链接 (Coreference Resolution and Entity Linking)](https://web.stanford.edu/~jurafsky/slp3/26.pdf) — 经典教科书章节。
- [Lee et al. (2017). 端到端神经共指消解 (End-to-end Neural Coreference Resolution)](https://arxiv.org/abs/1707.07045) — 基于跨度的端到端模型。
- [Joshi et al. (2020). SpanBERT](https://arxiv.org/abs/1907.10529) — 改善共指消解的预训练方法。
- [Pradhan et al. (2012). CoNLL-2012 共享任务 (CoNLL-2012 Shared Task)](https://aclanthology.org/W12-4501/) — 基准测试。
- [Hobbs (1978). 解析代词指代 (Resolving Pronoun References)](https://www.sciencedirect.com/science/article/pii/0024384178900064) — 基于规则的经典方法。
