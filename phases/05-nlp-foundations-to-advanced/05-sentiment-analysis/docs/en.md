# 感情分析

> NLPの定番タスク。古典的なテキスト分類について知るべきことのほとんどが、ここに現れます。

**種類:** 実装
**言語:** Python
**前提:** フェーズ 5 · 02 (BoW + TF-IDF)、フェーズ 2 · 14 (Naive Bayes)
**時間:** 約75分

## 問題

"The food was not great." これはポジティブでしょうか、ネガティブでしょうか。

感情分析は単純に見えます。レビューを書いた人が、何かを好きだったか嫌いだったかを述べる。その文にラベルを付ける。それがNLPの定番タスクになった理由は、簡単そうに見える例の裏に必ず難しい例が隠れているからです。否定は意味を反転させます。皮肉は意味を逆にします。`Not bad at all` は、否定的に見える単語が2つ入っているのにポジティブです。絵文字は周囲のテキストより強いシグナルを持つことがあります。ドメイン語彙も重要です (音楽レビューの `tight` と、ファッションレビューの `tight` は違います)。

感情分析は古典的NLPの実験場です。素朴なベースラインがなぜ特定の失敗モードを持つのかを理解できれば、よりリッチなモデルがなぜ発明されたのかも理解できます。このレッスンでは、Naive Bayesのベースラインをゼロから作り、logistic regressionを追加し、本番の感情分析をコンプライアンス級の問題にする落とし穴に名前を付けます。

## コンセプト

古典的な感情分析は2段階のレシピです。

1. **表現する。** テキストを特徴ベクトルに変換します。BoW、TF-IDF、またはn-gramを使います。
2. **分類する。** ラベル付き例の上で線形モデル (Naive Bayes、logistic regression、SVM) をfitします。

Naive Bayesは、動くモデルの中でいちばん単純なものです。ラベルが与えられたとき、すべての特徴は独立だと仮定します。カウントから `P(word | positive)` と `P(word | negative)` を推定します。推論時には確率を掛け合わせます。この「naive」な独立性仮定は笑ってしまうほど間違っていますが、それでも結果は驚くほど強いです。理由は、疎なテキスト特徴と中規模データでは、分類器が気にするのは各単語がどちら側に傾くかであり、その強さの厳密さではないからです。

Logistic regressionは独立性仮定を直します。負の重みを含め、特徴ごとに重みを学習します。bigram特徴としての `not good` には負の重みが付きます。Naive Bayesは、ラベル付きデータで見たことのないbigramにはそれができません。

## 実装

### ステップ1: 実際のミニデータセット

```python
POSITIVE = [
    "absolutely loved this movie",
    "beautiful cinematography and a great story",
    "one of the best films of the year",
    "brilliant acting from the lead",
    "heartwarming and funny",
]

NEGATIVE = [
    "boring and far too long",
    "not worth your time",
    "the plot made no sense",
    "terrible acting, awful script",
    "i want my two hours back",
]
```

意図的に小さくしています。実務では数万件の例を使います (IMDb、SST-2、Yelp polarity)。数式は同じです。

### ステップ2: multinomial Naive Bayesをゼロから作る

```python
import math
from collections import Counter


def train_nb(docs_by_class, vocab, alpha=1.0):
    class_priors = {}
    class_word_probs = {}
    total_docs = sum(len(d) for d in docs_by_class.values())

    for cls, docs in docs_by_class.items():
        class_priors[cls] = len(docs) / total_docs
        counts = Counter()
        for doc in docs:
            for token in doc:
                counts[token] += 1
        total = sum(counts.values()) + alpha * len(vocab)
        class_word_probs[cls] = {
            w: (counts[w] + alpha) / total for w in vocab
        }
    return class_priors, class_word_probs


def predict_nb(doc, class_priors, class_word_probs):
    scores = {}
    for cls in class_priors:
        s = math.log(class_priors[cls])
        for token in doc:
            if token in class_word_probs[cls]:
                s += math.log(class_word_probs[cls][token])
        scores[cls] = s
    return max(scores, key=scores.get)
```

加算スムージング (`alpha=1.0`) はLaplace smoothingです。これがないと、あるクラスで未出の単語の確率がゼロになり、logが破綻します。実務では `alpha=0.01` がよく使われます。`alpha=1.0` は教材としての標準値です。

### ステップ3: logistic regressionをゼロから作る

```python
import numpy as np


def sigmoid(x):
    return 1.0 / (1.0 + np.exp(-np.clip(x, -20, 20)))


def train_lr(X, y, epochs=500, lr=0.05, l2=0.01):
    n_features = X.shape[1]
    w = np.zeros(n_features)
    b = 0.0
    for _ in range(epochs):
        logits = X @ w + b
        preds = sigmoid(logits)
        err = preds - y
        grad_w = X.T @ err / len(y) + l2 * w
        grad_b = err.mean()
        w -= lr * grad_w
        b -= lr * grad_b
    return w, b


def predict_lr(X, w, b):
    return (sigmoid(X @ w + b) >= 0.5).astype(int)
```

ここではL2正則化が重要です。テキスト特徴は疎です。L2がないと、モデルは学習例を記憶してしまいます。`0.01` から始めて調整してください。

### ステップ4: 否定を扱う (失敗モード)

"not good" と "not bad" を考えます。BoW分類器は `{not, good}` と `{not, bad}` を見て、学習データに多く出た側から学びます。bigram分類器は `not_good` と `not_bad` を見て、それぞれを別の特徴として学習します。たいていはそれで十分です。

bigramがない場合に使える、より粗い修正があります。**否定スコープ** です。否定語の後に続くtokenに、次の句読点まで `NOT_` というprefixを付けます。

```python
NEGATION_WORDS = {"not", "no", "never", "nor", "none", "nothing", "neither"}
NEGATION_TERMINATORS = {".", "!", "?", ",", ";"}


def apply_negation(tokens):
    out = []
    negate = False
    for token in tokens:
        if token in NEGATION_TERMINATORS:
            negate = False
            out.append(token)
            continue
        if token in NEGATION_WORDS:
            negate = True
            out.append(token)
            continue
        out.append(f"NOT_{token}" if negate else token)
    return out
```

```python
>>> apply_negation(["not", "good", "at", "all", ".", "but", "funny"])
['not', 'NOT_good', 'NOT_at', 'NOT_all', '.', 'but', 'funny']
```

これで `good` と `NOT_good` は別の特徴になります。分類器はそれらに逆向きの重みを付けられます。前処理を3行追加するだけで、感情分析ベンチマークのaccuracyが測定可能なほど上がります。

### ステップ5: 重要な評価指標

クラスに偏りがある場合、accuracyだけでは誤解を招きます。実際の感情コーパスは70-80%がポジティブ、または70-80%がネガティブであることが多く、多数派を常に返す分類器でも80% accuracyを達成できますが、役には立ちません。次をすべて報告してください。

- **クラス別precisionとrecall。** クラスごとに1組ずつ出します。クラスバランスを尊重した単一の数値にするには、macro平均を取ります。
- **Macro-F1 (不均衡データの主要指標)。** クラス別F1の平均で、各クラスを同じ重みで扱います。クラスが不均衡なときはaccuracyの代わりに使います。
- **Weighted-F1 (代替指標)。** macroと同様ですが、クラス頻度で重み付けします。不均衡そのものにビジネス上の意味があるときは、Macro-F1と並べて報告します。
- **混同行列。** 生の件数です。どんなスカラー指標を信じる前にも必ず確認してください。モデルがどのクラスの組を混同しているかを明らかにします。
- **クラス別エラー例。** クラスごとに誤予測を5件取り出します。読みます。実際のエラーを読むことに代わるものはありません。

極端に不均衡なデータ (> 95対5) では、accuracyではなく **AUROC** と **AUPRC** を報告してください。AUPRCは少数クラスにより敏感です。通常、気にしているのはそちらです (spam、fraud、まれなsentiment)。

**避けるべきよくあるバグ。** 不均衡データでmacro-F1ではなくmicro-F1を報告すると、多数派クラスに支配されるため高く見える数値になります。Macro-F1は少数クラスの性能を見ざるを得なくします。

```python
def evaluate(y_true, y_pred):
    tp = sum(1 for t, p in zip(y_true, y_pred) if t == 1 and p == 1)
    fp = sum(1 for t, p in zip(y_true, y_pred) if t == 0 and p == 1)
    fn = sum(1 for t, p in zip(y_true, y_pred) if t == 1 and p == 0)
    tn = sum(1 for t, p in zip(y_true, y_pred) if t == 0 and p == 0)
    precision = tp / (tp + fp) if tp + fp else 0
    recall = tp / (tp + fn) if tp + fn else 0
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0
    return {"tp": tp, "fp": fp, "tn": tn, "fn": fn, "precision": precision, "recall": recall, "f1": f1}
```

## 使う

scikit-learnなら、これを6行で正しく実行できます。

```python
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline

pipe = Pipeline([
    ("tfidf", TfidfVectorizer(ngram_range=(1, 2), min_df=2, sublinear_tf=True, stop_words=None)),
    ("clf", LogisticRegression(C=1.0, max_iter=1000)),
])
pipe.fit(X_train, y_train)
print(pipe.score(X_test, y_test))
```

注目すべき点が3つあります。`stop_words=None` は否定語を残します。`ngram_range=(1, 2)` はbigramを追加するので、`not_good` が特徴になります。`sublinear_tf=True` は繰り返し語の影響を弱めます。この3つのフラグが、SST-2で75% accuracyのベースラインと85% accuracyのベースラインを分けます。

### transformerを使うべきとき

- 皮肉検出。古典的モデルはここで失敗します。例外はありません。
- 文書の途中で感情が変わる長いレビュー。
- アスペクトベース感情分析。"Camera was great but battery was terrible." 感情をアスペクトに対応付ける必要があります。transformerか構造化出力モデルが必要です。
- 英語以外、低リソース言語。Multilingual BERTはzero-shotベースラインを無料で与えてくれます。

上のどれかが必要なら、フェーズ7 (transformer詳解) に進んでください。そうでなければ、TF-IDF + bigram + 否定処理の上にNaive Bayesまたはlogistic regressionを載せたものが、2026年時点の本番ベースラインです。

### 再現性の落とし穴 (再び)

感情分析モデルの再学習は日常的に行われます。再評価はそうではありません。論文で報告されるaccuracyは、特定のsplit、特定の前処理、特定のtokenizerを使っています。同一pipelineを使わずに新しいモデルをベースラインと比較すると、誤解を招く差分が出ます。論文の数値ではなく、自分のpipeline上で必ずベースラインを再生成してください。

## 出荷する

`outputs/prompt-sentiment-baseline.md` として保存します。

```markdown
---
name: sentiment-baseline
description: 新しいデータセット向けの感情分析ベースラインを設計します。
phase: 5
lesson: 05
---

データセットの説明 (ドメイン、言語、サイズ、ラベル粒度、レイテンシ予算) が与えられたら、次を出力します。

1. 特徴抽出レシピ。tokenizer、n-gram範囲、stopwordポリシー (通常は残す)、否定処理 (スコープ付きprefixまたはbigram) を指定します。
2. 分類器。ベースラインにはNaive Bayes、本番にはlogistic regression、transformerはドメインが皮肉 / アスペクト / クロスリンガルを必要とする場合のみ使います。
3. 評価計画。precision、recall、F1、混同行列、クラス別エラー例を報告します (スカラーだけにしない)。
4. デプロイ後に監視すべき失敗モードを1つ。domain driftと皮肉が上位2つです。

感情分析タスクでstopword削除を推奨することは拒否してください。クラスが不均衡な場合 (例: 90% positive)、accuracyを唯一の指標として報告することを拒否してください。サブワードの多い言語では、word-level TF-IDFよりFastTextまたはtransformer embeddingsが必要だと指摘してください。
```

## 演習

1. **易しい。** scikit-learn pipelineの前処理ステップとして `apply_negation` を追加し、小さな感情分析データセットでF1の差分を測定してください。
2. **普通。** クラス重み付きlogistic regressionを実装してください (scikit-learnに `class_weight="balanced"` を渡すか、自分で勾配を導出します)。90対10の合成クラス不均衡で効果を測定してください。
3. **難しい。** 感情分析モデルの残差の上で2つ目の分類器を学習し、皮肉検出器を作ってください。実験設定を文書化してください。accuracyがchanceを下回る場合は読者に警告してください (2クラス皮肉検出のchance-levelは約50%で、最初の試みの多くはそこに落ち着きます)。
