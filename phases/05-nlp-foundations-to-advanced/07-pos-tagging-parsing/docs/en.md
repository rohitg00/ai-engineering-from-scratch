# POSタグ付けと構文解析

> 文法はしばらく流行遅れだった。それから、あらゆるLLMパイプラインが構造化抽出を検証する必要に迫られ、また戻ってきた。

**種別:** 構築
**言語:** Python
**前提条件:** Phase 5 · 01 (Text Processing), Phase 2 · 14 (Naive Bayes)
**所要時間:** 約45分

## 問題

レッスン01では、見出し語化には品詞タグが必要だと約束した。`running` が動詞だと分からなければ、見出し語化器はそれを `run` に戻せない。`better` が形容詞だと分からなければ、`good` に戻せない。

その約束の裏には、ひとつの大きな研究分野が隠れていた。品詞タグ付けは文法カテゴリを割り当てる。構文解析は文の木構造を復元する。どの単語がどの単語を修飾するのか、どの動詞がどの引数を支配するのかを明らかにする。古典的NLPは、この2つを20年かけて洗練してきた。その後、深層学習が事前学習済みTransformer上のトークン分類タスクへと押し込み、研究コミュニティは先へ進んだ。

しかし応用の現場は違う。構造化抽出パイプラインは今でも内部でPOSと依存木を使う。LLMが生成したJSONは文法制約に照らして検証される。質問応答システムは依存構造解析でクエリを分解する。機械翻訳の品質評価器は構文木の対応を確認する。

知っておく価値がある。このレッスンでは、タグセット、ベースライン、そして自前実装をやめてspaCyを呼ぶべき地点を扱う。

## コンセプト

**POS tagging** は各トークンに文法カテゴリをラベル付けする。**Penn Treebank (PTB)** タグセットは英語の標準だ。36個のタグがあり、普通の読者には細かすぎるように見える区別を持つ。`NN` は単数名詞、`NNS` は複数名詞、`NNP` は単数固有名詞、`VBD` は過去形動詞、`VBZ` は三人称単数現在の動詞、という具合だ。**Universal Dependencies (UD)** タグセットはより粗く、17タグで、言語非依存である。クロスリンガル処理の標準になった。

```
The/DET cats/NOUN were/AUX running/VERB at/ADP 3pm/NOUN ./PUNCT
```

**構文解析** は木を生成する。主な形式は2つある。

- **句構造解析。** 名詞句、動詞句、前置詞句が互いに入れ子になる。出力は非終端カテゴリ (NP, VP, PP) の木で、単語が葉になる。
- **依存構造解析。** 各単語は依存先となる単一の主辞を持ち、文法関係でラベル付けされる。出力は、すべての辺が (主辞, 従属語, 関係) の三つ組である木になる。

依存構造解析は、特に語順の自由度が高い言語に対して言語横断で自然に一般化できるため、2010年代に主流になった。

```
running is ROOT
cats is nsubj of running
were is aux of running
at is prep of running
3pm is pobj of at
```

## 作ってみる

### Step 1: 最頻タグベースライン

動く中で最も単純なPOSタガー。各単語について、訓練時に最も頻繁に持っていたタグを予測する。

```python
from collections import Counter, defaultdict


def train_mft(train_examples):
    word_tag_counts = defaultdict(Counter)
    all_tags = Counter()
    for tokens, tags in train_examples:
        for token, tag in zip(tokens, tags):
            word_tag_counts[token.lower()][tag] += 1
            all_tags[tag] += 1
    word_best = {w: c.most_common(1)[0][0] for w, c in word_tag_counts.items()}
    default_tag = all_tags.most_common(1)[0][0]
    return word_best, default_tag


def predict_mft(tokens, word_best, default_tag):
    return [word_best.get(t.lower(), default_tag) for t in tokens]
```

Brown corpusでは、このベースラインだけで約85%の精度に届く。良くはないが、真面目なモデルが下回ってはいけない床である。

### Step 2: bigram HMMタガー

系列の同時確率をモデル化する。

```
P(tags, words) = prod P(tag_i | tag_{i-1}) * P(word_i | tag_i)
```

表は2つ。遷移確率 (直前のタグが与えられたときのタグ) と、出力確率 (タグが与えられたときの単語) だ。どちらもカウントからLaplace平滑化で推定する。復号にはViterbiを使う。これはタグの格子上で動的計画法を行う方法だ。

```python
import math


def train_hmm(train_examples, alpha=0.01):
    transitions = defaultdict(Counter)
    emissions = defaultdict(Counter)
    tags = set()
    vocab = set()

    for tokens, ts in train_examples:
        prev = "<BOS>"
        for token, tag in zip(tokens, ts):
            transitions[prev][tag] += 1
            emissions[tag][token.lower()] += 1
            tags.add(tag)
            vocab.add(token.lower())
            prev = tag
        transitions[prev]["<EOS>"] += 1

    return transitions, emissions, tags, vocab


def log_prob(table, given, key, smooth_denom, alpha):
    return math.log((table[given].get(key, 0) + alpha) / smooth_denom)


def viterbi(tokens, transitions, emissions, tags, vocab, alpha=0.01):
    tags_list = list(tags)
    n = len(tokens)
    V = [[0.0] * len(tags_list) for _ in range(n)]
    back = [[0] * len(tags_list) for _ in range(n)]

    for j, tag in enumerate(tags_list):
        em_denom = sum(emissions[tag].values()) + alpha * (len(vocab) + 1)
        tr_denom = sum(transitions["<BOS>"].values()) + alpha * (len(tags_list) + 1)
        tr = log_prob(transitions, "<BOS>", tag, tr_denom, alpha)
        em = log_prob(emissions, tag, tokens[0].lower(), em_denom, alpha)
        V[0][j] = tr + em
        back[0][j] = 0

    for i in range(1, n):
        for j, tag in enumerate(tags_list):
            em_denom = sum(emissions[tag].values()) + alpha * (len(vocab) + 1)
            em = log_prob(emissions, tag, tokens[i].lower(), em_denom, alpha)
            best_prev = 0
            best_score = -1e30
            for k, prev_tag in enumerate(tags_list):
                tr_denom = sum(transitions[prev_tag].values()) + alpha * (len(tags_list) + 1)
                tr = log_prob(transitions, prev_tag, tag, tr_denom, alpha)
                score = V[i - 1][k] + tr + em
                if score > best_score:
                    best_score = score
                    best_prev = k
            V[i][j] = best_score
            back[i][j] = best_prev

    last_best = max(range(len(tags_list)), key=lambda j: V[n - 1][j])
    path = [last_best]
    for i in range(n - 1, 0, -1):
        path.append(back[i][path[-1]])
    return [tags_list[j] for j in reversed(path)]
```

Brownでbigram HMMを使うと約93%の精度に届く。85%から93%への上昇の大部分は遷移確率によるものだ。モデルは `DET NOUN` がよくあり、`NOUN DET` はまれだと学習する。

### Step 3: なぜ現代のタガーはこれを上回るのか

遷移確率と出力確率は局所的だ。`saw` が "I bought a saw" では名詞で、"I saw the movie." では動詞だという事実を捉えられない。任意の特徴量 (接尾辞、単語の形、前後の単語、単語そのもの) を使うCRFなら約97%に届く。BiLSTM-CRFやTransformerなら98%以上に届く。

このタスクの上限はアノテータ間の不一致で決まる。Penn Treebankで人間のアノテータが一致するのは約97%だ。98%を超えるモデルは、テストセットに過剰適合している可能性が高い。

### Step 4: 依存構造解析の見取り図

依存構造解析を完全にゼロから実装するのは範囲外だ。定番の教科書的説明はJurafsky and Martinにある。知っておくべき古典的な系統は2つ。

- **遷移ベース** パーサー (arc-eager, arc-standard) はshift-reduceパーサーのように動く。トークンを読み、スタックへshiftし、arcを作るreduce操作を適用する。貪欲復号は高速。古典的実装はMaltParser。現代的なニューラル版はChen and Manningの遷移ベースパーサー。
- **グラフベース** パーサー (Eisnerのアルゴリズム、Dozat-Manning biaffine) は、あり得るすべての主辞-従属語の辺にスコアを付け、最大全域木を選ぶ。遅いが、より高精度だ。

ほとんどの応用ではspaCyを呼べばよい。

```python
import spacy

nlp = spacy.load("en_core_web_sm")
doc = nlp("The cats were running at 3pm.")
for token in doc:
    print(f"{token.text:10s} tag={token.tag_:5s} pos={token.pos_:6s} dep={token.dep_:10s} head={token.head.text}")
```

```
The        tag=DT    pos=DET    dep=det        head=cats
cats       tag=NNS   pos=NOUN   dep=nsubj      head=running
were       tag=VBD   pos=AUX    dep=aux        head=running
running    tag=VBG   pos=VERB   dep=ROOT       head=running
at         tag=IN    pos=ADP    dep=prep       head=running
3pm        tag=NN    pos=NOUN   dep=pobj       head=at
.          tag=.     pos=PUNCT  dep=punct      head=running
```

`dep` 列を下から上へ読むと、文の文法構造が見えてくる。

## 使ってみる

本番向けNLPライブラリはどれも、標準パイプラインの一部としてPOSタガーと依存構造パーサーを同梱している。

- **spaCy** (`en_core_web_sm` / `md` / `lg` / `trf`)。高速で高精度。トークン化 + NER + 見出し語化と統合されている。`token.tag_` (Penn)、`token.pos_` (UD)、`token.dep_` (依存関係)。
- **Stanford NLP (stanza)**。CoreNLPの後継。60以上の言語で最先端級。
- **trankit**。Transformerベース。UD精度が高い。
- **NLTK**。`pos_tag`。使えるが遅く、古い。教育用途には十分。

### 2026年でもこれが重要な場所

- **見出し語化。** レッスン01では、正しく見出し語化するためにPOSが必要だった。これは常に必要だ。
- **LLM出力からの構造化抽出。** 生成された文が文法制約 (主語と動詞の一致、必須修飾語など) を満たすか検証する。
- **アスペクトベース感情分析。** 依存構造解析は、どの形容詞がどの名詞を修飾するかを教えてくれる。
- **クエリ理解。** "movies directed by Wes Anderson starring Bill Murray" は、構文解析によって構造化制約に分解される。
- **クロスリンガル転移。** UDタグと依存関係は言語非依存なので、新しい言語に対するゼロショットの構造化分析を可能にする。
- **低計算量パイプライン。** Transformerを配布できない場合でも、POS + 依存構造解析 + gazetteer だけで驚くほど遠くまで行ける。

## 提出物

`outputs/skill-grammar-pipeline.md` として保存する。

```markdown
---
name: grammar-pipeline
description: 下流NLPタスク向けに古典的なPOS + 依存構造パイプラインを設計する。
version: 1.0.0
phase: 5
lesson: 07
tags: [nlp, pos, parsing]
---

下流タスク (情報抽出、書き換え検証、クエリ分解、見出し語化) が与えられたら、次を出力する。

1. 使用するタグセット。英語のみのレガシーパイプラインならPenn Treebank、多言語またはクロスリンガルならUniversal Dependencies。
2. ライブラリ。ほとんどの本番用途ではspaCy、学術品質の多言語処理ではstanza、最高レベルのUD精度が必要ならtrankit。具体的なモデルIDを挙げる。
3. 統合パターン。ライブラリを呼び、必要な属性 (`.pos_`, `.dep_`, `.head`) を消費する3〜5行を示す。
4. テストすべき失敗モード。名詞/動詞の曖昧性 (`saw`, `book`, `can`) とPP attachmentの曖昧性は古典的な落とし穴。20件の出力をサンプリングして目視する。

独自パーサーの実装は推奨しない。パーサーをゼロから作るのは研究プロジェクトであり、アプリケーション作業ではない。小文字/大文字の揺れを扱わずにPOSタグを消費するパイプラインは壊れやすいと指摘する。
```

## 演習

1. **易しい。** 小さなタグ付きコーパス (例: NLTKのBrown subset) で最頻タグベースラインを使い、hold-out文の精度を測定する。約85%という結果を確認する。
2. **普通。** 上のbigram HMMを訓練し、タグごとのprecision/recallを報告する。HMMが最も混同するタグはどれか。
3. **難しい。** spaCyの依存構造解析を使い、1000文のサンプルから主語-動詞-目的語の三つ組を抽出する。手作業でラベル付けした50個の三つ組で評価する。抽出が失敗する箇所を記録する。よくあるのは受動態、等位接続、省略された主語だ。

## 重要用語

| 用語 | よく言われる説明 | 実際の意味 |
|------|-----------------|-----------------------|
| POS tag | 単語の種類 | 文法カテゴリ。PTBには36個、UDには17個ある。 |
| Penn Treebank | 標準タグセット | 英語特化。動詞の時制や名詞の数を細かく区別する。 |
| Universal Dependencies | 多言語タグセット | PTBより粗い。言語中立で、クロスリンガル処理の標準。 |
| Dependency parse | 文の木 | 各単語が1つの主辞を持ち、各辺が文法関係を持つ。 |
| Viterbi | 動的計画法 | 出力確率と遷移確率から、最も確率の高いタグ系列を見つける。 |

## さらに読む

- [Jurafsky and Martin — Speech and Language Processing, chapters 8 and 18](https://web.stanford.edu/~jurafsky/slp3/) — POSと構文解析の定番教科書的説明。
- [Universal Dependencies project](https://universaldependencies.org/) — すべての多言語パーサーで使われるクロスリンガルなタグセットとtreebank集。
- [spaCy linguistic features guide](https://spacy.io/usage/linguistic-features) — `Token` で公開される各属性の実用的なリファレンス。
- [Chen and Manning (2014). A Fast and Accurate Dependency Parser using Neural Networks](https://nlp.stanford.edu/pubs/emnlp2014-depparser.pdf) — ニューラルパーサーを主流へ押し上げた論文。
