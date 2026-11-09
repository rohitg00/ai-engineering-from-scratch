# Le paysage des agents de codage autonomes (2026)

> Le taux de vérification de la banque SWE est passé de 4% à 80,9% en moins de trois ans. Le même Claude Sonnet 4.5 a obtenu 43,2% sur SWE-agent v1 et 59,8% sur Cline autonome  l'échafaudage autour du modèle compte maintenant autant que le modèle lui-même. OpenHands (anciennement OpenDevin) est la plateforme la plus active sous licence MIT et sa boucle CodeAct exécute des actions Python directement dans une boîte à sable au lieu d'appels à l'outil JSON. Les numéros de titre cachent un problème méthodologique: 161 des 500 tâches vérifiées SWE-bench nécessitent seulement un changement de ligne 12, et SWE-bench Pro (10 tâches de ligne +) se situe à 2359% pour les mêmes modèles frontaliers.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, CodeAct vs JSON tool-call comparison)
**Prerequisites:** Phase 14 · 07 (Tool use), Phase 15 · 01 (Long-horizon agents)
**Time:** ~45 minutes

## Le problème

La question correcte est: sur une répartition des tâches qui correspond à mon travail, avec l'échafaudage que je vais exécuter en production, quelle fiabilité de bout en bout obtiens-je?

Entre 2022 et 2026, le champ a appris que l'échafaudage  la couche de récupération, le planificateur, la boîte à sable, la boucle de vérification de la modification, le format de rétroaction  est porteur de charge. Claude Sonnet 4.5 sur SWE-agent v1 a obtenu 43,2% sur SWE-bench Verified; le même modèle à l'intérieur de l'échafaudage autonome de Cline a obtenu 59,8%. 16.6 points de différence absolus, les mêmes poids. Le modèle de base est un composant; la boucle est le produit.

Le problème du complément est que la saturation des benchmarks cache les régressions. SWE-bench Verified est proche de saturation, et la queue facile à effectuer (161 des 500 tâches nécessitant ≤ 2 lignes) tire les meilleurs scores. La qualité du monde réel est mieux mesurée sur des distributions comme SWE-bench Pro (10 + changements de lignes), où les mêmes leaders sont toujours assis à 2359%.

## Le concept

### SWE-bench, un paragraphe

SWE-bench (Jimenez et coll.) prend de vrais problèmes GitHub avec des correctifs de base et demande à un agent de produire un correctif qui permet de passer la suite de tests. SWE-bench Verified (OpenAI, 2024) est un sous-ensemble de 500 tâches géré par l'homme avec les tâches ambiguës et brisées supprimées. SWE-bench Pro est le successeur plus difficile  tâches nécessitant plus de 10 lignes de changement, où les agents frontaliers actuels sont à 2359%.

### Ce que la courbe 2022 → 2026 montre réellement

- **2022**: modèles de recherche à ~4% sur le banc SWE brut.
- **2024**: GPT-4 + échafaudage de style Devin à ~ 14%; agent SWE à ~ 12%.
- **2025**: Claude 3.5/3.7 Sonnet à l'intérieur de Aider et agent SWE poussent dans la plage de 4055%.
- **2026**Le tableau de classement de l'Epoch AI suit en direct ce qui suit: Claude Sonnet 4.5 et les concurrents frontaliers à 7080%+ sur le banc SWE-Verified.

La pente provient de trois sources de composition: de meilleurs modèles de base, d'un meilleur échafaudage (CodeAct, réflexion, boucles de vérification) et de meilleures valeurs de référence (élimination du bruit vérifiée).

### Appels à l'outil CodeAct par rapport à JSON

OpenHands (All-Hands-AI, arXiv:2407.16741, anciennement OpenDevin) a pris un pari architectural spécifique: au lieu du modèle émettant des appels d'outil JSON que l'hôte décode et exécute, le modèle émet du code Python et un noyau de style Jupyter le gère dans une boîte à sable.

Le compromis:

- **JSON tool calls**: chaque action est une seule fois; facile à vérifier; compositionalité limitée; sûre par défaut car chaque appel passe par un validateur explicite.
- **CodeAct**: une action peut être un programme entier; composition; nécessite une boîte à sable durcie (OpenHands utilise l'isolement Docker); les modes de défaillance incluent tout ce que le temps de fonctionnement de la boîte à sable permet.

Les deux architectures sont en production. CodeAct est dominant dans les plateformes ouvertes (OpenHands, smolagents). Les appels à l'outil JSON restent dominants dans les services gérés (Agentes gérés par l'anthropie, Assistants OpenAI) où le fournisseur contrôle l'exécuteur.

### Écaflements dans le paysage de 2026

| Scaffold | License | Execution model | Notable property |
|---|---|---|---|
| OpenHands (OpenDevin) | MIT | CodeAct in Docker | Most active open platform; event-stream replayable |
| SWE-agent | MIT | Agent-Computer Interface (ACI) | First end-to-end SWE-bench scaffold |
| Aider | Apache-2 | edit-via-diff in local repo | Minimal scaffold, strong regression stability |
| Cline | Apache-2 | VS Code agent with tool policy | Highest-scoring open scaffold on Sonnet 4.5 |
| Devin (Cognition) | Proprietary | Managed VM + planner | First "AI software engineer" product category |
| Claude Code | Proprietary | Permission modes + routines | Lesson 10 covers the agent loop in detail |

### Pourquoi l'échafaudage domine

Une course de codage est une trajectoire à long horizon (leçon 1).

1. **Retrieval**L'ACI de l'agent SWE, l'index de fichiers OpenHands et la carte référencée d'Aider attaquent tout cela.
2. **Verifier loop**: exécuter des tests, lire les traces de pile et réessayer est un delta de plus de 10 points sur le banc SWE.
3. **Failure containment**Le même modèle avec et sans boucle de vérification ressemble à deux produits différents.

### La saturation des indices de référence et la réelle distribution

Les auteurs d'OpenHands et Epoch AI indiquent tous deux que SWE-bench Verified a une queue facile: 161 des 500 tâches nécessitent seulement 12 lignes de changement. Les scores élevés sont en partie motivés par cette queue. SWE-bench Pro se limite à plus de 10 changements de ligne et rend des scores dans la plage de 2359% même pour les systèmes frontaliers.

Implication pour choisir un agent: exécuter un sous-ensemble Pro-like de votre propre backlog de bug. Le score qui compte est le score sur les tâches représentatives de ce que vous expédez.

```figure
a5-scaffold-delta
```

## Utilisez-le

`code/main.py`compare deux échafaudages de jouets à l'aide d'un agent sur une distribution fixe de mini-tasks:

1. Une .**JSON tool-call**un échafaudage qui prend une action par tour.
2. Une .**CodeAct**un échafaudage qui peut émettre un petit extrait Python par action.

Les deux utilisent un " modèle " de stub (règles déterministes) afin que la comparaison isola l'échafaudage de la qualité du modèle.

## La faire partir

`outputs/skill-scaffold-audit.md`aide à vérifier un échafaudage proposé d'agent de codage avant son adoption: qualité de récupération, présence du vérificateur, isolement des boîtes à sable et conformité des points de référence à la distribution.

## Exercices

1. On court .`code/main.py`Combien de tours chaque échafaudage prend-il sur le même ensemble de tâches ?

2. Lisez le document OpenHands (arXiv:2407.16741). Le document soutient que CodeAct dépasse les appels d'outil JSON sur les tâches complexes.

3. Choisissez une tâche de votre backlog de bug qui nécessiterait plus de 10 lignes de changement sur deux fichiers. Estimer la probabilité de succès de bout en bout pour un modèle frontalier sous (a) appels à l'outil JSON et (b) CodeAct. Justifier l'écart.

4. SWE-bench Verified a 161 tâches de 12 lignes à un seul fichier.

5. Lisez "Introduction de la vérification du banc SWE" (OpenAI). Expliquez la méthodologie spécifique utilisée pour supprimer les tâches ambiguës et nommez une catégorie que la curation manquerait.

## Les termes clés

| Term | What people say | What it actually means |
|---|---|---|
| SWE-bench | "Coding benchmark" | Real GitHub issues with ground-truth patches and test suites |
| SWE-bench Verified | "Cleaned subset" | 500 human-curated tasks, easier-tail present |
| SWE-bench Pro | "Harder subset" | 10+ line changes; frontier sits at 23–59% |
| CodeAct | "Code-as-action" | Agent emits Python; Jupyter-style kernel executes in sandbox |
| JSON tool call | "Function calling" | Each action is a structured JSON payload validated before execution |
| Scaffold | "Agent framework" | Retrieval + planner + executor + verifier loop around the base model |
| ACI (Agent-Computer Interface) | "SWE-agent's format" | Command set designed for LLM ergonomics, not human shells |
| Verifier loop | "Test-and-retry" | Run tests, read output, revise patch; biggest non-model reliability gain |

## Pour en savoir plus

- [Jimenez et al. — SWE-bench](https://www.swebench.com/) l'indice de référence et la méthodologie originaux.
- [OpenAI — Introducing SWE-bench Verified](https://openai.com/index/introducing-swe-bench-verified/) comment le sous-ensemble de la sélection a été construit.
- [Wang et al. — OpenHands: An Open Platform for AI Software Developers](https://arxiv.org/abs/2407.16741) Architecture CodeAct et conception de flux d'événements.
- [Epoch AI — SWE-bench leaderboard](https://epoch.ai/benchmarks)- Les scores en direct.
- [Anthropic — Measuring agent autonomy](https://www.anthropic.com/research/measuring-agent-autonomy) cadrage de fiabilité des agents de codage à long horizon.
