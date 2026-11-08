---
id: graphs-knowledge-graphs
title: Graphs and Knowledge Graphs
code: GK
subtitle: Graph matrices, Laplacian and message passing, entity linking, relation extraction and hybrid graph memory.
hue: 160
sources: phases/01-math-foundations/21-graph-theory, phases/05-nlp-foundations-to-advanced/25-entity-linking, phases/05-nlp-foundations-to-advanced/26-relation-extraction-kg, phases/14-agent-engineering/09-hybrid-memory-mem0
source_hash: 3bbbf6cfcfc85a68
---

## Graph matrices
type: concepts
from: phases/01-math-foundations/21-graph-theory/docs/en.md

- **Adjacency**: $A[i][j] = 1$ for an edge. It is symmetric for an undirected graph.
- **Degree matrix**: $D$ is diagonal with the degree of each node. A triangle gives diag(2, 2, 2).
- **Laplacian**: $L = D - A$. It is positive semi-definite. All eigenvalues are $\ge 0$.
- **Zero eigenvalues**: their count equals the number of connected components.
- **Fiedler value**: the smallest non-zero eigenvalue. A small value shows a bottleneck.
- **Message passing**: $H^{(k+1)} = \sigma(A_{\text{norm}} H^{(k)} W)$. Each row of $A_{\text{norm}}$ sums to 1.
- **GCN layer**: $\sigma(\hat{D}^{-1/2} \hat{A} \hat{D}^{-1/2} H W)$ with self-loops $\hat{A} = A + I$.
- **PageRank**: $(1-d)/n + d \sum \text{score}(u) / \text{out}(u)$ with d=0.85.

## Graph tasks in code
type: task-table
span: 2
from: phases/01-math-foundations/21-graph-theory/code/graph_theory.py, phases/01-math-foundations/21-graph-theory/docs/en.md

| Task | Code |
|---|---|
| Build a graph | `Graph(n_nodes, directed=False)` |
| Add an edge | `add_edge(u, v, weight=1.0)` |
| Hop distances and visit order | `bfs(graph, start)` returns order, distances |
| Find components | `connected_components(graph)` |
| Split into two clusters | `spectral_clustering(graph, k=2)` |
| One GNN round | `message_passing(graph, features, weight_matrix)` |
| Rank nodes | `pagerank(graph, damping=0.85, max_iter=100, tol=1e-6)` |
| Laplacian eigenvalues, ascending | `np.linalg.eigvalsh(L)` |

## Spectral split with numpy
type: annotated-code
lang: python
from: phases/01-math-foundations/21-graph-theory/docs/en.md

```python
D = np.diag(A.sum(axis=1))                       # degree matrix
L = D - A                                        # Laplacian
eigenvalues, eigenvectors = np.linalg.eigh(L)    # ascending order
eigenvalues[1]                                   # Fiedler value
fiedler = eigenvectors[:, 1]                     # Fiedler vector
group_a = np.where(fiedler >= 0)[0]              # one cluster
group_b = np.where(fiedler < 0)[0]               # the other cluster
G = nx.karate_club_graph()                       # 34 nodes, 78 edges
nx.number_connected_components(G)
nx.pagerank(G)                                   # node importance
```

## Text to knowledge graph
type: flow
from: phases/05-nlp-foundations-to-advanced/26-relation-extraction-kg/docs/en.md, phases/05-nlp-foundations-to-advanced/25-entity-linking/docs/en.md

1. **NER**: find the entity mentions in the text.
2. **Coref**: resolve "he" to the right entity before RE.
3. **Entity linking**: map each mention to one KB id.
4. **Relation extraction**: emit (subject, relation, object) triples with spans.
5. **Verify**: match each triple element to the source. Reject unsupported triples.
6. **Ontology mapping**: map relations to canonical ids, for example `P108` employer.
7. **Graph load**: store each triple with its doc id and char-span.

## Link one mention
type: flow
from: phases/05-nlp-foundations-to-advanced/25-entity-linking/docs/en.md, phases/05-nlp-foundations-to-advanced/25-entity-linking/code/main.py

1. **Alias index**: look up the lowercased mention. A typical index gives 10-30 candidates.
2. **No candidates**: `disambiguate` returns `None, 0.0`.
3. **Context score**: Jaccard overlap of context tokens and description tokens.
4. **Prior**: the score is `jac + 0.1 * prior` from `PRIORS`.
5. **Embedding option**: mark the span with [MENTION] tags. Pick the max cosine.
6. **NIL**: no KB entry matches. Use a threshold on the top score.
7. **Collapse**: keep one KB id for each coref cluster.

## Extract, verify, build
type: annotated-code
lang: python
from: phases/05-nlp-foundations-to-advanced/26-relation-extraction-kg/code/main.py

```python
def verify(triples, text):
    verified = []
    for t in triples:
        s, e = t["span"]
        if text[s:e] != t["evidence"]:          # span must match the source
            continue
        verified.append(t)
    return verified

triples = extract(doc)                          # regex PATTERNS, one P id each
graph = build_graph(verify(triples, doc))       # subject to relation, object
for rel, obj, ev in graph.get("Tim Cook", []):  # ev is the source sentence
    if rel == "P169":                           # CEO of
```

## Hybrid memory: Mem0
type: architecture
from: phases/14-agent-engineering/09-hybrid-memory-mem0/docs/en.md, phases/14-agent-engineering/09-hybrid-memory-mem0/code/main.py

```arch
node | add | 1,2 | add() | text, user_id, metadata | client
node | vec | 2,1 | VectorStore | semantic similarity | store
node | kv | 2,2 | KVStore | user_id, fact_type, entity | store
node | graph | 2,3 | GraphStore | typed edges, valid flag | store
node | fuse | 3,2 | Fusion score | relevance, importance, recency | process
node | out | 4,2 | search() | fused top_k |
edge | add | vec |
edge | add | kv |
edge | add | graph |
edge | vec | fuse | cosine
edge | kv | fuse | exact hit
edge | graph | fuse | subgraph
edge | fuse | out |
```

## Mem0Config and defaults
type: defaults
from: phases/14-agent-engineering/09-hybrid-memory-mem0/code/main.py, phases/14-agent-engineering/09-hybrid-memory-mem0/docs/en.md

| Setting | Default | Note |
|---|---|---|
| `w_relevance` | 0.6 | Raise it for retrieval agents |
| `w_importance` | 0.2 | Raise it for compliance agents |
| `w_recency` | 0.2 | Raise it for chat agents |
| `recency_halflife_s` | 86400.0 | Recency halves each half-life |
| `importance` | 0.5 | Set on each record at add time |
| `scope` | user | Or session or agent |
| `top_k` | 5 | Vector search pulls 3 times more first |
| KV hit relevance | 0.4 | Fixed relevance for KV-only records |

## Failures and fixes
type: troubleshooting
from: phases/05-nlp-foundations-to-advanced/25-entity-linking/docs/en.md, phases/05-nlp-foundations-to-advanced/26-relation-extraction-kg/docs/en.md, phases/14-agent-engineering/09-hybrid-memory-mem0/docs/en.md

| Symptom | Cause | Fix |
|---|---|---|
| Frequent entity always wins | Popularity bias | Fine-tune on domain data |
| Right entity never scored | Low candidate recall | Measure mention recall @ 30 first |
| Wrong entity for a new name | Mention is not in the KB | Predict NIL |
| "He founded Apple" lost | No coreference before RE | Run coref first |
| Triples the text does not support | LLM hallucination | Verify every span against the source |
| Graph cannot be queried | Open IE relation drift | Collapse to canonical ids |
| Vector recall degrades | Embedding drift as corpus grows | Re-embed the top-N-used records |
| 50 edges per message | Noisy extractor | Cap graph writes per `add` call |

## Abbreviations
type: glossary
from: phases/01-math-foundations/21-graph-theory/docs/en.md, phases/05-nlp-foundations-to-advanced/25-entity-linking/docs/en.md, phases/05-nlp-foundations-to-advanced/26-relation-extraction-kg/docs/en.md, phases/14-agent-engineering/09-hybrid-memory-mem0/docs/en.md

- **BFS / DFS**: breadth-first with a queue, depth-first with a stack. Both $O(V + E)$.
- **GCN**: graph convolutional network. Message passing with symmetric normalization.
- **EL**: entity linking. Map a mention to a unique KB entry.
- **KB**: knowledge base. Wikidata, Wikipedia, DBpedia or a domain KB.
- **NIL**: the prediction that no KB entry matches.
- **RE**: relation extraction. Text to (subject, relation, object) triples.
- **AEVS**: Anchor-Extraction-Verification-Supplement. Span-verified extraction.
- **Open IE**: any verbal phrase is a relation. High recall, low precision.
- **Mem0g**: typed edges with temporal validity for relationship queries.

## Questions
type: qa
from: phases/01-math-foundations/21-graph-theory/docs/en.md, phases/05-nlp-foundations-to-advanced/25-entity-linking/docs/en.md, phases/14-agent-engineering/09-hybrid-memory-mem0/docs/en.md

- **Why BFS for hop distance?** The BFS level of a node is its shortest path in an unweighted graph.
- **How does the Fiedler vector split?** Positive entries go in one cluster. Negative entries go in the other.
- **What do K rounds of message passing see?** The K-hop neighborhood of each node.
- **Why report two EL numbers?** 99% disambiguation on 80% candidate recall is an 80% pipeline.
- **Why mark an edge invalid?** Temporal queries traverse the valid-at-time subgraph.
- **Why three memory stores?** One store is wrong for two of the three query classes.

## Tips
type: tips
from: phases/01-math-foundations/21-graph-theory/docs/en.md, phases/05-nlp-foundations-to-advanced/26-relation-extraction-kg/docs/en.md, phases/05-nlp-foundations-to-advanced/25-entity-linking/docs/en.md, phases/14-agent-engineering/09-hybrid-memory-mem0/docs/en.md

- Use networkx in production. Use the scratch code to learn what it does.
- Give every triple a source char-span and a doc id.
- Map open IE relations onto a closed ontology before you merge them.
- Budget 60-80% of the engineering work for canonicalization.
- Add `P580` start time and `P582` end time to time-bounded relations.
- Report in-KB accuracy (`P@1`) and the NIL-detection rate on AIDA-CoNLL.
- Pick one scope for each memory write: user, session or agent.
