# 任务 - 范围合约与任务边界

## 目标
编写每个任务的 `scope_contract.json` 以及一个全局感知的检查器，将智能体的差异（diff）与合约进行比较，并标记任何被禁止或超出范围的写入。

## 输入
- 一个任务描述，包含允许的 glob 模式、禁止的 glob 模式、验收命令、回滚说明、所需审批
- 两次演示运行：一次在范围内，一次越界

## 交付物
- `scope_contract.json` schema 验证器（JSON Schema 子集，glob 数组）
- 差异解析器——从接触过的文件和运行的命令生成 `RunSummary`
- `scope_check(contract, run) -> (violations, in_scope, off_scope)`
- `scope_report.json`——保存在脚本旁边

## 验收标准
- `python3 code/main.py` 退出码为零
- 范围内运行报告零违规
- 越界运行报告确切的越界文件及每个文件的原因

## 不包含范围
- 时间预算、网络出口白名单。本课交付文件 glob；练习提示在此基础上扩展。
- 接入运行时中断。本课在报告处结束。

## 参考资料
- `docs/en.md` - 完整课程
- `code/main.py` - 参考实现
- `outputs/skill-scope-contract.md` - 提取的技能
