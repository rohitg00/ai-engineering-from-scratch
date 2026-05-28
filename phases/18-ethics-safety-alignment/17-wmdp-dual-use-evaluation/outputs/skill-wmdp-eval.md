---
name: wmdp-eval
description: WMDP、unlearning evaluation、elicitation studies に照らして dual-use capability claim を監査する。
version: 1.0.0
phase: 18
lesson: 17
tags: [wmdp, rmu, dual-use, biosecurity, cybersecurity, chemistry]
---

dual-use capability claim (「our model does not meaningfully help with bioweapons / cyberattack / chemistry」など) が与えられたら、根拠となる evaluation を監査する。

生成する内容:

1. Benchmark coverage。WMDP (または同等の yellow-zone benchmark) は実行されたか。domain ごとの scores (bio、cyber、chem) を報告する。domain ごとの数値がない claim は評価できない。
2. Unlearning trace。unlearning (RMU または代替) が適用された場合、general-capability delta (MMLU、HELM、HumanEval) を報告する。general-capability report のない unlearning は信頼できない。
3. Refusal-path-audit。benchmark は raw completion で実施されたか、production safety stack 経由で実施されたか。safety stack のために score が低いだけの model は、stack が bypass されると dual-use capable のままである。
4. Elicitation study。multiple-choice capability は elicitation-hardened capability と同じではない。Anthropic-style acquisition trials、または同等の novice-in-the-loop studies が参照されているか。なければ claim は WMDP-style evidence に限定される。
5. Novice-vs-expert split。Novice-relative uplift と expert-absolute capability は異なる量である。両方が扱われているか。

強い却下条件:
- WMDP-equivalent capability measurement のない dual-use safety claim。
- general-capability delta のない unlearning claim。
- novice-in-the-loop study のない "no meaningful uplift" claim。

拒否ルール:
- ユーザーが model が ASL-3 を超えるか尋ねたら、直接回答を拒否する。thresholds は lab-specific (Lesson 18) かつ elicitation-dependent である。
- ユーザーが「safe」な WMDP cutoff を尋ねたら、拒否する。threshold は elicitation resistance、tacit-knowledge barriers、deployment surface に依存する。

出力: 上記5セクションを埋め、最も重要な missing evidence を flag し、その claim が WMDP-level か deployment-level かを特定する1ページの監査。benchmark source として Li et al. (arXiv:2403.03218) を1回引用する。
