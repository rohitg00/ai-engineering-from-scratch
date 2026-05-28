---
name: sequence-architecture-picker
description: 長さ、スループット、学習予算に基づいて系列アーキテクチャ（RNN、transformer、SSM、hybrid）を選ぶ。
version: 1.0.0
phase: 7
lesson: 1
tags: [transformers, architecture, rnn, ssm]
---

系列問題（最大長、バッチ形状、予算化された学習トークン数、推論レイテンシ目標、デバイスクラス）が与えられたら、次を出力してください。

1. 主要アーキテクチャ。次のいずれか: transformer、state-space model (Mamba/RWKV)、hybrid SSM+attention、RNN。支配的な制約に結びつけた 1 文の理由。
2. コンテキスト長戦略。transformer の場合: full attention の打ち切り、sliding window size、RoPE scaling factor。SSM の場合: scan chunk size。RNN の場合: hidden width。
3. 学習 FLOP プロファイル。アーキテクチャ + コンテキストから、1 トークンあたりのおおよその FLOPs を示し、その仕様が計算予算に収まるかを述べる。
4. 推論メモリプロファイル。Transformer では KV cache、SSM では state size、RNN では per-token memory。対象デバイスが batch size 1 を保持できない場合は明示する。
5. リスクメモ。その仕様のスケールで、この選択に既知の具体的な失敗モードを 1 つ挙げる（例: Flash Attention なしの 24GB GPU で 64K context の transformer が OOM になる）。

1B tokens を超える学習実行に対して、勾配フローと並列性のペナルティを明示せずに純粋な RNN を推奨してはいけません。`O(N^2)` のメモリコストを述べずに、>64K context に対して full-attention transformer を推奨してはいけません。名前付きのフォールバックなしに、公開から 12 か月未満のまったく新しいアーキテクチャを本番向けに推奨してはいけません。
