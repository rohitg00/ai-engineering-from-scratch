# Naif Bayes

> "Saf" varsayım yanlıştır ve yine de işe yarar. Güzelliği de bu.

**Tür:** Yapım
**Dil:** Python
**Önkoşullar:** Aşama 2, Dersler 01-07 (sınıflandırma, Bayes teoremi)
**Süre:** ~75 dakika

## Öğrenme Hedefleri

- Metin sınıflandırması için Laplace yumuşatma ile Multinomial Naive Bayes'i sıfırdan uygulayın
- Saf bağımsızlık varsayımının neden matematiksel olarak yanlış olduğunu ancak pratikte doğru sınıf sıralaması ürettiğini açıklayın
- Multinomial, Bernoulli ve Gaussian Naive Bayes değişkenlerini karşılaştırın ve belirli bir özellik türü için doğru olanı seçin
- Naive Bayes'i yüksek boyutlu seyrek veriler üzerinde lojistik regresyona karşı değerlendirin ve işteki önyargı-varyans değiş tokuşunu açıklayın

## Sorun

Metni sınıflandırmanız gerekir. Spam veya spam olmayan e-postalar. Müşteri değerlendirmeleri olumlu veya olumsuz. Biletleri kategorilere ayırın. Binlerce özelliğe (kelime başına bir tane) ve sınırlı eğitim verisine sahipsiniz.

Çoğu sınıflandırıcı burada boğulur. Lojistik regresyon binlerce ağırlığı güvenilir bir şekilde tahmin etmek için yeterli örneğe ihtiyaç duyar. Karar ağaçları her seferinde tek bir kelimeye bölünür ve aşırı uyum sağlar. 10.000 boyuttaki KNN anlamsızdır çünkü her nokta diğer her noktadan eşit derecede uzaktadır.

Naive Bayes bu işi hallediyor. Matematiksel olarak yanlış bir varsayımda bulunur (her özelliğin sınıfa verilen diğer özelliklerden bağımsız olduğu gibi) ve özellikle küçük eğitim setleriyle metin sınıflandırma konusunda hala "daha akıllı" modellerden daha iyi performans gösterir. Veriler üzerinden tek geçişte eğitim verir. Milyonlarca özelliğe ölçeklenir. Olasılık tahminleri üretir (her ne kadar bağımsızlık varsayımı nedeniyle çoğu zaman zayıf kalibre edilmiş olsa da).

Yanlış bir varsayımın neden iyi tahminlere yol açtığını anlamak size machine learning hakkında temel bir şeyi öğretir: en iyi model en doğru model değildir, verileriniz için en iyi önyargı-varyans değişimine sahip olandır.

## Konsept

### Bayes Teoremi (Hızlı İnceleme)

Bayes teoremi koşullu olasılıkları tersine çevirir:

```
P(class | features) = P(features | class) * P(class) / P(features)
```

Biz `P(class | features)`'yi istiyoruz -- bir belgenin içindeki kelimelere göre bir sınıfa ait olma olasılığını. Bunu şu şekilde hesaplayabiliriz:
- `P(features | class)` -- bu kelimelerin bu sınıftaki belgelerde görülme olasılığı
- `P(class)` -- sınıfın öncelikli olasılığı (genel olarak spam ne kadar yaygındır?)
- `P(features)` -- kanıt, tüm sınıflar için aynıdır, dolayısıyla karşılaştırırken bunu göz ardı edebiliriz

En yüksek `P(class | features)` değerine sahip sınıf kazanır.

### Naif Bağımsızlık Varsayımı

`P(features | class)`'nin hesaplanması tam olarak tüm özelliklerin ortak olasılığının birlikte tahmin edilmesini gerektirir. 10.000 kelimelik bir kelime dağarcığıyla, 2 üzeri 10.000 olası kombinasyonun üzerinde bir dağılım tahmin etmeniz gerekir. İmkansız.

Saf varsayım: her özellik, sınıfa göre koşullu olarak bağımsızdır.

```
P(w1, w2, ..., wn | class) = P(w1 | class) * P(w2 | class) * ... * P(wn | class)
```

Tek bir imkansız ortak dağılım yerine, her özellik için n adet basit dağılım tahmin edersiniz. Her birinin yalnızca bir sayıma ihtiyacı vardır.

Bu varsayım açıkça yanlıştır. "Makine" ve "öğrenme" kelimeleri hiçbir belgede bağımsız değildir. Ancak sınıflandırıcının doğru olasılık tahminlerine ihtiyacı yoktur. Hangi sınıfın en yüksek olasılığa sahip olduğu doğru sıralamaya ihtiyaç duyar. Bağımsızlık varsayımı sistematik hatalara neden olur, ancak bu hatalar tüm sınıfları benzer şekilde etkiler, dolayısıyla sıralama doğru kalır.

### Neden Hala Çalışıyor?

Üç neden:

1. **Kalibrasyona göre sıralama.** Sınıflandırmanın yalnızca en üst sıradaki sınıfın doğru olması gerekir. Gerçek olasılık 0,7 olduğunda P(spam) = 0,99999 olsa bile, sınıflandırıcı yine de spam'ı doğru şekilde seçer. Doğru olasılıklara ihtiyacımız yok. Doğru kazanana ihtiyacımız var.

2. **Yüksek önyargı, düşük varyans.** Bağımsızlık varsayımı güçlü bir önseldir. Modeli büyük ölçüde kısıtlar, bu da aşırı uyumu önler. Sınırlı eğitim verileriyle, biraz yanlış ancak istikrarlı bir model, teorik olarak doğru ancak son derece istikrarsız bir modeli yener. Bu, eylemdeki önyargı-varyans değişimidir.

3. **Özellik fazlalığı iptal edilir.** İlişkili özellikler gereksiz kanıt sağlar. Sınıflandırıcı bu kanıtı iki kez sayar, ancak doğru sınıf için de onu iki kez sayar. Eğer "makine" ve "öğrenme" her zaman birlikte görünüyorsa, her ikisi de "teknoloji" sınıfına kanıt teşkil etmektedir. NB bunları iki kez sayar, ancak doğru sınıf için bunları iki kez sayar.

Dördüncü, pratik neden: Naive Bayes son derece hızlıdır. Eğitim, veri sayma frekanslarından tek geçişlidir. Tahmin bir matris çarpımıdır. Bir milyon belge üzerinde saniyeler içinde eğitim alabilirsiniz. Bu hız, daha yavaş modellere kıyasla daha hızlı yineleme yapabileceğiniz, daha fazla özellik seti deneyebileceğiniz ve daha fazla deney gerçekleştirebileceğiniz anlamına gelir.

### Adım Adım Matematik

Somut bir örnek üzerinden izleyelim. Diyelim ki iki sınıfımız var: spam ve spam olmayan. Kelime dağarcığımızda üç kelime vardır: "bedava", "para", "toplantı".

Eğitim verileri:
- Spam e-postalarda 80 kez "ücretsiz", 60 kez "para", 10 kez "toplantı" ifadesi geçiyor (toplam 150 kelime)
- Spam olmayan e-postalarda 5 kez "ücretsiz", 10 kez "para", 100 kez "toplantı" ifadesi geçiyor (toplam 115 kelime)
- E-postaların %40'ı spam, %60'ı spam değil

Laplace yumuşatmayla (alfa=1):

```
P(free | spam)    = (80 + 1) / (150 + 3) = 81/153 = 0.529
P(money | spam)   = (60 + 1) / (150 + 3) = 61/153 = 0.399
P(meeting | spam) = (10 + 1) / (150 + 3) = 11/153 = 0.072

P(free | not-spam)    = (5 + 1) / (115 + 3) = 6/118 = 0.051
P(money | not-spam)   = (10 + 1) / (115 + 3) = 11/118 = 0.093
P(meeting | not-spam) = (100 + 1) / (115 + 3) = 101/118 = 0.856
```

Yeni e-posta şunu içerir: "ücretsiz" (2 kez), "para" (1 kez), "toplantı" (0 kez).

```
log P(spam | email) = log(0.4) + 2*log(0.529) + 1*log(0.399) + 0*log(0.072)
                    = -0.916 + 2*(-0.637) + (-0.919) + 0
                    = -3.109

log P(not-spam | email) = log(0.6) + 2*log(0.051) + 1*log(0.093) + 0*log(0.856)
                        = -0.511 + 2*(-2.976) + (-2.375) + 0
                        = -8.838
```

Spam büyük bir farkla kazanır. "Ücretsiz" kelimesinin iki kez geçmesi spam için güçlü bir kanıttır. "Toplantı"nın görünmemesinin her iki günlük toplamına da sıfır katkısı olduğunu unutmayın (0 * log(P)) -- Multinomial NB'de eksik kelimelerin hiçbir etkisi yoktur. Kelime yokluğunu açıkça modelleyen Bernoulli NB'dir.

### Üç Değişken

Naive Bayes'in üç çeşidi vardır. Her model `P(feature | class)` farklıdır.

#### Çok terimli Naif Bayes

Her özelliği bir sayı olarak modeller. Özelliklerin kelime frekansları veya TF-IDF değerleri olduğu metin verileri için en iyisi.

```
P(word_i | class) = (count of word_i in class + alpha) / (total words in class + alpha * vocab_size)
```

`alpha` Laplace yumuşatmadır (aşağıda açıklanmıştır). Bu değişken, metin sınıflandırması için en güçlü araçtır.

#### Gauss Saf Bayes

Her özelliği normal dağılım olarak modeller. Sürekli özellikler için en iyisi.

```
P(x_i | class) = (1 / sqrt(2 * pi * var)) * exp(-(x_i - mean)^2 / (2 * var))
```

Her sınıf, özellik başına kendi ortalamasını ve varyansını alır. Bu, özellikler her sınıfta gerçekten bir çan eğrisini takip ettiğinde işe yarar.

#### Bernoulli Naif Bayes

Her özelliği ikili (var veya yok) olarak modeller. Kısa metin veya ikili özellik vektörleri için en iyisidir.

```
P(word_i | class) = (docs in class containing word_i + alpha) / (total docs in class + 2 * alpha)
```

Multinomial'dan farklı olarak Bernoulli, bir kelimenin yokluğunu açıkça cezalandırıyor. "Ücretsiz" genellikle spam'de görünüyor ancak bu e-postada bulunmuyorsa, Bernoulli bunu spam'e karşı kanıt olarak sayar.

### Her Bir Değişken Ne Zaman Kullanılmalı

| Varyant | Özellik Türü | En İyisi | Örnek |
|---------|-------------|----------|---------|
| Çok terimli | Sayımlar veya frekanslar | Metin sınıflandırması, kelime çantası | E-posta spam'ı, konu sınıflandırması |
| Gaussian | Sürekli değerler | Normal özelliklere sahip tablo verileri | İris sınıflandırması, sensör verileri |
| Bernoulli | İkili (0/1) | Kısa metin, ikili özellik vektörleri | SMS spam'ı, varlık/yokluk özellikleri |

### Laplace Yumuşatma

Bir kelime test verilerinde göründüğünde ancak belirli bir sınıfın eğitim verilerinde hiç görünmediğinde ne olur?

Düzgünleştirme olmadan: `P(word | class) = 0/N = 0`. Tüm ürün boyunca bir sıfır çarpıldığında, diğer tüm kanıtlara bakılmaksızın `P(class | features) = 0` elde edilir. Görünmeyen tek bir kelime, diğer deliller onu ne kadar desteklerse desteklesin, tüm öngörüyü yok eder.

Laplace yumuşatma, her özellik sayısına küçük bir sayı `alpha` (genellikle 1) ekler:

```
P(word_i | class) = (count(word_i, class) + alpha) / (total_words_in_class + alpha * vocab_size)
```

Alfa=1 ile her kelime en azından küçük bir olasılığa sahip olur. Bir test e-postasında görünen "karışıklık" kelimesi artık spam olasılığını ortadan kaldırmıyor. Yumuşatmanın Bayes yorumu vardır: Kelime dağılımlarının önüne tekdüze bir Dirichlet yerleştirmeye eşdeğerdir.

Daha yüksek alfa, daha güçlü yumuşatma (daha düzgün dağılımlar) anlamına gelir. Düşük alfa, modelin verilere daha fazla güvendiği anlamına gelir. Alfa, ayarladığınız bir hiperparametredir.

Alfanın etkisi:

| Alfa | Efekt | Ne zaman kullanılır |
|-------|--------|-------------|
| 0,001 | Neredeyse yumuşatma yok, verilere güvenin | Çok büyük eğitim seti, görülmeyen hiçbir özellik beklenmiyor |
| 0.1 | Hafif yumuşatma | Büyük eğitim seti |
| 1.0 | Standart Laplace yumuşatma | Varsayılan başlangıç ​​noktası |
| 10.0 | Ağır yumuşatma, dağılımları düzleştirme | Çok küçük eğitim seti, pek çok görülmemiş özellik bekleniyor |

### Günlük Uzayı Hesaplaması

Yüzlerce olasılığın çarpılması (her biri 1'den küçük) kayan noktalı taşmaya neden olur. Gerçek değer çok küçük bir pozitif sayı olmasına rağmen kayan noktada çarpım sıfır olur.

Çözüm: günlük alanında çalışın. Olasılıkları çarpmak yerine logaritmalarını ekleyin:

```
log P(class | x1, x2, ..., xn) = log P(class) + sum_i log P(xi | class)
```

Bu, tahmini bir nokta çarpımına dönüştürür:

```
log_scores = X @ log_feature_probs.T + log_class_priors
prediction = argmax(log_scores)
```

Matris çarpımı. Naive Bayes tahmininin bu kadar hızlı olmasının nedeni budur; tek katmanlı doğrusal modelle aynı işlemdir.

### Naive Bayes ve Lojistik Regresyon

Her ikisi de metin için doğrusal sınıflandırıcılardır. Fark, modellediklerindedir.

| Görünüş | Naif Bayes | Lojistik Regresyon |
|--------|------------|-------------------|
| Tür | Üretken (modeller P(X\|Y)) | Ayırt edici (modeller P(Y\|X)) |
| Eğitim | Frekansları sayın | Optimize loss function |
| Küçük veriler | Daha iyi (önceki güçlü yardımlar) | Daha da kötüsü (ağırlıkları tahmin etmek için yeterli değil) |
| Büyük veri | Daha da kötüsü (yanlış varsayım acıtır) | Daha İyi (esnek sınır) |
| Özellikler | Bağımsızlığını varsayar | Korelasyonları yönetir |
| Hız | Tek geçişte, çok hızlı | Yinelemeli optimizasyon |
| Kalibrasyon | Zayıf olasılıklar | Daha iyi olasılıklar |

Temel kural: Naive Bayes ile başlayın. Yeterli veriniz ve NB platolarınız varsa lojistik regresyona geçin.

### Sınıflandırma İşlem Hattı

```mermaid
flowchart LR
    A[Raw Text] --> B[Tokenize]
    B --> C[Build Vocabulary]
    C --> D[Count Word Frequencies]
    D --> E[Apply Smoothing]
    E --> F[Compute Log Probabilities]
    F --> G[Predict: argmax P class given words]

    style A fill:#f9f,stroke:#333
    style G fill:#9f9,stroke:#333
```

Uygulamada, kayan noktalı taşmayı önlemek için günlük uzayında çalışıyoruz. Birçok küçük olasılığı çarpmak yerine logaritmalarını topluyoruz:

```
log P(class | features) = log P(class) + sum_i log P(feature_i | class)
```

```figure
naive-bayes
```

## İnşa Et

`code/naive_bayes.py`'deki kod hem MultinomialNB'yi hem de GaussianNB'yi sıfırdan uygular.

### Çok terimliNB

Sıfırdan uygulama:

1. **fit(X, y)**: Her sınıf için her özelliğin sıklığını sayın. Laplace yumuşatma ekleyin. Günlük olasılıklarını hesaplayın. Sınıf önceliklerini saklayın (sınıf frekanslarının günlüğü).

2. **predict_log_proba(X)**: Her örnek için, tüm sınıflar için log P(class) + log P'nin toplamını(feature_i | class) hesaplayın. Bu bir matris çarpımıdır: X @ log_probs.T + log_priors.

3. **tahmin(X)**: En yüksek log olasılığına sahip sınıfı döndürür.

```python
class MultinomialNB:
    def __init__(self, alpha=1.0):
        self.alpha = alpha

    def fit(self, X, y):
        classes = np.unique(y)
        n_classes = len(classes)
        n_features = X.shape[1]

        self.classes_ = classes
        self.class_log_prior_ = np.zeros(n_classes)
        self.feature_log_prob_ = np.zeros((n_classes, n_features))

        for i, c in enumerate(classes):
            X_c = X[y == c]
            self.class_log_prior_[i] = np.log(X_c.shape[0] / X.shape[0])
            counts = X_c.sum(axis=0) + self.alpha
            self.feature_log_prob_[i] = np.log(counts / counts.sum())

        return self
```

Temel içgörü: Uydurma sonrasında tahmin, yalnızca matris çarpımı artı bir önyargıdan ibarettir. Naive Bayes'in bu kadar hızlı olmasının nedeni budur.

### GaussianNB

Sürekli özellikler için, özellik ve sınıf başına ortalama ve varyansı tahmin ederiz:

```python
class GaussianNB:
    def __init__(self):
        pass

    def fit(self, X, y):
        classes = np.unique(y)
        self.classes_ = classes
        self.means_ = np.zeros((len(classes), X.shape[1]))
        self.vars_ = np.zeros((len(classes), X.shape[1]))
        self.priors_ = np.zeros(len(classes))

        for i, c in enumerate(classes):
            X_c = X[y == c]
            self.means_[i] = X_c.mean(axis=0)
            self.vars_[i] = X_c.var(axis=0) + 1e-9
            self.priors_[i] = X_c.shape[0] / X.shape[0]

        return self
```

Tahmin, özellik başına Gauss PDF'sini, özelliklerle çarpılarak kullanır (günlük alanına eklenir).

### Demo: Metin Sınıflandırması

Kod, iki sınıfı (teknoloji makaleleri ve spor makaleleri) simüle eden sentetik kelime çantası verileri üretir. Her sınıfın farklı kelime frekans dağılımı vardır. MultinomialNB bunları kelime sayımlarını kullanarak sınıflandırır.

Sentetik veriler şu şekilde çalışır: 200 "kelime" (özellik sütunları) oluştururuz. 0-39 arası kelimeler teknoloji makalelerinde yüksek, spor makalelerinde ise düşük frekansa sahiptir. 80-119 arasındaki kelimeler sporda yüksek, teknolojide düşük frekansa sahiptir. 40-79 arası kelimeler her ikisinde de orta frekanstadır. Bu, bazı kelimelerin güçlü sınıf göstergeleri olduğu, diğerlerinin ise gürültü olduğu gerçekçi bir senaryo yaratır.

### Demo: Sürekli Özellikler

Kod, İris benzeri veriler üretir (3 sınıf, 4 özellik, Gauss kümesi). GaussianNB, sınıf başına ortalama ve varyansı kullanarak sınıflandırma yapar. Her sınıfın farklı bir merkezi (ortalama vektör) ve farklı yayılımı (varyans) vardır; bu, ölçümlerin kategoriler arasında sistematik olarak farklılık gösterdiği gerçek dünya verilerini taklit eder.

Kod ayrıca şunları da gösterir:
- **Düzleştirme karşılaştırması:** Düzgünleştirme gücünün doğruluk üzerindeki etkisini göstermek için MultinomialNB'yi farklı alfa değerleriyle eğitme.
- **Eğitim boyutu deneyi:** Eğitim verilerinin sayısı 20'den 1600'e çıktıkça NB doğruluğu nasıl artıyor? NB, çok az örnekle bile makul bir doğruluğa ulaşır; bu onun ana avantajıdır.
- **Karışıklık matrisi:** NB'nin nerede hata yaptığını gösteren sınıf başına hassasiyet, hatırlama ve F1 puanı.

### Tahmin Hızı

Naive Bayes tahmini bir matris çarpımıdır. D özellikli ve k sınıflı n örnek için:
- Çok terimliNB: bir matris çarpımı (n x d) @ (d x k) = O(n * d * k)
- GaussianNB: n * k Gaussian PDF değerlendirmeleri, her biri d özellik = O(n * d * k)

Her ikisi de her boyutta doğrusaldır. Bunu KNN (tüm eğitim noktalarına mesafe hesaplaması gerektiren) veya RBF çekirdekli SVM (tüm destek vektörlerine karşı çekirdek değerlendirmesi gerektiren) ile karşılaştırın. NB, tahmin zamanında büyüklük sırasına göre daha hızlıdır.

## Kullan onu

Sklearn'de her iki değişken de tek satırlıktır:

```python
from sklearn.naive_bayes import GaussianNB, MultinomialNB

gnb = GaussianNB()
gnb.fit(X_train, y_train)
print(f"GaussianNB accuracy: {gnb.score(X_test, y_test):.3f}")

mnb = MultinomialNB(alpha=1.0)
mnb.fit(X_train_counts, y_train)
print(f"MultinomialNB accuracy: {mnb.score(X_test_counts, y_test):.3f}")
```

Sklearn ile metin sınıflandırması için:

```python
from sklearn.feature_extraction.text import CountVectorizer
from sklearn.naive_bayes import MultinomialNB
from sklearn.pipeline import Pipeline

text_clf = Pipeline([
    ("vectorizer", CountVectorizer()),
    ("classifier", MultinomialNB(alpha=1.0)),
])

text_clf.fit(train_texts, train_labels)
accuracy = text_clf.score(test_texts, test_labels)
```

`naive_bayes.py`'deki kod, doğruluğunu doğrulamak için sıfırdan uygulamaları aynı verilerdeki sklearn ile karşılaştırır.

### Naive Bayes'li TF-IDF

Ham kelime sayıları her kelimeye oluşum başına eşit ağırlık verir. Ancak "the" ve "is" gibi yaygın kelimeler her sınıfta sıklıkla karşımıza çıkar; hiçbir bilgi taşımazlar. TF-IDF (Terim Frekansı - Ters Belge Sıklığı), yaygın sözcüklerin ağırlığını azaltırken nadir, ayırt edici sözcüklerin ağırlığını artırır.

```python
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.naive_bayes import MultinomialNB
from sklearn.pipeline import Pipeline

text_clf = Pipeline([
    ("tfidf", TfidfVectorizer()),
    ("classifier", MultinomialNB(alpha=0.1)),
])
```

TF-IDF değerleri negatif değildir, dolayısıyla MultinomialNB ile çalışırlar. TF-IDF + MultinomialNB kombinasyonu, metin sınıflandırması için en güçlü temellerden biridir. dataset'lerde 10.000'den az eğitim örneğiyle sıklıkla daha karmaşık modelleri yener.

### Kısa Metin için BernoulliNB

Kısa metinler (tweetler, SMS, sohbet mesajları) açısından BernoulliNB, MultinomialNB'den daha iyi performans gösterebilir. Kısa metinlerin kelime sayısı azdır, dolayısıyla MultinomialNB'nin dayandığı frekans bilgisi gürültülüdür. BernoulliNB yalnızca kısa metinlerde daha güvenilir olan varlığı veya yokluğu önemser.

```python
from sklearn.naive_bayes import BernoulliNB
from sklearn.feature_extraction.text import CountVectorizer

text_clf = Pipeline([
    ("vectorizer", CountVectorizer(binary=True)),
    ("classifier", BernoulliNB(alpha=1.0)),
])
```

CountVectorizer'daki `binary=True` bayrağı tüm sayıları 0/1'e dönüştürür. Bu olmadan, BernoulliNB hala çalışıyor ancak tasarlanmadığı sayımları görüyor.

### NB Olasılıklarını Kalibre Etme

NB olasılıkları kötü kalibre edilmiştir. NB P(spam) = 0,95 dediğinde gerçek olasılık 0,7 olabilir. Güvenilir olasılık tahminlerine ihtiyacınız varsa (örneğin, bir eşik belirlemek veya diğer modellerle birleştirmek için), sklearn'in CalibratedClassifierCV'sini kullanın:

```python
from sklearn.calibration import CalibratedClassifierCV

calibrated_nb = CalibratedClassifierCV(MultinomialNB(), cv=5, method="sigmoid")
calibrated_nb.fit(X_train, y_train)
proba = calibrated_nb.predict_proba(X_test)
```

Bu, çapraz doğrulamayı kullanan NB'nin ham puanlarının üstüne lojistik bir regresyona uyuyor. Ortaya çıkan olasılıklar gerçek sınıf frekanslarına çok daha yakındır.

### Sık Karşılaşılan Şeyler

1. **Negatif özellik değerleri.** MultinomialNB, negatif olmayan özellikler gerektirir. Negatif değerleriniz varsa (belirli ayarlara veya standartlaştırılmış özelliklere sahip TF-IDF gibi), bunun yerine GaussianNB'yi kullanın veya özellikleri pozitif olacak şekilde kaydırın.

2. **Sıfır varyans özellikleri.** GaussianNB varyansa böler. Bir özelliğin bir sınıf için sıfır varyansı varsa (tüm değerler aynı), olasılık hesaplaması bozulur. Kod, bunu önlemek için tüm varyanslara küçük bir yumuşatma terimi (1e-9) ekler.

3. **Sınıf dengesizliği.** E-postaların %99'u spam değilse, önceki P(spam değil) = 0,99 o kadar güçlüdür ki, olasılık kanıtını bastırır. Sınıf önceliklerini manuel olarak ayarlayabilir veya sklearn'de class_prior parametresini kullanabilirsiniz.

4. **Özellik ölçeklendirme.** MultinomialNB'nin ölçeklendirmeye ihtiyacı yoktur (sayımlara göre çalışır). GaussianNB'nin ölçeklendirmeye de ihtiyacı yoktur (özellik başına istatistikleri tahmin eder). Bu, özellik ölçeklerine duyarlı olan lojistik regresyon ve SVM'ye göre bir avantajdır.

## Gönderin

Bu ders şunları üretir:
- `outputs/skill-naive-bayes-chooser.md` -- doğru NB varyantını seçmeye yönelik bir karar becerisi
- `code/naive_bayes.py` -- Sklearn karşılaştırmasıyla sıfırdan MultinomialNB ve GaussianNB

### Naive Bayes Başarısız Olduğunda

Bağımsızlık varsayımı yanlış sıralamalara (sadece yanlış olasılıklara değil) neden olduğunda NB başarısız olur. Bu şu durumlarda olur:

1. **Güçlü özellik etkileşimleri.** Eğer sınıf iki özelliğin kombinasyonuna bağlıysa ancak her iki özelliğin de tek başına olmaması durumunda (XOR benzeri modeller), NB bunu tamamen kaçıracaktır. Her özellik tek başına hiçbir kanıt sağlamaz ve NB bunları doğrusal olmayan bir şekilde birleştiremez.

2. **Karşıt kanıtlarla yüksek derecede ilişkili özellikler.** A özelliği "spam" diyorsa ve B özelliği "spam değil" diyorsa ancak A ve B mükemmel bir şekilde korelasyonluysa (gerçekte her zaman aynı fikirdeler), NB hiçbir şeyin olmadığı çelişkili kanıtlar görecektir.

3. **Çok geniş eğitim setleri.** Yeterli veriyle, lojistik regresyon gibi ayırt edici modeller gerçek karar sınırını öğrenir ve NB'den daha iyi performans gösterir. Küçük verilerde yardımcı olan bağımsızlık varsayımı artık modeli geride tutuyor.

Pratikte bu hata modları metin sınıflandırmasında nadirdir. Metin özellikleri çok sayıdadır, tek tek zayıftır ve bağımsızlık varsayımının hataları ortadan kalkma eğilimindedir. Güçlü bir şekilde ilişkili olan birkaç özelliğe sahip tablo verileri için öncelikle lojistik regresyonu veya ağaç tabanlı modelleri göz önünde bulundurun.

## Egzersizler

1. **Düzleştirme deneyi.** MultinomialNB'yi 0,01, 0,1, 1,0, 10,0 ve 100,0 alfa değerlerine sahip metin verileri üzerinde eğitin. Grafik doğruluğu vs alfa. Performans nerede zirveye ulaşır? Çok yüksek alfa neden acı verir?

2. **Özellik bağımsızlığı testi.** Gerçek bir metin dataset alın. Açıkça ilişkili olan iki kelimeyi seçin ("makine" ve "öğrenme"). P(word1 | class) * P(word2 | class) değerini hesaplayın ve P(word1 AND word2 | class) ile karşılaştırın. Bağımsızlık varsayımı ne kadar yanlıştır? Sınıflandırma doğruluğunu etkiler mi?

3. **Bernoulli uygulaması.** Kodu bir BernoulliNB sınıfıyla genişletin. Kelime çantasını ikiliye (var/yok) dönüştürün ve metin verilerindeki doğruluğu MultinomialNB ile karşılaştırın. Bernoulli ne zaman kazanır?

4. **NB ve Lojistik Regresyon.** Her ikisini de metin verileriyle eğitin. 100 eğitim örneğiyle başlayın ve sayıyı 10.000'e çıkarın. Her ikisi için de çizim doğruluğu ve eğitim seti boyutu. Lojistik Regresyon hangi noktada Naive Bayes'i geride bırakıyor?

5. **Spam filtresi.** Eksiksiz bir spam sınıflandırıcı oluşturun: token Ham e-posta metnini oluşturun, kelime dağarcığı oluşturun, kelime çantası özellikleri oluşturun, MultinomialNB'yi eğitin, hassasiyetle değerlendirin ve geri çağırın (yalnızca doğruluk değil, neden?).

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|----------------------|
| Naif Bayes | "Basit olasılıksal sınıflandırıcı" | Bayes teoremini, özelliklerin sınıfa göre koşullu olarak bağımsız olduğu varsayımıyla uygulayan bir sınıflandırıcı |
| Koşullu bağımsızlık | "Özellikler birbirini etkilemez" | P(A, B \| C) = P(A \| C) * P(B \| C) -- B'yi bilmek, C |'yi öğrendikten sonra size A hakkında yeni bir şey söylemez.
| Laplace yumuşatma | "Eklenti yumuşatma" | Sıfır olasılığın tahmine hakim olmasını önlemek için her özelliğe küçük bir sayı ekleme |
| Önceki | "Verileri görmeden önce neye inanıyordunuz" | P(sınıf) -- herhangi bir özelliği gözlemlemeden önce her sınıfın olasılığı |
| Olasılık | "Veriler ne kadar iyi uyuyor" | P(özellikler \| sınıf) -- eğer sınıf biliniyorsa bu özellikleri gözlemleme olasılığı |
| Arka | "Verileri gördükten sonra neye inanırsınız" | P(sınıf \| özellikler) -- özellikler gözlemlendikten sonra sınıfın güncellenen olasılığı |
| Üretken model | "Verilerin nasıl oluşturulduğunu modeller" | P(X \| Y) ve P(Y)'yi öğrenen, ardından Bayes teoremini kullanarak P(Y \| X) |
| Ayırt edici model | "Karar sınırını modeller" | X'in nasıl oluşturulduğunu modellemeden doğrudan P(Y \| X) öğrenen bir model |
| Günlük olasılığı | "Aşağı akışı önleyin" | Kayan noktada birçok küçük sayının çarpımının sıfır olmasını önlemek için P yerine log P ile çalışma |

## Daha Fazla Okuma

- [scikit-learn Naive Bayes belgelerini](https://scikit-learn.org/stable/modules/naive_bayes.html) -- üç değişkenin tümü matematiksel ayrıntılarla birlikte
- [McCallum ve Nigam, Naive Bayes Metin Sınıflandırması için Olay Modellerinin Karşılaştırması (1998)](https://www.cs.cmu.edu/~knigam/papers/multinomial-aaaiws98.pdf) -- metin için Multinomial ile Bernoulli'nin klasik karşılaştırması
- [Rennie ve diğerleri, Naive Bayes Metin Sınıflandırıcılarının Zayıf Varsayımlarıyla Mücadele (2003)](https://people.csail.mit.edu/jrennie/papers/icml03-nb.pdf) -- metin için NB'de iyileştirmeler
- [Ng ve Jordan, Ayrımcı ve Üretken Sınıflandırıcılar Üzerine (2001)](https://ai.stanford.edu/~ang/papers/nips01-discriminativegenerative.pdf) -- NB'nin daha az veriyle LR'den daha hızlı yakınsadığını kanıtlıyor
