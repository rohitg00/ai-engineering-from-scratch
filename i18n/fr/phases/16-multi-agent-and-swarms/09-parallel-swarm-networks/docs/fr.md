# Parallèle / Architéctures en réseau

> Contrairement à la direction: aucun décideur central. Les agents lisent un bus d'événements partagés, reprennent le travail de manière asynchrone, rédigent les résultats. LangGraph prend explicitement en charge "Swarm Architecture" pour les environnements décentralisés et dynamiques. Matrix (arXiv:2511.21686) représente à la fois le contrôle et le flux de données en tant que messages sérialisés passés à travers des files d'attente distribuées pour éliminer le gouffre-bouteille de l'orchestre. Le compromis est explicite: déterminisme et traçabilité pour l'évolutivité. Swarm s'adapte aux tâches avec de nombreux sous-problèmes indépendants; il ne s'adapte pas aux tâches qui nécessitent un seul plan cohérent.

**Type:** Learn + Build
**Languages:** Python (stdlib, `threading`, `queue`), TypeScript
**Prerequisites:** Phase 16 · 05 (Supervisor Pattern), Phase 16 · 04 (Primitive Model)
**Time:** ~75 minutes

## Problème

Le superviseur est le seul à faire le choix, et chaque décision sur qui fait quoi passe par un seul agent.

Les architectures de masse inversent la conception. Au lieu d'un planificateur central qui envoie le travail, les travailleurs choisissent le travail d'une file d'attente partagée. La "coordination" est intégrée à la sémantique du bus d'événement.

## Concept

### La forme

```
                ┌──── shared queue ────┐
                │                      │
       ┌────────┼────────┐  ◄──────┬───┘
       ▼        ▼        ▼         │
     Worker  Worker  Worker   Worker
      A       B       C        D
       │        │        │         │
       └────────┴────────┴─────────┘
                 │
                 ▼
            results pool
```

Aucun orchestrateur. Chaque travailleur répète: tirer une tâche, procéder, écrire le résultat (et optionnellement faire des suivi).

### Quand l' essaim se passe

- **Many independent tasks.**Les tâches ne dépendent pas les unes des autres.
- **Variable-duration work.**Si certaines tâches prennent 100ms et d'autres 10s, un essaim équilibre automatiquement la charge  les travailleurs rapides tirent les prochains emplois.
- **Throughput over determinism.**Vous vous souciez du temps de réalisation total, pas de la commande stricte.

### Quand l' essaim échoue

- **Ordered workflows.**Si l'étape 3 a besoin de la sortie de l'étape 2, un essaim risque de tirer l'étape 3 avant l'étape 2.
- **Global-plan tasks.**Les questions de recherche complexes bénéficient d'un planificateur.
- **Debugging.**Sans journal central et sans travail asynchrone, reproduire un bug est coûteux.

### Les données de l'équipe de gestion des données doivent être fournies à l'utilisateur.

Matrix est le document de 2025 qui conduit l'éventail à sa conclusion naturelle: le flux de contrôle et le flux de données sont des messages sérialisés sur des files d'attente distribuées. Aucun coordinateur central. La tolérance aux erreurs provient de la durabilité du message. L'évolutivité est le problème du courtier de messages, pas du système.

Contribution: un modèle de programmation où la coordination multi-agents est " quel sujet de message cet agent s'abonne-t-il à ? " plutôt que " quel agent le superviseur choisit-il ensuite ? " Cela fait ressembler le système à un réseau pub/sub événement.

### Les graphes sont en masse

Les documents de LangGraph 2025 décrivent explicitement "Architecture de la nuée" comme l'un des modèles multi-agents: les agents sont des nœuds, mais les bords forment un graphique dirigé avec des cycles et tout nœud peut être activé à partir du bassin.

### Mode d'échec: famine et hotspotting

Si tous les travailleurs effectuent la tâche la plus rapide disponible, les tâches de longue durée ne sont jamais choisies tant qu'elles ne sont pas les seules à faire.

Les atténuations:
- Les files d'attente prioritaires avec vieillissement explicite (augmenter la priorité avec le temps d'attente).
- Spécialisation des travailleurs: certains travailleurs ne prennent que des tâches "longues".
- Pressure de retour: limiter le nombre de tâches rapides entrant dans la file d'attente.

### Le lien de routage basé sur le contenu

Les paires de groupes sont naturellement en route basée sur le contenu (leçon 22). Au lieu d'une file d'attente générique, il y a une file d'attente par type de message.

```figure
sw-work-stealing
```

## Faites-le

`code/main.py`met en œuvre un essaim de 4 fils de travailleurs tirant d' un partagé `queue.Queue`Les tâches ont une durée variable (certaines rapides, d'autres lentes).

- **Sequential baseline:**Un travailleur traite toutes les tâches en série.
- **Fixed assignment:**chaque tâche préalablement attribuée à un travailleur spécifique (type superviseur).
- **Swarm:**Les travailleurs sortent de la file d'attente.

Les balances de masse se chargent automatiquement; les tâches fixes laissent les travailleurs rapides inactifs lorsque leur tâche est lente.

Je vais courir .

```
python3 code/main.py
npx tsx code/main.ts
```

Les résultats montrent le nombre de tâches par travailleur (les répartitions de masse sont inégales mais optimales) et les temps de l'horloge murale.

## Utilisez-le

`outputs/skill-swarm-fit.md`évaluera si une tâche doit utiliser swarm vs supervisor. Les entrées: indépendance de la tâche, variance de durée, exigences de commande, besoins de débogabilité.

## La faire partir

Liste de contrôle:

- **Priority queue with aging.**Éviter la famine à long terme.
- **Worker idempotency.**Une tâche peut être effectuée plus d'une fois si un travailleur s'écrase au milieu de la course.
- **Durable queue.**Utilisez Kafka, Redis Streams ou une file d'attente basée sur une base de données pour la production. `queue.Queue`est seulement en mémoire.
- **Observability per task.**Chaque tâche a une identification de trace; chaque travailleur enregistre le début et la fin.
- **Back-pressure.**Si la file d'attente croît plus vite que les travailleurs ne le drainent, ralentissez le producteur.

## Exercices

1. On court .`code/main.py`Combien plus rapide est la charge de travail séquentielle sur la durée variable ?
2. Ajouter une variante de la file d'attente prioritaire (utilisation `queue.PriorityQueue`) Assigner la priorité par champ "importance" des tâches. Observer si les tâches à faible priorité sont jamais en train de mourir de faim sous charge continue.
3. Implémenter un détecteur de points chauds: enregistrer quand un travailleur traite 3 fois plus de tâches que le travailleur le plus lent.
4. Lisez l'abstrait du document Matrix (arXiv:2511.21686) et la section 3. Identifiez un compromis spécifique que la Matrix accepte (gains d'évolutivité) et celui qu'elle abandonne (traçabilité, déterminisme).
5. Convertir la démo swarm à utiliser un `queue.Queue`Les tâches sont généralement des tâches de type "tâche_type" ou "cargo utile" qui ne sont pas des tâches de type "tâche_type" ou "cargo utile" et qui ne sont pas des tâches de type "tâche_type" ou "cargo utile" qui sont des tâches de type "tâche_type" ou "cargo utile"), les travailleurs ne s'abonnent qu'à des types spécifiques.

## Les termes clés

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Swarm architecture | "Decentralized agents" | Workers pull from shared queue; no central orchestrator. |
| Event bus | "Agents subscribe to topics" | Message broker that routes tasks to workers by type or content. |
| Starvation | "Task never runs" | Low-priority task never gets picked because higher-priority work arrives continuously. |
| Hot-spotting | "One worker drowns" | Load imbalance where one worker gets most tasks. |
| Back-pressure | "Slow down the producer" | Mechanism that signals upstream to stop producing when the queue fills up. |
| Idempotent worker | "Safe to re-run" | A task processed twice produces the same result. Required because workers may crash mid-run. |
| Durable queue | "Survives crashes" | Queue backed by disk or replicated storage; tasks are not lost when a worker crashes. |
| Matrix framework | "Full message-passing swarm" | Both data and control flow are serialized messages on distributed queues. |

## Pour en savoir plus

- [LangGraph workflows and agents — Swarm Architecture](https://docs.langchain.com/oss/python/langgraph/workflows-agents) soutien explicite de la bande
- [Matrix — A Decentralized Framework for Multi-Agent Systems](https://arxiv.org/abs/2511.21686) Envahisseur complet de messages
- [Anthropic engineering — why supervisor not swarm in Research](https://www.anthropic.com/engineering/multi-agent-research-system) pourquoi un système de production spécifique a explicitement choisi le superviseur plutôt que le swarm
- [AutoGen v0.4 actor-model docs](https://microsoft.github.io/autogen/stable/) l'acteur événement-driven réécrire, plus proche de la foule que le groupe de chat de v0.2
