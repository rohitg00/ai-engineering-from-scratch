# 情感分析（sentiment analysis）

> 自然語言處理的標準任務。古典文字分類該知道的事，大部分會在這裡出現。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 5 · 02 (BoW + TF-IDF), Phase 2 · 14 (Naive Bayes)
**Time:** ~75 minutes

## The Problem｜問題

「The food was not great.」正面還是負面？

情感聽起來很簡單。評論者說喜歡或不喜歡某件事。給句子貼上標籤（label）。它會變成標準任務，是因為每個看起來容易的例子後面都藏著一個難的。否定會把意思翻過來。諷刺會把它倒過去。「Not bad at all」是正面，儘管有兩個帶負面色彩的詞。表情符號帶的訊號比周圍文字多。領域詞彙要緊（音樂評論裡的 `tight` 對上時尚評論裡的 `tight`）。

情感分析是古典自然語言處理的實作實驗室。如果你懂每個單純基準模型（baseline）為什麼有特定的失敗方式，你就懂每個更豐富的模型為什麼被發明出來。這一課從零做出單純貝氏（Naive Bayes）基準模型，加上邏輯斯迴歸（logistic regression），並點名那些讓正式環境的情感分析變成合規等級問題的陷阱。

## The Concept｜核心概念

古典情感分析是兩步食譜。

1. **表示。** 把文字變成特徵向量。詞袋、TF-IDF 或 n-gram。
2. **分類。** 在有標籤的例子上配一個線性模型：單純貝氏、邏輯斯迴歸，或支援向量機（SVM）。

單純貝氏是最笨、但行得通的模型。假設給定標籤後每個特徵（feature）獨立。從次數估計 `P(word | positive)` 和 `P(word | negative)`。推論（inference）時把機率相乘。「單純」的獨立假設錯得可笑，結果卻強得嚇人。原因是：文字特徵稀疏、資料量中等時，分類器（classifier）在意的是每個詞倒向哪一邊，多過倒多少。

邏輯斯迴歸拿掉獨立假設。它為每個特徵學一個權重，包含負權重。`not good` 當成二元 n-gram 特徵會得到負權重。單純貝氏對從沒標過的二元 n-gram 做不到這件事。

```figure
sentiment-logits
```

## Build It｜動手實作

### 步驟 1：一份真的迷你資料集（dataset）

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

故意做小。真正的工作用數萬筆例子（IMDb、SST-2、Yelp polarity）。數學是一樣的。

### 步驟 2：從零做多項單純貝氏

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

加性平滑（alpha=1.0）就是拉普拉斯平滑（Laplace smoothing）。沒有它，某個類別沒看過的詞機率是零，對數就爆掉。實務上 `alpha=0.01` 常見。`alpha=1.0` 是教學預設。

### 步驟 3：從零做邏輯斯迴歸

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

這裡 L2 正則化（regularization）要緊。文字特徵是稀疏的；沒有 L2，模型會背下訓練例子。從 `0.01` 開始再調校。

### 步驟 4：處理否定（失敗方式）

看「not good」和「not bad」。詞袋分類器看到 `{not, good}` 和 `{not, bad}`，然後從訓練裡哪一組出現較多來學。二元 n-gram 分類器看到 `not_good` 和 `not_bad`，把它們學成不同的特徵。通常這樣就夠。

沒有二元 n-gram 時，一個比較粗、但行得通的修法：**否定範圍（negation scoping）**。在否定詞後面的 token 加上 `NOT_` 前綴，直到下一個標點。

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

現在 `good` 和 `NOT_good` 是不同特徵。分類器可以把權重設成相反。三行前處理（preprocessing），在情感基準上準確率（accuracy）會有量得到的跳升。

### 步驟 5：要緊的評估指標

只有準確率會誤導，如果類別不平衡（imbalanced）。真實的情感語料庫（corpus）通常 70% 到 80% 是正面，或 70% 到 80% 是負面；永遠猜多數類的分類器可以拿到 80% 準確率，卻毫無用處。下面每一項都要報：

- **每一類的精確率（precision）和召回率（recall）。** 每一類一對。把它們做宏平均（macro-average），得到一個尊重類別平衡的單一數字。
- **宏平均 F1（macro-F1，類別不平衡資料的主要指標）。** 每一類 F1 分數（F1 score）的平均，權重相等。類別不平衡時用這個，不要用準確率。
- **加權 F1（另一個選擇）。** 和宏平均一樣，但依類別頻率加權。當不平衡本身有商業意義時，和宏平均 F1 一起報。
- **混淆矩陣（confusion matrix）。** 原始次數。在相信任何單一數字之前都要先看；它會露出模型把哪兩類搞混。
- **每一類的錯誤樣本。** 每一類抽 5 筆預測錯的。讀它們。沒有東西能取代讀真正的錯誤。

嚴重不平衡的資料（超過 95 比 5）改報 **ROC 曲線下面積（area under the ROC curve，AUROC）** 和 **精確率－召回率曲線下面積（area under the precision-recall curve，AUPRC）**，不要報準確率。AUPRC 對少數類更敏感，而你通常在意的就是少數類（垃圾郵件、詐欺、稀有情感）。

**要避開的常見 bug。** 在不平衡資料上報微觀 F1 而不是宏平均 F1，數字會看起來很高，因為它被多數類主導。宏平均 F1 逼你看見少數類的表現。

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

## Use It｜實際應用

scikit-learn 用六行就做對。

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

三件事要注意。`stop_words=None` 留下否定詞。`ngram_range=(1, 2)` 加上二元 n-gram，所以 `not_good` 變成一個特徵。`sublinear_tf=True` 把重複的詞壓低。這三個旗標，就是 SST-2 上 75% 準確率的基準模型和 85% 準確率的基準模型之間的差別。

### 什麼時候改拿 transformer

- 諷刺偵測。古典模型在這裡會失敗。就是這樣。
- 長評論，情感在文件中途轉向。
- 面向情感分析（aspect-based sentiment）。「Camera was great but battery was terrible.」你得把情感歸到面向。只有 transformer 或結構化輸出模型做得到。
- 非英文、資源少的語言。多語 BERT 免費給你一個零樣本（zero-shot）基準模型。

上面任何一項你需要，就直接跳到第 7 階段（transformer 深入）。否則，TF-IDF 加上二元 n-gram、再加上否定處理的單純貝氏或邏輯斯迴歸，就是你 2026 年的正式環境基準模型。

### 可重現性陷阱（又一次）

重新訓練情感模型是例行工作。重新評估它們不是。論文報的準確率用的是特定切分、特定前處理、特定 tokenizer。如果你拿新模型和基準模型比，卻沒有用同一條管線（pipeline），你會得到誤導人的差距。永遠在你自己的管線上重新產生基準模型，不要用論文裡的數字。

## Ship It｜交付成果

存成 `outputs/prompt-sentiment-baseline.md`：

```markdown
---
name: sentiment-baseline
description: Design a sentiment analysis baseline for a new dataset.
phase: 5
lesson: 05
---

Given a dataset description (domain, language, size, label granularity, latency budget), you output:

1. Feature extraction recipe. Specify tokenizer, n-gram range, stopword policy (usually keep), negation handling (scoped prefix or bigrams).
2. Classifier. Naive Bayes for baseline, logistic regression for production, transformer only if the domain needs sarcasm / aspects / cross-lingual.
3. Evaluation plan. Report precision, recall, F1, confusion matrix, and per-class error samples (not just scalars).
4. One failure mode to monitor post-deployment. Domain drift and sarcasm are the top two.

Refuse to recommend dropping stopwords for sentiment tasks. Refuse to report accuracy as the sole metric when classes are imbalanced (e.g., 90% positive). Flag subword-rich languages as needing FastText or transformer embeddings over word-level TF-IDF.
```

## Exercises｜練習

1. **簡單。** 在 scikit-learn 管線裡把 `apply_negation` 加進前處理，在一份小的情感資料集上量 F1 的差距。
2. **中等。** 實作類別加權的邏輯斯迴歸（把 `class_weight="balanced"` 傳給 scikit-learn，或自己推梯度）。在合成的 90 比 10 類別不平衡上量效果。
3. **困難。** 做一個諷刺偵測器：在情感模型的殘差上訓練第二個分類器。寫下你的實驗設定。當準確率低於隨機時警告讀者（二類諷刺的隨機水準約 50%，而且多數初次嘗試的結果也會落在這個水準）。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|-----------------|-----------------------|
| 極性 | 正面或負面 | 二元標籤；有時延伸到中性，或更細（5 星）。 |
| 面向情感 | 每個面向的極性 | 把情感歸到文字裡提到的特定實體或屬性。 |
| 否定範圍 | 把附近的 token 反過來 | 在「not」之後的 token 加上 `NOT_`，直到標點。 |
| 拉普拉斯平滑 | 次數加 1 | 避免單純貝氏裡出現機率為零的特徵。 |
| L2 正則化 | 把權重縮小 | 在損失上加 `lambda * sum(w^2)`。稀疏文字特徵少不了它。 |

## Further Reading｜延伸閱讀

- [Pang and Lee (2008). Opinion Mining and Sentiment Analysis](https://www.cs.cornell.edu/home/llee/opinion-mining-sentiment-analysis-survey.html) ——奠基的綜述。長，但前四節蓋住古典的全部。
- [Wang and Manning (2012). Baselines and Bigrams: Simple, Good Sentiment and Topic Classification](https://aclanthology.org/P12-2018/) ——說明二元 n-gram 加單純貝氏在短文上很難被打贏的論文。
- [scikit-learn text feature extraction docs](https://scikit-learn.org/stable/modules/feature_extraction.html#text-feature-extraction) ——`CountVectorizer`、`TfidfVectorizer`，以及你會調校的每個旋鈕。
