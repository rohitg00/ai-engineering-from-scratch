---
name: skill-fine-tuning-guide
description: LoRAとQLoRAでLLMをいつ、どのようにfine-tuneするかの意思決定ツリー
version: 1.0.0
phase: 11
lesson: 8
tags: [fine-tuning, lora, qlora, peft, llm-engineering]
---

# Fine-Tuning Decision Guide

fine-tuningの前に、この順で試します。

```
1. Prompt engineering (minutes, $0)
2. Few-shot examples in prompt (minutes, $0)
3. RAG for knowledge retrieval (days, $10-100/month)
4. Fine-tuning with LoRA/QLoRA (days, $5-50 per experiment)
5. Full fine-tuning (weeks, $100-10,000 per run)
```

前の手段が測定上不十分な場合だけ次へ進みます。

## fine-tuneする場面

- promptingだけでは実現できない一貫した出力スタイルや形式が必要
- 大きなモデルを蒸留したい（8B modelでGPT-4品質など）
- レイテンシが重要で、few-shot examplesの追加トークンを許容できない
- 複雑な推論パターンを確実に守らせたい
- 望ましいinput-output behaviorの高品質例が1,000件以上ある

## fine-tuneしない場面

- 適切なpromptでモデルがすでに望むことをする
- モデルに事実を知ってほしい（代わりにRAGを使う）
- 学習例が500件未満（過学習しやすい）
- タスクが頻繁に変わる（再学習は高い）
- 特定出力にどのデータが影響したか監査する必要がある（fine-tuningはブラックボックス）

## 手法選択

| GPU VRAM | 7B model | 13B model | 70B model |
|----------|----------|-----------|-----------|
| 16GB (T4) | QLoRA | 不可 | 不可 |
| 24GB (3090/4090) | QLoRA or LoRA | QLoRA | 不可 |
| 40GB (A100) | LoRA or Full | QLoRA or LoRA | QLoRA |
| 80GB (A100/H100) | Full | LoRA or Full | QLoRA or LoRA |

## LoRA設定チェックリスト

1. r=16, alpha=32から始める（多くのタスクで安全なデフォルト）
2. まずq_projとv_projを対象にする（最小構成のLoRA）
3. QLoRAではlearning rate 2e-4、LoRA fp16では5e-5を使う
4. lora_dropout=0.05を設定する
5. 1-3 epochs学習する（多いと過学習リスク）
6. held-out setで100 stepsごとに評価する
7. checkpointsを保存し、eval lossで最良を選ぶ

## よくある間違い

- epochを多くしすぎる（小規模データでは2-3 epoch後に過学習）
- full fine-tuningと同じlearning rateを使う（LoRAにはより高いLRが必要）
- pad tokenを設定し忘れる（LlamaモデルでNaN lossesの原因）
- base modelをfreezeしない（LoRAの目的を失う）
- training dataだけで評価する（必ず10-20%をeval用にhold outする）
- prompt engineering baselineを飛ばす（promptで解ける問題をfine-tuneしてしまう）

## 品質検証

学習後、200件以上のheld-out examplesで比較します。

1. 最良prompt付きBase model（baseline）
2. LoRA adapter付きBase model（fine-tuned model）
3. 同じpromptのGPT-4またはClaude（ceiling）

LoRA modelがprompted baselineを上回らないなら、必要なのは追加computeではなく、学習データまたは設定の見直しです。

## Adapter管理

- multi-task servingではadapterを分けて保持する（リクエストごとにswap）
- single-task deploymentではadapterをbase weightsにmergeする
- adapterをHugging Face Hubに保存する（10-100MBでversion/shareしやすい）
- デプロイ前にmerged modelの出力がunmerged outputと一致することをテストする
- 複数adapterを1つに統合するにはTIES-MergingまたはDAREを使う

## 学習デバッグ

lossが下がらない場合:

1. learning rateを確認する（LoRAには低すぎる可能性。2e-4を試す）
2. LoRA layersが実際にgradientを受けているか確認する
3. base model weightsがfreezeされていることを確認する
4. data formattingを確認する（tokenizerはモデル期待形式と一致している必要がある）

lossは下がるがeval品質が悪い場合:

1. 学習データ品質の問題（garbage in, garbage out）
2. 過学習（epochsを減らし、dropoutを増やし、データを追加する）
3. target modulesが不適切（複雑タスクではMLP layersを追加する）
4. rankが低すぎる（r=32またはr=64を試す）
