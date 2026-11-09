# Les blocs de mémoire et le calcul du temps de sommeil

> Les blocs de mémoire fonctionnels discrets que le modèle peut modifier directement, et un agent de sommeil qui consolide la mémoire de manière asynchrone pendant que l'agent principal est inactif.

**Type:** Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 07 (MemGPT)
**Time:** ~75 minutes

## Objectifs d'apprentissage

- Nombre des trois niveaux de mémoire utilisés par Letta (core, rappel, archivage) et le rôle de chacun.
- Expliquez le modèle de blocage de mémoire: bloc humain, bloc de personnalité et bloc définis par l'utilisateur comme objets de première classe.
- Décrivez ce qu'est le calcul du temps de sommeil, pourquoi il est hors de la voie critique et pourquoi il peut exécuter un modèle plus fort que l'agent principal.
- Implémenter une boucle scriptée à deux agents où un agent principal sert les réponses et un agent de sommeil consolide les blocs entre les tours.

## Le problème

MemGPT (leçon 07) a résolu le flux de contrôle de la mémoire virtuelle.

1. **Latency.**Chaque opération de mémoire est sur le chemin critique. si l'agent doit tailler, résumer ou réconcilier pendant que l'utilisateur attend, la latence de la queue explose.
2. **Memory rot.**Les écrits s'accumulent, les faits contradictoires restent, la récupération se noie dans le contenu obsolète.
3. **Structure loss.**Un magasin d'archives plat ne peut pas exprimer "le bloc humain est toujours dans le prompt; le bloc Persona est toujours dans le prompt; le bloc Tasks swaps par session".

Letta (letta.com) est le nom de la plateforme le projet MemGPT original adopté en 2024  le modèle du papier garde le nom MemGPT  et la réécriture 2026 Letta V1 est une étape ultérieure, séparée.

## Le concept

### Trois niveaux

| Tier | Scope | Where it lives | Written by |
|------|-------|----------------|------------|
| Core | Always visible | Inside the main prompt | Agent tool call + sleep-time rewrites |
| Recall | Conversation history | Retrievable | Automatic turn logging |
| Archival | Arbitrary facts | Vector + KV + graph | Agent tool call + sleep-time ingest |

Le cœur est le cœur MemGPT. rappelez-vous est le tampon de conversation avec sa queue évacuée. archivage est le magasin externe. la fraction nettoie la surcharge à deux niveaux de MemGPT.

### Blocs de mémoire

Un bloc est une section taillée, persistante et éditable du niveau principal.

- **Human block** faits sur l'utilisateur (nom, rôle, préférences, objectifs).
- **Persona block** l'identité, le ton, les contraintes de l'agent.

Letta généralise à des blocs définis par l'utilisateur: a `Task`bloc pour l'objectif actuel, un `Project`bloc pour les faits de base de code, un `Safety`Chaque bloc a une limite de débit.`id`- Je suis là .`label`- Je suis là .`value`- Je suis là .`limit`(capitulatif de caractères), `description`(pour que le modèle sache quand le modifier).

Les blocs sont éditables via la surface de l'outil:

- `block_append(label, text)`
- `block_replace(label, old, new)`
- `block_read(label)`
- `block_summarize(label)` condenser un bloc qui est proche de sa limite.

### Compteur du sommeil

L'ajout Letta 2025: exécuter un deuxième agent en arrière-plan, hors du chemin critique.`learned_context`En effet, les données de l'archivage sont des données de base, et elles sont partagées en blocs partagés, et les archives sont consolidées ou invalidées.

Propriétés qui tombent:

- **No latency cost.**Les réponses primaires ne doivent pas attendre des opérations de mémoire.
- **Stronger model allowed.**L'agent de sommeil peut être un modèle plus cher et plus lent car il n'est pas limité par la latence.
- **Natural consolidation window.**Déduire, résumer, annuler les faits contradictoires lorsque l'utilisateur n'attend pas.

La forme correspond à la façon dont les humains travaillent: vous faites la tâche, vous dormez dessus, la mémoire à long terme se calme du jour au lendemain.

### Résumé du sujet

Letta V1 (`letta_v1_agent`, 2026) déprécie `send_message`/ battements de cœur et en ligne `Thought:`Les réponses API (OpenAI) et les messages API avec la pensée étendue (Anthropic) émettent le raisonnement sur un canal séparé, passé à travers des tours (crypté entre les fournisseurs en production).

### Où ce modèle va mal

- **Block bloat.**Il n' y a pas de fin .`block_append`- Il faut mettre un résumé avant l'écriture qui dépasse le capot.
- **Silent drift.**L'agent du sommeil réécrit un bloc et l'agent principal ne le remarque jamais.
- **Poisoned consolidation.**L'agent du sommeil traite le contenu accessible à l'attaquant dans le noyau.

```figure
memory-blocks
```

## Faites-le

`code/main.py`les implémentations:

- `Block` id, étiquette, valeur, limite, description.
- `BlockStore` CRUD + `near_limit(label)`- Je suis un assistant.
- Deux agents avec scénario`PrimaryAgent`Il sert un tour, `SleepTimeAgent`se consolide entre les tours.
- Une trace qui montre une conversation en trois tours avec Block écrit, plus un passe-temps de sommeil qui résume un bloc et invalide un fait obsolète.

- Je vais le faire.

```
python3 code/main.py
npx tsx code/main.ts
```

La transcription montre la fraction: les virages primaires sont rapides et produisent des écritures brutes; le passage du sommeil est compact et nettoie.

## Utilisez-le

- **Letta**(letta.com) pour la mise en œuvre de référence.
- **Claude Agent SDK skills**En tant que connaissance en forme de bloc  une compétence est un bloc d'instructions nommé, versionné et récupérable que l'agent charge à la demande.
- **Custom builds**Pour les équipes qui veulent contrôler le backend de stockage, utilisez le contrat Letta API pour pouvoir migrer plus tard.

## La faire partir

`outputs/skill-memory-blocks.md`génère un système de bloc en forme de Letta avec des crochets de sommeil pour tout temps d'exécution, y compris les règles de sécurité et le câblage de citation.

## Exercices

1. Ajouter un `block_summarize`outil qui remplace la valeur de bloc par un résumé généré par modèle lorsque `near_limit`Quel seuil de déclenchement minimise à la fois les appels de résumé et le débordement de bloc ?
2. La déduction du temps de sommeil sur l'archivage: deux enregistrements dont le texte a une superposition symbolique de plus de 90% s'effondrent à un.
3. Blocs de version. sur chaque enregistrement d'écriture la valeur ancienne et une différence.`block_history(label)`pour que les opérateurs puissent déboguer "pourquoi l'agent a oublié X".
4. Traitez les agents de sommeil comme des écrivains peu fiables.
5. Port l'exemple pour utiliser l'API Letta (`letta_v1_agent`Quels changements se produisent dans le schéma des blocs, et comment le raisonnement natif modifie-t-il la forme des traces?

## Les termes clés

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Memory block | "Editable prompt section" | Typed, persistent, LLM-editable segment of core memory |
| Human block | "User memory" | Facts about the user, pinned in core |
| Persona block | "Agent identity" | Self-concept, tone, constraints, pinned in core |
| Sleep-time compute | "Async memory work" | Second agent doing consolidation off the critical path |
| Core / Recall / Archival | "Tiers" | Three-layer memory split: always-visible / conversation / external |
| Block limit | "Cap" | Character limit per block; forces summarization |
| Native reasoning | "Thinking channel" | Provider-level reasoning output, not prompt-level `Thought:` |
| Learned context | "Sleep output" | Facts the sleep-time agent writes into shared blocks |

## Pour en savoir plus

- [Letta, Memory Blocks blog](https://www.letta.com/blog/memory-blocks) le modèle de bloc
- [Letta, Sleep-time Compute blog](https://www.letta.com/blog/sleep-time-compute) consolidation asynchrone
- [Letta, Rearchitecting the Agent Loop](https://www.letta.com/blog/letta-v1-agent) Réécriture de raisonnement natif
- [Packer et al., MemGPT (arXiv:2310.08560)](https://arxiv.org/abs/2310.08560) l'origine
