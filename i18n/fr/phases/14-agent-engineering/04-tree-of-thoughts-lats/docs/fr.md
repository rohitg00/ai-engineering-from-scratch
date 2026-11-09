# L'arbre des pensées et des actions: recherche délibérée

> Une seule trajectoire de chaîne de pensée n'a pas de place pour retomber. ToT (Yao et coll., 2023) transforme le raisonnement en un arbre avec une auto-évaluation sur chaque nœud. LATS (Zhou et coll., 2024) unifie ToT avec ReAct et Réflexion dans la recherche d'arbre de Monte Carlo. Le jeu de 24 passe de 4% (CoT) à 74% (ToT); LATS atteint 92,7% pass@1 sur HumanEval.

**Type:** Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 01 (Agent Loop), Phase 14 · 03 (Reflexion)
**Time:** ~75 minutes

## Objectifs d'apprentissage

- Le raisonnement de cadre comme la recherche: les nœuds sont des "pensées", les bords sont des "expansions", la valeur est "comme prometteuse".
- Implémenter une recherche sur les arbres BFS de style stdlib ToT avec un score d'auto-évaluation.
- S' étendre à une boucle de jouets LATS MCTS avec sélection / extension / simulation / backpropagate.
- Décidez quand la recherche vaut le multiplicateur des jetons (jeu de 24, génération de code) et quand une seule trajectoire est suffisante (question simple et réponse).

## Le problème

La chaîne de pensée est une marche linéaire. Si la première étape est incorrecte, chaque étape ultérieure fonctionne sur une mauvaise prémisse.

Ce qui est nécessaire au raisonnement, c'est la capacité de proposer plusieurs candidats, de les évaluer, de choisir ceux qui sont prometteurs et de revenir en arrière quand des endroits bloqués apparaissent.

## Le concept

### L'arbre des pensées (Yao et coll., NeurIPS 2023)

Chaque nœud est une étape intermédiaire cohérente ("une pensée"). Chaque nœud peut s'étendre à des pensées de K enfant. Le LLM auto-évaluent chaque nœud avec une demande de notation.

```
                     (root: "find 24 from 4 6 4 1")
                    /               |            \
           ("6 - 4 = 2")    ("4 + 1 = 5")    ("4 * 6 = 24")  <- Score: HIGH
              /   \              |                  |
          ...    ...          ...                finish
```

L'auto-évaluation est la pièce à porter.`sure / likely / impossible`classification `1..10`Les trois ont battu CoT de façon substantielle sur le jeu de 24 (4% -> 74% avec GPT-4).

### LATS (Zhou et coll., ICML 2024)

LATS unit le TOT, le ReAct et la Réflexion sous MCTS.

- **Policy**: proposer des actions candidates suivantes (react).
- **Value function**: score une trajectoire partielle (auto-évalue à la ToT).
- **Self-reflector**: en cas d'échec, écrivez une réflexion en langage naturel (à la Réflexion) et utilisez-la pour revoir les déploiements futurs.

Les résultats en temps papier: HumanEval pass@1 92,7% avec GPT-4 (SOTA), WebShop moyenne 75,9 avec GPT-3.5 (approche de l'ajustement basé sur le gradient).

### MCTS, au minimum

Quatre phases par itération:

1. **Select** passer de la racine à la feuille en utilisant la TCC (confiance supérieure liée aux arbres).
2. **Expand** générer des enfants K par l'intermédiaire de la politique.
3. **Simulate** déploiement d'un enfant utilisant la politique, score la feuille avec la fonction de valeur (ou la récompense environnementale).
4. **Backpropagate** les comptes de visites et les estimations de valeur actualisés sur le parcours.

Formule de l' UCT: `Q(s, a) + c * sqrt(ln N(s) / N(s, a))`Le premier terme est l'exploitation, le second est l'exploration.`c`par tâche.

### La réalité des coûts

La recherche explose des jetons. ToT sur Game of 24 utilise 1001000x les jetons de CoT. LATS est similaire.

- Les tâches dans lesquelles une seule trajectoire est démontrativement insuffisante (jeu de 24, code complexe).
- Les tâches où l'horloge murale est moins importante que la précision.
- Les tâches avec une fonction de valeur bon marché et fiable (tests unitaires pour le code, cible explicite pour les mathématiques).

Si votre tâche a une seule bonne réponse et un évaluateur bruyant, la recherche rend souvent les choses pires  elle trouve une mauvaise réponse " bonne note ".

### 2026 positionnement

La plupart des agents de production n'exécutent pas de LATS. Ils exécutent ReAct avec une vérification basée sur des outils (CRITIC, leçon 05).

- Les agents de codage qui exécutent des tests en tant que fonction de valeur (au style HumanEval).
- Des agents de recherche approfondie qui explorent plusieurs chemins de requête.
- Des flux de travail lourds à planifier à l'intérieur des sous-graphes LangGraph.

AlphaEvolve (Léction 11) est l'extrême de 2025: recherche évolutionnaire sur le code, aptitude vérifiable par machine, gains frontaliers (première amélioration de la matmul 4x4 en 56 ans).

```figure
tree-of-thoughts
```

## Faites-le

`code/main.py`les implémentations:

- Un petit BFS sur une tâche stylisée "opération de sélection d'arithmétique".
- Un jeu LATS MCTS en boucle sur la même tâche (Sélection / Expansion / Simulation / Backpropagate) avec la sélection UCT.
- Une fonction de valeur qui compose un score symbolique plus un score auto-équivalent.

- Je vais le faire.

```
python3 code/main.py
npx tsx code/main.ts
```

La trace montre que ToT élargit trois candidats par nœud avec BFS, comparativement à LATS convergeant sur le meilleur déploiement via MCTS.

## Utilisez-le

LangGraph envoie l'exploration de style ToT comme modèles de sous-graphes; le blog de l'équipe LangChain sur LATS (mai 2024) est le tutoriel de référence. LlamaIndex envoie un `TreeOfThoughts`Pour la plupart des agents de production de 2026 ce modèle vit derrière une`if task_complexity > threshold: use_search()` voir le modèle d'évaluation-optimisation dans la leçon 05.

## La faire partir

`outputs/skill-search-policy.md`choisit entre ReAct linéaire, ToT, LATS et recherche évolutionnaire compte tenu de la forme de la tâche, du budget et de la fidélité de l'évaluateur.

## Exercices

1. Exécutez le jouet LATS avec UCT c=0,1 vs c=2,0.
2. Le MCTS trouve-t-il toujours la meilleure feuille ? quelle est la limite minimale de signal-à-bruit qu'il tolère ?
3. Mettre en œuvre des ToT de recherche de faisceaux (maintient le top-k à chaque niveau) et comparer avec BFS.
4. Lire la section 5.1.Réproduire le nombre de trajectories HumanEval: combien de déploiements faut-il pour atteindre le passage@1 signalé?
5. Lisez la discussion du document LATS sur "quand le LATS aide moins". Écrivez une règle de décision en un paragraphe pour cartographier la forme de la tâche pour la stratégie de recherche.

## Les termes clés

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Tree of Thoughts | "Branching CoT" | Yao et al. — tree of thought nodes with self-evaluation |
| LATS | "MCTS for LLMs" | Zhou et al. — unifies ToT + ReAct + Reflexion under MCTS |
| UCT | "Upper confidence bound" | Select formula balancing exploitation (Q) and exploration (ln N / n) |
| Value function | "How good is this state" | Prompted LLM score or environment reward; feeds backprop |
| Policy | "Action proposer" | ReAct-style generator; emits candidate next thoughts/actions |
| Rollout | "Simulated trajectory" | Walk from a node to a leaf using policy, score with value |
| Backpropagate | "Update ancestors" | Push the leaf's reward up the path, updating visit counts and Q |
| Search cost | "Token explosion" | 100-1000x CoT on Game of 24; budget before you adopt |

## Pour en savoir plus

- [Yao et al., Tree of Thoughts (arXiv:2305.10601)](https://arxiv.org/abs/2305.10601) le papier canonique
- [Zhou et al., LATS (arXiv:2310.04406)](https://arxiv.org/abs/2310.04406) MCTS avec rétroaction Réflexion
- [LangGraph overview](https://docs.langchain.com/oss/python/langgraph/overview) modèles de sous-graphe pour la recherche
- [AlphaEvolve (arXiv:2506.13131)](https://arxiv.org/abs/2506.13131) recherche évolutionnaire avec des évaluateurs programmatiques
