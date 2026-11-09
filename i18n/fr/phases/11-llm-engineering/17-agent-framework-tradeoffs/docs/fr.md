# Comptes d'affaires sur le cadre des agents  Graphique, rôle et orchestration des acteurs

> Chaque framework vend la même démo (un agent de recherche crée un rapport) et cache le même bug (un schéma d'état lutte avec la couche d'orchestration). Choisissez le framework dont les abstractions correspondent à la forme de votre problème; tout le reste est de la colle que vous écrivez deux fois.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 11 · 09 (Function Calling), Phase 11 · 16 (LangGraph)
**Time:** ~45 minutes

## Le problème

Vous avez une tâche qui nécessite plus d'un appel de LLM. Peut-être est-ce un flux de travail de recherche (plan, recherche, résumé, citation). Peut-être est-ce un pipeline de code-révision (parse diff, critique, patch, validation). Peut-être est-ce un assistant multi-tours qui livre des vols, écrit des e-mails, et des rapports de dépenses. Vous choisissez un cadre.

Trois jours plus tard, vous découvrez la fuite d'abstractions du cadre. CrewAI vous donne des rôles mais vous combat quand le "chercheur" doit remettre un plan structuré à l'"écrivain". AutoGen vous donne un chat entre agents mais n'a pas d'état de première classe donc votre point de contrôle est un picot d'un journal de conversation. LangGraph vous donne un graphique de l'état mais vous oblige à nommer chaque transition avant de savoir ce que fera l'agent. Agno vous donne une abstraction à un seul agent qui crie quand vous essayez de diffuser à trois travailleurs concurrents.

La solution n'est pas de " choisir le meilleur cadre. " Il est de correspondre l'abstraction de base du cadre à la forme de votre problème.

## Le concept

![Agent framework matrix: core abstraction vs problem shape](../assets/framework-matrix.svg)

Quatre cadres dominent le paysage de 2026 et leurs abstractions fondamentales ne sont pas les mêmes.

| Framework | Core abstraction | Best fit | Worst fit |
|-----------|------------------|----------|-----------|
| **LangGraph** | `StateGraph` — typed state, nodes, conditional edges, checkpointer. | Workflows with explicit state and human-in-the-loop interrupts; production agents needing time-travel debugging. | Loose, role-driven brainstorming where the topology is unknown. |
| **CrewAI** | `Crew` — roles (goal, backstory), tasks, process (sequential or hierarchical). | Role-playing or persona-driven workflows with a short linear/hierarchical plan. | Anything stateful beyond the crew's turn history; complex branching. |
| **AutoGen** | `ConversableAgent` pair — two or more agents that speak in turns until an exit condition. | Multi-agent *dialogue* (teacher-student, proposer-critic, actor-reviewer) where the thinking emerges from the chat. | Deterministic workflows with a known DAG; anything needing durable state across restarts. |
| **Agno** | `Agent` — a single LLM + tools + memory, composable into teams. | Fast-to-build single agents and lightweight teams; strong multi-modality and built-in storage drivers. | Deep, explicitly-branched graphs with custom reducers. |

### Ce que signifie réellement "abstraction"

L'abstraction de base d'un cadre est ce que vous dessinez sur le tableau blanc lorsque vous lancez l'architecture.

- **LangGraph**→ vous dessinez un graphique. Les nœuds sont des étapes, les bords sont des transitions, et l'objet d'état à chaque point est tapé.
- **CrewAI**→ vous dessinez un tableau d'org. Chaque rôle a une description de poste et un gestionnaire route les tâches.
- **AutoGen**Deux agents se font un message, un troisième se joint si vous avez besoin d'un modérateur.
- **Agno**→ vous dessinez une seule boîte avec des outils suspendus dessus. Placez des boîtes côte à côte pour une équipe. Le modèle mental est "agent avec des batteries inclus".

### La question de l'État

L'État est le point où la plupart des choix de cadre se décomposent dans la production.

- **LangGraph.**État de type (`TypedDict`Les modèles de calcul de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de
- **CrewAI.**Les flux d' état sont des chaînes entre les tâches via le `context`Le champ ou structuré par`output_pydantic`Aucun magasin durable par équipage, vous devez vous enfuir si l'équipage doit survivre à un redémarrage.
- **AutoGen.**L' état est l' historique de chat et toute définition utilisateur `context`. Les transcriptions de conversation persistent; l'état de flux de travail arbitraire ne le fait pas à moins que vous écriviez des adaptateurs.
- **Agno.**Les pilotes de stockage intégrés (SQLite, Postgres, Mongo, Redis, DynamoDB) sont attachés à un `Agent`par le biais `storage=` Les sessions de conversation et les souvenirs des utilisateurs persistent automatiquement.

### La question de la branche

Tous les agents non triviaux sont des branches.

- **LangGraph** vous décidez, via des bords conditionnels. Le routage est une fonction Python avec des branches nommées. Les branches sont de première classe dans le graphique compilé; le point de contrôle enregistre la branche qui a été prise.
- **CrewAI** le gestionnaire décide en mode hiérarchique; en mode séquentiel, vous décidez au moment de la construction. Le routage est implicite dans la liste de tâches; il n'y a pas de "si" de première classe en dehors de la demande du gestionnaire.
- **AutoGen**Les agents décident par chat.`GroupChatManager`sélectionne le prochain haut-parleur; vous pouvez écrire à la main un `speaker_selection_method`Mais le défaut est basé sur le LLM.
- **Agno** l'agent décide par quel outil appeler ensuite. les équipes ont un mode coordinateur/router/collaborateur; le développement est responsable de brancher au-delà de cela.

### La question de l'observabilité

- **LangGraph** OpenTelemetry via LangSmith ou tout exportateur OTel. Chaque transition de nœud est une durée de traçabilité; les points de contrôle sont doubles en tant que traces jouables. LangSmith est l'option de première partie; Langfuse/Phoenix possède également des adaptateurs.
- **CrewAI** OpenTelemetry de première classe depuis fin 2025; intégrations avec Langfuse, Phoenix, Opik, AgentOps.
- **AutoGen** L'intégration de OpenTelemetry via `autogen-core`Les connecteurs sont des connecteurs, la granularité de traçage est par message agent, pas par nœud.
- **Agno** intégré `monitoring=True`flag plus les exportateurs OpenTelemetry; intégration étroite avec Langfuse pour les traces de session.

### Coût et latence

Les quatre cadres ajoutent des frais généraux par appel (logie du cadre, validation, sérialisation). ordre approximatif d'augmentation des frais généraux: Agno ≈ LangGraph < CrewAI ≈ AutoGen. La différence est dominée par le montant supplémentaire de la mise en route du cadre.`GroupChatManager`LangGraph ne dépense que des jetons là où vous écrivez.`llm.invoke`Le chemin d'Agno est mince.

Lorsque le coût par course est important, préférer le routage explicite (LangGraph edges, AutoGen `speaker_selection_method`) sur le parcours sélectionné par le LLM.

### Interopérabilité

- **LangGraph** **LangChain**outils, récupérateurs, LLM. Adapteur MCP de première classe (outils importés en tant que serveurs MCP).
- **CrewAI** les outils hérités de `BaseTool`Les outils LangChain, LlamaIndex et MCP s'adaptent tous à l'équipage.`allow_delegation=True`- Je suis désolé .
- **AutoGen**- Je suis là.`FunctionTool`Il est possible de mettre en place un adaptateur MCP disponible, un couplage serré avec l'écosystème AG2 pour les modèles agent-agent.
- **Agno**- Je suis là.`@tool`décorateur ou sous-classe BaseTool; adaptateur MCP; les outils peuvent être partagés entre les agents et les équipes.

## La compétence

> Vous pouvez expliquer, en une phrase, pourquoi un cadre donné est bon pour un problème d'agent donné.

Liste de contrôle préconstruite:

1. **Draw the shape.**Est-ce un graphique (état typé, transitions nommées)? un jeu de rôle (les spécialistes abandonnent le travail)? un chat (les agents parlent jusqu'à ce qu'ils aient fini)? un agent unique avec des outils?
2. **Decide who branches.**Le développement décide de la branche → LangGraph. Le gestionnaire décide de l'agent → CrewAI hiérarchique.
3. **Check the state budget.**Si oui, LangGraph est la fonction par défaut; les sessions Agno couvrent l'état de la conversation.
4. **Check the cost budget.**Le routage sélectionné par LLM coûte des jetons supplémentaires par tour.
5. **Budget the framework overhead.**Chaque cadre est une autre dépendance. Si la tâche est deux appels LLM et un outil, écrivez 30 lignes de Python simple; aucun cadre est moins cher que aucun cadre.

Ne cherchez pas un cadre avant de pouvoir dessiner le graphique, le graphique d'org, le chat ou la boîte d'agents.

## La matrice de décision

| Problem shape | Preferred framework | Why |
|---------------|---------------------|-----|
| Workflow DAG with typed state, human approvals, long-running | LangGraph | First-class state, checkpointer, interrupts, time-travel. |
| Research / writing pipeline with distinct roles | CrewAI (sequential) or LangGraph subgraphs | Role-per-task is cheap to express in CrewAI; scale up with LangGraph when branching gets complex. |
| Proposer-critic or teacher-student dialogue | AutoGen | Two-agent chat is its native shape. |
| Single agent with tools, sessions, memory | Agno | Thinnest setup, built-in storage and memory. |
| Thousands of parallel fanouts with reducers | LangGraph + `Send` | The only one with a first-class parallel-dispatch API. |
| Quick prototype, no framework commitment | Plain Python + provider SDK | No framework is the fastest framework. |

```figure
l5-framework-fit
```

## Exercices

1. **Easy.**Prenez la même tâche  "rechercher le siège social d'Anthropic, écrivez un bref de 200 mots, citer des sources"  et mettez-le en œuvre dans LangGraph (quatre nœuds: planifier, rechercher, écrire, citer) et dans CrewAI (trois rôles: chercheur, écrivain, éditeur). Rapporte le coût des jetons par exécution et lignes de code.
2. **Medium.**Construire la même tâche dans AutoGen (chercheur  chat écrivain, éditeur rejoint via `GroupChat`) et Agno (un seul agent avec `search_tools`et `write_tools`Les quatre mises en œuvre sont classées selon: a) le coût par course, b) la capacité de reprendre après un accident, c) la capacité d'injecter une approbation humaine avant la phase de rédaction.
3. **Hard.**Construire un script d' arbre de décision `pick_framework.py`qui prend une brève description du problème (JSON: `{has_typed_state, has_roles, has_dialogue, has_parallel_fanout, needs_resume}`Il est nécessaire de vérifier la validité de la recommandation dans six cas que vous avez conçus vous-même.

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Orchestration | "How the agents coordinate" | The layer that decides which node/role/agent runs next. |
| Durable state | "Resume after a restart" | State that survives process death, attached to a checkpoint or session store. |
| LLM-selected routing | "Let the model decide" | A planner LLM picks the next step each turn; flexible but pays tokens on every decision. |
| Explicit routing | "Developer decides" | A Python function or static edge picks the next step; cheap and auditable. |
| Crew | "A CrewAI team" | Roles + tasks + process (sequential or hierarchical) bound into a single runnable. |
| GroupChat | "AutoGen's multi-agent chat" | A managed conversation between N agents with a speaker selector. |
| Team (Agno) | "Multi-agent Agno" | Route / coordinate / collaborate mode over a set of agents. |
| StateGraph | "LangGraph's graph" | Typed-state, node, conditional-edge, checkpointer abstraction. |

## Pour en savoir plus

- [LangGraph documentation](https://langchain-ai.github.io/langgraph/) StateGraph, points de contrôle, interruptions, voyage dans le temps.
- [CrewAI documentation](https://docs.crewai.com/) équipages, flux, agents, tâches, processus.
- [AutoGen documentation](https://microsoft.github.io/autogen/) ConversableAgent, GroupeChat, équipes, outils.
- [Agno documentation](https://docs.agno.com/) Agent, équipe, flux de travail, stockage, mémoire.
- [Anthropic — Building effective agents (Dec 2024)](https://www.anthropic.com/research/building-effective-agents) bibliothèque de modèles (chaîne de commande, routage, parallélisation, orchestrateur-travailleur, évaluateur-optimisateur)
- [Yao et al., "ReAct: Synergizing Reasoning and Acting" (ICLR 2023)](https://arxiv.org/abs/2210.03629) la boucle chaque cadre s'habille.
- [Wu et al., "AutoGen: Enabling Next-Gen LLM Applications via Multi-Agent Conversation" (2023)](https://arxiv.org/abs/2308.08155) Le papier de conception d'AutoGen.
- [Park et al., "Generative Agents: Interactive Simulacra of Human Behavior" (UIST 2023)](https://arxiv.org/abs/2304.03442) fondation de jeu de rôle sur laquelle les piles de personnages de style CrewAI s'appuient.
- La phase 11 · 16 (Langgraph)  le cadre par lequel cette leçon est comparée.
- Phase 11 · 19 (Réflexion)  un schéma qui correspond bien à LangGraph mais maladroitement à CrewAI.
- Phase 11 · 22 (observabilité de la production)  comment utiliser l'instrument quel que soit le cadre que vous choisissez.
