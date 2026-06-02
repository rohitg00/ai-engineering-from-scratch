# 多 agent 辩论与协作（Multi-Agent Debate and Collaboration）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> Du 等人（ICML 2024，"Society of Minds"）让 N 个模型实例独立给出答案，再在 R 轮中互相批判、迭代收敛。可以提升事实性、规则遵循度和推理能力。在 token 成本上，稀疏拓扑优于全连接。

**Type:** Learn + Build
**Languages:** Python (stdlib)
**Prerequisites:** Phase 14 · 12 (Workflow Patterns), Phase 14 · 05 (Self-Refine and CRITIC)
**Time:** ~60 minutes

## 学习目标（Learning Objectives）

- 解释辩论协议：N 个 proposer、R 轮、收敛到共同答案。
- 说明为什么辩论能提升事实性、规则遵循度和推理能力。
- 解释稀疏拓扑：并不是每个辩手都需要看到其他所有人。
- 用 stdlib 在脚本化 LLM 上实现辩论，包含全连接和稀疏两种变体；测量 token 成本与准确率。

## 问题（The Problem）

Self-Refine（Lesson 05）是一个模型自我批判——存在群体思维（groupthink）的风险。CRITIC（Lesson 05）把批判建立在外部工具之上——但工具并不总是可用。辩论引入了第三种模式：多实例、交叉批判、靠分歧达成收敛。

## 概念（The Concept）

### Society of Minds（Du et al., ICML 2024）

- N 个模型实例对同一个问题独立给出答案。
- 在 R 轮中，每个模型阅读其他模型的提案并加以批判。
- 模型根据这些批判更新自己的答案。
- R 轮之后，返回收敛后的答案。

原论文实验出于成本考虑用了 N=3、R=2。在更难的问题上（MMLU、GSM8K、Chess Move Validity、传记生成），增加 agent 数量和轮数都会提升准确率。

跨模型组合优于单模型辩论：ChatGPT + Bard 一起比任一单独都强。

### 稀疏拓扑（Sparse topology）

《Improving Multi-Agent Debate with Sparse Communication Topology》（arXiv:2406.11776，2024–2025）指出全连接辩论并不总是最优。稀疏拓扑（星形、环形、hub-and-spoke）可以在更低 token 成本下达到与全连接相当的准确率。每个辩手只看到一部分同伴。

含义：

- 全连接 N=5、R=3 = 5 × 3 = 15 个提案，每个读 4 个同伴 = 60 次批判操作。
- 星形 N=5、R=3（1 个 hub + 4 个 spoke）= 15 个提案，spoke 只读 hub = 12 次批判操作。

### 辩论什么时候有用

- **事实性。** N 个独立提案，交叉核对降低 hallucination（幻觉）。
- **规则遵循度。** Chess Move Validity——一个模型漏掉某条规则，其他模型能抓出来。
- **开放式推理。** 多种切入角度逐步收敛到正确答案。

### 辩论什么时候反而有害

- **对延迟敏感的 UX。** N × R 串行轮次带来的延迟你未必扛得住。
- **对成本敏感的大规模场景。** 每个问题要花 N × R 的 token。
- **简单事实查询。** 查一次比辩五次便宜得多。

### 2026 年的工程实例

- **Anthropic orchestrator-workers**（Lesson 12）——辩论的一种变体，外加一个综合（synthesis）步骤。
- **LangGraph supervisor**（Lesson 13）——中央 router（路由器）+ 专家 agent，可以把辩论实现成一个节点。
- **OpenAI Agents SDK**（Lesson 16）——agent 之间来回 handoff（交接）做迭代批判。
- **多 agent 评估**——把辩论与 evaluator-optimizer 配对，得到评估信号。

### 这个模式容易翻车的地方

- **收敛塌陷。** 所有 agent 都收敛到第一个错误答案。可以用强制分歧轮缓解。
- **Hub 故障。** 在星形拓扑下，一个糟糕的 hub 会带坏所有人。可以轮换 hub，或者用多个 hub。
- **Prompt 同质化。** 所有 agent 都用相同的 prompt，自然给出相同答案。要用多样化的 prompt 和（或）模型。

## 动手实现（Build It）

`code/main.py` 用 stdlib 实现辩论：

- `Debater` 类（脚本化 LLM，每个辩手有独立的观点漂移）。
- `FullMeshDebate` 和 `SparseDebate` 两个 runner。
- 三个问题：一个事实题、一个规则题、一个推理题。
- 指标：收敛答案、收敛所需轮数、总批判操作数。

运行：

```
python3 code/main.py
```

输出：每种协议的准确率和成本；稀疏拓扑在 3 题中的 2 题上以更低成本追平了全连接。

## 用起来（Use It）

- **Anthropic orchestrator-workers** 适合简单的 2–3 个 worker 的辩论。
- **LangGraph** 适合带 checkpoint 的有状态多轮辩论。
- **自定义** 适合研究场景或对正确性有特殊保证要求的场合。

## 上线部署（Ship It）

`outputs/skill-debate.md` 给出了一个多 agent 辩论的脚手架，可配置拓扑、N、R 和收敛规则。

## 练习（Exercises）

1. 实现一条「强制分歧」规则：第 1 轮中每个辩手都必须给出与众不同的提案。测量它对收敛速度的影响。
2. 加入按置信度加权的聚合：辩手返回 (answer, confidence)，聚合器按置信度加权。有用吗？
3. 把其中一个「agent」替换成另一个观点不同的脚本化 LLM。异质性能提升准确率吗？
4. 在你的 3 个问题上测量全连接 vs 稀疏的 token 成本。画出成本对准确率的图。
5. 读 Society of Minds 论文。把你的玩具实现移植到 N=5、R=3。什么会坏？什么会变好？

## 关键术语（Key Terms）

| 术语 | 大家嘴上怎么说 | 实际含义 |
|------|----------------|------------------------|
| Debate | "多 agent 批判" | N 个 proposer、R 轮交叉批判、收敛 |
| Full mesh | "人人互看" | 每个辩手每轮都读所有同伴 |
| Sparse topology | "受限的同伴视图" | 辩手只读一部分同伴 |
| Hub-and-spoke | "星形拓扑" | 一个中心辩手，N-1 个 spoke 只读 hub |
| Convergence | "达成一致" | 辩手收敛到共同答案 |
| Society of Minds | "Du 等人的辩论论文" | ICML 2024 的多 agent 辩论方法 |

## 延伸阅读（Further Reading）

- [Du et al., Society of Minds (arXiv:2305.14325)](https://arxiv.org/abs/2305.14325) —— 多 agent 辩论的经典论文
- [Sparse Communication Topology (arXiv:2406.11776)](https://arxiv.org/abs/2406.11776) —— 稀疏拓扑的实验结果
- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) —— 把 orchestrator-workers 作为辩论的一种变体
- [Madaan et al., Self-Refine (arXiv:2303.17651)](https://arxiv.org/abs/2303.17651) —— 单模型自我批判的对照
