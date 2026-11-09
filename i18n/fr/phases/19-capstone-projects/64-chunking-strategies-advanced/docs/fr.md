# Les stratégies de déchiquetage, comparées

> Le choc décide de ce que votre retriever peut faire surface.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 11 lessons 04 (embeddings), 06 (RAG), 07 (advanced RAG); Phase 19 Track B foundations (lessons 20-29)
**Time:** ~90 minutes

## Objectifs d'apprentissage
- Mettre en œuvre cinq stratégies de décomposition à partir de zéro: fenêtre fixe, phrase, récursive-split, clustering sémantique et en-tête de décomposition structurelle.
- Mesurer le rappel sur un corpus de composants avec des réponses étiquetées en or et expliquer pourquoi une stratégie gagne sur la prose et une stratégie différente sur les documents techniques.
- Lisez une distribution de longueur de morceau et reconnaissez les modes d'échec que chaque stratégie injecte: phrases orphelines, coupes de symbole de milieu, morceaux en en-tête seulement, dérive sémantique.
- Choisissez un défaut pour un nouveau corpus sans exécuter le point de référence en examinant trois propriétés: type de document, longueur moyenne du paragraphe et si le format est explicitement structuré.

## Le problème

Chaque pipeline RAG commence par couper les documents source en morceaux assez petits pour qu'un modèle d'intégration les correspond et assez grands pour que chaque morceau porte une idée autonome.

Une requête qui demande "comment ressemble le seuil d'abrogation budgétaire" ne peut réussir que si la partie qui retient le seuil d'abrogation est accessible. Si le séparateur de fenêtre fixe coupe la valeur du seuil du contexte environnant, l'intégration se déplace vers un autre cluster, le score BM25 diminue, les réranquants voient le bruit, et la réponse générée par le LLM est erronée. Le document de 2024 " LongRAG: améliorer la génération augmentée de récupération avec des LLM à long contexte " a mesuré un swing absolu de 35% dans le rappel de récupération purement à partir du choix de décomposition. Les travaux de suivi en 2025 sur les en-têtes contextuels ont réduit le fossé mais ne l'ont pas comblé.

Cette leçon construit cinq stratégies côte à côte, les compare à un corpus fixe avec des intervalles de réponse étiquetés en or, et vous permet de lire les numéros de rappel vous-même.

## Le concept

```mermaid
flowchart LR
  Doc[Source Document] --> S1[Fixed Window]
  Doc --> S2[Sentence]
  Doc --> S3[Recursive Split]
  Doc --> S4[Semantic Cluster]
  Doc --> S5[Structural Markdown]
  S1 --> Chunks1[Chunks]
  S2 --> Chunks2[Chunks]
  S3 --> Chunks3[Chunks]
  S4 --> Chunks4[Chunks]
  S5 --> Chunks5[Chunks]
  Chunks1 --> Index[Embedding Index]
  Chunks2 --> Index
  Chunks3 --> Index
  Chunks4 --> Index
  Chunks5 --> Index
  Index --> Eval[Recall@k vs Gold Spans]
```

### Ventile fixe

La ligne de base de force brute. Couper tous les caractères N. Supposer optionnellement de sorte qu'une phrase coupée à la position N apparaît entière à l'intérieur de la pièce qui commence à la position N - se superposer. rapide, déterministe, terrible aux limites. Utilisez-le comme un contrôle, pas par défaut.

### La phrase

Partagez les limites de la phrase avec un regex ou une machine d'état simple. Emballez une ou plusieurs phrases dans une pièce jusqu'à un budget de caractères cibles. Arrêtez de couper le milieu du mot. Toujours coupe le milieu du paragraphe et le milieu de la section. Le défaut dans de nombreux premiers pipelines RAG et un choix raisonnable pour la prose sans autre structure.

### Partage récursif

La stratégie de hiérarchie populaire par les bibliothèques de l'ère 2023. Essayez de diviser sur le séparateur le plus fort d'abord (double nouvelle ligne, paragraphe), de revenir à la prochaine (une seule nouvelle ligne), puis aux phrases, puis aux caractères. La récursion se termine lorsque la pièce correspond au budget.

### Clusterage sémantique

Embed chaque phrase. Cluster des phrases contiguës qui partagent un sujet centroid. Couper chaque fois que la similitude de fonctionnement avec le centroid tombe en dessous d'un seuil. Les limites reflètent le sens, pas les caractères. Plus lent à construire et dépend du modèle d'embedding, mais résistant aux documents qui changent de sujet à l'intérieur d'un paragraphe.

### Titres de détail structurels

Pour les documents qui portent une structure explicite (marquage, réstructure de texte, sections numérotées de style RFC), coupez-les aux limites de l'en-tête. Chaque pièce devient l'en-tête plus tout ce qui est sous celui-ci jusqu'à l'en-tête suivant au même niveau ou au niveau supérieur.

### Comment recall@k mesure le choix de la limite

Une requête étiquetée en or contient les détournements exacts des caractères de l'espace de réponse à l'intérieur du document source. Après avoir déchiqueté, vous demandez: les morceaux de haut de la cotte que le retriever a retournés se chevauchent-ils sur la plage d'or ? Si oui, recall@k pour cette requête est 1. Si non, c'est 0. La moyenne sur l'ensemble de requêtes. Exécutez la même évaluation pour chaque stratégie et le spread vous montre quelle politique de limite survit au corpus que vous avez.

```figure
ci-chunk-boundaries
```

## Faites-le

`code/main.py`les implémentations:

- `fixed_window(text, size, overlap)`- la ligne de base.
- `sentence_chunks(text, target)`- un simple rédacteur de phrases.
- `recursive_split(text, separators, target)`- la récursion hiérarchique.
- `semantic_chunks(text, similarity_threshold)`- le regroupement à base de centroid sur une intégration déterministe simulée.
- `structural_markdown(text)`- le séparateur de tête.
- `mock_embed(text, dim)`- une intégration basée sur le hash pour que la boucle se déconnecte.
- `DenseIndex`- la même forme utilisée dans la leçon de récupération hybride de la piste B de phase 19.
- `eval_recall(strategy, corpus, queries, k)`- la boucle de comparaison.
- Une .`main()`qui exécute chaque stratégie sur le corpus des fichiers et imprime une table recall@k.

- Je vais le faire.

```bash
python3 code/main.py
npx tsx code/main.ts
```

La sortie est une petite table avec une ligne par stratégie et une colonne par k. La phrase perd sur la structure fixe. La marque structurelle gagne sur la fixation de marque. Le récursif conserve son propre sur la fixation mixte parce que la récursion s'adapte. Le regroupement sémantique gagne sur la prose fixe où il n'y a pas d'indices structurels utiles.

## Les modes d'échec ne se cachent pas

**Orphan sentences.**L'emballage de phrases produit des morceaux qui manquent de la phrase de sujet. L'emballage pointe ensuite vers le mauvais cluster.

**Mid-symbol cuts.**Le code interne de fenêtre fixe ou YAML va diviser un identifiant en deux.

**Header-only chunks.**La décomposition structurelle émet une pièce ne contenant que `## Title`- Filtrez-les ou attachez le premier paragraphe de la pièce suivante.

**Semantic drift.**Les clusters sémantiques sont des sous-cuts lorsque le corpus est uniformément sur le sujet. Une pièce de 5000 caractères emballent de nombreuses réponses spécifiques dans une intégration diffuse.

**Stale embeddings.**Le clustering sémantique utilise un modèle d'intégration. Si vous changez le modèle, vous changez également les morceaux.

## Choisir une définition par défaut sans exécuter la référence

Trois propriétés décident de la pièce par défaut pour un nouveau corpus.

| Property | Value | Default |
|----------|-------|---------|
| Document type | Prose with no structure | Recursive split, target 800 |
| Document type | Markdown / RFC / API docs | Structural markdown |
| Document type | Code | AST-aware (out of scope; see Phase 19 lesson 02) |
| Paragraph length | Long, single topic | Sentence, target 500 |
| Paragraph length | Short, mixed topics | Semantic, threshold 0.6 |

Quand vous avez des doutes, choisissez une fraction récursive.

## Utilisez-le

Modèles de production:

- Exécutez l'évaluation avant d'envoyer un nouveau pipeline; ne faites pas confiance à la stratégie de votre bibliothèque par défaut.
- Réécouter l'évaluation chaque fois que vous changez le modèle d'intégration ou le mix corpus; le gagnant est corpus-dependent.
- Persistez le nom de la stratégie dans les métadonnées de chaque pièce afin que vous puissiez attribuer des régressions plus tard.

## La faire partir

Le système RAG de fin à fin de la piste F dans la leçon 69 utilise le chunker sélectionné ici comme première étape.`eval_recall`Choisissez la stratégie qui gagne sur votre corpus et l'alimentez.

## Exercices

1. Ajouter une sixième stratégie: jeton-window en utilisant `tiktoken`Comparer avec la fenêtre fixe sur le même appareil.
2. Injectez une fraction de 30% des blocs de code dans le fichier de prose, redémarrez la table, expliquez pourquoi chaque stratégie, à l'exception de la marquage structurelle, perd son rappel.
3. Remplacez l'intégration déterministe par celle du véritable fournisseur de votre projet. Mesurez le delta de rappel de regroupement sémantique. Rapportez si l'écart entre les stratégies s'élargit ou se rétrécit.
4. Ajouter un `summary`champ par pièce: une description centroid d'une phrase. Refaire l'évaluation avec le résumé joint au corps de pièce. Mesurer le relevé de rappel.

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Recall@k | "Did we get the right chunk?" | Fraction of queries where any of the top-k chunks overlaps the gold answer span |
| Chunk overlap | "Sliding window" | Re-include the last N characters of the previous chunk in the next chunk |
| Structural splitter | "Header-aware chunks" | Cut at H1/H2/H3 boundaries; the heading text is part of the chunk |
| Semantic chunker | "Topic-aware chunks" | Embed sentences, cluster by centroid similarity, cut on drift |
| Centroid drift | "Topic shift" | Cosine similarity between the running mean and the next sentence drops past a threshold |

## Pour en savoir plus

- [LongRAG: Enhancing Retrieval-Augmented Generation with Long-context LLMs (arXiv 2406.15319)](https://arxiv.org/abs/2406.15319)
- [Anthropic, Contextual Retrieval](https://www.anthropic.com/news/contextual-retrieval)
- [LlamaIndex, Chunking strategies for production RAG](https://docs.llamaindex.ai/en/stable/optimizing/production_rag/)
- L'étape 11 leçon 06 - Fondements du RAG
- Leçon 07 de la phase 11 - RAG avancé
- L'étape 19 leçon 65 - récupération hybride qui classe les morceaux produits ici
- L'étude de phase 19 - le harnais d'évaluation qui note le choix de la stratégie dans la production
