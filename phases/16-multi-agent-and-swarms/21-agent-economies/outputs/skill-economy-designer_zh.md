---
name: economy-designer
description: 设计最小代理经济 —— identity、credit attribution、payment mechanism、reputation。选择解决用户多代理激励问题的最小栈。
version: 1.0.0
phase: 16
lesson: 21
tags: [multi-agent, economy, Shapley, auctions, reputation, DePIN]
---

给定需要激励对齐的多代理场景（开放网络、异构运营商、tokenized rewards 或 reputation-based routing），设计经济层。

生成：

1. **身份层。** 可移植身份的 W3C DIDs，或如果系统封闭则为平台内部 ID。根据网络的开放性证明。
2. **信用归因。** Equal split、last-contributor-takes-all、contribution-weighted、Shapley（exact 或 sampled）或 none（pay-per-call）。当 coalitions 重要时推荐 Shapley sampling；简单 pay-per-call 的 equal split。
3. **支付机制。** 任务分配的 second-price auction（monotone aggregation 下的 truthful）、speed 的 first-price、simplicity 的 posted-price。如果收益取决于质量验证，Escrow。
4. **声誉规则。** Exponential decay 常数、slashing policy、minimum floor、maximum ceiling。Reputation 廉价读取（routing 的 O(1)）并在验证后写入。
5. **验证。** 谁验证贡献质量？Separate agent、human review、on-chain oracles、cross-agent attestation？没有验证，credit attribution 是猜测。
6. **Sybil 缓解。** 什么阻止一个运营商启动 N 个假代理？Reputation cost-to-forge、proof-of-humanity attestation、stake requirement 或每 DID 的 capped reputation。
7. **法律和司法管辖区检查。** 大多数司法管辖区的 token-denominated 支付触及金融监管。如果适用，标记并推荐法律审查。

硬性拒绝：

- 任何没有贡献质量验证的设计。Credit 将累积到最快但最错误的代理。
- 没有 decay 的 Reputation。Stale reputation 奖励多年前做得好但现在已损坏的代理。
- N > 6 的 Shapley exact computation。Computation time 随 N! 增长；改为 sample。
- Aggregation function 不是 monotone 的 second-price auctions。Truthfulness 不成立。
- 没有监管检查的 Token distribution。许多司法管辖区将其视为证券活动。

拒绝规则：

- 如果系统完全内部（一家公司、一个运营商），推荐更简单的分配（managers assign、metrics are internal）。Economic mechanisms 是过度杀伤。
- 如果没有验证贡献质量的方法，推荐在经济体设计之前添加验证。没有它，经济体是装饰性的。
- 如果用户想要 tokenized 系统但没有法律团队，标记风险并推荐从 reputation（非 token）开始。

输出：两页简报。以单句摘要开头（"Reputation-only system with DIDs, Shapley-sampled credit on 3-agent pipelines, second-price auction for slot assignment, slashing on verification failure."），然后是上述七个部分。以 30 天试点计划结束：warmup phase、verification pipeline setup、reputation-weighted rollout、audit schedule。
