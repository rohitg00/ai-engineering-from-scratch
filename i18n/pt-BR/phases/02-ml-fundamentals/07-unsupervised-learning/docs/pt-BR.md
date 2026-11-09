# Aprender sem supervisão

> Sem rótulos, sem professores, o algoritmo encontra estrutura por si só.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 1 (Norms & Distances, Probability & Distributions), Phase 2 Lessons 1-6
**Time:** ~90 minutes

## Objetivos de aprendizagem

- Implementar K-Means, DBSCAN e Gaussian Mix Models a partir do zero e comparar seu comportamento de agrupamento
- Avaliação da qualidade do cluster utilizando a pontuação da silueta e o método do cotovelo para selecionar o K ideal
- Explicar quando o DBSCAN supera os K-Means e identificar qual algoritmo lida com aglomerados não esféricos e valores fora do horizonte
- Construir um canal de detecção de anomalias utilizando métodos de agrupamento para marcar pontos que se desviam dos padrões normais

## O problema

Todas as aulas de ML até agora assumiram dados rotulados: "aqui está a entrada, aqui está a saída correta". No mundo real, os rótulos são caros. Um hospital tem milhões de registos de pacientes, mas ninguém tem marcado manualmente cada um com uma categoria de doença. Um site de comércio eletrônico tem milhões de sessões de usuários, mas ninguém tem segmentos de clientes etiquetados à mão. Uma equipa de segurança tem registos de rede, mas ninguém marcou todas as anomalias.

A aprendizagem não supervisionada encontra padrões sem que se lhe diga o que procurar. Agrupa pontos de dados semelhantes, descobre estruturas ocultas e supervisiona anomalias.

A questão é: sem rótulos, não se pode medir diretamente o "certo" ou o "errado".

## O conceito

### Agrupamento: Agrupamento de coisas semelhantes

O clustering atribui cada ponto de dados a um grupo (cluster) de modo que os pontos dentro do mesmo grupo são mais semelhantes uns aos outros do que aos pontos em outros grupos.

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

### K-Means: O Cavalo de Trabalho

K-Means divide os dados em aglomerados exatamente K. Cada aglomerado tem um centróide (seu centro de massa), e cada ponto pertence ao centroide mais próximo.

Algoritmo de Lloyd:

1. Escolha pontos aleatórios K como centroides iniciais
2. Asigne cada ponto de dados para o centroide mais próximo
3. Recompõe cada centróide como a média dos seus pontos atribuídos
4. Repita os passos 2-3 até que as atribuições parem de mudar

A função objetiva (inertia) mede a distância total quadrada de cada ponto até o centroide atribuído. K-Means minimiza isso, mas só encontra um mínimo local.

### Escolher K

Dois métodos padrão:

**Elbow method:**- Correr K-Means para $K = 1, 2, 3, \ldots, n$. Inércia de trama vs K. Procure o "cotovelo" onde adicionar mais aglomerados para reduzir significativamente a inércia.

**Silhouette score:**Para cada ponto, medir o quão semelhante é ao seu próprio cluster ($a$) contra o outro aglomerado mais próximo ($b$O coeficiente de silhueta é $(b - a) / \max(a, b)$, que varia de -1 (cluster errado) a +1 (bem agrupado).

### DBSCAN: Clustering baseado na densidade

O K-Means assume que os aglomerados são esféricos e exige que você escolha K com antecedência.

Dois parâmetros:
- **eps**: o raio de um bairro
- **min_samples**: o número mínimo de pontos necessários para formar uma região densa

Três tipos de pontos:
- **Core point**: tem pelo menos min_samples points dentro de eps distância
- **Border point**: dentro de eps de um ponto central, mas não em si um ponto central
- **Noise point**Não há núcleo nem fronteira, são excepcionais.

DBSCAN conecta pontos centrais que estão dentro de eps um do outro para o mesmo grupo. pontos de fronteira juntar-se ao grupo de um ponto central próximo. pontos de ruído não pertencem a nenhum grupo.

Forças: encontra aglomerados de qualquer forma, determina automaticamente o número de aglomerados, identifica valores anormais.

### Clustering hierárquico

Construi uma árvore (dendrograma) de aglomerados aninhados.

Aglomerativo (de baixo para cima):
1. Comece com cada ponto como seu próprio aglomerado
2. Fundi os dois aglomerados mais próximos
3. Repita até que apenas um grupo permaneça
4. Cortar o dendrograma no nível desejado para obter aglomerados K

A "certeza" entre os aglomerados pode ser medida como:
- **Single linkage**: distância mínima entre quaisquer dois pontos dos dois aglomerados
- **Complete linkage**: distância máxima entre quaisquer dois pontos
- **Average linkage**: distância média entre todos os pares
- **Ward's method**: a fusão que causa o menor aumento da variância total dentro do cluster

### Modelos de mistura gaussiana (GMM)

K-Means dá atribuições difíceis: cada ponto pertence a exatamente um cluster. GMM dá atribuições macias: cada ponto tem uma probabilidade de pertencer a cada cluster.

GMM assume que os dados são gerados a partir de uma mistura de distribuições de K Gaussian, cada uma com sua própria média e covariância.

- **E-step**: calcular a probabilidade de cada ponto pertencer a cada Gaussian
- **M-step**A partir da data de obtenção dos dados, a data de obtenção dos dados deve ser de acordo com o método de cálculo.

O GMM pode modelar aglomerados elípticos (não apenas esféricos como K-Means) e naturalmente lida com aglomerados sobrepostos.

### Quando usar qual

| Method | Best for | Avoid when |
|--------|----------|------------|
| K-Means | Large datasets, spherical clusters, known K | Irregular shapes, outliers present |
| DBSCAN | Unknown K, arbitrary shapes, outlier detection | Varying densities, very high dimensions |
| Hierarchical | Small datasets, need dendrogram, unknown K | Large datasets ($O(n^2)$ memory) |
| GMM | Overlapping clusters, soft assignments needed | Very large datasets, too many dimensions |

### Detecção de anomalias com aglomeração

O agrupamento suporta naturalmente a detecção de anomalias:
- **K-Means**Os pontos distantes de qualquer centroide são anomalias .
- **DBSCAN**: pontos de ruído são anomalias por definição
- **GMM**Os pontos com baixa probabilidade em todos os Gaussianos são anomalias .

```figure
kmeans-step
```

## Construí-lo

### Passo 1: K-Means do zero

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

### Passo 2: Método de cotovelo e pontuação de silueta

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

### Passo 3: DBSCAN a partir do zero

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

### Passo 4: Modelo de mistura gaussiana (algoritmo EM)

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

### Passo 5: Gerar dados de teste e executar tudo

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

## Usá-lo

Com o scikit-learn, os mesmos algoritmos são de linha única:

```python
from sklearn.cluster import KMeans, DBSCAN, AgglomerativeClustering
from sklearn.mixture import GaussianMixture
from sklearn.metrics import silhouette_score as sklearn_silhouette

km = KMeans(n_clusters=3, random_state=42).fit(data)
db = DBSCAN(eps=1.5, min_samples=5).fit(data)
agg = AgglomerativeClustering(n_clusters=3).fit(data)
gmm_model = GaussianMixture(n_components=3, random_state=42).fit(data)
```

As versões do zero mostram exatamente o que essas bibliotecas compute. K-Means itera entre atribuir e recomputar. DBSCAN cresce aglomerados a partir de sementes densas. GMM alternar entre a expectativa e a maximização. As versões da biblioteca adicionam estabilidade numérica, inicialização mais inteligente (K-Means ++), e aceleração da GPU, mas a lógica central é a mesma.

## Envia-o

Esta lição produz implementações de trabalho de K-Means, DBSCAN e GMM a partir do zero.

## Exercícios

1. Implementar a inicialização K-Means++: em vez de escolher centróides aleatórios, escolha o primeiro aleatoriamente e cada centróide subsequente com probabilidade proporcional à sua distância quadrada do centroide existente mais próximo. Compare a velocidade de convergência com a inicialização aleatória.
2. Adicione aglomeração hierárquica ao código. Implemente a ligação de Ward e produzir um dendrograma (como uma lista aninhada de fusões). Corte-o em diferentes níveis e compare com os resultados de K-Means.
3. Construir um simples pipeline de detecção de anomalias: executar DBSCAN e GMM nos mesmos dados, pontos de referência que ambos os métodos concordarem são anormais (ruído em DBSCAN, baixa probabilidade em GMM).

## Termos-chave

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

## Mais leitura

- [Stanford CS229 - Unsupervised Learning](https://cs229.stanford.edu/notes2022fall/main_notes.pdf)- Notas de Andrew Ng sobre clustering e EM
- [scikit-learn Clustering Guide](https://scikit-learn.org/stable/modules/clustering.html)- comparação prática de todos os algoritmos de agrupamento com exemplos visuais
- [DBSCAN original paper (Ester et al., 1996)](https://www.aaai.org/Papers/KDD/1996/KDD96-037.pdf)- o papel que introduziu o agrupamento baseado na densidade
