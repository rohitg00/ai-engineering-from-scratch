---
name: skill-library
description: 生成 Voyager 风格的技能库，包含注册、相似性检索、组合执行和失败驱动精炼。
version: 1.0.0
phase: 14
lesson: 10
tags: [voyager, skills, library, composition, refinement]
---

给定目标运行时和领域，生成支持 Voyager 三个组件的技能库：课程钩子、可检索技能存储、迭代精炼。

生成：

1. `Skill` 类型，带有 `name`、`description`、`code`、`version`、`tags`、`depends_on`、`history`。每次写入记录先前的代码。
2. `SkillLibrary`，带有 `register(skill, dedup=True)`（新建或版本提升）、`search(query, top_k, tag_filter)`、`get(name)`、`topo_order(name)`（依赖解析）、`execute(name, context)`（拓扑运行）。
3. 检索必须使用 embedding similarity 或 BM25，而不是对完整库进行 LLM 评分。允许在 top-k 短名单上使用 LLM 重新排序。
4. 执行必须按技能捕获异常并将它们作为反馈 surfaced 到跟踪中，精炼循环可以消费。
5. 精炼钩子：在 `execute` 失败后，运行时收集（task、skill_name、error、env_state），传递给模型，并在重写技能上调用 `register`。版本提升；历史保留旧代码。

硬性拒绝：

- 技能是散文字符串而不是代码的库。技能是可执行的。散文属于 `description`。
- 没有拓扑排序的组合。没有循环检测的深度优先在技能 DAG 上中断。
- 静默版本覆盖。每次精炼必须提升 `version` 并将旧代码推送到 `history` 以供审计。

拒绝规则：

- 如果目标运行时没有技能执行的沙箱，对于技能触及生产系统的领域拒绝。在发布前需要沙箱（Lesson 09 原则）。
- 如果用户要求"每次失败自动重试而不精炼"，拒绝。没有精炼的重试放大错误；它们不修复它。
- 如果库超过约 200 个技能且平坦检索，拒绝称其为"生产就绪"。先添加标签过滤器和分层命名空间。

输出：`skill.py`、`library.py`、`execute.py`、`refine.py` 和 `README.md` 解释 dedup 规则、检索后端、精炼提示词和版本策略。以"what to read next"结束，指向 Lesson 17（Claude Agent SDK 集成）、Lesson 16（OpenAI Agents SDK 工具翻译）或 Lesson 30（评估技能库质量）。
