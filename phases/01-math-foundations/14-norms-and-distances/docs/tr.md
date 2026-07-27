# Normlar ve Mesafeler

> Mesafe fonksiyonunuz "benzer"in ne anlama geldiğini tanımlar. Yanlışı seçin ve aşağı yöndeki her şey bozulur.

**Tür:** Yapım
**Dil:** Python
**Önkoşullar:** Aşama 1, Dersler 01 (Doğrusal Cebir Sezgisi), 02 (Vektörler, Matrisler ve İşlemler)
**Süre:** ~90 dakika

## Öğrenme Hedefleri

- L1, L2, kosinüs, Mahalanobis, Jaccard'ı uygulayın ve mesafe fonksiyonlarını sıfırdan düzenleyin
- Belirli bir makine öğrenimi görevi için uygun mesafe ölçüsünü seçin ve alternatiflerin neden başarısız olduğunu açıklayın
- L1 ve L2 normlarını LASSO ve Ridge düzenlemelerine ve bunların geometrik kısıtlama bölgelerine bağlayın
- Aynı dataset'nin farklı ölçümler altında nasıl farklı en yakın komşular ürettiğini gösterin

## Sorun

İki vektörünüz var. Belki de embedding kelimesidirler. Belki bunlar kullanıcı profilleridir. Belki piksel dizileridir. Bilmeniz gerekenler: ne kadar yakınlar?

Cevap tamamen hangi mesafe fonksiyonunu seçtiğinize bağlıdır. İki veri noktası, bir ölçüt altında en yakın komşular olabilirken, bir başka ölçüt altında birbirinden uzak olabilir. KNN sınıflandırıcınız, öneri motorunuz, vector database'niz, kümeleme algoritmanız, loss function'niz - hepsi bu seçime bağlıdır. Yanlış anladığınızda modeliniz yanlış şey için optimize edilir.

Evrensel bir en iyi mesafe yoktur. L2 mekansal veriler için çalışır. Kosinüs benzerliği NLP'ye hakimdir. Jaccard setlerle ilgileniyor. Mesafeyi düzenle dizeleri işler. Mahalanobis korelasyonları açıklıyor. Wasserstein olasılık kütlesini hareket ettiriyor. Her biri "benzer"in ne anlama geldiğine dair farklı bir varsayımı kodluyor.

Bu ders, tüm önemli mesafe fonksiyonlarını sıfırdan oluşturur, her birinin ne zaman doğru araç olduğunu gösterir ve aynı verilerin, kullandığınız ölçüme bağlı olarak nasıl tamamen farklı en yakın komşular ürettiğini gösterir.

## Konsept

### Normlar: vektör büyüklüğünün ölçülmesi

Norm, bir vektörün "boyutunu" ölçer. İki vektör arasındaki her mesafe fonksiyonu, farklarının normu olarak yazılabilir: d(a, b) = ||a - b||. Yani normları anlamak mesafeleri anlamaktır.

### L1 Normu (Manhattan mesafesi)

L1 normu tüm bileşenlerin mutlak değerlerini toplar.

```
||x||_1 = |x_1| + |x_2| + ... + |x_n|
```

Manhattan mesafesi olarak adlandırılmasının nedeni, yalnızca eksenler boyunca hareket edebildiğiniz bir şehir ızgarasında ne kadar yürüdüğünüzü ölçmesidir. Köşegen yok.

```
Point A = (1, 1)
Point B = (4, 5)

L1 distance = |4-1| + |5-1| = 3 + 4 = 7

On a grid, you walk 3 blocks east and 4 blocks north.
```

L1 ne zaman kullanılmalı:
- Yüksek boyutlu seyrek veriler (metin özellikleri, tek sıcak kodlamalar)
- Aykırı değerlere karşı sağlamlık istediğinizde (tek bir büyük fark baskın değildir)
- Özellik seçimi sorunları (L1 düzenlemesi seyrekliği teşvik eder)

L1 düzenlemesine bağlantı (Kement): loss function'nize ||w||_1 eklemek, mutlak ağırlık değerlerinin toplamını cezalandırır. Bu, küçük ağırlıkları tam olarak sıfıra iterek otomatik özellik seçimi gerçekleştirir. L1 cezası, ağırlık alanında elmas şeklindeki kısıtlama bölgeleri yaratır ve elmasların köşeleri, bazı ağırlıkların sıfır olduğu eksenlerde bulunur.

loss function'lere Bağlantı: Ortalama Mutlak Hata (MAE), tahminler ve hedefler arasındaki ortalama L1 mesafesidir. Tüm hataları doğrusal olarak cezalandırarak MSE'ye kıyasla aykırı değerlere karşı dayanıklı olmasını sağlar.

### L2 Normu (Öklid mesafesi)

L2 normu düz çizgi mesafesidir. Kareli bileşenlerin toplamının karekökü.

```
||x||_2 = sqrt(x_1^2 + x_2^2 + ... + x_n^2)
```

Bu, geometri dersinde öğrendiğiniz mesafedir. N boyutlu Pisagor.

```
Point A = (1, 1)
Point B = (4, 5)

L2 distance = sqrt((4-1)^2 + (5-1)^2) = sqrt(9 + 16) = sqrt(25) = 5.0

The straight line, cutting diagonally through the grid.
```

L2 ne zaman kullanılmalı:
- Düşük ila orta boyutlu sürekli veriler
- Özellik ölçekleri karşılaştırılabilir olduğunda
- Fiziksel mesafeler (uzaysal veriler, sensör okumaları)
- Piksel düzeyinde görüntü benzerliği

L2 düzenlemesine bağlantı (Ridge): loss function'nize ||w||_2^2 eklemek büyük ağırlıkları cezalandırır. L1'den farklı olarak ağırlıkları sıfıra itmez. Tüm ağırlıkları orantılı olarak sıfıra doğru küçültür. L2 cezası dairesel kısıtlama bölgeleri oluşturur, dolayısıyla eksenlerde köşe yoktur. Ağırlıklar küçülür ancak nadiren tam olarak sıfır olur.

loss function'lere Bağlantı: Ortalama Karesel Hata (MSE), L2 mesafelerinin karesinin ortalamasıdır. Kare alma, büyük hataları küçük hatalardan daha ağır şekilde cezalandırır.

```
MAE (L1 loss):  |y - y_hat|         Linear penalty. Robust to outliers.
MSE (L2 loss):  (y - y_hat)^2       Quadratic penalty. Sensitive to outliers.
```

### Lp Normları: genel aile

L1 ve L2, Lp normunun özel durumlarıdır:

```
||x||_p = (|x_1|^p + |x_2|^p + ... + |x_n|^p)^(1/p)
```

Farklı p değerleri, farklı şekilli "birim toplar" (başlangıç noktasından 1 uzaklıktaki tüm noktaların kümesi) üretir:

```
p=1:    Diamond shape      (corners on axes)
p=2:    Circle/sphere      (the usual round ball)
p=3:    Superellipse       (rounded square)
p=inf:  Square/hypercube   (flat sides along axes)
```

### L-sonsuzluk Normu (Chebyshev mesafesi)

p sonsuza yaklaştıkça Lp normu maksimum mutlak bileşene yakınsar.

```
||x||_inf = max(|x_1|, |x_2|, ..., |x_n|)
```

İki nokta arasındaki mesafe, en fazla farklılık gösterdikleri tek boyuta göre belirlenir. Diğer tüm boyutlar göz ardı edilir.

```
Point A = (1, 1)
Point B = (4, 5)

L-inf distance = max(|4-1|, |5-1|) = max(3, 4) = 4
```

L-sonsuz ne zaman kullanılır:
- Herhangi bir boyuttaki en kötü durum sapması önemli olduğunda
- Oyun tahtaları (satrançta şah L-sonsuzda hareket eder: herhangi bir yöndeki bir adımın maliyeti 1'dir)
- İmalat toleransları (her boyut spesifikasyona uygun olmalıdır)

### Kosinüs Benzerliği ve Kosinüs Uzaklığı

Kosinüs benzerliği, büyüklüklerini göz ardı ederek iki vektör arasındaki açıyı ölçer.

```
cos_sim(a, b) = (a . b) / (||a||_2 * ||b||_2)
```

-1 (zıt yönler) ile +1 (aynı yön) arasında değişir. Dik vektörlerin kosinüs benzerliği 0'dır.

Kosinüs mesafesi onu bir mesafeye dönüştürür: kosinüs_mesafesi = 1 - kosinüs_benzerliği. Bu, 0 (aynı yön) ile 2 (ters yön) arasında değişir.

```
a = (1, 0)    b = (1, 1)

cos_sim = (1*1 + 0*1) / (1 * sqrt(2)) = 1/sqrt(2) = 0.707
cos_dist = 1 - 0.707 = 0.293
```

NLP ve embedding'lerde kosinüs neden baskındır: metinde belge uzunluğu benzerliği etkilememelidir. Kedilerle ilgili başka bir belgenin iki katı uzunlukta olan kedilerle ilgili bir belge yine de "benzer" olmalıdır. Kosinüs benzerliği büyüklüğü (uzunluğu) göz ardı eder ve yalnızca yöne önem verir. Aynı kelime dağılımına sahip ancak farklı uzunluktaki iki belge aynı yönü işaret eder ve kosinüs benzerliği 1,0 olur.

Kosinüs benzerliği ne zaman kullanılır?
- Metin benzerliği (TF-IDF vektörleri, embedding kelimesi, embedding cümlesi)
- Büyüklüğün gürültü ve yönün sinyal olduğu herhangi bir alan
- Öneri sistemleri (kullanıcı tercih vektörleri)
- Embedding arama (vector database'ler neredeyse her zaman kosinüs veya nokta çarpımını kullanır)

### Nokta Çarpım Benzerliği ve Kosinüs Benzerliği

İki vektörün nokta çarpımı:

```
a . b = a_1*b_1 + a_2*b_2 + ... + a_n*b_n
      = ||a|| * ||b|| * cos(angle)
```

Kosinüs benzerliği, her iki büyüklük tarafından normalleştirilmiş nokta çarpımdır. Her iki vektör de birim normalize edildiğinde (büyüklük = 1), nokta çarpım ve kosinüs benzerliği aynıdır.

```
If ||a|| = 1 and ||b|| = 1:
    a . b = cos(angle between a and b)
```

Farklı olduklarında: nokta çarpım büyüklük bilgisini içerir. Büyüklüğü daha büyük olan bir vektör daha yüksek bir nokta çarpım puanı alır. Bu, "popüler" öğelerin daha üst sıralarda yer almasını istediğiniz bazı erişim sistemlerinde önemlidir. Büyüklük, örtülü bir kalite veya önem sinyali görevi görür.

```
a = (3, 0)    b = (1, 0)    c = (0, 1)

dot(a, b) = 3     dot(a, c) = 0
cos(a, b) = 1.0   cos(a, c) = 0.0

Both agree on direction, but dot product also reflects magnitude.
```

Pratikte:
- Saf yön benzerliği istediğinizde kosinüs benzerliğini kullanın
- Büyüklükler anlamlı bilgi taşıdığında nokta çarpımı kullanın
- Birçok vector database (Pinecone, Weaviate, Qdrant) aralarında seçim yapmanızı sağlar
- embedding'leriniz L2 normalleştirilmişse seçimin önemi yoktur

### Mahalanobis Mesafesi

Öklid mesafesi tüm boyutları eşit olarak ele alır. Ancak özellikleriniz birbiriyle ilişkiliyse veya farklı ölçeklere sahipse L2 yanıltıcı sonuçlar verir.

Mahalanobis mesafesi, verilerin kovaryans yapısını açıklar.

```
d_M(x, y) = sqrt((x - y)^T * S^(-1) * (x - y))
```

burada S, verilerin kovaryans matrisidir.

Sezgisel olarak: Mahalanobis mesafesi ilk önce verileri ilişkilendirmez ve normalleştirir (beyazlatma), ardından dönüştürülen uzaydaki L2 mesafesini hesaplar. Eğer S birim matris ise (ilişkisiz, birim varyans özellikleri), Mahalanobis mesafesi Öklid mesafesine indirgenir.

```
Example: height and weight are correlated.
Someone 6'2" and 180 lbs is not unusual.
Someone 5'0" and 180 lbs is unusual.

Euclidean distance might say they are equally far from the mean.
Mahalanobis distance correctly identifies the second as an outlier
because it accounts for the height-weight correlation.
```

Mahalanobis mesafesi ne zaman kullanılır?
- Aykırı değer tespiti (ortalamadan büyük Mahalanobis mesafesine sahip noktalar aykırı değerlerdir)
- Özelliklerin farklı ölçekleri ve korelasyonları olduğunda sınıflandırma
- Güvenilir bir kovaryans matrisini tahmin etmek için yeterli veriye sahip olduğunuzda
- İmalatta kalite kontrol (çok değişkenli proses takibi)

### Jaccard Benzerliği (setler için)

Jaccard benzerlik ölçümleri iki küme arasında örtüşmektedir.

```
J(A, B) = |A intersect B| / |A union B|
```

0'dan (örtüşme yok) 1'e (özdeş kümeler) kadar değişir. Jaccard mesafesi = 1 - Jaccard benzerliği.

```
A = {cat, dog, fish}
B = {cat, bird, fish, snake}

Intersection = {cat, fish}         size = 2
Union = {cat, dog, fish, bird, snake}  size = 5

Jaccard similarity = 2/5 = 0.4
Jaccard distance = 0.6
```

Jaccard ne zaman kullanılmalı:
- Etiket, kategori veya özellik kümelerini karşılaştırma
- Kelime varlığına dayalı belge benzerliği (sıklığa değil)
- Neredeyse kopya tespiti (Jaccard'ın MinHash yaklaşımı)
- İkili özellik vektörlerinin karşılaştırılması (varlık/yokluk verileri)
- Segmentasyon modellerinin değerlendirilmesi (Birleşim Üzerinden Kesişme = Jaccard)

### Mesafeyi Düzenle (Levenshtein Mesafesi)

Düzenleme mesafesi, bir dizeyi diğerine dönüştürmek için gereken minimum tek karakterli işlem sayısını sayar. İşlemler şunlardır: ekleme, silme veya değiştirme.

```
"kitten" -> "sitting"

kitten -> sitten  (substitute k -> s)
sitten -> sittin  (substitute e -> i)
sittin -> sitting (insert g)

Edit distance = 3
```

Dinamik programlama kullanılarak hesaplanır. (i, j) girişinin, A dizesinin ilk i karakterleri ile B dizesinin ilk j karakterleri arasındaki düzenleme mesafesi olduğu bir matris doldurun.

```
        ""  s  i  t  t  i  n  g
    ""   0  1  2  3  4  5  6  7
    k    1  1  2  3  4  5  6  7
    i    2  2  1  2  3  4  5  6
    t    3  3  2  1  2  3  4  5
    t    4  4  3  2  1  2  3  4
    e    5  5  4  3  2  2  3  4
    n    6  6  5  4  3  3  2  3
```

Düzenleme mesafesini ne zaman kullanmalı:
- Yazım denetimi ve düzeltme
- DNA dizi hizalaması (ağırlıklı işlemlerle)
- Bulanık dize eşleştirme
- Dağınık metin verilerinin tekilleştirilmesi

### KL Diverjans (mesafe değil ama bir gibi kullanılır)

KL sapması bir olasılık dağılımının diğerinden ne kadar farklı olduğunu ölçer. Ders 09'da ele alınıyor, ancak bu tartışmanın içinde yer alıyor çünkü insanlar bunu bir "mesafe" olmasa da bir "mesafe" olarak kullanıyor.

```
D_KL(P || Q) = sum(p(x) * log(p(x) / q(x)))
```

Kritik özellik: KL ıraksaması simetrik DEĞİLDİR.

```
D_KL(P || Q) != D_KL(Q || P)
```

Bu, bir mesafe ölçümünün temel gereksinimini karşılamadığı anlamına gelir. Aynı zamanda üçgen eşitsizliğini de sağlamaz. Bu bir mesafe değil, farklılıktır.

İleri KL (D_KL(P || Q)) "ortalama arayandır": Q, P'nin tüm modlarını kapsamaya çalışır.
Ters KL (D_KL(Q || P)) "mod arayandır": Q, P'nin tek bir moduna odaklanır.

KL sapmasını gördüğünüzde:
- VAE'ler (ELBO'daki KL terimi gizli dağılımı bir öncekine doğru iter)
- Bilginin damıtılması (öğrenci, öğretmenin dağılımını eşleştirmeye çalışır)
- RLHF (KL cezası, ince ayarlı modeli temel modele yakın tutar)
- Politika gradient yöntemleri (ilke güncellemelerini kısıtlama)

### Wasserstein Mesafesi (Dünya Taşıyıcısının Mesafesi)

Wasserstein mesafesi, bir olasılık dağılımını diğerine dönüştürmek için gereken minimum "iş"i ölçer. Bunu şu şekilde düşünün: Eğer dağılımlardan biri bir toprak yığını, diğeri ise bir delikse, ne kadar kiri ve ne kadar uzağa taşımanız gerekir?

```
W(P, Q) = inf over all transport plans gamma of E[d(x, y)]
```

1 boyutlu dağılımlar için, kümülatif dağılım fonksiyonlarının mutlak farkının integralini basitleştirir:

```
W_1(P, Q) = integral |CDF_P(x) - CDF_Q(x)| dx
```

Wasserstein neden önemlidir:
- Gerçek bir metriktir (simetrik, üçgen eşitsizliğini karşılar)
- Dağılımlar çakışmadığında bile gradient'leri sağlar (KL ıraksaması sonsuza gider)
- Bu özellik, orijinal GAN'ların eğitim istikrarsızlığını çözen Wasserstein GAN'ların (WGAN'ler) merkezi olmasını sağladı

```
Distributions with no overlap:

P: [1, 0, 0, 0, 0]    Q: [0, 0, 0, 0, 1]

KL divergence: infinity (log of zero)
Wasserstein: 4 (move all mass 4 bins)

Wasserstein gives a meaningful gradient. KL does not.
```

Wasserstein ne zaman kullanılır?
- GAN eğitimi (WGAN, WGAN-GP)
- Örtüşmeyebilecek dağılımların karşılaştırılması
- Optimum taşıma sorunları
- Görüntü alma (renk histogramlarını karşılaştırma)

### Neden Farklı Görevler Farklı Mesafelere İhtiyaç Duyar?

| Görev | En iyi mesafe | Neden |
|------|--------------|-----|
| Metin benzerliği | Kosinüs | Büyüklük gürültüdür, yön anlamdır |
| Resim piksel karşılaştırması | L2 | Mekansal ilişkiler önemlidir, özellikler karşılaştırılabilir ölçektedir |
| Seyrek yüksek loş özellikler | L1 | Sağlamdır, nadir görülen büyük farklılıkları artırmaz |
| Örtüşmeyi ayarla (etiketler, kategoriler) | Jaccard | Veriler doğal olarak belirlenmiş değere sahiptir, vektörel değildir |
| Dize eşleştirme | Mesafeyi düzenle | Operasyonlar insanın düzenleme sezgisine eşlenir |
| Aykırı değer tespiti | Mahalanobis | Özellik korelasyonları ve ölçekleri için hesaplar |
| Dağılımları karşılaştırma | KL farklılığı | Kaybolan bilgileri P yerine Q kullanarak ölçer |
| GAN eğitimi | Wasserstein | Dağıtımlar çakışmadığında bile gradient'ler sağlar |
| Embedding'ler (vektör DB) | Kosinüs veya nokta çarpımı | Embedding'ler anlamı yönde kodlamak için eğitilmiştir |
| Tavsiye | Nokta ürün | Büyüklük, popülerliği veya güveni kodlayabilir |
| DNA dizileri | Ağırlıklı düzenleme mesafesi | İkame maliyetleri nükleotid çiftine göre değişir |
| Üretim Kalite Kontrolü | L-sonsuz | Herhangi bir boyuttaki en kötü durum sapması önemlidir |

### Loss Function'lere bağlantı

Loss function'ler, tahminlere karşı hedeflere uygulanan mesafe fonksiyonlarıdır.

```
Loss function       Distance it uses       Behavior
MSE                 L2 squared             Penalizes large errors heavily
MAE                 L1                     Penalizes all errors equally
Huber loss          L1 for large errors,   Best of both: robust to outliers,
                    L2 for small errors    smooth gradient near zero
Cross-entropy       KL divergence          Measures distribution mismatch
Hinge loss          max(0, margin - d)     Only penalizes below margin
Triplet loss        L2 (typically)         Pulls positives close, pushes
                                           negatives away
Contrastive loss    L2                     Similar pairs close, dissimilar
                                           pairs beyond margin
```

### Düzenlemeye Bağlantı

Düzenleme, loss function'ye ağırlıklara bir norm cezası ekler.

```
L1 regularization (Lasso):   loss + lambda * ||w||_1
  -> Sparse weights. Some weights become exactly zero.
  -> Automatic feature selection.
  -> Solution has corners (non-differentiable at zero).

L2 regularization (Ridge):   loss + lambda * ||w||_2^2
  -> Small weights. All weights shrink toward zero.
  -> No feature selection (nothing goes to exactly zero).
  -> Smooth solution everywhere.

Elastic Net:                  loss + lambda_1 * ||w||_1 + lambda_2 * ||w||_2^2
  -> Combines sparsity of L1 with stability of L2.
  -> Groups of correlated features are kept or dropped together.
```

Neden L1 seyreklik üretiyor ama L2 üretmiyor: kısıtlama bölgesini 2 boyutlu ağırlık uzayında resmedin. L1 bir elmastır, L2 bir dairedir. loss function'nin konturları (elipsler) büyük olasılıkla bir ağırlığın sıfır olduğu bir köşede elmasa dokunacaktır. Çembere her iki ağırlığın da sıfır olmadığı düzgün bir noktada dokunuyorlar.

### En Yakın Komşu Arama

Her mesafe fonksiyonu bir en yakın komşu arama problemini ima eder: bir sorgu noktası verildiğinde dataset'deki en yakın noktaları bulun.

Tam en yakın komşu araması, d boyutlu n noktadan oluşan dataset'deki sorgu başına O(n * d)'dir. Büyük dataset'ler için bu çok yavaştır.

Yaklaşık En Yakın Komşu (ANN) algoritmaları, büyük hız kazanımları için küçük miktarda doğruluktan yararlanır:

```
Algorithm         Approach                      Used by
KD-trees          Axis-aligned space partition   scikit-learn (low-dim)
Ball trees        Nested hyperspheres            scikit-learn (medium-dim)
LSH               Random hash projections        Near-duplicate detection
HNSW              Hierarchical navigable         FAISS, Qdrant, Weaviate
                  small-world graph
IVF               Inverted file index with       FAISS (billion-scale)
                  cluster-based search
Product quant.    Compress vectors, search       FAISS (memory-constrained)
                  in compressed space
```

HNSW (Hiyerarşik Gezinilebilir Küçük Dünya), modern vector database'lerde baskın algoritmadır. Her düğümün yaklaşık en yakın komşularına bağlandığı çok katmanlı bir grafik oluşturur. Arama üst katmanda başlar (seyrek, uzun atlamalar) ve alt katmana (yoğun, kısa atlamalar) iner.

```figure
norm-unit-balls
```

## İnşa Et

### Adım 1: Tüm norm ve mesafe fonksiyonları

Uygulamanın tamamı için `code/distances.py`'ye bakın. Her fonksiyon yalnızca temel Python matematiği kullanılarak sıfırdan oluşturulmuştur.

### Adım 2: Aynı veriler, farklı mesafeler, farklı komşular

`distances.py`'deki demo bir dataset oluşturur, bir sorgu noktası seçer ve en yakın komşunun mesafe ölçüsüne bağlı olarak nasıl değiştiğini gösterir. L1 altında "en yakın" olan nokta, L2 veya kosinüs altında en yakın olmayabilir.

### Adım 3: Embedding benzerlik araması

Kod, kosinüs benzerliği ve L2 mesafesini kullanarak bir sorguya en benzer "belgeleri" bulan ve sıralamaların farklı olabileceğini gösteren sahte bir embedding benzerlik araması içerir.

## Kullan onu

En yaygın pratik kullanım: vector database'de benzer öğeleri bulmak.

```python
import numpy as np

def cosine_similarity_matrix(X):
    norms = np.linalg.norm(X, axis=1, keepdims=True)
    norms = np.where(norms == 0, 1, norms)
    X_normalized = X / norms
    return X_normalized @ X_normalized.T

embeddings = np.random.randn(1000, 768)

sim_matrix = cosine_similarity_matrix(embeddings)

query_idx = 0
similarities = sim_matrix[query_idx]
top_k = np.argsort(similarities)[::-1][1:6]
print(f"Top 5 most similar to item 0: {top_k}")
print(f"Similarities: {similarities[top_k]}")
```

`model.encode(text)`'yi arayıp ardından bir vector database aradığınızda, aslında olan budur. embedding modeli metni vektörlerle eşler. vector database, sorgu vektörünüz ile depolanan her vektör arasındaki kosinüs benzerliğini (veya nokta çarpımını) hesaplar ve bunların hepsini kontrol etmekten kaçınmak için YSA algoritmalarını kullanır.

## Egzersizler

1. (1, 2, 3) ile (4, 0, 6) arasındaki L1, L2 ve L-sonsuz uzaklıklarını hesaplayın. L-inf <= L2 <= L1'in her zaman herhangi bir nokta çifti için geçerli olduğunu doğrulayın. Bu siparişin neden garanti edildiğini kanıtlayın.

2. Kosinüs benzerliğinin yüksek (> 0,9) ancak L2 mesafesinin büyük (> 10) olduğu iki vektör oluşturun. Ne olduğunu geometrik olarak açıklayın. Daha sonra kosinüs benzerliğinin düşük (< 0,3) ancak L2 mesafesinin küçük (< 0,5) olduğu iki vektör oluşturun.

3. dataset ve bir sorgu noktası alan ve L1, L2, kosinüs ve Mahalanobis mesafesi altındaki en yakın komşuyu döndüren bir fonksiyon uygulayın. Dördünün de hangi noktanın en yakın olduğu konusunda anlaşamadığı bir dataset bulun.

4. CDF yöntemini kullanarak [0,5, 0,5, 0, 0] ile [0, 0, 0,5, 0,5] arasındaki Wasserstein mesafesini elle hesaplayın. Daha sonra bunu [0,25, 0,25, 0,25, 0,25] ile [0, 0, 0,5, 0,5] arasında hesaplayın. Hangisi daha büyük ve neden?

5. Yaklaşık Jaccard benzerliği için MinHash'ı uygulayın. 100 rastgele küme oluşturun, tüm çiftler için tam Jaccard'ı hesaplayın ve 50, 100 ve 200 karma işlevlerini kullanarak MinHash yaklaşımıyla karşılaştırın. Yaklaşım hatasını çizin.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|----------------------|
| Norm | "Bir vektörün boyutu" | Bir vektörü negatif olmayan bir skalerle eşleyen, üçgen eşitsizliğini, mutlak homojenliği ve yalnızca sıfır vektörü için sıfırı karşılayan bir işlev |
| L1 normu | "Manhattan mesafesi" | Mutlak bileşen değerlerinin toplamı. Optimizasyonda seyreklik yaratır. Aykırı değerlere karşı dayanıklı |
| L2 normu | "Öklid mesafesi" | Kareli bileşenlerin toplamının karekökü. Öklid uzayında düz çizgi mesafesi |
| Lp normu | "Genelleştirilmiş norm" | Mutlak bileşenlerin p'inci kuvvetlerinin toplamının p'inci kökü. L1 ve L2 özel durumlardır |
| L-sonsuz normu | "Maksimum norm" veya "Chebyshev mesafesi" | Maksimum mutlak bileşen değeri. p sonsuza yaklaşırken Lp'nin limiti |
| Kosinüs benzerliği | "Vektörler arasındaki açı" | Her iki büyüklükle normalleştirilmiş nokta çarpım. -1 ile +1 arasında değişir. Vektör uzunluğunu yok sayar |
| Kosinüs mesafesi | "1 eksi kosinüs benzerliği" | Kosinüs benzerliğini mesafeye dönüştürür. 0'dan 2'ye kadar aralıklar |
| Nokta ürün | "Normalleştirilmemiş kosinüs" | Bileşen bazında ürünlerin toplamı. Kosinüs benzerliği ile her iki büyüklüğün çarpımına eşittir |
| Mahalanobis mesafesi | "Korelasyona duyarlı mesafe" | Veri kovaryans matrisi kullanılarak beyazlatılmış (ilişkisizleştirilmiş ve normalleştirilmiş) bir alandaki L2 mesafesi |
| Jaccard benzerliği | "Çakışmayı ayarla" | Kesişme boyutu birleşim boyutuna bölünür. Kümeler için, vektörler için değil |
| Mesafeyi düzenle | "Levenstein mesafesi" | Bir dizeyi diğerine dönüştürmek için minimum ekleme, silme ve değiştirme işlemleri |
| KL farklılığı | "Dağıtımlar arasındaki mesafe" | Gerçek bir mesafe değil (simetrik değil). P'yi kodlamak için Q kullanımından kaynaklanan ekstra bitleri ölçer |
| Wasserstein mesafesi | "Toprak taşıyıcının mesafesi" | Kütleyi bir dağıtımdan diğerine taşımak için gereken minimum iş. Gerçek bir metrik |
| Yaklaşık en yakın komşu | "ANN araması" | Yaklaşık olarak en yakın noktaları kesin aramadan çok daha hızlı bulan algoritmalar (HNSW, LSH, IVF) |
| HNSW | "Vektör DB algoritması" | Hiyerarşik Gezinilebilir Küçük Dünya grafiği. Hızlı yaklaşık en yakın komşu araması için çok katmanlı grafik |
| L1 düzenlemesi | "Kement" | Kayba L1 normu ağırlıkların eklenmesi. Ağırlıkları sıfıra indirir (seyreklik) |
| L2 düzenlemesi | "Sırt" veya "ağırlık azalması" | Ağırlıkların kare L2 normunun kayba eklenmesi. Ağırlıkları seyreklik olmadan sıfıra doğru küçültür |
| Elastik Ağ | "L1 + L2" | L1 ve L2 düzenlemesini birleştirir. İlişkili özellik gruplarını tek başına olduğundan daha iyi yönetir |

## Daha Fazla Okuma

- [FAISS: Verimli Benzerlik Araması için Bir Kitaplık](https://github.com/facebookresearch/faiss) - Milyar ölçekli YSA araması için Meta'nın kitaplığı
- [Wasserstein GAN (Arjovsky ve diğerleri, 2017)](https://arxiv.org/abs/1701.07875) - Earth Mover'ın GAN'lara olan mesafesini tanıtan makale
- [Yerelliğe Duyarlı Karma (Indyk ve Motwani, 1998)](https://dl.acm.org/doi/10.1145/276698.276876) - temel YSA algoritması
- [Kelime Temsillerinin Verimli Tahmini (Mikolov ve diğerleri, 2013)](https://arxiv.org/abs/1301.3781) - Word2Vec, burada kosinüs benzerliği embedding'ler için varsayılan hale geldi
- [sklearn.neighbors belgeleri](https://scikit-learn.org/stable/modules/neighbors.html) - scikit-learn'de mesafe ölçümleri ve komşu algoritmaları için pratik kılavuz
