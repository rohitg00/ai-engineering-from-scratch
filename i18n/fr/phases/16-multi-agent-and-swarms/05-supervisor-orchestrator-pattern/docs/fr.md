# Modèle de superviseur / orchestrateur-travailleur

> Un agent principal planifie et délègue; les travailleurs spécialisés exécutent dans des contextes parallèles et rapportent. C'est le modèle derrière le système de recherche d'Anthropic (Claude Opus 4 en tant que plomb, Sonnet 4 en tant que subagents), mesuré à +90,2% par rapport à l'Opus 4 à agent unique sur les évaluations internes de la recherche. Le post d'ingénierie d'Anthropic rapporte que 80% de la variance sur BrowseComp est expliquée par l'utilisation de jetons seulement  multi-agent gagne en grande partie parce que chaque sous-agent obtient une nouvelle fenêtre de contexte. Cette leçon construit le modèle de superviseur à partir des primitifs et couvre les leçons d'ingénierie de 2026 provenant des déploiements de production.

**Type:** Learn + Build
**Languages:** Python (stdlib, `threading`), TypeScript
**Prerequisites:** Phase 16 · 04 (Primitive Model)
**Time:** ~75 minutes

## Problème

La recherche est la tâche prototypée que les systèmes à agent unique échouent. Vous demandez "qu'est-ce qui a changé dans les systèmes à agent multiple entre 2023 et 2026?" Un agent unique lit cinq documents de manière séquentielle, remplit la moitié de son contexte avec leur texte, puis doit raisonner sur tous ensemble. Il oublie le premier article au moment où il atteint le cinquième. Il ne peut pas paralléliser.

Le modèle de superviseur corrige ceci: un agent principal planifie la recherche, délègue chaque sous-question à un travailleur et synthétise. Chaque travailleur obtient sa propre fenêtre de 200k-token pour une question étroite. Le responsable ne voit jamais les matières premières  seulement les résumés des travailleurs.

Le système de recherche de production d'Anthropic rapporte +90,2% sur les évaluations internes de recherche par rapport à un seul Opus 4.

## Concept

### Le modèle

```
                 ┌──────────────┐
                 │   Lead       │  plans, decomposes,
                 │  (Opus 4)    │  synthesizes
                 └──┬────┬───┬──┘
                    │    │   │
            ┌───────┘    │   └───────┐
            ▼            ▼           ▼
      ┌─────────┐  ┌─────────┐  ┌─────────┐
      │ Worker1 │  │ Worker2 │  │ Worker3 │
      │(Sonnet) │  │(Sonnet) │  │(Sonnet) │
      └─────────┘  └─────────┘  └─────────┘
         fresh       fresh        fresh
         context     context      context
```

Le plomb ne lit jamais les matières premières, les ouvriers ne voient jamais le travail de l'autre avant que le plomb ne se synthétise.

### Pourquoi il gagne ?

Trois mécanismes:

1. **Fresh context per subagent.**Un travailleur qui explore le "patrimoine de l'ACL-FIPA" ne porte pas les 40 000 jetons dépensés pour planifier.
2. **Specialization via prompt.**Le conseil du chef est " décomposer et synthétiser ", pas " rechercher. " Le conseil de chaque travailleur est étroit: " trouver ce qui a changé dans X. " Les instructions ciblées produisent des résultats ciblés.
3. **Parallelism.**Les ouvriers travaillent simultanément.`max(worker_times) + plan + synthesis`- Je ne sais pas .`sum(worker_times)`- Je suis désolé .

### Les cours d'ingénierie (Anthropic 2025)

Le post Anthropic énumère plusieurs leçons de production qui sont encore pertinentes pour 2026:

- **Scale effort to query complexity.**Des requêtes simples: un agent, 3 à 10 appels à l'outil. Des requêtes complexes: 10+ agents.
- **Broad then narrow.**Décomposer en sous-questions larges d'abord, puis engendrer plus de travailleurs par sous-question si la réponse justifie la profondeur.
- **Rainbow deployments.**Les agents sont longs et étroits. Le vert bleu traditionnel ne fonctionne pas. L'anthropique utilise l'arc-en-ciel: déploiement progressif de nouvelles versions tandis que les anciennes se déchargent.
- **Token usage dominates.**Multi-agent est ~ 15x les jetons de single-agent. Exécutez-le seulement lorsque la valeur de la tâche justifie le coût.

### Le tour de la graphie

LangGraph a envoyé une `langgraph-supervisor`bibliothèque de haut niveau `create_supervisor`En 2025, LangChain a déménagé la recommandation de mettre en œuvre le modèle de superviseur via l'appel à l'outil directement, car les appels à l'outil donnent plus de contrôle sur ce que le superviseur voit* (ingénierie contextuelle).

### Les modes d'échec

- **Lead hallucinates the plan.**Si le plomb génère des sous-questions qui ne décomposent pas la vraie question, les travailleurs effectuent des recherches précises sur la mauvaise cible.
- **Workers over-explore.**Sans limites de portée explicites, les travailleurs dépassent leur sous-question assignée et polluent l'étape de synthèse.
- **Synthesis conflicts.**Deux travailleurs rapportent des faits contradictoires. Le prospect doit soit réinterroger (ajouter une ronde) ou noter explicitement le désaccord.

### Quand le superviseur a tort

- **Sequential tasks.**Si l'étape 2 a besoin de la sortie de l'étape 1, le parallélisme n'achète rien.
- **Simple queries.**L'agent unique les traite plus vite et moins cher.
- **Strict determinism.**Le superviseur utilise une délégation sélectionnée par le LLM. Les graphiques statiques sont meilleurs lorsque l'audit/réplique est plus important que l'adaptabilité.

```figure
supervisor-hierarchy
```

## Faites-le

`code/main.py`Il met en œuvre un superviseur de trois travailleurs parallèles en utilisant `threading`. Le plomb décompose une requête en sous-questions, les travailleurs s'exécutent simultanément sur chaque sous-question et le plomb est synthétisé.

Structure clé:

- `Lead.plan(query)`une requête est divisée en 3 sous-questions.
- `Worker.run(sub_q)`renvoie un faux résumé (peut être un agent utilisant des outils dans la production).
- `Lead.run(query)`Il dégage les travailleurs en fils, en joints et en synthétise.

Je vais courir .

```
python3 code/main.py
npx tsx code/main.ts
```

La sortie montre le plan, les traces de l'ouvrier parallèle avec des timestamps de début/fin et la synthèse finale.

## Utilisez-le

`outputs/skill-supervisor-designer.md`Il prend une requête utilisateur et produit une conception de modèle de superviseur: prompt du système de conduite, rôles de travailleurs, règles de décomposition des sous-questions et modèle de synthèse.

## La faire partir

Liste de contrôle avant de déployer un modèle de surveillance:

- **Model pairing.**Le plomb sur un modèle de niveau de raisonnement (classe Opus, `o3`Les travailleurs travaillent sur un modèle plus rapide et moins cher (Sonnet, `o4-mini`)
- **Worker timeout.**Tout travailleur qui dépasse 2 fois la durée de fonctionnement médiane est tué; le plomb se réorganise avec une portée plus étroite ou se déplace sans elle.
- **Token cap per worker.**Une limite d'effort (par exemple 10 fois l'entrée de synthèse attendue) empêche un travailleur en fuite de dépenser le budget.
- **Observability.**Suivez le plan du chef, les appels à l'outil de chaque travailleur et la synthèse.
- **Rainbow rollout.**Les agents de longue date ont besoin d'une transition progressive, pas d'un échange.

## Exercices

1. On court .`code/main.py`En ce qui concerne le nombre de travailleurs, le coût de production dépasse les économies parallèles dans cette démonstration.
2. Mettre en œuvre un délai de travail: tuer tout travailleur qui court plus de 0,5 seconde et avoir le plomb synthétiser les résultats restants.
3. Ajouter une étape de détection des conflits à la synthèse du leader: si deux travailleurs répondent à des réponses contradictoires, le leader note le désaccord plutôt que de choisir un. Comment détecter une contradiction sans appeler un LLM?
4. Lisez le rapport d'ingénierie de la société Anthropic sur les systèmes de recherche.
5. Comparer avec LangGraph `create_supervisor`Pourquoi Anthropic ne passe explicitement que des sous-répondices et non pas le contexte des travailleurs brut dans la synthèse ?

## Les termes clés

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Supervisor | "Lead agent" | An orchestrator agent that plans, delegates, and synthesizes. Does not do the work itself. |
| Worker | "Subagent" | A focused agent invoked by the supervisor with narrow scope and its own context window. |
| Orchestrator-worker | "Supervisor pattern" | Same thing, different name. The 2026 literature uses both. |
| Fresh context | "Clean window" | A worker's context starts from its system prompt and assigned question, not the lead's history. |
| Rainbow deployment | "Gradual rollout" | Long-running stateful agents need versioned drain-and-replace, not blue-green. |
| Token dominance | "Context is the variable" | 80% of research-eval variance comes from total tokens used, not model choice, per Anthropic. |
| Scale effort | "Match agent count to complexity" | Lead estimates query difficulty, spawns 1 vs 10+ workers accordingly. |
| Synthesis conflict | "Workers disagree" | Two workers return contradictory facts; the lead must surface disagreement, not silently pick one. |

## Pour en savoir plus

- [Anthropic engineering — How we built our multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system) la référence de production pour le modèle de surveillance
- [LangGraph workflows and agents](https://docs.langchain.com/oss/python/langgraph/workflows-agents) le superviseur d'appel d'outils est maintenant la forme recommandée
- [LangGraph supervisor reference](https://reference.langchain.com/python/langgraph-supervisor) l'assistant hérité, encore utilisé en production en 2026
- [OpenAI cookbook — Orchestrating Agents: Routines and Handoffs](https://developers.openai.com/cookbook/examples/orchestrating_agents) Variante de superviseur basée sur la remise
