---
id: summarization-qa-nli
title: Summarization, QA, NLI and Multilingual NLP
code: SQ
subtitle: Summarize, answer, check entailment and transfer across languages. Models, metrics, defaults and failures.
hue: 285
sources: phases/05-nlp-foundations-to-advanced/12-text-summarization, phases/05-nlp-foundations-to-advanced/13-question-answering, phases/05-nlp-foundations-to-advanced/18-multilingual-nlp, phases/05-nlp-foundations-to-advanced/21-nli-textual-entailment
source_hash: 452c3d3b36b29868
---

## Grounded QA with an NLI gate
type: architecture
from: phases/05-nlp-foundations-to-advanced/13-question-answering/docs/en.md, phases/05-nlp-foundations-to-advanced/21-nli-textual-entailment/docs/en.md

```arch
node | q | 1,1 | Question | | client
node | retr | 2,1 | Retriever | top-k passages | process
node | read | 3,1 | Reader | span or LLM answer | model
node | nli | 4,1 | NLI check | context entails answer? | model
node | corpus | 2,2 | Corpus | BM25, dense or hybrid | store
node | out | 4,2 | Answer | or "I don't know" | client
edge | q | retr |
edge | corpus | retr | search
edge | retr | read | passages
edge | read | nli | answer
edge | nli | out | entailment
```

## Tasks in code
type: task-table
span: 2
from: phases/05-nlp-foundations-to-advanced/12-text-summarization/docs/en.md, phases/05-nlp-foundations-to-advanced/13-question-answering/docs/en.md, phases/05-nlp-foundations-to-advanced/13-question-answering/code/main.py, phases/05-nlp-foundations-to-advanced/21-nli-textual-entailment/docs/en.md

| Task | Code |
|---|---|
| Extractive summary | `textrank(text, top_k=3, damping=0.85, iterations=50, epsilon=1e-4)` |
| Abstractive summary | `pipeline("summarization", model="facebook/bart-large-cnn")` |
| Generate the summary | `summarizer(article, max_length=120, min_length=60, do_sample=False)` |
| ROUGE with stemming | `rouge_scorer.RougeScorer(["rouge1", "rouge2", "rougeL"], use_stemmer=True)` |
| Extractive QA | `pipeline("question-answering", model="deepset/roberta-base-squad2")` |
| Allow an empty answer | pass `handle_impossible_answer=True` to the pipeline call |
| SQuAD metrics | `exact_match(pred, gold)` and `token_f1(pred, gold)` |
| Zero-shot topic labels | `zs(text, candidate_labels=labels)` |

## SQuAD normalization
type: annotated-code
lang: python
from: phases/05-nlp-foundations-to-advanced/13-question-answering/code/main.py

```python
def normalize(text):
    text = text.lower()
    text = re.sub(r"\b(a|an|the)\b", " ", text)  # remove articles
    text = re.sub(r"[^\w\s]", " ", text)         # remove punctuation
    return " ".join(text.split())

exact_match("June 29th, 2007", "June 29, 2007")  # 0.0
token_f1("June 29th, 2007", "June 29, 2007")     # 0.67
token_f1("29 June 2007", "June 29, 2007")        # 1.00, EM is 0
refusal_from_score(top_retrieval_score, threshold=0.3)  # True means refuse
```

## TextRank, step by step
type: flow
from: phases/05-nlp-foundations-to-advanced/12-text-summarization/code/main.py, phases/05-nlp-foundations-to-advanced/12-text-summarization/docs/en.md

1. **Split**: `sentence_split` cuts after `.`, `!` or `?`. Few sentences: return all.
2. **Graph**: `similarity` is word overlap over the log of both lengths.
3. **Iterate**: each score is `1 - damping` plus damped neighbour scores.
4. **Stop**: change below `epsilon`, or `iterations` passes.
5. **Output**: top `top_k` sentences, in document order.

## Metrics
type: concepts
from: phases/05-nlp-foundations-to-advanced/12-text-summarization/docs/en.md, phases/05-nlp-foundations-to-advanced/13-question-answering/docs/en.md, phases/05-nlp-foundations-to-advanced/13-question-answering/code/main.py

- **ROUGE-1, ROUGE-2**: unigram and bigram overlap with the reference.
- **ROUGE-L**: longest common subsequence. 40 is good. 50 is exceptional.
- **EM**: exact match after normalization. Else the score is 0.
- **Token F1**: $F_1 = \frac{2PR}{P + R}$ over token overlap. It gives partial credit.
- **BERTScore**: contextual embedding similarity. Report it next to ROUGE.
- **G-Eval**: LLM judge with chain-of-thought. Matches humans ~80% of the time.
- **Entity-level F1**: entities that occur only in the summary are suspect.
- **RAGAS**: faithfulness, answer relevance, context precision, context recall.

## Questions
type: qa
from: phases/05-nlp-foundations-to-advanced/12-text-summarization/docs/en.md, phases/05-nlp-foundations-to-advanced/13-question-answering/docs/en.md, phases/05-nlp-foundations-to-advanced/18-multilingual-nlp/docs/en.md, phases/05-nlp-foundations-to-advanced/21-nli-textual-entailment/docs/en.md

- **Extractive or abstractive?** Extractive for news, medical, legal and financial text. Abstractive needs a factuality check.
- **How does zero-shot classification work?** Each label becomes a hypothesis. Pick the label with the highest entailment.
- **Which source language for transfer?** Try a close high-resource relative first. Hindi for Indic targets.
- **Why per-language accuracy?** The aggregate hides the long tail.
- **Does RAGAS need gold answers?** No. It scores four dimensions without references.

## Tips
type: tips
from: phases/05-nlp-foundations-to-advanced/12-text-summarization/docs/en.md, phases/05-nlp-foundations-to-advanced/13-question-answering/docs/en.md, phases/05-nlp-foundations-to-advanced/21-nli-textual-entailment/docs/en.md

- Always use stemming in ROUGE. Else "running" and "run" do not match.
- Report ROUGE-L, BERTScore and G-Eval. Calibrate on 50-100 human-labeled summaries.
- Tell the model to use only the context and to say "I don't know."
- Always check the `score` field of the QA pipeline.
- Run a 100-example labeled sanity check before you ship zero-shot classification.
- For input over the context window, use chunked map-reduce, not truncation.

## NLI and faithfulness
type: annotated-code
lang: python
from: phases/05-nlp-foundations-to-advanced/21-nli-textual-entailment/docs/en.md

```python
nli = pipeline("text-classification",
               model="facebook/bart-large-mnli",
               top_k=None)                       # return all three labels
result = nli({"text": premise, "text_pair": hypothesis})[0]
zs = pipeline("zero-shot-classification", model="facebook/bart-large-mnli")
result = zs(text, candidate_labels=labels)       # labels sorted by score

def is_faithful(answer, context, threshold=0.5):
    result = nli({"text": context, "text_pair": answer})[0]
    entail = next(s for s in result if s["label"] == "entailment")
    return entail["score"] > threshold           # context supports the claim
```

## Troubleshooting
type: troubleshooting
from: phases/05-nlp-foundations-to-advanced/12-text-summarization/docs/en.md, phases/05-nlp-foundations-to-advanced/13-question-answering/docs/en.md, phases/05-nlp-foundations-to-advanced/18-multilingual-nlp/docs/en.md, phases/05-nlp-foundations-to-advanced/21-nli-textual-entailment/docs/en.md

| Symptom | Cause | Fix |
|---|---|---|
| Summary says "John Brown" | Entity swap in abstractive output | Flag entities not in the source |
| "25,000" becomes "25 million" | Number drift | Use extractive or a factuality gate |
| Span returned for an unanswerable question | Null score ignored by default | Set `handle_impossible_answer=True` |
| Reader looks bad | Retriever missed the passage | Measure retrieval recall in top-`k` |
| ~60% from the hypothesis alone | "not", "never" leak the label | Hypothesis-only baseline, ANLI |
| 20+ F1 drop on long premises | Sentence-level NLI model | Use a DocNLI-trained model |
| Zero-shot swings 10+ points | Template sensitivity | Tune `hypothesis_template` |
| Hindi output subtly wrong | 3-5x tokens per word | Check fertility, `byte_fallback=True` |

## Defaults and numbers
type: defaults
from: phases/05-nlp-foundations-to-advanced/12-text-summarization/docs/en.md, phases/05-nlp-foundations-to-advanced/13-question-answering/code/main.py, phases/05-nlp-foundations-to-advanced/18-multilingual-nlp/docs/en.md, phases/05-nlp-foundations-to-advanced/21-nli-textual-entailment/docs/en.md

| Setting | Default | Note |
|---|---|---|
| TextRank `damping` | 0.85 | PageRank default |
| TextRank `iterations` | 50 | Stops early below `epsilon` 1e-4 |
| BART `max_length` | 120 | With `min_length=60` |
| Refusal `threshold` | 0.3 | Top retrieval score below it: refuse |
| `is_faithful` threshold | 0.5 | Entailment score must be above it |
| Few-shot examples | 100-500 | Target language. 95-98% of English |
| `learning_rate` | 2e-5 | Higher rates collapse the alignment |
| `num_train_epochs` | 5 | Safe for 100-500 examples |

## Abbreviations
type: glossary
from: phases/05-nlp-foundations-to-advanced/12-text-summarization/docs/en.md, phases/05-nlp-foundations-to-advanced/13-question-answering/docs/en.md, phases/05-nlp-foundations-to-advanced/18-multilingual-nlp/docs/en.md, phases/05-nlp-foundations-to-advanced/21-nli-textual-entailment/docs/en.md

- **ROUGE**: Recall-Oriented Understudy for Gisting Evaluation. N-gram and LCS overlap.
- **SQuAD**: Stanford Question Answering Dataset. EM and F1 metrics.
- **NLI**: Natural Language Inference. Entailment, contradiction or neutral.
- **RTE**: Recognizing Textual Entailment. The older name for NLI.
- **MultiNLI**: 433k pairs across 10 genres. The standard NLI training corpus.
- **ANLI**: Adversarial NLI. Humans wrote pairs to break models.
- **XLM-R**: 100-language RoBERTa on CommonCrawl. Base 270M, Large 550M.
- **NLLB**: No Language Left Behind. 200 languages, 55 low-resource.

## Pick a model
type: command-table
from: phases/05-nlp-foundations-to-advanced/12-text-summarization/docs/en.md, phases/05-nlp-foundations-to-advanced/13-question-answering/docs/en.md, phases/05-nlp-foundations-to-advanced/18-multilingual-nlp/docs/en.md, phases/05-nlp-foundations-to-advanced/21-nli-textual-entailment/docs/en.md

| Command | What it does |
|---|---|
| `facebook/bart-large-cnn` | News summary of 3 to 5 sentences, English |
| `google/pegasus-pubmed` | Summaries of scientific papers |
| `philschmid/bart-large-cnn-samsum` | Dialog summaries |
| `deepset/roberta-base-squad2` | Answer span from a given passage |
| `facebook/bart-large-mnli` | Lightweight zero-shot classification |
| `cross-encoder/nli-deberta-v3-base` | Fast NLI for the edge |
| `joeddav/xlm-roberta-large-xnli` | Zero-shot classification in many languages |
| `facebook/nllb-200-distilled-600M` | Translation, 200 languages |
