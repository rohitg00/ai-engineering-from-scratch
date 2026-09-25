# 多智能体辩论与协作

> Du et al.（ICML 2024，"Society of Minds"）运行 N 个模型实例独立提出答案，然后在 R 轮中相互批评以收敛。提升事实性、规则遵循和推理能力。稀疏拓扑在 token 成本上优于全连接网格。

**Type:** Learn + Build
**Languages:** Python (stdlib)
**Prerequisites:** Phase 14 · 12（Workflow Patterns）、Phase 14 · 05（Self-Refine and CRITIC）
**Time:** 约 60 分钟

## 学习目标

- 解释辩论协议：N 个提案者、R 轮，收敛到共享答案。
- 描述为什么辩论能提升事实性、规则遵循和推理能力。
- 解释稀疏拓扑：并非每个辩论者都需要看到其他所有人。
- 在脚本化 LLM 上实现 stdlib 辩论，包含全连接网格和稀疏两种变体；测量 token 成本与准确率。

## 问题所在

Self-Refine（第 05 课）是单个模型自我批评——存在群体思维风险。CRITIC（第 05 课）将批评锚定在外部工具上——但工具并非总是可用。辩论引入了第三种模式：多个实例、交叉批评、通过分歧达成收敛。

## 核心概念

### Society of Minds（Du et al., ICML 2024）

- N 个模型实例对同一问题独立提出答案。
- 在 R 轮中，每个模型阅读其他模型的提案并加以批评。
- 模型根据批评更新自己的答案。
- R 轮之后，返回收敛的答案。

受成本限制，原始实验使用 N=3、R=2。在困难问题（MMLU、GSM8K、国际象棋走法有效性、传记生成）上，智能体和轮数越多，准确率越高。

跨模型组合优于单模型辩论：ChatGPT + Bard 搭配 > 任一单独使用。

### 稀疏拓扑

"Improving Multi-Agent Debate with Sparse Communication Topology"（arXiv:2406.11776，2024-2025）表明全连接网格辩论并非总是最优。稀疏拓扑（星形、环形、中心辐射型）能以更低的 token 成本达到相同准确率。每个辩论者只看到一部分同伴。

影响：

- 全连接网格 N=5, R=3 = 5 × 3 = 15 个提案，每个读取 4 个同伴 = 60 次批评操作。
- 星形 N=5, R=3（1 个中心 + 4 个辐条）= 15 个提案，辐条只读取中心 = 12 次批评操作。

### 辩论何时有效

- **事实性。** N 个独立提案，交叉校验减少幻觉。
- **规则遵循。** 国际象棋走法有效性——一个模型漏掉规则，其他模型能发现。
- **开放式推理。** 多种视角框定收窄到正确答案。

### 辩论何时有害

- **延迟敏感的 UX。** N × R 轮串行执行的延迟可能无法接受。
- **成本敏感的规模化。** 每个问题 N × R 的 token 开销。
- **简单的事实查询。** 一次查询比五次辩论更便宜。

### 2026 年的实际落地

- **Anthropic orchestrator-workers**（第 12 课）——带综合步骤的辩论变体。
- **LangGraph supervisor**（第 13 课）——中央路由器 + 专家智能体可将辩论实现为一个节点。
- **OpenAI Agents SDK**（第 16 课）——智能体之间来回交接以进行迭代批评。
- **Multi-agent evals**——将辩论与 evaluator-optimizer 配对以产生评估信号。

### 该模式的常见失败方式

- **收敛塌缩。** 所有智能体收敛到第一个错误答案。通过强制分歧轮来缓解。
- **中心故障。** 在星形拓扑中，坏的中心会污染所有人。轮换或使用多个中心。
- **提示词同质化。** 所有智能体使用相同提示词；产出相同答案。使用多样化的提示词和/或模型。

```figure
debate-converge
```

## 动手实现

`code/main.py` 实现了 stdlib 辩论：

- `Debater` 类（带每个辩论者意见漂移的脚本化 LLM）。
- `FullMeshDebate` 和 `SparseDebate` 运行器。
- 三个问题：一个事实型、一个规则型、一个推理型。
- 指标：收敛答案、收敛所需轮数、总批评操作数。

运行：

```
python3 code/main.py
```

输出：每种协议的准确率与成本；稀疏拓扑以更低成本在 2/3 的问题上匹配全连接网格。

## 应用场景

- **Anthropic orchestrator-workers** 用于简单的 2-3 个 worker 辩论。
- **LangGraph** 用于带检查点的有状态多轮辩论。
- **Custom** 用于研究或专门的正确性保证。

## 上线部署

`outputs/skill-debate.md` 脚手架搭建了一个可配置拓扑、N、R 和收敛规则的多智能体辩论。

## 练习

1. 实现"强制分歧"规则：在第 1 轮，每个辩论者必须提出不同的提案。测量其对收敛速度的影响。
2. 添加置信度加权聚合：辩论者返回（答案，置信度）；聚合器按置信度加权。这有帮助吗？
3. 将一个"智能体"替换为意见不同的另一个脚本化 LLM。异质性会提升准确率吗？
4. 在你的 3 个问题上测量全连接网格与稀疏拓扑的 token 成本。绘制成本与准确率的关系图。
5. 阅读 Society of Minds 论文。将你的玩具实现扩展到 N=5, R=3。什么出问题了？什么变好了？

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|----------------|------------------------|
| Debate | "多智能体批评" | N 个提案者、R 轮交叉批评、收敛 |
| Full mesh | "人人读人人" | 每轮每个辩论者读取所有同伴 |
| Sparse topology | "有限的同伴视野" | 辩论者只读取部分同伴 |
| Hub-and-spoke | "星形拓扑" | 一个中央辩论者，N-1 个辐条只读取中心 |
| Convergence | "达成一致" | 辩论者收敛到共享答案 |
| Society of Minds | "Du et al. 的辩论论文" | ICML 2024 多智能体辩论方法 |

## 延伸阅读

- [Du et al., Society of Minds (arXiv:2305.14325)](https://arxiv.org/abs/2305.14325) — 经典的多智能体辩论
- [Sparse Communication Topology (arXiv:2406.11776)](https://arxiv.org/abs/2406.11776) — 稀疏拓扑结果
- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) — orchestrator-workers 作为辩论变体
- [Madaan et al., Self-Refine (arXiv:2303.17651)](https://arxiv.org/abs/2303.17651) — 单模型自我批评的对应方案