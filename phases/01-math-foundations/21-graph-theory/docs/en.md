# 機械学習のためのグラフ理論

> グラフは関係性のデータ構造です。データに接続があるなら、グラフ理論が必要です。

**種類:** Build
**言語:** Python
**前提:** Phase 1, Lessons 01-03 (linear algebra, matrices)
**時間:** 約90分

## 学習目標

- adjacency matrix/list 表現を持つ graph class を作り、BFS と DFS を実装する
- graph Laplacian を計算し、その固有値で connected components とクラスタを検出する
- 正規化 adjacency matrix 乗算として GNN-style message passing を 1 ラウンド実装する
- Fiedler vector を使って spectral clustering でグラフを分割する

## 問題

ソーシャルネットワーク、分子、knowledge bases、citation networks、道路地図はすべてグラフです。従来の ML はデータを平坦な表として扱いますが、接続構造が重要なとき表では不十分です。

ユーザーが何を買うかを予測するなら、その人の履歴だけでなく友人の履歴も重要です。分子がタンパク質に結合するかを予測するなら、原子そのものだけでなく結合構造が重要です。構造がデータなのです。

Graph Neural Networks (GNNs) は創薬、推薦、不正検知、knowledge graph reasoning で使われます。すべての GNN は、グラフ表現、探索、Laplacian、message passing という基礎の上にあります。

## 概念

### Graphs: Nodes and Edges

グラフ `G = (V, E)` は頂点 `V` と辺 `E` からなります。辺は二つの node をつなぎます。

**Directed vs undirected.** 無向グラフでは `(u, v)` は `u` と `v` が相互につながることを意味します。有向グラフでは `u` から `v` への向きがあります。

**Weighted vs unweighted.** 無重みグラフでは辺は存在するかしないかだけです。重み付きグラフでは距離、コスト、強さなどの数値が辺に付きます。

| グラフの種類 | 例 |
|-----------|----|
| Undirected, unweighted | Facebook friendship network |
| Directed, unweighted | Twitter follow network |
| Undirected, weighted | Road map |
| Directed, weighted | Web page links |

### Adjacency Matrix と Degree

adjacency matrix `A` は中心的な表現です。

```
A[i][j] = 1    if there is an edge from node i to node j
A[i][j] = 0    otherwise
```

無向グラフでは `A` は対称です。重み付きグラフでは `A[i][j]` に辺の重みが入ります。

node の degree は接続している辺の数です。degree matrix `D` は対角行列です。

```
D[i][i] = degree of node i
D[i][j] = 0    for i != j
```

degree は node の重要度やハブ構造を示します。ソーシャルネットワークでは少数の hub と多数の leaf nodes という power law がよく現れます。

### BFS と DFS

**Breadth-First Search (BFS)** は近い neighbor から順に探索します。queue (FIFO) を使います。無重みグラフでは最短経路を見つけます。

**Depth-First Search (DFS)** は戻る前にできるだけ深く進みます。stack (LIFO) または recursion を使います。connected components、cycle detection、topological sorting に便利です。

| Algorithm | Data structure | Finds | Use case |
|-----------|---------------|-------|----------|
| BFS | Queue | Shortest paths | Social network distance, knowledge graph traversal |
| DFS | Stack | Components, cycles | Connectivity, topological sort |

### Graph Laplacian

`L = D - A` は spectral graph theory で最も重要な行列です。

```
D = [[2, 0, 0],    A = [[0, 1, 1],    L = [[2, -1, -1],
     [0, 2, 0],         [1, 0, 1],         [-1, 2, -1],
     [0, 0, 2]]         [1, 1, 0]]         [-1, -1,  2]]
```

Laplacian の性質:

1. `L` は positive semi-definite です。
2. ゼロ固有値の個数は connected components の個数です。
3. 最小の非ゼロ固有値 (Fiedler value) は接続の強さを測ります。
4. Fiedler value の eigenvector (Fiedler vector) は良い二分割を示します。

### Spectral clustering

spectral clustering は次の手順です。

1. Laplacian `L` を計算する
2. `L` の小さいほうから `k` 個の eigenvectors を求める
3. それらを node の新しい座標として使う
4. その座標に k-means を実行する

Laplacian の eigenvectors は、グラフ上で最も滑らかな関数を表します。強く接続した node は似た値を持ち、bottleneck で分かれた node は異なる値を持ちます。

### Message Passing

GNN の中心操作です。各 node は neighbor からメッセージを集め、集約し、自分の状態を更新します。

```
h_v^(k+1) = UPDATE(h_v^(k), AGGREGATE({h_u^(k) : u in neighbors(v)}))
```

単純な形では、集約は平均、更新は linear transform + activation です。

```
h_v^(k+1) = sigma(W * mean({h_u^(k) : u in neighbors(v)}))
```

行列で書くと次の形になります。

```
H^(k+1) = sigma(A_norm * H^(k) * W)
```

1 ラウンドで immediate neighbors、2 ラウンドで neighbors of neighbors、`K` ラウンドで `K`-hop neighborhood の情報を取り込めます。

## 実装

### Step 1: Graph class from scratch

```python
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

    def adjacency_matrix(self):
        import numpy as np
        A = np.zeros((self.n, self.n))
        for u in range(self.n):
            for v, w in self.adj[u].items():
                A[u][v] = w
        return A

    def degree_matrix(self):
        import numpy as np
        D = np.zeros((self.n, self.n))
        for i in range(self.n):
            D[i][i] = self.degree(i)
        return D

    def laplacian(self):
        return self.degree_matrix() - self.adjacency_matrix()
```

### Step 2: BFS and DFS

```python
from collections import deque

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
```

### Step 3: Connected components and Laplacian eigenvalues

```python
def connected_components(graph):
    visited = set()
    components = []
    for node in range(graph.n):
        if node not in visited:
            order, _ = bfs(graph, node)
            visited.update(order)
            components.append(order)
    return components
```

### Step 4: Spectral clustering and message passing

```python
def message_passing(graph, features, weight_matrix):
    import numpy as np
    A = graph.adjacency_matrix()
    row_sums = A.sum(axis=1, keepdims=True)
    row_sums[row_sums == 0] = 1
    A_norm = A / row_sums
    aggregated = A_norm @ features
    output = aggregated @ weight_matrix
    return output
```

## Use It

実務では `networkx` と `numpy` を使うと、多くの操作が一行で書けます。自作実装は、ライブラリが何をしているかを理解するために使います。

```python
import networkx as nx
import numpy as np

G = nx.karate_club_graph()

A = nx.adjacency_matrix(G).toarray()
L = nx.laplacian_matrix(G).toarray()

eigenvalues = np.linalg.eigvalsh(L.astype(float))
print(f"Smallest eigenvalues: {eigenvalues[:5]}")
print(f"Connected components: {nx.number_connected_components(G)}")
```

## Ship It

このレッスンで作るもの:
- `outputs/skill-graph-analysis.md`: graph-structured data を分析するためのスキルリファレンス

## 接続

| 概念 | 現れる場所 |
|---------|------------|
| Adjacency matrix | GCN, GAT, GraphSAGE input |
| Laplacian | Spectral clustering, ChebNet filters |
| BFS | Knowledge graph traversal, shortest path queries |
| Message passing | Every GNN layer |
| Spectral gap | Graph connectivity, random walk mixing time |
| PageRank | Node importance ranking |

GCN (Kipf & Welling, 2017) の graph convolution は self-loops を加えた `A_hat = A + I` と対称正規化を使います。

```text
H^(l+1) = sigma(D_hat^(-1/2) * A_hat * D_hat^(-1/2) * H^(l) * W^(l))
```

これは正規化された message passing そのものです。

## 演習

1. PageRank をゼロから実装してください。
2. 二つの clique を一本の辺でつないだグラフを作り、spectral clustering が正しい分割を見つけるか確認してください。
3. 重み付きグラフの shortest paths に Dijkstra's algorithm を実装してください。
4. 2-layer message passing network を作り、2-hop neighborhood の情報が入ることを示してください。
5. Karate Club graph で degree distribution、Laplacian eigenvalues、spectral clustering を分析してください。

## 重要用語

| 用語 | よくある言い方 | 実際の意味 |
|------|----------------|------------|
| Graph | 「nodes and edges」 | ペア関係を表す数学構造 `G=(V,E)` |
| Adjacency matrix | 「接続表」 | `A[i][j] = 1` なら node `i` と `j` が接続 |
| Degree | 「どれだけつながっているか」 | node に接する辺の数 |
| Laplacian | 「D minus A」 | 固有値がグラフ構造を表す `L = D - A` |
| Fiedler value | 「代数的連結度」 | `L` の最小非ゼロ固有値 |
| BFS | 「レベル順探索」 | 深く行く前に neighbor をすべて訪れる探索 |
| DFS | 「深さ優先」 | 一つの経路を最後までたどってから戻る探索 |
| Message passing | 「node が neighbor と情報交換する」 | GNN の中心操作 |
| Spectral clustering | 「固有ベクトルでクラスタリング」 | Laplacian eigenvectors でグラフを分割する |

## 参考資料

- **Kipf & Welling (2017)** -- "Semi-Supervised Classification with Graph Convolutional Networks."
- **Spielman (2012)** -- "Spectral Graph Theory" lecture notes.
- **Hamilton (2020)** -- "Graph Representation Learning."
- **Bronstein et al. (2021)** -- "Geometric Deep Learning: Grids, Groups, Graphs, Geodesics, and Gauges."
- **Veličković et al. (2018)** -- "Graph Attention Networks."
