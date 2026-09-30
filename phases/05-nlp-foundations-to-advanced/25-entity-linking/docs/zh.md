# 實體連結與消歧

> NER 找到了 "Paris"。實體連結要決定的是：Paris, France？Paris Hilton？Paris, Texas？還是 Paris（那位特洛伊王子）？沒有連結，你的知識圖譜就一直是模稜兩可的。

**類型：** 實作
**程式語言：** Python
**先修單元：** 階段 5 · 06（NER）、階段 5 · 24（指代消解）
**時間：** 約 60 分鐘

## 問題所在

有個句子寫著："Jordan beat the press."，你的 NER 把 "Jordan" 標成 PERSON。很好。但是*哪一個* Jordan？

- Michael Jordan（籃球）？
- Michael B. Jordan（演員）？
- Michael I. Jordan（柏克萊的機器學習教授——是的，這個混淆在機器學習論文裡真的會發生）？
- Jordan（那個國家）？
- Jordan（希伯來語的名字）？

實體連結（EL）把每個提及解到知識庫裡一筆唯一的條目上：Wikidata、Wikipedia、DBpedia，或你自家領域的知識庫。它拆成兩個子任務：

1. **候選生成。** 給定 "Jordan"，哪些知識庫條目是說得通的？
2. **消歧。** 給定上下文，哪一個候選才是對的？

兩個步驟都可以學。兩個步驟都有基準測試。整條管線的組合方式十年來都很穩定——會變的是消歧器的品質。

## 核心概念

![實體連結管線：提及 → 候選 → 消歧後的實體](../assets/entity-linking.svg)

**候選生成。** 拿提及的表面形式（"Jordan"）去別名索引裡查候選。Wikipedia 的別名字典涵蓋了大多數命名實體："JFK" → John F. Kennedy、Jacqueline Kennedy、JFK airport、JFK（電影）。一般的索引每個提及會回傳 10-30 個候選。

**消歧：三種做法。**

1. **先驗 + 上下文（Milne & Witten, 2008）。** `P(entity | mention) × context-similarity(entity, text)`。效果好、速度快、不用訓練。
2. **基於嵌入（ESS／REL／Blink）。** 編碼提及 + 上下文。編碼每個候選的描述。取餘弦相似度最大者。2020-2024 年的預設做法。
3. **生成式（GENRE, 2021；基於 LLM，2023 年起）。** 逐詞元解碼出實體的正規名稱。解碼被限制在一棵合法實體名稱的 trie 上，所以輸出保證是一個有效的知識庫 id。

**端到端 vs 管線。** 現代模型（ELQ、BLINK、ExtEnD、GENRE）一次跑完 NER + 候選生成 + 消歧。管線式系統在生產環境仍然佔優勢，因為你可以逐個元件替換。

### 兩個要量的東西

- **提及召回率（候選生成）。** 正確知識庫條目出現在候選清單裡的黃金提及比例。整條管線的地板就是它。
- **消歧準確率／F1。** 在候選正確的前提下，top-1 對的頻率有多高。

兩個都要回報。一個系統在 80% 候選召回率上有 99% 的消歧準確率，那它是一條 80% 的管線。

```figure
gx-entity-linking
```

## 動手實作

### 步驟 1：用 Wikipedia 重新導向建別名索引

```python
alias_to_entities = {
    "jordan": ["Q41421 (Michael Jordan)", "Q810 (Jordan, country)", "Q254110 (Michael B. Jordan)"],
    "paris":  ["Q90 (Paris, France)", "Q663094 (Paris, Texas)", "Q55411 (Paris Hilton)"],
    "apple":  ["Q312 (Apple Inc.)", "Q89 (apple, fruit)"],
}
```

Wikipedia 的別名資料：約 1,800 萬組（別名, 實體）配對。從 Wikidata 的 dump 下載。存成反向索引。

### 步驟 2：基於上下文的消歧

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

Jaccard 重疊只是個玩具。換成嵌入上的餘弦相似度（transformer 版本見 `code/main.py` 的步驟 2）。

### 步驟 3：基於嵌入（BLINK 風格）

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

建索引時，把每個知識庫實體都編碼一次。查詢時，把提及 + 上下文編碼一次，跟候選池做內積，取最大值。

### 步驟 4：生成式實體連結（概念）

GENRE 逐字元解碼出實體的 Wikipedia 標題。受限解碼（見單元 20）保證只有合法標題能被輸出。它跟一棵由知識庫支撐的 trie 緊密整合。現代的後繼者是 REL-GEN 與搭配結構化輸出的 LLM 提示式 EL。

```python
prompt = f"""Text: {text}
Mention: {mention}
List the best Wikipedia title for this mention.
Respond with JSON: {{"title": "..."}}"""
```

再配上一份白名單（Outlines 的 `choice`），這就是 2026 年最容易上線的 EL 管線。

### 步驟 5：在 AIDA-CoNLL 上評估

AIDA-CoNLL 是標準的 EL 基準測試：1,393 篇路透社文章、34k 個提及、Wikipedia 實體。回報 in-KB 準確率（`P@1`）與知識庫外的無對應實體（NIL）偵測率。

## 常見陷阱

- **無對應實體（NIL）的處理。** 有些提及根本不在知識庫裡（新興實體、名不見經傳的人）。系統必須預測 NIL，而不是硬猜一個錯的實體。這要分開量測。
- **提及邊界錯誤。** 上游 NER 漏掉部分區段（"Bank of America" 只被標成 "Bank"）。EL 召回率就掉下來。
- **熱門度偏誤。** 訓練出來的系統會過度預測高頻實體。一篇機器學習論文裡的 "Michael I. Jordan" 常常被連到打籃球的那個 Jordan。
- **跨語言 EL。** 把中文文本裡的提及對應到英文 Wikipedia 實體。需要一個多語言編碼器，或是加一道翻譯步驟。
- **知識庫過期。** 新公司、新事件、新人物不會在去年的 Wikipedia dump 裡。生產環境的管線需要一個更新迴圈。

## 框架應用

2026 年的技術選擇：

| 情境 | 選什麼 |
|-----------|------|
| 通用英文 + Wikipedia | BLINK 或 REL |
| 跨語言、知識庫 = Wikipedia | mGENRE |
| 對 LLM 友善、每天只有少量提及 | 用候選清單 + 受限 JSON 對 Claude／GPT-4 下提示詞 |
| 特定領域的知識庫（醫療、法律） | 自訂 BERT 搭配知識庫感知的檢索 + 在領域內的 AIDA 式資料集上微調 |
| 極低延遲 | 只用完全比對的先驗（Milne-Witten 基線） |
| 研究 SOTA | GENRE／ExtEnD／生成式 LLM-EL |

2026 年真正上線的生產模式是：NER → 指代消解 → 對每個提及做 EL → 把叢集收斂成每群一個正規實體。輸出是文件裡每個實體一個知識庫 id，而不是每個提及一個。

## 產出交付

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

## 練習

1. **簡單。** 在 `code/main.py` 裡對 10 個有歧義的提及（Paris、Jordan、Apple）實作先驗+上下文的消歧器。手工標出正確實體。量測準確率。
2. **中等。** 用 sentence transformer 編碼 50 個有歧義的提及。把每個候選的描述也嵌入。比較基於嵌入的消歧與 Jaccard 上下文重疊。
3. **困難。** 建一個 1k 實體的領域知識庫（例如你公司的員工 + 產品）。端到端實作 NER + EL。在 100 個保留句子上量測精確率與召回率。

## 關鍵術語

| 術語 | 大家怎麼說 | 實際上是什麼 |
|------|-----------------|-----------------------|
| 實體連結（EL） | 「連到 Wikipedia」 | 把一個提及對應到唯一一筆知識庫條目。 |
| 候選生成 | 「它可能是誰？」 | 為一個提及回傳一份說得通的知識庫條目短名單。 |
| 消歧 | 「挑出對的那個」 | 用上下文給候選評分，挑出贏家。 |
| 別名索引 | 「那張查找表」 | 從表面形式 → 候選實體的對應表。 |
| 無對應實體（NIL） | 「不在知識庫裡」 | 明確預測「沒有任何知識庫條目對得上」。 |
| 知識庫（KB） | 「knowledge base」 | Wikidata、Wikipedia、DBpedia，或你自家領域的知識庫。 |
| AIDA-CoNLL | 「那個基準測試」 | 1,393 篇附有黃金實體連結的路透社文章。 |

## 延伸閱讀

- [Milne, Witten (2008). Learning to Link with Wikipedia](https://researchcommons.waikato.ac.nz/entities/publication/b9a0b520-abc5-47c5-a86a-da6c579893ab) —— 奠基性的先驗+上下文做法。
- [Wu et al. (2020). Zero-shot Entity Linking with Dense Entity Retrieval (BLINK)](https://arxiv.org/abs/1911.03814) —— 基於嵌入的主力。
- [De Cao et al. (2021). Autoregressive Entity Retrieval (GENRE)](https://arxiv.org/abs/2010.00904) —— 搭配受限解碼的生成式 EL。
- [Hoffart et al. (2011). Robust Disambiguation of Named Entities in Text (AIDA)](https://www.aclweb.org/anthology/D11-1072.pdf) —— 那篇基準測試論文。
- [REL: An Entity Linker Standing on the Shoulders of Giants (2020)](https://arxiv.org/abs/2006.01969) —— 開源的生產級技術堆疊。
