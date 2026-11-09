# Temps d'exécution de la production: file d'attente, événement, chron

> Les agents de production fonctionnent sur six formes de temps d'exécution: requête-réponse, streaming, exécution durable, arrière-plan basé sur la file d'attente, événement-orienté et planifié. Choisissez la forme avant de choisir le cadre.

**Type:** Learn
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 13 (LangGraph), Phase 14 · 22 (Voice)
**Time:** ~60 minutes

## Objectifs d'apprentissage

- Nombre des six formes de production et correspondent chacune à un modèle de cadre / produit.
- Expliquez pourquoi l'exécution durable (LangGraph) est importante pour les tâches à long terme.
- Décrivez le temps de fonctionnement de l'événement et le moment où Claude Managed Agents convient.
- Expliquer la déclaration de capacité d'observabilité à charge pour les agents à plusieurs étapes.

## Le problème

Les agents de production échouent de manière à ce qu'un ordinateur portable Jupyter ne soit pas sur la surface: les délais de réseau à l'étape 37, l'utilisateur suspend une appel vocale au milieu, le travail cron meurt lors du redémarrage de la machine, le travailleur d'arrière-plan se débarrasse de la mémoire.

## Le concept

### Réponse à la demande

- HTTP synchrone, l'utilisateur attend la finition.
- Uniquement viable pour des tâches courtes (< 30 ans).
- Les piles: Agno (Python + FastAPI), Mastra (TypeScript + Express/Hono/Fastify/Koa).
- Observabilité: journaux d'accès HTTP standard + spans OTel.

### Retour en continu

- SSE ou WebSocket pour la sortie progressive.
- LiveKit étend cela à WebRTC pour la voix/vidéo (leçon 22).
- Stacks: tout cadre avec support de streaming + une frontend qui gère SSE/WS.
- Observabilité: le timing par pièce, la latence du premier jeton, la latence de la queue.

### Exécution durable

- Le poste de contrôle de l'État après chaque étape, les CV automatiques en cas d'échec.
- Le modèle d'acteur AutoGen v0.4 isole les défaillances à un agent (leçon 14).
- Le différentiateur de base de LangGraph (leçon 13).
- Essentiel lorsque le nombre d'étapes est inconnu et que le coût de récupération est élevé.

### Basé sur la file d'attente / arrière-plan

- Le travail entre en file d'attente, les travailleurs se rassemblent, les résultats reviennent via des webhooks ou des pubs/subs.
- Essentiel pour les agents à long horizon (de dizaines à des centaines d'étapes par tâche, par annonce d'utilisation informatique d'Anthropic).
- Les piles: Céléri (Python), BullMQ (Node), SQS + Lambda (AWS), sur mesure.
- Observabilité: profondeur de file d'attente, répartition de la latence par emploi, taille du DLQ.

### Événements

- Les agents s'abonnent aux déclencheurs: nouveau courriel, relations publiques ouvertes, feu de cron.
- Claude Managed Agents couvre cela à l'extérieur de la boîte (leçon 17).
- Les flux d'IAC (leçon 15) structurent les flux de travail déterministes basés sur les événements.
- Observabilité: source de déclenchement, latence de l'événement au démarrage, latence de l'agent.

### Les programmes

- Des agents en forme de Cron qui fonctionnent périodiquement.
- Combinez avec une exécution durable pour que la course nocturne échoue à la prochaine fois.
- Stacks: Kubernetes CronJob + un cadre durable; hébergé (Render cron, Vercel cron).

### Modèles de déploiement 2026

- **CrewAI Flows**pour la production axée sur les événements.
- **Agno**FastAPI sans état pour les microservices Python.
- **Mastra**adaptateurs de serveur (Express, Hono, Fastify, Koa) pour intégration.
- **Pipecat Cloud / LiveKit Cloud**pour la voix gérée (leçon 22).
- **Claude Managed Agents**pour l'asynchronisation à long terme hébergée.

### La visibilité est porteur de charge

Sans OpenTelemetry GenAI (leçon 23) plus un Langfuse/Phoenix/Opik backend (leçon 24), vous ne pouvez pas débogager un agent multi-étape qui a échoué à l'étape 40. Ce n'est pas facultatif pour la production. C'est la différence entre "nous débogageons rapidement" et "nous reproduisons à partir de zéro avec plus de logging".

### Lorsque les temps de production ne sont pas satisfaisants

- **Wrong shape choice.**Choisir une requête-réponse pour une tâche de 5 minutes.
- **No DLQ.**Les travailleurs font la queue sans lettre morte.
- **Opaque background work.**Les défaillances sont invisibles jusqu'à ce que l'utilisateur les rapporte.
- **Skipping durable state.**Toute course > 30 secondes où vous ne pouvez pas vous permettre de redémarrer nécessite une exécution durable.

```figure
wb-runtime-shapes
```

## Faites-le

`code/main.py`est une démo multi-forme stdlib:

- Point final de demande-réponse (fonction simple).
- Gestionnaire de diffusion (générateur).
- Travailleur en file d'attente avec DLQ.
- Registre de déclenchement d'événement.
- Un planificateur en forme de Cron.

- Je vais le faire.

```bash
python3 code/main.py
npx tsx code/main.ts
```

Exécution: cinq traces montrant le comportement de chaque forme sur la même tâche. La même logique d'agent, différentes coquilles extérieures. L'exécution durable (la sixième forme) est intentionnellement couverte dans la leçon 13 avec la vérification LangGraph.

## Utilisez-le

- **Request-response**pour une expérience utilisateur de chat.
- **Streaming**pour les réponses progressives.
- **Durable**pour des tâches à long terme.
- **Queue**pour les lots / asynchronyme / longue durée.
- **Event**pour la réactivité de l'agent.
- **Cron**pour le ménage (consolidation de la mémoire, évaluations, rapports de coûts).

## La faire partir

`outputs/skill-runtime-shape.md`choisit une forme de temps de fonctionnement pour une tâche et fixe les exigences d'observabilité.

## Exercices

1. Portes ta leçon 01 ReAct boucle à toutes les six formes de ta pile. Quelle forme correspond à quelle surface du produit?
2. Ajouter un DLQ à la démo basée sur la file d'attente. Simuler 10% d'échec de travail; surface taille DLQ.
3. Écrivez un agent d'évaluation à l'aide de cron qui fonctionne chaque nuit contre vos 20 principales traces de la journée.
4. Implémenter le streaming avec la pression de contre: si le client est lent, pause l'agent. Comment cela interagit-il avec un budget de tour?
5. Quand vous déménagerez-vous avec un agent à long horizon ?

## Les termes clés

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Request-response | "Synchronous" | User waits; short tasks only |
| Streaming | "SSE / WS" | Progressive output; better UX; latency observable per chunk |
| Durable execution | "Resume from failure" | Checkpointed state; restart at last step |
| Queue-based | "Background jobs" | Producer / worker pool / DLQ |
| Event-driven | "Trigger-based" | Agent reacts to external events |
| DLQ | "Dead-letter queue" | Parking lot for failed jobs |
| Claude Managed Agents | "Hosted harness" | Anthropic-hosted long-running async with caching + compaction |

## Pour en savoir plus

- [LangGraph overview](https://docs.langchain.com/oss/python/langgraph/overview) Détails d'exécution durables
- [Claude Managed Agents overview](https://platform.claude.com/docs/en/managed-agents/overview) Asynchronisation à long terme hébergée
- [Anthropic, Introducing computer use](https://www.anthropic.com/news/3-5-models-and-computer-use) "Des dizaines à des centaines de pas par tâche"
- [AutoGen v0.4 (Microsoft Research)](https://www.microsoft.com/en-us/research/articles/autogen-v0-4-reimagining-the-foundation-of-agentic-ai-for-scale-extensibility-and-robustness/) Isolement des défauts du modèle acteur
