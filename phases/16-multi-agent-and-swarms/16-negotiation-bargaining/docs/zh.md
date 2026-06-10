# 16 · 谈判与议价

> 智能体（agent）就资源、价格、任务分配与条款进行谈判。2026 年的基准测试集给出了清晰的结论：NegotiationArena（arXiv:2402.05863）表明大语言模型（LLM）可以通过人设操纵（persona manipulation，例如"急迫感"）将收益提升约 20%；"衡量议价能力"（"Measuring Bargaining Abilities"，arXiv:2402.15813）显示买方比卖方更难，且模型规模并无助益——他们提出的 **OG-Narrator**（确定性报价生成器 + LLM 叙述器）把成交率从 26.67% 拉升到 88.88%；大规模自主谈判竞赛（Large-Scale Autonomous Negotiation Competition，arXiv:2503.06416）运行了约 18 万场谈判，发现**隐藏思维链（chain-of-thought-concealing）**的智能体凭借对对手隐藏推理过程而获胜；Bhattacharya 等人 2025 年依据哈佛谈判项目（Harvard Negotiation Project）指标评估，Llama-3 最高效、Claude-3 最激进、GPT-4 最公平。本课实现合同网协议（Contract Net Protocol，FIPA 的前身，见第 02 课），接入一个 LLM 风格的买家/卖家，运行一种 OG-Narrator 式的分解，并衡量成交率如何随每一项结构性选择而变化。

**类型：** 学习 + 构建
**语言：** Python（标准库）
**前置：** 第 16 阶段 · 02（FIPA-ACL 的传承）、第 16 阶段 · 09（并行集群网络）
**时长：** 约 75 分钟

## 问题

两个智能体需要就一个价格达成一致。若放任它们仅凭纯语言提示自行交涉，2024–2026 年的 LLM 成交率低得令人意外（在 arXiv:2402.15813 中那些参数被严格设定的议价场景中约为 27%）。扩大规模无法解决问题：GPT-4 在议价上并不比 GPT-3.5 在结构上更强；它只是更擅长议价的*语言*。

根本症结在于，LLM 把两件工作混为一谈——决定报价与叙述报价。OG-Narrator 把二者分离：一个确定性报价生成器计算数值层面的出价动作；LLM 只负责叙述。成交率随之跃升至约 89%。

这印证了一个经典的多智能体（multi-agent）结论：将机制（mechanism）与通信层（communication layer）解耦才能取胜。合同网协议（Contract Net Protocol，FIPA，1996；Smith，1980）是任务市场（task market）机制的参照范本。把一个 LLM 插入到叙述环节，你就得到了一个现代化的、由 LLM 驱动的任务市场。

## 概念

### 一段话说清合同网

Smith 1980 年的合同网协议：一个**管理者（manager）**广播一份**招标书（call for proposals，cfp）**；**投标者（bidders）**以包含其出价的 **propose** 消息进行响应；管理者选出中标者，向中标者发送 **accept-proposal**，向落标者发送 **reject-proposal**。中标者执行工作。可选消息：**refuse**（投标者拒绝投标）。FIPA 将其编制为 `fipa-contract-net` 交互协议。

### 为何 OG-Narrator 取胜

"衡量语言模型的议价能力"（"Measuring Bargaining Abilities of Language Models"，arXiv:2402.15813）观察到：

- LLM 经常违反议价规则（以毫无意义的价格出价，无视对方的 ZOPA）。
- 它们锚定（anchor）能力差（接受糟糕的首次报价；以象征性而非战略性的金额还价）。
- 仅靠扩大规模无法修正这些问题。更大的模型生成更可信的语言，但战略性错误程度相近。

OG-Narrator 的分解方式：

```
           ┌──────────────────┐        ┌──────────────────┐
  state  → │ offer generator  │ price → │  LLM narrator    │ → message
           │  (deterministic) │        │  (writes the     │
           │                  │        │   human-style    │
           └──────────────────┘        │   accompaniment) │
                                       └──────────────────┘
```

报价生成器是一种经典的谈判策略：Rubinstein 议价模型、Zeuthen 策略，或一个简单的针对价格的针锋相对（tit-for-tat）。LLM 负责叙述。消息中既包含确定性算出的价格，也包含自然语言的措辞包装。

成交率跃升的原因在于：

- 价格始终保持在议价区间内。
- 锚定是战略性的，而非情绪化的。
- LLM 做它擅长的事：写作。

### NegotiationArena 的发现

arXiv:2402.05863 提供了权威的基准测试。核心发现：

- LLM 可以通过采用人设（"我急着在周五前把这个卖掉"）将收益提升约 20%——人设操纵是一种真实有效的策略。
- 公平/合作型智能体会被对抗型智能体利用；防御需要明确的反向姿态（counter-posturing）。
- 在约 40% 的基准场景中，对称配对（symmetric pair-ups）会收敛到不公平的结果。

这并不是说"LLM 是糟糕的谈判者"，而是"LLM 谈判得太像人类，连可被利用的那部分也学得很像"。

### 思维链隐藏

大规模自主谈判竞赛（arXiv:2503.06416）跨多种 LLM 策略运行了约 18 万场谈判。获胜者对对手隐藏自己的推理过程：

- 如果某个智能体在公开可见的草稿区（scratchpad）里打印出"我最多只到 $75；我的保留价是 $70"，对手就会读到它。
- 获胜者私下计算策略；输出通道只包含报价和最低限度必要的叙述。

这是经典博弈论（Aumann 1976 关于理性与信息的论述）在 2026 年的回响：泄露你的私有估值会损失收益。LLM 并不能凭直觉理解这一点，反而乐于在会被对手看到的推理轨迹里打出自己的保留价。

工程要点：把私有草稿区上下文与公开消息上下文分离开来。这不是可选项。

### Bhattacharya 等人 2025——模型排名

依据哈佛谈判项目指标（原则性谈判、尊重 BATNA、利益互惠）：

- **Llama-3** 在达成交易上最高效（成交率 + 收益）。
- **Claude-3** 是最激进的谈判者（高锚定、晚让步）。
- **GPT-4** 最公平（跨各种配对的收益方差最小）。

这是一份 2025 年的快照。重点不在于 2026 年 4 月哪个模型胜出——而在于不同的基础模型具有持久稳定的谈判风格。异质集成（heterogeneous ensembles，见第 15 课）会把这一点作为多样性来源加以利用。

### 通过合同网 + LLM 进行任务分配

合同网在 LLM 多智能体场景下的现代复用方式：

1. 管理者智能体将任务分解为若干单元。
2. 向工作者（worker）智能体广播带有任务描述的 `cfp`。
3. 每个工作者返回一份报价：`(price, eta, confidence)`，其中 price 可以是 token、计算单元或美元。
4. 管理者选出中标者（视任务而定，可单个或多个）并授标。
5. 落标的工作者可以自由地去竞标其他任务。

这种方式能轻松扩展到 100 名以上工作者，因为协调是"广播-响应"式的，而非同步聊天。已用于生产环境：Microsoft Agent Framework 的编排模式，以及一些 LangGraph 实现。

### LLM-利益相关方交互式谈判

NeurIPS 2024（https://proceedings.neurips.cc/paper_files/paper/2024/file/984dd3db213db2d1454a163b65b84d08-Paper-Datasets_and_Benchmarks_Track.pdf）引入了带有**秘密评分（secret scores）**和**最低接受阈值（minimum-acceptance thresholds）**的多方可计分博弈。每个利益相关方都有私有效用；LLM 必须从消息中推断它们。这是两方议价向 N 方联盟形成（coalition formation）的推广。它与那些拥有异质工作者能力的生产级任务市场密切相关。

### 叙述与机制的分离规则

纵观 2024–2026 年所有谈判基准测试，一以贯之的工程规则是：

> 让 LLM 叙述。不要让 LLM 计算报价。

如果报价需要是一个数字（价格、ETA、数量），就从谈判状态出发确定性地生成它，再让 LLM 产出措辞包装。如果报价需要是一个提案结构（任务分解、角色分配），可以让 LLM 起草，但在发送前要对照 schema 验证并做约束检查。

## 动手构建

`code/main.py` 实现了：

- `ContractNetManager`、`ContractNetTask`、`Bid`——管理者 + 投标者，广播 cfp、收集提案、授标。
- `og_narrator_bargain(state, rng)`——OG-Narrator 买家：确定性的、朝中点收敛的 Zeuthen 式让步。
- `seller_response(state, rng)`——确定性的卖家还价策略（两种风格共同的结构性基准事实）。
- `naive_llm_bargain(state, rng)`——模拟一个全 LLM 议价者：以高方差挑选价格，常常落在 ZOPA 之外。
- 测量：在 1000 次试验上的成交率，每次试验都重新采样新的保留价。

运行：

```
python3 code/main.py
```

预期输出：朴素 LLM 成交率约 65–75%；OG-Narrator 成交率约 85–95%；这 15–25 个百分点的差距正是把报价生成与叙述分解开来所带来的结构性优势。此外还有一个含三名投标者和一项任务的合同网任务市场分配示例。

## 应用

`outputs/skill-bargainer-designer.md` 设计了一套议价协议：由谁生成报价（确定性还是 LLM）、由谁叙述、私有草稿区如何与公开消息分离，以及如何监控成交率。

## 上线

生产环境议价检查清单：

- **分离草稿区。** 私有状态绝不能进入对手的上下文。这一点没有商量余地。
- **确定性报价生成。** 价格、数量、ETA：要计算，不要提示。
- **验证所有传入报价**，对照 schema 进行校验。在协议边界处拒绝 ZOPA 之外的报价。
- **限定回合数。** 最多 3–5 回合；陷入僵局时升级到调解者（mediator）。
- **持续测量成交率与收益方差。** 成交率下降是一种症状——往往源于提示漂移（prompt drift）或对手侧的攻击。
- **记录所有被拒绝的提案**及其确定性理由。对于合同网管理者而言，落标者需要明白被拒的原因。

## 练习

1. 运行 `code/main.py`。确认 OG-Narrator 在成交率上胜过朴素 LLM。高出多少？
2. 实现**基于人设的收益提升**（arXiv:2402.05863）——买家在叙述中（且仅在叙述中）采用"本周急着买"的人设，报价生成器保持不变。成交率或收益是否发生变化？
3. 实现思维链**隐藏**：维护一个不会传给对手的私有草稿区字符串。如果你不小心把它泄露了（通过交换通道来模拟）会发生什么？
4. 把合同网扩展为带保留价（reserve price）的 N 投标者拍卖。当所有出价都超过保留价时，管理者如何在最低价与最高质量之间做抉择？你会选择哪条授标规则，为什么？
5. 阅读 Bhattacharya 等人 2025 年关于哈佛谈判项目指标的研究。实现两个风格不同的议价者（激进型 vs 公平型）。在对称和非对称配对下测量收益方差。

## 关键术语

| 术语 | 人们怎么说 | 它实际的含义 |
|------|----------------|------------------------|
| Contract Net（合同网） | "任务市场" | Smith 1980、FIPA 1996。cfp + propose + accept/reject。任务市场的范本。 |
| ZOPA | "可能达成协议的区间" | 买方最高价与卖方最低价之间的重叠区。区间之外的报价无法成交。 |
| BATNA | "谈判协议的最佳替代方案" | 本次交易失败时你的退路。它设定了你的保留价。 |
| OG-Narrator | "报价生成器 + 叙述器" | 一种分解：确定性报价，LLM 叙述。 |
| Zeuthen strategy（Zeuthen 策略） | "风险最小化让步" | 一种经典的报价生成器，依据风险上限来让步。 |
| Rubinstein bargaining（Rubinstein 议价） | "交替出价均衡" | 用于带折现的无限期议价的博弈论模型。 |
| CoT concealment（思维链隐藏） | "隐藏你的推理" | arXiv:2503.06416 中的获胜者保留私有草稿区；公开通道只展示报价。 |
| Persona manipulation（人设操纵） | "情绪化姿态" | arXiv:2402.05863：来自急迫/紧迫人设的约 20% 收益提升。 |

## 延伸阅读

- [NegotiationArena](https://arxiv.org/abs/2402.05863)——该基准测试；人设操纵与被利用的相关发现
- [衡量语言模型的议价能力](https://arxiv.org/abs/2402.15813)——OG-Narrator 以及"买方比卖方更难"的结论
- [大规模自主谈判竞赛](https://arxiv.org/abs/2503.06416)——约 18 万场谈判；隐藏思维链者获胜
- [LLM-利益相关方交互式谈判（NeurIPS 2024）](https://proceedings.neurips.cc/paper_files/paper/2024/file/984dd3db213db2d1454a163b65b84d08-Paper-Datasets_and_Benchmarks_Track.pdf)——带有秘密效用的多方可计分博弈
- [Smith 1980——合同网协议](https://ieeexplore.ieee.org/document/1675516)——经典机制，发表于 IEEE Transactions on Computers
