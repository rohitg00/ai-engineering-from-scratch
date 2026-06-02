# 评估与协调基准（Evaluation and Coordination Benchmarks）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 五个 2025-2026 年的基准（benchmark）覆盖了多 agent 评估空间。**MultiAgentBench / MARBLE**（ACL 2025，arXiv:2503.01935）评估 star / chain / tree / graph 四种拓扑，使用里程碑（milestone）KPI；**graph 最适合研究类任务**，加入认知规划（cognitive planning）大约能提升 3% 的里程碑达成率。**COMMA** 评估多模态、信息不对称下的协调；包括 GPT-4o 在内的顶尖模型在该基准上挣扎着才能勉强超过随机基线（random baseline）。**MedAgentBoard**（arXiv:2505.12371）覆盖四类医疗任务，结论常常是多 agent 并未压过单 LLM。**AgentArch**（arXiv:2509.10769）对企业级 agent 架构做基准测试，把 tool-use + 记忆（memory）+ 编排（orchestration）组合起来评估。**SWE-bench Pro**（[arXiv:2509.16941](https://arxiv.org/abs/2509.16941)）有 1865 个问题，分布在 41 个仓库里，覆盖业务应用、B2B 服务和开发者工具；前沿模型在 Pro 上得分约 23%，而在 Verified 上能拿到 70% 以上 —— 这是对污染（contamination）的现实校验。Claude Opus 4.7（2026 年 4 月）据报道在 Pro 上达到 **64.3%**，使用了显式的 agent 团队协调（Anthropic 尚未发布一手来源 —— 视作初步结果）；Verdent（agent 脚手架）在 Verified 上达到 **76.1% pass@1**（[Verdent 技术报告](https://www.verdent.ai/blog/swe-bench-verified-technical-report)）。**AAAI 2026 Bridge Program WMAC**（https://multiagents.org/2026/）是 2026 年社区的焦点。本节课基于 MARBLE 的指标，跑一次 topology-vs-metric 扫描，并钉死「仅仅通过 SWE-bench Verified 不能作为泛化能力的证据」这一规则。

**Type:** Learn
**Languages:** Python (stdlib)
**Prerequisites:** Phase 16 · 15（Voting and Debate Topology），Phase 16 · 23（Failure Modes）
**Time:** ~75 minutes

## 问题（Problem）

当一篇论文宣称「我们的多 agent 系统更好」时，要问的是：比什么更好？在什么任务上？怎么衡量的？2023-2024 时代的多 agent 评估一片混乱 —— 每个人都自己挑指标、自己挑基线、自己挑任务集。2025-2026 的基准给这件事强加了结构。

没有共享的基准，你无法在两个多 agent 系统之间做有意义的比较。更糟的是，没有 hold-out 基准，前沿模型可能被污染。SWE-bench Verified 到 2025 年中已经部分被训练语料污染；前沿分数虚高；Pro 就是为了做一次未被污染的现实校验而设计的。

本节课逐一列举 2026 年五个标志性的基准，说清楚每一个测的是什么，并教你如何带着怀疑读基准类的论断。

## 概念（Concept）

### MultiAgentBench (MARBLE) — ACL 2025

arXiv:2503.01935。在研究、编码和规划三类任务上，评估四种协调拓扑（star、chain、tree、graph）。基于里程碑（milestone）的 KPI 跟踪部分进度，而非只看最终成功。

实测结果：

- **Graph** 拓扑最适合研究场景；支持任意对任意的批评（critique）。
- **Chain** 最适合需要逐步精化的编码任务。
- **Star** 最适合快速事实归并（fast-factual consolidation）。
- 当 graph 上 agent 数超过 ~4 时会出现**协调税（coordination tax）**。
- 在所有拓扑上，**认知规划（cognitive planning）**大约能提升 3% 的里程碑达成率。

适用场景：你想公平地（apples-to-apples）比较协调拓扑。MARBLE 仓库（https://github.com/ulab-uiuc/MARBLE）提供了评估器。

### COMMA — 多模态、信息不对称

覆盖的任务里，agent 拥有不同的观测模态，必须在信息不完全共享的前提下完成协调。报告的结果令人不安：包括 GPT-4o 在内的前沿模型，在 COMMA 上 agent-agent 协作连**随机基线（random baseline）**都很难打败。这表明多 agent 模态既训练不足、也评估不足 —— LLM 处理单模态合作还算合理；多模态协调直接崩。

适用场景：你的系统涉及多模态或信息不对称的协调。COMMA 的 null result 是一记警钟：先量化，再宣称。

### MedAgentBoard — 领域压力测试

arXiv:2505.12371。四类医疗任务：诊断、治疗规划、报告生成、患者沟通。把多 agent 与单 LLM、传统规则系统放在一起对比。

发现：在大多数类别上，多 agent **并不**压过单 LLM。多 agent 的优势很窄 —— 只有当子任务本身可清晰拆分时（诊断 + 治疗），任务分解才有帮助；当协调开销超过专业化收益时（报告生成），它反而拖后腿。

适用场景：你的领域有清晰的单 LLM 基线。如果 MedAgentBoard 这个教训能推广，那么很多被提议的多 agent 系统都是过度设计。

### AgentArch — 企业级架构

arXiv:2509.10769。企业场景下，工具使用、记忆、编排叠加在一起。基准把每一层的贡献隔离开评估：加工具能提升多少？加记忆呢？加多 agent 编排呢？

适用场景：你正在设计企业级 agent 栈，需要为每一层的存在给出理由。AgentArch 帮你避免买进那些你无法量化价值的功能。

### SWE-bench Pro — 现实校验

arXiv:2509.16941。1865 个问题，41 个仓库，覆盖业务应用、B2B 服务和开发者工具。设计上做到**未被污染**，使用了更晚的训练截止日期。前沿模型在 Pro 上 ~23%，在 Verified 上 70%+。这中间的差距就是污染信号。

2026 年 4 月的分数：
- Claude Opus 4.7 在 Pro 上：**64.3%**（报告中使用了显式的 agent 团队协调；Anthropic 尚未发布一手来源 —— 视作初步结果）。
- Verdent（agent 脚手架）在 Verified 上：**76.1% pass@1**（[技术报告](https://www.verdent.ai/blog/swe-bench-verified-technical-report)）。
- 前沿模型在 Pro 上不带 agent 脚手架的原始得分：~23-35%（[SWE-bench Pro paper](https://arxiv.org/abs/2509.16941)）。

要点：「我们打赢了 SWE-bench Verified」已经不再是能力的证据。Pro 才是当前的把关测试。Agent 团队脚手架在 Pro 上能带来可量化的提升（~30-40 个点的差值），这是 2026 年支持多 agent 协调最有力的实证论据之一。

### AAAI 2026 WMAC

AAAI 2026 Bridge Program — Workshop on Multi-Agent Coordination（https://multiagents.org/2026/）。2026 年多 agent AI 研究的社区焦点。被接收的论文与 workshop 论文集是评估新方法的标志性场所；做生产决策时，应优先采信 WMAC 接收的结论，而不是 arXiv 预印本。

### 带着怀疑读基准论断 —— 2026 年的 checklist

当有人宣称一个多 agent 结果时：

1. **哪个基准、哪个 split？** SWE-bench Verified 还是 Pro，差别很大。报错 split 的数字毫无价值。
2. **污染检查。** 这个基准发布日期是不是在模型训练截止日期之后？如果不是，就要谨慎对待。
3. **基线对比。** 对比单 LLM 基线、对比随机、对比前人多 agent 工作。不是「对比同一个系统未调参的版本」。
4. **统计显著性。** 试验次数 N、p 值、置信区间。前沿模型方差大；单次运行容易误导。
5. **任务多样性。** 一个任务还是多个任务？泛化能力对生产很重要。
6. **成本披露。** 每任务消耗的 token、wall-clock 时间。「以 20 倍成本得到 90% 的解」是商业决策，而不是能力论断。

### 这些基准没能很好衡量的事

- **长链路（long-horizon）协调。** 数天 wall-clock 量级的交互。当前所有基准都跑得很短。
- **对抗鲁棒性（Adversarial resilience）。** 当某个 agent 是恶意或被攻陷时会怎样？
- **部署后漂移（drift）。** 基准是静态的；生产分布会漂移。
- **成本归一化的性能。** 多数基准报告的是原始准确率，而不是「单位成本下的准确率」。

针对你真正在意的那条轴，自己搭一个内部基准，往往才是对的。

## 动手实现（Build It）

`code/main.py` 是一段非交互的走读：

- 在一个玩具任务上模拟 3 个多 agent 系统。
- 给每个系统计算 MARBLE 风格的里程碑指标。
- 通过从「训练」集中扣留任务来做一次污染检查。
- 显式地与随机基线对比。
- 打印一份基准论断评分卡（scorecard）。

运行：

```bash
python3 code/main.py
```

预期输出：系统评分卡，包含原始准确率、里程碑达成率、单任务成本、相对随机基线的差值（vs-random delta），以及一条污染检查备注。

## 用起来（Use It）

`outputs/skill-benchmark-reader.md` 接收任意多 agent 基准论断作为输入，套用怀疑式 checklist。输出：一个评级和若干 caveats。

## 上线部署（Ship It）

生产环境的评估纪律：

- **搭一个内部基准**，反映你真实的生产分布。公开基准只能参考，不能替代。
- **每次比较都包含一个随机基线。** 如果协调任务上你不能远超随机，这个任务本身可能就没定义清楚。
- **在准确率旁边一并报告成本。** Token 成本和 wall-clock，运维团队两个都需要。
- **每季度重建一次基准。** 生产分布会漂移；陈旧的基准会误导人。
- **避免对公开基准过拟合。** 如果团队专门冲着 SWE-bench Pro 的数字做优化，生产指标会回退。

## 练习（Exercises）

1. 跑 `code/main.py`。指出三个被模拟的系统中，哪一个的「单位里程碑成本」最低。它和原始准确率最高的那个是同一个吗？
2. 读 MultiAgentBench（arXiv:2503.01935）。针对你自己的任务领域，决定 MARBLE 会推荐四种拓扑中的哪一种。从论文的结果出发给出理由。
3. 读 SWE-bench Pro 论文。它具体靠什么做到抗污染？同样的手法能不能应用到其他你在意的基准上？
4. 读 COMMA 关于多模态协调的发现。设计一个简单的多模态协调任务，可以加进你的内部基准。什么样的信号才算有用？
5. 把基准论断 checklist 应用到一篇近期多 agent 论文的头条结果上。你会给这个论断打几分？

## 关键术语（Key Terms）

| 术语 | 大家怎么说 | 实际意思 |
|------|----------------|------------------------|
| MARBLE | "MultiAgentBench" | ACL 2025；star / chain / tree / graph 拓扑，配里程碑 KPI。 |
| COMMA | "多模态基准" | 多模态、信息不对称的协调；前沿模型连随机基线都难打败。 |
| MedAgentBoard | "领域压力测试" | 四类医疗任务；常常发现多 agent 并不压过单 LLM。 |
| AgentArch | "企业级基准" | 工具 + 记忆 + 编排，分层叠加。 |
| SWE-bench Pro | "抗污染" | 1865 个问题，41 个仓库；~23% vs Verified 的 70%+（污染信号）。 |
| Milestone achievement | "部分得分" | 奖励进度而非仅奖励最终成功的基准。 |
| Contamination | "基准泄进训练数据了" | 发布后基准会漂入训练语料；分数虚高。 |
| WMAC | "AAAI 2026 Bridge Program" | Workshop on Multi-Agent Coordination；社区焦点。 |

## 延伸阅读（Further Reading）

- [MultiAgentBench / MARBLE](https://arxiv.org/abs/2503.01935) — 带里程碑 KPI 的拓扑基准
- [MARBLE repository](https://github.com/ulab-uiuc/MARBLE) — 参考实现
- [MedAgentBoard](https://arxiv.org/abs/2505.12371) — 领域压力测试；多 agent 经常并不占优
- [AgentArch](https://arxiv.org/abs/2509.10769) — 企业级 agent 架构
- [SWE-bench leaderboards](https://www.swebench.com/) — 前沿模型在 Verified 与 Pro 上的成绩
- [AAAI 2026 WMAC](https://multiagents.org/2026/) — 2026 年社区焦点
