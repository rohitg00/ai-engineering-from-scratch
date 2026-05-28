# Evaluation と Coordination Benchmarks

> 5 つの 2025-2026 benchmarks が multi-agent evaluation space を覆っている。**MultiAgentBench / MARBLE**（ACL 2025, arXiv:2503.01935）は star/chain/tree/graph topologies を milestone KPIs で評価し、**research には graph が最良**で、cognitive planning は milestone achievement を約 3% 加える。**COMMA** は multimodal asymmetric-information coordination を評価し、GPT-4o を含む state-of-the-art models が random baseline を超えるのに苦戦する。**MedAgentBoard**（arXiv:2505.12371）は 4 つの medical task categories を扱い、multi-agent が single-LLM を支配しないことをしばしば示す。**AgentArch**（arXiv:2509.10769）は tool-use + memory + orchestration を組み合わせる enterprise agent architectures を benchmark する。**SWE-bench Pro**（[arXiv:2509.16941](https://arxiv.org/abs/2509.16941)）は business apps、B2B services、developer tools にまたがる 41 repos / 1865 problems を持つ。frontier models は Pro で約 23%、Verified では 70%+ を得る。これは contamination への reality check である。Claude Opus 4.7（2026 年 4 月）は explicit agent-teams coordination により Pro で **64.3%** と報告されている（Anthropic primary source はまだ未公開。preliminary として扱う）。Verdent（agent scaffold）は Verified で **76.1% pass@1**（[Verdent technical report](https://www.verdent.ai/blog/swe-bench-verified-technical-report)）。**AAAI 2026 Bridge Program WMAC**（https://multiagents.org/2026/）は 2026 年の community focal point である。この lesson は MARBLE の metrics を土台に、topology-vs-metric sweep を走らせ、「SWE-bench Verified に通るだけでは generalization の証拠にならない」という rule を固定する。

**種別:** 学習
**言語:** Python (stdlib)
**前提条件:** Phase 16 · 15 (Voting and Debate Topology), Phase 16 · 23 (Failure Modes)
**所要時間:** 約75分

## 問題

paper が「our multi-agent system is better」と主張したときの question は、何より良いのか、何で、どう測ったのか、である。2023-2024 年の multi-agent evaluation は混沌としていた。各自が独自 metrics、独自 baselines、独自 task sets を選んでいた。2025-2026 benchmarks は構造を与えた。

shared benchmarks がなければ、2 つの multi-agent systems を意味のある形で比較できない。さらに hold-out benchmarks がなければ frontier models は contaminate し得る。SWE-bench Verified は 2025 年半ばまでに training corpora に部分的に contaminated になった。frontier scores は inflate した。Pro は uncontaminated reality check として設計された。

この lesson は 2026 年の 5 canonical benchmarks を列挙し、それぞれが何を測るかを示し、benchmark claims を懐疑的に読む方法を教える。

## コンセプト

### MultiAgentBench（MARBLE）— ACL 2025

arXiv:2503.01935。research、coding、planning tasks において 4 coordination topologies（star、chain、tree、graph）を評価する。Milestone-based KPIs は final success だけでなく partial progress を追跡する。

measured results:

- **Graph** topology は research scenarios に最良。any-to-any critique を支える。
- **Chain** は stepwise-refinement coding に最良。
- **Star** は fast-factual consolidation に最良。
- graph では ~4 agents を超えると **coordination tax** が現れる。
- **Cognitive planning** は topologies 全体で milestone achievement を約 3% 増やす。

Use when: coordination topologies を apples-to-apples で比較したいとき。MARBLE repo（https://github.com/ulab-uiuc/MARBLE）が evaluator を提供する。

### COMMA — multimodal asymmetric information

agents が異なる observation modalities を持ち、full information sharing なしに coordinate しなければならない tasks を扱う。reported result は厳しい。GPT-4o を含む frontier models が、COMMA の agent-agent collaboration で **random baseline** を超えるのに苦戦する。signal は、multi-agent modalities が under-trained かつ under-evaluated だということ。LLMs は single-modality cooperation はそれなりに扱うが、multi-modality coordination は崩れる。

Use when: system が multimodal または asymmetric-information coordination を持つ場合。COMMA の null result は、claim の前に測るべきだという警告である。

### MedAgentBoard — domain stress test

arXiv:2505.12371。4 medical task categories: diagnosis、treatment planning、report generation、patient communication。multi-agent vs single-LLM vs conventional rule-based systems を比較する。

finding: 多くの categories で multi-agent は single-LLM を支配しない。multi-agent advantage は狭い。subtasks が clearly separable（diagnosis + treatment）な場合は task decomposition が効くが、coordination overhead が specialization gain を上回る（report generation）場合は害になる。

Use when: domain に clear-cut single-LLM baselines がある場合。MedAgentBoard の lesson が generalize するなら、多くの proposed multi-agent systems は over-engineered である。

### AgentArch — enterprise architectures

arXiv:2509.10769。tool use、memory、orchestration を layered に組み合わせる enterprise settings。benchmark は各 layer の contribution を isolate する。tools を追加するとどれだけ効くか。memory を追加するとどうか。multi-agent orchestration を追加するとどうか。

Use when: enterprise agent stack を設計し、各 layer を正当化する必要がある場合。AgentArch は価値を測れない features を買うことを避ける助けになる。

### SWE-bench Pro — reality check

arXiv:2509.16941。business apps、B2B services、developer tools にまたがる 41 repositories / 1865 problems。later training cutoffs に対して **uncontaminated** であるよう設計された。frontier models は Pro で約 23%、Verified で 70%+ を得る。この gap が contamination signal である。

April 2026 scores:
- Claude Opus 4.7 on Pro: **64.3%**（explicit agent-teams coordination 付きで報告。Anthropic primary source はまだ未公開なので preliminary として扱う）。
- Verdent（agent scaffold）on Verified: **76.1% pass@1**（[technical report](https://www.verdent.ai/blog/swe-bench-verified-technical-report)）。
- agent scaffolding なしの frontier raw scores on Pro: ~23-35%（[SWE-bench Pro paper](https://arxiv.org/abs/2509.16941)）。

takeaway: 「we beat SWE-bench Verified」はもはや capability の証拠ではない。Pro が現在の gating test である。Agent-team scaffolding は Pro 上で measurable gains（~30-40 point delta）を生み、これは 2026 年における multi-agent coordination の最も強い empirical arguments の 1 つである。

### AAAI 2026 WMAC

AAAI 2026 Bridge Program — Workshop on Multi-Agent Coordination（https://multiagents.org/2026/）。multi-agent AI research における 2026 年の community focal point。accepted papers と workshop proceedings は new methods を評価する canonical venue である。production decisions では arXiv preprints より WMAC-accepted claims を優先する。

### benchmark claims を懐疑的に読む — 2026 checklist

誰かが multi-agent result を主張したら:

1. **Which benchmark, which split?** SWE-bench Verified vs Pro は大きく違う。wrong split の number は無価値。
2. **Contamination check。** benchmark は model の training cutoff より後に release されたか。そうでなければ caution。
3. **Baseline comparison。** single-LLM baseline、random、prior multi-agent work と比較しているか。「same system の untuned version」との比較ではない。
4. **Statistical significance。** N trials、p-value、confidence interval。frontier models は high-variance であり、single runs は誤解を招く。
5. **Task diversity。** 1 task か many か。generalization は production に重要。
6. **Cost disclosure。** task あたり tokens、wall-clock。20x cost の 90% solution は capability claim ではなく business decision。

### どの benchmark もまだうまく測れないもの

- **Long-horizon coordination。** wall-clock days の interaction。現在の benchmarks はすべて短い。
- **Adversarial resilience。** 1 agent が malicious または compromised のとき何が起きるか。
- **Drift under deployment。** benchmarks は static だが production distributions は shift する。
- **Cost-normalized performance。** ほとんどの benchmarks は raw accuracy を報告し、accuracy-per-dollar は報告しない。

自分たちが本当に気にする axis に対して internal benchmark を作るのが正しいことが多い。

## 実装

`code/main.py` は non-interactive walk-through である:

- toy task 上で 3 multi-agent systems を simulate する。
- 各 system の MARBLE-style milestone metrics を計算する。
- 「training」set から tasks を withholding して contamination check を走らせる。
- random baseline と明示的に比較する。
- benchmark-claims scorecard を print する。

Run:

```bash
python3 code/main.py
```

期待される出力: raw accuracy、milestone achievement、cost-per-task、vs-random baseline delta、contamination-check note を持つ system scorecard。

## Use It

`outputs/skill-benchmark-reader.md` は任意の multi-agent benchmark claim を読み、scrutiny checklist を適用する。Output: grade と caveats。

## Ship It

production evaluation discipline:

- **internal benchmark を作る。** actual production distribution を反映するものにする。public benchmarks は参考になるが代替ではない。
- **すべての比較に random baseline を含める。** coordination task で random に大差で勝てないなら、その task は ill-posed かもしれない。
- **accuracy と一緒に cost を報告する。** token cost と wall-clock。ops teams には両方必要。
- **benchmark を quarterly に作り直す。** production distribution は shift する。stale benchmarks は誤解を招く。
- **published-benchmark overfitting を避ける。** team が SWE-bench Pro numbers だけを optimize していると、production では regress する。

## Exercises

1. `code/main.py` を実行する。3 simulated systems のうち best cost-per-milestone を持つものを特定する。それは highest raw-accuracy system と一致するか。
2. MultiAgentBench（arXiv:2503.01935）を読む。自分の task domain では、MARBLE は 4 topologies のどれを推奨するか。paper results から justify する。
3. SWE-bench Pro paper を読む。具体的に何が contamination-resistant にしているのか。同じ technique は他の気になる benchmarks にも適用できるか。
4. COMMA の multimodal coordination に関する finding を読む。internal benchmark に追加できる simple multimodal coordination task を設計する。useful signal と見なすものは何か。
5. benchmark-claims checklist を、最近の multi-agent paper の headline result 1 つに適用する。その claim にどの grade を付けるか。

## Key Terms

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| MARBLE | 「MultiAgentBench」 | ACL 2025。star/chain/tree/graph topologies と milestone KPIs。 |
| COMMA | 「Multimodal benchmark」 | multimodal asymmetric-info coordination。frontier models は random に苦戦する。 |
| MedAgentBoard | 「Domain stress test」 | 4 medical categories。multi-agent が single-LLM を支配しないことが多い。 |
| AgentArch | 「Enterprise benchmark」 | tools + memory + orchestration を layered に評価する。 |
| SWE-bench Pro | 「Contamination-resistant」 | 1865 problems、41 repos。Verified の 70%+ に対して ~23%（contamination signal）。 |
| Milestone achievement | 「partial credit」 | final success だけでなく progress に報酬を与える benchmarks。 |
| Contamination | 「benchmark が training に漏れる」 | release 後、benchmarks が training corpora に入り scores が inflate する。 |
| WMAC | 「AAAI 2026 Bridge Program」 | Workshop on Multi-Agent Coordination。community focal point。 |

## 参考文献

- [MultiAgentBench / MARBLE](https://arxiv.org/abs/2503.01935) — milestone KPIs を持つ topology benchmark
- [MARBLE repository](https://github.com/ulab-uiuc/MARBLE) — reference implementation
- [MedAgentBoard](https://arxiv.org/abs/2505.12371) — domain stress test。multi-agent はしばしば dominate しない
- [AgentArch](https://arxiv.org/abs/2509.10769) — enterprise agent architectures
- [SWE-bench leaderboards](https://www.swebench.com/) — frontier models の Verified と Pro scores
- [AAAI 2026 WMAC](https://multiagents.org/2026/) — 2026 community focal point
