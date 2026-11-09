# 对于法定法律学历的群体优化 (PSO,ACO)

> 生物灵感优化正在使LLM复苏.**LMPSO**(arXiv:2504.09247) 使用PSO,每个粒子的速度是提示,LLM生成下一个候选人;在结构序列输出 (数学表达式,程序) 上工作良好. **Model Swarms**(arXiv:2410.11163) 对待每一位LLM专家作为模型重量多元件的PSO粒子,并报告**13.3% average gain**只有200个实例的9个数据集上超过12个基线. **SwarmPrompt**为了快速优化,将PSO+灰狼混合.**AMRO-S**                                  **4.7x speedup**通过"PROPT PARAMETER SPACE"和"ACO"在代理路由中,测量这些经典算法为什么适合LLM时代,以及何时不适合.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 16 · 09 (Parallel Swarm Networks), Phase 16 · 14 (Consensus and BFT)
**Time:** ~75 minutes

## 问题

您有一个提示,在任务评估中得分62%.您想改进它. 简单的举动是无梯度的手动调整,这很糟糕.强化学习需要奖励信号和足够的推广来训练. 通过提示推进实际上是不可能的.提示是一个单独的字符串,而不是一个可分化参数.

经典生物启发优化  PSO 连续搜索空间,ACO 选路是专门为这个制度设计的:无梯度,基于人口,每项评估便宜.对其进行无梯度搜索步骤的LLM结合,你得到了一个令人惊的实用优化器.

类似的模式适用于多代理系统中的代理 *路由 * .ACO式的子记录了哪个代理在哪个任务类型上最好工作,让路由器利用该线路,并分解子,以便重新发现路线.

## 概念

### 公共卫生组织的更新 (肯尼迪和埃伯哈特 1995)

粒子群优化:在连续搜索空间中的粒子群.每个粒子都有位置.`x_i`速度`v_i`每次代:

```
v_i <- w * v_i + c1 * r1 * (p_best_i - x_i) + c2 * r2 * (g_best - x_i)
x_i <- x_i + v_i
evaluate fitness(x_i)
update p_best_i if improved
update g_best if global best
```

在哪里?`p_best`粒子本身的最佳.`g_best`是群众最好的,`w, c1, c2`它们是惯性+认知+社会权重,`r1, r2`它们是随机因素.

### 关于法定管理局的产品的PSO  LMPSO

根据""的定义,每颗粒子都是一个候选输出.速度是描述如何修改当前输出,以实现个人/全球最佳.LLM从速度提示生成新的输出.速度的"惰性"是"做小增进变化"这样的提示.

如果:
- 输出结构化 (可解析,可评估).
- 健身是自动的 (测试运行,算术评估).
- 人口小 (~10-30颗粒),因此总计LLM调用仍然可管理.

身体健康需要人体检查时,它不起作用.

### 模型群

随着一个数据集的更新,每一个"粒子"都会通过一个无梯度更新将参数移动到集体最佳水平.报告:在9个数据集上平均增加13.3%的12个基线,每次代仅为200次.

基本的见解是,在一个共享参数多元组 (适配器重量,LORA 分) 中,LLC专家模型已经接近.

### 更新ACO (多里戈 1992)

殖民地优化:穿过图表;每个路径都有子痕迹.子按子强度移动概率重量.完成任务的子按溶液质量比例存储子.子随时间而衰退.

###  AMRO-S  ACO 代理路由

根据ACO的数据,每一个任务类型都是"目的地",每一个代理都是可能的路线.

- **Interpretable routing evidence.**子强度是人类可以读取的信号.
- **Quality-gated asynchronous update.**异体仅在质量检查通过后更新, 脱离结论与学习.
- **4.7x speedup**关于多代理路由基准.

质量关键:没有它,快速但错误的代理会积聚,

### 什么时候使用PSO/ACO在 LLM

**Use PSO when:**
- 搜索空间是连续的或是连续参数的地图 (即时嵌入,LoRA权重,数值生成参数).
- 健身是便宜的,自动的.
- 人口可能很小 (10-30).

**Use ACO when:**
- 你有路由或路径选择问题.
- 随着时间的推移,决策得到加强 (同样的任务类型会再次出现).
- 你需要解释的证据来决定路线.

**Do not use either when:**
- 健身需要人体审查 (每次代谢太昂贵).
- 搜索空间是单独的和结合式的,以一种方式,PSO不覆盖 (使用遗传算法而不是).
- 实时决策需要严格的延迟 (PSO/ACO相对于单通度度相对慢相近).

### 生物灵感的原因仍然是胜利

基于梯度的方法需要可分辨的信号.LLM输出和路由决策并不微乎其微的分辨性.伪梯度方法 (强化学习路由器,DPO式快速调节器) 有效,但需要昂贵的培训.

对于 PSO 和 ACO,只需要一个*评估器*函数.如果您可以评分一个候选输出或路由决定,您可以优化空间. 这使得适用性条格更低.

### 实际限制

- **Population budget.**对于LLM评价的~$0.02 / call, a 20-particle PSO running 50 iterations costs ~$20,根据计划.
- **Exploration vs exploitation.**子衰变率和PSO惰性交换;过快衰变 →忘记解决方案;过慢 →坚持早期的本地优势.
- **Catastrophic drift.**两种算法可以在健身环境变化 (新数据分布) 时融合,然后分离.

```figure
swarm-stigmergy
```

## 建立它

`code/main.py`执行:

- `LMPSO`PSO对数值提示参数 (温度,顶_k重量).每个粒子的"LLM生成"是模拟的脚本健身函数.运行算法30次并显示g_best融合.
- `AMRO_S` ACO 类型的路由. 3 个代理, 4 个任务类型, 子矩阵, 100 个路由任务. 打印 (task_type → 代理选择) 时间分布以显示轨迹形成.
- 比较:随机路由与同一任务流中的ACO路由. 测量质量和延迟.

运行:

```
python3 code/main.py
npx tsx code/main.ts
```

预期产量:
- 体育:g_best 身体健康从随机到近最佳的改善超过30次.
- AMRO-S:因任务类型而稳定于正确的代理;ACO路由在质量上随机超过30-40%,同时降低延迟 (减少重试).

## 用它

`outputs/skill-swarm-optimizer.md`帮助选择PSO,ACO,遗传算法和基于梯度的优化器来解决LLM/代理优化问题.

## 运送它

- **Start small.**只有在缩曲线显示明显的增长的情况下,
- **Log pheromones or g_best per iteration.**没有痕迹的调试群群优化器是痛苦的.
- **Quality-gate updates.**特别是在ACO路由方面:快速和错误的药物不能积累.
- **Reset decay on distribution shift.**当你的评估分布发生变化时,老化的子会变得陈旧;暂时重新设置或翻倍衰变率.
- **Cap the per-iteration cost.**发出每次发行成本的指标. 费用500美元/发行,并获得0.5%的收益,不能运输.

## 运动

1. 跑步`code/main.py`观察LMPSO的化. 不同人口规模 5, 10, 20, 50. 化时间在多少度?
2. 执行"灾难性漂移"实验:在30次回复后,改变健身功能.PSO如何快速适应?是否重置`p_best`帮助?
3. 添加质量门 AMRO-S:仅在评估分数>0.7 的运行时存储子.
4. 读LMPSO (arXiv:2504.09247). 绘制纸的"速度作为提示"回到你的数值速度.
5. 通过非同步的激素更新,实现脱的"推理快速路径". 这如何改变系统延迟在持续负载下?

## 关键词

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| PSO | "Particle Swarm Optimization" | Kennedy-Eberhart 1995. Population-based gradient-free optimizer. |
| ACO | "Ant Colony Optimization" | Dorigo 1992. Path/route optimization via pheromone trails. |
| LMPSO | "PSO with LLM generation" | arXiv:2504.09247. Velocity is a prompt; LLM produces candidates. |
| Model Swarms | "PSO on expert weights" | arXiv:2410.11163. Gradient-free update on model parameter subspace. |
| AMRO-S | "ACO for agent routing" | arXiv:2603.12933. Pheromone matrix over task-type × agent. |
| p_best / g_best | "Personal / global best" | Per-particle and swarm-wide best solutions found so far. |
| Pheromone | "Routing memory" | Strength on an edge; decays over time; deposits on quality. |
| Quality-gated update | "Only learn from good runs" | Pheromone deposit conditioned on quality check. |
| Catastrophic drift | "Distribution shift" | Fitness landscape changes; old p_best and pheromones become stale. |

## 进一步阅读

- [Kennedy & Eberhart — Particle Swarm Optimization](https://ieeexplore.ieee.org/document/488968)1995年公共卫生组织文件
- [Dorigo — Ant Colony Optimization](https://www.aco-metaheuristic.org/about.html) 1992年ACO基金会
- [LMPSO — Language Model Particle Swarm Optimization](https://arxiv.org/abs/2504.09247)结构化LLM产品的公共服务管理局
- [Model Swarms — gradient-free LLM expert optimization](https://arxiv.org/abs/2410.11163)模型重量子空间的PSO
- [AMRO-S — ant-colony multi-agent routing](https://arxiv.org/abs/2603.12933) 质量门的胺驱动路由
