# 関係抽出とナレッジグラフ構築

> NER は entities を見つけました。Entity linking はそれらを anchor しました。Relation extraction は、その間の edges を見つけます。Knowledge graph は nodes、edges、そしてそれらの provenance の総和です。

**種別:** 構築
**言語:** Python
**前提条件:** Phase 5 · 06 (NER), Phase 5 · 25 (Entity Linking)
**所要時間:** 約60分

## 問題

analyst が "Tim Cook became CEO of Apple in 2011." を読みます。facts は 4 つあります。

- `(Tim Cook, role, CEO)`
- `(Tim Cook, employer, Apple)`
- `(Tim Cook, start_date, 2011)`
- `(Apple, type, Organization)`

Relation Extraction (RE) は free text を structured triples `(subject, relation, object)` に変換します。corpus 全体で集約すれば knowledge graph になります。さらに集約して query すれば、RAG、analytics、compliance audits のための reasoning substrate になります。

2026 年の問題: LLMs は relations を熱心に抽出します。熱心すぎるほどです。source text が support していない triples を hallucinate します。provenance がなければ、real triples と plausible fiction を見分けられません。2026 年の答えは、AEVS-style anchor-and-verify pipelines です。

## 概念

![Text → triples → knowledge graph](../assets/relation-extraction.svg)

**Triple form。** `(subject_entity, relation_type, object_entity)`。relations は closed ontology (Wikidata properties、FIBO、UMLS) から来る場合も、open set (OpenIE-style、anything goes) から来る場合もあります。

**3 つの extraction approaches。**

1. **Rule / pattern-based。** Hearst patterns: "X such as Y" → `(Y, isA, X)`。さらに hand-crafted regex。壊れやすい一方で、precise で explainable です。
2. **Supervised classifier。** 1 文内の 2 つの entity mentions が与えられたとき、fixed set から relation を予測します。TACRED、ACE、KBP で訓練します。2015-2022 年の standard です。
3. **Generative LLM。** triples を emit するよう model に prompt します。out of the box で動きます。provenance がなければ、plausible-looking junk を hallucinate します。

**AEVS (Anchor-Extraction-Verification-Supplement, 2026)。** 現在の hallucination-mitigation framework です。

- **Anchor。** すべての entity span と relation-phrase span を exact positions とともに特定します。
- **Extract。** anchor spans に link された triples を生成します。
- **Verify。** 各 triple element を source text に照合します。unsupported なものを reject します。
- **Supplement。** coverage pass により、anchored span が落ちていないことを確認します。

hallucinations は大きく減ります。より多くの compute が必要ですが、auditable になります。

**open-vs-closed tradeoff。**

- **Closed ontology。** fixed property list (例: Wikidata の 11,000+ properties)。predictable。queryable。invent しにくい。
- **Open IE。** 任意の verbal phrase が relation になります。high recall。low precision。query しづらい。

Production KGs は通常 mix します。discovery には open IE を使い、main graph に merge する前に relations を closed ontology へ canonicalize します。

## 作ってみる

### Step 1: pattern-based extraction

```python
PATTERNS = [
    (r"(?P<s>[A-Z]\w+) (?:is|was) (?:a|an|the) (?P<o>[A-Z]?\w+)", "isA"),
    (r"(?P<s>[A-Z]\w+) (?:is|was) born in (?P<o>\w+)", "bornIn"),
    (r"(?P<s>[A-Z]\w+) works? (?:at|for) (?P<o>[A-Z]\w+)", "worksAt"),
    (r"(?P<s>[A-Z]\w+) founded (?P<o>[A-Z]\w+)", "founded"),
]
```

full toy extractor は `code/main.py` を参照してください。Hearst patterns は debuggable なので、domain-specific pipelines で今も出荷されています。

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

REBEL は seq2seq relation extractor です。text を入力し、triples を出力します。すでに Wikidata property ids になっています。distant-supervision data で fine-tuned されています。標準的な open-weights baseline です。

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

返されたすべての span を source に照らして verify してください。`text[start:end] != triple_entity` となるものは reject します。これは AEVS の "verify" step を最小化した形です。

### Step 4: closed ontology へ canonicalize する

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

canonicalization は engineering work の 60-80% を占めることがよくあります。必ず budget に入れてください。

### Step 5: 小さな graph を作って query する

```python
triples = extract(text)
graph = {}
for s, r, o in triples:
    graph.setdefault(s, []).append((r, o))


def neighbors(node, relation=None):
    return [(r, o) for r, o in graph.get(node, []) if relation is None or r == relation]


print(neighbors("Tim Cook", relation="P108"))    # -> [(P108, Apple)]
```

これはすべての RAG-over-KG system の atom です。RDF triple stores (Blazegraph、Virtuoso)、property graphs (Neo4j)、または vector-augmented graph stores で scale します。

## 落とし穴

- **Coreference before RE。** "He founded Apple" — RE には "he" が誰かを知る必要があります。coref を先に実行してください (lesson 24)。
- **Entity canonicalization。** "Apple Inc" と "Apple" は同じ node に resolve されなければなりません。entity linking を先に実行してください (lesson 25)。
- **Hallucinated triples。** LLMs は text が support していない triples を emit します。span verification を enforce してください。
- **Relation canonicalization drift。** Open IE relations は一貫しません ("was born in," "came from," "is a native of")。canonical ids に collapse しなければ、graph は query できません。
- **Temporal errors。** "Tim Cook is CEO of Apple" — 今は true ですが、2005 年には false です。多くの relations は time-bounded です。qualifiers (Wikidata の `P580` start time、`P582` end time) を使ってください。
- **Domain mismatch。** REBEL は Wikipedia で訓練されています。legal、medical、scientific text では domain-fine-tuned RE models が必要になることがよくあります。

## 使う

2026 年の stack:

| 状況 | 選択 |
|-----------|------|
| Fast production、general domain | REBEL または LlamaPred + Wikidata canonicalization |
| Domain-specific (biomed、legal) | SciREX-style domain fine-tune + custom ontology |
| LLM-prompted、audited output | AEVS pipeline: anchor → extract → verify → supplement |
| High-volume news IE | Pattern-based + supervised hybrid |
| KG を scratch から作る | Open IE + manual canonicalization pass |
| Temporal KG | qualifiers (start/end time、point in time) 付きで extract |

integration pattern: NER → coref → entity linking → relation extraction → ontology mapping → graph load。すべての stage が potential quality gate です。

## 出荷する

`outputs/skill-re-designer.md` として保存:

```markdown
---
name: re-designer
description: provenance と canonicalization を備えた relation extraction pipeline を設計する。
version: 1.0.0
phase: 5
lesson: 26
tags: [nlp, relation-extraction, knowledge-graph]
---

corpus (domain、language、volume) と downstream use (KG-RAG、analytics、compliance) が与えられたら、次を出力してください。

1. Extractor。Pattern-based / supervised / LLM / AEVS hybrid。precision vs recall target に結びついた理由。
2. Ontology。Closed property list (Wikidata / domain)、または canonicalization pass 付きの open IE。
3. Provenance。すべての triple が source char-span + doc id を持つ。audit では譲れない条件。
4. Merge strategy。Canonical entity id + relation id + temporal qualifiers。dedup policy。
5. Evaluation。200 hand-labelled triples 上の precision / recall + LLM-extracted sample の hallucination-rate。

span verification (source provenance) のない LLM-based RE pipeline は拒否する。canonicalization なしに open-IE output を production graph へ流す設計は拒否する。time-bounded relations (employer、spouse、position) に temporal qualifier がない pipeline は警告する。
```

## 演習

1. **Easy.** `code/main.py` の pattern extractor を 5 つの news-article sentences に対して実行してください。precision を hand-check します。
2. **Medium.** 同じ sentences に REBEL (または small LLM) を使ってください。triples を比較します。どちらの extractor が higher precision ですか。higher recall はどちらですか。
3. **Hard.** AEVS pipeline を作ってください。LLM で extract し、source に対して spans を verify します。50 Wikipedia-style sentences 上で、verify step の前後の hallucination rate を測ります。

## 重要用語

| Term | みんなの言い方 | 実際の意味 |
|------|-----------------|-----------------------|
| Triple | Subject-relation-object | KG の atomic unit である `(s, r, o)` tuple。 |
| Open IE | 何でも抽出する | open-vocabulary relation phrases。high recall、low precision。 |
| Closed ontology | fixed schema | relation types の bounded set (Wikidata、UMLS、FIBO)。 |
| Canonicalization | すべてを normalize する | surface names / relations を canonical ids に map する。 |
| AEVS | grounded extraction | Anchor-Extraction-Verification-Supplement pipeline (2026)。 |
| Provenance | source-of-truth link | すべての triple が source への doc id + char-span を持つ。 |
| Distant supervision | cheap labels | text を existing KG と align して training data を作る。 |

## 参考文献

- [Mintz et al. (2009). Distant supervision for relation extraction without labeled data](https://www.aclweb.org/anthology/P09-1113.pdf) — distant-supervision paper。
- [Huguet Cabot, Navigli (2021). REBEL: Relation Extraction By End-to-end Language generation](https://aclanthology.org/2021.findings-emnlp.204.pdf) — seq2seq RE の workhorse。
- [Wadden et al. (2019). Entity, Relation, and Event Extraction with Contextualized Span Representations (DyGIE++)](https://arxiv.org/abs/1909.03546) — joint IE。
- [AEVS — Anchor-Extraction-Verification-Supplement framework](https://www.mdpi.com/2073-431X/15/3/178) — 2026 年の hallucination-mitigation design。
- [Wikidata SPARQL tutorial](https://www.wikidata.org/wiki/Wikidata:SPARQL_tutorial) — canonical graph queries。
