# Deep Q-Networks (DQN)

> 2013年、Mnih は生のピクセルを入力にした単一の Q-learning ネットワークを訓練し、7本の Atari ゲームで従来型 RL エージェントをすべて上回った。2015年には49本のゲームへ拡張して Nature に発表し、deep-RL の時代を始めた。DQN は、関数近似を安定させる3つの工夫を加えた Q-learning である。

**種別:** 構築
**言語:** Python
**前提条件:** Phase 3 · 03 (Backpropagation), Phase 9 · 04 (Q-learning, SARSA)
**所要時間:** 約75分

## 問題

表形式 Q-learning では、すべての `(state, action)` ペアに個別の Q 値が必要になる。チェス盤には約 `10⁴³` 個の状態がある。Atari の1フレームは `210×160×3 = 100,800` 個の特徴量である。表形式 RL は数千状態で限界に達し、数十億状態など到底扱えない。

振り返れば解決策は明らかだ。Q-table をニューラルネットワーク `Q(s, a; θ)` に置き換えればよい。しかし、その「振り返れば明らか」な方法にたどり着くまでには何十年もかかった。Q-learning に素朴な関数近似を組み合わせると、「deadly triad」すなわち関数近似 + bootstrapping + off-policy 学習のもとで発散する。Mnih ら (2013, 2015) は、学習を安定させる3つのエンジニアリング上の工夫を見つけた。

1. **Experience replay** によって遷移の相関を弱める。
2. **Target network** によって bootstrap target を固定する。
3. **Reward clipping** によって勾配の大きさを正規化する。

Atari における DQN は、単一のアーキテクチャと単一のハイパーパラメータセットが、生のピクセルから多数の制御問題を解いた最初の例だった。その後の DDQN、Rainbow、Dueling、Distributional、R2D2、Agent57 といった「deep-RL」はすべて、この3つの工夫を土台に積み上げられている。

## コンセプト

![DQN training loop: env, replay buffer, online net, target net, Bellman TD loss](../assets/dqn.svg)

**目的関数。** DQN は、ニューラル Q 関数に対する1ステップ TD loss を最小化する。

`L(θ) = E_{(s,a,r,s')~D} [ (r + γ max_{a'} Q(s', a'; θ^-) - Q(s, a; θ))² ]`

`θ` は online network で、勾配降下により各ステップで更新される。`θ^-` は target network で、定期的に `θ` からコピーされる（およそ10,000ステップごと）。`D` は過去の遷移を保持する replay buffer である。

**3つの工夫を重要度順に見る。**

**Experience replay。** `~10⁶` 個の遷移を保持するリングバッファ。各訓練ステップでは minibatch を一様ランダムにサンプリングする。これにより時間的相関（連続フレームはほぼ同一）を断ち、まれな報酬遷移から何度も学習でき、連続する勾配更新の相関を弱められる。これがないと、ニューラルネットを使った on-policy TD は Atari で発散する。

**Target network。** Bellman 方程式の両辺で同じネットワーク `Q(·; θ)` を使うと、更新のたびに target が動き、「自分の尻尾を追いかける」状態になる。解決策は、重みを固定した2つ目のネットワーク `Q(·; θ^-)` を持つことだ。`C` ステップごとに `θ → θ^-` をコピーする。これにより、数千回の勾配ステップにわたり回帰 target が安定する。DDPG や SAC で使われる soft update `θ^- ← τ θ + (1-τ) θ^-` は、より滑らかな変種である。

**Reward clipping。** Atari の報酬の大きさは 1 から 1000 以上までばらつく。`{-1, 0, +1}` に clip すると、単一のゲームが勾配を支配するのを防げる。報酬の大きさ自体が重要な場合には誤りだが、符号だけが重要な Atari では十分に機能する。

**Double DQN。** Hasselt (2016) は maximization bias を修正した。online net で行動を*選択*し、target net でその行動を*評価*する。

`target = r + γ Q(s', argmax_{a'} Q(s', a'; θ); θ^-)`

差し替えるだけで使え、一貫して性能が良い。デフォルトで使うべきである。

**その他の改善（Rainbow, 2017）。** prioritized replay（TD-error が大きい遷移をより多くサンプリング）、dueling architecture（`V(s)` と advantage head を分ける）、noisy networks（学習される探索）、n-step returns、distributional Q（C51/QR-DQN）、multi-step bootstrapping。各改善は数パーセントずつ効き、効果はおおむね加算的である。

## 作ってみる

ここでのコードは stdlib のみで numpy も使わない。小さな連続 GridWorld 上で、手書きの単一 hidden layer MLP を使うため、各訓練ステップはマイクロ秒で走る。アルゴリズムは、大規模な Atari DQN と同じである。

### ステップ1: replay buffer

```python
class ReplayBuffer:
    def __init__(self, capacity):
        self.buf = []
        self.capacity = capacity
    def push(self, s, a, r, s_next, done):
        if len(self.buf) == self.capacity:
            self.buf.pop(0)
        self.buf.append((s, a, r, s_next, done))
    def sample(self, batch, rng):
        return rng.sample(self.buf, batch)
```

Atari では容量 `~50,000`、この toy env では 5,000 で十分である。

### ステップ2: 小さな Q-network（手書き MLP）

```python
class QNet:
    def __init__(self, n_in, n_hidden, n_actions, rng):
        self.W1 = [[rng.gauss(0, 0.3) for _ in range(n_in)] for _ in range(n_hidden)]
        self.b1 = [0.0] * n_hidden
        self.W2 = [[rng.gauss(0, 0.3) for _ in range(n_hidden)] for _ in range(n_actions)]
        self.b2 = [0.0] * n_actions
    def forward(self, x):
        h = [max(0.0, sum(w * xi for w, xi in zip(row, x)) + b) for row, b in zip(self.W1, self.b1)]
        q = [sum(w * hi for w, hi in zip(row, h)) + b for row, b in zip(self.W2, self.b2)]
        return q, h
```

Forward pass は linear → ReLU → linear。ネットワーク全体はこれだけである。

### ステップ3: DQN update

```python
def train_step(online, target, batch, gamma, lr):
    grads = zeros_like(online)
    for s, a, r, s_next, done in batch:
        q, h = online.forward(s)
        if done:
            y = r
        else:
            q_next, _ = target.forward(s_next)
            y = r + gamma * max(q_next)
        td_error = q[a] - y
        accumulate_grads(grads, online, s, h, a, td_error)
    apply_sgd(online, grads, lr / len(batch))
```

形は Lesson 04 の Q-learning と同じで、違いは2つだけだ。(a) table を index する代わりに、微分可能な `Q(·; θ)` を backprop する。(b) target に `Q(·; θ^-)` を使う。

### ステップ4: 外側のループ

各 episode で、`Q(·; θ)` に対して ε-greedy に行動し、遷移を buffer に入れ、minibatch をサンプリングし、勾配ステップを行い、定期的に `θ^- ← θ` を同期する。パターンは次のとおり。

```python
for episode in range(N):
    s = env.reset()
    while not done:
        a = epsilon_greedy(online, s, epsilon)
        s_next, r, done = env.step(s, a)
        buffer.push(s, a, r, s_next, done)
        if len(buffer) >= batch:
            train_step(online, target, buffer.sample(batch), gamma, lr)
        if steps % sync_every == 0:
            target = copy(online)
        s = s_next
```

16次元 one-hot state を持つ小さな GridWorld では、エージェントは約500 episodes でほぼ最適な方策を学習する。Atari では、これを 200M frames まで拡張し、CNN feature extractor を追加する。

## 落とし穴

- **Deadly triad。** Function approximation + off-policy + bootstrapping は発散しうる。DQN は target net + replay で緩和しているため、どちらも外してはいけない。
- **Exploration。** ε は通常、訓練の最初の約10%で 1.0 から 0.01 へ減衰させる。初期探索が足りないと、Q-net は局所的な basin に収束する。
- **Overestimation。** ノイズを含む Q に対する `max` は上方バイアスを持つ。本番では常に Double DQN を使う。
- **Reward scale。** 報酬を clip または normalize する。勾配の大きさは報酬の大きさに比例する。
- **Replay buffer coldstart。** buffer に数千個の遷移が貯まるまで訓練しない。初期の `~20` サンプルに対する勾配は過学習する。
- **Target sync frequency。** 頻繁すぎると target net がないのと同じで、まれすぎると target が古くなる。Atari DQN は 10,000 env steps を使う。経験則として、訓練 horizon の約 `1/100` ごとに同期する。
- **Observation preprocessing。** Atari DQN は state を Markov にするため4フレームを stack する。速度情報を含む任意の env では、frame-stacking または recurrent state が必要になる。

## 使いどころ

2026年時点で、DQN が state-of-the-art であることは少ないが、off-policy algorithm の基準点であり続けている。

| タスク | 選ぶべき手法 | DQN ではない理由 |
|------|------------------|--------------|
| Discrete-action Atari-like | Rainbow DQN or Muesli | 同じ枠組みで、より多くの工夫がある。 |
| Continuous control | SAC / TD3 (Phase 9 · 07) | DQN には policy network がない。 |
| On-policy / high-throughput | PPO (Phase 9 · 08) | Replay buffer がなく、scale しやすい。 |
| Offline RL | CQL / IQL / Decision Transformer | Conservative Q targets により、bootstrapping の破綻を避ける。 |
| Large discrete action spaces (recommender) | DQN with action embedding, or IMPALA | 問題ない。表現の作り込みが重要。 |
| LLM RL | PPO / GRPO | Sequence-level であり step-level ではない。loss が異なる。 |

教訓はいまも有効である。Replay と target networks は SAC、TD3、DDPG、SAC-X、AlphaZero の self-play buffer、あらゆる offline RL method に現れる。Reward clipping は PPO の advantage normalization として生き続けている。このアーキテクチャは設計図である。

## 出荷する

`outputs/skill-dqn-trainer.md` として保存する。

```markdown
---
name: dqn-trainer
description: 離散行動 RL タスク向けに DQN training config（buffer、target sync、ε schedule、reward clipping）を作成する。
version: 1.0.0
phase: 9
lesson: 5
tags: [rl, dqn, deep-rl]
---

離散行動環境（observation shape、action count、horizon、reward scale）が与えられたら、次を出力する。

1. Network。Architecture（MLP / CNN / Transformer）、feature dim、depth。
2. Replay buffer。Capacity、minibatch size、warmup size。
3. Target network。Sync strategy（hard every C steps または soft τ）。
4. Exploration。ε start / end / schedule length。
5. Loss。Huber vs MSE、gradient clip value、reward clipping rule。
6. Double DQN。無効にする明示的理由がない限りデフォルトで有効。

Target network がない、replay buffer がない、または ε が 1 のまま固定された DQN は出荷を拒否する。連続行動タスクは拒否する（SAC / TD3 へルーティングする）。Reward range が per-step mean の 10× を超える場合は、clipping または scale normalization が必要だと指摘する。
```

## 演習

1. **初級。** `code/main.py` を実行する。Per-episode return curve を plot する。Running mean が -10 を超えるまでに何 episodes かかるか。
2. **中級。** Target network を無効にする（Bellman target の両側で online net を使う）。訓練の不安定さを測る。Return は振動または発散するか。
3. **上級。** Double DQN を追加する。Online net で `argmax a'` を選び、target net で評価する。Noisy-reward GridWorld で、1,000 episodes 後の `Q(s_0, best_a)` と真の `V*(s_0)` の bias を、Double DQN あり/なしで比較する。

## 重要用語

| 用語 | よく言われること | 実際の意味 |
|------|-----------------|-----------------------|
| DQN | "Deep Q-learning" | Neural Q-function、replay buffer、target network を使う Q-learning。 |
| Experience replay | "Shuffled transitions" | 各 gradient step で一様サンプリングされる ring buffer。データの相関を弱める。 |
| Target network | "Frozen bootstrap" | Bellman target で使う Q の定期コピー。訓練を安定させる。 |
| Deadly triad | "Why RL diverges" | Function approximation + bootstrapping + off-policy = 収束保証がない。 |
| Double DQN | "Fix for maximization bias" | Online net が行動を選び、target net が評価する。 |
| Dueling DQN | "V and A heads" | `Q = V + A - mean(A)` に分解する。同じ出力だが gradient flow が良くなる。 |
| Rainbow | "All the tricks" | DDQN + PER + dueling + n-step + noisy + distributional を1つにまとめたもの。 |
| PER | "Prioritized Replay" | TD-error magnitude に比例して遷移をサンプリングする。 |

## 参考文献

- [Mnih et al. (2013). Playing Atari with Deep Reinforcement Learning](https://arxiv.org/abs/1312.5602) — deep RL のきっかけとなった2013年 NeurIPS workshop paper。
- [Mnih et al. (2015). Human-level control through deep reinforcement learning](https://www.nature.com/articles/nature14236) — Nature paper。49-game DQN。
- [Hasselt, Guez, Silver (2016). Deep Reinforcement Learning with Double Q-learning](https://arxiv.org/abs/1509.06461) — DDQN。
- [Wang et al. (2016). Dueling Network Architectures](https://arxiv.org/abs/1511.06581) — dueling DQN。
- [Hessel et al. (2018). Rainbow: Combining Improvements in Deep RL](https://arxiv.org/abs/1710.02298) — 工夫を積み重ねた paper。
- [OpenAI Spinning Up — DQN](https://spinningup.openai.com/en/latest/algorithms/dqn.html) — 明快で現代的な解説。
- [Sutton & Barto (2018). Ch. 9 — On-policy Prediction with Approximation](http://incompleteideas.net/book/RLbook2020.pdf) — 「deadly triad」（function approximation + bootstrapping + off-policy）の教科書的説明。DQN の target network と replay buffer はこれを抑えるために設計されている。
- [CleanRL DQN implementation](https://docs.cleanrl.dev/rl-algorithms/dqn/) — ablation studies で使われる reference single-file DQN。この lesson の from-scratch 版と並べて読むとよい。
