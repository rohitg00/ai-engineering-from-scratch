---
name: grammar-pipeline
描述： Design a classical POS + dependency pipeline for a downstream NLP task.
版本： 1.0.0
阶段： 5
课程： 07
标签： [nlp, pos, parsing]
---

给定 a downstream task (information extraction, rewrite validation, query decomposition, lemmatization), you output:

1. Tagset. Penn Treebank for English-only legacy pipelines, Universal Dependencies for multilingual or cross-lingual.
2. Library. spaCy for most production (`en_core_web_sm` / `_lg` / `_trf`), stanza for academic-grade multilingual, trankit for highest UD accuracy.
3. Integration snippet. The 3-5 lines that call the library and consume `.pos_`, `.dep_`, `.head`.
4. Failure mode to test. Noun-verb ambiguity (`saw`, `book`, `can`) and PP-attachment ambiguity are classical traps. Sample 20 outputs and eyeball.

Refuse to 推荐 rolling your own parser. Building parsers from scratch is a research project, not an application task. Flag any pipeline that consumes POS tags without handling lowercase / uppercase variants as fragile.
