# 限制自我改善的设计

> 研究已经聚合在四种原始的自我改善循环的界限. 必须在每一个编辑中保持的正式变量. 无法修改的配列. 必须满足所有维度 (安全性,公平性,稳定性),而不仅仅是性能. 历史指标表明能力损失时,停止循环的回归检测. 没有一个是安全性证明的信息理论结果 (科尔摩戈罗夫复杂性,洛布定理) 绑定任何系统可以证明自己的继任者. 它们是缓解导致沉默失败的成本.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, bounded-loop with invariant check)
**Prerequisites:** Phase 15 · 07 (RSI), Phase 15 · 04 (DGM)
**Time:** ~60 minutes

## 问题

课7的比赛模拟器显示,小率差异会导致大差距.课4的DGM案例研究表明,循环可以积极发挥自己的评估者.这两个结果都表明了相同的工程问题:你可以在自我改进循环上设置什么限制,这样限制不能被循环本身默默削弱?

ICLR 2026 RSI 研讨会总结 (openreview.net/pdf?id=OsPQ6zTQXV) 确定了四种原始性.人类的RSP v3.0 (课 19) 和深思维的FSF v3 (课 20) 都在能力门中引用它们.Meta HyperAgents的工作和社区框架如SAHOO (3月2026) 实现子集在生产中.

诚实的框架:这些是减轻.信息理论结果将任何系统对其继任者所能证明的东西绑定在一起,而没有当前的设计正式关闭了问题.一个有界限的循环比一个无界的循环更安全,在绝对的术语中不是安全的.

## 概念

### 基本的1:正式的不变

一个不变的属性是必须在每一次自我修改之前和之后保持的属性.

- 产量分布是根据固定的结构头条 (课17).
- 没有工具调用到未经授权的终端点.
- 记忆写道通过记录,签名的路径.
- 评估器的模块哈希与批准版本相匹配.

如果一个拟议的修改违反了一个不变的,它会被拒绝. 这会捕获DGM式评估者改模式 (课 4).

难的是选择安全性所需的不变元件,并且可在合理的时间内计算.过度规格的摊位进展;过度规格的低点让循环通过重要属性.

### 基本的2:配列

配列是循环核心目标的不可变的表示,固定在循环编辑表面之外.

- 宪法文本 (课17),每次发出呼唤时,从只能阅读的位置上加载.
- 评估人员在独立存储库中,具有独立的访问控制.
- 工具许可证说明书,由人签署,并重新验证每一个周期.

杆的作用是防止客观漂移. 循环可能会改善它追求目标的方式,但不能编辑目标是什么.

微妙的失败模式:一个锁环不能编辑仍然可以通过一个锁重新解释,它在读取锁的方式中漂移.宪法人工智能 (课 17) 显然基于理性来处理新情况;这种推理层是解释漂移生活的地方.锁是必要的,不够的.

### 基本的3:多目标的限制

优化单个规模分数的循环会找到快捷径.必须同时满足多个硬约束的循环有更少的快捷径.典型轴:

- 绩效 (任务级基准指标)
- 安全性 (红队评估,已知坏人拒绝率)
- 公平性 (敏感子组的不同影响限度)
- 强度 (OOD测试组,对抗输入处理)

修改只能接受每一个限制都能维持. 第十三课的成本管理员将这堆积成财务限制. 第十八课的拉马卫队作为安全轴插入.

### 基本 4:回归检测

每个周期的分数与历史分布进行比较. 超过配置宽容的下降暂停了循环. 这会捕获沉默的能力损失,如果循环"改善了"它,则会被吸收到运行平均值中.

实际实施:存储最后N周期的每任务分数.每一个新周期计算每任务的三角形.如果任何三角形落落在门以下,这个周期会被拒绝,人类会进行审查.

### 信息理论限制

科尔摩戈尔夫复杂性和洛布定理设定了系统可以证明自己对什么的上限.施密德伯的正式的戈德尔机器 (课 4) 旨在达到最高的这样的限度;没有人完成了非微不足道的证明.洛布的结果说:如果一个系统可以证明认为"如果我证明我应该做X,我会做X",它会做X而不证明它应该,一个已知自参考失败.

对于我们的原始人来说,它们无法关闭安全问题.它们使沉默失败变得更昂贵.一个恶意或漂移的循环,可以地绕过一个缺失的检查,现在必须积极破坏一个明确的检查,这是一个更可检测的签名.

### 实践中的例子

假设一个代理提出了编辑.

1. 变化不变的检查:模块哈希,工具许可证表,宪法标题.
2.  anchor check:目标语句与批准版本 (字节或语义) 匹配.
3. 多目标评估:性能,安全性,公平性,强度等方面.
4. 逆转检测:没有轴向超过耐受性下降.

任何一次失败都会停止循环.

```figure
bounded-gates
```

## 用它

`code/main.py`在DGM类型的玩具上从第4课程运行一个有限的自我改进循环,但上面有四个原始的层.每个原始可以单独启用或禁用.示范是每个原始的捕获一个特定的失败类,并且删除其中任何一个让该失败类通过.

## 运送它

`outputs/skill-bounded-loop-review.md`审计一个拟议的边界循环,并评分它实际实施的四种原始因素中的哪个与其要求的比较.

## 运动

1. 跑步`code/main.py`确认循环仍然在基本指标上改进,而不会让黑客获胜.

2. 关闭回归检测. 构建输入,这导致默默能力损失被接受.

3. 禁用多目标限制. 显示循环在安全轴下降时与性能轴相近.

4. 设计一个编码代理的配列.

5. 阅读ICLR2026 RSI研讨会总结,选择四个原始方法之一,并提出具体的改进现行技术状态.

## 关键词

| Term | What people say | What it actually means |
|---|---|---|
| Invariant | "Always-true property" | A property checked by external code before and after every edit |
| Alignment anchor | "Pinned objective" | Immutable core-goal representation outside the loop's edit surface |
| Multi-objective constraint | "All axes must hold" | Performance, safety, fairness, robustness — all required |
| Regression detection | "Pause on drop" | Pause the loop when historical metric deltas suggest capability loss |
| Kolmogorov bound | "Information-theoretic limit" | Limits what a system can prove about its own successor |
| Lob's theorem | "Self-reference trap" | System can act on "I should" without proving it should |
| Gate stack | "Layered check" | Multiple primitives combined; any failure rejects the edit |
| Bounded improvement | "Mitigation, not proof" | Raises silent-failure cost; does not close the safety problem |

## 进一步阅读

- [ICLR 2026 RSI Workshop summary (OpenReview)](https://openreview.net/pdf?id=OsPQ6zTQXV)四个原始的融合.
- [Anthropic Responsible Scaling Policy v3.0](https://anthropic.com/responsible-scaling-policy/rsp-v3-0)多目标能力门.
- [DeepMind Frontier Safety Framework v3](https://deepmind.google/blog/strengthening-our-frontier-safety-framework/) 欺骗性对准监测作为一个不变的原始.
- [Schmidhuber (2003). Godel Machines](https://people.idsia.ch/~juergen/goedelmachine.html)是这些原始人的正式证据祖先.
- [Anthropic — Claude's Constitution (January 2026)](https://www.anthropic.com/news/claudes-constitution)基于理性的配列.
