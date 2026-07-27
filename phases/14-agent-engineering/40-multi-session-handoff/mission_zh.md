# 任务 - 多会话交接

## 目标
在会话结束时，从工作台产出物生成 `handoff.md` 和 `handoff.json`，使下一个会话在第一分钟内就高效运转。两种格式携带相同的七个字段；如不一致，以 JSON 为准。

## 输入
- 之前课程的 `agent_state.json`、`verification_report.json`、`review_report.json`、`feedback_record.jsonl`
- 七个字段：摘要（summary）、变更文件（changed_files）、运行的命令（commands_run）、失败尝试（failed_attempts）、未解决风险（open_risks）、下一步行动（next_action）、裁决指针（verdict_pointer）

## 交付物
- `WorkbenchSnapshot` 加载器——汇集四个产出物
- `generate_handoff(snapshot) -> (markdown, payload)`
- 反馈过滤器——选取最后 K 条记录加上所有非零退出的记录
- `handoff.md` 和 `handoff.json`——写入脚本旁边

## 验收标准
- `python3 code/main.py` 退出码为零
- 两个文件均包含全部七个字段且 `next_action` 非空
- 使用相同输入重新运行脚本产生相同的数据包

## 不包含范围
- 压缩策略（Codex compact 端点、Claude Code 五阶段）。交接结束一个会话；压缩扩展一个会话。
- PR 模板。Markdown 可复用为 PR 正文，但本课在文件输出处结束。

## 参考资料
- `docs/en.md` - 完整课程
- `code/main.py` - 参考实现
- `outputs/skill-handoff-generator.md` - 提取的技能
