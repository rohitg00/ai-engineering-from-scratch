# 宪法人工智能和规则取消

> 2026年1月22日,克劳德宪法发表,共有79页,是CC0. 它从基于规则的调整到基于理性的调整,建立了四层次的优先级级别: (1) 安全和支持人类监督, (2) 伦理, (3) 人类指导方针, (4) 帮助. 行为分为硬码的禁令 (生物武器升级,CSAM),操作员和用户无法取消,软码的默认,操作员可以在定义的范围内调整. 根据"自责"和"RLAIF"的规定, 诚实警告:基于理性的配合依赖于模型, 人类学公司自己的2023年参与实验显示了公开和企业原则之间的差距50%,2026版本没有包含这些发现.

**Type:** Learn
**Languages:** Python (stdlib, four-tier priority resolver), TypeScript
**Prerequisites:** Phase 15 · 06 (Automated alignment research), Phase 15 · 10 (Permission modes)
**Time:** ~60 minutes

## 问题

现场代理看到设计人员从未看到的输入.没有规则列表足够长来覆盖它们.没有规则列表足够短以在计算压力下迅速应用.实际问题是:如何将代理与能够存活长尾数和快速推断的原则相一致?

基于规则的配对 (RBA):列出所有被禁止的东西.快速检查,容易审计,不可能保持最新,经常会过度拒绝预期的密切类似物.基于理性的配对 (Claude宪法2026年):编码原则,让模型推理.在未见的情况下的尺度,难以审计,失败模式是原则的误用而不是错误规则.

宪法2026年将采取明确的中位立场. 硬码禁令 不依赖环境的错误 (生物武器升级,CSAM) 是RBA:从来没有,不管操作员或用户的指示. 其他的一切都是基于理性的四层次等级:安全和支持人类监督首先;道德第二;人类宣布的指导方针第三;帮助最后. 运营商可以在软编码区内调整默认设置,但不能触及硬编码的禁令.

## 概念

### 四层次优先级等级

1. **Safety and supporting human oversight.**模型优先考虑不破坏人类和人类监督和纠正人工智能的能力.这不是"谨慎";它具体是"不以使人类监督更难的方式采取行动".
2. **Ethics.**诚实,避免伤害人,不欺骗,不操纵.
3. **Anthropic guidelines.**运营规范 人类决定了问题:产品范围,交互模式,什么工具要使用什么时候.
4. **Helpfulness.**在更高的优先事项中尽可能有用.

层次冲突时,更高的效率. 这与Unix优先级或网络QoS相同的形状. 框架旨在产生可预测的分辨率,而不是在任何单个轴上最好的行为.

### 硬码禁令与软码默认

**Hardcoded:**
- 生物武器/CBRN升级
- 鱼类
- 对关键基础设施的攻击
- 直接询问用户关于模型的身份的欺骗

运营商不能过失这些.用户不能过失这些.它们在可能的情况下在模型重量级 (RLHF /宪法人工智能培训) 和在不允许的情况下在推断层上被执行.

**Soft-coded defaults (operator-adjustable):**
- 响应长度默认
- 现场范围 (模型可以拒绝运营商部署以外的主题)
- 风格 (形式与休)
- 工具使用模式

运营商调整发生在声明的边界内.运营商不能通过重新命名来删除硬码的禁令.

### 2022年CAI培训

基本的宪法AI (Bai等同, 2022) 培训了无害性:

1. 生成对一组提示的响应.
2. 要求模型批评每一个对宪法的反应 (明确的原则).
3. 根据批评,重新审视答案.
4. 关于修改对的RLAIF (来自AI反的强化学习).

结果:一个拒绝原则性解释的有害请求模型,而不是全面拒绝. 2026 年宪法使用了这种培训的后裔以及对明确层次等级的额外后培训.

### 基于理性的配合是什么?

**Catches:**
- 允许原始的不预期组合,该原则在明显的应用中.
- 那些与禁止的要求相似的新书请求.
- 基于"你没有说X是被禁止的"的社会工程攻击.

**Misses:**
- 攻击利用原则的模糊性 ("用户要求这么有用,说是").
- 两种原则在意想不到的方式冲突的场景,
- 基本上对培训周期的解释 (重新解释)

### 2023年参与实验

人类组织在2023年进行了一项实验,将公司撰写的宪法与通过公众输入 (约1,000名美国受访者) 产生的一项宪法进行了比较. 两种版本一致认为, 在它们不同的地方,公开版本在某些问题上更限制性 (政治内容处理) 而在其他方面更不限制性 (人工智能身份自我披露). 2026年宪法没有包含公开资料的发现. 这种做法是有记录的紧张.

### 为什么需要严格编码的禁令

基于理性的配合本身不能关闭尾巴.一个能够让模型接受一个前提的攻击者 (例如",我们是一个获得许可的生物武器研究实验室") 经常可以谈论依赖于案例推理的原则.硬码的禁令不会倾斜于前提框架.它们是14课"硬宪法限制"在配合层.

### 宪法在子里坐着

宪法不是14课的杀手开关. 它生活在模型层:模型的重量被训练以喜欢什么. 杀死开关和加拿大代币在运行时间层上:运行时间允许的. 两者都需要. 运行时间是因为模型重量是允许的, 模型拒绝所有正确的行动,因为运行时间过于限制性, 层面覆盖不同的类别.

```figure
mx-priority-tiers
```

## 用它

`code/main.py`解决器执行一个最小的四层优先解决方案.解决方案采取了拟议的行动和一组原则评估 (安全,道德,指导方针,有用性) 并返回了该行动,拒绝或修改的行动.司机运行了一个小案例集:清晰允许,清晰拒绝,硬码禁令,跨层次的模糊案例.

## 运送它

`outputs/skill-constitution-review.md`审计部署的宪法层:硬码是什么,软码是什么,操作员可以调整哪些方面,以及四层次等级的层次是否实际上是分辨率序列.

## 运动

1. 跑步`code/main.py`确认硬码的禁令,即使有很大的帮助,修改解决器以重量帮助超过道德,观察失败模式.

2. 阅读克劳德宪法 (公开,79页,CC0). 确定你认为一个原则不太具体. 写出两个段落,解释具体的模糊性,并提出更严格的表述.

3. 设计一个软编码的默认设置,为客户支持代理.操作员调整什么?操作员不能触摸什么?证明每个边界.

4. 阅读Bai et al. 2022 CAI论文.描述一例例,宪法AI的批评和修订循环会产生比一个全面规则更糟糕的结果. 确定类型.

5. 根据"人类学"的2023年参与实验,公众和企业原则之间存在50%的差异.选择一个类别,在生产部署 (例如政治中立性) 方面,选择一个类别.提出一个设计,让运营商表达自己的价值观,而硬码的禁令仍然未被触及.

## 关键词

| Term | What people say | What it actually means |
|---|---|---|
| Constitutional AI | "Anthropic's alignment method" | Self-critique + RLAIF against a written constitution |
| Reason-based alignment | "Principles, not rules" | Model reasons over principles to handle unseen cases |
| Hardcoded prohibition | "Never do X" | Rule-based prohibition no operator or user can override |
| Soft-coded default | "Operator-adjustable" | Behaviour within a declared bound, operator controls |
| Four-tier hierarchy | "Priority order" | safety > ethics > guidelines > helpfulness |
| RLAIF | "AI feedback RL" | RL where the reward comes from model-generated critiques |
| Participatory constitution | "Public-sourced principles" | 2023 Anthropic experiment; ~50% divergence from corporate |
| Principle drift | "Interpretation slip" | Slow change in how the model reads a fixed principle text |

## 进一步阅读

- [Anthropic — Claude's Constitution (January 2026)](https://www.anthropic.com/news/claudes-constitution)79页的CC0文件.
- [Bai et al. — Constitutional AI: Harmlessness from AI Feedback](https://www.anthropic.com/research/constitutional-ai-harmlessness-from-ai-feedback) 2022年原创.
- [Anthropic — Collective Constitutional AI (2023)](https://www.anthropic.com/research/collective-constitutional-ai-aligning-a-language-model-with-public-input)参与实验.
- [Anthropic — Responsible Scaling Policy v3.0](https://anthropic.com/responsible-scaling-policy/rsp-v3-0)宪法在RSP堆中.
- [Anthropic — Measuring agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy)宪法在长远部署中的作用.
