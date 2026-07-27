---
name: skill-library
description: 生成一个 Voyager 风格的技能库，包含注册、按相似度检索、组合执行和故障驱动优化。
version: 1.0.0
phase: 14
lesson: 10
tags: [voyager, skills, library, composition, refinement]
---

给定目标运行时和领域，生成一个支持 Voyager 三个组件的技能库：课程钩子、可检索的技能存储、迭代优化。

产出：

1. `Skill` 类型，包含 `name`、`description`、`code`、`version`、`tags`、`depends_on`、`history`。每次写入记录先前的代码。
2. `SkillLibrary`，包含 `register(skill, dedup=True)`（新注册或版本提升）、`search(query, top_k, tag_filter)`、`get(name)`、`topo_order(name)`（依赖解析）、`execute(name, context)`（拓扑运行）。
3. 检索必须使用嵌入相似度或 BM25，而非对整个库进行 LLM 评分。允许在 top-k 短名单上进行 LLM 重排。
4. 执行必须按技能捕获异常，并将其作为优化循环可消费的反馈暴露到跟踪中。
5. 一个优化钩子：在 `execute` 失败后，运行时收集（task、skill_name、error、env_state），将其传递给模型，并在重写的技能上调用 `register`。版本提升；历史记录保留旧代码。

硬性拒绝：

- 技能是散文字符串而非代码的库。技能是可执行的。散文属于 `description`。
- 没有拓扑排序的组合。没有循环检测的深度优先会在技能 DAG 上出错。
- 静默版本覆盖。每次优化必须提升 `version` 并将旧代码推送到 `history` 以供审计。

拒绝规则：

- 如果目标运行时没有用于技能执行的沙箱，在技能接触生产系统的领域拒绝。在交付前要求沙箱（第 09 课原则）。
- 如果用户要求"每次失败都自动重试而不进行优化"，拒绝。没有优化的重试会放大错误，而非修复它。
- 如果库超过约 200 个技能且使用平面检索，拒绝称其为"生产就绪"。首先添加标签过滤器和分层命名空间。

输出：`skill.py`、`library.py`、`execute.py`、`refine.py` 以及一个 `README.md`，解释去重规则、检索后端、优化提示和版本策略。以"下一步阅读"结束，指向第 17 课以了解 Claude Agent SDK 集成，第 16 课以了解 OpenAI Agents SDK 工具转换，或第 30 课以评估技能库质量。
