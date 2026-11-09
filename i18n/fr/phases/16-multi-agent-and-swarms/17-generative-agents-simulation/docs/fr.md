# Agents génératifs et simulation émergente

> Parque et coll. 2023 (UIST '23, arXiv:2304.03442) peuplée **Smallville**, une boîte à sable de 25 agents, avec une architecture en trois parties: **memory stream**(Log de la langue naturelle), **reflection**(synthèses de niveau supérieur que l'agent génère sur son propre flux), et **plan**(comportement au niveau du jour, puis sous-plans). Le résultat historique a été l'émergence d'une fête de la Saint-Valentin: un agent a semé avec " veut organiser une fête de la Saint-Valentin ", sans plus de scénarios, a produit des invitations réparties dans la population, des dates coordonnées, et la fête s'est déroulée  de 24 agents qui ont commencé sans le savoir. Les ablations montrent que les trois composants sont nécessaires pour la crédibilité. Les défaillances documentées sont des erreurs de la norme spatiale (entrées dans des magasins fermés, partage des salles de bains individuelles). C'est l'architecture de référence pour les simulations d'agents et l'évaluation sociale multi-agents en 2026.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 16 · 04 (Primitive Model), Phase 16 · 13 (Shared Memory)
**Time:** ~75 minutes

## Problème

La plupart des systèmes multi-agents sont des équipes étroitement scriptées: plans de planificateurs, codes de code, critiques de réviseurs. Cela fonctionne pour des tâches bien définies. Il ne capture pas le comportement émergent et non scripté qui se produit lorsque les agents ont une mémoire, des priorités et un monde ouvert. La recherche, la simulation de la société et de plus en plus l'IA de jeu ont besoin de ce second type.

L'architecture de Smallville est la référence pour cela. Jusqu'à Park 2023, les meilleures simulations d'agents étaient des scripts superficiels; après cela, le modèle est le modèle par défaut pour les agents génératifs dans les mondes ouverts. Si vous construisez une simulation d'agents en 2026, vous utilisez soit les trois composants de Smallville ou justifiez explicitement pourquoi vous ne le faites pas.

## Concept

### Les trois composantes

**Memory stream.**Un journal d'observations, d'actions, de réflexions et de plans, uniquement en annexe. Chaque entrée a un timestamp, un type, une description (langue naturelle) et des métadonnées dérivées: **recency**- Je suis là .**importance**(auto-évalué 1 à 10 par l'agent), et **relevance**(semblance de cousin avec la requête actuelle).

```
[2026-02-14 09:12:03] observation: Isabella Rodriguez asked me if I like jazz
[2026-02-14 09:14:22] reflection:   I enjoy long conversations about music
[2026-02-14 10:05:00] plan:         Attend Isabella's Valentine's Day party tonight
```

La récupération de mémoire combine les trois scores: `score = w_recency * e^(-decay * age) + w_importance * importance + w_relevance * cos_sim`Les entrées de haut de K entrent dans la requête actuelle.

**Reflection.**Il est également possible de récupérer des informations sur les données de base de la mémoire de l'architecture, en utilisant des données de base de données.

**Plan.**Décomposition en haut et en bas. D'abord, un plan de jour en grandes lignes (" aller travailler, dîner avec Klaus "). Ensuite des plans à l'heure.

### Pourquoi les trois choses comptent (ablation)

Park et al. ont réalisé des ablations en abandonnant chacune de l'observation, de la réflexion et du plan.

- Sans**observation**L'agent manque de contexte et agit sur des croyances périmées.
- Sans**reflection**l'agent ne peut pas former des croyances de plus haut ordre; les interactions restent superficielles.
- Sans**plan**Le comportement devient un bruit réactif; les objectifs se dissipent.

Les scores de crédibilité des évaluateurs humains sont les plus élevés avec les trois; la chute de n'importe lequel produit une régression mesurable.

### L'émergence de la Saint-Valentin

Une agent, Isabella Rodriguez, est semée avec le but " veut organiser une fête de la Saint-Valentin au Hobbs Cafe le 14 février à 17h. " Les 24 autres agents ne reçoivent pas de telles semences.

1. Le plan d'Isabella inclut d'inviter les gens.
2. Chaque invitation devient une observation dans le flux de mémoire d'un voisin.
3. Cette réflexion de la voisine suscite des croyances: " Isabella organise une fête. "
4. Le plan du voisin inclut "assister à une fête le 14 février".
5. Les voisins disent aux autres voisins, l'invitation se répand sans coordination centrale.
6. À 17 h le 14 février, plusieurs agents se sont rassemblés au café Hobbs.

Il s'agit d'une émergence au sens technique: le comportement au niveau du système (un parti) est issu d'interactions locales (invitations bilatérales + planification individuelle) sans orchestrateur central.

### Les modes de défaillance documentés

Parque et coll. documentent explicitement:

- **Spatial norm errors.**Les agents entrent dans des magasins fermés. Les agents essaient d'utiliser la même salle de bain individuelle. Les agents mangent dans des salles non destinées à manger. Le modèle ne déduit pas les normes socio-physiques de l'environnement seulement.
- **Memory overflow.**Les opérations de simulation profonde entraînent une augmentation des coûts de récupération de mémoire.
- **Reflection hallucination.**Les réflexions peuvent inventer des relations qui n'existent pas dans le flux de mémoire.

Ce sont des modes de défaillance liés à la production: toute simulation d'agent 2026 les hérite.

### Règles de mise en œuvre en trois éléments

1. **Memory is append-only.**Ne changez jamais une entrée de mémoire.
2. **Importance scores are cheap.**Appelle le Master pour évaluer l'importance de 1 à 10 au moment de la rédaction.
3. **Retrieval is ranked, not filtered.**Top-k par score combiné; n'utilisez pas de filtres durs (qui perdent de leur contexte).
4. **Reflection runs periodically.**Trigger lorsque la somme de l'importance des souvenirs non traités dépasse un seuil (par exemple, 150).
5. **Plans are revisable.**Lorsqu'une nouvelle observation contredit un plan, régénérez seulement le segment affecté, pas l'ensemble du plan.

### Agents génératifs au-delà de Smallville

La littérature de suivi 2024-2026 étend l'architecture:

- **Multi-agent social simulation for policy / market research.**Les populations de Smallville simulent le comportement des utilisateurs en réponse aux caractéristiques.
- **NPC AI for games.**Les jeux de rôle avec des agents de Smallville produisent des histoires émergentes au lieu de quêtes scriptées.
- **Generative-agent evaluation benchmarks.**Plutôt que de préciser les tâches, la métrique devient crédibilité + cohérence du comportement sur de longues périodes.

L'architecture est la référence. Les extensions échanger des composants (stockage vectoriel pour la mémoire, récupération augmentée de la réflexion, plan neurosymbolique) mais garder la structure en trois parties.

### Pourquoi cela importe pour l'ingénierie multi-agents

Smallville est la preuve du concept que l'émergence de multi-agents est bon marché lorsque les composants sont corrects. L'architecture a maintenant été reproduite sur les modèles open source (les LLM plus petits perdent la crédibilité avec gracie, pas fortement).**emergent social behavior**Tout système qui a besoin de**tight task execution**utilise les modèles de superviseurs / rôles / primitives de plus tôt dans cette phase.

```figure
a5-memory-reflection
```

## Faites-le

`code/main.py`Il implique les trois composants dans stdlib Python avec des politiques d'agent scripté (pas de véritable LLM).

- `MemoryStream` Appendice de journaux uniquement avec récupération de récente/importance/relevance.
- `reflect(stream)`Réflexion sur les récents souvenirs d'une grande importance.
- `plan(agent_state)` des plans au niveau journalier et horaire basés sur les croyances actuelles.
- Scenario: 5 agents. L'agent 1 commence par "fête à 17h". Au cours des tiques simulées, l'invitation se répand et les agents convergent.

Je vais courir .

```
python3 code/main.py
npx tsx code/main.ts
```

Les résultats attendus: trace de tirage par tirage. Au dernier tirage, au moins 3 des 5 agents montrent le parti dans leur plan, et ils convergent à l'emplacement du parti.

## Utilisez-le

`outputs/skill-simulation-designer.md`Il conçoit une simulation générative-agent: nombre d'agents, schéma de mémoire, cadence de réflexion, horizon de plan et métrique d'évaluation.

## La faire partir

Règles pour les simulations de production:

- **Memory is the database.**Choisissez un magasin réel (vecteur DB, Postgres) à l'échelle.
- **Log the retrieval trace.**Pour chaque action, enregistrez les souvenirs qui l'ont conduite.
- **Budget per-agent tokens.**Le plan de chaque agent pour chaque tique est $O(k)$N agents × T ticks × appels par tick peuvent enfanter votre budget.
- **Compact memory periodically.**Résumé et séquence des entrées de faible importance.
- **Detect spatial / social norm violations**L'architecture ne les apprend pas.

## Exercices

1. On court .`code/main.py`Confirmez que 3 agents sont convergents à la fête.
2. Le comportement est-il le même ?
3. Introduisez un objectif en compétition (" Klaus veut donner une conférence de recherche à 17h ").
4. Ajouter des contraintes spatiales: Hobbs Cafe peut contenir au plus 4 agents. La manche de simulation déborde-t-elle avec élégance, ou frappe-t-elle le modèle de défaillance de la salle de bain à une seule personne?
5. Par exemple, la section 6 (expériences de comportement émergentes) identifie un comportement non reproduisable dans votre miniature.

## Les termes clés

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Memory stream | "The agent's diary" | Append-only log of observations, actions, reflections, plans. |
| Recency | "How new is the memory" | Exponential-decay score by age. |
| Importance | "How much does the agent care" | Self-rated 1-10 at write time. Cached. |
| Relevance | "How related to the current query" | Cosine similarity (embedding-based). |
| Reflection | "Higher-order belief" | Synthesis generated from recent memories, re-ingested as a new memory. |
| Plan | "Day/hour/action decomposition" | Top-down plan tree. Revisable when observations contradict. |
| Smallville | "Park 2023's sandbox" | 25-agent simulation that produced the Valentine's Day emergence. |
| Believability | "The quality metric" | Human-rater score for whether behavior seems like a plausible agent. |

## Pour en savoir plus

- [Park et al. — Generative Agents: Interactive Simulacra of Human Behavior](https://arxiv.org/abs/2304.03442) l'architecture de référence
- [UIST '23 paper page](https://dl.acm.org/doi/10.1145/3586183.3606763) lieu de publication
- [Smallville code release](https://github.com/joonspk-research/generative_agents) mise en œuvre de référence Python
- [Hayes-Roth 1985 — A Blackboard Architecture for Control](https://www.sciencedirect.com/science/article/abs/pii/0004370285900639) l'art antérieur des agents de mémoire structurée
