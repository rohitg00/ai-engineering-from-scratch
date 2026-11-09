# SDK OpenAI Agents: remise en main, garde-corps, suivi

> OpenAI Agents SDK est le framework multicommandé léger construit sur l'API Responses. cinq primitifs: Agent, Handoff, Guardrail, Session, Tracing.`transfer_to_<agent>`Les rails de garde sont activés par défaut.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 01 (Agent Loop), Phase 14 · 06 (Tool Use)
**Time:** ~75 minutes

## Objectifs d'apprentissage

- Nombre des cinq primitifs du SDK OpenAI Agents.
- Expliquez les remises: pourquoi elles sont modélisées comme des outils, quelle forme de nom le modèle voit et comment le contexte se transmet.
- Distinguer les barreaux d'entrée, les barreaux de sortie et les barreaux d'outillage; expliquer `run_in_parallel`contre le mode de blocage.
- Implémenter un runtime stdlib avec des remises + barreaux + traçage de style span.

## Le problème

Les agents qui ne peuvent pas déléguer de manière propre finissent par tout remplir dans un seul prompt. Les agents sans barreaux expédient des PII, des sorties violant les politiques ou des boucles pour toujours. Le SDK d'OpenAI codifie les trois primitives qui rendent le travail multi-agent traitable.

## Le concept

### Cinq primitifs

1. **Agent.**LLM + instructions + outils + remises.
2. **Handoff.**Délégué à un autre agent.`transfer_to_<agent_name>`- Je suis désolé .
3. **Guardrail.**Validation sur entrée (seulement le premier agent), sortie (seulement le dernier agent) ou invocation d'outil (par outil de fonction).
4. **Session.**L'historique de conversation automatique à travers les virages.
5. **Tracing.**Des couches intégrées pour les générations de LLM, des appels à l'outil, des remises, des barreaux.

### Les outils

Le modèle voit .`transfer_to_billing_agent`L'appel indique le temps de fonctionnement à:

1. Copiez le contexte de la conversation (ou effondre via `nest_handoff_history`- le beta).
2. Initializer l'agent cible avec ses instructions.
3. Continuez la course avec l'agent cible.

C'est le modèle de supervision (leçon 13 / leçon 28) produit.

### Rennes de garde

Trois saveurs:

- **Input guardrails.**Rejetez les demandes dangereuses ou hors de portée avant toute appel de LLM.
- **Output guardrails.**On peut détecter les fuites d'informations, les violations de la politique, les réponses malformées.
- **Tool guardrails.**Exécutez l'outil par fonction, validez les arguments, vérifiez les autorisations, exécutez l'audit.

Mode:

- **Parallel**(par défaut). le LLM Guardrail fonctionne à côté du LLM principal.
- **Blocking**(le secteur de l'énergie)`run_in_parallel=False`Le Master de la Garde routière passe en premier, si vous trébuchez, aucun jeton n'est gaspillé sur l'appel principal.

Les câbles triplé s' élèvent .`InputGuardrailTripwireTriggered`- Je suis là .`OutputGuardrailTripwireTriggered`- Je suis désolé .

### Traçage

Chaque génération de LLM, appel à l'outil, remise en main et garde-corps émet une durée. `OPENAI_AGENTS_DISABLE_TRACING=1`Il décide de ne pas le faire.`add_trace_processor(processor)`Les fans s'étendent à votre propre backend à côté de OpenAI.

### Les séances

`Session`stocke l'historique de conversation dans un backend (SQLite, Redis, personnalisé). `Runner.run(agent, input, session=session)`les charges automatiques et les appendages.

### Où ce modèle va mal

- **Handoff drift.**L'agent A passe à l'agent B qui le remet à l'agent A. Ajoutez un compteur de saut.
- **Guardrail bypass.**Les barreaux d'outils ne tirent que sur les outils fonctionnels; les outils intégrés (lecteur de fichiers, récupération Web) ont besoin d'une politique distincte.
- **Over-tracing.**Contenu sensible en spans. Parler avec OTel GenAI règles de capture de contenu (leçon 23)  stockage externe, référence par ID.

```figure
ae-agent-handoff
```

## Faites-le

`code/main.py`met en œuvre la forme SDK dans stdlib:

- `Agent`- Je suis là .`FunctionTool`- Je suis là .`Handoff`(en tant qu'outil de fonction avec la sémantique de transfert).
- `Runner`avec des barreaux d'entrée/sortie/outil, un déploiement de dépêche et un compteur de saut.
- Un émetteur simple pour montrer la forme de la trace.
- Un agent de triage qui se livre à la facturation ou au support en fonction de la requête de l'utilisateur; les sorties de garde-garde sur une entrée.

- Je vais le faire.

```
python3 code/main.py
npx tsx code/main.ts
```

La trace montre deux remises réussie, un voyage sur la garde-ferre d'entrée, et un arbre d'espace reflétant ce que le SDK réel émet.

## Utilisez-le

- **OpenAI Agents SDK**pour les premiers produits OpenAI.
- **Claude Agent SDK**(Létion 17) pour les produits Claude-first.
- **LangGraph**(Létion 13) quand vous voulez un état explicite et un CV durable.
- **Custom**lorsque vous avez besoin d'un contrôle exact (voix, multi-fournisseurs, déploiements fédérés).

## La faire partir

`outputs/skill-agents-sdk-scaffold.md`échafaudage d'une application SDK Agents avec un agent de triage, des remises, des barreaux d'entrée/sortie/outil, un magasin de session et un processeur de suivi.

## Exercices

1. Ajouter un compteur de dépôt: rejet après N transfert.
2. Mise en œuvre `nest_handoff_history`en option  coller les messages précédents en un seul résumé avant de les transférer.
3. Écrivez une barrière de sortie bloquant. Comparer la latence sur les commandes qui le bousculeraient contre celles qui passent.
4. Le fil`add_trace_processor`Quelle forme émet-il par intervalle ?
5. Lisez les documents du SDK. Portez votre jouet stdlib à `openai-agents-python`- Vous avez mal modelé quoi ?

## Les termes clés

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Agent | "LLM + instructions" | Agent type in the SDK; owns tools and handoffs |
| Handoff | "Transfer" | Tool the model calls to delegate to another agent |
| Guardrail | "Policy check" | Validation on input / output / tool invocation |
| Tripwire | "Guardrail trip" | Exception raised when guardrail rejects |
| Session | "History store" | Conversation memory persisted between runs |
| Tracing | "Spans" | Built-in observability over LLM + tool + handoff + guardrail |
| Blocking guardrail | "Sequential check" | Guardrail runs first; no token waste on trip |
| Parallel guardrail | "Concurrent check" | Guardrail runs alongside; lower latency, wastes tokens on trip |

## Pour en savoir plus

- [OpenAI Agents SDK docs](https://openai.github.io/openai-agents-python/) primitivité, remise en main, garde-corps, traçage
- [Claude Agent SDK overview](https://platform.claude.com/docs/en/agent-sdk/overview) Cote-partie à la saveur de claude
- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) quand se rendre à la demande
- [OpenTelemetry GenAI semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/) le SDK standard Agents couvre la carte à
