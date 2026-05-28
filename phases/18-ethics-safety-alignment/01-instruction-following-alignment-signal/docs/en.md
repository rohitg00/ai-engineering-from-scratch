# アラインメント信号としての Instruction-Following

> RLHF へのその後の批判は、すべてこのパイプラインへの反論として読めます。最適化圧がプロキシをどう歪めるかを学ぶ前に、まずそのプロキシ自体を見る必要があります。InstructGPT (Ouyang et al., 2022) は参照アーキテクチャを定義しました。instruction-response ペアでの supervised fine-tuning、ペアワイズ preference ranking で訓練された reward model、そして SFT policy への KL penalty を入れた reward model に対する PPO です。1.3B の InstructGPT は 175B の GPT-3 より好まれました。この単一の結果が、2026 年の frontier lab が今でも RLHF 型の post-training pipeline を出荷している理由です。

**種別:** 学習
**言語:** Python (stdlib, toy three-stage pipeline)
**前提条件:** Phase 10 · 06 (SFT), Phase 10 · 07 (RLHF), Phase 10 · 08 (DPO)
**所要時間:** 約45分

## 学習目標

- InstructGPT pipeline の 3 段階と、それぞれで使う loss を説明できる。
- なぜ 1.3B の instruction-tuned model が human preference evaluation で生の 175B GPT-3 に勝ったのかを説明できる。
- 第 3 段階の KL penalty が何を守っているのか、またそれを外すと mode-seeking behaviour に崩れる理由を述べられる。
- alignment tax と、それに対して Ouyang et al. が使った PPO-ptx mitigation を説明できる。

## 問題

Pre-trained language model はテキストを補完します。質問に答えるようには訓練されていません。GPT-3 に「リストを反転する Python 関数を書いて」と聞くと、コードではなく別のプロンプトが返ってくることがあります。訓練分布の大半が web text であり、web text はさらに web text として続くからです。モデルは仕事をしています。ただし、その仕事の定義が間違っています。

この問題を直すために serious lab が使ったプロキシが human preference です。2 つの completion を rater に渡す。rater がより良い方を選ぶ。reward model がその rater を学習する。次に RL loop が policy を reward model のスコアが高い出力へ寄せる。これが InstructGPT の主張全体です。論文の残りは engineering です。

## 概念

### Stage 1: supervised fine-tuning (SFT)

意図のある人間ならこう書く、という response を持つ prompt-response ペアを集めます。Ouyang et al. は labeler と OpenAI API から 13k prompts を使いました。base model をこのデータで標準的な cross-entropy loss により fine-tune します。

SFT が与えるもの: モデルは質問を継続するのではなく、質問に答えるようになります。SFT が与えないもの: 複数の答えが妥当なときに、rater がどれを好むかという信号です。

### Stage 2: reward model (RM)

各 prompt について、SFT model から K 個の completion を sample します。labeler がそれらを ranking します。任意の prompt-response pair をスコア化する reward model を訓練し、`y_w` が `y_l` より好まれたペアについて次を最小化します。

```
L_RM = -log sigmoid(r(x, y_w) - r(x, y_l))
```

これは Bradley-Terry pairwise preference loss です。RM は通常、SFT model から初期化し、LM head を scalar head に置き換えます。

Reward model は小さくて済みます。175B InstructGPT には 6B で十分でした。一方で壊れやすくもあります。論文の section 5 は、小規模でも現れた reward-hacking behaviours の話が中心です。

### Stage 3: KL penalty 付き PPO

目的関数を次のように定義します。

```
J(pi) = E_{x~D, y~pi(.|x)} [ r(x, y) ] - beta * KL(pi(.|x) || pi_SFT(.|x))
```

PPO で最大化します。KL term は `pi` が SFT policy から大きく逸脱しないようにします。これがないと、optimizer は adversarial examples、つまり人間が本当に好むからではなく RM が見たことがないため高スコアになる文字列を見つけます。

KL coefficient `beta` は RLHF で最も重要な hyperparameter です。低すぎると reward hacking。高すぎると SFT から改善しません。

### Alignment tax

RLHF 後、モデルは人間には好まれる一方で、標準 benchmark (SQuAD, HellaSwag, DROP) では後退します。Ouyang et al. はこれを alignment tax と呼び、PPO-ptx で対処します。pre-training gradients を RL objective に混ぜ、reward されていない downstream task の能力を忘れないようにします。

```
J_ptx(pi) = J(pi) + gamma * E_{x~D_pretrain} [ log pi(x) ]
```

PPO-ptx は標準になりました。Anthropic、DeepMind、Meta はいずれも何らかの variant を使っています。

### 結果

1.3B InstructGPT (SFT + RM + PPO-ptx) は、175B base GPT-3 より labeler に好まれる割合がおよそ 70% でした。本番 traffic からの hidden-test prompts では差がさらに広がります。この数字から読み取るべきことは 2 つです。

1. Alignment は capability とは別の軸です。175B model は capability が高く、1.3B model は alignment が高かった。labeler は aligned model を好みました。
2. Capability floor は base model で決まります。RLHF によって base model が見たことのない事実を知るようにはできません。

### Phase 18 の基準点になる理由

後の lesson に出てくる批判、reward hacking (Lesson 2)、DPO (Lesson 3)、sycophancy (Lesson 4)、CAI (Lesson 5)、sleeper agents (Lesson 7)、alignment faking (Lesson 9) は、すべてこの pipeline のどこかへの反論です。Reward hacking は stage 2 を攻撃します。DPO は stage 2 と 3 を畳み込みます。CAI は human labeler を置き換えます。Sycophancy は labeler が bias のある信号であることを示します。Alignment faking は policy が stage 3 自体を迂回できることを示します。これらの批判を追うには、まず pipeline を頭に入れておく必要があります。

## 使ってみる

`code/main.py` は toy preference data 上で 3 段階を simulation します。base "policy" は actions {A, B, C} 上の bias のある coin です。Stage 1 SFT は 200 prompts 上の labeler actions を模倣します。Stage 2 は 500 個の pairwise rankings から Bradley-Terry reward model を fit します。Stage 3 は SFT policy への KL penalty を入れた簡略 PPO update を実行します。reward が上がり、KL divergence が増え、policy が drift する様子を確認できます。KL term を切ると、50 update steps 以内に reward hacking が現れることも見られます。

見るべき点:

- `beta = 0.1` と `beta = 0.0` の reward trajectory。
- 訓練 step に対する KL(pi || pi_SFT)。
- labeler preference と比較した final action distribution。

## 成果物

この lesson では `outputs/skill-instructgpt-explainer.md` を作ります。RLHF pipeline description や paper abstract を受け取り、3 段階のどこが変更されているか、各段階でどの loss が使われているか、KL penalty または同等の regularizer があるかを特定します。

## 演習

1. `code/main.py` を実行してください。`beta = 0.0` に設定し、200 PPO steps 後の action distribution を報告してください。mode-seeking behaviour を 1 段落で説明してください。

2. reward model に action B への +0.5 bias を加えてください (simulated reward bug)。`beta = 0.1` で PPO を実行します。KL penalty は policy が bias を exploit するのを防ぎますか。どの `beta` で exploitation が見えるようになりますか。

3. Ouyang et al. (arXiv:2203.02155) Figure 1 を読んでください。PPO を 1, 5, 20, 100 steps 実行し、SFT model に対する preference を測って labeler-preference curve を再現してください。

4. 論文の Section 4.3 は、1.3B InstructGPT が 175B GPT-3 におよそ 70% 勝つと報告しています。なぜ labeler 自身の prompts より、hidden production prompts の方が比率が高くなるのでしょうか。

5. 同じ preference data 上で PPO loss を DPO (Phase 10 · 08) に置き換えてください。final policy drift (SFT への KL) と final reward を比較してください。matched reward ではどちらの方法がより大きく drift しますか。

## 重要語句

| Term | よく言われること | 実際の意味 |
|------|-----------------|------------|
| SFT | "instruction tuning" | Stage 1: prompt-response pairs 上の cross-entropy fine-tune |
| Reward model | "the RM" | pairwise labels 上の Bradley-Terry で訓練された (prompt, response) の scalar regressor |
| Bradley-Terry | "pairwise preference loss" | -log sigmoid(r_w - r_l); pairwise ranking を binary classification に落とす |
| KL penalty | "the regularizer" | `beta * KL(pi \|\| pi_SFT)`。RL policy を SFT anchor の近くに保つ |
| PPO-ptx | "PPO with pretraining mix" | alignment tax を相殺するため、PPO objective に pre-training log-likelihood の一部を加える |
| Alignment tax | "the RLHF regression" | RLHF が target にしていない標準 benchmark での post-RLHF drop |
| Labeler preference | "the ground truth" | human rankings の sample。RM はその統計的プロキシであり、"human values" のプロキシではない |

## 追加資料

- [Ouyang et al. — Training language models to follow instructions with human feedback (arXiv:2203.02155)](https://arxiv.org/abs/2203.02155) — InstructGPT paper。以後のすべての RLHF pipeline の土台
- [Stiennon et al. — Learning to summarize from human feedback (arXiv:2009.01325)](https://arxiv.org/abs/2009.01325) — RLHF-for-summarization の先行研究
- [Christiano et al. — Deep reinforcement learning from human preferences (arXiv:1706.03741)](https://arxiv.org/abs/1706.03741) — preference-based RL の元の定式化
- [Bai et al. — Training a Helpful and Harmless Assistant with RLHF (arXiv:2204.05862)](https://arxiv.org/abs/2204.05862) — Anthropic による InstructGPT pipeline の HH extension
