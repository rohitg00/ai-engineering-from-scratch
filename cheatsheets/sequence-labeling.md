---
id: sequence-labeling
title: NER, POS Tagging and Coreference
code: NP
subtitle: BIO tags, CRF and HMM taggers, Viterbi, dependency parses, coreference clusters and entity linking to a KB.
hue: 160
sources: phases/05-nlp-foundations-to-advanced/06-named-entity-recognition, phases/05-nlp-foundations-to-advanced/07-pos-tagging-parsing, phases/05-nlp-foundations-to-advanced/24-coreference-resolution, phases/05-nlp-foundations-to-advanced/25-entity-linking
source_hash: 7dc1ba47e8b7fdac
---

## Extraction pipeline
type: architecture
from: phases/05-nlp-foundations-to-advanced/24-coreference-resolution/docs/en.md, phases/05-nlp-foundations-to-advanced/25-entity-linking/docs/en.md, phases/05-nlp-foundations-to-advanced/06-named-entity-recognition/docs/en.md

```arch
node | text | 1,1 | Document | | client
node | ner | 2,1 | NER | BIO token labels to spans | model
node | coref | 3,1 | Coref | mention clusters | model
node | cand | 3,2 | Candidate generation | alias index, 10-30 per mention | store
node | dis | 2,2 | Disambiguation | prior + context or embeddings | process
node | kb | 1,2 | KB id per entity | or NIL | store
edge | text | ner | tokens
edge | ner | coref | mentions
edge | coref | cand | each mention
edge | cand | dis | candidates
edge | dis | kb | top-1
```

## Core ideas
type: concepts
from: phases/05-nlp-foundations-to-advanced/06-named-entity-recognition/docs/en.md, phases/05-nlp-foundations-to-advanced/07-pos-tagging-parsing/docs/en.md, phases/05-nlp-foundations-to-advanced/24-coreference-resolution/docs/en.md, phases/05-nlp-foundations-to-advanced/25-entity-linking/docs/en.md

- **BIO**: `B-X` begins, `I-X` continues, `O` is outside. `New B-GPE`, `York I-GPE`.
- **BILOU**: adds `L-X` (last) and `U-X` (unit) for cleaner boundaries.
- **HMM**: $P = \prod_i P(t_i \mid t_{i-1}) \, P(w_i \mid t_i)$. Transition times emission.
- **CRF**: discriminative. Mixes word shape, case and neighbor features. Enforces valid tag sequences.
- **Viterbi**: dynamic programming for the best tag sequence over the tag lattice.
- **Dependency parse**: each word has one head and a relation label.
- **Mention types**: named entity, nominal, pronominal, appositive.
- **Prior + context**: `P(entity | mention) × context-similarity(entity, text)`.

## Rule-based pronoun resolver
type: flow
from: phases/05-nlp-foundations-to-advanced/24-coreference-resolution/docs/en.md, phases/05-nlp-foundations-to-advanced/24-coreference-resolution/code/main.py

1. **extract_mentions**: capitalized spans, pronouns by lookup, definite "the X" phrases.
2. **resolve**: for each pronoun, take the earlier named and nominal mentions.
3. **agreement_score**: +1 for number match. Gender clash costs 2.
4. **recency_score**: closer candidates score higher.
5. **resolve**: link the candidate with the highest sum.
6. **clusters**: union-find over the links gives one cluster per entity.

## Tasks in code
type: task-table
span: 2
from: phases/05-nlp-foundations-to-advanced/06-named-entity-recognition/code/main.py, phases/05-nlp-foundations-to-advanced/07-pos-tagging-parsing/code/main.py, phases/05-nlp-foundations-to-advanced/25-entity-linking/code/main.py

| Task | Code |
|---|---|
| Spans to BIO labels | `spans_to_bio(tokens, spans)` |
| BIO labels back to spans | `bio_to_spans(tokens, labels)` |
| Capitalization shape | `word_shape(word)` |
| Gazetteer baseline | `rule_based_ner(tokens)` |
| Most-frequent-tag baseline | `predict_mft(tokens, word_best, default_tag)` |
| Train the bigram HMM | `train_hmm(examples, alpha=0.01)` |
| Decode tags | `viterbi(tokens, transitions, emissions, tags, vocab, alpha=0.01)` |
| Link a mention | `disambiguate(mention, context, use_prior=True)` |

## CRF and transformer NER
type: annotated-code
lang: python
from: phases/05-nlp-foundations-to-advanced/06-named-entity-recognition/docs/en.md

```python
crf = sklearn_crfsuite.CRF(algorithm="lbfgs",
    c1=0.1, c2=0.1,                   # L1 and L2 regularization
    max_iterations=100,
    all_possible_transitions=True)    # learns I-ORG after O is unlikely
X_train = [to_features(s) for s in sentences_tokenized]
crf.fit(X_train, bio_labels_train)    # ~84 F1 on CoNLL-2003
ner = pipeline("ner", model="dslim/bert-base-NER",
               aggregation_strategy="simple")  # merges B-X, I-X into spans
print(ner("Apple sued Google over its iPhone in the US."))
```

## spaCy: tags, parse, entities, clusters
type: annotated-code
lang: python
from: phases/05-nlp-foundations-to-advanced/07-pos-tagging-parsing/docs/en.md, phases/05-nlp-foundations-to-advanced/06-named-entity-recognition/docs/en.md, phases/05-nlp-foundations-to-advanced/24-coreference-resolution/docs/en.md

```python
nlp = spacy.load("en_core_web_sm")
doc = nlp("The cats were running at 3pm.")
for token in doc:
    print(token.tag_, token.pos_, token.dep_, token.head.text)  # Penn, UD, relation
for ent in doc.ents:
    print(f"{ent.text:20s} {ent.label_}")   # iPhone comes out ORG in sm
nlp = spacy.load("en_coreference_web_trf")   # experimental model
doc = nlp("<text>")                          # rerun with the coref model
for cluster in doc._.coref_clusters:
    print(cluster, "->", [m.text for m in cluster])
```

## Numbers to expect
type: defaults
from: phases/05-nlp-foundations-to-advanced/07-pos-tagging-parsing/docs/en.md, phases/05-nlp-foundations-to-advanced/24-coreference-resolution/docs/en.md, phases/05-nlp-foundations-to-advanced/25-entity-linking/docs/en.md, phases/05-nlp-foundations-to-advanced/06-named-entity-recognition/docs/en.md

| Setting | Default | Note |
|---|---|---|
| Most-frequent-tag on Brown | ~85% | The floor for any tagger |
| Bigram HMM on Brown | ~93% | Gain comes from transitions |
| CRF with features | ~97% | BiLSTM-CRF or transformer ~98%+ |
| Annotator agreement, PTB | 97% | Past 98% is likely overfitting |
| Tagsets | 36 | PTB has 36 tags. UD has 17 |
| Coref SOTA, CoNLL-2012 | ~83 F1 | Mean of MUC, B³, CEAF |
| Candidates per mention | 10-30 | From the alias index |
| Classical NER latency | 50ms | Under it, classical NER wins |

## Troubleshooting
type: troubleshooting
from: phases/05-nlp-foundations-to-advanced/06-named-entity-recognition/docs/en.md, phases/05-nlp-foundations-to-advanced/24-coreference-resolution/docs/en.md, phases/05-nlp-foundations-to-advanced/25-entity-linking/docs/en.md, phases/05-nlp-foundations-to-advanced/07-pos-tagging-parsing/docs/en.md

| Symptom | Cause | Fix |
|---|---|---|
| CoNLL model fails on contracts | Domain shift | Fine-tune on your domain |
| ORG and FACILITY overlap | BIO cannot nest spans | Span-based or multi-pass NER |
| Long entity split in two | Token-level labels | `aggregation_strategy` or post-process |
| F1 looks too high | Token-level F1 | Entity-level F1 with `seqeval` |
| Every mention its own cluster | Singleton explosion | Check MUC, B³ and CEAF together |
| Coref drops on long docs | ~15 F1 loss over 2,000 tokens | Sliding window plus merge |
| Wrong famous entity picked | Popularity bias | Domain fine-tune, check NIL |
| EL recall drops | NER cut the span short | Fix mention boundaries upstream |

## Use X when
type: qa
from: phases/05-nlp-foundations-to-advanced/06-named-entity-recognition/docs/en.md, phases/05-nlp-foundations-to-advanced/07-pos-tagging-parsing/docs/en.md, phases/05-nlp-foundations-to-advanced/24-coreference-resolution/docs/en.md, phases/05-nlp-foundations-to-advanced/25-entity-linking/docs/en.md

- **Classical NER or an LLM?** Classical under 50ms, at 98%+ F1, or on-prem. Else start with an LLM zero-shot baseline.
- **PTB or UD?** PTB for English-only legacy pipelines. UD for multilingual work.
- **Which parser?** spaCy for most production, stanza for multilingual, trankit for top UD accuracy.
- **Which EL method?** BLINK or REL for English Wikipedia. Exact-match prior for the lowest latency.
- **LLM coref?** Easy cases only. It over-merges and drops mentions in long docs.

## Abbreviations
type: glossary
from: phases/05-nlp-foundations-to-advanced/06-named-entity-recognition/docs/en.md, phases/05-nlp-foundations-to-advanced/07-pos-tagging-parsing/docs/en.md, phases/05-nlp-foundations-to-advanced/24-coreference-resolution/docs/en.md, phases/05-nlp-foundations-to-advanced/25-entity-linking/docs/en.md

- **NER**: named entity recognition. Label token spans with types.
- **CRF**: Conditional Random Field. Models label transitions.
- **PTB / UD**: Penn Treebank and Universal Dependencies tagsets.
- **EL**: entity linking. Map a mention to one KB entry.
- **NIL**: no KB entry matches the mention.
- **CoNLL F1**: mean of MUC, B³ and CEAF-φ4 F1.
- **Cataphora**: the pronoun comes before its referent.

## Tips
type: tips
from: phases/05-nlp-foundations-to-advanced/25-entity-linking/docs/en.md, phases/05-nlp-foundations-to-advanced/24-coreference-resolution/docs/en.md, phases/05-nlp-foundations-to-advanced/07-pos-tagging-parsing/docs/en.md

- Report mention recall and disambiguation accuracy. 99% on 80% recall is an 80% pipeline.
- Merge coref clusters into NER entities. Emit one KB id per entity, not per mention.
- Constrain LLM entity linking to valid KB ids.
- Test noun-verb ambiguity (`saw`, `book`, `can`) on 20 sampled outputs.
