# Monte Carlo Methods — 完全なエピソードから学習する

> 動的計画法にはモデルが必要です。Monte Carlo に必要なのはエピソードだけです。方策を実行し、リターンを観測し、平均します。RL で最も単純な発想であり、下流のすべてを開く発想です。

**種別:** 構築
**言語:** Python
**前提条件:** Phase 9 · 01 (MDPs), Phase 9 · 02 (Dynamic Programming)
**所要時間:** 約75分

## 問題

動的計画法は美しいですが、すべての状態と行動について `P(s' | s, a)` を問い合わせられることを仮定します。現実世界では、ほとんど何もそのようには動きません。ロボットは関節トルクをかけた後のカメラ画素の分布を解析的に計算できません。価格設定アルゴリズムは、あらゆる顧客反応を積分できません。LLM は、あるトークンの後に続きうるすべての継続を列挙できません。

環境から *サンプル* できる能力だけを必要とする手法が必要です。方策を実行します。軌跡 `s_0, a_0, r_1, s_1, a_1, r_2, …, s_T` を得ます。それを使って価値を推定します。これが Monte Carlo です。

DP から MC への移行は哲学的に重要です。*既知モデル + 厳密 backup* から *サンプルされた rollout + 平均リターン* へ移ります。分散は跳ね上がりますが、適用範囲は大きく広がります。この後のすべての RL アルゴリズム、TD、Q-learning、REINFORCE、PPO、GRPO は、根本では Monte Carlo 推定器です。ときどき、その上に bootstrapping が重ねられます。

## コンセプト

![Monte Carlo: rollout, compute returns, average; first-visit vs every-visit](../assets/monte-carlo.svg)

**中心アイデアを1行で書くと:** `V^π(s) = E_π[G_t | s_t = s] ≈ (1/N) Σ_i G^{(i)}(s)` です。ここで `G^{(i)}(s)` は、方策 `π` のもとで `s` を訪問した後に観測されたリターンです。

**First-visit と every-visit MC。** 状態 `s` を複数回訪問するエピソードがあるとき、first-visit MC は最初の訪問からのリターンだけを数えます。every-visit MC はすべての訪問を数えます。どちらも極限では不偏です。First-visit は解析しやすい（iid サンプル）です。Every-visit は1エピソードあたりより多くのデータを使うため、実務ではたいてい速く収束します。

**逐次平均。** すべてのリターンを保存する代わりに、running average を更新します。

`V_n(s) = V_{n-1}(s) + (1/n) [G_n - V_{n-1}(s)]`

並べ替えると `V_new = V_old + α · (target - V_old)` で、`α = 1/n` です。`1/n` を定数ステップサイズ `α ∈ (0, 1)` に置き換えると、`π` の変化を追跡する非定常 MC 推定器になります。この一手が、MC から TD、そしてすべての現代的 RL アルゴリズムへの飛躍です。

**探索が問題になる。** DP は列挙によってすべての状態に触れました。MC は方策が訪れる状態しか見ません。`π` が決定的なら、状態空間の領域全体が一度もサンプルされず、その価値推定は永遠にゼロのままです。歴史順に3つの対処があります。

1. **Exploring starts。** 各エピソードをランダムな (s, a) ペアから開始します。カバレッジを保証しますが、実務では非現実的です（ロボットを任意状態に「リセット」することはできません）。
2. **ε-greedy。** 現在の Q に関して greedy に行動しつつ、確率 `ε` でランダム行動を選びます。すべての状態行動ペアが漸近的にサンプルされます。
3. **Off-policy MC。** behavior policy `μ` のもとでデータを集め、importance sampling によって target policy `π` について学習します。高分散ですが、DQN のような replay-buffer 手法への橋渡しです。

**Monte Carlo Control。** Policy iteration と同じように evaluate → improve → evaluate しますが、evaluation はサンプリングベースです。

1. `π` を実行してエピソードを得る。
2. 観測されたリターンから `Q(s, a)` を更新する。
3. `Q` に関して `π` を ε-greedy にする。
4. 繰り返す。

穏やかな条件（すべてのペアが無限回訪問され、`α` が Robbins-Monro を満たす）のもとで、確率1で `Q*` と `π*` に収束します。

## 作る

### Step 1: rollout → (s, a, r) のリスト

```python
def rollout(env, policy, max_steps=200):
    trajectory = []
    s = env.reset()
    for _ in range(max_steps):
        a = policy(s)
        s_next, r, done = env.step(s, a)
        trajectory.append((s, a, r))
        s = s_next
        if done:
            break
    return trajectory
```

モデルはありません。あるのは `env.reset()` と `env.step(s, a)` だけです。gym 環境と同じインターフェースですが、必要最小限に削っています。

### Step 2: リターンを計算する（逆向きスイープ）

```python
def returns_from(trajectory, gamma):
    returns = []
    G = 0.0
    for _, _, r in reversed(trajectory):
        G = r + gamma * G
        returns.append(G)
    return list(reversed(returns))
```

1パス、`O(T)` です。後ろ向き再帰 `G_t = r_{t+1} + γ G_{t+1}` により、再合計を避けます。

### Step 3: first-visit MC evaluation

```python
def mc_policy_evaluation(env, policy, episodes, gamma=0.99):
    V = defaultdict(float)
    counts = defaultdict(int)
    for _ in range(episodes):
        trajectory = rollout(env, policy)
        returns = returns_from(trajectory, gamma)
        seen = set()
        for t, ((s, _, _), G) in enumerate(zip(trajectory, returns)):
            if s in seen:
                continue
            seen.add(s)
            counts[s] += 1
            V[s] += (G - V[s]) / counts[s]
    return V
```

実際に働いているのは3行です。初回訪問で状態を seen に入れ、カウントを増やし、running mean を更新します。

### Step 4: ε-greedy MC control（on-policy）

```python
def mc_control(env, episodes, gamma=0.99, epsilon=0.1):
    Q = defaultdict(lambda: {a: 0.0 for a in ACTIONS})
    counts = defaultdict(lambda: {a: 0 for a in ACTIONS})

    def policy(s):
        if random() < epsilon:
            return choice(ACTIONS)
        return max(Q[s], key=Q[s].get)

    for _ in range(episodes):
        trajectory = rollout(env, policy)
        returns = returns_from(trajectory, gamma)
        seen = set()
        for (s, a, _), G in zip(trajectory, returns):
            if (s, a) in seen:
                continue
            seen.add((s, a))
            counts[s][a] += 1
            Q[s][a] += (G - Q[s][a]) / counts[s][a]
    return Q, policy
```

### Step 5: DP のゴールドスタンダードと比較する

`V^π` の MC 推定は、エピソード数 → ∞ で Lesson 02 の DP 結果に一致するはずです。実務上は、4×4 GridWorld で50,000エピソード実行すれば、DP の答えから `~0.1` 以内に入ります。

## 落とし穴

- **無限エピソード。** MC はエピソードが *終端する* ことを要求します。方策が永遠にループしうるなら、`max_steps` で上限を設け、その上限を暗黙の失敗として扱います。ランダム方策の GridWorld が頻繁にタイムアウトするのは普通です。ただし正しく数えてください。
- **分散。** MC は完全なリターンを使います。長いエピソードでは分散が巨大です。最後の不運な報酬1つが `V(s_0)` を同じだけ動かします。TD 手法（Lesson 04）は bootstrapping によってこれを削ります。
- **状態カバレッジ。** まっさらな Q に対する greedy MC は、タイがあると1つの行動しか試しません。必ず探索してください（ε-greedy、exploring starts、UCB）。
- **非定常な方策。** MC control のように `π` が変化する場合、古いリターンは別の方策から来ています。Constant-α MC はこれを扱えますが、sample-average MC は扱えません。
- **Off-policy importance sampling。** 重み `π(a|s)/μ(a|s)` は軌跡全体で掛け合わされます。ホライズンとともに分散が爆発します。per-decision weighted IS で抑えるか、TD に切り替えてください。

## 使う

2026年における Monte Carlo 手法の役割は次のとおりです。

| ユースケース | MC を使う理由 |
|----------|--------|
| 短ホライズンのゲーム（blackjack、poker） | エピソードが自然に終端し、リターンが明確。 |
| ログ済み方策のオフライン評価 | 保存済み軌跡上の割引リターンを平均する。 |
| Monte Carlo Tree Search (AlphaZero) | 木の葉からの MC rollout が選択を導く。 |
| LLM RL 評価 | ある方策について sampled completions の平均報酬を計算する。 |
| PPO の baseline 推定 | advantage target `A_t = G_t - V(s_t)` が MC の `G_t` を使う。 |
| RL 教育 | 実際に動く最も単純なアルゴリズム。bootstrapping を外して核を見る。 |

現代の deep-RL アルゴリズム（PPO、SAC）は、`n`-step returns や GAE によって、純粋な MC（完全リターン）と純粋な TD（1ステップ bootstrap）の間を補間します。どちらの端点も同じ推定器のインスタンスです。

## Ship It

`outputs/skill-mc-evaluator.md` として保存します。

```markdown
---
name: mc-evaluator
description: Evaluate a policy via Monte Carlo rollouts and produce a convergence report with DP-comparison if available.
version: 1.0.0
phase: 9
lesson: 3
tags: [rl, monte-carlo, evaluation]
---

Given an environment (episodic, with reset+step API) and a policy, output:

1. Method. First-visit vs every-visit MC. Reason.
2. Episode budget. Target number, variance diagnostic, expected standard error.
3. Exploration plan. ε schedule (if needed) or exploring starts.
4. Gold-standard comparison. DP-optimal V* if tabular; otherwise a bound from a Q-learning / PPO baseline.
5. Termination check. Max-step cap, timeouts, handling of non-terminating trajectories.

Refuse to run MC on non-episodic tasks without a finite horizon cap. Refuse to report V^π estimates from fewer than 100 episodes per state for tabular tasks. Flag any policy with zero-variance actions as an exploration risk.
```

## 演習

1. **Easy.** 4×4 GridWorld の一様ランダム方策に対して first-visit MC evaluation を実装してください。10,000エピソード実行します。`V(0,0)` をエピソード数の関数として、DP の答えと並べてプロットしてください。
2. **Medium.** `ε ∈ {0.01, 0.1, 0.3}` の ε-greedy MC control を実装してください。20,000エピソード後の平均リターンを比較します。曲線はどのような形ですか。bias-variance tradeoff はどこにありますか。
3. **Hard.** importance sampling を使う *off-policy* MC を実装してください。一様ランダム方策 `μ` のもとでデータを集め、決定的最適方策 `π` の `V^π` を推定します。plain IS、per-decision IS、weighted IS を比較してください。どれが最も低分散ですか。

## 重要用語

| 用語 | よくある言い方 | 実際の意味 |
|------|-----------------|-----------------------|
| Monte Carlo | 「ランダムサンプリング」 | 分布からの iid サンプルを平均して期待値を推定すること。 |
| Return `G_t` | 「未来の報酬」 | ステップ `t` からエピソード終端までの割引報酬和: `Σ_{k≥0} γ^k r_{t+k+1}`。 |
| First-visit MC | 「各状態を1回だけ数える」 | エピソード中の最初の訪問だけが価値推定に寄与する。 |
| Every-visit MC | 「すべての訪問を使う」 | すべての訪問が寄与する。わずかにバイアスがあるが、サンプル効率が高い。 |
| ε-greedy | 「探索ノイズ」 | 確率 `1-ε` で greedy 行動、確率 `ε` でランダム行動を選ぶ。 |
| Importance sampling | 「誤った分布からのサンプルを補正する」 | `μ` のデータから `V^π` を推定するため、`π(a\|s)/μ(a\|s)` の積でリターンを重み付けする。 |
| On-policy | 「自分のデータから学ぶ」 | Target policy = behavior policy。Vanilla MC、PPO、SARSA。 |
| Off-policy | 「他者のデータから学ぶ」 | Target policy ≠ behavior policy。Importance-sampled MC、Q-learning、DQN。 |

## 参考資料

- [Sutton & Barto (2018). Ch. 5 — Monte Carlo Methods](http://incompleteideas.net/book/RLbook2020.pdf) — 標準的な扱いです。
- [Singh & Sutton (1996). Reinforcement Learning with Replacing Eligibility Traces](https://link.springer.com/article/10.1007/BF00114726) — first-visit と every-visit の解析です。
- [Precup, Sutton, Singh (2000). Eligibility Traces for Off-Policy Policy Evaluation](http://incompleteideas.net/papers/PSS-00.pdf) — off-policy MC と分散制御です。
- [Mahmood et al. (2014). Weighted Importance Sampling for Off-Policy Learning](https://arxiv.org/abs/1404.6362) — 現代的な低分散 IS 推定器です。
- [Tesauro (1995). TD-Gammon, A Self-Teaching Backgammon Program](https://dl.acm.org/doi/10.1145/203330.203343) — MC/TD self-play が超人的なプレイに収束することを示した最初期の大規模な実証です。このフェーズ後半の全レッスンの概念的な前身です。
