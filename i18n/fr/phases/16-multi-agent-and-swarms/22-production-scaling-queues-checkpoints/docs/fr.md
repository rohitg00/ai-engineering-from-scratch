# Écalement de la production  Cours, points de contrôle, durabilité

> L' évolue des systèmes multi-agents à des milliers de circuits simultanés nécessite **durable execution** les files d'attente de travail plus les points de contrôle, de sorte que tout travailleur peut reprendre toute course après un accident, à condition que la gestion des contrats de location, les effets secondaires idempotents et la répétition déterministe soient en place.`thread_id`Les agents peuvent dormir indéfiniment en attendant l'entrée humaine. **MegaAgent**(arXiv:2408.09955) a mené une file d'attente producteur-consommateur par agent avec trois états (Idle / Processing / Response) et une coordination à deux couches (chat intragroupe + chat administrateur intergroupe). **Fiber/async**Les fils restent inactifs 99% du temps en attendant des jetons, les fibres produisent coopérativement sur la prise en charge/transmission.**FastAPI + Postgres + nothing else**Cette leçon construit un journal de checkpoint durable, une file de travail par agent avec des transitions d'état, une démo asynchrone-versus-thread, et atterrit la règle pragmatique "start simple".

**Type:** Learn + Build
**Languages:** Python (stdlib, `asyncio`, `sqlite3`), TypeScript
**Prerequisites:** Phase 16 · 09 (Parallel Swarm Networks), Phase 16 · 13 (Shared Memory)
**Time:** ~75 minutes

## Problème

Un prototype de système multi-agent fonctionne sur un ordinateur portable avec trois agents dans une boucle d'événements en mémoire.

- Les agents courent parfois pendant des heures (longues recherches, des attentes humaines en cours de cycle).
- Les processus de travail se déroulent, le redémarrage perd son état.
- La charge maximale est 10 fois moyenne; vous avez besoin d'échelle horizontale.
- Les utilisateurs paient par agent, vous avez besoin de la sémantique pour le chargement.

La boucle d'événements en mémoire ne fait aucun de ces. Vous avez besoin d'une couche d'exécution durable en dessous.

1. Un moteur de flux de travail avec des points de contrôle (temporal, LangGraph runtime).
2. Une file d'attente de messages avec un magasin d'État (Postgres + SQS/RabbitMQ).
3. Cadres de modèle d'acteur (producteur-consommateur de MegaAgent par agent).
4. FastAPI + Postgres laminé à la main (argument de Bedi).

Cette leçon est une miniature de chacun.

## Concept

### Exécution durable, modèle

Un moteur d'exécution durable persiste dans l'état complet du programme après chaque "pas" (superpas, en langgraph).

```
worker crashes mid-step
  -> lease timeout
  -> another worker picks up the thread_id
  -> resumes from last checkpoint
  -> no duplicate side effects
```

Les exigences pour que cela fonctionne:

- **Serializable state.**Tout l'état de l'agent doit être persistant.
- **Deterministic resume.**En raison du même état et des mêmes entrées, l'agent produit les mêmes actions (ou se déplace vers un oracle déterministe externe pour les appels LLM).
- **Idempotent side effects.**Les appels externes (appels à l'outil, paiements) doivent être idempotents ou utiliser une clé de déduplication.

LangGraph écrit un point de contrôle après chaque super-étape; Temporal écrit après chaque activité; Restate utilise des journaux basés sur des événements.

### Un temps de fonctionnement par point de contrôle

L'exemple de fonctionnement de LangGraph est celui de chaque agent.`thread_id`Le code de contrôle est un code de contrôle de la ligne de contrôle, qui est un code de contrôle de la ligne de contrôle.`interrupt()`En attendant l'entrée humaine, le temps de fonctionnement persiste et libère le travailleur.

Il s'agit du modèle de production de référence en avril 2026.

### La file d'attente par agent de MegaAgent

arXiv:2408.09955 décrit une expérience à grande échelle: des milliers d'agents concurrents dans un seul cluster.

```
agent i:
  state ∈ {Idle, Processing, Response}
  in_queue   <- messages addressed to agent i
  out_queue  -> replies + side effects

coordinators:
  intra-group chat  (agents in the same group)
  inter-group admin chat  (high-level routing)
```

La coordination à deux couches permet à la conversation intragroupe de se dérouler densément tandis que l'intergroupe reste rare  le modèle utilisé pour maintenir le coût linéaire dans des milliers d'agents.

### Asynchrony par rapport au fil par travail

Les appels LLM sont liés I/O. Un fil en attente du prochain jeton est inactif 99% du temps. Les fils coûtent ~ 1 MB de RAM chacun; à 10 000 appels simultanés, c'est 10 GB seulement pour les piles.

Les fibres (Python `asyncio`, Go goroutines, Rust `tokio`Les mêmes 10 000 appels s'inscrivent confortablement dans le processus.

Exception: le post-traitement lié au processeur (embedding, tokenizer tricks) nécessite toujours des fils ou des processus. Séparer votre couche I/O de votre couche CPU.

### Le contre-point de Bedi

"Scaling Agentic Software" (Ashpreet Bedi, 2026) affirme que la plupart des équipes sur-ingénier avant de mesurer la charge.

- Rapide et postgrés.
- Chaque course d'agent est une ligne; état mis à jour en place avec une concurrence optimiste.
- Travails de fond via `pg_notify`ou un simple travailleur de Sellery.
- Retest la politique dans le code de demande.

Pour les charges inférieures à ~ 100 opérations simultanées d'agent sur des tâches gérables, c'est souvent tout ce dont vous avez besoin.

La règle: adopter des cadres d'exécution durables lorsque vous rencontrez un problème concret que des architectures simples ne peuvent pas résoudre.

### Une sémantique unique

Pour les courses d'agents payants, vous avez besoin d'une "exclusivité effective" (au moins une livraison + un consommateur idempotent).

- **Dedup key per run.**Incluez-le dans chaque appel d'effet secondaire.
- **Outbox pattern.**Les effets secondaires sont écrits sur une table, puis exécutés par un processus séparé.
- **Compensating transactions.**Si un effet secondaire réussit mais que son écriture de suivi échoue, prévoyez une compensation.

Il s'agit de modèles d'ingénierie de base de données, pas spécifiques à la LLM. La taxe de la LLM est seulement que les appels à la LLM sont lents; tout le reste sont des systèmes distribués standard.

### Déploiement de l'arc-en-ciel

Le système de recherche multi-agents d'Anthropic utilise des " déploiements d'arc-en-ciel ": plusieurs versions de l'agent runtime fonctionnent simultanément de sorte que les agents de longue durée n'ont pas à être tués lors de chaque déploiement de code.

C'est la norme pour les systèmes à long terme; l'adaptation de 2026 est que les agents peuvent vivre des heures, donc les cycles de déploiement doivent s'adapter.

### Liste de contrôle de la production canonique

- État durable (checkpoints, instantanés ou boîte de réception + journal jouable).
- Effets secondaires inapte.
- Couche de synchronisation de l'entrée/sortie pour les appels de licence.
- Au moins une livraison avec dedup.
- Déploiement arc-en-ciel/canary pour les charges de travail à grande intensité.
- Observabilité: traces par agent, vérification super-étape, compteur de réessayer.

```figure
sw-checkpoint-replay
```

## Faites-le

`code/main.py`les implémentations:

- `CheckpointStore` Registre de checkpoint supporté par SQLite avec les clés de thread-id. Chaque super-étape ajoute une rangée.
- `run_with_checkpoint(agent, thread_id)` simulation d'un accident à mi-courrier; un deuxième travailleur reprend à partir du dernier point de contrôle.
- `AgentQueue` par agent Machine d'état d'ouverture / traitement / réponse avec une petite file de travail.
- `demo_async_vs_threads()` exécute 500 "appels LLM" simulés simultanément via async et via des fils; rapporte le mur-horloge et la mémoire de pointe (approximativement).

Je vais courir .

```
python3 code/main.py
npx tsx code/main.ts
```

Sortie attendue: le point de contrôle reprend avec succès après un crash simulé; la version asynchronous traite 500 appels concurrents en < 1s; la version de fil prend plusieurs secondes et utilise des ordres de magnitude de mémoire en plus par unité concurrente.

## Utilisez-le

`outputs/skill-scaling-advisor.md`conseille sur le choix d'exécution durable: FastAPI + Postgres, LangGraph runtime, Temporal ou personnalisé. Calibré par charge, besoins de rétention d'état et déploiement de fréquence.

## La faire partir

Resserrement de la production canonique:

- **Start simple (Bedi's rule).**Rapide API + Postgres jusqu'à ce que vous la mesuriez en échec.
- **Instrument everything before optimizing.**Histogramme de latence par exécution, temps par étape, compte de répétition, catégorisation des défaillances.
- **Outbox pattern for side effects.**Surtout les paiements et les appels API externes.
- **Rainbow deploys.**Ne tuez jamais les agents en vol pendant les déploiements.
- **Adopt durable-execution engines (Temporal / LangGraph / Restate) when**Vous rencontrez des problèmes spécifiques: des heures d'attente humaine en boucle, une coordination entre régions, des politiques complexes de retrait/compensation.
- **Async for the I/O layer.**Les fils sont uniquement destinés au post-traitement lié au processeur.

## Exercices

1. On court .`code/main.py`- Confirmer les travaux de résumé du point de contrôle; mesurer la différence de synchronisation par rapport au fil.
2. La mise en œuvre d'une**outbox**Table: chaque appel à l'outil écrit d'abord à la boîte sortante, puis une routine/tâche séparée est exécutée.
3. Simuler une**rainbow deploy**: deux versions en temps de fonctionnement simultanées; router la moitié des nouveaux threads_ids à chacune; confirmer que les threads en vol sur l'ancienne version ne sont pas interrompus.
4. Lisez le document de fonctionnement de LangGraph (ligné ci-dessous). Identifiez quelles fonctionnalités de la fonctionnalité prendraient le plus de temps à reproduire dans une version FastAPI + Postgres roulée à la main. Est-ce une raison d'adopter, ou pouvez-vous reporter?
5. Lisez MegaAgent (arXiv:2408.09955) Section 3. La coordination à deux couches (inter-group + intergroup admin chat) est explicite.

## Les termes clés

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Durable execution | "Persist the program state" | Engine writes state after each super-step; crash recovery is deterministic. |
| Super-step | "Transactional boundary" | Unit of work between checkpoints. LangGraph term. |
| thread_id | "Agent run identifier" | Key that binds checkpoints and resume logic. |
| Idempotency | "Safe to retry" | Repeating a side effect produces the same result as one attempt. |
| Outbox pattern | "Decouple side effects" | Write intent to a table; a separate executor performs and marks done. |
| At-least-once delivery | "Possible duplicates" | Message queue semantics; dedup key makes consumer effective-once. |
| Rainbow deploy | "Overlapping versions" | Multiple runtime versions concurrent during long-running workloads. |
| Async fiber | "Cooperative yielding" | User-mode concurrency; cheap compared to threads for I/O-bound loads. |
| Checkpoint | "State snapshot" | Serialized state at a super-step boundary; key for resume. |

## Pour en savoir plus

- [LangChain — The runtime behind production deep agents](https://www.langchain.com/conceptual-guides/runtime-behind-production-deep-agents) Conception de l'exécution de LangGraph
- [MegaAgent](https://arxiv.org/abs/2408.09955) Coordonnées de production et de consommation par agent; coordination à deux couches à des milliers d'agents concurrents
- [Matrix](https://arxiv.org/abs/2511.21686) cadre décentralisé avec des files d'attente de messages comme substrat de coordination
- [Temporal docs](https://docs.temporal.io/) le moteur de référence du flux de travail pour une exécution durable
- [Anthropic — Multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system) les leçons de production, y compris le déploiement de l'arc-en-ciel
