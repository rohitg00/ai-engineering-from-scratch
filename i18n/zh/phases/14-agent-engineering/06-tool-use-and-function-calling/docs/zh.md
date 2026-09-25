# 工具使用与函数调用

> Toolformer(Schick 等,2023)开启了自监督工具标注。Berkeley Function Calling Leaderboard V4(Patil 等,2025)设定了 2026 年的基准:40% agentic、30% 多轮、10% live、10% non-live、10% 幻觉。单轮调用已基本解决。记忆、动态决策和长程工具链尚未解决。

**Type:** Build
**Languages:** Python (标准库)
**Prerequisites:** Phase 14 · 01(Agent Loop)、Phase 13 · 01(Function Calling Deep Dive)
**Time:** 约 60 分钟

## 学习目标

- 解释 Toolformer 的自监督训练信号:仅当工具标注的执行能降低下一 token 的损失时才保留该标注。
- 说出 BFCL V4 的五个评测类别及各自衡量的内容。
- 实现一个基于标准库的工具注册表,包含 schema 验证、参数强制转换和执行沙箱。
- 诊断 2026 年的三个开放问题:长程工具链、动态决策和记忆。

## 问题所在

早期的工具使用问的是:模型能否预测出正确的函数调用?现代的工具使用问的是:模型能否在 40 步中串联工具,带上记忆,面对部分可观测性,从工具故障中恢复,并且不会幻觉出不存在的工具?

Toolformer 确立了基线:模型可以通过自监督学会何时调用工具。BFCL V4 定义了 2026 年的评测目标。两者之间的差距正是生产级 agent 的生存空间。

## 核心概念

### Toolformer(Schick 等,NeurIPS 2023)

思路:让模型在自己的预训练语料中标注候选 API 调用。对每个候选,执行它。仅当包含工具结果能降低下一 token 的损失时,才保留该标注。然后在过滤后的语料上做微调。

涵盖的工具:计算器、问答系统、搜索引擎、翻译器、日历。自监督信号只关心工具是否有助于预测文本——不需要人工标注。

规模结论:工具使用能力随规模涌现。小模型会因工具标注受损;大模型则获益。这就是为什么 2026 年的前沿模型内置了强大的工具使用能力,而多数 7B 模型需要显式的工具使用微调才能可靠。

### Berkeley Function Calling Leaderboard V4(Patil 等,ICML 2025)

BFCL 是 2026 年事实上的评测标准。V4 的构成:

- **Agentic(40%)** — 完整的 agent 轨迹:记忆、多轮、动态决策。
- **多轮(30%)** — 带工具链的交互式对话。
- **Live(10%)** — 用户提交的真实提示词(分布更难)。
- **Non-Live(10%)** — 合成的测试用例。
- **幻觉(10%)** — 检测何时不应调用任何工具。

V3 引入了基于状态的评测:在一段工具调用序列之后,检查 API 的实际状态(例如"文件是否已创建?"),而不是匹配工具调用的 AST。V4 新增了 web search、记忆和格式敏感度类别。

2026 年的关键发现:单轮函数调用已接近解决。失败集中在:记忆(跨轮次携带上下文)、动态决策(依据先前结果选择工具)、长程链(20 步以上后出现漂移)和幻觉检测(在没有任何工具适配时拒绝调用)。

### 工具 schema

每家 provider 都有自己的 schema。细节各异,但形状相同:

```
name: string
description: string (what it does, when to use it)
input_schema: JSON Schema (properties, required, types, enums)
```

Anthropic 直接使用 `input_schema`。OpenAI 使用 `function.parameters`。两者都接受 JSON Schema。描述是承重结构——模型靠阅读描述来选择正确的工具。糟糕的工具描述是"选错工具"类失败的头号根因。

### 参数验证

不要信任任何工具调用。要验证:

1. **类型强制转换。** 模型可能返回字符串 "5",而 schema 要求 int。无歧义时转换;有歧义时拒绝。
2. **枚举验证。** 如果 schema 规定 `status in {"open", "closed"}` 而模型输出 `"in_progress"`,则附带描述性错误拒绝。
3. **必填字段。** 缺少必填字段 -> 立即向模型返回错误观察结果,而不是崩溃。
4. **格式验证。** 日期、邮箱、URL——用具体的解析器验证,不要用正则。

每次验证失败都应返回结构化的观察结果,让模型能以正确的形状重试。

### 并行工具调用

现代 provider 支持在一个 assistant 轮次中进行并行工具调用。流程:

1. 模型发出 3 个带不同 `tool_use_id` 的工具调用。
2. 运行时执行它们(相互独立时并行执行)。
3. 每个结果以 `tool_result` 块的形式返回,并通过 `tool_use_id` 关联。

工程准则:把关联 ID 当作承重结构。交换它们就会导致"工具 A 的结果路由给工具 B"。

### 沙箱

工具执行是沙箱边界。细节见第 09 课。简要版:每个工具都应声明读写范围、网络访问、超时和内存上限。通用的 `run_shell(cmd)` 是危险信号;具体的 `git_status()` 更安全。

```figure
tool-routing
```

## 动手实现

`code/main.py` 实现了一个生产形态的工具注册表:

- JSON Schema 子集验证器(仅用标准库)。
- 工具注册,包含描述、输入 schema、超时和执行器。
- 参数强制转换和枚举验证。
- 带关联 ID 的并行工具分发。
- 以结构化字符串返回的错误观察结果。

运行:

```
python3 code/main.py
```

轨迹显示一个迷你 agent 在一个轮次内调用三个工具,其中包含一个故意格式错误的调用,它会被拒绝并返回模型可以据此行动的描述性错误。

## 应用

每家 provider 都有自己的工具 schema——Anthropic、OpenAI、Gemini、Bedrock。如果需要多 provider 支持,请使用转换层(OpenAI Agents SDK、Vercel AI SDK、LangChain tool adapter)。BFCL 是参考基准——如果工具使用是产品的核心,上线前请针对你的 agent 跑一遍。

## 发布

`outputs/skill-tool-registry.md` 为给定任务领域生成工具目录、schema 和注册表。包含描述质量检查(每个工具的描述是否告诉了模型何时使用它?)。

## 练习

1. 添加一个 "no-op" 工具,让模型可以显式拒绝使用任何其他工具。在一个类 BFCL 的幻觉测试上测量效果。
2. 实现 int-as-string 和 float-as-string 的参数强制转换。从哪里开始,强制转换会开始掩盖真正的 bug?
3. 为每个工具添加超时和熔断器(连续 3 次失败后 60 秒内拒绝该工具)。这会改变模型恢复的方式吗?
4. 阅读 BFCL V4 的说明。选一个类别(例如 "多轮"),用你的 agent 跑 10 个示例提示词。报告通过率。
5. 把标准库验证器移植到 Pydantic 或 Zod。Pydantic/Zod 捕捉到了哪些玩具实现遗漏的问题?

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|----------------|------------------------|
| 函数调用 | "工具使用" | 带经验证 schema 的结构化输出工具调用 |
| Toolformer | "自监督工具标注" | Schick 2023——保留其结果能降低下一 token 损失的工具调用 |
| BFCL | "Berkeley Function Calling Leaderboard" | 2026 年基准:40% agentic、30% 多轮、10% live、10% non-live、10% 幻觉 |
| 工具 schema | "面向模型的函数签名" | name、description、参数的 JSON Schema |
| tool_use_id | "关联 ID" | 将工具调用与其结果关联;并行分发时必不可少 |
| 幻觉检测 | "知道何时不调用" | V4 类别:在没有任何工具适配时拒绝调用 |
| 参数强制转换 | "字符串转整数的修复" | 针对可预测 schema 不匹配的窄幅修复;有歧义时拒绝 |
| 沙箱 | "工具执行边界" | 每个工具的读写范围、网络、超时、内存上限 |

## 延伸阅读

- [Schick 等,Toolformer (arXiv:2302.04761)](https://arxiv.org/abs/2302.04761) — 自监督工具标注
- [Berkeley Function Calling Leaderboard (V4)](https://gorilla.cs.berkeley.edu/leaderboard.html) — 2026 年评测基准
- [Anthropic,工具使用文档](https://platform.claude.com/docs/en/agent-sdk/overview) — Claude Agent SDK 中的生产级工具 schema
- [OpenAI Agents SDK 文档](https://openai.github.io/openai-agents-python/) — function tool 类型和 Guardrails