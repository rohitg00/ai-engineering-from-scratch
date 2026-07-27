# Özellik Mühendisliği ve Seçimi

> İyi bir özellik bin veri noktasına bedeldir.

**Tür:** Yapım
**Diller:** Python
**Önkoşullar:** Aşama 1 (ML için İstatistik, Doğrusal Cebir), Aşama 2 Dersler 1-7
**Süre:** ~90 dakika

## Öğrenme Hedefleri

- Sayısal dönüşümleri (standartlaştırma, minimum-maksimum ölçeklendirme, log dönüşümü, gruplama) uygulayın ve her birinin uygun olduğunu açıklayın
- Kategorik özellikler için tek-etkin, etiket ve hedef kodlama oluşturun ve hedef kodlamada veri sızıntısı riskini belirleyin
- Sıfırdan bir TF-IDF vektörleştirici oluşturun ve bunun metin sınıflandırması için neden ham kelime sayısından daha iyi performans gösterdiğini açıklayın
- Boyutsallığı azaltmak için filtre tabanlı özellik seçimini (varyans eşiği, korelasyon, karşılıklı bilgi) uygulayın

## Sorun

Bir dataset'niz var. Bir algoritma seçersiniz. Onu eğitiyorsun. Sonuçlar vasat. Daha süslü bir algoritmayı denersiniz. Hala vasat. Hiperparametreleri ayarlamak için bir hafta harcıyorsunuz. Marjinal iyileşme.

Daha sonra birisi ham verileri daha iyi özelliklere dönüştürür ve basit bir lojistik regresyon, ayarlanmış gradient destekli topluluğunuzu geride bırakır.

Bu sürekli olur. Klasik ML'de verinin temsili algoritma seçiminden daha önemlidir. Öğrenci ne kadar bilgili olursa olsun, "metrekare" ve "yatak odası sayısı"na sahip bir ev fiyatı modeli, "ham dize olarak adres"e sahip bir modeli yenecektir. Algoritma yalnızca sizin verdiğinizle çalışabilir.

Özellik mühendisliği, ham verileri modellerin bulmasını kolaylaştıran temsillere dönüştürme sürecidir. Özellik seçimi, sinyal eklemeden gürültü ekleyen özelliklerin atılması işlemidir. Hepsi birlikte klasik makine öğrenimindeki en yüksek kaldıraçlı aktivitedir.

## Konsept

### Özellik İşlem Hattı

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

Ham sayılar nadiren modele hazırdır. Ortak dönüşümler:

**Ölçeklendirme:** Mesafeye dayalı algoritmaların (K-Ortalamalar, KNN, SVM) tüm özelliklere eşit şekilde yaklaşması için özellikleri aynı aralığa yerleştirin. Min-maks ölçeklendirme [0, 1] ile eşleşir. Standardizasyon (z-puanı) ortalama=0, std=1 ile eşleşir.

**Günlük dönüşümü:** Sağa çarpık dağılımları (gelir, nüfus, kelime sayısı) sıkıştırır. Çarpımsal ilişkileri toplamsal ilişkilere dönüştürür.

**Binning:** Sürekli değerleri kategorilere dönüştürür. Özellik ve hedef arasındaki ilişki doğrusal olmayıp adım adım olduğunda kullanışlıdır (e.g., yaş grupları).

**Polinom özellikleri:** x^2, x^3, x1*x2 terimlerini oluşturur. Doğrusal modellerin, daha fazla özellik pahasına doğrusal olmayan ilişkileri yakalamasına olanak tanır.

### Kategorik Özellikler

Modellerin sayılara ihtiyacı vardır. Kategorilerin kodlanması gerekir.

**Tek geçişli kodlama:** Her kategori için bir ikili sütun oluşturur. "renk = kırmızı/mavi/yeşil" üç sütuna dönüşür: is_red, is_blue, is_green. Düşük kardinaliteli özellikler için iyi çalışır ancak birçok kategoride patlama yapar.

**Etiket kodlaması:** Her kategoriyi bir tam sayıyla eşler: kırmızı=0, mavi=1, yeşil=2. Yanlış sıralamaya neden olur (model yeşil > mavi > kırmızıyı düşünebilir). Yalnızca bireysel değerlere bölünen ağaç tabanlı modeller için uygundur.

**Hedef kodlama:** Her kategoriyi, o kategoriye ait hedef değişkenin ortalamasıyla değiştirir. Güçlü ama tehlikeli: yüksek veri sızıntısı riski. Yalnızca eğitim verileri üzerinden hesaplanmalı ve test verilerine uygulanmalıdır.

### Metin Özellikleri

**Sayma vektörleştiricisi:** Her kelimenin bir belgede kaç kez göründüğünü sayar. "matın üzerine oturan kedi" {the: 2, cat: 1, sat: 1, on: 1, mat: 1} olur.

**TF-IDF:** Dönem Frekansı-Ters Belge Frekansı. Kelimeleri belgelerde ne kadar benzersiz olduklarına göre tartar. "The" gibi yaygın kelimelerin ağırlığı azalır. Nadir, ayırt edici kelimelerin ağırlığı artıyor.

```
TF(word, doc) = count(word in doc) / total words in doc
IDF(word) = log(total docs / docs containing word)
TF-IDF = TF * IDF
```

### Eksik Değerler

Gerçek verilerde delikler vardır. Stratejiler:

- **Satırları bırak:** Yalnızca eksik veriler nadir ve rastgele olduğunda
- **Ortalama/medyan ataması:** Basittir, dağılım şeklini korur (medyan aykırı değerlere karşı daha dayanıklıdır)
- **Mod ataması:** Kategorik özellikler için
- **Gösterge sütunu:** Atamadan önce "was_this_missing" ikili sütununu ekleyin. Verilerin eksik olduğu gerçeği başlı başına bilgilendirici olabilir
- **İleri/geri doldurma:** Zaman serisi verileri için

### Özellik Etkileşimi

Bazen ilişki kombinasyon halindedir. "Boy" ve "kilo" tek başına "BMI = ağırlık / boy^2"den daha az belirleyicidir. Özellik etkileşimleri özellik alanını çoğaltır; bu nedenle doğru olanları seçmek için alan bilgisini kullanın.

### Özellik Seçimi

Daha fazla özellik her zaman daha iyi değildir. Alakasız özellikler gürültüye neden olur, eğitim süresini artırır ve aşırı uyum sağlamaya neden olabilir.

**Filtre yöntemleri (ön model):**
- Korelasyon: birbiriyle yüksek düzeyde korelasyona sahip özellikleri kaldırın (fazlalık)
- Karşılıklı bilgi: Bir özelliği bilmenin hedef hakkındaki belirsizliği ne kadar azalttığını ölçer
- Fark eşiği: çok az değişen özellikleri kaldırın

**Sarmalayıcı yöntemleri (model tabanlı):**
- L1 düzenlemesi (Kement): alakasız özellik ağırlıklarını tam olarak sıfıra indirir
- Özyinelemeli özelliğin ortadan kaldırılması: eğitin, en az önemli özelliği kaldırın, tekrarlayın

**Seçim neden önemlidir:** 10 iyi özelliğe sahip bir model, genellikle 10 iyi özelliğe ve 90 gürültülü özelliğe sahip bir modelden daha iyi performans gösterir. Gürültülü özellikler, modele genellemeyen eğitim veri modellerine aşırı uyum sağlama fırsatları verir.

```figure
feature-scaling
```

## İnşa Et

### Adım 1: Sıfırdan sayısal dönüşümler

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

### Adım 2: Sıfırdan kategorik kodlama

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

### 3. Adım: Sıfırdan metin özellikleri

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

### Adım 4: Sıfırdan değer atamasının eksik olması

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

### Adım 5: Sıfırdan özellik seçimi

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

### Adım 6: Tam işlem hattı ve demo

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

## Kullan onu

Scikit-learn ile bu dönüşümler şekillendirilebilir ardışık düzenlerdir:

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

Sıfırdan sürümler, her dönüşümün içinde tam olarak ne olduğunu gösterir. Kitaplık sürümleri uç durum yönetimi, seyrek matris desteği ve ardışık düzen kompozisyonu ekler ancak matematik aynıdır.

## Gönderin

Bu ders şunları üretir:
- `outputs/prompt-feature-engineer.md` - ham verilerden sistematik olarak mühendislik özellikleri için bir prompt

## Egzersizler

1. Sayısal dönüşümlere sağlam ölçeklendirme ekleyin (ortalama ve standart sapma yerine medyan ve çeyrekler arası aralığı kullanarak). Bunu aşırı aykırı değerlere sahip verilerdeki standart ölçeklendirmeyle karşılaştırın.
2. Birini dışarıda bırakma hedef kodlamasını uygulayın: her satır için, o satırın kendi hedef değerini hariç tutarak hedef ortalamasını hesaplayın. Bunun, saf hedef kodlamaya kıyasla aşırı uyumu nasıl azalttığını gösterin.
3. Varyans eşiğini, korelasyon filtrelemeyi ve karşılıklı bilgi sıralamasını birleştiren otomatik bir özellik seçimi hattı oluşturun. Bunu dataset muhafazasına uygulayın ve model performansını (basit bir doğrusal regresyon kullanın) tüm özelliklerle seçilen özelliklerle karşılaştırın.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|----------------------|
| Özellik mühendisliği | "Yeni sütunlar oluşturuluyor" | Ham verileri modele yönelik kalıpları ortaya çıkaran gösterimlere dönüştürme |
| Standardizasyon | "Normal hale getiriyoruz" | Özelliğin ortalama=0 ve std=1 olması için ortalamayı çıkarıp standart sapmaya böleriz |
| Tek seferde kodlama | "Kukla değişkenler oluşturma" | Her satır için tam olarak bir sütunun 1 olduğu kategori başına bir ikili sütun oluşturma |
| Hedef kodlama | "Kodlamak için yanıtı kullanma" | Her bir kategoriyi, fazla sığdırmayı önlemek için yumuşatma yoluyla o kategorinin ortalama hedef değeriyle değiştirme |
| TF-IDF | "Fantazi kelime sayımı" | Dönem Sıklığı çarpı Ters Belge Sıklığı: tümce genelinde ne kadar ayırt edici olduklarına göre ağırlıklandırılan kelimeler |
| itham | "Boşlukları doldurma" | Eksik değerleri tahmini değerlerle değiştirme (ortalama, medyan, mod veya model tarafından tahmin edilen) |
| Özellik seçimi | "Kötü sütunlar atılıyor" | Gürültü veya fazlalık ekleyen özelliklerin kaldırılması, yalnızca hedef hakkında sinyali olanların tutulması |
| Karşılıklı bilgi | "Bir şey size diğeri hakkında ne kadar çok şey anlatır" | X değişkeninin gözlemlenmesiyle elde edilen, Y değişkenine ilişkin belirsizlikteki azalmanın ölçüsü |
| Veri sızıntısı | "Yanlışlıkla hile yapmak" | Tahmin zamanında mevcut olmayacak bilgilerin eğitim sırasında kullanılması, hatalı iyimser sonuçlar verilmesi |

## Daha Fazla Okuma

- [Özellik Mühendisliği ve Seçimi (Max Kuhn & Kjell Johnson)](http://www.feat.engineering/) - özellik mühendisliğinin tüm kapsamını kapsayan ücretsiz çevrimiçi kitap
- [scikit-learn Ön İşleme Kılavuzu](https://scikit-learn.org/stable/modules/preprocessing.html) - tüm standart dönüşümler için pratik referans
- [Hedef Kodlama Doğru Yapıldı (Micci-Barreca, 2001)](https://dl.acm.org/doi/10.1145/507533.507538) - yumuşatma ile hedef kodlama üzerine orijinal makale
