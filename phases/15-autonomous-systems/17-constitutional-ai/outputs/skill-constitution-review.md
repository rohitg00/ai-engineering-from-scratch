---
name: constitution-review
description: デプロイの constitutional layer を監査する。hardcoded prohibitions、soft-coded defaults、運用者が調整できる境界、4層階層による解決を確認する。
version: 1.0.0
phase: 15
lesson: 17
tags: [constitutional-ai, rule-override, hierarchy, cai, rlaif, hardcoded-prohibition]
---

デプロイの constitutional layer（system prompt、operator config、宣言された原則）が与えられたら、Claude Constitution の参照に照らして監査し、不足している hardcoded prohibitions、曖昧な原則、または誤った層順序を指摘してください。

作成する内容:

1. **Hardcoded prohibition inventory.** 運用者またはユーザーの指示に関係なく、決して曲げてはならない禁止事項をすべて列挙します。最低限の基準: bioweapons / CBRN uplift、CSAM、重要インフラ攻撃の計画、直接尋ねられたときの虚偽の身元説明。追加項目はデプロイ固有です（例: 金融サービスでは特定の fraud prohibition を追加する）。
2. **Soft-coded defaults.** 運用者が調整できる挙動をすべて列挙します。それぞれについて、宣言された境界を示します。境界のない「調整可能」設定は、バックドア的な上書きです。
3. **Tier ordering.** 解決順序が safety > ethics > guidelines > helpfulness であることを確認します。実装された resolver で helpfulness が ethics に勝つことがあれば、デプロイ上の破綻として指摘します。
4. **Principle ambiguity flags.** テキスト上、実質的に異なる解釈を許す原則を特定します。曖昧さは訓練サイクルをまたいで増幅します（principle drift）。
5. **Layer completeness.** Constitutional layer に加えて runtime-layer controls（Lessons 10, 13, 14）が存在することを確認します。Constitution だけでは不十分で、runtime だけでも不十分です。

即時不合格:
- Hardcoded prohibition layer がまったくないデプロイ。
- hardcoded prohibition を上書きできると主張する operator config（名称変更によるものを含む）。
- helpfulness を ethics より上に置く層順序。
- 評価できないほど一般的な原則テキスト（「善くあれ」など）。
- Constitutional AI を runtime controls の代替として扱うこと。

拒否ルール:
- ユーザーが hardcoded prohibition を挙げているのに、それを支える runtime-layer の backstop を示せない場合、そのデプロイを single-layer として指摘し、本番投入を拒否します。
- operator config に、宣言された境界のない調整可能な "safety" 設定が含まれる場合は拒否します。
- ユーザーが 2023 年の participatory-constitution の知見を現在のデプロイで実行可能なものとして扱う場合は確認してください。2026 年版 Constitution はそれらを取り込んでいないため、「民主的に継承している」という主張はそのデプロイでは裏付けられません。

出力形式:

次を含む constitutional audit を返してください。
- **Hardcoded floor**（禁止事項、強制レイヤー: weights / inference / both）
- **Soft-coded defaults**（設定、operator bound、user-visible y/n）
- **Tier order**（列挙し、safety > ethics > guidelines > helpfulness を確認）
- **Ambiguity flags**（原則、具体的な曖昧さ、厳密化案）
- **Layer completeness**（constitutional y/n、runtime controls y/n、両方が必須）
- **Readiness**（production / staging / research-only）
