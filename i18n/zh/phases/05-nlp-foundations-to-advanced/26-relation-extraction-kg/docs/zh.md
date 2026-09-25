# 关系抽取与知识图谱构建

> NER 找到了实体。实体链接锚定了它们。关系抽取找出它们之间的边。知识图谱就是节点、边及其来源的总和。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 5 · 06 (NER)、Phase 5 · 25 (Entity Linking)
**Time:** 约 60 分钟

## 问题

分析师读到："Tim Cook became CEO of Apple in 2011." 这句话包含四个事实：

- `(Tim Cook, role, CEO)`
- `(Tim Cook, employer, Apple)`
- `(Tim Cook, start_date, 2011)`
- `(Apple, type, Organization)`

关系抽取(Re)将自由文本转换为结构化三元组 `(subject, relation, object)`。在语料库上聚合，你就得到了一个知识图谱。聚合并查询，你就得到了一个可供 RAG、分析或合规审计使用的推理基底。

2026 年的问题：LLM 抽取关系时过于热情，热情过头。它们会幻觉出源文本并不支持的三元组。没有来源信息，你就无法区分真实的三元组和貌似合理的虚构。2026 年的答案是 AEVS 风格的锚定-验证流水线。

## 概念

![Text → triples → knowledge graph](../assets/relation-extraction.svg)

**三元组形式。** `(subject_entity, relation_type, object_entity)`。关系可以来自封闭本体(Wikidata 属性、FIBO、UMLS),也可以来自开放集合(OpenIE 风格，任何短语都行)。

**三种抽取方法。**

1. **规则/模式。** Hearst 模式："X such as Y" → `(Y, isA, X)`。加上手工编写的正则表达式。脆弱但精确、可解释。
2. **监督分类器。** 给定句子中的两个实体提及，从固定关系集合中预测关系。在 TACRED、ACE、KBP 上训练。2015–2022 年的主流方法。
3. **生成式 LLM。** 提示模型输出三元组。开箱即用。但需要来源校验，否则会幻觉出貌似合理的垃圾。

**AEVS(Anchor-Extraction-Verification-Supplement,2026)。** 当前的幻觉缓解框架：

- **Anchor(锚定)。** 识别每个实体片段和关系短语片段及其精确位置。
- **Extract(抽取)。** 生成链接到锚定片段的三元组。
- **Verify(验证)。** 将每个三元组元素回溯匹配到源文本；拒绝任何缺乏支持的内容。
- **Supplement(补充)。** 一轮覆盖性检查，确保没有锚定片段被遗漏。

幻觉大幅下降。需要更多算力，但结果可审计。

**开放与封闭的权衡。**

- **封闭本体。** 固定属性列表(例如 Wikidata 的 11,000+ 个属性)。可预测、可查询，但难以扩展。
- **开放 IE。** 任何动词短语都可以成为关系。高召回、低精度，查询起来很混乱。

生产级知识图谱通常混合使用：用开放 IE 做发现，然后在合并进主图之前，将关系规范化到封闭本体上。

```figure
relation-triples
```

## 动手构建

### 第 1 步：基于模式的抽取

```python
PATTERNS = [
    (r"(?P<s>[A-Z]\w+) (?:is|was) (?:a|an|the) (?P<o>[A-Z]?\w+)", "isA"),
    (r"(?P<s>[A-Z]\w+) (?:is|was) born in (?P<o>\w+)", "bornIn"),
    (r"(?P<s>[A-Z]\w+) works? (?:at|for) (?P<o>[A-Z]\w+)", "worksAt"),
    (r"(?P<s>[A-Z]\w+) founded (?P<o>[A-Z]\w+)", "founded"),
]
```

完整玩具抽取器见 `code/main.py`。Hearst 模式至今仍出现在领域专用流水线中，因为它们易于调试。

### 第 2 步：监督关系分类

```python
from transformers import AutoTokenizer, AutoModelForSequenceClassification

tok = AutoTokenizer.from_pretrained("Babelscape/rebel-large")
model = AutoModelForSequenceClassification.from_pretrained("Babelscape/rebel-large")

text = "Tim Cook was born in Alabama. He later became CEO of Apple."
encoded = tok(text, return_tensors="pt", truncation=True)
output = model.generate(**encoded, max_length=200)
triples = tok.batch_decode(output, skip_special_tokens=False)
```

REBEL 是一个 seq2seq 关系抽取器：文本输入，三元组输出，且直接使用 Wikidata 属性 id。在远程监督数据上微调。是标准的开源权重基线。

### 第 3 步：带锚定的 LLM 提示抽取

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

将每个返回的片段与源文本核对。拒绝任何 `text[start:end] != triple_entity` 的内容。这就是 AEVS"验证"步骤的最小形式。

### 第 4 步：规范化到封闭本体

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

规范化往往占全部工程工作的 60–80%。要为此预留预算。

### 第 5 步：构建小型图谱并查询

```python
triples = extract(text)
graph = {}
for s, r, o in triples:
    graph.setdefault(s, []).append((r, o))


def neighbors(node, relation=None):
    return [(r, o) for r, o in graph.get(node, []) if relation is None or r == relation]


print(neighbors("Tim Cook", relation="P108"))    # -> [(P108, Apple)]
```

这是所有 RAG-over-KG 系统的原子单元。可以用 RDF 三元组存储(Blazegraph、Virtuoso)、属性图(Neo4j)或向量增强图存储来扩展它。

## 常见陷阱

- **先共指消解再做 RE。** "He founded Apple" —— RE 需要知道 "he" 是谁。先运行共指消解(第 24 课)。
- **实体规范化。** "Apple Inc" 和 "Apple" 必须解析为同一个节点。先做实体链接(第 25 课)。
- **幻觉三元组。** LLM 会输出文本不支持的三元组。强制执行片段验证。
- **关系规范化漂移。** 开放 IE 的关系不一致("was born in"、"came from"、"is a native of")。必须折叠为规范 id,否则图谱无法查询。
- **时序错误。** "Tim Cook is CEO of Apple" —— 现在为真，2005 年为假。许多关系有时间边界。使用限定符(Wikidata 中的 `P580` 开始时间、`P582` 结束时间)。
- **领域不匹配。** REBEL 在 Wikipedia 上训练。法律、医学和科学文本通常需要领域微调的 RE 模型。

## 应用场景

2026 年的技术栈：

| 场景 | 选择 |
|-----------|------|
| 快速生产、通用领域 | REBEL 或 LlamaPred + Wikidata 规范化 |
| 特定领域(生物医学、法律) | SciREX 风格的领域微调 + 自定义本体 |
| LLM 提示、可审计输出 | AEVS 流水线:锚定 → 抽取 → 验证 → 补充 |
| 大批量新闻 IE | 模式 + 监督混合方法 |
| 从零构建知识图谱 | 开放 IE + 手动规范化一轮 |
| 时序知识图谱 | 带限定符抽取(开始/结束时间、时间点) |

集成模式:NER → 共指消解 → 实体链接 → 关系抽取 → 本体映射 → 图加载。每个阶段都是潜在的质量门控。

## 上线部署

保存为 `outputs/skill-re-designer.md`:

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

## 练习

1. **简单。** 在 5 句新闻文章句子上运行 `code/main.py` 中的模式抽取器。人工检查精度。
2. **中等。** 在同样的句子上使用 REBEL(或小型 LLM)。比较三元组。哪个抽取器精度更高？召回更高？
3. **困难。** 构建 AEVS 流水线：用 LLM 抽取 + 将片段与源文本验证。在 50 句 Wikipedia 风格句子上，测量验证步骤前后的幻觉率。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|-----------------------|
| 三元组 | 主语-关系-宾语 | 作为知识图谱原子单元的 `(s, r, o)` 元组。 |
| 开放 IE | 抽取任何东西 | 开放词表的关系短语；高召回、低精度。 |
| 封闭本体 | 固定模式 | 有界的关系类型集合(Wikidata、UMLS、FIBO)。 |
| 规范化 | 全部归一化 | 将表面名称/关系映射为规范 id。 |
| AEVS | 有据可依的抽取 | Anchor-Extraction-Verification-Supplement 流水线(2026)。 |
| 来源(Provenance) | 真相来源链接 | 每个三元组都携带指向其来源的文档 id + 字符片段。 |
| 远程监督 | 廉价标签 | 将文本与现有知识图谱对齐以生成训练数据。 |

## 延伸阅读

- [Mintz et al. (2009). Distant supervision for relation extraction without labeled data](https://www.aclweb.org/anthology/P09-1113.pdf) —— 远程监督开山之作。
- [Huguet Cabot, Navigli (2021). REBEL: Relation Extraction By End-to-end Language generation](https://aclanthology.org/2021.findings-emnlp.204.pdf) —— seq2seq RE 的主力模型。
- [Wadden et al. (2019). Entity, Relation, and Event Extraction with Contextualized Span Representations (DyGIE++)](https://arxiv.org/abs/1909.03546) —— 联合 IE。
- [AEVS — Anchor-Extraction-Verification-Supplement framework](https://www.mdpi.com/2073-431X/15/3/178) —— 2026 年的幻觉缓解设计。
- [Wikidata SPARQL tutorial](https://www.wikidata.org/wiki/Wikidata:SPARQL_tutorial) —— 规范图谱查询。