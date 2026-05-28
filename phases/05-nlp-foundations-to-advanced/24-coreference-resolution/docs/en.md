# 共参照解析

> 「彼女は彼に電話した。彼は答えなかった。医師は昼食中だった。」2 人に対して 3 つの参照があり、誰も名前で呼ばれていません。Coreference resolution は、誰が誰なのかを解き明かします。

**種別:** 学習
**言語:** Python
**前提条件:** Phase 5 · 06 (NER), Phase 5 · 07 (POS & Parsing)
**所要時間:** 約60分

## 問題

300 語の記事から Apple Inc. への mentions をすべて抽出してください。記事に "Apple" と書かれていれば簡単です。しかし "the company"、"they"、"Cupertino's technology giant"、"Jobs's firm" と書かれていると難しくなります。これらの mentions を同じ entity に resolve しなければ、NER pipeline は mentions の 60-80% を見逃します。

Coreference resolution は、同じ real-world entity を指すすべての expression を 1 つの cluster に結びつけます。これは surface-level NLP (NER、parsing) と downstream semantics (IE、QA、summarization、KG) をつなぐ接着剤です。

2026 年に重要な理由:

- Summarization: 「The CEO announced...」ではなく「Tim Cook announced...」のように、summary では CEO の名前を出すべきです。
- Question answering: 「彼女は誰に電話したか」に答えるには「彼女」を resolve する必要があります。
- Information extraction: "PER1 founded Apple" と "Jobs founded Apple" が別 entries になっている knowledge graph は間違っています。
- Multi-document IE: 同じ event についての記事間で mentions を merge することは cross-document coreference です。

## 概念

![Coreference clustering: mentions → entities の対応](../assets/coref.svg)

**タスク。** Input: document。Output: mentions (spans) の clustering。各 cluster は 1 つの entity を指します。

**Mention の種類。**

- **Named entity。** "Tim Cook"
- **Nominal。** "the CEO", "the company"
- **Pronominal。** "he", "she", "they", "it"
- **Appositive。** "Tim Cook, Apple's CEO,"

**アーキテクチャ。**

1. **Rule-based (Hobbs, 1978)。** grammar rules を使った syntactic-tree-based pronoun resolution。良い baseline です。pronouns では驚くほど beat しにくいです。
2. **Mention-pair classifier。** mentions のすべての pair (m_i, m_j) について、corefer するかを予測します。transitive closure で cluster にします。2016 年以前の standard です。
3. **Mention-ranking。** 各 mention について、candidate antecedents ("no antecedent" を含む) を rank します。top を選びます。
4. **Span-based end-to-end (Lee et al., 2017)。** Transformer encoder。length cap までのすべての candidate spans を列挙します。mention scores を予測します。各 span について antecedent-probability を予測します。greedy に cluster します。現代の default です。
5. **Generative (2024+)。** LLM に prompt します: "List every pronoun in this text and its antecedent." 簡単な cases ではよく機能しますが、long documents や rare referents では苦戦します。

**評価指標。** standard metrics は 5 つ (MUC、B³、CEAF、BLANC、LEA) あります。単一の metric では clustering quality を捉えきれないためです。最初の 3 つの平均を CoNLL F1 として報告します。2026 年の CoNLL-2012 における state-of-the-art は約 83 F1 です。

**既知の難しいケース。**

- 何ページも前に導入された entities を指す definite descriptions。
- Bridging anaphora ("the wheels" → 前に言及された car)。
- 中国語や日本語のような言語における zero anaphora。
- Cataphora (referent の前に pronoun が出る): "When **she** walked in, Mary smiled."

## 作ってみる

### Step 1: pretrained neural coreference (AllenNLP / spaCy-experimental)

```python
import spacy
nlp = spacy.load("en_coreference_web_trf")   # experimental model
doc = nlp("Apple announced new products. The company said they would ship soon.")
for cluster in doc._.coref_clusters:
    print(cluster, "->", [m.text for m in cluster])
```

より長い document では、次のような結果が得られます。
- Cluster 1: [Apple, The company, they]
- Cluster 2: [new products]

### Step 2: rule-based pronoun resolver (teaching)

stdlib だけの実装は `code/main.py` を参照してください。

1. mentions を抽出します: named entities (capitalized spans)、pronouns (dict lookup)、definite descriptions ("the X")。
2. 各 pronoun について、直前の K mentions を見て、次で score します。
   - gender/number agreement (heuristic)
   - recency (近いほど勝つ)
   - syntactic role (subjects を優先)
3. 最も score の高い antecedent に link します。

neural models とは競争になりません。ただし、search space と、end-to-end model が下す必要のある decisions を示してくれます。

### Step 3: using LLMs for coreference

```python
prompt = f"""Text: {text}

List every pronoun and noun phrase that refers to a person or company.
Cluster them by what they refer to. Output JSON:
[{{"entity": "Apple", "mentions": ["Apple", "the company", "it"]}}, ...]
"""
```

注意すべき failure modes が 2 つあります。第一に、LLMs は過剰に merge します (別々の人を指す "him" と "her" を同一視するなど)。第二に、LLMs は long documents で mentions を黙って落とします。必ず span-offset checks で検証してください。

### Step 4: evaluation

standard の conll-2012 script は MUC、B³、CEAF-φ4 を計算し、その平均を報告します。in-house eval では、まず annotated test set 上の span-level precision and recall から始め、次に mention-linking F1 を追加してください。

## 落とし穴

- **Singleton explosion。** 一部の systems はすべての mention を単独 cluster として報告します。B³ は寛容です。MUC はこれを罰します。必ず 3 つの metrics すべてを確認してください。
- **Long context の pronouns。** 2,000 tokens を超える documents では performance が約 15 F1 落ちます。慎重に chunk してください。
- **Gender assumptions。** Hard-coded gender rules は non-binary referents、organizations、animals で壊れます。learned models か neutral scoring を使ってください。
- **Long docs での LLM drift。** 単一の API call では、50+ paragraphs にまたがる mentions を確実に cluster できません。sliding-window + merge を使ってください。

## 使う

2026 年の stack:

| 状況 | 選択 |
|-----------|------|
| 英語、single document | `en_coreference_web_trf` (spaCy-experimental) または AllenNLP neural coref |
| 多言語 | OntoNotes または Multilingual CoNLL で訓練した SpanBERT / XLM-R |
| Cross-document event coref | 専用の end-to-end models (2025–26 SOTA) |
| 手早い LLM baseline | structured-output coref prompt を使った GPT-4o / Claude |
| 本番 dialog systems | Rule-based fallback + neural primary + critical slots の manual review |

2026 年に出荷される integration pattern: まず NER を実行し、coref を実行し、coref clusters を NER entities に merge します。downstream tasks は、mention ごとに 1 entity ではなく、cluster ごとに 1 entity を見ます。

## 出荷する

`outputs/skill-coref-picker.md` として保存:

```markdown
---
name: coref-picker
description: coreference approach、evaluation plan、integration strategy を選ぶ。
version: 1.0.0
phase: 5
lesson: 24
tags: [nlp, coref, information-extraction]
---

use case (single-doc / multi-doc、domain、language) が与えられたら、次を出力してください。

1. アプローチ。Rule-based / neural span-based / LLM-prompted / hybrid。1 文の理由。
2. モデル。neural の場合は名前つき checkpoint。
3. 統合。操作順: tokenize → NER → coref → downstream task。
4. 評価。held-out set 上の CoNLL F1 (MUC + B³ + CEAF-φ4 average) + 20 documents の manual cluster review。

sliding-window merge なしに 2,000 tokens を超える documents に対して LLM-only coref を使うことは拒否する。mention-level precision-recall report なしに coref を実行する pipeline は拒否する。demographically diverse text に deploy された gender-heuristic systems は警告する。
```

## 演習

1. **Easy.** `code/main.py` の rule-based resolver を 5 つの hand-crafted paragraphs で実行してください。ground truth に対する mention-link accuracy を測ります。
2. **Medium.** pretrained neural coref model を news article に使ってください。clusters を自分の manual annotation と比較します。どこで失敗しましたか。
3. **Hard.** coref-enhanced NER pipeline を作ってください。まず NER、その後 coref clusters で merge します。100 articles 上で NER-only と比べた entity-coverage improvement を測ります。

## 重要用語

| 用語 | よく言われること | 実際の意味 |
|------|-----------------|-----------------------|
| Mention | 参照 | entity (name、pronoun、noun phrase) を指す text span。 |
| Antecedent | "it" が指すもの | 後続 mention と corefer する、先行する mention。 |
| Cluster | entity の mentions | すべて同じ real-world entity を指す mentions の集合。 |
| Anaphora | Backward reference | 後続 mention が先行 mention を指す ("he" → "John")。 |
| Cataphora | Forward reference | 先行 mention が後続 mention を指す ("When he arrived, John...")。 |
| Bridging | Implicit reference | "I bought a car. The wheels were bad." (その car の wheels)。 |
| CoNLL F1 | leaderboards 上の数値 | MUC、B³、CEAF-φ4 F1 scores の平均。 |

## 参考文献

- [Jurafsky & Martin, SLP3 Ch. 26 — Coreference Resolution and Entity Linking](https://web.stanford.edu/~jurafsky/slp3/26.pdf) — canonical textbook chapter。
- [Lee et al. (2017). End-to-end Neural Coreference Resolution](https://arxiv.org/abs/1707.07045) — span-based end-to-end。
- [Joshi et al. (2020). SpanBERT](https://arxiv.org/abs/1907.10529) — coref を改善する pretraining。
- [Pradhan et al. (2012). CoNLL-2012 Shared Task](https://aclanthology.org/W12-4501/) — benchmark。
- [Hobbs (1978). Resolving Pronoun References](https://www.sciencedirect.com/science/article/pii/0024384178900064) — rule-based の古典。
