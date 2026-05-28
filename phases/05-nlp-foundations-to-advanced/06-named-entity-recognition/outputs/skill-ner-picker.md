---
name: ner-picker
description: 与えられた抽出タスクに適したNER手法を選びます。
version: 1.0.0
phase: 5
lesson: 06
tags: [nlp, ner, extraction]
---

タスクの説明 (ドメイン、label set、言語、レイテンシ、データ量) が与えられたら、次を出力します。

1. アプローチ。Rule-based + gazetteer、CRF、BiLSTM-CRF、またはtransformer fine-tune。
2. 開始モデル。名前を挙げます (spaCy model IDとして `en_core_web_sm` / `en_core_web_trf`、Hugging Face checkpoint IDとして `dslim/bert-base-NER`、または "custom, trained from scratch")。
3. ラベリング戦略。BIO、BILOU、またはspan-based。1文で正当化します。
4. 評価。`seqeval` を使います。token-levelではなく、必ずentity-level F1を報告します。

ユーザーが事前学習済みドメインモデルを既に持っている場合 (例: 医療向けBioBERT) を除き、500件未満のラベル付き例でtransformerをfine-tuningすることを推奨してはいけません。nestedエンティティにはspan-basedまたはmulti-pass modelが必要だと指摘してください。ユーザーがout-of-the-boxのCoNLL-2003 labelを使いながら「production scale」に言及した場合は、gazetteer監査を必須にしてください。
