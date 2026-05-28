---
name: classifier-stack-audit
description: デプロイの input/output classifier stack（model、taxonomy、input rails、output rails、dialog rails）を監査し、adversarial attack のギャップを指摘する。
version: 1.0.0
phase: 15
lesson: 18
tags: [llama-guard, nemo-guardrails, input-rails, output-rails, colang, adversarial-attacks]
---

デプロイの classifier stack（Llama Guard version、NeMo Guardrails config、custom classifiers、normalization steps）が与えられたら、2026 年の参照に照らして監査し、そのスタックがカバーしていない攻撃面を指摘してください。

作成する内容:

1. **Model inventory.** 使用中の classifier を列挙します。Llama Guard 3（8B / 1B-INT4）か Llama Guard 4（multimodal、S1–S14）か。NeMo Guardrails の version。custom classifiers の有無。デプロイが画像を受け付ける場合、classifier が multimodal であることを確認します。
2. **Taxonomy mapping.** 宣言された business category を classifier の taxonomy に対応づけます。運用者が気にするすべてのカテゴリは classifier category に対応していなければなりません。未対応カテゴリは無防備です。
3. **Rail coverage.** input rails が model turn の前に発火し、output rails が response を返す前に発火することを確認します。Dialog rails（NeMo の Colang）はターン横断の制約を強制します。単一ターンの classifier はマルチターン攻撃を捕捉できません。
4. **Normalization.** 分類前に、入力が NFKC-normalized され、homoglyph-mapped され、zero-width / variation-selector characters が除去されていることを確認します。Raw-byte classification は Emoji Smuggling（Huang et al. 2025）で 100% ASR の標的になります。
5. **Attack-corpus coverage.** 文書化された各攻撃（emoji smuggling、homoglyph、in-context redirection、semantic paraphrase）について、スタック内の具体的な防御を挙げます。Classifier-only defense はこの監査では不合格です。Constitution（Lesson 17）と runtime（Lessons 10, 13, 14）とのレイヤリングが必要です。

即時不合格:
- Multimodal inputs に text-only classifier を使っているデプロイ。
- normalization step がないデプロイ。
- input rails しかないデプロイ（sensitive-category outputs に対する output rails がない）。
- classifier を唯一の safety layer として扱うスタック。
- 運用者自身の分布で再現できない ASR claims。

拒否ルール:
- ユーザーが宣言したカテゴリが classifier の taxonomy に対応しない場合は拒否し、先に mapping を求めます。Unmapped = unguarded です。
- デプロイが multimodal input surface に対して Llama Guard 3 の ASR 数値を引用している場合は拒否し、Llama Guard 4 または multimodal classifier を要求します。
- ユーザーが高リスク設定で classifier layer を十分なものとして扱う場合は拒否します。EU AI Act Article 14（Lesson 15）は、その上に human oversight を期待しています。

出力形式:

次を含む classifier audit を返してください。
- **Model inventory**（name、version、modality）
- **Taxonomy mapping**（operator category → classifier category）
- **Rail coverage**（input / output / dialog、model の前後どちらで発火するか）
- **Normalization note**（NFKC y/n、homoglyph y/n、zero-width strip y/n）
- **Attack-corpus coverage**（attack → defense）
- **Layer completeness**（classifier + constitution + runtime、3つすべてが必須）
- **Readiness**（production / staging / research-only）
