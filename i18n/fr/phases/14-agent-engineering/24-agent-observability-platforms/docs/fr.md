# L'agent observé: Langfuse, Phoenix, Opik

> Trois plateformes d'observabilité d'agents auto-hébergés dominent 2026. Langfuse (MIT)  6M+ installations/mois, suivi + gestion rapide + évaluations + répétition de session. Arize Phoenix (Elastic 2.0)  évaluations profondes spécifiques à l'agent, pertinence RAG, automatisation OpenInference. Comet Opik (Apache 2.0)  optimisation automatique des rappel, garde-corps, détection des hallucinations par juge LLM.

**Type:** Learn
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 23 (OTel GenAI)
**Time:** ~45 minutes

## Objectifs d'apprentissage

- Nombre des trois principales plateformes d'observabilité d'agents auto-hébergés et leurs licences, et dites quelle licence n'est pas open source OSI.
- Distinguer ce que chacun est le plus fort à: Langfuse (sessions mgmt + instantanées), Phoenix (RAG + auto-instrumentation), Opik (optimisation + garde-corps).
- Expliquez pourquoi 89% des organisations déclarent avoir l'observabilité des agents en place d'ici 2026.
- Mettre en œuvre un pipeline de trace à tableau de bord avec évaluation par le juge de la LLM.

## Le problème

OTel GenAI (Léction 23) vous donne le schéma. Vous avez toujours besoin de la plateforme qui ingère les étendues, exécute les évaluations, stocke les versions rapides et surface les régressions.

## Le concept

### Langfuse (MIT)

- 6M+ SDK installés par mois, 19k+ étoiles GitHub.
- Caractéristiques: suivi, gestion rapide avec version + terrain de jeu, évaluations (LLM-as-judge, commentaires des utilisateurs, personnalisés), répétitions de session.
- Juin 2025: précédemment des modules commerciaux (LLM-as-a-judge, files d'attente d'annotation, expériences rapides, Playground) open-source sous MIT.
- Le plus fort pour: observabilité de bout en bout avec une boucle de gestion rapide serrée.

### Arize Phoenix (licence élastique 2.0)

- Évaluation plus approfondie spécifique à l'agent: clustering des traces, détection d'anomalies, pertinence de la récupération pour le RAG.
- Autonome instrumentation OpenInference natif.
- Partage avec Arize AX géré pour la production.
- Aucune version rapide  positionnée comme un outil de dérive/régrésion comportementale aux côtés de plates-formes plus larges.
- Le plus fort pour: la pertinence des RAG, la dérive comportementale, la détection des anomalies.

### Comète Opik (Apache 2.0)

- Optimisation rapide automatisée par des expériences A/B.
- Rideaux de protection (rédaction des informations sur les données, contraintes de travail).
- Détection d'hallucinations par le juge LLM.
- Benchmark de la mesure de Comet: les journaux Opik + évaluations en 23.44s vs Langfuse 327.15s (~14x gap)  prennent les benchmarks du fournisseur comme directionnels.
- Le plus fort pour: boucle d'optimisation, expérimentation automatisée, application de la garde-corps.

### Données de l'industrie

Par Maxim (2026 analyse de terrain): 89% des organisations ont une observabilité des agents; les problèmes de qualité sont la principale barrière de production (32% des répondants les citent).

### Je choisis une

| Need | Pick |
|------|------|
| All-in-one with prompt management | Langfuse |
| Deep RAG evaluation + drift | Phoenix |
| Automated optimization + guardrails | Opik |
| Open licensing, no ELv2 | Langfuse (MIT) or Opik (Apache 2.0) |
| Datadog / New Relic integration | Any — they all export OTel |

### Où ce modèle va mal

- **No eval strategy.**Tracer sans évaluation est juste une extraction coûteuse.
- **Self-rolled LLM-judge without grounding.**Le modèle CRITIC (leçon 05) s'applique  les juges ont besoin d'outils externes pour la vérification des faits.
- **Prompt versions not tied to traces.**Quand le prod régresse, vous ne pouvez pas le couper à l'interrupteur qui l'a causé.

```figure
wb-trace-ingest
```

## Faites-le

`code/main.py`met en œuvre un collecteur de traces stdlib + évaluateur juge LLM:

- Ingérez des écoulements en forme de GenAI.
- Groupe par session, étiquette de défaillance des courses (voyage de garde, évaluations de faible confiance).
- Un juge de droit spécialisé qui note les réponses des agents sur une rubrique.
- Un résumé de tableau de bord: taux d'échec, principales raisons d'échec, répartition des scores d'évaluation.

- Je vais le faire.

```
python3 code/main.py
npx tsx code/main.ts
```

Résultats: scores d'évaluation par séance et catégorisation des défaillances correspondant à ce que Langfuse/Phoenix/Opik montrerait.

## Utilisez-le

- **Langfuse**hébergé par eux-mêmes ou dans le cloud; transmis par voie électronique via OTel ou leur SDK.
- **Arize Phoenix**Autogestion; ouverture à l'instrument automatique.
- **Comet Opik**l'hébergement autonome ou dans le cloud; boucle d'optimisation automatisée.
- **Datadog LLM Observability**pour les équipes de opérations mixtes + ML qui gèrent déjà Datadog.

## La faire partir

`outputs/skill-obs-platform-wiring.md`choisit une plateforme et envoie des traces + évaluations + des versions rapides dans un agent existant.

## Exercices

1. Exporter une semaine de traces d'OTel vers le cloud Langfuse.
2. Écrivez une rubrique de juge de LLM pour votre domaine (correction factuelle, ton, adhérence à la portée).
3. Comparer la version rapide de Langfuse avec la cluster de traces de Phoenix.
4. Lisez les documents de la garde d'Opik, envoyez une garde d'information à l'un de vos agents.
5. Évaluez les trois sur votre corpus, ignorez les chiffres publiés par le vendeur, mesurez les vôtres.

## Les termes clés

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Tracing | "Spans collector" | Ingest OTel / SDK spans; index by session |
| Prompt management | "Prompt CMS" | Versioned prompts tied to traces |
| LLM-as-judge | "Automated eval" | Separate LLM scores agent output against a rubric |
| Session replay | "Trace playback" | Step through past runs for debugging |
| RAG relevancy | "Retrieval quality" | Does the retrieved context match the query |
| Trace clustering | "Behavioral grouping" | Cluster similar runs for drift detection |
| Guardrail enforcement | "Policy at log time" | PII/toxicity/scope checks on logged content |

## Pour en savoir plus

- [Langfuse docs](https://langfuse.com/) Traçabilité, évaluation, mise en œuvre rapide
- [Arize Phoenix docs](https://docs.arize.com/phoenix) Automatisation des instruments, dérive
- [Comet Opik](https://www.comet.com/site/products/opik/) Optimisation + barreaux
- [OpenTelemetry GenAI semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/) le schéma consomment les trois
