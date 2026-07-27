# Relation Extraction & Knowledge Graph Construction / 关系抽取与知识图谱构建

> NER found the entities. Entity linking anchored them. Relation extraction finds the edges between them. A knowledge graph is the sum of nodes, edges, and their provenance.
> NER 找到了实体，实体链接将它们锚定，关系抽取则发现它们之间的边。知识图谱是节点、边及其来源的总和。

**类型：** Build 构建
**语言：** Python
**前置条件：** 阶段 5 · 06（命名实体识别），阶段 5 · 25（实体链接）
**时长：** ~60 分钟

## The Problem / 问题

分析师读到一句话："Tim Cook became CEO of Apple in 2011." 其中包含四个事实：

- `(Tim Cook, role, CEO)`
- `(Tim Cook, employer, Apple)`
- `(Tim Cook, start_date, 2011)`
- `(Apple, type, Organization)`

关系抽取（Relation Extraction, RE）将自由文本转化为结构化的三元组 `(subject, relation, object)`。在整个语料库上聚合，就得到了一个知识图谱。聚合后加以查询，就为 RAG、分析或合规审计提供了推理基础。

2026 年的问题是：LLM 抽取关系时过于热情，会幻觉出源文本并不支持的三元组。如果没有来源证明（provenance），就无法区分真实三元组与貌似合理的虚构。2026 年的答案是 AEVS 风格的锚定-验证流水线。

## The Concept / 概念

![Text → triples → knowledge graph](../assets/relation-extraction.svg)

**三元组形式。** `(subject_entity, relation_type, object_entity)`。关系可以来自封闭本体（Wikidata 属性、FIBO、UMLS），也可以是开放集合（OpenIE 风格，不限内容）。

**三种抽取方法。**

1. **规则/模式匹配。** Hearst 模式："X such as Y" → `(Y, isA, X)`。外加手工编写的正则表达式。脆弱但精确、可解释。
2. **监督分类器。** 给定句子中的两个实体提及，从固定集合中预测关系。在 TACRED、ACE、KBP 上训练。2015–2022 年的标准方法。
3. **生成式 LLM。** 提示模型输出三元组。开箱即用，但需要来源证明，否则会幻觉出看似合理的垃圾三元组。

**AEVS（Anchor-Extraction-Verification-Supplement，锚定-抽取-验证-补充，2026）。** 当前的幻觉缓解框架：

- **Anchor（锚定）。** 识别每个实体跨度（entity span）和关系短语跨度（relation-phrase span）及其精确位置。
- **Extract（抽取）。** 生成与锚定跨度关联的三元组。
- **Verify（验证）。** 将每个三元组元素匹配回源文本；拒绝任何无依据的内容。
- **Supplement（补充）。** 覆盖度检查确保没有锚定跨度被遗漏。

幻觉率大幅下降。需要更多计算资源，但可审计。

**开放 vs 封闭的权衡。**

- **封闭本体（Closed ontology）。** 固定的属性列表（例如 Wikidata 的 11,000+ 个属性）。可预测，可查询，难以编造。
- **开放式信息抽取（Open IE）。** 任何动词短语都可作为关系。召回率高，精确率低，查询混乱。

生产级知识图谱通常采用混合方式：先用 Open IE 进行发现，然后将关系规范化为封闭本体，再合并到主图谱中。

## Build It / 动手构建

### Step 1: pattern-based extraction / 步骤 1：基于模式的关系抽取

```python
PATTERNS = [
    (r"(?P<s>[A-Z]\w+) (?:is|was) (?:a|an|the) (?P<o>[A-Z]?\w+)", "isA"),
    (r"(?P<s>[A-Z]\w+) (?:is|was) born in (?P<o>\w+)", "bornIn"),
    (r"(?P<s>[A-Z]\w+) works? (?:at|for) (?P<o>[A-Z]\w+)", "worksAt"),
    (r"(?P<s>[A-Z]\w+) founded (?P<o>[A-Z]\w+)", "founded"),
]
```

完整的小型抽取器见 `code/main.py`。Hearst 模式仍然在领域特定流水线中使用，因为它易于调试。

### Step 2: supervised relation classification / 步骤 2：监督式关系分类

```python
from transformers import AutoTokenizer, AutoModelForSequenceClassification

tok = AutoTokenizer.from_pretrained("Babelscape/rebel-large")
model = AutoModelForSequenceClassification.from_pretrained("Babelscape/rebel-large")

text = "Tim Cook was born in Alabama. He later became CEO of Apple."
encoded = tok(text, return_tensors="pt", truncation=True)
output = model.generate(**encoded, max_length=200)
triples = tok.batch_decode(output, skip_special_tokens=False)
```

REBEL 是一个序列到序列的关系抽取器：输入文本，输出三元组，且已使用 Wikidata 属性 ID。在远程监督数据上微调。是开放权重的标准基线模型。

### Step 3: LLM-prompted extraction with anchoring / 步骤 3：带锚定的 LLM 提示式抽取

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

验证每个返回的跨度与源文本是否匹配。拒绝任何 `text[start:end] != triple_entity` 的情况。这就是 AEVS "验证"步骤的最小化形式。

### Step 4: canonicalize onto a closed ontology / 步骤 4：规范化为封闭本体

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

### Step 5: build a small graph and query / 步骤 5：构建小型图谱并查询

```python
triples = extract(text)
graph = {}
for s, r, o in triples:
    graph.setdefault(s, []).append((r, o))


def neighbors(node, relation=None):
    return [(r, o) for r, o in graph.get(node, []) if relation is None or r == relation]


print(neighbors("Tim Cook", relation="P108"))    # -> [(P108, Apple)]
```

这是每个 RAG-over-KG 系统的原子操作。可扩展为 RDF 三元组存储（Blazegraph、Virtuoso）、属性图（Neo4j）或向量增强的图存储。

## Pitfalls / 常见陷阱

- **关系抽取前的指代消解。** "He founded Apple" —— 关系抽取需要知道 "he" 是谁。先运行指代消解（第 24 课）。
- **实体规范化。** "Apple Inc" 和 "Apple" 必须解析为同一节点。先进行实体链接（第 25 课）。
- **幻觉三元组。** LLM 会输出文本不支持的三元组。强制进行跨度验证。
- **关系规范化漂移。** Open IE 的关系不一致（"was born in"、"came from"、"is a native of"）。必须将其归并为规范 ID，否则图谱将无法查询。
- **时间错误。** "Tim Cook is CEO of Apple" —— 现在为真，2005 年为假。许多关系具有时间边界。使用限定符（Wikidata 中的 `P580` 起始时间、`P582` 结束时间）。
- **领域不匹配。** REBEL 在 Wikipedia 上训练。法律、医学和科学文本通常需要领域微调的关系抽取模型。

## Use It / 使用指南

2026 年的技术选型：

| 场景 | 选择 |
|------|------|
| 快速生产、通用领域 | REBEL 或 LlamaPred + Wikidata 规范化 |
| 领域特定（生物医学、法律） | SciREX 风格的领域微调 + 自定义本体 |
| LLM 提示式、可审计输出 | AEVS 流水线：锚定 → 抽取 → 验证 → 补充 |
| 高吞吐新闻信息抽取 | 基于模式 + 监督式混合 |
| 从零构建知识图谱 | Open IE + 人工规范化 |
| 时序知识图谱 | 带限定符抽取（起始/结束时间、时间点） |

集成模式：NER → 指代消解 → 实体链接 → 关系抽取 → 本体映射 → 图谱加载。每个阶段都是一个潜在的质量关卡。

## Ship It / 交付

保存为 `outputs/skill-re-designer.md`：

```markdown
---
name: re-designer
description: Design a relation extraction pipeline with provenance and canonicalization.
version: 1.0.0
phase: 5
lesson: 26
tags: [nlp, relation-extraction, knowledge-graph]
---

Given a corpus (domain, language, volume) and downstream use (KG-RAG, analytics, compliance), output:

1. Extractor. Pattern-based / supervised / LLM / AEVS hybrid. Reason tied to precision vs recall target.
2. Ontology. Closed property list (Wikidata / domain) or open IE with canonicalization pass.
3. Provenance. Every triple carries source char-span + doc id. Non-negotiable for audit.
4. Merge strategy. Canonical entity id + relation id + temporal qualifiers; dedup policy.
5. Evaluation. Precision / recall on 200 hand-labelled triples + hallucination-rate on LLM-extracted sample.

Refuse any LLM-based RE pipeline without span verification (source provenance). Refuse open-IE output flowing into a production graph without canonicalization. Flag pipelines with no temporal qualifier on time-bounded relations (employer, spouse, position).
```

## Exercises / 练习

1. **简单。** 在 5 个新闻文章句子上运行 `code/main.py` 中的模式抽取器。手动检查精确率。
2. **中等。** 在相同的句子上使用 REBEL（或一个小型 LLM）。比较三元组。哪个抽取器精确率更高？召回率更高？
3. **困难。** 构建 AEVS 流水线：使用 LLM 抽取 + 与源文本进行跨度验证。在 50 个 Wikipedia 风格的句子上测量验证步骤前后的幻觉率。

## Key Terms / 关键术语

| 术语 | 通常说法 | 实际含义 |
|------|---------|---------|
| Triple 三元组 | 主语-关系-宾语 | `(s, r, o)` 元组，知识图谱的原子单位。 |
| Open IE 开放式信息抽取 | 抽取一切 | 开放词汇的关系短语；召回率高，精确率低。 |
| Closed ontology 封闭本体 | 固定模式 | 有界的关系类型集合（Wikidata、UMLS、FIBO）。 |
| Canonicalization 规范化 | 归一化一切 | 将表面名称/关系映射到规范 ID。 |
| AEVS 锚定-抽取-验证-补充 | 有依据的抽取 | Anchor-Extraction-Verification-Supplement 流水线（2026）。 |
| Provenance 来源证明 | 事实源头链接 | 每个三元组携带文档 ID + 字符跨度以追溯其来源。 |
| Distant supervision 远程监督 | 廉价标签 | 将文本与现有知识图谱对齐以创建训练数据。 |

## Further Reading / 延伸阅读

- [Mintz et al. (2009). Distant supervision for relation extraction without labeled data](https://www.aclweb.org/anthology/P09-1113.pdf) —— 远程监督论文。
- [Huguet Cabot, Navigli (2021). REBEL: Relation Extraction By End-to-end Language generation](https://aclanthology.org/2021.findings-emnlp.204.pdf) —— 序列到序列关系抽取的主力模型。
- [Wadden et al. (2019). Entity, Relation, and Event Extraction with Contextualized Span Representations (DyGIE++)](https://arxiv.org/abs/1909.03546) —— 联合信息抽取。
- [AEVS — Anchor-Extraction-Verification-Supplement framework](https://www.mdpi.com/2073-431X/15/3/178) —— 2026 幻觉缓解设计方案。
- [Wikidata SPARQL tutorial](https://www.wikidata.org/wiki/Wikidata:SPARQL_tutorial) —— 规范图查询教程。
