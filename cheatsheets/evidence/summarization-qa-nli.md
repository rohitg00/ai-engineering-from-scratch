# Evidence: cheatsheets/summarization-qa-nli.md

Abbreviations: P05 = phases/05-nlp-foundations-to-advanced. S = P05/12-text-summarization, Q = P05/13-question-answering, M = P05/18-multilingual-nlp, N = P05/21-nli-textual-entailment. d = docs/en.md, c = code/main.py.

## Grounded QA with an NLI gate (architecture, 6 nodes, 5 edges)
- Question: Q/d:28
- Retriever, top-k passages: Q/d:28
- Reader extractive span or generative LLM: Q/d:26-30, 167
- NLI check, context entails answer, not entailment = fabrication: N/d:21, 92-101
- Corpus searched with BM25, dense or hybrid: Q/d:145, 168
- Answer or "I don't know": Q/d:106, 121

## TextRank, step by step (flow, 5 steps)
1. sentence_split on `.`, `!`, `?`, return all when n <= top_k: S/c:6-7, 22-24
2. similarity = overlap / (log(len1+1) + log(len2+1)): S/c:10-17
3. new_scores start at 1 - damping plus damped weighted neighbour scores: S/c:33-39
4. stop below epsilon or after iterations: S/c:20, 33, 40-42
5. top_k by score, sorted back to document order: S/c:45-47

## Tasks in code (task-table, 8 rows)
- textrank(text, top_k=3, damping=0.85, iterations=50, epsilon=1e-4): S/d:58
- pipeline("summarization", model="facebook/bart-large-cnn"): S/d:95
- summarizer(article, max_length=120, min_length=60, do_sample=False): S/d:99
- rouge_scorer.RougeScorer(["rouge1", "rouge2", "rougeL"], use_stemmer=True): S/d:110
- pipeline("question-answering", model="deepset/roberta-base-squad2"): Q/d:43
- handle_impossible_answer=True passed to the pipeline call: Q/d:59
- exact_match(pred, gold), token_f1(pred, gold): Q/c:16, 20
- zs(text, candidate_labels=labels): N/d:84

## NLI and faithfulness (annotated-code, 10 lines)
- nli pipeline text-classification, facebook/bart-large-mnli, top_k=None returns all labels: N/d:60-62
- nli({"text": premise, "text_pair": hypothesis})[0]: N/d:67
- zero-shot-classification pipeline: N/d:79
- zs call, labels sorted by score in the output: N/d:84-87
- is_faithful body: N/d:95-98

## SQuAD normalization (annotated-code, 9 lines)
- normalize body, articles and punctuation removed: Q/c:9-13
- exact_match("June 29th, 2007", "June 29, 2007") gives 0, token_f1 gives 0.67: cases at Q/c:67, output of `python3 code/main.py`; Q/d:115
- "29 June 2007" gives EM 0, F1 1.00: case at Q/c:68, output of `python3 code/main.py`
- refusal_from_score(top_retrieval_score, threshold=0.3): Q/c:34-35

## Metrics (concepts, 8 bullets)
- ROUGE-1, ROUGE-2 unigram and bigram overlap: S/d:28
- ROUGE-L longest common subsequence, 40 good, 50 exceptional: S/d:28
- EM strict match after normalization, else 0: Q/d:115
- Token F1 partial credit, 2PR/(P+R): Q/d:115, Q/c:29-31
- BERTScore contextual embedding similarity, reported next to ROUGE: S/d:121, 127
- G-Eval chain-of-thought LLM judge, ~80% match with humans: S/d:124-125
- Entity-level F1, summary-only entities are suspect: S/d:144
- RAGAS four dimensions: Q/d:126-131

## Questions (qa, 5 bullets)
- Extractive safer for news, medical, legal, financial. Abstractive needs factuality check: S/d:146
- Zero-shot via NLI, label as hypothesis, pick max entailment: N/d:47
- Source language: close high-resource relative first, Hindi for Indic: M/d:48-50
- Per-language accuracy, aggregate hides the long tail: M/d:143
- RAGAS reference-free, four dimensions without gold references: Q/d:126, 133

## Tips (tips, 6 bullets)
- Always use stemming, "running" vs "run": S/d:115
- Report ROUGE-L, BERTScore, G-Eval, calibrate on 50-100 human-labeled summaries: S/d:127
- Use only the context, say "I don't know.": Q/d:106, 111
- Always check the score field: Q/d:59
- 100-example labeled sanity check before zero-shot: N/d:151
- Chunked map-reduce, not truncation: S/d:183

## Troubleshooting (troubleshooting, 8 rows)
- Entity swap "John Smith" / "John Brown", entity check: S/d:135, 144
- Number drift "25,000" / "25 million", extractive or factuality check: S/d:136, 146
- Pipeline returns a span when null wins, set handle_impossible_answer=True: Q/d:59
- Reader cannot fix a missing passage, measure retrieval recall: Q/d:122
- Hypothesis-only ~60% from "not", "nobody", "never", adversarial ANLI: N/d:109-110, 42
- Single-sentence NLI drops 20+ F1 on documents, use DocNLI-trained: N/d:111
- Template swing 10+ points, hypothesis_template: N/d:90, 112
- Hindi 3-5x tokens, subtly wrong output, fertility check, byte_fallback=True: M/d:167, 171, 173

## Defaults and numbers (defaults, 8 rows)
- damping 0.85, PageRank default: S/d:88, S/c:20
- iterations 50, epsilon 1e-4 early stop: S/c:20, 40
- max_length 120 with min_length=60: S/d:99
- refusal threshold 0.3: Q/c:34, Q/d:178
- is_faithful threshold 0.5: N/d:95, 98
- few-shot 100-500 examples, 95-98% of English baseline: M/d:28
- learning_rate 2e-5, higher collapses alignment: M/d:131, 139
- num_train_epochs 5 for 100-500 examples: M/d:130, 139

## Abbreviations (glossary, 8 bullets)
- ROUGE expansion, n-gram / LCS overlap: S/d:28, 198
- SQuAD Stanford Question Answering Dataset, EM + F1: Q/d:188
- NLI three-way classification: N/d:18, 164
- RTE older name for NLI: N/d:165
- MultiNLI 433k pairs, 10 genres, standard training corpus: N/d:41
- ANLI adversarial, humans wrote examples to break models: N/d:42
- XLM-R 100 languages, RoBERTa, CommonCrawl, Base 270M, Large 550M: M/d:35, 214
- NLLB No Language Left Behind, 200 languages, 55 low-resource: M/d:38, 215

## Pick a model (command-table, 8 rows)
- facebook/bart-large-cnn news 3-5 sentences English: S/d:154
- google/pegasus-pubmed scientific papers: S/d:155
- philschmid/bart-large-cnn-samsum dialog: S/d:157
- deepset/roberta-base-squad2 span from given passage: Q/d:143
- facebook/bart-large-mnli lightweight zero-shot: N/d:123
- cross-encoder/nli-deberta-v3-base fast / edge: N/d:122
- joeddav/xlm-roberta-large-xnli zero-shot classification: M/d:155, 85
- facebook/nllb-200-distilled-600M translation 200 languages: M/d:157
