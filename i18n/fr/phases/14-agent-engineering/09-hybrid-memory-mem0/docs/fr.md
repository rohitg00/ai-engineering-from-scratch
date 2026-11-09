# Mémoire hybride: vecteur + graphe + KV

> La mémoire hybride exploite trois magasins en parallèle  vecteur pour la similitude sémantique, KV pour la recherche rapide de faits, graphique pour le raisonnement entité-relation  avec une couche de notation qui les fusionne lors de la récupération.

**Type:** Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 07 (MemGPT), Phase 14 · 08 (Letta Blocks)
**Time:** ~75 minutes

## Objectifs d'apprentissage

- Expliquez pourquoi un seul stock (vecteur seulement, graphe seulement, KV seulement) est insuffisant pour la mémoire de l'agent.
- Nommez les trois magasins parallèles de Mem0 et ce que chacun optimisera pour.
- Décrivez le score de fusion de Mem0  pertinence, importance, récente  et pourquoi il s'agit d'une somme pondérée et non d'une hiérarchie.
- Implémenter une mémoire de trois étages de jouets dans stdlib avec un `add()`qui écrit à tous les trois et à un`search()`qui fusionne les résultats.

## Le problème

Chaque magasin est adapté à une seule des trois classes de requêtes:

- **Semantic similarity**"Qu'est-ce que nous avons discuté de la dérive d'agent la semaine dernière?" Vector gagne, KV et la défaite graphique.
- **Fact lookup** "Quel est le numéro de téléphone de l'utilisateur?" KV gagne; vecteur est gaspillé, graphe est exagéré.
- **Relationship reasoning** "quels clients partagent la même entité de facturation?" Le graphique gagne; vecteur et KV ne peuvent répondre.

Les agents de production émettent les trois en une seule session. Une mémoire d'une seule boutique est toujours mauvaise pour deux d'entre eux.`add`- Je suis là.`search`la surface avec une fonction de notation qui les fusionne.

## Le concept

### Trois magasins en parallèle

Mem0 (arXiv:2504.19413, avril 2025) sur `add(text, user_id, metadata)`- Le numéro de la liste:

1. Extraire des faits candidats du texte (étape axée sur le LLM).
2. Écrivez chaque fait dans le vecteur de stockage (embedding) pour la recherche sémantique.
3. Écrire chaque fait dans le magasin KV à clé (user_id, fact_type, entité) pour $O(1)$Je suis en train de chercher.
4. Écrivez chaque fait dans le graph store (Mem0g) comme des bords taillés pour les requêtes de relation.

Je suis en train de`search(query, user_id)`- Le numéro de la liste:

1. Le magasin vectoriel retourne le top-k en intégrant cosine.
2. Le magasin KV renvoie des hits directs sur la requête dérivée (user_id, type, entité).
3. Le graph store renvoie le sous-graphe accessible par les entités de requête.
4. Une couche de scores fusionne les trois.

### Scoring de fusion

```
score = w_relevance * relevance(q, record)
      + w_importance * importance(record)
      + w_recency * recency(record)
```

- **Relevance** cosine vectoriel, correspondance exacte KV, poids de la trajectoire du graphique.
- **Importance** étiqueté au moment de la rédaction ou appris (certains faits comptent plus: noms, identifiants, politiques).
- **Recency** déclin exponentiel au fil du temps depuis la dernière rédaction ou lecture.

Les poids sont ajustés par produit.`w_recency`pour les agents de chat; plus élevé `w_importance`pour les agents de conformité; supérieur `w_relevance`pour les agents de récupération.

### Mem0g et raisonnement temporel

Mem0g ajoute un détecteur de conflit. Lorsqu'un nouveau fait contredit un bord existant, le bord existant est marqué comme non valide mais non supprimé.

C'est le comportement de conformité que généralise le modèle d'invalidation de Letta.

### Numéros de référence

Les rapports du document Mem0 (2025):

- **LoCoMo**(mémoire de longue durée de conversation): 91,6
- **LongMemEval**(mémoire épisodique à long horizon): 93,4
- **BEAM 1M**(indice de référence de mémoire de jeton M): 64,1

Les lignes de base de comparaison (LLM en plein contexte 128k, magasin vectoriel plat, KV plat) perdent toutes 10 points. Les critères de référence ne justifient pas le choix  la forme opérationnelle  mais les chiffres montrent que la conception de fusion n'est pas une erreur d'arrondissement.

### Taxonomie de portée

Mem0 partage la mémoire par champ:

- **User memory** persiste pendant les séances, enfoncée `user_id`- Je suis désolé .
- **Session memory** persiste dans un seul fil.
- **Agent memory** État d'instance par agent.

Chaque écriture choisit un champ. La récupération peut effectuer des requêtes sur des champs avec des poids par champ. Le mélange des champs sans réfléchir est la façon dont vous obtenez "l'assistant a dit à Alice sur le projet de Bob" incidents.

### Où ce modèle va mal

- **Embedding drift.**Les résultats vectoriels qui apparaissent bien sur les 100 premières requêtes se dégradent à mesure que le corpus grandit.
- **KV schema creep.** `(user_id, type, entity)`Il semble simple jusqu' à ce que chaque équipe ajoute le sien.`type`- vérifier le type de jeu trimestriellement.
- **Graph explosion.**Un extracteur bruyant ajoute 50 bords par message.`add`- Je ne sais pas.

```figure
ae-memory-fusion
```

## Faites-le

`code/main.py`met en œuvre le modèle à trois étages dans stdlib:

- `VectorStore` similitude naïve de superposition des symboles en tant que substituteur intégré.
- `KVStore` dicté sur la touche `(user_id, fact_type, entity)`- Je suis désolé .
- `GraphStore` bordes typées (objet, relation, objet, valide).
- `Mem0` façade de haut niveau avec `add()`- Je suis là .`search()`, le score de fusion, et la récupération consciente de la portée.
- Une trace de travail sur une conversation multi-utilisateur, multi-session.

- Je vais le faire.

```
python3 code/main.py
npx tsx code/main.ts
```

La sortie montre trois voies de rappel distinctes plus le top-k fusionné.`main()`et regarder le changement de classement.

## Utilisez-le

- **Mem0 (Apache 2.0)** prêt à la production. Auto-hébergement avec Postgres + Qdrant + Neo4j, ou utiliser le cloud géré.
- **Letta** un noyau/reprise/archivage à trois niveaux; apportez vos propres arrière-plan vectoriels et graphiques.
- **Zep** alternative commerciale avec KG temporel et extraction de faits.
- **Custom builds** lorsque vous avez besoin d'un contrôle exact sur l'extracteur (conformité) ou les poids de fusion (agents vocaux où la récente domination).

## La faire partir

`outputs/skill-hybrid-memory.md`génère un échafaudage de mémoire à trois étages avec un scorer de fusion, une taxonomie de champ et une invalidation temporelle câblés.

## Exercices

1. Remplacez la similitude vectorielle de jouet par un modèle d'intégration réel (transformateurs de phrases, Ollama, intégrations OpenAI). Mesurer le rappel@10 sur une longue conversation synthétique.
2. Ajoutez une requête temporelle: `search(query, as_of=timestamp)`- Retourner uniquement des dossiers valides à cette date ou avant.
3. Implémenter un détecteur de conflit: si un fait entrant contredit un bord de graphique, invalidez l'ancien bord et enregistrez les deux.
4. Port le scorer de fusion pour inclure un `user_feedback`dimension (poignée en haut sur les enregistrements récupérés). Comment prévenir les jeux (l'agent ne renvoie que les enregistrements qu'il a déjà aimés)?
5. Lire les documents du mémoire (`docs.mem0.ai`Prenez le jouet à la main .`mem0`Comparer la qualité de récupération sur les mêmes 20 requêtes de test.

## Les termes clés

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Hybrid memory | "Vector plus graph plus KV" | Three stores written in parallel, fused on retrieval |
| Fact extraction | "Memory ingestion" | LLM step that breaks text into (entity, relation, fact) tuples |
| Fusion scoring | "Relevance ranking" | Weighted sum of relevance, importance, recency |
| Scope | "Memory namespace" | user / session / agent — determines who sees what |
| Mem0g | "Memory graph" | Typed edges with temporal validity for relationship queries |
| Temporal invalidation | "Soft delete" | Mark contradicted edges invalid; never delete |
| Embedding drift | "Retrieval rot" | Vector quality degrades as corpus grows; re-embed periodically |

## Pour en savoir plus

- [Chhikara et al., Mem0 (arXiv:2504.19413)](https://arxiv.org/abs/2504.19413) le papier original
- [Mem0 docs](https://docs.mem0.ai/platform/overview) API de production, SDK, cloud géré
- [Packer et al., MemGPT (arXiv:2310.08560)](https://arxiv.org/abs/2310.08560) le prédécesseur de contexte virtuel
- [Letta, Memory Blocks blog](https://www.letta.com/blog/memory-blocks) la conception de trois niveaux
