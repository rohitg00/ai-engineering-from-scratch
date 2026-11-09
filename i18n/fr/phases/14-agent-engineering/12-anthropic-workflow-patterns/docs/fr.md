# Les modèles de flux de travail d'Anthropic: plus simples que complexes

> Schluntz et Zhang (Anthropic, Déc 2024) distinguent les flux de travail (pistes prédéfinies) des agents (utilisation dynamique des outils).

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 01 (Agent Loop)
**Time:** ~60 minutes

## Objectifs d'apprentissage

- Nommez les cinq modèles de flux de travail d'Anthropic: chaîne rapide, routage, parallélisation, orchestrateur-travailleur, évaluateur-optimisateur.
- Expliquez la différence entre les agents et les flux de travail et le coût de l'ingénierie de chacun.
- Identifier le moment où choisir un flux de travail au lieu d'un agent (et vice versa).
- Implémenter les cinq modèles dans le stdlib contre un LLM scénarisé.

## Le problème

Les équipes recherchent des cadres multi-agents pour les problèmes qui nécessitent un appel à une seule fonction. Le coût est réel: les cadres ajoutent des couches qui obscurcissent les demandes, cachent le flux de contrôle et invitent la complexité prématurée.

## Le concept

### Flux de travail par rapport aux agents

- **Workflow.**Les LLM et les outils sont orchestrés par des chemins de code prédéfinis.
- **Agent.**Les LLM dirigent dynamiquement leurs propres outils et font leurs propres pas.

Les deux ont leur place. Les flux de travail sont moins chers, plus rapides et plus faciles à déboguer. Les agents débloquent des problèmes sans fin, mais rendent les modes d'échec plus difficiles à raisonner.

### Le LLM complémentaire

Fondation pour les cinq modèles: un LLM avec trois capacités câblées en  recherche (reprise), outils (actions), mémoire (persistance).

### Les cinq modèles

1. **Prompt chaining.**La sortie de l'appel 1 est l'entrée de l'appel 2. Utilisez-la lorsqu'une tâche a une décomposition linéaire propre. Ports programmatiques optionnels entre les étapes.

2. **Routing.**Un classifiateur LLM choisit le LLM ou l'outil en aval à invoquer. Utilisez lorsque des entrées catégoriquement différentes nécessitent une manipulation différente (support de niveau 1 vs remboursement vs bug vs ventes).

3. **Parallelization.**Exécuter N LLM appels simultanément, résultats agrégés. Deux formes: sectionnement (couches différentes) et vote (même prompt, N coure, majorité/synthèse).

4. **Orchestrator-workers.**Un LLM orchestrateur décide dynamiquement quels travailleurs (également LLM) exécuter et synthétise leur production.

5. **Evaluator-optimizer.**Un LLM propose une réponse, un autre LLM l'évalue. Iterer jusqu'à ce que l'évaluateur passe.

### Où les flux de travail battent les agents

- **Predictable tasks.**Si vous pouvez énumérer les étapes, vous devriez.
- **Cost-bound tasks.**Les flux de travail ont un nombre limité d'étapes; les agents peuvent être en spirale.
- **Compliance-bound tasks.**Les auditeurs veulent lire le graphique, pas le déduire des trajectoires.

### Où les agents battent les flux de travail

- **Open-ended research.**Quand la prochaine étape dépend de ce que la dernière étape a rendu.
- **Variable-length tasks.**Minutes à heures de travail où le nombre d'étapes est inconnu.
- **Novel domains.**Si vous ne connaissez pas encore le bon flux de travail, explorez d'abord, codifiez plus tard.

### Le compagnon de l'ingénierie contextuelle

" Ingénierie contextuelle efficace pour les agents d'IA " (Anthropic 2025) formalite la discipline adjacente: la fenêtre 200k est un budget, pas un conteneur. Qu'est-ce qu'il faut inclure, quand compacter, quand laisser le contexte croître. Couvert en détail dans la phase 14 leçon sur la compression de contexte (phase 14 leçon 06 précédente dans ce programme d'études avant la renumération).

```figure
workflow-chain
```

## Faites-le

`code/main.py`Il met en œuvre les cinq modèles de flux de travail par rapport à un `ScriptedLLM`- Le numéro de la liste:

- `prompt_chain(input, steps)` séquentielle.
- `route(input, classifier, handlers)` classification + expédition.
- `parallel_vote(prompt, n, aggregator)` N couronne, agrégée.
- `orchestrator_workers(task, workers)`L'orchestre choisit les ouvriers.
- `evaluator_optimizer(task, proposer, evaluator, max_iter)` boucle jusqu'à la passée.

- Je vais le faire.

```
python3 code/main.py
npx tsx code/main.ts
```

Chaque modèle imprime sa trace. Le total des lignes de code par modèle est de ~10-15; le coût d'un cadre est mesuré en milliers.

## Utilisez-le

- L'API directe appelle pour la plupart des tâches.
- Framework seulement lorsque le modèle a vraiment besoin d'un état durable (LangGraph), de la concurrence acteur-modèle (AutoGen v0.4), ou de la modélisation de rôle (CrewAI).
- Recherchez le SDK de Claude Agent quand vous voulez la forme du harnais Claude Code sans le reconstruire.

## La faire partir

`outputs/skill-workflow-picker.md`choisit le bon modèle pour une description de tâche donnée, y compris la justification de la décision et le chemin du réfacteur vers un agent si les flux de travail ne sont pas suffisants.

## Exercices

1. La mise en œuvre de l'itinéraire avec un seuil de confiance. En dessous du seuil -> escalade à humain. Où se trouve le seuil pour un cas d'utilisation de support de niveau 1 ?
2. Ajoutez un temps de pause à `parallel_vote`Comment on fait pour compenser les voix manquantes ?
3. Tournez-vous`evaluator_optimizer`En tant que bandit, conservez les deux premières sorties en plusieurs iterations afin qu'un bon résultat tardif ne soit pas écrasé par un mauvais tardif.
4. Combinez la chaîne de prompt avec le routage: un routeur choisit une des trois chaînes. Mesurez le coût des jetons par rapport à une seule alternative à grande demande.
5. Choisissez une fonction de production, dessinez le graphique du flux de travail, comptez les étapes.

## Les termes clés

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Workflow | "Predefined flow" | Engineer-owned graph of LLM and tool calls |
| Agent | "Autonomous AI" | Model-owned graph; dynamic tool direction |
| Augmented LLM | "LLM with tools" | LLM + search + tools + memory; the atomic unit |
| Prompt chaining | "Sequential calls" | Output of call N is input to call N+1 |
| Routing | "Classifier dispatch" | Pick which chain/model handles the input |
| Parallelization | "Fan out" | N concurrent calls; aggregate by sectioning or voting |
| Orchestrator-workers | "Dispatcher agent" | Orchestrator LLM picks specialist LLMs dynamically |
| Evaluator-optimizer | "Proposer + judge" | Iterate until evaluator passes; Self-Refine generalized |

## Pour en savoir plus

- [Anthropic, Building Effective Agents (Dec 2024)](https://www.anthropic.com/research/building-effective-agents) les cinq modèles de flux de travail
- [Anthropic, Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) la discipline du compagnon
- [LangGraph overview](https://docs.langchain.com/oss/python/langgraph/overview) lorsque les graphiques d'état gagnent leur coût
- [OpenAI Agents SDK](https://openai.github.io/openai-agents-python/) le modèle des ouvriers-orchestre, produit
