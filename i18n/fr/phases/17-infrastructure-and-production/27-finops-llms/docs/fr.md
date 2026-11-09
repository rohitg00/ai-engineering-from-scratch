# FinOps pour les LLM  Économie unitaire et attribution multi-locataires

> Les coûts sont des transactions de jetons, pas du temps de disponibilité des ressources. Les balises ne cartographient pas  un appel API est une transaction, pas un actif. Les décisions d'ingénierie (conception rapide, fenêtre contextuelle, longueur de sortie) sont des décisions financières.`user_id`) pour le prix des sièges et l'expansion, par tâche (`task_id`+ `route`) pour le coût et la priorité des surfaces des produits, par locataire (`tenant_id`) pour l'économie unitaire et le renouvellement. Quatre couches de jetons  prompt, outil, mémoire, réponse  un seau cache dépenser. L'échelle d'application pour les produits multi-locataires: limites de taux par locataire (2-3 fois le pic attendu, 429 + après-essai clair); plafond de dépenses quotidienne (1,5-3 fois le plafond contracté; déclenche le resserrement des taux + alerte); commutateurs de déclenchement sur le z-score des dépenses > 4 (pause automatique + page sur appel). Modèles d'attribution: tag-and-aggregate, joiner de télémétrie (trace-ID → facturation; plus grande précision), prélèvement d'échantillons et extrapolation, allocation basée sur un modèle, source d'événements, streaming en temps réel. Métrique unitaire: coût par requête résolue, coût par artefact généré  non $/M tokens. L'étiquetage rétroactif est toujours manqué; instrument de création à la demande.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, toy cost-attribution simulator with kill switch)
**Prerequisites:** Phase 17 · 13 (Observability), Phase 17 · 14 (Caching)
**Time:** ~60 minutes

## Objectifs d'apprentissage

- Expliquez pourquoi les FinOps traditionnels (tags + niveaux) font une rupture sur les dépenses de LLM et nommez les trois nouvelles dimensions d'attribution.
- Enumérez les quatre couches de jetons (prompte, outil, mémoire, réponse) et pourquoi la facturation à billets unique cache le coût.
- Conception d'une échelle d'application (coup de dépense → couverture de dépense → commutateur de destruction) pour un produit multi-locataire.
- Choisissez une mesure unitaire (coût par requête / artefact résolu) au lieu de jetons $ / M.

## Le problème

Votre facture dit 40 000 $.
- Quel locataire l'a dépensé.
- Quelle fonctionnalité produit l'a conduit.
- Si un utilisateur individuel a été abusif.
- Que ce soit une gonflement rapide, des appels à l'outil ou une amplification de la mémoire, c'était le coupable.

L'étiquetage et l'agrégation du côté fournisseur fonctionnent pour les ressources cloud (EC2, S3) où les étiquettes se propagent vers les éléments de ligne. Les appels LLM API ne sont pas automatiquement étiquetés.

## Le concept

### Trois dimensions d'attribution

**Per-user**(le secteur de l'énergie)`user_id`): qui coûte quoi.

**Per-task**(le secteur de l'énergie)`task_id`+ `route`Les moteurs disposent de priorités, de décisions de décès et de coûts de fonctionnalités.

**Per-tenant**(le secteur de l'énergie)`tenant_id`): quel client est rentable.

Les trois instruments au lieu d'appel le premier jour.

### Quatre couches de symboles

| Layer | Example | Typical % of total |
|-------|---------|---------------------|
| Prompt | system + user input | 40-60% |
| Tool | tool-call results fed back | 20-40% (agent workloads) |
| Memory | prior conversation / retrieved docs | 10-30% |
| Response | model output | 10-30% |

Les quatre éléments sont associés, ce qui rend l'optimisation aveugle.

### L'échelle d'exécution

1. **Rate limit**Par locataire. 2 à 3 fois le pic attendu.`Retry-After`Le locataire voit des frictions, pas de factures de surprise.

2. **Daily spend cap**Le déclencheur: limite de pression + alerte au succès du client.

3. **Kill switch**sur le score z des dépenses > 4 par rapport à la ligne de base du locataire.

### Modèles d'attribution

- **Tag-and-aggregate**: en-tête de métadonnées; agrégé plus tard.
- **Telemetry joiner**Le plus grand nombre de personnes qui ont été recrutées par des équipes matures ont été recrutées par des équipes de recherche.
- **Sampling + extrapolation**Le coût de la production est relativement faible, il est plus élevé que les coûts de production.
- **Model-based allocation**Pour les données héritées sans étiquettes.
- **Event-sourced**: coûts en tant qu'événements dans un flux (Kafka / Kinesis).
- **Real-time streaming**: mise à jour du tableau de bord sous seconde.

### Le coût par X est la mesure unitaire

Les jetons $/M sont des vendeurs.

- Coût par billet de soutien résolu.
- Coût par article généré.
- Coût par mission réussie de l'agent.
- Coût par minute de session utilisateur.

Le coût est lié au résultat du produit, sinon l'optimisation est non accordée.

### Forme de trace de l'attribution des coûts

```
trace_id: abc123
  user_id: u_42
  tenant_id: t_7
  task_id: task_classify_doc
  route: model_haiku
  layers:
    prompt_tokens: 1800
    tool_tokens: 600
    memory_tokens: 400
    response_tokens: 150
  cost_usd: 0.0135
  cached_input: true
  batch: false
```

Émettez à chaque appel. Conservez dans le lac de données. Aggregés par dimension.

### Le paquet d'épargne composée

Stack: cache + lot + route + passerelle.
- Cache L2 (phase 17 · 14): entrée ~10 fois moins chère.
- Partie (phase 17 · 15): 50% de réduction.
- Route vers modèle bon marché (phase 17 · 16): réduction des coûts de 60%.
- Efficience de la passerelle (phase 17 · 19): redondance + tentatives de réapprovisionnement.

Le meilleur cas est l'empilage: 5 à 10% de la base naïve. La plupart des équipes ont 2 à 3 leviers engagés; peu l'empile tous les quatre.

### Les chiffres que vous devriez vous rappeler

- Dimensions d'attribution: par utilisateur, par tâche, par locataire.
- Quatre couches de jetons: prompt, outil, mémoire, réponse.
- Commutateur de déclenchement: dépenser un score z > 4.
- Métrique unitaire: coût par requête résolue, pas jetons $/M.
- Optimisations en pile: ~5 à 10% de la valeur de référence possible.

```figure
i4-spend-ladder
```

## Utilisez-le

`code/main.py`Simulation d'un service LLM multi-locataire avec l'échelle de trois niveaux d'application.

## La faire partir

Cette leçon produit `outputs/skill-finops-plan.md`- En fonction du produit et de l'échelle, il conçoit le schéma d'attribution et l'échelle d'application.

## Exercices

1. On court .`code/main.py`À quel point le commutateur de tuerie tire-t-il ?
2. Conçuez un tableau de bord pour les coûts par habitant et par tâche.
3. Votre plus grand locataire est unité-économie-négatif.
4. Comptez le coût par billet résolu pour un produit de support: 3 millions de jetons/billet, ~ 800 billets/jour, toutes les entrées au taux caché GPT-5 de 0,125 $ / M (prix de liste de lancement; vérifiez la carte de taux en direct).
5. Débattez si l'étiquetage rétroactif peut fonctionner.

## Les termes clés

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Per-user attribution | "user-level cost" | `user_id` stamped on every call |
| Per-task attribution | "feature cost" | `task_id` + `route` identify product surface |
| Per-tenant attribution | "customer cost" | `tenant_id`; drives unit economics |
| Four token layers | "cost layers" | prompt + tool + memory + response |
| Rate limit | "429 guard" | Per-tenant ceiling enforced at gateway |
| Daily spend cap | "daily ceiling" | Tenant-scoped budget with alert |
| Kill switch | "auto-pause" | Spend z-score > 4 triggers auto-suspension |
| Cost per resolved | "product unit metric" | Cost tied to product outcome, not tokens |
| Telemetry joiner | "trace-to-billing" | Highest-accuracy attribution pattern |
| Stacked optimization | "cache+batch+route+gateway" | Compounding savings to ~5-10% baseline |

## Pour en savoir plus

- [FinOps Foundation — FinOps for AI Overview](https://www.finops.org/wg/finops-for-ai-overview/)
- [FinOps School — Cost per Unit 2026 Guide](https://finopsschool.com/blog/cost-per-unit/)
- [Digital Applied — LLM Agent Cost Attribution 2026](https://www.digitalapplied.com/blog/llm-agent-cost-attribution-guide-production-2026)
- [PointFive — Managed LLMs in Azure OpenAI](https://www.pointfive.co/blog/finops-for-ai-economics-of-managed-llms-in-azure-open-ai)
