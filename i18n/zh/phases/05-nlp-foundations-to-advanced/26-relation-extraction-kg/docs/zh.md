# 关系提取与知识图构建

> 根据NER的数据,NER发现了实体.实体链接将它们结起来.关系提取发现了它们之间的边缘.知识图是节点,边缘和它们的来源的总和.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 06 (NER), Phase 5 · 25 (Entity Linking)
**Time:** ~60 minutes

## 问题

一位分析师说:"蒂姆·库克于2011年成为果公司的首席执行官.

- `(Tim Cook, role, CEO)`
- `(Tim Cook, employer, Apple)`
- `(Tim Cook, start_date, 2011)`
- `(Apple, type, Organization)`

关系提取 (RE) 将自由文本转化为结构化的三倍`(subject, relation, object)`总结一个数据集,你有一个知识图,总结一个问题,你有一个RAG,分析或合规审计的推理基板.

2026 年的问题: LLM 热情地提取关系.太热情地.它们幻觉地呈现出源文本不支持的三倍.没有来源,你无法分辨真实的三倍与可信的虚构. 2026 年的答案是AEVS 式的和验证管道.

## 概念

![Text → triples → knowledge graph](../assets/relation-extraction.svg)

**Triple form.** `(subject_entity, relation_type, object_entity)`关系来自一个闭式的ontology (Wikidata属性,FIBO,UMLS) 或一个开放的集合 (OpenIE式,任何东西都行).

**Three extraction approaches.**

1. **Rule / pattern-based.**赫斯特模式: "X如Y" → `(Y, isA, X)`另外,手工制作的雷杰克斯,很简单,精确,可以解释.
2. **Supervised classifier.**根据一个句子中提到的两个实体,从一个固定集合预测关系.
3. **Generative LLM.**让模型发射三倍,它是出于盒子,需要来源,或者幻觉可观的垃圾.

**AEVS (Anchor-Extraction-Verification-Supplement, 2026).**目前的幻觉缓解框架:

- **Anchor.**确定每个实体跨度和关系短语跨度,以确切的位置.
- **Extract.**产生连接到杆的三倍.
- **Verify.**匹配每一个三重元素,返回源文本;拒绝任何未支持的内容.
- **Supplement.**覆盖卡确保没有脚的延长时间下降.

幻觉急剧下降,需要更多的计算,但可进行审计.

**The open-vs-closed tradeoff.**

- **Closed ontology.**固定属性列表 (例如,维基数据的11000+属性).可预测.可查询.难以发明.
- **Open IE.**任何口头短语都会成为关系. 记忆力很高,精度很低,查询很混乱.

产品KG通常混合:开启IE用于发现,然后在融入主图之前将关系定为封闭的ontology.

```figure
relation-triples
```

## 建立它

### 步骤1:基于模式的提取

```python
PATTERNS = [
    (r"(?P<s>[A-Z]\w+) (?:is|was) (?:a|an|the) (?P<o>[A-Z]?\w+)", "isA"),
    (r"(?P<s>[A-Z]\w+) (?:is|was) born in (?P<o>\w+)", "bornIn"),
    (r"(?P<s>[A-Z]\w+) works? (?:at|for) (?P<o>[A-Z]\w+)", "worksAt"),
    (r"(?P<s>[A-Z]\w+) founded (?P<o>[A-Z]\w+)", "founded"),
]
```

看到`code/main.py`听力模式仍然运输在特定域的管道中,因为它们是可以调试的.

### 步骤2:监督的后2后关系提取

```python
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM

tok = AutoTokenizer.from_pretrained("Babelscape/rebel-large")
model = AutoModelForSeq2SeqLM.from_pretrained("Babelscape/rebel-large")

text = "Tim Cook was born in Alabama. He later became CEO of Apple."
encoded = tok(text, return_tensors="pt", truncation=True)
output = model.generate(**encoded, max_length=200)
decoded = tok.batch_decode(output, skip_special_tokens=False)
```

REBEL是一个基于BART的seq2seq关系提取器:它生成三倍,而不是分类实体对.文本进,三倍,与来自维基数据属性的关系名称.解码的字符串仍然携带REBEL的字符串.`<triplet>`现在`<subj>`其他`<obj>`它们是按模型卡的解析器进行的.`(subject, relation, object)`根据远程监测数据进行了调整,标准的开放权重基线.

### 步骤3:通过结的LLM提取

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

检查每一个返回的跨度与源头.`text[start:end] != triple_entity`这就是 AEVS"验证"步骤.

### 步骤 4:将其加нони化到一个封闭的ontology

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

工程工程工作的60至80%是可尼化化.

### 步骤5:构建一个小图表和查询

```python
triples = extract(text)
graph = {}
for s, r, o in triples:
    graph.setdefault(s, []).append((r, o))


def neighbors(node, relation=None):
    return [(r, o) for r, o in graph.get(node, []) if relation is None or r == relation]


print(neighbors("Tim Cook", relation="P108"))    # -> [(P108, Apple)]
```

这就是每个RAG-over-KG系统的原子. 用RDF三重存储器 (Blazegraph,Virtuoso),属性图表 (Neo4j) 或向量增强图表存储来测量它.

## 陷

- **Coreference before RE.**RE需要知道他是谁. 首先要跑去 (课 24).
- **Entity canonicalization.**"果公司"和"果公司"必须解决同一节点.
- **Hallucinated triples.**法律法规的发射量是文本不支持的三倍.
- **Relation canonicalization drift.**开放IE关系不一致 ("出生于","来自","是本地"). 崩到正文标识或图表是不可抗拒的.
- **Temporal errors.**现在是真的,2005年是错误的.`P580`开始时间`P582`在维基数据中使用终点时间.
- **Domain mismatch.**法律,医学和科学文本通常需要域名精确调整的RE模型.

## 用它

现在,我们要做什么?

| Situation | Pick |
|-----------|------|
| Fast production, general domain | REBEL or LlamaPred with Wikidata canonicalization |
| Domain-specific (biomed, legal) | SciREX-style domain fine-tune + custom ontology |
| LLM-prompted, audited output | AEVS pipeline: anchor → extract → verify → supplement |
| High-volume news IE | Pattern-based + supervised hybrid |
| Building a KG from scratch | Open IE + manual canonicalization pass |
| Temporal KG | Extract with qualifiers (start/end time, point in time) |

集成模式:NER → coref →实体链接 →关系提取 → ontology映射 →图量负载.每个阶段都是潜在的质量门.

## 运送它

保存如`outputs/skill-re-designer.md`其他:

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

## 运动

1. **Easy.**运行模式提取器`code/main.py`报道文章的五句话.
2. **Medium.**根据"REBEL"的定义,使用REBEL (或一个小的LLM) 在同一句子上.
3. **Hard.**建立AEVS管道:使用LLM+检查跨度与源. 在50个维基百科类型的句子上测量幻觉率之前vs后的验证步骤.

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Triple | Subject-relation-object | `(s, r, o)` tuple that is the atomic unit of a KG. |
| Open IE | Extract anything | Open-vocabulary relation phrases; high recall, low precision. |
| Closed ontology | Fixed schema | Bounded set of relation types (Wikidata, UMLS, FIBO). |
| Canonicalization | Normalize everything | Map surface names / relations to canonical ids. |
| AEVS | Grounded extraction | Anchor-Extraction-Verification-Supplement pipeline (2026). |
| Provenance | Source-of-truth link | Every triple carries a doc id + char-span to its source. |
| Distant supervision | Cheap labels | Align text with an existing KG to create training data. |

## 进一步阅读

- [Mintz et al. (2009). Distant supervision for relation extraction without labeled data](https://www.aclweb.org/anthology/P09-1113.pdf)远程监督论文.
- [Huguet Cabot, Navigli (2021). REBEL: Relation Extraction By End-to-end Language generation](https://aclanthology.org/2021.findings-emnlp.204.pdf)后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后后
- [Wadden et al. (2019). Entity, Relation, and Event Extraction with Contextualized Span Representations (DyGIE++)](https://arxiv.org/abs/1909.03546) 联合 IE.
- [AEVS — Anchor-Extraction-Verification-Supplement framework](https://www.mdpi.com/2073-431X/15/3/178) 2026年幻觉减轻设计.
- [Wikidata SPARQL tutorial](https://www.wikidata.org/wiki/Wikidata:SPARQL_tutorial)可信图表查询.
