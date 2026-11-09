# L'homme dans le cercle: proposer et s'engager

> Le consensus de 2026 sur le HITL est spécifique. Il ne s'agit pas de "l'agent demande, l'utilisateur clique sur Approuver". Il s'agit de proposer-et-engager: l'action proposée est maintenue dans un magasin durable avec une clé d'idempotence; apparaît à un examinateur avec intention, lignée de données, autorisations touchées, rayon d'explosion et plan de rétroaction; n'est engagée qu'après une reconnaissance positive; vérifiée après exécution pour confirmer l'effet secondaire qui s'est effectivement produit. Le LangGraph `interrupt()`Plus le point de contrôle PostgreSQL, le Microsoft Agent Framework `RequestInfoEvent`, et Cloudflare's `waitForApproval()`La méthode de défaillance canonique est l'approbation du timbre en caoutchouc: "Approuver?" est cliqué sans examen.

**Type:** Learn
**Languages:** Python (stdlib, propose-then-commit state machine with idempotency), TypeScript
**Prerequisites:** Phase 15 · 12 (Durable execution), Phase 15 · 14 (Tripwires)
**Time:** ~60 minutes

## Le problème

Un agent prend une action. L'utilisateur doit décider: approuver ou non. Si la décision est instantanée, ce n'est probablement pas une révision. Si la décision est structurée, elle est lente mais digne de confiance. La question d'ingénierie est de savoir comment faire une révision structurée le chemin de la moindre résistance.

Le modèle HITL de l'ère 2023 était une demande synchrone: " L'agent veut envoyer un courriel à X avec le corps Y  approuver ? " L'utilisateur clique sur Approuver. Tout le monde sent que le système est sûr.

Le modèle 2026  propose-et-commit  déplace HITL sur un substrat durable, attache des métadonnées structurées et nécessite un engagement positif.`interrupt()`, Microsoft Agent Framework `RequestInfoEvent`, Cloudflare `waitForApproval()`Les noms des API diffèrent, mais pas la forme.

## Le concept

### La machine de l'État proposant ensuite des engagements

1. **Propose.**L'agent produit une action proposée. Persiste à un stock durable (PostgreSQL, Redis, Object Durable).
   - intention (pourquoi l'agent fait-il cela)
   - lignée des données (quelle source a conduit à cette proposition)
   - permissions touchées (quels champs / fichiers / points d'extrémité)
   - rayon d'explosion (qui est le pire cas)
   - plan de réouverture (si engagé, comment le faire annuler)
   - clé d'idempotence (unique par proposition; la réintroduction renvoie le même enregistrement)
2. **Surface.**Le réviseur voit la proposition avec toutes les métadonnées.
3. **Commit.**L'action est exécutée.
4. **Verify.**Après l'exécution, l'effet secondaire est lu et confirmé. Si l'étape de vérification échoue, le système est dans un mauvais état connu et l'alerte s'engage.

### La clé de l'idempotence

Sans clé d'idempotence, une nouvelle tentative après une défaillance transitoire peut exécuter une action approuvée à deux reprises. Exemple concret: l'utilisateur approuve le "transfert de 100 $ de A à B. " Blip réseau. Workflow répète. L'utilisateur a approuvé une fois mais le transfert est exécuté deux fois. La clé d'idempotence lie l'approbation à un seul effet secondaire unique; la deuxième exécution est un no-op.

C'est le même schéma d'idempotence que Stripe et AWS utilisent.

### Durabilité: pourquoi les approbations dépassent les processus

La salle d'attente d'approbation est un état qui ne appartient pas à l'agent. Le flux de travail est arrêté (leçon 12).`interrupt()`avec PostgreSQL checkpointing et pas seulement l'état de mémoire  une approbation deux jours plus tard trouve toujours le flux de travail intact.

### Approbation des timbres en caoutchouc et atténuation des défis et des réponses

L'interface utilisateur par défaut pour HITL ("Approuver" / "Réjecter") produit des approbations rapides sans révision authentique.

- "Vous comprenez quelle ressource cela touche ?
- "Avez-vous vérifié que le rayon de l'explosion est acceptable ?
- "Avez-vous un plan de reprise si cela échoue ?

La fonction de contrôle de l'HITL est une méthode de contrôle de l'agence de sécurité Anthropic citant explicitement le HITL comme une atténuation des modèles d'approbation des timbres de caoutchouc.

### Ce qui compte comme conséquent

Toutes les actions ne nécessitent pas de propos puis d'engagement.

- **Consequential actions**(souvent HITL): écritures irréversibles, transactions financières, communication en sortie, modifications de base de données de production, opérations destructives du système de fichiers.
- **Reversible actions**(parfois HITL): modification des fichiers locaux, changements de mise en scène env, écriture réversible avec un retour en arrière clair.
- **Reads and inspections**(ne jamais HITL): lire un fichier, énumérer des ressources, appeler une API à lecture seule.

### Vérification après l'action

"L'exécution de commit" n'est pas la même que "l'effet secondaire est arrivé". Les conditions de partition réseau et de course peuvent produire un flux de travail qui pense avoir réussi alors que le backend n'a pas persisté.`RETURNING`clauses ou AWS `GetObject`après `PutObject`- Je suis désolé .

### Loi sur l'IA de l'UE Article 14

L'article 14 impose une surveillance humaine efficace des systèmes d'IA à haut risque dans l'UE. "Efficace" n'est pas décoratif. Le langage réglementaire exclut spécifiquement les modèles de timbre en caoutchouc.

```figure
mx-propose-then-commit
```

## Utilisez-le

`code/main.py`Le pilote simule trois cas: un flux d'approbation propre, une réessaye après un échec transitoire (qui ne doit pas être exécuté à double exécution) et un tampon en caoutchouc par défaut par rapport à un flux de défi et de réponse.

## La faire partir

`outputs/skill-hitl-design.md`examine un flux de travail proposé de l'HITL pour proposer la forme et les indicateurs de la méta-données manquantes, des couches d'idempotence, de vérification ou de défi-réponse.

## Exercices

1. On court .`code/main.py`- Confirmer que la nouvelle tentative d'une proposition approuvée utilise le dossier durable et ne réexécute pas.

2. Extension du dossier de proposition par un `rollback`Simuler une exécution dont la étape de vérification échoue.

3. Lisez le cadre d'agents de Microsoft `RequestInfoEvent`Identifiez un champ de métadonnées l'API inclut que le moteur de jouet manque. Ajoutez-le et expliquez de quoi il protège.

4. Conceptez une liste de défis et réponses pour une action spécifique (par exemple, "poster sur un compte Twitter public").

5. Choisissez un cas où une requête synchrone " Approuver " serait suffisante (aucun magasin durable n'est nécessaire). Expliquez pourquoi et nommez la classe de risque que vous acceptez.

## Les termes clés

| Term | What people say | What it actually means |
|---|---|---|
| Propose-then-commit | "Two-phase approval" | Persisted proposal + positive commit + verify |
| Idempotency key | "Retry-safe token" | Unique per proposal; second execution no-ops |
| Data lineage | "Where it came from" | The specific source content that led to the proposal |
| Blast radius | "Worst case" | Scope of effect if the action goes wrong |
| Rubber-stamp | "Fast approval" | "Approve" clicked without genuine review |
| Challenge-and-response | "Forcing checklist" | Reviewer must positively acknowledge specific questions |
| RequestInfoEvent | "MS Agent Framework primitive" | Durable HITL request with structured metadata |
| `interrupt()` / `waitForApproval()` | "Framework primitives" | LangGraph / Cloudflare equivalents of the same shape |

## Pour en savoir plus

- [Microsoft Agent Framework — Human in the loop](https://learn.microsoft.com/en-us/agent-framework/workflows/human-in-the-loop) `RequestInfoEvent`, approbations durables.
- [Cloudflare Agents — Human in the loop](https://developers.cloudflare.com/agents/concepts/human-in-the-loop/) `waitForApproval()`et objets durables.
- [Anthropic — Measuring agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) HITL comme atténuation du risque à long terme.
- [EU AI Act — Article 14: Human oversight](https://artificialintelligenceact.eu/article/14/) base réglementaire pour les systèmes à haut risque.
- [Anthropic — Claude's Constitution (January 2026)](https://www.anthropic.com/news/claudes-constitution) le cadre constitutionnel en ce qui concerne la surveillance.
