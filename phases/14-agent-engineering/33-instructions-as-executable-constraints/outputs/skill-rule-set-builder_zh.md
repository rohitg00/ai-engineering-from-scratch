---
name: rule-set-builder
description: 采访项目所有者，将他们的现有散文指令分类为五个操作类别，并发出版本化的 agent-rules.md 加上 Python 检查器存根。
version: 1.0.0
phase: 14
lesson: 33
tags: [rules, instructions, constraints, checker, workbench]
---

给定仓库和任何现有散文指令（`AGENTS.md`、`CONTRIBUTING.md`、onboarding docs），生成工作台可以执行的五个类别规则集。

五个类别：

1. `startup` —— 工作开始前必须为真的事情。
2. `forbidden` —— 绝不能发生的事情。
3. `definition_of_done` —— 证明任务完成的事情。
4. `uncertainty` —— 代理不确定时做的事情。
5. `approval` —— 需要人类签署的事情。

生成：

1. `docs/agent-rules.md`，每个规则一个 `##` 标题。每个规则携带 `category`、`check` 和一行描述。
2. `tools/rule_checker.py`，带有 `RuleChecker` 类，暴露每个 `check` 的一个方法。每个方法接受 `TurnTrace` dataclass 并返回 `bool`。
3. `tools/rule_report.py` 运行器，加载规则，在跟踪上运行检查器，发出 `rule_report.json`。
4. 迁移说明文件：哪些散文行变成了哪个规则，哪些作为愿望被删除，为什么。

硬性拒绝：

- 没有 `check` 字段的规则。仅愿望的规则属于 onboarding docs，不属于工作台规则集。
- 单个"be careful"规则。指定类别和检查，或删除它。
- 需要 LLM 调用的检查。规则检查必须是确定性和便宜的，以便它们可以每轮运行。
- 超过 200 行的规则文件。按类别拆分为 `agent-rules.{startup,forbidden,done,uncertainty,approval}.md` 并从父索引路由。

拒绝规则：

- 如果代理产品无法提供 `TurnTrace`（没有仪器），拒绝连接检查器，直到至少记录 `read_state_file`、`edited_files` 和 `tests_exit_code`。
- 如果现有指令大多是愿望性的（>50%），在发出规则之前提出该发现。规则集看起来会很薄；那是正确的。
- 如果规则因为单个过去事件而添加，附加事件 id 以便未来审查可以决定它是否仍然需要。

输出结构：

```
<repo>/
├── docs/
│   └── agent-rules.md
├── tools/
│   ├── rule_checker.py
│   └── rule_report.py
└── docs/migration-notes.md
```

以"what to read next"结束，指向：

- Lesson 36 用于扩展 forbidden 类别的每任务范围契约。
- Lesson 38 用于消耗规则报告的验证门。
- Lesson 39 用于评分规则合规性的审查代理。
