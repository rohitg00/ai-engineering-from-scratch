# 任务 - 运行时反馈循环

## 目标
构建 `run_with_feedback`，包装 `subprocess.run`，捕获标准输出、标准错误、退出码和持续时间，确定性地截断输出，并追加一条 JSONL 记录供下一回合和验证门读取。

## 输入
- 三个演示命令用于测试运行器：一个成功、一个失败、一个缓慢
- 令牌预算：确定性的头部加尾部，附带 `...truncated N lines...` 标记

## 交付物
- `run_with_feedback(command, agent_note)`——写入 `feedback_record.jsonl`
- 加载器——将 JSONL 流式读取为 Python 列表
- 打印机——显示每个命令的最后一条记录

## 验收标准
- `python3 code/main.py` 退出码为零
- `feedback_record.jsonl` 跨多次运行累积每个命令的一条记录
- 带有 `exit_code: null` 的命令不能被循环标记为成功

## 不包含范围
- 遥测管道（OTel、Langfuse）。反馈供下一回合使用；遥测供操作者使用。
- 编辑脱敏和轮换策略。练习提示涵盖这些内容。

## 参考资料
- `docs/en.md` - 完整课程
- `code/main.py` - 参考实现
- `outputs/skill-feedback-runner.md` - 提取的技能
