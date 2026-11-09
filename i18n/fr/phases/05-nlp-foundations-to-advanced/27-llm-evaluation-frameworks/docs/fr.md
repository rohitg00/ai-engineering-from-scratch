# Évaluation du LLM  RAGAS, DeepEval, G-Eval

> L'équivalence sémantique est absente. L'examen humain n'est pas à l'échelle. LLM-as-judge est la réponse de production  avec suffisamment d'étalonnage pour faire confiance au nombre.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 13 (Question Answering), Phase 5 · 14 (Information Retrieval)
**Time:** ~75 minutes

## Le problème

Votre système RAG répond: "29 juin 2007".
La référence en or est: "29 juin 2007".
Exact Match marque 0, F1 marque 75%, un humain marquerait 100%.

Multipliez par 10 000 cas de test. Multipliez à nouveau par chaque changement de retriever, de déchiquetage, de prompt ou de modèle. Vous avez besoin d'un évaluateur qui comprend le sens, fonctionne à bas prix à l'échelle, ne ment pas sur les régressions et présente les bons modes d'échec.

2026 a trois cadres qui possèdent ce problème.

- **RAGAS.**Évaluation de la génération augmentée de la récupération. Quatre mesures RAG (fidélité, pertinence de la réponse, précision du contexte, rappel du contexte) avec des arrière-plans de NLI + LLM-juges.
- **DeepEval.**PYTEST pour les LLM. G-Eval, réalisation des tâches, hallucination, métriques de biais.
- **G-Eval.**Une méthode (et une métrique DeepEval): LLM-as-judge avec chaîne de pensée, critères personnalisés, score 0-1.

Cette leçon construit l'intuition pour la méthode et la couche de confiance qui l'entoure.

## Le concept

![Four evaluation dimensions, LLM-as-judge architecture](../assets/llm-evaluation.svg)

**LLM-as-judge.**Remplacez une métrique statique par une LLM qui note les résultats d'une rubrique.`(query, context, answer)`"C'est un score de 0 à 1 sur la fidélité".

Pourquoi cela fonctionne-t-il: les LLM approximent le jugement humain à une fraction du coût.$0.003 per scored case enables 1000-sample regression eval runs for under $5. Le député

Pourquoi il échoue silencieusement:

1. **Judge bias.**Les juges préfèrent des réponses plus longues, des réponses de leur propre famille de modèles, des réponses qui correspondent au style rapide.
2. **JSON parsing failures.**Pourtant, le nombre de points de la gamme de RAGAS est resté restreint.
3. **Drift over model versions.**La mise à niveau du juge change toutes les mesures.

**The RAG four.**

| Metric | Question | Backend |
|--------|----------|---------|
| Faithfulness | Does each claim in the answer come from the retrieved context? | NLI-based entailment |
| Answer relevance | Does the answer address the question? | Generate hypothetical questions from answer; compare to real question |
| Context precision | Of retrieved chunks, what fraction were relevant? | LLM-judge |
| Context recall | Did retrieval return everything needed? | LLM-judge against gold answer |

**G-Eval.**Définir un critère personnalisé: "La réponse cite-t-elle la source correcte?" Le cadre s'étend automatiquement en étapes d'évaluation de la chaîne de pensée, puis donne un score de 0-1.

**Calibration.**Ne faites jamais confiance au score du juge brut tant que vous n'avez pas une corrélation avec les étiquettes humaines. Exécutez 100 exemples étiquetés à la main. Juger à l'intrigue contre humain. Computez le rho de Spearman. Si rho < 0,7, votre rubrique du juge doit travailler.

```figure
n5-judge-gauge
```

## Faites-le

### Étape 1: fidélité à la NLI (à la RAGAS)

```python
from typing import Callable
from transformers import pipeline

nli = pipeline("text-classification",
               model="MoritzLaurer/DeBERTa-v3-large-mnli-fever-anli-ling-wanli",
               top_k=None)

# `llm` is any callable: prompt str -> generated str.
# Example: llm = lambda p: client.messages.create(model="claude-haiku-4-5", ...).content[0].text
LLM = Callable[[str], str]


def atomic_claims(answer: str, llm: LLM) -> list[str]:
    prompt = f"""Break this answer into simple factual claims (one per line):
{answer}
"""
    return llm(prompt).splitlines()


def faithfulness(answer: str, context: str, llm: LLM) -> float:
    claims = atomic_claims(answer, llm)
    if not claims:
        return 0.0
    supported = 0
    for claim in claims:
        result = nli({"text": context, "text_pair": claim})[0]
        entail = next((s for s in result if s["label"] == "entailment"), None)
        if entail and entail["score"] > 0.5:
            supported += 1
    return supported / len(claims)
```

Décomposer la réponse en revendications atomiques. NLI vérifier chaque revendication contre le contexte récupéré. fidélité = fraction prise en charge.

### Étape 2: la pertinence de la réponse

```python
import numpy as np
from sentence_transformers import SentenceTransformer

# encoder: any model implementing .encode(texts, normalize_embeddings=True) -> ndarray
# e.g., encoder = SentenceTransformer("BAAI/bge-small-en-v1.5")

def answer_relevance(question: str, answer: str, encoder, llm: LLM, n: int = 3) -> float:
    prompt = f"Write {n} questions this answer could be the answer to:\n{answer}"
    generated = [line for line in llm(prompt).splitlines() if line.strip()][:n]
    if not generated:
        return 0.0
    q_emb = np.asarray(encoder.encode([question], normalize_embeddings=True)[0])
    g_embs = np.asarray(encoder.encode(generated, normalize_embeddings=True))
    sims = [float(q_emb @ g_emb) for g_emb in g_embs]
    return sum(sims) / len(sims)
```

Si la réponse implique des questions différentes de celles posées, la pertinence diminue.

### Étape 3: Métrique personnalisée G-Eval

```python
from deepeval.metrics import GEval
from deepeval.test_case import LLMTestCaseParams, LLMTestCase

metric = GEval(
    name="Correctness",
    criteria="The answer should be factually accurate and match the expected output.",
    evaluation_steps=[
        "Read the expected output.",
        "Read the actual output.",
        "List factual claims in the actual output.",
        "For each claim, mark supported or unsupported by the expected output.",
        "Return score = fraction supported.",
    ],
    evaluation_params=[LLMTestCaseParams.INPUT, LLMTestCaseParams.ACTUAL_OUTPUT, LLMTestCaseParams.EXPECTED_OUTPUT],
)

test = LLMTestCase(input="When was the first iPhone released?",
                   actual_output="June 29th, 2007.",
                   expected_output="June 29, 2007.")
metric.measure(test)
print(metric.score, metric.reason)
```

Les étapes d'évaluation sont les rubriques. Les étapes explicites sont plus stables que les instructions implicites "score 0-1".

### Étape 4: Porte d'information

```python
import deepeval
from deepeval.metrics import FaithfulnessMetric, ContextualRelevancyMetric


def test_rag_system():
    cases = load_regression_cases()
    faith = FaithfulnessMetric(threshold=0.85)
    rel = ContextualRelevancyMetric(threshold=0.7)
    for case in cases:
        faith.measure(case)
        assert faith.score >= 0.85, f"faithfulness regression on {case.id}"
        rel.measure(case)
        assert rel.score >= 0.7, f"relevancy regression on {case.id}"
```

Envoyez-le comme un dossier de Pytest, faites-le sur toutes les relations publiques.

### Étape 5: évaluation des jouets à partir de zéro

Regardez !`code/main.py`- Approximations de fidélité (souverture des demandes de réponse au contexte) et de pertinence (souverture des jetons de réponse aux jetons de question) à l'aide de l'exemple de la production.

## Les pièges

- **No calibration.**Un juge avec une corrélation de 0,3 avec les étiquettes humaines est bruyant.
- **Self-evaluation.**Utiliser le même LLM pour générer et juger gonfle les scores de 10 à 20%. Utilisez une famille de modèles différente pour le juge.
- **Positional bias in pairwise judging.**Les juges préfèrent la première option, toujours randomiser l'ordre et exécuter les deux.
- **Raw aggregate hides failures.**Le score moyen de 0,85 cache souvent 5% de défaillances catastrophiques.
- **Golden dataset rot.**Les ensembles d'évaluation non révisés qui dérivent dans le temps brisent la comparaison longitudinale.
- **LLM cost.**Le juge prévoit le prix, le modèle le moins cher qui respecte le seuil de calibration, le GPT-4o-mini, le Claude Haiku, le Mistral-small.

## Utilisez-le

La pile de 2026:

| Use case | Framework |
|---------|-----------|
| RAG quality monitoring | RAGAS (4 metrics) |
| CI/CD regression gates | DeepEval + pytest |
| Custom domain criteria | G-Eval within DeepEval |
| Online live-traffic monitoring | RAGAS with reference-free mode |
| Human-in-the-loop spot checks | LangSmith or Phoenix with annotation UI |
| Red-teaming / safety eval | Promptfoo + DeepEval |

La pile typique: RAGAS pour la surveillance, DeepEval pour l'indice de taille, G-Eval pour les nouvelles dimensions.

## La faire partir

- Je ne sais pas .`outputs/skill-eval-architect.md`- Le numéro de la liste:

```markdown
---
name: eval-architect
description: Design an LLM evaluation plan with calibrated judge and CI gates.
version: 1.0.0
phase: 5
lesson: 27
tags: [nlp, evaluation, rag]
---

Given a use case (RAG / agent / generative task), output:

1. Metrics. Faithfulness / relevance / context-precision / context-recall + any custom G-Eval metrics with criteria.
2. Judge model. Named model + version, rationale for cost vs accuracy.
3. Calibration. Hand-labeled set size, target Spearman rho vs human > 0.7.
4. Dataset versioning. Tag strategy, change log, stratification.
5. CI gate. Thresholds per metric, regression-window logic, bottom-quantile alert.

Refuse to rely on a judge untested against ≥50 human-labeled examples. Refuse self-evaluation (same model generates + judges). Refuse aggregate-only reporting without bottom-10% surfacing. Flag any pipeline where judge upgrade lands without parallel baseline eval.
```

## Exercices

1. **Easy.**Utilisez RAGAS sur 10 exemples RAG avec des hallucinations connues.
2. **Medium.**50 QA répond à 0-1 pour la précision, score avec G-Eval, mesure le rho de Spearman entre juge et humain.
3. **Hard.**Construisez une passerelle de données informatique avec DeepEval. Regressez intentionnellement le récupérateur. Vérifiez que la passerelle échoue. Ajoutez l'alerte du quantile inférieur via la vérification du seuil sur le 10% le plus bas.

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| LLM-as-judge | Scoring with an LLM | Prompt a judge model to score outputs 0-1 given a rubric. |
| RAGAS | The RAG metric library | Open-source eval framework with 4 reference-free RAG metrics. |
| Faithfulness | Is the answer grounded? | Fraction of answer claims entailed by retrieved context. |
| Context precision | Were retrieved chunks relevant? | Fraction of top-K chunks that actually mattered. |
| Context recall | Did retrieval find everything? | Fraction of gold-answer claims supported by retrieved chunks. |
| G-Eval | Custom LLM judge | Rubric + chain-of-thought eval steps + 0-1 score. |
| Calibration | Trust but verify | Spearman correlation between judge score and human score. |

## Pour en savoir plus

- [Es et al. (2023). RAGAS: Automated Evaluation of Retrieval Augmented Generation](https://arxiv.org/abs/2309.15217) le journal RAGAS.
- [Liu et al. (2023). G-Eval: NLG Evaluation using GPT-4 with Better Human Alignment](https://arxiv.org/abs/2303.16634) le papier G-Eval.
- [DeepEval docs](https://deepeval.com/docs/metrics-introduction) stack de production ouvert.
- [Zheng et al. (2023). Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena](https://arxiv.org/abs/2306.05685) préjugés, calibration, limites.
- [MLflow GenAI Scorer](https://mlflow.org/blog/third-party-scorers) un cadre unifiant intégrant RAGAS, DeepEval et Phoenix.
