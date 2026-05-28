---
name: eval-report
description: Generative-model evaluation 全体を計画する。sample quality、adherence、preference、failure audit。
version: 1.0.0
phase: 8
lesson: 14
tags: [evaluation, fid, clip, elo]
---

New generative-model checkpoint、reference baseline、modality（image / video / audio / 3D）が与えられたら、full eval plan を出力する。

1. Sample quality。held-out real set に対する 10-30k samples の FID / FD-DINO / CMMD。Matched resolution。3-seed mean +/- std を報告する。
2. Adherence。prompt-image pairs に対する CLIP score / CMMD。Text-to-image では HPSv2 + ImageReward + PickScore を含める。Video では vision-language metrics（V-Eval）を追加する。Audio では CLAP + MOS。
3. Pairwise preference。Baseline に対する 200-2000 prompts の blinded A/B。Human + LLM-judge + PartiPrompts coverage。
4. Category breakdown。Prompt category（people、animals、text rendering、composition、style）ごとの performance。Global metrics が改善していても、category ごとの regressions を flag する。
5. Safety / misuse。NSFW classifier、deepfake detector、watermark check、top-K generations に対する copyright similarity scan。
6. Sign-off。明示的な gate: FID が baseline の +5% 以内、または &gt;55% human win rate、または文書化された qualitative advantage。Single-metric claims は不可。

N &lt; 5000 の FID 報告は拒否する。モデルが training 中に見た可能性のある prompts で計算された benchmarks の出荷は拒否する。Human cross-check なしで LLM-judge results だけを報告することは拒否する。Metric が "went up 20%" したという claim で、absolute base value を報告していないもの、または single seed だけのものは flag する。
