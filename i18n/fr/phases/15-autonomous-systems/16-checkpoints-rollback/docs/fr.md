# Les points de contrôle et les débouchés

> Chaque transition de l'état graphique persiste. Quand un travailleur se blesse, son contrat de location expire et un autre travailleur prend la voiture au dernier point de contrôle. Les objets durables Cloudflare conservent l'état pendant des heures ou des semaines. Propose-then-commit (leçon 15) définit un plan de réaction par action. La vérification post-action ferme la boucle. L'article 14 de la Loi sur l'IA de l'UE impose une surveillance humaine efficace pour les systèmes à haut risque  en pratique, cela signifie que les points de contrôle doivent être vérifiables, que les retours doivent être répétés et que le parcours d'audit doit survivre à un déploiement. Le mode défaillance aiguë: sans clés d'idempotence et vérifications des préconditions, une nouvelle tentative après une défaillance transitoire peut dupliquer une action déjà approuvée. La vérification après l'action est ce qui le prend.

**Type:** Learn
**Languages:** Python (stdlib, checkpoint and rollback state machine), TypeScript
**Prerequisites:** Phase 15 · 12 (Durable execution), Phase 15 · 15 (Propose-then-commit)
**Time:** ~60 minutes

## Le problème

L'exécution durable (leçon 12) rend un agent accidenté réalisable. Propose-then-commit (leçon 15) rend une action approuvée auditable. Cette leçon les rejoint: que se passe-t-il lorsqu'une action approuvée est partiellement exécutée, s'écrase et se réalise? quand se déroule le rollback, et contre quel état?

Les systèmes réels le font différemment:

- **LangGraph**Les points de contrôle de chaque transition de l'état graphique vers PostgreSQL.`interrupt()`, qui lui-même persiste.
- **Cloudflare Durable Objects**maintenir l'état par clé pendant des heures ou des semaines. Co-location du calcul avec le stockage pour l'action approuvée.
- **Microsoft Agent Framework**exposés `Checkpoint`les primitifs dans l'API de flux de travail; la répétition plus l'idempotence couvre les répétitions.

Dans tous les cas, la combinaison qui fonctionne réellement est: clé d'idempotence (empêche la double exécution) + vérification des préconditions (l'état est toujours ce que nous avons approuvé) + vérification post-action (l'effet secondaire est réellement arrivé) + retour sur vérifier-échec.

## Le concept

### Chaque transition persiste

Une transition graphique-état est toute étape qui déplace le flux de travail d'un état nommé à un autre. Les implémentations naïves persistent uniquement à des points de mise en œuvre spécifiques; les implémentations de production persistent à chaque transition. Le coût (quelques écritures supplémentaires) est faible par rapport au gain de fiabilité (la répétition se déplace n'importe où, la récupération de location est précise).

### Récupération du bail

Lorsqu'un travailleur se trouve en panne, le flux de travail n'est pas perdu; le bail (une affirmation de courte durée selon laquelle ce travailleur exécute cette course) expire simplement. Un autre travailleur prend le dernier point de contrôle et reprend. Le mécanisme de bail est ce qui permet aux systèmes de production de survivre aux déploiements en roulement sans perdre de travail en vol.

### Idempotence plus conditions préalables

L'idempotence seule ne suffit pas.$100 from A to B when balance > $1000. " Le flux de travail est engagé, s'écrase au milieu de l'exécution et reprend. Si seulement la clé d'idempotence est vérifiée, et l'exécution reprend, le transfert se déroule une fois (correct). Mais considérez que entre l'écrase et le CV, le solde d'A tombe à 500 $ via un flux de travail différent. Le contrôle d'idempotence passe toujours; la condition préalable ne le fait pas. Sans un contrôle de condition préalable, nous expédions un dépôt.

Toute action conséquente nécessite les deux éléments suivants:

- **Idempotency key**: empêche la double exécution.
- **Precondition check**: confirme que l'État est toujours conforme à ce qui a été approuvé.

### Vérification après l'action

"L'outil retourné 200" n'est pas une vérification.

- Mise à jour de la base de données: `UPDATE ... RETURNING *`puis affirmer l'état prévu des correspondances de rangées retournées.
- Envoi par courrier électronique: vérifiez le dossier envoyé pour l'identifiant du message après sa soumission.
- Écrire le fichier: lire le fichier et le faire hasher.
- Appel à l' API: suivi `GET`sur la ressource cible.

Si la vérification échoue, le flux de travail est dans un mauvais état connu.

### Plans de retour

Chaque action qui en résulte dans la proposition-et-commit (leçon 15) comporte un plan de réaction.

- **In-band rollback**: inverser directement l'effet secondaire (`DELETE`après `INSERT`- Je suis là .`Send-correction-email`après l' envoi).
- **Compensating transaction**: une nouvelle action qui neutralise l'original (moteur SAGA standard).
- **Out-of-band rollback**: alert un humain, arrête le flux de travail, laisse le mauvais état pour enquête.

Les actions sans réaction nécessitent un HITL plus fort au moment de l'engagement (leçon 15 - défi et réponse).

### Loi sur l'IA de l'UE Article 14 Lire opérationnelle

L'article 14 exige une "surveillance humaine efficace" des systèmes à haut risque.

- Les points de contrôle sont vérifiables par un vérificateur.
- Les retours sont répétés (testés de bout en bout au moins une fois).
- Le suivi de l'audit survit à un déploiement (le backend du point de contrôle n'est pas éphémère).
- Les vérifications ratées sont alertées, pas enregistrées en silence.

Un flux de travail qui s'écrase au milieu de l'engagement, reprend et complète l'effet secondaire sans voie de vérification + retour ne survit pas à l'essai de l'article 14.

### Le mode défaillance aiguë: le double exécuteur

L'incident de production le plus fréquent dans cet espace:

1. Action approuvée, clé d'indemptance k.
2. Commit commence, exécute, retourne 200.
3. Le flux de travail s'effondre avant de persister dans le statut "engagé".
4. Le flux de travail est repris; voit "approuvé mais non engagé"; est réexécuté.
5. Les effets secondaires sont deux fois.

Atténuation: persévérer une intention "en vol" avant l'exécution, exécuter avec une clé d'idempotence, puis marquer "committed" seulement après la vérification post-action réussie. Si les tirs d'action et l'écriture de statut échouent, vous savez vérifier et (le cas échéant) ré-écrire. Si l'écriture d'état réussit et l'action échoue, vous vérifiez et tirez exactement une fois via le chemin de récupération.

```figure
checkpoint-replay
```

## Utilisez-le

`code/main.py`Le conducteur simule quatre scénarios: une course propre, une nouvelle tentative après un accident (captures d'idempotence), un échec de précondition (abortes de flux de travail sans tir), une vérification de l'échec (incendie de roulement).

## La faire partir

`outputs/skill-rollback-rehearsal.md`conçoit un test de répétition de l'expérience de retour pour un flux de travail proposé et vérifie la persistance du parcours d'audit du point de contrôle.

## Exercices

1. On court .`code/main.py`Pour le cas d'accident, confirmez les tirs d'action exactement une fois à travers les tentatives de reprise.

2. Modifiez le modèle "marquer comme fait d'abord, puis le faire" afin que le statut écrive des incendies après l'action. Retournez le scénario de crash. Mesurer combien d'actions dupliquées tirent.

3. Développer un plan de réouverture pour une action de production spécifique (par exemple, "post to a Slack channel"). Classifier comme en bande, compensant ou hors bande. Justifier le choix.

4. Prenez un flux de travail que vous connaissez. Identifiez chaque transition d'état. Marquez-le avec une exigence de durabilité (persistent / ne persistent pas). Comptez ceux que vous ne persistez pas actuellement.

5. Test de retour répété: concevoir un test de bout en bout qui exécute un véritable flux de travail, le casse et confirme les feux de chemin de retour.

## Les termes clés

| Term | What people say | What it actually means |
|---|---|---|
| Checkpoint | "Save point" | Every graph-state transition persists to a durable store |
| Lease | "Worker claim" | Short-lived claim that a worker is executing a run; expires on crash |
| Precondition | "State gate" | Assertion that the state is still consistent with the approved action |
| Post-action verify | "Re-read check" | Confirm the side effect actually happened in the target system |
| In-band rollback | "Direct undo" | Reverse the side effect with the inverse operation |
| Compensating transaction | "SAGA undo" | A new action that neutralizes the original |
| Mark-as-done-first | "Status write order" | Persist the committed status before returning from commit |
| Article 14 | "EU AI Act human oversight" | Operational: queryable checkpoints, rehearsed rollbacks, auditable trail |

## Pour en savoir plus

- [Microsoft Agent Framework — Checkpointing and HITL](https://learn.microsoft.com/en-us/agent-framework/workflows/human-in-the-loop) Primitives de points de contrôle et récupération de location.
- [Cloudflare Agents — Human in the loop](https://developers.cloudflare.com/agents/concepts/human-in-the-loop/) Objets durables en tant que substrat d'état.
- [EU AI Act — Article 14: Human oversight](https://artificialintelligenceact.eu/article/14/) base réglementaire.
- [Anthropic — Measuring agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) Cadrage fiable des flux de travail à long terme.
- [Anthropic — Claude Code Agent SDK: agent loop](https://code.claude.com/docs/en/agent-sdk/agent-loop) Forme de flux de travail pour les routines de code Claude.
