---
name: workbench-pack
description: 生成一个针对项目调优的即插即用智能体工作台包——根据团队历史打磨的规则、匹配仓库的范围 glob、扩展了一个领域特定条目的标准维度。
version: 1.0.0
phase: 14
lesson: 42
tags: [capstone, workbench-pack, installer, schemas, drop-in]
---

给定一个仓库、团队的事件历史和在其中运行的智能体产品，输出一个调优的 agent-workbench-pack 和一个安装器。

产出：

1. `agent-workbench-pack/` 目录，匹配规范布局：AGENTS.md、docs/、schemas/、scripts/、bin/、README.md、VERSION。
2. 一个 `bin/install.sh`，拒绝在没有 `--force` 的情况下覆盖现有包，并将 `.workbench-version` 写入目标仓库。
3. 项目调优版本的 `agent-rules.md`（每个类别至少有一条源自团队最近六次事件的规则）、`reviewer-rubric.md`（带有第六个领域维度）和 `scope_contract.schema.json`（带有项目特定的 glob）。
4. 一个 `lint_pack.py` 脚本，在脚本和模式之间或 VERSION 和模式的 `schema_version` 之间出现漂移时失败。
5. 可选的 CI 集成，在演示分支上安装包并针对已知良好任务运行验证门控。

硬性拒绝：

- 包含项目特定任务的包。任务存在于目标仓库的面板上。
- 绑定到单个供应商 SDK 的包。仅限框架无关；SDK 连接是目标仓库的工作。
- 修改状态文件的安装器。安装器是仅表面的幂等操作；状态属于智能体和人类。
- 没有对应检查函数的规则。理想化的规则属于入职文档，不属于包。

拒绝规则：

- 如果事件历史为空，拒绝交付调优的 `agent-rules.md`。使用规范默认值并提出差距。
- 如果目标仓库的 CI 与安装不兼容（没有 `.github/workflows/`，没有等效项），拒绝可选的 CI 步骤并记录手动路径。
- 如果团队使用包的私有分支，拒绝编写公共安装器。私有安装器携带私有不变量。

输出结构：

```
agent-workbench-pack/
├── AGENTS.md
├── docs/
├── schemas/
├── scripts/
├── bin/install.sh
├── lint_pack.py
├── VERSION
└── README.md
```

以"下一步阅读"结尾，指向：

- 第 41 课以了解此包改进的之前/之后基准。
- 第 30 课（评估驱动的智能体开发）以了解消费包裁决的评估循环。
- [SkillKit](https://github.com/rohitg00/skillkit) 以了解跨 32 个 AI 智能体分发包。
