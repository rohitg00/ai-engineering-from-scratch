# 智能体工作台包

任何想要可靠智能体工作的仓库的即插即用工作台。

## 你会得到什么

- `AGENTS.md` 简要路由器，指向包中其余部分。
- `docs/` 规则、可靠性策略、交接协议、审查标准。
- `schemas/` 用于状态、面板和范围契约的 JSON Schema。
- `scripts/` 初始化、反馈运行器、验证门控、交接生成器。
- `bin/install.sh` 幂等安装器。

## 快速开始

```
bin/install.sh
$EDITOR task_board.json
python3 scripts/init_agent.py
```

## 版本管理

`VERSION` 文件是契约。主要版本升级需要状态迁移。
