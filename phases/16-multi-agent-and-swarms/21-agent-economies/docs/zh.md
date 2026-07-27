# Agent 经济系统、代币激励与声誉

> 长期自主 Agent（METR 的 1 小时至 8 小时工作曲线）需要经济主体地位。新兴的 **5 层堆栈**为：**DePIN**（物理计算）→ **身份**（W3C DID + 声誉资本）→ **认知**（RAG + MCP）→ **结算**（账户抽象）→ **治理**（Agentic DAO）。生产级 Agent 激励网络包括 **Bittensor**（TAO 子网奖励特定任务模型）、**Fetch.ai / ASI Alliance**（ASI-1 Mini LLM + FET 代币）以及 **Gonka**（基于 Transformer 的 PoW，将计算重新分配给生产性 AI 任务）。学术工作方面：AAMAS 2025 的去中心化 LaMAS 使用 **Shapley 值信用归因**来公平奖励贡献 Agent；Google Research 的「面向大语言模型的机制设计」提出了在单调聚合下的**代币拍卖**（第二价格支付）。本课将构建一个最小化的 Agent 市场，将 Shapley 值信用归因应用于多 Agent 流水线，并运行一个第二价格代币拍卖，使博弈论机制具体落地。

**类型：** 学习
**语言：** Python（标准库）
**前置知识：** 阶段 16 · 16（协商与讨价还价），阶段 16 · 09（并行群组网络）
**时间：** ~75 分钟

## 问题

多 Agent 系统在 Agent 共同产出价值但需要单独奖励时变得复杂。经典机制——平均分配、最后贡献者全拿——要么不公平，要么可被博弈。基于联盟的 Shapley 值奖励在构造上是公平的，但计算代价高昂。2025-2026 年的文献推动了实用的近似方法：Shapley 采样、单调聚合拍卖以及基于已确认贡献积累的链上声誉。

除了信用归因，该领域已转向实际的经济 Agent：Bittensor TAO 奖励挖掘计算以微调子网特定模型，Fetch.ai/ASI 以 FET 代币奖励 ASI-1 Mini LLM 的使用，Gonka 将 Transformer 工作量证明重新分配至生产性 AI 任务。自主交易的 Agent 今天已经存在；问题在于如何对齐激励。

本课将 Agent 经济系统视为一个特定的问题家族——信用归因、机制设计与声誉——并用最简的数学构建每一个，让概念深入人心。

## 概念

### 5 层 Agent 经济堆栈

1. **DePIN（物理计算）。** 出租 GPU、存储、带宽的去中心化基础设施。Bittensor 子网、Render Network、Akash。并非 Agent 特有；Agent 使用它。
2. **身份。** W3C 去中心化标识符（DID）为每个 Agent 提供独立于任何平台的持久 ID。声誉积累到 DID 上。Agent 网络协议（ANP）将 DID 用作发现层。
3. **认知。** Agent 的推理循环：LLM + RAG + MCP。这是其他阶段构建的内容。
4. **结算。** 账户抽象（ERC-4337）让 Agent 无需持有 ETH 即可从自己的余额支付 Gas。Agent 可以支付服务、彼此或计算。
5. **治理。** Agentic DAO：人类和 Agent 共同对协议变更进行投票的治理结构，投票权与声誉挂钩。

并非每个生产系统都使用全部五层。Bittensor 使用 1、2、部分 3、部分 4，不使用 5。OpenAI 的 Agent 除 3 外均不使用。该堆栈是一个参考地图，而非强制要求。

### Bittensor、Fetch.ai、Gonka——实际运行的系统

**Bittensor（TAO）。** 子网负责专门任务（语言建模、图像生成、预测）。矿工提交模型输出。验证者对其进行排序；基于质押权重的评分分配 TAO 奖励。每个子网有自己的评估。经济启示：按任务特定输出质量付费，而非按使用的计算量。

**Fetch.ai / ASI Alliance。** ASI-1 Mini LLM 运行在 Fetch.ai 网络上；用户支付 FET 代币进行推理。Agent 作为对等体的叙事在这里更强：Fetch 上的一个 Agent 可以调用另一个 Agent 执行任务并以 FET 支付。

**Gonka。** Transformer 工作量证明：「工作」是 Transformer 的前向传播。矿工通过运行具有已知正确输出（来自训练数据）的推理任务获得收益。资源生产性的 PoW 取代了基于哈希的 PoW。

截至 2026 年 4 月，三者均为生产级。收益分配方式不同。Bittensor 奖励相对于子网验证者的质量；Fetch 奖励由付费用户衡量的效用；Gonka 奖励可验证的推理工作。

### Shapley 值信用归因

三个 Agent 协作完成一个任务。输出得分为 0.8。谁贡献了什么？

Shapley 值：满足四个公理（效率、对称性、线性、零元）的唯一信用分配方案。对于 Agent `i`：

```
shapley(i) = (1/N!) * 对所有排序 O 求和 (v(S_i_O ∪ {i}) - v(S_i_O))
```

其中 `S_i_O` 是在排序 `O` 中排在 `i` 之前的 Agent 集合。实践中：枚举所有排列，记录每个 Agent 在每个排列中的边际贡献，取平均。

对于 N=3 个 Agent，有 6 种排列。对于 N=10，有 360 万种——因此实践中你采样排序而非枚举。

### 用于聚合的第二价格拍卖

Google Research（「面向大语言模型的机制设计」）提出了用于聚合 LLM 输出的第二价格代币拍卖。设定：N 个 Agent 各自提供一个完成方案；每个 Agent 对被选中有一个私有估值。拍卖方选择估值最高的方案，并支付**第二高**的估值。在单调聚合下（价值取决于哪个方案被选中，而非多少方案参与竞标），这是诚实的——Agent 按真实估值出价。

这对 LLM 系统的重要意义：你可以将完成任务外包给多个定价不同的 Agent；拍卖选择最佳方案 + 公平支付，且 Agent 没有动机谎报。

### 声誉资本

一个绑定到 DID 的声誉评分从已确认的贡献中积累。一个简单的更新规则：

```
rep(i, t+1) = alpha * rep(i, t) + (1 - alpha) * contribution_quality(i, t)
```

衰减因子 `alpha` 接近 1。声誉：

- 读取成本低，可用于路由决策（「将困难任务分配给高声誉 Agent」）。
- 伪造成本高（随时间积累，绑定到 DID）。
- 可以被削减：未通过验证的贡献将被扣分。

### AAMAS 2025 去中心化 LaMAS

LaMAS 提案（AAMAS 2025）结合了：DID 身份、Shapley 值信用归因以及一个简单的拍卖机制。关键主张：将信用归因步骤去中心化使系统可审计且能抵抗单点操纵。

### 经济学的失效点

- **价格预言机操纵。** 如果信用函数可以被博弈，Agent 就会去博弈。每种机制都需要经过对抗性测试。
- **女巫攻击。** 一个操作者启动 N 个假 Agent 来夸大自己的贡献。DID 能减缓但无法阻止这一点；声誉的伪造成本是缓解手段。
- **验证成本。** 信用归因的公平性取决于验证者。如果验证成本低廉（小型 LLM），则可能被博弈；如果成本高昂（人工审核），系统无法扩展。
- **监管阴影。** Agent 经济系统与金融监管相交织。截至 2026 年，Bittensor、Fetch 和 Gonka 在某些司法管辖区均处于法律灰色地带。

### Agent 经济系统的适用场景

- **具有异构操作者的开放网络。** 没有一个团队控制所有 Agent。
- **可验证的输出。** 没有验证，信用归因只是猜测。
- **长期工作流。** 一次性任务无法从声誉积累中受益。
- **代币化支付在法律上可行**的司法管辖区。

在封闭的企业系统中，经济机制让位于更简单的分配方式（管理者分配工作，指标为内部使用）。经济学文献主要适用于开放网络。

## 构建

`code/main.py` 实现了：

- `shapley(value_fn, agents)` — 针对小 N 的枚举精确 Shapley 计算。
- `second_price_auction(bids)` — 诚实机制；胜出者支付第二高价格。
- `Reputation` — 绑定 DID 的声誉，带指数衰减和削减功能。
- 演示 1：三个 Agent 协作，精确 Shapley 归因信用。
- 演示 2：五个 Agent 竞标一个任务槽位；第二价格拍卖选择胜出者及支付额。
- 演示 3：100 轮任务分配给具有异构声誉的 Agent；基于声誉加权的路由优于随机路由。

运行：

```
python3 code/main.py
```

预期输出：每个 Agent 的 Shapley 值；显示诚实出价均衡的拍卖结果；显示经过预热后声誉加权路由相较随机路由有 10-20% 的质量提升。

## 使用

`outputs/skill-economy-designer.md` 设计一个最小化的 Agent 经济系统：身份层选择、信用归因机制、支付机制、声誉规则。

## 交付

2026 年运行 Agent 经济系统的建议：

- **从声誉开始，而非代币。** 声誉实现成本低且本身就有价值；代币增加了法律和经济复杂性。
- **先验证，后奖励。** 绝不要在未经独立验证步骤的情况下分配信用。自我报告的质量会招致女巫攻击。
- **Shapley 采样，而非精确 Shapley。** 采样 100-1000 个排序；精确枚举无法扩展。
- **限制衰减因子和声誉下限。** 无界的衰减会抹杀合法贡献者；衰减过慢则奖励过时的高声誉 Agent。
- **对机制进行对抗性审计。** 在开放网络之前运行红队场景。每种机制都有其博弈论；你要发现漏洞，而非等攻击者来发现。

## 练习

1. 运行 `code/main.py`。确认 Shapley 值之和等于总价值（效率公理）。改变价值函数；Shapley 分配是否按预期方向变化？
2. 实现 Shapley **采样**（对 K 个排序的蒙特卡洛）。K 如何影响近似精度？对 N=4 对比精确结果。
3. 在拍卖前实现一个联盟形成步骤：Agent 可以合并为团队并作为一个单元投标。哪些联盟会形成？结果是否帕累托优于单独投标？
4. 阅读 Google Research 的机制设计博客。找出一个假设，如果被违反，会破坏诚实性。在 LLM 环境下，这种失败模式是什么样的？
5. 阅读 AAMAS 2025 的去中心化 LaMAS 论文。在一个人工合成任务上对 10 个 Agent 实现他们的 Shapley 步骤。精确计算需要多长时间？100 次采样的近似结果有多接近？

## 关键术语

| 术语 | 人们说的 | 实际含义 |
|------|----------|----------|
| DePIN | 「去中心化物理基础设施」 | 代币激励的计算/存储/带宽。Bittensor、Akash、Render。 |
| DID | 「去中心化标识符」 | W3C 可移植 ID 规范。Agent 声誉绑定到 DID，而非平台。 |
| ERC-4337 | 「账户抽象」 | 可赞助 Gas 的合约账户，实现 Agent 支付。 |
| Shapley 值 | 「公平信用归因」 | 满足效率、对称性、线性、零元的唯一分配方案。 |
| 第二价格拍卖 | 「Vickrey 拍卖」 | 诚实机制：胜出者支付第二高出价。兼容单调聚合。 |
| 声誉资本 | 「累积质量评分」 | 绑定 DID 的评分，来自已确认的贡献；随时间衰减。 |
| Agentic DAO | 「Agent + 人类共同治理」 | Agent 投票者作为一等公民的 DAO，投票权与声誉挂钩。 |
| TAO / FET / GPU 积分 | 「代币面额」 | Bittensor TAO、Fetch.ai FET、各类 DePIN 代币。 |

## 延伸阅读

- [The Agent Economy](https://arxiv.org/abs/2602.14219) — 2026 年 5 层 Agent 经济堆栈综述
- [Google Research — Mechanism design for large language models](https://research.google/blog/mechanism-design-for-large-language-models/) — 单调聚合下的代币拍卖
- [AAMAS 2025 — decentralized LaMAS](https://www.ifaamas.org/Proceedings/aamas2025/pdfs/p2896.pdf) — Shapley 值信用归因
- [Bittensor TAO documentation](https://docs.bittensor.com/) — 子网结构与奖励分配
- [Fetch.ai / ASI Alliance](https://fetch.ai/) — ASI-1 Mini LLM 和 FET 代币
- [W3C Decentralized Identifiers (DIDs) spec](https://www.w3.org/TR/did-core/) — 身份基础
