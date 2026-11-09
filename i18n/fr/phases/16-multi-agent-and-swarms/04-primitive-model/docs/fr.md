# Le modèle primitif multi-agent

> Quatre primitives, rien de plus  l'agent, la remise en main, l'état partagé, l'orchestrateur  couvrent un espace de conception quadri-dimensionnel, et les principaux cadres multi-agents expédiés en 2026 (AutoGen, LangGraph, CrewAI, OpenAI Agents SDK, Microsoft Agent Framework) sont des points dans celui-ci. Cette leçon les construit à partir de zéro, exécute un système de jouets sur les quatre, puis repère chaque cadre majeur sur les mêmes axes afin que vous puissiez lire toute nouvelle version en un paragraphe.

**Type:** Learn
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 (Agent Engineering), Phase 16 · 01 (Why Multi-Agent)
**Time:** ~60 minutes

## Problème

Chaque six mois, un nouveau framework multi-agents est lancé. AutoGen en 2023. CrewAI en 2024. LangGraph et OpenAI Swarm en 2024. Google ADK en avril 2025. Microsoft Agent Framework RC en février 2026. Chaque communiqué de presse affirme être "l'abstraction correcte".

Si vous essayez de les apprendre un à la fois, vous allez vous épuiser. Les API sont différentes. Les docs ne sont pas d'accord sur ce qu'est un "agent". Un cadre appelle sa mémoire partagée un "tableau noir", un autre le nomme un "pools de messages", un troisième le nomme un "StateGraph". Vous commencez à soupçonner que le champ est juste en train de se bouger.

Les quatre primitives sont stables, apprenez-les une fois, lisez chaque nouveau cadre en un paragraphe.

## Concept

### Les quatre primitifs

1. **Agent** un prompt système plus une liste d'outils. Stateless; chaque exécution commence à partir de son prompt système et de l'historique de message actuel.
2. **Handoff** un transfert structuré de contrôle d'un agent à un autre. mécaniquement, un appel à l'outil qui renvoie un nouvel agent ou un bord de graphique qui suit une condition.
3. **Shared state** toute structure de données que plus d'un agent peut lire (parfois écrire).
4. **Orchestrator** qui décide qui parle ensuite. Options: un graphique explicite (déterministique), un sélecteur de haut-parleurs LLM (mous), l'appel de l'autre haut-parleur (OpenAI Swarm), ou un planificateur sur une file d'attente (architecture de swarm).

Chaque cadre choisit les paramètres par défaut pour chaque axe; le reste est la syntaxe de surface.

### Comment chaque cadre 2026 le trace

| Framework | Agent | Handoff | Shared state | Orchestrator |
|-----------|-------|---------|--------------|--------------|
| OpenAI Swarm / Agents SDK | `Agent(instructions, tools)` | tool returns Agent | caller's problem | the LLM's next handoff call |
| AutoGen v0.4 / AG2 | `ConversableAgent` | speaker-selector on GroupChat | message pool | selector function (LLM or round-robin) |
| CrewAI | `Agent(role, goal, backstory)` | `Process.Sequential / Hierarchical` | Task outputs chained | manager LLM or static order |
| LangGraph | node function | graph edge + condition | `StateGraph` reducer | the graph, deterministic |
| Microsoft Agent Framework | agent + orchestration patterns | pattern-specific | thread / context | pattern-specific |
| Google ADK | agent + A2A card | A2A task | A2A artifacts | host decides |

Les différences de surface sont énormes, sous les quatre boutons.

### Pourquoi cela importe ?

Une fois que vous voyez les primitifs, la comparaison du cadre devient une courte liste de contrôle:

- Le chef d'orchestre fait-il confiance au LLM pour le routage (Swarm) ou le routage est-il en code (LangGraph)?
- Est-ce que l'état est partagé dans l'histoire complète (GroupChat) ou projeté (Reducteur de l'état-graphe)?
- Les agents peuvent-ils modifier les instructions de l'autre (gérant de l'équipement d'exploration) ou seulement les envoyer (swarm)?

Ces trois questions répondent à 80% du cadre qui correspond à un problème donné. Vous arrêtez de chercher le meilleur cadre multi-agents et commencez à concevoir pour l'axe qui vous intéresse vraiment.

### Le discernement sans État

Tout élément primitif, à l'exception de l'état partagé, est sans état. L'agent est une fonction de (prompte, outils).**The only stateful thing in the system is shared state.**C'est là que vivent tous les bugs intéressants: empoisonnement de la mémoire (leçon 15), commande de messages, versionnement, contention de rédaction.

Les cadres qui cachent l'état partagé (Swarm) poussent le problème vers l'appelant. Les cadres qui le centralisent (checkpoint LangGraph, pool AutoGen) le rendent inspectable mais déplacent le coût de coordination sur la mise en œuvre de l'état partagé.

### Anatomie d'une seule primitive

#### - Ça va ?

```
Agent = (system_prompt, tools, model, optional_name)
```

Deux agents avec le même système de commande et des outils sont interchangeables. Tout ce qui ressemble à l'état par agent est en fait dans l'état partagé ou le protocole de transfert.

#### Retour

```
Handoff = (from_agent, to_agent, reason, payload)
```

Trois mises en œuvre dominent:

- **Function return** l'outil renvoie le prochain agent. Ceci est le modèle OpenAI Swarm. Les agents transportent le routage dans leurs schémas d'outils.
- **Graph edge** LangGraph. Les bords sont déclaratifs. Le LLM produit une valeur; une condition sélectionne le nœud suivant.
- **Speaker selection** AutoGen GroupChat. Une fonction sélectrice (parfois elle-même appel LLM) lit le pool et choisit qui parle ensuite.

#### État partagé

```
SharedState = { messages: [], artifacts: {}, context: {} }
```

Au moins une liste de messages. Plus souvent: des objets structurés (expériences de tâches CrewAI), un contexte typé (réducteurs de LangGraph), une mémoire externe (MCP, vecteur DB).

Deux topologies: **full pool**(tous les agents voient chaque message) et **projected**Les pools complets sont simples et à faible échelle.

#### Orchestreur

```
Orchestrator = ({state, last_speaker}) -> next_agent
```

Quatre saveurs:

- **Static** le graphique est fixé au moment de la construction (Deterministique LangGraph, Sequentiel CrewAI).
- **LLM-selected** un LLM lit le tableau et choisit le prochain conférencier (AutoGen, CrewAI Hiérarchique).
- **Handoff-driven** l'agent actuel décide en appelant un outil de remise (Swarm).
- **Queue-driven** les travailleurs tirent de la file d'attente partagée; aucun haut-parleur suivant explicite (architectures de masse, Matrix).

### Quels changements entre cadres

Une fois les primitives fixées, les décisions de conception restantes sont:

- **Memory strategy** contrôle éphémère par rapport à contrôle durable (contrôle LangGraph).
- **Safety boundary** qui peut approuver une remise (humain-in-the-loop).
- **Cost accounting** budgets de jetons par agent.
- **Observability** Tracer les remises, persister dans l'état pour la répétition.

Toutes sont mises en œuvre en plus des primitives.

```figure
a5-primitive-radar
```

## Faites-le

`code/main.py`Il est utilisé pour la mise en œuvre des quatre primitives dans ~ 150 lignes de stdlib Python.

Les exportations de dossiers:

- `Agent` une classe de données de nom, de prompt système, d'outils, de fonction de politique.
- `Handoff` une fonction qui renvoie un nouvel agent.
- `SharedState` une base de messages sécurisée.
- `Orchestrator` trois variantes: `StaticOrchestrator`- Je suis là .`HandoffOrchestrator`- Je suis là .`LLMSelectorOrchestrator`(simulé).

La démo exécute le même pipeline de trois agents (recherche → écrit → révision) à travers les trois types d'orchestrateur et imprime le pool de messages à la fin. Vous pouvez voir que les sorties ne diffèrent que dans *qui choisit ensuite*; les agents et l'état partagé sont identiques sur les circuits.

- Je vais le faire.

```
python3 code/main.py
npx tsx code/main.ts
```

Les résultats attendus: trois circuits d'orchestrateur, un par modèle. Chacun imprime le groupe de messages final. La course guidée par la remise atteint moins d'agents si le chercheur décide de le faire tôt  c'est le compromis de routage LLM en miniature.

## Utilisez-le

`outputs/skill-primitive-mapper.md`est une compétence qui lit toute base de code multi-agent ou document cadre et renvoie le cartographie quatre-primitive.

## La faire partir

Avant d'adopter un nouveau cadre, écrivez la cartographie primitive pour elle. Si vous ne pouvez pas, les documents sont incomplets ou le cadre invente une cinquième primitive (rétrogradation  vérifier pour une saveur d'état partagé que vous n'avez pas vu).

Enfoncer la cartographie dans votre document d'architecture. Quand un nouveau membre de l'équipe rejoint, envoyez-lui la cartographie avant les documents API. Lorsque les versions du framework changent, différez la cartographie, pas le changelog.

## Exercices

1. On court .`code/main.py`Observez comment le choix de l'orchestre change les agents.
2. La mise en œuvre d'un quatrième type d'orchestre: un type de rangée où les agents pollent partagent l'état du travail.
3. Prenez le démarrage rapide LangGraph (https://docs.langchain.com/oss/python/langgraph/workflows-agentsQuelles sont les cartes d'abstractions de LangGraph 1:1 et quelles sont les enveloppes de commodité ?
4. Lisez le livre de cuisine OpenAI Swarm (https://developers.openai.com/cookbook/examples/orchestrating_agentsIdentifier lequel des quatre primitifs que Swarm rend le plus ergonomique et lequel il pousse à l'appelant.
5. Trouvez un cadre dans ce tableau qui cache l'état partagé entièrement. Expliquez ce qui se brise lorsque les agents doivent coordonner entre les remises sans relire l'histoire.

## Les termes clés

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Agent | "An LLM with tools" | A `(system_prompt, tools, model)` triple. Stateless. |
| Handoff | "Transfer of control" | A structured call that names the next agent and optional payload. Three implementations: function return, graph edge, speaker selection. |
| Shared state | "Memory" / "context" | The only stateful part of a multi-agent system. Message pool or blackboard. |
| Orchestrator | "Coordinator" | Whoever decides who runs next. Static graph, LLM selector, handoff-driven, or queue-driven. |
| Primitive | "Abstraction" | One of the four axes every framework parameterizes. Not a framework feature. |
| Message pool | "Shared chat history" | Full-history shared state. Easy to reason about, scales badly. |
| Projected state | "Scoped view" | Role-specific view into shared state. Scales, requires schema design. |
| Speaker selection | "Who talks next" | Orchestrator pattern where a function (often an LLM) picks the next agent from a group. |

## Pour en savoir plus

- [OpenAI cookbook: Orchestrating Agents — Routines and Handoffs](https://developers.openai.com/cookbook/examples/orchestrating_agents) l'articulation la plus claire de l'orchestration guidée par la main
- [AutoGen stable docs](https://microsoft.github.io/autogen/stable/) GroupChat + sélection de conférenciers est la référence pour l'orchestration sélectionnée par le LLM
- [LangGraph workflows and agents](https://docs.langchain.com/oss/python/langgraph/workflows-agents) Orchestration du bord du graphique et état partagé basé sur un réducteur
- [CrewAI introduction](https://docs.crewai.com/en/introduction) agents de rôle-objectif-histoire de fond, processus séquentiels / hiérarchiques
- [AG2 (community AutoGen continuation)](https://github.com/ag2ai/ag2) la ligne AutoGen v0.2 en direct après que Microsoft ait mis v0.4 en maintenance
