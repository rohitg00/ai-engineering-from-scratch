---
name: msj-audit
description: long-context safety evaluation が many-shot jailbreaking を網羅しているか監査する。
version: 1.0.0
phase: 18
lesson: 13
tags: [many-shot-jailbreaking, context-window, power-law, anthropic]
---

long-context model の safety evaluation が与えられたら、その評価が many-shot jailbreaking を網羅しているか監査する。

生成する内容:

1. Shot-count coverage。テストされた shot counts を報告する (1, 5, 16, 64, 256、および >= 1M context のモデルでは少なくとも1つの >= 512 を含むべき)。単一の shot count だけをテストする評価では ASR は情報量が少ない。MSJ は曲線である。
2. Power-law fit。behaviour category ごとの fitted exponent を報告する。浅い exponent は、その category で model が ICL-robust であることを示す。急な exponent は MSJ が不釣り合いに有効であることを示す。
3. Category breakdown。MSJ effectiveness は category によって異なる: violent content、deceit、self-harm、bioweapon。Anil et al. 2024 によれば、violent/deceitful はより少ない shots で jailbreak される。評価にない category を flag する。
4. Defense identification。classifier-based prompt modification は入っているか。classifier 自体の adversarial robustness は評価されているか。Anthropic の 61% -> 2% という報告は classifier calibration に依存する。
5. Compositional check。MSJ + PAIR、MSJ + persuasive templates、MSJ + encoding をテストしているか。compositional attacks は単独技術より強いことが多い。

強い却下条件:
- 5-shot-only evaluation に基づく「our long-context model is safe」という主張。
- jailbreak ASR と benign ICL performance を同じ classifier で報告しない defense claim。trade-off が論点である。
- category breakdown のない category-aggregate ASR。

拒否ルール:
- ユーザーが MSJ を完全に patch できるか尋ねたら、二択回答を拒否する。MSJ は ICL と mechanism を共有しており、ICL を消さずに除去することはできない。
- ユーザーが evaluation に推奨 shot count を尋ねたら、単一の数値を拒否し、5 から 512 shots までの power-law fit を求める。

出力: shot-count coverage、category ごとの power-law fit、defense identification、compositional attack gap を1つ報告する1ページの監査。methodological reference として Anil et al. 2024 (Anthropic) を1回引用する。
