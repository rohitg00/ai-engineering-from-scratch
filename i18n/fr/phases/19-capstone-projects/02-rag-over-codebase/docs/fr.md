# Capstone 02  RAG sur la base de code (Cross-Repo Semantic Search)

> Chaque organisme d'ingénierie sérieux en 2026 effectue une recherche interne de code qui comprend la signification, pas seulement les chaînes. Amp, réponses de base de code de Cursor, graphique d'entreprise d'Augment, repomap d'Aider, MCP interne de Pinterest  même forme. Ingérer de nombreux repos, analyser avec le gardien d'arbre, intégrer des morceaux de fonction et de classe, recherche hybride, ré-rangement, répondre avec des citations. Ce capstone vous demande de construire un qui traite 2M lignes de code sur 10 repos et survit à la réindexation progressive à chaque poussée git.

**Type:** Capstone
**Languages:** Python (ingestion), TypeScript (API + UI, retrieval scaffold)
**Prerequisites:** Phase 5 (NLP foundations), Phase 7 (transformers), Phase 11 (LLM engineering), Phase 13 (tools), Phase 17 (infrastructure)
**Phases exercised:**P5 · P7 · P11 · P13 · P17
**Time:** 30 hours

## Problème

D'ici 2026, chaque agent de codage frontalier expédie une couche de récupération de base de code parce que les fenêtres contextuelles seules ne résolvent pas les questions de référencement. Le contexte 1M-token de Claude aide; il n'élimine pas le besoin de récupération classée. Une recherche naïve sur des morceaux de poisons générés, sur la duplication monorepo et sur la longue queue de symboles rarement importés. La réponse de production est une recherche hybride (dense + BM25) sur les morceaux conscients de l'AST avec un ré-ranking, soutenue par un graphique de références de symboles.

Vous apprenez cela en indexant une vraie flotte  pas un seul repos tutoriel  et en mesurant MRR@10, la fidélité des citations et la fraîcheur accrue. Les modes d'échec sont infrastructuraux: un monorepo de fichier de 100k, une poussée qui retouche la moitié des fichiers, une requête qui doit traverser quatre repos pour répondre correctement.

## Concept

Un pipeline d'ingestion conscient de l'AST analyse chaque fichier avec un gardien d'arbre, extrait des nœuds de fonction et de classe et des morceaux aux limites des nœuds plutôt que des fenêtres de jetons fixes. Chaque pièce obtient trois représentations: une intégration dense (code Voyage-3 ou nomic-embed-code), des termes BM25 rares et un bref résumé en langage naturel. Le résumé ajoute une troisième modalité récupérable  les utilisateurs demandent "comment est autorisé X" et le résumé mentionne "authz", même si le code n'a que `check_permission`- Je suis désolé .

Le ravitaillement est hybride. Une requête effectue à la fois des recherches denses et BM25, fusionne le top-k et remet l'union à un ré-ranking cross-encoder (Cohere rerank-3 ou bge-reranker-v2-gemma-2b). La liste réaffichée passe à un synthétiseur de contexte long (Claude Sonnet 4.7 avec cache rapide, ou Llama 3.3 70B auto-hébergé) avec des instructions pour citer chaque revendication par dossier et gamme de lignes. Les réponses sans citation sont rejetées par un post-filtre.

La fraîcheur accrue est le problème de l'infrastructure. Git push déclenche un diff: quels fichiers ont changé, quels symboles ont changé. Seuls les morceaux affectés sont réintégrés. Les bords des symboles croisés affectés (importations, appels de méthode) sont recomputés. L'index reste cohérent sans reprocesser 2M lignes chaque commit.

## Architecture

```
git push --> webhook --> ingest worker (LlamaIndex Workflow)
                           |
                           v
             tree-sitter parse + AST chunk
                           |
            +--------------+----------------+
            v              v                v
          dense        BM25 index       summary (LLM)
        (Voyage / bge)  (Tantivy)        (Haiku 4.5)
            |              |                |
            +------> Qdrant / pgvector <----+
                            |
                            v
                      symbol graph (Neo4j / kuzu)
                            |
  query --> LangGraph agent (retrieve -> rerank -> synth)
                            |
                            v
                 Claude Sonnet 4.7 1M context
                            |
                            v
                 answer + file:line citations
```

## La pile

- Parsing: gardien d'arbre avec 17 grammaires linguistiques (Python, TS, Rust, Go, Java, C++, etc.)
- Embeddings denses: Voyage-code-3 (hébergé) ou nomic-embedded-code-v1.5 (auto-hébergé), bge-code-v1 fallback
- Indice de la déchette: Tantivy (Rust) avec BM25F, pondéré par champ sur le nom du symbole par rapport au corps
- Vector DB: Qdrant 1.12 avec recherche hybride, ou pgvector + pgvector scale pour les équipes de moins de 50 M vecteurs
- Modèle de résumé de fragment: Claude Haiku 4.5 ou Gemini 2.5 Flash, en cache rapide
- Rencontre: Rencontre cohérente 3 ou bge-rencontre-v2-gemma-2b auto-hébergé
- Orchestration: flux de travail LlamaIndex pour l'ingestion, LangGraph pour l'agent de requête
- Synthétiseur: Claude Sonnet 4.7 (1M de contexte) avec mise en cache rapide
- Graphique symbolique: Neo4j (géré) ou kuzu (intégré) pour les bordures d'importation et d'appel
- Observabilité: portée de la membrane par étape de récupération + synthèse

```figure
ce-hybrid-retrieval
```

## Faites-le

1. **Ingestion walker.**Iterer l'historique de git sur chaque crochet de poussée. Collecter les fichiers modifiés. Pour chaque fichier, analyser avec tree-sitter, extraire la fonction et les nœuds de classe avec leur champ de source complet. Émettez des enregistrements de pièces`{repo, path, start_line, end_line, symbol, body}`- Je suis désolé .

2. **Chunk summarizer.**Les fractions de lot dans Haiku 4.5 appellent avec une mise en cache rapide sur le préambule du système.

3. **Embedding pool.**Deux files d'attente parallèles: dense (code Voyage-3 lot 128) et résumé (même modèle, mais sur la chaîne de résumé).`{repo, path, start_line, end_line, symbol, kind}`- Je suis désolé .

4. **BM25 index.**Indice Tantivy pondéré par champ: poids du nom du symbole 4, poids du corps du symbole 1, poids de résumé 2.

5. **Symbol graph.**Pour chaque pièce, enregistrer les bords: importations (ce fichier utilise le symbole Y de repo Z), appels (cette fonction appelle la méthode M sur la classe C), héritage.

6. **Query agent.**LangGraph avec trois nœuds.`retrieve`feu dense + BM25 parallèlement, déduplicé par (répo, chemin, symbole). `rerank`Il met le cross-encoder sur le top-50 et garde le top-10. `synth`Il appelle Claude Sonnet 4.7 avec les morceaux réaffectés dans le contexte, cache le prompt système, nécessite des citations de fichier: ligne.

7. **Citation enforcement.**Analyse de la sortie du modèle; toute réclamation sans une`(repo/path:start-end)`L'ancrage est marqué pour une requête ou abandonné.

8. **Incremental re-index.**Sur chaque connexion Web, calculer la différence de niveau du symbole. Seuls les morceaux re-embeddés dont le texte a changé. Reconstituer les bords du symbole pour les morceaux dont les importations ont changé. Mesure: un poussé de 50 fichiers ré-indexé en moins de 60 secondes pour une flotte 2M-LOC.

9. **Eval.**Étiquettez 100 questions de référencement croisés avec fichier d'or: réponses en ligne. Mesurez MRR@10, nDCG@10, fidélité des citations (fraction des revendications avec ancres vérifiables) et latence p50/p99.

## Utilisez-le

```
$ code-rag ask "how is S3 multipart abort wired into our retry budget?"
[retrieve]  12 chunks dense + 7 chunks bm25, 16 unique after dedup
[rerank]    top-5 kept (cohere rerank-3)
[synth]     claude-sonnet-4.7, cache hit rate 68%, 2.1s
answer:
  Multipart aborts are triggered by `AbortMultipartOnFail` in
  services/uploader/retry.go:122-148, which decrements the per-bucket
  retry budget defined in config/budgets.yaml:34-51 ...
  citations: [services/uploader/retry.go:122-148, config/budgets.yaml:34-51,
              libs/s3client/multipart.ts:44-61]
```

## La faire partir

Des compétences délivrables `outputs/skill-codebase-rag.md`. En raison d'un corpus de repos, il indique le pipeline d'ingestion, l'indice hybride et l'agent de requête et renvoie une réponse citée pour toute question de repos croisé.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | Retrieval quality | MRR@10 and nDCG@10 on a 100-question held-out set |
| 20 | Citation faithfulness | Fraction of answer claims with verifiable file:line anchors |
| 20 | Latency and scale | p95 query latency at 10k QPS on the indexed corpus size |
| 20 | Incremental indexing correctness | Time from git push to searchable on a 50-file commit |
| 15 | UX and answer formatting | Citation clickability, snippet previews, follow-up affordance |
| **100** | | |

## Exercices

1. Swap Voyage-code-3 pour code nomic-embed auto-hébergé. Mesurer le delta MRR@10. Indiquer si le vide se ferme avec le ré-rangement activé.

2. Injecter 20% de code généré (plaque de chaudière produite par LLM) dans le corpus et réévaluer. Observer l'empoisonnement de récupération. Ajouter un drapeau "généré" à la charge utile et de pondérer ces coups.

3. Indiquez la recherche hybride Qdrant par rapport au pgvector + pgvector à la taille du corpus.

4. Ajouter une vérification de dérive basée sur l'échantillonnage: hebdomadaire, répéter l'évaluation de 100 questions.

5. Extension à la résolution des symboles multilingues: une fonction Python qui appelle un service Go sur gRPC. Utilisez le graphique des symboles pour les relier.

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| AST-aware chunking | "Function-level splits" | Cutting code at tree-sitter node boundaries instead of fixed token windows |
| Hybrid search | "Dense + sparse" | Run BM25 and vector search in parallel, merge top-k, rerank |
| Cross-encoder rerank | "Second-stage rank" | Model that scores each (query, candidate) pair together, more accurate than cosine |
| Prompt caching | "Cached system prompt" | 2026 Claude / OpenAI feature that discounts repeat prefix tokens up to 90% |
| Symbol graph | "Code graph" | Edges for imports, calls, inheritance across files and repos |
| Citation faithfulness | "Grounded answer rate" | Fraction of claims a user can verify by clicking the anchor and reading the referenced span |
| Incremental re-index | "Push-to-search time" | Wall-clock from git push to the changed symbols being queryable |

## Pour en savoir plus

- [Sourcegraph Amp](https://ampcode.com) intelligence de code de production entre références
- [Sourcegraph Cody RAG architecture](https://sourcegraph.com/blog/how-cody-understands-your-codebase) la plongée en profondeur de référence pour cette pierre angulaire
- [Aider repo-map](https://aider.chat/docs/repomap.html) vue repo classée par le gardien d'arbre
- [Augment Code enterprise graph](https://www.augmentcode.com) graphique de symboles commerciaux RAG
- [Qdrant hybrid search docs](https://qdrant.tech/documentation/concepts/hybrid-queries/) mise en œuvre de référence
- [Voyage AI code embeddings](https://docs.voyageai.com/docs/embeddings) Détails du code de voyage-3
- [Cohere rerank-3](https://docs.cohere.com/reference/rerank) référence à l'encodeur croisé
- [Pinterest MCP internal search](https://medium.com/pinterest-engineering) référence interne à la plateforme
