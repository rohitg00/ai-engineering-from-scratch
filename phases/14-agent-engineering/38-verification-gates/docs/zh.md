# 验证门

> Agent 不能自己将工作标记为完成。验证门读取范围契约、反馈日志、规则报告和差异，并回答一个简单问题：这个任务真的完成了吗？如果门说否，无论聊天说什么，任务都未完成。

**类型：** 构建
**语言：** Python（标准库）
**先决条件：** 阶段 14 · 33（规则）、阶段 14 · 36（范围）、阶段 14 · 37（反馈）
**时间：** ~55 分钟

## 学习目标

- 将验证门定义为工作台制品上的确定性函数。
- 将规则报告、范围报告、反馈记录和差异组合成单一裁决。
- 发布 `verification_report.json`，审查者 Agent 和 CI 都可以读取。
- 在任何阻止严重性失败时拒绝推进任务，无一例外。

## 问题

Agent 太容易宣布成功。三种失败形态占主导：

- "看起来不错。" 模型读取自己的差异并判定它是正确的。
- "测试通过。" 自信地说。没有测试实际运行的记录。
- "验收达标。" 验收标准解释得足够宽松以意味着"任何类似完成的东西。"

工作台修复是一个单一的验证门，读取 Agent 已经产生的制品并做出调用。门是确定性的。门在版本控制中。门接入 CI。Agent 无法贿赂它。

## 概念

```mermaid
flowchart TD
  Diff[差异] --> Gate[verify_agent.py]
  Scope[scope_report.json] --> Gate
  Rules[rule_report.json] --> Gate
  Feedback[feedback_record.jsonl] --> Gate
  Gate --> Verdict[verification_report.json]
  Verdict --> Pass{通过?}
  Pass -- 是 --> Review[审查者 Agent]
  Pass -- 否 --> Refuse[拒绝完成 + 呈现给人类]
```

### 门检查的内容

| 检查 | 来源制品 | 严重性 |
|-------|------------|----------|
| 所有验收命令已运行 | `feedback_record.jsonl` | 阻止 |
| 所有验收命令退出为零 | `feedback_record.jsonl` | 阻止 |
| 范围检查无禁止写入 | `scope_report.json` | 阻止 |
| 范围检查无超范围写入 | `scope_report.json` | 阻止或警告 |
| 所有阻止严重性规则通过 | `rule_report.json` | 阻止 |
| 反馈中无 `null` 退出代码 | `feedback_record.jsonl` | 阻止 |
| 接触的文件匹配 `scope.allowed_files` | 两者 | 警告 |

`warn` 发现注释裁决；`block` 发现阻止 `passed: true`。

### 确定性，非概率性

门必须每次为相同制品集产生相同裁决。无 LLM 裁判。LLM 裁判属于审查者侧（阶段 14 · 39），其目标是定性评估，而非状态。

### 一个报告，一个路径

门在每个任务结清时发布一个 `verification_report.json`，写在 `outputs/verification/<task_id>.json` 下。CI 消费相同路径。具有不同路径的多个门分叉真相来源。

### 无一例外拒绝

阻止严重性发现不能被 Agent 覆盖。它们只能被人类覆盖，带有记录的 `override_reason` 和 `overridden_by` 用户 ID。覆盖是签名变更，而非 Agent 决策。

## 构建

`code/main.py` 实现：

- 每个输入制品的加载器，全部本地存根化，以便课程是自包含的。
- `verify(task_id, artifacts) -> VerdictReport` 纯函数。
- 显示每个检查结果和最终通过/失败的打印机。
- 具有三个任务场景的演示：干净通过、范围蠕变、缺失验收。

运行：

```
python3 code/main.py
```

输出：三个裁决报告，每个保存在脚本旁边。

## 生产模式

四种模式将门从"另一个 lint 作业"提升到"决定性边缘。"

**深度防御，非单一门。** 预提交 hook → CI 状态检查 → 工具前授权 hook → 合并前门。每层都是确定性的，以便一层的失败被下一层捕获。microservices.io 的 2026 年 3 月 playbook 是明确的：预提交 hook 是不可绕过的，因为与模型侧技能不同，它不依赖于 Agent 遵循指令。验证门位于 CI / 合并前层。

**确定性检查防御，模型裁判仅用于细微差别。** Anthropic 的 2026 年混合规范配对：可验证奖励（单元测试、模式检查、退出代码）回答"代码是否解决了问题？" — LLM 评分标准回答"代码是否可读、安全、符合风格？" 门运行第一类；审查者（阶段 14 · 39）运行第二类。混合它们会折叠信号。

**签名覆盖日志，而非 Slack 线程。** 每次覆盖在 `outputs/verification/overrides.jsonl` 中发出一行，带有：时间戳、发现代码、原因、签署用户、当前 HEAD 提交。运行时拒绝任何缺少签名的覆盖；审计线索是 git 跟踪的。这是覆盖策略和覆盖剧场之间的界限。

**作为一等检查的覆盖率底线。** `coverage_report.json` 馈送 `coverage_floor`（默认 80%）检查。如果测量的覆盖率降至底线以下或低于前一次合并的底线超过 1 个百分点，门失败。没有此检查，Agent 悄悄删除失败的测试，验证报告保持绿色。

`--strict` 模式将警告提升为阻止。对于发布分支、阻止发布的 PR 或事件后分类，`--strict` 使每个警告成为硬性失败。标志按分支选择加入；不是全局默认，因为对所有事情严格会侵蚀日常流程。

## 使用

生产模式：

- **CI 步骤。** `verify_agent` 作业针对 Agent 的最终制品运行门。没有 `passed: true` 拒绝合并保护。
- **交接前 hook。** Agent 运行时在生成交接文档之前调用门。无绿色裁决，无交接。
- **手动分类。** 当 Agent 声称成功且人类怀疑它时，操作员读取报告。

门是工作台流程中的决定性边缘。所有其他层面都在它的上游。

## 部署

`outputs/skill-verification-gate.md` 将门接入特定项目：哪些验收命令馈送它，哪些规则是阻止严重性，哪些超范围写入被容忍，覆盖审计日志如何存储。

## 练习

1. 添加 `coverage_floor` 检查：测试命令必须产生至少 80% 的覆盖率报告。决定哪个制品携带底线。
2. 支持 `--strict` 模式，将每个 `warn` 提升为 `block`。记录严格模式是正确默认的情况。
3. 使门除了 JSON 外还生成 Markdown 摘要。辩护哪些字段属于摘要。
4. 添加 `time_since_last_human_touch` 检查：在人类键击后 60 秒内编辑的任何文件免于超范围标记。
5. 对你产品的真实 Agent 差异运行门。多少发现是真实的，多少是噪音？门需要成长在哪里？

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|----------|----------|
| Verification gate（验证门） | "阻止事物的检查" | 在工作台制品上的确定性函数，产生通过/失败裁决 |
| Block severity（阻止严重性） | "硬性失败" | 阻止 `passed: true` 并需要签名覆盖的发现 |
| Override log（覆盖日志） | "我们让它通过的原因" | 带原因和用户 ID 的签名条目，由审查审计 |
| Acceptance command（验收命令） | "证据" | 其零退出是 `done` 含义的 shell 命令 |
| One report path（一个报告路径） | "真相来源" | `outputs/verification/<task_id>.json`，由 CI 和人类共同消费 |

## 延伸阅读

- [Anthropic, 长运行应用程序开发的 Harness 设计](https://www.anthropic.com/engineering/harness-design-long-running-apps)
- [OpenAI Agents SDK 护栏](https://platform.openai.com/docs/guides/agents-sdk/guardrails)
- [microservices.io, GenAI 开发平台：护栏](https://microservices.io/post/architecture/2026/03/09/genai-development-platform-part-1-development-guardrails.html) — 预提交和 CI 之间的深度防御
- [ICMD, 2026 年 Agentic AI Ops Playbook](https://icmd.app/article/the-2026-playbook-for-agentic-ai-ops-guardrails-costs-and-reliability-at-scale-1776661990431) — 审批门阶梯（草案 → 批准 → 阈值下自动）
- [类型检查合规性：确定性护栏 (arXiv 2604.01483)](https://arxiv.org/pdf/2604.01483) — Lean 4 作为确定性门控的上限
- [logi-cmd/agent-guardrails — 合并门规范](https://github.com/logi-cmd/agent-guardrails) — 范围 + 突变测试门
- [Guardrails AI x MLflow](https://guardrailsai.com/blog/guardrails-mlflow) — 作为 CI 评分器的确定性验证器
- [Akira, Agentic 系统的实时护栏](https://www.akira.ai/blog/real-time-guardrails-agentic-systems) — 工具前/后门
- 阶段 14 · 27 — 提示注入防御（门的对抗对）
- 阶段 14 · 36 — 此门强制执行的范围契约
- 阶段 14 · 37 — 此门评分的反馈日志
- 阶段 14 · 39 — 门移交给的审查者 Agent
