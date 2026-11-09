# Sélection de chat et de conférenciers

> L'orchestration de la conversation partagée met N agents dans une conversation; une fonction sélectrice (LLM, round-robin ou personnalisé) choisit qui parle ensuite. C'est l'archétype de la conversation multi-agents émergente  les agents ne connaissent pas leur rôle dans un graphique statique, ils réagissent simplement au pool partagé. AutoGen GroupChat et AG2 GroupChat sont les mises en œuvre de référence: la sémantique de GroupChat d'AutoGen v0.2 a été préservée dans la fourchette AG2; AutoGen v0.4 l'a réécrite comme un modèle d'acteur axé sur les événements. Microsoft a mis AutoGen en mode maintenance en février 2026 et l'a fusionné avec le Kernel sémantique dans le Microsoft Agent Framework (RC février 2026). Le GroupeChat primitif survit dans AG2 et Microsoft Agent Framework  apprendre une fois, l'utiliser partout.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 16 · 04 (Primitive Model)
**Time:** ~60 minutes

## Problème

Les graphiques statiques (LangGraph) sont excellents lorsque le flux de travail est connu. Les vraies conversations ne sont pas statiques: parfois le codeur demande au critique, parfois au chercheur, parfois à l'écrivain. Le codage dur de chaque dépôt possible produit une explosion de bord. Vous voulez * agents réagissant à un pool partagé*, avec une fonction décidant qui parle ensuite.

C'est exactement ce que fait AutoGen GroupChat.

## Concept

### La forme

```
              ┌─── shared pool ────┐
              │   m1  m2  m3  ...  │
              └─────────┬──────────┘
                        │ (everyone reads all)
      ┌───────┬─────────┼─────────┬───────┐
      ▼       ▼         ▼         ▼       ▼
    Agent A  Agent B  Agent C  Agent D  Selector
                                           │
                                           ▼
                                  "next speaker = C"
```

Chaque agent voit chaque message, une fonction de sélection est invoquée à chaque tour pour choisir qui parle ensuite.

### Les trois saveurs sélectionnantes

**Round-robin.**Cycle fixe. déterministe. Équelle linéairement en N mais ignore le contexte  un codeur obtient le tour même lorsque le sujet est une revue juridique.

**LLM-selected.**Un appel à un LLM qui lit le pool récent et renvoie le meilleur intervenant suivant. Context-conscient mais lent: à chaque tour ajoute un appel à un LLM. Autogénération par défaut.

**Custom.**Une fonction Python avec la logique que vous voulez. Typique: LLM sélectionné avec des règles de retour (par exemple, "donner toujours le vérificateur le tour après le codeur").

### L'API de l'agent conversiblement

```
agent = ConversableAgent(
    name="coder",
    system_message="You write Python.",
    llm_config={...},
)
chat = GroupChat(agents=[coder, reviewer, tester], messages=[])
manager = GroupChatManager(groupchat=chat, llm_config={...})
```

`GroupChatManager`Quand un agent termine un tour, le gestionnaire appelle le sélecteur, qui renvoie le prochain agent.

### Résolution

Trois modèles communs:

- **Max rounds.**Une boucle dure sur les virages totaux.
- **"TERMINATE" token.**Les agents peuvent envoyer un message de sentinelle; le gestionnaire s'arrête quand il apparaît.
- **Goal-reached check.**Un vérificateur léger passe à chaque tour et arrête la conversation.

### Lignée: forcs et fusions

Au début de 2025, Microsoft a commencé une réécriture majeure d'AutoGen (v0.4) autour d'un modèle d'acteur axé sur les événements.

En février 2026, Microsoft a annoncé que AutoGen passerait au mode maintenance, avec le modèle d'acteur axé sur les événements fusionnant dans **Microsoft Agent Framework**Le concept de GroupChat survit dans les deux pistes; les détails de mise en œuvre diffèrent. AG2 est le code préféré en amont pour le code compatible v0.2.

### Quand le groupe chat est adapté

- **Emergent conversations.**Vous ne voulez pas pré-cabeler chaque haut-parleur possible.
- **Role-mixing tasks.**Le codeur demande au chercheur, le chercheur demande à l'archiviste, l'archiviste demande au codeur de retour.
- **Exploratory problem-solving.**Pensez à la réunion de la tempête, pas à la ligne d'assemblage.

### Quand il échoue

- **Strict determinism.**Le sélecteur de la licence peut être incohérent, le même prompt, des coups différents, des intervenants différents.
- **Sycophancy cascades.**Les agents se déposent à qui parle le plus en confiance.
- **Context bloat.**Chaque agent lit chaque message; après 10 tours, le contexte est énorme.
- **Hot speakers.**Un agent domine la conversation parce que le sélecteur favorise ses spécialités.

### Chat de groupe contre superviseur

Les mêmes primitifs, différents par défaut:

- Un agent planifie et d'autres exécutent.
- Chat de groupe: tous les agents sont des pairs; le sélecteur est une fonction sur le pool partagé.

Les deux utilisent les quatre primitives de la leçon 04. Les discussions de groupe par défaut à l'orchestration sélectionnée par le LLM et à l'état partagé complet.

```figure
swarm-speaker
```

## Faites-le

`code/main.py`Il est possible de mettre en œuvre un groupechat à partir de zéro dans stdlib.`TERMINATE`Je vous en prie.

La démo imprime la transcription de la conversation plus la trace de décision du sélecteur pour les deux variantes.

Je vais courir .

```
python3 code/main.py
npx tsx code/main.ts
```

## Utilisez-le

`outputs/skill-groupchat-selector.md`configure un sélecteur GroupChat pour une tâche donnée  round-robin vs LLM-selected vs custom, et quelles entrées sélecteur (messages récents, spécialités d'agent, compteurs de tour) utiliser.

## La faire partir

Liste de contrôle:

- **Max rounds cap.**Toujours. 10 à 20 pour les tâches typiques.
- **Speaker-balance metric.**Tournées de piste par agent; alerte lorsque le déséquilibre dépasse un seuil.
- **Termination token.** `TERMINATE`ou un agent de vérification dédié.
- **Projection or scoped memory.**Après ~ 10 messages, envisagez de donner à chaque agent seulement une vue à portée de main pour éviter le gonflement de contexte.
- **Selector logging.**Pour les variantes sélectionnées par LLM, enregistrer à la fois l'entrée du sélecteur et son choix.

## Exercices

1. On court .`code/main.py`Comparer la conversation sous round-robin vs LLM-selectionné.
2. Ajoutez une règle de "maximum parle par agent" dans le sélecteur.
3. Mettre en œuvre une fin d'essai atteinte: arrêter lorsque l'examen est "approuvé".
4. Lisez les documents stables d' AutoGen sur le GroupeChat (https://microsoft.github.io/autogen/stable/user-guide/core-user-guide/design-patterns/group-chat.html                                            `GroupChatManager`- Je suis désolé .
5. Lire le rapport AG2 (https://github.com/ag2ai/ag2) et comparer sa version v0.2 de GroupChat à la version v0.4 basée sur des événements.

## Les termes clés

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| GroupChat | "Agents in one chat room" | Shared message pool + selector function. AutoGen / AG2 primitive. |
| Speaker selection | "Who talks next" | The function that picks the next agent. Round-robin, LLM-selected, or custom. |
| GroupChatManager | "The meeting host" | AutoGen component that owns the selector and loops over turns. |
| ConversableAgent | "The base agent" | AutoGen base class; an agent that can send and receive messages. |
| Termination token | "The 'stop' word" | Sentinel string (usually `TERMINATE`) that ends the chat. |
| Hot speaker | "One agent dominates" | Failure mode where the selector keeps picking the same agent. |
| Context bloat | "Pool grows unbounded" | Each agent reads every prior message; context grows with turns. |
| Projection | "Scoped view" | Role-specific view into the shared pool to prevent context bloat. |

## Pour en savoir plus

- [AutoGen group chat docs](https://microsoft.github.io/autogen/stable/user-guide/core-user-guide/design-patterns/group-chat.html) la mise en œuvre de référence
- [AG2 repo](https://github.com/ag2ai/ag2) communauté AutoGen v0.2 continuation
- [Microsoft Agent Framework docs](https://learn.microsoft.com/en-us/agent-framework/) le successeur fusionné, RC février 2026
- [AutoGen v0.4 release notes](https://microsoft.github.io/autogen/stable/) Récris détails du modèle d'acteur axé sur l'événement
