# 人类负责任扩展政策 v3.0

> 俄罗斯国家安全政策3.0将于2026年2月24日生效,取代2023年政策. 两层减轻:安特罗皮克将单方面做什么,而不是作为整个行业的建议 (包括RAND SL-4安全标准). 增加边境安全路线图和风险报告作为常规文件,而不是一次性交付. 减少2023年的暂停承诺. 引入AI研发4门:一旦过渡,人类必须发布确认的案例,确定错误排列风险和减轻. 克劳德·奥普斯4.6不过了. 安特罗皮克在3.0的公告中表示",自信地排除这一点变得困难".SaferAI评价了2023年的RSP为2.2;他们将3.0降级为1.9,将安特罗皮克与OpenAI和DeepMind一起列入"弱"RSP类别. 质量值取代了2023年的量化承诺;取消暂停条款是最严重的回归.

**Type:** Learn
**Languages:** Python (stdlib, RSP threshold decision engine), TypeScript
**Prerequisites:** Phase 15 · 06 (AAR), Phase 15 · 07 (RSI)
**Time:** ~45 minutes

## 问题

边境实验室发布了扩展政策,这些政策部分是技术文件,部分是治理文件,部分是向监管机构的信号.RSP v3.0是当前的人类文件.仔细阅读它并不重要,因为遵守它是有约束力的 (不是),而是因为框架塑造了实验室如何理解灾难风险,以及如何向公众沟通妥协.

对于v3.0和v2.0的差异,这是有用的单元. 增加了什么:边境安全路线图,风险报告,人工智能研发4门. 已删除的内容:2023年暂停承诺. 两层减缓计划分为人类单方面和行业推. 外部评价 SaferAI 将分数从2.2 (v2)降至1.9 (v3.0). 这就是如何扩展政策可以变得不那么严格,同时看起来更精致.

## 概念

### 两层减缓计划

- **Anthropic unilateral actions**培训停止超过一个门,具体的安全措施,具体的部署门户.
- **Industry-wide recommendations**报告中提到, 印度的安全性标准包括RAND SL-4安全标准.

这意味着读者需要看看每个承诺生活在哪个列中. "整个行业推"列中的安全措施不是人类的承诺;这是人类的希望.

### 人工智能研发4门

具体来说:一个模型可以以竞争成本自动化大量的人工智能研究.一旦人类公司认为模型跨越了这一水平,他们必须在继续扩展之前发布一个肯定案例,确定错误排列风险和减轻.

根据 v3.0 宣布,克劳德·奥普斯 4.6 没有过过这个标准. 文件补充说:"确定排除这一点变得困难. " 这种表达是重要的;它承认这个门足够接近,可以成为一个现实的关注,而不是一个投机的限制.

课程6 (自动调整研究) 和课程7 (反复自我改善) 直接进入这个门.自动调整研究人员穿越研究质量条是AI研发4门的证据.

### 边境安全路线图和风险报告

现在,我们已经开始使用了这两个工具.

- **Frontier Safety Roadmap**: 未来展望文件,描述计划的安全工作,能力预期和减轻研究.
- **Risk Report**: 发布后的特定模型后回顾文件,描述观察到的能力和残余风险.

两者都是公开的.两者都在声明的时间表上更新. 实用性是:读者可以跟踪人类在路线图中所说的会如何与他们在风险报告中所报告的相比.

### 删除暂停条款

2023 年的RSP 包含了明确的暂停承诺:如果模型超过了特定能力门,训练将暂停直到减缓实施. v3.0 将明确的暂停取代了更柔软的表述 (发表一个肯定案例,如果减缓足够,继续进行).SaferAI和其他分析师直接称这是新文档中最强烈的回归.

政策论点:2023年的定量门在2026年时代的能力基准上无法达到,因为基准本身被重新扩展.反论点:扩展政策中的暂停条款是一种承诺手段;删除它消除了政策的可信度.

### 安全AI的降级

安全AI是一个独立的组织,该组织评分RSP类型的文档.他们的公众评分:2023年,人类RSP获得2.2分 (从4.0是当前最好的RSP和1.0是名义的规模中).3.0的评分为1.9.这将人类从"中度"转向"弱",加入OpenAI和DeepMind在弱类别.

根据SaferAI的降级因素:
- 质量门取代了量化门.
- 暂停承诺已取消.
- AI研发4门减轻被描述为"确实情况",而不是具体措施.
- 审查机制依赖于安特罗皮克的安全咨询小组,其独立监督有限.

### 这里没有什么教训

根据"RSP 3.0"的规定,人类公司不能遵守任何规定.这不是遵守规则的教训.无人教学没有任何强迫人类公司遵守规则.教训是用应有的具体性和怀疑态度阅读文件.扩展政策是主要公众信号边界实验室关于灾难风险姿势的发射.阅读它们是任何工作取决于边界能力的人的实际技能.

```figure
a5-rsp-ladder
```

## 用它

`code/main.py`根据一个候选模型和一组能力测量,返回是否过过 AI R&D-4 门,所需的肯定案例部分,以及是否可以继续部署.这是故意简单的;目的是明确文件的逻辑.

## 运送它

`outputs/skill-scaling-policy-review.md`审查一个扩展政策 (人类,OpenAI,DeepMind或内部) 与3.0参考:两层结构,门,暂停承诺,独立审查.

## 运动

1. 跑步`code/main.py`确认值值评价者按照预期行为,并产生正确的肯定案例模板.

2. 阅读RSP v3.0完整 (32页). 确定"行业范围内的推"级别中的每项承诺. 在v2中,哪些承诺将是"人类单方面"的?

3. 阅读SaferAI的RSP评级方法. 通过将其标题应用到文档中,重现了其1.9分数的3.0版本.哪个标题行导致了下调?

4. 提议取代承诺,以保持政策的可信度,同时承认2026年基准重新扩展问题.

5. 比较RSP v3.0和OpenAI准备框架 v2 (课 20). 选择一个更强大的区域.

## 关键词

| Term | What people say | What it actually means |
|---|---|---|
| RSP | "Anthropic's scaling policy" | Responsible Scaling Policy; v3.0 effective Feb 24, 2026 |
| AI R&D-4 | "Research-automation threshold" | Capability to automate substantial AI research at competitive cost |
| Affirmative case | "Safety justification" | Published argument that risks are identified and mitigations adequate |
| Frontier Safety Roadmap | "Forward plan" | Standing document on planned safety work and expected capabilities |
| Risk Report | "Retrospective on a model" | Standing document on observed capability and residual risk after release |
| Two-tier mitigation | "Unilateral vs industry" | Anthropic commitments vs industry recommendations, separated |
| Pause commitment | "2023 clause" | Explicit promise to pause training; removed in v3.0 |
| SaferAI rating | "Independent RSP grade" | Third-party rubric; v3.0 scored 1.9 (v2 was 2.2) |

## 进一步阅读

- [Anthropic — Responsible Scaling Policy v3.0](https://anthropic.com/responsible-scaling-policy/rsp-v3-0)全32页的政策.
- [Anthropic — RSP v3.0 announcement](https://www.anthropic.com/news/responsible-scaling-policy-v3)从v2的变化总结.
- [Anthropic — Frontier Safety Roadmap](https://www.anthropic.com/responsible-scaling-policy/roadmap)从RSP3.0链接的常规文件.
- [Anthropic — Risk Report: February 2026](https://www.anthropic.com/feb-2026-risk-report)关于克劳德·奥普斯4.6的回顾,这是它出版时的边界模型.
- [Anthropic — Measuring agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy)将AI研发-4与测量自主化连接起来.
