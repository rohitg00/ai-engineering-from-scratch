# 评估和协调基准

> 五个2025-2026年基准标准涵盖多代理评估领域. **MultiAgentBench / MARBLE**分析星/链/树/图表的顶层与里程碑指标;**graph is best for research**认知规划增加了3%的里程碑成就.**COMMA**评估多模式的无对称信息协调;包括GPT-4o在内的最先进的模型,**MedAgentBoard**医疗工作类别: 医疗工作类别: 医疗工作类别: 医疗工作类别: 医疗工作类别: 医疗工作类别: 医疗工作类别: 医疗工作类别: 医疗工作类别: 医疗工作类别: 医疗工作类别: 医疗工作类别: 医疗工作类别: 医疗工作类别: 医疗工作类别: 医疗工作类别: 医疗工作类别: 医疗工作类型: 医疗工作类型: 医疗工作类型: 医疗工作类型: 医疗工作类型: 医疗工作类型: 医疗工作类型: 医疗工作类型: 医疗工作类型: 医疗工作类型: 医疗工作类型: 医疗工作类型: 医疗工作类型: 医疗工作类型: 医疗工作类型: 医疗工作类型: 医疗工作类型: 医疗工作类型: 医疗类型: 医疗类型: 医疗类型: 医疗类型: 医疗类型: 医疗类型: 医疗类型: 医疗类型: 类型: 医疗类型: 类型: 类型: 类型: 类型: 类型: 类型: 类型: 类型: 类型: 类型: 类型: 类型: 类型: 类型: 类型: 类型: 类型: 类型: 类型: 类型: 类型: 类型: 类型: 类型: 类型: 类型: 类: 类: 类型: 类型: 类: 类: 类: 类: 类: 类: 类: 类: 类: 类: 类: 类: 类: 类: 类: 类: 类: 类: 类: 类: 类: 类: 类: 类: 类: 类: 类: 类:**AgentArch**企业代理架构结合工具使用+内存+调整. **SWE-bench Pro**([arXiv:2509.16941](https://arxiv.org/abs/2509.16941)) 在41个应用程序,B2B服务和开发工具中出现了1865个问题.边界模型在Pro上获得23%的分数,而在Verified上获得70%+的分数.**64.3%**关于PRO与明确的代理团队协调 (尚未发表的人类主要来源; 作为初步处理);**76.1% pass@1**关于验证 ([Verdent technical report](https://www.verdent.ai/blog/swe-bench-verified-technical-report)它们是**AAAI 2026 Bridge Program WMAC**(https://multiagents.org/2026/) 是2026年社区焦点.这个课程基于 MARBLE 的指标,进行了拓与指标扫描,并按"仅通过SWE 台验证不是通用化的证据"规则.

**Type:** Learn
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 16 · 15 (Voting and Debate Topology), Phase 16 · 23 (Failure Modes)
**Time:** ~75 minutes

## 问题

报告称"我们的多代理系统更好",问题是:比什么更好,在什么方面,如何衡量? 2023-2024年多代理评估时代是混乱的.

没有共享基准,你不能有意义地比较两个多代理系统.更糟糕的是,没有持久基准,边界模型可以污染.SWE-bench Verified在2025年中旬被部分污染了训练机构;边界分数膨胀;Pro被设计为无污染的现实检查.

这一课列出了2026年五项标准,列出了每项标准的名称,

## 概念

###          

评估研究,编码和规划任务的四个协调拓 (星,链,树,图) .基于里程碑的KPI跟踪部分进展而不是最终成功.

测量结果:

- **Graph**对于研究场景来说,最好的拓学;支持任何对任何批评.
- **Chain**最适合步骤精炼编码.
- **Star**对于快速的实事整合,最好.
- **Coordination tax**在图表上显示了4个代理.
- **Cognitive planning**增加了在各类拓领域的3%的里程碑成就.

您想比较协调拓的果到果时使用.https://github.com/ulab-uiuc/MARBLE) 提供评价者.

### COMMA 多模式非对称信息

报告结果不舒服:包括GPT-4o在内的边界模型努力击败一个**random baseline**关于COMMA中代理人合作. 信号是多代理模式不充分训练和评估 LLM合理处理单模式合作;多模式协调崩.

系统具有多模式或不对称信息协调时使用. COMMA 的无效结果是要求之前测量警告.

### 域压力测试

医疗任务类别:诊断,治疗规划,报告生成,患者沟通. 进行多代理与单个LLM与传统规则系统的比较.

发现:多代理在大多数类别中没有统治单个LLM.多代理优势是狭窄的. 任务分解有助于分离子任务 (诊断+治疗);当协调总费超过专业化收益时,会有伤害 (报告生成).

如果MedAgentBoard的课程一般化,许多拟议的多代理系统都过于工程.

### 公司架构

企业设置,工具使用,内存和配套配套.基准标识分离每个层的贡献:添加工具有多少帮助?添加内存?添加多代理配套?

您正在设计一个企业代理堆,需要证明每个层的合理性. AgentArch 帮助避免购买无法测量价值的功能.

### 现实检查

设计为: 创建技术,开发技术,开发技术,开发技术,开发技术,开发技术,开发技术,开发技术,开发技术,开发技术,开发技术,开发技术,开发技术,开发技术等.**uncontaminated**边界车型在Pro上获得23%的比分,而在Verified上获得70%以上的比分.

2026年4月的成绩:
- 克劳德·奥普斯 4.7 在Pro: **64.3%**(经过明确的代理团队协调报告;尚未发表任何人类主要来源.
- 经验证的: **76.1% pass@1**([technical report](https://www.verdent.ai/blog/swe-bench-verified-technical-report))
- 无代理架的Pro的边界原始分数: ~23-35% ([SWE-bench Pro paper](https://arxiv.org/abs/2509.16941))

结果: "我们击败了SWE-bench Verified"不再是能力的证据.Pro是目前的盖特测试.代理团队架构对Pro (~30-40点德尔塔) 产生可测量的收益,这是2026年多代理协调的最强实验性论点之一.

### 美国航空航天局2026 WMAC

 关于多代理协调工作坊 (https://multiagents.org/2026/通过该组织的研究,研究人员将对人工智能进行研究,并将其作为"2026年多代理人工智能研究社区焦点".接受的论文和研讨会程序是评估新方法的常规场所;对生产决策的 arXiv预印件的WMAC接受的要求进行推迟.

### 阅读对基准指标的索赔怀疑 2026年检查清单

当有人声称多代理结果:

1. **Which benchmark, which split?**关于错误分数的报道是毫无价值的.
2. **Contamination check.**如果没有,请谨慎处理.
3. **Baseline comparison.**对于单个LLM基线,对随机,对以前的多代理工作.
4. **Statistical significance.**边界模型具有高变量,单次运行误导性.
5. **Task diversity.**总体化是生产的重要任务.
6. **Cost disclosure.**按任务的代币,墙钟. 90% 的解决方案以20倍的成本是商业决定,而不是能力要求.

### 任何基准指标都没有什么好

- **Long-horizon coordination.**现在的标准都不够.
- **Adversarial resilience.**如果一个代理人恶意或有危害,会发生什么?
- **Drift under deployment.**标准是静态的,生产分布变化.
- **Cost-normalized performance.**许多基准指标都显示出原始准确性,而不是每美元的准确性.

建立你真正关心的轴心的内部基准通常是正确的举动.

```figure
a5-bench-gap
```

## 建立它

`code/main.py`是一个非互动的通行:

- 模拟3个多代理系统在玩具任务上.
- 计算每个里程碑的标志.
- 通过将任务从"训练"组中隐,进行污染检查.
- 显然与随机基线相比.
- 打印了指标索赔的分数卡.

运行:

```bash
python3 code/main.py
npx tsx code/main.ts
```

预期输出:系统分数卡,含原始精度,里程碑成就,每任务成本,与随机基线的比分,以及污染检查说明.

## 用它

`outputs/skill-benchmark-reader.md`阅读多代理基准要求并应用审查清单. 产量:评级和警告.

## 运送它

生产评估学科:

- **Build an internal benchmark**公共基准指标提供信息,但不替代.
- **Include a random baseline**如果您无法在协调任务中以大差距击败随机,任务可能会被错误地设置.
- **Report cost alongside accuracy.**代币成本和墙钟. 操作团队需要两者.
- **Rebuild the benchmark quarterly.**产量分配转移;过时的基准误导.
- **Avoid published-benchmark overfitting.**如果你的团队专门为SWE-bench Pro数字进行优化,

## 运动

1. 跑步`code/main.py`确定三个模拟系统中哪个成本比里程碑最高. 它是否与最高的原始精度系统相匹配?
2. 阅读多代理位 (arXiv:2503.01935). 对于您自己的任务域,请决定MARBLE建议的四种拓物种中哪种.根据论文的结果证明.
3. 阅读SWE-bench Pro论文. 具体是什么使其耐污染?
4. 设计一个简单的多模式协调任务,你可以将其添加到你的内部基准.
5. 根据最近的一篇多代理报纸的标题结果,你会给索赔的评分是什么?

## 关键词

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| MARBLE | "MultiAgentBench" | ACL 2025; star/chain/tree/graph topologies with milestone KPIs. |
| COMMA | "Multimodal benchmark" | Multimodal asymmetric-info coordination; frontier models struggle vs random. |
| MedAgentBoard | "Domain stress test" | Four medical categories; often finds multi-agent does not dominate single-LLM. |
| AgentArch | "Enterprise benchmark" | Tools + memory + orchestration layered. |
| SWE-bench Pro | "Contamination-resistant" | 1865 problems, 41 repos; ~23% vs 70%+ on Verified (the contamination signal). |
| Milestone achievement | "Partial credit" | Benchmarks that reward progress, not only final success. |
| Contamination | "Benchmark leaked into training" | Post-release, benchmarks drift into training corpora; scores inflate. |
| WMAC | "AAAI 2026 Bridge Program" | Workshop on Multi-Agent Coordination; community focal point. |

## 进一步阅读

- [MultiAgentBench / MARBLE](https://arxiv.org/abs/2503.01935)具有里程碑指标的拓基准
- [MARBLE repository](https://github.com/ulab-uiuc/MARBLE)参考实施
- [MedAgentBoard](https://arxiv.org/abs/2505.12371)域压力测试;多剂通常没有主导作用
- [AgentArch](https://arxiv.org/abs/2509.10769)企业代理架构
- [SWE-bench leaderboards](https://www.swebench.com/) 边界模型的验证和专业成绩
- [AAAI 2026 WMAC](https://multiagents.org/2026/)2026年社区焦点
