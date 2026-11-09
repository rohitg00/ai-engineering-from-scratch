# 思想理论和新兴协调

> 李等人 (arXiv:2310.10701) 表明,在合作的文本游戏展览中,LLM代理人**emergent high-order Theory of Mind**由于环境管理和幻觉,但由于无法实现长远规划, 由于对第三个代理人的信念而认为其他代理人是否有所理解, 由于环境管理和幻觉而无法进行长远规划.**only**M即时条件产生与身份相关的差异化和目标导向的补充性;低容量的 LLM 仅显示出虚假的出现. 协调的出现是即时的,有条件的,依赖于模型,而不是免费的. 这一课程实现了最小的TOM知情代理,与ToM的提示以及没有TOM的合作任务,并测量了与Riedl 2025协议相比的协调.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 16 · 07 (Society of Mind and Debate), Phase 16 · 17 (Generative Agents)
**Time:** ~75 minutes

## 问题

许多代理协调通常看起来很神奇:代理人分工,预测彼此,避免裁员.通常,这种"出现"是快速工程的文物.有人告诉代理人"协调".删除提示,删除协调.

根据Rieedl的2025年发现,在受控条件下,只有当被促使代理商推理**other agents' minds**没有ToM提示,即使是强大的模型也显示出无法存活的统计控制的协调模式.这对于生产来说很重要:团队运输"多代理协调"功能,这些功能是依赖于提示和脆弱的.

这一课将TOM视为一个特定的能力 (关于信仰的信念进行推理),建立一个最小的TOM意识的代理,并测量真正的协调与快速穿衣的样子.

## 概念

### 什么是ToM

发展心理学:3岁的孩子认为每个人的内心世界与他们相匹配.5岁的孩子理解别人有不同的信仰.7岁的孩子认为球在杯子下.

对于LLM代理人,ToM命令地图:

- **Zeroth-order:**没有别人的模型. 代理人只根据自己的观察行动.
- **First-order:**经纪人对其他经纪人的信仰有模型.
- **Second-order:**经纪人模拟了复发性信念.

李及其他研究人员发现,在合作游戏中,第一级和第二级的TOM在LLM代理中出现,但随着长视野和不可靠的通信而降低.

### 简而言之,萨利-安妮测试

1985年的一次虚假信仰测试:萨利把一个石放在篮子A里,离开了.安妮把它移到篮子B里.萨利回来时会看哪里?一个第一级TOM的孩子说篮子A (萨利的信念与现实不同).一个没有的孩子说篮子B.

简单地提出时,GPT-4时代的LLM通过了萨利-安妮风格的测试.当叙述长,场景发生多次变化,或者问题被间接表达时,它们会失败.这是2026年生产LLM中的ToM实际状态.

### 里德尔的协调测量

瑞德 (arXiv:2510.05174) 构建了一个人口规模测试:N代理,合作目标,可变的快速条件.

1. **Identity-linked differentiation.**经纪人是否随着时间的推移发展出稳定的角色区别?
2. **Goal-directed complementarity.**代理人的行动是否相互补充 (不同次任务),而不是重复?
3. **Higher-order synergy.**统计测量,以确定组是否实现了任何子组都无法实现的目标.

结果:只有在ToM提示条件下,所有三项指标都产生信号超过基线.没有ToM提示,对中等容量模型来说,指标几乎没有机会.大型模型显示一些协调,但没有明确的ToM提示,但效果比明确的提示小.

### 协调错觉

没有统计控制,演示中的"紧急协调"通常反映了:

- 快速工程,以协调 (系统提示说"一起工作").
- 观察者偏见 (我们看到预期的模式).
- 经过比赛后的成功选项.

没有可测量信号的"紧急协调"的生产系统应被视为市场化.

### 对于TOM的认识,

结构:

```
agent state:
  own_beliefs:    {facts the agent believes}
  other_models:   {other_agent_id -> {beliefs_the_agent_attributes_to_them}}
  actions_last_N: [history of others' actions]

observation update:
  - update own_beliefs from direct observation
  - update other_models[agent_id] from their action + prior beliefs

action selection:
  - enumerate candidate actions
  - for each, predict what each other agent will do next given their modeled beliefs
  - pick action that maximizes joint outcome under those predictions
```

其他`other_models`属性是ToM状态.第一级ToM只保留一个级别.第二级添加`other_models[i][other_models_of_j]`我认为的,代理,我认为J代理相信.

### 为什么长视线会疼

李等文件:背景限制导致代理人忘记属于谁的信念.幻觉增加了其他代理模型的错误信念.这两者都会产生"我认为他认为X"错误,随着时间的推移,会增加.

报告中所记录的减轻措施以及2024-2026年进行的后续行动:

- **Explicit ToM state in the prompt.**结构格式: `{agent_id: belief_list}`为了保持身份与信仰的联系.
- **Shorter reasoning chains.**每次更新TOM的数量减少了复合幻觉.
- **External ToM store.**保持模型在LLM背景之外;每轮只注入相关部件.

### 在生产中ToM失败时

- **Adversarial settings.**具有良好的TOM的代理人更容易操纵 (你可以模拟他们对你的模型,然后利用).
- **Heterogeneous teams.**当模型不同时,对一个对手的ToM模型不会通用.
- **Ground-truth-dependent tasks.**对于"TOM"来说,是关于信仰;如果正确性取决于事实,

### 实际上可以测量的协调

团队的协调是真实的,而不是快速的:

1. **Complementarity over time.**在多轮任务中, 代理人的行动是否涵盖不同次任务?
2. **Anticipation.**根据B在T+2的预测,A的作用在T+1转向上是否取决于B的作用在T+2上是正确的?
3. **Correction.**当A误解B的信念时,A是否通过转T+2纠正?

它们可以在记录的多代理系统中测量.

```figure
sw-theory-of-mind
```

## 建立它

`code/main.py`执行:

- `ToMAgent`追踪自己的信仰和其他代理人的信仰模式.
- 合作任务:三位代理必须从三个盒子中收集三个代币;每个盒子可以包含一个代币. 代理人不能沟通;他们从彼此的行为中推断意图.
- 两个配置:`zeroth_order`没有TOM`first_order`(ToM与一个层次的信仰模型).
- 测量超过200个随机试验:完成率,重复率 (两个针对同一盒子的代理),平均转向到完成.

运行:

```
python3 code/main.py
npx tsx code/main.ts
```

预期输出:零级代理在~35%的速度重复工作,并在10轮完成60%的试验.第一级ToM代理在~5%重复工作,完成95%.

## 用它

`outputs/skill-tom-auditor.md`检查是否有快速的调整,对控制的统计意义,以及测量对互补性.

## 运送它

协调要求检查列表:

- **Control condition.**没有协调提示的系统版本.
- **Statistical test.**系统与控制之间的区别是否显著?`p < 0.05`在你的指标上?
- **Complementarity measure.**随着时间的推移,行动的分歧,
- **Failure-case log.**当特工协调错误时,TOM状态是什么样子的?
- **Model-capacity disclosure.**如果在较小的模型上效果消失,

## 运动

1. 跑步`code/main.py`确认一级ToM将重复率降低7倍.当你扩展到5个代理和5个盒子时,差距是否会持续下去?
2. 实施第二级ToM (Agent A 模拟B 对C的想法).它是否改善了第一级?在哪些任务上?
3. 注射一个**hallucination**随机翻转每轮一个信念. 这会降低一级性能多么?
4. 读一读Li et al. (arXiv:2310.10701). 复制"长视线降解"发现:随着轮流从10转到30转,您的第一级ToM性能如何变化?
5. 阅读Riedl 2025 (arXiv:2510.05174). 运用更高级的协同效应统计数据在模拟日志上.

## 关键词

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Theory of Mind | "Understanding others' minds" | The capacity to model another agent's beliefs. Graded by order (0, 1, 2+). |
| Sally-Anne test | "The false-belief test" | 1985 developmental psychology; LLMs pass plain versions, fail complex ones. |
| First-order ToM | "A believes X" | Modeling one other's beliefs about facts. |
| Second-order ToM | "A believes B believes X" | Recursive modeling one level deeper. |
| Identity-linked differentiation | "Stable roles over time" | Riedl's metric: roles persist, not random. |
| Goal-directed complementarity | "Disjoint actions" | Agents target different subtasks, not the same one. |
| Higher-order synergy | "Group exceeds any subset" | Riedl's statistical measure for real coordination. |
| Coordination illusion | "It looks coordinated" | Prompt-dressed appearance of coordination without measurable signal. |

## 进一步阅读

- [Li et al. — Theory of Mind for Multi-Agent Collaboration via Large Language Models](https://arxiv.org/abs/2310.10701)合作游戏中新兴TM;长视野失败模式
- [Riedl — Emergent Coordination in Multi-Agent Language Models](https://arxiv.org/abs/2510.05174)人口规模测量;TOM提示是承载条件
- [Premack & Woodruff — Does the chimpanzee have a theory of mind?](https://doi.org/10.1017/S0140525X00076512)TOM概念的起源于1978年
- [Baron-Cohen, Leslie, Frith — Does the autistic child have a theory of mind?](https://doi.org/10.1016/0010-0277(85)90022-8) 萨利-安妮论文 (1985)
