# Text Summarization

> Extractive systems tell you what the document said. Abstractive systems tell you what the author meant. Different tasks, different pitfalls.

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 5 · 02 (BoW + TF-IDF), Phase 5 · 11 (Machine Translation)
**Time:** ~75 minutes

## The Problem

A 2,000-word news article lands in your feed. You need 120 words that capture it. You can either pick the three most important sentences from the article (extractive) or rewrite the content in your own words (abstractive). Both are called summarization. They are completely different problems.

Extractive summarization is a ranking problem. Score every sentence, return the top-`k`. The output is always grammatical because it is lifted verbatim. The risk is missing content that is distributed across the article.

Abstractive summarization is a generation problem. A transformer produces new text conditioned on the input. The output is fluent and compressive but may hallucinate facts that were not in the source. The risk is confident fabrication.

This lesson builds both, with the failure mode each one owns.

## The Concept

![Extractive TextRank vs abstractive transformer](../assets/summarization.svg)

**Extractive.** Treat the article as a graph where nodes are sentences and edges are similarities. Run PageRank (or something like it) over the graph to score sentences by how connected they are to everything else. Highest-scoring sentences are the summary. The canonical implementation is **TextRank** (Mihalcea and Tarau, 2004).

**Abstractive.** Fine-tune a transformer encoder-decoder (BART, T5, Pegasus) on document-summary pairs. At inference, the model reads the document and generates the summary token-by-token via cross-attention. Pegasus in particular uses a gap-sentence pretraining objective that makes it excellent at summarization without much fine-tuning.

Evaluation with **ROUGE** (Recall-Oriented Understudy for Gisting Evaluation). ROUGE-1 and ROUGE-2 score unigram and bigram overlap. ROUGE-L scores longest common subsequence. Higher is better but 40 ROUGE-L is "good" and 50 is "exceptional." Every paper reports all three. Use the `rouge-score` package.

## Build It

### Step 1: TextRank (extractive)

```python
import math
import re
from collections import Counter


def sentence_split(text):
    return re.split(r"(?<=[.!?])\s+", text.strip())


def similarity(s1, s2):
    w1 = Counter(s1.lower().split())
    w2 = Counter(s2.lower().split())
    intersection = sum((w1 & w2).values())
    denom = math.log(len(w1) + 1) + math.log(len(w2) + 1)
    if denom == 0:
        return 0.0
    return intersection / denom


def textrank(text, top_k=3, damping=0.85, iterations=50, epsilon=1e-4):
    sentences = sentence_split(text)
    n = len(sentences)
    if n <= top_k:
        return sentences

    sim = [[0.0] * n for _ in range(n)]
    for i in range(n):
        for j in range(n):
            if i != j:
                sim[i][j] = similarity(sentences[i], sentences[j])

    scores = [1.0] * n
    for _ in range(iterations):
        new_scores = [1 - damping] * n
        for i in range(n):
            total_out = sum(sim[i]) or 1e-9
            for j in range(n):
                if sim[i][j] > 0:
                    new_scores[j] += damping * sim[i][j] / total_out * scores[i]
        if max(abs(s - ns) for s, ns in zip(scores, new_scores)) < epsilon:
            scores = new_scores
            break
        scores = new_scores

    ranked = sorted(range(n), key=lambda k: scores[k], reverse=True)[:top_k]
    ranked.sort()
    return [sentences[i] for i in ranked]
```

Two things worth naming. The similarity function uses log-normalized word overlap, which is the original TextRank variant. Cosine of TF-IDF vectors works too. The damping factor 0.85 and iteration count are the PageRank defaults.

### Step 2: abstractive with BART

```python
from transformers import pipeline

summarizer = pipeline("summarization", model="facebook/bart-large-cnn")

article = """(long news article text)"""

summary = summarizer(article, max_length=120, min_length=60, do_sample=False)
print(summary[0]["summary_text"])
```

BART-large-CNN is fine-tuned on the CNN/DailyMail corpus. It produces news-style summaries out of the box. For other domains (scientific papers, dialog, legal), use the corresponding Pegasus checkpoint or fine-tune on your target data.

### Step 3: ROUGE evaluation

```python
from rouge_score import rouge_scorer

scorer = rouge_scorer.RougeScorer(["rouge1", "rouge2", "rougeL"], use_stemmer=True)
scores = scorer.score(reference_summary, generated_summary)
print({k: round(v.fmeasure, 3) for k, v in scores.items()})
```

Always use stemming. Without it, "running" and "run" count as different words and ROUGE undercounts.

### Beyond ROUGE (2026 summarization eval)

ROUGE has been the dominant summarization metric for twenty years and it is insufficient on its own in 2026. A large-scale meta-analysis of NLG papers showed:

- **BERTScore** (contextual embedding similarity) gained ground through 2023 and is now reported alongside ROUGE in most summarization papers.
- **BARTScore** treats evaluation as generation: score the summary by how likely a pretrained BART assigns it given the source.
- **MoverScore** (Earth Mover's Distance over contextual embeddings) reached the top spot in 2025 summarization benchmarks because it captures semantic overlap better than ROUGE.
- **FactCC** and **QA-based faithfulness** were common 2021-2023, now often replaced by **G-Eval** (a GPT-4 prompt chain that scores coherence, consistency, fluency, relevance with chain-of-thought reasoning).
- **G-Eval** and similar LLM-judge approaches match human judgment ~80% of the time when rubrics are well-designed.

Production recommendation: report ROUGE-L for legacy comparison, BERTScore for semantic overlap, G-Eval for coherence and factuality. Calibrate against 50-100 human-labeled summaries.

### Step 4: the factuality problem

Abstractive summaries are prone to hallucination. Extractive summaries carry a much lower hallucination risk because the output is lifted verbatim from the source, though they can still mislead if source sentences are decontextualized, outdated, or quoted out of order. This is the single biggest reason production systems still prefer extractive methods for compliance-adjacent content.

Hallucination types to name:

- **Entity swap.** Source says "John Smith." Summary says "John Brown."
- **Number drift.** Source says "25,000." Summary says "25 million."
- **Polarity flip.** Source says "rejected the offer." Summary says "accepted the offer."
- **Fact invention.** Source does not mention the CEO. Summary says the CEO approved.

Evaluation approaches that work:

- **FactCC.** A binary classifier trained on entailment between source sentence and summary sentence. Predicts factual/not-factual.
- **QA-based factuality.** Ask a QA model questions whose answers are in the source. If the summary supports different answers, flag.
- **Entity-level F1.** Compare named entities in source vs summary. Entities present only in the summary are suspect.

For anything user-facing where factuality matters (news, medical, legal, financial), extractive is the safer default. Abstractive needs a factuality check in the loop.

## Use It

The 2026 stack:

| Use case | Recommended |
|---------|-------------|
| News, 3-5 sentence summary, English | `facebook/bart-large-cnn` |
| Scientific papers | `google/pegasus-pubmed` or a tuned T5 |
| Multi-document, long-form | Any LLM with 32k+ context, prompted |
| Dialog summarization | `philschmid/bart-large-cnn-samsum` |
| Extractive, low hallucination risk by construction | TextRank or `sumy`'s LSA / LexRank |

LLMs with long context often beat specialized models in 2026 when compute is not a constraint. The tradeoff is cost and reproducibility; specialized models give more consistent outputs.

## Ship It

Save as `outputs/skill-summary-picker.md`:

```markdown
---
name: summary-picker
description: Pick extractive or abstractive, named library, factuality check.
version: 1.0.0
phase: 5
lesson: 12
tags: [nlp, summarization]
---

Given a task (document type, compliance requirement, length, compute budget), output:

1. Approach. Extractive or abstractive. Explain in one sentence why.
2. Starting model / library. Name it. `sumy.TextRankSummarizer`, `facebook/bart-large-cnn`, `google/pegasus-pubmed`, or an LLM prompt.
3. Evaluation plan. ROUGE-1, ROUGE-2, ROUGE-L (use rouge-score with stemming). Plus factuality check if abstractive.
4. One failure mode to probe. Entity swap is the most common in abstractive news summarization; flag samples where source entities do not appear in summary.

Refuse abstractive summarization for medical, legal, financial, or regulated content without a factuality gate. Flag input over the model's context window as needing chunked map-reduce summarization (not just truncation).
```

## Exercises

1. **Easy.** Run TextRank on 5 news articles. Compare the top-3 sentences to a reference summary. Measure ROUGE-L. You should see 30-45 ROUGE-L on CNN/DailyMail-style articles.
2. **Medium.** Implement entity-level factuality: extract named entities from source and summary (spaCy), compute recall of source entities in summary and precision of summary entities against source. High precision and low recall mean safe but terse; low precision means hallucinated entities.
3. **Hard.** Compare BART-large-CNN against an LLM (Claude or GPT-4) on 50 CNN/DailyMail articles. Report ROUGE-L, factuality (by entity F1), and cost per summary. Document where each wins.

## Key Terms

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Extractive | Pick sentences | Return sentences verbatim from the source. Never hallucinates. |
| Abstractive | Rewrite | Generate new text conditioned on source. Can hallucinate. |
| ROUGE | Summary metric | N-gram / LCS overlap between system output and reference. |
| TextRank | Graph-based extractive | PageRank over sentence similarity graph. |
| Factuality | Is it right | Whether summary claims are supported by the source. |
| Hallucination | Made-up content | Content in the summary that the source does not support. |

## Further Reading

- [Mihalcea and Tarau (2004). TextRank: Bringing Order into Texts](https://aclanthology.org/W04-3252/) — the extractive canonical paper.
- [Lewis et al. (2019). BART: Denoising Sequence-to-Sequence Pre-training](https://arxiv.org/abs/1910.13461) — the BART paper.
- [Zhang et al. (2019). PEGASUS: Pre-training with Extracted Gap-sentences](https://arxiv.org/abs/1912.08777) — Pegasus and the gap-sentence objective.
- [Lin (2004). ROUGE: A Package for Automatic Evaluation of Summaries](https://aclanthology.org/W04-1013/) — ROUGE paper.
- [Maynez et al. (2020). On Faithfulness and Factuality in Abstractive Summarization](https://arxiv.org/abs/2005.00661) — the factuality landscape paper.
