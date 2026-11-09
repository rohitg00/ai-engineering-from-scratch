# Özellik Mühendisliği ve Seçim

> İyi bir özellik bin veri noktasına değer.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 1 (Statistics for ML, Linear Algebra), Phase 2 Lessons 1-7
**Time:** ~90 minutes

## Öğrenme Hedefleri

- Sayısal dönüşümleri uygulayın (standartlama, minimum maksimum ölçekleme, log dönüşümü, binning) ve her biri ne zaman uygun olduğunu açıklayın
- Kategorik özellikler için tek sıcak, etiket ve hedef kodlama oluşturun ve hedef kodlama sırasında veri sızma riskini belirleyin
- TF-IDF vektörlüğünü sıfırdan inşa edin ve metin sınıflandırması için çiğ kelime sayısını neden üstlendiğini açıklayın
- Boyutlandırmayı azaltmak için filtre tabanlı özellik seçimi (varians eşiği, korelasyon, karşılıklı bilgi) uygulanır

## Sorun

Verileriniz var. Bir algoritma seçersiniz. Eğitim veriyorsunuz. Sonuçlar ortalama. Daha şık bir algoritma denersiniz. Yine de ortalama. Bir hafta hiperparametre ayarlamayı geçiriyorsunuz.

Sonra birisi çiğ verileri daha iyi özelliklere dönüştürür ve basit bir lojistik geri dönüş, ayarlanmış gradient güçlendirilmiş ansamblinizi yenir.

Bu sürekli olarak gerçekleşir. Klasik ML'de, verilerin temsil edilmesi algoritmanın seçimine göre daha önemlidir. "Sıkere görüntü" ve "yataq odaları sayısı" ile bir ev fiyat modeli öğrencinin ne kadar karmaşık olmasına rağmen "başlangıçlı bir ip olarak" bir modelden daha üstün olacaktır. Algoritm sadece verdiğiniz ile çalışabilir.

Özellik mühendisliği, modellerin kalıpları bulmakta daha kolay hale getiren ham verileri temsillere dönüştürme sürecidir. Özellik seçimi, sinyal eklemeden gürültü ekleyen özellikleri atma sürecidir.

## Anlaşım

### Özellik Pipeline

```mermaid
flowchart LR
    A[Raw Data] --> B[Handle Missing Values]
    B --> C[Numerical Transforms]
    B --> D[Categorical Encoding]
    B --> E[Text Features]
    C --> F[Feature Interactions]
    D --> F
    E --> F
    F --> G[Feature Selection]
    G --> H[Model-Ready Data]
```

### Sayısal Özellikler

Çiğ rakamlar nadiren model hazırdır.

**Scaling:**Özellikleri aynı aralıkta koyun, böylece mesafe tabanlı algoritmalar (K-Means, KNN, SVM) tüm özellikleri eşit şekilde değerlendirir. Min-max ölçekleme haritaları [0, 1]. Standartlama (z-not) haritaları ortalama = 0, std = 1.

**Log transform:**Sağdaki dağılımları (gıda, nüfus, kelime sayıları) sıkıştırır.

**Binning:**Sürekli değerleri kategorilere dönüştürür. Özellik ve hedef arasındaki ilişki doğrusal değil ancak adımlarsal olduğunda yararlıdır (örneğin, yaş grupları).

**Polynomial features:**Yaratır $x^2$- Evet .$x^3$- Evet .$x_1 x_2$Düzsel modeller daha fazla özelliğin bedeliyle çizgi olmayan ilişkileri yakalar.

### Kategori Özellikleri

Modellerin sayılara, kategorilerin kodlanmasına ihtiyacı var.

**One-hot encoding:**Her kategori için ikili bir sütun oluşturur. "color = red/blue/green" üç sütun haline gelir: is_red, is_blue, is_green. Düşük kardinallik özellikleri için iyi çalışır, ancak birçok kategori ile patlar.

**Label encoding:**Her kategorinin bir tam sayıya yerleştirilmesini çiz: kırmızı = 0, mavi = 1, yeşil = 2. Yanlış bir sıralama içeriyor (model yeşil > mavi > kırmızı düşünebilir). Sadece bireysel değerlere bölünen ağaç tabanlı modeller için uygundur.

**Target encoding:**Her kategoriyi bu kategori için hedef değişkenin ortalamasıyla değiştirir. Güçlü ama tehlikeli: veri sızma riski yüksek. Sadece eğitim verileri üzerine hesaplanmalı ve test verilerine uygulanmalıdır.

### Metin Özellikleri

**Count vectorizer:**Bir belgede her kelime kaç kez göründüğünü sayar. " kedi çarşafta oturuyordu " {: 2, kedi: 1, sat: 1, on: 1, mat: 1 } olur.

**TF-IDF:**"Frequency-Inverse Document Frequency" terimi. Sözcüklerin farklılıklarına göre ağırlanır. "the" gibi yaygın kelimeler düşük ağırlık kazanır. Nadir, ayırt edici kelimeler yüksek ağırlık kazanır.

```math
\begin{aligned}
\text{TF}(\text{word}, \text{doc}) &= \frac{\text{count(word in doc)}}{\text{total words in doc}} \\
\text{IDF}(\text{word}) &= \log \frac{\text{total docs}}{\text{docs containing word}} \\
\text{TF-IDF} &= \text{TF} \cdot \text{IDF}
\end{aligned}
```

### Kayıp Değerler

Gerçek verilerde boşluklar var.

- **Drop rows:**Kayıp veriler nadir ve rastgele olduğunda
- **Mean/median imputation:**Basit, özelliğin merkezini korur (ortalama daha sağlamdır), ancak varyansiyonunu küçültürür ve her doldurulmuş değeri bir pikte yığar, böylece dağılım şekli değişir
- **Mode imputation:**Kategorik özellikler için
- **Indicator column:**İletişimden önce "was_this_missing" ikili bir sütunu ekleyin. Verilerin eksik olduğu gerçeği kendisi bilgi vericidir
- **Forward/backward fill:**Zaman dizisi verileri için

### Özellikler etkileşimi

Bazen ilişki kombinasyonda. "Yükseklik" ve "kozluk" tek başına daha az öngörücüdür.$\text{BMI} = \text{weight} / \text{height}^2$Özellik etkileşimleri özellik alanını çoğaltır, bu yüzden doğru olanı seçmek için alan bilgisini kullanın.

### Özellik Seçimi

Daha fazla özellik her zaman daha iyi değildir.

**Filter methods (pre-model):**
- İlişki: birbirine çok ilişkili olan özellikleri kaldırın (çıkıcı)
- Karşılıklı bilgi: Bir özelliği bilmek, hedef hakkında belirsizlikleri ne kadar azaltacağını ölçer
- Değişiklik eşiği: az değişen özellikleri kaldır

**Wrapper methods (model-based):**
- L1 düzenlenmesi (Lasso): İlişkin olmayan özellik ağırlıklarını tam olarak sıfıra çıkarır
- Tekrarlı özelliklerin ortadan kaldırılması: tren, en az önemli özellikleri kaldırmak, tekrar etmek

**Why selection matters:**10 iyi özellikli bir model genellikle 10 iyi özellikli ve 90 gürültülü bir modelden daha iyi performans gösterecektir.

```figure
feature-scaling
```

## Yapın

### Adım 1: Sayı sıfırdan dönüştürülür

```python
import math


def min_max_scale(values):
    min_val = min(values)
    max_val = max(values)
    if max_val == min_val:
        return [0.0] * len(values)
    return [(v - min_val) / (max_val - min_val) for v in values]


def standardize(values):
    n = len(values)
    mean = sum(values) / n
    variance = sum((v - mean) ** 2 for v in values) / n
    std = math.sqrt(variance) if variance > 0 else 1.0
    return [(v - mean) / std for v in values]


def log_transform(values):
    return [math.log(v + 1) for v in values]


def bin_values(values, n_bins=5):
    min_val = min(values)
    max_val = max(values)
    bin_width = (max_val - min_val) / n_bins
    if bin_width == 0:
        return [0] * len(values)
    result = []
    for v in values:
        bin_idx = int((v - min_val) / bin_width)
        bin_idx = min(bin_idx, n_bins - 1)
        result.append(bin_idx)
    return result


def polynomial_features(row, degree=2):
    n = len(row)
    result = list(row)
    if degree >= 2:
        for i in range(n):
            result.append(row[i] ** 2)
        for i in range(n):
            for j in range(i + 1, n):
                result.append(row[i] * row[j])
    return result
```

### Adım 2: Kategori kodlama sıfırdan

```python
def one_hot_encode(values):
    categories = sorted(set(values))
    cat_to_idx = {cat: i for i, cat in enumerate(categories)}
    n_cats = len(categories)

    encoded = []
    for v in values:
        row = [0] * n_cats
        row[cat_to_idx[v]] = 1
        encoded.append(row)

    return encoded, categories


def label_encode(values):
    categories = sorted(set(values))
    cat_to_int = {cat: i for i, cat in enumerate(categories)}
    return [cat_to_int[v] for v in values], cat_to_int


def target_encode(feature_values, target_values, smoothing=10):
    global_mean = sum(target_values) / len(target_values)

    category_stats = {}
    for feat, target in zip(feature_values, target_values):
        if feat not in category_stats:
            category_stats[feat] = {"sum": 0.0, "count": 0}
        category_stats[feat]["sum"] += target
        category_stats[feat]["count"] += 1

    encoding = {}
    for cat, stats in category_stats.items():
        cat_mean = stats["sum"] / stats["count"]
        weight = stats["count"] / (stats["count"] + smoothing)
        encoding[cat] = weight * cat_mean + (1 - weight) * global_mean

    return [encoding[v] for v in feature_values], encoding
```

### Adım 3: Tekst özellikleri sıfırdan

```python
def count_vectorize(documents):
    vocab = {}
    idx = 0
    for doc in documents:
        for word in doc.lower().split():
            if word not in vocab:
                vocab[word] = idx
                idx += 1

    vectors = []
    for doc in documents:
        vec = [0] * len(vocab)
        for word in doc.lower().split():
            vec[vocab[word]] += 1
        vectors.append(vec)

    return vectors, vocab


def tfidf(documents):
    n_docs = len(documents)

    vocab = {}
    idx = 0
    for doc in documents:
        for word in doc.lower().split():
            if word not in vocab:
                vocab[word] = idx
                idx += 1

    doc_freq = {}
    for doc in documents:
        seen = set()
        for word in doc.lower().split():
            if word not in seen:
                doc_freq[word] = doc_freq.get(word, 0) + 1
                seen.add(word)

    vectors = []
    for doc in documents:
        words = doc.lower().split()
        word_count = len(words)
        tf_map = {}
        for word in words:
            tf_map[word] = tf_map.get(word, 0) + 1

        vec = [0.0] * len(vocab)
        for word, count in tf_map.items():
            tf = count / word_count
            idf = math.log(n_docs / doc_freq[word])
            vec[vocab[word]] = tf * idf
        vectors.append(vec)

    return vectors, vocab
```

### Adım 4: Kayıp değer sıfırdan algılama

```python
def impute_mean(values):
    present = [v for v in values if v is not None]
    if not present:
        return [0.0] * len(values), 0.0
    mean = sum(present) / len(present)
    return [v if v is not None else mean for v in values], mean


def impute_median(values):
    present = sorted(v for v in values if v is not None)
    if not present:
        return [0.0] * len(values), 0.0
    n = len(present)
    if n % 2 == 0:
        median = (present[n // 2 - 1] + present[n // 2]) / 2
    else:
        median = present[n // 2]
    return [v if v is not None else median for v in values], median


def impute_mode(values):
    present = [v for v in values if v is not None]
    if not present:
        return values, None
    counts = {}
    for v in present:
        counts[v] = counts.get(v, 0) + 1
    mode = max(counts, key=counts.get)
    return [v if v is not None else mode for v in values], mode


def add_missing_indicator(values):
    return [0 if v is not None else 1 for v in values]
```

### Adım 5: Baştan başlayan özellik seçimi

```python
def correlation(x, y):
    n = len(x)
    mean_x = sum(x) / n
    mean_y = sum(y) / n
    cov = sum((xi - mean_x) * (yi - mean_y) for xi, yi in zip(x, y)) / n
    std_x = math.sqrt(sum((xi - mean_x) ** 2 for xi in x) / n)
    std_y = math.sqrt(sum((yi - mean_y) ** 2 for yi in y) / n)
    if std_x == 0 or std_y == 0:
        return 0.0
    return cov / (std_x * std_y)


def mutual_information(feature, target, n_bins=10):
    feat_min = min(feature)
    feat_max = max(feature)
    bin_width = (feat_max - feat_min) / n_bins if feat_max != feat_min else 1.0
    feat_binned = [
        min(int((f - feat_min) / bin_width), n_bins - 1) for f in feature
    ]

    n = len(feature)
    target_classes = sorted(set(target))

    feat_bins = sorted(set(feat_binned))
    p_feat = {}
    for b in feat_bins:
        p_feat[b] = feat_binned.count(b) / n

    p_target = {}
    for t in target_classes:
        p_target[t] = target.count(t) / n

    mi = 0.0
    for b in feat_bins:
        for t in target_classes:
            joint_count = sum(
                1 for fb, tv in zip(feat_binned, target) if fb == b and tv == t
            )
            p_joint = joint_count / n
            if p_joint > 0:
                mi += p_joint * math.log(p_joint / (p_feat[b] * p_target[t]))

    return mi


def variance_threshold(features, threshold=0.01):
    n_features = len(features[0])
    n_samples = len(features)
    selected = []

    for j in range(n_features):
        col = [features[i][j] for i in range(n_samples)]
        mean = sum(col) / n_samples
        var = sum((v - mean) ** 2 for v in col) / n_samples
        if var >= threshold:
            selected.append(j)

    return selected


def remove_correlated(features, threshold=0.9):
    n_features = len(features[0])
    n_samples = len(features)

    to_remove = set()
    for i in range(n_features):
        if i in to_remove:
            continue
        col_i = [features[r][i] for r in range(n_samples)]
        for j in range(i + 1, n_features):
            if j in to_remove:
                continue
            col_j = [features[r][j] for r in range(n_samples)]
            corr = abs(correlation(col_i, col_j))
            if corr >= threshold:
                to_remove.add(j)

    return [i for i in range(n_features) if i not in to_remove]
```

### Adım 6: Tam bir boru hattı ve demo

```python
import random


def make_housing_data(n=200, seed=42):
    random.seed(seed)
    data = []
    for _ in range(n):
        sqft = random.uniform(500, 5000)
        bedrooms = random.choice([1, 2, 3, 4, 5])
        age = random.uniform(0, 50)
        neighborhood = random.choice(["downtown", "suburbs", "rural"])
        has_pool = random.choice([True, False])

        sqft_with_missing = sqft if random.random() > 0.05 else None
        age_with_missing = age if random.random() > 0.08 else None

        price = (
            50 * sqft
            + 20000 * bedrooms
            - 1000 * age
            + (50000 if neighborhood == "downtown" else 10000 if neighborhood == "suburbs" else 0)
            + (15000 if has_pool else 0)
            + random.gauss(0, 20000)
        )

        data.append({
            "sqft": sqft_with_missing,
            "bedrooms": bedrooms,
            "age": age_with_missing,
            "neighborhood": neighborhood,
            "has_pool": has_pool,
            "price": price,
        })
    return data


if __name__ == "__main__":
    data = make_housing_data(200)

    print("=== Raw Data Sample ===")
    for row in data[:3]:
        print(f"  {row}")

    sqft_raw = [d["sqft"] for d in data]
    age_raw = [d["age"] for d in data]
    prices = [d["price"] for d in data]

    print("\n=== Missing Value Handling ===")
    sqft_missing = sum(1 for v in sqft_raw if v is None)
    age_missing = sum(1 for v in age_raw if v is None)
    print(f"  sqft missing: {sqft_missing}/{len(sqft_raw)}")
    print(f"  age missing: {age_missing}/{len(age_raw)}")

    sqft_indicator = add_missing_indicator(sqft_raw)
    age_indicator = add_missing_indicator(age_raw)
    sqft_imputed, sqft_fill = impute_median(sqft_raw)
    age_imputed, age_fill = impute_mean(age_raw)
    print(f"  sqft filled with median: {sqft_fill:.0f}")
    print(f"  age filled with mean: {age_fill:.1f}")

    print("\n=== Numerical Transforms ===")
    sqft_scaled = standardize(sqft_imputed)
    age_scaled = min_max_scale(age_imputed)
    sqft_log = log_transform(sqft_imputed)
    age_binned = bin_values(age_imputed, n_bins=5)
    print(f"  sqft standardized: mean={sum(sqft_scaled)/len(sqft_scaled):.4f}, std={math.sqrt(sum(v**2 for v in sqft_scaled)/len(sqft_scaled)):.4f}")
    print(f"  age min-max: [{min(age_scaled):.2f}, {max(age_scaled):.2f}]")
    print(f"  age bins: {sorted(set(age_binned))}")

    print("\n=== Categorical Encoding ===")
    neighborhoods = [d["neighborhood"] for d in data]

    ohe, ohe_cats = one_hot_encode(neighborhoods)
    print(f"  One-hot categories: {ohe_cats}")
    print(f"  Sample encoding: {neighborhoods[0]} -> {ohe[0]}")

    le, le_map = label_encode(neighborhoods)
    print(f"  Label encoding map: {le_map}")

    te, te_map = target_encode(neighborhoods, prices, smoothing=10)
    print(f"  Target encoding: {({k: round(v) for k, v in te_map.items()})}")

    print("\n=== Text Features ===")
    descriptions = [
        "large modern house with pool",
        "small cozy cottage near downtown",
        "spacious family home with large yard",
        "modern apartment downtown with view",
        "rustic cabin in rural area",
    ]
    cv, cv_vocab = count_vectorize(descriptions)
    print(f"  Vocabulary size: {len(cv_vocab)}")
    print(f"  Doc 0 non-zero features: {sum(1 for v in cv[0] if v > 0)}")

    tf, tf_vocab = tfidf(descriptions)
    print(f"  TF-IDF vocabulary size: {len(tf_vocab)}")
    top_words = sorted(tf_vocab.keys(), key=lambda w: tf[0][tf_vocab[w]], reverse=True)[:3]
    print(f"  Doc 0 top TF-IDF words: {top_words}")

    print("\n=== Polynomial Features ===")
    sample_row = [sqft_scaled[0], age_scaled[0]]
    poly = polynomial_features(sample_row, degree=2)
    print(f"  Input: {[round(v, 4) for v in sample_row]}")
    print(f"  Polynomial: {[round(v, 4) for v in poly]}")
    print(f"  Features: [x1, x2, x1^2, x2^2, x1*x2]")

    print("\n=== Feature Selection ===")
    feature_matrix = [
        [sqft_scaled[i], age_scaled[i], float(sqft_indicator[i]), float(age_indicator[i])]
        + ohe[i]
        for i in range(len(data))
    ]

    print(f"  Total features: {len(feature_matrix[0])}")

    surviving_var = variance_threshold(feature_matrix, threshold=0.01)
    print(f"  After variance threshold (0.01): {len(surviving_var)} features kept")

    surviving_corr = remove_correlated(feature_matrix, threshold=0.9)
    print(f"  After correlation filter (0.9): {len(surviving_corr)} features kept")

    binary_prices = [1 if p > sum(prices) / len(prices) else 0 for p in prices]
    print("\n  Mutual information with target:")
    feature_names = ["sqft", "age", "sqft_missing", "age_missing"] + [f"neigh_{c}" for c in ohe_cats]
    for j in range(len(feature_matrix[0])):
        col = [feature_matrix[i][j] for i in range(len(feature_matrix))]
        mi = mutual_information(col, binary_prices, n_bins=10)
        print(f"    {feature_names[j]}: MI={mi:.4f}")

    print("\n  Correlation with price:")
    for j in range(len(feature_matrix[0])):
        col = [feature_matrix[i][j] for i in range(len(feature_matrix))]
        corr = correlation(col, prices)
        print(f"    {feature_names[j]}: r={corr:.4f}")
```

## Kullan

Scikit-learn ile bu dönüşümler kompose edilebilir boru hattı:

```python
from sklearn.preprocessing import StandardScaler, OneHotEncoder, PolynomialFeatures
from sklearn.impute import SimpleImputer
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.feature_selection import mutual_info_classif, VarianceThreshold
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline

numeric_pipe = Pipeline([
    ("imputer", SimpleImputer(strategy="median")),
    ("scaler", StandardScaler()),
])

categorical_pipe = Pipeline([
    ("encoder", OneHotEncoder(sparse_output=False)),
])

preprocessor = ColumnTransformer([
    ("num", numeric_pipe, ["sqft", "age"]),
    ("cat", categorical_pipe, ["neighborhood"]),
])
```

Kitaplık sürümleri kenar durum yönetimi, nadir matris desteği ve boru hattı kompozisyonunu ekler, ancak matematik aynıdır.

## Gönder

Bu ders şunları ortaya çıkarır:
- `outputs/prompt-feature-engineer.md`- ham verilerden sistematik olarak mühendislik özellikleri için bir çağrı

## Egzersizler

1. Sayı dönüşümlerine güçlü ölçeklendirme (orta ve karartel aralığı ortalama ve standart sapma yerine kullanılarak) ekleyin.
2. Bir kaç hedef kodlamasını uygulayın: Her satır için, hedef değeri hariç hedef ortalamasını hesaplayın. Bu, naif hedef kodlamasına kıyasla aşırı uyumluluğu nasıl azaltır.
3. Değişiklik eşiği, korelasyon filtrasyonu ve karşılıklı bilgi sıralamasını birleştiren otomatik bir özellik seçimi borusu oluşturun.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|----------------|----------------------|
| Feature engineering | "Making new columns" | Transforming raw data into representations that expose patterns to the model |
| Standardization | "Making it normal" | Subtracting the mean and dividing by standard deviation so the feature has mean=0 and std=1 |
| One-hot encoding | "Making dummy variables" | Creating one binary column per category, where exactly one column is 1 for each row |
| Target encoding | "Using the answer to encode" | Replacing each category with the average target value for that category, with smoothing to prevent overfitting |
| TF-IDF | "Fancy word counts" | Term Frequency times Inverse Document Frequency: words weighted by how distinctive they are across the corpus |
| Imputation | "Filling in blanks" | Replacing missing values with estimated values (mean, median, mode, or model-predicted) |
| Feature selection | "Throwing out bad columns" | Removing features that add noise or redundancy, keeping only those with signal about the target |
| Mutual information | "How much one thing tells you about another" | A measure of the reduction in uncertainty about variable Y gained by observing variable X |
| Data leakage | "Accidentally cheating" | Using information during training that would not be available at prediction time, giving falsely optimistic results |

## Daha Fazla Okumak

- [Feature Engineering and Selection (Max Kuhn & Kjell Johnson)](http://www.feat.engineering/)- Özellik mühendisliği alanının tüm alanlarını kapsayan ücretsiz çevrimiçi kitap
- [scikit-learn Preprocessing Guide](https://scikit-learn.org/stable/modules/preprocessing.html)- Tüm standart dönüşümler için pratik referans
- [Target Encoding Done Right (Micci-Barreca, 2001)](https://dl.acm.org/doi/10.1145/507533.507538)- hedef kodlama ile ilgili orijinal kağıt
