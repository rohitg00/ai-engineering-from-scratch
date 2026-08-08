# 05 · 自主研究智能体（Autonomous Research Agent — AI 科学家级）

> Sakana 的 AI-Scientist-v2 发表了完整论文。Agent Laboratory 跑了实验。Allen AI 分享了追踪记录。2026 年的形态是：对实验进行规划-执行-验证（plan-execute-verify）树搜索，带预算成本控制、沙盒化代码执行、视觉反馈 LaTeX 撰写器，以及一个自动化的 NeurIPS 风格审稿人评审团。本课程的目标是构建一个这样的智能体，在每篇论文 30 美元以内端到端运行，并通过 Sakana 记录的沙盒逃逸红队测试。

**类型：** 综合实战
**语言：** Python（智能体 + 沙盒）、LaTeX（输出）
**前置：** 第二阶段（机器学习）、第三阶段（深度学习）、第七阶段（Transformer）、第十阶段（从零实现 LLM）、第十四阶段（智能体）、第十五阶段（自主智能体）、第十六阶段（多智能体）、第十八阶段（安全）
**覆盖阶段：** P0 · P2 · P3 · P7 · P10 · P14 · P15 · P16 · P18
**时长：** 40 小时

## 问题

自主研究智能体（Autonomous Research Agent）在 2026 年跨过了一道门槛。Sakana AI 的 AI-Scientist-v2 在 Nature 上发表，生成的论文通过了研讨会同行评审。ShinkaEvolve（ICLR 2026）将这条路线延伸到演化假设。AMD 的 Agent Laboratory 交付了可复现的追踪记录。这些智能体并非魔法——它们是一个规划-执行-验证（plan-execute-verify）循环，运行在候选实验的树上，配有成本上限、种子绑定的沙盒和自动化评审。精髓在于循环本身、预算控制和安全方案。

你将通过在一个窄域中实现该循环来学习它（例如，对 1 亿参数 Transformer 的注意力稀疏性消融实验）。价值不在于第一次运行就发现新东西，而在于基础设施：树搜索、实验沙盒、撰写-审稿循环、红队报告。Sakana 团队记录了沙盒逃逸失败案例；你的智能体必须通过同一套红队测试。

## 核心概念

智能体是一个最佳优先树搜索（best-first tree search）。节点是实验规格：（假设、配置、代码、预期结果）。展开步骤提出带有小改动的子节点（换优化器、调整批次大小、消融一个组件）。每个子节点在全新的沙盒中运行，带有硬资源上限。结果反馈到评分函数中，按（新颖性 × 质量 × 剩余预算）对节点排序。树持续增长直到预算耗尽，然后选出最佳分支进行撰写。

撰写器是多模态的。它生成 LaTeX 草稿，编译，渲染图表，然后将渲染后的 PDF 反馈给 Claude Opus 4.7 的视觉模式，对排版、图表可读性和论据-证据对齐进行评审。一个由五位 LLM 评审组成的评审团给出 NeurIPS 风格的评分（新颖性、严谨性、清晰性、可复现性、影响力）；如果平均分低于阈值，论文将带着评审意见返回撰写器。

安全性至关重要。每个实验在 E2B 或 Daytona 沙盒中运行，无网络出口，硬性墙钟限制，锁定资源上限。智能体的代码生成步骤经过策略层，阻止可能逃逸沙盒的系统调用。红队报告复现 Sakana 记录的攻击面（fork 炸弹、文件系统逃逸、LLM 编写的网络调用）。

## 架构

```
种子想法 + 领域
      |
      v
  文献检索（Semantic Scholar + OpenAlex + FAISS 缓存）
      |
      v
  LangGraph 规划-执行-验证树
      |
      v
  +--- 展开节点 ----+      逐节点沙盒
  |                 |      （E2B / Daytona）
  v                 v      资源上限
  子节点1         子节点k   无网络出口
  |                 |      确定性种子
  v                 v
  运行实验         运行实验
  |                 |
  v                 v
  按（新颖性, 质量, 预算）对节点打分
      |
      v
  最佳分支 -> LaTeX 撰写器
      |
      v
  编译 + 视觉评审（Opus 4.7 视觉模式）
      |
      v
  评审团（5 位 LLM 评审, NeurIPS 评分标准）
      |
      v
  paper.pdf + review.md + trace.json
```

## 技术栈

- 编排（Orchestration）：LangGraph，带检查点（checkpointing）和人工审批门
- 树搜索（Tree search）：对实验节点的自定义最佳优先搜索（Sakana v2 中的 AB-MCTS 风格）
- 沙盒（Sandbox）：每个实验用 E2B，Docker-in-Docker 作为回退方案；通过 cgroups 限制资源
- 文献（Literature）：Semantic Scholar Graph API + OpenAlex + 本地 FAISS 摘要缓存
- 撰写器（Writer）：LaTeX 模板 + Claude Opus 4.7（视觉模式）用于图表评审和排版
- 评审（Reviewer）：5 位评审组成的评审团（Opus 4.7、GPT-5.4、Gemini 3 Pro、DeepSeek R1、Qwen3-Max），带加权聚合
- 实验框架（Experiment framework）：PyTorch 2.5 用于物理实验，W&B 用于日志记录
- 可观测性（Observability）：Langfuse 用于智能体追踪，每篇论文 30 美元硬预算

## 构建过程

1. **种子与领域范围界定。** 取一个种子想法（如"研究 10 亿参数以下 Transformer 注意力图中的稀疏模式"）。定义搜索空间：模型、数据集、算力预算。

2. **文献检索。** 查询 Semantic Scholar + OpenAlex，获取 50 篇引用最多的相关论文；本地缓存摘要；生成一页领域概要。

3. **树框架搭建。** 用种子假设初始化根节点。实现 `expand(node) -> children`，以小幅修改提案生成子节点（每个子节点改变一项配置）。实现 `score(node)`，作为新颖性 × 质量 × 预算的加权项。

4. **沙盒封装。** 每个实验运行 `docker run --network=none --memory=8g --cpus=2 --pids-limit=256 --read-only`（或等效的 E2B 策略）。种子写入沙盒；输出以只读方式挂载出来。

5. **规划-执行-验证循环。** `plan` 生成子节点提案。`execute` 运行沙盒，捕获日志和指标。`verify` 对指标运行单元检查（损失下降了吗？消融实验是否隔离了效果？）。失败的节点在树上记录失败原因。

6. **撰写器。** 预算耗尽后，选择最佳分支。用 matplotlib 渲染图表。通过 Claude Opus 4.7 生成 LaTeX 草稿，将分支追踪记录作为上下文。编译。将编译后的 PDF 反馈给 Opus 4.7 视觉模式进行评审。迭代。

7. **评审团。** 五位评审按 NeurIPS 风格评分标准对草稿在（新颖性、严谨性、清晰性、可复现性、影响力）上打分。若平均分低于 4.0/5，带着评审意见返回撰写器。最多 3 次重写后强制停止。

8. **红队。** 构建或集成一组针对沙盒的对抗任务：fork 炸弹、网络外传尝试、文件系统逃逸、LLM 编写的 shell 元字符。确认全部被阻止。撰写发现报告。

9. **可复现性。** 每篇论文附带树搜索追踪 JSON、种子、W&B 运行链接、沙盒配置，以及一份能端到端复现的 README。

## 使用方式

```
$ ai-scientist run --seed "attention sparsity in sub-1B transformers" --budget 30
[lit]    50 papers, digest in 12s
[tree]   expanded 8 nodes, budget 12/30
[exec]   node #3 sparsity=top-8, loss=2.83 (best so far)
[exec]   node #6 sparsity=top-4, loss=3.12 (worse)
[exec]   ...
[tree]   chose branch rooted at node #3 (novelty 0.62, quality 0.81)
[write]  LaTeX draft v1 complete
[vision] critique: figure 2 legend too small, claim-evidence ok
[write]  draft v2 after 3 edits
[review] mean 4.2/5 (novelty 3.9, rigor 4.3, clarity 4.1, repro 4.5, impact 4.2)
[done]   paper.pdf + review.md + trace.json     $28.40 spent
```

## 交付标准

`outputs/skill-ai-scientist.md` 是交付物。给定一个种子想法、一个领域和一个 30 美元预算，它运行完整流水线并产出一篇可评审的论文及其可复现包。

| 权重 | 标准 | 度量方式 |
|:-:|---|---|
| 25 | 论文质量 | 与已发表研讨会论文进行盲审评分对比 |
| 20 | 实验严谨性 | 基线、种子、消融实验；每个论断必须有结果表中的数据支撑 |
| 20 | 成本与算力纪律 | 强制执行 30 美元/篇上限，Langfuse 追踪 |
| 20 | 安全性 | 沙盒红队通过；验证网络策略和紧急切断开关 |
| 15 | 可复现性 | 使用相同种子一键重跑即可复现论文 |
| **100** | | |

## 练习

1. 将流水线针对同一领域中的三个不同种子想法各运行一次。比较树搜索中哪些部分重叠。识别重复浪费的算力。

2. 在实验执行前，对预估成本超过 5 美元的节点添加人机协同（human-in-the-loop）审批门。衡量总成本下降了多少。

3. 将评审团替换为单评审。在已知劣质论文的留存集上测量误接受率。

4. 引入一个网络外传红队测试：智能体编写尝试 `curl` 外部地址的代码。验证 `--network=none` 策略阻断了该行为。记录该尝试。

5. 将你的树搜索与平坦随机基线（相同预算，无展开策略）进行比较。报告新颖性 × 质量的增益。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|-----------|---------|
| 树搜索（Tree search） | "AB-MCTS 风格展开" | 对实验节点按新颖性×质量×预算评分进行最佳优先探索 |
| 沙盒（Sandbox） | "实验隔离" | 无网络、限制 CPU/内存、固定种子的容器，输入只读 |
| 视觉评审（Vision critique） | "渲染后阅读" | 将论文编译为 PDF，将 PDF 反馈给 VLM 进行排版和论据-证据评审 |
| 评审团（Reviewer ensemble） | "自动化同行评审" | 多位 LLM 评审按 NeurIPS 评分标准对论文打分；加权聚合决定流水线是否通过 |
| 新颖性评分（Novelty score） | "这是新的吗？" | 惩罚与 50 篇文献缓存接近程度的启发式度量 |
| 成本上限（Cost ceiling） | "$ 预算" | 每篇论文总花费的硬上限；Langfuse 计数器 + 运行前估算 |
| 红队（Red team） | "沙盒逃逸审计" | 策略若存在漏洞即会逃逸沙盒的对抗任务 |

## 延伸阅读

- [Sakana AI-Scientist-v2 仓库](https://github.com/SakanaAI/AI-Scientist-v2) —— 参考级生产级研究智能体
- [Sakana AI-Scientist-v1 论文 (arXiv:2408.06292)](https://arxiv.org/abs/2408.06292) —— 原始方法论
- [ShinkaEvolve（Sakana ICLR 2026）](https://sakana.ai) —— 演化扩展
- [Agent Laboratory（AMD）](https://github.com/SamuelSchmidgall/AgentLaboratory) —— 多角色研究实验室框架
- [LangGraph 文档](https://langchain-ai.github.io/langgraph/) —— 参考编排层
- [Semantic Scholar Graph API](https://api.semanticscholar.org/) —— 文献检索
- [E2B 沙盒](https://e2b.dev) —— 参考实验隔离方案
- [NeurIPS 审稿指南](https://neurips.cc/Conferences/2026/Reviewer-Guidelines) —— 评审团所编码的评分标准
