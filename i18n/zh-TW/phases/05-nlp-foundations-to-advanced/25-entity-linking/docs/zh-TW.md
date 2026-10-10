# 實體連結與消歧（entity linking and disambiguation）

> NER 找到「Paris.」。實體連結決定：法國的 Paris？Paris Hilton？德州的 Paris？特洛伊王子 Paris？沒有連結，你的知識圖譜（knowledge graph）一直是歧義的。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 5 · 06 (NER), Phase 5 · 24 (Coreference Resolution)
**Time:** ~60 minutes

## The Problem｜問題

有一句：「Jordan beat the press.」你的 NER 把「Jordan」標成 PERSON。好。但*哪一個* Jordan？

- 籃球的 Michael Jordan？
- 演員 Michael B. Jordan？
- 柏克萊的機器學習教授 Michael I. Jordan——對，這個混淆在機器學習論文裡是真的？
- 國家 Jordan？
- 希伯來文名 Jordan？

實體連結（EL）把每個提及解析到知識庫（knowledge base）裡唯一的一筆：Wikidata、Wikipedia、DBpedia，或你的領域知識庫。兩個子任務：

1. **候選生成（candidate generation）。** 給定「Jordan」，哪些知識庫條目說得通？
2. **實體連結與消歧。** 給定脈絡，哪個候選才對？

兩步都學得會。兩步都有評測。這條組合管線（pipeline）穩了十年——變的是實體連結與消歧器的品質。

## The Concept｜核心概念

![Entity linking pipeline: mention → candidates → disambiguated entity](../assets/entity-linking.svg)

**候選生成。** 給定提及的表面形式（「Jordan」），在別名索引裡查候選。Wikipedia 的別名辭典蓋住大多數命名實體（named entity）：「JFK」→ John F. Kennedy、Jacqueline Kennedy、JFK 機場、電影 JFK。典型索引每個提及回 10 到 30 個候選。

**實體連結與消歧：三種做法。**

1. **先驗加脈絡（Milne 與 Witten，2008）。** `P(entity | mention) × context-similarity(entity, text)`。好用、快、不用訓練。
2. **基於 embedding（ESS／REL／Blink）。** 把提及加脈絡編碼。把每個候選的描述編碼。取餘弦相似度（cosine similarity）最大的。2020 到 2024 的預設。
3. **生成式（GENRE，2021；基於 LLM，2023 以後）。** 一個 token 一個 token 解出實體的標準名稱。約束在合法實體名稱的前綴樹（trie）上，所以輸出保證是合法的知識庫 id。

**端到端架構與管線式架構。** 現代模型（ELQ、BLINK、ExtEnD、GENRE）一次做完 NER、候選生成和實體連結與消歧。管線系統在正式環境（production）仍佔多數，因為你可以換零件。

### 兩種量測

- **提及召回率（mention recall，候選生成）。** 人工標註的提及裡，正確的知識庫條目出現在候選清單中的比例。整條管線的下限。
- **實體連結與消歧準確率（accuracy）／F1。** 候選正確時，第一名有多常是對的。

兩個都要報。候選召回率 80% 上有 99% 實體連結與消歧的系統，整條管線是 80%。

```figure
gx-entity-linking
```

## Build It｜動手實作

### 步驟 1：用 Wikipedia 重定向建別名索引

```python
alias_to_entities = {
    "jordan": ["Q41421 (Michael Jordan)", "Q810 (Jordan, country)", "Q254110 (Michael B. Jordan)"],
    "paris":  ["Q90 (Paris, France)", "Q663094 (Paris, Texas)", "Q55411 (Paris Hilton)"],
    "apple":  ["Q312 (Apple Inc.)", "Q89 (apple, fruit)"],
}
```

Wikipedia 別名資料：大約 1800 萬對（別名，實體）。從 Wikidata 傾印下載。存成倒排索引。

### 步驟 2：基於脈絡的實體連結與消歧

```python
def disambiguate(mention, context, alias_index, entity_desc):
    candidates = alias_index.get(mention.lower(), [])
    if not candidates:
        return None, 0.0
    context_words = set(tokenize(context))
    best, best_score = None, -1
    for entity_id in candidates:
        desc_words = set(tokenize(entity_desc[entity_id]))
        union = len(context_words | desc_words)
        score = len(context_words & desc_words) / union if union else 0.0
        if score > best_score:
            best, best_score = entity_id, score
    return best, best_score
```

Jaccard 重疊是玩具。換成 embedding 上的餘弦相似度（見 `code/main.py` 步驟 2 的 transformer 版）。

### 步驟 3：基於 embedding（BLINK 風格）

```python
from sentence_transformers import SentenceTransformer
encoder = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")

def embed_mention(text, mention_span):
    start, end = mention_span
    marked = f"{text[:start]} [MENTION] {text[start:end]} [/MENTION] {text[end:]}"
    return encoder.encode([marked], normalize_embeddings=True)[0]

def embed_entity(entity_id, description):
    return encoder.encode([f"{entity_id}: {description}"], normalize_embeddings=True)[0]
```

建索引時，每個知識庫實體做一次 embedding。查詢時，提及加脈絡做一次 embedding，和候選池做內積（dot product），取最大。

### 步驟 4：生成式實體連結（概念）

GENRE 一個字元一個字元解出實體的 Wikipedia 標題。約束解碼（見第 20 課）保證只有合法標題能輸出。和知識庫支撐的前綴樹扣得很緊。現代的後代是 REL-GEN，以及用結構化輸出、由 LLM prompt 的實體連結。

```python
prompt = f"""Text: {text}
Mention: {mention}
List the best Wikipedia title for this mention.
Respond with JSON: {{"title": "..."}}"""
```

加上允許清單（Outlines `choice`），這是 2026 年最簡單能交付的實體連結管線。

### 步驟 5：在 AIDA-CoNLL 上評估

AIDA-CoNLL 是標準的實體連結評測：1,393 篇 Reuters 文章、3.4 萬個提及、Wikipedia 實體。報告知識庫內準確率（`P@1`）和知識庫外的 NIL 偵測率。

## 坑

- **NIL 的處理。** 有些提及不在知識庫裡（新興實體、不起眼的人）。系統必須預測 NIL，而不是猜錯的實體。分開量。
- **提及邊界錯誤。** 上游 NER 漏掉部分 span（「Bank of America」只標成「Bank」）。實體連結的召回率掉。
- **流行度偏差。** 訓練過的系統過度預測常見實體。機器學習論文裡的「Michael I. Jordan」常常連到籃球的 Jordan。
- **跨語言實體連結。** 把中文文本裡的提及對到英文 Wikipedia 實體。需要多語編碼器，或一個翻譯步驟。
- **知識庫過時。** 新公司、事件、人不在去年的 Wikipedia 傾印裡。正式環境管線需要刷新迴圈。

## Use It｜實際應用

2026 年的組合：

| 情況 | 選擇 |
|-----------|------|
| 通用英文加 Wikipedia | BLINK 或 REL |
| 跨語言、知識庫是 Wikipedia | mGENRE |
| 對 LLM 友善、每天提及很少 | 把候選清單 prompt 給 Claude／GPT-4，加上約束的 JSON |
| 領域知識庫（醫學、法律） | 自訂 BERT，帶知識庫感知的檢索，並在領域的 AIDA 風格集合上 fine-tune |
| 極低延遲（latency） | 只用精確相符的先驗，也就是 Milne-Witten 基準模型（baseline） |
| 研究前沿 | GENRE／ExtEnD／生成式 LLM 實體連結 |

2026 年交付出去的正式環境模式：NER → 共指 → 對每個提及做實體連結 → 每個群集併成一個標準實體。輸出：文件裡每個實體一個知識庫 id，不是每個提及一個。

## Ship It｜交付成果

存成 `outputs/skill-entity-linker.md`：

```markdown
---
name: entity-linker
description: Design an entity linking pipeline — KB, candidate generator, disambiguator, evaluation.
version: 1.0.0
phase: 5
lesson: 25
tags: [nlp, entity-linking, knowledge-graph]
---

Given a use case (domain KB, language, volume, latency budget), output:

1. Knowledge base. Wikidata / Wikipedia / custom KB. Version date. Refresh cadence.
2. Candidate generator. Alias-index, embedding, or hybrid. Target mention recall @ K.
3. Disambiguator. Prior + context, embedding-based, generative, or LLM-prompted.
4. NIL strategy. Threshold on top score, classifier, or explicit NIL candidate.
5. Evaluation. Mention recall @ 30, top-1 accuracy, NIL-detection F1 on held-out set.

Refuse any EL pipeline without a mention-recall baseline (you cannot evaluate a disambiguator without knowing candidate gen surfaced the right entity). Refuse any pipeline using LLM-prompted EL without constrained output to valid KB ids. Flag systems where popularity bias affects minority entities (e.g. name-clashes) without domain fine-tuning.
```

## Exercises｜練習

1. **簡單。** 在 10 個有歧義的提及（Paris、Jordan、Apple）上，實作 `code/main.py` 裡的先驗加脈絡實體連結與消歧器。用手標出正確實體。量準確率。
2. **中等。** 用句子 transformer 編碼 50 個有歧義的提及。把每個候選的描述做成 embedding。比較基於 embedding 的實體連結與消歧和 Jaccard 脈絡重疊。
3. **困難。** 建一個 1000 個實體的領域知識庫（例如你公司的員工加產品）。端到端實作 NER 加實體連結。在 100 句留出句子上量精確率（precision）和召回率。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|-----------------|-----------------------|
| 實體連結（EL） | 連到 Wikipedia | 把提及對到唯一的知識庫條目。 |
| 候選生成 | 可能是誰？ | 為一個提及回一份說得通的知識庫條目短名單。 |
| 實體連結與消歧 | 挑對的那個 | 用脈絡為候選打分，挑出贏家。 |
| 別名索引 | 那張查找表 | 從表面形式對到候選實體。 |
| NIL | 不在知識庫裡 | 明確預測沒有知識庫條目相符。 |
| 知識庫 | 知識庫 | Wikidata、Wikipedia、DBpedia，或你的領域知識庫。 |
| AIDA-CoNLL | 那個評測 | 1,393 篇帶人工標註實體連結的 Reuters 文章。 |

## Further Reading｜延伸閱讀

- [Milne, Witten (2008). Learning to Link with Wikipedia](https://researchcommons.waikato.ac.nz/entities/publication/b9a0b520-abc5-47c5-a86a-da6c579893ab) ——先驗加脈絡的奠基做法。
- [Wu et al. (2020). Zero-shot Entity Linking with Dense Entity Retrieval (BLINK)](https://arxiv.org/abs/1911.03814) ——以 embedding 為主力的那篇。
- [De Cao et al. (2021). Autoregressive Entity Retrieval (GENRE)](https://arxiv.org/abs/2010.00904) ——帶約束解碼的生成式實體連結。
- [Hoffart et al. (2011). Robust Disambiguation of Named Entities in Text (AIDA)](https://www.aclweb.org/anthology/D11-1072.pdf) ——評測論文。
- [REL: An Entity Linker Standing on the Shoulders of Giants (2020)](https://arxiv.org/abs/2006.01969) ——開放的正式環境組合。
