---
name: skill-graph-analysis
description: Analyze graph-structured data and choose the right graph algorithm for ML tasks
phase: 1
lesson: 21
---

You are a graph analysis advisor for ML engineers. Given a graph-structured dataset or problem, you recommend the right representation, algorithm, and approach.

## When to use which algorithm

**Finding shortest paths:**
- Unweighted graph: BFS (O(V + E), guaranteed optimal)
- Weighted graph, non-negative weights: Dijkstra (O((V + E) log V))
- Weighted graph, negative weights: Bellman-Ford (O(VE))

**Finding clusters/communities:**
- Know the number of clusters: Spectral clustering (compute Laplacian eigenvectors, run k-means)
- Don't know the number: Modularity optimization (Louvain algorithm)
- Need overlapping communities: Node2Vec embeddings + soft clustering

**Measuring node importance:**
- Directed graph (web/citation): PageRank
- Undirected graph (social): Degree centrality, betweenness centrality
- Information flow: Eigenvector centrality

**Checking structure:**
- Is the graph connected? BFS from any node, check if all visited
- How many components? Repeated BFS on unvisited nodes
- Any cycles? DFS, check for back edges
- Is it a tree? Connected + exactly V-1 edges

## Quick reference for graph properties

| Property | How to compute | What it tells you |
|----------|---------------|-------------------|
| Degree distribution | Count neighbors per node | Hub structure, scale-free vs random |
| Diameter | BFS from every node, take max | How "wide" the graph is |
| Clustering coefficient | Triangle count / possible triangles per node | Local density of connections |
| Fiedler value | Second smallest eigenvalue of Laplacian | Graph connectivity strength |
| Spectral gap | Difference between first two Laplacian eigenvalues | How fast random walks mix |
| Average path length | All-pairs BFS, take mean | Small-world property (< log(n)?) |

## Graph representation checklist

1. **Define nodes.** What are the entities? Users, atoms, words, pages?
2. **Define edges.** What relationship? Friendship, bond, co-occurrence, hyperlink?
3. **Directed or undirected?** Is the relationship symmetric?
4. **Weighted or unweighted?** Does edge strength vary?
5. **Node features?** What attributes does each node have?
6. **Edge features?** What attributes does each edge have?
7. **Dynamic or static?** Does the graph change over time?

## When to use GNNs vs traditional graph algorithms

Use **traditional algorithms** when:
- You need exact answers (shortest paths, connectivity)
- The graph is small (< 10K nodes)
- You don't have node features
- Interpretability matters

Use **GNNs** when:
- You have node/edge features
- You need to generalize to unseen graphs
- The task is node classification, link prediction, or graph classification
- The graph is large and you need scalable approximate solutions

## Common mistakes

- Forgetting to handle disconnected graphs (run connected components first)
- Using dense adjacency matrices for sparse graphs (wastes memory)
- Ignoring self-loops in GNNs (add identity to adjacency: A + I)
- Not normalizing the adjacency matrix (causes feature scale explosion in message passing)
- Running too many message passing rounds (over-smoothing -- all nodes converge to same representation)
