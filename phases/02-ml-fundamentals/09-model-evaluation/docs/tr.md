# Model Değerlendirmesi

> Bir model yalnızca onu ölçme şekliniz kadar iyidir.

**Tür:** Yapım
**Diller:** Python
**Önkoşullar:** Aşama 1 (Olasılık ve Dağılımlar, ML İstatistikleri), Aşama 2 Dersleri 1-8
**Süre:** ~90 dakika

## Öğrenme Hedefleri

- K-katlı ve katmanlı K-katlı çapraz doğrulamayı sıfırdan uygulayın ve dengesiz veriler için katmanlaştırmanın neden önemli olduğunu açıklayın
- Hassasiyet, geri çağırma, F1, AUC-ROC ve regresyon ölçümlerini (MSE, RMSE, MAE, R-kare) sıfırdan hesaplayın
- Bir modelin yüksek sapmadan mı yoksa yüksek varyanstan mı muzdarip olduğunu teşhis etmek için öğrenme eğrilerini yorumlayın
- Veri sızıntısı, yanlış metrik seçimi ve test seti kirliliği dahil yaygın değerlendirme hatalarını belirleyin

## Sorun

Bir model yetiştirdin. Verilerinizde %95 doğruluk elde eder. İyi mi?

Belki. Belki de değil. Verilerinizin %95'i bir sınıfa aitse, o sınıfı her zaman tahmin eden bir model tamamen işe yaramazken %95 doğruluk elde eder. Eğitim aldığınız verilerle değerlendirme yaptıysanız %95 rakamı anlamsızdır çünkü model yalnızca yanıtları ezberlemiştir. dataset'nizin bir zaman bileşeni varsa ve bölmeden önce rastgele karıştırdıysanız modeliniz geçmişi tahmin etmek için gelecekteki verileri kullanıyor olabilir.

Model değerlendirmesi çoğu makine öğrenimi projesinin yanlış gittiği yerdir. Yanlış ölçüm, kötü bir modelin iyi görünmesini sağlar. Yanlış bölme, modelin hile yapmasına neden olur. Yanlış karşılaştırma, daha kötü modeli seçmenize neden olur. Değerlendirmenin doğru yapılması isteğe bağlı değildir. Üretimde çalışan bir model ile gerçek verileri gördüğü anda başarısız olan bir model arasındaki farktır.

## Konsept

### Eğitim, Doğrulama, Test

```mermaid
flowchart LR
    A[Full Dataset] --> B[Train Set 60-70%]
    A --> C[Validation Set 15-20%]
    A --> D[Test Set 15-20%]
    B --> E[Fit Model]
    E --> C
    C --> F[Tune Hyperparameters]
    F --> E
    F --> G[Final Model]
    G --> D
    D --> H[Report Performance]
```

Üç bölünme, üç amaç:

- **Eğitim seti**: model bu verilerden öğrenir. Bu örnekleri eğitim sırasında görür.
- **Doğrulama seti**: hiperparametreleri ayarlamak ve modeller arasında seçim yapmak için kullanılır. Model hiçbir zaman bu veriler üzerinde eğitim yapmaz ancak kararlarınız bundan etkilenir.
- **Test seti**: Nihai performansı raporlamak için en sonunda tam olarak bir kez dokunuldu. Test performansına baktığınızda modelinizi değiştirmek için geri dönerseniz, bunun artık bir test seti olmadığını görürsünüz. İkinci bir doğrulama seti haline geldi.

Test seti, rapor edilen performansın, modelin gerçekten görünmeyen veriler üzerinde nasıl performans göstereceğini yansıttığına dair garantinizdir.

### K-Katlamalı Çapraz Doğrulama

Küçük dataset'lerle, tek bir eğitim/doğrulama bölünmesi verileri boşa harcar ve gürültülü tahminler verir. K-katlı çapraz doğrulama, hem eğitim hem de doğrulama için tüm verileri kullanır:

```mermaid
flowchart TB
    subgraph Fold1["Fold 1"]
        direction LR
        V1["Val"] --- T1a["Train"] --- T1b["Train"] --- T1c["Train"] --- T1d["Train"]
    end
    subgraph Fold2["Fold 2"]
        direction LR
        T2a["Train"] --- V2["Val"] --- T2b["Train"] --- T2c["Train"] --- T2d["Train"]
    end
    subgraph Fold3["Fold 3"]
        direction LR
        T3a["Train"] --- T3b["Train"] --- V3["Val"] --- T3c["Train"] --- T3d["Train"]
    end
    subgraph Fold4["Fold 4"]
        direction LR
        T4a["Train"] --- T4b["Train"] --- T4c["Train"] --- V4["Val"] --- T4d["Train"]
    end
    subgraph Fold5["Fold 5"]
        direction LR
        T5a["Train"] --- T5b["Train"] --- T5c["Train"] --- T5d["Train"] --- V5["Val"]
    end
    Fold1 --> R["Average scores"]
    Fold2 --> R
    Fold3 --> R
    Fold4 --> R
    Fold5 --> R
```

1. Verileri K eşit boyutlu katlara bölün
2. Her katlama için K-1 katlamaları üzerinde çalışın ve kalan katlamayı doğrulayın
3. K doğrulama puanlarının ortalamasını alın

K=5 veya K=10 standart seçimlerdir. Her veri noktası doğrulama için tam olarak bir kez kullanılır. Ortalama puan herhangi bir tekli bölünmeden daha istikrarlı bir tahmindir.

**Katmanlı K-katlama**: her katlamadaki sınıf dağılımını korur. dataset'niz %70 A sınıfı ve %30 B sınıfı ise, her katlama kabaca aynı orana sahip olacaktır. Bu, rastgele bir bölünmenin tüm azınlık örneklerini tek bir kata koyabileceği dengesiz dataset'ler için önemlidir.

### Sınıflandırma Metrikleri

**Karışıklık matrisi**: temel. İkili sınıflandırma için:

|  | Olumlu Tahmin | Negatif Tahmin |
|--|---|---|
| Aslında Olumlu | Gerçek Pozitif (TP) | Yanlış Negatif (FN) |
| Aslında Olumsuz | Yanlış Pozitif (FP) | Gerçek Negatif (TN) |

Bu matristen diğer tüm ölçümler aşağıdakileri takip eder:

- **Doğruluk** = (TP + TN) / (TP + TN + FP + FN). Doğru tahminlerin oranı. Sınıflar dengesiz olduğunda yanıltıcıdır.
- **Hassaslık** = TP / (TP + FP). Olumlu olarak tahmin edilen her şeyin gerçekte kaç tanesi olumluydu? Yanlış pozitiflerin maliyetli olduğu durumlarda kullanın (e.g., gerçek e-postayı spam olarak işaretleyen spam filtresi).
- **Geri çağırma** (hassasiyet) = TP / (TP + FN). Tüm gerçek pozitiflerden kaçını yakaladık? Yanlış negatiflerin maliyetli olduğu durumlarda kullanın (e.g., bir tümörün eksik olduğu kanser taramasında).
- **F1 puanı** = 2 * kesinlik * geri çağırma / (hassasiyet + geri çağırma). Hassasiyet ve geri çağırmanın harmonik ortalaması. Hiçbiri açıkça baskın olmadığında her ikisini de dengeler.
- **AUC-ROC**: Alıcı Çalışma Karakteristiği eğrisinin altındaki alan. Çeşitli sınıflandırma eşiklerinde gerçek pozitif oran ile yanlış pozitif oranın grafiğini çizer. AUC = 0,5 rastgele tahmin anlamına gelir, AUC = 1,0 mükemmel ayırma anlamına gelir. Eşikten bağımsız: Seçtiğiniz kesimden bağımsız olarak modelin pozitifleri negatiflerin üzerinde ne kadar iyi sıraladığını ölçer.

### Regresyon Metrikleri

- **MSE** (Ortalama Kare Hatası) = ortalama((y_true - y_pred)^2). Büyük hataları karesel olarak cezalandırır. Aykırı değerlere duyarlı.
- **RMSE** (Kök Ortalama Karesel Hata) = sqrt(MSE). Hedef değişkenle aynı birimler. Yorumlanması MSE'den daha kolaydır.
- **MAE** (Ortalama Mutlak Hata) = ortalama(|y_true - y_pred|). Tüm hataları doğrusal olarak ele alır. Aykırı değerlere karşı MSE'den daha dayanıklıdır.
- **R-kare** = 1 - SS_res / SS_tot, burada SS_res = toplam((y_true - y_pred)^2) ve SS_tot = toplam((y_true - y_mean)^2). Model tarafından açıklanan varyansın oranı. R^2 = 1,0 mükemmeldir. R^2 = 0,0, modelin her zaman ortalamayı tahmin etmekten daha iyi olmadığı anlamına gelir. Model ortalamadan daha kötüyse R^2 negatif olabilir.

### Öğrenme Eğrileri

Eğitim seti boyutunun bir fonksiyonu olarak eğitim ve doğrulama puanlarını çizin:

- **Yüksek önyargı (yetersiz uyum)**: her iki eğri de düşük bir puana yakınsar. Daha fazla veri eklemek yardımcı olmayacaktır. Daha karmaşık bir modele ihtiyacınız var.
- **Yüksek varyans (aşırı uyum)**: eğitim puanı yüksektir ancak doğrulama puanı çok daha düşüktür. Aralarındaki boşluk büyüktür. Daha fazla veri eklemek yardımcı olacaktır.

### Doğrulama Eğrileri

Bir hiperparametrenin fonksiyonu olarak eğitim ve doğrulama puanlarının grafiğini çizin:

- Düşük karmaşıklıkta: her iki puan da düşüktür (yetersiz uyum)
- Doğru karmaşıklıkta: her iki puan da yüksek ve birbirine yakın
- Yüksek karmaşıklıkta: eğitim puanı yüksek kalır ancak doğrulama puanı düşer (fazla uyum)

Optimum hiperparametre değeri, doğrulama puanının zirve yaptığı yerdir.

### Yaygın Değerlendirme Hataları

**Veri sızıntısı**: Test setindeki bilgilerin eğitime sızması. Örnekler: hedeften türetilen bir özelliği kullanarak, zaman serisi tahminindeki gelecekteki veriler de dahil olmak üzere, bölmeden önce tam dataset'ye bir ölçekleyici yerleştirmek. Her zaman önce bölün, ardından ön işleme tabi tutun.

**Sınıf dengesizliği**: İşlemlerin %99'u meşru, %1'i sahtekarlıktır. Her zaman "meşru" tahminde bulunan bir model %99 doğruluk elde eder. Bunun yerine kesinlik, geri çağırma, F1 veya AUC-ROC kullanın.

**Yanlış ölçüm**: Geri çağırmayı (tıbbi teşhis) optimize etmeniz gerektiğinde doğruluğu optimize etmek veya verileriniz aşırı aykırı değerlere sahip olduğunda RMSE'yi optimize etmek (bunun yerine MAE kullanın).

**Katmanlı bölünmeler kullanılmaması**: Dengesiz verilerde, rastgele bir bölünme, doğrulama katına çok az sayıda azınlık örneği koyabilir ve bu da kararsız tahminler verebilir.

**Çok sık test yapmak**: Test performansına her baktığınızda ve ayar yaptığınızda, test setine gereğinden fazla uyuyorsunuz. Test seti tek kullanımlıktır.

```figure
precision-recall-threshold
```

## İnşa Et

### 1. Adım: Eğitim/doğrulama/test bölümü

```python
import random
import math


def train_val_test_split(X, y, train_ratio=0.6, val_ratio=0.2, seed=42):
    random.seed(seed)
    n = len(X)
    indices = list(range(n))
    random.shuffle(indices)

    train_end = int(n * train_ratio)
    val_end = int(n * (train_ratio + val_ratio))

    train_idx = indices[:train_end]
    val_idx = indices[train_end:val_end]
    test_idx = indices[val_end:]

    X_train = [X[i] for i in train_idx]
    y_train = [y[i] for i in train_idx]
    X_val = [X[i] for i in val_idx]
    y_val = [y[i] for i in val_idx]
    X_test = [X[i] for i in test_idx]
    y_test = [y[i] for i in test_idx]

    return X_train, y_train, X_val, y_val, X_test, y_test
```

### Adım 2: K-katlı ve katmanlı K-katlı çapraz doğrulama

```python
def kfold_split(n, k=5, seed=42):
    random.seed(seed)
    indices = list(range(n))
    random.shuffle(indices)

    fold_size = n // k
    folds = []

    for i in range(k):
        start = i * fold_size
        end = start + fold_size if i < k - 1 else n
        val_idx = indices[start:end]
        train_idx = indices[:start] + indices[end:]
        folds.append((train_idx, val_idx))

    return folds


def stratified_kfold_split(y, k=5, seed=42):
    random.seed(seed)

    class_indices = {}
    for i, label in enumerate(y):
        class_indices.setdefault(label, []).append(i)

    for label in class_indices:
        random.shuffle(class_indices[label])

    folds = [{"train": [], "val": []} for _ in range(k)]

    for label, indices in class_indices.items():
        fold_size = len(indices) // k
        for i in range(k):
            start = i * fold_size
            end = start + fold_size if i < k - 1 else len(indices)
            val_part = indices[start:end]
            train_part = indices[:start] + indices[end:]
            folds[i]["val"].extend(val_part)
            folds[i]["train"].extend(train_part)

    return [(f["train"], f["val"]) for f in folds]


def cross_validate(X, y, model_fn, k=5, metric_fn=None, stratified=False):
    n = len(X)

    if stratified:
        folds = stratified_kfold_split(y, k)
    else:
        folds = kfold_split(n, k)

    scores = []
    for train_idx, val_idx in folds:
        X_train = [X[i] for i in train_idx]
        y_train = [y[i] for i in train_idx]
        X_val = [X[i] for i in val_idx]
        y_val = [y[i] for i in val_idx]

        model = model_fn()
        model.fit(X_train, y_train)
        predictions = [model.predict(x) for x in X_val]

        if metric_fn:
            score = metric_fn(y_val, predictions)
        else:
            score = sum(1 for yt, yp in zip(y_val, predictions) if yt == yp) / len(y_val)
        scores.append(score)

    return scores
```

### Adım 3: Karışıklık matrisi ve sınıflandırma ölçümleri

```python
def confusion_matrix(y_true, y_pred):
    tp = sum(1 for yt, yp in zip(y_true, y_pred) if yt == 1 and yp == 1)
    tn = sum(1 for yt, yp in zip(y_true, y_pred) if yt == 0 and yp == 0)
    fp = sum(1 for yt, yp in zip(y_true, y_pred) if yt == 0 and yp == 1)
    fn = sum(1 for yt, yp in zip(y_true, y_pred) if yt == 1 and yp == 0)
    return tp, tn, fp, fn


def accuracy(y_true, y_pred):
    tp, tn, fp, fn = confusion_matrix(y_true, y_pred)
    total = tp + tn + fp + fn
    return (tp + tn) / total if total > 0 else 0.0


def precision(y_true, y_pred):
    tp, tn, fp, fn = confusion_matrix(y_true, y_pred)
    return tp / (tp + fp) if (tp + fp) > 0 else 0.0


def recall(y_true, y_pred):
    tp, tn, fp, fn = confusion_matrix(y_true, y_pred)
    return tp / (tp + fn) if (tp + fn) > 0 else 0.0


def f1_score(y_true, y_pred):
    p = precision(y_true, y_pred)
    r = recall(y_true, y_pred)
    return 2 * p * r / (p + r) if (p + r) > 0 else 0.0


def roc_curve(y_true, y_scores):
    thresholds = sorted(set(y_scores), reverse=True)
    tpr_list = []
    fpr_list = []

    total_positives = sum(y_true)
    total_negatives = len(y_true) - total_positives

    for threshold in thresholds:
        y_pred = [1 if s >= threshold else 0 for s in y_scores]
        tp = sum(1 for yt, yp in zip(y_true, y_pred) if yt == 1 and yp == 1)
        fp = sum(1 for yt, yp in zip(y_true, y_pred) if yt == 0 and yp == 1)

        tpr = tp / total_positives if total_positives > 0 else 0.0
        fpr = fp / total_negatives if total_negatives > 0 else 0.0

        tpr_list.append(tpr)
        fpr_list.append(fpr)

    return fpr_list, tpr_list, thresholds


def auc_roc(y_true, y_scores):
    fpr_list, tpr_list, _ = roc_curve(y_true, y_scores)

    pairs = sorted(zip(fpr_list, tpr_list))
    fpr_sorted = [p[0] for p in pairs]
    tpr_sorted = [p[1] for p in pairs]

    area = 0.0
    for i in range(1, len(fpr_sorted)):
        width = fpr_sorted[i] - fpr_sorted[i - 1]
        height = (tpr_sorted[i] + tpr_sorted[i - 1]) / 2
        area += width * height

    return area
```

### Adım 4: Regresyon ölçümleri

```python
def mse(y_true, y_pred):
    n = len(y_true)
    return sum((yt - yp) ** 2 for yt, yp in zip(y_true, y_pred)) / n


def rmse(y_true, y_pred):
    return math.sqrt(mse(y_true, y_pred))


def mae(y_true, y_pred):
    n = len(y_true)
    return sum(abs(yt - yp) for yt, yp in zip(y_true, y_pred)) / n


def r_squared(y_true, y_pred):
    mean_y = sum(y_true) / len(y_true)
    ss_res = sum((yt - yp) ** 2 for yt, yp in zip(y_true, y_pred))
    ss_tot = sum((yt - mean_y) ** 2 for yt in y_true)
    if ss_tot == 0:
        return 0.0
    return 1.0 - ss_res / ss_tot
```

### Adım 5: Eğrileri öğrenme

```python
def learning_curve(X, y, model_fn, metric_fn, train_sizes=None, val_ratio=0.2, seed=42):
    random.seed(seed)
    n = len(X)
    indices = list(range(n))
    random.shuffle(indices)

    val_size = int(n * val_ratio)
    val_idx = indices[:val_size]
    pool_idx = indices[val_size:]

    X_val = [X[i] for i in val_idx]
    y_val = [y[i] for i in val_idx]

    if train_sizes is None:
        train_sizes = [int(len(pool_idx) * r) for r in [0.1, 0.2, 0.4, 0.6, 0.8, 1.0]]

    train_scores = []
    val_scores = []

    for size in train_sizes:
        subset = pool_idx[:size]
        X_train = [X[i] for i in subset]
        y_train = [y[i] for i in subset]

        model = model_fn()
        model.fit(X_train, y_train)

        train_pred = [model.predict(x) for x in X_train]
        val_pred = [model.predict(x) for x in X_val]

        train_scores.append(metric_fn(y_train, train_pred))
        val_scores.append(metric_fn(y_val, val_pred))

    return train_sizes, train_scores, val_scores
```

### Adım 6: Test için basit bir sınıflandırıcı ve tam demo

```python
class SimpleLogistic:
    def __init__(self, lr=0.1, epochs=100):
        self.lr = lr
        self.epochs = epochs
        self.weights = None
        self.bias = 0.0

    def sigmoid(self, z):
        z = max(-500, min(500, z))
        return 1.0 / (1.0 + math.exp(-z))

    def fit(self, X, y):
        n_features = len(X[0])
        self.weights = [0.0] * n_features
        self.bias = 0.0

        for _ in range(self.epochs):
            for xi, yi in zip(X, y):
                z = sum(w * x for w, x in zip(self.weights, xi)) + self.bias
                pred = self.sigmoid(z)
                error = yi - pred
                for j in range(n_features):
                    self.weights[j] += self.lr * error * xi[j]
                self.bias += self.lr * error

    def predict_proba(self, x):
        z = sum(w * xi for w, xi in zip(self.weights, x)) + self.bias
        return self.sigmoid(z)

    def predict(self, x):
        return 1 if self.predict_proba(x) >= 0.5 else 0


class SimpleLinearRegression:
    def __init__(self, lr=0.001, epochs=200):
        self.lr = lr
        self.epochs = epochs
        self.weights = None
        self.bias = 0.0

    def fit(self, X, y):
        n_features = len(X[0])
        self.weights = [0.0] * n_features
        self.bias = 0.0
        n = len(X)

        for _ in range(self.epochs):
            for xi, yi in zip(X, y):
                pred = sum(w * x for w, x in zip(self.weights, xi)) + self.bias
                error = yi - pred
                for j in range(n_features):
                    self.weights[j] += self.lr * error * xi[j] / n
                self.bias += self.lr * error / n

    def predict(self, x):
        return sum(w * xi for w, xi in zip(self.weights, x)) + self.bias


def standardize(values):
    n = len(values)
    mean = sum(values) / n
    var = sum((v - mean) ** 2 for v in values) / n
    std = math.sqrt(var) if var > 0 else 1.0
    return [(v - mean) / std for v in values], mean, std


def make_classification_data(n=300, seed=42):
    random.seed(seed)
    X = []
    y = []
    for _ in range(n):
        x1 = random.gauss(0, 1)
        x2 = random.gauss(0, 1)
        label = 1 if (x1 + x2 + random.gauss(0, 0.5)) > 0 else 0
        X.append([x1, x2])
        y.append(label)
    return X, y


def make_regression_data(n=200, seed=42):
    random.seed(seed)
    X = []
    y = []
    for _ in range(n):
        x1 = random.uniform(0, 10)
        x2 = random.uniform(0, 5)
        target = 3 * x1 + 2 * x2 + random.gauss(0, 2)
        X.append([x1, x2])
        y.append(target)
    return X, y


def make_imbalanced_data(n=300, minority_ratio=0.05, seed=42):
    random.seed(seed)
    X = []
    y = []
    for _ in range(n):
        if random.random() < minority_ratio:
            x1 = random.gauss(3, 0.5)
            x2 = random.gauss(3, 0.5)
            label = 1
        else:
            x1 = random.gauss(0, 1)
            x2 = random.gauss(0, 1)
            label = 0
        X.append([x1, x2])
        y.append(label)
    return X, y


if __name__ == "__main__":
    X_clf, y_clf = make_classification_data(300)

    print("=== Train/Validation/Test Split ===")
    X_train, y_train, X_val, y_val, X_test, y_test = train_val_test_split(X_clf, y_clf)
    print(f"  Train: {len(X_train)}, Val: {len(X_val)}, Test: {len(X_test)}")
    print(f"  Train class distribution: {sum(y_train)}/{len(y_train)} positive")
    print(f"  Val class distribution: {sum(y_val)}/{len(y_val)} positive")

    model = SimpleLogistic(lr=0.1, epochs=200)
    model.fit(X_train, y_train)

    print("\n=== Classification Metrics ===")
    y_pred = [model.predict(x) for x in X_test]
    tp, tn, fp, fn = confusion_matrix(y_test, y_pred)
    print(f"  Confusion matrix: TP={tp}, TN={tn}, FP={fp}, FN={fn}")
    print(f"  Accuracy:  {accuracy(y_test, y_pred):.4f}")
    print(f"  Precision: {precision(y_test, y_pred):.4f}")
    print(f"  Recall:    {recall(y_test, y_pred):.4f}")
    print(f"  F1 Score:  {f1_score(y_test, y_pred):.4f}")

    y_scores = [model.predict_proba(x) for x in X_test]
    auc = auc_roc(y_test, y_scores)
    print(f"  AUC-ROC:   {auc:.4f}")

    print("\n=== K-Fold Cross-Validation (K=5) ===")
    cv_scores = cross_validate(
        X_clf, y_clf,
        model_fn=lambda: SimpleLogistic(lr=0.1, epochs=200),
        k=5,
        metric_fn=accuracy,
    )
    mean_cv = sum(cv_scores) / len(cv_scores)
    std_cv = math.sqrt(sum((s - mean_cv) ** 2 for s in cv_scores) / len(cv_scores))
    print(f"  Fold scores: {[round(s, 4) for s in cv_scores]}")
    print(f"  Mean: {mean_cv:.4f} (+/- {std_cv:.4f})")

    print("\n=== Stratified K-Fold Cross-Validation (K=5) ===")
    strat_scores = cross_validate(
        X_clf, y_clf,
        model_fn=lambda: SimpleLogistic(lr=0.1, epochs=200),
        k=5,
        metric_fn=accuracy,
        stratified=True,
    )
    strat_mean = sum(strat_scores) / len(strat_scores)
    strat_std = math.sqrt(sum((s - strat_mean) ** 2 for s in strat_scores) / len(strat_scores))
    print(f"  Fold scores: {[round(s, 4) for s in strat_scores]}")
    print(f"  Mean: {strat_mean:.4f} (+/- {strat_std:.4f})")

    print("\n=== Imbalanced Data: Why Accuracy Lies ===")
    X_imb, y_imb = make_imbalanced_data(300, minority_ratio=0.05)
    positives = sum(y_imb)
    print(f"  Class distribution: {positives} positive, {len(y_imb) - positives} negative ({positives/len(y_imb)*100:.1f}% positive)")

    always_negative = [0] * len(y_imb)
    print(f"  Always-negative baseline:")
    print(f"    Accuracy:  {accuracy(y_imb, always_negative):.4f}")
    print(f"    Precision: {precision(y_imb, always_negative):.4f}")
    print(f"    Recall:    {recall(y_imb, always_negative):.4f}")
    print(f"    F1 Score:  {f1_score(y_imb, always_negative):.4f}")

    X_tr_i, y_tr_i, X_v_i, y_v_i, X_te_i, y_te_i = train_val_test_split(X_imb, y_imb)
    model_imb = SimpleLogistic(lr=0.5, epochs=500)
    model_imb.fit(X_tr_i, y_tr_i)
    y_pred_imb = [model_imb.predict(x) for x in X_te_i]
    print(f"\n  Trained model on imbalanced data:")
    print(f"    Accuracy:  {accuracy(y_te_i, y_pred_imb):.4f}")
    print(f"    Precision: {precision(y_te_i, y_pred_imb):.4f}")
    print(f"    Recall:    {recall(y_te_i, y_pred_imb):.4f}")
    print(f"    F1 Score:  {f1_score(y_te_i, y_pred_imb):.4f}")

    print("\n=== Regression Metrics ===")
    X_reg, y_reg = make_regression_data(200)

    col0 = [x[0] for x in X_reg]
    col1 = [x[1] for x in X_reg]
    col0_s, m0, s0 = standardize(col0)
    col1_s, m1, s1 = standardize(col1)
    X_reg_scaled = [[col0_s[i], col1_s[i]] for i in range(len(X_reg))]

    X_tr_r, y_tr_r, X_v_r, y_v_r, X_te_r, y_te_r = train_val_test_split(X_reg_scaled, y_reg)
    reg_model = SimpleLinearRegression(lr=0.01, epochs=500)
    reg_model.fit(X_tr_r, y_tr_r)
    y_pred_r = [reg_model.predict(x) for x in X_te_r]

    print(f"  MSE:       {mse(y_te_r, y_pred_r):.4f}")
    print(f"  RMSE:      {rmse(y_te_r, y_pred_r):.4f}")
    print(f"  MAE:       {mae(y_te_r, y_pred_r):.4f}")
    print(f"  R-squared: {r_squared(y_te_r, y_pred_r):.4f}")

    mean_baseline = [sum(y_tr_r) / len(y_tr_r)] * len(y_te_r)
    print(f"\n  Mean baseline:")
    print(f"    MSE:       {mse(y_te_r, mean_baseline):.4f}")
    print(f"    R-squared: {r_squared(y_te_r, mean_baseline):.4f}")

    print("\n=== Learning Curve ===")
    sizes, train_sc, val_sc = learning_curve(
        X_clf, y_clf,
        model_fn=lambda: SimpleLogistic(lr=0.1, epochs=200),
        metric_fn=accuracy,
    )
    print(f"  {'Size':>6} {'Train':>8} {'Val':>8}")
    for s, tr, va in zip(sizes, train_sc, val_sc):
        print(f"  {s:>6} {tr:>8.4f} {va:>8.4f}")

    print("\n=== Statistical Model Comparison ===")
    model_a_scores = cross_validate(
        X_clf, y_clf,
        model_fn=lambda: SimpleLogistic(lr=0.1, epochs=100),
        k=5, metric_fn=accuracy,
    )
    model_b_scores = cross_validate(
        X_clf, y_clf,
        model_fn=lambda: SimpleLogistic(lr=0.1, epochs=500),
        k=5, metric_fn=accuracy,
    )
    diffs = [a - b for a, b in zip(model_a_scores, model_b_scores)]
    mean_diff = sum(diffs) / len(diffs)
    std_diff = math.sqrt(sum((d - mean_diff) ** 2 for d in diffs) / len(diffs))
    t_stat = mean_diff / (std_diff / math.sqrt(len(diffs))) if std_diff > 0 else 0.0
    print(f"  Model A (100 epochs) mean: {sum(model_a_scores)/len(model_a_scores):.4f}")
    print(f"  Model B (500 epochs) mean: {sum(model_b_scores)/len(model_b_scores):.4f}")
    print(f"  Mean difference: {mean_diff:.4f}")
    print(f"  Paired t-statistic: {t_stat:.4f}")
    print(f"  (|t| > 2.78 for significance at p<0.05 with df=4)")
```

## Kullan onu

Scikit-learn ile değerlendirme iş akışının içine yerleştirilmiştir:

```python
from sklearn.model_selection import cross_val_score, StratifiedKFold, learning_curve
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    roc_auc_score, confusion_matrix, mean_squared_error, r2_score,
)
from sklearn.linear_model import LogisticRegression

model = LogisticRegression()
scores = cross_val_score(model, X, y, cv=StratifiedKFold(5), scoring="f1")
```

Sıfırdan sürümler, çapraz doğrulamanın tam olarak ne yaptığını (sihir yok, yalnızca for-döngüler ve dizin izleme), her bir metriğin nasıl hesaplandığını (yalnızca TP/FP/TN/FN sayımı) ve katmanlaştırmanın neden önemli olduğunu (her katlamada sınıf oranlarını koruyarak) gösterir. Kitaplık sürümleri paralellik, daha fazla puanlama seçeneği ve işlem hatlarıyla entegrasyon ekler.

## Gönderin

Bu ders şunları üretir:
- `outputs/skill-evaluation.md` - sınıflandırma ve regresyon modelleri için değerlendirme stratejisini kapsayan bir beceri

## Egzersizler

1. Hassasiyet-geri çağırma eğrilerini uygulayın: Farklı eşik değerlerinde hassasiyet ve geri çağırmanın grafiğini çizin. Ortalama hassasiyeti hesaplayın (PR eğrisinin altındaki alan). Dengesiz bir dataset'de PR eğrisini ROC eğrisiyle karşılaştırın ve her birinin ne zaman daha bilgilendirici olduğunu açıklayın.
2. İç içe geçmiş bir çapraz doğrulama döngüsü oluşturun: dış döngü model performansını değerlendirir, iç döngü ise hiperparametreleri ayarlar. Doğrulama verilerini değerlendirmeye sızdırmadan iki modeli adil bir şekilde karşılaştırmak için bunu kullanın.
3. Model karşılaştırması için bir permütasyon testi uygulayın: etiketleri karıştırın, yeniden eğitin ve performansı ölçün. Boş bir dağıtım oluşturmak için 100 kez tekrarlayın. Bu dağılıma göre gözlemlenen model performansına ilişkin p-değerini hesaplayın.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|----------------------|
| Aşırı uyum | "Eğitim verilerinin hafızaya alınması" | Model, eğitim verilerindeki gürültüyü yakalayarak eğitimde iyi performans gösterirken görünmeyen verilerde zayıf performans sergiliyor |
| Çapraz doğrulama | "Farklı alt kümeler üzerinde test etme" | Doğrulama için verinin hangi bölümünün kullanılacağı sistematik olarak döndürülerek, tüm döndürmelerdeki sonuçların ortalaması alınır |
| Hassasiyet | "Tahmin edilen pozitiflerden kaç tanesi doğrudur" | TP / (TP + FP): Olumlu tahminlerin gerçekte olumlu olan oranı |
| Geri Çağırma | "Kaç tane gerçek pozitif bulduk" | TP / (TP + FN): Doğru şekilde tanımlanan gerçek pozitiflerin oranı |
| AUC-ROC | "Modelin sınıfları ne kadar iyi ayırdığı" | 0,5'ten (rastgele) 1,0'a (mükemmel) kadar tüm eşiklerde gerçek pozitif oranı ile yanlış pozitif oranı eğrisinin altındaki alan |
| R-kare | "Farklılığın ne kadarı açıklandı" | 1 - (artık karelerin toplamı / karelerin toplam toplamı): model tarafından yakalanan hedef varyansın oranı |
| Veri sızıntısı | "Model hile yaptı" | Eğitim sırasında tahmin zamanında mevcut olmayacak bilgilerin kullanılması iyimser değerlendirmeye yol açar |
| Öğrenme eğrisi | "Daha fazla veriyle performans nasıl değişir?" | Yetersiz uyumu veya aşırı uyumu ortaya çıkaran eğitim ve doğrulama puanlarının eğitim seti boyutuna göre grafiği |
| Katmanlı bölünme | "Sınıf oranlarını dengede tutmak" | Verileri, her bir alt kümenin her sınıf için tam dataset ile aynı orana sahip olacağı şekilde bölmek |

## Daha Fazla Okuma

- [scikit-learn Model Seçim Kılavuzu](https://scikit-learn.org/stable/model_selection.html) - çapraz doğrulama, ölçümler ve hiperparametre ayarlama hakkında kapsamlı referans
- [Doğruluğun Ötesinde: Hassasiyet ve Geri Çağırma (Google ML Hızlandırılmış Kursu)](https://developers.google.com/machine-learning/crash-course/classification/precision-and-recall) - etkileşimli örneklerle net açıklama
- [Çapraz Doğrulama Prosedürleri Araştırması (Arlot ve Celisse, 2010)](https://projecteuclid.org/journals/statistics-surveys/volume-4/issue-none/A-survey-of-cross-validation-procedures-for-model-selection/10.1214/09-SS054.full) - farklı CV stratejilerinin ne zaman ve neden işe yaradığının titizlikle ele alınması
