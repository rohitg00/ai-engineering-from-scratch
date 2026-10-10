# 關係抽取與知識圖譜建構

> NER 找到實體。實體連結把它們錨定。關係抽取找出它們之間的邊。知識圖譜是節點、邊，和它們的出處（provenance）彙整。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 5 · 06 (NER), Phase 5 · 25 (Entity Linking)
**Time:** ~60 minutes

## The Problem｜問題

分析師讀到：「Tim Cook became CEO of Apple in 2011.」。四個事實：

- `(Tim Cook, role, CEO)`
- `(Tim Cook, employer, Apple)`
- `(Tim Cook, start_date, 2011)`
- `(Apple, type, Organization)`

關係抽取（relation extraction，RE）把自由文本變成結構化三元組 `(subject, relation, object)`。在語料庫（corpus）上彙整，你就有一張知識圖譜（knowledge graph）。再彙整、再查詢，你就有給 RAG、分析或法規稽核用的推理底層。

2026 年的問題：大型語言模型抽關係抽得很起勁。太起勁。它們會幻覺（hallucination）出來源文本不支持的三元組。沒有出處，你分不出真的三元組和說得通的虛構。2026 年的答案是 AEVS（Anchor-Extraction-Verification-Supplement，錨定–抽取–驗證–補充）式的錨定再驗證管線（pipeline）。

## The Concept｜核心概念

![Text → triples → knowledge graph](../assets/relation-extraction.svg)

**三元組形式。** `(subject_entity, relation_type, object_entity)`。關係來自封閉本體（ontology）（Wikidata 屬性、FIBO、UMLS），或開放集合（OpenIE 風格，什麼都行）。

**三種抽取做法。**

1. **規則／模式。** Hearst 模式：「X such as Y」→ `(Y, isA, X)`。再加上手寫的正規表示式（regex）。脆弱、精確且可解釋。
2. **監督式分類器（classifier）。** 給定句子裡的兩個實體提及，從固定集合預測關係。在 TACRED、ACE、KBP 上訓練。2015 到 2022 的標準。
3. **生成式 LLM。** prompt 模型吐出三元組。開箱就能用。需要出處，不然會幻覺出看起來說得通的垃圾。

**AEVS（Anchor-Extraction-Verification-Supplement，錨定–抽取–驗證–補充，2026）。** 目前抑制幻覺的框架：

- **錨定。** 找出每個實體 span 和關係片語 span，帶精確位置。
- **抽取。** 生成連到錨定 span 的三元組。
- **驗證。** 把三元組的每個元素對回來源文本；不支持的就拒絕。
- **補充。** 一輪覆蓋檢查，確保沒有錨定 span 被丟掉。

幻覺陡降。計算量更多，但可稽核。

**開放對封閉的取捨。**

- **封閉本體。** 固定屬性清單（例如 Wikidata 的 1.1 萬個以上屬性）。可預期。可查詢。很難編造。
- **開放資訊抽取。** 任何動詞片語都能當關係。召回率（recall）高。精確率（precision）低。查詢很亂。

正式環境（production）的知識圖譜通常混用：先用開放資訊抽取探索關係，再把關係標準化到封閉本體，才併進主圖。

```figure
relation-triples
```

## Build It｜動手實作

### 步驟 1：模式抽取

```python
PATTERNS = [
    (r"(?P<s>[A-Z]\w+) (?:is|was) (?:a|an|the) (?P<o>[A-Z]?\w+)", "isA"),
    (r"(?P<s>[A-Z]\w+) (?:is|was) born in (?P<o>\w+)", "bornIn"),
    (r"(?P<s>[A-Z]\w+) works? (?:at|for) (?P<o>[A-Z]\w+)", "worksAt"),
    (r"(?P<s>[A-Z]\w+) founded (?P<o>[A-Z]\w+)", "founded"),
]
```

完整的玩具抽取器見 `code/main.py`。Hearst 模式仍用於特定領域的正式管線，因為可以除錯。

### 步驟 2：監督式關係分類

```python
from transformers import AutoTokenizer, AutoModelForSequenceClassification

tok = AutoTokenizer.from_pretrained("Babelscape/rebel-large")
model = AutoModelForSequenceClassification.from_pretrained("Babelscape/rebel-large")

text = "Tim Cook was born in Alabama. He later became CEO of Apple."
encoded = tok(text, return_tensors="pt", truncation=True)
output = model.generate(**encoded, max_length=200)
triples = tok.batch_decode(output, skip_special_tokens=False)
```

REBEL 是 seq2seq 關係抽取器：文本進去，三元組出來，已經是 Wikidata 屬性 id。在遠距監督（distant supervision）資料上 fine-tune。標準的開放權重基準模型（baseline）。

### 步驟 3：帶錨定的 LLM prompt 抽取

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

每個回傳的 span 都對上來源。`text[start:end] != triple_entity` 的就拒絕。這是 AEVS「驗證」步驟的最小形式。

### 步驟 4：標準化到封閉本體

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

標準化常常是工程工作的 60% 到 80%。要為它留預算。

### 步驟 5：建一張小圖並查詢

```python
triples = extract(text)
graph = {}
for s, r, o in triples:
    graph.setdefault(s, []).append((r, o))


def neighbors(node, relation=None):
    return [(r, o) for r, o in graph.get(node, []) if relation is None or r == relation]


print(neighbors("Tim Cook", relation="P108"))    # -> [(P108, Apple)]
```

這是每個「在知識圖譜上做 RAG」系統的原子。用 RDF 三元組儲存（Blazegraph、Virtuoso）、屬性圖（Neo4j），或向量增強的圖儲存來放大。

## 坑

- **關係抽取之前先共指。** 「He founded Apple」——關係抽取得知道「he」是誰。先跑共指（第 24 課）。
- **實體標準化。** 「Apple Inc」和「Apple」必須解析到同一個節點。先做實體連結（第 25 課）。
- **幻覺三元組。** LLM 吐出文本不支持的三元組。強制做 span 驗證。
- **關係標準化漂移。** 開放資訊抽取的關係不一致（「was born in」「came from」「is a native of」）。不併成標準 id，圖就查不了。
- **時間錯誤。** 「Tim Cook is CEO of Apple」——現在為真，2005 年為假。許多關係只在特定時間範圍內成立。用限定詞（Wikidata 的 `P580` 開始時間、`P582` 結束時間）。
- **領域不合。** REBEL 在 Wikipedia 上訓練。法律、醫學、科學文本常常需要領域 fine-tune 的關係抽取模型。

## Use It｜實際應用

2026 年的組合：

| 情況 | 選擇 |
|-----------|------|
| 要快的正式環境、一般領域 | REBEL 或 LlamaPred，加上 Wikidata 標準化 |
| 領域專用（生醫、法律） | SciREX 風格的領域 fine-tune，加自訂本體 |
| LLM prompt、輸出要稽核 | AEVS 管線：錨定 → 抽取 → 驗證 → 補充 |
| 大量新聞資訊抽取 | 模式加監督式的混合 |
| 從零建知識圖譜 | 開放資訊抽取，再人工過一輪標準化 |
| 時間知識圖譜 | 抽取時帶限定詞（開始／結束時間、時間點） |

整合模式：NER → 共指 → 實體連結 → 關係抽取 → 本體對應 → 載入圖。每一階段都可能是品質閘門。

## Ship It｜交付成果

存成 `outputs/skill-re-designer.md`：

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

## Exercises｜練習

1. **簡單。** 在 5 句新聞上跑 `code/main.py` 裡的模式抽取器。用手檢查精確率。
2. **中等。** 在同一批句子上用 REBEL（或一個小 LLM）。比較三元組。哪個抽取器精確率較高？召回率較高？
3. **困難。** 做 AEVS 管線：用 LLM 抽取，再把 span 對上來源驗證。在 50 句 Wikipedia 風格的句子上，量驗證步驟前後的幻覺率。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|-----------------|-----------------------|
| 三元組 | 主詞–關係–受詞 | 知識圖譜的原子單位 `(s, r, o)`。 |
| 開放資訊抽取 | 什麼都抽 | 開放詞彙的關係片語；召回高，精確率低。 |
| 封閉本體 | 固定 schema | 有界的關係類型集合（Wikidata、UMLS、FIBO）。 |
| 標準化 | 全部對齊 | 把表面名稱和關係對到標準 id。 |
| AEVS | 有依據的抽取 | 錨定–抽取–驗證–補充管線（2026）。 |
| 出處 | 連回來源的連結 | 每個三元組帶著文件 id 和字元 span，指回來源。 |
| 遠距監督 | 便宜的標籤（label） | 把文本和既有知識圖譜對齊，造出訓練資料。 |

## Further Reading｜延伸閱讀

- [Mintz et al. (2009). Distant supervision for relation extraction without labeled data](https://www.aclweb.org/anthology/P09-1113.pdf) ——遠距監督論文。
- [Huguet Cabot, Navigli (2021). REBEL: Relation Extraction By End-to-end Language generation](https://aclanthology.org/2021.findings-emnlp.204.pdf) ——seq2seq 關係抽取的主力。
- [Wadden et al. (2019). Entity, Relation, and Event Extraction with Contextualized Span Representations (DyGIE++)](https://arxiv.org/abs/1909.03546) ——聯合資訊抽取。
- [AEVS — Anchor-Extraction-Verification-Supplement framework](https://www.mdpi.com/2073-431X/15/3/178) ——2026 年抑制幻覺的設計。
- [Wikidata SPARQL tutorial](https://www.wikidata.org/wiki/Wikidata:SPARQL_tutorial) ——標準的圖查詢。
