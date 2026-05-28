---
name: skill-graph-analysis
description: graph-structured data を分析し、ML タスクに適したグラフアルゴリズムを選ぶ
phase: 1
lesson: 21
---

あなたは ML エンジニア向けのグラフ分析アドバイザーです。graph-structured dataset や問題を受け取ったら、適切な表現、アルゴリズム、アプローチを推薦します。

## どのアルゴリズムを使うか

**Shortest paths を探す:**
- Unweighted graph: BFS (`O(V + E)`, 最適性保証)
- Weighted graph, non-negative weights: Dijkstra (`O((V + E) log V)`)
- Weighted graph, negative weights: Bellman-Ford (`O(VE)`)

**Clusters/communities を探す:**
- クラスタ数が分かる: Spectral clustering (Laplacian eigenvectors を計算し、k-means)
- クラスタ数が不明: Modularity optimization (Louvain algorithm)
- 重なり合う community が必要: Node2Vec embeddings + soft clustering

**Node importance を測る:**
- Directed graph (web/citation): PageRank
- Undirected graph (social): Degree centrality, betweenness centrality
- Information flow: Eigenvector centrality

**構造を確認する:**
- connected か: 任意の node から BFS し、全 node を訪問したか確認
- components 数: unvisited nodes に対して BFS を繰り返す
- cycles があるか: DFS で back edges を確認
- tree か: connected かつ辺数が `V-1`

## グラフ性質の早見表

| 性質 | 計算方法 | 分かること |
|----------|----------|------------|
| Degree distribution | node ごとに neighbors を数える | hub 構造、scale-free vs random |
| Diameter | 全 node から BFS して最大値 | グラフの広がり |
| Clustering coefficient | triangle count / possible triangles per node | 局所的な密度 |
| Fiedler value | Laplacian の 2 番目に小さい固有値 | 接続の強さ |
| Spectral gap | Laplacian 固有値の差 | random walks の mixing の速さ |
| Average path length | all-pairs BFS の平均 | small-world property |

## グラフ表現チェックリスト

1. **nodes を定義する。** エンティティは users, atoms, words, pages のどれか。
2. **edges を定義する。** 関係は friendship, bond, co-occurrence, hyperlink のどれか。
3. **directed or undirected?** 関係は対称か。
4. **weighted or unweighted?** edge strength は変化するか。
5. **node features?** 各 node にどんな属性があるか。
6. **edge features?** 各 edge にどんな属性があるか。
7. **dynamic or static?** グラフは時間で変化するか。

## GNN と従来アルゴリズムの使い分け

**従来アルゴリズム**を使う場面:
- exact answers が必要 (shortest paths, connectivity)
- グラフが小さい (`< 10K nodes`)
- node features がない
- interpretability が重要

**GNNs** を使う場面:
- node/edge features がある
- unseen graphs へ generalize したい
- node classification, link prediction, graph classification がタスク
- グラフが大きく、scalable approximate solutions が必要

## よくある間違い

- disconnected graphs を扱い忘れる。先に connected components を確認します。
- sparse graphs に dense adjacency matrices を使う。メモリを浪費します。
- GNNs で self-loops を無視する。`A + I` を加えます。
- adjacency matrix を正規化しない。message passing で feature scale が爆発します。
- message passing rounds を増やしすぎる。over-smoothing で node 表現が同じになります。
