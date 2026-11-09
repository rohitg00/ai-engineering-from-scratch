# Denetimsiz Öğrenme

> Etiket yok, öğretmen yok.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 1 (Norms & Distances, Probability & Distributions), Phase 2 Lessons 1-6
**Time:** ~90 minutes

## Öğrenme Hedefleri

- K-Means, DBSCAN ve Gaussian Karışıklık Modellerini sıfırdan uygulayın ve gruplama davranışlarını karşılaştırın
- Optimal K seçmek için silüette puanı ve dirsek yöntemi kullanarak klüster kalitesini değerlendir
- DBSCAN'ın K-Means'ı ne zaman geçirdiğini açıklayın ve hangi algoritmanın küre dışı kümeleri ve dış değerleri ele aldığını belirleyin.
- Normal desenlerden farklı noktaları işaretlemek için gruplama yöntemleri kullanarak anomali tespit boru hattı oluşturmak

## Sorun

Şimdiye kadar her ML dersi etiketlenen verileri varsaydı: "burada bir giriş, burada doğru çıkış var". Gerçek dünyada etiketler pahalı. Bir hastanenin milyonlarca hastane kayıtları var ama kimse her hastaneyi bir hastalık kategorisine işaretlememiştir. Bir e-ticaret sitesi milyonlarca kullanıcı seansına sahiptir ama hiçbiri el etiketleri ile müşteri segmentlerine sahip değildir. Güvenlik ekibi ağ kayıtlarına sahip ama hiç kimse her anomaliyi işaretlememiştir.

Gözetimsiz öğrenme, neye bakması gerektiğini söylemeden kalıpları bulur. Benzer veri noktalarını gruplar, gizli yapıları keşfeder ve anomalileri yüze çıkarır. Gözetimsiz öğrenme bir cevap anahtarı olan bir ders kitabı ile öğrenirse, gözetimsiz öğrenme kalıplar ortaya çıkana kadar ham verilere bakıyor.

Açıkçası, etiketsiz "sağ" veya "sağ"ı doğrudan ölçemezsiniz. Algoritmanızın bulduğu yapının anlamlı olup olmadığını değerlendirmek için farklı araçlara ihtiyacınız var.

## Anlaşım

### Gruplama: Eşyaları Bir araya getirmek

Gruplama, her veri noktasını bir gruba (cluster) tahsis eder, böylece aynı grubun içindeki noktalar diğer gruplardaki noktalara göre birbirine daha çok benzer.

```mermaid
flowchart LR
    A[Raw Data] --> B{Choose Method}
    B --> C[K-Means]
    B --> D[DBSCAN]
    B --> E[Hierarchical]
    B --> F[GMM]
    C --> G[Flat, spherical clusters]
    D --> H[Arbitrary shapes, noise detection]
    E --> I[Tree of nested clusters]
    F --> J[Soft assignments, elliptical clusters]
```

### K-Means: İş Atı

K-Means verileri tam olarak K kümelerine ayırır. Her kümenin bir merkez bölgesi (masası merkezi) vardır ve her nokta en yakın merkez bölgesine aittir.

Lloyd'un algoritması:

1. K'yi başlangıç merkezleri olarak seçin
2. Her veri noktasını en yakın merkez noktasına tahsis edin
3. Her merkez bölgeyi, verilen noktaların ortalaması olarak hesaplayın
4. Görevler değişmeyi bırakana kadar adımları 2-3 tekrarlayın

Objektif fonksiyon (inertia) her noktadan verilen merkezine toplam kare mesafeyi ölçer. K-Means bunu en aza indirir, ancak sadece yerel bir minimum bulur.

### K'yi seçmek

İki standart yöntem:

**Elbow method:**K-Means için çalıştır $K = 1, 2, 3, \ldots, n$. Plot inertia vs K. Daha fazla kümeler eklemek inersiyanı önemli ölçüde azaltmayı durdurduğu "kökü" için bakın.

**Silhouette score:**Her nokta için kendi kümeye ne kadar benzer olduğunu ölç ($a$) ile en yakın diğer kümeler arasında ($b$), silüette katılamı $(b - a) / \max(a, b)$, -1 ( yanlışı) ile +1 (iyi bir gruplama) arasında değişen.

### DBSCAN: Sıklık Temelinde Gruplama

K-Means, kümelerin küresel olduğunu varsayır ve K'yi önceden seçmenizi gerektirir. DBSCAN hiçbir varsayım yapmaz.

İki parametre:
- **eps**: bir mahalle radyüsü
- **min_samples**: yoğun bir bölge oluşturmak için gereken en az nokta sayısı

Üç tip nokta:
- **Core point**: eps mesafesinde en az min_sampel noktaları vardır
- **Border point**: bir çekirdek noktasının eps'lerinde ama kendisi çekirdek noktası değil
- **Noise point**Bu değerler dış seviyelerdir.

DBSCAN, birbirinden eps uzaklıkta bulunan çekirdek noktaları aynı küme ile bağlar. Sınır noktaları yakın bir çekirdek noktasının kümesine katılır.

Güçleri: herhangi bir şekildeki kümeleri bulur, kümelerin sayısını otomatik olarak belirler, dış değerleri belirler. Zayıflık: değişik yoğunluklu kümelerle mücadele eder.

### Yerarşik Gruplama

Yatağındaki kümelerden oluşan bir ağaç (dendrogram) oluşturur.

Agglomeratif (altından yukarı):
1. Her noktayı kendi kümesi olarak başlat .
2. En yakın iki kümesi birleştir .
3. Tekrarlayın , sadece bir küme kalana kadar
4. K kümeleri elde etmek için dendrogramı istenen düzeyde kes

Gruplar arasındaki "yakınlık" aşağıdakiler gibi ölçülebilir:
- **Single linkage**: iki kümedeki herhangi iki noktanın arasındaki en az mesafe
- **Complete linkage**: herhangi iki nokta arasındaki maksimum mesafe
- **Average linkage**: tüm çiftler arasındaki ortalama mesafe
- **Ward's method**: küme içindeki toplam değişkenliğin en küçük artışına neden olan birleşim

### Gaussian Karışıklık Modelleri (GMM)

K-Means zor görevler verir: her nokta tam olarak bir küme aittir. GMM yumuşak görevler verir: her nokta her küme aittir olasılığına sahiptir.

GMM verilerin her biri kendi ortalaması ve kovariansı olan K Gaussian dağılımlarının bir karışımından üretildiğini varsayır.

- **E-step**: her noktanın her Gaussian ' a ait olma olasılığını hesaplayın
- **M-step**: verilerin olasılığını en üst düzeye çıkarmak için her Gaussian'ın ortalama, kovarians ve karışım ağırlığını güncelleyin

GMM eliptik kümeleri (K-Means gibi sadece küresel değil) modelleyebilir ve doğal olarak üst üste yığınan kümeleri ele alabilir.

### Hangi Zaman Kullanılır

| Method | Best for | Avoid when |
|--------|----------|------------|
| K-Means | Large datasets, spherical clusters, known K | Irregular shapes, outliers present |
| DBSCAN | Unknown K, arbitrary shapes, outlier detection | Varying densities, very high dimensions |
| Hierarchical | Small datasets, need dendrogram, unknown K | Large datasets ($O(n^2)$ memory) |
| GMM | Overlapping clusters, soft assignments needed | Very large datasets, too many dimensions |

### Gruplama ile Anomaly Deteksiyonu

Gruplama doğal olarak anomali tespitini destekler:
- **K-Means**: herhangi bir merkezden uzak noktalar anormallikler
- **DBSCAN**: gürültü noktaları tanımıyla anomalilerdir
- **GMM**Tüm Gaussiler altında düşük olasılık olan noktalar anormalliklerdir .

```figure
kmeans-step
```

## Yapın

### Adım 1: K-Yani sıfırdan

```python
import math
import random


def euclidean_distance(a, b):
    return math.sqrt(sum((ai - bi) ** 2 for ai, bi in zip(a, b)))


def kmeans(data, k, max_iterations=100, seed=42):
    random.seed(seed)
    n_features = len(data[0])

    centroids = random.sample(data, k)

    for iteration in range(max_iterations):
        clusters = [[] for _ in range(k)]
        assignments = []

        for point in data:
            distances = [euclidean_distance(point, c) for c in centroids]
            nearest = distances.index(min(distances))
            clusters[nearest].append(point)
            assignments.append(nearest)

        new_centroids = []
        for cluster in clusters:
            if len(cluster) == 0:
                new_centroids.append(random.choice(data))
                continue
            centroid = [
                sum(point[j] for point in cluster) / len(cluster)
                for j in range(n_features)
            ]
            new_centroids.append(centroid)

        if all(
            euclidean_distance(old, new) < 1e-6
            for old, new in zip(centroids, new_centroids)
        ):
            print(f"  Converged at iteration {iteration + 1}")
            break

        centroids = new_centroids

    return assignments, centroids
```

### Adım 2: Elbow metodu ve siluet skor

```python
def compute_inertia(data, assignments, centroids):
    total = 0.0
    for point, cluster_id in zip(data, assignments):
        total += euclidean_distance(point, centroids[cluster_id]) ** 2
    return total


def silhouette_score(data, assignments):
    n = len(data)
    if n < 2:
        return 0.0

    clusters = {}
    for i, c in enumerate(assignments):
        clusters.setdefault(c, []).append(i)

    if len(clusters) < 2:
        return 0.0

    scores = []
    for i in range(n):
        own_cluster = assignments[i]
        own_members = [j for j in clusters[own_cluster] if j != i]

        if len(own_members) == 0:
            scores.append(0.0)
            continue

        a = sum(euclidean_distance(data[i], data[j]) for j in own_members) / len(own_members)

        b = float("inf")
        for cluster_id, members in clusters.items():
            if cluster_id == own_cluster:
                continue
            avg_dist = sum(euclidean_distance(data[i], data[j]) for j in members) / len(members)
            b = min(b, avg_dist)

        if max(a, b) == 0:
            scores.append(0.0)
        else:
            scores.append((b - a) / max(a, b))

    return sum(scores) / len(scores)


def find_best_k(data, max_k=10):
    print("Elbow method:")
    inertias = []
    for k in range(1, max_k + 1):
        assignments, centroids = kmeans(data, k)
        inertia = compute_inertia(data, assignments, centroids)
        inertias.append(inertia)
        print(f"  K={k}: inertia={inertia:.2f}")

    print("\nSilhouette scores:")
    for k in range(2, max_k + 1):
        assignments, centroids = kmeans(data, k)
        score = silhouette_score(data, assignments)
        print(f"  K={k}: silhouette={score:.4f}")

    return inertias
```

### Adım 3: DBSCAN sıfırdan

```python
def dbscan(data, eps, min_samples):
    n = len(data)
    labels = [-1] * n
    cluster_id = 0

    def region_query(point_idx):
        neighbors = []
        for i in range(n):
            if euclidean_distance(data[point_idx], data[i]) <= eps:
                neighbors.append(i)
        return neighbors

    visited = [False] * n

    for i in range(n):
        if visited[i]:
            continue
        visited[i] = True

        neighbors = region_query(i)

        if len(neighbors) < min_samples:
            labels[i] = -1
            continue

        labels[i] = cluster_id
        seed_set = list(neighbors)
        seed_set.remove(i)

        j = 0
        while j < len(seed_set):
            q = seed_set[j]

            if not visited[q]:
                visited[q] = True
                q_neighbors = region_query(q)
                if len(q_neighbors) >= min_samples:
                    for nb in q_neighbors:
                        if nb not in seed_set:
                            seed_set.append(nb)

            if labels[q] == -1:
                labels[q] = cluster_id

            j += 1

        cluster_id += 1

    return labels
```

### Adım 4: Gaussian Karışıklık Modülü (EM algoritması)

```python
def gmm(data, k, max_iterations=100, seed=42):
    random.seed(seed)
    n = len(data)
    d = len(data[0])

    indices = random.sample(range(n), k)
    means = [list(data[i]) for i in indices]
    variances = [1.0] * k
    weights = [1.0 / k] * k

    def gaussian_pdf(x, mean, variance):
        d = len(x)
        coeff = 1.0 / ((2 * math.pi * variance) ** (d / 2))
        exponent = -sum((xi - mi) ** 2 for xi, mi in zip(x, mean)) / (2 * variance)
        return coeff * math.exp(max(exponent, -500))

    for iteration in range(max_iterations):
        responsibilities = []
        for i in range(n):
            probs = []
            for j in range(k):
                probs.append(weights[j] * gaussian_pdf(data[i], means[j], variances[j]))
            total = sum(probs)
            if total == 0:
                total = 1e-300
            responsibilities.append([p / total for p in probs])

        old_means = [list(m) for m in means]

        for j in range(k):
            r_sum = sum(responsibilities[i][j] for i in range(n))
            if r_sum < 1e-10:
                continue

            weights[j] = r_sum / n

            for dim in range(d):
                means[j][dim] = sum(
                    responsibilities[i][j] * data[i][dim] for i in range(n)
                ) / r_sum

            variances[j] = sum(
                responsibilities[i][j]
                * sum((data[i][dim] - means[j][dim]) ** 2 for dim in range(d))
                for i in range(n)
            ) / (r_sum * d)
            variances[j] = max(variances[j], 1e-6)

        shift = sum(
            euclidean_distance(old_means[j], means[j]) for j in range(k)
        )
        if shift < 1e-6:
            print(f"  GMM converged at iteration {iteration + 1}")
            break

    assignments = []
    for i in range(n):
        assignments.append(responsibilities[i].index(max(responsibilities[i])))

    return assignments, means, weights, responsibilities
```

### Adım 5: Test verilerini oluşturun ve her şeyi çalıştırın

```python
def make_blobs(centers, n_per_cluster=50, spread=0.5, seed=42):
    random.seed(seed)
    data = []
    true_labels = []
    for label, (cx, cy) in enumerate(centers):
        for _ in range(n_per_cluster):
            x = cx + random.gauss(0, spread)
            y = cy + random.gauss(0, spread)
            data.append([x, y])
            true_labels.append(label)
    return data, true_labels


def make_moons(n_samples=200, noise=0.1, seed=42):
    random.seed(seed)
    data = []
    labels = []
    n_half = n_samples // 2
    for i in range(n_half):
        angle = math.pi * i / n_half
        x = math.cos(angle) + random.gauss(0, noise)
        y = math.sin(angle) + random.gauss(0, noise)
        data.append([x, y])
        labels.append(0)
    for i in range(n_half):
        angle = math.pi * i / n_half
        x = 1 - math.cos(angle) + random.gauss(0, noise)
        y = 1 - math.sin(angle) - 0.5 + random.gauss(0, noise)
        data.append([x, y])
        labels.append(1)
    return data, labels


if __name__ == "__main__":
    centers = [[2, 2], [8, 3], [5, 8]]
    data, true_labels = make_blobs(centers, n_per_cluster=50, spread=0.8)

    print("=== K-Means on 3 blobs ===")
    assignments, centroids = kmeans(data, k=3)
    print(f"  Centroids: {[[round(c, 2) for c in cent] for cent in centroids]}")
    sil = silhouette_score(data, assignments)
    print(f"  Silhouette score: {sil:.4f}")

    print("\n=== Elbow Method ===")
    find_best_k(data, max_k=6)

    print("\n=== DBSCAN on 3 blobs ===")
    db_labels = dbscan(data, eps=1.5, min_samples=5)
    n_clusters = len(set(db_labels) - {-1})
    n_noise = db_labels.count(-1)
    print(f"  Found {n_clusters} clusters, {n_noise} noise points")

    print("\n=== GMM on 3 blobs ===")
    gmm_assignments, gmm_means, gmm_weights, _ = gmm(data, k=3)
    print(f"  Means: {[[round(m, 2) for m in mean] for mean in gmm_means]}")
    print(f"  Weights: {[round(w, 3) for w in gmm_weights]}")
    gmm_sil = silhouette_score(data, gmm_assignments)
    print(f"  Silhouette score: {gmm_sil:.4f}")

    print("\n=== DBSCAN on moons (non-spherical clusters) ===")
    moon_data, moon_labels = make_moons(n_samples=200, noise=0.1)
    moon_db = dbscan(moon_data, eps=0.3, min_samples=5)
    n_moon_clusters = len(set(moon_db) - {-1})
    n_moon_noise = moon_db.count(-1)
    print(f"  Found {n_moon_clusters} clusters, {n_moon_noise} noise points")

    print("\n=== K-Means on moons (will fail to separate) ===")
    moon_km, moon_centroids = kmeans(moon_data, k=2)
    moon_sil = silhouette_score(moon_data, moon_km)
    print(f"  Silhouette score: {moon_sil:.4f}")
    print("  K-Means splits moons poorly because they are not spherical")

    print("\n=== Anomaly detection with DBSCAN ===")
    anomaly_data = list(data)
    anomaly_data.append([20.0, 20.0])
    anomaly_data.append([-5.0, -5.0])
    anomaly_data.append([15.0, 0.0])
    anomaly_labels = dbscan(anomaly_data, eps=1.5, min_samples=5)
    anomalies = [
        anomaly_data[i]
        for i in range(len(anomaly_labels))
        if anomaly_labels[i] == -1
    ]
    print(f"  Detected {len(anomalies)} anomalies")
    for a in anomalies[-3:]:
        print(f"    Point {[round(v, 2) for v in a]}")
```

## Kullan

Scikit-learn ile aynı algoritmalar tek satırlı:

```python
from sklearn.cluster import KMeans, DBSCAN, AgglomerativeClustering
from sklearn.mixture import GaussianMixture
from sklearn.metrics import silhouette_score as sklearn_silhouette

km = KMeans(n_clusters=3, random_state=42).fit(data)
db = DBSCAN(eps=1.5, min_samples=5).fit(data)
agg = AgglomerativeClustering(n_clusters=3).fit(data)
gmm_model = GaussianMixture(n_components=3, random_state=42).fit(data)
```

K-Means, tahsis ve yeniden hesaplama arasında tekrarlama yapar. DBSCAN yoğun tohumlardan kümeler büyütür. GMM bekleme ve maksimumlama arasında değişir. Kitaplık sürümleri sayısal istikrar, daha akıllı başlangıç (K-Means++) ve GPU hızlandırımı ekler, ancak temel mantık aynıdır.

## Gönder

Bu ders, K-Means, DBSCAN ve GMM'nin çalışkan uygulamalarını sıfırdan üretir.

## Egzersizler

1. K-Means++ başlangıç uygulaması: rastgele centroidleri seçmek yerine, ilk merkezi rastgele ve sonraki her merkezi, en yakın mevcut merkezi arasındaki mesafesi karesine nispeten olan olasılık ile seçin.
2. Kodlara hiyerarşik aglomeratif gruplama ekleyin. Ward'ın bağlantısını uygulayın ve bir dendrogram (birleştirme listesi olarak) oluşturun.
3. Basit bir anomali tespit borusu oluşturun: DBSCAN ve GMM'yi aynı veriler üzerinde çalıştırın, her iki yöntemin de aynı fikirde olduğu işaret noktaları dış seviyeler (DBSCAN'da gürültü, GMM'de düşük olasılık)

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|----------------|----------------------|
| Clustering | "Grouping similar things" | Partitioning data into subsets where within-group similarity exceeds between-group similarity, measured by a specific distance metric |
| Centroid | "The center of a cluster" | The mean of all points assigned to a cluster; used by K-Means as the cluster representative |
| Inertia | "How tight the clusters are" | Sum of squared distances from each point to its assigned centroid; lower is tighter |
| Silhouette score | "How well-separated clusters are" | For each point, $(b - a) / \max(a, b)$ where $a$ is mean intra-cluster distance and $b$ is mean nearest-cluster distance |
| Core point | "A point in a dense region" | A point with at least min_samples neighbors within eps distance, in DBSCAN |
| EM algorithm | "Soft K-Means" | Expectation-Maximization: iteratively compute membership probabilities (E-step) and update distribution parameters (M-step) |
| Dendrogram | "A tree of clusters" | A tree diagram showing the order and distance at which clusters were merged in hierarchical clustering |
| Anomaly | "An outlier" | A data point that does not conform to the expected pattern, identified as noise by DBSCAN or low-probability by GMM |

## Daha Fazla Okumak

- [Stanford CS229 - Unsupervised Learning](https://cs229.stanford.edu/notes2022fall/main_notes.pdf)- Andrew Ng'in gruplama ve EM üzerine ders notları
- [scikit-learn Clustering Guide](https://scikit-learn.org/stable/modules/clustering.html)- Tüm gruplama algoritmalarının görsel örneklerle pratik bir karşılaştırması
- [DBSCAN original paper (Ester et al., 1996)](https://www.aaai.org/Papers/KDD/1996/KDD96-037.pdf)- yoğunluk tabanlı gruplama başlatılan kağıt
