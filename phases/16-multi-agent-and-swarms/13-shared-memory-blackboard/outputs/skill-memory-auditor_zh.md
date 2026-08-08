---
name: memory-auditor
description: 审计多代理系统的共享内存设计，包括 provenance、versioning、verifier separation 和 projection schema。在生产前标记内存中毒暴露。
version: 1.0.0
phase: 16
lesson: 13
tags: [multi-agent, shared-state, blackboard, memory-poisoning, provenance]
---

给定多代理代码库或架构文档，审计共享内存设计并标记内存中毒暴露。

生成：

1. **拓扑。** 完整消息池、topic-partitioned blackboard、projected per-agent view 或 hybrid？命名数据结构（list、dict、pandas frame、vector store、SQL table）。计算稳态下写入器和读取器的粗略上限。
2. **Provenance 字段。** 每次写入时，条目是否记录：writer id、timestamp、prompt hash 或 prompt text、tool-call trace、source URI 或 tool name？列出存在的字段和缺失的字段。
3. **更新模型。** 日志是仅追加，还是写入器就地变异？如果是变异，并发控制机制是什么（lock、optimistic versioning、none）？更正应该是 supersession 条目，不是就地编辑 —— 标记任何不这样做的设计。
4. **验证器分离。** 是否有具有独立源访问权限的只读代理？它可以写入主池吗（不应该）？它的输出去哪里？
5. **投影模式。** 如果设计使用投影（LangGraph reducers、blackboard topics、role-scoped views），模式是否已记录？新代理如何声明它们消费的投影？
6. **中毒风险评分。** 在每个轴上评分 1-5：[provenance completeness]、[supersession over mutation]、[verifier independence]、[projection schema clarity]。在任何轴上得分低于 3 的系统被标记。

硬性拒绝：

- 任何不标记缺失验证器的审计。具有独立源访问权限的不可写验证器是承重缓解措施；没有它，每个其他缓解措施都是装饰性的。
- 推荐"添加更多测试"的审计。测试无法捕获内存中毒，因为中毒产生通过测试的合理输出。
- 推荐将内容哈希作为唯一 provenance 的审计。哈希告诉你*写了什么*，不是*谁*或*从哪里*。

拒绝规则：

- 如果代码库将共享状态隐藏在没有检查工具的外部服务（Redis、Postgres、vector DB）中，说明审计无法在没有生产读取访问权限的情况下完成。
- 如果系统少于三个代理，注意内存中毒风险低，但 provenance 仍然是廉价保险。
- 如果系统使用具有内置状态管理的框架（LangGraph checkpointer、AutoGen pool），审计框架的保证而不是重新推导它们。

输出：两页报告。以一句摘要开头（"共享状态是没有 provenance 和验证器的完整消息池 —— 高中毒风险。"），然后是上述六个部分。以优先行动列表结束：三个更改，每个标记为 [critical] [should] 或 [nice-to-have]，并附带估计的实现时间。
