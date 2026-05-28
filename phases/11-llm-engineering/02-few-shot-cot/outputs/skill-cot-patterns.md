---
name: skill-cot-patterns
description: タスクの複雑さ、精度要件、コスト制約に基づいて適切な推論手法を選ぶための判断フレームワーク
version: 1.0.0
phase: 11
lesson: 02
tags: [chain-of-thought, few-shot, self-consistency, tree-of-thought, react, reasoning, prompting]
---

# 推論手法選択ガイド

LLM に問題を推論させる必要があるときは、プロンプトを書く前に手法を選びます。手法が推論アーキテクチャを決め、プロンプトはそこに内容を流し込みます。

## クイック判断ツリー

1. タスクは単純な事実検索または単一ステップの分類ですか？
   - Yes: **zero-shot** を使います。CoT は精度を上げずコストだけ増やします。
   - No: 続けます。

2. タスクは多段階推論 (数学、論理、計画) を必要としますか？
   - Yes: **Chain-of-Thought** を使います。手順 3 に進みます。
   - No: 形式が重要なら **few-shot**、そうでなければ zero-shot を使います。

3. 1 つの推論ミスは許容できますか？
   - Yes: **few-shot CoT** (単一サンプル、temperature 0.0) を使います。
   - No: **self-consistency** (N=5、temperature 0.7) を使います。手順 4 に進みます。

4. 問題は多くの可能な経路を持つ探索/計画問題ですか？
   - Yes: **Tree-of-Thought** を使います。
   - No: self-consistency で十分です。

5. タスクは外部情報または計算を必要としますか？
   - Yes: **ReAct** (推論 + ツール呼び出し) を使います。
   - No: 純粋な推論手法で十分です。

## 手法マトリクス

| Technique | Accuracy Lift | Cost Multiplier | Latency | Best For |
|-----------|--------------|-----------------|---------|----------|
| Zero-shot | Baseline | 1x | ~1s | 単純タスク、事実 Q&A |
| Few-shot | +5-15% | 1.2x | ~1s | 形式一致、分類 |
| Zero-shot CoT | +10-20% | 1.3x | ~1.5s | すばやい推論強化 |
| Few-shot CoT | +15-25% | 1.5x | ~2s | 数学、論理、多段階 |
| Self-Consistency (N=5) | +2-5% over CoT | 5x | ~5s | 高リスク推論 |
| Self-Consistency (N=10) | +1-2% over N=5 | 10x | ~10s | 重要判断のみ |
| Tree-of-Thought | Task-dependent | 10-40x | ~30s+ | 探索、計画、パズル |
| ReAct | Task-dependent | 3-10x | ~5-15s | 知識に根ざしたタスク |
| Prompt Chaining | +5-10% over single | 2-5x | ~5-10s | 複雑な複数部分タスク |

## モデル別ガイダンス

### GPT-4o / GPT-4.1
- ベースライン推論が強力です。zero-shot CoT で十分なことが多いです。
- 3 例の few-shot CoT で GSM8K 95% に到達します。
- Self-consistency の上積みは小さい (95% から 97%) ため、重要タスクだけで使います。
- 回答抽出にはネイティブの structured outputs を使えます。

### Claude 3.5 Sonnet / Claude 3.7 Sonnet
- 構造化されたプロンプト形式 (XML tags) に非常に強いです。
- XML 区切りの例を使った few-shot CoT が最もよく機能します。
- Extended thinking (Claude 3.7) はネイティブ CoT なので、促す必要はありません。
- Claude は temperature 0.7 で推論の多様性が出やすく、self-consistency が有効です。

### Llama 3.1/3.3 70B
- few-shot CoT の恩恵が最も大きいモデル群です。
- 推論タスクでは N=5 の self-consistency を推奨します。
- 商用モデルより明示的な形式指示が必要です。
- ローカル推論で ToT は高価なため、バッチ処理に限定して検討します。

### Gemini 2.5 Pro
- 多段階推論に最初から強いです。
- Thinking mode により、プロンプトエンジニアリングなしで組み込み CoT が使えます。
- few-shot 例は精度より形式一貫性に効きます。
- 大きなコンテキストウィンドウ (1M) により、例を多く含む few-shot が実用的です。

## アンチパターン

**単純タスクへの CoT**: 「What is 2+2? Let's think step by step」はトークンの無駄です。CoT は 3 ステップ以上あるときに効きます。

**temperature 0.0 での self-consistency**: N 個のサンプルがすべて同一になります。多様な推論経路には temperature > 0 (0.5-0.8 推奨) が必要です。

**何にでも ToT**: ToT は b=分岐数、d=深さとして O(b^d) の LLM 呼び出しが必要です。b=3、d=3 なら最大 39 呼び出しです。安価な手法が失敗する問題に限定してください。

**悪い例を使った few-shot**: 推論ミスを含む例は、そのミスをモデルに教えます。すべての例を検証してください。誤った例 1 つは、例ゼロより精度を下げることがあります。

**一貫した形式なしの回答抽出**: self-consistency ではサンプル間で回答を比較します。形式がばらつくと投票が壊れます。必ず "The answer is [number]." のように強制してください。

## コスト最適化

GPT-4o 価格 ($2.50/1M input、$10/1M output) で 10,000 queries/day を処理する本番システムの例です。

| Technique | Avg Tokens/Query | Daily Cost | Accuracy |
|-----------|-----------------|------------|----------|
| Zero-shot | ~200 | ~$5 | 78% |
| Few-shot CoT | ~600 | ~$15 | 95% |
| Self-Consistency (N=5) | ~3,000 | ~$75 | 97% |
| ToT (b=3, d=2) | ~6,000 | ~$150 | Task-dependent |

多くのアプリケーションでコスト最適なのは、few-shot CoT から始めることです。信頼度が低いクエリだけ self-consistency にエスカレーションします。

## Prompt Chaining との統合

推論手法は prompt chaining と組み合わせられます。

**Chain Step 1** (Extract): zero-shot、temperature 0.0
**Chain Step 2** (Reason): few-shot CoT、temperature 0.0
**Chain Step 3** (Verify): self-consistency with N=3、temperature 0.7

この 3 ステップチェーンは単一 CoT 呼び出しの約 3 倍のコストですが、抽出エラー、推論エラーを捕捉し、検証ステップから信頼度スコアを提供します。

## プロンプトを超えるタイミング

アプリケーションコードを書く時間よりプロンプト調整の時間が長くなっているなら、次を検討します。

1. **Fine-tuning**: ラベル付き例が 500+ あり、タスクが狭い場合
2. **DSPy compilation**: 自動プロンプト最適化が欲しい場合
3. **Agent frameworks**: 複数ターンのツール利用が必要な場合 (Phase 14)
4. **RAG**: モデルがプライベート/最新知識にアクセスする必要がある場合 (Lessons 06-07)

プロンプト手法は基礎です。どのモデル、どのプロバイダーでも使え、学習データも不要です。ただし限界があります。次の段階へ進むべきタイミングを知ることも、手法そのものを習得するのと同じくらい重要です。
