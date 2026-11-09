# Réouverture et planification et exécution: planification déconnectée

> ReAct interpose la pensée et l'action dans un flux. ReWOO les sépare: un grand plan à l'avance, puis exécute. 5 fois moins de jetons, +4% de précision sur HotpotQA, et vous pouvez distiller le planificateur dans un modèle 7B. Plan-and-Execute l'a généralisé; Plan-and-Act l'a porté à la navigation Web.

**Type:** Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 01 (Agent Loop)
**Time:** ~60 minutes

## Objectifs d'apprentissage

- Expliquez pourquoi la fraction Planner / Worker / Solver de ReWOO économise des jetons et améliore la robustesse sur la boucle interleavée de ReAct.
- Implémenter un plan DAG, un exécuteur d'ordre dépendance et un résolveur qui compose les sorties de travail  tous stdlib.
- Décidez quand une tâche doit être exécutée en plan-et-exécution par rapport à ReAct interlevé, en utilisant le cadre "cinq modèles de flux de travail" de 2026 (Anthropic).
- Reconnaître quand les données synthétiques du plan Plan-and-Act sont nécessaires pour des tâches Web ou mobiles à long terme.

## Le problème

La boucle de réaction-pensée-observation interdite de ReAct est simple et flexible, mais chaque appel à l'outil doit contenir le contexte précédent complet  y compris chaque pensée précédente. L'utilisation des jetons augmente quadratiquement avec la profondeur. Pire: lorsqu'un outil échoue au milieu de la boucle, le modèle doit dériver le plan entier de l'observation d'erreur.

ReWOO (Xu et coll., arXiv:2305.18323, mai 2023) a remarqué cela et a fait un pari: planifier tout à l'avance, chercher des preuves en parallèle, comporter la réponse à la fin. Un appel à la planification de LLM, N outil demande des preuves (peut être parallèle), un appel à la résolution de LLM. Le commerce est moins souple (le plan est statique) pour une efficacité de jeton beaucoup plus élevée et des modes de défaillance plus clairs.

## Le concept

### Les trois rôles

```
Planner:  user_question -> [plan_dag]
Workers:  [plan_dag]     -> [evidence]        (tool calls, possibly parallel)
Solver:   user_question, plan_dag, evidence -> final_answer
```

Le planificateur produit un DAG. Chaque nœud nomme un outil, ses arguments et les nœuds antérieurs dont il dépend (références comme `#E1`- Je suis là .`#E2`Les ouvriers exécutent les nœuds dans l'ordre topologique.

### Pourquoi 5 fois moins de jetons

ReAct augmente la longueur de la prompt en ligne avec le nombre de étapes. À l'étape 10, la prompt contient la pensée 1 plus l'action 1 plus l'observation 1 plus la pensée 2 plus l'action 2 plus l'observation 2, etc. Chaque étape intermédiaire inclut également de manière redondante la prompt originale.

ReWOO paie un prompt de planificateur (grand), N petits employés (chacun juste l'appel à l'outil, pas de chaîne), et un prompt de résolveur. sur HotpotQA, le papier mesure ~ 5 fois moins de jetons tout en obtenant une précision absolue de +4.

### Pourquoi il est plus robuste

Si le travailleur 3 échoue dans ReAct, la boucle doit raisonner à partir de l'erreur au milieu du courant. Dans ReWOO, le travailleur 3 renvoie une chaîne d'erreur; le résolveur la voit dans le contexte du plan d'origine et peut se dégrader avec grâce. La localisation de l'échec est par nœud, pas par étape.

### Destillation par planificateur

Le deuxième résultat du document: parce que le planificateur ne voit pas les observations, vous pouvez affiner un modèle 7B sur les sorties du planificateur d'un professeur 175B. Le petit modèle gère la planification; le grand modèle n'est pas nécessaire à l'inférence.

### Plan et exécution (2023)

L'équipe LangChain a généralisé ReWOO en août 2023 en un nom de modèle: Plan-et-Execute. Le planificateur d'avant émet une liste d'étapes, l'exécuteur exécute chaque étape, un réplanificateur optionnel peut réviser après avoir observé les résultats.

### Le projet de loi (Erdogan et coll., arXiv:2503.09572, ICML 2025)

Plan-and-Act étalonne le schéma à des agents Web et mobiles à long horizon. La contribution clé est les données de plan synthétiques: un générateur de trajectoire étiqueté produit des données de formation où le plan est explicite. Utilisé pour affiner les modèles de planificateur qui continuent à travailler après 3050 étapes sur des tâches similaires à WebArena où une seule trajectoire ReAct perd de la cohérence.

### Quand choisir lequel

| Pattern | When |
|---------|------|
| ReAct | Short tasks, unknown environment, need reactive exception handling |
| ReWOO | Structured tasks with known tools, token-sensitive, parallelizable evidence |
| Plan-and-Execute | Like ReWOO but with replanning after partial execution |
| Plan-and-Act | Long-horizon (>30 steps), web/mobile/computer-use |
| Tree of Thoughts | Search is worth paying for (Lesson 04) |

Direction de décembre 2024 d'Anthropic: commencez par le plus simple. Si la tâche est un appel à outil plus un résumé, ne construisez pas ReWOO. Si la tâche est une tâche de recherche en 40 étapes, ne faites pas ReAct seul.

```figure
rewoo-plan
```

## Faites-le

`code/main.py`met en œuvre un jouet ReWOO:

- `Planner` une politique scriptée qui émet un plan DAG à partir d'un prompt.
- `Worker` envoie l'appel à l'outil de chaque nœud via le registre.
- `Solver` composition écrite qui lit les preuves et produit une réponse finale.
- Résolution de la dépendance  références comme `#E1`sont remplacés par des produits de travail antérieurs.

La démo répond à "Quelle est la population de la capitale de la France, arrondie à des millions?" en utilisant un plan en deux étapes: (1) rechercher la capitale, (2) rechercher la population, puis résoudre.

- Je vais le faire.

```
python3 code/main.py
npx tsx code/main.ts
```

La trace montre d'abord le plan complet, puis les résultats du travailleur, puis la composition du solveur.

## Utilisez-le

LangGraph envoie Plan-and-Execute comme recette (`create_react_agent`Pour ReAct, des graphiques personnalisés pour exécuter le plan). Les flux de CrewAI codent directement le schéma: vous définissez les tâches à l'avance et le DAG de Flow les exécute.

## La faire partir

`outputs/skill-rewoo-planner.md`génère un plan DAG ReWOO à partir d'une demande d'utilisateur, donné un catalogue d'outils. Il valide le plan (acyclique, chaque référence résolue, chaque outil existe) avant de le remettre à un exécuteur.

## Exercices

1. L'exécution parallèle des travailleurs pour les nœuds de plan indépendants.
2. Ajouter un nœud de réaménagement qui s'allume si un travailleur renvoie une erreur. Quelle est la plus petite modification à ReWOO qui le rend Plan-et-Execute ?
3. Remplacez`Planner`avec un petit modèle (classe 7B) et garder `Solver`Comparer la qualité de bout en bout  où la fraction échoue-t-elle ?
4. Lisez la section 4 du document ReWOO sur la distillation des planificateurs.
5. Le jouet est porté à la forme de la trajectoire du Plan-et-Act: le plan est une séquence, pas un DAG.

## Les termes clés

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| ReWOO | "Reasoning without observations" | Plan, then fetch evidence in parallel, then solve — no observations in the planning prompt |
| Plan-and-Execute | "LangChain's plan-execute pattern" | ReWOO with an optional replanner node after execution |
| Plan-and-Act | "Scaled plan-execute" | Explicit planner/executor split with synthetic plan training data for long-horizon tasks |
| Evidence reference | "#E1, #E2, ..." | Plan-node placeholder substituted with prior worker output at dispatch time |
| Planner distillation | "Small planner, big executor" | Fine-tune a small model on planner traces from a large teacher |
| Token efficiency | "Fewer round trips" | 5x fewer tokens on HotpotQA vs ReAct in the paper |
| DAG executor | "Topological dispatcher" | Runs plan nodes in dependency order; parallel at each level |

## Pour en savoir plus

- [Xu et al., ReWOO: Decoupling Reasoning from Observations (arXiv:2305.18323)](https://arxiv.org/abs/2305.18323) le papier canonique
- [Erdogan et al., Plan-and-Act (arXiv:2503.09572)](https://arxiv.org/abs/2503.09572) planificateur-exécuteur à l'échelle avec des plans synthétiques
- [LangGraph Plan-and-Execute tutorial](https://docs.langchain.com/oss/python/langgraph/overview) la recette de base
- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) Choisissez le modèle le plus simple qui fonctionne
