# 固有表現認識

> 名前を抜き出す。それだけなら簡単に聞こえますが、曖昧な境界、入れ子のエンティティ、ドメイン用語が出てくると話は変わります。

**種類:** 実装
**言語:** Python
**前提:** フェーズ 5 · 02 (BoW + TF-IDF)、フェーズ 5 · 03 (Word Embeddings)
**時間:** 約75分

## 問題

"Apple sued Google over its iPhone search deal in the US." エンティティは5つあります。Apple (ORG)、Google (ORG)、iPhone (PRODUCT)、search deal (おそらく)、US (GPE) です。よいNERシステムは、それらをすべて正しい型で抽出します。悪いシステムはiPhoneを見逃し、果物のAppleと会社のAppleを混同し、`US` をPERSONとしてラベル付けします。

NERは、あらゆる構造化抽出pipelineの下にある働き者です。履歴書解析、コンプライアンスログのスキャン、医療記録の匿名化、検索クエリ理解、チャットボット応答のgrounding、法務契約の抽出。普段は目にしませんが、常に依存しています。

このレッスンでは、古典的な道筋 (rule-based、HMM、CRF) から現代的な道筋 (BiLSTM-CRF、その後transformer) へ進みます。それぞれの段階は、前の段階の具体的な制限を解きます。そのパターン自体がこのレッスンです。

## コンセプト

**BIO tagging** (またはBILOU) は、エンティティ抽出を系列ラベリング問題に変換します。各tokenに `B-TYPE` (エンティティの開始)、`I-TYPE` (エンティティの内側)、または `O` (どのエンティティにも属さない) を付けます。

```
Apple    B-ORG
sued     O
Google   B-ORG
over     O
its      O
iPhone   B-PRODUCT
search   O
deal     O
in       O
the      O
US       B-GPE
.        O
```

複数tokenのエンティティは連鎖します。`New B-GPE`、`York I-GPE`、`City I-GPE` です。BIOを理解するモデルは任意のspanを抽出できます。

アーキテクチャの進化は次の通りです。

- **Rule-based。** Regex + gazetteer lookup。既知エンティティでは高precision、新しいエンティティではカバレッジゼロです。
- **HMM。** Hidden Markov Model。tagが与えられたときのtokenのemission probability、tagからtagへのtransition probability、Viterbi decode。ラベル付きデータで学習します。
- **CRF。** Conditional Random Field。HMMに似ていますがdiscriminativeなので、word shape、大文字小文字、周辺語など任意の特徴を混ぜられます。2026年でも低リソースdeploymentにおける古典的な本番の主力です。
- **BiLSTM-CRF。** 手作り特徴の代わりにneural特徴を使います。LSTMが文を両方向から読み、上にあるCRF layerが一貫したtag列を強制します。
- **Transformer-based。** BERTにtoken-classification headを載せてfine-tuneします。最高accuracy。最も多い計算量。

## 実装

### ステップ1: BIO tagging helper

```python
def spans_to_bio(tokens, spans):
    labels = ["O"] * len(tokens)
    for start, end, label in spans:
        labels[start] = f"B-{label}"
        for i in range(start + 1, end):
            labels[i] = f"I-{label}"
    return labels


def bio_to_spans(tokens, labels):
    spans = []
    current = None
    for i, label in enumerate(labels):
        if label.startswith("B-"):
            if current:
                spans.append(current)
            current = (i, i + 1, label[2:])
        elif label.startswith("I-") and current and current[2] == label[2:]:
            current = (current[0], i + 1, current[2])
        else:
            if current:
                spans.append(current)
                current = None
    if current:
        spans.append(current)
    return spans
```

```python
>>> tokens = ["Apple", "sued", "Google", "over", "iPhone", "sales", "."]
>>> labels = ["B-ORG", "O", "B-ORG", "O", "B-PRODUCT", "O", "O"]
>>> bio_to_spans(tokens, labels)
[(0, 1, 'ORG'), (2, 3, 'ORG'), (4, 5, 'PRODUCT')]
```

### ステップ2: 手作り特徴

古典的な (非neural) NERでは、特徴が勝負です。役に立つ特徴は次のようなものです。

```python
def token_features(token, prev_token, next_token):
    return {
        "lower": token.lower(),
        "is_upper": token.isupper(),
        "is_title": token.istitle(),
        "has_digit": any(c.isdigit() for c in token),
        "suffix_3": token[-3:].lower(),
        "shape": word_shape(token),
        "prev_lower": prev_token.lower() if prev_token else "<BOS>",
        "next_lower": next_token.lower() if next_token else "<EOS>",
    }


def word_shape(word):
    out = []
    for c in word:
        if c.isupper():
            out.append("X")
        elif c.islower():
            out.append("x")
        elif c.isdigit():
            out.append("d")
        else:
            out.append(c)
    return "".join(out)
```

`word_shape("iPhone")` は `xXxxxx` を返します。`word_shape("USA-2024")` は `XXX-dddd` を返します。大文字小文字のパターンは固有名詞に対する強いシグナルです。

### ステップ3: 単純なrule-based + 辞書ベースライン

```python
ORG_GAZETTEER = {"Apple", "Google", "Microsoft", "OpenAI", "Meta", "Amazon", "Netflix"}
GPE_GAZETTEER = {"US", "USA", "UK", "India", "Germany", "France"}
PRODUCT_GAZETTEER = {"iPhone", "Android", "Windows", "ChatGPT", "Claude"}


def rule_based_ner(tokens):
    labels = []
    for token in tokens:
        if token in ORG_GAZETTEER:
            labels.append("B-ORG")
        elif token in GPE_GAZETTEER:
            labels.append("B-GPE")
        elif token in PRODUCT_GAZETTEER:
            labels.append("B-PRODUCT")
        else:
            labels.append("O")
    return labels
```

本番のgazetteerには、WikipediaやDBpediaから収集した数百万件のエントリが入ります。カバレッジは良好です。曖昧性解消 (`Apple` が会社か果物か) はひどいです。だから統計的モデルが勝ちました。

### ステップ4: CRFの段階 (概略、完全実装ではない)

確率論の基礎なしにCRFをゼロから50行で完全実装しても、あまり学びはありません。代わりに `sklearn-crfsuite` を使います。

```python
import sklearn_crfsuite

def to_features(tokens):
    out = []
    for i, tok in enumerate(tokens):
        prev = tokens[i - 1] if i > 0 else ""
        nxt = tokens[i + 1] if i + 1 < len(tokens) else ""
        out.append({
            "word.lower()": tok.lower(),
            "word.isupper()": tok.isupper(),
            "word.istitle()": tok.istitle(),
            "word.isdigit()": tok.isdigit(),
            "word.suffix3": tok[-3:].lower(),
            "word.shape": word_shape(tok),
            "prev.word.lower()": prev.lower(),
            "next.word.lower()": nxt.lower(),
            "BOS": i == 0,
            "EOS": i == len(tokens) - 1,
        })
    return out


crf = sklearn_crfsuite.CRF(algorithm="lbfgs", c1=0.1, c2=0.1, max_iterations=100, all_possible_transitions=True)
X_train = [to_features(s) for s in sentences_tokenized]
crf.fit(X_train, bio_labels_train)
```

`c1` と `c2` はL1正則化とL2正則化です。`all_possible_transitions=True` にすると、`O` の後に `I-ORG` が来るような不正な系列が起こりにくいことをモデルが学習できます。これが、制約を自分で書かなくてもCRFがBIOの一貫性を強制する仕組みです。

### ステップ5: BiLSTM-CRFが追加するもの

特徴は学習されるものになります。入力はtoken embeddings (GloVeまたはfastText) です。LSTMは左から右、右から左に読みます。結合されたhidden stateがCRF出力layerを通ります。CRFは引き続きtag列の一貫性を強制します。LSTMは手作り特徴を学習済み特徴で置き換えます。

```python
import torch
import torch.nn as nn


class BiLSTM_CRF_Head(nn.Module):
    def __init__(self, vocab_size, embed_dim, hidden_dim, n_labels):
        super().__init__()
        self.embed = nn.Embedding(vocab_size, embed_dim)
        self.lstm = nn.LSTM(embed_dim, hidden_dim, bidirectional=True, batch_first=True)
        self.fc = nn.Linear(hidden_dim * 2, n_labels)

    def forward(self, token_ids):
        e = self.embed(token_ids)
        h, _ = self.lstm(e)
        emissions = self.fc(h)
        return emissions
```

CRF layerには `torchcrf.CRF` を使います (pip install pytorch-crf)。手作りCRFに対する改善は測定できますが、数万件のラベル付き文がない限り、期待するほど大きくはありません。

## 使う

spaCyには、本番品質のNERが最初から同梱されています。

```python
import spacy

nlp = spacy.load("en_core_web_sm")
doc = nlp("Apple sued Google over its iPhone search deal in the US.")
for ent in doc.ents:
    print(f"{ent.text:20s} {ent.label_}")
```

```
Apple                ORG
Google               ORG
iPhone               ORG
US                   GPE
```

`iPhone` が `PRODUCT` ではなく `ORG` とラベル付けされている点に注意してください。spaCyの小さいモデルはproductエンティティのカバレッジが弱いです。大きいモデル (`en_core_web_lg`) はより良く、transformerモデル (`en_core_web_trf`) はさらに良くなります。

BERTベースNERにはHugging Faceを使います。

```python
from transformers import pipeline

ner = pipeline("ner", model="dslim/bert-base-NER", aggregation_strategy="simple")
print(ner("Apple sued Google over its iPhone in the US."))
```

```
[{'entity_group': 'ORG', 'word': 'Apple', ...},
 {'entity_group': 'ORG', 'word': 'Google', ...},
 {'entity_group': 'MISC', 'word': 'iPhone', ...},
 {'entity_group': 'LOC', 'word': 'US', ...}]
```

`aggregation_strategy="simple"` は、連続したB-X、I-X tokenを1つのspanにまとめます。これがないとtoken単位のlabelが返り、自分でmergeする必要があります。

### LLMベースNER (2026年の選択肢)

Zero-shotおよびfew-shotのLLM NERは、多くのドメインでfine-tuned modelと競えるようになっており、ラベル付きデータが乏しい場合は大幅に優れます。

- **Zero-shot prompting。** エンティティ型の一覧とschema例をLLMに与えます。JSON出力を依頼します。すぐに動きます。新規ドメインでのaccuracyは中程度です。
- **ZeroTuneBio風prompting。** タスクを、候補抽出 → 意味説明 → 判定 → 再確認に分解します。one-shotではない多段promptにより、biomedical NERのaccuracyが大きく上がります。同じパターンは法務、金融、科学ドメインにも使えます。
- **RAGによるdynamic prompting。** 推論呼び出しごとに、小さな注釈済みseed setから最も類似したラベル付き例を取得し、その場でfew-shot promptを組み立てます。2026年のbenchmarkでは、GPT-4のbiomedical NER F1がstatic promptingより11-12%向上します。
- **エンティティ型ごとの分解。** 長い文書では、すべてのエンティティ型を一度に抽出する単一呼び出しは、長さが増えるほどrecallを落とします。エンティティ型ごとに1回ずつ抽出を実行します。推論コストは上がりますが、accuracyはかなり上がります。臨床ノートや法務契約では標準的なパターンです。

2026年時点の本番推奨: 学習データを集める前に、LLM zero-shotベースラインから始めてください。多くの場合、F1は十分高く、fine-tuningが不要になります。

### 古典的NERがまだ勝つ場所

LLMが使える場合でも、古典的NERが勝つのは次のような場合です。

- レイテンシ予算が50ms未満。
- 数千件のラベル付き例があり、98%以上のF1が必要。
- ドメインに安定したontologyがあり、事前学習済みCRFまたはBiLSTMがよく転移する。
- 規制上の制約により、オンプレミスで非生成モデルが必要。

### 破綻する場所

- **Domain shift。** CoNLLで学習したNERは、法務契約ではgazetteerより悪い結果になります。自分のドメインでfine-tuneしてください。
- **Nested entities。** "Bank of America Tower" はORGであると同時にFACILITYでもあります。標準BIOでは重なり合うspanを表現できません。nested NER (multi-passまたはspan-based model) が必要です。
- **Long entities。** "United States Federal Deposit Insurance Corporation." token-level modelはこれを分割してしまうことがあります。`aggregation_strategy` を使うか、post-processしてください。
- **Sparse types。** 医療NERのlabelにはDRUG_BRAND、ADVERSE_EVENT、DOSEなどがあります。汎用モデルには何もわかりません。この領域ではScispacyとBioBERTが出発点です。

## 出荷する

`outputs/skill-ner-picker.md` として保存します。

```markdown
---
name: ner-picker
description: 与えられた抽出タスクに適したNER手法を選びます。
version: 1.0.0
phase: 5
lesson: 06
tags: [nlp, ner, extraction]
---

タスクの説明 (ドメイン、label set、言語、レイテンシ、データ量) が与えられたら、次を出力します。

1. アプローチ。Rule-based + gazetteer、CRF、BiLSTM-CRF、またはtransformer fine-tune。
2. 開始モデル。名前を挙げます (spaCy model ID、Hugging Face checkpoint ID、または「custom, trained from scratch」)。
3. ラベリング戦略。BIO、BILOU、またはspan-based。1文で正当化します。
4. 評価。`seqeval` を使います。token-levelではなく、必ずentity-level F1を報告します。

ユーザーが事前学習済みドメインモデルを既に持っている場合を除き、500件未満のラベル付き例でtransformerをfine-tuningすることを推奨してはいけません。nestedエンティティにはspan-basedまたはmulti-pass modelが必要だと指摘してください。ユーザーが「production scale」に言及し、labelがCoNLL-2003から変わっていない場合はgazetteer監査を必須にしてください。
```

## 演習

1. **易しい。** `bio_to_spans` (`spans_to_bio` の逆変換) を実装し、10文でround-tripの一貫性を検証してください。
2. **普通。** 上のsklearn-crfsuite CRFをCoNLL-2003 English NER datasetで学習してください。`seqeval` を使ってentity別F1を報告します。典型的な結果は約84 F1です。
3. **難しい。** ドメイン固有のNERデータセット (医療、法務、金融) で `distilbert-base-cased` をfine-tuneしてください。spaCy small modelと比較します。data leakage checkを文書化し、何が意外だったかを書いてください。

## 重要用語

| 用語 | よく言われること | 実際の意味 |
|------|-----------------|------------|
| NER | 名前を抽出する | token spanに型 (PERSON、ORG、GPE、DATEなど) を付ける。 |
| BIO | Tagging scheme | `B-X` は開始、`I-X` は継続、`O` は外側。 |
| BILOU | よりよいBIO | 境界をきれいにするために `L-X` (last)、`U-X` (unit) を追加する。 |
| CRF | 構造化分類器 | emissionだけでなくlabel間のtransitionもモデル化する。妥当な系列を強制する。 |
| Nested NER | 重なり合うエンティティ | あるspanが、その部分spanとは別のエンティティである。BIOでは表現できない。 |
| Entity-level F1 | 正しいNER指標 | 予測spanは正解spanと完全一致する必要がある。Token-level F1はaccuracyを過大評価する。 |

## 参考文献

- [Lample et al. (2016). Neural Architectures for Named Entity Recognition](https://arxiv.org/abs/1603.01360) - BiLSTM-CRFの論文。定番です。
- [Devlin et al. (2018). BERT: Pre-training of Deep Bidirectional Transformers](https://arxiv.org/abs/1810.04805) - 標準になったtoken-classification patternを導入しました。
- [spaCy linguistic features - named entities](https://spacy.io/usage/linguistic-features#named-entities) - `Doc.ents` と `Span` の全属性に関する実用リファレンスです。
- [seqeval](https://github.com/chakki-works/seqeval) - 正しいmetric libraryです。必ず使ってください。
