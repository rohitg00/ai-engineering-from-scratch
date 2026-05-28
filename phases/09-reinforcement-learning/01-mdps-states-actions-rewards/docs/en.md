# MDP、状態、行動、報酬

> Markov Decision Process は、状態、行動、遷移、報酬、割引の5つでできています。RL のすべて、つまり Q-learning、PPO、DPO、GRPO は、この形の上で最適化します。一度学べば、強化学習の残りをずっと読みやすくなります。

**種別:** 学習
**言語:** Python
**前提条件:** Phase 1 · 06 (Probability & Distributions), Phase 2 · 01 (ML Taxonomy)
**所要時間:** 約45分

## 問題

あなたはチェスボットを書いているとします。あるいは在庫計画器、取引エージェント、推論モデルを訓練する PPO ループかもしれません。4つの異なる領域ですが、意外な事実があります。すべて同じ数学的対象に落とし込めます。

教師あり学習では `(x, y)` のペアが与えられ、関数を当てはめることを求められます。強化学習ではラベルはありません。あるのは、状態のストリーム、自分が取った行動、そしてスカラー報酬だけです。その手はゲームに勝ったのか。補充判断はコストを下げたのか。その取引は利益を出したのか。LLM が今生成したトークンは、judge からより高い報酬につながったのか。

このストリームは、形式化しなければ学習できません。「何を見たか」「何をしたか」「次に何が起きたか」「それがどれほど良かったか」を、それぞれ推論可能な対象にする必要があります。その形式化が Markov Decision Process です。このフェーズのすべての RL アルゴリズムは、最後の RLHF や GRPO のループも含めて、この形の上で最適化します。

## コンセプト

![Markov decision process: states, actions, transitions, rewards, discount](../assets/mdp.svg)

**5つの対象。**

- **状態** `S`。エージェントが判断に必要とするすべて。GridWorld ならセル、チェスなら盤面、LLM ならコンテキストウィンドウと任意のメモリです。
- **行動** `A`。選択肢です。上下左右へ移動する、手を指す、トークンを出力する、などです。
- **遷移** `P(s' | s, a)`。状態 `s` と行動 `a` が与えられたときの、次状態の分布です。チェスでは決定的、在庫では確率的、LLM のデコードではほぼ決定的です。
- **報酬** `R(s, a, s')`。スカラー信号です。勝ち = +1、負け = -1。売上からコストを引いた値。GRPO の log-likelihood ratio 項などです。
- **割引** `γ ∈ [0, 1)`。未来の報酬を現在に比べてどれだけ重視するかです。`γ = 0.99` はおよそ100ステップのホライズンを、`γ = 0.9` はおよそ10ステップのホライズンを買うことに相当します。

**Markov 性** `P(s_{t+1} | s_t, a_t) = P(s_{t+1} | s_0, a_0, …, s_t, a_t)`。未来は現在の状態だけに依存します。そうでないなら、状態表現が不完全です。手法の失敗ではなく、状態の失敗です。

**方策とリターン。** 方策 `π(a | s)` は状態を行動分布へ写します。リターン `G_t = r_t + γ r_{t+1} + γ² r_{t+2} + …` は、将来報酬の割引和です。価値 `V^π(s) = E[G_t | s_t = s]` は、方策 `π` のもとで `s` から始めたときの期待リターンです。Q値 `Q^π(s, a) = E[G_t | s_t = s, a_t = a]` は、特定の行動から始めたときの期待リターンです。すべての RL アルゴリズムはこのどちらかを推定し、それに応じて `π` を改善します。

**Bellman 方程式。** このフェーズのすべてが使う固定点方程式です。

`V^π(s) = Σ_a π(a|s) Σ_{s', r} P(s', r | s, a) [r + γ V^π(s')]`
`Q^π(s, a) = Σ_{s', r} P(s', r | s, a) [r + γ Σ_{a'} π(a'|s') Q^π(s', a')]`

これは期待リターンを「このステップの報酬」と「到達先の割引価値」に分解します。再帰的です。Phase 9 の各アルゴリズムは、この方程式を収束まで反復するか（動的計画法）、そこからサンプルするか（Monte Carlo）、1ステップだけブートストラップします（temporal difference）。

## 作る

### Step 1: 小さな決定的 MDP

4×4 の GridWorld。エージェントは左上から開始し、右下が終端、ステップごとの報酬は -1、行動は `{up, down, left, right}` です。`code/main.py` を参照してください。

```python
GRID = 4
TERMINAL = (3, 3)
ACTIONS = {"up": (-1, 0), "down": (1, 0), "left": (0, -1), "right": (0, 1)}

def step(state, action):
    if state == TERMINAL:
        return state, 0.0, True
    dr, dc = ACTIONS[action]
    r, c = state
    nr = min(max(r + dr, 0), GRID - 1)
    nc = min(max(c + dc, 0), GRID - 1)
    return (nr, nc), -1.0, (nr, nc) == TERMINAL
```

5行です。これが環境全体です。決定的遷移、一定のステップ罰則、吸収終端状態があります。

### Step 2: 方策をロールアウトする

方策は、状態から行動分布への関数です。最も単純なものは一様ランダムです。

```python
def uniform_policy(state):
    return {a: 0.25 for a in ACTIONS}

def rollout(policy, max_steps=200):
    s, total, steps = (0, 0), 0.0, 0
    for _ in range(max_steps):
        a = sample(policy(s))
        s, r, done = step(s, a)
        total += r
        steps += 1
        if done:
            break
    return total, steps
```

ランダム方策を1000回実行します。この 4×4 盤面では平均リターンはだいたい -60 から -80 です。最適リターンは -6（下と右への直線経路）です。この差を埋めることが Phase 9 のすべてです。

### Step 3: Bellman 方程式で `V^π` を正確に計算する

小さな MDP では Bellman 方程式は線形システムです。状態を列挙し、期待値を適用し、値が動かなくなるまで反復します。

```python
def policy_evaluation(policy, gamma=0.99, tol=1e-6):
    V = {s: 0.0 for s in all_states()}
    while True:
        delta = 0.0
        for s in all_states():
            if s == TERMINAL:
                continue
            v = 0.0
            for a, pi_a in policy(s).items():
                s_next, r, _ = step(s, a)
                v += pi_a * (r + gamma * V[s_next])
            delta = max(delta, abs(v - V[s]))
            V[s] = v
        if delta < tol:
            return V
```

これは iterative policy evaluation です。Sutton & Barto の最初のアルゴリズムであり、この後に続くすべての RL 手法の理論的基盤です。

### Step 4: `γ` は物理的な意味を持つハイパーパラメータ

有効ホライズンはおおよそ `1 / (1 - γ)` です。`γ = 0.9` → 10ステップ。`γ = 0.99` → 100ステップ。`γ = 0.999` → 1000ステップ。

低すぎるとエージェントは近視眼的に振る舞います。高すぎると credit assignment がノイズを帯びます。多くの初期ステップが遠い未来の報酬に対して責任を共有するためです。LLM RLHF では通常 `γ = 1` を使います。エピソードが短く有界だからです。制御タスクでは `0.95–0.99` を使います。長期ホライズンの戦略ゲームでは `0.999` を使います。

## 落とし穴

- **非 Markov 的な状態。** 判断に直近3つの観測が必要なら、「状態」は現在の観測だけではありません。対処: フレームを積む（Atari の DQN は4フレームを積む）か、観測列に対する recurrent state（LSTM/GRU）を使います。
- **疎な報酬。** 勝敗だけの報酬では、大きな状態空間での学習はほぼ不可能です。報酬を shaping する（中間信号を入れる）か、模倣でブートストラップします（Phase 9 · 09）。
- **Reward hacking。** 代理報酬を最適化すると、しばしば病的な振る舞いが出ます。OpenAI のボートレースエージェントは、レースを完走せず、パワーアップを集めながら円を描き続けました。報酬は常に代理ではなく、目標成果から定義してください。
- **割引の指定ミス。** 無限ホライズンのタスクで `γ = 1` にすると、すべての価値が無限になります。有限ホライズンか `γ < 1` のどちらかで必ず上限を設けます。
- **報酬スケール。** {+100, -100} と {+1, -1} は同じ最適方策を与えますが、勾配の大きさは大きく異なります。PPO/DQN に入れる前に `[-1, 1]` 程度へ正規化します。

## 使う

2026年のスタックでは、コードに触る前にすべての RL パイプラインを MDP に落とします。

| 状況 | 状態 | 行動 | 報酬 | γ |
|-----------|-------|--------|--------|---|
| 制御（移動、操作） | 関節角 + 速度 | 連続トルク | タスク固有に shaped | 0.99 |
| ゲーム（チェス、Go、ポーカー） | 盤面 + 履歴 | 合法手 | 勝ち=+1 / 負け=-1 | 1.0（有限） |
| 在庫 / 価格設定 | 在庫 + 需要 | 発注量 | 売上 - コスト | 0.95 |
| LLM の RLHF | コンテキストトークン | 次トークン | 終端での reward-model score | 1.0（エピソード ~200 トークン） |
| 推論向け GRPO | プロンプト + 部分応答 | 次トークン | 終端での verifier 0/1 | 1.0 |

訓練ループを書く前に5つ組を書いてください。「RL が動かない」というバグ報告の大半は、紙の上で壊れている MDP 定式化に戻ります。

## Ship It

`outputs/skill-mdp-modeler.md` として保存します。

```markdown
---
name: mdp-modeler
description: Given a task description, produce a Markov Decision Process spec and flag formulation risks before training.
version: 1.0.0
phase: 9
lesson: 1
tags: [rl, mdp, modeling]
---

Given a task (control / game / recommendation / LLM fine-tuning), output:

1. State. Exact feature vector or tensor spec. Justify Markov property.
2. Action. Discrete set or continuous range. Dimensionality.
3. Transition. Deterministic, stochastic-with-known-model, or sample-only.
4. Reward. Function and source. Sparse vs shaped. Terminal vs per-step.
5. Discount. Value and horizon justification.

Refuse to ship any MDP where the state is non-Markovian without explicit mention of frame-stacking or recurrent state. Refuse any reward that was not defined in terms of the target outcome. Flag any `γ ≥ 1.0` on an infinite-horizon task. Flag any reward range >100x the typical step reward as a likely gradient-explosion source.
```

## 演習

1. **Easy.** `code/main.py` に 4×4 GridWorld とランダム方策のロールアウトを実装してください。10,000エピソード実行します。リターンの平均と標準偏差を報告し、最適リターン（-6）と比較してください。
2. **Medium.** 一様ランダム方策について、`γ ∈ {0.5, 0.9, 0.99}` で `policy_evaluation` を実行してください。それぞれの `V` を 4×4 グリッドとして出力します。終端に近い状態価値が、大きな `γ` でより速く大きくなる理由を説明してください。
3. **Hard.** GridWorld を確率的にしてください。各行動は確率 `p = 0.1` で隣接方向に滑るものとします。一様方策を再評価します。`V[start]` は良くなりますか、悪くなりますか。なぜですか。

## 重要用語

| 用語 | よくある言い方 | 実際の意味 |
|------|-----------------|-----------------------|
| MDP | 「強化学習の設定」 | Markov 性を満たすタプル `(S, A, P, R, γ)`。 |
| State | 「エージェントが見るもの」 | 選んだ方策クラスのもとで、将来のダイナミクスに十分な統計量。 |
| Policy | 「エージェントの振る舞い」 | 条件付き分布 `π(a \| s)` または決定的写像 `s → a`。 |
| Return | 「総報酬」 | 現在ステップからの割引和 `Σ γ^t r_t`。 |
| Value | 「状態の良さ」 | `s` から始めたときの `π` のもとでの期待リターン。 |
| Q-value | 「行動の良さ」 | `s` から始め、最初に行動 `a` を取ったときの `π` のもとでの期待リターン。 |
| Bellman equation | 「動的計画法の再帰」 | 価値 / Q を、1ステップ報酬と割引された後続価値に分解する固定点。 |
| Discount `γ` | 「未来と現在」 | 遠い未来の報酬に対する幾何的重み。有効ホライズンは `~1/(1-γ)`。 |

## 参考資料

- [Sutton & Barto (2018). Reinforcement Learning: An Introduction, 2nd ed.](http://incompleteideas.net/book/RLbook2020.pdf) — 定番の教科書。Ch. 3 は MDP と Bellman 方程式を扱い、Ch. 1 は以降すべてのレッスンの土台になる reward hypothesis を動機づけます。
- [Bellman (1957). Dynamic Programming](https://press.princeton.edu/books/paperback/9780691146683/dynamic-programming) — Bellman 方程式の起源です。
- [OpenAI Spinning Up — Part 1: Key Concepts](https://spinningup.openai.com/en/latest/spinningup/rl_intro.html) — deep RL の角度から見た簡潔な MDP 入門です。
- [Puterman (2005). Markov Decision Processes](https://onlinelibrary.wiley.com/doi/book/10.1002/9780470316887) — MDP と厳密解法に関する operations research の参照文献です。
- [Littman (1996). Algorithms for Sequential Decision Making (PhD thesis)](https://www.cs.rutgers.edu/~mlittman/papers/thesis-main.pdf) — MDP を動的計画法の特殊化として導く、非常に明快な導出です。
