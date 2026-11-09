# Le modèle d'acteur pour les agents  Messages asynchronisés et temps d'exécution typiés

> Les agents en tant qu'acteurs: échange de messages asynchrone, gestionnaires d'événements, isolation des défauts, concurrences naturelles. AutoGen v0.4 (Microsoft Research, Jan 2025) a redessiné l'orchestration des agents autour de ce modèle; le framework est maintenant en mode maintenance, avec Microsoft Agent Framework (preview publique Oct 2025) comme successeur de production.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 01 (Agent Loop), Phase 14 · 12 (Workflow Patterns)
**Time:** ~75 minutes

## Objectifs d'apprentissage

- Décrire le modèle d'acteur: agents en tant qu'acteurs, messages en tant que seul IPC, isolement de défaillance par acteur.
- Nommer les trois couches API d'AutoGen v0.4  Core, AgentChat, Extensions  et ce que chacun est pour.
- Expliquez pourquoi la déconnexion de la transmission des messages de la manutention donne une isolation des défauts et une simultanée naturelle.
- Implémenter un acteur stdlib runtime en Python et portez un flux de révision de code à deux agents sur lui.

## Le problème

La plupart des cadres d'agents sont synchrones: un agent produit, un agent consomme, dans une pile d'appels. Les défaillances écrasent la pile. La concurrence est activée. La distribution nécessite une réécriture.

Autogénération v0.4: le modèle acteur. Chaque agent est un acteur avec une boîte de réception privée. Les messages sont la seule interaction. Le temps d'exécution découple la livraison de la manipulation. Les défaillances isolent à un acteur. La concurrence est native. La distribution est juste un transport différent.

## Le concept

### Actors

Un acteur a:

- Un État privé (ne jamais touché directement de l'extérieur).
- Une boîte de réception (ligne de message).
- Un gestionnaire:`receive(message) -> effects`où les effets peuvent être "répondez", "envoyez à un autre acteur", "spam un nouvel acteur", "actualiser l'état", "arrêter soi-même".

Deux acteurs ne peuvent pas partager leur mémoire, ils ne peuvent envoyer que des messages.

### Trois couches d'API

AutoGen v0.4 divise sa surface en trois:

1. **Core.**Cadre d'acteurs de bas niveau. `AgentRuntime`- Je suis là .`Agent`- Je suis là .`Message`- Je suis là .`Topic`Échange de messages asynchronisés, basé sur des événements.
2. **AgentChat.**API de haut niveau axée sur les tâches (renversement de ConversableAgent de v0.2). `AssistantAgent`- Je suis là .`UserProxyAgent`- Je suis là .`RoundRobinGroupChat`- Je suis là .`SelectorGroupChat`- Je suis désolé .
3. **Extensions.**Intégrations  OpenAI, Anthropic, Azure, outils, mémoire.

### Pourquoi la déconnexion est importante

Dans le modèle v0.2, appel `agent_a.chat(agent_b)`Il bloque synchronement agent_a jusqu'à ce que l'agent_b revienne.`send(agent_b, msg)`Il met le message dans la boîte de réception de l'agent_b et le retour.

- **Fault isolation.**L'agent B s'écrase pas l'agent A  le temps d'exécution capture l'échec dans le gestionnaire de B et décide de quoi faire (enregistrement, réessayer, lettre morte).
- **Natural concurrency.**Beaucoup de messages en vol à la fois; les acteurs traitent leur boîte de réception en même temps.
- **Distribution-ready.**La boîte de réception + transport est la même abstraction que si l'acteur est en cours de traitement ou sur un autre hôte.

### Topologies

- **RoundRobinGroupChat.**Les agents se tournent en rotation fixe.
- **SelectorGroupChat.**Un agent sélecteur choisit qui va suivre en fonction du contexte de la conversation.
- **Magentic-One.**Une équipe multi-agents de référence pour la navigation sur le Web, l'exécution du code, la gestion de fichiers.

### Observabilité

Le support OpenTelemetry est intégré. Chaque message émet une durée; les appels à l'outil sont portés `gen_ai.*`Les caractéristiques de l'OTel GenAI sont les mêmes que celles des conventions sémantiques OTel GenAI de 2026 (leçon 23).

### Statut: mode de maintenance

Début 2026: AutoGen v0.7.x est stable pour la recherche et le prototypage. Microsoft a déplacé le développement actif vers le Microsoft Agent Framework, le successeur de production (preview publique 1 octobre 2025; 1.0 GA a été ciblé pour la fin du 1er trimestre 2026).

```figure
actor-mailbox
```

## Faites-le

`code/main.py`met en œuvre un runtime d'acteur stdlib:

- `Message` chargement utile avec `sender`- Je suis là .`recipient`- Je suis là .`topic`- Je suis là .`body`- Je suis désolé .
- `Actor` abstrait avec `receive(message, runtime)`- Je suis désolé .
- `Runtime` boucle d'événement avec une file d'attente partagée, livraison, isolement de défaillance.
- Une démo de deux acteurs:`ReviewerAgent`code de révision, `ChecklistAgent`Ils échangent des messages jusqu'à un consensus.

- Je vais le faire.

```
python3 code/main.py
npx tsx code/main.ts
```

La trace montre la livraison du message, un échec simulé chez un acteur qui ne s'écrase pas avec l'autre, et la convergence sur un verdict partagé.

## Utilisez-le

- **AutoGen v0.4/v0.7**(maintenance)  stable pour la recherche, la prototypage, les modèles multi-agents.
- **Microsoft Agent Framework** le successeur de la production (preview publique Octobre 2025); les mêmes idées de modèle d'acteur dans une API mise à jour.
- **LangGraph swarm topology**(Léction 13)  Des modèles similaires par le biais de remises d'outils partagés.
- **Custom actor runtime** lorsque vous avez besoin d'un transport spécifique (NATS, RabbitMQ, gRPC).

## La faire partir

`outputs/skill-actor-runtime.md`génère un temps de fonctionnement minimal des acteurs plus un modèle d'équipe (RoundRobin ou Selector) pour une tâche multi-agent donnée.

## Exercices

1. Ajoutez une file d'attente: quand un gestionnaire soulève, gardez le message défaillant pour inspection humaine.
2. Mise en œuvre `SelectorGroupChat`: un acteur sélecteur choisit qui traite le message suivant en fonction de l'état de conversation.
3. Ajouter le transport distribué: échanger la file d'attente en cours de processus pour un serveur JSON-over-HTTP afin que les acteurs puissent exécuter des processus distincts.
4. Transférez une durée d' OTel par message (ou un stand-in sans opération).`gen_ai.agent.name`- Je suis là .`gen_ai.operation.name`Pour la leçon 23.
5. Lisez le post d'architecture d'AutoGen v0.4.`autogen_core`Qu'est-ce que vous avez omis qui compte dans la production ?

## Les termes clés

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Actor | "Agent" | Private state + inbox + handler; no shared memory |
| Message | "Event" | Typed payload; the only way actors interact |
| Inbox | "Mailbox" | Per-actor queue of pending messages |
| Runtime | "Agent host" | Event loop that routes messages and isolates failures |
| Topic | "Channel" | Named publish-subscribe route between actors |
| Fault isolation | "Let it crash" | One actor failing does not crash others |
| RoundRobinGroupChat | "Fixed-rotation team" | Agents take turns in order |
| SelectorGroupChat | "Context-routed team" | Selector picks who goes next |
| Magentic-One | "Reference team" | Multi-agent squad for web + code + files |

## Pour en savoir plus

- [AutoGen v0.4, Microsoft Research](https://www.microsoft.com/en-us/research/articles/autogen-v0-4-reimagining-the-foundation-of-agentic-ai-for-scale-extensibility-and-robustness/) le poste de redessin
- [LangGraph overview](https://docs.langchain.com/oss/python/langgraph/overview) Alternative en forme de graphe
- [OpenTelemetry GenAI semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/) couvre AutoGen émet par défaut
