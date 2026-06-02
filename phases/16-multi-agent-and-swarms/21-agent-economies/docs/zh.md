# Agent 经济、Token 激励与声誉

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 长链路自治 agent（METR 提出的「1 小时到 8 小时工作曲线」）需要经济意义上的能动性。当下浮现的 **5 层栈** 是：**DePIN**（物理算力）→ **Identity**（W3C DIDs + 声誉资本）→ **Cognition**（RAG + MCP）→ **Settlement**（账户抽象）→ **Governance**（Agentic DAO）。已上线的 agent 激励网络包括 **Bittensor**（TAO 子网奖励特定任务的模型）、**Fetch.ai / ASI Alliance**（ASI-1 Mini LLM + FET token）以及 **Gonka**（基于 transformer 的 PoW，把算力重新分配给有产出的 AI 任务）。学术界这边：AAMAS 2025 的去中心化 LaMAS 用 **Shapley 值进行贡献归因（credit attribution）**，公平地奖励参与的 agent；Google Research 的 "Mechanism design for large language models" 提出在单调聚合下采用第二价格支付的 **token 拍卖**。本课会搭一个最小的 agent 市场，把 Shapley 值贡献归因用到一个多 agent 流水线里，再跑一场第二价格 token 拍卖，让博弈论这套机器具体落地。

**Type:** Learn
**Languages:** Python (stdlib)
**Prerequisites:** Phase 16 · 16 (Negotiation and Bargaining), Phase 16 · 09 (Parallel Swarm Networks)
**Time:** ~75 minutes

## 问题（Problem）

多 agent 系统一旦让 agent 共同产出价值、又要单独奖励，事情就复杂起来。经典分配机制——平均分、最后贡献者通吃——要么不公平，要么容易被钻空子。基于联盟（coalition）的 Shapley 值奖励在公理上是公平的，但计算成本高。2025–2026 的文献给出了若干实用的近似：Shapley 采样、单调聚合拍卖，以及由确认贡献累积形成的链上声誉。

除了贡献归因，这一领域已经把目光投向真正在做经济活动的 agent：Bittensor TAO 用算力挖矿微调（fine-tune）子网专属模型并按贡献奖励，Fetch.ai/ASI 用 FET token 奖励 ASI-1 Mini LLM 的使用，Gonka 把 transformer 的工作量证明（proof-of-work）重新分配到有产出的 AI 任务上。能自主交易的 agent 今天就已经存在；问题在于如何对齐激励。

本课把 agent 经济视作一个明确的问题族——贡献归因、机制设计、声誉——并用最少的数学把每一块搭出来，让概念扎得住。

## 概念（Concept）

### Agent 经济的 5 层栈（The 5-layer agent-economy stack）

1. **DePIN（物理算力）。** 出租 GPU、存储、带宽的去中心化基础设施。Bittensor 子网、Render Network、Akash。它本身不是为 agent 设计的，但 agent 用得上。
2. **Identity（身份）。** W3C 去中心化标识符（DIDs）给每个 agent 一个独立于任何平台的、长期持有的 ID。声誉累计到该 DID 上。Agent Network Protocol（ANP）就用 DID 作为发现层。
3. **Cognition（认知）。** Agent 的推理循环：LLM + RAG + MCP。这是其他课在搭的部分。
4. **Settlement（结算）。** 账户抽象（ERC-4337）让 agent 可以用自己的余额支付 gas，无需持有 ETH。Agent 可以为服务、为彼此、为算力付费。
5. **Governance（治理）。** Agentic DAO：由人类*与* agent 共同投票决定协议变更的治理结构，投票权和声誉绑定。

不是每个生产系统都用全 5 层。Bittensor 用了 1、2，部分 3、部分 4，5 完全没有。OpenAI 的 agent 除了 3 之外什么都没用。这套栈是参考地图，不是必备清单。

### Bittensor、Fetch.ai、Gonka——实际在跑的东西

**Bittensor（TAO）。** 子网（subnet）对应特定任务（语言建模、图像生成、预测）。矿工提交模型输出，验证者排名，按 stake 加权打分来分发 TAO 奖励。每个子网有自己的评估方式。经济学上的启示是：为特定任务的输出质量付费，而不是为耗用的算力付费。

**Fetch.ai / ASI Alliance。** ASI-1 Mini LLM 跑在 Fetch.ai 网络上；用户用 FET token 支付推理费用。"agent 即对等节点" 这条叙事在这里更鲜明：Fetch 上的一个 agent 可以叫另一个 agent 干活并用 FET 支付。

**Gonka。** 基于 transformer 的工作量证明：所谓「工作」就是 transformer 的前向传播。矿工通过运行已知正确输出（来自训练数据）的推理任务来赚取奖励。是面向资源生产的 PoW，而不是基于哈希的 PoW。

截至 2026 年 4 月，三者都已经达到生产级。回报分配机制各不相同：Bittensor 按相对于子网验证者的质量来奖励；Fetch 按付费用户的实际使用价值来奖励；Gonka 奖励可验证的推理工作。

### Shapley 值的贡献归因（Shapley-value credit attribution）

三个 agent 协作完成一个任务，输出得分 0.8。各自贡献了多少？

Shapley 值：满足四条公理（efficiency、symmetry、linearity、null）的唯一一种贡献分配。对 agent `i`：

```
shapley(i) = (1/N!) * sum over all orderings O of (v(S_i_O ∪ {i}) - v(S_i_O))
```

其中 `S_i_O` 是排序 `O` 中位于 `i` 之前的 agent 集合。实操上：枚举所有排列，记录每个 agent 在每个排列里的边际贡献，再求平均。

N=3 时有 6 个排列。N=10 时是 360 万——所以实际中不去枚举，而是对排列做采样。

### 聚合用的第二价格拍卖（Second-price auction for aggregation）

Google Research（"Mechanism design for large language models"）提出用第二价格 token 拍卖来聚合 LLM 输出。设定是：N 个 agent 各自提出一个 completion；每人对「被选中」有自己的私人估值。拍卖方挑出估值最高的提案，但只支付*第二高*的估值。在单调聚合（价值取决于哪个提案被选中，而不是出价人数）的前提下，这个机制是激励相容的（truthful）——agent 会按真实估值出价。

这对 LLM 系统的意义在于：你可以把 completion 任务外包给定价不同的多个 agent；拍卖能挑出最好的那个并公平付费，agent 也没有动机谎报。

### 声誉资本（Reputation capital）

绑定到 DID 的声誉分数会从已确认的贡献中累积。一条简单的更新规则：

```
rep(i, t+1) = alpha * rep(i, t) + (1 - alpha) * contribution_quality(i, t)
```

衰减因子 `alpha` 接近 1。声誉的特点：

- 读取成本低，方便用于路由决策（"硬任务交给高声誉 agent"）。
- 伪造成本高（要在时间上累积，且绑定 DID）。
- 可以被罚没（slash）：未通过验证的贡献会扣分。

### AAMAS 2025 的去中心化 LaMAS

LaMAS 提案（AAMAS 2025）把三件事组合起来：DID 身份、Shapley 值贡献归因、一个简单的拍卖机制。核心论点：把贡献归因这一步去中心化，能让系统可审计，且不会被单点操纵。

### 经济学在哪些地方崩盘

- **价格预言机操纵（Price oracle manipulation）。** 贡献函数若可被博弈，agent 就会去博弈。每一种机制都需要做对抗性测试。
- **女巫攻击（Sybil attacks）。** 一个运营者拉起 N 个假 agent，把贡献都灌给自己。DIDs 能拖慢，但拦不住；真正的缓解措施是让伪造声誉的成本高昂。
- **验证成本。** 贡献归因的公平上限就是验证者的水平。验证便宜（小 LLM）就容易被博弈；验证昂贵（人类评审团）就跑不大规模。
- **监管悬顶。** Agent 经济与金融监管交叠。截至 2026 年，Bittensor、Fetch、Gonka 在某些司法辖区都处于法律灰色地带。

### Agent 经济在什么时候有意义

- **运营者异构的开放网络。** 没有单一团队控制所有 agent。
- **可验证的输出。** 缺乏验证，贡献归因就只是猜测。
- **长链路工作流。** 一次性任务从声誉累积里得不到好处。
- **代币化支付在你的辖区在法律上可行。**

封闭的企业系统里，经济机制让位于更简单的分配方式（经理派活、指标内部化）。经济学文献基本只适用于开放网络。

## 动手实现（Build It）

`code/main.py` 实现：

- `shapley(value_fn, agents)` — 对小 N 用枚举法精确计算 Shapley 值。
- `second_price_auction(bids)` — 激励相容机制；获胜者支付第二高的出价。
- `Reputation` — 绑定 DID 的声誉，含指数衰减与罚没。
- Demo 1：三个 agent 协作，用精确 Shapley 做归因。
- Demo 2：五个 agent 竞拍一个任务名额；第二价格拍卖给出获胜者与支付额。
- Demo 3：100 轮把任务派给声誉异构的 agent；声誉加权的路由在热身期之后胜过随机分配。

运行：

```
python3 code/main.py
```

预期输出：每个 agent 的 Shapley 值；展示真实出价均衡的拍卖结果；声誉加权路由相对随机分配在热身后给出 10–20% 的质量提升。

## 用起来（Use It）

`outputs/skill-economy-designer.md` 设计一个最小可行的 agent 经济：身份层、贡献归因机制、支付机制、声誉规则的选型。

## 上线部署（Ship It）

2026 年要把 agent 经济跑起来：

- **从声誉做起，token 后置。** 声誉实现成本低，单独拿出来就有价值；token 会引入法律和经济上的复杂度。
- **先验证，再奖励。** 永远不要在缺乏独立验证的情况下分配贡献。自报质量必然滋生女巫游戏。
- **Shapley 用采样，别用精确枚举。** 采样 100–1000 个排列；精确枚举不可扩展。
- **给衰减因子设上限，给声誉设下限。** 无界衰减会把合法贡献者抹掉；衰减太慢则会让陈旧的高声誉 agent 长期吃红利。
- **机制要做对抗性审计。** 在网络对外开放前跑红队场景。每一种机制背后都有一套博弈论；你想抢在攻击者之前找到漏洞。

## 练习（Exercises）

1. 跑一遍 `code/main.py`。确认 Shapley 值之和等于总价值（efficiency 公理）。改一改价值函数；Shapley 分配是否朝预期方向变化？
2. 实现 Shapley *采样*（对 K 个排列做 Monte Carlo）。K 如何影响近似精度？在 N=4 时与精确解对比。
3. 在拍卖前增加一个组队步骤：agent 可以合并成团队、以团队身份出价。哪些联盟会形成？结果在 Pareto 意义下是否优于单独出价？
4. 读 Google Research 的机制设计博文。找出一个一旦被破坏就会让激励相容失败的假设。在 LLM 场景下这种失败模式长什么样？
5. 读 AAMAS 2025 去中心化 LaMAS 论文。在一个合成任务上对 10 个 agent 实现他们的 Shapley 步骤。精确计算要多久？采样 100 次能逼近多少？

## 关键术语（Key Terms）

| 术语 | 通常的说法 | 实际含义 |
|------|----------------|------------------------|
| DePIN | "去中心化物理基础设施" | 用 token 激励的算力 / 存储 / 带宽。Bittensor、Akash、Render。 |
| DID | "去中心化标识符" | W3C 规范的可移植 ID。Agent 声誉绑定到 DID，而不是平台。 |
| ERC-4337 | "账户抽象" | 能代付 gas 的合约账户，使 agent 可以付款。 |
| Shapley value | "公平贡献归因" | 满足 efficiency、symmetry、linearity、null 的唯一分配。 |
| Second-price auction | "Vickrey 拍卖" | 激励相容机制：获胜者支付第二高出价。与单调聚合相容。 |
| Reputation capital | "累积质量分" | 绑定 DID 的分数，由确认过的贡献累积，会随时间衰减。 |
| Agentic DAO | "agent + 人类共同治理" | DAO 把 agent 视为一等投票者，投票权挂钩声誉。 |
| TAO / FET / GPU credits | "代币计价单位" | Bittensor TAO、Fetch.ai FET、各种 DePIN token。 |

## 延伸阅读（Further Reading）

- [The Agent Economy](https://arxiv.org/abs/2602.14219) — 2026 年关于 5 层 agent 经济栈的综述
- [Google Research — Mechanism design for large language models](https://research.google/blog/mechanism-design-for-large-language-models/) — 单调聚合下的 token 拍卖
- [AAMAS 2025 — decentralized LaMAS](https://www.ifaamas.org/Proceedings/aamas2025/pdfs/p2896.pdf) — Shapley 值贡献归因
- [Bittensor TAO documentation](https://docs.bittensor.com/) — 子网结构与奖励分配
- [Fetch.ai / ASI Alliance](https://fetch.ai/) — ASI-1 Mini LLM 和 FET token
- [W3C Decentralized Identifiers (DIDs) spec](https://www.w3.org/TR/did-core/) — 身份层基础
