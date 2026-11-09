# 双重利用能力评估

> 李等",WMDP基准:通过不学习测量和减少恶意使用" (ICML 2024, arXiv:2403.03218). 4,157个多选题涉及生物安全 (1,520),网络安全 (2,225),化学 (412). 问题在"黄区"附近的知识支持区内,通过多专家审查和ITAR/EAR法律合规来过. 双重目的:代理评估双重用途能力和脱学习基准 (伴随式RMU方法降低了WMDP性能,同时保持了一般能力). 2024-2025场地叙述:早期的OpenAI/人类2024评估报告了"轻微升级"在互联网搜索上;到2025年4月,OpenAI的准备框架v2表示,模型"正处于帮助新手创造已知的生物威胁的峰".人类生物武器获取试验显示了2.5倍升级,不足以排除ASL-3.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, WMDP-shaped uplift evaluation harness)
**Prerequisites:** Phase 18 · 16 (red-team tooling), Phase 14 (agent engineering)
**Time:** ~60 minutes

## 学习目标

- 描述WMDP的三个域,问题数量和"黄区"过标准.
- 解释RMU以及为什么WMDP既是评估,也是不学习的基准.
- 描述2024-2025年的升起叙述:"轻度升起" -> "在峰" -> "不够排除ASL-3".
- 区分初学者相对的升级与专家绝对能力.

## 问题

双重使用能力是每个实验室的边界安全框架下的测量问题 (课 18). 问题是,模型X是否能显著提升新手在生物,化学或网络领域造成大规模伤害的能力? 直接测量 (要求模型实际产生损害) 是违法和不道德的. 代理测量需要一个基准,模型不能拒绝 (产生诚实的能力数量),但其问题本身不是有害的出版物.

## 概念

### 黄区

需要接近,能够了解有害过程的问题,而不是直接合成的方法. "什么反应剂催化了[发表的路径]的第4步?"而不是"我如何制造[危险化合物]?"每个问题由多个领域专家进行审查;过以确定ITAR/EAR的出口控制合规性.

总共有4157个问题:
- 生物安全:1,520
- 网络安全: 2,225
- 化学: 412

模特没有被要求协助任何东西,能力可以测量而不会引起有害行为.

### 代表性错误指导不学习

随机解学方法. 应用到LLaMa-2-7B,将WMDP分数降低到近随机,同时保持MMLU和其他一般能力基准在几个百分点内. 发表的方法是每次生物化学网络解学论文的解学基准.

### 2024-2025年升起的叙事

三个阶段:

1. **2024 "mild uplift."**早期的OpenAI和人类准备/RSP评估报告了尝试生物相邻任务的初学者在互联网搜索中具有较小的优势.

2. **April 2025 "on the cusp."**开通AI的准备框架v2报告了模型"在帮助新手创造已知的生物威胁的边缘".

3. **Anthropic's 2025 bioweapon-acquisition trial.**随着新手参与者进行的控制研究,测量了收购阶段任务的相对成功.报告的升级为2.53.不够排除ASL-3 (课 18) 人类责任扩展政策3级的门值已达到或接近.

### 初学者对专家对绝对

对于这些问题,

- **Novice-relative uplift.**模型有多大帮助一个非专家?多倍.相对优势很大,因为新手知道很少;即使是小小的信息也有帮助.
- **Expert-absolute capability.**专家可以提取更多信息,而不是初学者.绝对的天花板很高.

安全案例 (课 18) 针对两者: "模型不能给初学者足够的提高执行"以及"专家不能从模型中提取尚未发布的信息".

### 测量陷

基于 WMDP 的数据,WMDP 是一个能力代理,而不是部署测量.
- 发射阻力 (不需要安全过器的,才能得到能力的难度)
- 默默的知识 (需要湿实验室技能的能力,而不是信息)
- 执行障碍 (采购,设备)

普的2025年生物武器采购试验增加了初学者启动层,并增加了WMDP类型的能力:它测量了实际任务成功,而不是多种选择能力.

### 在这个阶段的第18阶段

课时12-16是针对模型输出的攻击和防御工具.课时17是双用途能力层. 课时18是边境安全框架评估的测量.课时30是通过2026年的网络/生物/化学/核升级证据来完成这一任务.

```figure
al-wmdp-yellow-zone
```

## 用它

`code/main.py`通过一个简单的不学习干预 (零出域特定表示) 降低了分数;你可以衡量对一般能力的折衷.

## 运送它

这一课产生了`outputs/skill-wmdp-eval.md`鉴于可用双重能力的说法 ("我们的模型对生物武器没有任何意义",它审计了:哪些基准标准运行,哪些拒绝路径用于评估 (原始完成与政策目标),以及是否新手启动研究补充了多次选择结果.

## 运动

1. 跑步`code/main.py`报告玩具脱习步骤前后的各领域准确性. 解释一般能力的交易.

2. 增加玩具WMDP的第四个领域 (例如,放射性).在黄色区指定两个插图问题类型.解释为什么编制这样的问题比添加MMLU形状的问题更难.

3. 阅读WMDP 2024第5节 (RMU方法). 绘制一个更简单的不学习方法 (例如,抑制域内容的顶级k神经元) 并描述预期的一般能力成本.

4. 关于人类2025年生物武器采购试验报告的增长为2.53.描述这两个方法可以偏向上方 (初学者样本大小,任务忠诚度) 和下方 (诱导天花板,模型安全门).

5. 阐述 ASL-3 的安全情况需要的内容,除了通过WMDP脱学习之外. 举出至少两项补充性诱导研究.

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| WMDP | "the dual-use benchmark" | 4,157 MCQ questions across bio/cyber/chem in the yellow zone |
| Yellow zone | "enabling but not synthesis" | Proximate knowledge adjacent to harmful capability without being a synthesis recipe |
| RMU | "the unlearning baseline" | Representation Misdirection for Unlearning; reduces WMDP scores, preserves general capability |
| Novice-relative uplift | "how much it helps non-experts" | Multiplicative advantage over status-quo internet search for a novice |
| Expert-absolute capability | "ceiling for experts" | Maximum information extractable from the model by a motivated expert |
| Acquisition-phase task | "steps before synthesis" | Procurement, equipment, permits — the earliest parts of a harm pathway |
| ITAR/EAR | "export-control compliance" | Legal frameworks that constrain publishing certain enabling knowledge |

## 进一步阅读

- [Li et al. — The WMDP Benchmark (arXiv:2403.03218, ICML 2024)](https://arxiv.org/abs/2403.03218)基准和RMU文件
- [OpenAI — Preparedness Framework v2 (April 15, 2025)](https://openai.com/index/updating-our-preparedness-framework/)"在边"的语言
- [Anthropic — Responsible Scaling Policy v3.0 (February 2026)](https://www.anthropic.com/responsible-scaling-policy)ASL-3生物门和收购试验结果
- [DeepMind — Frontier Safety Framework v3.0 (September 2025)](https://deepmind.google/blog/strengthening-our-frontier-safety-framework/)生物升级CCL
