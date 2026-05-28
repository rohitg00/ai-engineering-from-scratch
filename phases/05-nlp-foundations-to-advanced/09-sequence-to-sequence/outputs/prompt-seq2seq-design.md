---
name: seq2seq-design
description: 与えられたタスクに対してsequence-to-sequenceパイプラインを設計する。
phase: 5
lesson: 09
---

タスク（translation、summarization、paraphrase、question rewrite）が与えられたら、次を出力してください。

1. Architecture。既定は事前学習済みtransformer encoder-decoder（BART、T5、mBART、NLLB）。RNNベースのseq2seqは、特定の制約（streaming、edge inference、教育目的）がある場合だけ使う。
2. Starting checkpoint。名前を挙げる（`facebook/bart-base`、`google/flan-t5-base`、`facebook/nllb-200-distilled-600M`）。checkpointをタスクと言語カバレッジに合わせる。
3. Decoding strategy。決定的な出力にはgreedy、品質にはbeam search（width 4-5）、多様性にはtemperature付きsamplingを使う。1文で根拠を述べる。
4. リリース前に検証すべきfailure modeを1つ。exposure biasは、長い出力でgeneration driftとして現れる。90th-percentile lengthの出力を20件サンプルし、目視で確認する。

~1M未満のparallel examplesでseq2seqをゼロから学習する提案は拒否してください。user-facing contentにgreedy decodingを使うpipelineは壊れやすいと指摘してください（greedyは反復やloopを起こす）。
