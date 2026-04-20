import numpy as np
from collections import deque


class Graph:
    def __init__(self, n_nodes, directed=False):
        self.n = n_nodes
        self.directed = directed
        self.adj = {i: {} for i in range(n_nodes)}

    def add_edge(self, u, v, weight=1.0):
        self.adj[u][v] = weight
        if not self.directed:
            self.adj[v][u] = weight

    def neighbors(self, node):
        return list(self.adj[node].keys())

    def degree(self, node):
        return len(self.adj[node])

    def weighted_degree(self, node):
        return sum(self.adj[node].values())

    def adjacency_matrix(self):
        A = np.zeros((self.n, self.n))
        for u in range(self.n):
            for v, w in self.adj[u].items():
                A[u][v] = w
        return A

    def degree_matrix(self):
        D = np.zeros((self.n, self.n))
        for i in range(self.n):
            D[i][i] = self.weighted_degree(i)
        return D

    def laplacian(self):
        return self.degree_matrix() - self.adjacency_matrix()

    def __repr__(self):
        edges = []
        seen = set()
        for u in range(self.n):
            for v, w in self.adj[u].items():
                key = (min(u, v), max(u, v)) if not self.directed else (u, v)
                if key not in seen:
                    seen.add(key)
                    if w == 1.0:
                        edges.append(f"{u}-{v}")
                    else:
                        edges.append(f"{u}-{v}({w})")
        return f"Graph(n={self.n}, edges=[{', '.join(edges)}])"


def bfs(graph, start):
    visited = set()
    order = []
    distances = {}
    queue = deque([(start, 0)])
    visited.add(start)
    while queue:
        node, dist = queue.popleft()
        order.append(node)
        distances[node] = dist
        for neighbor in graph.neighbors(node):
            if neighbor not in visited:
                visited.add(neighbor)
                queue.append((neighbor, dist + 1))
    return order, distances


def dfs(graph, start):
    visited = set()
    order = []
    stack = [start]
    while stack:
        node = stack.pop()
        if node in visited:
            continue
        visited.add(node)
        order.append(node)
        for neighbor in reversed(graph.neighbors(node)):
            if neighbor not in visited:
                stack.append(neighbor)
    return order


def connected_components(graph):
    visited = set()
    components = []
    for node in range(graph.n):
        if node not in visited:
            order, _ = bfs(graph, node)
            visited.update(order)
            components.append(order)
    return components


def spectral_clustering(graph, k=2):
    if graph.n < 2:
        raise ValueError("spectral_clustering requires at least 2 nodes")
    if not (2 <= k <= graph.n):
        raise ValueError(f"k must satisfy 2 <= k <= {graph.n}, got k={k}")

    L = graph.laplacian()
    eigenvalues, eigenvectors = np.linalg.eigh(L)

    if k == 2:
        fiedler = eigenvectors[:, 1]
        labels = np.zeros(graph.n, dtype=int)
        labels[fiedler < 0] = 1
        return labels

    features = eigenvectors[:, 1:k + 1]
    norms = np.linalg.norm(features, axis=1, keepdims=True)
    norms[norms == 0] = 1
    features = features / norms

    rng = np.random.RandomState(42)
    centroids = features[rng.choice(graph.n, k, replace=False)]

    for _ in range(100):
        dists = np.zeros((graph.n, k))
        for c in range(k):
            dists[:, c] = np.linalg.norm(features - centroids[c], axis=1)
        labels = np.argmin(dists, axis=1)

        new_centroids = np.zeros_like(centroids)
        for c in range(k):
            mask = labels == c
            if mask.any():
                new_centroids[c] = features[mask].mean(axis=0)

        if np.allclose(centroids, new_centroids):
            break
        centroids = new_centroids

    return labels


def message_passing(graph, features, weight_matrix):
    A = graph.adjacency_matrix()
    row_sums = A.sum(axis=1, keepdims=True)
    row_sums[row_sums == 0] = 1
    A_norm = A / row_sums

    aggregated = A_norm @ features
    output = aggregated @ weight_matrix
    return output


def pagerank(graph, damping=0.85, max_iter=100, tol=1e-6):
    n = graph.n
    scores = np.ones(n) / n

    for _ in range(max_iter):
        new_scores = np.ones(n) * (1 - damping) / n
        dangling_sum = 0.0
        for u in range(n):
            out_deg = graph.degree(u)
            if out_deg > 0:
                for v in graph.neighbors(u):
                    new_scores[v] += damping * scores[u] / out_deg
            else:
                dangling_sum += scores[u]
        new_scores += damping * dangling_sum / n
        if np.abs(new_scores - scores).sum() < tol:
            scores = new_scores
            break
        scores = new_scores

    return scores


def demo_social_network():
    print("=" * 60)
    print("DEMO 1: Small Social Network -- BFS and DFS")
    print("=" * 60)

    g = Graph(6)
    g.add_edge(0, 1)
    g.add_edge(0, 2)
    g.add_edge(1, 3)
    g.add_edge(2, 3)
    g.add_edge(3, 4)
    g.add_edge(4, 5)

    print(f"\nGraph: {g}")
    print(f"\nAdjacency matrix:\n{g.adjacency_matrix().astype(int)}")

    for node in range(g.n):
        print(f"  Node {node}: degree={g.degree(node)}, neighbors={g.neighbors(node)}")

    bfs_order, bfs_dist = bfs(g, 0)
    print(f"\nBFS from node 0:")
    print(f"  Visit order: {bfs_order}")
    print(f"  Distances:   {bfs_dist}")

    dfs_order = dfs(g, 0)
    print(f"\nDFS from node 0:")
    print(f"  Visit order: {dfs_order}")


def demo_laplacian():
    print("\n" + "=" * 60)
    print("DEMO 2: Laplacian Eigenvalues and Connected Components")
    print("=" * 60)

    g = Graph(7)
    g.add_edge(0, 1)
    g.add_edge(1, 2)
    g.add_edge(0, 2)
    g.add_edge(3, 4)
    g.add_edge(5, 6)

    print(f"\nGraph: {g}")
    print(f"Connected components: {connected_components(g)}")

    L = g.laplacian()
    eigenvalues = np.linalg.eigvalsh(L)
    print(f"\nLaplacian:\n{L.astype(int)}")
    print(f"\nEigenvalues: {np.round(eigenvalues, 4)}")

    n_zeros = np.sum(np.abs(eigenvalues) < 1e-8)
    print(f"Number of zero eigenvalues: {n_zeros}")
    print(f"Number of connected components: {len(connected_components(g))}")
    print(f"Match: {n_zeros == len(connected_components(g))}")


def demo_message_passing():
    print("\n" + "=" * 60)
    print("DEMO 3: Message Passing with Random Node Features")
    print("=" * 60)

    g = Graph(5)
    g.add_edge(0, 1)
    g.add_edge(0, 2)
    g.add_edge(1, 2)
    g.add_edge(2, 3)
    g.add_edge(3, 4)

    rng = np.random.RandomState(42)
    features = rng.randn(5, 3)
    W = rng.randn(3, 2) * 0.5

    print(f"\nGraph: {g}")
    print(f"\nNode features (5 nodes, 3 features each):")
    for i in range(5):
        print(f"  Node {i}: {np.round(features[i], 4)}")

    output = message_passing(g, features, W)
    print(f"\nAfter 1 round of message passing (output dim = 2):")
    for i in range(5):
        print(f"  Node {i}: {np.round(output[i], 4)}")

    output2 = message_passing(g, output, rng.randn(2, 2) * 0.5)
    print(f"\nAfter 2 rounds (2-hop neighborhood info):")
    for i in range(5):
        print(f"  Node {i}: {np.round(output2[i], 4)}")


def demo_spectral_clustering():
    print("\n" + "=" * 60)
    print("DEMO 4: Spectral Clustering on Two Communities")
    print("=" * 60)

    g = Graph(10)
    for i in range(5):
        for j in range(i + 1, 5):
            g.add_edge(i, j)
    for i in range(5, 10):
        for j in range(i + 1, 10):
            g.add_edge(i, j)
    g.add_edge(2, 7)

    print(f"\nGraph: two cliques (0-4 and 5-9) connected by edge 2-7")

    labels = spectral_clustering(g, k=2)
    print(f"\nSpectral clustering labels: {labels}")
    print(f"Cluster 0: {np.where(labels == 0)[0]}")
    print(f"Cluster 1: {np.where(labels == 1)[0]}")

    L = g.laplacian()
    eigenvalues = np.linalg.eigvalsh(L)
    print(f"\nLaplacian eigenvalues: {np.round(eigenvalues, 4)}")
    print(f"Fiedler value (algebraic connectivity): {eigenvalues[1]:.4f}")

    scores = pagerank(g)
    print(f"\nPageRank scores:")
    for i in range(g.n):
        print(f"  Node {i}: {scores[i]:.4f}")

    bridge_nodes = [2, 7]
    non_bridge = [n for n in range(g.n) if n not in bridge_nodes]
    print(f"\nBridge nodes {bridge_nodes} PageRank: "
          f"{np.mean(scores[bridge_nodes]):.4f}")
    print(f"Non-bridge nodes avg PageRank: "
          f"{np.mean(scores[non_bridge]):.4f}")
    print("Bridge nodes have higher PageRank -- they connect communities.")


if __name__ == "__main__":
    demo_social_network()
    demo_laplacian()
    demo_message_passing()
    demo_spectral_clustering()
