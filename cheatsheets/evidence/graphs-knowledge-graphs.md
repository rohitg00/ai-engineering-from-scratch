# Evidence: cheatsheets/graphs-knowledge-graphs.md

Abbreviations: G = phases/01-math-foundations/21-graph-theory, EL = phases/05-nlp-foundations-to-advanced/25-entity-linking, RE = phases/05-nlp-foundations-to-advanced/26-relation-extraction-kg, M = phases/14-agent-engineering/09-hybrid-memory-mem0. d = docs/en.md. Gc = G/code/graph_theory.py, ELc = EL/code/main.py, REc = RE/code/main.py, Mc = M/code/main.py.

## Graph matrices (concepts)
- Adjacency definition, symmetric when undirected: G/d:54-58
- Degree matrix diagonal, triangle diag(2, 2, 2): G/d:77-86
- L = D - A, positive semi-definite: G/d:136, 146
- zero eigenvalues count components: G/d:148
- Fiedler value, bottleneck: G/d:150
- message passing matrix form, rows sum to 1: G/d:201-205
- GCN with self-loops A + I: G/d:464-470
- PageRank formula, d=0.85: G/d:474

## Graph tasks in code (task-table)
- Graph(n_nodes, directed=False): Gc:5-6
- add_edge(u, v, weight=1.0): Gc:11
- bfs(graph, start) returns order, distances: Gc:56, G/d:295-309
- connected_components(graph): Gc:89
- spectral_clustering(graph, k=2): Gc:100
- message_passing(graph, features, weight_matrix): Gc:142
- pagerank(graph, damping=0.85, max_iter=100, tol=1e-6): Gc:153
- np.linalg.eigvalsh(L), ascending: G/d:347, 351

## Spectral split with numpy (annotated-code)
- D = np.diag(A.sum(axis=1)), L = D - A: G/d:429-430
- np.linalg.eigh(L): G/d:432
- eigenvalues[1] Fiedler value: G/d:434
- fiedler, group_a, group_b: G/d:437-439
- nx.karate_club_graph(): G/d:397, 34 nodes and 78 edges: G/d:482
- nx.number_connected_components(G): G/d:404
- nx.pagerank(G): G/d:409

## Text to knowledge graph (flow)
1. NER first: RE/d:165, EL/d:141
2. coref before RE, "He founded Apple": RE/d:145
3. entity linking: RE/d:146, 165
4. triples with spans: RE/d:19, 89-90
5. verify each element against source: RE/d:39, 103
6. canonical ids, P108 employer: RE/d:107-113, 165
7. provenance doc id + char-span: RE/d:185, 207

## Link one mention (flow)
1. alias index lookup, 10-30 candidates: EL/d:31, ELc:44
2. None, 0.0 with no candidates: ELc:45-46
3. Jaccard overlap: ELc:54-56
4. jac + 0.1 * prior, PRIORS: ELc:30, 57-58
5. [MENTION] markers, max cosine: EL/d:36, 94, 101
6. NIL, threshold on top score: EL/d:122, 162
7. one KB id per cluster: EL/d:141

## Extract, verify, build (annotated-code)
- verify function body: REc:36-45
- extract(doc), PATTERNS with P ids: REc:5-12, 79
- build_graph(verified): REc:48-52, 84
- graph.get("Tim Cook", []) and rel == "P169": REc:89-90
- P169 = CEO of: REc:18

## Hybrid memory: Mem0 (architecture)
- add(text, user_id, metadata): M/d:31
- VectorStore semantic search: M/d:34, 99
- KVStore keyed on user_id, fact_type, entity: M/d:35, 100, Mc:50-53
- GraphStore typed edges with valid flag: M/d:101, Mc:71-75
- fusion relevance, importance, recency: M/d:47-55
- search returns top_k by cosine, direct hits, subgraph: M/d:38-43, Mc:134-158

## Mem0Config and defaults (defaults)
- w_relevance 0.6, retrieval agents: Mc:99, M/d:57
- w_importance 0.2, compliance agents: Mc:100, M/d:57
- w_recency 0.2, chat agents: Mc:101, M/d:57
- recency_halflife_s 86400.0, 0.5 ** (elapsed / half): Mc:102, 132
- importance 0.5: Mc:21, 114
- scope "user", user / session / agent: Mc:114, M/d:79-81
- top_k 5, vector pulls top_k * 3: Mc:135, 137
- KV relevance 0.4: Mc:153

## Failures and fixes (troubleshooting)
- popularity bias, domain fine-tuning: EL/d:124, 165
- mention recall floor, recall @ 30: EL/d:43, 163
- NIL for mentions not in KB: EL/d:122
- coref before RE: RE/d:145
- hallucinated triples, span verification: RE/d:147
- relation canonicalization drift: RE/d:148
- embedding drift, re-embed top-N-used: M/d:87
- graph explosion, 50 edges, cap writes per add: M/d:89

## Abbreviations (glossary)
- BFS queue, DFS stack, O(V + E): G/d:94, 110, 328
- GCN symmetric normalization: G/d:464, 470
- EL: EL/d:20, 178
- KB: EL/d:183
- NIL: EL/d:182
- RE triples: RE/d:19
- AEVS: RE/d:35-40, 206
- Open IE high recall low precision: RE/d:47, 203
- Mem0g typed edges with temporal validity: M/d:140

## Questions (qa)
- BFS level = shortest path in unweighted graph: G/d:108
- Fiedler sign split: G/d:152, 444
- K rounds give K-hop neighborhood: G/d:207
- 99% on 80% recall is 80% pipeline: EL/d:46
- invalid not deleted, valid-at-time subgraph: M/d:61
- single store wrong for two of three: M/d:19, 25

## Tips (tips)
- networkx in production: G/d:414
- char-span + doc id provenance: RE/d:185
- canonicalize onto closed ontology before merge: RE/d:49
- canonicalization 60-80% of engineering: RE/d:123
- P580 start, P582 end: RE/d:149
- P@1 and NIL-detection on AIDA-CoNLL: EL/d:118
- one scope per write: M/d:83
