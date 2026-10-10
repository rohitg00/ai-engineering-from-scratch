# 共指解析（coreference resolution）

> 「She called him. He did not answer. The doctor was at lunch.」三個指稱指向兩個人，名字都沒出現。共指解析弄清誰是誰。

**Type:** Learn
**Languages:** Python
**Prerequisites:** Phase 5 · 06 (NER), Phase 5 · 07 (POS & Parsing)
**Time:** ~60 minutes

## The Problem｜問題

從一篇 300 詞的文章抽出 Apple Inc. 的每一次提及。文章寫「Apple.」時很容易。寫「the company,」「they,」「Cupertino's technology giant,」或「Jobs's firm.」時就難。不把這些提及解析到同一個實體，你的 NER 管線（pipeline）會漏掉 60% 到 80% 的提及。

共指解析把每一個指向同一個真實世界實體的表達，連成一個群集。它是表面 NLP（NER、剖析）和下游語意之間的黏合：資訊抽取、問答、摘要、知識圖譜（knowledge graph）。

為什麼它在 2026 年要緊：

- 摘要：「The CEO announced...」對上「Tim Cook announced...」——摘要應該說出執行長的名字。
- 問答：「Who did she call?」必須解析「she.」。
- 資訊抽取：知識圖譜裡「PER1 founded Apple」和「Jobs founded Apple」分成兩筆，是錯的。
- 多文件資訊抽取：把同一事件的文章裡的提及合併，是跨文件共指。

## The Concept｜核心概念

![Coreference clustering: mentions → entities](../assets/coref.svg)

**任務。** 輸入：一份文件。輸出：把提及（span）分群，每個群集指向一個實體。

**提及的類型。**

- **命名實體。** 「Tim Cook」
- **名詞性提及。** 「the CEO」、「the company」
- **代名詞。** 「he」、「she」、「they」、「it」
- **同位語。** 「Tim Cook, Apple's CEO,」

**架構。**

1. **規則式（Hobbs，1978）。** 用文法規則、基於句法樹的代名詞解析。好的基準模型（baseline）。在代名詞上意外地難打贏。
2. **提及配對分類器（mention-pair classifier）。** 對每一對提及 (m_i, m_j)，預測它們是否共指。用傳遞閉包分群。2016 年以前的標準。
3. **提及排序（mention-ranking）。** 為每個提及把候選先行語（antecedent）排序（包括「沒有先行語」）。取最高的。
4. **基於 span 的端到端（span-based end-to-end，Lee 等人，2017）。** transformer 編碼器。枚舉長度上限以內的所有候選 span。預測提及分數。為每個 span 預測先行語機率。貪婪地分群。現代的預設。
5. **生成式（2024 以後）。** prompt 一個 LLM：「List every pronoun in this text and its antecedent.」。簡單案例表現良好，但處理長文件和罕見所指時仍有困難。

**評估指標。** 五個標準指標（MUC、B³、CEAF、BLANC、LEA），因為沒有單一指標抓得住分群品質。前三個的平均報成 CoNLL F1。2026 年在 CoNLL-2012 上的前沿：約 83 F1。

**已知的難例。**

- 有定描述指向好幾頁之前才介紹的實體。
- 橋接回指（「the wheels」→ 先前提到的一輛車）。
- 中文和日文這類語言裡的零回指。
- 預指（代名詞在所指之前）：「When **she** walked in, Mary smiled.」。

```figure
coref-links
```

## Build It｜動手實作

### 步驟 1：預訓練的神經共指（AllenNLP／spaCy-experimental）

```python
import spacy
nlp = spacy.load("en_coreference_web_trf")   # experimental model
doc = nlp("Apple announced new products. The company said they would ship soon.")
for cluster in doc._.coref_clusters:
    print(cluster, "->", [m.text for m in cluster])
```

較長的文件上，你會得到類似這樣的：
- 群集 1：[Apple, The company, they]
- 群集 2：[new products]

### 步驟 2：規則式代名詞解析器（教學用）

見 `code/main.py` 的純標準函式庫（library）實作：

1. 抽出提及：命名實體（大寫開頭的 span）、代名詞（字典查找）、有定描述（「the X」）。
2. 對每個代名詞，看前面 K 個提及，依這些打分：
   - 性／數一致（啟發式）
   - 新近程度（越近越贏）
   - 句法角色（主詞優先）
3. 連到分數最高的先行語。

打不過神經模型。但它露出搜尋空間，以及端到端模型必須做的決定。

### 步驟 3：用 LLM 做共指

```python
prompt = f"""Text: {text}

List every pronoun and noun phrase that refers to a person or company.
Cluster them by what they refer to. Output JSON:
[{{"entity": "Apple", "mentions": ["Apple", "the company", "it"]}}, ...]
"""
```

兩個要盯的失敗模式。第一，LLM 合併過頭（「him」和「her」指兩個不同的人）。第二，LLM 在長文件裡悄悄丟掉提及。永遠用 span 偏移檢查來驗證。

### 步驟 4：評估

標準的 conll-2012 腳本計算 MUC、B³、CEAF-φ4，並報告平均。內部評估先在你標註過的測試集上做 span 層級的精確率（precision）和召回率（recall），再加提及連結的 F1。

## 坑

- **單一提及群集過多。** 有些系統把每個提及都報成自己的群集。B³ 寬鬆。MUC 會罰。三個指標都要看。
- **長脈絡裡的代名詞。** 超過 2,000 個 token 的文件，F1 掉大約 15 分。切塊要小心。
- **性別假設。** 寫死的性別規則在非二元所指、組織、動物上會壞。用學來的模型，或中性的打分。
- **長文件上的 LLM 漂移。** 單一次 API 呼叫無法可靠地把 50 段以上的提及分群。用滑動視窗再合併。

## Use It｜實際應用

2026 年的組合：

| 情況 | 選擇 |
|-----------|------|
| 英文、單份文件 | `en_coreference_web_trf`（spaCy-experimental）或 AllenNLP 神經共指 |
| 多語 | 在 OntoNotes 或 Multilingual CoNLL 上訓練的 SpanBERT／XLM-R |
| 跨文件事件共指 | 專門的端到端模型（2025–26 的前沿） |
| 快速的 LLM 基準 | GPT-4o／Claude，用結構化輸出的共指 prompt |
| 正式環境（production）的對話系統 | 規則式後援加神經主力，關鍵槽位再人工審 |

2026 年交付出去的整合模式：先跑 NER，再跑共指，把共指群集併進 NER 實體。下游任務看到的是每個群集一個實體，不是每個提及一個實體。

## Ship It｜交付成果

存成 `outputs/skill-coref-picker.md`：

```markdown
---
name: coref-picker
description: Pick a coreference approach, evaluation plan, and integration strategy.
version: 1.0.0
phase: 5
lesson: 24
tags: [nlp, coref, information-extraction]
---

Given a use case (single-doc / multi-doc, domain, language), output:

1. Approach. Rule-based / neural span-based / LLM-prompted / hybrid. One-sentence reason.
2. Model. Named checkpoint if neural.
3. Integration. Order of operations: tokenize → NER → coref → downstream task.
4. Evaluation. CoNLL F1 (MUC + B³ + CEAF-φ4 average) on held-out set + manual cluster review on 20 documents.

Refuse LLM-only coref for documents over 2,000 tokens without sliding-window merge. Refuse any pipeline that runs coref without a mention-level precision-recall report. Flag gender-heuristic systems deployed in demographically diverse text.
```

## Exercises｜練習

1. **簡單。** 在 5 段手寫段落上跑 `code/main.py` 裡的規則式解析器。對上真實標註資料（ground truth）量提及連結的準確率（accuracy）。
2. **中等。** 在一篇新聞上用預訓練的神經共指模型。把群集和你自己的人工標註比。它在哪裡失敗？
3. **困難。** 做一條共指增強的 NER 管線：先 NER，再用共指群集合併。在 100 篇文章上，量相對只有 NER 的實體覆蓋改善。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|-----------------|-----------------------|
| 提及 | 一個指稱 | 指向實體的一段文本（名字、代名詞、名詞片語）。 |
| 先行語 | 「it」指的是什麼 | 較晚的提及與之共指的較早提及。 |
| 群集 | 這個實體的提及 | 全部指向同一個真實世界實體的提及集合。 |
| 回指 | 往回指 | 較晚的提及指向較早的（「he」→「John」）。 |
| 預指 | 往前指 | 較早的提及指向較晚的（「When he arrived, John...」）。 |
| 橋接 | 隱含的指稱 | 「I bought a car. The wheels were bad.」（那輛車的輪子。） |
| CoNLL F1 | 排行榜上的那個數字 | MUC、B³、CEAF-φ4 的 F1 平均。 |

## Further Reading｜延伸閱讀

- [Jurafsky & Martin, SLP3 Ch. 26 — Coreference Resolution and Entity Linking](https://web.stanford.edu/~jurafsky/slp3/26.pdf) ——標準教科書章節。
- [Lee et al. (2017). End-to-end Neural Coreference Resolution](https://arxiv.org/abs/1707.07045) ——基於 span 的端到端。
- [Joshi et al. (2020). SpanBERT](https://arxiv.org/abs/1907.10529) ——改善共指的預訓練。
- [Pradhan et al. (2012). CoNLL-2012 Shared Task](https://aclanthology.org/W12-4501/) ——那個評測。
- [Hobbs (1978). Resolving Pronoun References](https://www.sciencedirect.com/science/article/pii/0024384178900064) ——規則式的經典。
