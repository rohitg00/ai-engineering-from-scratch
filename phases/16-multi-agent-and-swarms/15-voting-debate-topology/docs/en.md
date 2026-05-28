# Voting, Self-Consistency, and Debate Topology

> 最も安い aggregation は、N 個の independent agent を sample して majority-vote することだ。Wang et al. 2022 の self-consistency は、1つの model を N 回 sample してこれを行った。multi-agent は、monoculture から逃れるために **heterogeneous** agents へ拡張する。異なる models、異なる prompts、異なる temperatures、異なる contexts。majority vote を超えると debate topology が重要になる。MultiAgentBench (arXiv:2503.01935, ACL 2025) は star / chain / tree / graph coordination を評価し、**research では graph が最良**で、約4 agent を超えると "coordination tax" が出ることを示した。AgentVerse (ICLR 2024) は2つの emergent pattern、volunteer behaviors と conformity behaviors を文書化している。conformity は feature (consensus を見つける) でもあり、risk (groupthink、Lesson 24) でもある。この lesson では topology space を map し、各 variant を作り、coordination tax を測る。

**種別:** 学習 + 構築
**言語:** Python (stdlib)
**前提条件:** Phase 16 · 07 (Society of Mind and Debate), Phase 16 · 14 (Consensus and BFT)
**所要時間:** 約75分

## 問題

debate は accuracy を改善し得る (Du et al., arXiv:2305.14325)。同時に悪化させることもある。debate が効くかは4つの structural choice に依存する:

1. 誰が誰と話すか (topology)。
2. round 数 (Du 2023: round と agent 数はそれぞれ独立に効く)。
3. agent が heterogeneous かどうか (異なる base model は monoculture を壊す)。
4. adversarial voice が存在するかどうか (steel-manning vs. straw-manning)。

「5 agent を走らせて vote する」を task に後付けする team は、single agent より悪化することが多い。failure は random ではない。topology と heterogeneity に従って起きる。この lesson は topology map である。

## コンセプト

### Self-consistency, the single-model baseline

Wang et al. 2022 ("Self-Consistency Improves Chain of Thought Reasoning") は、同じ model を temperature > 0 で N 回 sample し、reasoning-path answer に majority vote した。GSM8K では、N=40 samples が single greedy decode より大きく改善した。self-consistency は multi-agent voting の single-agent precursor である。

制限: self-consistency は1つの base model を使う。error は構造上 correlated する。model が systematic bias を持つなら、N samples すべてがそれを共有する。

### Multi-agent vote, the heterogeneous extension

N samples を N 個の *異なる* agent に置き換える。異なる base models (Claude、GPT、Llama)、異なる prompts、異なる tool access。利点は uncorrelated errors。cost は、agent ごとに費用が異なり、coordination overhead が増えること。

heterogeneous debate の 2026 年の canonical name は **A-HMAD** — Adversarial Heterogeneous Multi-Agent Debate。完全に普及しているわけではないが、paper では「異なる model が debate し、monoculture collapse 由来の correlated errors を減らす」ものとしてこの term を使う。

### The four topologies

```
star                chain               tree                graph

    ┌─A─┐           A─B─C─D         ┌──A──┐              A───B
    │   │                           │     │              │ × │
    B   C                           B     C              D───C
    │   │                          / \   / \
    D   E                         D   E F   G           (fully connected)
```

Star: 1つの hub。ほかは hub とだけ話す。back-channel のない supervisor-worker に相当する。
Chain: linear。各 agent は前の agent の output を見る。pipeline-like。
Tree: hierarchical。hierarchical agent system (Lesson 06) で使われる。
Graph: any-to-any。fully-connected clique と任意 DAG を含む。

### The coordination tax (MultiAgentBench)

MultiAgentBench (MARBLE, ACL 2025, arXiv:2503.01935) は、research、coding、planning を含む task suite で star、chain、tree、graph を benchmark した。主要な測定結果:

- **Graph** topology は research task で勝つ。information が any-to-any に流れ、agent が互いに critique できる。
- **Star** は fast-answer factual task で勝つ。hub が filter し consolidate する。
- **Chain** は stepwise pipeline (staged refinement) で勝つ。
- **Coordination tax** は graph topology で約4 agent を超えると現れる。wall-clock と token cost が quality より速く増える。

4-agent ceiling は empirical であり fundamental ではない。2026 年の LLM context capacity を反映している。各 agent の context が peer output で埋まり、全員が全員を見られるようになると agent N+1 の marginal value が落ちる。

### Multi-Agent Debate Strategies ("Should we be going MAD?")

arXiv:2311.17371 は 2023 年の MAD strategies survey だ。他の研究でも再現された key finding は、self-consistency と構造的に似た MAD variant (independent sampling + aggregation) は、同じ budget ではしばしば self-consistency に劣るということだ。MAD が最も効くのは、agent が本当に heterogeneous で、debate に adversarial structure (反対する agent) がある場合である。

### AgentVerse emergent patterns

AgentVerse (ICLR 2024, https://proceedings.iclr.cc/paper_files/paper/2024/file/578e65cdee35d00c708d4c64bce32971-Paper-Conference.pdf) は、明示的設計がなくても multi-agent debate から生じる2つの behavior を文書化している:

- **Volunteer.** agent が自発的に help を申し出る ("I can take the next step")。有用: subtask に最も capable な agent へ work を割り当てる。
- **Conformity.** critic が間違っていても agent が stance を critic に合わせる。これは sycophancy (Lesson 14) の debate 版である。

conformity があるため、debate-until-agreement は強い口調の agent に報酬を与える。bounded rounds と separate judge が mitigation になる。

### Heterogeneity: the actual knob that moves accuracy

practical literature における 2024-2026 年の pattern: N agents のうち1つを別 base model に入れ替える方が、N を1つ増やすより accuracy bump が大きい。直感は monoculture だ。新しい independent-error source は、追加の correlated sample より価値がある。

極限では heterogeneity が numerosity に勝つ。clean ground truth を持つほとんどの task で、3つの異なる model は1つの model の5 copy に勝る。

### Jury methods

Sibyl framework (Minsky-LLM literature で引用) は「jury」を formalize する。stage ごとに voting して answer を refine する、少数の specialized agents だ。plain majority vote と違い、jury には role がある。1 agent は cross-examine し、1 agent は context を供給し、1 agent は plausibility を score する。jury method は、plain vote (安いが monoculture-prone) と full MAD (高価で conformity-prone) の中間にある。

### When vote-with-debate dominates

- question に ground truth がある (fact、math、code behavior)。vote convergence に意味がある。
- agent が異なる source や tool に access できる (heterogeneity が利用可能)。
- round が bounded (通常 2-3) で、separate judge または verifier がある。
- budget が 3-5 agents を許す。graph topology で 5-7 を超えると coordination tax が支配的になる。

### When vote-with-debate hurts

- question が opinion-shaped。agent は最も正しい answer ではなく、最も自信ありげに見える answer に収束する。
- すべての agent が base model を共有する。monoculture で consensus が無意味になる。
- round が unbounded。conformity が毎回勝つ。
- task が simple。single agent に self-consistency N=5 を付ける方が安く、同じくらい正確。

## 実装

`code/main.py` は次を実装する:

- `run_star(agents, hub, question)` — hub が各 worker に poll し aggregate する。
- `run_chain(agents, question)` — sequential refinement。
- `run_tree(root, children, question)` — depth-2 aggregation 付き hierarchy。
- `run_graph(agents, question, rounds)` — all-to-all debate、bounded rounds。
- scripted heterogeneity dial: 各 agent が systematic wrongness の方向を示す `error_bias` を持つ。
- 各 topology を N=3、5、7 で実行し、(accuracy、total_tokens、wallclock_simulated) を report する measurement harness。

Run:

```
python3 code/main.py
```

期待される出力: topology × N → (accuracy, tokens, latency) の table。research-style task では N=3-5 の graph が勝つ。fast-factual task では star が勝つ。N=7 の graph では coordination tax (latency が accuracy より速く膨らむ) が見える。

## Use It

`outputs/skill-topology-picker.md` は task description を読み、topology (star / chain / tree / graph)、N (agent 数)、heterogeneity profile (使う base models)、round bound を推奨する skill である。

## Ship It

ensemble では常に:

- 1つの強い base model で **self-consistency at N=5** から始める。安い baseline である。
- accuracy が重要なら **heterogeneous voting at N=3** に上げる。delta を測る。
- task に structure (research、multi-step) があり bounded rounds が可能な場合だけ、**debate topology** に上げる。
- minority cluster を必ず log する。minority が持続的に正しいなら diversity signal である。
- accuracy と並べて wall-clock と tokens を benchmark する。「10x cost で accuracy が良い」は business decision である。

## Exercises

1. `code/main.py` を実行する。graph topology の coordination-tax curve を plot する: accuracy vs N、tokens vs N。どの N で curve が inflect するか。
2. A-HMAD を実装する。意図的に異なる bias を持つ3 agent を使う。Lesson 14 の monoculture attack で、all-same-bias baseline と比べてどうなるか。
3. graph topology に "judge" role を追加する。judge は vote せず、final consensus だけを score する。emergent conformity behavior は変わるか。
4. AgentVerse paper (ICLR 2024) を読む。自分の実装が最も強く示す emergent behavior を特定する。prompt change で反対の behavior を引き出せるか。
5. MultiAgentBench (arXiv:2503.01935) Section 4 (topology experiments) を読む。harness を使い、paper 内の1 task で "graph-wins-research" result を再現する。

## Key Terms

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Self-consistency | "Sample N times, vote" | Wang 2022。single model、N 個の temperature>0 samples、reasoning path に majority vote。 |
| Heterogeneity | "Different models" | 異なる base model または prompt family の ensemble。monoculture を壊す。 |
| MAD | "Multi-agent debate" | agent が round をまたいで critique を交換する generic term。Du 2023 を参照。 |
| A-HMAD | "Adversarial Heterogeneous MAD" | 異なる model + adversarial structure を強調する MAD variant。 |
| Topology | "Who talks to whom" | star、chain、tree、graph。information flow を決める。 |
| Coordination tax | "Diminishing returns" | graph で約4 agent を超えると、cost が quality より速く増える。 |
| Volunteer behavior | "Unprompted help" | AgentVerse emergent pattern。agent が step を引き受けると申し出る。 |
| Conformity behavior | "Agreement under pressure" | AgentVerse emergent pattern。agent が critic に合わせる。 |
| Jury | "Small specialized panel" | role (examiner、context、scorer) を持つ Sibyl-style ensemble。 |

## 参考文献

- [Wang et al. — Self-Consistency Improves Chain of Thought Reasoning](https://arxiv.org/abs/2203.11171) — single-model baseline
- [Du et al. — Improving Factuality and Reasoning via Multiagent Debate](https://arxiv.org/abs/2305.14325) — agent 数と round 数は独立に効く
- [MultiAgentBench / MARBLE](https://arxiv.org/abs/2503.01935) — research では graph、pipeline では chain が良いことを示す topology benchmark
- [Should we be going MAD?](https://arxiv.org/abs/2311.17371) — MAD-strategy survey。同 budget では MAD が self-consistency に負けがちなことを示す
- [AgentVerse (ICLR 2024)](https://proceedings.iclr.cc/paper_files/paper/2024/file/578e65cdee35d00c708d4c64bce32971-Paper-Conference.pdf) — volunteer と conformity の emergent patterns
- [MARBLE repo](https://github.com/ulab-uiuc/MARBLE) — reference benchmark implementation
