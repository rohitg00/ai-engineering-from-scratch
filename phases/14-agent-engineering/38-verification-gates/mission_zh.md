# 任务 - 验证门

## 目标
实现 `verify(task_id, artifacts)`，作为一个纯确定性函数，处理范围报告、规则报告、反馈日志和差异（diff），每次任务关闭时生成一个 `verification_report.json`。

## 输入
- 用于 `scope_report.json`、`rule_report.json`、`feedback_record.jsonl` 和差异的存根加载器
- 检查表：验收已运行、验收退出码为零、范围干净、无 `null` 退出、所有阻塞级别规则通过

## 交付物
- 纯函数 `verify(task_id, artifacts) -> VerdictReport`
- 打印机——显示每个检查结果及最终的通过/失败
- 写入磁盘的三个演示场景：干净通过、范围蔓延、缺失验收

## 验收标准
- `python3 code/main.py` 退出码为零
- 干净通过场景报告 `passed: true`；其他两个场景报告 `passed: false`
- 每个场景在 `outputs/verification/` 下写入独立的 `verification_report.json`

## 不包含范围
- 大语言模型作为评判的逻辑。验证门保持确定性；定性判断属于第 39 课的审查者。
- 签名覆盖审计日志。练习提示以此方向扩展验证门。

## 参考资料
- `docs/en.md` - 完整课程
- `code/main.py` - 参考实现
- `outputs/skill-verification-gate.md` - 提取的技能
