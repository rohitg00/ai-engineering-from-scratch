# 26 · 关系抽取与知识图谱构建

> 命名实体识别（NER）找到了实体，实体链接把它们锚定到了知识库，关系抽取（Relation Extraction）则找出它们之间的边。一张知识图谱就是节点、边以及它们溯源信息的总和。

**类型：** 实践构建
**语言：** Python
**前置：** 第 5 阶段 · 06（命名实体识别）、第 5 阶段 · 25（实体链接）
**时长：** 约 60 分钟

## 问题所在

一位分析师读到这句话：「Tim Cook became CEO of Apple in 2011.」（蒂姆·库克于 2011 年成为苹果公司 CEO。）其中包含四条事实：

- `(Tim Cook, role, CEO)`
- `(Tim Cook, employer, Apple)`
- `(Tim Cook, start_date, 2011)`
- `(Apple, type, Organization)`

关系抽取（Relation Extraction，RE）把自由文本转化为结构化三元组 `(subject, relation, object)`（主语、关系、宾语）。在整个语料库上汇总，你就得到一张知识图谱（Knowledge Graph）。汇总并可查询，你就拥有了一个推理底座，可服务于 RAG、数据分析或合规审计。

2026 年的难题：大语言模型（LLM）抽取关系的热情过于高涨。太热情了。它们会幻想出源文本并不支持的三元组。一旦缺乏溯源（provenance），你就无法把真实三元组和看似合理的虚构内容区分开来。2026 年的答案是 AEVS 风格的「锚定—验证」式流水线。

## 核心概念

〔图：文本 → 三元组 → 知识图谱〕

**三元组形式。** `(subject_entity, relation_type, object_entity)`。关系要么来自一个封闭本体（closed ontology，如 Wikidata 属性、FIBO、UMLS），要么来自一个开放集合（开放信息抽取 OpenIE 风格，什么都行）。

**三种抽取路径。**

1. **基于规则/模式。** Hearst 模式（Hearst patterns）：「X such as Y」→ `(Y, isA, X)`。再加上手写的正则表达式。脆弱、精确、可解释。
2. **有监督分类器。** 给定一句话中的两个实体提及（mention），从一个固定集合中预测它们的关系。在 TACRED、ACE、KBP 等数据集上训练。这是 2015–2022 年的标准做法。
3. **生成式 LLM。** 提示模型直接吐出三元组。开箱即用。但需要溯源，否则会幻想出看似合理的垃圾内容。

**AEVS（Anchor-Extraction-Verification-Supplement，锚定—抽取—验证—补全，2026）。** 当前主流的幻觉缓解框架：

- **锚定（Anchor）。** 标定每一个实体片段（span）和关系短语片段的精确位置。
- **抽取（Extract）。** 生成与锚定片段相关联的三元组。
- **验证（Verify）。** 把每个三元组元素回溯匹配到源文本；拒绝任何无文本支撑的内容。
- **补全（Supplement）。** 通过一次覆盖检查，确保没有任何已锚定的片段被遗漏。

幻觉率会大幅下降。代价是需要更多算力，但结果可审计。

**开放与封闭之间的取舍。**

- **封闭本体。** 固定的属性列表（例如 Wikidata 的 11000 多个属性）。可预测、可查询、难以凭空捏造。
- **开放信息抽取（Open IE）。** 任何动词短语都能成为一个关系。召回率高，精确率低，查询起来一团乱麻。

生产级知识图谱通常采用混合方案：用开放信息抽取做发现，然后把关系规范化（canonicalize）到一个封闭本体上，再并入主图谱。

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

完整的玩具版抽取器见 `code/main.py`。Hearst 模式至今仍在特定领域的流水线中使用，因为它们易于调试。

### 第 2 步：有监督关系分类

```python
from transformers import AutoTokenizer, AutoModelForSequenceClassification

tok = AutoTokenizer.from_pretrained("Babelscape/rebel-large")
model = AutoModelForSequenceClassification.from_pretrained("Babelscape/rebel-large")

text = "Tim Cook was born in Alabama. He later became CEO of Apple."
encoded = tok(text, return_tensors="pt", truncation=True)
output = model.generate(**encoded, max_length=200)
triples = tok.batch_decode(output, skip_special_tokens=False)
```

REBEL 是一个序列到序列（seq2seq）的关系抽取器：输入文本，输出三元组，并且直接采用 Wikidata 属性 id。它在远程监督（distant-supervision）数据上微调而成，是标准的开放权重基线模型。

### 第 3 步：带锚定的 LLM 提示式抽取

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

对照源文本验证每一个返回的片段。凡是 `text[start:end] != triple_entity` 的，一律拒绝。这就是 AEVS「验证」步骤的最小化形式。

### 第 4 步：规范化到封闭本体

```python
RELATION_MAP = {
    "is the CEO of": "P169",       # "首席执行官"
    "was born in":   "P19",         # "出生地"
    "founded":        "P112",       # "创立者"（主语/宾语反转）
    "works at":       "P108",       # "雇主"
}


def canonicalize(relation):
    rel_low = relation.lower().strip()
    if rel_low in RELATION_MAP:
        return RELATION_MAP[rel_low]
    return None   # 丢弃未映射的开放关系，或转入人工审核
```

规范化往往占整个工程工作量的 60–80%。预算上要留足。

### 第 5 步：构建一张小图并查询

```python
triples = extract(text)
graph = {}
for s, r, o in triples:
    graph.setdefault(s, []).append((r, o))


def neighbors(node, relation=None):
    return [(r, o) for r, o in graph.get(node, []) if relation is None or r == relation]


print(neighbors("Tim Cook", relation="P108"))    # -> [(P108, Apple)]
```

这是每一个「KG 之上做 RAG」系统的原子单元。要扩展，可以用 RDF 三元组存储（Blazegraph、Virtuoso）、属性图（Neo4j），或向量增强的图存储。

## 易踩的坑

- **先做共指消解，再做关系抽取。** 「He founded Apple」——关系抽取需要知道「he」是谁。先跑共指消解（coref，第 24 课）。
- **实体规范化。** 「Apple Inc」和「Apple」必须解析到同一个节点。先做实体链接（第 25 课）。
- **幻觉三元组。** LLM 会吐出文本并不支持的三元组。强制做片段验证。
- **关系规范化漂移。** 开放信息抽取产出的关系前后不一致（「was born in」「came from」「is a native of」）。把它们收敛到规范 id，否则图谱无法查询。
- **时间错误。** 「Tim Cook is CEO of Apple」——现在为真，2005 年则为假。许多关系是有时效边界的。请使用限定词（qualifier，Wikidata 中 `P580` 表示起始时间、`P582` 表示结束时间）。
- **领域不匹配。** REBEL 是在维基百科上训练的。法律、医疗和科学文本往往需要经过领域微调的关系抽取模型。

## 如何选用

2026 年的技术栈：

| 场景 | 选择 |
|-----------|------|
| 快速上生产、通用领域 | REBEL 或 LlamaPred 配合 Wikidata 规范化 |
| 特定领域（生物医药、法律） | SciREX 风格的领域微调 + 自定义本体 |
| LLM 提示式、需审计的输出 | AEVS 流水线：锚定 → 抽取 → 验证 → 补全 |
| 高吞吐量新闻信息抽取 | 基于模式 + 有监督的混合方案 |
| 从零构建知识图谱 | 开放信息抽取 + 一次人工规范化 |
| 时序知识图谱 | 带限定词抽取（起始/结束时间、时间点） |

集成模式：NER → 共指消解 → 实体链接 → 关系抽取 → 本体映射 → 入图。每一个环节都是潜在的质量关卡。

## 交付产物

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

## 练习

1. **简单。** 在 `code/main.py` 的模式抽取器上跑 5 句新闻文章语句。人工核查精确率。
2. **中等。** 在同样的句子上使用 REBEL（或一个小型 LLM）。对比抽取出的三元组。哪个抽取器精确率更高？召回率更高？
3. **困难。** 搭建 AEVS 流水线：用 LLM 抽取 + 对照源文本验证片段。在 50 句维基百科风格的语句上，测量验证步骤前后的幻觉率。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|-----------------------|
| 三元组（Triple） | 主语-关系-宾语 | `(s, r, o)` 元组，是知识图谱的原子单元。 |
| 开放信息抽取（Open IE） | 什么都抽 | 开放词表的关系短语；召回率高，精确率低。 |
| 封闭本体（Closed ontology） | 固定模式 | 有界的关系类型集合（Wikidata、UMLS、FIBO）。 |
| 规范化（Canonicalization） | 把一切标准化 | 把表层名称/关系映射到规范 id。 |
| AEVS | 有据可依的抽取 | 锚定—抽取—验证—补全流水线（2026）。 |
| 溯源（Provenance） | 真相来源链接 | 每个三元组都携带指向其来源的 doc id + 字符片段。 |
| 远程监督（Distant supervision） | 廉价标注 | 把文本与一个已有知识图谱对齐，以生成训练数据。 |

## 延伸阅读

- [Mintz et al. (2009). Distant supervision for relation extraction without labeled data](https://www.aclweb.org/anthology/P09-1113.pdf) —— 远程监督的奠基论文。
- [Huguet Cabot, Navigli (2021). REBEL: Relation Extraction By End-to-end Language generation](https://aclanthology.org/2021.findings-emnlp.204.pdf) —— seq2seq 关系抽取的主力模型。
- [Wadden et al. (2019). Entity, Relation, and Event Extraction with Contextualized Span Representations (DyGIE++)](https://arxiv.org/abs/1909.03546) —— 联合信息抽取。
- [AEVS —— 锚定—抽取—验证—补全框架](https://www.mdpi.com/2073-431X/15/3/178) —— 2026 年的幻觉缓解设计。
- [Wikidata SPARQL 教程](https://www.wikidata.org/wiki/Wikidata:SPARQL_tutorial) —— 规范的图查询。
