# 自然言語推論 — テキスト含意

> 「t が h を含意する」とは、t を読んだ人間が h は真だと結論づける、という意味です。NLI は、含意 / 矛盾 / 中立を予測するタスクです。表面上は地味ですが、本番環境では重要な土台になります。

**種別:** 学習
**言語:** Python
**前提条件:** Phase 5 · 05 (Sentiment Analysis), Phase 5 · 13 (Question Answering)
**所要時間:** 約60分

## 問題

要約器を作りました。要約が出力されました。その要約にハルシネーションが含まれていないと、どう確認すればよいでしょうか。

チャットボットを作りました。ボットは「yes」と答えました。その答えが検索されたパッセージに裏づけられていると、どう確認すればよいでしょうか。

10,000 件のニュース記事をトピック別に分類する必要があります。訓練ラベルはありません。既存のモデルを再利用できるでしょうか。

この 3 つの問題はいずれも Natural Language Inference に帰着します。NLI は、前提 `t` と仮説 `h` が与えられたとき、`h` が `t` によって含意されるのか、矛盾するのか、中立 (無関係) なのかを問います。

- **ハルシネーションチェック:** `t` = ソース文書、`h` = 要約内の主張。含意でない = ハルシネーション。
- **グラウンデッド QA:** `t` = 検索されたパッセージ、`h` = 生成された回答。含意でない = 捏造。
- **ゼロショット分類:** `t` = 文書、`h` = 言語化したラベル ("This is about sports")。含意 = 予測ラベル。

1 つのタスクで、本番用途が 3 つあります。だからこそ、ほぼすべての RAG 評価フレームワークは内部で NLI モデルを使っています。

## 概念

![NLI: three-way classification, premise vs hypothesis](../assets/nli.svg)

**3 つのラベル。**

- **含意。** `t` → `h`。"The cat is on the mat" は "There is a cat." を含意します。
- **矛盾。** `t` → ¬`h`。"The cat is on the mat" は "There is no cat." と矛盾します。
- **中立。** どちらにも推論できません。"The cat is on the mat" は "The cat is hungry." に対して中立です。

**論理的含意ではありません。** NLI は *自然* 言語推論です。厳密な論理ではなく、典型的な人間の読者が何を推論するかを扱います。"John walked his dog" は NLI では "John has a dog" を含意しますが、厳密な一階述語論理では、所有関係を公理化しない限り認められません。

**データセット。**

- **SNLI** (2015)。人手でアノテーションされた 57 万ペア。前提は画像キャプション。ドメインは狭めです。
- **MultiNLI** (2017)。10 ジャンルにわたる 43.3 万ペア。2026 年時点の標準的な訓練コーパスです。
- **ANLI** (2019)。敵対的 NLI。人間が既存モデルを破ることを狙って例を書きました。より難しいベンチマークです。
- **DocNLI, ConTRoL** (2020–21)。文書長の前提。マルチホップ推論と長距離推論をテストします。

**アーキテクチャ。** transformer encoder (BERT, RoBERTa, DeBERTa) が `[CLS] premise [SEP] hypothesis [SEP]` を読みます。`[CLS]` 表現を 3-way softmax に渡します。MNLI で訓練し、ホールドアウトのベンチマークで評価すると、分布内のペアでは 90% 超の精度が得られます。

**NLI によるゼロショット。** 文書と候補ラベルがあるとき、各ラベルを仮説 ("This text is about sports") に変換します。それぞれの含意確率を計算し、最大のものを選びます。これが Hugging Face の `zero-shot-classification` pipeline の背後にある仕組みです。

## 作ってみる

### Step 1: 事前訓練済み NLI モデルを実行する

```python
from transformers import pipeline

nli = pipeline("text-classification",
               model="facebook/bart-large-mnli",
               top_k=None)  # return all labels; replaces deprecated return_all_scores=True

premise = "The cat is sleeping on the couch."
hypothesis = "There is a cat in the room."

result = nli({"text": premise, "text_pair": hypothesis})[0]
print(result)
# [{'label': 'entailment', 'score': 0.97},
#  {'label': 'neutral', 'score': 0.02},
#  {'label': 'contradiction', 'score': 0.01}]
```

本番向け NLI では、`facebook/bart-large-mnli` と `microsoft/deberta-v3-large-mnli` がオープンな標準候補です。DeBERTa-v3 はリーダーボード上位の常連です。

### Step 2: ゼロショット分類

```python
zs = pipeline("zero-shot-classification", model="facebook/bart-large-mnli")

text = "The stock market rallied after the central bank cut interest rates."
labels = ["finance", "sports", "politics", "technology"]

result = zs(text, candidate_labels=labels)
print(result)
# {'labels': ['finance', 'politics', 'technology', 'sports'],
#  'scores': [0.92, 0.05, 0.02, 0.01]}
```

デフォルトのテンプレートは "This example is about {label}." です。`hypothesis_template` でカスタマイズできます。訓練データは不要です。ファインチューニングも不要です。そのまま動きます。

### Step 3: RAG の忠実性チェック

```python
def is_faithful(answer, context, threshold=0.5):
    result = nli({"text": context, "text_pair": answer})[0]
    entail = next(s for s in result if s["label"] == "entailment")
    return entail["score"] > threshold
```

これは RAGAS の忠実性評価の中核です。生成回答を原子的な主張に分割します。各主張を検索コンテキストと照合します。含意された割合を報告します。

### Step 4: 手作り NLI 分類器 (概念用)

`code/main.py` には stdlib のみの toy があります。前提と仮説を、語彙の重なり + 否定検出で比較します。transformer モデルには到底及びませんが、このタスクの形は示しています。2 つのテキストを入力し、3-way ラベルを出力し、損失は `{entail, contradict, neutral}` 上の cross-entropy です。

## 落とし穴

- **仮説だけのショートカット。** モデルは仮説だけからでも SNLI で約 60% の精度でラベルを予測できます。"not"、"nobody"、"never" が矛盾と相関するためです。ラベル漏れ検出の強力なベースラインになります。
- **語彙重なりヒューリスティック。** 部分系列ヒューリスティック ("every subsequence is entailed") は SNLI では通りますが、HANS/ANLI では失敗します。敵対的ベンチマークを使いましょう。
- **文書長での劣化。** 単文 NLI モデルは文書長の前提で 20+ F1 低下します。長いコンテキストには DocNLI で訓練されたモデルを使います。
- **ゼロショットテンプレート感度。** "This example is about {label}"、"{label}"、"The topic is {label}" の違いだけで精度が 10 ポイント以上動くことがあります。テンプレートをチューニングしてください。
- **ドメイン不一致。** MNLI は一般英語で訓練されています。法律、医療、科学テキストには、ドメイン特化 NLI モデル (SciNLI, MedNLI など) が必要です。

## 使う

2026 年のスタック:

| ユースケース | モデル |
|---------|-------|
| 汎用 NLI | `microsoft/deberta-v3-large-mnli` |
| 高速 / エッジ | `cross-encoder/nli-deberta-v3-base` |
| ゼロショット分類 (軽量) | `facebook/bart-large-mnli` |
| 文書レベル NLI | `MoritzLaurer/DeBERTa-v3-large-mnli-fever-anli-ling-wanli` |
| 多言語 | `MoritzLaurer/multilingual-MiniLMv2-L6-mnli-xnli` |
| RAG のハルシネーション検出 | RAGAS / DeepEval 内の NLI レイヤー |

2026 年のメタパターン: NLI はテキスト理解の万能テープです。「A は B を支持しているか」「A は B と矛盾するか」が必要になったら、別の LLM 呼び出しに進む前に NLI を検討してください。

## 出荷する

`outputs/skill-nli-picker.md` として保存:

```markdown
---
name: nli-picker
description: 分類 / 忠実性 / ゼロショットタスク向けに、NLI モデル、ラベルテンプレート、評価設定を選ぶ。
version: 1.0.0
phase: 5
lesson: 21
tags: [nlp, nli, zero-shot]
---

ユースケース（忠実性チェック、ゼロショット分類、文書レベル推論）が与えられたら、次を出力してください。

1. モデル。名前つき NLI checkpoint。ドメイン、長さ、言語に結びついた理由。
2. テンプレート（ゼロショットの場合）。言語化パターン。例。
3. しきい値。判定ルール用の含意カットオフ。キャリブレーションに基づく理由。
4. 評価。ホールドアウトのラベル付きセットでの accuracy、仮説のみベースライン、敵対的サブセット。

100 例のラベル付き健全性チェックなしでゼロショット分類を出荷することは拒否する。文書長の前提に単文レベル NLI モデルを使うことは拒否する。NLI がハルシネーションを解決すると主張するものには警告する。NLI はそれを減らすが、なくすわけではない。
```

## 演習

1. **Easy.** 全 3 クラスを含む手作りの (premise, hypothesis, label) トリプル 20 件で `facebook/bart-large-mnli` を実行してください。accuracy を測ります。敵対的な「部分系列ヒューリスティック」の罠 ("I did not eat the cake" vs "I ate the cake") を追加し、破綻するか確認してください。
2. **Medium.** AG News 見出し 100 件で、ゼロショットテンプレート `"This text is about {label}"`、`"The topic is {label}"`、`"{label}"` を比較してください。accuracy の振れ幅を報告します。
3. **Hard.** RAG 忠実性チェッカーを作ってください。原子的主張への分解 + 主張ごとの NLI です。gold context つきの RAG 生成回答 50 件で評価します。手作業ラベルに対する false-positive と false-negative の率を測ってください。

## 重要用語

| 用語 | よく言われること | 実際の意味 |
|------|-----------------|-----------------------|
| NLI | Natural Language Inference | 前提と仮説の関係を 3-way 分類すること。 |
| RTE | Recognizing Textual Entailment | NLI の古い呼び名。同じタスク。 |
| Entailment | "t implies h" | t が与えられたとき、典型的な読者は h が真だと結論づける。 |
| Contradiction | "t rules out h" | t が与えられたとき、典型的な読者は h が偽だと結論づける。 |
| Neutral | 未決定 | t から h へ、どちら向きにも推論できない。 |
| Zero-shot classification | 分類器としての NLI | ラベルを仮説として言語化し、最大の含意を選ぶ。 |
| Faithfulness | 回答は裏づけられているか | (検索コンテキスト, 生成回答) に対する NLI。 |

## 参考文献

- [Bowman et al. (2015). A large annotated corpus for learning natural language inference](https://arxiv.org/abs/1508.05326) — SNLI。
- [Williams, Nangia, Bowman (2017). A Broad-Coverage Challenge Corpus for Sentence Understanding through Inference](https://arxiv.org/abs/1704.05426) — MultiNLI。
- [Nie et al. (2019). Adversarial NLI](https://arxiv.org/abs/1910.14599) — ANLI benchmark。
- [Yin, Hay, Roth (2019). Benchmarking Zero-shot Text Classification](https://arxiv.org/abs/1909.00161) — 分類器としての NLI。
- [He et al. (2021). DeBERTa: Decoding-enhanced BERT with Disentangled Attention](https://arxiv.org/abs/2006.03654) — 2026 年の NLI の主力。
