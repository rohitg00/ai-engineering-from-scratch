# 毕业项目 05 — 自主研究智能体（AI-Scientist 级）

> Sakana 的 AI-Scientist-v2 发表了完整的论文。Agent Laboratory 运行了实验。Allen AI 公开了轨迹。2026 年的形态是针对实验的计划-执行-验证树搜索、有预算约束的成本、沙箱化代码执行、带视觉反馈的 LaTeX 写作器，以及自动化的 NeurIPS 风格审稿人集成。本毕业项目要求构建这样一个系统，在每篇论文 30 美元的预算内端到端运行它，并通过 Sakana 记录的沙箱逃逸红队测试。

**Type:** Capstone
**Languages:** Python (智能体 + 沙箱), LaTeX (输出)
**Prerequisites:** 阶段 2（机器学习）、阶段 3（深度学习）、阶段 7（Transformer）、阶段 10（从零构建 LLM）、阶段 14（智能体）、阶段 15（自主智能体）、阶段 16（多智能体）、阶段 18（安全）
**Phases exercised:** P0 · P2 · P3 · P7 · P10 · P14 · P15 · P16 · P18
**Time:** 40 小时

## 问题

自主研究智能体在 2026 年跨过了一道门槛。Sakana AI 的 AI-Scientist-v2 在 Nature 上发表，其生成的论文通过了研讨会级别的同行评审。ShinkaEvolve（ICLR 2026）将这一方向扩展到演化式假设。AMD 的 Agent Laboratory 发布了可复现的轨迹。这些智能体并非魔法——它们是一个运行在候选实验树之上的计划-执行-验证循环，配有成本上限、绑定随机种子的沙箱和自动化评审。真正的功夫在于循环本身、预算控制和安全设计。

你需要在某个狭窄领域中，针对一个种子想法（例如，在一个 1 亿参数 Transformer 上进行注意力稀疏性消融实验）实现该循环来学习它。价值不在于第一次运行就发现新东西，而在于基础设施本身：树搜索、实验沙箱、写作器-审稿人循环、红队报告。Sakana 团队记录了沙箱逃逸的失败案例；你的智能体必须通过同样的红队测试。

## 概念

该智能体是一个最佳优先树搜索。节点是实验规格：(假设, 配置, 代码, 预期结果)。一次扩展步骤通过小改动（更换优化器、调整批大小、消融某个组件）提出子节点。每个子节点在带有硬性资源上限的全新沙箱中运行。结果反馈到一个评分函数，按（新颖性 × 质量 × 剩余预算）对节点排序。树不断生长直到预算耗尽，然后写出最优分支。

写作器是多模态的。它生成 LaTeX 草稿、编译、渲染图表，并将渲染后的 PDF 反馈给 Claude Opus 4.7 的视觉模式，以获得关于排版、图表可读性以及论断-证据一致性的批评意见。一个由五个 LLM 评审组成的集成发出 NeurIPS 风格的分数（新颖性、严谨性、清晰度、可复现性、影响力）；如果平均分低于阈值，论文将连同批评意见返回给写作器。

安全是承重结构。每个实验都在无网络出口、有界墙钟时间和固定资源限制的 E2B 或 Daytona 沙箱中运行。智能体的代码生成步骤经过一个策略层，该层会阻止逃逸沙箱的系统调用。红队报告复现 Sakana 记录的攻击面（fork 炸弹、文件系统逃逸、LLM 编写的网络调用）。

## 架构

```
seed idea + domain
      |
      v
  literature search (Semantic Scholar + OpenAlex + FAISS cache)
      |
      v
  LangGraph plan-execute-verify tree
      |
      v
  +--- expand node ----+      per-node sandbox
  |                    |      (E2B / Daytona)
  v                    v      resource caps
  child_1           child_k   no network egress
  |                    |      deterministic seeds
  v                    v
  run experiment       run experiment
  |                    |
  v                    v
  score nodes by (novelty, quality, budget)
      |
      v
  best branch -> LaTeX writer
      |
      v
  compile + vision critique (Opus 4.7 vision)
      |
      v
  reviewer ensemble (5 LLM judges, NeurIPS rubric)
      |
      v
  paper.pdf + review.md + trace.json
```

## 技术栈

- 编排：带检查点与人工审批闸门的 LangGraph
- 树搜索：基于实验节点的自定义最佳优先搜索（类似 Sakana v2 的 AB-MCTS 风格）
- 沙箱：每个实验使用 E2B，Docker-in-Docker 兜底；通过 cgroups 实施资源上限
- 文献：Semantic Scholar Graph API + OpenAlex + 本地 FAISS 摘要缓存
- 写作器：LaTeX 模板 + Claude Opus 4.7（视觉模式）用于图表批评与排版
- 审稿人：5 个评审的集成（Opus 4.7、GPT-5.4、Gemini 3 Pro、DeepSeek R1、Qwen3-Max），加权聚合
- 实验框架：物理实验使用 PyTorch 2.5，日志使用 W&B
- 可观测性：智能体轨迹使用 Langfuse，每篇论文硬性预算 30 美元

```figure
ce-experiment-tree
```

## 构建步骤

1. **种子与领域限定。** 选定一个种子想法（例如，“研究参数量低于 1B 的 Transformer 注意力图中的稀疏模式”）。定义搜索空间：模型、数据集、计算预算。

2. **文献调研。** 查询 Semantic Scholar + OpenAlex，获取引用最高的 50 篇相关论文；在本地缓存摘要；生成一页的领域摘要。

3. **树脚手架。** 用种子假设初始化根节点。实现 `expand(node) -> children`，采用小改动提议（每个子节点仅一处配置变更）。实现 `score(node)`，作为加权的新颖性 × 质量 × 预算项。

4. **沙箱封装。** 每个实验都运行在 `docker run --network=none --memory=8g --cpus=2 --pids-limit=256 --read-only`（或等效的 E2B 策略）中。随机种子写入沙箱；输出以只读方式挂载导出。

5. **计划-执行-验证循环。** `plan` 提出子节点。`execute` 运行沙箱，捕获日志与指标。`verify` 对指标运行单元检查（损失是否下降？消融是否隔离了效果？）。失败节点在树上记录失败原因。

6. **写作器。** 预算耗尽后，选择最优分支。用 matplotlib 渲染图表。通过 Claude Opus 4.7，以分支轨迹作为上下文生成 LaTeX 草稿。编译。将编译后的 PDF 反馈给 Opus 4.7 视觉模式进行批评。迭代。

7. **审稿人集成。** 五个评审按（新颖性、严谨性、清晰度、可复现性、影响力）以 NeurIPS 风格评分标准为草稿打分。如果均值 < 4.0/5，连同批评意见返回给写作器。重写 3 次后硬性停止。

8. **红队。** 构建或集成一套针对沙箱的对抗性任务：fork 炸弹、网络数据外传尝试、文件系统逃逸、LLM 编写的 shell 元字符。确认全部被拦截。撰写发现报告。

9. **可复现性。** 每篇论文附带其树搜索轨迹 JSON、随机种子、W&B 运行链接、沙箱配置，以及一份端到端复现论文的 README。

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

`outputs/skill-ai-scientist.md` 是交付物。给定一个种子想法 + 一个领域 + 30 美元预算，它运行完整流水线，输出一篇可评审的论文以及一个可复现性包。

| 权重 | 评估标准 | 衡量方式 |
|:-:|---|---|
| 25 | 论文质量 | 对照已发表的研讨会论文进行盲评打分 |
| 20 | 实验严谨性 | 基线、随机种子、消融；每个论断都由结果表中的单元格支撑 |
| 20 | 成本与计算纪律 | 强制执行每篇论文 30 美元上限，经 Langfuse 追踪 |
| 20 | 安全性 | 沙箱红队通过；网络策略与 kill-switch 已验证 |
| 15 | 可复现性 | 使用相同随机种子的一条命令重跑可复现论文 |
| **100** | | |

## 练习

1. 在同一领域针对三个不同的种子想法运行流水线。比较树搜索中哪些部分相互重叠。找出重复浪费的计算。

2. 在实验执行前为预估成本超过 5 美元的节点添加人工在环闸门。测量总成本下降了多少。

3. 将审稿人集成换成单个评审。在一组已知劣质论文的留存集上测量误接受率。

4. 引入网络数据外传红队测试：智能体编写尝试向 `curl` 某外部地址发送数据的代码。确认 `--network=none` 策略将其拦截。记录该尝试。

5. 将你的树搜索与扁平随机基线（相同预算，无扩展策略）进行比较。报告新颖性 × 质量的提升。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|-----------------|------------------------|
| 树搜索 | “类似 AB-MCTS 的扩展” | 在实验节点上的最佳优先探索，使用新颖性×质量×预算评分 |
| 沙箱 | “实验隔离” | 无网络、CPU/内存有界、种子固定、输入只读的容器 |
| 视觉批评 | “先渲染再阅读” | 将论文编译为 PDF，将 PDF 反馈给 VLM 进行排版与论断-证据批评 |
| 审稿人集成 | “自动化同行评审” | 多个 LLM 评审按 NeurIPS 评分标准为论文打分；加权聚合决定流水线是否通过 |
| 新颖性评分 | “这是新的吗？” | 一种对与 50 篇论文文献缓存过于接近进行惩罚的启发式方法 |
| 成本上限 | “$ 预算” | 每篇论文总花费的硬性上限；Langfuse 计数器 + 运行前估算 |
| 红队 | “沙箱逃逸审计” | 若策略有误便会逃逸出沙箱的对抗性任务 |

## 延伸阅读

- [Sakana AI-Scientist-v2 仓库](https://github.com/SakanaAI/AI-Scientist-v2) — 参考级生产研究智能体
- [Sakana AI-Scientist-v1 论文 (arXiv:2408.06292)](https://arxiv.org/abs/2408.06292) — 原始方法论
- [ShinkaEvolve (Sakana ICLR 2026)](https://sakana.ai) — 演化式扩展
- [Agent Laboratory (AMD)](https://github.com/SamuelSchmidgall/AgentLaboratory) — 多角色研究实验室框架
- [LangGraph 文档](https://langchain-ai.github.io/langgraph/) — 参考编排层
- [Semantic Scholar Graph API](https://api.semanticscholar.org/) — 文献检索
- [E2B 沙箱](https://e2b.dev) — 参考实验隔离方案
- [NeurIPS 评审指南](https://neurips.cc/Conferences/2026/Reviewer-Guidelines) — 审稿人集成所编码的评分标准