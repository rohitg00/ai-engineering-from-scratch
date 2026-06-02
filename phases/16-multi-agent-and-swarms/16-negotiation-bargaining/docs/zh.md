# 谈判与议价（Negotiation and Bargaining）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> agent 们要就资源、价格、任务分配和条款进行谈判。2026 年的基准结论很清楚：NegotiationArena（arXiv:2402.05863）显示 LLM 可以通过 persona 操纵（"绝望感"）把收益提高约 20%；《Measuring Bargaining Abilities》（arXiv:2402.15813）显示买方比卖方更难，规模也救不了——他们的 **OG-Narrator**（确定性报价生成器 + LLM 叙述者）把成交率从 26.67% 拉到了 88.88%；Large-Scale Autonomous Negotiation Competition（arXiv:2503.06416）跑了约 18 万场谈判，发现 **CoT 隐藏**（chain-of-thought-concealing）的 agent 通过对对手隐藏推理过程获胜；Bhattacharya 等人 2025 年用哈佛谈判项目（Harvard Negotiation Project）的指标测出 Llama-3 最有效、Claude-3 最激进、GPT-4 最公平。本课实现 Contract Net Protocol（FIPA 的祖先，第 02 课），接入一个 LLM 风格的买家/卖家，跑一遍 OG-Narrator 风格的拆解，并测量每个结构性选择对成交率的影响。

**Type:** Learn + Build
**Languages:** Python (stdlib)
**Prerequisites:** Phase 16 · 02 (FIPA-ACL Heritage), Phase 16 · 09 (Parallel Swarm Networks)
**Time:** ~75 minutes

## 问题（Problem）

两个 agent 要就一个价格达成一致。如果只用纯语言 prompt 让它们自己谈，2024–2026 年的 LLM 成交率低得出奇——在 arXiv:2402.15813 那种参数收得很紧的议价场景里，只有约 27%。规模也补不上：GPT-4 在议价的*结构*上并不比 GPT-3.5 强，它只是议价的*语言*更好。

根问题是 LLM 把两件事混成了一件——决定报价 vs 叙述报价。OG-Narrator 把它们拆开：一个确定性的报价生成器算出数字动作；LLM 只负责叙述。成交率直接跳到约 89%。

这对应一个经典的多 agent 结论：把机制（mechanism）和通信层（communication layer）解耦才会赢。Contract Net Protocol（FIPA, 1996; Smith, 1980）是任务市场机制的参照样板。把 LLM 插到叙述位上，你就得到一个现代的 LLM 驱动任务市场。

## 概念（Concept）

### 一段话讲清 Contract Net

Smith 1980 年的 Contract Net Protocol：一个 **manager**（管理者）广播一条 **call for proposals (cfp)**（招标）；**bidders**（投标方）回 **propose** 消息附带各自的报价；manager 选出赢家，向赢家发 **accept-proposal**，向输家发 **reject-proposal**。赢家执行任务。可选消息：**refuse**（投标方拒绝报价）。FIPA 把这套写成了 `fipa-contract-net` 交互协议。

### 为什么 OG-Narrator 会赢

《Measuring Bargaining Abilities of Language Models》（arXiv:2402.15813）观察到：

- LLM 经常打破议价规则（报出离谱价格、无视对方的 ZOPA）。
- 它们锚定（anchor）很差（接受糟糕的首轮报价；还价时给的是象征性数字而非战略性数字）。
- 单纯加规模解决不了。更大的模型只是说出更像样的话，战略错误依旧。

OG-Narrator 的拆解：

```
           ┌──────────────────┐        ┌──────────────────┐
  state  → │ offer generator  │ price → │  LLM narrator    │ → message
           │  (deterministic) │        │  (writes the     │
           │                  │        │   human-style    │
           └──────────────────┘        │   accompaniment) │
                                       └──────────────────┘
```

报价生成器是一个经典谈判策略：Rubinstein 议价模型、Zeuthen 策略、或者对价格做简单的 tit-for-tat。LLM 负责叙述。消息里包含确定性算出来的价格，外加自然语言的包装。

成交率上去是因为：
- 价格停留在议价区间（bargaining zone）内。
- 锚定是战略性的，不是情绪化的。
- LLM 做它擅长的事：写。

### NegotiationArena 的发现

arXiv:2402.05863 提供了规范基准。主要结论：

- LLM 通过采用 persona（"我急着周五前把这卖掉"）能把收益提高约 20%——persona 操纵是个真实有效的战术。
- 公平/合作型 agent 会被对抗型 agent 剥削；防守需要显式的反向姿态（counter-posturing）。
- 对称配对在大约 40% 的基准场景里收敛到不公平的结果。

这不是"LLM 不会谈判"，而是"LLM 谈判得太像人，包括人身上那些可被剥削的部分"。

### Chain-of-thought 隐藏

Large-Scale Autonomous Negotiation Competition（arXiv:2503.06416）跑了约 18 万场谈判，覆盖了大量 LLM 策略。赢家都把推理过程对对手隐藏起来：

- 如果一个 agent 在公开可见的 scratchpad 里写"我最多到 \$75；保留价是 \$70"，对手是会读到的。
- 赢家在私下计算策略；输出通道里只有报价和最低限度的必要叙述。

这是 2026 年版本的经典博弈论回声（Aumann 1976 关于理性与信息的工作）：暴露你的私人估值要付出收益代价。LLM 没这个直觉，它会很乐意把自己的保留价打在推理痕迹（reasoning trace）里，而那痕迹会被对手看到。

工程结论：把私有 scratchpad 上下文和公开消息上下文分离开。这不是可选项。

### Bhattacharya 等人 2025——模型排名

按哈佛谈判项目的指标（原则性谈判 principled negotiation、BATNA 尊重、利益互惠）：

- **Llama-3** 最擅长达成交易（成交率 + 收益）。
- **Claude-3** 最激进（高锚定、晚让步）。
- **GPT-4** 最公平（不同配对下的收益方差最小）。

这是 2025 年的快照。重点不是"2026 年 4 月谁赢"——重点是不同基础模型有持续性的谈判风格。异质 ensemble（第 15 课）把这一点作为多样性来源之一。

### 用 Contract Net + LLM 做任务分配

Contract Net 在 LLM 多 agent 上的现代复用：

1. Manager agent 把任务拆成单元。
2. 把任务描述以 `cfp` 广播给 worker agent。
3. 每个 worker 返回一个报价：`(price, eta, confidence)`，price 可以是 token、计算单元或美元。
4. Manager 选出赢家（单选或多选，看任务），并授标。
5. 落选 worker 可自由去投别的任务。

这种方式能轻松扩展到上百 worker，因为协调是"广播-应答"，不是同步聊天。生产里在用：Microsoft Agent Framework 的编排模式，部分 LangGraph 实现。

### LLM-Stakeholders 交互式谈判

NeurIPS 2024（https://proceedings.neurips.cc/paper_files/paper/2024/file/984dd3db213db2d1454a163b65b84d08-Paper-Datasets_and_Benchmarks_Track.pdf）引入了带 **secret scores**（秘密分数）和 **minimum-acceptance thresholds**（最低接受阈值）的多方可计分博弈。每个利益相关方都有自己的私有 utility；LLM 必须从消息里把它们推断出来。这是把双方议价泛化到 N 方联盟形成（coalition formation）。在生产场景里，对于 worker 能力异质的任务市场尤为相关。

### 叙述 vs 机制 这条规则

横跨 2024–2026 所有谈判基准，工程上一致的规则是：

> 让 LLM 叙述。不要让 LLM 计算报价。

如果报价必须是数字（价格、ETA、数量），就根据谈判状态确定性地生成它，让 LLM 产出包装。如果报价必须是某种提案结构（任务拆解、角色分配），让 LLM 起草，但发出去之前要按 schema 校验、按约束检查。

## 动手实现（Build It）

`code/main.py` 实现了：

- `ContractNetManager`、`ContractNetTask`、`Bid`——manager + 投标方，广播 cfp、收集 proposal、授标。
- `og_narrator_bargain(state, rng)`——OG-Narrator 风格的买方：朝中点做 Zeuthen 风格的确定性让步。
- `seller_response(state, rng)`——确定性卖方还价策略（两种风格共用的结构性 ground truth）。
- `naive_llm_bargain(state, rng)`——模拟一个全 LLM 议价者：报价高方差，经常落在 ZOPA 之外。
- 测量：在 1000 次试验上跑成交率，每次试验重新采样保留价。

运行：

```
python3 code/main.py
```

预期输出：naive-LLM 成交率约 65–75%；OG-Narrator 成交率约 85–95%；那 15–25 个百分点的差距，就是把"报价生成"和"叙述"拆开带来的结构性优势。再加一个 Contract Net 任务市场分配示例：三个投标方、一个任务。

## 用起来（Use It）

`outputs/skill-bargainer-designer.md` 设计了一套议价协议：谁生成报价（确定性还是 LLM）、谁叙述、私有 scratchpad 怎么和公开消息分开、成交率怎么监控。

## 上线部署（Ship It）

生产议价 checklist：

- **分离 scratchpad。** 私有状态绝不进对手的上下文。这条没得谈。
- **报价确定性生成。** 价格、数量、ETA：算出来，别让模型 prompt 出来。
- **所有进入的报价都按 schema 校验。** 在协议边界上拒掉 ZOPA 之外的报价。
- **限定回合数。** 最多 3–5 轮；僵局升级给调解者。
- **持续测量成交率和收益方差。** 成交率下滑是症状——通常是 prompt 漂移或来自对手侧的攻击。
- **所有被拒提案都要带确定性理由记日志。** 对 Contract Net manager 来说，落选 bidder 需要知道为什么。

## 练习（Exercises）

1. 跑 `code/main.py`。确认 OG-Narrator 在成交率上击败 naive-LLM。差多少？
2. 实现 **persona 带来的收益提升**（arXiv:2402.05863）——买家在叙述里采用"本周必须买到"的 persona，但报价生成器不变。成交率或收益变了吗？
3. 实现 chain-of-thought **隐藏**：维护一个不传给对手的私有 scratchpad 字符串。如果不小心泄露了（比如把通道交换一下做模拟）会怎样？
4. 把 Contract Net 扩展为带保留价的 N 方拍卖。当所有出价都超过保留价时，manager 在"最低价"和"最高质量"之间怎么选？你选哪种授标规则，为什么？
5. 读 Bhattacharya 等人 2025 关于哈佛谈判项目指标的工作。实现两个风格不同的议价者（激进 vs 公平）。在对称和不对称配对下测量收益方差。

## 关键术语（Key Terms）

| 术语 | 大家怎么说 | 真实含义 |
|------|----------------|------------------------|
| Contract Net | "任务市场" | Smith 1980, FIPA 1996。cfp + propose + accept/reject。规范的任务市场。 |
| ZOPA | "可能成交区间"（Zone of possible agreement） | 买家最高出价和卖家最低接受价的重叠。落在这之外的报价没法成交。 |
| BATNA | "谈判协议外的最佳选择"（Best alternative to a negotiated agreement） | 这笔谈崩时你的退路。它定下你的保留价。 |
| OG-Narrator | "Offer generator + narrator" | 拆解：确定性报价 + LLM 叙述。 |
| Zeuthen 策略 | "风险最小化让步" | 经典报价生成器，按风险上限做让步。 |
| Rubinstein 议价 | "交替出价均衡" | 带折现的无限期议价博弈论模型。 |
| CoT 隐藏 | "藏住你的推理" | arXiv:2503.06416 的赢家都保留私有 scratchpad；公开通道只露报价。 |
| Persona 操纵 | "情绪姿态" | arXiv:2402.05863：绝望/紧迫感 persona 带来约 20% 收益提升。 |

## 延伸阅读（Further Reading）

- [NegotiationArena](https://arxiv.org/abs/2402.05863) —— 基准；persona 操纵与剥削相关结论
- [Measuring Bargaining Abilities of Language Models](https://arxiv.org/abs/2402.15813) —— OG-Narrator 与"买方比卖方难"的结果
- [Large-Scale Autonomous Negotiation Competition](https://arxiv.org/abs/2503.06416) —— 约 18 万场谈判；CoT 隐藏者获胜
- [LLM-Stakeholders Interactive Negotiation (NeurIPS 2024)](https://proceedings.neurips.cc/paper_files/paper/2024/file/984dd3db213db2d1454a163b65b84d08-Paper-Datasets_and_Benchmarks_Track.pdf) —— 带秘密 utility 的多方可计分博弈
- [Smith 1980 — The Contract Net Protocol](https://ieeexplore.ieee.org/document/1675516) —— 经典机制，IEEE Transactions on Computers
