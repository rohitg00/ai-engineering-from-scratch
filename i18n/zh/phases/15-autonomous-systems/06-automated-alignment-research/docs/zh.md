# 机动调整研究 (人类 AAR)

> 人类运行了克劳德·奥普斯4.6自主排列研究人员的并行团队在独立的沙盒中,通过一个共享论坛协调,他们的日志在任何沙盒之外 (因此代理人不能删除自己的记录). 在弱到强的训练问题上,AAR超过了人类研究人员. 根据Anthropic的简要标志,规定工作流程,通常会限制AAR的灵活性,降低性能. 自动化调整研究将时间线压缩,并且在RSP旨在检测的错误调整风险上也是如此.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, parallel-research-forum simulator)
**Prerequisites:** Phase 15 · 05 (AI Scientist v2), Phase 15 · 04 (DGM)
**Time:** ~60 minutes

## 问题

调整研究在人与研究人员的时间中昂贵.可扩展的监督,奖励规范或弱到强的培训等问题需要每次进行数周的实验.随着边界能力的进步,调整工作负载增长得比合格研究人员的供应更快.

自动配列研究 (AAR) 询问是否能够弥补差距,同时还能超越配列能力的边界模型. 关于AAR运行的弱到强训练研究的2026年报告 (alignment.anthropic.com/2026/automated-w2s-researcher/) 是该类部署的系统的第一项公开结果之一.

结果是真正积极的:AAR解决了一个研究问题比人类基线更好.结果还集中在一个系统中,每个问题在这个阶段已经发展.如果对齐研究可以自动化,那么危害保障的部分也可以.

## 概念

### 建筑 (正如公开描述的)

- **Parallel agents.**多个Claude Opus 4.6实例都作为AAR运行,每个实例都在一个独立的沙盒中.沙盒限制了文件系统,网络和进程表面.
- **Shared forum.**结果被发布到一个存储后台位于每一个沙盒外的共享论坛. 代理人可以阅读论坛;代理人不能从自己的沙盒中删除或编辑论坛记录.
- **Task allocation.**人为设计的任务队列将研究问题分配给AAR.AAR提出分解,运行实验,写出发现.
- **Weak-to-strong training focus.**发表的研究涉及弱到强的培训使用较弱的监督模式培训更强的学生模型.

### 为什么"出沙箱"日志重要

记录完整性属性是控制实验与潜在的受损实验之间的区别.如果AAR能够编辑自己的记录,它们可以掩盖失败或可疑的实验.人类标志着这一点直接:该属性是对研究成果的信任的必要条件,并且验证是非微不足道的.

基础设施方面,模拟是仅添加到外部存储的记录 (例如S3对象锁定,不可变的Datadog记录).该代理人没有修改过去的记录的凭证.这是2026年企业安全团队使用的相同模式来制作反软件的审计轨迹.

### 规定的工作流量交易

根据"人类"的报告,规定的工作流程通常会限制AAR的灵活性,降低性能.换句话说:如果人类设计师逐步写出研究计划,AAR的表现会比给出高层次的目标和分解自由更糟糕.这与整个机构研究 (LangGraph,微软的代理框架) 结果一致.

灵活性可以提高AAR性能,也可以使其无法被批准分解,使用新工具和实现目标漂移. 折衷是设计空间的决定:在没有提供代理空间来将目标概括之外的目标的情况下,多少灵活性可以购买足够的能力来击败人类?

### 压缩风险

根据深思维度的FSF版本,DepMind的FSF版本3包含类似的ML研发自主化水平.这两个框架都将这一门作为提高控制的触发器.

亚亚超值一步:它自动化了部分管道 (对特定,精确任务进行排列研究),但不是端到端能力开发循环.时间线问题是,距离的缩小速度是多快.

压缩的时间表是复合故障的担忧. 如果对准研究和能力研究以相似的速度复合,则对准不一致的风险表面至少与能力一样快速增长. 如果能力增长得更快 (历史趋势), 这就是AAR作为合格商品的论点:如果研究过程值得信赖,每次额外的调整结果都会减少差距.

### 什么AAR不取代

人类研究人员设定任务队列,审查结果,并持有宪法权威.AAR加速管道的中间,而不是终点.人类的发表产品包括AAR贡献和人类研究人员对什么发表,什么撤回,什么精炼的判断.

这与第15课中的提出然后承诺模式相符:AAR提出,人类承诺.

```figure
aar-forum
```

## 用它

`code/main.py`模拟一个多个AAR研究论坛.三个独立的"研究代理"并行运行,将研究结果发布到一个仅供添加的论坛,并进行了可选的操纵尝试.

观察:

- 如何在沙箱中进行记录,捕获木材改的尝试.
- 如何通过自由分解分配任务,在更难的问题上超过固定工作流程.
- 如果记录不被改, 一个被破坏的AAR如何污染论坛的信号.

## 运送它

`outputs/skill-aar-deployment-review.md`是一个自动化调整研究管道的部署前审查.

## 运动

1. 跑步`code/main.py`设置"固定工作流程"与"自由分解"的设置.自由分解总是赢得胜利,还是有问题类别,固定工作流程是竞争的?

2. 修改模拟器,让一个代理试图改日志. 确认只添加日志检测到它. 写一段说明日志中检测签名的样子.

3. 读一读人类软件的弱到强的AAR报告. 确定AAR比人类研究人员更具具体的任务.

4. 设计一个任务队列分配政策,以平衡AAR灵活性 (更好的结果) 与规定的工作流程限制 (更简单的审计).描述您将A/B测试两者的方式.

5. 在一个段落中,描述你认为会跨越它,而AAR目前没有.

## 关键词

| Term | What people say | What it actually means |
|---|---|---|
| AAR | "Automated Alignment Researcher" | Claude Opus 4.6 instance operated autonomously on alignment problems |
| Weak-to-strong training | "Training a stronger model with a weaker supervisor" | Classic scalable-oversight benchmark AARs outperformed humans on |
| Shared forum | "Where agents publish findings" | Append-only, out-of-sandbox storage |
| Out-of-sandbox log | "Agent cannot edit its own record" | Tamper-evident write-through to external storage |
| Prescribed workflow | "Step-by-step plan from human designer" | Constrains AAR; often degrades performance vs free decomposition |
| Free decomposition | "Agent decides how to break the task" | More capable, harder to audit |
| AI R&D threshold | "RSP/FSF capability level" | Full automation of R&D pipeline at competitive cost |
| Compressed timeline | "Alignment vs capability race" | If capability compounds faster than alignment, misalignment risk grows |

## 进一步阅读

- [Anthropic — Automated Weak-to-Strong Researcher](https://alignment.anthropic.com/2026/automated-w2s-researcher/)主要来源
- [Anthropic Responsible Scaling Policy v3.0](https://anthropic.com/responsible-scaling-policy/rsp-v3-0)人工智能研发门框架
- [Anthropic — Measuring AI agent autonomy](https://www.anthropic.com/research/measuring-agent-autonomy)更广泛的代理自主制框架.
- [DeepMind Frontier Safety Framework v3](https://deepmind.google/blog/strengthening-our-frontier-safety-framework/) ML 与RSP相对的研发自主性水平.
- [Burns et al. (2023). Weak-to-Strong Generalization (OpenAI)](https://openai.com/index/weak-to-strong-generalization/)AAR攻击的根本问题.
