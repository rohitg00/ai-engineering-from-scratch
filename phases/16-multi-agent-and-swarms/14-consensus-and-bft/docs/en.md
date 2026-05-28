# Consensus and Byzantine Fault Tolerance for Agents

> 古典的 distributed-systems BFT が stochastic LLM と出会う。2025-2026 年には3つの研究方向が出てきた。**CP-WBFT** (arXiv:2511.10400) は confidence probe で各 vote を重み付けする。**DecentLLMs** (arXiv:2507.14928) は leaderless で、parallel worker proposal と geometric-median aggregation を使う。**WBFT** (arXiv:2505.05103) は weighted voting と Hierarchical Structure Clustering を組み合わせ、Core node と Edge node に分ける。"Can AI Agents Agree?" (arXiv:2603.01213) の率直な empirical result は、現在は scalar agreement すら fragile だということだ。1つの deceptive agent が Mixture-of-Agents を compromise できる。BFT は必要だが十分ではない。この lesson は minimal BFT protocol を作り、agent-specific attack を3つ (byzantine lie、sycophantic conformity、correlated-error monoculture) 注入し、各 consensus variant がどう耐えるかを測る。

**種別:** 学習 + 構築
**言語:** Python (stdlib)
**前提条件:** Phase 16 · 07 (Society of Mind and Debate), Phase 16 · 13 (Shared Memory)
**所要時間:** 約75分

## 問題

N 個の LLM agent がそれぞれ answer を出す。意見が割れる。2つの agent が correlated (同じ base model、同じ training data、同じ failure mode) しているため、majority vote は間違った answer を選ぶ。3つ目の agent はたまたま新しい形で間違っている。結果として majority は false majority になる。

そこに deceptive agent を加える。意図的に嘘をつく。あるいは sycophantic agent は、最後に話した相手に同調する。古典的 BFT では、Byzantine node は `f < n/3` の割合で任意に振る舞うと仮定する。2026 年の現実では、LLM node は honest でも stochastic であり、model 間で correlated し、互いの output に影響される。独立した Bernoulli voter として扱うことはできない。

古典的 BFT (PBFT, 1999) は間違っていない。だが不完全だ。任意の bit-flipping は扱う。しかし「3つの honest agent が同じ training data を共有するため、同じ hallucination を共有する」は扱わない。この lesson では PBFT の foundation から始め、2025-2026 年の adaptation を3つ layer する。

## コンセプト

### What classical BFT gives you

Practical Byzantine Fault Tolerance (Castro & Liskov, OSDI 1999) は `f < n/3` の Byzantine node に耐える。protocol には3 phase (pre-prepare、prepare、commit) と2 primitive (signed messages、quorum certificates) がある。`n >= 3f + 1` の honest-or-malicious node の間で単一 value に合意する。

guarantee は強いが、次を仮定する:

1. **Independent faults.** Byzantine は協調しない。
2. **Honest nodes are truly honest.** honest output の correctness は問題にしない。protocol は disagreement を揃えるだけ。
3. **The question has a ground-truth answer.** 間違った fact への consensus も consensus である。

LLM agents は3つすべてに違反する。同じ base model を動かす2 agent は fault を共有する。"honest" な LLM も hallucinate する。ambiguous question では、「truth」は agent が決めるものであり、external oracle はない。

### The three LLM-specific attacks

**Byzantine lie.** 1つの agent が意図的に間違った answer を出す。`f < n/3` なら古典的 BFT はこれを扱う。

**Sycophantic conformity.** 1つの agent が他 agent の answer を読んでから vote し、最後に話した相手に合わせる。malicious ではないが、最も大きな声と correlated する。agent はすべての signature check に pass するため、古典的 BFT はこれを防がない。

**Correlated-error monoculture.** 3つの agent が base model を共有する。同じ wrong answer を hallucinate する。majority は間違う。3つ全員が「honestly」合意しているため、古典的 BFT は助けにならない。

### The 2025-2026 responses

**CP-WBFT** (arXiv:2511.10400) — Confidence-Probed Weighted BFT。各 voter が answer に confidence probe (self-reported probability、または separate calibration model の prediction) を付ける。vote weight は confidence に応じて scaling される。complete graph 上で +85.71% の BFT improvement が報告された。mitigation 対象: sycophantic conformity (conforming agent は自分で導いた position ではないため confidence が低くなりがち)。

**DecentLLMs** (arXiv:2507.14928) — leaderless。worker agent が parallel に propose し、evaluator agent が proposal を score し、final answer は scored position の geometric median になる。`f < n/2` で robust。mitigation 対象: Byzantine lie と correlated errors (geometric median は outlier に robust で、model-biased average ではなく dense cluster に寄せる)。

**WBFT** (arXiv:2505.05103) — Hierarchical Structure Clustering 付き Weighted BFT。vote weight は response quality と history から学習した trust score で割り当てる。agent を Core と Edge に cluster する。まず Core agents が consensus を達成し、Edge agents が従う。mitigation 対象: scalability (Core consensus は小さく速い) と、部分的には monoculture (Core を diversity で選べる)。

### Empirical: "Can AI Agents Agree?" (arXiv:2603.01213)

この paper は複数の frontier model で scalar agreement (LLM agent が単一 numeric value に合意すること) を測る。結果は不都合だ:

- adversary がいなくても、多くの benchmark で LLM agent は scalar question に 30% を超える rate で disagree する。
- deceptive persona を採用した1つの agent が、Mixture-of-Agents consensus を honest baseline から 40+ percentage points ずらせる。
- disagreement rate は model diversity と相関する。heterogeneous ensemble は homogeneous ensemble より disagree しやすい (良い点: uncorrelated errors) が、agreement に向かう drift も遅い (悪い点: time-to-agreement が長い)。

takeaway: BFT は output を揃える machinery をくれるが、揃った output が正しいかは教えてくれない。verification (Phase 16 · 08 role specialization)、diversity (Phase 16 · 15 debate variants)、evaluator agents (Phase 16 · 24 benchmarks) と組み合わせる。

### The core protocol, stripped down

LLM agents 向けの minimal BFT round:

```
1. task arrives; each agent i produces answer a_i
2. each agent attaches confidence probe c_i in [0, 1]
3. aggregator collects (a_i, c_i) from all n agents
4. aggregator groups by semantic cluster (equivalent answers)
5. aggregator computes weight for each cluster C:
     w(C) = sum_{i in C} c_i
6. winner = cluster with max weight, if max > threshold * sum(c_i)
   else: retry or escalate
7. minority clusters logged with provenance for post-hoc audit
```

semantic clustering step が LLM-specific な twist だ。2つの answer "the study reports 4.2%" と "4.2% improvement" は同じ cluster である。naive string-equality check ではこれを見逃す。production では cheap embedding model または explicit canonicalization を使う。

### Threshold tuning

`threshold` parameter は accept と retry の境界を決める。低すぎると weak majority を accept する。高すぎると何も accept しない。empirical range は `n=5-7` agents で 0.5-0.67、小さい `n` ではさらに高い。threshold 未満なら human または別の agent ensemble に escalate する。

### Where consensus does not help

- **Ambiguous questions.** ground truth がない question では consensus は opinion である。そう呼ぶ。
- **Compound questions.** 「code を書き、説明せよ」は2つの answer だ。個別に vote する。
- **Adversarial multi-round.** agent が prior round を observe して mimic できると (Du 2023 debate)、truth に関係なく互いに同意し始める。round を bound する (通常 2-3)。

## 実装

`code/main.py` は次を実装する:

- `AgentVoter` — (answer, confidence) を持つ scripted policy。
- `MajorityVote` — classical plurality。
- `CPWBFT` — semantic clustering 付き confidence-weighted voting。
- `DecentLLMs` — scored proposal に対する geometric-median aggregation。
- `Scenario` — 3つの attack pattern 下で各 aggregator を実行する。

実装済みの attack pattern:

1. `byzantine`: 1 agent が高 confidence で嘘をつく。
2. `sycophancy`: 1 agent が最初に見た answer を matching confidence で copy する。
3. `monoculture`: 3 agent が wrong answer (correlated error) を moderate confidence で共有する。

Run:

```
python3 code/main.py
```

期待される出力: (attack, aggregator) -> final answer の table。correct answer が強調される。Plurality は monoculture case で失敗する。CPWBFT の confidence weighting は sycophancy を緩和する。DecentLLMs の geometric-median は、monoculture が population の半分未満なら honest cluster に寄せる。

## Use It

`outputs/skill-consensus-designer.md` は multi-agent ensemble の consensus protocol を設計する。clustering method、weighting、threshold、sub-threshold round の escalation policy を決める。

## Ship It

consensus mechanism を ship する前に:

- **上の3 pattern で attack-test する。** protocol は silently ではなく predictably に fail すべき。
- **すべての minority cluster を provenance 付きで log する。** minority cluster は correlated error の early-warning system である。
- **bounded rounds を強制する。** 「agreement まで debate し続ける」は禁止。sycophancy に報酬を与える。
- **agreement と correctness を分離する。** consensus output は verifier に渡す。verifier は ensemble から independent にする。
- **agreement rate を monitor する。** 急上昇は conformity bias、急低下は model drift を意味する。

## Exercises

1. `code/main.py` を実行する。plurality が monoculture attack で失敗し、monoculture confidence が 0.7 未満なら CPWBFT が部分的に緩和することを確認する。
2. 4つ目の attack pattern を追加する: **silent abstention** — 1つの agent が answer を拒否する ("I don't know")。各 aggregator は abstention をどう扱うべきか。選択を実装する。
3. semantic clustering を string canonicalization から embedding-similarity に入れ替える (任意の open-source embedding model を使う)。sycophancy attack に何が起きるか。
4. CP-WBFT (arXiv:2511.10400) を読む。confidence-probe calibration step (separate calibration model が各 agent の self-reported confidence を検査する) を実装する。monoculture scenario で accuracy gain を測る。
5. "Can AI Agents Agree?" (arXiv:2603.01213) を読む。簡略化した scalar-agreement experiment を再現する。3 agent、1 scalar question、deceptive-persona prompt。CPWBFT または DecentLLMs は捕捉できるか。

## Key Terms

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| BFT | "Byzantine fault tolerance" | `f < n/3` の任意 fault 下で consensus を取る Castro-Liskov 1999 protocol。 |
| Byzantine | "Any bad behavior" | 嘘をつく、message を落とす、silent fail するなど、safe crash 以外の挙動をする node。 |
| Confidence probe | "How sure are you?" | vote に付く self-reported または calibrator-predicted probability。 |
| Semantic clustering | "Same answer, different words" | vote count 前に equivalent answer を group 化すること。 |
| Geometric median | "Robust center" | sample point までの distance の和を最小化する点。mean と違い outlier に robust。 |
| Monoculture | "Same model, same failures" | agent が training data や base model を共有することで起きる correlated errors。 |
| Sycophantic conformity | "Agreeing with the loud voice" | 最初または最も大きい声の agent に vote が bias すること。 |
| Core/Edge | "Hierarchical BFT" | WBFT split。小さな Core consensus が先、Edge node が従う。latency を bound する。 |

## 参考文献

- [Castro & Liskov — Practical Byzantine Fault Tolerance (OSDI 1999)](https://pmg.csail.mit.edu/papers/osdi99.pdf) — foundation
- [CP-WBFT — Confidence-Probe Weighted BFT](https://arxiv.org/abs/2511.10400) — confidence による vote weighting
- [DecentLLMs — leaderless multi-agent consensus](https://arxiv.org/abs/2507.14928) — geometric-median aggregation
- [WBFT — Weighted BFT with Hierarchical Structure Clustering](https://arxiv.org/abs/2505.05103) — bounded latency のための Core/Edge split
- [Can AI Agents Agree?](https://arxiv.org/abs/2603.01213) — scalar-agreement fragility と deceptive-persona attack
