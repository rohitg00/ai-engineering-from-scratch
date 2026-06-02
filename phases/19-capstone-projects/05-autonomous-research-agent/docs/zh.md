# Capstone 05 — 自主科研 Agent（AI-Scientist 级别）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> Sakana 的 AI-Scientist-v2 已经发表了完整论文。Agent Laboratory 跑通了实验。Allen AI 公开了 trace。2026 年的形态是：基于 plan-execute-verify（规划-执行-验证）的实验树搜索、预算化的成本、沙箱化的代码执行、视觉反馈的 LaTeX 写作器，以及自动化的 NeurIPS 风格 reviewer（验证器）集成。本 capstone 的任务是亲手做一个，端到端跑下来每篇论文不超过 30 美元，并且经受住 Sakana 公开过的沙箱逃逸红队测试。

**Type:** Capstone
**Languages:** Python（agent + 沙箱），LaTeX（输出）
**Prerequisites:** Phase 2（ML）、Phase 3（深度学习）、Phase 7（transformer）、Phase 10（从零实现 LLM）、Phase 14（agent）、Phase 15（自主性）、Phase 16（多 agent）、Phase 18（安全）
**Phases exercised:** P0 · P2 · P3 · P7 · P10 · P14 · P15 · P16 · P18
**Time:** 40 hours

## 问题（Problem）

自主科研 agent 在 2026 年跨过了一道门槛。Sakana AI 的 AI-Scientist-v2 在 Nature 上发表，其生成的论文通过了 workshop 的同行评审。ShinkaEvolve（ICLR 2026）把这条线延伸到了演化假设。AMD 的 Agent Laboratory 提供了可复现的 trace。这些 agent 并不神奇——它们是在候选实验树上跑的 plan-execute-verify 循环，外加成本上限、绑定 seed 的沙箱以及自动化评审。手艺活在循环、预算和安全故事里。

你通过对一个种子想法在窄域内的实现来学习这个循环（例如，在一个 100M 参数 transformer 上做 attention（注意力）稀疏性的消融实验（ablation））。价值不在第一次运行就发现什么新东西。价值在基础设施上：树搜索、实验沙箱、writer-reviewer 循环、红队报告。Sakana 团队记录过沙箱逃逸的失败；你的 agent 必须通过同样的红队测试。

## 概念（Concept）

这个 agent 是一种最佳优先（best-first）树搜索。节点是实验规格：(假设, 配置, 代码, 预期结果)。expand（扩展）步骤通过小幅修改提出子节点（更换 optimizer、调整 batch size、消融某个组件）。每个子节点在一个全新的沙箱中运行，并带有硬性资源上限。结果回流到一个评分函数中，按 (novelty × quality × remaining budget)（新颖度 × 质量 × 剩余预算）对节点排序。树一直生长直到预算耗尽，然后把最优分支写成论文。

writer 是多模态的。它生成一份 LaTeX 草稿、编译它、渲染图表，并把渲染好的 PDF 喂回 Claude Opus 4.7 的 vision 模式，对版面、图表可读性和「论点-证据」对齐进行批评。一个由五个 LLM 法官组成的 reviewer 集成给出 NeurIPS 风格的评分（novelty、rigor、clarity、reproducibility、impact）；如果均值低于阈值，论文带着批评意见返回 writer。

安全是承重墙。每个实验都跑在 E2B 或 Daytona 沙箱里，没有出网、有限墙钟时间、固定的资源上限。agent 的代码生成步骤要经过一个策略层，拦截会逃出沙箱的系统调用。红队报告复现 Sakana 记录在案的攻击面（fork bomb、文件系统逃逸、LLM 写出的网络调用）。

## 架构（Architecture）

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

## 技术栈（Stack）

- 编排：LangGraph，带 checkpointing 和人工审批关卡
- 树搜索：自定义最佳优先搜索，作用于实验节点（Sakana v2 的 AB-MCTS 风格）
- 沙箱：每个实验一个 E2B，备选 Docker-in-Docker；通过 cgroups 设资源上限
- 文献：Semantic Scholar Graph API + OpenAlex + 摘要的本地 FAISS 缓存
- Writer：LaTeX 模板 + Claude Opus 4.7（vision 模式）做图表批评和版面批评
- Reviewer：5 个法官的集成（Opus 4.7、GPT-5.4、Gemini 3 Pro、DeepSeek R1、Qwen3-Max），加权聚合
- 实验框架：物理实验用 PyTorch 2.5，日志用 W&B
- 可观测性：Langfuse 做 agent trace，每篇论文 30 美元硬预算

## 动手实现（Build It）

1. **Seed 与域界定。** 拿一个种子想法（例如「调研 sub-1B transformer 的 attention map 稀疏性模式」）。定义搜索空间：模型、数据集、计算预算。

2. **文献扫描。** 在 Semantic Scholar + OpenAlex 上查 50 篇引用最高的相关论文；本地缓存摘要；生成 1 页的领域综述。

3. **树骨架。** 用种子假设初始化根节点。实现 `expand(node) -> children`，用「小幅修改」式提案（每个子节点改一个配置）。把 `score(node)` 实现为加权的 novelty × quality × budget 项。

4. **沙箱封装。** 每个实验跑 `docker run --network=none --memory=8g --cpus=2 --pids-limit=256 --read-only`（或者等价的 E2B 策略）。seed 写进沙箱；输出以只读方式挂载出来。

5. **Plan-execute-verify 循环。** `plan` 提出子节点。`execute` 跑沙箱、抓取日志和指标。`verify` 在指标上跑单元检查（loss 真的降了吗？消融真的隔离了那个效应吗？）。失败的节点把失败原因记录在树上。

6. **Writer。** 预算用完后，挑选最佳分支。用 matplotlib 渲染图表。把分支 trace 作为 context 传给 Claude Opus 4.7 生成 LaTeX 草稿。编译。把编译好的 PDF 喂回 Opus 4.7 vision 让它批评。迭代。

7. **Reviewer 集成。** 五个法官按 NeurIPS 风格 rubric 在 (novelty, rigor, clarity, reproducibility, impact) 上为草稿打分。如果均值 < 4.0/5，带着批评意见返回 writer。3 次重写后硬停。

8. **红队。** 自建或集成一组针对沙箱的对抗任务：fork bomb、网络外泄尝试、文件系统逃逸、LLM 写出的 shell 元字符。确认全部被拦截。写出发现报告。

9. **可复现性。** 每篇论文都附带它的树搜索 trace JSON、seed、W&B 运行链接、沙箱配置，以及一个端到端复现的 README。

## 用起来（Use It）

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

## 上线部署（Ship It）

交付物是 `outputs/skill-ai-scientist.md`。给定一个种子想法 + 一个域 + 30 美元预算，它就跑完整条流水线，产出一份可评审的论文加一份可复现性资料包。

| 权重 | 评判项 | 如何度量 |
|:-:|---|---|
| 25 | 论文质量 | 与已发表的 workshop 论文进行盲法 rubric 对比评审 |
| 20 | 实验严谨性 | baseline、seed、消融实验；每条结论都对应结果表格里的一格 |
| 20 | 成本与算力纪律 | 每篇 30 美元天花板强制执行，Langfuse 全程 trace |
| 20 | 安全 | 沙箱红队通过；网络策略和 kill switch（紧急停机开关）已验证 |
| 15 | 可复现性 | 用相同的 seed 一条命令重跑出同一篇论文 |
| **100** | | |

## 练习（Exercises）

1. 用同一个域里的三个不同种子想法跑一遍流水线。对比树搜索的哪些部分有重叠。找出重复浪费的算力。

2. 在估算成本超过 5 美元的节点执行实验之前，加一道 human-in-the-loop（人工确认）关卡。测量总成本下降了多少。

3. 把 reviewer 集成换成单个法官。在一个已知坏论文的留出集（held-out set）上测量误接受率。

4. 引入一个网络外泄红队测试：agent 写出会去 `curl` 外部地址的代码。确认 `--network=none` 策略能拦截它。把这次尝试记录下来。

5. 用一个扁平随机 baseline（相同预算，没有扩展策略）和你的树搜索对比。报告 novelty × quality 的增益。

## 关键术语（Key Terms）

| 术语 | 大家怎么说 | 实际是什么 |
|------|-----------------|------------------------|
| Tree search | 「AB-MCTS 风格的扩展」 | 在实验节点上做最佳优先探索，按 novelty × quality × budget 评分 |
| Sandbox | 「实验隔离」 | 容器，没有网络、CPU/内存有限、seed 固定、输入只读 |
| Vision critique | 「先渲染再读」 | 把论文编译为 PDF，再把 PDF 喂回一个 VLM 做版面与「论点-证据」批评 |
| Reviewer 集成 | 「自动化同行评审」 | 多个 LLM 法官用 NeurIPS rubric 给论文打分；加权聚合作为流水线的关卡 |
| Novelty score | 「这是新东西吗？」 | 启发式评分，惩罚和那 50 篇文献缓存太接近的方案 |
| Cost ceiling | 「美元预算」 | 每篇论文总花费的硬上限；Langfuse 计数器 + 预运行估算 |
| 红队（Red team） | 「沙箱逃逸审计」 | 一组对抗任务，如果策略写错就会逃出沙箱 |

## 延伸阅读（Further Reading）

- [Sakana AI-Scientist-v2 repository](https://github.com/SakanaAI/AI-Scientist-v2) —— 参考生产级科研 agent
- [Sakana AI-Scientist-v1 paper (arXiv:2408.06292)](https://arxiv.org/abs/2408.06292) —— 原始方法学论文
- [ShinkaEvolve (Sakana ICLR 2026)](https://sakana.ai) —— 演化扩展
- [Agent Laboratory (AMD)](https://github.com/SamuelSchmidgall/AgentLaboratory) —— 多角色科研实验室框架
- [LangGraph documentation](https://langchain-ai.github.io/langgraph/) —— 参考编排层
- [Semantic Scholar Graph API](https://api.semanticscholar.org/) —— 文献检索
- [E2B sandboxes](https://e2b.dev) —— 参考实验隔离
- [NeurIPS reviewer guidelines](https://neurips.cc/Conferences/2026/Reviewer-Guidelines) —— reviewer 集成所编码的 rubric
