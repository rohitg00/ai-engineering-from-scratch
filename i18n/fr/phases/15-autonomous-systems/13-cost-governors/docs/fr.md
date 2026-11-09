# Les budgets d'action, les plafonds d'itération et les régulateurs des coûts

> Le coût mensuel de la formation en droit d'un agent de commerce électronique de taille moyenne a augmenté de $1,200 to $L'agent a trouvé une nouvelle boucle et a continué à dépenser à l'intérieur. Microsoft's Agent Governance Toolkit (April 2, 2026) codifie la défense contre cette classe: par demande `max_tokens`Les commandes de téléphonie mobile, les commandes de téléphonie mobile, les commandes de téléphonie mobile, les commandes de téléphonie mobile, les commandes de téléphonie mobile, les commandes de téléphonie mobile, les commandes de téléphonie mobile, les commandes de téléphonie mobile, les commandes de téléphonie mobile, les commandes téléphoniques, les commandes téléphoniques, les commandes téléphoniques, les commandes téléphoniques, les commandes téléphoniques, les commandes téléphoniques, les commandes téléphoniques, les commandes téléphoniques, les téléphonies, les téléphones portables, les téléphonies, les téléphones portables, les téléphones portables, les téléphones portables, les téléphones portables, les téléphones portables, les téléphones portables, les téléphones portables, les téléphones portables, les téléphones portables, les téléphones portables, les téléphones portables, les téléphones portables, les téléphonies portables, les téléphonies et les téléphonies.

**Type:** Learn
**Languages:** Python (stdlib, layered cost-governor simulator), TypeScript
**Prerequisites:** Phase 15 · 10 (Permission modes), Phase 15 · 12 (Durable execution)
**Time:** ~60 minutes

## Le problème

Les agents autonomes dépensent de l'argent réel à chaque tour. Une mauvaise sortie d'un chatbot est une mauvaise réponse; la mauvaise boucle d'un agent est une facture. Le terme documenté par l'industrie pour le mode échec est "Denial of Wallet"

La solution n'est pas un seul nombre, mais une pile de limites à différentes échelles de temps et granularités: par demande, par tâche, par heure, par jour, par mois. Une pile bien conçue capture une boucle en cours de route en quelques minutes, une fuite lente en quelques heures et une mauvaise libération en une journée. La même pile maintient un budget quand l'agent est à long horizon et autonome.

C'est une leçon d'ingénierie: les mathématiques sont triviales, la discipline est où les équipes échouent. La liste des limites ci-dessous est nommée soit dans le Kit d'outils de gouvernance des agents Microsoft ou dans les documents SDK des agents de code Claude Anthropic.

## Le concept

### L'étape des coûts

1. **`max_tokens` per request.**Simple, empêche un appel d'émettre une finition illimitée.
2. **Per-task token budget.**Dans toute la course, ne dépassez pas N. Arrêtez à la limite.
3. **Per-task dollar budget.**Comme les jetons, mais en monnaie.`max_budget_usd`dans le code Claude.
4. **Per-tool call cap.**Pas plus de N `WebFetch`Les appels, N `shell_exec`les appels, etc.
5. **Iteration cap (`max_turns`).**Iterations de boucle d'agent totale; empêche les boucles de raisonnement infinies.
6. **Per-minute / per-hour / per-day / per-month cap.**Des fenêtres en roulement, des fuites à différentes échelles temporelles.
7. **Financial velocity limit.**Par exemple, "si les dépenses dépassent 50 $ en 10 minutes, coupez l'accès".
8. **Tiered model routing.**Par défaut, un modèle plus petit; escalade vers un modèle plus grand seulement lorsqu'un classificateur juge que la tâche le justifie.
9. **Prompt caching.**Context prompt et stable du système stocké dans le cache du fournisseur; le coût des jetons de réenvoi est proche de zéro.
10. **Context windowing.**Compaction / résumé pour maintenir le contexte actif en dessous d'un seuil; réduction directe des coûts des jetons.
11. **HITL checkpoints on expensive actions.**Avant une action connue pour être coûteuse (long appel à l'outil, téléchargement important, mise à niveau coûteux du modèle), il faut un tapage humain.
12. **Kill switch on budget breach.**La session est interrompue lorsque des chapeaux sont allumés.

### Pourquoi la pile, pas une seule casquette

Un seul plafond mensuel ne capture un agent fugitif qu'après la disparition du portefeuille. Un seul plafond par demande ne capte rien au niveau de la session.

- **Runaway loop**(agent coincé dans une reprise de 5 secondes): pris par la limite de vitesse.
- **Slow leak**(agent effectuant ~ 2 fois le travail attendu par tâche): pris par le plafond journalier.
- **Bad release**(nouvelle version utilise des jetons 5x): pris par le plafond hebdomadaire / mensuel.
- **Legitimate surge**(réelle demande, pas un bug): pris par le cap horaire / jour avec un journal clair.

### Surface de budget de harnais

Le SDK Claude Code Agent expose (docs publics):

- `max_turns` Cap d'itération.
- `max_budget_usd` plafond en dollars; avortements de séance sur violation.
- `allowed_tools`- Je suis là .`disallowed_tools` allouliste et denyliste d'outils.
- Point de crochet avant utilisation de l'outil pour la comptabilité des coûts personnalisée.

Combinez avec l'échelle en mode autorisation (leçon 10).`autoMode`séance sans`max_budget_usd`L'anthropique définit explicitement le mode automatique comme nécessitant des contrôles budgétaires; le classifiant est orthogonal au coût.

### Loi sur l'IA de l'UE, agence OWASP Top 10

Le Kit d'outils de gouvernance des agents de Microsoft couvre les exigences du Top 10 des agents OWASP et de l'article 14 de la Loi sur l'IA de l'UE (surveillance humaine).

### Les observations $1,200 → $4 800 cas

Le cas réel dans les documents de Microsoft: un agent de commerce électronique dont le coût mensuel a quadruplé après l'ajout d'un nouvel outil. L'outil permettait à l'agent de passer un sondage sur l'état des commandes pendant chaque séance. Aucune détection de boucle. Pas de capuche par outil. Aucune alerte sur la croissance hebdomadaire. La fixation était une limite par outil plus une alerte de croissance quotidienne. Il s'agit d'un modèle: chaque nouvelle surface d'outil est une nouvelle boucle potentielle; chaque nouvel outil a besoin de son propre plafond et de son propre alerte.

```figure
cost-governor-stack
```

## Utilisez-le

`code/main.py`L'agent simulé dérive dans une boucle de vote après quelques tours; la pile de couches le prend dans la fenêtre de vitesse tandis qu'un seul capsule mensuelle ne tirerait que quelques jours plus tard.

## La faire partir

`outputs/skill-agent-budget-audit.md`l'audit de la pile de coûts du déploiement d'un agent proposé et détecte les couches manquantes.

## Exercices

1. On court .`code/main.py`Confirmer la vitesse limite avant le plafond d'itération sur une trajectoire de cycle de sondage. Maintenant désactiver la vitesse limite et mesurer combien l'agent "spend" avant que le plafond d'itération le capture.

2. Conceptez un ensemble de plaques de plaques pour chaque outil pour un agent de navigateur (leçon 11). Quel outil a besoin du plaque de plaque le plus serré? Quel outil peut fonctionner sans limite sans risque?

3. Lisez les documents du kit d'outils de gouvernance des agents de Microsoft. Listez chaque type de plafond et les noms du kit d'outils. Mettez chacun dans un des modes d'échec (circuit de fuite, fuite lente, mauvaise sortie, survol).

4. Prix d'une opération non surveillée au cours de la nuit pour une tâche réaliste (par exemple, "triage 50 émissions dans un repo").`max_budget_usd`à 2x votre estimation de points.

5. Le code de Claude `max_budget_usd`Des limites de vitesse complémentaires que vous appliquerez à l'extérieur.

## Les termes clés

| Term | What people say | What it actually means |
|---|---|---|
| Denial of Wallet | "Runaway bill" | Agent loop generating spend with no cap to stop it |
| max_tokens | "Per-request cap" | Ceiling on a single completion's size |
| max_turns | "Iteration cap" | Ceiling on agent loop iterations in a session |
| max_budget_usd | "Dollar kill switch" | Session cost cap; aborts on breach |
| Velocity limit | "Rate cap" | Limit on spend per short window (e.g., $50 / 10 min) |
| Tiered routing | "Small model first" | Cheap model default; escalate only when classifier warrants |
| Prompt caching | "Cached system prompt" | Provider-side cache reduces re-send token cost to near zero |
| HITL checkpoint | "Human approval gate" | Human tap required before expensive action |

## Pour en savoir plus

- [Anthropic Claude Code Agent SDK — agent loop and budgets](https://code.claude.com/docs/en/agent-sdk/agent-loop) `max_turns`- Je suis là .`max_budget_usd`, les outils de réparation.
- [Microsoft Agent Framework — human-in-the-loop and governance](https://learn.microsoft.com/en-us/agent-framework/workflows/human-in-the-loop) les points de contrôle des gouvernements des coûts.
- [Anthropic — Claude Managed Agents overview](https://platform.claude.com/docs/en/managed-agents/overview) contrôle des coûts du côté du fournisseur.
- [Anthropic — Prompt caching (Claude API docs)](https://platform.claude.com/docs/en/build-with-claude/prompt-caching) mécanique de mise en cache.
- [Anthropic — Measuring agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) profil des coûts pour les agents à long horizon.
