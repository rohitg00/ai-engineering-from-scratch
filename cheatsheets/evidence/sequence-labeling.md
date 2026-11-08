# Evidence: cheatsheets/sequence-labeling.md

Abbreviations: N06 = phases/05-nlp-foundations-to-advanced/06-named-entity-recognition, N07 = phases/05-nlp-foundations-to-advanced/07-pos-tagging-parsing, N24 = phases/05-nlp-foundations-to-advanced/24-coreference-resolution, N25 = phases/05-nlp-foundations-to-advanced/25-entity-linking. d = docs/en.md, c = code/main.py.

## Extraction pipeline (architecture, 6 nodes, 5 edges)
- Order NER, coref, EL on each mention, one KB id per entity: N25/d:141, N24/d:122
- NER with BIO token labels to spans: N06/d:20, 37
- Coref outputs mention clusters: N24/d:27
- Candidate generation from an alias index, 10-30 candidates: N25/d:22, 31
- Disambiguation by prior + context or embeddings: N25/d:35-36
- NIL prediction: N25/d:122, 182

## Core ideas (concepts, 8)
- BIO and New B-GPE, York I-GPE: N06/d:20, 37, 310
- BILOU adds L-X and U-X: N06/d:311
- HMM product of transition and emission: N07/d:84, 87
- CRF discriminative, arbitrary features, valid sequences: N06/d:43, 312
- Viterbi over the tag lattice: N07/d:87, 247
- Dependency parse, one head, labeled relation: N07/d:31, 246
- Mention types named entity, nominal, pronominal, appositive: N24/d:29-34
- P(entity | mention) × context-similarity(entity, text): N25/d:35

## Rule-based pronoun resolver (flow, 6 steps)
1. extract_mentions, capitalized spans, pronouns, "the X": N24/d:77, N24/c:27
2. resolve, earlier ne and nominal candidates for each pronoun: N24/c:89-94
3. agreement_score, +1 number, -2 on gender clash: N24/c:71-81
4. recency_score, closer wins: N24/c:84-86, N24/d:80
5. highest sum links the antecedent: N24/c:98, N24/d:82
6. clusters with union-find: N24/c:103-120

## Tasks in code (task-table, 8)
- spans_to_bio(tokens, spans): N06/c:34
- bio_to_spans(tokens, labels): N06/c:43
- word_shape(word): N06/c:6
- rule_based_ner(tokens): N06/c:20
- predict_mft(tokens, word_best, default_tag): N07/c:27
- train_hmm(examples, alpha=0.01): N07/c:31
- viterbi(tokens, transitions, emissions, tags, vocab, alpha=0.01): N07/c:52
- disambiguate(mention, context, use_prior=True): N25/c:43

## CRF and transformer NER (annotated-code, 9 lines)
- sklearn_crfsuite.CRF(algorithm="lbfgs", c1=0.1, c2=0.1, max_iterations=100, all_possible_transitions=True): N06/d:176
- c1 and c2 are L1 and L2, illegal I-ORG after O: N06/d:181
- X_train = [to_features(s) ...], crf.fit: N06/d:177-178
- ~84 F1 on CoNLL-2003: N06/d:302
- pipeline("ner", model="dslim/bert-base-NER", aggregation_strategy="simple"): N06/d:235
- aggregation_strategy merges B-X, I-X: N06/d:246
- print(ner(...)): N06/d:236

## spaCy: tags, parse, entities, clusters (annotated-code, 10 lines)
- spacy.load("en_core_web_sm"), nlp("The cats were running at 3pm."): N07/d:173-174
- token.tag_, token.pos_, token.dep_, token.head.text: N07/d:176, Penn, UD, relation: N07/d:195
- doc.ents, ent.text, ent.label_: N06/d:217-218
- iPhone labeled ORG in the small model: N06/d:228
- spacy.load("en_coreference_web_trf") experimental: N24/d:63
- doc._.coref_clusters loop: N24/d:65-66

## Numbers to expect (defaults, 8)
- MFT ~85% on Brown, the floor: N07/d:77
- Bigram HMM ~93%, gain from transitions: N07/d:153
- CRF ~97%, BiLSTM-CRF or transformer ~98%+: N07/d:157
- Annotators agree 97%, past 98% overfitting: N07/d:159
- PTB 36 tags, UD 17: N07/d:22, 243
- Coref ~83 F1 on CoNLL-2012, average of MUC, B³, CEAF: N24/d:44
- 10-30 candidates per mention: N25/d:31
- Classical NER wins under 50ms: N06/d:263

## Troubleshooting (troubleshooting, 8)
- Domain shift, fine-tune on your domain: N06/d:270
- Nested entities, span-based or multi-pass: N06/d:271
- Long entities split, aggregation_strategy or post-process: N06/d:272
- Token-level F1 overstates, entity-level F1 with seqeval: N06/d:294, 314
- Singleton explosion, check all three metrics: N24/d:105
- ~15 F1 drop over 2,000 tokens: N24/d:106, sliding-window + merge: N24/d:108
- Popularity bias: N25/d:124, domain fine-tuning: N25/d:165, NIL: N25/d:122
- Mention boundary errors drop EL recall: N25/d:123

## Use X when (qa, 5)
- Classical under 50ms, 98%+ F1, on-prem: N06/d:263-266, LLM zero-shot first: N06/d:257
- PTB legacy English, UD multilingual: N07/d:225
- spaCy, stanza, trankit: N07/d:226
- BLINK or REL, exact-match prior for low latency: N25/d:134, 138
- LLM coref easy cases only, over-merge and dropped mentions: N24/d:42, 97

## Abbreviations (glossary, 7)
- NER: N06/d:309
- CRF: N06/d:312
- PTB / UD: N07/d:22, 244-245
- EL: N25/d:20, 178
- NIL: N25/d:182
- CoNLL F1: N24/d:164
- Cataphora: N24/d:51, 162

## Tips (tips, 4)
- Report both measurements, 99% on 80% recall is an 80% pipeline: N25/d:46
- Merge coref clusters into NER entities, one KB id per entity: N24/d:122, N25/d:141
- Constrain LLM EL to valid KB ids: N25/d:165
- Noun-verb ambiguity saw, book, can, sample 20 outputs: N07/d:228
