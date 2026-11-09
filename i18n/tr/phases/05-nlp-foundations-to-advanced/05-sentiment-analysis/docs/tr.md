# Duygu Analisi

> Klasik metin sınıflandırması hakkında bilmeniz gerekenlerin çoğu burada gösterilmiştir.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 02 (BoW + TF-IDF), Phase 2 · 14 (Naive Bayes)
**Time:** ~75 minutes

## Sorun

"Yemek çok iyi değildi". İyi mi kötü mi?

Duygular basit görünüyor. Bir eleştirmen bir şeyi beğendiğini veya beğenmediğini söyledi. cümleyi etiketleyin. Kanonik NLP görevi haline gelmesinin nedeni, her kolay görünen durumun zor birini saklamasıdır. İtiraz anlamını tersine çevirir. Sarkazm onu tersine çevirir. "Hiç fena değil" iki negatif kodlanmış kelime olmasına rağmen olumlu olur. Emojis çevresindeki metinden daha fazla sinyal taşır.`tight`Müzik incelemesi vs.`tight`moda incelemesinde).

Sentiment klasik NLP için bir çalışma laboratuvarıdır. Eğer her naif temel çizginin neden belirli bir başarısızlık moduna sahip olduğunu anlarsanız, her zengin modelin neden icat edildiğini anlarsınız. Bu ders, naif Bayes temel çizgisini sıfırdan inşa eder, lojistik geri dönüşü ekler ve üretim duygusunu bir uyumluluk derecesi sorunu yapan tuzakları isimlendirir.

## Anlaşım

Klasik duygu iki adımlı bir tarif.

1. **Represent.**Metni bir özellik vektörüne dönüştürün.
2. **Classify.**Etiketlenmiş örneklere bir çizgisi model (Naive Bayes, lojistik gerileme, SVM) uygulayın.

Bayes'in en aptalca modelini kullanırken, her özellik etiketi göz önüne alındığında bağımsız olduğunu varsayalım.`P(word | positive)`ve `P(word | negative)`Bu nedenle, "sürekli" bağımsızlık varsayımı gülünç bir şekilde yanlış ve sonuçlar şaşırtıcı derecede güçlüdür.

Logistik gerileme bağımsızlık varsayımını düzeltir. Negatif ağırlıklar dahil her özellik için bir ağırlık öğrenir. `not good`Bayes'in bence bunu hiç etiketlemediği bir büyüklük için yapamaz.

```figure
sentiment-logits
```

## Yapın

### Adım 1: Gerçek bir mini veri kümesi

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

Gerçek çalışmalarda on binlerce örnek kullanılır (IMDb, SST-2, Yelp polaritesi).

### Adım 2: Multinomal Naive Bayes sıfırdan

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

Ekleyici düzeltme (alfa=1.0) Laplace düzeltmesidir. Bu olmadan, bir sınıfta görülmeyen bir kelime olasılık sıfırdır ve log patlar. `alpha=0.01`Bu, pratikte yaygın bir durumdur.`alpha=1.0`öğretim açısından yanlış.

### Adım 3: Lojiistik geri dönüş sıfırdan

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

L2 düzenlenmesi burada önemlidir. Metin özellikleri nadirdir; L2 olmadan model eğitim örneklerini ezberler.`0.01`ve sesini dinle.

### Adım 4: Yükleme inkârı (kararlılık modu)

"Yok iyi" ve "kötü" düşünün.`{not, good}`ve `{not, bad}`Bir bigram sınıflandırıcısı görüyor.`not_good`ve `not_bad`Bu, genellikle yeterli olur.

Bigramlar olmadığında işe yarayan bir çirkin ilaç:**negation scoping**. Negasyon kelimesinin ardından ön işaretler `NOT_`Bir sonraki noktalama kadar.

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

Şimdi .`good`ve `NOT_good`Bu, bir grup farklı özelliklere sahip olan bir grup sınıflandırıcı tarafından karşı tarafa ağırlıklandırılabilir.

### Adım 5: Önemli değerlendirme ölçümleri

Düzgünlük, sınıfların dengesiz olması halinde yanıltıcıdır. Gerçek duygu korporası genellikle %70'den %80'e olumlu veya %70'e oranla negatifdir; sabit çoğunluk sınıflandırıcısı %80'e doğru olur ve değersizdir. Aşağıdaki her birini bildirin:

- **Per-class precision and recall.**Sınıf başına bir çift, sınıf dengesini koruyan tek bir sayı elde etmek için onları makro ortalama yapın.
- **Macro-F1 (primary metric for imbalanced data).**Sınıflar dengesiz olduğunda bu doğruluğu kullanmak yerine kullanın.
- **Weighted-F1 (alternative).**Makro gibi ama sınıf frekansı ile ağırlıklı.
- **Confusion matrix.**Herhangi bir skalar metrikte güvenmeden önce her zaman kontrol edin; modelin hangi sınıf çiftini karıştırdığını ortaya çıkarır.
- **Per-class error samples.**Sınıf başına 5 yanlış tahmin çıkar ve oku.

Ağır dengesizlik (> 95-5 oranı) veriler için rapor **AUROC**ve **AUPRC**AUPRC, çoğunlukla önem verdiğiniz azınlık sınıfına karşı daha duyarlı (spam, dolandırıcılık, nadir duygu).

**Common bug to avoid.**Mikro-F1 yerine makro-F1 oranında dengesiz veriler raporlamak, çoğunluk sınıfının baskın olduğu için yüksek görünen bir rakam verir.

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

## Kullan

Sikit-Learn altı satırda yapar, doğru.

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

Dikkat edilmesi gereken üç şey var.`stop_words=None`- Hayır.`ngram_range=(1, 2)`Bigramlar ekliyor.`not good`bir özellik haline gelir (scikit-learn iki kelimeyi bir boşlukla birleştirir). `sublinear_tf=True`Bu üç işaret, SST-2'de %75 ve %85 doğruluklı bir başlangıç arasındaki farkı temsil eder.

### Transformatörün ne zaman kullanılması gerekiyor?

- Klasik modeller burada başarısız oluyor.
- Uzun incelemeler, içgüdülerin değişmesi.
- "Kamera harika ama pil berbat". Sadece transformörler veya yapılandırılmış çıkış modellerine ilişkin duyguları yönlendirmelisin.
- İngilizce olmayan, düşük kaynaklı diller. Çok dilli BERT size sıfır çekim temelini ücretsiz olarak verir.

Yukarıdaki herhangi birine ihtiyacınız varsa, 7. aşamaya geçin (transformatörler derin dalış). Aksi takdirde, Naive Bayes veya TF-IDF artı bigramlar artı inkar eleştirisi 2026 üretim başlangıç çizginizdir.

### Tekrarlanılabilirlik tuzağı (yeniden)

Duygu modellerini yeniden eğitmek rutin bir şey. Onları yeniden değerlendirmek değildir. Kağıtlarda bildirilen doğruluk rakamları belirli bölünmeler, belirli önceden işleme, belirli işaretleme kullanır. Yeni modelinizi aynı boru hattını kullanmadan bir temel çizgiyle karşılaştırırsanız yanıltıcı deltalar elde edeceksiniz. Kağıt numarası değil, boru hattınızdaki temel çizgiyi her zaman yenilenti yapın.

## Gönder

- Kaydet .`outputs/prompt-sentiment-baseline.md`- ...

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

## Egzersizler

1. **Easy.**Ekle`apply_negation`Scikit-Learn borusunda bir önceden işleme adımı olarak ve küçük bir duygu verisi kümesi üzerinde F1 delta ölçülmesi.
2. **Medium.**Sınıf ağırlığıyla lojistik gerilemeyi uygulayın (geçer `class_weight="balanced"`90-10 sınıf dengesizliği üzerinde etkisini ölçün.
3. **Hard.**Bir sarkasma algılayıcısı oluşturmak için, duygu modelinin kalıntıları üzerine ikinci bir sınıflandırıcıyı eğit. Deneysel ayarınızı belgeleyin.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Polarity | Positive or negative | Binary label; sometimes extended to neutral or fine-grained (5-star). |
| Aspect-based sentiment | Per-aspect polarity | Attribute sentiment to specific entities or attributes mentioned in text. |
| Negation scoping | Reversing nearby tokens | Prefix tokens after "not" with `NOT_` until punctuation. |
| Laplace smoothing | Adding 1 to counts | Prevents zero-probability features in Naive Bayes. |
| L2 regularization | Shrinking weights | Adds `lambda * sum(w^2)` to loss. Essential for sparse text features. |

## Daha Fazla Okumak

- [Pang and Lee (2008). Opinion Mining and Sentiment Analysis](https://www.cs.cornell.edu/home/llee/opinion-mining-sentiment-analysis-survey.html)Uzun, ama ilk dört bölümde her şey klasik.
- [Wang and Manning (2012). Baselines and Bigrams: Simple, Good Sentiment and Topic Classification](https://aclanthology.org/P12-2018/)Bigram + Naive Bayes'i gösteren kağıt kısa metinle yenilmek zordur.
- [scikit-learn text feature extraction docs](https://scikit-learn.org/stable/modules/feature_extraction.html#text-feature-extraction) referans için `CountVectorizer`- Evet .`TfidfVectorizer`, ve her düğmeye ayarlayacaksın.
