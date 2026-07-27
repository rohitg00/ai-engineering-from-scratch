---
name: rule-set-builder
description: 采访项目所有者，将其现有的散文指令分类为五个操作类别，并输出带版本号的 agent-rules.md 加上 Python 检查器存根。
version: 1.0.0
phase: 14
lesson: 33
tags: [rules, instructions, constraints, checker, workbench]
---

给定一个仓库和任何现有的散文指令（`AGENTS.md`、`CONTRIBUTING.md`、入职文档），生成工作台可以执行的五类别规则集。

五个类别：

1. `startup`——工作开始前必须为真的条件。
2. `forbidden`——绝不能发生的事情。
3. `definition_of_done`——证明任务完成的条件。
4. `uncertainty`——智能体不确定时的行为。
5. `approval`——需要人类签核的事项。

产出：

1. `docs/agent-rules.md`，每条规则一个 `##` 标题。每条规则携带 `category`、`check` 和一行描述。
2. `tools/rule_checker.py`，包含一个 `RuleChecker` 类，暴露每个 `check` 一个方法。每个方法接受 `TurnTrace` 数据类并返回 `bool`。
3. `tools/rule_report.py` 运行器，加载规则，在追踪上运行检查器，输出 `rule_report.json`。
4. 迁移说明文件：哪些散文行变成了哪条规则，哪些因过于理想化而被丢弃，以及原因。

硬性拒绝：

- 没有 `check` 字段的规则。仅理想化的规则属于入职文档，不属于工作台规则集。
- 单一的"小心"规则。指定类别和检查，否则移除。
- 需要 LLM 调用的检查。规则检查必须是确定性的且廉价的，以便每轮都能运行。
- 超过 200 行的规则文件。按类别拆分为 `agent-rules.{startup,forbidden,done,uncertainty,approval}.md` 并从父索引路由。

拒绝规则：

- 如果智能体产品无法提供 `TurnTrace`（没有仪表化），拒绝连接检查器，直到至少记录了 `read_state_file`、`edited_files` 和 `tests_exit_code`。
- 如果现有指令主要是理想化的（>50%），在输出规则之前提出来该发现。规则集会显得单薄；这是正确的。
- 如果因为单一过去事件添加了一条规则，附加事件 ID，以便未来审查可以决定是否仍然需要它。

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

以"下一步阅读"结尾，指向：

- 第 36 课以了解扩展禁止类别的每任务范围契约。
- 第 38 课以了解消费规则报告的验证门控。
- 第 39 课以了解对规则合规性评分的审查智能体。
