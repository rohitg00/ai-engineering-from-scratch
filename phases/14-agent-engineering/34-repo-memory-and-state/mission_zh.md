# 任务 - 仓库内存与持久状态

## 目标
编写 `agent_state.json` 和 `task_board.json` 的 JSON Schema，构建一个能够加载、验证、修改并原子化写入的 `StateManager`，并证明跨两个回合的完整往返可用。

## 输入
- 第 32 课中的三文件工作台结构
- 仅使用标准库的验证器，覆盖 required、type、enum、pattern 和 items

## 交付物
- `agent_state.schema.json` 和 `task_board.schema.json`——位于代码旁边
- `StateManager.load`、`StateManager.update`、`StateManager.commit`——使用临时文件加重命名的写入方式
- 一次演示运行——跨两个回合修改状态并干净地重新加载

## 验收标准
- `python3 code/main.py` 退出码为零
- 错误的写入（缺少必填字段、错误枚举值）被拒绝，不会持久化
- 运行后的 `workdir/agent_state.json` 通过 schema 验证

## 不包含范围
- SQLite 或外部存储后端。本地文件即是本课内容。
- LangGraph 检查点、Letta 内存块。相同的思路，不同的存储方式；此处不包含。

## 参考资料
- `docs/en.md` - 完整课程
- `code/main.py` - 参考实现
- `outputs/skill-state-schema.md` - 提取的技能
