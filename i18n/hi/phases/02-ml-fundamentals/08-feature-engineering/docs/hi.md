# विशेषता इंजीनियरिंग और चयन

> एक अच्छी सुविधा एक हजार डेटा पॉइंट्स के लायक है।

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 1 (Statistics for ML, Linear Algebra), Phase 2 Lessons 1-7
**Time:** ~90 minutes

## सीखने के लक्ष्य

- संख्यात्मक परिवर्तन (मानकीकरण, न्यूनतम अधिकतम स्केलिंग, लॉग परिवर्तन, बिल्डिंग) को लागू करें और समझाएं कि प्रत्येक उपयुक्त कब है
- श्रेणीगत विशेषताओं के लिए एक-उष्ण, लेबल और लक्ष्य एन्कोडिंग बनाएं और लक्ष्य एन्कोडिंग में डेटा लीक जोखिम की पहचान करें
- एक TF-IDF वेक्टरराइज़र को खरोंच से बनाएं और समझाएं कि यह पाठ वर्गीकरण के लिए कच्चे शब्द की गणना से बेहतर क्यों है
- आयामता को कम करने के लिए फ़िल्टर आधारित विशेषता चयन (वियरिएंस थ्रॉश, सहसंबंध, पारस्परिक जानकारी) लागू करें

## समस्या

आपके पास एक डेटा सेट है. आप एक एल्गोरिथ्म चुनते हैं. आप इसे प्रशिक्षित करते हैं. परिणाम मध्यम हैं. आप एक अधिक शानदार एल्गोरिथ्म की कोशिश करते हैं. आप अभी भी मध्यम हैं. आप हाइपरपैरामीटर को समायोजित करने में एक सप्ताह बिताते हैं. मार्जिनल सुधार.

फिर किसी ने कच्चे डेटा को बेहतर सुविधाओं में बदल दिया और एक सरल लॉजिस्टिक प्रतिगमन आपके ट्यूनिंग ग्रेडिएंट-बढ़ते एंसेंबल को हराया।

यह लगातार होता है. क्लासिकल एमएल में, एल्गोरिदम के चयन से अधिक डेटा का प्रतिनिधित्व मायने रखता है। "वर्ग फुटेज" और "कमरे की संख्या" के साथ एक घर मूल्य मॉडल "अड्रेस के रूप में कच्चे स्ट्रिंग" के साथ एक मॉडल को हराएगा। चाहे छात्र कितना भी परिष्कृत हो। एल्गोरिदम केवल आपके द्वारा दिए गए काम के साथ काम कर सकता है।

फीचर इंजीनियरिंग कच्चे डेटा को प्रतिनिधित्व में बदलने की प्रक्रिया है जो मॉडल के लिए पैटर्न को ढूंढना आसान बनाता है। फीचर चयन ध्वनि जोड़ने के बिना शोर जोड़ने वाली सुविधाओं को फेंकने की प्रक्रिया है। साथ में, वे शास्त्रीय एमएल में उच्चतम लीवरेज गतिविधि हैं।

## अवधारणा

### विशेषता पाइपलाइन

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

### संख्यात्मक विशेषताएं

कच्चे संख्याएं शायद ही कभी मॉडल तैयार होती हैं. आम परिवर्तनः

**Scaling:**सुविधाओं को एक ही सीमा पर रखें ताकि दूरी आधारित एल्गोरिदम (के-मीन्स, केएनएन, एसवीएम) सभी सुविधाओं को समान रूप से संभाल सकें। मिन-मैक्स स्केलिंग मैप्स [0, 1] तक। मानकीकरण (ज़-स्कोर) मैप्स mean=0, std=1 तक।

**Log transform:**दाएं-छेड़े वितरण (आय, जनसंख्या, शब्द गिनती) को संपीड़ित करता है। गुणात्मक संबंधों को योगीय में बदल देता है।

**Binning:**निरंतर मानों को श्रेणियों में परिवर्तित करता है। जब विशेषता और लक्ष्य के बीच संबंध गैर-रैखिक लेकिन चरण-wise (जैसे, आयु समूह) है।

**Polynomial features:**बनाता है $x^2$,$x^3$,$x_1 x_2$अधिक सुविधाओं की कीमत पर रैखिक मॉडल गैर-रेखीय संबंधों को कैप्चर करने देता है।

### श्रेणीगत विशेषताएं

मॉडल को संख्याओं की आवश्यकता होती है।

**One-hot encoding:**प्रत्येक श्रेणी के लिए एक द्विआधारी स्तंभ बनाता है। "रंग = लाल / नीला / हरा" तीन स्तंभों में बदल जाता हैः is_red, is_blue, is_green। कम कार्डिनल्टी सुविधाओं के लिए अच्छी तरह से काम करता है लेकिन कई श्रेणियों के साथ विस्फोट करता है।

**Label encoding:**प्रत्येक श्रेणी को एक पूर्णांक में मैप करेंः लाल = 0, नीला = 1, हरा = 2. गलत क्रमबद्धता पेश करता है (मॉडल हरे > नीले > लाल सोच सकता है) । केवल पेड़ आधारित मॉडल के लिए उपयुक्त है जो व्यक्तिगत मानों पर विभाजित होते हैं।

**Target encoding:**प्रत्येक श्रेणी को उस श्रेणी के लिए लक्ष्य चर के औसत से बदल देता है। शक्तिशाली लेकिन खतरनाकः डेटा लीक का उच्च जोखिम। केवल प्रशिक्षण डेटा पर गणना की जानी चाहिए और परीक्षण डेटा पर लागू किया जाना चाहिए।

### पाठ विशेषताएं

**Count vectorizer:**यह गणना करता है कि प्रत्येक शब्द दस्तावेज़ में कितनी बार दिखाई देता है। "मक्खी मैट पर बैठी" {the: 2, cat: 1, sat: 1, on: 1, mat: 1} बन जाती है।

**TF-IDF:**शब्द आवृत्ति-उपवर्ती दस्तावेज़ आवृत्ति. दस्तावेजों में शब्दों का वजन कितना अद्वितीय है। "the" जैसे सामान्य शब्द कम वजन प्राप्त करते हैं। दुर्लभ, विशिष्ट शब्द उच्च वजन प्राप्त करते हैं।

```math
\begin{aligned}
\text{TF}(\text{word}, \text{doc}) &= \frac{\text{count(word in doc)}}{\text{total words in doc}} \\
\text{IDF}(\text{word}) &= \log \frac{\text{total docs}}{\text{docs containing word}} \\
\text{TF-IDF} &= \text{TF} \cdot \text{IDF}
\end{aligned}
```

### खोए हुए मूल्य

वास्तविक डेटा में छेद है।

- **Drop rows:**केवल जब गायब डेटा दुर्लभ और यादृच्छिक है
- **Mean/median imputation:**सरल, सुविधा के केंद्र को बनाए रखता है (मध्यस्थ असाधारण के लिए अधिक मजबूत है), लेकिन इसके भिन्नता को छोटा करता है और प्रत्येक भरने वाले मूल्य को एक स्पाइक पर ढेर करता है, इसलिए वितरण आकार बदलता है
- **Mode imputation:**श्रेणीगत विशेषताओं के लिए
- **Indicator column:**जोड़ने से पहले एक बाइनरी कॉलम "was_this_missing" जोड़ें. तथ्य यह है कि डेटा गायब है अपने आप में सूचनात्मक हो सकता है
- **Forward/backward fill:**समय श्रृंखला के लिए डेटा

### विशेषता बातचीत

कभी-कभी संबंध संयोजन में होता है। "ऊंचाई" और "वेट" अकेले कम भविष्यवाणी करते हैं।$\text{BMI} = \text{weight} / \text{height}^2$सुविधाओं के बीच बातचीत सुविधाओं के स्थान को गुणा करती है, इसलिए सही लोगों को चुनने के लिए डोमेन ज्ञान का उपयोग करें।

### विशेषता चयन

अधिक सुविधाएँ हमेशा बेहतर नहीं होती हैं। अप्रासंगिक सुविधाएँ शोर बढ़ा देती हैं, प्रशिक्षण समय बढ़ा देती हैं और अति-फिटिंग का कारण बन सकती हैं।

**Filter methods (pre-model):**
- संयोगः एक दूसरे से अत्यधिक संबद्ध विशेषताओं को हटा दें (रिडंडेंट)
- पारस्परिक सूचनाः यह मापता है कि किसी विशेषता को जानने से लक्ष्य के बारे में अनिश्चितता कम होती है
- भिन्नता सीमाः उन विशेषताओं को हटा दें जो शायद ही भिन्न हों

**Wrapper methods (model-based):**
- L1 नियमितकरण (लासो): अपरिवर्तनीय विशेषता भार को बिल्कुल शून्य तक चलाता है
- पुनरावर्ती विशेषता समाप्त करनाः ट्रेन, कम महत्वपूर्ण विशेषता हटाएं, दोहराएं

**Why selection matters:**10 अच्छी सुविधाओं वाले मॉडल आमतौर पर 10 अच्छी सुविधाओं वाले मॉडल और 90 शोर वाले मॉडल से बेहतर प्रदर्शन करेंगे। शोरपूर्ण सुविधाएं मॉडल को प्रशिक्षण डेटा पैटर्न पर ओवरफिट करने का अवसर देती हैं जो सामान्य नहीं होती हैं।

```figure
feature-scaling
```

## इसे बनाओ

### चरण 1: शून्य से संख्यात्मक परिवर्तन

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

### चरण 2: श्रेणीबद्ध कोडिंग खरोंच से

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

### चरण 3: स्क्रैच से पाठ सुविधाएँ

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

### चरण 4: शून्य से अनुपस्थित मूल्य निर्धारण

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

### चरण 5: स्क्रैच से फीचर चयन

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

### चरण 6: पूर्ण पाइपलाइन और डेमो

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

## इसका प्रयोग करें

स्किट-लर्न के साथ, ये परिवर्तन संश्लेषित पाइपलाइन हैंः

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

स्क्रैच संस्करणों में प्रत्येक परिवर्तन के अंदर क्या होता है, यह दिखाया गया है। पुस्तकालय संस्करणों में एज-केस हैंडलिंग, दुर्लभ मैट्रिक्स समर्थन और पाइपलाइन संरचना शामिल है, लेकिन गणित समान है।

## इसे भेजें

इस पाठ से उत्पन्न होता हैः
- `outputs/prompt-feature-engineer.md`- कच्चे डेटा से व्यवस्थित रूप से इंजीनियरिंग सुविधाओं के लिए एक संकेत

## व्यायाम

1. संख्यात्मक परिवर्तनों में मजबूत स्केलिंग (मध्यम और मानक विचलन के बजाय मध्य और अंतर-क्वार्टिल रेंज का उपयोग करके) जोड़ें। इसे चरम विकृति वाले डेटा पर मानक स्केलिंग के साथ तुलना करें।
2. एक-बाहर लक्ष्य एन्कोडिंग लागू करेंः प्रत्येक पंक्ति के लिए, उस पंक्ति के अपने लक्ष्य मूल्य को छोड़कर लक्ष्य औसत की गणना करें। दिखाएं कि यह साफ़ लक्ष्य एन्कोडिंग की तुलना में ओवरफिटिंग कैसे कम करता है।
3. एक स्वचालित सुविधा चयन पाइपलाइन बनाएं जो भिन्नता सीमा, सहसंबंध फ़िल्टरिंग और आपसी सूचना रैंकिंग को जोड़ता है। इसे आवास डेटासेट पर लागू करें और सभी सुविधाओं बनाम चयनित सुविधाओं के साथ मॉडल प्रदर्शन (सरल रैखिक प्रतिगमन का उपयोग करें) की तुलना करें।

## प्रमुख शर्तें

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

## आगे पढ़ना

- [Feature Engineering and Selection (Max Kuhn & Kjell Johnson)](http://www.feat.engineering/)- फीचर इंजीनियरिंग के पूरे परिदृश्य को कवर करने वाली मुफ्त ऑनलाइन पुस्तक
- [scikit-learn Preprocessing Guide](https://scikit-learn.org/stable/modules/preprocessing.html)- सभी मानक परिवर्तनों के लिए व्यावहारिक संदर्भ
- [Target Encoding Done Right (Micci-Barreca, 2001)](https://dl.acm.org/doi/10.1145/507533.507538)- लक्षित कोडिंग के बारे में मूल पेपर
