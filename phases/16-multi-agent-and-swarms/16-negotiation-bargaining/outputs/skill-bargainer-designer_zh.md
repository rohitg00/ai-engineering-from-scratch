---
name: bargainer-designer
description: 设计谈判协议：哪个代理叙述、哪个组件生成报价、private scratchpads 如何与公共消息分离、轮次限制是什么以及如何监控成交率。
version: 1.0.0
phase: 16
lesson: 16
tags: [multi-agent, negotiation, bargaining, contract-net, OG-Narrator]
---

给定谈判或任务市场场景（two-party bargain、N-party auction、contract-net task allocation），设计协议。

生成：

1. **机制。** Two-party bargain、N-bidder auction、contract-net broadcast 或 multi-party coalition。命名游戏。
2. **报价生成器。** Deterministic（Zeuthen-style concession、Rubinstein equilibrium、simple linear schedule）或 LLM-prompted。默认：deterministic，除非报价必须是定性结构（proposal、role assignment）。
3. **叙述层。** LLM 贡献什么：human-friendly framing、persuasion tactics、persona。明确说明 LLM 不决定什么。
4. **Private vs public channels。** 推理痕迹如何保持在对等方的上下文之外。"Private scratchpad" + "public message" 作为两个字段。根据 arXiv:2503.06416，这是不可协商的。
5. **轮次限制。** 两方最多 3-5 轮。无界不是选项；它奖励一致性并鼓励情绪化报价。
6. **Reservation 和 BATNA 纪律。** 双方必须知道他们的 reservation price。如果另一方探测，LLM 叙述者不得透露它。针对此规则验证每条传出消息。
7. **成交率监控。** 此协议的预期基线成交率（引用谈判基准中的数字：取决于 LLM 角色的 27%-89% 范围）。回归的警报阈值。
8. **升级。** 低于阈值的轮次、ZOPA 违规或对方规则破坏路由到调解代理或人类。

硬性拒绝：

- 任何 LLM 计算数值报价而没有确定性回退的设计。arXiv:2402.15813 显示这产生约 27% 的成交率。
- 任何没有单独 private 和 public channels 的设计。对等方将读取你的推理。
- 任何具有无界轮次的设计。保证一致性驱动的结果。
- 让单个代理持有买方和卖方状态的设计（角色扮演谈判）。Private-information 属性是机制；合并角色会移除它。

拒绝规则：

- 如果任务没有数值收益（qualitative negotiation、contract terms），OG-Narrator 分解可能不适用。推荐结构化 proposal + schema validation。
- 如果用户无法实现单独的 scratchpad（单 LLM-call 架构），明确标记泄漏风险并推荐 two-call 架构。
- 如果谈判与可能说谎的对方对抗，推荐调解代理加记录报价以供审计。

输出：一页简报。以单句摘要开头（"Two-party bargain: Zeuthen offer generator + LLM narrator, 5-round bound, separate scratchpad, deal-rate alert below 85%."），然后是上述八个部分。以示例消息结束：对等方看到什么 vs private scratchpad 持有什么。
