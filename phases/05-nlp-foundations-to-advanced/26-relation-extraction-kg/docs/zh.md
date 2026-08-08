# Relation Extraction & Knowledge Graph Construction

> NER找到了这些实体。链接的实体锚定了它们。关系提取找到它们之间的边。知识图是节点、边及其出处的总和。

** 类型：** 构建
** 语言：** Python
** 先决条件：** 阶段5 · 06（NER）、阶段5 · 25（实体链接）
** 时间：** ~60分钟

## The Problem

一位分析师写道：“蒂姆·库克于2011年成为苹果首席执行官。“四个事实：

- '（蒂姆·库克，角色，首席执行官）'
- '（蒂姆·库克，苹果公司雇主）'
- '（蒂姆·库克，start_Date，2011年）'
- '（苹果、类型、组织）'

关系提取（RE）将自由文本转化为结构化的三重结构“（主题、关系、对象）”。汇总整个整个数据库，您就拥有了一个知识图。汇总和查询，您就拥有了RAG、分析或合规审计的推理基础。

2026年的问题：LLM热情地提取关系。太热情了。他们产生了源文本不支持的三重幻觉。如果没有出处，你就无法区分真实的三倍和似是而非的虚构。2026年的答案是AEVS式的锚定和验证管道。

## The Concept

![Text → triples → knowledge graph](../assets/relation-extraction.svg)

** 三重形式。** '（主题_实体、关系_类型、对象_实体）'。关系来自封闭的本体（维基数据属性、HIPO、UMPS）或开放集（OpenIE风格，任何事情都可以）。

** 三种提取方法。**

1. ** 基于规则/模式。**赫斯特模式：“X例如Y”-'（Y，isA，X）'。加上手工制作的regex。易碎、精确、可解释。
2. ** 监督分类器。**给定一个句子中提到了两个实体，从固定集合中预测关系。接受过TACRED、ACE、KBP培训。标准2015-2022年。
3. ** 生成式法学硕士。**提示模型发出三重信号。开箱即用。需要出处，或者产生幻觉看起来可能的垃圾。

**AEVS（锚-提取-验证-补充，2026）。**当前的幻觉缓解框架：

- ** 锚。**识别每个实体范围和关系短语范围及其确切位置。
- ** 摘录。**生成链接到锚跨度的三重组。
- ** 验证。**将每个三重元素与源文本匹配;拒绝任何不支持的内容。
- ** 补充。**覆盖通行证确保锚定跨度不会掉落。

幻觉急剧减少。需要更多计算但可审计。

** 开放与封闭的权衡。**

- ** 封闭的存在论。**固定财产列表（例如，维基数据的11，000多个属性）。可预测的。可查询。很难发明。
- ** 打开IE。**任何口头短语都成为一种关系。高召回率。精确度低。查询起来很混乱。

生产KG通常混合使用：打开IE进行发现，然后将关系规范化到封闭的本体上，然后合并到主图中。

## Build It

### Step 1: pattern-based extraction

```python
PATTERNS = [
    (r"(?P<s>[A-Z]\w+) (?:is|was) (?:a|an|the) (?P<o>[A-Z]?\w+)", "isA"),
    (r"(?P<s>[A-Z]\w+) (?:is|was) born in (?P<o>\w+)", "bornIn"),
    (r"(?P<s>[A-Z]\w+) works? (?:at|for) (?P<o>[A-Z]\w+)", "worksAt"),
    (r"(?P<s>[A-Z]\w+) founded (?P<o>[A-Z]\w+)", "founded"),
]
```

参见`code/main.py`获取完整的玩具提取器。Hearst模式仍然在特定于域的管道中提供，因为它们是可调试的。

### Step 2: supervised relation classification

```python
from transformers import AutoTokenizer, AutoModelForSequenceClassification

tok = AutoTokenizer.from_pretrained("Babelscape/rebel-large")
model = AutoModelForSequenceClassification.from_pretrained("Babelscape/rebel-large")

text = "Tim Cook was born in Alabama. He later became CEO of Apple."
encoded = tok(text, return_tensors="pt", truncation=True)
output = model.generate(**encoded, max_length=200)
triples = tok.batch_decode(output, skip_special_tokens=False)
```

REbel是一个seq 2 seq关系提取器：文本输入，三重输出，已经在维基数据属性id中。对远程监督数据进行微调。标准开放重量基线。

### Step 3: LLM-prompted extraction with anchoring

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

根据源验证每个返回的跨度。删除任何' text[start：end]！=三重实体'。这是AEVS最低形式的“验证”步骤。

### Step 4: canonicalize onto a closed ontology

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

规范化通常占工程工作的60-80%。为此的预算。

### Step 5: build a small graph and query

```python
triples = extract(text)
graph = {}
for s, r, o in triples:
    graph.setdefault(s, []).append((r, o))


def neighbors(node, relation=None):
    return [(r, o) for r, o in graph.get(node, []) if relation is None or r == relation]


print(neighbors("Tim Cook", relation="P108"))    # -> [(P108, Apple)]
```

这是每一个RAG-over-KG系统的原子。使用RDF三重存储（Blazegraph，Virtuoso），属性图（Neo4j）或矢量增强图存储扩展它。

## Pitfalls

- ** RE之前的共同参考。**“他创立了苹果”- RE需要知道“他”是谁。首先运行coref（第24课）。
- ** 实体规范化。**“Apple Inc”和“Apple”必须解析为同一个节点。首先是实体链接（第25课）。
- ** 幻觉三重奏。** LLM发出文本不支持的三倍。执行跨度验证。
- ** 关系规范化漂移。**开放IE关系不一致（“出生于”、“来自”、“土生土长”）。折叠到规范id或图无法查询。
- ** 时间错误。**“蒂姆·库克是苹果首席执行官”--现在是正确的，2005年是错误的。许多关系都有时间限制。使用限定符（维基数据中的“P580”开始时间、“P582”结束时间）。
- ** 域名不匹配。** REbel在维基百科上接受培训。法律、医学和科学文本通常需要领域微调的RE模型。

## Use It

2026年堆栈：

| 情况 | 接 |
|-----------|------|
| 快速生产，通用领域 | REbel或LlamaPred与维基数据规范化 |
| 特定领域（生物医学、法律） | SciREX风格的领域微调+自定义本体 |
| LLM提示、审计的输出 | AEVS管道：锚点|提取|验证|补充 |
| 大量新闻IE | 基于模式+监督混合 |
| 从头开始建造KG | 打开IE +手动规范通行证 |
| 颞叶KG | 包含限定词的提取（开始/结束时间、时间点） |

集成模式：NER-coref-实体链接-关系提取-本体映射-图加载。每个阶段都是一个潜在的质量门。

## Ship It

另存为“输出/skill-re-designer.md”：

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

## Exercises

1. ** 简单。**在“code/main.py”中对5个新闻文章句子运行模式提取器。手动检查精度。
2. ** 中等。**对相同的句子使用REbel（或小型LLM）。比较三重。哪个提取器的精度更高？更高的回忆？
3. ** 很难。**构建AEVS管道：使用LLM提取+针对源验证跨度。测量50个维基百科风格的句子验证步骤之前和之后的幻觉率。

## Key Terms

| Term | 别人怎么说 | 它实际上意味着什么 |
|------|-----------------|-----------------------|
| 三重 | 主体-关系-对象 | '（s，r，o）' tuple，是KG的原子单位。 |
| 打开IE | 提取任何东西 | 开放词汇关系短语;高召回率，低精确度。 |
| 封闭的存在论 | 固定模式 | 有界的关系类型集（维基数据、UMPS、HIPO）。 |
| 规范化 | 规范一切 | 将表面名称/关系映射到规范id。 |
| AEVS | 地面提取 | 锚-提取-验证-补充管道（2026年）。 |
| 出处 | 真相来源链接 | 每个三重组都携带一个docid + char-span到其源。 |
| 远程监控 | 廉价标签 | 将文本与现有KG对齐以创建训练数据。 |

## Further Reading

- [Mintz等人（2009）。没有标记数据的关系提取的远程监督]（https：//www.aclweb.org/anthology/P09-1113.pdf）-远程监督论文。
- [Huguet Cabot，Navigli（2021）。REbel：通过端到端语言生成的关系提取]（https：//aclanthology.org/2021.findings-emnlp.204.pdf）-seq 2seq RE主力。
- [Wadden等人（2019）。使用上下文化跨度表示的实体、关系和事件提取（DyGIE++）]（https：//arxiv.org/ab/1909.03546）-联合IE。
- [AEVS- 锚-提取-验证-补充框架]（https：//www.mdpi.com/2073-431X/15/3/178）- 2026年幻觉缓解设计。
- [维基数据SPARQL教程]（https：//www.wikidata.org/wiki/Wikidata：SPARQL_教程）-规范图查询。
