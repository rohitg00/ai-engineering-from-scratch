# 工具使用与函数调用（Tool Use and Function Calling）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> Toolformer（Schick et al., 2023）开启了自监督工具标注。Berkeley Function Calling Leaderboard V4（Patil et al., 2025）定下了 2026 年的标杆：40% agentic、30% multi-turn、10% live、10% non-live、10% hallucination。单轮已经被解决，但记忆、动态决策和长链路（long-horizon）工具链还没有。

**Type:** Build
**Languages:** Python (stdlib)
**Prerequisites:** Phase 14 · 01 (Agent Loop), Phase 13 · 01 (Function Calling Deep Dive)
**Time:** ~60 minutes

## 学习目标（Learning Objectives）

- 解释 Toolformer 的自监督训练信号：只有当执行工具能降低下一个 token 的 loss 时，才保留这次工具标注。
- 说出 BFCL V4 的五个评估类别，以及每一类衡量什么。
- 用 stdlib 实现一个带 schema 校验、参数强转（argument coercion）和执行沙箱（sandboxing）的工具注册表。
- 诊断 2026 年三大未解问题：长链路工具链、动态决策、记忆。

## 问题（Problem）

早期的 tool use 问的是：模型能不能预测出一个正确的 function call？现代的 tool use 问的是：模型能不能在 40 步之内串起多种工具，带着记忆、在部分可观测的环境里、能从工具失败中恢复，而且不会幻觉出根本不存在的工具？

Toolformer 立下了 baseline：模型可以通过自监督学会什么时候该调用工具。BFCL V4 定义了 2026 年的评估目标。两者之间的鸿沟，就是生产级 agent 真正生活的空间。

## 概念（Concept）

### Toolformer（Schick et al., NeurIPS 2023）

思路：让模型给自己的预训练语料标注候选 API 调用。对每一个候选都执行一次。只有当带上工具结果之后，下一个 token 的 loss 降低时，才保留这条标注。在过滤后的语料上做 fine-tune。

覆盖的工具：计算器、QA 系统、搜索引擎、翻译器、日历。这个自监督信号纯粹关心「工具是否帮助预测文本」——没有任何人工标注。

规模化结果：tool use 在规模上才会涌现。小模型反而被工具标注拖累；大模型才能从中获益。这就是为什么 2026 年的前沿模型自带强 tool use，而大多数 7B 模型还需要显式做 tool-use fine-tune 才能稳定。

### Berkeley Function Calling Leaderboard V4（Patil et al., ICML 2025）

BFCL 是 2026 年事实上的评估标准。V4 的构成：

- **Agentic（40%）** —— 完整的 agent 轨迹：记忆、多轮、动态决策。
- **Multi-Turn（30%）** —— 带工具链的交互式对话。
- **Live（10%）** —— 用户提交的真实 prompt（更难的分布）。
- **Non-Live（10%）** —— 合成测试用例。
- **Hallucination（10%）** —— 检测「这时候不该调任何工具」。

V3 引入了基于状态的评估：在一串工具调用之后，去检查 API 的实际状态（比如「文件创建出来了吗？」），而不是去匹配工具调用的 AST。V4 又新增了网页搜索、记忆、格式敏感性这几类。

2026 年的关键发现：单轮 function calling 已经基本解决。失败集中在记忆（跨轮承载上下文）、动态决策（基于先前结果选工具）、长链路（20+ 步之后开始漂移）以及幻觉检测（没有合适工具时拒绝调用）。

### Tool schema

每个 provider 都有自己的 schema。细节不同，但骨架一致：

```
name: string
description: string (what it does, when to use it)
input_schema: JSON Schema (properties, required, types, enums)
```

Anthropic 直接用 `input_schema`。OpenAI 用 `function.parameters`。两边都接受 JSON Schema。description 是承重墙——模型靠它来挑选正确的工具。糟糕的工具描述是「选错工具」类故障的头号根因。

### 参数校验（Argument validation）

不要相信任何工具调用。要校验：

1. **类型强转（Type coercion）。** 模型可能在 schema 写明 int 的地方返回字符串 `"5"`。语义无歧义就强转；有歧义就拒绝。
2. **枚举校验（Enum validation）。** 如果 schema 写明 `status in {"open", "closed"}`，而模型给出 `"in_progress"`，要带描述性错误把它打回。
3. **必填字段。** 缺必填字段要立刻把错误观测（observation）回传给模型，而不是直接 crash。
4. **格式校验。** 日期、邮箱、URL —— 用真正的 parser 校验，不要靠正则。

每一次校验失败都要返回结构化的 observation，让模型可以以正确的形态重试。

### 并行工具调用（Parallel tool calls）

现代 provider 支持在一次 assistant 轮次里并行发出多次工具调用。循环长这样：

1. 模型发出 3 次工具调用，每次带不同的 `tool_use_id`。
2. Runtime 执行它们（独立的话就并行）。
3. 每个结果以 `tool_result` 块返回，靠 `tool_use_id` 关联。

工程铁律：把关联 ID 当作承重结构对待。一旦换错，就会出现「错的工具配错的结果」式的路由错乱。

### 沙箱（Sandboxing）

工具执行就是沙箱边界。详见第 09 课。简版：每个工具都应该指定读 / 写表面、网络访问、超时、内存上限。一个泛泛的 `run_shell(cmd)` 是红旗；专用的 `git_status()` 才安全。

## 动手实现（Build It）

`code/main.py` 实现了一个生产形态的工具注册表：

- JSON Schema 子集校验器（仅用 stdlib）。
- 带 description、input schema、超时和 executor 的工具注册。
- 参数强转和枚举校验。
- 带关联 ID 的并行工具派发。
- 错误以结构化字符串的 observation 返回。

跑起来：

```
python3 code/main.py
```

trace 会展示一个 mini agent 在一轮里调三个工具，其中故意混入一次格式错误的调用，会被带描述性错误打回，让模型可以据此采取行动。

## 用起来（Use It）

每个 provider 都有自己的 tool schema —— Anthropic、OpenAI、Gemini、Bedrock。如果你需要跨 provider，就用一层翻译适配（OpenAI Agents SDK、Vercel AI SDK、LangChain tool adapter）。BFCL 是参考基准 —— 如果 tool use 是产品的核心，那就在上线前先把 agent 拿去跑一遍 BFCL。

## 上线部署（Ship It）

`outputs/skill-tool-registry.md` 会为给定的任务领域生成工具目录、schema 和注册表。包含 description 质量检查（每个工具的 description 是否告诉了模型「什么时候该用它」？）。

## 练习（Exercises）

1. 加一个「no-op」工具，让模型可以显式拒绝调用任何其他工具。在一个 BFCL 风格的 hallucination 测试上度量它。
2. 实现 int-as-string 和 float-as-string 的参数强转。强转从哪一刻开始反而会掩盖真正的 bug？
3. 给每个工具加上超时，再加上熔断器（连续失败 3 次后，60 秒内拒绝该工具）。这会怎么改变模型的恢复方式？
4. 读 BFCL V4 的描述。挑一个类别（比如「multi-turn」），把 10 条示例 prompt 跑过你的 agent，报告通过率。
5. 把 stdlib 校验器移植到 Pydantic 或 Zod。Pydantic / Zod 抓到了哪些玩具版漏掉的问题？

## 关键术语（Key Terms）

| 术语 | 大家嘴上说的 | 实际含义 |
|------|----------------|------------------------|
| Function calling | 「Tool use」 | 带 schema 校验的结构化输出工具调用 |
| Toolformer | 「自监督工具标注」 | Schick 2023 —— 只保留那些「带上结果能降低下一个 token loss」的工具调用 |
| BFCL | 「Berkeley Function Calling Leaderboard」 | 2026 基准：40% agentic、30% multi-turn、10% live、10% non-live、10% hallucination |
| Tool schema | 「给模型的函数签名」 | name、description、参数的 JSON Schema |
| tool_use_id | 「关联 ID」 | 把一次工具调用绑定到它的结果；并行派发的命脉 |
| Hallucination detection | 「知道什么时候不该调」 | V4 类别：没有合适工具时拒绝调用 |
| Argument coercion | 「字符串转 int 的修补」 | 针对可预测 schema 失配的窄范围修补；有歧义就拒绝 |
| Sandboxing | 「工具执行边界」 | 每个工具的读 / 写表面、网络、超时、内存上限 |

## 延伸阅读（Further Reading）

- [Schick et al., Toolformer (arXiv:2302.04761)](https://arxiv.org/abs/2302.04761) —— 自监督工具标注
- [Berkeley Function Calling Leaderboard (V4)](https://gorilla.cs.berkeley.edu/leaderboard.html) —— 2026 评估基准
- [Anthropic, Tool use documentation](https://platform.claude.com/docs/en/agent-sdk/overview) —— Claude Agent SDK 中的生产级工具 schema
- [OpenAI Agents SDK docs](https://openai.github.io/openai-agents-python/) —— function tool 类型与 Guardrails
