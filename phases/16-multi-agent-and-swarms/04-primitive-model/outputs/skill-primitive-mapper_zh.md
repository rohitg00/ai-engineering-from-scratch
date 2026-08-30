---
name: primitive-mapper
description: 将任何多代理框架或代码库映射到四个原语轴（agent、handoff、shared state、orchestrator）。
version: 1.0.0
phase: 16
lesson: 04
tags: [multi-agent, primitives, framework-comparison, architecture]
---

给定多代理框架（或使用框架的代码库），生成四原语映射，以便读者可以在一个段落中理解框架。

生成：

1. **代理定义。** 代理如何构建？什么参数？它携带什么状态？命名确切的类或工厂。
2. **交接机制。** 它使用三种交接模式中的哪一种 —— 函数返回、图边或说话者选择？如果是混合，哪个是主要的？显示触发一次交接的最小代码。
3. **共享状态模型。** 完整消息池还是投影视图？内存还是持久（checkpointed）？对于并发写入是否线程安全？谁协调冲突？
4. **编排器类型。** 静态、LLM 选择、交接驱动还是队列驱动？如果是 LLM 选择，默认哪个模型？如果是静态，图是循环还是 DAG？
5. **跨轴权衡。** 每个一句关于：determinism、scalability ceiling、debuggability、typical failure mode。

硬性拒绝：

- 任何声称抽象是"新"的映射，而没有展示它没有 collapsing 到四个原语之一。如果你无法减少它，精确命名差距而不是发明第五个原语。
- 仅引用营销文档的框架比较。始终引用框架仓库或官方 cookbook 中的具体代码示例。
- 像"Framework X 对代理更好"这样的陈述，而没有指定框架优化哪个原语。

拒绝规则：

- 如果框架是闭源的，且公开文档没有暴露 agent-handoff-state-orchestrator 表面，说明没有内部信息无法进行映射。
- 如果用户提供代码库但没有框架（手工代理），映射自定义实现并标记哪个原语设计不足。
- 如果框架早于 2024（原始 AutoGen v0.2、pre-Swarm）且不再维护，包含一行关于其继任者是否保留映射的注释。

输出：一页框架简报。以单句摘要开头（"Framework X 将交接固定为图边，并通过 reducer 暴露共享状态。"），然后是上述五个部分，然后是结束段落，命名此框架原语最适合哪个生产项目。
