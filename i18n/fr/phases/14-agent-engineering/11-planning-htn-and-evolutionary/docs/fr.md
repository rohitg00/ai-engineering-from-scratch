# Planification avec HTN et recherche évolutionnaire

> La planification symbolique traite les cas où le plan est prouvablement correct. La recherche de code évolutionnaire traite les cas où la fonction de fitness est vérifiable par machine. ChatHTN (2025) et AlphaEvolve (2025) montrent ce que chacun déverrouille lorsqu'il est associé à un LLM.

**Type:** Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 02 (ReWOO and Plan-and-Execute)
**Time:** ~75 minutes

## Objectifs d'apprentissage

- Expliquer les réseaux de tâches hiérarchiques: tâches, méthodes, opérateurs, pré-conditions, effets.
- Décrivez la recherche symbolique  en boucle hybride de ChatHTN avec décomposition de la chute de LLM.
- Expliquez la boucle évolutionnaire d'AlphaEvolve et pourquoi elle ne fonctionne qu'avec un évaluateur programmatique.
- Mettre en œuvre un planificateur de jouets HTN plus une recherche évolutionnaire de jouets dans Stdlib.

## Le problème

ReWOO (leçon 02), Plan-et-Execute et ReAct couvrent la plupart des projets d'agents.

1. **Plans with provable correctness.**Le plan doit être solide par construction.Un plan de LLM fluide qui parfois hallucine une étape est inacceptable.
2. **Optimizations with a machine-checkable fitness function.**La multiplication de matrice, l'heuristique de planification, le compilateur passe  l'objectif n'est pas "un plan correct" mais "le meilleur plan".

HTN Planning et AlphaEvolve résolvent les deux problèmes différents.

## Le concept

### Réseaux hiérarchiques de tâches

Un HTN est:

- **Tasks** composé (à décomposer) et primitif (exécutable directement).
- **Methods** des moyens de décomposer une tâche composée en sous-tâches, avec des conditions préalables.
- **Operators** actions primitives avec des conditions préalables et des effets.
- **State** un ensemble de faits.

Planification: compte tenu d'une tâche cible et d'un état initial, trouver une décomposition en opérateurs primitifs dont les conditions préalables sont satisfaites en séquence.

Le HTN est plus ancien que les LLM et constitue toujours la référence pour des plans prouvablement corrects.

### Le projet de loi de l'Union européenne sur les droits de l'homme (CATHN)

ChatHTN (arXiv:2505.11814) interpose le HTN symbolique avec les requêtes de LLM:

1. Essayez de décomposer la tâche complète actuelle avec les méthodes existantes.
2. Si aucune méthode n'est appliquée, demandez au LLM: "comment décomposeriez-vous `task`dans l' État `s`Je suis là.
3. Transformer la réponse du LLM en sous-tâches candidates.
4. Valider contre le schéma de l'opérateur; rejeter les décompositions invalides.
5. - Il faut recourir.

L'affirmation centrale du document: chaque plan produit est prouvablement solide car les suggestions de LLM ne sont introduites que sous forme de décompositions candidates, jamais sous forme de modifications directes du plan.

Apprentissage en ligne des méthodes (OpenReview `gwYEDY9j2x`Le programme de suivi de la formation (en 2025) ajoute un apprenant qui généralise les décompositions produites par le LLM par régression  réduisant la fréquence de requête du LLM à 75%.

### AlphaEvolve (Novikov et coll., 2025)

AlphaEvolve (arXiv:2506.13131, DeepMind, juin 2025) est une bête différente: recherche de code évolutif orchestrée par un ensemble de Gémeaux 2.0 Flash/Pro.

- Le boucle:

1. Commencez par un programme de semence + un évaluateur programme (retourne un score de fitness).
2. L'ensemble des LLM propose des mutations.
3. Faites passer les mutations par l'évaluateur.
4. Gardez le meilleur, muter à nouveau.

Les gains publiés:

- Première amélioration par rapport à Strassen pour la multiplication de matrice complexe 4x4 en 56 ans (48 multiplication scalaire).
- 0,7% ont récupéré le calcul de Google via une heuristique de planification Borg.
- 32% de vitesse de FlashAttention sur une charge de travail frontalière.

La contrainte dure: la fonction de fitness doit être vérifiable par machine.

### Quand utiliser quel

| Problem class | Use | Why |
|---------------|-----|-----|
| Scheduling with hard constraints | HTN + ChatHTN | Provable soundness |
| Compiler optimization | AlphaEvolve | Machine-checkable fitness |
| Multi-step task execution | ReAct / ReWOO | LLM in the loop, no formal guarantees |
| Code improvement with tests | AlphaEvolve | Tests are the evaluator |
| Policy-bound automation | HTN | Preconditions encode policy |

### Où ce modèle va mal

- **HTN without operators.**Sans précondictions/ schémas d'effet, l'affirmation de solidité s'effondre.
- **AlphaEvolve without a real evaluator.**" Demandez au LLM si le code est meilleur " n'est pas une fonction de fitness.
- **Over-engineering.**La plupart des tâches d'agent n'en ont pas besoin.

```figure
htn-tree-expand
```

## Faites-le

`code/main.py`Il met en œuvre deux jouets:

- Un planificateur de réseau de téléphonie électronique avec opérateurs, méthodes, préconitions, effets et un`LLMFallback`Le "LLM" est un décomposateur scripté, donc le planificateur fonctionne hors ligne.
- Une recherche évolutive stdlib sur les programmes arithmétiques: développer des expressions dont la production est minimisée `|f(x) - target|`L'évaluation est déterministe.

- Je vais le faire.

```
python3 code/main.py
npx tsx code/main.ts
```

La trace montre le planificateur HTN décomposant une tâche composée (avec un retrait de LLM au milieu du plan) et la boucle évolutionnaire convergeant sur une expression cible.

## Utilisez-le

- **HTN planners** `pyhop`- Je suis là .`SHOP3`, ou construire votre propre pour l'application de la politique spécifique à un domaine.
- **ChatHTN** code de recherche; le modèle (symbolique + LLM fallback) est porté de manière propre à tout planificateur HTN.
- **AlphaEvolve** Paper DeepMind; le modèle (ensemble + évaluateur) est reproduisable. OpenEvolve et autres fourches open source similaires sont en train d'émerger.
- **Agent frameworks** aucun navire de première classe HTN ou AlphaEvolve encore.

## La faire partir

`outputs/skill-hybrid-planner.md`génère un échafaudage de planificateurs hybrides (HTN ou évolutionnaire) avec un rôle de MLL explicitement défini.

## Exercices

1. Prendre le plan de la ligne de transmission en mode rétro-traçage: lorsque le post-conditionnement d'un opérateur échoue à l'heure de fonctionnement, faire demi-tour et essayer la méthode suivante.
2. Ajouter un cache de méthode LLM à ChatHTN: lorsque le LLM décompose la tâche `T`dans le modèle de l'état `P`Retournez à la bibliothèque de méthodes à l'appel suivant.
3. Évoluer l'évaluateur de recherche évolutionnaire vers une suite de tests réelle. Évoluer une fonction de tri qui passe 20 cas de test; rapporter des générations à la convergence.
4. Lisez les notes de conception de l'évaluateur d'AlphaEvolve. Concevez un évaluateur pour un domaine qui vous intéresse (optimisation de requête SQL, minimisation de la suite de tests, déploiement YAML).
5. Combiner: utiliser HTN pour décomposer une tâche composée en sous-tâches, puis utiliser la recherche évolutionnaire sur l'opérateur primitif de chaque sous-tâche. Où brille-t-il, où est-il sur-ingénierie?

## Les termes clés

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| HTN | "Hierarchical planner" | Task decomposition with operators, preconditions, effects |
| Method | "Decomposition rule" | Way to break a compound task into subtasks |
| Operator | "Primitive action" | Concrete step with precondition and effect |
| ChatHTN | "LLM + HTN" | Symbolic planner asks LLM when no method matches |
| AlphaEvolve | "Evolutionary code search" | Ensemble LLMs mutate code; deterministic evaluator selects |
| Fitness function | "Evaluator" | Deterministic, machine-checkable score over outputs |
| Online method learning | "Cached LLM decomposition" | Store + generalize LLM plans to cut query cost |

## Pour en savoir plus

- [Gopalakrishnan et al., ChatHTN (arXiv:2505.11814)](https://arxiv.org/abs/2505.11814) symbolique + planificateur hybride LLM
- [Novikov et al., AlphaEvolve (arXiv:2506.13131)](https://arxiv.org/abs/2506.13131) recherche de code évolutif avec des mutations de LLM
- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) quand trouver un planificateur par rapport à une boucle simple
