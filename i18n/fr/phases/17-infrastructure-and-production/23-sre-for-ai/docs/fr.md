# SRE pour l'IA  Réponse à des incidents multi-agents, annuaires de conduite, détection prédictive

> L'AI SRE utilise des LLM basés sur des données d'infrastructure (logs, runbooks, topologie de services) via RAG pour automatiser les phases d'enquête, de documentation et de coordination. Le modèle d'architecture de 2026 est l'orchestration multi-agents  agents spécialisés (logs, métriques, livres de conduite) coordonnés par un superviseur; l'IA propose des hypothèses et des requêtes, les humains approuvent les appels de jugement. Datadog Bits AI et Azure SRE Agent expédient cela comme des produits gérés. Les runbooks évoluent: NeuBird Hawkeye utilise l'évaluation adversitaire (deux modèles analysent le même incident; accord = confiance, désaccord = incertitude); la mémoire opérationnelle persiste en fonction des changements d'équipe. L'automédication reste prudente: l'IA suggère, les humains approuvent. L'action entièrement autonome est étroite (capsule de redémarrage, déploiement spécifique de rampe) avec des barreaux serrés  toute personne vendant "set it and forget it" est survendue. Frontière émergente: prédiction d'incidents. Une recherche du MIT rapporte qu'un LLM formé sur les journaux historiques + les temps de GPU + les schémas d'erreur API a prédit 89% des pannes de service 10 à 15 minutes plus tôt. Projection: 95% des LLM d'entreprises auront un décalage automatisé d'ici fin 2026.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, toy multi-agent incident triage simulator)
**Prerequisites:** Phase 17 · 13 (Observability), Phase 17 · 24 (Chaos Engineering)
**Time:** ~60 minutes

## Objectifs d'apprentissage

- Diagramme de l'architecture multi-agent AI SRE: superviseur + agents spécialisés (logs, métriques, runbooks) + passerelle d'approbation humaine.
- Expliquez pourquoi la remise en état automatique est étroite (capsule de redémarrage, déploiement réversible) plutôt que large (service de réarchitecture).
- Nommez le modèle d'évaluation de l'adversité (NeuBird Hawkeye): deux modèles sont d'accord = confiance; désaccord = escalade.
- Citons le résultat de détection précoce du MIT de 89% et la contrainte opérationnelle: les prédictions sans action sont juste des tableaux de bord.

## Le problème

Un ingénieur en appel est appelé à 3 heures du matin "Total taux d'erreur dans la caisse". Ils vérifient Datadog, Loki, trois livrets d'exécution, le journal de déploiement. 30 minutes plus tard, ils réalisent que la cause principale est un OOM vLLM d'un KV cache spike. Ils redémarrent la capsule; l'erreur est nettoyée.

En 2026, les 20 premières minutes de cette enquête sont automatisées. Le regroupement des journaux par service, en corrélation avec les déploiements récents, en correspondance avec les runbooks  sont tous RAG + utilisation des outils. Un agent supervisé peut faire un triage de première passe et présenter une hypothèse avant que l'homme ouvre Datadog.

La réparation entièrement autonome est un problème différent. Retourner la capsule: sécurisé. Échanger la GPU pool: sécurisé si la politique le permet. Rédécorer le service: absolument pas. La discipline trace la ligne étroite.

## Le concept

### Architecture multi-agent

```
          Incident
             │
             ▼
        Supervisor
        /    |    \
       ▼     ▼     ▼
  Log agent  Metric agent  Runbook agent
       │     │     │
       └─────┴─────┘
             │
             ▼
        Hypothesis + evidence
             │
             ▼
        Human approval
             │
             ▼
        Action (narrow set)
```

Le superviseur découple l'incident en sous-queries. Les agents spécialisés ont accès aux outils (recherche de journaux, PromQL, récupération de documents). Le superviseur synthétise, présente une hypothèse + des preuves à l'homme. L'homme approuve ou redirige.

### Département de traitement automatique

**Safe (narrow)**: redémarrer la capsule, revenir à la déploiement spécifique, faire évoluer le poids de l'échelle dans les limites pré-approuvées, activer le drapeau de fonctionnalité pré-approuvé.

**Not safe (broad)**: modifier la topologie des services, modifier les limites des ressources, déployer un nouveau code, modifier le système de gestion des données internes, modifier les bases de données.

Tout le monde qui vend "set it and forget it" est un surventeur.

### Évaluation adverse (NeuBird Hawkeye)

Deux modèles analysent indépendamment le même incident. Si ils sont d'accord sur la cause profonde, la confiance est élevée. Si ils ne sont pas d'accord, escalader à l'homme avec les deux hypothèses visibles.

### Mémoire opérationnelle

Le retour d'équipe est la destruction silencieuse des feuilles de connaissances tribales traditionnelles de SRE. AI SRE stocke des livres de conduite + des post-mortem dans un vecteur DB; les agents récupèrent sur chaque nouvel incident. Lorsque de nouveaux ingénieurs rejoignent, l'IA a une histoire complète.

### Prévision préalable à l'incident

MIT 2025 recherche: LLM formé sur les journaux historiques, les températures de GPU, les schémas d'erreur API prédit 89% des pannes 10 à 15 minutes avant qu'elles se produisent sur le set de test.

Vérifiez la réalité: les prédictions sans action sont des tableaux de bord. La question opérationnelle est "quand nous prédisposons, que faisons-nous?" drainage préventif? Pager? Auto-échelle? La réponse est spécifique à la politique.

### Produits en 2026

- **Datadog Bits AI** a géré le co-pilot de la SRE à l'intérieur de Datadog.
- **Azure SRE Agent**- Native de l'Azure.
- **NeuBird Hawkeye** évaluation adversitaire + mémoire opérationnelle.
- **PagerDuty AIOps** triage + déduplication.
- **Incident.io Autopilot** commandant d'incident + coordination.

### Les livres de conduite en tant que code

Les runbooks évoluent des pages Confluence à des versions de marquage avec des sections structurées (symptom, hypothèse, vérifier, agir).

### Les chiffres que vous devriez vous rappeler

- Détection précoce du MIT: 89% des pannes, 10 à 15 minutes de délai.
- Triation multi-agent: superviseur + (logs, métriques, manuels de conduite) + humain.
- Un ensemble de remède automatique sécurisé: redémarrer la capsule, réinstaller, étaler dans les limites.
- Évaluation adverse: deux modèles indépendants; accord = confiance.

```figure
i4-incident-agents
```

## Utilisez-le

`code/main.py`Simulation de triage multi-agent: l'agent de journal trouve une erreur, l'agent métrique trouve une pointe de CPU, l'agent de la carte de roulement correspond à un problème connu.

## La faire partir

Cette leçon produit `outputs/skill-ai-sre-plan.md`. Compte tenu du volume d'incidents, de la maturité de l'équipe, il conçoit un déploiement de l'IA SRE.

## Exercices

1. On court .`code/main.py`Et si les agents de log et de métrique ne sont pas d'accord ?
2. Définissez trois actions de réparation automatique "sûr" pour votre service.
3. Écrire un modèle de routeur structuré: sections, champs requis, commandes de vérification.
4. Quelle est votre politique ?
5. Débattez si une équipe de 3 personnes devrait adopter l'IA SRE en 2026 ou attendre.

## Les termes clés

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| AI SRE | "agent for on-call" | LLM-backed incident investigation + coordination |
| Supervisor agent | "the orchestrator" | Top-level agent breaking incidents into sub-queries |
| Specialized agent | "domain agent" | Sub-agent with tool access (logs, metrics, runbooks) |
| Auto-remediation | "AI fixes it" | Narrow pre-approved action; NOT broad re-architecture |
| Operational memory | "vector runbooks" | Post-mortems + runbooks in vector DB for RAG |
| Adversarial eval | "two-model check" | Independent analyses; agreement = confidence |
| NeuBird Hawkeye | "the adversarial one" | Product with adversarial-eval + memory pattern |
| Bits AI | "Datadog's SRE agent" | Datadog-managed AI SRE |
| Pre-incident prediction | "early detection" | 10-15 min lead time on outage prediction |

## Pour en savoir plus

- [incident.io — AI SRE Complete Guide 2026](https://incident.io/blog/what-is-ai-sre-complete-guide-2026)
- [InfoQ — Human-Centred AI for SRE](https://www.infoq.com/news/2026/01/opsworker-ai-sre/)
- [DZone — AI in SRE 2026](https://dzone.com/articles/ai-in-sre-whats-actually-coming-in-2026)
- [Datadog Bits AI](https://www.datadoghq.com/product/bits-ai/)
- [NeuBird Hawkeye](https://www.neubird.ai/)
- [awesome-ai-sre](https://github.com/agamm/awesome-ai-sre)
