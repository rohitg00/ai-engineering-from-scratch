# MARL — MADDPG, QMIX, MAPPO

> multi-agent coordination の reinforcement-learning heritage は、2026 年の LLM-agent systems にもなお影響している。**MADDPG**（Lowe et al., NeurIPS 2017, arXiv:1706.02275）は Centralized Training, Decentralized Execution（CTDE）を導入した。training 中は各 critic が全 agents の states と actions を見るが、test time には local actors だけが走る。cooperative、competitive、mixed settings で機能する。**QMIX**（Rashid et al., ICML 2018, arXiv:1803.11485）は monotonic mixing network を持つ value-decomposition で、per-agent Qs を joint Q に合成し、`argmax` が clean に分散できる。StarCraft Multi-Agent Challenge（SMAC）で dominant。**MAPPO**（Yu et al., NeurIPS 2022, arXiv:2103.01955）は centralized value function を持つ PPO で、particle-world、SMAC、Google Research Football、Hanabi において minimal tuning で「surprisingly effective」。これらは decentralized に行動しなければならない agent teams の training policies を支えている。MAPPO は **2026 cooperative-MARL baseline の default** である。この lesson では小さな grid-world toy から各手法を構築し、LLM-agent training に触れる前に 3 つの考え方を身体化する。

**種別:** 学習
**言語:** Python (stdlib, small NumPy-free implementations)
**前提条件:** Phase 09 (Reinforcement Learning), Phase 16 · 09 (Parallel Swarm Networks)
**所要時間:** 約90分

## 問題

LLM-agent systems は、agent 間 coordination の policies を training することが増えている。いつ defer するか、いつ act するか、どの peer を呼ぶか。そうした policies の training 方法を教える literature は Multi-Agent Reinforcement Learning（MARL）であり、LLM wave より前から存在し、dominant algorithms が少数ある。

pattern vocabulary なしに MARL papers を読むのはつらい。Centralized training with decentralized execution（CTDE）、value decomposition、centralized critics は buzzwords ではない。具体的な problems に対する具体的な answers である:

- Independent RL（各 agent が単独で学ぶ）は、各 agent から見た environment が non-stationary になる。悪い。
- Centralized RL（1 agent が全てを control）は scale せず、execution constraints に反する。
- CTDE は両方の良いところを取る。global information で train し、local policies で deploy する。

## コンセプト

### papers が使う 3 つの environments

- **Particle World（multi-agent particle env）。** cooperative/competitive tasks を持つ単純な 2D physics。MADDPG の original testbed。
- **StarCraft Multi-Agent Challenge（SMAC）。** cooperative micro-management、partial observation。QMIX の testbed。discrete actions、continuous states。
- **Google Research Football, Hanabi, MPE。** MAPPO baselines。

env ごとに action/observation types が異なる。algorithms はそれに応じて選ばれる。

### MADDPG（2017）— CTDE pattern

各 agent `i` は、自身の observation を action に map する actor `mu_i(o_i)` を持つ。各 agent には、training 中に全 observations と全 actions を見る critic `Q_i(x, a_1, ..., a_n)` もある。actor は critic の evaluation に対する policy gradient で update される。

```
actor update:    grad_theta_i J = E[grad_theta mu_i(o_i) * grad_a_i Q_i(x, a_1..n) at a_i=mu_i(o_i)]
critic update:   TD on Q_i(x, a_1..n) given next-state joint estimate
```

なぜ CTDE か。training time には全員の actions が分かるので、それを使って各 critic の variance を下げる。deploy time には各 agent は `o_i` だけを見て `mu_i(o_i)` を呼ぶ。

failure mode: critics は N agents とともに大きくなる（input が全 actions を含む）。approximation なしでは ~10 agents を超えると scale しにくい。

### QMIX（2018）— value decomposition

cooperative only。global reward は per-agent Q-values の monotone function の和で表される:

```
Q_tot(tau, a) = f(Q_1(tau_1, a_1), ..., Q_n(tau_n, a_n)),   df/dQ_i >= 0
```

monotonicity は、`argmax_a Q_tot` を各 agent が独立に `argmax_{a_i} Q_i` を選ぶことで計算できることを保証する。これは必要な **decentralized execution property** そのものである。training time には mixing network が per-agent Qs から `Q_tot` を生成する。

QMIX が SMAC で勝つ理由: cooperative StarCraft micro-management は homogeneous agents、local obs、global reward であり、value decomposition に完全に合う。

failure mode: monotonicity constraint は制約的である。一部の tasks は monotone decomposable でない reward structures を持つ（1 agent が team のために sacrifice するなど）。extensions（QTRAN、QPLEX）がこれを緩和する。

### MAPPO（2022）— 見落とされていた default

Multi-Agent PPO は centralized value function を持つ PPO である。各 agent は独自 policy を持つ。全 agents は full state を見る value functions を共有する（または per-agent に持つ）。Yu et al. 2022 は MAPPO を MADDPG、QMIX、およびそれらの extensions と 5 benchmarks で比較し、次を見いだした:

- MAPPO は particle-world、SMAC、Google Research Football、Hanabi、MPE において off-policy MARL methods に匹敵、または上回る。
- hyperparameter tuning は最小限でよい。
- training が stable で、seeds をまたいで reproducible。

この paper まで、community は on-policy MARL を過小評価していた。2026 年には MAPPO が cooperative MARL の default baseline であり、新手法はそれを上回る必要がある。

### LLM-agent engineers が気にすべき理由

直接の用途は 3 つある:

1. **Router training。** meta-agent がどの sub-agent に task を渡すかを選ぶ。これは N decentralized sub-agents と 1 centralized router を持つ MARL problem である。MAPPO が合う。
2. **Role emergence。** generative-agent simulations で、agents が時間とともに complementary roles を採用するよう train するのは、変装した MARL problem である。QMIX-style value decomposition は complementarity を構造的に強制する。
3. **Multi-agent tool use。** agents が tools を共有し budget を競う場合、CTDE で train すれば resource constraints を守る deployable local policies が得られる。

実用上の caveat: 2026 年の production LLM-agent systems の多くは policies を train するのではなく prompt している。MARL が入るのは、(a) 大量の interaction data、(b) 明確な reward signal、(c) training infrastructure への投資意思、があるときである。

### RL を超えた design pattern としての CTDE

training しなくても、CTDE は有用な architectural pattern である:

- *design* 時には full team visibility を仮定する。
- *runtime* では decentralized execution を enforce する。各 agent は `o_i` だけを見る。

この pattern は per-agent state を explicit に保つこと、partial observability を upfront に考えることを強制する。多くの production multi-agent systems は shared state everywhere を暗黙に仮定する。CTDE discipline はそれを防ぐ。

### non-stationarity problem

複数 agents が同時に learn すると、各 agent の environment（他 agents の policies を含む）は non-stationary になる。classical single-agent RL proofs は崩れる。この lesson の MARL algorithms はすべてこれに対処する:

- MADDPG: global critic が全 actions を見るため、value estimate が stationary になる。
- QMIX: value decomposition が learning を joint-Q space に移し、optimality を well-defined にする。
- MAPPO: centralized value function が他 agents の policy changes による variance を dampen する。

LLM-agent systems では、non-stationarity は「自分の agent は先月動いたが、upstream の別 agent が変わったので誤動作する」という形で現れる。CTDE で MARL を train するのが principled fix である。prompt-level fixes は速いが耐久性が低い。

### この lesson が扱わないこと

actual networks の training は Phase 09 の topic である。この lesson では、gradient updates なしに CTDE、value-decomposition、centralized-value patterns を示す scripted-policy versions を作る。目的は full MARL library（PyMARL、MARLlib、RLlib multi-agent）を使う前に patterns を内面化すること。

## 実装

`code/main.py` は、すべて tiny 2-agent cooperative grid-world 上で 3 つの pattern demonstrations を実装する:

- Environment: 4x4 grid 上の 2 agents と 1 reward pellet。reward = いずれかの agent が pellet に到達したら 1。task は終了。
- `IndependentAgents` — 各 agent は others を environment として扱う。baseline。
- `MADDPGStyle` — centralized critic が joint value を計算し、actor policies はそこから update する。scripted policy improvement。
- `QMIXStyle` — monotone mixer による value decomposition。
- `MAPPOStyle` — centralized value function。policies は shared baseline に対して update する。

4 つすべてが同じ episodes を走り、average steps-to-goal を報告する。CTDE variants は independent baseline より短い paths に収束する。

Run:

```
python3 code/main.py
```

期待される出力: independent agents は平均約 6 steps、CTDE variants は約 3.5 steps へ近づく（4x4 grid の optimal は 3）。scripted policies でも pattern difference が出る。

## Use It

`outputs/skill-marl-picker.md` は、given multi-agent task に対し MARL algorithm を選ぶ skill である。cooperative vs competitive、homogeneous vs heterogeneous、action-space type、scale、reward signal を見る。

## Ship It

production の MARL は稀である。使う場合:

- **MAPPO から始める。** 2022 paper が baseline として確立した。まず再現すると fancier methods を追い回す数週間を節約できる。
- **全 agent の observation and action stream を log する。** per-agent traces なしの MARL debugging は絶望的。
- **training code と execution code を分離する。** CTDE は discipline である。execution path には本当に `o_i` だけを見せる。
- **Reward shaping warning。** MARL は reward design に極めて敏感である。shaping の coordination bug 1 つで、agents はそれを exploit する。adversarial tests を走らせる。
- **LLM agents では** まず prompt-level policies を検討する。interaction data + reward signal + infrastructure がすべて揃ったときだけ MARL training に投資する。

## Exercises

1. `code/main.py` を実行する。independent と MAPPO-style agents の steps-to-goal gap を測る。6x6 grid では gap は広がるか縮むか。
2. competitive variant を実装する: 2 agents、1 pellet、最初に到達した agent だけが reward を得る。competition を clean に扱える pattern はどれか。歴史的には MADDPG。
3. MADDPG（arXiv:1706.02275）Section 3 を読む。exact critic update rule を自分の言葉で pseudocode として symbolically に実装する。
4. MAPPO（arXiv:2103.01955）を読む。authors はなぜ centralized value + PPO が benchmarks で off-policy MARL に勝つと論じているか。最も強い claims を 3 つ列挙する。
5. hypothetical LLM-agent system（例: research agent + summarizer + coder）に design pattern として CTDE を適用する。design time に使えるが runtime には使えない joint information は何か。

## Key Terms

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| MARL | 「Multi-Agent RL」 | multi-agent systems のための reinforcement learning。 |
| CTDE | 「Centralized Training, Decentralized Execution」 | global info で train し、local policies で deploy する。 |
| MADDPG | 「Multi-Agent DDPG」 | 全 observations + actions を見る per-agent critic を持つ CTDE。 |
| QMIX | 「Value decomposition」 | per-agent Qs の monotonic mixing。cooperative。 |
| MAPPO | 「Multi-Agent PPO」 | centralized value function を持つ PPO。2026 default baseline。 |
| Value decomposition | 「individual Qs の合計」 | joint Q を per-agent Qs の monotone function として表す。 |
| Non-stationarity | 「moving targets」 | others が learn するにつれ各 agent の env が変わること。MARL の核心問題。 |
| On-policy / off-policy | 「current / replay から学ぶ」 | PPO は on-policy（MAPPO）。DDPG と Q-learning は off-policy。 |
| SMAC | 「StarCraft Multi-Agent Challenge」 | cooperative micromanagement benchmark。QMIX の本拠地。 |

## 参考文献

- [Lowe et al. — Multi-Agent Actor-Critic for Mixed Cooperative-Competitive Environments](https://arxiv.org/abs/1706.02275) — MADDPG; NeurIPS 2017
- [Rashid et al. — QMIX: Monotonic Value Function Factorisation for Deep Multi-Agent Reinforcement Learning](https://arxiv.org/abs/1803.11485) — QMIX; ICML 2018
- [Yu et al. — The Surprising Effectiveness of PPO in Cooperative Multi-Agent Games](https://arxiv.org/abs/2103.01955) — MAPPO; NeurIPS 2022
- [BAIR blog post on MAPPO](https://bair.berkeley.edu/blog/2021/07/14/mappo/) — MAPPO result の読みやすい framing
- [SMAC repository](https://github.com/oxwhirl/smac) — StarCraft Multi-Agent Challenge
