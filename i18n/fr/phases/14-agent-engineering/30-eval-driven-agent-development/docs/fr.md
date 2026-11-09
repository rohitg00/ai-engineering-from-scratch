# Développement d'agents à base d'évalue

> L'évaluation n'est pas la dernière étape, c'est la boucle extérieure qui motive tous les autres choix de la phase 14.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** All of Phase 14.
**Time:** ~60 minutes

## Objectifs d'apprentissage

- Nombre des trois couches d'évaluation  référence statique, production personnalisée hors ligne, production en ligne  et à quoi sert chacune.
- Expliquez la boucle serrée de l'évaluateur-optimisateur.
- Décrire les meilleures pratiques de 2026: évaluations en direct à côté du code, exécutées en CI, relations en porte.
- Connectez chaque leçon de la phase 14 à l'évaluation qu'elle génère.

## Le problème

Les agents passent des démos. Ils échouent dans la production de manière que les démos ne peuvent pas prévoir. Les critères de référence répondent " est-ce que ce modèle est largement capable ? " et non " est-ce que cet agent expédie les bons patchs pour mon produit ? " La réponse: évaluation à trois couches, en cours de fonctionnement continu, avec chaque garde-corps et règle apprise cartographiée à un cas d'évaluation.

## Le concept

### Trois couches d'évaluation

1. **Static benchmarks** SWE-bench Verifié pour le code (leçon 19), WebArena/OSWorld pour la navigation / bureau (leçon 20), GAIA pour généraliste (leçon 19), BFCL V4 pour l'utilisation d'outils (leçon 06). Utilisation pour la comparaison entre modèles et la régression. La contamination est réelle: SWE-bench+ a trouvé 32,67% de fuite de solution.

2. **Custom offline evals** la forme de votre produit:
   - Leur rôle est de rendre des comptes à la Cour des comptes.
   - Basé sur l'exécution (exécuter le patch, vérifier les tests).
   - Basé sur la trajectoire (comparer les séquences d'action contre l'or; OSWorld-Human montre des agents supérieurs de 1,4-2,7 fois plus que l'or).

3. **Online evals** production:
   - Retours de séance (Langfuse).
   - Alertes déclenchées par la garde-ferre (leçon 16, 21).
   - Suivi des coûts / latences par étape (leçon 23 OTel couvre).

### Évaluateur-optimisateur (anthropique)

La boucle serrée:

1. Le proposateur génère la sortie.
2. Les juges évaluateurs.
3. Rétroyer jusqu'à ce que l'évaluateur passe.

Tout flux d'agent qui vous intéresse peut être intégré à un évaluateur-optimisateur pour la fiabilité.

### 2026 les meilleures pratiques

- Les Evals vivent à côté du code.
- Rendez-vous au renseignement sur chaque affaire.
- La combinaison des portes sur les scores d'évaluation (par exemple "pas de régression > 5% contre principal").
- Chaque garde-garde est une carte d'évaluation.
- Chaque règle apprise (Reflection, pro-workflow learning-rule) correspond à un cas d'échec.

### Lier la phase 14 ensemble

La plupart des leçons de la phase 14 génèrent des cas d'évaluation.

| Lesson | Eval case it generates |
|--------|------------------------|
| 01 Agent Loop | Budget-exhausted, infinite-loop guard |
| 02 ReWOO | Planner replans correctly when a tool fails |
| 03 Reflexion | Learned reflections apply on retry |
| 05 Self-Refine/CRITIC | Judge passes refined output |
| 06 Tool Use | Argument coercion works; unknown tools rejected |
| 07-10 Memory | Retrieval citations match sources; stale facts invalidate |
| 12 Workflow Patterns | Each pattern produces correct output |
| 13 LangGraph | Resume reproduces state exactly |
| 14 AutoGen Actors | DLQ catches crashed handlers |
| 16 OpenAI Agents SDK | Guardrail trips on the right inputs |
| 17 Claude Agent SDK | Subagent results return to orchestrator |
| 19-20 Benchmarks | SWE-bench Verified score, WebArena success rate, OSWorld efficiency |
| 21 Computer Use | Per-step safety catches injected DOM |
| 23 OTel | Spans emit required attributes |
| 26 Failure Modes | Detectors tag known failures |
| 27 Prompt Injection | PVE refuses poisoned retrievals |
| 28 Orchestration | Supervisor routes to the right specialist |
| 29 Runtime Shapes | DLQ handles N% failure |

Si votre suite d'évaluation a un cas pour chaque rangée, vous avez couvert le noyau de la phase 14.

### Lorsque le développement axé sur l'évaluation échoue

- **No baseline.**Les Evals sans le dernier bon connu sont illisibles.
- **LLM-judge without grounding.**Les juges ont également des hallucinations.
- **Over-fitting to evals.**L'optimisation pour l'évaluation est différente de l'utilité de la production.
- **Flaky evals.**Les cas non déterministes provoquent de fausses alarmes.

```figure
ae-eval-three-layers
```

## Faites-le

`code/main.py`est un harnais d'évaluation stdlib:

- Registre de cas avec catégories (marque de référence, personnalisée, en ligne).
- Un agent sous contrôle.
- Loup évaluateur-optimisateur: proposer, juger, affiner jusqu'à passer ou à la ronde maximale.
- Porte CI: taux de réussite agrégé + régression par rapport à la ligne de référence.

- Je vais le faire.

```
python3 code/main.py
npx tsx code/main.ts
```

Résultats: par cas, défaillance, flag de régression, verdict de la porte CI.

## Utilisez-le

- Écrivez des cas d'évaluation dans le même repo que votre code d'agent.
- Retourne sur chaque rapport public via CI.
- Faut pas construire sur la régression.
- Suivez le taux de réussite au fil du temps.
- Rattache chaque échec de production à un nouveau cas.

## La faire partir

`outputs/skill-eval-suite.md`construit une suite d'évaluation en trois couches pour un produit agent avec des portes CI et un suivi de régression.

## Exercices

1. Prenez une de vos erreurs de production, écrivez une évaluation qui la reproduit.
2. Construisez une rubrique de juge de LLM pour votre domaine avec trois dimensions (factuelle, ton, portée).
3. Faites passer la suite d'évaluation dans l'IC. Faites échouer la construction sur la régression >=5%.
4. Ajoutez une métrique de trajectorie-efficacité: combien d'étapes l'agent a-t-il fait par rapport à une trajectoire d'or?
5. Mettez chaque leçon de phase 14 dans une évaluation de votre suite.

## Les termes clés

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Static benchmark | "Off-the-shelf eval" | SWE-bench, GAIA, AgentBench, WebArena, OSWorld |
| Custom offline eval | "Domain eval" | LLM-as-judge / exec / trajectory on your product shape |
| Online eval | "Production eval" | Session replay, guardrail alerts, cost/latency tracking |
| Evaluator-optimizer | "Propose-judge-refine" | Iterate until judge passes |
| CI gate | "Merge blocker" | Fail the build on eval regression |
| Baseline | "Last-known-good" | Reference score to detect regression |
| Trajectory efficiency | "Steps over gold" | Agent step count divided by human expert minimum |

## Pour en savoir plus

- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) "débuter simple, optimiser avec les évaluations"
- [OpenAI, SWE-bench Verified](https://openai.com/index/introducing-swe-bench-verified/) l'indice de référence sélectionné
- [Berkeley Function Calling Leaderboard](https://gorilla.cs.berkeley.edu/leaderboard.html) référence de l'utilisation des outils
- [Langfuse docs](https://langfuse.com/) évaluations + répétition de session en pratique
