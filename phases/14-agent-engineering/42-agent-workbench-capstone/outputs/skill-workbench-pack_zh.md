---
name: workbench-pack
description: 生成项目调优的 drop-in 代理工作台包 —— 规则锐化到团队历史，范围 globs 匹配仓库，评分标准维度扩展一个领域特定条目。
version: 1.0.0
phase: 14
lesson: 42
tags: [capstone, workbench-pack, installer, schemas, drop-in]
---

给定仓库、团队事件历史和在其中运行的代理产品，发出调优的 agent-workbench-pack 和安装程序。

生成：

1. `agent-workbench-pack/` 目录，匹配规范布局：AGENTS.md、docs/、schemas/、scripts/、bin/、README.md、VERSION。
2. `bin/install.sh`，拒绝在没有 `--force` 的情况下覆盖现有包，并将 `.workbench-version` 写入目标仓库。
3. 项目调优版本的 `agent-rules.md`（每个类别至少一个规则，来自团队最近六个事件）、`reviewer-rubric.md`（带有第六个领域维度）和 `scope_contract.schema.json`（带有项目特定 globs）。
4. `lint_pack.py` 脚本，在脚本和模式之间或 VERSION 和模式的 `schema_version` 之间漂移时失败。
5. 可选 CI 集成，在 demo 分支上安装包并针对已知良好任务运行验证门。

硬性拒绝：

- 包含项目特定任务的包。任务位于目标仓库的板上。
- 绑定到单个供应商 SDK 的包。仅框架无关；SDK 连接是目标仓库的工作。
- 变异状态文件的安装程序。安装程序是幂等表面；状态属于代理和人类。
- 没有相应检查功能的规则。愿望规则属于 onboarding，不属于包。

拒绝规则：

- 如果事件历史为空，拒绝发布调优的 `agent-rules.md`。使用规范默认值并提出差距。
- 如果目标仓库的 CI 与安装不兼容（没有 `.github/workflows/`，没有等效），拒绝可选 CI 步骤并记录手动路径。
- 如果团队使用包的私有 fork，拒绝编写公共安装程序。私有安装程序携带私有不变量。

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

以"what to read next"结束，指向：

- Lesson 41 用于此包改进的 before/after 基准。
- Lesson 30 (Eval-Driven Agent Development) 用于消耗包裁决的评估循环。
- [SkillKit](https://github.com/rohitg00/skillkit) 用于跨 32 个 AI 代理分发包。
