# Duygu Analizi

> Kanonik NLP görevi. Klasik metin sınıflandırması hakkında bilmeniz gerekenlerin çoğu burada gösteriliyor.

**Tür:** Yapım
**Diller:** Python
**Önkoşullar:** Aşama 5 · 02 (BoW + TF-IDF), Aşama 2 · 14 (Naive Bayes)
**Süre:** ~75 dakika

## Sorun

"Yemek harika değildi." Olumlu mu olumsuz mu?

Duygu basit geliyor. Bir yorumcu, bir şeyi beğendiklerini veya beğenmediklerini söyledi. Cümleyi etiketleyin. Bunun kanonik NLP görevi haline gelmesinin nedeni, her kolay görünen vakanın, zor bir vakayı saklamasıdır. Olumsuzluk anlamı değiştirir. Alaycılık bunu tersine çevirir. "Hiç fena değil" iki negatif kodlu kelimeye rağmen olumludur. Emojiler çevredeki metinlerden daha fazla sinyal taşır. Alan kelime dağarcığı önemlidir (müzik incelemesinde `tight`, moda incelemesinde `tight`).

Sentiment, klasik NLP için çalışan bir laboratuvardır. Her saf temelin neden belirli bir başarısızlık moduna sahip olduğunu anlarsanız, neden her daha zengin modelin icat edildiğini anlarsınız. Bu ders sıfırdan bir Naive Bayes temeli oluşturuyor, lojistik regresyon ekliyor ve üretim duyarlılığını uyumluluk düzeyinde bir sorun haline getiren tuzakları adlandırıyor.

## Konsept

Klasik duygu iki adımlı bir tariftir.

1. **Temsil edin.** Metni bir özellik vektörüne dönüştürün. BoW, TF-IDF veya n-gram.
2. **Sınıflandırın.** Etiketli örneklere doğrusal bir model (Naive Bayes, lojistik regresyon, SVM) yerleştirin.

Naive Bayes işe yarayan en aptal modeldir. Etikete göre her özelliğin bağımsız olduğunu varsayalım. Sayımlardan `P(word | positive)` ve `P(word | negative)`'yi tahmin edin. inference'de olasılıkları çarpın. "Saf" bağımsızlık varsayımı gülünç derecede yanlıştır, ancak sonuçlar şok edici derecede güçlüdür. Sebebi: Seyrek metin özellikleri ve orta düzeyde veri nedeniyle, sınıflandırıcı her kelimenin ne kadar çok hangi tarafa eğildiğine önem verir.

Lojistik regresyon bağımsızlık varsayımını düzeltir. Negatif ağırlıklar da dahil olmak üzere özellik başına bir ağırlık öğrenir. Bigram özelliği olarak `not good` negatif ağırlık alır. Naive Bayes, asla etiketlemediği bigramlar için bunu yapamaz.

```figure
sentiment-logits
```

## İnşa Et

### Adım 1: gerçek bir mini dataset

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

Bilerek küçük. Gerçek çalışma on binlerce örnek kullanır (IMDb, SST-2, Yelp polaritesi). Matematik aynıdır.

### Adım 2: sıfırdan çok terimli Naive Bayes

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

Eklemeli yumuşatma (alfa=1.0) Laplace yumuşatmadır. Bu olmadan, sınıfta görülmeyen bir kelimenin olasılığı sıfırdır ve kütük patlar. `alpha=0.01` pratikte yaygındır. `alpha=1.0` öğretme varsayılanıdır.

### Adım 3: sıfırdan lojistik regresyon

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

L2 düzenlemesi burada önemlidir. Metin özellikleri seyrektir; L2 olmadan model eğitim örneklerini ezberler. `0.01`'den başlayın ve ayarlayın.

### Adım 4: Olumsuzlamayı ele alma (hata modu)

"İyi değil" ve "fena değil"i düşünün. Bir BoW sınıflandırıcı, `{not, good}` ve `{not, bad}`'yi görür ve eğitimde hangisinin daha fazla ortaya çıktığını öğrenir. Bigram sınıflandırıcı `not_good` ve `not_bad`'yi görür ve bunları farklı özellikler olarak öğrenir. Bu genellikle yeterlidir.

Bigramlarınız olmadığında işe yarayan daha basit bir düzeltme: **olumsuzlama kapsamı**. `NOT_` ile bir olumsuzluk sözcüğünden sonra bir sonraki noktalama işaretine kadar token öneki.

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

Artık `good` ve `NOT_good` farklı özelliklerdir. Sınıflandırıcı bunları zıt yönde ağırlıklandırabilir. Üç satırlık ön işleme, benchmark duyarlılığında ölçülebilir doğruluk artışı.

### Adım 5: Önemli değerlendirme ölçümleri

Sınıflar dengesizse tek başına doğruluk yanıltıcıdır. Gerçek duygu bütünü genellikle %70-80 olumlu veya %70-80 olumsuzdur; sabit çoğunluklu bir sınıflandırıcı %80 doğruluk elde eder ve değersizdir. Aşağıdakilerin her birini bildirin:

- **Sınıf başına kesinlik ve geri çağırma.** Sınıf başına bir çift. Sınıf dengesine saygılı tek bir sayı elde etmek için bunların makro ortalamasını alın.
- **Makro-F1 (dengesiz veriler için birincil ölçüm).** Eşit ağırlıklı, sınıf başına F1 puanlarının ortalaması. Sınıflar dengesiz olduğunda doğruluk yerine bunu kullanın.
- **Ağırlıklı-F1 (alternatif).** Makro ile aynıdır ancak sınıf frekansına göre ağırlıklandırılmıştır. Dengesizliğin ticari anlamı olduğunda makro-F1 ile birlikte rapor verin.
- **Karışıklık matrisi.** Ham sayımlar. Herhangi bir skaler metriğe güvenmeden önce daima inceleyin; modelin hangi sınıf çiftini karıştırdığını ortaya çıkarır.
- **Sınıf başına hata örnekleri.** Sınıf başına 5 yanlış tahmin alın. Onları okuyun. Hiçbir şey gerçek hataları okumanın yerini tutamaz.

Ciddi derecede dengesiz veriler için (> 95-5 oranı), doğruluk yerine **AUROC** ve **AUPRC** raporlayın. AUPRC, genellikle önemsediğiniz (spam, dolandırıcılık, nadir görülen duyarlılık) azınlık sınıfına karşı daha duyarlıdır.

**Kaçınılması gereken yaygın hata.** Dengesiz verilerde makro-F1 yerine mikro-F1'in raporlanması, çoğunluk sınıfının hakimiyetinde olduğu için yüksek görünen bir sayı verir. Macro-F1 sizi azınlık sınıfı performansını görmeye zorluyor.

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

## Kullan onu

scikit-learn bunu altı satırda doğru bir şekilde yapıyor.

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

Dikkat edilmesi gereken üç şey. `stop_words=None` olumsuzlamaları tutar. `ngram_range=(1, 2)` bigramlar ekleyerek `not_good`'nin bir özellik haline gelmesini sağlar. `sublinear_tf=True` tekrarlanan sözcükleri azaltır. Bu üç bayrak, SST-2'de %75 doğru taban çizgisi ile %85 doğru taban çizgisi arasındaki farktır.

### transformer'ye ne zaman ulaşılmalıdır?

- Alaycılık tespiti. Klasik modeller burada başarısız oluyor. Dönem.
- Belgenin ortasında duyarlılığın değiştiği uzun incelemeler.
- Görünüşe dayalı duyarlılık. "Kamera harikaydı ama pil berbattı." Duyguları yönlere atfetmeniz gerekir. Yalnızca Transformer'ler veya yapılandırılmış çıktı modelleri.
- İngilizce dışındaki, düşük kaynaklı diller. Çok dilli BERT size ücretsiz olarak sıfır atışlı bir temel sunar.

Yukarıdakilerden herhangi birine ihtiyacınız varsa 7. aşamaya geçin (transformer'nin derin dalışı). Aksi takdirde, Naive Bayes veya TF-IDF artı bigramlar artı olumsuzlama yönetimi üzerindeki lojistik regresyon, 2026 üretim temelinizdir.

### Tekrarlanabilirlik tuzağı (tekrar)

Duygu modellerinin yeniden eğitilmesi rutin bir işlemdir. Bunları yeniden değerlendirmek doğru değil. Makalelerde bildirilen doğruluk sayıları belirli bölünmeleri, belirli ön işlemeleri ve belirli tokenizer'leri kullanır. Yeni modelinizi aynı ardışık düzeni kullanmadan bir taban çizgisiyle karşılaştırırsanız yanıltıcı deltalar elde edersiniz. Kağıdın numarasını değil, her zaman boru hattınızdaki taban çizgisini yeniden oluşturun.

## Gönderin

`outputs/prompt-sentiment-baseline.md` olarak kaydet:

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

1. **Kolay.** Scikit-learn kanalına bir ön işleme adımı olarak `apply_negation`'yi ekleyin ve küçük bir duyarlılık dataset üzerinde F1 deltasını ölçün.
2. **Orta.** Sınıf ağırlıklı lojistik regresyon uygulayın (scikit-learn'e `class_weight="balanced"`'yi aktarın veya gradient'yi kendiniz türetin). Sentetik 90-10 sınıfı dengesizlik üzerindeki etkiyi ölçün.
3. **Zor.** Duygu modelinin artıkları üzerinde ikinci bir sınıflandırıcıyı eğiterek bir alaycılık algılayıcı oluşturun. Deneysel kurulumunuzu belgeleyin. Doğruluğunuz şansın altında olduğunda okuyucuyu uyarın (2. sınıf alaycılığın şans seviyesi ~%50'dir ve ilk denemelerin çoğu oraya ulaşır).

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|-----------------|-----------------------|
| Polarite | Olumlu veya olumsuz | İkili etiket; bazen nötr veya ince taneli (5 yıldızlı) kadar genişletilir. |
| Boyuta dayalı duyarlılık | Her açıdan polarite | Metinde bahsedilen belirli varlıklara veya niteliklere duyarlılık atfedin. |
| Olumsuzluk kapsamı | Yakında geri geri gidiyor tokens | Noktalama işaretine kadar "değil"den sonra `NOT_` ile token ön eki. |
| Laplace yumuşatma | Sayılara 1 ekleme | Naive Bayes'te sıfır olasılık özelliklerini önler. |
| L2 düzenlemesi | Küçülen ağırlıklar | Kayba `lambda * sum(w^2)` ekler. Seyrek metin özellikleri için gereklidir. |

## Daha Fazla Okuma

- [Pang ve Lee (2008). Fikir Madenciliği ve Duyarlılık Analizi](https://www.cs.cornell.edu/home/llee/opinion-mining-sentiment-analysis-survey.html) — temel anket. Uzun ama ilk dört bölüm klasik olan her şeyi kapsıyor.
- [Wang ve Manning (2012). Temel Çizgiler ve Bigramlar: Basit, İyi Duygu ve Konu Sınıflandırması](https://aclanthology.org/P12-2018/) — bigramları + Naive Bayes'i gösteren makalenin kısa metinde yenilmesi zordur.
- [scikit-learn metin özelliği çıkarma belgeleri](https://scikit-learn.org/stable/modules/feature_extraction.html#text-feature-extraction) — `CountVectorizer`, `TfidfVectorizer` ve ayarlayacağınız her düğme için referans.
