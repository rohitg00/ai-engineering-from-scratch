# 让人同意和拜占庭人对代理人的宽容

> 传统分布式系统BFT与 Stochastic LLM相遇.在2025-2026年,出现了三个研究方向: **CP-WBFT**根据信任调查,每一个投票都被权衡.**DecentLLMs**随着同步的工人提案和几何中位数聚合, **WBFT**通过"重量投票"和"层次结构集群"来分开核心和边缘节点. 根据"人工智能代理商是否可以同意?" (arXiv:2603.01213) 的实验结果,即使是规模协议也很脆弱. 利率是必要的,但不足的. 这一课构建了最小的BFT协议,注入了三个特征特定攻击 (拜占庭谎言,同情性合规性,相关错误单文化),并测量了每个共识变体如何应对.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 16 · 07 (Society of Mind and Debate), Phase 16 · 13 (Shared Memory)
**Time:** ~75 minutes

## 问题

许多人认为,这两种方法是错误的,因为两种方法是相对的 (相同的基础模型,相同的训练数据,相同的失败模式).第三个方法是错误的,所以大多数是错误的多数.

现在再加一个欺骗剂:它是故意的.或者一个伪幻剂:它同意谁说最后.在经典的BFT,假设是拜占庭节点是个小部分.`f < n/3`实际上,在2026年,LLM节点是固的,即使是诚实的,相对于模型,并且受到彼此的输出的影响.

经典BFT (PBFT, 1999) 没有错误.它不完整.它处理任意的点翻.它不处理"三位诚实代理人分享幻觉,因为他们分享训练数据".这个课程是基于PBFT的基础和3个2025-2026年适应层.

## 概念

### 经典的BFT给你什么?

实际的拜占庭错误宽容 (卡斯特罗和里斯科夫,OSDI 1999) 宽容`f < n/3`协议有三个阶段 (预备,准备,承诺) 和两个原始阶段 (签署的消息,定制证书).`n >= 3f + 1`诚实或恶意的节点.

保障是强大的,但假设:

1. **Independent faults.**拜占庭人没有协调.
2. **Honest nodes are truly honest.**诚实输出的正确性是无关的;
3. **The question has a ground-truth answer.**关于错误的事实的共识仍然是共识.

两位经理使用相同的基本模型都会犯错误. 一个"诚实"的经理仍然会幻觉. 在模糊的问题上",真相"是经理决定的.

### 针对三大法定学专业攻击

**Byzantine lie.**一个代理出了故意错误的答案.`f < n/3`现在,我们要去.

**Sycophantic conformity.**一个代理人在投票前读取别人的答案,并与最后一位发言者一致. 不是恶意,但与最响亮的声音相关.经典的BFT不会阻止这一点,因为代理通过了每一个签名检查.

**Correlated-error monoculture.**现在,我们在这个问题上,我们需要一个问题,我们需要一个问题,我们需要一个问题,我们需要一个问题.

### 未来的2025-2026年

**CP-WBFT** 信心证明权重BFT.每个选民将信心探测器附加到答案 (自报告的概率或单独校准模型的预测).投票权重量以信心量度.报告的BFT在完整图表上增长了85.71% .减轻:同效性 (符合的代理人往往对他们的志愿者立场有较低的信心).

**DecentLLMs**工人代理商并行提出,评估员代理商评分提案,最终答案是评分的位置的几何中位数. 强当`f < n/2`减轻:拜占庭谎言和相关错误 (几何中位数是强到异常值,并向密集集团拉,而不是模型偏差的平均值).

**WBFT** 按响应质量加上从历史中学到的信任分数来分配投票权.集群代理将核心和边缘分为核心;核心代理必须先达成共识,边缘代理必须遵循.减轻:可扩展性 (核心共识小而快) 和部分单种 (核心可选择多样性).

### 经验性:人工智能代理人是否可以同意?

纸质测量跨多边界模型的规模协议 (LLM代理商一致同意单个数值).

- 即使没有对手,LLM代理人在许多基准上不同意比例的问题,
- 一个采用欺骗性角色的代理人可以将混合代理的共识从诚实基线中提升40多个百分点.
- 异质组比同质组不同意 (好:不相关错误),但也偏向较慢 (坏:更长的协议时间).

结合验证 (16期·08角色专业化),多样性 (16期·15辩论变体) 和评估代理 (16期·24基准).

### 核心协议被剥夺

对于法定士代理人来说,最低BFT轮:

```
1. task arrives; each agent i produces answer a_i
2. each agent attaches confidence probe c_i in [0, 1]
3. aggregator collects (a_i, c_i) from all n agents
4. aggregator groups by semantic cluster (equivalent answers)
5. aggregator computes weight for each cluster C:
     w(C) = sum_{i in C} c_i
6. winner = cluster with max weight, if max > threshold * sum(c_i)
   else: retry or escalate
7. minority clusters logged with provenance for post-hoc audit
```

语义集群步骤是LLM特定的转折.两个答案"研究报告4.2%"和"4.2%改善"是相同的集群.一个天真的字符串等式检查会错过这一点.在生产中,使用廉价的嵌入模型或明确的加нони化.

### 值调整

其他`threshold`太低:你接受弱多数.太高:你永远不会接受任何东西. 经验范围:0.5-0.67为`n=5-7`其他类型的代理人,较高的代理人`n`在门以下,升级到人类或其他代理团队.

### 达成一致的意见没有帮助

- **Ambiguous questions.**如果这个问题没有基本的真理, 达成一致就是一个观点.
- **Compound questions.**两个答案,分别投票.
- **Adversarial multi-round.**如果代理人能够观察之前的轮子并模仿 (Du 2023 辩论),他们开始不管真相如何,相互同意.

```figure
swarm-consensus-wave
```

## 建立它

`code/main.py`执行:

- `AgentVoter`一个编写的政策 (答案,信心).
- `MajorityVote`经典多元化.
- `CPWBFT`以信任权衡的投票,并进行语义分组.
- `DecentLLMs`评分的提案的几何中位数聚合.
- `Scenario`每一个集成器都以三个攻击模式运行.

实施的攻击模式:

1. `byzantine`据了解,一名特工在撒谎时,
2. `sycophancy`一个代理人复制了看到的第一回复,
3. `monoculture`经理们对此有所不同,但他们对此有所不同.

运行:

```
python3 code/main.py
npx tsx code/main.ts
```

预期产量:一个表 (攻击,聚合器) ->最终答案,正确答案突出.多元化失败了单种类案例.CPWBFT的信心权重减轻了缩.单种类人口不到一半时,DecentLLMs的几何中位拉向诚实集群.

## 用它

`outputs/skill-consensus-designer.md`设计多代理集团共识协议:集群方法,权重,门和次门轮升政策.

## 运送它

在运输之前,任何共识机制:

- **Attack-test with at least the three patterns**你的协议应该是预测的失败,而不是默默的失败.
- **Log every minority cluster**少数群体是您的早期警告系统,
- **Enforce bounded rounds.**没有"一直争论直到达成协议",
- **Separate agreement from correctness.**认可输出向验证器;验证器独立于组合.
- **Monitor the agreement rate.**剧烈上升意味着符合性偏见;剧烈下降意味着模型漂移.

## 运动

1. 跑步`code/main.py`确认多数率会失败单种植攻击,但当单种植信心低于0.7时,CPWBFT会部分缓解这一攻击.
2. 添加第四次攻击模式:**silent abstention**一个代理拒绝回答 ("我不知道").每个集体应如何处理弃权?
3. 转换语义集群从字符串定律化到嵌入式 (使用任何开源嵌入式模型).
4. 阅读CP-WBFT (arXiv:2511.10400). 实施信任探测校准步骤 (单独的校准模型检查每个代理的自报告信任). 测量单种植场景的准确度增长.
5. 阅读"人工智能代理商是否同意?" (arXiv:2603.01213). 复制一个简单的规模协议实验:三个代理商,一个规模问题,欺骗人提示.CPWBFT或DecentLLMs是否抓住它?

## 关键词

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| BFT | "Byzantine fault tolerance" | Castro-Liskov 1999 protocol for consensus with `f < n/3` arbitrary faults. |
| Byzantine | "Any bad behavior" | A node that can lie, drop messages, fail silently — anything but crash safely. |
| Confidence probe | "How sure are you?" | Self-reported or calibrator-predicted probability attached to a vote. |
| Semantic clustering | "Same answer, different words" | Grouping equivalent answers before counting votes. |
| Geometric median | "Robust center" | The point minimizing sum of distances to sample points. Robust to outliers, unlike the mean. |
| Monoculture | "Same model, same failures" | Correlated errors when agents share training data or base model. |
| Sycophantic conformity | "Agreeing with the loud voice" | An agent's vote biases toward whoever spoke first/loudest. |
| Core/Edge | "Hierarchical BFT" | WBFT split: small Core consensus first, Edge nodes follow. Bounds latency. |

## 进一步阅读

- [Castro & Liskov — Practical Byzantine Fault Tolerance (OSDI 1999)](https://www.usenix.org/conference/osdi-99/practical-byzantine-fault-tolerance)基础
- [CP-WBFT — Confidence-Probe Weighted BFT](https://arxiv.org/abs/2511.10400)投票权重依靠信心
- [DecentLLMs — leaderless multi-agent consensus](https://arxiv.org/abs/2507.14928)几何中位数聚合
- [WBFT — Weighted BFT with Hierarchical Structure Clustering](https://arxiv.org/abs/2505.05103) 限度延迟的核心/边缘分区
- [Can AI Agents Agree?](https://arxiv.org/abs/2603.01213)规模协议脆弱性和欺骗性攻击
