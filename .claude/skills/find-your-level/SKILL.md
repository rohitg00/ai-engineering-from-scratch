---
name: find-your-level
version: 1.0.0
description: >
  AI/ML の知識レベルを、260レッスン・20フェーズで構成される
  AI Engineering from Scratch カリキュラムの開始地点に対応付ける対話型クイズ。
  トリガーフレーズ: "どこから始めればいい", "find my level", "何を知っているか確認して",
  "which phase", "知識を評価して", "placement test", "skip ahead"
tags: [assessment, onboarding, curriculum, ai-engineering]
---

# レベル診断

あなたは **AI Engineering from Scratch** カリキュラム（20フェーズ、260以上のレッスン）のプレースメントクイズを実施します。目的は、学習者がすでに理解している内容を飛ばし、ちょうど挑戦が始まる地点から学習を始められるように、適切な開始位置を見極めることです。

## クイズ構成

知識領域は5つあり、各領域2問、合計10問です。2問ずつのラウンド形式（1領域につき1ラウンド）で提示します。学習者がラウンド内の2問に回答したら、その領域を採点してから次へ進みます。

## 採点

各問題は1点です（0 = 不正解または空欄、1 = 正解）。各領域のスコアは0-2点です。合計スコアは0-10点です。

## クイズの進め方

最初に学習者へ短く挨拶し、そのまま Round 1 に入ります。すべての問題で **AskUserQuestion** を使います。各ラウンド後、次のラウンドに進む前に、その領域のスコアを学習者に伝えます（例: "Math & Statistics: 2/2"）。コメントは短くします。解答の説明は最後まで行わないでください。

---

### ラウンド 1 -- Math & Statistics

**Q1.** 2つのベクトル a = [1, 2, 3] と b = [4, 5, 6] があります。この内積はいくつですか？

- A) 21
- B) 32
- C) 15
- D) 27

**正解: B) 32** (1*4 + 2*5 + 3*6 = 32)

**Q2.** 公平なコインを3回投げます。ちょうど2回表が出る確率はいくつですか？

- A) 1/4
- B) 3/8
- C) 1/2
- D) 1/8

**正解: B) 3/8** (C(3,2) * (1/2)^3 = 3/8)

---

### ラウンド 2 -- Classical ML

**Q3.** 90%がネガティブ、10%がポジティブのサンプルからなる分類タスクで、モデルがすべてをネガティブと予測しました。このモデルの accuracy（正解率）はいくつですか？

- A) 50%
- B) 10%
- C) 90%
- D) 0%

**正解: C) 90%**（すべてのネガティブを正解し、すべてのポジティブを誤判定するため）

**Q4.** 次のうち、Random Forest のハイパーパラメータはどれですか？

- A) 学習された分割しきい値
- B) 木の数
- C) 葉ノードの予測値
- D) 各ノードの Gini impurity

**正解: B) 木の数**

---

### ラウンド 3 -- Deep Learning

**Q5.** バックプロパゲーション中、連鎖律は何を計算しますか？

- A) 最適な learning rate
- B) 各重みに対する loss の勾配
- C) 必要な層の数
- D) batch size

**正解: B) 各重みに対する loss の勾配**

**Q6.** ResNet の residual connection（skip connection）は、主にどの問題に対処しますか？

- A) 小さなデータセットでの overfitting
- B) 深いネットワークにおける vanishing gradients
- C) データ読み込みの遅さ
- D) メモリ使用量の多さ

**正解: B) 深いネットワークにおける vanishing gradients**

---

### ラウンド 4 -- NLP & Transformers

**Q7.** Transformer アーキテクチャでは、attention mechanism は何と何の間で計算されますか？

- A) pixels と labels
- B) Queries、Keys、Values
- C) Encoder と Decoder のみ
- D) embeddings と positions のみ

**正解: B) Queries, Keys, and Values**

**Q8.** 大規模言語モデルを fine-tuning するとき、LoRA（Low-Rank Adaptation）の主な利点は何ですか？

- A) すべてのパラメータをゼロから学習する
- B) ほとんどの重みを固定し、小さな低ランク更新行列だけを学習する
- C) 学習データが一切不要になる
- D) より良い結果のためにモデルサイズを2倍にする

**正解: B) ほとんどの重みを固定し、小さな低ランク更新行列だけを学習する**

---

### ラウンド 5 -- Applied AI

**Q9.** RAG（Retrieval-Augmented Generation）システムでは、LLM が回答を生成する前に何が起こりますか？

- A) クエリを使ってモデルを再学習する
- B) 関連ドキュメントを検索し、プロンプトに挿入する
- C) ユーザーが手動でコンテキストを選択する
- D) モデルが自身の重みを検索する

**正解: B) 関連ドキュメントを検索し、プロンプトに挿入する**

**Q10.** multi-agent system における "coordinator" または "orchestrator" agent の主な目的は何ですか？

- A) ほかのすべての agent を置き換えること
- B) タスクを割り当て、メッセージをルーティングし、agent 間の協調を管理すること
- C) トークン使用量を増やすこと
- D) バックアップモデルとして機能すること

**正解: B) タスクを割り当て、メッセージをルーティングし、agent 間の協調を管理すること**

---

## 5ラウンド完了後

領域別の内訳と合計を表示します。

```
Math & Statistics:    X/2
Classical ML:         X/2
Deep Learning:        X/2
NLP & Transformers:   X/2
Applied AI:           X/2
----------------------------
Total:                X/10
```

## スコアと開始地点の対応

| 合計スコア | 開始地点 | 意味 |
|-------------|-------------|---------------|
| 0-3 | Phase 1: Math Foundations | 基礎から始める |
| 4-5 | Phase 3: Deep Learning Core | 数学とMLの基礎は身についている |
| 6-7 | Phase 7: Transformers Deep Dive | DL は理解済み。次は transformers |
| 8-9 | Phase 11: LLM Engineering | 土台は十分。LLMアプリへ進む |
| 10 | Phase 14: Agent Engineering | 主要範囲は理解済み。agents を構築する |

## 個別学習パス

開始地点を示した後、20個すべてのフェーズを含む markdown テーブルを生成します。各フェーズのステータスはスコアに基づいて決めます。開始地点より前のフェーズは "Skip"（学習者がすでに理解している内容）にします。開始地点以降のフェーズは "Do" にします。スキップ対象のフェーズに対応する領域で学習者が 1/2 点だった場合、そのフェーズは "Skip" ではなく "Review" にします。

Review 判定のための領域とフェーズの対応:
- Math & Statistics (1/2) -> Phase 1 を "Review" にする
- Classical ML (1/2) -> Phase 2 を "Review" にする
- Deep Learning (1/2) -> Phase 3 を "Review" にする
- NLP & Transformers (1/2) -> Phase 5 と 7 を "Review" にする
- Applied AI (1/2) -> Phase 14 を "Review" にする

時間見積もりは、正本である ROADMAP.md から読み取ります。各フェーズ見出しには `(~N hours)` 形式で見積もり時間が含まれています。ハードコードした数値ではなく、この値をパースしてください。これにより、見積もりが更新されても学習パスがロードマップと同期されます。

## 出力形式

次のようなテーブルを生成します。

```markdown
| Phase | Name | Status | Est. Hours |
|-------|------|--------|------------|
| 0 | Setup & Tooling | Skip | -- |
| 1 | Math Foundations | Review | 30 |
| 2 | ML Fundamentals | Skip | -- |
| 3 | Deep Learning Core | Do | 20 |
| ... | ... | ... | ... |
```

テーブルのルール:
- "Skip" フェーズの時間は `--` と表示します（合計には含めません）
- "Review" フェーズは全時間を表示します（学習者は軽く見直すべきです）
- "Do" フェーズは全時間を表示します
- Phase 0（Setup & Tooling）は、スコアに関係なく常に "Skip" にします（知識ではなくツール設定のため）
- "Review" と "Do" フェーズの時間を合計し、末尾に合計を表示します

テーブルの後に、見積もり合計を1文で追加します: "あなた専用の学習パス: 約X時間、Yフェーズ。"

最後に短い推奨事項を追加します。どのフェーズから始めるべきか、また最も弱い領域に基づいて最初に何へ集中すべきかを伝えてください。
