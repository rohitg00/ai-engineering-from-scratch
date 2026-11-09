# Autoprofit et critique: amélioration du rendement par répétition

> Self-Refine (Madaan et coll., 2023) utilise un LLM dans trois rôles  générer, rétroaction, affiner  dans une boucle. Gain moyen: +20 absolu sur 7 tâches. CRITIC (Gou et coll., 2023) durcit l'étape de rétroaction en routant la vérification via des outils externes. En 2026, ce modèle se déploie dans chaque cadre comme un "évaluateur-optimisateur" (Anthropic) ou une boucle de garde (OpenAI Agents SDK).

**Type:** Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 01 (Agent Loop), Phase 14 · 03 (Reflexion)
**Time:** ~60 minutes

## Objectifs d'apprentissage

- Les trois instructions de l'État Self-Refine (générer, rétroaction, affiner) et expliquer pourquoi l'histoire est importante pour le prompt de raffinage.
- Expliquez l'idée critique de CRITIC: les LLM ne sont pas fiables pour l'auto-vérification sans fondement externe.
- Implémenter une boucle stdlib Self-Refine avec l'historique et un vérificateur externe optionnel.
- Mettez ce schéma dans le flux de travail "évaluateur-optimisateur" d'Anthropic et les barreaux de sortie du SDK OpenAI Agents.

## Le problème

Un agent produit une réponse presque correcte. Peut-être qu'une ligne de code a une erreur de syntaxe. Peut-être qu'un résumé est trop long. Peut-être qu'un plan manque un cas d'extrémité. Ce que vous voulez, c'est: l'agent critique sa propre sortie, puis la corrige.

Autorefinement montre que cela fonctionne avec un seul modèle, pas de données de formation, pas de RL. Mais il y a un problème: les LLM sont mauvais à l'auto-vérification sur des faits concrets.

Ensemble, ces deux documents définissent la norme par défaut de 2026 pour l'amélioration itérative: générer, vérifier (externellement lorsque cela est possible), affiner, arrêter lorsque le vérificateur passe.

## Le concept

### Autorefinition (Madaan et coll., NeurIPS 2023)

Un LLM, trois rôles:

```
generate(task)            -> output_0
feedback(task, output_0)  -> critique_0
refine(task, output_0, critique_0, history) -> output_1
feedback(task, output_1)  -> critique_1
refine(task, output_1, critique_1, history) -> output_2
...
stop when feedback says "no issues" or budget exhausted.
```

Détail clé:`refine`Le document ablè ce point: l'historique de la chute et la qualité de la chute sont nettement.

Titre: +20 amélioration absolue moyenne sur 7 tâches (mathématiques, code, acronyme, dialogue) y compris GPT-4.

### CRIQUE (Gou et coll., arXiv:2305.11738, v4 février 2024)

La faiblesse de l'auto-réfinition: l'étape de rétroaction est un LLM en soi. Pour les affirmations factuelles, cela est peu fiable (une hallucination semble souvent convaincante pour le modèle qui l'a produite).`feedback(task, output)`avec `verify(task, output, tools)`où `tools`comprend:

- Un moteur de recherche pour des affirmations factuelles.
- Un interprète de code pour la correction du code.
- Une calculatrice pour l'arithmétique.
- Les vérificateurs spécifiques à un domaine (essais unitaires, vérificateurs de type, linters).

Le vérificateur produit une critique structurée basée sur les résultats des outils.

Titre: CRITIC dépasse Auto-Réfinition sur les tâches factuelles parce que la critique est basée.

### Condition d'arrêt

Deux formes communes:

1. **Verifier passes.**Les tests externes donnent le résultat. préférentiel lorsque cela est possible (essais d'unité, vérificateur de type, affirmation de barrière).
2. **No feedback issued.**Le modèle dit "la sortie est bonne". Cheap mais peu fiable; coupler avec un capot d'iteration maximale.

2026 par défaut: les combiner. " Arrêtez si le vérificateur passe OR modèle dit bien ET itérations >= 2 OR itérations >= max_iterations. "

### Évaluateur-optimisateur (Anthropic, 2024)

Le post de décembre 2024 d'Anthropic l'appelle l'un des cinq modèles de flux de travail.

- Évaluateur: note la production et produit une critique.
- Optimisateur: révise la sortie en raison de la critique.

La conception de l'analyse est un processus de révision de la structure de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de la analyse de la recherche.

### Garde-roue de sortie OpenAI Agents SDK

Un protecteur est un validateur qui fonctionne sur la sortie finale d'un agent.`OutputGuardrailTripwireTriggered`Les gardages peuvent appeler des outils (au style CRITIC) ou être des fonctions pures (au style Auto-Réfinition).

### 2026 pièges

- **Rubber-stamp loops.**Le même modèle de génération et de critique avec le même style de prompt converge sur "il me semble bien". Utilisez des instructions structurellement différentes, ou un modèle moins cher pour critiquer.
- **Over-refinement.**Chaque passe de raffinage ajoute de la latence et des jetons.
- **CRITIC on trivial tasks.**Si il n'y a pas de vérificateur externe, CRITIC dégénère en Auto-Réfinition; ne payez pas la latence pour un vérificateur de stub.

```figure
self-refine
```

## Faites-le

`code/main.py`Il implique Auto-Réfinition et CRITIC sur une tâche de jouet: produire une courte liste de balles donnée à un sujet. Le vérificateur vérifie le format (3 balles, chacune inférieure à 60 chars).

Components:

- `generate`- Producteur du scénario.
- `feedback` Autoscritie au style de la maîtrise de la loi.
- `verify_external` vérificateur fondé de style CRITIC.
- `refine` réécrit l'expérience de sortie donnée.
- Condition d'arrêt  passe de vérificateur ou max 4 itérations.

- Je vais le faire.

```
python3 code/main.py
npx tsx code/main.ts
```

Comparer les tests Auto-réfinition versus CRITIC. CRITIC capture une erreur factuelle Auto-réfinition manquée parce que le vérificateur externe a mis à terre l'auto-critique ne le fait pas.

## Utilisez-le

L'optimisateur d'évaluation d'Anthropic est ce modèle dans le langage convivial à Claude. Les barreaux de sortie du OpenAI Agents SDK sont en forme de CRITIC (les barreaux peuvent appeler des outils). LangGraph envoie un nœud de réflexion qui se lit comme Self-Refine. L'utilisation de l'ordinateur Gemini 2.5 de Google ajoute un évaluateur de sécurité à chaque étape qui est une variante CRITIC: chaque action est vérifiée avant de se commit.

## La faire partir

`outputs/skill-refine-loop.md`Configure une boucle d'évaluation-optimisateur en fonction de la forme de la tâche, de la disponibilité du vérificateur et du budget d'itération. Émet des requêtes pour le générateur, l'évaluateur/ vérificateur et l'optimisateur, ainsi qu'une politique d'arrêt.

## Exercices

1. Exécutez le jouet avec max_iterations=1.
2. Le système de vérification externe doit être remplacé par un vérificateur bruyant (faux positifs aléatoires de 30%).
3. Implémenter une variante "critique génératrice sur différents modèles": génère des modèles de grande taille, critique de modèles de petite taille.
4. Lisez la section 3 de CRITIC (arXiv:2305.11738 v4). Nommez les trois catégories d'outils de vérification et donnez un exemple pour chacune.
5. La carte OpenAI Agents SDK `output_guardrails`Qu'est-ce qui ne va pas avec le SDK, et qu'est-ce qui va bien ?

## Les termes clés

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Self-Refine | "LLM that fixes itself" | Generate -> feedback -> refine loop in one model, with history |
| CRITIC | "Tool-grounded verification" | Replace feedback with an external verifier (search, code, calc, tests) |
| Evaluator-Optimizer | "Anthropic workflow pattern" | Two roles — evaluator scores, optimizer revises — looped to convergence |
| Output guardrail | "Post-hoc check" | OpenAI Agents SDK validator that runs after an agent produces output |
| Verify step | "Critique phase" | The load-bearing decision: grounded or self-rated |
| Refine history | "What the model already tried" | Prior outputs + critiques prepended to refine prompt; drop and quality collapses |
| Rubber-stamp loop | "Self-agreement failure" | Same-prompt critique returns "looks good"; fix with structurally different prompts |
| Stop condition | "Convergence test" | Verifier passes OR no feedback AND iteration cap; never single-condition |

## Pour en savoir plus

- [Madaan et al., Self-Refine (arXiv:2303.17651)](https://arxiv.org/abs/2303.17651) le papier canonique
- [Gou et al., CRITIC (arXiv:2305.11738)](https://arxiv.org/abs/2305.11738) vérification fondée sur des outils
- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) modèle de flux de travail évaluateur-optimisateur
- [OpenAI Agents SDK docs](https://openai.github.io/openai-agents-python/) barreaux de sortie en tant que vérificateurs en forme de CRITIC
