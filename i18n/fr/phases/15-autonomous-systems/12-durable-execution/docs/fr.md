# Agents de longue durée: exécution durable

> Les agents de production à long horizon ne sont pas utilisés `while True`. Chaque appel LLM devient une activité avec un point de contrôle, une nouvelle tentative et une répétition. L'intégration du SDK OpenAI Agents de Temporal est terminée en mars 2026. Claude Code Routines (Anthropic) exécute des invocations de code Claude programmées sans un processus local persistant. Les sessions font une pause sur l'entrée humaine, survivent aux déploiements et reprennent à partir du dernier point de contrôle sur la touche de Claude Code.`thread_id`. Derrière la nouvelle ergonomie se trouve un vieux modèle  orchestration des flux de travail  avec une nouvelle entrée: LLM appelle des activités non déterministes qui doivent être répétées déterministiquement lors de la récupération.

**Type:** Learn
**Languages:** Python (stdlib, minimal durable-execution state machine), TypeScript
**Prerequisites:** Phase 15 · 10 (Permission modes), Phase 15 · 01 (Long-horizon agents)
**Time:** ~60 minutes

## Le problème

Considérez un agent qui fonctionne pendant quatre heures, appelle trois outils, demande à l'utilisateur deux fois et fait 40 appels LLM. À mi-parcours, l'hôte est en cours de redémarrage.

- Dans un naïf .`while True`La mise en œuvre de la procédure de réinitialisation est effectuée à partir de zéro. les trois appels à l'outil (avec des effets secondaires réels) sont réactivés.
- Avec une exécution durable: la course se poursuit depuis le point de contrôle le plus récent. Les activités déjà terminées ne sont pas réexécutées; leurs résultats sont reproduits à partir du journal durable. L'utilisateur n'approuve pas de nouveau les choses qu'il a déjà approuvées. Les appels LLM déjà effectués ne sont pas ré-facturés.

C'est le même schéma que les moteurs de flux de travail ont mis en place depuis une décennie (Temporal, Cadence, Cherami d'Uber). Ce qui est nouveau, c'est que les appels LLM sont maintenant une sorte d'activité  non déterministe, coûteuse, avec des effets secondaires  et ils s'intègrent parfaitement à ce schéma.

Le thème principal de la leçon est: la fiabilité à long horizon décline (le METR observe une " dégradation de 35 minutes "  le taux de réussite diminue à peu près quadratiquement avec l'horizon).

## Le concept

### Activités, flux de travail et répétition

- **Workflow**Le code d'orchestration déterministe définit la séquence des activités, les branches, les attentes.
- **Activity**L'activité est enregistrée avec ses entrées et (une fois terminée) ses sorties.
- **Event log**Chaque activité démarre, complète, échoue, réessaye et chaque décision de workflow est enregistrée.
- **Replay**: lors de la récupération, le code du flux de travail est réexécuté dès le début; chaque activité déjà terminée renvoie son résultat enregistré sans réexécuter. Seules les activités qui n'avaient pas été terminées sont réellement exécutées.

C'est la même forme que React qui rend une DOM virtuelle ou Git qui reconstruit un arbre de travail à partir de commits.

### Pourquoi les appels de Master correspondent au modèle

Les appels à la LLM sont:
- Non déterministe (température > 0; même la température 0 dérive entre les versions du modèle).
- On peut en dire autant de la durée de vie.
- Les défaillances potentielles (limits de taux, délais).
- Effets secondaires (si elles invoquent des outils).

En terminant chaque appel de LLM comme une activité, vous pouvez réessayer avec un backoff exponentiel, un point de contrôle à travers les redémarrages et une piste reproduisable pour débogage.

### Les points de contrôle identifiés par `thread_id`

LangGraph, Microsoft Agent Framework, Cloudflare Durable Objects et Claude Code Routines convergent toutes sur la même forme d'API: une `thread_id`(ou équivalent) identifie la session; chaque transition d'état persiste à un backend (postgreSQL par défaut, SQLite pour dev, Redis pour cache); résumé lit le dernier point de contrôle.

Le choix de l'arrière-plan est important:

- **PostgreSQL**: durable, consultable, survit aux déploiements.
- **SQLite**: local-dev seulement; perd des données sur les hôtes.
- **Redis**: rapide mais éphémère, sauf si l'AOF/snapshot est configuré.
- **Cloudflare Durable Objects**: distribué de manière transparente; scope par une clé unique; survit pendant des heures à des semaines.

### Les données humaines comme état de première classe

La proposition-et-commit (leçon 15) nécessite un état durable d'"attente humaine". Le flux de travail prend une pause, la file d'attente externe retient la demande en attente et l'approbation reprend à partir de ce point.

### La dégradation de 35 minutes

METR a observé que chaque classe d'agent mesurée montre une détérioration de la fiabilité au-delà de ~35 minutes d'exploitation continue. Le double de la durée de la tâche quadruple le taux d'échec. L'exécution durable ne résout pas cela; elle vous permet de fonctionner plus longtemps que le profil de fiabilité ne le permet. Le modèle sûr consiste à combiner la durabilité avec des points de contrôle qui nécessitent un HITL frais à la réentrée, et avec des interrupteurs de détection budgétaire (leçon 13) qui limitent le calcul total indépendamment de l'heure du mur.

### Quand l'exécution durable est la mauvaise réponse

- Les courses sont plus courtes que quelques minutes sans intervention humaine.
- Récupération des informations uniquement lues.
- Les tâches dans lesquelles la correction nécessite une fin-à-fin dans une fenêtre de contexte (certaines tâches de raisonnement; certaines générations à coup unique).

```figure
memory-consolidation
```

## Utilisez-le

`code/main.py`implémentera un moteur d'exécution durable minimal dans stdlib Python. Il prend en charge:

- `@activity`décorateur qui enregistre les entrées et sorties dans un journal d'événements JSON.
- Une fonction de flux de travail qui séquence les activités.
- Une .`run_or_replay(workflow, event_log)`fonction qui reproduit les activités accomplies sans les réexécuter.

Le pilote simule un flux de travail de trois activités, s'écrase à mi-chemin et montre (a) une nouvelle tentative naïve de tout réexécuter par rapport à (b) une répétition exécutant uniquement l'activité manquante.

## La faire partir

`outputs/skill-durable-execution-review.md`examine le déploiement d'un agent de longue date proposé pour une forme d'exécution durable correcte: activités, déterminisme, arrière-plan des points de contrôle, état d'entrée humaine et politique de HITL sur résumé.

## Exercices

1. On court .`code/main.py`. Observer la différence entre le nombre d'activités et d'exécutions entre la répétition naïve et la répétition.

2. Convertir le moteur de jouet à utiliser `thread_id`Simuler deux sessions simultanées partageant le moteur et confirmer que leurs journaux d'événements ne collisionnent pas.

3. Prenez une activité dans le moteur de jouets. Introduisez un non-determinisme (un timestamp de l'horloge murale à l'intérieur d'une décision de flux de travail). Démontre la divergence lors de la répétition. Expliquez comment les moteurs réels gèrent cela (enregistrement des effets secondaires, `Workflow.now()`Les API).

4. Lisez le message LangChain "Runtime behind production deep agents" en lisant chaque état dans lequel le temps de fonctionnement persiste et en nommant le mode d'échec couvert par chacun.

5. Conceptez une politique de checkpoint pour une tâche de codage autonome de 6 heures. Où vous déplacez le checkpoint?

## Les termes clés

| Term | What people say | What it actually means |
|---|---|---|
| Workflow | "Agent's script" | Deterministic orchestration code; replayable from event log |
| Activity | "A step" | Non-deterministic unit (LLM call, tool call); logged before and after |
| Event log | "The backing store" | Durable record of every state transition |
| Replay | "Resume" | Re-run workflow; completed activities return logged results without re-execution |
| Checkpoint | "Save point" | Persisted state keyed by thread_id; latest-wins on resume |
| thread_id | "Session key" | Identifier that scopes durable state |
| 35-minute degradation | "Reliability decay" | METR: success rate drops ~quadratically with horizon |
| Non-determinism | "Drift on replay" | Wall clock, random, LLM output; must be registered as side effect |

## Pour en savoir plus

- [Anthropic — Claude Code Agent SDK: agent loop](https://code.claude.com/docs/en/agent-sdk/agent-loop) budget, tournées et réécriture de la sémantique.
- [Microsoft — Agent Framework: human-in-the-loop and checkpointing](https://learn.microsoft.com/en-us/agent-framework/workflows/human-in-the-loop) Forme de demande d'information événement.
- [LangChain — The Runtime Behind Production Deep Agents](https://www.langchain.com/conceptual-guides/runtime-behind-production-deep-agents) exigences concrètes en matière de temps de fonctionnement.
- [OpenAI Agents SDK + Temporal integration (Trigger.dev announcement)](https://trigger.dev) forme d'activité pour les cours de maîtrise de droit.
- [Anthropic — Measuring agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) la référence de dégradation de 35 minutes.
