# 关系抽取与知识图谱构建

> NER 找到了实体。实体链接将它们锚定。关系抽取找到了它们之间的边。知识图谱是节点、边及其来源的总和。

**类型：** 构建  
**语言：** Python  
**前置条件：** 阶段 5 · 06（NER），阶段 5 · 25（实体链接）  
**用时：** 约60分钟

## 问题

分析师读到：“蒂姆·库克（Tim Cook）于2011年成为苹果公司CEO。” 包含四个事实：

- `(Tim Cook, role, CEO)`
- `(Tim Cook, employer, Apple)`
- `(Tim Cook, start_date, 2011)`
- `(Apple, type, Organization)`

关系抽取（Relation Extraction, RE）将自由文本转化为结构化三元组 `(subject, relation, object)`。对整个语料库进行聚合，就得到了知识图谱。聚合并查询后，便获得了支持 RAG、分析或合规审计的推理基础。

2026年的问题：LLM 抽取关系时过于热情。它们会幻觉出源文本不支持的三元组。没有来源（Provenance），就无法区分真实三元组和看似合理的虚构内容。2026年的答案是 AEVS 风格的锚定与验证流水线（Anchor-and-Verify Pipeline）。

## 概念

![文本 → 三元组 → 知识图谱](../assets/relation-extraction.svg)

**三元组形式。** `(subject_entity, relation_type, object_entity)`。关系来自封闭的本体论（Wikidata 属性、FIBO、UMLS）或开放集合（OpenIE 风格，任意内容）。

**三种抽取方法。**

1. **基于规则/模式。** Hearst 模式："X such as Y" → `(Y, isA, X)`。外加手工编写的正则表达式。脆弱、精确、可解释。
2. **有监督分类器。** 给定句子中的两个实体提及，从固定集合中预测关系。在 TACRED、ACE、KBP 上训练。2015–2022 年的标准方法。
3. **生成式 LLM。** 提示模型输出三元组。开箱即用。需要来源，否则会幻觉出看似合理的垃圾。

**AEVS（锚定-抽取-验证-补充，2026）。** 当前缓解幻觉的框架：

- **锚定（Anchor）。** 识别每个实体片段和关系短语片段及其精确位置。
- **抽取（Extract）。** 生成与锚定片段关联的三元组。
- **验证（Verify）。** 将每个三元组元素匹配回源文本；拒绝任何不支持的内容。
- **补充（Supplement）。** 覆盖检查确保没有锚定片段被遗漏。

幻觉大幅下降。需要更多计算量，但可审计。

**开放与封闭的权衡。**

- **封闭本体论。** 固定属性列表（例如 Wikidata 的 11,000+ 属性）。可预测。可查询。难以凭空编造。
- **开放信息抽取（Open IE）。** 任何动词短语都可成为关系。高召回率。低精确率。查询时混乱。

生产环境中的知识图谱通常混合使用：先用 Open IE 进行发现，然后规范化（Canonicalize）关系到封闭本体论，再合并到主图中。

## 构建

### 第1步：基于模式的抽取

```python
PATTERNS = [
    (r"(?P<s>[A-Z]\w+) (?:is|was) (?:a|an|the) (?P<o>[A-Z]?\w+)", "isA"),
    (r"(?P<s>[A-Z]\w+) (?:is|was) born in (?P<o>\w+)", "bornIn"),
    (r"(?P<s>[A-Z]\w+) works? (?:at|for) (?P<o>[A-Z]\w+)", "worksAt"),
    (r"(?P<s>[A-Z]\w+) founded (?P<o>[A-Z]\w+)", "founded"),
]
```

完整的玩具抽取器见 `code/main.py`。Hearst 模式在特定领域流水线中仍然被使用，因为它们可调试。

### 第2步：有监督关系分类

```python
from transformers import AutoTokenizer, AutoModelForSequenceClassification

tok = AutoTokenizer.from_pretrained("Babelscape/rebel-large")
model = AutoModelForSequenceClassification.from_pretrained("Babelscape/rebel-large")

text = "Tim Cook was born in Alabama. He later became CEO of Apple."
encoded = tok(text, return_tensors="pt", truncation=True)
output = model.generate(**encoded, max_length=200)
triples = tok.batch_decode(output, skip_special_tokens=False)
```

REBEL 是一个序列到序列（seq2seq）关系抽取器：输入文本，输出三元组，且已使用 Wikidata 属性 ID。在远程监督数据上微调。标准的开源权重基线模型。

### 第3步：带锚定的 LLM 提示抽取

```python
prompt = f"""Extract (subject, relation, object) triples from the text.
For each triple, include the exact character span in the source text.

Text: {text}

Output JSON:
[{{"subject": {{"text": "...", "span": [start, end]}},
   "relation": "...",
   "object": {{"text": "...", "span": [start, end]}}}}, ...]

Only include triples fully supported by the text. No inference beyond what is stated.
"""
```

验证每个返回的片段是否与源文本匹配。拒绝所有 `text[start:end] != triple_entity` 的情况。这是 AEVS“验证”步骤的最小形式。

### 第4步：规范化到封闭本体论

```python
RELATION_MAP = {
    "is the CEO of": "P169",       # "chief executive officer"
    "was born in":   "P19",         # "place of birth"
    "founded":        "P112",       # "founded by" (inverted subject/object)
    "works at":       "P108",       # "employer"
}


def canonicalize(relation):
    rel_low = relation.lower().strip()
    if rel_low in RELATION_MAP:
        return RELATION_MAP[rel_low]
    return None   # drop unmapped open relations or route to manual review
```

规范化通常占工程工作量的 60-80%。请为此做好预算。

### 第5步：构建小型图并查询

```python
triples = extract(text)
graph = {}
for s, r, o in triples:
    graph.setdefault(s, []).append((r, o))


def neighbors(node, relation=None):
    return [(r, o) for r, o in graph.get(node, []) if relation is None or r == relation]


print(neighbors("Tim Cook", relation="P108"))    # -> [(P108, Apple)]
```

这是每个 RAG-over-KG 系统的基础单元。可通过 RDF 三元组存储（Blazegraph、Virtuoso）、属性图（Neo4j）或向量增强图存储来扩展。

## 陷阱

- **关系抽取前的指代消解（Coreference）。** “He founded Apple” — RE 需要知道“He”是谁。先运行指代消解（第24课）。
- **实体规范化。** “Apple Inc”和“Apple”必须解析为同一节点。先进行实体链接（第25课）。
- **幻觉三元组。** LLM 会输出文本不支持的三元组。强制进行片段验证。
- **关系规范化漂移。** Open IE 关系不一致（“was born in”、“came from”、“is a native of”）。必须折叠成规范 ID，否则图无法查询。
- **时间错误。** “Tim Cook is CEO of Apple” — 现在为真，2005年为假。许多关系具有时间边界。使用限定符（Wikidata 中的 `P580` 开始时间、`P582` 结束时间）。
- **领域不匹配。** REBEL 在维基百科上训练。法律、医学和科学文本通常需要领域微调的关系抽取模型。

## 使用

2026年的选择栈：

| 场景 | 选择 |
|------|------|
| 快速生产，通用领域 | REBEL 或 LlamaPred 配合 Wikidata 规范化 |
| 特定领域（生物医学、法律） | SciREX 风格领域微调 + 自定义本体论 |
| LLM 提示、可审计输出 | AEVS 流水线：锚定 → 抽取 → 验证 → 补充 |
| 高吞吐量新闻信息抽取 | 基于模式 + 有监督混合 |
| 从零构建知识图谱 | Open IE + 人工规范化环节 |
| 时间知识图谱 | 使用限定符（开始/结束时间、时间点）进行抽取 |

集成模式：NER → 指代消解 → 实体链接 → 关系抽取 → 本体映射 → 图加载。每个阶段都是一个潜在的质量门控。

## 交付

保存为 `outputs/skill-re-designer.md`：

```markdown
---
name: re-designer
description: 设计具有来源追踪和规范化功能的关系抽取流水线。
version: 1.0.0
phase: 5
lesson: 26
tags: [nlp, relation-extraction, knowledge-graph]
---

给定语料库（领域、语言、规模）和下游用途（KG-RAG、分析、合规），输出以下内容：

1. **抽取器。** 基于模式 / 有监督 / LLM / AEVS 混合。理由与精确率 / 召回率目标相关联。
2. **本体论。** 封闭属性列表（Wikidata / 领域）或带规范化环节的 Open IE。
3. **来源（Provenance）。** 每个三元组携带源字符片段 + 文档 ID。审计时不可协商。
4. **合并策略。** 规范实体 ID + 关系 ID + 时间限定符；去重策略。
5. **评估。** 在 200 个手工标注的三元组上评估精确率 / 召回率，并在 LLM 抽取的样本上评估幻觉率。

拒绝任何没有片段验证（源来源）的基于 LLM 的关系抽取流水线。拒绝未规范化的 Open IE 输出流入生产图。对时间有边界的关系（雇主、配偶、职位）没有时间限定符的流水线要标记出来。
```

## 练习

1. **简单。** 在 5 条新闻文章句子上运行 `code/main.py` 中的模式抽取器。手工检查精确率。
2. **中等。** 对同样的句子使用 REBEL（或一个小型 LLM）。比较三元组。哪个抽取器精确率更高？召回率更高？
3. **困难。** 构建 AEVS 流水线：使用 LLM 抽取 + 对源文本验证片段。在 50 条维基百科风格句子上，测量验证步骤前后的幻觉率。

## 关键术语

| 术语 | 人们说的 | 实际含义 |
|------|---------|---------|
| 三元组（Triple） | 主语-关系-宾语 | `(s, r, o)` 元组，是知识图谱的原子单元。 |
| 开放信息抽取（Open IE） | 抽取任何内容 | 开词汇关系短语；高召回率，低精确率。 |
| 封闭本体论（Closed ontology） | 固定模式 | 有界的关系类型集合（Wikidata、UMLS、FIBO）。 |
| 规范化（Canonicalization） | 标准化一切 | 将表层名称/关系映射到规范 ID。 |
| AEVS | 有依据的抽取 | 锚定-抽取-验证-补充流水线（2026）。 |
| 来源（Provenance） | 事实来源链接 | 每个三元组携带文档 ID + 字符片段，指向其来源。 |
| 远程监督（Distant supervision） | 廉价标签 | 将文本与现有知识图谱对齐，以创建训练数据。 |

## 延伸阅读

- [Mintz et al. (2009). Distant supervision for relation extraction without labeled data](https://www.aclweb.org/anthology/P09-1113.pdf) — 远程监督论文。
- [Huguet Cabot, Navigli (2021). REBEL: Relation Extraction By End-to-end Language generation](https://aclanthology.org/2021.findings-emnlp.204.pdf) — seq2seq 关系抽取主力模型。
- [Wadden et al. (2019). Entity, Relation, and Event Extraction with Contextualized Span Representations (DyGIE++)](https://arxiv.org/abs/1909.03546) — 联合信息抽取。
- [AEVS — Anchor-Extraction-Verification-Supplement framework](https://www.mdpi.com/2073-431X/15/3/178) — 2026 年幻觉缓解设计。
- [Wikidata SPARQL tutorial](https://www.wikidata.org/wiki/Wikidata:SPARQL_tutorial) — 规范图查询。