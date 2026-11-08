# Bayes teoremi

> Muhtemelen beklediğiniz şeyle ilgili Bayes teoremi de öğrendiğiniz şeyle ilgili.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 1, Lesson 06 (Probability Fundamentals)
**Time:** ~75 minutes

## Öğrenme Hedefleri

- Önceden, olasılıklardan ve kanıtlardan sonraki olasılıkları hesaplamak için Bayes teorimini uygulayın
- Laplace düzeltmesi ve log- uzay hesaplama ile Naive Bayes metin sınıflandırıcısını sıfırdan oluşturun
- MLE ve MAP tahminlerini karşılaştırın ve MAP'nin L2 düzenlenmesine nasıl karşılık verdiğini açıklayın
- A/B testleri için Beta-Binomial konjugat öncüleri kullanarak sıralı Bayesian güncelleştirmeyi uygulayın

## Sorun

Teste yüzde 99 doğruluk gösteriyor, test pozitif.

Çoğu insan 99% diyor. Gerçek cevap hastalığın ne kadar nadir olduğuna bağlıdır. Eğer 10.000 kişiden 1 kişi hastalıktırsa, olumlu sonuçlar sadece hasta olma şansının %1'ini verir. Diğer olumlu sonuçların %99'u sağlıklı insanlardan gelen sahte alarmlardır.

Bu bir hile sorusu değil. Bayes teoremi. Her spam filtre, her tıbbi teşhis, belirsizlikleri ölçen her makine öğrenme modeli bu tam olarak mantık kullanır. İnançla başlarsınız. Kanıt görürsünüz. Güncelleştiriyorsunuz.

Bunu anlamadan ML sistemleri inşa ederseniz, model çıkışlarını yanlış yorumlarsınız, kötü eşiği belirlersiniz ve aşırı güvenli tahminler gönderirsiniz.

## Anlaşım

### Ortak olasılıktan Bayes'e

Ders 06 ' dan beri şartsal olasılığın:

```math
P(A \mid B) = \frac{P(A \text{ and } B)}{P(B)}
```

Ve simetrik olarak:

```math
P(B \mid A) = \frac{P(A \text{ and } B)}{P(A)}
```

Her iki ifade de aynı sayıcıya sahiptir: $P(A \text{ and } B)$- Onları eşitle ve yeniden düzenle .

```math
\begin{aligned}
P(A \text{ and } B) &= P(A \mid B) \cdot P(B) = P(B \mid A) \cdot P(A) \\[4pt]
&\text{Therefore:} \\[4pt]
P(A \mid B) &= \frac{P(B \mid A) \cdot P(A)}{P(B)}
\end{aligned}
```

Bu Bayes teoremi. 4 büyüklük, 1 denklem.

### Dört bölüm

| Part | Name | What it means |
|------|------|---------------|
| $P(A \mid B)$ | Posterior | Your updated belief about $A$ after seeing evidence $B$ |
| $P(B \mid A)$ | Likelihood | How probable the evidence $B$ is if $A$ is true |
| $P(A)$ | Prior | Your belief about $A$ before seeing any evidence |
| $P(B)$ | Evidence | Total probability of seeing $B$ under all possibilities |

Kanıt süresi$P(B)$Toplam olasılık yasasını kullanarak genişletebilirsiniz:

```math
P(B) = P(B \mid A) \cdot P(A) + P(B \mid \text{not } A) \cdot P(\text{not } A)
```

### Tıbbi test örneği

Bir hastalık 10.000 kişiden 1'i etkiliyor. Test %99 doğrudur (hastalık olanların %99'unu yakalar, %1'inde yanlış pozitif verir).

```math
\begin{aligned}
P(\text{sick}) &= 0.0001 \quad \text{(prior: disease is rare)} \\
P(\text{positive} \mid \text{sick}) &= 0.99 \quad \text{(likelihood: test catches it)} \\
P(\text{positive} \mid \text{healthy}) &= 0.01 \quad \text{(false positive rate)} \\[6pt]
P(\text{positive}) &= P(\text{positive} \mid \text{sick}) \cdot P(\text{sick}) + P(\text{positive} \mid \text{healthy}) \cdot P(\text{healthy}) \\
&= 0.99 \cdot 0.0001 + 0.01 \cdot 0.9999 \\
&= 0.000099 + 0.009999 \\
&= 0.010098 \\[6pt]
P(\text{sick} \mid \text{positive}) &= P(\text{positive} \mid \text{sick}) \cdot P(\text{sick}) / P(\text{positive}) \\
&= 0.99 \cdot 0.0001 / 0.010098 \\
&= 0.0098 \\
&= 0.98\%
\end{aligned}
```

Bir hastalığa rastlananlar bile, çoğu kez yanlış pozitif sonuçlar verir.

### Spam filtre örneği

"Lotteri" kelimesini içeren bir e-posta aldınız.

```math
\begin{aligned}
P(\text{spam}) &= 0.3 \quad \text{(30\% of email is spam)} \\
P(\text{"lottery"} \mid \text{spam}) &= 0.05 \quad \text{(5\% of spam emails contain "lottery")} \\
P(\text{"lottery"} \mid \text{not spam}) &= 0.001 \quad \text{(0.1\% of legitimate emails contain "lottery")} \\[6pt]
P(\text{"lottery"}) &= 0.05 \cdot 0.3 + 0.001 \cdot 0.7 \\
&= 0.015 + 0.0007 \\
&= 0.0157 \\[6pt]
P(\text{spam} \mid \text{"lottery"}) &= 0.05 \cdot 0.3 / 0.0157 \\
&= 0.955 \\
&= 95.5\%
\end{aligned}
```

Bir kelime olasılığı %30'dan %95.5'e kaydırır. Gerçek bir spam filtresi Bayes'i yüzlerce kelime üzerinde aynı anda uyguluyor.

### Naive Bayes: Bağımsızlık varsayımı

Naive Bayes, tüm özelliklerin sınıfı göz önüne alındığında koşulsuz bağımsız olduğunu varsayarak bunu birden fazla özelliğe uzattı:

```math
P(\text{class} \mid \text{feature}_1, \text{feature}_2, \ldots, \text{feature}_n) = \frac{P(\text{class}) \cdot P(\text{feature}_1 \mid \text{class}) \cdot P(\text{feature}_2 \mid \text{class}) \cdots P(\text{feature}_n \mid \text{class})}{P(\text{feature}_1, \text{feature}_2, \ldots, \text{feature}_n)}
```

"Sane" kısmı bağımsızlık varsayımıdır. Metinde, kelime olayları bağımsız değildir ("Yeni" ve "York" ilişkilidir). Ancak varsayım pratikte şaşırtıcı derecede iyi çalışır çünkü sınıflandırıcı sadece sınıfları sıralamalı, kalibrli olasılıkları üretmemelidir.

Tüm sınıflar için isimlendirici aynı olduğundan, onu atlayıp saylayıcıları karşılaştırabilirsiniz:

```math
\text{score}(\text{class}) = P(\text{class}) \cdot \prod_i P(\text{feature}_i \mid \text{class})
```

En yüksek puanı alan sınıfı seç.

### Maksimum olasılık tahminleri (MLE)

Nasıl oluyor da ?$P(\text{feature} \mid \text{class})$- Eğitim verilerinden mi?

```math
P(\text{"free"} \mid \text{spam}) = \frac{\text{number of spam emails containing "free"}}{\text{total spam emails}}
```

Bu MLE: gözlemlenen verileri en olası yapan parametreler değerlerini seçin. Muhtemelenlik fonksiyonunu en üst düzeye çıkarıyorsunuz, bu da ayrı sayılar için nispet frekansına düşürür.

Sorun: Eğer bir kelime eğitim sırasında spam'de hiç görünmezse, MLE ona sıfır olasılık verir.

```math
P(\text{word} \mid \text{class}) = \frac{\text{count}(\text{word}, \text{class}) + 1}{\text{total\_words\_in\_class} + \text{vocabulary\_size}}
```

Her saymaya 1 eklemek, hiç bir olasılığın asla sıfır olmadığını sağlar.

Hiçbir eğitim mesajında hiç görünmeyen bir kelime sözlükte bulunmuyor. `predict`- Hayır, hayır. - Hayır, hayır.

### Maksimum a posteriori (MAP)

MLE soruyor: hangi parametrelerin en üst düzeyde olması $P(\text{data} \mid \text{parameters})$- Ne ?

MAP soruyor: hangi parametrelerin en üst düzeyde olması $P(\text{parameters} \mid \text{data})$- Ne ?

Bayes teoremiyle:

```math
P(\text{parameters} \mid \text{data}) \propto P(\text{data} \mid \text{parameters}) \cdot P(\text{parameters})
```

MAP, parametrelerin kendileri üzerinde bir öncü ekler. Eğer parametrelerin küçük olması gerektiğine inanıyorsanız, bunu büyük değerleri cezalandıran bir öncü olarak kodlarsınız. Bu ML'deki L2 düzenlenmesine benzer. Kırmızı tepede "boğaz" cezası, ağırlıklarda kelimenin tam anlamıyla Gaussian öncüdür.

| Estimation | Optimizes | ML equivalent |
|------------|-----------|---------------|
| MLE | $P(\text{data} \mid \text{params})$ | Unregularized training |
| MAP | $P(\text{data} \mid \text{params}) \cdot P(\text{params})$ | L2 / L1 regularization |

### Bayesian vs. Frequentist: pratik fark

Frequentistler parametreyi bilinmeyen bir şey olarak görüyor ve "Bu deneyi defalarca tekrarlarsam ne olur?" diye soruyorlar.

Bayesililer parametreleri dağılım olarak görüyor ve "Ben gözlemlediğimden dolayı parametreler hakkında ne düşünüyorum?" diye soruyorlar.

ML sistemlerinin inşaatı için pratik fark:

| Aspect | Frequentist | Bayesian |
|--------|-------------|----------|
| Output | Point estimate | Distribution over values |
| Uncertainty | Confidence intervals (about procedure) | Credible intervals (about parameter) |
| Small data | Can overfit | Prior acts as regularization |
| Computation | Usually faster | Often requires sampling (MCMC) |

Çoğu üretim ML frekansist (SGD, nokta tahminleri) Bayesian yöntemler kalibrli belirsizlik (tıp kararları, güvenlik kritik sistemleri) veya verilerin az olduğu (çık atışlı öğrenme, soğuk başlangıç) zaman parlaklık gösterir.

### Bayesian düşüncesinin ML için neden önemli olduğu

Bağlantı analogiden daha derin:

**Priors are regularization.**Gaussian önlemleri L2 düzenlemesi, Laplace önlemleri L1'dir. Her düzenleme terimini eklediğinizde, hangi parametreler değerlerini beklediğiniz hakkında Bayesian bir ifade yapıyorsunuz.

**Posteriors are uncertainty.**Tek tahmin edilen olasılık, modelin bu tahminle ilgili ne kadar güvenli olduğunu söylemez.$P(\text{spam})$0.8 ile 0.95 arasında".

**Bayes updates are online learning.**Bugünün arkası yarınki öncesidir. Modeliniz yeni verileri gördüğünde, inançlarını sıfırdan yeniden eğitmek yerine, aşamalı olarak güncelleyecek.

**Model comparison is Bayesian.**Bayesian bilgi kriterleri (BIC), sınırlı olasılıkla ve Bayes faktörleri, aşırı uygun olmadan modeller arasında seçim yapmak için Bayesian mantık kullanır.

```figure
bayes-update
```

## Yapın

### Adım 1: Bayes teoremi işlevi

```python
def bayes(prior, likelihood, false_positive_rate):
    evidence = likelihood * prior + false_positive_rate * (1 - prior)
    posterior = likelihood * prior / evidence
    return posterior

result = bayes(prior=0.0001, likelihood=0.99, false_positive_rate=0.01)
print(f"P(sick|positive) = {result:.4f}")
```

### Adım 2: Naive Bayes sınıflandırıcısı

```python
import math
from collections import defaultdict

class NaiveBayes:
    def __init__(self, smoothing=1.0):
        self.smoothing = smoothing
        self.class_counts = defaultdict(int)
        self.word_counts = defaultdict(lambda: defaultdict(int))
        self.class_word_totals = defaultdict(int)
        self.vocab = set()

    def train(self, documents, labels):
        for doc, label in zip(documents, labels):
            self.class_counts[label] += 1
            words = doc.lower().split()
            for word in words:
                self.word_counts[label][word] += 1
                self.class_word_totals[label] += 1
                self.vocab.add(word)

    def predict(self, document):
        words = [word for word in document.lower().split() if word in self.vocab]
        total_docs = sum(self.class_counts.values())
        vocab_size = len(self.vocab)
        best_class = None
        best_score = float("-inf")
        for cls in self.class_counts:
            score = math.log(self.class_counts[cls] / total_docs)
            for word in words:
                count = self.word_counts[cls].get(word, 0)
                total = self.class_word_totals[cls]
                score += math.log((count + self.smoothing) / (total + self.smoothing * vocab_size))
            if score > best_score:
                best_score = score
                best_class = cls
        return best_class
```

Log olasılığı, düşük akışın önlenmesini sağlar. Birçok küçük olasılığı çarpırken yüzen nokta için çok küçük sayılar üretilir. Log olasılığı toplamı sayısal olarak istikrarlıdır ve matematiksel olarak eşittir.

### Adım 3: Spam verilerini eğit

```python
train_docs = [
    "win free money now",
    "free lottery ticket winner",
    "claim your prize today free",
    "urgent offer free cash",
    "congratulations you won free",
    "meeting tomorrow at noon",
    "project update attached",
    "can we schedule a call",
    "quarterly report review",
    "lunch on thursday sounds good",
    "team standup notes attached",
    "please review the pull request",
]

train_labels = [
    "spam", "spam", "spam", "spam", "spam",
    "ham", "ham", "ham", "ham", "ham", "ham", "ham",
]

classifier = NaiveBayes()
classifier.train(train_docs, train_labels)

test_messages = [
    "free money waiting for you",
    "meeting rescheduled to friday",
    "you won a free prize",
    "please review the attached report",
]

for msg in test_messages:
    print(f"  '{msg}' -> {classifier.predict(msg)}")
```

### Dördüncü adım: Öğrenilen olasılıkları incelemek

```python
def show_top_words(classifier, cls, n=5):
    vocab_size = len(classifier.vocab)
    total = classifier.class_word_totals[cls]
    probs = {}
    for word in classifier.vocab:
        count = classifier.word_counts[cls].get(word, 0)
        probs[word] = (count + classifier.smoothing) / (total + classifier.smoothing * vocab_size)
    sorted_words = sorted(probs.items(), key=lambda x: x[1], reverse=True)
    for word, prob in sorted_words[:n]:
        print(f"    {word}: {prob:.4f}")

print("\nTop spam words:")
show_top_words(classifier, "spam")
print("\nTop ham words:")
show_top_words(classifier, "ham")
```

## Kullan

Scikit-Learn gemileri üretime hazır saf Bayes uygulamalar:

```python
from sklearn.feature_extraction.text import CountVectorizer
from sklearn.naive_bayes import MultinomialNB
from sklearn.metrics import classification_report

vectorizer = CountVectorizer()
X_train = vectorizer.fit_transform(train_docs)
clf = MultinomialNB()
clf.fit(X_train, train_labels)

X_test = vectorizer.transform(test_messages)
predictions = clf.predict(X_test)
for msg, pred in zip(test_messages, predictions):
    print(f"  '{msg}' -> {pred}")
```

Aynı algoritma. CountVectorizer, işaretleme ve kelime birikimi oluşturmayı halleder. MultinomialNB, düzeltmeyi ve kayıt olasılıklarını içeride haller.

## Gönder

Burada inşa edilen NaiveBayes sınıfı tüm hattı gösterir: tokenizasyon, Laplace düzleştirmesi ile olasılık tahminleri, log- uzay tahminleri.`code/bayes.py`Python'un standart kütüphanesi dışında hiçbir bağımlılık olmadan son-son çalıştırılır.`code/bayes.ts`Sadece Node standart kütüphanesi kullanıyor.

### Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte Birlikte

Ön ve arka bölünme aynı bölünme ailesine ait olduğunda ön bölünme "konjugat" olarak adlandırılır. Bu Bayesian güncelleştirmesini cebirsel olarak temiz yapar.

| Likelihood | Conjugate Prior | Posterior | Example |
|-----------|----------------|-----------|---------|
| Bernoulli | $\text{Beta}(a, b)$ | $\text{Beta}(a + \text{successes}, b + \text{failures})$ | Coin flip bias estimation |
| Normal (known variance) | $\text{Normal}(\mu_0, \sigma_0)$ | Normal(weighted mean, smaller variance) | Sensor calibration |
| Poisson | $\text{Gamma}(a, b)$ | $\text{Gamma}(a + \text{sum of counts}, b + n)$ | Modeling arrival rates |
| Multinomial | $\text{Dirichlet}(\alpha)$ | $\text{Dirichlet}(\alpha + \text{counts})$ | Topic modeling, language models |

Bu neden önemlidir: konjugat ön önlemleri olmadan, sonradan yaklaşmak için Monte Carlo örneklemesine veya varyasyon sonucuya ihtiyacınız var.

Beta dağılım, pratikte en yaygın konjugat öncesi olanıdır. $\text{Beta}(a, b)$Bu, bir olasılık parametri hakkında inancınızı temsil eder.$a/(a+b)$- Daha büyük .$a+b$, daha yoğun (güvenli) dağıtım.

Beta öncesi özel durumlar:
- $\text{Beta}(1, 1)$Parametre hakkında hiçbir fikrin yok.
- $\text{Beta}(10, 10)$Parametreyi 0.5'e yakın olduğuna inanıyorsunuz.
- $\text{Beta}(1, 10)$= 0'ya doğru eğilmiş. Parametre küçük olduğuna inanıyorsun.

Güncelleme kuralı çok basit:

```math
\begin{aligned}
\text{Prior:} \quad & \text{Beta}(a, b) \\
\text{Data:} \quad & s \text{ successes}, f \text{ failures} \\
\text{Posterior:} \quad & \text{Beta}(a + s, b + f)
\end{aligned}
```

Entegral yok, örnekleme yok, sadece ekleme.

### Bayesian Değişiklikleri

Bayesian sonuçları doğal olarak sıradan bir şekilde gerçekleşir. Bugünün arkası yarınki öncesine dönüşür. Gerçek sistemler tüm tarihi verileri yeniden işleme yapmadan bu şekilde adım adım öğrenir.

Konkrete bir örnek: bir madeni paranın adil olup olmadığını tahmin etmek.

**Day 1: No data yet.**
Başlayın .$\text{Beta}(1, 1)$- Bir üniforma öncü.
- Önceki ortalama: 0,5
- Prior, düz bir [0, 1]

**Day 2: Observe 7 heads, 3 tails.**
$\text{Posterior} = \text{Beta}(1 + 7, 1 + 3) = \text{Beta}(8, 4)$
- Arka ortalama: $8/12 = 0.667$
- Kanıtlar para başlara doğru yönlendirilmiş olduğunu gösteriyor

**Day 3: Observe 5 more heads, 5 more tails.**
Dünki arka parayı bugünün ön parayı olarak kullan.
$\text{Posterior} = \text{Beta}(8 + 5, 4 + 5) = \text{Beta}(13, 9)$
- Arka ortalama: $13/22 = 0.591$
- Dengeli yeni veriler tahminleri 0.5'e geri çekmiş.

```mermaid
graph LR
    A["Prior<br/>Beta(1,1)<br/>mean = 0.50"] -->|"7H, 3T"| B["Posterior 1<br/>Beta(8,4)<br/>mean = 0.67"]
    B -->|"becomes prior"| C["Prior 2<br/>Beta(8,4)"]
    C -->|"5H, 5T"| D["Posterior 2<br/>Beta(13,9)<br/>mean = 0.59"]
```

Gözlemlerin sırası önemli değil. $\text{Beta}(1,1)$12 baş ve 8 kuyrukla aynı anda güncelleştirilmiş .$\text{Beta}(13, 9)$- aynı sonuç. Sıralı güncelleme ve seri güncelleme matematiksel olarak eşittir. Ama sıralı güncelleme, ham verileri saklamadan her adımda kararlar vermenizi sağlar.

Bu, üretim ML sistemlerinde çevrimiçi öğrenmenin temelidir. Thompson'un banditler için örneklemesi, artışlı önerme sistemleri ve akış anomali tespitçileri bu örneği kullanır.

### A/B Testlerine Bağlantı

A/B testleri Bayesian sonucu olarak gizlenir.

Kurulum: iki düğme rengi test ediyorsunuz. A (mavi) ve B (yeşil) variansı. Hangisinin daha fazla tıklama aldığını bilmek istiyorsunuz.

Bayesian A/B testi:

1. **Prior.**Başlayın .$\text{Beta}(1, 1)$Her iki varians için de ön tercih yoktur.
2. **Data.**A Variant: 1000 görüntüden 50 tıklama. B Variant: 1000 görüntüden 65 tıklama.
3. **Posteriors.**
   - A: $\text{Beta}(1 + 50, 1 + 950) = \text{Beta}(51, 951)$Ortalama = 0.051
   - B: $\text{Beta}(1 + 65, 1 + 935) = \text{Beta}(66, 936)$Ortalama = 0.066
4. **Decision.**Hesaplama$P(B > A)$-- B'nin gerçek dönüşüm oranının A'dan daha yüksek olasılığı.

Bilgisayar $P(B > A)$Analizsel olarak zor ama Monte Carlo onu önemsiz kılar.

```
1. Draw 100,000 samples from Beta(51, 951)  -> samples_A
2. Draw 100,000 samples from Beta(66, 936)  -> samples_B
3. P(B > A) = fraction of samples where B > A
```

- Eğer$P(B > A) > 0.95$Eğer 0.05 ile 0.95 arasında ise, verileri toplamaya devam edersiniz.$P(B > A) < 0.05$, siz gemi A varianti .

Sıklıklı A/B testlerine göre avantajlar:
- Doğrudan bir olasılık ifadesi elde ediyorsunuz: "B'nin daha iyi olma ihtimali %97'dir"
- P değerini karıştırmak yok, "siflet hipotezini reddetme" koruma yok.
- Yanlış pozitif oranları şişirmeyerek sonuçları herhangi bir zamanda kontrol edebilirsiniz (bir "bakma sorunu" yok)
- Önceki bilgiyi içerebilirsiniz (örneğin, önceki testler dönüşüm oranlarının genellikle %3-8 olduğunu göstermektedir)

| Aspect | Frequentist A/B | Bayesian A/B |
|--------|----------------|--------------|
| Output | p-value | $P(B > A)$ |
| Interpretation | "How surprising is this data if A=B?" | "How likely is B better than A?" |
| Early stopping | Inflates false positives | Safe at any point (given a well-chosen prior and correctly specified model) |
| Prior knowledge | Not used | Encoded as Beta prior |
| Decision rule | $p < 0.05$ | $P(B > A) > \text{threshold}$ |

## Egzersizler

1. **Multiple tests.**Bir hasta bağımsız testlerde iki kez pozitif testler yapmıştır (her ikisi de %99 doğrudur, hastalık yayılması 10.000'den 1'dir).$P(\text{sick})$İkinci test için ilk testten önceki test olarak arka test kullanın.

2. **Smoothing impact.**Spam sınıflandırıcısını 0.01, 0.1, 1.0 ve 10.0'luk düzeltme değerleriyle çalıştırın.

3. **Add features.**NaiveBayes sınıfını, kelimeler sayısının yanında bir özellik olarak mesaj uzunluğu (kısık/uzun) kullanmak için genişlet. Tahmin $P(\text{short} \mid \text{spam})$ve $P(\text{short} \mid \text{ham})$Eğitim verilerinden alın ve tahmin puanına katlayın.

4. **MAP by hand.**Görülen verileri göz önüne alarak (7 başlık 10 para atışında) bir $\text{Beta}(2,2)$(MLE tahminine karşılaştırın)$7/10$)

### İpuçlar

**Exercise 1.**Arama .`bayes`1 testi sonrasında bir kez geriye dönmek için, sonra geriye dönmeyi öncü olarak tekrar çağırın.`sequential_bayes(prior, likelihood, false_positive_rate, 2)`0.5'e yakın aynı değer vermeli.

**Exercise 2.**Bir tane oluştur .`NaiveBayes(smoothing=s)`Her değer için aynı verilere göre çalıştırın ve yazdırın.`top_words`0. düzeltmekle spam'de hiç görünmeyen bir kelime 0 olasılığı elde eder, bu yüzden logu tanımlanmaz.

**Exercise 3.**Kaç spam ve ham mesajının kısa olduğunu hesaplayın, her sınıfdaki mesaj sayısına bölün ve bu oranın logunu puanlara ekleyin `predict`Her sınıf için iki olasılığın 1'e kadar olduğunu kontrol et.

**Exercise 4.**Bir $\text{Beta}(\alpha, \beta)$Daha önce, MAP tahminleri $\frac{h + \alpha - 1}{n + \alpha + \beta - 2}$- İçeri koy .$h = 7$- Evet .$n = 10$; sonuç MLE (0.7) ile önceki mod (0.5) arasında olmalıdır.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|----------------|----------------------|
| Prior | "My initial guess" | $P(\text{hypothesis})$ before observing evidence. In ML: the regularization term. |
| Likelihood | "How well the data fits" | $P(\text{evidence} \mid \text{hypothesis})$. How probable the observed data is under a specific hypothesis. |
| Posterior | "My updated belief" | $P(\text{hypothesis} \mid \text{evidence})$. The prior multiplied by the likelihood, then normalized. |
| Evidence | "The normalizing constant" | $P(\text{data})$ across all hypotheses. Ensures the posterior sums to 1. |
| Naive Bayes | "That simple text classifier" | A classifier that assumes features are independent given the class. Works well despite the false assumption. |
| Laplace smoothing | "Add-one smoothing" | Adding a small count to every feature to prevent zero probabilities from unseen data. |
| MLE | "Just use the frequencies" | Choose parameters that maximize $P(\text{data} \mid \text{parameters})$. No prior. Can overfit with small data. |
| MAP | "MLE with a prior" | Choose parameters that maximize $P(\text{data} \mid \text{parameters}) \cdot P(\text{parameters})$. Equivalent to regularized MLE. |
| Log-probability | "Work in log space" | Using $\log(P)$ instead of $P$ to avoid floating-point underflow when multiplying many small numbers. |
| False positive | "A wrong alarm" | The test says positive, but the true state is negative. Drives the base rate fallacy. |

## Daha Fazla Okumak

- [3Blue1Brown: Bayes' theorem](https://www.youtube.com/watch?v=HZGCoVF3YvM)- tıbbi test örneği ile görsel açıklama
- [Stanford CS229: Generative Learning Algorithms](https://cs229.stanford.edu/main_notes.pdf)- Naif Bayes ve onun ayrımcılık modellerine ilişkisi
- [Think Bayes](https://greenteapress.com/wp/think-bayes/)- ücretsiz kitap, Bayesian istatistikleri Python kodu ile
- [scikit-learn Naive Bayes](https://scikit-learn.org/stable/modules/naive_bayes.html)- üretim uygulamaları ve her variantın ne zaman kullanılacağı
