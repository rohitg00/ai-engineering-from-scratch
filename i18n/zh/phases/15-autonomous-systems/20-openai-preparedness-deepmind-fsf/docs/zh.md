# 开放AI准备框架和深思维度边界安全框架

> 开放AI准备框架v2 (2025年4月) 引入了与跟踪类别不同的研究类别:长距离自治,沙包,自主复制和适应,破坏保障. 追踪类别引发能力报告以及安全咨询小组审查的保障报告. 深思维的FSF v3 (9月2025年,随着追踪能力水平的增加2026年4月17日) 将自主性折叠成ML研发和网络领域 (ML研发自主性级别1 =以竞争成本对抗人工+AI工具完全自动化AI研发管道). 通过自动监测仪器推理滥用,FSF v3明确解决欺骗性调整. 诚实的注意: PF v2 (包括长距离自主) 中的研究类别不会自动触发减轻;政策语言是"潜在的".

**Type:** Learn
**Languages:** Python (stdlib, three-framework decision-table diff tool), TypeScript
**Prerequisites:** Phase 15 · 19 (Anthropic RSP)
**Time:** ~45 minutes

## 问题

第19课仔细阅读人类学的扩展政策. 这一课通过阅读OpenAI和DeepMind的图像来完成了图像.这三个文件是表兄弟文物,解决了相同的问题.

融合:三者都将长距离自主权作为值得追踪的能力类. 它们都承认欺骗行为 (伪造配合,鱼) 是特定的风险类别. 它们都拥有内部审查机构. 差异:OpenAI将类别分为"追踪" (强制减轻) 和"研究" (无自动触发). 心把自主权折叠成两个领域,而不是单独命名. 实验室称之为Tracked vs Research,或Critical vs Moderate,或Tier-1 vs Tier-2; 运营后果在哪个桶里一个能力生活在实验室之间不同.

阅读它们在一起是有用的练习.同样的能力可以是"强制减轻"在人类,"监控但不触发"在OpenAI,和"追踪在特定领域"在深思维.政策姿势重要.

## 概念

### 开放AI准备框架v2 (2025年4月)

结构:

- **Tracked Categories**引发能力报告 (模型能做什么) 以及保障报告 (有哪些减轻措施).
- **Research Categories**实验室正在跟踪但尚未承诺具体减轻的模型能力. 包括长距离自主化,沙包,自主复制和适应,破坏保障措施.

关键框架在v2:研究类别不会自动触发减缓.政策语言是"潜在"减缓.这是观察的具体的三角形:在Tracked vs Research中,一个类别的位置是"关门"和"观察"之间的链.

### 深思边界安全框架 v3 (2025年9月;2026年4月17日增加了跟踪能力水平)

结构:

- **Critical Capability Levels (CCLs)**技术能力门分为三组:滥用 (CBRN,网络,有害操纵),ML研发和勘探错误排列轨道.自主化不是自己的领域;它被折叠成ML研发和网络.
- **Tracked Capability Levels**具体例子:ML研发自主化级别1 = 完全自动化人工智能研发管道以竞争性成本对比的人工+人工智能工具.
- **Deceptive alignment monitoring**:明确承诺对仪器推理滥用的自动监测.

独立框架与OpenAI不同.DeepMind不把"自治"作为顶级域名;它被折叠成自主权可能造成伤害的域名 (ML R&D和网络).论点是,没有域名的自主权是没有风险的能力;反论点是,跨域域的自主权是框架应该命名的超级风险.

### 三个东西都相结合

- 内部安全咨询小组 (名为人类SAG,OpenAISAG,深思维的内部委员会).
- 明确提到欺骗性配合/配合假装作为风险类别.
- 现存的文物,按声明的序列 (人类:边境安全路线图,风险报告;OpenAI:能力和保障报告;DeepMind:FSF更新周期).
- 承认仅仅监控的防御系统有限. 深思明确说:"自动监控将不会长期保持足够的状态.

### 在它们的分歧

- **Anthropic**关闭关闭:在v3.0中删除暂停承诺;AI研发-4门是下一个名字的门口.
- **OpenAI**: 追踪与研究分区;研究类别 (包括长距离自主权) 没有自动关门.
- **DeepMind**随着其它领域的自主化; 随访能力水平在2026年4月增加了细分性.

### 沙:一个特殊的能力,

沙 (一个在评估上战略性上表现不佳的模型) 在OpenAI的研究类别中.安тропо克的RSP v3.0通过评估-文本差距 (课 1) 来解决.DeepMind通过FSF v3中的欺骗性对齐监测来解决.

如果模型不适用于评估,每个框架的能力门值就会被低估. 框架只能有效,只要测量有效. 这就是为什么除了实验室自我评估外,还需要外部测量 (课时21:METR) 和对抗评估.

### 阅读政策的技能

- 您需要在保险中找到所有功能,如果不可以找到,保险不包括.
- 类别:它是追踪 (触发缓解) 或研究 (追踪但没有触发)?OpenAI称之为此;人类和深思有自己的相当.
- 率:政策是否在声明的时间表上更新,还是仅在特定事件之后?
- 独立:外部审查是强制性的还是可选的?人类与阿波罗和美国人工智能安全研究所合作伙伴;OpenAI与METR;深思与内部SAG主要合作伙伴.

```figure
a5-tracked-vs-research
```

## 用它

`code/main.py`根据一个功能 (自主化,欺骗性调整,研发自动化,网络升级等),它输出了三个政策中的每个政策如何分类能力,以及什么缓解触发. 它是一个阅读辅助,而不是政策工具.

## 运送它

`outputs/skill-cross-policy-diff.md`通过使用三个框架作为参考,为特定能力进行跨政策比较.

## 运动

1. 跑步`code/main.py`确认不同工具的输出符合至少两个功能的政策,你可以与源文件进行验证.

2. 阅读全文OpenAI准备框架 v2. 识别每个研究类别.为每一个,写一句话说明为什么它在研究而不是追踪.

3. 阅读深思维护FSF v3完整,加上2026年4月的追踪能力水平更新. 确定ML研发自主级别1的具体评估标准.你将如何外部测量它?

4. 沙包装在OpenAI的研究类别中.设计一个评估,使沙包装模型强迫其实际能力.参考课程1的评估环境游戏讨论.

5. 根据您的选择,对特定功能进行三项政策进行比较. 指定您认为哪些政策的分类是最严格的,哪些是最少的. 用源文本证明理由.

## 关键词

| Term | What people say | What it actually means |
|---|---|---|
| Preparedness Framework | "OpenAI's scaling policy" | PF v2 (April 2025); Tracked vs Research categories |
| Tracked Category | "Mandatory mitigation" | Triggers Capabilities + Safeguards Reports; SAG review |
| Research Category | "Monitored only" | Tracked but no automatic mitigation; includes Long-range Autonomy |
| Frontier Safety Framework | "DeepMind's scaling policy" | FSF v3 (Sept 2025) + Tracked Capability Levels (Apr 2026) |
| CCL | "Critical Capability Level" | DeepMind threshold per domain (CBRN, Cyber, Harmful Manipulation, ML R&D) |
| ML R&D autonomy level 1 | "R&D automation" | Fully automate AI R&D pipeline at competitive cost |
| Sandbagging | "Strategic underperformance" | Model underperforms on evals; in OpenAI Research Categories |
| Instrumental reasoning | "Means-ends reasoning" | Reasoning about how to achieve goals; target of DeepMind monitoring |

## 进一步阅读

- [OpenAI — Updating our Preparedness Framework](https://openai.com/index/updating-our-preparedness-framework/) v2 公告.
- [OpenAI — Preparedness Framework v2 PDF](https://cdn.openai.com/pdf/18a02b5d-6b67-4cec-ab64-68cdfbddebcd/preparedness-framework-v2.pdf)完整的文件.
- [DeepMind — Strengthening our Frontier Safety Framework](https://deepmind.google/blog/strengthening-our-frontier-safety-framework/)FSF v3公告.
- [DeepMind — Updating the Frontier Safety Framework (April 2026)](https://deepmind.google/blog/updating-the-frontier-safety-framework/) 追踪能力水平增加.
- [Gemini 3 Pro FSF Report](https://storage.googleapis.com/deepmind-media/gemini/gemini_3_pro_fsf_report.pdf)FSF格式风险报告的例子.
