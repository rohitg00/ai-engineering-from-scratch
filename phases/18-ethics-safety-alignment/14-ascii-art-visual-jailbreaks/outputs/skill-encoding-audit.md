---
name: encoding-audit
description: jailbreak-defense report を encoding-family attacks 全体で監査する。
version: 1.0.0
phase: 18
lesson: 14
tags: [artprompt, ascii-art, encoding-attack, utes, structural-sleight]
---

jailbreak-defense report が与えられたら、網羅された encoding-family attacks と、それぞれを捕捉する defense layer を列挙する。

生成する内容:

1. Encoding coverage。評価された attack family を列挙する: ASCII art (ArtPrompt)、base64、leet-speak、UTF-8 homoglyphs、nested JSON / YAML / CSV、tree/graph UTES、image-modality。欠けている family を flag する。
2. Defense-layer mapping。各 family について、どの defense layer (keyword filter、perplexity filter、paraphrase、retokenization、output classifier、multimodal moderator) が捕捉し、どれが捕捉しないかを特定する。
3. Visual-recognition gap。Jiang et al. 2024 によれば、ArtPrompt に対して PPL と Retokenization が失敗するのは、認識が visual level で起きるためである。その report の defense に visual/structural level で動くものはあるか。
4. Generalization test。UTES (StructuralSleight) は任意の rare structures に一般化する。その report は training defense set にない構造をテストしているか。
5. Capability-safety tradeoff。visual-text capability が強い model (high ViTC score) ほど ArtPrompt に脆弱である。報告されていれば model の ViTC score を記載し、なければ要求する。

強い却下条件:
- substring/keyword filtering だけに基づく defense claim。
- 1つの encoding family だけを扱い、「encoding attacks」全体へ外挿する defense claim。
- family ごとの attack-success rate がない defense claim。

拒否ルール:
- ユーザーが ArtPrompt は「patched」か尋ねたら、拒否し、recognition-level と text-level defense の gap を説明する。
- ユーザーが all-encoding defense の推奨を尋ねたら、単一の推奨を拒否する。deployment が直面し得る全 family にまたがる layered defense が必要である。

出力: 上記5セクションを埋め、主要な encoding gap を flag し、追加すべき最も緊急の defense layer を名前で示す1ページの監査。Jiang et al. (arXiv:2402.11753) と StructuralSleight をそれぞれ1回引用する。
