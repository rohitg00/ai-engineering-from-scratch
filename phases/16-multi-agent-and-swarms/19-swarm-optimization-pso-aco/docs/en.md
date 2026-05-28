# LLM のための Swarm Optimization（PSO, ACO）

> Bio-inspired optimization が LLM 時代に戻ってきている。**LMPSO**（arXiv:2504.09247）は PSO を使い、各 particle の velocity を prompt として、LLM が次の candidate を生成する。structured-sequence outputs（math expressions、programs）でよく機能する。**Model Swarms**（arXiv:2410.11163）は各 LLM expert を model-weight manifold 上の PSO particle とみなし、200 instances だけで 9 datasets / 12 baselines に対して **13.3% average gain** を報告した。**SwarmPrompt**（ICAART 2025）は prompt optimization のために PSO + Grey Wolf を hybridize する。**AMRO-S**（arXiv:2603.12933）は multi-agent LLM routing 向けの ACO-inspired pheromone specialists で、**4.7x speedup**、interpretable routing evidence、inference と learning を decouple する quality-gated asynchronous update を備える。この lesson では prompt parameter space 上の PSO と agent routing 上の ACO を実装し、これらの classical algorithms が LLM 時代に合う理由と、合わない場合を測る。

**種別:** 学習 + 構築
**言語:** Python (stdlib)
**前提条件:** Phase 16 · 09 (Parallel Swarm Networks), Phase 16 · 14 (Consensus and BFT)
**所要時間:** 約75分

## 問題

task eval で 62% の score を出す prompt がある。改善したい。naive な方法は gradient-free の manual tweaking だが、scale しない。reinforcement learning には reward signals と十分な rollouts が必要である。prompt への backprop は実質的に不可能だ。prompt は differentiable parameter ではなく discrete string だからである。

classical bio-inspired optimization、つまり continuous search spaces 向けの PSO と path selection 向けの ACO は、この regime のために作られた。gradient-free、population-based、per evaluation が安い。LLM と組み合わせて gradient-free search step を担わせると、驚くほど実用的な optimizer になる。

同じ patterns は multi-agent systems の agent *routing* にも適用できる。ACO-style pheromone trail は、どの agent がどの task-type で最も良かったかを記録し、router がその trail を exploit できるようにし、pheromone を decay させて routes を再発見できるようにする。

## コンセプト

### PSO refresher（Kennedy & Eberhart 1995）

Particle Swarm Optimization は continuous search space 内の particles の population である。各 particle は position `x_i` と velocity `v_i` を持つ。各 iteration:

```
v_i <- w * v_i + c1 * r1 * (p_best_i - x_i) + c2 * r2 * (g_best - x_i)
x_i <- x_i + v_i
evaluate fitness(x_i)
update p_best_i if improved
update g_best if global best
```

`p_best` は particle 自身の best、`g_best` は swarm の best、`w, c1, c2` は inertia + cognitive + social weights、`r1, r2` は random factors である。

### LLM outputs 上の PSO — LMPSO

arXiv:2504.09247 は、LLM-generated structured outputs（math expressions、programs）向けに PSO を適応する。各 particle は candidate output である。velocity は、current output を personal/global best に近づける変更方法を記述する *prompt* である。LLM は velocity prompt から new output を生成する。velocity の「inertia」は「make small incremental changes」のような prompt になる。

これは次の場合によく機能する:
- output が structured（parseable, evaluable）。
- fitness が automatic（test runs、arithmetic evaluation）。
- population が小さい（~10-30 particles）ため total LLM calls が manageable。

fitness が human review を必要とする場合はうまくいかない。per-iteration cost が prohibitive になる。

### Model Swarms

arXiv:2410.11163 は PSO を output layer から *model* layer に移す。各「particle」は expert LLM（parameters）である。swarm は gradient-free update により parameters を collective best へ動かす。報告値は、iteration あたり 200 instances だけで、9 datasets において 12 baselines に対し 13.3% average gain。

key insight は、LLM expert models はすでに shared parameter manifold（adapter weights、LoRA deltas）上で近くにあるという点である。この low-dimensional subspace での PSO は安く効果的である。

### ACO refresher（Dorigo 1992）

Ant Colony Optimization では、ants が graph を traverses し、各 path が pheromone trail を持つ。ant の move probabilities は pheromone strength で重みづけされる。task を完了した ants は solution quality に比例した pheromone を deposit する。pheromone は time とともに decay する。

### AMRO-S — agent routing のための ACO

arXiv:2603.12933 は multi-agent routing に ACO を使う。各 task-type は「destination」、各 agent は possible route である。良い outputs を出した routes の pheromone が強くなる。key contributions:

- **Interpretable routing evidence。** Pheromone strength は human-readable signal。
- **Quality-gated asynchronous update。** Pheromone は quality checks に合格した後だけ update され、inference と learning を decouple する。
- multi-agent routing benchmark で **4.7x speedup**。

quality gate は重要である。これがないと fast-but-wrong agents が pheromone を獲得し、system が悪い routes に lock in する。

### LLM に PSO / ACO を使うべきとき

**PSO を使うとき:**
- search space が continuous、または continuous parameters（prompt embeddings、LoRA weights、numeric generation parameters）に map できる。
- fitness が cheap and automatic。
- population を小さくできる（10-30）。

**ACO を使うとき:**
- routing または path-selection problem がある。
- decisions が time とともに reinforce する（同じ task types が戻ってくる）。
- routing decisions の interpretable evidence が必要。

**どちらも使わないとき:**
- fitness に human review が必要（per iteration が高すぎる）。
- search space が PSO で扱えない形の discrete and combinatorial（代わりに genetic algorithms）。
- real-time decisions に strict latency が必要（PSO/ACO は single-pass heuristics に比べ収束が遅い）。

### bio-inspired がまだ勝つ理由

gradient-based methods には differentiable signals が必要である。LLM outputs と routing decisions は簡単には differentiable でない。Pseudo-gradient methods（reinforcement-learned routers、DPO-style prompt tuners）は機能するが、expensive training が必要である。

PSO と ACO が必要とするのは *evaluator* function だけである。candidate output または routing decision を score できるなら、その space を optimize できる。これにより applicability の bar がずっと低くなる。

### practical limits

- **Population budget。** N particles × T iterations × per-eval cost。LLM eval が ~$0.02 / call なら、20-particle PSO を 50 iterations 走らせると約 $20。計画しておく。
- **Exploration vs exploitation。** Pheromone decay rate と PSO inertia は trade off する。decay が速すぎる → solutions を忘れる。遅すぎる → early local optima に stuck。
- **Catastrophic drift。** fitness landscape が shift（new data distribution）すると、どちらの algorithm も converge 後に diverge し得る。best-fitness stability を monitor する。

## 実装

`code/main.py` は次を実装する:

- `LMPSO` — numeric prompt parameters（temperature、top_k weights）上の PSO。各 particle の「LLM generation」は scripted fitness function として simulate する。algorithm を 30 iterations 走らせ、g_best convergence を示す。
- `AMRO_S` — ACO-style routing。3 agents、4 task types、pheromone matrix、100 routed tasks。trail formation を示すため、time とともに（task_type → agent choices）distribution を print する。
- Comparison: same task stream 上の random routing vs ACO routing。quality と latency を測る。

Run:

```
python3 code/main.py
```

期待される出力:
- LMPSO: g_best fitness が random から 30 iterations で near-optimal へ改善する。
- AMRO-S: pheromone table が task-type ごとの正しい agent に安定する。ACO routing は random より quality で約 30-40% 勝ち、latency も下げる（retries が少ない）。

## Use It

`outputs/skill-swarm-optimizer.md` は、LLM / agent optimization problems に対して PSO、ACO、genetic algorithms、gradient-based optimizers のどれを選ぶかを支援する。

## Ship It

- **小さく始める。** 10-20 particles、20-50 iterations。convergence curve が明確な gain を示す場合だけ scale up する。
- **iteration ごとに pheromones または g_best を log する。** trail なしで swarm optimizers を debug するのはつらい。
- **Quality-gate updates。** 特に ACO routing では、fast-and-wrong agents に pheromone を蓄積させてはいけない。
- **distribution shift では decay を reset する。** eval distribution が変わったら aged pheromones は stale。reset するか decay rate を一時的に 2 倍にする。
- **per-iteration cost を cap する。** cost-per-iteration metric を emit する。$500 / iteration かかって 0.5% しか得しない PSO は shippable ではない。

## Exercises

1. `code/main.py` を実行する。LMPSO convergence を観察する。population size を 5、10、20、50 に変える。time-to-converge はどの size で saturate するか。
2. 「catastrophic drift」experiment を実装する: iteration 30 の後で fitness function を変える。PSO はどれだけ早く adapt するか。`p_best` の reset は効くか。
3. AMRO-S に quality gate を追加する: eval score > 0.7 の runs にだけ pheromone deposit する。un-gated version と比べて convergence はどう変わるか。
4. LMPSO（arXiv:2504.09247）を読む。paper の「velocity as a prompt」を、自分の numeric velocity に対応づける。simulation で失われているもの、保たれているものは何か。
5. AMRO-S（arXiv:2603.12933）を読む。decoupled「inference fast-path」と asynchronous pheromone update を実装する。sustained load 下で system latency はどう変わるか。

## Key Terms

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| PSO | 「Particle Swarm Optimization」 | Kennedy-Eberhart 1995。population-based gradient-free optimizer。 |
| ACO | 「Ant Colony Optimization」 | Dorigo 1992。pheromone trails による path/route optimization。 |
| LMPSO | 「LLM generation を使う PSO」 | arXiv:2504.09247。velocity は prompt、LLM が candidates を生成する。 |
| Model Swarms | 「expert weights 上の PSO」 | arXiv:2410.11163。model parameter subspace 上の gradient-free update。 |
| AMRO-S | 「agent routing の ACO」 | arXiv:2603.12933。task-type × agent の pheromone matrix。 |
| p_best / g_best | 「personal / global best」 | これまで見つかった per-particle と swarm-wide の best solutions。 |
| Pheromone | 「routing memory」 | edge 上の strength。time とともに decay し、quality に応じて deposit される。 |
| Quality-gated update | 「良い runs からだけ学ぶ」 | quality check を条件にした pheromone deposit。 |
| Catastrophic drift | 「distribution shift」 | fitness landscape が変わり、古い p_best と pheromones が stale になる。 |

## 参考文献

- [Kennedy & Eberhart — Particle Swarm Optimization](https://ieeexplore.ieee.org/document/488968) — 1995 年の PSO paper
- [Dorigo — Ant Colony Optimization](https://www.aco-metaheuristic.org/about.html) — 1992 年の ACO foundations
- [LMPSO — Language Model Particle Swarm Optimization](https://arxiv.org/abs/2504.09247) — structured LLM outputs 向け PSO
- [Model Swarms — gradient-free LLM expert optimization](https://arxiv.org/abs/2410.11163) — model-weight subspace 上の PSO
- [AMRO-S — ant-colony multi-agent routing](https://arxiv.org/abs/2603.12933) — quality gate 付き pheromone-driven routing
