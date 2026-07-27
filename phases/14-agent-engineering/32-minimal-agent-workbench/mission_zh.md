# 任务 - 最小智能体工作台

## 目标
将最小的三文件工作台（路由器、状态、任务板）部署到一个全新的 `workdir/` 目录中，并证明单个智能体回合能够读取状态、获取任务、写入范围并持久化更新后的状态。

## 输入
- 课程代码旁边的一个空 `workdir/` 目录
- 了解三个文件：`AGENTS.md`、`agent_state.json`、`task_board.json`

## 交付物
- `code/main.py`——创建三个文件并运行一个回合
- `workdir/AGENTS.md`——指向状态、板和验证命令的简短路由器
- `workdir/agent_state.json`——包含当前活跃任务 ID、接触过的文件、下一步行动
- `workdir/task_board.json`——包含一个小型积压任务列表及状态

## 验收标准
- `python3 code/main.py` 在第一次和第二次运行时均退出码为零
- 第二次运行时从上一次结束的位置继续，而非从头开始
- 脚本打印出的差异显示该回合接触过的一个文件

## 不包含范围
- 范围合约、验证门、审查智能体。这些将在后续课程中逐步叠加。
- 庞大的 `AGENTS.md`。路由器故意保持简短。

## 参考资料
- `docs/en.md` - 完整课程
- `code/main.py` - 参考实现
- `outputs/skill-minimal-workbench.md` - 提取的技能
