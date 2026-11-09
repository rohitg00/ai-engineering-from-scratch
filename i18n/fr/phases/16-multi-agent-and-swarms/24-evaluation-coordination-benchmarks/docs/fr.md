# Indices de référence d'évaluation et de coordination

> Cinq critères de référence 2025-2026 couvrent l'espace d'évaluation multi-agents. **MultiAgentBench / MARBLE**(ACL 2025, arXiv:2503.01935) évalue les topologies étoile/chaîne/arbre/graphe avec des indicateurs clés; **graph is best for research**, la planification cognitive ajoute à ~ 3% des réalisations clés. **COMMA**L'évaluation de la coordination multimodal asymétrique-information; les modèles de pointe, y compris le GPT-4o, luttent pour surmonter une ligne de base aléatoire. **MedAgentBoard**(arXiv:2505.12371) couvre quatre catégories de tâches médicales et trouve souvent que le multi-agent ne domine pas le single-LLM. **AgentArch**(arXiv:2509.10769) références des architectures d'agents d'entreprise combinant l'utilisation d'outils + mémoire + orchestration. **SWE-bench Pro**(le secteur de l'énergie)[arXiv:2509.16941](https://arxiv.org/abs/2509.16941)Il existe des problèmes de protection des données dans 41 repossissants couvrant des applications commerciales, des services B2B et des outils de développement; les modèles frontaliers obtiennent un score de ~23% sur Pro vs 70%+ sur Verified  un contrôle de la réalité sur la contamination.**64.3%**sur Pro avec une coordination explicite des équipes d'agents (aucune source primaire anthropic n'a encore été publiée  traiter comme préliminaire); Verdent (échafaudage d'agents) frappe **76.1% pass@1**sur vérifié ([Verdent technical report](https://www.verdent.ai/blog/swe-bench-verified-technical-report)**AAAI 2026 Bridge Program WMAC**(le secteur de l'énergie)https://multiagents.org/2026/Cette leçon s'appuie sur les mesures de MARBLE, effectue un balayage topologique contre métrique et fixe la règle " juste passer la banque SWE Verified n'est pas une preuve de généralisation ".

**Type:** Learn
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 16 · 15 (Voting and Debate Topology), Phase 16 · 23 (Failure Modes)
**Time:** ~75 minutes

## Problème

Lorsque un article affirme que "notre système multi-agents est meilleur", la question est: mieux que quoi, sur quoi, mesuré comment? L'ère 2023-2024 de l'évaluation multi-agents a été un chaos  chacun a choisi ses propres mesures, ses propres lignes de base et ses propres ensembles de tâches.

Sans benchmarks partagés, vous ne pouvez pas comparer deux systèmes multi-agents de manière significative. Pire, sans benchmarks de détention, les modèles frontaliers peuvent contaminer. SWE-bench Verified est partiellement contaminé dans les corps de formation à la mi-2025; les scores frontaliers ont gonflé; Pro a été conçu comme un contrôle de la réalité non contaminé.

Cette leçon énumère les cinq critères de référence canoniques de 2026, nomme ce que chaque mesure, et vous apprend à lire les affirmations de référence de manière sceptique.

## Concept

### Le groupe de travail de la Commission

ArXiv:2503.01935. Évalue quatre topologies de coordination (étoile, chaîne, arbre, graphique) sur les tâches de recherche, de codage et de planification.

Résultats mesurés:

- **Graph**La meilleure topologie pour les scénarios de recherche; prend en charge toute critique.
- **Chain**le mieux adapté à la codage de raffinage progressif.
- **Star**la meilleure solution pour une consolidation rapide.
- **Coordination tax**apparaît après ~ 4 agents sur le graphique.
- **Cognitive planning**ajoute à ~3% de réalisation de milestones dans les topologies.

Utilisez lorsque vous souhaitez comparer les topologies de coordination pommes à pommes.https://github.com/ulab-uiuc/MARBLE) est fourni par l'évaluateur.

### COMMA  Informations asymétriques multimodelles

Il couvre des tâches dans lesquelles les agents ont des modalités d'observation différentes et doivent se coordonner sans partager pleinement les informations.**random baseline**La Commission a également décidé de mettre en place un programme de coopération de coopération entre les agents dans le cadre de la COMMA.

Utilisez lorsque: votre système dispose d'une coordination multimodal ou asymétrique-information.

### Test de stress de domaine MedAgentBoard 

ArXiv: 2505.12371. Quatre catégories de tâches médicales: diagnostic, planification du traitement, génération de rapports, communication avec les patients. Compares systèmes basés sur des règles conventionnelles avec des systèmes multi-agent et un seul LLM.

Résultats: le multi-agent N'est PAS le principal facteur de la LLM dans la plupart des catégories. L'avantage du multi-agent est étroit.

Utilisez quand: votre domaine a des lignes de base claires pour un seul LLM. Si la leçon de MedAgentBoard généralise, de nombreux systèmes multi-agents proposés sont sur-ingénieurs.

### AgentArch  architectures d'entreprise

Les paramètres d'entreprise avec l'utilisation des outils, la mémoire et l'orchestration couchés ensemble.

Utilisez-le lorsque vous conçoitz une pile d'agents d'entreprise et que vous devez justifier chaque couche. AgentArch aide à éviter d'acheter des fonctionnalités dont vous ne pouvez pas mesurer la valeur.

### SWE-bench Pro  la vérification de la réalité

1865 problèmes dans 41 référentiels couvrant des applications commerciales, des services B2B et des outils de développement.**uncontaminated**Les modèles Frontier obtiennent un score de 23% sur Pro contre 70%+ sur Verified.

Points du mois d'avril 2026:
- Claude Opus 4.7 sur Pro: **64.3%**(reporté avec une coordination explicite entre les équipes d'agents; aucune source primaire Anthropic n'a encore été publiée  traité comme préliminaire).
- Verdent (échafaudage d' agent) sur vérifié: **76.1% pass@1**(le secteur de l'énergie)[technical report](https://www.verdent.ai/blog/swe-bench-verified-technical-report))
- Scores de base frontaliers sur Pro sans échafaudage d'agent: ~23-35% ([SWE-bench Pro paper](https://arxiv.org/abs/2509.16941))

Le résultat: " nous avons battu le banc SWE-Verified " n'est plus une preuve de capacité. Pro est le test de mise en place actuel. L'échafaudage agent-équipe produit des gains mesurables sur Pro (~ 30-40 points delta), ce qui est l'un des arguments empiriques les plus forts pour la coordination multi-agent en 2026.

### AAAI 2026 WMAC

Le programme de ponts 2026 de l'AAAI  Atelier sur la coordination multi-agents (https://multiagents.org/2026/Les documents acceptés et les ateliers sont le lieu canonique d'évaluation des nouvelles méthodes; renoncer aux revendications acceptées par le WMAC sur les prépriintes arXiv pour les décisions de production.

### Lire les revendications de référence de manière sceptique  la liste de contrôle de 2026

Quand quelqu'un prétend un résultat multi-agent:

1. **Which benchmark, which split?**Le SWE-bench Verified vs Pro compte beaucoup, un nombre rapporté sur la mauvaise fraction est inutile.
2. **Contamination check.**Le modèle a- t- il été mis en valeur après sa formation ?
3. **Baseline comparison.**Contrairement à la base de l'unité de licence, contre le hasard, contre le travail de plusieurs agents antérieurs.
4. **Statistical significance.**N essais, p-value, intervalle de confiance. les modèles frontaliers sont à forte variance; les courses simples induisent en erreur.
5. **Task diversity.**Une tâche ou plusieurs?
6. **Cost disclosure.**Une solution à 90% à 20 fois le coût est une décision commerciale, pas une revendication de capacité.

### Ce que aucune des valeurs de référence ne mesure bien

- **Long-horizon coordination.**Des jours d'interaction avec les cloches murales.
- **Adversarial resilience.**Que se passe-t-il quand un agent est malveillant ou compromis ?
- **Drift under deployment.**Les points de référence sont statiques; les distributions de production changent.
- **Cost-normalized performance.**La plupart des indicateurs de référence rapportent une précision brute, pas une précision par dollar.

Construire votre propre référence interne pour l'axe qui vous intéresse est souvent la bonne décision.

```figure
a5-bench-gap
```

## Faites-le

`code/main.py`est une marche non interactive:

- Simule 3 systèmes multi-agents sur une tâche de jouet.
- Compute les mesures marquées de style MARBLE pour chacune.
- Effectue un contrôle de contamination en détournant des tâches d'un ensemble de "formation".
- Comparé à une base aléatoire explicitement.
- Imprime une carte de référence des revendications.

Je vais courir .

```bash
python3 code/main.py
npx tsx code/main.ts
```

Expérience attendue: carte de score du système avec précision brute, réalisation de l'étape importante, coût par tâche, delta de la ligne de base par rapport au hasard et note de contrôle de la contamination.

## Utilisez-le

`outputs/skill-benchmark-reader.md`L'évaluation de la qualité des produits de base est effectuée en fonction des critères de référence de l'entreprise.

## La faire partir

Discipline de l'évaluation de la production:

- **Build an internal benchmark**Les critères de référence publics sont des informations, mais ne sont pas des remplacements.
- **Include a random baseline**Si vous ne pouvez pas battre le hasard par une grande marge sur une tâche de coordination, la tâche peut être mal posée.
- **Report cost alongside accuracy.**Les équipes d'opération ont besoin des deux.
- **Rebuild the benchmark quarterly.**Les changements de distribution de la production; les critères de référence obsolètes induisent en erreur.
- **Avoid published-benchmark overfitting.**Si votre équipe optimise spécifiquement pour les numéros SWE-bench Pro, vous régresserez sur la production.

## Exercices

1. On court .`code/main.py`- Identifier lequel des trois systèmes simulés a le meilleur coût par étape.
2. Lisez MultiAgentBench (arXiv:2503.01935). Pour votre propre domaine de tâches, décidez laquelle des quatre topologies que MARBLE recommanderait.
3. Lisez le papier SWE-bench Pro. Qu'est-ce qui le rend spécifiquement résistant à la contamination?
4. Lisez les conclusions de COMMA sur la coordination multimodal. Développez une tâche de coordination multimodal simple que vous pourriez ajouter à votre référence interne.
5. Appliquez la liste de contrôle des revendications de référence au résultat de l'article de presse récent.

## Les termes clés

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| MARBLE | "MultiAgentBench" | ACL 2025; star/chain/tree/graph topologies with milestone KPIs. |
| COMMA | "Multimodal benchmark" | Multimodal asymmetric-info coordination; frontier models struggle vs random. |
| MedAgentBoard | "Domain stress test" | Four medical categories; often finds multi-agent does not dominate single-LLM. |
| AgentArch | "Enterprise benchmark" | Tools + memory + orchestration layered. |
| SWE-bench Pro | "Contamination-resistant" | 1865 problems, 41 repos; ~23% vs 70%+ on Verified (the contamination signal). |
| Milestone achievement | "Partial credit" | Benchmarks that reward progress, not only final success. |
| Contamination | "Benchmark leaked into training" | Post-release, benchmarks drift into training corpora; scores inflate. |
| WMAC | "AAAI 2026 Bridge Program" | Workshop on Multi-Agent Coordination; community focal point. |

## Pour en savoir plus

- [MultiAgentBench / MARBLE](https://arxiv.org/abs/2503.01935) référence de topologie avec des indicateurs clés clés
- [MARBLE repository](https://github.com/ulab-uiuc/MARBLE) mise en œuvre de référence
- [MedAgentBoard](https://arxiv.org/abs/2505.12371) test de stress de domaine; souvent, le multi-agent ne domine pas
- [AgentArch](https://arxiv.org/abs/2509.10769) architectures d'agents d'entreprise
- [SWE-bench leaderboards](https://www.swebench.com/) Scores vérifiés et pro pour les modèles frontaliers
- [AAAI 2026 WMAC](https://multiagents.org/2026/) le point focal communautaire de 2026
