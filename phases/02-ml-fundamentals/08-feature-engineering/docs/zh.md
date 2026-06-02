# 特征工程与特征选择（Feature Engineering & Selection）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 一个好特征，胜过一千个数据点。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 1 (Statistics for ML, Linear Algebra), Phase 2 Lessons 1-7
**Time:** ~90 minutes

## 学习目标（Learning Objectives）

- 实现数值变换（标准化、min-max 缩放、log 变换、分箱），并解释每种方法各自适合什么场景
- 为类别特征构建 one-hot、label 和 target 三种编码方式，并指出 target encoding 的数据泄漏（data leakage）风险
- 从零构建一个 TF-IDF 向量化器，并解释为什么它在文本分类任务上比原始词频更优
- 应用基于过滤（filter）的特征选择方法（方差阈值、相关性、互信息）来降维

## 问题（The Problem）

你拿到一个数据集，挑了一个算法，开始训练。结果很一般。换一个更花哨的算法，依然一般。又花了一周调超参数，提升微乎其微。

然后某个人把原始数据变换成更好的特征，一个简单的 logistic regression（逻辑回归）就把你精调过的 gradient-boosted 集成模型按在地上摩擦。

这种事天天上演。在经典 ML 里，**数据的表征**比**算法的选择**更重要。一个用「面积」「卧室数」做特征的房价模型，会碾压一个把「地址作为原始字符串」喂进去的模型——不管后者用的学习器多么先进。算法只能在你给它的东西上发挥。

特征工程（feature engineering）就是把原始数据变换成让模型更容易找到规律的表征的过程。特征选择（feature selection）则是把那些只添噪声、不带信号的特征扔掉的过程。两者合在一起，是经典 ML 里**杠杆率最高**的活儿。

## 概念（The Concept）

### 特征流水线（The Feature Pipeline）

```mermaid
flowchart LR
    A[原始数据] --> B[处理缺失值]
    B --> C[数值变换]
    B --> D[类别编码]
    B --> E[文本特征]
    C --> F[特征交互]
    D --> F
    E --> F
    F --> G[特征选择]
    G --> H[可直接喂给模型的数据]
```

### 数值特征（Numerical Features）

原始数字很少能直接喂给模型。常见变换有：

**缩放（Scaling）：** 把所有特征拉到同一个量纲范围内，让基于距离的算法（K-Means、KNN、SVM）平等对待每一维。Min-max scaling 把值映射到 [0, 1]。Standardization（z-score，标准化）把分布变成 mean=0、std=1。

**Log 变换（Log transform）：** 压缩右偏（right-skewed）分布，比如收入、人口、词频。把乘性关系变成加性关系。

**分箱（Binning）：** 把连续值切成离散类别。当特征与目标的关系是非线性但**阶梯式**的时候很有用（比如年龄段）。

**多项式特征（Polynomial features）：** 构造 x²、x³、x1·x2 这类项。让线性模型也能捕捉非线性关系，代价是特征数量膨胀。

### 类别特征（Categorical Features）

模型只认数字，类别得编码。

**One-hot encoding：** 给每个类别开一列二值列。`color = red/blue/green` 变成三列：is_red、is_blue、is_green。低基数（low-cardinality）特征上很好用，但类别一多就会爆炸。

**Label encoding：** 把每个类别映射成一个整数：red=0、blue=1、green=2。引入了**虚假的顺序关系**（模型可能以为 green > blue > red）。只适合在按单值切分的树模型里用。

**Target encoding：** 把每个类别替换成该类别下目标变量的均值。威力大，但**危险**：数据泄漏风险高。必须只在训练集上算，再应用到测试集。

### 文本特征（Text Features）

**Count vectorizer：** 数每个词在文档里出现了几次。`"the cat sat on the mat"` 变成 `{the: 2, cat: 1, sat: 1, on: 1, mat: 1}`。

**TF-IDF：** Term Frequency-Inverse Document Frequency（词频-逆文档频率）。按一个词在整个语料里有多独特来加权。像 `the` 这种常见词权重低；罕见、有辨识度的词权重高。

```
TF(word, doc) = count(word in doc) / total words in doc
IDF(word) = log(total docs / docs containing word)
TF-IDF = TF * IDF
```

### 缺失值（Missing Values）

真实数据总有窟窿。常见策略：

- **删行（Drop rows）：** 只在缺失稀少且随机时使用
- **均值/中位数填充（Mean/median imputation）：** 简单，能保留分布形状（中位数对离群点更鲁棒）
- **众数填充（Mode imputation）：** 用于类别特征
- **指示列（Indicator column）：** 在填充前加一列「这个值原本是不是缺失的」二值列。**「缺失」这件事本身**可能就是有信息的
- **前向/后向填充（Forward/backward fill）：** 用于时序数据

### 特征交互（Feature Interaction）

有时候规律藏在**组合**里。光看「身高」和「体重」预测力不强，但 `BMI = weight / height²` 就好用得多。特征交互会让特征空间成倍膨胀，所以要靠领域知识挑组合。

### 特征选择（Feature Selection）

特征不是越多越好。无关特征会引入噪声、增加训练时间、还可能导致过拟合。

**过滤法（Filter methods，建模前）：**
- 相关性：去掉互相高度相关的特征（冗余）
- 互信息（Mutual information）：衡量「知道这个特征能多大程度降低对目标的不确定性」
- 方差阈值（Variance threshold）：去掉几乎不变的特征

**包裹法（Wrapper methods，基于模型）：**
- L1 正则化（Lasso）：把无关特征的权重直接压到 0
- 递归特征消除（Recursive feature elimination）：训练 → 去掉最不重要的特征 → 重复

**为什么选择重要：** 一个有 10 个好特征的模型，往往会比一个有 10 个好特征 + 90 个噪声特征的模型表现更好。噪声特征给了模型在训练集上**过拟合那些不会泛化的规律**的机会。

## 动手实现（Build It）

### 第 1 步：从零实现数值变换

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

### 第 2 步：从零实现类别编码

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

### 第 3 步：从零实现文本特征

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

### 第 4 步：从零实现缺失值填充

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

### 第 5 步：从零实现特征选择

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

### 第 6 步：完整流水线与演示

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

## 用起来（Use It）

在 scikit-learn 里，这些变换都是可组合的 pipeline：

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

从零写的版本让你看清每个变换内部到底发生了什么。库版本多了一些边界处理、稀疏矩阵支持和 pipeline 组合，但底层数学是一样的。

## 上线部署（Ship It）

本课产出：
- `outputs/prompt-feature-engineer.md` —— 一个用来从原始数据系统化做特征工程的 prompt

## 练习（Exercises）

1. 给数值变换加一个 robust scaling（用中位数和四分位距，而不是均值和标准差）。在带极端离群点的数据上，把它和标准 scaling 对比一下。
2. 实现 leave-one-out（留一） target encoding：对每一行，计算**排除掉它自己的目标值**之后的目标均值。展示这种做法相比朴素 target encoding 如何减少过拟合。
3. 搭一个自动化的特征选择流水线，把方差阈值、相关性过滤、互信息排序串起来。把它应用到房价数据集上，用一个简单的 linear regression 对比「全部特征 vs 选择后特征」的模型表现。

## 关键术语（Key Terms）

| 术语 | 大家通常怎么说 | 实际是什么意思 |
|------|----------------|----------------------|
| Feature engineering（特征工程） | 「造新列」 | 把原始数据变换成能把规律暴露给模型的表征 |
| Standardization（标准化） | 「让它正态化」 | 减均值除标准差，让特征 mean=0、std=1 |
| One-hot encoding | 「造 dummy 变量」 | 每个类别开一列二值列，每行恰好有一列为 1 |
| Target encoding | 「用答案做编码」 | 把每个类别替换成该类别的目标均值，并加平滑防过拟合 |
| TF-IDF | 「花哨版词频」 | 词频乘以逆文档频率：按词在语料里有多独特来加权 |
| Imputation（填充） | 「补空白」 | 用估计值（mean、median、mode 或模型预测）替换缺失值 |
| Feature selection（特征选择） | 「扔掉差列」 | 去掉只添噪声或冗余的特征，只留对目标有信号的 |
| Mutual information（互信息） | 「一个东西能告诉你多少另一个东西」 | 观察 X 之后对 Y 的不确定性减少了多少 |
| Data leakage（数据泄漏） | 「不小心作弊」 | 训练时用了预测时拿不到的信息，导致结果虚高 |

## 延伸阅读（Further Reading）

- [Feature Engineering and Selection (Max Kuhn & Kjell Johnson)](http://www.feat.engineering/) —— 一本免费在线书，覆盖特征工程的完整版图
- [scikit-learn Preprocessing Guide](https://scikit-learn.org/stable/modules/preprocessing.html) —— 所有标准变换的实战参考
- [Target Encoding Done Right (Micci-Barreca, 2001)](https://dl.acm.org/doi/10.1145/507533.507538) —— 带平滑的 target encoding 原始论文
