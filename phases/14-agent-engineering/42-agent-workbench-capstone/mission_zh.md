# 任务 - 顶点项目：交付可复用的智能体工作台包

## 目标
将之前十一节课的内容组装到一个带版本的 `outputs/agent-workbench-pack/` 目录中，附带一个安装程序，能够幂等地将其部署到任何目标仓库中。

## 输入
- 第 32 课到第 40 课的 schema、脚本和文档
- 包结构：`AGENTS.md`、`docs/`、`schemas/`、`scripts/`、`bin/`、`README.md`、`VERSION`

## 交付物
- `outputs/agent-workbench-pack/`——完整填充上述结构
- `bin/install.sh`（或 `bin/install.py`）——拒绝在没有 `--force` 的情况下覆盖
- `VERSION` 文件及 `README.md`——描述哪些包含在内、哪些排除在外

## 验收标准
- `python3 code/main.py` 退出码为零并打印包目录树
- 重新运行组装器是幂等的
- 将 `bin/install.sh` 部署到全新的目标仓库后，得到一个可用的工作台：状态、任务板、规则、范围、初始化、运行器、门、审查者、交接全部就位

## 不包含范围
- 每个项目的任务内容。任务属于目标仓库的任务板，而非此包。
- 供应商 SDK 调用。该包在设计上无框架依赖。

## 参考资料
- `docs/en.md` - 完整课程
- `code/main.py` - 参考实现
- `outputs/skill-workbench-pack.md` - 提取的技能
