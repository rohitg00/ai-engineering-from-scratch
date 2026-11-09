# 自主研究代理 (AI科学家类)

> 萨卡纳的AI科学家-v2发表了完整的论文. 实验室经营了实验. 艾尔恩分享了痕迹. 2026 形状是计划执行验证实验的树搜索,预算成本,沙盒代码执行,视觉反的LateX编写器,以及一个自动 NeurIPS 风格的评论员组. 终点是建造一个,每张纸每期运行在30美元内,

**Type:** Capstone
**Languages:** Python (agent + sandbox), TypeScript, LaTeX (output)
**Prerequisites:** Phase 2 (ML), Phase 3 (deep learning), Phase 7 (transformers), Phase 10 (LLMs from scratch), Phase 14 (agents), Phase 15 (autonomous), Phase 16 (multi-agent), Phase 18 (safety)
**Phases exercised:**子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子
**Time:** 40 hours

## 问题

自主研究机构在2026年超过了门. 萨卡纳AI的AI-Scientist-v2在自然杂志上发表了通过论文, 卡Evolve (ICLR 2026) 将这一线延伸到不断发展的假设. 美国麻醉剂实验室发送了可复制的痕迹. 代理人不是魔法,他们是一个计划执行验证循环, 运行在候选人实验的树上, 飞船是通报的,预算,安全故事.

通过在狭窄领域的种子想法中实现一个循环学习 (例如,在100M参数变压器上注意力-度的缩). 发现新东西不是最重要的. 价值在基础设施中:树木搜索,实验沙箱,作家-评论员循环,红团报告. 萨卡纳团队记录了逃离沙箱失败,你的代理必须通过同一个红色团队.

## 概念

代理是最好的第一棵树搜索. 节点是实验规格: (假设,配置,代码,预期结果). 扩展步骤建议小编辑 (换换优化器,换批量大小,拆除组件). 每个孩子都在一个新鲜的沙箱里跑着, 结果将返回一个分数函数,该函数将节点排列为 (新品 × 质量 × 剩余预算). 树长得很长,直到预算耗尽,然后最好的枝子被写出来.

写作者是多元化. 它生成了Latex草案,编译,呈现数字,并将呈现的PDF重新输入Claude Opus 4.7的视觉模式,用于对布局,图像可读性和索赔证据的批评. 五名LLM法官组成的评审团发出NeurIPS类型的分数 (新奇性,严格性,清晰性,可复制性,影响);如果平均值低于门,则论文将与批评回归作者.

安全性是承载性的.每一次实验都在E2B或Daytona沙箱中运行,没有网络出口,有界限的墙钟和固定资源限制.代理的代码生成步骤通过一个政策层来阻止逃离沙箱的系统调用.红团报告复制了萨卡纳文档的攻击表面 (叉子炸弹,文件系统逃脱,LLM编写的网络调用).

## 建筑

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

## 堆

- 配乐:有检查点和人机批准门的LangGraph
- 树的搜索:自定义最佳首次对实验节点 (从Sakana v2中的AB-MCTS风格)
- 沙箱:每次实验的E2B,Docker-in-Docker倒退;通过cgroups的资源限制
- 文学:语义学家图 API + OpenAlex + 摘要的当地 FAISS缓存
- 作者: LaTeX模板 + Claude Opus 4.7 (视觉模式) 图像评论和布局
- 评审员:由5名评委组成 (Opus 4.7,GPT-5.4,Gemini 3 Pro,DeepSeek R1,Qwen3-Max)
- 实验框架:PyTorch 2.5用于物理实验,W&B用于伐木
- 观察性: 长用于探测代理,每张纸张30美元的预算

```figure
ce-experiment-tree
```

## 建立它

1. **Seed and domain scoping.**设置一个种子想法 (例如"研究1B变压器的注意力地图中的稀疏性模式").定义搜索空间:模型,数据集,计算预算.

2. **Literature pass.**查询50篇最引用的相关论文;缓存摘要本地;生成1页域名摘要.

3. **Tree scaffolding.**首先将根源与种子假设进行初始化.`expand(node) -> children`通过小编辑建议 (每孩子每次进行一个配置更改).`score(node)`作为重量新品 × 质量 × 预算期限.

4. **Sandbox wrapping.**每次实验都会运行.`docker run --network=none --memory=8g --cpus=2 --pids-limit=256 --read-only`种子被写入沙箱,输出只可读.

5. **Plan-execute-verify loop.** `plan`让我知道.`execute`运行沙箱,捕获日志和指标. `verify`失败节点将存储在树上失败原因.

6. **Writer.**预算后,选择最好的分支.用matplotlib生成数字.通过Claude Opus 4.7生成一个LateX草案,将分支的痕迹在文本中.编译.将编译的PDF返回Opus 4.7视觉进行评论.重复.

7. **Reviewer ensemble.**五名评委通过NeurIPS类型的标题评分草案 (新鲜性,严格性,清晰性,可复制性,影响性).如果平均值 <4.0/5,返回作者与批评. 3次重写后,硬停止.

8. **Red team.**构建或集成针对沙箱的反抗任务:叉子炸弹,网络泄密尝试,文件系统逃逸,LLM写的子元字符.确认所有被阻止.写出发现.

9. **Reproducibility.**每张纸都带着树木搜索的JSON,种子,W&B运行链接,沙盒配置,以及一个 README重复它.

## 用它

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

## 运送它

`outputs/skill-ai-scientist.md`由于一个种子想法+一个域名+一个30美元的预算,它运行了整个管道,

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | Paper quality | Blind rubric review against published workshop papers |
| 20 | Experimental rigor | Baselines, seeds, ablations; every claim backed by a cell in the results table |
| 20 | Cost and compute discipline | $30/paper ceiling enforced, Langfuse-traced |
| 20 | Safety | Sandbox red team passes; network policy and kill-switch verified |
| 15 | Reproducibility | One-command rerun with identical seeds reproduces the paper |
| **100** | | |

## 运动

1. 运行管道与同一领域的三个不同的种子想法进行比较. 树-搜索重叠的部分. 识别复制浪费计算.

2. 在实验执行之前,为超过5美元的节点添加一个人-在循环的门.

3. 根据一系列已知坏报纸,测量假接受率.

4. 引入网络泄漏红团队测试: 代理编写试图`curl`确认一个外部地址.`--network=none`政策阻止了它.记录尝试.

5. 根据您的树木搜索和一个平坦的随机基线 (相同的预算,没有扩张策略) 进行比较.

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Tree search | "AB-MCTS-style expansion" | Best-first exploration over experiment nodes with a novelty×quality×budget score |
| Sandbox | "Experiment isolation" | Container with no network, bounded CPU/memory, pinned seeds, read-only inputs |
| Vision critique | "Render-then-read" | Compile the paper to PDF, feed the PDF back to a VLM for layout and claim-evidence critique |
| Reviewer ensemble | "Automated peer review" | Multiple LLM judges scoring the paper with a NeurIPS rubric; weighted aggregate gates the pipeline |
| Novelty score | "Is this new?" | Heuristic that penalizes proximity to the 50-paper literature cache |
| Cost ceiling | "$ budget" | Hard cap on total spend per paper; Langfuse counters + pre-run estimates |
| Red team | "Sandbox-escape audit" | Adversarial tasks that would escape the sandbox if the policy is wrong |

## 进一步阅读

- [Sakana AI-Scientist-v2 repository](https://github.com/SakanaAI/AI-Scientist-v2)参考生产研究机构
- [Sakana AI-Scientist-v1 paper (arXiv:2408.06292)](https://arxiv.org/abs/2408.06292)原始方法
- [ShinkaEvolve (Sakana ICLR 2026)](https://sakana.ai)进化扩展
- [Agent Laboratory (AMD)](https://github.com/SamuelSchmidgall/AgentLaboratory)多功能研究实验室框架
- [LangGraph documentation](https://langchain-ai.github.io/langgraph/)参考管弦层
- [Semantic Scholar Graph API](https://api.semanticscholar.org/) 搜索文献
- [E2B sandboxes](https://e2b.dev)参考实验隔离
- [NeurIPS reviewer guidelines](https://neurips.cc/Conferences/2026/ReviewerGuidelines)评审员组编码的条目
