import math
import random


def l1_norm(x):
    return sum(abs(xi) for xi in x)


def l2_norm(x):
    return math.sqrt(sum(xi ** 2 for xi in x))


def lp_norm(x, p):
    if p == float('inf'):
        return max(abs(xi) for xi in x)
    return sum(abs(xi) ** p for xi in x) ** (1 / p)


def linf_norm(x):
    return max(abs(xi) for xi in x)


def l1_distance(a, b):
    return sum(abs(ai - bi) for ai, bi in zip(a, b))


def l2_distance(a, b):
    return math.sqrt(sum((ai - bi) ** 2 for ai, bi in zip(a, b)))


def lp_distance(a, b, p):
    diff = [ai - bi for ai, bi in zip(a, b)]
    return lp_norm(diff, p)


def linf_distance(a, b):
    return max(abs(ai - bi) for ai, bi in zip(a, b))


def dot_product(a, b):
    return sum(ai * bi for ai, bi in zip(a, b))


def cosine_similarity(a, b):
    dot = dot_product(a, b)
    norm_a = l2_norm(a)
    norm_b = l2_norm(b)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


def cosine_distance(a, b):
    return 1.0 - cosine_similarity(a, b)


def mahalanobis_distance(x, y, cov_matrix):
    n = len(x)
    diff = [xi - yi for xi, yi in zip(x, y)]

    inv_cov = invert_matrix(cov_matrix)

    temp = [0.0] * n
    for i in range(n):
        for j in range(n):
            temp[i] += diff[j] * inv_cov[j][i]

    result = sum(temp[i] * diff[i] for i in range(n))
    return math.sqrt(max(0, result))


def invert_matrix(matrix):
    n = len(matrix)
    augmented = [row[:] + [1.0 if i == j else 0.0 for j in range(n)] for i, row in enumerate(matrix)]

    for col in range(n):
        max_row = col
        for row in range(col + 1, n):
            if abs(augmented[row][col]) > abs(augmented[max_row][col]):
                max_row = row
        augmented[col], augmented[max_row] = augmented[max_row], augmented[col]

        pivot = augmented[col][col]
        if abs(pivot) < 1e-12:
            raise ValueError("Matrix is singular or near-singular")
        for j in range(2 * n):
            augmented[col][j] /= pivot

        for row in range(n):
            if row != col:
                factor = augmented[row][col]
                for j in range(2 * n):
                    augmented[row][j] -= factor * augmented[col][j]

    return [row[n:] for row in augmented]


def jaccard_similarity(set_a, set_b):
    if not set_a and not set_b:
        return 1.0
    intersection = len(set_a & set_b)
    union = len(set_a | set_b)
    return intersection / union


def jaccard_distance(set_a, set_b):
    return 1.0 - jaccard_similarity(set_a, set_b)


def edit_distance(s1, s2):
    m, n = len(s1), len(s2)
    dp = [[0] * (n + 1) for _ in range(m + 1)]

    for i in range(m + 1):
        dp[i][0] = i
    for j in range(n + 1):
        dp[0][j] = j

    for i in range(1, m + 1):
        for j in range(1, n + 1):
            if s1[i - 1] == s2[j - 1]:
                dp[i][j] = dp[i - 1][j - 1]
            else:
                dp[i][j] = 1 + min(
                    dp[i - 1][j],
                    dp[i][j - 1],
                    dp[i - 1][j - 1]
                )

    return dp[m][n]


def kl_divergence(p, q):
    total = 0.0
    for pi, qi in zip(p, q):
        if pi > 0:
            if qi <= 0:
                return float('inf')
            total += pi * math.log(pi / qi)
    return total


def wasserstein_1d(p, q):
    assert len(p) == len(q), "Distributions must have the same number of bins"
    n = len(p)
    cdf_p = [0.0] * n
    cdf_q = [0.0] * n

    cdf_p[0] = p[0]
    cdf_q[0] = q[0]
    for i in range(1, n):
        cdf_p[i] = cdf_p[i - 1] + p[i]
        cdf_q[i] = cdf_q[i - 1] + q[i]

    return sum(abs(cdf_p[i] - cdf_q[i]) for i in range(n))


def compute_covariance(data):
    n = len(data)
    d = len(data[0])
    means = [sum(data[i][j] for i in range(n)) / n for j in range(d)]
    centered = [[data[i][j] - means[j] for j in range(d)] for i in range(n)]
    cov = [[0.0] * d for _ in range(d)]
    for i in range(d):
        for j in range(d):
            cov[i][j] = sum(centered[k][i] * centered[k][j] for k in range(n)) / (n - 1)
    return cov


def normalize_vector(v):
    norm = l2_norm(v)
    if norm == 0:
        return v[:]
    return [vi / norm for vi in v]


def find_nearest_neighbor(query, dataset, distance_fn, **kwargs):
    best_idx = 0
    best_dist = float('inf')
    for i, point in enumerate(dataset):
        d = distance_fn(query, point, **kwargs)
        if d < best_dist:
            best_dist = d
            best_idx = i
    return best_idx, best_dist


def find_k_nearest(query, dataset, distance_fn, k=5, **kwargs):
    distances = []
    for i, point in enumerate(dataset):
        d = distance_fn(query, point, **kwargs)
        distances.append((i, d))
    distances.sort(key=lambda x: x[1])
    return distances[:k]


def demo_norms():
    print("=" * 65)
    print("NORMS: MEASURING VECTOR SIZE")
    print("=" * 65)

    vectors = [
        ("(3, 4)", [3, 4]),
        ("(1, 1, 1, 1)", [1, 1, 1, 1]),
        ("(5, 0, 0)", [5, 0, 0]),
        ("(1, 2, 3, 4, 5)", [1, 2, 3, 4, 5]),
    ]

    print(f"  {'Vector':<20s} {'L1':>8s} {'L2':>8s} {'L3':>8s} {'L-inf':>8s}")
    print(f"  {'-' * 20} {'-' * 8} {'-' * 8} {'-' * 8} {'-' * 8}")
    for name, v in vectors:
        print(f"  {name:<20s} {l1_norm(v):>8.3f} {l2_norm(v):>8.3f} "
              f"{lp_norm(v, 3):>8.3f} {linf_norm(v):>8.3f}")

    print()
    print("  Note: L-inf <= L2 <= L1 always holds.")
    print()


def demo_distances():
    print("=" * 65)
    print("DISTANCES BETWEEN TWO POINTS")
    print("=" * 65)

    a = [1, 2, 3]
    b = [4, 0, 6]

    print(f"  A = {a}")
    print(f"  B = {b}")
    print()
    print(f"  L1 (Manhattan):   {l1_distance(a, b):.4f}")
    print(f"  L2 (Euclidean):   {l2_distance(a, b):.4f}")
    print(f"  L3:               {lp_distance(a, b, 3):.4f}")
    print(f"  L-inf (Chebyshev):{linf_distance(a, b):.4f}")
    print(f"  Cosine distance:  {cosine_distance(a, b):.4f}")
    print(f"  Cosine similarity:{cosine_similarity(a, b):.4f}")
    print(f"  Dot product:      {dot_product(a, b):.4f}")
    print()


def demo_cosine_vs_dot():
    print("=" * 65)
    print("COSINE SIMILARITY vs DOT PRODUCT")
    print("=" * 65)

    a = [1, 2, 3]
    b = [2, 4, 6]
    c = [3, 1, 0]

    print(f"  A = {a}")
    print(f"  B = {b}  (A scaled by 2)")
    print(f"  C = {c}  (different direction)")
    print()
    print(f"  {'Pair':<10s} {'Cosine':>10s} {'Dot':>10s}")
    print(f"  {'-' * 10} {'-' * 10} {'-' * 10}")
    print(f"  {'A vs B':<10s} {cosine_similarity(a, b):>10.4f} {dot_product(a, b):>10.4f}")
    print(f"  {'A vs C':<10s} {cosine_similarity(a, c):>10.4f} {dot_product(a, c):>10.4f}")
    print(f"  {'B vs C':<10s} {cosine_similarity(b, c):>10.4f} {dot_product(b, c):>10.4f}")
    print()
    print("  Cosine says A and B are identical (same direction).")
    print("  Dot product says B is more similar because of larger magnitude.")
    print()

    a_norm = normalize_vector(a)
    b_norm = normalize_vector(b)
    c_norm = normalize_vector(c)

    print("  After L2 normalization:")
    print(f"  {'Pair':<10s} {'Cosine':>10s} {'Dot':>10s}")
    print(f"  {'-' * 10} {'-' * 10} {'-' * 10}")
    print(f"  {'A vs B':<10s} {cosine_similarity(a_norm, b_norm):>10.4f} {dot_product(a_norm, b_norm):>10.4f}")
    print(f"  {'A vs C':<10s} {cosine_similarity(a_norm, c_norm):>10.4f} {dot_product(a_norm, c_norm):>10.4f}")
    print()
    print("  After normalization, cosine and dot product are identical.")
    print()


def demo_mahalanobis():
    print("=" * 65)
    print("MAHALANOBIS DISTANCE")
    print("=" * 65)

    random.seed(42)
    n = 200
    data = []
    for _ in range(n):
        x = random.gauss(0, 3)
        y = 0.8 * x + random.gauss(0, 1)
        data.append([x, y])

    cov = compute_covariance(data)
    mean = [sum(d[0] for d in data) / n, sum(d[1] for d in data) / n]

    point_along = [mean[0] + 3, mean[1] + 0.8 * 3]
    point_perp = [mean[0] + 1, mean[1] - 3]

    l2_along = l2_distance(mean, point_along)
    l2_perp = l2_distance(mean, point_perp)
    mah_along = mahalanobis_distance(mean, point_along, cov)
    mah_perp = mahalanobis_distance(mean, point_perp, cov)

    print(f"  Data: {n} points with correlated features (r ~ 0.8)")
    print(f"  Mean: ({mean[0]:.2f}, {mean[1]:.2f})")
    print(f"  Covariance: [[{cov[0][0]:.2f}, {cov[0][1]:.2f}], [{cov[1][0]:.2f}, {cov[1][1]:.2f}]]")
    print()
    print(f"  Point along correlation axis:  {[round(x, 2) for x in point_along]}")
    print(f"    L2 distance from mean:       {l2_along:.4f}")
    print(f"    Mahalanobis distance:         {mah_along:.4f}")
    print()
    print(f"  Point perpendicular to axis:   {[round(x, 2) for x in point_perp]}")
    print(f"    L2 distance from mean:       {l2_perp:.4f}")
    print(f"    Mahalanobis distance:         {mah_perp:.4f}")
    print()
    print("  L2 says both points are similar distances from the mean.")
    print("  Mahalanobis correctly identifies the perpendicular point as")
    print("  more unusual given the correlation structure of the data.")
    print()


def demo_jaccard():
    print("=" * 65)
    print("JACCARD SIMILARITY (SETS)")
    print("=" * 65)

    pairs = [
        ({"cat", "dog", "fish"}, {"cat", "bird", "fish", "snake"}),
        ({"python", "java", "rust"}, {"python", "java", "rust"}),
        ({"a", "b", "c"}, {"d", "e", "f"}),
        ({"ml", "ai", "data"}, {"ml", "ai", "data", "ops", "cloud"}),
    ]

    for a, b in pairs:
        j = jaccard_similarity(a, b)
        print(f"  A = {sorted(a)}")
        print(f"  B = {sorted(b)}")
        print(f"  Jaccard similarity: {j:.4f}")
        print(f"  Jaccard distance:   {1 - j:.4f}")
        print()


def demo_edit_distance():
    print("=" * 65)
    print("EDIT DISTANCE (LEVENSHTEIN)")
    print("=" * 65)

    pairs = [
        ("kitten", "sitting"),
        ("sunday", "saturday"),
        ("hello", "hello"),
        ("", "abc"),
        ("algorithm", "altruistic"),
        ("python", "pytorch"),
    ]

    for s1, s2 in pairs:
        d = edit_distance(s1, s2)
        print(f"  '{s1}' -> '{s2}':  distance = {d}")

    print()


def demo_kl_divergence():
    print("=" * 65)
    print("KL DIVERGENCE (NOT SYMMETRIC)")
    print("=" * 65)

    p = [0.9, 0.1]
    q = [0.5, 0.5]

    kl_pq = kl_divergence(p, q)
    kl_qp = kl_divergence(q, p)

    print(f"  P = {p}")
    print(f"  Q = {q}")
    print(f"  KL(P || Q) = {kl_pq:.4f} nats")
    print(f"  KL(Q || P) = {kl_qp:.4f} nats")
    print(f"  Difference: {abs(kl_pq - kl_qp):.4f}")
    print(f"  KL divergence is NOT a distance metric.")
    print()

    p2 = [0.25, 0.25, 0.25, 0.25]
    q2 = [0.1, 0.1, 0.1, 0.7]

    print(f"  P = {p2}")
    print(f"  Q = {q2}")
    print(f"  KL(P || Q) = {kl_divergence(p2, q2):.4f} nats")
    print(f"  KL(Q || P) = {kl_divergence(q2, p2):.4f} nats")
    print()


def demo_wasserstein():
    print("=" * 65)
    print("WASSERSTEIN DISTANCE (EARTH MOVER'S DISTANCE)")
    print("=" * 65)

    cases = [
        ("Identical",
         [0.25, 0.25, 0.25, 0.25],
         [0.25, 0.25, 0.25, 0.25]),
        ("Shifted right by 1",
         [0.5, 0.5, 0.0, 0.0],
         [0.0, 0.5, 0.5, 0.0]),
        ("Shifted right by 2",
         [0.5, 0.5, 0.0, 0.0],
         [0.0, 0.0, 0.5, 0.5]),
        ("Opposite ends",
         [1.0, 0.0, 0.0, 0.0],
         [0.0, 0.0, 0.0, 1.0]),
        ("Spread vs concentrated",
         [0.25, 0.25, 0.25, 0.25],
         [0.0, 0.0, 0.0, 1.0]),
    ]

    for name, p, q in cases:
        w = wasserstein_1d(p, q)
        kl = kl_divergence(p, q)
        kl_str = f"{kl:.4f}" if kl != float('inf') else "inf"
        print(f"  {name}")
        print(f"    P = {p}")
        print(f"    Q = {q}")
        print(f"    Wasserstein: {w:.4f}    KL: {kl_str}")
        print()

    print("  Wasserstein provides finite, meaningful distances even when")
    print("  distributions do not overlap (where KL goes to infinity).")
    print()


def demo_different_neighbors():
    print("=" * 65)
    print("SAME DATA, DIFFERENT METRICS, DIFFERENT NEAREST NEIGHBORS")
    print("=" * 65)

    random.seed(123)
    n_points = 8
    dim = 5

    dataset = []
    for i in range(n_points):
        if i < 3:
            point = [random.gauss(0, 1) for _ in range(dim)]
        elif i < 6:
            base = [random.gauss(0, 0.5) for _ in range(dim)]
            base[0] *= 5
            point = base
        else:
            point = [random.gauss(3, 0.3) for _ in range(dim)]
        dataset.append(point)

    query = [1.0, 0.5, -0.5, 1.0, 0.2]

    print(f"  Query: {[round(x, 2) for x in query]}")
    print()
    print(f"  {'Point':<8s} {'L1':>8s} {'L2':>8s} {'Cosine':>8s} {'L-inf':>8s}")
    print(f"  {'-' * 8} {'-' * 8} {'-' * 8} {'-' * 8} {'-' * 8}")

    results = {"L1": [], "L2": [], "Cosine": [], "L-inf": []}

    for i, point in enumerate(dataset):
        d_l1 = l1_distance(query, point)
        d_l2 = l2_distance(query, point)
        d_cos = cosine_distance(query, point)
        d_linf = linf_distance(query, point)

        results["L1"].append((i, d_l1))
        results["L2"].append((i, d_l2))
        results["Cosine"].append((i, d_cos))
        results["L-inf"].append((i, d_linf))

        print(f"  P{i:<6d} {d_l1:>8.3f} {d_l2:>8.3f} {d_cos:>8.4f} {d_linf:>8.3f}")

    print()
    print("  Nearest neighbor by metric:")
    for metric_name, dists in results.items():
        best = min(dists, key=lambda x: x[1])
        print(f"    {metric_name:<8s}: Point {best[0]} (distance = {best[1]:.4f})")

    l1_best = min(results["L1"], key=lambda x: x[1])[0]
    l2_best = min(results["L2"], key=lambda x: x[1])[0]
    cos_best = min(results["Cosine"], key=lambda x: x[1])[0]
    linf_best = min(results["L-inf"], key=lambda x: x[1])[0]

    all_same = (l1_best == l2_best == cos_best == linf_best)
    if not all_same:
        print()
        print("  The metrics DISAGREE on which point is nearest.")
        print("  Your distance function defines your notion of similarity.")
    print()


def demo_embedding_search():
    print("=" * 65)
    print("EMBEDDING SIMILARITY SEARCH")
    print("=" * 65)

    random.seed(77)
    dim = 64

    documents = [
        "machine learning algorithms",
        "deep neural networks",
        "natural language processing",
        "computer vision models",
        "reinforcement learning agents",
        "database query optimization",
        "web server configuration",
        "network security protocols",
    ]

    embeddings = []
    for i, doc in enumerate(documents):
        base = [random.gauss(0, 1) for _ in range(dim)]
        if i < 5:
            for j in range(10):
                base[j] += 2.0
        else:
            for j in range(10, 20):
                base[j] += 2.0
        if i in [0, 1]:
            for j in range(20, 25):
                base[j] += 1.5
        embeddings.append(base)

    query_embedding = embeddings[0][:]
    noise = [random.gauss(0, 0.3) for _ in range(dim)]
    query_embedding = [q + n for q, n in zip(query_embedding, noise)]

    print(f"  Query: '{documents[0]}' (with noise)")
    print(f"  Embedding dimension: {dim}")
    print()

    cosine_scores = []
    l2_scores = []
    dot_scores = []

    for i in range(len(documents)):
        cos = cosine_similarity(query_embedding, embeddings[i])
        l2 = l2_distance(query_embedding, embeddings[i])
        dp = dot_product(query_embedding, embeddings[i])
        cosine_scores.append((i, cos))
        l2_scores.append((i, l2))
        dot_scores.append((i, dp))

    cosine_ranked = sorted(cosine_scores, key=lambda x: -x[1])
    l2_ranked = sorted(l2_scores, key=lambda x: x[1])
    dot_ranked = sorted(dot_scores, key=lambda x: -x[1])

    print(f"  {'Rank':<6s} {'Cosine':<35s} {'L2':<35s} {'Dot Product':<35s}")
    print(f"  {'-' * 6} {'-' * 35} {'-' * 35} {'-' * 35}")
    for rank in range(len(documents)):
        ci, cs = cosine_ranked[rank]
        li, ls = l2_ranked[rank]
        di, ds = dot_ranked[rank]
        cos_str = f"{documents[ci][:25]:<25s} ({cs:.3f})"
        l2_str = f"{documents[li][:25]:<25s} ({ls:.1f})"
        dot_str = f"{documents[di][:25]:<25s} ({ds:.1f})"
        print(f"  {rank + 1:<6d} {cos_str:<35s} {l2_str:<35s} {dot_str:<35s}")

    print()
    print("  Cosine similarity focuses on direction (topic similarity).")
    print("  L2 distance is sensitive to magnitude differences.")
    print("  Dot product blends direction and magnitude.")
    print()


def demo_knn_classification():
    print("=" * 65)
    print("KNN CLASSIFICATION: DISTANCE METRIC CHANGES THE PREDICTION")
    print("=" * 65)

    random.seed(99)

    training_data = [
        ([1.0, 5.0], "A"),
        ([1.5, 4.5], "A"),
        ([2.0, 4.0], "A"),
        ([5.0, 1.0], "B"),
        ([4.5, 1.5], "B"),
        ([4.0, 2.0], "B"),
        ([3.0, 3.0], "C"),
        ([3.5, 2.5], "C"),
        ([2.5, 3.5], "C"),
    ]

    query = [2.8, 2.8]

    print(f"  Query: {query}")
    print(f"  Training set: {len(training_data)} points, 3 classes")
    print()

    k = 3
    for metric_name, dist_fn in [("L1", l1_distance), ("L2", l2_distance),
                                   ("Cosine", cosine_distance), ("L-inf", linf_distance)]:
        distances = []
        for point, label in training_data:
            d = dist_fn(query, point)
            distances.append((d, label, point))
        distances.sort(key=lambda x: x[0])

        neighbors = distances[:k]
        votes = {}
        for d, label, point in neighbors:
            votes[label] = votes.get(label, 0) + 1
        prediction = max(votes, key=votes.get)

        print(f"  Metric: {metric_name}")
        for d, label, point in neighbors:
            print(f"    Neighbor: {point}  class={label}  dist={d:.4f}")
        print(f"    Prediction (k={k}): {prediction}")
        print()


def demo_regularization():
    print("=" * 65)
    print("L1 vs L2 REGULARIZATION EFFECT ON WEIGHTS")
    print("=" * 65)

    random.seed(42)
    n_features = 10
    weights = [random.gauss(0, 2) for _ in range(n_features)]

    print(f"  Original weights: {[round(w, 3) for w in weights]}")
    print(f"  L1 norm: {l1_norm(weights):.4f}")
    print(f"  L2 norm: {l2_norm(weights):.4f}")
    print()

    lr = 0.1

    w_l1 = weights[:]
    for step in range(50):
        for i in range(n_features):
            grad = lr * (1 if w_l1[i] > 0 else (-1 if w_l1[i] < 0 else 0))
            w_l1[i] -= grad
            if abs(w_l1[i]) < lr:
                w_l1[i] = 0.0

    w_l2 = weights[:]
    for step in range(50):
        for i in range(n_features):
            grad = lr * 2 * w_l2[i]
            w_l2[i] -= grad

    print(f"  After L1 regularization (50 steps):")
    print(f"    Weights: {[round(w, 3) for w in w_l1]}")
    print(f"    Zeros:   {sum(1 for w in w_l1 if w == 0.0)}/{n_features}")
    print(f"    L1 norm: {l1_norm(w_l1):.4f}")
    print()
    print(f"  After L2 regularization (50 steps):")
    print(f"    Weights: {[round(w, 3) for w in w_l2]}")
    print(f"    Zeros:   {sum(1 for w in w_l2 if abs(w) < 1e-10)}/{n_features}")
    print(f"    L2 norm: {l2_norm(w_l2):.4f}")
    print()
    print("  L1 drives 'small' weights to exactly zero (sparsity).")
    print("  L2 shrinks all weights but none reach exactly zero.")
    print()


def demo_norm_ordering():
    print("=" * 65)
    print("NORM ORDERING: L-inf <= L2 <= L1 (always)")
    print("=" * 65)

    random.seed(55)
    for trial in range(5):
        dim = random.randint(2, 10)
        a = [random.gauss(0, 5) for _ in range(dim)]
        b = [random.gauss(0, 5) for _ in range(dim)]

        d1 = l1_distance(a, b)
        d2 = l2_distance(a, b)
        dinf = linf_distance(a, b)

        holds = dinf <= d2 <= d1
        print(f"  dim={dim:>2d}  L1={d1:>8.3f}  L2={d2:>8.3f}  L-inf={dinf:>8.3f}  ordering holds: {holds}")

    print()
    print("  For any p1 < p2: ||x||_p2 <= ||x||_p1")
    print("  Higher p values focus on fewer (larger) components.")
    print()


if __name__ == "__main__":
    demo_norms()
    demo_distances()
    demo_cosine_vs_dot()
    demo_mahalanobis()
    demo_jaccard()
    demo_edit_distance()
    demo_kl_divergence()
    demo_wasserstein()
    demo_norm_ordering()
    demo_different_neighbors()
    demo_embedding_search()
    demo_knn_classification()
    demo_regularization()
