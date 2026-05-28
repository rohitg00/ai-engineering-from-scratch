---
name: summary-picker
description: extractive か abstractive かを選び、library 名と factuality check を示す。
version: 1.0.0
phase: 5
lesson: 12
tags: [nlp, summarization]
---

task (document type、compliance requirement、length、compute budget) が与えられたら、次を出力する:

1. 方法。Extractive または abstractive。理由を 1 文で説明する。
2. 出発点となる model / library。名前を挙げる。`sumy.TextRankSummarizer`、`facebook/bart-large-cnn`、`google/pegasus-pubmed`、または LLM prompt。
3. 評価計画。ROUGE-1、ROUGE-2、ROUGE-L (`rouge-score` with stemming を使う)。abstractive の場合は factuality check も加える。
4. 調べるべき failure mode を 1 つ。abstractive news summarization で最も一般的なのは entity swap である。source entities が summary に現れない sample を flag する。

medical、legal、financial、regulated content では、factuality gate なしに abstractive summarization を使ってはならない。input が model の context window を超える場合は、単なる truncation ではなく chunked map-reduce summarization が必要だと flag する。
