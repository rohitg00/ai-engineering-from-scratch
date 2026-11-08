# Normalar ve Uzaklıklar

> Mesafe fonksiyonunuz "aynı" ne anlama geldiğini belirler.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 1, Lessons 01 (Linear Algebra Intuition), 02 (Vectors, Matrices & Operations)
**Time:** ~90 minutes

## Öğrenme Hedefleri

- L1, L2, cosine, Mahalanobis, Jaccard uygulaması ve mesafe fonksiyonlarını sıfırdan düzenle
- Verilmiş bir ML görevi için uygun mesafe ölçüsünü seçin ve alternatiflerin neden başarısız olduğunu açıklayın
- L1 ve L2 normlarını LASSO ve Ridge düzenlenmesi ve geometrik kısıtlama bölgelerine bağlayın
- Aynı veri kümesinin farklı metrikler altında farklı en yakın komşuları nasıl ürettiğini göster

## Sorun

İki vektörünüz var. Belki de kelimeler yerleştirilmiştir. Belki de kullanıcı profilleri. Belki de piksel dizileri. Bilmeniz gereken şey: ne kadar yakınlar?

Cevap tamamen hangi mesafe fonksiyonuna bağlı. İki veri noktası bir metrik altında en yakın komşu olabilir ve diğerinde uzak olabilir. KNN sınıflandırıcınız, önerme motorunuz, vektör veritabanınız, gruplama algoritmanız, kayıp fonksiyonunuz - hepsi bu seçeneğe bağlı. Yanlış bir şey edin ve modeliniz yanlış bir şey için optimize olur.

En iyi evrensel mesafe yoktur. L2 uzay verileri için çalışır. Kosin benzerliği NLP'ye hakimdir. Jaccard setleri ele alıyor. Edit distance strings'i ele alıyor. Mahalanobis ilişkileri hesaplıyor. Wasserstein olasılık kütlesini hareket ettirir. Her biri " benzer " ne anlama geldiği hakkında farklı bir varsayımı kodlar.

Bu ders, her büyük mesafe fonksiyonunu sıfırdan inşa eder, her biri doğru araç olduğunda gösterir ve hangi metrik kullanıldığına bağlı olarak aynı verilerin en yakın komşuları tamamen farklı nasıl ürettiğini gösterir.

## Anlaşım

### Normalar: vektör büyüklüğünü ölçmek

Bir norm bir vektörün "ölümünü" ölçer. İki vektör arasındaki her mesafe fonksiyonu fark norm olarak yazılabilir:$d(a, b) = \lVert a - b \rVert$Yani normları anlamak mesafeleri anlamak demektir.

### L1 Norm (Manhattan mesafesi)

L1 normı tüm bileşenlerin mutlak değerlerini toplamaktadır.

```math
\lVert x \rVert_1 = |x_1| + |x_2| + \cdots + |x_n|
```

Manhattan mesafe adı veriliyor çünkü şehir şebekesinde ne kadar uzak yürüydüğünüzü ölçüyor.

```
Point A = (1, 1)
Point B = (4, 5)

L1 distance = |4-1| + |5-1| = 3 + 4 = 7

On a grid, you walk 3 blocks east and 4 blocks north.
```

L1 ne zaman kullanılır:
- Yüksek boyutlu nadir veriler (metin özellikleri, tek sıcak kodlamalar)
- Eğer katılık isteseydiniz (tek büyük bir fark baskın değildir)
- Özellik seçimi sorunları (L1 düzenlenmesi kısıtlılığı teşvik eder)

L1 düzenlenmesine bağlama (Lasso): ekleme $\lVert w \rVert_1$L1 cezası, ağırlık alanında elmas şeklinde kısıtlama bölgelerini oluşturur ve elmasların köşeleri bazı ağırlıkların sıfır olduğu eksellerde bulunur.

Kayıp fonksiyonlarına bağlantı: Ortalama mutlak hata (MAE) tahminler ve hedefler arasındaki ortalama L1 mesafedir. Tüm hataları doğrusal olarak cezalandırır ve MSE ile karşılaştırıldığında dış değerlere dayanıklı hale getirir.

### L2 Norm (Euklid mesafesi)

L2 normı düz çizgi mesafesi.

```math
\lVert x \rVert_2 = \sqrt{x_1^2 + x_2^2 + \cdots + x_n^2}
```

Bu geometri dersi boyunca öğrendiğin mesafedir.$n$boyutları.

```
Point A = (1, 1)
Point B = (4, 5)

L2 distance = sqrt((4-1)^2 + (5-1)^2) = sqrt(9 + 16) = sqrt(25) = 5.0

The straight line, cutting diagonally through the grid.
```

L2 ne zaman kullanılır:
- Düşük ve orta boyutlu sürekli veriler
- Özellik ölçekleri karşılaştırılabilir olduğunda
- Fiziksel mesafeler (yerel veriler, sensör okumaları)
- Piksel düzeyinde görüntü benzerliği

L2 düzenlenmesine bağlama (Ridge): ekleme $\lVert w \rVert_2^2$L1'den farklı olarak, ağırlıkları sıfıra doğru itmez. Tüm ağırlıkları sıfıra doğru oranla küçültür. L2 cezası döngü kısıtlama bölgelerini oluşturur, bu nedenle ekselerde köşeler yoktur.

Kayıp fonksiyonlarına bağlantı: Ortalama kare hata (MSE) L2 mesafelerinin ortalamasıdır.

```math
\begin{aligned}
\text{MAE (L1 loss):} \quad & |y - \hat{y}| && \text{Linear penalty. Robust to outliers.} \\
\text{MSE (L2 loss):} \quad & (y - \hat{y})^2 && \text{Quadratic penalty. Sensitive to outliers.}
\end{aligned}
```

### Lp Normalar: Genel aile

L1 ve L2 Lp normunun özel durumlarıdır:

```math
\lVert x \rVert_p = (|x_1|^p + |x_2|^p + \cdots + |x_n|^p)^{1/p}
```

 Farklı değerler$p$Farklı şekilli "birlik topları" üretir (başlangıçtan en fazla 1 mesafede bulunan tüm noktaların toplamı; aşağıdaki şekiller sınırlarıdır):

```
p=1:    Diamond shape      (corners on axes)
p=2:    Circle/sphere      (the usual round ball)
p=3:    Superellipse       (rounded square)
p=inf:  Square/hypercube   (flat sides along axes)
```

### L- sonsuzluk Norm (Chebyshev mesafe)

- Evet .$p$Sonsuzluk yaklaşırsa, Lp normı maksimum mutlak bileşenine yaklaşıyor.

```math
\lVert x \rVert_\infty = \max(|x_1|, |x_2|, \ldots, |x_n|)
```

İki nokta arasındaki mesafe en çok farklı oldukları tek boyutla belirlenir.

```math
\begin{aligned}
\text{Point } A &= (1, 1) \\
\text{Point } B &= (4, 5) \\[6pt]
L_\infty \text{ distance} &= \max(|4-1|, |5-1|) = \max(3, 4) = 4
\end{aligned}
```

L- Infinity ne zaman kullanılır:
- En kötü durumdaki herhangi bir boyutta sapma önemli olduğunda
- Oyun tahtası (şekerdeki bir kral L- sonsuzlukta hareket eder: herhangi bir yöne bir adım maliyet 1)
- Üretim toleransları (her boyut spesifikasyon içerisinde olmalıdır)

### Kosin benzerliği ve Kosin mesafesi

Kosinus benzerliği, iki vektör arasındaki açıyı ölçer ve büyüklüklerini görmezden gelir.

```math
\text{cos\_sim}(a, b) = \frac{a \cdot b}{\lVert a \rVert_2 \, \lVert b \rVert_2}
```

-1 (karşı yönler) ile +1 (aynı yön) arasında değişir. Döksel vektörler 0'da cosine benzerliği vardır.

Kosinus mesafe onu bir mesafeye dönüştürür: cosine_distance = 1 - cosine_semblarity. Bu 0 (tıpkı aynı yönde) ile 2 (karşı yönde) arasında değişir.

```math
\begin{aligned}
& a = (1, 0) \qquad b = (1, 1) \\[6pt]
& \text{cos\_sim} = \frac{1 \cdot 1 + 0 \cdot 1}{1 \cdot \sqrt{2}} = \frac{1}{\sqrt{2}} = 0.707 \\
& \text{cos\_dist} = 1 - 0.707 = 0.293
\end{aligned}
```

Neden cosine NLP ve yerleşimlerde egemenlik gösterir: metinde, belge uzunluğu benzerliği etkilememeli. Kediler hakkında iki kat daha uzun bir belge hala "böyle" olmalıdır. Kosin benzerliği büyüklüğü (uzunluğu) görmezden gelir ve sadece yönü önemsiyor. Aynı kelime dağılımına sahip ama farklı uzunluklara sahip iki belge aynı yönde işaret eder ve cosine benzerliği 1.0 elde eder.

Kosinus benzerliği ne zaman kullanılır:
- Metin benzerliği (TF-IDF vektörleri, kelime yerleştirmeleri, cümle yerleştirmeleri)
- Büyüklüğü gürültü ve yönü sinyal olduğu herhangi bir alan
- Önerme sistemleri (kullanıcı tercih vektörleri)
- Embedding search (vektor veritabanları neredeyse her zaman cosine veya nokta ürünü kullanır)

### Dot Ürün Benliği vs. Kosin Benliği

İki vektörün nokta ürünü:

```math
\begin{aligned}
a \cdot b &= a_1 b_1 + a_2 b_2 + \cdots + a_n b_n \\
&= \lVert a \rVert \, \lVert b \rVert \cos(\text{angle})
\end{aligned}
```

Kosin benzerliği, her iki büyüklükten normalleştirilen nokta ürünüdür. Her iki vektör zaten birim normalleştirildiğinde (büyüklük = 1), nokta ürünü ve kozine benzerliği aynıdır.

```math
\text{If } \lVert a \rVert = 1 \text{ and } \lVert b \rVert = 1: \quad a \cdot b = \cos(\text{angle between } a \text{ and } b)
```

Farklı olduğunda: nokta ürünü büyüklük bilgisini içerir. Daha büyük büyüklükteki bir vektör daha yüksek nokta ürünü puanını alır. Bu, "popüler" öğelerin daha yüksek sıraya yer almasını istediğiniz bazı çekim sistemlerinde önemlidir. Büyüklük içeren bir kalite veya önem sinyali olarak hareket eder.

```
a = (3, 0)    b = (1, 0)    c = (0, 1)

dot(a, b) = 3     dot(a, c) = 0
cos(a, b) = 1.0   cos(a, c) = 0.0

Both agree on direction, but dot product also reflects magnitude.
```

İşlemde:
- Temiz yönlü benzerlik istediğinizde cosine benzerliği kullanın
- Büyüklükler anlamlı bilgi taşıdığında nokta ürünü kullanın
- Pek çok vektör veritabanı (Pinecone, Weaviate, Qdrant) bunlar arasında seçim yapmanızı sağlar
- Eğer yerleşimleriniz L2 normalleşmişse, seçim önemi yoktur.

### Mahalanobis Uzaklığı

Euclidean mesafe tüm boyutları eşit şekilde değerlendirir ama özellikleriniz ilişkili veya farklı ölçeklere sahipse L2 yanıltıcı sonuçlar verir.

Mahalanobis mesafesinin verilerin kovarians yapısını hesaplaması.

```math
d_M(x, y) = \sqrt{(x - y)^T S^{-1} (x - y)}
```

nerede$S$verilerin kovarians matrisi.

İnsüütüel olarak: Mahalanobis mesafe önce verileri dekorele eder ve normalleştirir (beyazlama), sonra bu dönüştürülen alanın L2 mesafesini hesaplar.$S$Mahalanobis mesafesinin, kimlik matrisi (korreli olmayan, birim varyans özellikleri) olarak, Euclidean mesafeye indirgenmesi.

```
Example: height and weight are correlated.
Someone 6'2" and 180 lbs is not unusual.
Someone 5'0" and 180 lbs is unusual.

Euclidean distance might say they are equally far from the mean.
Mahalanobis distance correctly identifies the second as an outlier
because it accounts for the height-weight correlation.
```

Mahalanobis mesafesini ne zaman kullanmalısınız:
- Eksi belirleme (mahalanobi ortalamadan büyük bir mesafesi olan noktalar eksi belirlenir)
- Özellikler farklı ölçeklere ve korelasyonlara sahip olduğunda sınıflandırma
- Güvenilir bir kovariansa matrisini tahmin etmek için yeterli verilere sahip olduğunuzda
- Üretimdeki kalite kontrolü (çok değişken süreç izleme)

### Jaccard Benzerliği (seti için)

Jaccard benzerlik ölçüleri iki set arasında örtüşmektedir.

```math
J(A, B) = \frac{|A \cap B|}{|A \cup B|}
```

0 (tıpkı birer set gibi) ile 1 (tıpkı birer set gibi) arasında değişir.

```
A = {cat, dog, fish}
B = {cat, bird, fish, snake}

Intersection = {cat, fish}         size = 2
Union = {cat, dog, fish, bird, snake}  size = 5

Jaccard similarity = 2/5 = 0.4
Jaccard distance = 0.6
```

Jaccard ne zaman kullanılır:
- Etiket, kategoriler veya özellikler gruplarını karşılaştırmak
- Sözcük varlığına (sırıncı değil) dayalı belge benzerliği
- Yaklaşık çiftleme tespit (Jaccard'ın MinHash yaklaşımı)
- İkili özellik vektörlerini karşılaştırmak (oluş/olmaması verileri)
- Değerlendirme segmentasyon modelleri (Bölçme Ülke = Jaccard)

### Edit Distance (Levenshtein Distance)

Düzenleme mesafesinin bir dizeyi diğerine dönüştürmek için gerekli olan en az tek karakterli işlem sayısını saymasıdır.

```
"kitten" -> "sitting"

kitten -> sitten  (substitute k -> s)
sitten -> sittin  (substitute e -> i)
sittin -> sitting (insert g)

Edit distance = 3
```

Dinamik programlama kullanarak hesaplanmıştır.$(i, j)$ilk edit arasındaki mesafe $i$A ve birinci harflerin karakterleri $j$B. dizinin karakterleri.

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

Düzenleme mesafesini ne zaman kullanılır:
- İletişim kontrolü ve düzeltme
- DNA sırası düzeltmesi (vezli işlemlerle)
- Sızıntılı ip eşleşimi
- Kafasız metin verilerinin kopyalanması

### KL Dönüşüm (uzaklık değil, aynı şekilde kullanılır)

KL farklılığı, bir olasılık dağılımının diğerinden nasıl farklı olduğunu ölçer. Ders 09, ancak bu tartışmaya dahil olur çünkü insanlar bir olmamasına rağmen "uzaktan" olarak kullanırlar.

```math
D_{KL}(P \,\|\, Q) = \sum_x p(x) \log\frac{p(x)}{q(x)}
```

Kritik özellik: KL farklılığı simetrik değildir.

```math
D_{KL}(P \,\|\, Q) \ne D_{KL}(Q \,\|\, P)
```

Bu, mesafe metrikinin temel gerekçesiyle karşılanmıyor, üçgen eşitsizliğini de tatmin etmiyor, bu bir mesafe değil bir farklılık.

KL ' den ileriye$(D_{KL}(P \Vert Q))$"Anlam aramak": $Q$$P$- Evet .
KL ' i tersine çevir$(D_{KL}(Q \Vert P))$"modu aramak": $Q$Tek bir mod üzerinde odaklanır.$P$- Evet .

KL'nin farklılığını gördüğünüzde:
- VAEs (ELBO'daki KL terimi, gizli dağılımları bir öncekiye doğru itiyor)
- Bilgi destilasyonu (öğrenci öğretmenin dağıtımına eşlik etmeye çalışır)
- RLHF (KL cezası, ince ayarlanmış modeli temel modelin yakınında tutar)
- Politika gradiyenti yöntemleri (sastırma politika güncelleştirmeleri)

### Wasserstein Mesafe (Dünya Hareketçisinin Mesafe)

Wasserstein mesafesinin ölçüsü, bir olasılık dağılımını diğerine dönüştürmek için gereken en az "iş"in ölçülmesidir.

```math
W(P, Q) = \inf_{\gamma} \mathbb{E}[d(x, y)] \quad \text{(over all transport plans } \gamma\text{)}
```

1D dağılımlar için, kumületif dağılım fonksiyonlarının mutlak farkının entegraline basitleştirir:

```math
W_1(P, Q) = \int |\text{CDF}_P(x) - \text{CDF}_Q(x)| \, dx
```

Wasserstein neden önemli:
- Gerçek bir metriktir (simetrik, üçgen eşitsizliğini tatmin eder)
- Paylaşımlar üst üste geçmediğinde bile gradient sağlar (KL farklılığı sonsuzluğa gider)
- Bu özellik, orijinal GAN'ların eğitim dengesizliğini çözen Wasserstein GAN'larının (WGAN) merkezi haline getirdi.

```
Distributions with no overlap:

P: [1, 0, 0, 0, 0]    Q: [0, 0, 0, 0, 1]

KL divergence: infinity (log of zero)
Wasserstein: 4 (move all mass 4 bins)

Wasserstein gives a meaningful gradient. KL does not.
```

Wasserstein ne zaman kullanılır:
- GAN eğitim (WGAN, WGAN-GP)
- Birbiriyle örtüşmeyebilecek dağılımları karşılaştırmak
- Optimal ulaşım sorunları
- Resim geri alımı (renk histogramlarını karşılaştırmak)

### Farklı Görevlerin Neden Farklı Mesajlara Gerekli Olduğunu

| Task | Best distance | Why |
|------|--------------|-----|
| Text similarity | Cosine | Magnitude is noise, direction is meaning |
| Image pixel comparison | L2 | Spatial relationships matter, features are comparable scale |
| Sparse high-dim features | L1 | Robust, does not amplify rare large differences |
| Set overlap (tags, categories) | Jaccard | Data is naturally set-valued, not vectorial |
| String matching | Edit distance | Operations map to human editing intuition |
| Outlier detection | Mahalanobis | Accounts for feature correlations and scales |
| Comparing distributions | KL divergence | Measures information lost by using $Q$ instead of $P$ |
| GAN training | Wasserstein | Provides gradients even when distributions do not overlap |
| Embeddings (vector DB) | Cosine or dot product | Embeddings are trained to encode meaning in direction |
| Recommendation | Dot product | Magnitude can encode popularity or confidence |
| DNA sequences | Weighted edit distance | Substitution costs vary by nucleotide pair |
| Manufacturing QC | L-infinity | Worst-case deviation in any dimension matters |

### Kayıp fonksiyonlarla bağlantı

Kayıp fonksiyonları, tahminlere vs. hedeflere uygulanan mesafe fonksiyonlarıdır.

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

### Düzenlenme ile bağlantı

Düzenlendirme, kayıp fonksiyonuna ağırlıklarda norm cezası ekler.

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

L1 neden kısıtlama üretir ama L2 neden üretmez: 2 boyutlu bir ağırlık alanında kısıtlama bölgesini görüntüleyin. L1 bir elmas, L2 bir daire. Kayıp fonksiyonunun konturları (ellipseleri) bir köşede elması en çok dokunabilir, burada bir ağırlık sıfırdır.

### En Yakın Komşunu Aramak

Her mesafe işlevi en yakın komşu arama sorunu anlamına gelir: sorgu noktasını vererek, bir veri kümesindeki en yakın noktaları bul.

En yakın komşu aramaları .$O(n \cdot d)$ bir veri kümesindeki sorguya göre$n$$d$Büyük veri kümeleri için bu çok yavaş.

Yaklaşık En Yakın Komşu (ANN) algoritmaları büyük hız kazanımları için küçük miktarda doğruluk ticareti:

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

HNSW (Hiyerarşik Yürüyen Küçük Dünya) modern vektör veritabanlarında baskın algoritmadır. Her düğümün en yakın komşularına bağlandığı çok katmanlı bir grafik oluşturur. Arama üst katmandan başlar (sparse, long jumps) ve alt katmana (dense, short jumps) iner.

```figure
norm-unit-balls
```

## Yapın

### Adım 1: Tüm norm ve mesafe fonksiyonları

Bakın .`code/distances.py`Bu işlemler, Python'un temel matematiklerini kullanarak tamamlanmıştır.`code/distances.ts`Aynı fonksiyon ve demo ile bir TypeScript portu.

### Adım 2: Aynı veriler, farklı mesafeler, farklı komşular

Demo ' nun varlığı .`distances.py`L1 altında "en yakın" olan nokta L2 veya cosine altında en yakın olmayabilir.

### Adım 3: Benzerlik arayışı yerleştir

Kod, bir soruya en benzer "belgeler" i bulmaya yönelik benzerlik arama simgesel bir gömleği içerir. Bu sorgu, sıralamanın farklı olabileceğini gösterir.

## Kullan

En yaygın pratik kullanım: vektör veritabanında benzer öğeleri bulmak.

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

Aradığın zaman .`model.encode(text)`Vectör veritabanı, sorgu vektörünüzle tüm depolanmış vektörler arasında cosine benzerliği (veya nokta ürünü) hesaplar ve hepsini kontrol etmemek için ANN algoritmaları kullanır.

## Egzersizler

1. (1, 2, 3) ve (4, 0, 6) arasındaki L1, L2 ve L- sonsuzluk mesafelerini hesaplayın.$L_\infty \le L_2 \le L_1$Bu sipariş neden garantili olduğunu kanıtlayın.

2. İki vektör oluşturmak, burada kozin benzerliği yüksek (> 0,9) ama L2 mesafe büyük (> 10). Geometri olarak ne olduğunu açıklayın.

3. Bir veri kümesi ve bir sorgu noktasını alan ve L1, L2, cosine ve Mahalanobis mesafesinin altında en yakın komşunu geri veren bir fonksiyon uygulayın.

4. CDF yöntemi kullanarak [0,5, 0,5, 0,0] ve [0, 0, 0,5, 0,5] arasındaki Wasserstein mesafesini elle hesaplayın.

5. Yaklaşık Jaccard benzerliği için MinHash uygulayın. 100 rastgele set oluşturun, tüm çiftler için tam Jaccard hesaplayın ve 50, 100 ve 200 hash fonksiyonlarını kullanarak MinHash yaklaşımıyla karşılaştırın. Yaklaşım hatasını çizin.

### İpuçlar

**Exercise 1.**Fark vektörü (-3, 2, -3), bu yüzden o vektörün üç normunu hesapla `l1_norm`- Evet .`l2_norm`ve`linf_norm`Kanıt için en büyüklerini karşılaştırın.$\lvert d_i \rvert$ve toplamı mutlak değerlerin toplamının karesine karşılaştırın.

**Exercise 2.**Kosin benzerliği uzunluğu görmezden gelir, bu nedenle neredeyse aynı yönde işaret eden iki vektörle başlayın ve onlardan birini çok daha uzun yapın. İkinci durumda, farklı yönlerde işaret eden köken yakınında iki kısa vektör kullanın, sonra her iki koşulı kontrol edin `cosine_similarity`ve `l2_distance`- Evet .

**Exercise 3.**Arama .`find_nearest_neighbor(query, dataset, distance_fn)`Her biri için bir kez .`l1_distance`- Evet .`l2_distance`- Evet .`cosine_distance`ve`mahalanobis_distance`- Evet .`demo_different_neighbors`Metriklerin anlaşılmadığı bir veri kümesi gösterir, önce okuyun ve dört yanıtın da farklılaşana kadar noktaları değiştirin.

**Exercise 4.**Her dağılımın toplam toplamını yazın, sonra iki toplam toplamın mutlak farklarını ekleyin.`wasserstein_1d(p, q)`, sonra büyük değerin olasılık kütlesi ne kadar uzakta hareket etmesi gerektiğini açıklayın.

**Exercise 5.**Her bir hash fonksiyonu için, bir setin MinHash imzası, elementlerinin üzerindeki en az hash değeri ve iki setin aynı en az tahminleri aldığı hash fonksiyonlarının bölümü olarak Jaccard benzerliklerini tahmin eder.`jaccard_similarity`Bu hata yaklaşık olarak $1/\sqrt{k}$için$k$hash fonksiyonları.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|----------------|----------------------|
| Norm | "Size of a vector" | A function that maps a vector to a non-negative scalar, satisfying triangle inequality, absolute homogeneity, and zero only for the zero vector |
| L1 norm | "Manhattan distance" | Sum of absolute component values. Produces sparsity in optimization. Robust to outliers |
| L2 norm | "Euclidean distance" | Square root of sum of squared components. The straight-line distance in Euclidean space |
| Lp norm | "Generalized norm" | The $p$-th root of the sum of $p$-th powers of absolute components. L1 and L2 are special cases |
| L-infinity norm | "Max norm" or "Chebyshev distance" | The maximum absolute component value. The limit of Lp as $p$ approaches infinity |
| Cosine similarity | "Angle between vectors" | Dot product normalized by both magnitudes. Ranges from -1 to +1. Ignores vector length |
| Cosine distance | "1 minus cosine similarity" | Converts cosine similarity to a distance. Ranges from 0 to 2 |
| Dot product | "Unnormalized cosine" | Sum of component-wise products. Equals cosine similarity times both magnitudes |
| Mahalanobis distance | "Correlation-aware distance" | L2 distance in a space that has been whitened (decorrelated and normalized) using the data covariance matrix |
| Jaccard similarity | "Set overlap" | Size of intersection divided by size of union. For sets, not vectors |
| Edit distance | "Levenshtein distance" | Minimum insertions, deletions, and substitutions to transform one string into another |
| KL divergence | "Distance between distributions" | Not a true distance (not symmetric). Measures extra bits from using $Q$ to encode $P$ |
| Wasserstein distance | "Earth mover's distance" | Minimum work to transport mass from one distribution to another. A true metric |
| Approximate nearest neighbor | "ANN search" | Algorithms (HNSW, LSH, IVF) that find approximately closest points much faster than exact search |
| HNSW | "The vector DB algorithm" | Hierarchical Navigable Small World graph. Multi-layer graph for fast approximate nearest neighbor search |
| L1 regularization | "Lasso" | Adding the L1 norm of weights to the loss. Drives weights to zero (sparsity) |
| L2 regularization | "Ridge" or "weight decay" | Adding the squared L2 norm of weights to the loss. Shrinks weights toward zero without sparsity |
| Elastic Net | "L1 + L2" | Combines L1 and L2 regularization. Handles correlated feature groups better than either alone |

## Daha Fazla Okumak

- [FAISS: A Library for Efficient Similarity Search](https://github.com/facebookresearch/faiss)- Meta'nın milyarlık ANN arama kütüphanesi
- [Wasserstein GAN (Arjovsky et al., 2017)](https://arxiv.org/abs/1701.07875)- Dünya Hareketçisinin mesafesini GAN'lara tanıtan kağıt.
- [Locality-Sensitive Hashing (Indyk & Motwani, 1998)](https://dl.acm.org/doi/10.1145/276698.276876)- ANN algoritması
- [Efficient Estimation of Word Representations (Mikolov et al., 2013)](https://arxiv.org/abs/1301.3781)- Word2Vec, burada cosine benzerliği yerleşimler için varsayılan oldu
- [sklearn.neighbors documentation](https://scikit-learn.org/stable/modules/neighbors.html)- Sikit-learn'da mesafe ölçümleri ve komşu algoritmaları için pratik rehber
