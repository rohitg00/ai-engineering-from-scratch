# 时间水平和外部能力评估

> 根据该报告,该公司的资产在该地区的总额为1%. 他们的时间视野1.1基准 (2026年1月) 符合任务成功概率与专家人类完成时间的物流曲线;50%概率的交叉定义了模型的时间视野. 20252026的参与集包括GPT-5.1,GPT-5.1-Codex-Max和原型监测评估 (监测器可以捕获侧任务;可以逃避代理). 基准套件:HCAST (180+ML,网络,SWE,推理任务; 1分钟到8+小时),RE-Bench (71ML的研究工程任务与专家基线),SWAA. 诚实的说明:METR测量是理想化的,没有人,没有实际的后果, 时间视野是上限,而不是部署预测.

**Type:** Learn
**Languages:** Python (stdlib, logistic-fit horizon estimator), TypeScript
**Prerequisites:** Phase 15 · 01 (Long-horizon agents), Phase 15 · 19 (RSP)
**Time:** ~60 minutes

## 问题

规模化政策 (课时19,20),只能与它们所指的测量一样有用. "AI R&D-4门"和"长距离自主化"在政策散文中定义;只有当特定评估产生特定数字时,它们才会被执行.

 METR是20242026外部评估组织,它已经定义了许多这些数字. 他们评估边界模型通常在发布前,在NDA下与实验室,然后发布方法. 时间视野1.1基准 (2026年1月) 是他们的标题文物:一个单个尺度,将能力压缩成一个可读的单位 ("这个模型可以完成一个专家在50%的可靠性下花费X小时的任务").

课程部分是关于方法 (如何计算一个视界) 和部分是解释 (为什么视界是一个上限,而不是部署预测).这两个技能都属于一起.一个了解视界是如何适合的团队,比一个只看到"14小时"在幻灯片上的团队更难以用一个糟糕的供应商声称来欺骗.

## 概念

### 计量背景

- 成立于2023年12月 (前ARC Evals,分成独立的501 ((c) ((3)).
- 范围:评估边界模型的自主能力,通常是预发布.
- 合作实验室:人类学,OpenAI (多项参与 2025~2026).
- 值得注意的成果:时间视野1.0 (2025年3月),时间视野1.1 (2026年1月),原型监测评估.

### 时间视野适合

方法 (来自METR博客和论文):

1. 收集一个分钟到小时的专家完成时间的任务套件. 目前的套件:HCAST (180多项任务),RE-Bench (71项任务),SWAA.
2. 运行模型在每个任务;记录成功或失败.
3. 适应物流曲线:$P(\text{success})$作为一个函数$\log(\text{expert completion time})$现在,我们要去.
4. 视界是专家时间,P成功=0.5.

逻辑适应的形状是正确的,因为能力通常与任务难度的关系越来越高,接近平原.50%点是选择 (10%,90%);METR在详细的论文中报告多个门值,但以50%领先,因为它是最直观的.

### 2026年1月的数字

按时间视野1.1:

- 克劳德·奥普斯 4.6: 时间视野 1.1 (2026年1月) 起,可靠度为50%~14小时.
- 在HCAST类型任务中,翻倍时间:TIME Horizon 1.1 (1月2026) 报告的2023后的适应时间为 ~4.3个月 (130.8天);TIME Horizon 1.0 的全 20192025适应时间为 ~7个月,并与2023后的数字一起报告在TH1.1中.

它们被引用在安特罗皮克的RSP v3.0 (课 19) 和DeepMind的FSF v3 (课 20) 中作为值评估的测量之一.

### 标准套餐

- **HCAST**专家时间:1分钟至8小时以上. 视野数后的主要套件.
- **RE-Bench**测量模型是否能够完成符合AI研发4门的ML研发工作.
- **SWAA**:较短的任务;可用于定位地平线曲线的低端.

### 试机监测评估

20252026 METR工作包括监测和评估原型:监测器能否捕获执行侧任务的模型 (除了操作员要求的外),能否使代理人逃避监测器.这些直接提供OpenAI PF v2中的"破坏保障措施"类别和DeepMind FSF v3 (课程20) 中的欺骗性对准监测.

### 为什么地平线是上限

- **Idealized tooling**模型的标准任务为模型提供了清洁的工具和格式化数据.
- **No real consequences**实际部署有不可逆转的风险.
- **Eval-context gaming**课1:模型在测试中表现不一样. 2026年国际人工智能安全报告实验性地记录了这一点.
- **No legitimate user variance**实际用户生成模糊,依赖环境的请求.

发展水平是有利条件下能力上限. 部署可靠性是不同的数量,较低,团队必须测量自己的分布才能知道它.

### 外部评估者案件

内部实验室有动机优化报告的指标,外部评估是重要的.METR的独立性  501 ((c) 3) 具有声明的方法和同行审查的论文是结构减轻.单独的减轻不够 (实验室仍然控制METR看到的),但它严格比没有外部评估更好.

### 如何在实践中使用视界数字

- **As a capability filter**:如果模型的视野远低于拟议任务的专业时间,请不要自动运送 (Lesson 1'技能文件).
- **As a trend indicator**双倍时间告诉你,即使没有新的减轻措施,当前的做法将保持安全的时间.
- **As a prior**根据您的任务分配,工具质量和部署环境,调整.

```figure
a5-horizon-fit
```

## 用它

`code/main.py`实现任务成功与任务成功的物流适应$\log(\text{expert time})$报告50%的水平 (METR的标题),10%的水平 (保守),90%的水平 (乐观).

## 运送它

`outputs/skill-horizon-interpretation.md`审查出售商的视野索赔,并对基准索赔与部署现实进行差距分析.

## 运动

1. 跑步`code/main.py`现在将任务时间格格分减半,视野是否有意义地估计变化?

2. 阅读METR的时间视野1.1博客文章. 确定可靠性最高和最低的具体任务. 解释为什么存在差距.

3. 阅读METR的"测量自主人工智能能力"资源.列出HCAST任务类别.选择一个类别,你会对生产任务进行更重的权重,并证明为什么.

4. 引入评估背景游戏到模拟器中:将失败任务的20%转换为成功. 报告新的视野. 这接近20%的游戏率对观察到的数量做什么.

5. 设计一个内部视野评估,以您自己的 bug 后备表或代表性任务集. 描述数据收集,合适性和输出告诉您的内容. 进行METR 数字比较.

## 关键词

| Term | What people say | What it actually means |
|---|---|---|
| METR | "External evaluator" | ex-ARC Evals; independent 501(c)(3) since Dec 2023 |
| Time Horizon | "Capability measure" | Expert task length at 50% reliability, from logistic fit |
| HCAST | "METR's main suite" | 180+ tasks spanning 1 min to 8+ hours |
| RE-Bench | "Research engineering" | 71 ML research-engineering tasks with human baseline |
| SWAA | "Short-task suite" | Calibrates the low end of the horizon curve |
| Doubling time | "Growth rate" | Time for the 50% horizon to double; ~7 months per HCAST |
| Eval-context gaming | "Model behaves differently" | Documented behavior gap between tests and deployment |
| Upper bound | "Horizon is a ceiling" | Benchmark horizon > deployment reliability under load |

## 进一步阅读

- [METR — Resources for Measuring Autonomous AI Capabilities](https://metr.org/measuring-autonomous-ai-capabilities/) HCAST,RE-Bench,SWAA规格.
- [METR — Measuring AI Ability to Complete Long Tasks](https://metr.org/blog/2025-03-19-measuring-ai-ability-to-complete-long-tasks/)原始的视界纸.
- [METR — Time Horizon 1.1 (January 2026)](https://metr.org/research/)目前的数字和方法.
- [Epoch AI — METR Time Horizons benchmark](https://epoch.ai/benchmarks/metr-time-horizons) 现场追踪.
- [Anthropic — Measuring agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy)对METR测量的内部观点.
