# Réfléchissez: Apprendre à renforcer la parole

> La RL basée sur les gradients a besoin de milliers d'essais et d'un graphiteur pour corriger un mode défaillance. Reflexion (Shinn et coll., NeurIPS 2023) le fait en langage naturel: après chaque essai raté, l'agent écrit une réflexion, la stocke dans la mémoire épisodique et conditionne le prochain essai sur cette mémoire. C'est le modèle derrière le calcul du temps de sommeil de Letta, les apprentissages de Claude Code sur CLAUDE.md et la règle d'apprentissage pro-flux de travail.

**Type:** Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 01 (Agent Loop), Phase 14 · 02 (ReWOO)
**Time:** ~60 minutes

## Objectifs d'apprentissage

- Nombre des trois composantes de Réflexion (Acteur, Évaluateur, Autoreflex) et le rôle de la mémoire épisodique.
- Implémenter une boucle de réflexion stdlib avec évaluateur binaire, tampon de réflexion et nouvelles tentatives de réécriture.
- Choisissez entre des sources de rétroaction scalaires, heuristiques et auto-évaluées pour une tâche donnée.
- Expliquez pourquoi le renforcement verbal capture des erreurs que la RL basée sur le gradient aurait besoin de milliers d'essais pour corriger.

## Le problème

Un agent échoue à une tâche. Dans la RL standard, vous pourriez effectuer des milliers d'essais supplémentaires, calculer des gradients, mettre à jour des poids.

La réflexion (Shinn et coll., arXiv:2303.11366) pose une autre question: et si l'agent pensait simplement à pourquoi il a échoué et essayait à nouveau avec cette pensée dans son prompt? Pas de mises à jour de poids. Pas de gradient.

Le résultat: sur ALFWorld, il bat ReAct et d'autres lignes de base non finement réglées. sur HotpotQA, il s'améliore par rapport à ReAct. sur la génération de code (HumanEval / MBPP) il met à jour l'état de l'art à l'époque. Tout cela sans un seul pas de gradient.

## Le concept

### Les trois composantes

```
Actor         : generates a trajectory (ReAct-style loop)
Evaluator     : scores the trajectory — binary, heuristic, or self-eval
Self-Reflector: writes a natural-language reflection on the failure
```

Plus une structure de données:

```
Episodic memory: list of prior reflections, prepended to the next trial's prompt
```

Un essai est effectué par l'Acteur. L'évaluateur le note. Si le score est faible, l'Auto-Reflecteur produit une réflexion ("J'ai choisi l'outil incorrect parce que j'ai mal lu la question comme posant une question sur X quand il demandait sur Y"). La réflexion entre dans la mémoire épisodique.

### Trois types d'évaluateurs

1. **Scalar** un signal binaire externe. ALFWorld réussit ou échoue. Tests HumanEval réussissent ou échouent.
2. **Heuristic** signatures de défaillance prédéfinies. "Si l'agent a produit la même action deux fois de suite, marquez comme coincé". "Si la trajectoire dépasse 50 étapes, marquez comme inefficace".
3. **Self-evaluated** le LLM marque sa propre trajectoire. nécessaire lorsqu'aucune vérité fondée n'est disponible. signal plus faible; bien associé à la vérification fondée sur des outils (leçon 05  CRITIC).

Le modèle par défaut de 2026 est un mélange: scalaire quand il est disponible, auto-égale quand il n'est pas, heuristique comme rails de sécurité.

### Pourquoi cela généralise-t-il

La réflexion n'est pas un nouvel algorithme mais un modèle nommé.

- Letta's sleep-time computation (leçon 08): un agent séparé réfléchit sur les conversations passées et écrit aux blocs de mémoire.
- Le code de Claude `CLAUDE.md`/ "sauvage de la mémoire": réflexions capturées en tant qu'apprentissage, pré-pendées pour les futures séances.
- Les flux de travail pro`/learn-rule`commandes: corrections prises en tant que règles explicites.
- Les nœuds de réflexion de LangGraph: un nœud qui note la sortie et les routes pour les affiner si nécessaire.

Tout cela découle du même point de vue: le langage naturel est un moyen suffisamment riche pour transporter "ce que j'ai appris de l'échec" entre les deux sessions.

### Quand ça marche et quand ça ne marche pas

La réflexion fonctionne lorsque:

- Il y a un signal de défaillance clair (faillance des tests, erreur de l'outil, mauvaise réponse).
- La classe de tâches est reproduisable (le même type de question peut être posé à nouveau).
- La réflexion a de la place pour améliorer la trajectoire (budget d'action suffisant).

La réflexion ne peut pas aider si:

- L'agent réussit déjà à la première tentative.
- L'échec est externe (réseau en panne, outil cassé)  la réflexion sur "réseau était en panne" n'aide pas les futurs exécutions.
- La réflexion se transforme en superstition  en stockant un récit sur une course à pied unique.

2026: dépôt: pourriture de la mémoire. Les réflexions s'accumulent; certaines sont obsolètes ou fausses; les ré-exécutions deviennent plus lentes à mesure que le tampon épisodique augmente.

```figure
react-trace
```

## Faites-le

`code/main.py`Il met en œuvre Reflexion sur un puzzle de jouet: produire une liste de 3 éléments qui s'ajoute à une cible. L'acteur émet des listes de candidats; l'évaluateur vérifie la somme; l'auto-réflecteur écrit une ligne sur ce qui est mal passé. La réflexion va dans la mémoire épisodique pour le prochain essai.

Components:

- `Actor` une politique écrite qui s'améliore lorsqu'elle voit des réflexions.
- `Evaluator.binary()` Passer ou échouer sur la somme cible.
- `SelfReflector` génère un diagnostic à une seule ligne de l'échec.
- `EpisodicMemory` une liste limitée avec la sémantique TTL.

- Je vais le faire.

```
python3 code/main.py
npx tsx code/main.ts
```

La trace montre trois essais. L'essai 1 échoue, une réflexion est stockée, l'essai 2 voit le reflet et s'améliore mais échoue toujours, l'essai 3 réussit.

## Utilisez-le

LangGraph envoie la réflexion comme un modèle de nœud.`/memory`Les commandes et les flux de travail pro`/learn-rule`Letta's compute de temps de sommeil exécute l'auto-réflecteur en temps d'arrêt afin que l'agent principal reste lié à la latence. OpenAI Agents SDK ne délivre pas directement la réflexion; vous le construisez avec une garde personnalisée qui rejette les trajectoires par score et une mémoire`Session`qui survit à travers les courants.

## La faire partir

`outputs/skill-reflexion-buffer.md`crée et maintient un tampon épisodique avec capture de réflexion, TTL et déduplication.

## Exercices

1. Passer de l'évaluation binaire à l'évaluation scalaire qui renvoie une mesure de distance (à quelle distance de la cible).
2. Ajoutez à la réflexion un TTL de 10 essais.
3. Appliquez l'évaluation heuristique: marquez l'essai comme bloqué si la même action se répète.
4. Exécutez Reflexion avec un Acteur adversaire qui ignore les réflexions.
5. Lisez la section 4 du document Reflexion sur AlfWorld.

## Les termes clés

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Reflexion | "Self-correction" | Shinn et al. 2023 — Actor, Evaluator, Self-Reflector plus episodic memory |
| Verbal reinforcement | "Learning without gradients" | Natural-language reflection prepended to the next trial's prompt |
| Episodic memory | "Per-task reflections" | Bounded buffer of prior reflections for one task class |
| Scalar evaluator | "Binary success signal" | Pass/fail or numeric score from ground truth |
| Heuristic evaluator | "Pattern-based detector" | Predefined failure signatures (e.g. stuck-loop, too-many-steps) |
| Self-evaluator | "LLM-as-judge on own trace" | Lower-signal fallback when no ground truth — pair with tool-grounded verification |
| Memory rot | "Stale reflections" | Episodic buffer fills with obsolete entries; fix with compaction/TTL |
| Sleep-time reflection | "Async self-reflection" | Run Self-Reflector off the hot path so primary agent stays fast |

## Pour en savoir plus

- [Shinn et al., Reflexion: Language Agents with Verbal Reinforcement Learning (arXiv:2303.11366)](https://arxiv.org/abs/2303.11366) le papier canonique
- [Letta, Sleep-time Compute](https://www.letta.com/blog/sleep-time-compute) Réflexion asynchrone dans la production
- [Anthropic, Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) gérer le tampon épisodique dans le cadre du contexte
- [LangGraph overview](https://docs.langchain.com/oss/python/langgraph/overview) modèle de nœud de réflexion
