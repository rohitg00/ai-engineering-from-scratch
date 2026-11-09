# Capstone 08  Chatbot RAG de production pour une ligne verticale régulée

> Harvey, Glean, Mendable et LlamaCloud ont tous la même forme de production en 2026. Ingest avec docling ou Unstructured et ColPali pour les visuels. La recherche hybride. Rencontre avec Bge-Rencontre-V2-Jemma. Synthétisez avec Claude Sonnet 4.7 en utilisant une mise en cache rapide à un taux de succès de 60-80%. Garde avec la Garde Lama 4 et les gardiens de NeMo. Attention à Langfuse et Phoenix. Grade avec RAGAS sur un jeu d'or de 200 questions. Construisez-en un dans un domaine réglementé (juridique, clinique, assurance), et la pierre angulaire passe le jeu d'or, l'équipe rouge et le tableau de bord à dérive.

**Type:** Capstone
**Languages:** Python (pipeline + API), TypeScript (chat UI, pipeline scaffold)
**Prerequisites:** Phase 5 (NLP), Phase 7 (transformers), Phase 11 (LLM engineering), Phase 12 (multimodal), Phase 17 (infrastructure), Phase 18 (safety)
**Phases exercised:**P5 · P7 · P11 · P12 · P17 · P18
**Time:** 30 hours

## Problème

Le RAG du domaine réglementé (contrats juridiques, protocoles d'essais cliniques, polices d'assurance) est la forme de production la plus expédiée en 2026 parce que le retour sur investissement est évident et que les enjeux sont concrets. Harvey (Allen & Overy) l'a construit pour être légale. Les navires de défense ont le goût de développeurs-docs. Glean couvre la recherche d'entreprise. Le modèle est: ingérer une haute fidélité, récupérer un hybride avec un rencart, synthétiser avec l'application des citations et le caching rapide, protéger avec plusieurs couches de sécurité et surveiller la dérive en continu.

Les parties difficiles ne sont pas le modèle. Il s'agit de la conformité aux compétences (HIPAA, GDPR, SOC2), de l'audit au niveau des citations, du contrôle des coûts (le caching rapide obtient une réduction de 60-90% lorsque le taux de succès est élevé), de la détection des hallucinations via la fidélité RAGAS et de la détection de dérive lorsque les documents sources sont mis à jour sans que l'indice ne soit à la hauteur. Cette pierre angulaire vous demande de la transporter sur un ensemble doré de 200 questions avec une suite rouge-équipe à côté.

## Concept

Le pipeline a deux côtés.**Ingestion**Les documents sont analysés par le document documentation ou par le documentation non structurée; ColPali traite les documents visuellement riches; les blocs obtiennent des résumés, des balises et des étiquettes d'accès basées sur les rôles.**Conversation**LangGraph gère la mémoire et le multi-tour; chaque requête exécute la récupération hybride, se classe avec bge-reranker-v2-gemma-2b, se synthétise avec Claude Sonnet 4.7 (caché instantanément), passe la sortie à travers Llama Guard 4 et NeMo Guardrails, et émet une réponse ancrée par citation.

La pile d'évaluation a quatre couches. **Golden set**(200 questions et réponses avec citations) pour vérifier la précision. **Red team**(prison breaks, tentatives d'extraction d'informations personnelles, questions hors domaine) pour la sécurité. **RAGAS**pour la fidélité / la pertinence de la réponse / la précision du contexte automatiquement par tour. **Drift dashboard**(Arize Phoenix) regardant la qualité de récupération et le score d'hallucinations chaque semaine.

Le caching rapide est le levier de coûts. Claude 4.5+ et GPT-5+ prennent en charge les instructions système de caching + contexte récupéré. À un taux de clics de 60-80%, le coût par requête diminue de 3-5 fois. Le pipeline doit être conçu pour des préfixes stables (système prompt + contexte réaffecté en premier) afin d'obtenir des taux de clics de cache élevés.

## Architecture

```
documents (contracts, protocols, policies)
      |
      v
docling / Unstructured parse + ColPali for visuals
      |
      v
chunks + summaries + role-labels + jurisdiction tags
      |
      v
pgvector + pgvectorscale  +  BM25 (Tantivy)
      |
query + role + jurisdiction
      |
      v
LangGraph conversational agent
   +--- retrieve (hybrid)
   +--- filter by role + jurisdiction
   +--- rerank (bge-reranker-v2-gemma-2b or Voyage rerank-2)
   +--- synthesize (Claude Sonnet 4.7, prompt cached)
   +--- guard (Llama Guard 4 + NeMo Guardrails + Presidio output PII scrub)
   +--- cite + return
      |
      v
eval:
  RAGAS faithfulness / answer_relevance / context_precision (online)
  Langfuse annotation queue (sampled)
  Arize Phoenix drift (weekly)
  red team suite (pre-release)
```

## La pile

- Ingestion: Unstructured.io ou docling pour les documents structurés; ColPali pour les PDF riches en visuels
- Vecteur DB: pgvector + pgvectorscale sous 50M vecteurs; Qdrant Cloud autrement
- Sparse: Tantivy BM25 avec poids de champ
- Orchestration: flux de travail LlamaIndex (ingestion) + LangGraph (conversation)
- Rencontre: bge-renanker-v2-gemma-2b hébergé par soi-même ou Voyage renank-2 hébergé
- LLM: Claude Sonnet 4.7 avec mise en cache rapide; Llama 3.3 70B auto-hébergé
- Eval: RAGAS 0.2 en ligne, DeepEval pour les hallucinations et les suites de jailbreak
- Observabilité: Langfuse auto-hébergé avec file d'attente d'annotation; Arize Phoenix pour dérive
- Garde-rails: Llama Guard 4 classifiateur d'entrée/sortie, politique de NeMo Guardrails v0.12, dépistage des PII de Presidio
- Conformité: étiquettes d'accès basées sur les rôles sur les blocs; étiquettes de compétence pour le RGPD/HIPAA

```figure
canary-rollout
```

## Faites-le

1. **Ingestion.**Parser votre corpus (1000 à 10000 documents pour une construction sérieuse) avec Unstructured ou docling. Pour les pages scannées / visuelles lourdes, parcourir ColPali. Produire des morceaux avec des résumés, des étiquettes de rôle, des balises de juridiction.

2. **Index.**Embedding dense (Voyage-3 ou Nomic-embed-v2) dans l'échelle pgvector + pgvector. indice latéral BM25 via Tantivy. Filtres de rôle et de juridiction en tant que charge utile.

3. **Hybrid retrieve.**Filtre par rôle + juridiction d'abord; puis parallèle dense + BM25; fusionner avec fusion de rang réciproque; top-20 à re-ranker; top-5 à synthétiser.

4. **Synthesize with prompt caching.**Le système demande + les politiques statiques dans l'en-tête de cache; réafficher le contexte comme extension de cache; la question utilisateur comme suffixe non caché.

5. **Guardrails.**Llama Guard 4 sur entrée; NeMo Guardrails rail bloque des questions hors domaine ou des sujets interdits par la politique; Presidio efface les informations personnelles accidentelles dans la sortie; le filtrage post-application des citations.

6. **Golden set.**200 paires de questions/réponse étiquetées par un expert de domaine avec (réponse, citations).

7. **Red team.**50 indications contradictoires: jailbreaks (PAIR, TAP), tentatives d'exfiltration des données personnelles, fuites hors domaine, fuites transversales.

8. **Drift dashboard.**Arize Phoenix suit la qualité de la récupération (nDCG, fidélité des citations) chaque semaine.

9. **Cost report.**Langfuse: taux de mise en cache rapide, jetons par requête, $/query par étape.

## Utilisez-le

```
$ chat --role=analyst --jurisdiction=GDPR
> what is the data-retention obligation for EU user profiles under our contract?
[retrieve]  hybrid top-20 filtered to GDPR + analyst-role
[rerank]    top-5 kept
[synth]     claude-sonnet-4.7, cache hit 74%, 0.8s
answer:
  The contract (Section 12.4, Master Services Agreement dated 2024-03-11)
  obligates EU user profile deletion within 30 days of termination per GDPR
  Article 17. The DPA amendment (DPA-v2.1, Section 5) extends this to 14 days
  for "restricted" category data.
  citations: [MSA-2024-03-11 s12.4, DPA-v2.1 s5]
```

## La faire partir

`outputs/skill-production-rag.md`Un chatbot de domaine réglementé déployé avec des étiquettes de conformité, passé par la rubrique, observé avec la surveillance en direct de la dérive.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | RAGAS faithfulness + answer relevance | Online scores on the golden set (200 Q/A) |
| 20 | Citation correctness | Fraction of answers with verifiable source anchors |
| 20 | Guardrail coverage | Llama Guard 4 pass rate + jailbreak suite results |
| 20 | Cost / latency engineering | Prompt-cache hit rate, p95 latency, $/query |
| 15 | Drift monitoring dashboard | Phoenix live dashboard with weekly retrieval-quality trend |
| **100** | | |

## Exercices

1. Construire une deuxième tranche de corpus sous une juridiction différente (par exemple, HIPAA aux côtés du RGPD).

2. Mesurer le taux de succès de cache rapide sur une semaine de trafic de production. Identifier quelles requêtes brisent le préfixe de cache.

3. Ajoutez la mémoire multi-tours avec un tampon de résumé de 10k. Mesurez si la fidélité diminue à mesure que la conversation se développe.

4. Échangez Claude Sonnet 4.7 contre Llama 3.3 70B auto-hébergé.

5. Ajouter un mode "incertitude": si les scores réévalués sont inférieurs à un seuil, l'agent dit "je n'ai pas de citations sûres" au lieu de répondre.

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Prompt caching | "Cached system + context" | Claude/OpenAI feature: cached prefix tokens discounted 60-90% on hit |
| RAGAS | "RAG evaluator" | Automated scoring of faithfulness, answer relevance, context precision |
| Golden set | "Labeled eval" | 200+ expert-labeled Q/A with citations; the ground truth |
| Jurisdiction tag | "Compliance label" | GDPR/HIPAA/SOC2 scope attached to chunks; enforced by retrieval filter |
| Citation faithfulness | "Grounded answer rate" | Fraction of claims backed by retrievable source spans |
| Drift | "Retrieval quality decay" | Weekly change in nDCG or citation score; alert threshold 5% |
| Red team | "Adversarial eval" | Pre-release jailbreak, PII extraction, off-domain probes |

## Pour en savoir plus

- [Harvey AI](https://www.harvey.ai) stack de production légal de référence
- [Glean enterprise search](https://www.glean.com) RAG de référence à l'échelle de l'entreprise
- [Mendable documentation](https://mendable.ai) référence RAG des développeurs-docs
- [LlamaCloud Parse + Index](https://docs.cloud.llamaindex.ai/llamaparse/getting_started) ingestion gérée
- [Anthropic prompt caching](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching) la référence au levier des coûts
- [RAGAS 0.2 documentation](https://docs.ragas.io/) le cadre d'évaluation canonique des RAG
- [Arize Phoenix](https://github.com/Arize-ai/phoenix) Observabilité de la dérive de référence
- [Llama Guard 4](https://www.llama.com/docs/model-cards-and-prompt-formats/llama-guard-4/) Classification de la sécurité 2026
- [NeMo Guardrails v0.12](https://docs.nvidia.com/nemo-guardrails/) Cadre ferroviaire de la politique
