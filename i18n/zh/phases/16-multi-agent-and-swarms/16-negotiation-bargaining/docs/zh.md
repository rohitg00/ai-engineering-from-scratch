# 谈判与讨价还价

> 智能体就资源、价格、任务分配与条款进行谈判。2026 年的基准测试结论明确：NegotiationArena（arXiv:2402.05863）表明 LLM 可以通过角色扮演操控（“绝望感”）将收益提升约 20%；"Measuring Bargaining Abilities"（arXiv:2402.15813）表明买方比卖方更难做好，且规模扩大并无帮助——其 **OG-Narrator**（确定性报价生成器 + LLM 叙述器）将成交率从 26.67% 推升至 88.88%；大规模自主谈判竞赛（arXiv:2503.06416）运行了约 18 万场谈判，发现采用 **思维链隐藏** 的智能体通过向对手隐藏推理过程而获胜；Bhattacharya et al. 2025 基于 Harvard Negotiation Project 指标对模型排名：Llama-3 最有效，Claude-3 最具攻击性，GPT-4 最公平。本课实现 Contract Net Protocol（FIPA 的前身，见第 02 课），接入 LLM 式的买方/卖方，运行 OG-Narrator 式的分解，并衡量每种结构性选择对成交率的影响。

**Type:** Learn + Build
**Languages:** Python（标准库）
**Prerequisites:** 阶段 16 · 02（FIPA-ACL Heritage）、阶段 16 · 09（Parallel Swarm Networks）
**Time:** 约 75 分钟

## 问题

两个智能体需要就价格达成一致。若仅依靠纯语言提示，2024-2026 年的 LLM 成交率低得惊人（arXiv:2402.15813 中高度参数化的议价场景下约 27%）。扩大规模也解决不了：GPT-4 在议价的结构性能力上并不比 GPT-3.5 强；它只是更擅长议价的 *语言表达*。

根本问题在于 LLM 把两件工作混为一谈——决定报价和叙述报价。OG-Narrator 把两者分离：由确定性报价生成器计算数值出价，LLM 只负责叙述。成交率跃升至约 89%。

这印证了经典多智能体研究的结论：把机制与通信层解耦是制胜之道。Contract Net Protocol（FIPA，1996；Smith，1980）是参考性的任务市场机制。把 LLM 插入叙述槽位，你就得到了一个现代的 LLM 驱动的任务市场。

## 概念

### Contract Net，一段话说明

Smith 1980 年的 Contract Net Protocol：**管理者** 广播 **招标（cfp）**；**投标者** 回复包含其报价的 **propose** 消息；管理者选定赢家，向其发送 **accept-proposal**，向其余投标者发送 **reject-proposal**。赢家执行任务。可选消息：**refuse**（投标者拒绝出价）。FIPA 将其规范化为 `fipa-contract-net` 交互协议。

### OG-Narrator 为何获胜

"Measuring Bargaining Abilities of Language Models"（arXiv:2402.15813）观察到：

- LLM 经常违反议价规则（以荒谬的价格出价，无视对方的 ZOPA）。
- 它们的锚定很差（接受糟糕的首轮报价；以象征性而非策略性的幅度还价）。
- 仅靠规模无法解决这些问题。更大的模型生成更可信的语言，但策略性错误依旧。

OG-Narrator 的分解方式：

```
           ┌──────────────────┐        ┌──────────────────┐
  state  → │ offer generator  │ price → │  LLM narrator    │ → message
           │  (deterministic) │        │  (writes the     │
           │                  │        │   human-style    │
           └──────────────────┘        │   accompaniment) │
                                       └──────────────────┘
```

报价生成器是一个经典的谈判策略：Rubinstein 议价模型、Zeuthen 策略，或简单的以牙还牙价格策略。LLM 负责叙述。消息中包含确定性价格与自然语言包装。

成交率跃升的原因：
- 价格始终保持在议价区间内。
- 锚点是策略性的，而非情绪化的。
- LLM 只做它擅长的事：写作。

### NegotiationArena 的发现

arXiv:2402.05863 提供了权威基准。主要发现：

- LLM 可以通过采用某种角色（“我必须在周五前把它卖掉”）将收益提升约 20% —— 角色操控是真实的战术。
- 公平/合作的智能体会被对抗性的智能体利用；防御需要明确的反姿态。
- 对称配对在约 40% 的基准场景中收敛到不公平的结果。

这不是“LLM 是糟糕的谈判者”，而是“LLM 谈判得太像人类了，包括那些可被利用的部分”。

### 思维链隐藏

大规模自主谈判竞赛（arXiv:2503.06416）在众多 LLM 策略间运行了约 18 万场谈判。获胜者向对手隐藏了自己的推理：

- 如果一个智能体把“我最多只出到 $75; my reservation price is $70”打印到公开可见的草稿板上，对手就会读到。
- 获胜者在私下计算策略；输出通道只包含报价和最少的必要叙述。

这是经典博弈论（Aumann 1976 关于理性与信息）在 2026 年的回响：暴露你的私有估值会损失收益。LLM 对此没有直觉，会欣然把保留价敲进对对手可见的推理轨迹里。

工程要点：将私有草稿板上下文与公开消息上下文分离。没有商量余地。

### Bhattacharya et al. 2025 —— 模型排名

基于 Harvard Negotiation Project 指标（原则性谈判、BATNA 尊重、利益互惠）：

- **Llama-3** 在达成交易上最有效（成交率 + 收益）。
- **Claude-3** 是最具攻击性的谈判者（高锚定、晚让步）。
- **GPT-4** 最公平（各配对间收益方差最小）。

这是 2025 年的快照。重点不在于哪个模型在 2026 年 4 月胜出，而在于不同的基础模型具有持久稳定的谈判风格。异构集成（第 15 课）将此作为一种多样性来源纳入。

### 用 Contract Net + LLM 做任务分配

Contract Net 在 LLM 多智能体中的现代复用：

1. 管理者智能体将任务分解为单元。
2. 向工作节点智能体广播带任务描述的 `cfp`。
3. 每个工作节点返回一个报价：`(price, eta, confidence)`，其中价格可以是 token、算力单元或美元。
4. 管理者选定赢家（视任务而定，单个或多个）并授标。
5. 被拒绝的工作节点可自由竞标其他任务。

这可以很好地扩展到 100 个以上工作节点，因为协调是广播-应答式的，而非同步聊天。已在生产中使用：Microsoft Agent Framework 的编排模式、部分 LangGraph 实现。

### LLM-Stakeholders 交互式谈判

NeurIPS 2024（https://proceedings.neurips.cc/paper_files/paper/2024/file/984dd3db213db2d1454a163b65b84d08-Paper-Datasets_and_Benchmarks_Track.pdf）引入了带 **秘密分值** 与 **最低接受阈值** 的多方可计分博弈。每个利益相关方拥有私有效用函数；LLM 必须从消息中推断它们。这是将双方议价推广到 N 方联盟形成。适用于具有异构工作节点能力的生产级任务市场。

### 叙述与机制分离法则

纵观 2024-2026 年所有谈判基准，一致的工程法则是：

> 让 LLM 负责叙述。不要让 LLM 计算报价。

如果报价需要是一个数字（价格、ETA、数量），就从谈判状态中确定性地生成它，让 LLM 产出包装。如果报价需要是一个提案结构（任务分解、角色分配），可以让 LLM 起草，但发送前须按 schema 校验并做约束检查。

```figure
a5-og-narrator
```

## 动手实现

`code/main.py` 实现了：

- `ContractNetManager`、`ContractNetTask`、`Bid` —— 管理者 + 投标者，广播 cfp，收集提案，授标。
- `og_narrator_bargain(state, rng)` —— OG-Narrator 买方：向中点做确定性的 Zeuthen 式让步。
- `seller_response(state, rng)` —— 确定性的卖方还价策略（两种风格共同的结构性基准真值）。
- `naive_llm_bargain(state, rng)` —— 模拟全 LLM 议价者：以高方差选取价格，常落在 ZOPA 之外。
- 测量：1000 次试验的成交率，每次试验采样新的保留价。

运行：

```
python3 code/main.py
```

预期输出：naive-LLM 成交率约 65-75%；OG-Narrator 成交率约 85-95%；15-25 个百分点的差距就是把报价生成与叙述解耦的结构性优势。另有一个 Contract Net 任务市场分配示例，包含三个投标者和一个任务。

## 应用它

`outputs/skill-bargainer-designer.md` 设计一个议价协议：谁生成报价（确定性还是 LLM）、谁负责叙述、私有草稿板如何与公开消息分离，以及如何监控成交率。

## 上线它

生产级议价清单：

- **分离草稿板。** 私有状态绝不进入对手的上下文。这是不可妥协的。
- **确定性报价生成。** 价格、数量、ETA：用计算，不要用提示词。
- **校验所有 incoming 报价**，对照 schema。在协议边界拒绝 ZOPA 之外的报价。
- **限制轮数。** 最多 3-5 轮；陷入僵局时升级到调解者。
- **持续测量成交率与收益方差。** 成交率下降是一个症状——通常是提示词漂移或对手侧攻击。
- **记录所有被拒绝的提案**，附上确定性理由。对 Contract Net 管理者而言，落标者需要理解原因。

## 练习

1. 运行 `code/main.py`。确认 OG-Narrator 在成交率上优于 naive-LLM。领先多少？
2. 实现 **基于角色的收益提升**（arXiv:2402.05863）——买方仅在叙述中采用“这周急于买入”的角色，报价生成器不变。成交率或收益有变化吗？
3. 实现思维链 **隐藏**：维护一个不传给对手的私有草稿板字符串。如果意外泄露会发生什么（通过交换两个通道来模拟）？
4. 将 Contract Net 扩展为带保留价的 N 投标者拍卖。当所有出价都超过保留价时，管理者如何在最低价与最高质量之间抉择？你会选择哪种授标规则，为什么？
5. 阅读 Bhattacharya et al. 2025 关于 Harvard Negotiation Project 指标的内容。实现两个风格不同的议价者（攻击型 vs 公平型）。在对称与非对称配对下测量收益方差。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|------------------------|------------------------|
| Contract Net | “任务市场” | Smith 1980，FIPA 1996。cfp + propose + accept/reject。规范的任务市场。 |
| ZOPA | “可能达成协议的区域” | 买方上限与卖方下限之间的重叠。区间外的报价无法成交。 |
| BATNA | “谈判协议的最佳替代方案” | 这笔交易失败时你的退路。决定你的保留价。 |
| OG-Narrator | “报价生成器 + 叙述器” | 分解：确定性报价，LLM 叙述。 |
| Zeuthen 策略 | “风险最小化让步” | 经典报价生成器，基于风险限界做出让步。 |
| Rubinstein 议价 | “交替报价均衡” | 带贴现的无限期议价的博弈论模型。 |
| CoT 隐藏 | “隐藏你的推理” | arXiv:2503.06416 中的获胜者使用私有草稿板；公开通道只显示报价。 |
| 角色操控 | “情绪化姿态” | arXiv:2402.05863：通过绝望/紧迫角色获得约 20% 的收益提升。 |

## 延伸阅读

- [NegotiationArena](https://arxiv.org/abs/2402.05863) —— 基准；角色操控与利用行为的研究发现
- [Measuring Bargaining Abilities of Language Models](https://arxiv.org/abs/2402.15813) —— OG-Narrator 以及“买方难于卖方”的结论
- [Large-Scale Autonomous Negotiation Competition](https://arxiv.org/abs/2503.06416) —— 约 18 万场谈判；思维链隐藏获胜
- [LLM-Stakeholders Interactive Negotiation (NeurIPS 2024)](https://proceedings.neurips.cc/paper_files/paper/2024/file/984dd3db213db2d1454a163b65b84d08-Paper-Datasets_and_Benchmarks_Track.pdf) —— 带秘密效用的多方可计分博弈
- [Smith 1980 — The Contract Net Protocol](https://ieeexplore.ieee.org/document/1675516) —— 经典机制，IEEE Transactions on Computers