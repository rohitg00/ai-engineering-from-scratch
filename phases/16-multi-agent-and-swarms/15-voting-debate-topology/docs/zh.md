# 投票、自一致性与辩论拓扑（Voting, Self-Consistency, and Debate Topology）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 最便宜的聚合方式：采样 N 个独立 agent，多数投票。Wang 等人 2022 年的 self-consistency（自一致性）就是用同一个模型采样 N 次完成这件事。多 agent 把它扩展为 **异质（heterogeneous）** agent，逃离单一栽培（monoculture）——不同模型、不同 prompt、不同 temperature、不同上下文。在多数投票之外，辩论拓扑也很重要：MultiAgentBench（arXiv:2503.01935，ACL 2025）评估了 star / chain / tree / graph 四种协调方式，发现 **graph 在研究类任务上最优**，并且在大约 4 个 agent 之后会出现「协调税（coordination tax）」。AgentVerse（ICLR 2024）记录了两种涌现模式——志愿（volunteer）行为和从众（conformity）行为，而从众既是特性（达成共识），也是风险（群体迷思，见 Lesson 24）。本课会画出拓扑空间的地图，把每种变体都实现一遍，并测量协调税。

**Type:** Learn + Build
**Languages:** Python (stdlib)
**Prerequisites:** Phase 16 · 07 (Society of Mind and Debate), Phase 16 · 14 (Consensus and BFT)
**Time:** ~75 minutes

## 问题（Problem）

辩论可以提升准确率（Du 等人，arXiv:2305.14325），也可以降低准确率。辩论是否管用，取决于四个结构性选择：

1. 谁跟谁说话（拓扑）。
2. 多少轮（Du 2023：轮数和 agent 数都独立影响结果）。
3. agent 之间是否异质（不同的基座模型可以打破单一栽培）。
4. 是否存在对抗性的声音（认真挑刺 vs. 稻草人攻击）。

很多团队在任务上随手套个「跑 5 个 agent 投票」，结果反而比单 agent 还差。这种失败不是随机的，它跟拓扑和异质性高度相关。本课就是这张拓扑地图。

## 概念（Concept）

### 自一致性：单模型基线（Self-consistency, the single-model baseline）

Wang 等人 2022 年的论文（"Self-Consistency Improves Chain of Thought Reasoning"）在 temperature > 0 下对同一个模型采样 N 次，再对推理路径的答案做多数投票。在 GSM8K 上的结果是：N=40 个采样相比单次贪心解码有可观提升。Self-consistency 是多 agent 投票的单 agent 前身。

局限：self-consistency 只用一个基座模型。误差天然相关。如果模型有系统性偏差，所有 N 次采样都共享这个偏差。

### 多 agent 投票：异质化扩展（Multi-agent vote, the heterogeneous extension）

把 N 次采样换成 N 个 *不同的* agent。不同的基座模型（Claude、GPT、Llama）、不同的 prompt、不同的工具权限。好处：误差不相关。代价：不同 agent 的费用不同；协调它们也带来开销。

2026 年针对异质辩论的标准说法是 **A-HMAD**——Adversarial Heterogeneous Multi-Agent Debate（对抗式异质多 agent 辩论）。还没普及，但论文里会用这个词来指代「不同模型互相辩论，借此降低单一栽培崩塌带来的相关性误差」。

### 四种拓扑（The four topologies）

```
star                chain               tree                graph

    ┌─A─┐           A─B─C─D         ┌──A──┐              A───B
    │   │                           │     │              │ × │
    B   C                           B     C              D───C
    │   │                          / \   / \
    D   E                         D   E F   G           (fully connected)
```

Star：一个中心 hub，其他 agent 只跟 hub 说话。等价于没有反向通道的 supervisor-worker。
Chain：线性结构，每个 agent 看到前一个的输出。流水线式。
Tree：层级式，被层级 agent 系统使用（Lesson 06）。
Graph：任意对任意。包括完全连接的小团体，也包括任意 DAG（有向无环图）。

### 协调税（The coordination tax，MultiAgentBench）

MultiAgentBench（MARBLE，ACL 2025，arXiv:2503.01935）在一个包含研究、编码和规划的任务集上评测了 star、chain、tree、graph。关键测量结果：

- **Graph** 拓扑在研究任务上胜出。信息任意对任意流动；agent 之间可以互相批评。
- **Star** 在快速作答的事实类任务上胜出。Hub 起到过滤和整合作用。
- **Chain** 在分步式流水线（分阶段精化）上胜出。
- 在 graph 拓扑上，超过约 4 个 agent 之后会出现 **协调税**。墙上时钟和 token 成本的增长快于质量提升。

这个 4-agent 上限是经验值，不是基本规律。它反映的是 2026 年 LLM 的上下文容量：每个 agent 的上下文都被同伴的输出填满，一旦人人都能看到所有人，新增第 N+1 个 agent 的边际价值就会下降。

### 多 agent 辩论策略：「Should we be going MAD?」（Multi-Agent Debate Strategies）

arXiv:2311.17371 是 2023 年关于 MAD 策略的综述。其他人复现得到的关键发现是：那些在结构上 *与 self-consistency 相似*（独立采样 + 聚合）的 MAD 变体，在同等预算下往往不如 self-consistency。MAD 真正发挥作用，是在 agent 真正异质、且辩论具有对抗结构（有 agent 站出来反驳）的时候。

### AgentVerse 的涌现模式（AgentVerse emergent patterns）

AgentVerse（ICLR 2024，https://proceedings.iclr.cc/paper_files/paper/2024/file/578e65cdee35d00c708d4c64bce32971-Paper-Conference.pdf）记录了两种即使没有显式设计也会从多 agent 辩论中涌现出来的行为：

- **Volunteer（志愿）。** Agent 主动提供帮助（「我来做下一步」），并未被要求。好处：把任务分配给在该子任务上最有能力的 agent。
- **Conformity（从众）。** Agent 调整自己的立场以迎合批评者，即使批评者是错的。这是辩论场景下的 sycophancy（讨好型应答，见 Lesson 14）。

正因为存在 Conformity，「辩论到达成一致为止」会奖励嗓门大的人。有限轮数加上独立的 judge 可以缓解这一点。

### 异质性：真正能提高准确率的旋钮（Heterogeneity: the actual knob that moves accuracy）

2024–2026 年实践文献里的一个模式：把 N 个 agent 中的一个换成不同的基座模型，对准确率的提升比把 N 加 1 更显著。直觉是单一栽培——每多一个独立误差源，价值都比多一个相关采样更高。

走到极限，异质性胜过数量。在大多数有干净 ground truth 的任务上，三个不同的模型会击败同一模型的五个副本。

### 陪审团方法（Jury methods）

Sibyl 框架（在 Minsky-LLM 文献中被引用）把「陪审团（jury）」形式化——一小组分工明确的 agent，在每个阶段通过投票来精化答案。和单纯的多数投票不同，陪审团有角色：一个 agent 交叉质询，一个提供上下文，一个为可信度打分。陪审团方法处于纯投票（便宜，但易陷入单一栽培）和完整 MAD（昂贵，但易陷入从众）之间的中间地带。

### 投票 + 辩论占优的场景（When vote-with-debate dominates）

- 问题有 ground truth（事实、数学、代码行为）。投票收敛是有意义的。
- agent 可以访问不同的来源或工具（具备异质性）。
- 轮数有限（典型 2–3 轮），并且有独立的 judge 或验证器。
- 预算允许 3–5 个 agent。在 graph 拓扑上超过 5–7 个，协调税就会主导。

### 投票 + 辩论反而有害的场景（When vote-with-debate hurts）

- 问题是观点形态。Agent 会收敛到看起来最自信的答案，而不是最正确的答案。
- 所有 agent 共用同一个基座模型。单一栽培让共识失去意义。
- 轮数无界。Conformity 每次都会赢。
- 任务很简单。一个 agent 加上 N=5 的 self-consistency 又便宜又同样准确。

## 动手实现（Build It）

`code/main.py` 实现了：

- `run_star(agents, hub, question)`——hub 轮询每个 worker，再聚合。
- `run_chain(agents, question)`——顺序精化。
- `run_tree(root, children, question)`——深度 2 的层级聚合。
- `run_graph(agents, question, rounds)`——全互联辩论，轮数有界。
- 一个脚本化的异质性旋钮：每个 agent 都有 `error_bias`，标识它的系统性错误倾向。
- 一个测量框架，对每种拓扑跑 N=3、5、7，并报告 (accuracy, total_tokens, wallclock_simulated)。

运行：

```
python3 code/main.py
```

预期输出：一张 拓扑 × N → (accuracy, tokens, latency) 的表格。在研究风格的任务上，graph 在 N=3–5 时胜出；在快速事实类任务上，star 胜出；N=7 的 graph 会展示协调税（latency 比 accuracy 涨得更快）。

## 用起来（Use It）

`outputs/skill-topology-picker.md` 是一个 skill：读入一段任务描述，推荐拓扑（star / chain / tree / graph）、N（agent 数量）、异质性配置（要使用的基座模型）以及轮数上限。

## 上线部署（Ship It）

对任何集成方案：

- 先用一个强基座模型，从 **N=5 的 self-consistency** 开始。这是便宜的基线。
- 如果准确率重要，升级到 **N=3 的异质投票**。测量提升幅度。
- 只有在任务确实有结构（研究、多步骤）且能限定轮数时，才升级到 **辩论拓扑**。
- 永远要记录少数派簇。如果某个少数派持续是对的，你就拿到了一个多样性信号。
- 把墙上时钟和 token 数和准确率一起打基准。「准确率更好但成本 10 倍」是一个商业决策。

## 练习（Exercises）

1. 跑 `code/main.py`。把 graph 拓扑下的协调税曲线画出来：accuracy vs N、tokens vs N。曲线在哪个 N 出现拐点？
2. 实现 A-HMAD：三个 agent，有意带不同的偏差。在 Lesson 14 的单一栽培攻击下，「全部相同偏差」基线和 A-HMAD 相比表现如何？
3. 给 graph 拓扑加一个「judge」角色，它不投票，只对最终共识打分。这是否会改变涌现的从众行为？
4. 阅读 AgentVerse 论文（ICLR 2024）。判断你的实现里哪种涌现行为最显著。能不能通过调整 prompt 让相反的行为出现？
5. 阅读 MultiAgentBench（arXiv:2503.01935）第 4 节（拓扑实验）。用你的框架在论文里的某一个任务上复现「graph 在研究任务上胜出」的结论。

## 关键术语（Key Terms）

| 术语 | 大家通常怎么说 | 它真正的含义 |
|------|----------------|------------------------|
| Self-consistency（自一致性） | 「采样 N 次再投票」 | Wang 2022。单一模型，N 个 temperature>0 的采样，对推理路径做多数投票。 |
| Heterogeneity（异质性） | 「不同模型」 | 由不同基座模型或不同 prompt 家族组成的集成。打破单一栽培。 |
| MAD | 「多 agent 辩论」 | 指 agent 之间多轮交换批评的统称。参见 Du 2023。 |
| A-HMAD | 「对抗式异质 MAD」 | MAD 的变体，强调使用不同模型 + 对抗结构。 |
| Topology（拓扑） | 「谁跟谁说话」 | Star、chain、tree、graph。决定信息流向。 |
| Coordination tax（协调税） | 「边际收益递减」 | 在 graph 上超过约 4 个 agent 后，成本增长快于质量增长。 |
| Volunteer behavior（志愿行为） | 「主动伸手帮忙」 | AgentVerse 的涌现模式：agent 主动接下一步任务。 |
| Conformity behavior（从众行为） | 「在压力下达成一致」 | AgentVerse 的涌现模式：agent 跟批评者站到一边。 |
| Jury（陪审团） | 「小型专门小组」 | Sibyl 风格的集成，带角色（质询者、上下文提供者、打分者）。 |

## 延伸阅读（Further Reading）

- [Wang et al. — Self-Consistency Improves Chain of Thought Reasoning](https://arxiv.org/abs/2203.11171) —— 单模型基线
- [Du et al. — Improving Factuality and Reasoning via Multiagent Debate](https://arxiv.org/abs/2305.14325) —— agent 数和轮数都独立有效
- [MultiAgentBench / MARBLE](https://arxiv.org/abs/2503.01935) —— 拓扑基准，显示 graph 适合研究、chain 适合流水线
- [Should we be going MAD?](https://arxiv.org/abs/2311.17371) —— MAD 策略综述；发现等预算下 MAD 经常输给 self-consistency
- [AgentVerse (ICLR 2024)](https://proceedings.iclr.cc/paper_files/paper/2024/file/578e65cdee35d00c708d4c64bce32971-Paper-Conference.pdf) —— 志愿与从众两种涌现模式
- [MARBLE repo](https://github.com/ulab-uiuc/MARBLE) —— 参考基准实现
