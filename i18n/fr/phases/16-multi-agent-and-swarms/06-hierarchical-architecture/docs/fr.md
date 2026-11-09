# L'architecture hiérarchique et son mode d'échec

> La hiérarchie est le superviseur enraciné, les agents de direction sur les sous-gérants sur les travailleurs.`Process.hierarchical`est la version du manuel: a `manager_llm`La fonction de déléguer dynamiquement les tâches et de valider les sorties.`create_supervisor(create_supervisor(...))`. C'est le modèle naturel lorsque la tâche est un vrai tableau d'org. C'est aussi le modèle le plus susceptible de s'effondrer dans un boucle de gestion  les agents de gestion attribuent mal le travail, interprètent mal les sous-produits ou ne parviennent pas à un consensus.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 16 · 05 (Supervisor Pattern)
**Time:** ~60 minutes

## Problème

Une fois que le modèle de superviseur est cliqué, la prochaine étape naturelle est "et si les travailleurs sont eux-mêmes superviseurs?" Les équipes ont des sous-équipes; les entreprises ont des départements de départements.

Le problème: les gestionnaires de LLM ne sont pas les mêmes que les gestionnaires humains. Un gestionnaire humain a des antécédents stables sur ce que savent ses rapports. Un gestionnaire de LLM redécouvre l'org à chaque tournant de ce qui est dans son contexte.

## Concept

### La forme

```
                 Manager
                 ┌─────┐
                 └──┬──┘
           ┌────────┴────────┐
           ▼                 ▼
       Sub-Mgr A         Sub-Mgr B
       ┌─────┐           ┌─────┐
       └──┬──┘           └──┬──┘
         ┌┴──┬──┐          ┌┴──┐
         ▼   ▼  ▼          ▼   ▼
       W1  W2  W3         W4  W5
```

Chaque nœud interne planifie, délègue et synthétise.

### Là où il brille

- **Clear org mapping.**Si la tâche réelle est départementale ("révision juridique du document, révision financière du document, révision technique du document, puis résumé pour l'exécutif"), la hiérarchie est explicite.
- **Local summarization.**Chaque sous-gérant synthétise la production de son équipe avant que le chef de file ne la voie.

### Où il se brise

Trois modes de défaillance les post-mortem de 2026 continuent de trouver:

1. **Task assignment error.**Le gestionnaire lit l'objectif, hallucine une décomposition et délègue à un sous-gestionnaire incorrect. Parce que le sous-gestionnaire travaille obéissamment sur ce qui lui a été donné, l'erreur ne surgit qu'à la synthèse supérieure  un niveau enlevée d'où un humain aurait pu l'avoir attrapé.
2. **Output misinterpretation.**Le sous-gérant renvoie " incapable de vérifier la réclamation X. " Le supérieur gérant résume comme " la réclamation X n'a pas été confirmée. " La signification dérive à tous les niveaux.
3. **Consensus loops.**Deux sous-gérants ne sont pas d'accord; le chef de file leur demande de se réconcilier; ils déléguent à nouveau; les travailleurs se réorganisent; les sous-gérants répondent légèrement différemment; boucle.`Process.hierarchical`Il y a des limites de niveau, mais la limite elle-même est maintenant un hyperparamètre.

### La question décisive

Sequentiel (pipeline linéaire) vs hiérarchique: votre tâche a-t-elle réellement des sous-équipes indépendantes, ou est-ce qu'il s'agit d'un flux linéaire prétendant être un arbre?

### Mise en œuvre du cadre de rôle

Les équipages de l'AIA `Process.hierarchical`Le directeur:

- reçoit la tâche de premier niveau,
- attribue des sous-tâches aux équipages,
- évalue les résultats de l'équipage,
- décide de l'acceptation, de la rédélégation ou de l'itération.

Documents: https://docs.crewai.com/en/introduction(voir "Processus hiérarchiques" dans les concepts de base).

### Implementation du cadre graphique

LangGraph utilise des nids `create_supervisor`Le superviseur interne a son propre graphique; le superviseur externe traite le graphique interne comme un nœud opaque. C'est plus propre que CrewAI pour débogage (vous pouvez passer par chaque graphique séparément), mais plus difficile à exprimer la remodelage dynamique de l'arbre.

Référence: https://reference.langchain.com/python/langgraph-supervisor.

```figure
swarm-hierarchy-token
```

## Faites-le

`code/main.py`Il dispose d'une hiérarchie de 3 niveaux:

- Directeur principal: divise une tâche en branches "ingénierie" et "juridique",
- sous-gérant de l'ingénierie: divisé en travailleurs "frontend" et "backend",
- sous-directeur juridique: un travailleur.

La démo contraste avec le chemin heureux (tous sont d'accord) contre un **perturbed path**Lorsque la décomposition du directeur supérieur étiquette mal "legal" comme "financial" et observe la cascade d'erreurs  le sous-directeur effectue obéissamment les travaux financiers, le synthétiseur supérieur rapporte les résultats financiers, la question juridique initiale reste sans réponse.

Je vais courir .

```
python3 code/main.py
npx tsx code/main.ts
```

La sortie montre les deux chemins avec un côté-à-côté clair de "ce qui a été demandé" vs "ce qui a été livré".

## Utilisez-le

`outputs/skill-hierarchy-fitness.md`Les données de référence sont les données de référence de la structure de l'organisation, de la structure des organes, du budget de réconciliation, de la production, de la recommandation de modèle avec les modes d'échec spécifiques à prévenir.

## La faire partir

Si vous envoyez des hiérarchiques:

- **Cap tree depth at 2.**Trois niveaux cachent déjà la plupart des erreurs de l'observabilité.
- **Explicit reconciliation budget.**Mettez au maximum des tirs avant que le chef de l'équipe ne s'engage.
- **Provenance on every synthesis.**Le résumé de chaque nœud doit indiquer les sorties de feuilles qui l'ont produit.
- **Alert on decomposition drift.**Enregistrez la décomposition du gestionnaire par étape; diffère par rapport à la requête utilisateur. Si la décomposition ne couvre plus la requête, activez une alerte.

## Exercices

1. On court .`code/main.py`Combien de niveaux de gestion de la remise avant que la sortie de haut dévient complètement de la question de l'utilisateur?
2. Ajoutez un troisième niveau (supérieur → sous → sous → travailleur). Mesurez la fréquence à laquelle le chemin perturbé se corrige et diverge complètement à mesure que la profondeur augmente.
3. Mettre en œuvre un "canary" employé à chaque sous-administrateur qui est toujours posé la question initiale de l'utilisateur inchangé. Utilisez la réponse canarienne pour détecter la décomposition dérive. Comment le gestionnaire devrait-il réagir lorsque le canary ne convient pas à la réponse synthétisée?
4. Lisez le journal de CrewAI `Process.hierarchical`Identifier une barrière de protection concrète appliquée par CrewAI (limite de pas, contrainte manager_llm) et décrire le mode de défaillance visé.
5. Comparer les superviseurs LangGraph à la hiérarchie CrewAI.

## Les termes clés

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Hierarchical | "Org chart pattern" | Supervisors over supervisors; only leaves do work. |
| Manager LLM | "The boss" | The LLM that decomposes, assigns, and validates at an internal node. |
| Decomposition drift | "The boss lost the plot" | Top manager's split no longer covers the original question. |
| Reconciliation loop | "Endless meetings" | Sub-managers disagree; top re-delegates; workers re-run; loop until budget exhausted. |
| Depth-2 ceiling | "Don't go deeper than 2 levels" | Empirical guardrail: 3+ levels collapses observability. |
| Canary question | "Ground truth at every level" | A worker that is always asked the original query unchanged, to detect drift. |
| Provenance chain | "Who said what" | Trace from each synthesis back to the leaf outputs that produced it. |

## Pour en savoir plus

- [CrewAI introduction — Process.hierarchical](https://docs.crewai.com/en/introduction) manuel hiérarchique avec un directeur LLM
- [LangGraph supervisor reference](https://reference.langchain.com/python/langgraph-supervisor) superviseur en nid via `create_supervisor`
- [Anthropic engineering — Research system](https://www.anthropic.com/engineering/multi-agent-research-system)Pourquoi Anthropic a délibérément choisi un superviseur plat plutôt que hiérarchique
- [Cemri et al. — Why Do Multi-Agent LLM Systems Fail?](https://arxiv.org/abs/2503.13657) Taxonomie MAST; section sur les défaillances de coordination documents décomposition dérive
