# LLM Evaluation — RAGAS, DeepEval, G-Eval

> Exact-match and F1 miss semantic equivalence. Human review does not scale. LLM-as-judge is the production answer — with enough calibration to trust the number.

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 5 · 13 (Question Answering), Phase 5 · 14 (Information Retrieval)
**Time:** ~75 minutes

## The Problem

Your RAG system answers: "June 29th, 2007."
The gold reference is: "June 29, 2007."
Exact Match scores 0. F1 scores ~75%. A human would score 100%.

Now multiply by 10,000 test cases. Multiply again by every change to the retriever, chunking, prompt, or model. You need an evaluator that understands meaning, runs cheaply at scale, does not lie about regressions, and surfaces the right failure modes.

2026 has three frameworks that own this problem.

- **RAGAS.** Retrieval-Augmented Generation ASsessment. Four RAG metrics (faithfulness, answer-relevance, context-precision, context-recall) with NLI + LLM-judge backends. Research-backed, lightweight.
- **DeepEval.** Pytest for LLMs. G-Eval, task-completion, hallucination, bias metrics. CI/CD-native.
- **G-Eval.** A method (and a DeepEval metric): LLM-as-judge with chain-of-thought, custom criteria, 0-1 score.

All three lean on LLM-as-judge. This lesson builds intuition for the method and the trust layer around it.

## The Concept

![Four evaluation dimensions, LLM-as-judge architecture](../assets/llm-evaluation.svg)

**LLM-as-judge.** Replace a static metric with an LLM that scores outputs given a rubric. Given `(query, context, answer)`, prompt a judge LLM: "Score 0-1 on faithfulness." Return the score.

Why it works: LLMs approximate human judgment at a tiny fraction of the cost. GPT-4o-mini at ~$0.003 per scored case enables 1000-sample regression eval runs for under $5.

Why it fails silently:

1. **Judge bias.** Judges prefer longer answers, answers from their own model family, answers that match the prompt style.
2. **JSON parsing failures.** Bad JSON → NaN score → silently excluded from the aggregate. RAGAS users know this pain. Gate with try/except + explicit failure mode.
3. **Drift over model versions.** Upgrading the judge changes every metric. Freeze judge model + version.

**The RAG four.**

| Metric | Question | Backend |
|--------|----------|---------|
| Faithfulness | Does each claim in the answer come from the retrieved context? | NLI-based entailment |
| Answer relevance | Does the answer address the question? | Generate hypothetical questions from answer; compare to real question |
| Context precision | Of retrieved chunks, what fraction were relevant? | LLM-judge |
| Context recall | Did retrieval return everything needed? | LLM-judge against gold answer |

**G-Eval.** Define a custom criterion: "Did the answer cite the correct source?" The framework auto-expands into chain-of-thought evaluation steps, then scores 0-1. Good for domain-specific quality dimensions RAGAS does not cover.

**Calibration.** Never trust the raw judge score until you have a correlation against human labels. Run 100 hand-labeled examples. Plot judge vs human. Compute Spearman rho. If rho < 0.7, your judge rubric needs work.

## Build It

### Step 1: faithfulness with NLI (RAGAS-style)

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

Decompose the answer into atomic claims. NLI-check each claim against the retrieved context. Faithfulness = fraction supported.

### Step 2: answer relevance

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

If the answer implies different questions than the one asked, relevance drops.

### Step 3: G-Eval custom metric

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

The evaluation steps are the rubric. Explicit steps are more stable than implicit "score 0-1" prompts.

### Step 4: CI gate

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

Ship as a pytest file. Run on every PR. Block merges on regressions.

### Step 5: toy eval from scratch

See `code/main.py`. Stdlib-only approximations of faithfulness (overlap of answer claims with context) and relevance (overlap of answer tokens with question tokens). Not production. Shows the shape.

## Pitfalls

- **No calibration.** A judge with 0.3 correlation to human labels is noise. Require a calibration run before shipping.
- **Self-evaluation.** Using the same LLM to generate and judge inflates scores by 10-20%. Use a different model family for the judge.
- **Positional bias in pairwise judging.** Judges prefer the first option presented. Always randomize order and run both.
- **Raw aggregate hides failures.** Mean score 0.85 often hides 5% catastrophic failures. Always inspect the bottom quantile.
- **Golden dataset rot.** Unversioned eval sets that drift over time break longitudinal comparison. Tag the dataset with every change.
- **LLM cost.** At scale, judge calls dominate cost. Use the cheapest model that meets calibration threshold. GPT-4o-mini, Claude Haiku, Mistral-small.

## Use It

The 2026 stack:

| Use case | Framework |
|---------|-----------|
| RAG quality monitoring | RAGAS (4 metrics) |
| CI/CD regression gates | DeepEval + pytest |
| Custom domain criteria | G-Eval within DeepEval |
| Online live-traffic monitoring | RAGAS with reference-free mode |
| Human-in-the-loop spot checks | LangSmith or Phoenix with annotation UI |
| Red-teaming / safety eval | Promptfoo + DeepEval |

Typical stack: RAGAS for monitoring, DeepEval for CI, G-Eval for novel dimensions. Run all three; they disagree usefully.

## Ship It

Save as `outputs/skill-eval-architect.md`:

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

## Exercises

1. **Easy.** Use RAGAS on 10 RAG examples with known hallucinations. Verify the faithfulness metric catches each one.
2. **Medium.** Hand-label 50 QA answers 0-1 for correctness. Score with G-Eval. Measure Spearman rho between judge and human.
3. **Hard.** Build a pytest CI gate with DeepEval. Intentionally regress the retriever. Verify the gate fails. Add bottom-quantile alerting via threshold check on the lowest 10%.

## Key Terms

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| LLM-as-judge | Scoring with an LLM | Prompt a judge model to score outputs 0-1 given a rubric. |
| RAGAS | The RAG metric library | Open-source eval framework with 4 reference-free RAG metrics. |
| Faithfulness | Is the answer grounded? | Fraction of answer claims entailed by retrieved context. |
| Context precision | Were retrieved chunks relevant? | Fraction of top-K chunks that actually mattered. |
| Context recall | Did retrieval find everything? | Fraction of gold-answer claims supported by retrieved chunks. |
| G-Eval | Custom LLM judge | Rubric + chain-of-thought eval steps + 0-1 score. |
| Calibration | Trust but verify | Spearman correlation between judge score and human score. |

## Further Reading

- [Es et al. (2023). RAGAS: Automated Evaluation of Retrieval Augmented Generation](https://arxiv.org/abs/2309.15217) — the RAGAS paper.
- [Liu et al. (2023). G-Eval: NLG Evaluation using GPT-4 with Better Human Alignment](https://arxiv.org/abs/2303.16634) — the G-Eval paper.
- [DeepEval docs](https://deepeval.com/docs/metrics-introduction) — open production stack.
- [Zheng et al. (2023). Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena](https://arxiv.org/abs/2306.05685) — biases, calibration, limits.
- [MLflow GenAI Scorer](https://mlflow.org/blog/third-party-scorers) — unifying framework that integrates RAGAS, DeepEval, Phoenix.
