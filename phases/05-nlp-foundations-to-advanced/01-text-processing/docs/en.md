# テキスト処理 — トークン化、ステミング、レンマ化

> 言語は連続的です。モデルは離散的です。前処理はその橋渡しです。

**種別:** 実装
**言語:** Python
**前提条件:** フェーズ 2 · 14 (ナイーブベイズ)
**所要時間:** 約 45 分

## 課題

モデルは "The cats were running." をそのまま読めません。モデルが読むのは整数です。

どの NLP システムも、最初に同じ 3 つの問いに向き合います。単語はどこから始まるのか。単語の語根は何か。必要なときには "run"、"running"、"ran" を同じものとして扱い、そうでないときには別物として扱うにはどうすればよいのか。

トークン化を間違えると、モデルは壊れたデータから学習します。トークナイザが `don't` を 1 トークンとして扱う一方で `do n't` を 2 トークンとして扱うなら、学習分布は分裂します。ステマーが `organization` と `organ` を同じステムに潰してしまうと、トピックモデリングは壊れます。レンマ化器が品詞コンテキストを必要としているのにそれを渡さないと、動詞が名詞として扱われます。

このレッスンでは、3 つの前処理ステップをゼロから実装し、その後 NLTK と spaCy が同じ処理をどう行うかを見て、トレードオフを理解します。

## 考え方

操作は 3 つです。それぞれ役割と失敗モードがあります。

**トークン化** は文字列をトークンに分割します。「トークン」は意図的に曖昧な言葉です。適切な粒度はタスクによって変わるからです。古典的 NLP では単語単位。Transformer ではサブワード。空白を持たない言語では文字単位です。

**ステミング** はルールで接尾辞を切り落とします。高速で、攻撃的で、単純です。`running -> run`。`organization -> organ`。後者が失敗モードです。

**レンマ化** は文法知識を使って、単語を辞書形に戻します。遅めですが正確で、ルックアップ表または形態素解析器が必要です。`ran -> run` ("ran" が "run" の過去形だと知る必要があります)。`better -> good` (比較級を知る必要があります)。

目安としては、速度が重要でノイズを許容できるならステミングを使います (検索インデックス、粗い分類)。意味が重要ならレンマ化を使います (質問応答、意味検索、ユーザーが読むもの全般)。

## 作ってみる

### ステップ 1: 正規表現による単語トークナイザ

最小限に有用なトークナイザは、英数字以外で分割しつつ、句読点を独立したトークンとして残します。完璧でも最終形でもありませんが、1 行で動きます。

```python
import re

def tokenize(text):
    return re.findall(r"[A-Za-z]+(?:'[A-Za-z]+)?|[0-9]+|[^\sA-Za-z0-9]", text)
```

優先順に 3 つのパターンがあります。内側のアポストロフィを任意で含む単語 (`don't`, `it's`)。純粋な数字。空白でも英数字でもない任意の 1 文字を単独トークンとして扱うもの (句読点)。

```python
>>> tokenize("The cats weren't running at 3pm.")
['The', 'cats', "weren't", 'running', 'at', '3', 'pm', '.']
```

注目すべき失敗モードがあります。`3pm` は `['3', 'pm']` に分かれます。文字列の連続と数字の連続を別パターンとして交互に見ているからです。多くのタスクでは十分です。URL、メールアドレス、ハッシュタグはすべて壊れます。本番では、汎用パターンより前にそれらのパターンを追加します。

### ステップ 2: Porter ステマー (step 1a のみ)

完全な Porter アルゴリズムには 5 段階のルールがあります。Step 1a だけでも、英語で頻出する接尾辞を扱え、このパターンを学ぶには十分です。

```python
def stem_step_1a(word):
    if word.endswith("sses"):
        return word[:-2]
    if word.endswith("ies"):
        return word[:-2]
    if word.endswith("ss"):
        return word
    if word.endswith("s") and len(word) > 1:
        return word[:-1]
    return word
```

```python
>>> [stem_step_1a(w) for w in ["caresses", "ponies", "caress", "cats"]]
['caress', 'poni', 'caress', 'cat']
```

ルールは上から下に読みます。`ies -> i` ルールがあるため、`ponies -> pony` ではなく `ponies -> poni` になります。本物の Porter では step 1b がこれを修正します。ルールは競合します。先に出てきたルールが勝ちます。順序は個々のルール以上に重要です。

### ステップ 3: ルックアップベースのレンマ化器

本来のレンマ化には形態論が必要です。教材として扱いやすい版では、小さなレンマ表とフォールバックを使います。

```python
LEMMA_TABLE = {
    ("running", "VERB"): "run",
    ("ran", "VERB"): "run",
    ("runs", "VERB"): "run",
    ("better", "ADJ"): "good",
    ("best", "ADJ"): "good",
    ("cats", "NOUN"): "cat",
    ("cat", "NOUN"): "cat",
    ("were", "VERB"): "be",
    ("was", "VERB"): "be",
    ("is", "VERB"): "be",
}

def lemmatize(word, pos):
    key = (word.lower(), pos)
    if key in LEMMA_TABLE:
        return LEMMA_TABLE[key]
    if pos == "VERB" and word.endswith("ing"):
        return word[:-3]
    if pos == "NOUN" and word.endswith("s"):
        return word[:-1]
    return word.lower()
```

```python
>>> lemmatize("running", "VERB")
'run'
>>> lemmatize("cats", "NOUN")
'cat'
>>> lemmatize("better", "ADJ")
'good'
>>> lemmatize("watched", "VERB")
'watched'
```

最後の例が重要な学びどころです。`watched` は表に存在せず、フォールバックは `ing` しか扱いません。本物のレンマ化は `ed`、不規則動詞、比較級形容詞、音変化を伴う複数形 (`children -> child`) を扱います。本番システムで WordNet、spaCy の morphologizer、または完全な形態素解析器を使う理由はここにあります。

### ステップ 4: パイプラインとしてつなぐ

```python
def preprocess(text, pos_tagger=None):
    tokens = tokenize(text)
    stems = [stem_step_1a(t.lower()) for t in tokens]
    tags = pos_tagger(tokens) if pos_tagger else [(t, "NOUN") for t in tokens]
    lemmas = [lemmatize(word, pos) for word, pos in tags]
    return {"tokens": tokens, "stems": stems, "lemmas": lemmas}
```

欠けている部品は POS タガーです。フェーズ 5 · 07 (POS Tagging) でこれを作ります。今はすべてを `NOUN` として扱い、その制約を明確にしておきます。

## 使ってみる

NLTK と spaCy には本番向けの実装が入っています。どちらも数行で使えます。

### NLTK

```python
import nltk
nltk.download("punkt_tab")
nltk.download("wordnet")
nltk.download("averaged_perceptron_tagger_eng")

from nltk.tokenize import word_tokenize
from nltk.stem import PorterStemmer, WordNetLemmatizer
from nltk import pos_tag

text = "The cats were running."
tokens = word_tokenize(text)
stems = [PorterStemmer().stem(t) for t in tokens]
lemmatizer = WordNetLemmatizer()
tagged = pos_tag(tokens)


def nltk_pos_to_wordnet(tag):
    if tag.startswith("V"):
        return "v"
    if tag.startswith("J"):
        return "a"
    if tag.startswith("R"):
        return "r"
    return "n"


lemmas = [lemmatizer.lemmatize(t, nltk_pos_to_wordnet(tag)) for t, tag in tagged]
```

`word_tokenize` は短縮形、Unicode、正規表現では漏れるエッジケースを扱います。`PorterStemmer` は 5 段階すべてを実行します。`WordNetLemmatizer` には、NLTK の Penn Treebank スキームの POS タグを WordNet の略号セットへ変換して渡す必要があります。上の変換部分こそ、多くのチュートリアルが省いてしまう箇所です。

### spaCy

```python
import spacy

nlp = spacy.load("en_core_web_sm")
doc = nlp("The cats were running.")

for token in doc:
    print(token.text, token.lemma_, token.pos_)
```

```
The      the     DET
cats     cat     NOUN
were     be      AUX
running  run     VERB
.        .       PUNCT
```

spaCy はパイプライン全体を `nlp(text)` の背後に隠します。トークン化、POS タギング、レンマ化がすべて実行されます。大規模処理では NLTK より高速です。初期状態での精度も高めです。トレードオフは、個々のコンポーネントを簡単には差し替えられないことです。

### どれを選ぶか

| 状況 | 選択 |
|-----------|------|
| 教材、研究、コンポーネントの差し替え | NLTK |
| 本番、多言語、速度が重要 | spaCy |
| Transformer パイプライン (いずれにせよモデルのトークナイザを使う) | `tokenizers` / `transformers` を使い、古典的前処理を省く |

### 誰も警告してくれない 2 つの失敗モード

多くのチュートリアルはアルゴリズムを教えて終わります。実際の前処理パイプラインでは 2 つの問題が噛みついてきますが、ほとんど扱われません。

**再現性のドリフト。** NLTK と spaCy は、バージョン間でトークン化やレンマ化の挙動を変えることがあります。spaCy 2.x で `['do', "n't"]` を返していたものが、3.x では `["don't"]` になるかもしれません。モデルは一方の分布で学習されています。推論は別の分布で走ります。精度は静かに劣化し、誰も理由に気づきません。`requirements.txt` でライブラリのバージョンを固定してください。サンプル文 20 個の期待トークン化を固定する前処理回帰テストを書いてください。アップグレードのたびに実行します。

**学習 / 推論の不一致。** 学習時には強い前処理 (小文字化、ストップワード削除、ステミング) を行い、デプロイ時には生のユーザー入力を渡すと、性能は崩れます。これは本番 NLP で最もよくある失敗です。学習時に前処理するなら、推論時にも同一の関数を実行しなければなりません。前処理はモデルパッケージ内の関数として同梱し、サービングチームが書き直すノートブックのセルにしないでください。

## 形にして届ける

エンジニアが 3 冊の教科書を読まずに前処理戦略を選べるようにする、再利用可能なプロンプトです。

`outputs/prompt-preprocessing-advisor.md` として保存します。

```markdown
---
name: preprocessing-advisor
description: Recommends a tokenization, stemming, and lemmatization setup for an NLP task.
phase: 5
lesson: 01
---

You advise on classical NLP preprocessing. Given a task description, you output:

1. Tokenization choice (regex, NLTK word_tokenize, spaCy, or transformer tokenizer). Explain why.
2. Whether to stem, lemmatize, both, or neither. Explain why.
3. Specific library calls. Name the functions. Quote the POS-tag translation if NLTK is involved.
4. One failure mode the user should test for.

Refuse to recommend stemming for user-visible text. Refuse to recommend lemmatization without POS tags. Flag non-English input as needing a different pipeline.
```

## 演習

1. **易しい。** URL を 1 つのトークンとして保持するように `tokenize` を拡張してください。テスト: `tokenize("Visit https://example.com today.")` が URL トークンを 1 つ生成すること。
2. **普通。** Porter step 1b を実装してください。単語に母音が含まれ、`ed` または `ing` で終わる場合はそれを削除します。二重子音ルールも扱います (`hopping -> hop` であり、`hopp` ではありません)。
3. **難しい。** WordNet をルックアップ表として使い、WordNet に項目がない場合は自作 Porter ステマーへフォールバックするレンマ化器を作ってください。タグ付きコーパス上で、純粋な WordNet と純粋な Porter に対する精度を測定します。

## 重要用語

| 用語 | よく言われる意味 | 実際の意味 |
|------|-----------------|-----------------------|
| トークン | 単語 | モデルが消費する任意の単位。単語、サブワード、文字、バイトになり得ます。 |
| ステム | 単語の語根 | ルールベースの接尾辞削除の結果。常に実在語とは限りません。 |
| レンマ | 辞書形 | 辞書で引く形。正しく求めるには文法コンテキストが必要です。 |
| POS タグ | 品詞 | NOUN、VERB、ADJ のようなカテゴリ。正確なレンマ化に必要です。 |
| 形態論 | 単語形のルール | 時制、数、格によって単語がどう形を変えるか。レンマ化はこれに依存します。 |

## 参考資料

- [Porter, M. F. (1980). An algorithm for suffix stripping](https://tartarus.org/martin/PorterStemmer/def.txt) — 原論文。5 ページで、今でも最も明快な説明です。
- [spaCy 101 — linguistic features](https://spacy.io/usage/linguistic-features) — 実際のパイプラインがどう配線されているか。
- [NLTK book, chapter 3](https://www.nltk.org/book/ch03.html) — まだ考えたことがないであろうトークン化のエッジケース。
