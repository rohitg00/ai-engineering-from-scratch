# Le harnais comme bibliothèque  Subagents et magasin de séances

> Un harnais que vous pouvez importer: outils intégrés, sous-éléments pour l'isolement de contexte, crochets, propagation des traces W3C, persistance de session. Le SDK Claude Agent est l'exemple de référence  la forme de bibliothèque du harnais Claude Code  et Claude Managed Agents est l'alternative hébergée pour le travail asynchrone à long terme.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 01 (Agent Loop), Phase 14 · 10 (Skill Libraries)
**Time:** ~75 minutes

## Objectifs d'apprentissage

- Expliquez la différence entre le SDK client anthropic (API brute) et le SDK agent Claude (forme de harnais).
- Décrire les sous-éléments  parallélisation et isolement de contexte  et quand les atteindre.
- Nommer la surface de stockage de session du SDK Python (`append`- Je suis là .`load`- Je suis là .`list_sessions`- Je suis là .`delete`- Je suis là .`list_subkeys`) et le rôle de `--session-mirror`- Je suis désolé .
- Implémenter un harnais stdlib avec des outils intégrés, un débarquement sous-débarquement avec un contexte isolé, des crochets de cycle de vie et un magasin de session.

## Le problème

Une API LLM brute vous donne un tour de retour. Un agent de production a besoin d'exécution des outils, des serveurs MCP, des crochets de cycle de vie, de reproduction sous-jacente, de persistance de session, de propagation des traces. Claude Agent SDK expédie cette forme en tant que bibliothèque  le même harnais que Claude Code utilise, exposé pour les agents personnalisés.

## Le concept

### SDK client contre SDK agent

- **Client SDK (`anthropic`).**Tu possèdes la boucle, les outils, l'état.
- **Agent SDK (`claude-agent-sdk`).**Exécution intégrée, connexions MCP, crochets, reproduction sous-jacente, magasin de session, boucle de code Claude comme bibliothèque.

### Des outils intégrés

Le SDK expédie plus de 10 outils hors boîte: lecture/écriture de fichiers, shell, grep, glob, web fetch, etc. Les outils personnalisés s'enregistrent via l'interface standard outil-schéma.

### Les sous-gants

Deux objectifs documentés par Anthropic:

1. **Parallelization.**Exécuter des travaux indépendants simultanément. " Trouver le fichier de test pour chacun de ces 20 modules " est une tâche parallèle de 20 subagents.
2. **Context isolation.**Les subagents utilisent leur propre fenêtre de contexte; seuls les résultats reviennent à l'orchestre.

Python SDK ajoutés récemment: `list_subagents()`- Je suis là .`get_subagent_messages()`pour la lecture des transcriptions de subagents.

### Boutique de séances

Parité de protocole avec TypeScript:

- `append(session_id, message)` ajouter un tour.
- `load(session_id)`- Retourner la conversation.
- `list_sessions()` énumérer.
- `delete(session_id)` avec des séances en cascade à subagent.
- `list_subkeys(session_id)` liste des clés sous-jacentes.

`--session-mirror`(Bandard CLI) reflète la transcription à un fichier externe alors qu'elle est diffusée, pour débogage.

### Les crochets

Les crochets de cycle de vie que vous pouvez enregistrer:

- `PreToolUse`- Je suis là .`PostToolUse` Appels de passerelle ou d'outil d'audit.
- `SessionStart`- Je suis là .`SessionEnd`- Il est en train de démolir.
- `UserPromptSubmit` agir sur les données d'entrée utilisateur avant que le modèle ne les voie.
- `PreCompact` fonctionner avant la compression du contexte.
- `Stop`- Le nettoyage à l'exit de l'agent.
- `Notification` Alertes de canal latéraux.

Les crochets sont la façon dont les flux de travail pro (références du programme de cours de la phase 14) et les systèmes similaires ajoutent un comportement transversale.

### Contextes de traces W3C

Les étendues OTel actives sur l'appelant se propagent dans le sous-processus CLI via les en-têtes de contexte de trace W3C. L'ensemble de la trace multi-processus apparaît comme une trace dans votre backend.

### Claude gérait les agents

L' alternative hébergée (tête bêta `managed-agents-2026-04-01`Le contrôle des transactions pour les infrastructures gérées.

### Où ce modèle va mal

- **Subagent over-spawn.**On fait 100 sous-gants pour 100 petites tâches, le surcharge domine.
- **Hook creep.**Chaque équipe ajoute des crochets, des ballons de démarrage, et les revue tous les trimestres.
- **Session bloat.**Les séances s'accumulent, la taille augmente.`list_sessions`+ politique d'expiration.

```figure
ae-subagent-isolation
```

## Faites-le

`code/main.py`met en œuvre la forme SDK dans stdlib:

- `Tool`- Je suis là .`ToolRegistry`avec intégré `read_file`- Je suis là .`write_file`- Je suis là .`list_dir`- Je suis désolé .
- `Subagent` contexte privé, courir isolé, résultats retournés.
- `SessionStore` ajouter, charger, liste, supprimer, list_subkey.
- `Hooks` `pre_tool_use`- Je suis là .`post_tool_use`- Je suis là .`session_start`- Je suis là .`session_end`- Je suis désolé .
- Une démo: l'agent principal génère 3 sous-générations en parallèle (chacune isolée), agrégate les résultats, persiste la session.

- Je vais le faire.

```
python3 code/main.py
npx tsx code/main.ts
```

La trace montre l'isolement de contexte subagent (la taille du contexte de l'orchestre reste limitée), l'exécution du crochet et la persistance de la session.

## Utilisez-le

- **Claude Agent SDK**pour les produits Claude-first qui veulent la forme du harnais Claude Code.
- **Claude Managed Agents**pour les travaux d'asynchronisation à long terme hébergés.
- **OpenAI Agents SDK**(Létion 16) pour les contreparties OpenAI-premières.
- **LangGraph + custom tools**Si vous voulez la machine d'état en forme de graphe à la place.

## La faire partir

`outputs/skill-claude-agent-scaffold.md`Échafaudage une application SDK Claude Agent avec sous-boîtes, crochets, magasin de session, MCP attaché serveur, et W3C trace propagation.

## Exercices

1. Ajoutez un spawner de sous-gants qui regroupe 20 tâches en groupes de 5 sous-gants parallèles. Mesurez la taille du contexte de l'orchestre par rapport à une par tâche.
2. La mise en œuvre d'une `PreToolUse`accroche que les limites de tarifs `write_file`Les appels (5 minutes par session).
3. Le fil`list_subkeys`Comment est le nidage profond ?
4. Mettez le jouet dans la vraie .`claude-agent-sdk`Quel est le changement de l'enregistrement des outils ?
5. Quand passerais-tu de l'hébergement à l'administration ?

## Les termes clés

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Agent SDK | "Claude Code as a library" | Harness shape: tools, MCP, hooks, subagents, session store |
| Subagent | "Child agent" | Separate context, own budget; results bubble up |
| Session store | "Conversation DB" | Persist, load, list, delete turns with subagent cascade |
| Hook | "Lifecycle callback" | Pre/post tool, session, prompt submit, compact, stop |
| W3C trace context | "Cross-process trace" | Parent span propagates into CLI subprocess |
| Managed Agents | "Hosted harness" | Anthropic-hosted long-running async work |
| `--session-mirror` | "Transcript mirror" | Writes session turns to an external file as they stream |
| MCP server | "Tool surface" | External tool/resource source attached to the agent |

## Pour en savoir plus

- [Claude Agent SDK overview](https://platform.claude.com/docs/en/agent-sdk/overview) la forme bibliothécaire du code Claude
- [Anthropic, Building agents with the Claude Agent SDK](https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk) modèles de production
- [Claude Managed Agents overview](https://platform.claude.com/docs/en/managed-agents/overview) alternative hébergée
- [OpenAI Agents SDK](https://openai.github.io/openai-agents-python/) contrepartie
