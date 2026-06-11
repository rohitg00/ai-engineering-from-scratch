# 工具使用与函数调用

> Toolformer（Schick 等，2023）开启了自监督工具标注。Berkeley Function Calling Leaderboard V4（Patil 等，2025）设定了 2026 年的标准：40% agentic，30% 多轮，10% 实时，10% 非实时，10% 幻觉。单轮已解决。记忆、动态决策和长程工具链尚未解决。

**类型：** 构建
**语言：** Python（标准库）
**前置条件：** 第 14 阶段 · 01（Agent Loop），第 13 阶段 · 01（Function Calling Deep Dive）
**时间：** ~60 分钟

## 学习目标

- 解释 Toolformer 的自监督训练信号：仅当执行结果降低下一个 token 的损失时才保留工具标注。
- 说出 BFCL V4 的五个评估类别及其各自衡量什么。
- 实现一个标准库工具注册表，包含模式验证、参数强制转换和执行沙箱。
- 诊断三个 2026 年的开放问题：长程工具链、动态决策和记忆。

## 问题

早期工具使用问的是：模型能否预测正确的函数调用？现代工具使用问的是：模型能否在 40 步内链式调用工具，带记忆，带部分可观察性，从工具故障中恢复，且不幻觉不存在的工具？

Toolformer 建立了基线：模型可以通过自监督学习何时调用工具。BFCL V4 定义了 2026 年的评估目标。两者之间的差距就是生产 agent 所处的空间。

## 概念

### Toolformer（Schick 等，NeurIPS 2023）

想法：让模型在自己的预训练语料库中标注候选 API 调用。对于每个候选，执行它。仅当包含工具结果能降低下一个 token 的损失时才保留标注。在过滤后的语料库上微调。

涵盖的工具：计算器、QA 系统、搜索引擎、翻译器、日历。自监督信号纯粹关于工具是否有助于预测文本——无需人工标注。

规模结果：工具使用在规模达到后出现。较小的模型因工具标注而受损；较大的模型受益。这就是为什么 2026 年前沿模型内置了强大的工具使用能力，而大多数 7B 模型需要显式的工具使用微调才能可靠。

### Berkeley Function Calling Leaderboard V4（Patil 等，ICML 2025）

BFCL 是 2026 年的事实评估标准。V4 组成：

- **Agentic（40%）** — 完整 agent 轨迹：记忆、多轮、动态决策。
- **Multi-Turn（30%）** — 带工具链的交互式对话。
- **Live（10%）** — 用户提交的实时提示（更难分布）。
- **Non-Live（10%）** — 合成测试用例。
- **Hallucination（10%）** — 检测何时不应调用工具。

V3 引入了基于状态的评估：在工具序列之后，检查 API 的实际状态（例如"文件是否已创建？"）而不是匹配工具调用的 AST。V4 增加了网页搜索、记忆和格式敏感类别。

2026 年的关键发现：单轮函数调用接近解决。失败集中在记忆（跨轮次携带上下文）、动态决策（基于先前结果选择工具）、长程链（20+ 步后漂移）和幻觉检测（拒绝在没有任何工具适合时调用）。

### 工具模式

每个提供商都有自己的模式。细节不同但形状相同：

```
name: string
description: string（它做什么，何时使用）
input_schema: JSON Schema（properties, required, types, enums）
```

Anthropic 直接使用 `input_schema`。OpenAI 使用 `function.parameters`。两者都接受 JSON Schema。描述是关键的——模型通过它们来选择正确的工具。糟糕的工具描述是选错工具的第一大根本原因。

### 参数验证

不要相信任何工具调用。验证：

1. **类型强制转换。** 模型可能在模式要求 int 的地方返回字符串 "5"。如果无歧义则强制转换；如果有歧义则拒绝。
2. **枚举验证。** 如果模式说 `status in {"open", "closed"}` 而模型发出 `"in_progress"`，则返回描述性错误。
3. **必填字段。** 缺少必填字段 -> 立即向模型返回错误观察，而不是崩溃。
4. **格式验证。** 日期、邮箱、URL —— 用具体解析器验证，不要用正则。

每次验证失败都应返回结构化观察，以便模型可以用正确的形状重试。

### 并行工具调用

现代提供商支持在一个 assistant 轮次中并行调用工具。循环：

1. 模型发出 3 个带有不同 `tool_use_id` 的工具调用。
2. 运行时执行它们（如果独立则并行）。
3. 每个结果通过 `tool_use_id` 关联作为 `tool_result` 块返回。

工程规则：将关联 ID 视为关键。交换它们会导致错误工具到错误结果的路由。

### 沙箱

工具执行是沙箱边界。详见第 09 课。简而言之：每个工具应指定读/写表面、网络访问、超时、内存上限。通用的 `run_shell(cmd)` 是危险信号；具体的 `git_status()` 更安全。

## 构建

`code/main.py` 实现了一个生产级形状的工具注册表：

- JSON Schema 子集验证器（仅标准库）。
- 工具注册，包含描述、输入模式、超时和执行器。
- 参数强制转换和枚举验证。
- 带关联 ID 的并行工具调度。
- 错误观察作为结构化字符串。

运行：

```
python3 code/main.py
```

跟踪显示一个迷你 agent 在一个轮次中调用三个工具，其中一个故意格式错误的调用被拒绝，并返回模型可以处理的描述性错误。

## 使用

每个提供商都有自己的工具模式 —— Anthropic、OpenAI、Gemini、Bedrock。如果需要多提供商，使用翻译层（OpenAI Agents SDK、Vercel AI SDK、LangChain 工具适配器）。BFCL 是参考基准 —— 如果工具使用是产品的核心，在发布前针对你的 agent 运行它。

## 交付

`outputs/skill-tool-registry.md` 为给定任务域生成工具目录、模式和注册表。包含描述质量检查（每个工具的描述是否告诉模型何时使用它？）。

## 练习

1. 添加一个 "no-op" 工具，让模型可以显式拒绝使用任何其他工具。在类似 BFCL 的幻觉测试上测量。
2. 实现 int-as-string 和 float-as-string 的参数强制转换。强制转换从何处开始掩盖真正的 bug？
3. 为每个工具添加超时和熔断器（3 次连续失败后 60 秒内拒绝该工具）。这会如何改变模型的恢复方式？
4. 阅读 BFCL V4 描述。选择一个类别（例如"multi-turn"），让你的 agent 运行 10 个示例提示。报告通过率。
5. 将标准库验证器移植到 Pydantic 或 Zod。Pydantic/Zod 捕获了什么而玩具版本遗漏了？

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------|---------|
| Function calling | "工具使用" | 带验证模式的结构化输出工具调用 |
| Toolformer | "自监督工具标注" | Schick 2023 —— 仅保留能降低下一个 token 损失的工具调用 |
| BFCL | "Berkeley Function Calling Leaderboard" | 2026 基准：40% agentic，30% 多轮，10% 实时，10% 非实时，10% 幻觉 |
| Tool schema | "模型的函数签名" | 名称、描述、参数的 JSON Schema |
| tool_use_id | "关联 ID" | 将工具调用与其结果关联；并行调度必需 |
| Hallucination detection | "知道何时不调用" | V4 类别：当没有任何工具适合时拒绝调用 |
| Argument coercion | "字符串转整数修复" | 可预测的模式不匹配窄修复；有歧义则拒绝 |
| Sandboxing | "工具执行边界" | 每个工具的读/写表面、网络、超时、内存上限 |

## 延伸阅读

- [Schick 等，Toolformer (arXiv:2302.04761)](https://arxiv.org/abs/2302.04761) —— 自监督工具标注
- [Berkeley Function Calling Leaderboard (V4)](https://gorilla.cs.berkeley.edu/leaderboard.html) —— 2026 评估基准
- [Anthropic, Tool use documentation](https://platform.claude.com/docs/en/agent-sdk/overview) —— Claude Agent SDK 中的生产工具模式
- [OpenAI Agents SDK docs](https://openai.github.io/openai-agents-python/) —— 函数工具类型和 Guardrails