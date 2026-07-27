# 任务 - 智能体指令作为可执行约束

## 目标
将文本指令转化为跨五个类别的机器可检查规则，并生成一份可供审查者评分的规则报告。

## 输入
- `docs/agent-rules.md`——每个标题对应一条规则，每条规则包含标识符、类别、描述和 `check` 字段
- 一次演示智能体运行，故意违反两条规则

## 交付物
- 解析器——将 `agent-rules.md` 加载为数据类
- `rule_checker.py` 风格的函数——每个被引用的 `check` 对应一个函数
- `rule_report.json`——每条规则的通过/失败状态及聚合严重等级

## 验收标准
- `python3 code/main.py` 退出码为零
- 输出打印解析后的规则集、运行轨迹以及每条规则的通过/失败
- `rule_report.json` 捕获到两次故意违反

## 不包含范围
- 将检查器接入 CI。课程在书面报告处结束。
- 框架护栏（OpenAI SDK、LangGraph 中断）。规则集是这些护栏所实现的人类可读合约。

## 参考资料
- `docs/en.md` - 完整课程
- `code/main.py` - 参考实现
- `outputs/skill-rule-set-builder.md` - 提取的技能
