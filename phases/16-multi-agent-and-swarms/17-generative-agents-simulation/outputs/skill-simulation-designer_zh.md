---
name: simulation-designer
description: 为给定场景设计生成代理模拟（Smallville 风格）。指定内存模式、反思节奏、计划范围、空间/社会约束和评估指标。
version: 1.0.0
phase: 16
lesson: 17
tags: [multi-agent, simulation, generative-agents, emergence, memory]
---

给定需要从代理群体中产生涌现行为的场景（社会模拟、游戏 NPC、政策演练、市场动态），设计模拟。

生成：

1. **人口规模和异质性。** N 个代理；哪些共享基础模型 vs 不同；prompt families；role distribution。Smallville 使用 25 个具有个性化角色的同质代理；更大的人口受益于异质性。
2. **内存模式。** 每个条目的字段：`(ts, kind, content, importance, embedding_ref, source_ids)`。Recency-decay 常数；importance scoring procedure；relevance metric（cosine with embedding model X）。compaction 的保留策略。
3. **反思节奏。** 触发器：未处理 importance 的总和 > threshold，或每 N 个观察，或 periodic tick。每次触发的反思数量。Reflection prompt template。
4. **计划范围。** Day / hour / action 级别。哪些是强制的；哪些可选。Revision trigger：importance > threshold 的新观察与活跃计划矛盾。
5. **世界模型。** Spatial grid、social graph、resource constraints。什么构成观察（line-of-sight、conversation、notification）。架构不学习且必须显式编码的规范约束（capacity limits、closed hours、private spaces）。
6. **种子目标。** 哪些代理被植入哪些优先级。可能竞争的重叠目标；应该共存的非竞争目标。
7. **预算。** 每 tick 每代理的 LLM 调用（observe + retrieve + reflect + plan + act）。每 tick 每代理的预期 token。T ticks 的总模拟成本。
8. **评估指标。** Believability（human-rater）、goal achievement rate、coordination events counted、spatial-norm violations 作为失败信号。

硬性拒绝：

- 没有显式空间/社会规范编码的设计。架构将违反它们（Park 2023 的 closed-store、single-bathroom 失败）。
- 具有可变内存的设计。内存必须是仅追加的；更正为新条目。
- 每 tick 运行反思的设计。这是预算低效的；反思昂贵且触发器应基于阈值。
- 大 N（> 50）没有内存压缩策略的模拟。检索成本随流长度增长。

拒绝规则：

- 如果场景需要涌现*任务执行*而不是涌现*社会行为*，推荐监督者/角色/原语模式（Phase 16 · 05-08）。Smallville 用于社会模拟。
- 如果预算允许每 tick 总计 < 100 次 LLM 调用，推荐 N = 3-5 具有密集交互而不是更大的人口。
- 如果场景不从涌现中受益（紧密脚本化的任务），推荐单代理 + 工具。

输出：一页设计简报。以单句摘要开头（"Smallville-style simulation: 15 heterogeneous agents, reflection at importance sum > 120, 3-level plan horizon, spatial grid with capacity constraints, measured by believability + coordination events."），然后是上述八个部分。以预期涌现行为和要关注的头三个失败模式结束。
