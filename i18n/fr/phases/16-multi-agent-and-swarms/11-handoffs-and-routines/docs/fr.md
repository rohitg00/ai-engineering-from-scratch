# Les remises et les routines  Orchestration sans État

> Swarm d'OpenAI (octobre 2024) a distillé l'orchestration multi-agent à deux primitives: **routines**(instructions + outils comme un prompt système) et **handoffs**(un outil qui renvoie un autre agent). Aucune machine d'État, aucune branche DSL  les itinéraires LLM en appelant le bon outil de remise. Le SDK OpenAI Agents (mars 2025) est le successeur de la production. L'équipe de la série est la référence conceptuelle la plus pure. Le modèle est viral parce que la surface de l'API est à peu près "agent = prompt + outils; remise = agent de retour de fonction. " Limite: sans état, donc la mémoire est le problème de l'appelant.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 16 · 04 (Primitive Model)
**Time:** ~60 minutes

## Problème

Chaque framework multi-agents veut que vous appreniez son DSL: les nœuds et les bords de LangGraph, les équipes et les tâches CrewAI, AutoGen GroupChat et les gestionnaires.

L'équipe de communication est la machine d'État implicite dans les instructions du système des agents.

## Concept

### Deux primitifs

**Routine.**Un système de commande qui définit le rôle d'un agent et les outils disponibles. Pensez à cela comme un ensemble de instructions à portée de main: "vous êtes un agent de triage; si l'utilisateur demande des remboursements, remettez-les à l'agent de remboursement".

**Handoff.**Un outil que l'agent peut appeler qui renvoie un nouvel objet d'agent.

C'est l'abstraction dans son ensemble.

```
def transfer_to_refunds():
    return refund_agent  # Swarm sees Agent return → switch active agent

triage_agent = Agent(
    name="triage",
    instructions="Route the user to the right specialist.",
    functions=[transfer_to_refunds, transfer_to_sales, transfer_to_support],
)
```

L'interrogatoire du système de l'agent de triage lui permet de choisir la bonne remise en fonction du message de l'utilisateur.

### Pourquoi il est viral

- **Small API.**Deux concepts à apprendre.
- **Uses what the model already does.**L'appel à l'outil est déjà de qualité de production entre les fournisseurs.
- **No state-machine burden.**Vous ne décrivez pas le graphique; les instructions des agents décrivent à qui ils remettent.

### Le commerce des apatrides

Le cadre conserve une histoire de message pendant une course, mais il ne persiste rien. mémoire, continuité, tâches de longue durée  tout le problème de l'appelant.

En production (OpenAI Agents SDK, mars 2025) c'était l'une des principales choses qui a changé: le SDK ajoute la gestion de session intégrée, les barreaux de garde et le suivi tout en maintenant la remise à la main primitive.

### Lorsque les épaules/les manches s'adaptent

- **Triage patterns.**L'agent de première ligne envoie l'utilisateur à un spécialiste.
- **Skill-based handoffs.**"Si la tâche a besoin de code, appelez le codeur; si elle a besoin de recherche, appelez le chercheur".
- **Short, bounded conversations.**Assistance à la clientèle, FAQ à billet, flux de travail simples.

### Quand les éclats luttent

- **Long sessions with shared memory.**Les remises de mains ont réinitialisé l'état de conversation à l'historique de l'interrogatoire du nouvel agent.
- **Parallel execution.**Le transfert est un à la fois  les commutateurs d'agent actif.
- **Audit and replay.**Les courses sans statut sont difficiles à reproduire exactement; le choix de l'offre du LLM n'est pas déterministe.

### Le programme de développement durable OpenAI Agents (mars 2025)

Le successeur de la production ajoute:

- **Session state.**Un fil persistant à travers les courses.
- **Guardrails.**Les crochets de validation de l'entrée/sortie.
- **Tracing.**Chaque appel et remise d'outils sont enregistrés.
- **Handoff filters.**Contrôlez le contexte transféré sur le transfert.

Le primitif de la remise en main survit; l'ergonomie de la production s'y ajoute.

### Swarm vs GroupeChat

Les deux utilisent un routage basé sur le LLM, mais ils diffèrent en**who picks next**- Le numéro de la liste:

- GroupeChat: un sélecteur (fonction ou LLM) choisit le prochain orateur de l'extérieur.
- L'agent actuel choisit son successeur en appelant un outil de transfert.

Swarm est "l'agent décide ce qui vient ensuite"; GroupChat est "le gestionnaire décide ce qui vient ensuite".`GroupChatManager`- Je suis désolé .

```figure
sw-handoff-routing
```

## Faites-le

`code/main.py`Il implémentera Swarm à partir de zéro: une classe de données d'agent, un mécanisme de remise (outil retourne agent) et une boucle de fonctionnement qui détecte les commutateurs d'agent.

Démo: un agent de triage effectue des itinéraires pour rembourser, vendre ou soutenir des spécialistes. Chaque spécialiste dispose de ses propres outils.

Je vais courir .

```
python3 code/main.py
npx tsx code/main.ts
```

## Utilisez-le

`outputs/skill-handoff-designer.md`Il est possible de déterminer les types d'interventions et les types de dépôt.

## La faire partir

Liste de contrôle:

- **Handoff logging.**Chaque remise écrit un événement avec un instant de l'agent à l'agent, un instant de contexte.
- **Context transfer rules.**Décidez de ce qui se déplace sur le remise: l'historique complet (chère), les derniers N messages, ou un résumé.
- **Guardrail on handoff.**Une remise à un spécialiste avec des permissions d'outil différentes doit être authentifiée  sinon l'injection rapide peut forcer des remises non désirées.
- **Loop detection.**Deux agents qui se détachent est un échec commun; détecter avec une simple vérification de sondage de dernière K.
- **Fallback agent.**Si une cible de remise n'existe pas, retournez à une défaillance sécurisée.

## Exercices

1. On court .`code/main.py`Confirmez que l'agent actif du second tour est remboursé.
2. Ajouter une règle de détection de boucle: si les deux mêmes agents ont donné 3 fois de suite, forcer une sortie.
3. Lisez les documents OpenAI Agents SDK sur les filtres de remise. Implémenter une version " résumer sur remise ": l'agent sortant comprime le contexte en un résumé de balle avant que l'agent entrant ne prenne le relais.
4. Comparer la remise de Swarm à un sélecteur GroupChatManager.
5. Lisez le livre de cuisine de Swarm (https://developers.openai.com/cookbook/examples/orchestrating_agentsIdentifier une décision de conception explicite que Swarm fait changer ou maintenir le SDK OpenAI Agents.

## Les termes clés

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Routine | "The agent prompt" | System prompt + tool list. Defines role and available handoffs. |
| Handoff | "Transfer to another agent" | A tool the active agent can call that returns a new Agent. The runtime switches active agent. |
| Stateless | "No memory between runs" | Swarm does not persist anything; memory is the caller's responsibility. |
| Active agent | "Who's speaking now" | The agent currently holding the conversation. Handoff changes this. |
| Context transfer | "What moves on handoff" | Policy for what history the incoming agent sees: full, last N, or summarized. |
| Handoff loop | "Agents ping-pong" | Failure mode where two agents keep handing back to each other. |
| OpenAI Agents SDK | "Production Swarm" | March 2025 successor; adds sessions, guardrails, tracing on top of the handoff primitive. |
| Handoff filter | "Gate on transfer" | SDK feature to inspect and modify context at the handoff boundary. |

## Pour en savoir plus

- [OpenAI cookbook — Orchestrating Agents: Routines and Handoffs](https://developers.openai.com/cookbook/examples/orchestrating_agents) l'articulation de référence
- [OpenAI Swarm repo](https://github.com/openai/swarm) mise en œuvre originale, conservée comme référence conceptuelle
- [OpenAI Agents SDK docs](https://openai.github.io/openai-agents-python/) successeur de production avec séances et suivi
- [Anthropic handoff-in-Claude notes](https://docs.anthropic.com/en/docs/claude-code) comment les subagents de code Claude utilisent un modèle de remise via `Task`
