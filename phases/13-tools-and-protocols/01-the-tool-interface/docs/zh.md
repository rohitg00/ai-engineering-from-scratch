# 工具接口 —— 为什么 agent 需要结构化 I/O

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 语言模型产出的是 token，程序执行的是动作。横亘在两者之间的，就是工具接口（tool interface）：一份让模型请求动作、宿主真正去执行的契约。2026 年所有的 stack —— OpenAI、Anthropic、Gemini 的 function calling，MCP 的 `tools/call`，A2A 的 task parts —— 都是同一个四步循环的不同编码方式。本课给这个循环命名，并展示跑通它的最小骨架。

**Type:** Learn
**Languages:** Python (stdlib, no LLM)
**Prerequisites:** Phase 11 (LLM completion APIs)
**Time:** ~45 minutes

## 学习目标（Learning Objectives）

- 解释为什么一个只能生成文本的 LLM，凭自身无法对真实世界采取动作。
- 画出四步 tool-call 循环（describe → decide → execute → observe），并指出每一步的归属者。
- 把一个工具描述写成三件套：name、JSON Schema 输入、确定性的 executor 函数。
- 区分 pure（纯）工具和 side-effecting（带副作用）工具，并说明这种切分对安全性为什么重要。

## 问题（The Problem）

一个 LLM 在下一个 token 上吐出概率分布，仅此而已 —— 这就是它的全部输出面。如果你问一个聊天模型「Bengaluru 现在天气怎么样」，它能写出一句听起来合理的话，但它没法去拨通某个天气 API。那句话也许碰巧是对的，也许已经过期三天了。

弥合这个鸿沟，正是 tool interface 的目的。宿主程序 —— 你的 agent 运行时、Claude Desktop、ChatGPT、Cursor，或者一个自定义脚本 —— 向模型公布一份可调用工具的清单。当模型判断需要执行动作时，它产出一个结构化 payload，里面写着工具名和参数。宿主解析这个 payload，真正执行该工具，再把结果喂回去。循环持续进行，直到模型判断不需要再调用为止。

这套契约的第一个版本是 2023 年 6 月 OpenAI 的 "functions" 参数。Anthropic 紧随其后，在 Claude 2.1 里推出了 `tool_use` 块。Gemini 几个月后加入 `functionDeclarations`。如今每家厂商都暴露同一种形态：进去是一份带 JSON Schema 类型的工具清单，出来是一个 JSON payload 形式的 tool call。Model Context Protocol（2024 年 11 月）把这套契约推广开来，让一个工具注册表可以服务每一个模型。A2A（2026 年 4 月，v1.0）则把同样的 primitive 叠到了 agent 与 agent 之间的委派上。

四步循环是这一切之下的不变量。Phase 13 剩下的所有内容，都只是这个循环的展开。

## 概念（The Concept）

### 第一步：describe

宿主用三个字段来声明每一个工具。

- **Name.** 一个稳定、机器可读的标识符。`get_weather`，而不是 "weather thing"。
- **Description.** 一段自然语言简介。"在用户询问某个具体城市的当前天气时使用，不要用于历史数据。"
- **Input schema.** 一个 JSON Schema 对象（draft 2020-12），描述这个工具的参数。

模型拿到这份清单。现代厂商会用各家专属模板把这些声明序列化进 system prompt，所以作为调用方，你只跟结构化形式打交道。

### 第二步：decide

给定用户消息和可用工具，模型会选择三种行为之一。

1. **直接用文本回答。** 不调用工具。
2. **调用一个或多个工具。** 产出结构化的 call 对象。在 `parallel_tool_calls: true` 下（OpenAI 和 Gemini 默认开启，Anthropic 需要主动启用），模型可以在一轮里产出多个调用。
3. **拒绝。** 严格模式（strict mode）的结构化输出可以产出一个有类型的 `refusal` 块，而不是一个 call。

一个 tool call payload 有三个稳定字段：调用 `id`、工具 `name`、JSON `arguments` 对象。`id` 的存在是为了让宿主能把后来的结果对回到具体那一个调用 —— 这在并行调用乱序返回时尤其要紧。

### 第三步：execute

宿主收到调用，按声明的 schema 校验参数，然后跑 executor。参数不合法说明模型 hallucinate（幻觉）出了某个字段或用错了类型 —— 这是弱模型上极其常见的失败模式。生产宿主在参数不合法时通常做三件事之一：fail fast，把错误透传给模型；用一个受约束的 parser 来修复 JSON；或者把 validation 错误塞进 prompt 重试模型。

executor 本身就是普通代码。Python、TypeScript、shell 命令、数据库查询都行。它产出一个结果，通常是字符串，但也可以是任意 JSON 值，或者（在 MCP 里）一个结构化的内容块（文本、图片、resource 引用）。结果必须是可序列化的。

### 第四步：observe

宿主把工具结果以 `tool` 角色消息（带匹配的 `id`）追加到对话里，再次调用模型。模型现在拿到了 context 里的工具输出，可以产出最终回答，也可以请求更多调用。这一过程持续下去，直到模型不再发出调用，或者宿主撞到迭代次数的安全上限。

### 信任切分

工具按对安全性的影响分两种。

- **Pure（纯）。** 只读、确定性、无副作用。`get_weather`、`search_docs`、`get_current_time`。可以放心地推测性调用。
- **Consequential（有后果）。** 改变状态、花钱、动用户数据。`send_email`、`delete_file`、`execute_trade`。必须加门禁。

Meta 在 2026 年提出的 agent 安全 "Rule of Two"（二选其二法则）说：单轮里最多只能组合下面三项中的两项 —— untrusted input（不可信输入）、sensitive data（敏感数据）、consequential action（有后果的动作）。tool interface 就是你执行这条规则的地方 —— 通过拒绝调用、要求用户确认、或抬升权限。完整的安全章节见 Phase 13 · 15，agent 级权限策略见 Phase 14 · 09。

### 这个循环住在哪儿

| 上下文 | 谁来 describe | 谁来 decide | 谁来 execute |
|---------|---------------|-------------|--------------|
| 单轮 function calling（OpenAI/Anthropic/Gemini） | 应用开发者 | LLM | 应用开发者 |
| MCP | MCP server | LLM 通过 MCP client | MCP server |
| A2A | Agent Card 发布者 | 调用方 agent | 被调用 agent |
| Web 浏览器（function-calling agent） | 浏览器扩展 / WebMCP | LLM | 浏览器运行时 |

到处都是同一组四步。列名换了，结构没变。

### 为什么不直接 prompt 模型让它吐 JSON？

「让模型用 JSON 回复」是 function calling 出现之前的做法。在前沿模型上失败率约 5%–15%，到了较小的模型上就更糟。失败模式包括缺花括号、多了尾逗号、字段是幻觉出来的、类型不对。然后你就得加一道 JSON 修复、重试，或者一个受约束的 decoder。

原生 function calling 在三个层面更好。第一，厂商把模型端到端训练在确切的 call 形态上，所以严格模式下合法 JSON 率能爬到 98%–99%。第二，调用 payload 待在它自己的协议槽里，而不是嵌在自由文本里 —— 因此 tool call 永远不会泄露到用户可见的回复里。第三，厂商通过受约束解码（OpenAI 的 strict mode、Anthropic 的 `tool_use`、Gemini 的 `responseSchema`）来强制 schema 合规。输出保证能通过校验。

Phase 13 · 02 把三家厂商 API 并排走一遍，Phase 13 · 04 深入讲结构化输出。

### 断路器

循环在两种情况下终止：模型不再发调用，或者宿主撞到最大轮数上限。生产宿主把这个上限设在 5 到 20 之间。超过这个数，你几乎肯定陷进了模型自己出不来的 loop 里。Claude Code 默认 20，OpenAI Assistants 是 10，Cursor 的 agent 模式是 25。

另一个选项 —— 不设上限的 loop —— 每隔半年就以「agent 一夜烧掉 400 美元 API 费用」的复盘文章形式出现一次。不带上限就别上线。

Phase 14 · 12 深入讲错误恢复和自愈，Phase 17 讲生产环境的 rate limit。

### Phase 13 接下来怎么走

- Lessons 02 到 05 打磨厂商级的 tool-call 表面。
- Lessons 06 到 14 把这个循环泛化成 MCP。
- Lessons 15 到 18 把这个循环防御起来，对抗恶意 server、对抗性用户、未鉴权的远程 auth 暴露面。
- Lessons 19 到 22 把模式扩展到 agent 之间的协作、可观测性、路由、打包。
- Lesson 23 用所有 primitive 端到端跑出一个完整生态。

剩下的每一课都是这四步循环的展开。把它当成不变量记在心里。

## 用起来（Use It）

`code/main.py` 不接 LLM，就把四步循环跑起来。一个假的 "decider" 函数靠在用户消息上做模式匹配来模拟模型；executor、schema 校验器、observe-step 骨架都是真的。跑一遍就能看到完整的 request/response 编排，并打印中间状态；之后某一课你可以把这个假 decider 换成任何真实厂商。

看这些点：

- 工具注册表里每个工具有四个字段：name、description、schema、executor 引用。
- 校验器是一个最小化的 JSON Schema 子集（types、required、enum、min/max），仅用 stdlib 写成。Phase 13 · 04 给一个更完整的版本。
- 循环把迭代数限制在 5。生产 agent 就需要这种断路器。

## 上线部署（Ship It）

这一课产出 `outputs/skill-tool-interface-reviewer.md`。给定一份 tool 定义草稿（name + description + schema + executor 大纲），这个 skill 会从「循环适配度」上审计它：name 是否机器稳定？description 是否一份完整的使用说明？schema 是否正确使用了 JSON Schema 2020-12？pure-vs-consequential 的分类是否明确？

## 练习（Exercises）

1. 给 `code/main.py` 增加第四个工具 `get_stock_price(ticker)`。把 description 写成 "在用户按代码查询当前股价时使用，不要用于历史价格或市场总览。" 跑一遍骨架，确认假 decider 会把提到代码的 query 路由到这个新工具。

2. 把 schema 校验器搞坏。传一个 `arguments` 对象缺了必填字段的 call，确认宿主在执行前就拒绝它。再传一个多了未知字段的 call。决定一下：宿主应该拒绝还是忽略？用一个安全论据论证你的选择。

3. 把骨架里的每个工具按 pure 还是 consequential 分类。给需要的注册表条目加一个 `consequential: true` 标记，改循环让它在选中 consequential 工具时打印一行 "would confirm with user"。这就是每个生产宿主都需要的确认门禁的形态。

4. 在纸上画出四步循环，把上面那张厂商列表填好，对应你最常用的 client（Claude Desktop、Cursor、ChatGPT，或者自定义 stack）。再和 Phase 13 · 06 里的 MCP 专属变体对一对。

5. 把 OpenAI 的 function-calling guide 从头到尾读一遍。找出一个出现在 request 里、但不在本课呈现的四步循环里的字段。解释它加了什么、为什么它是「方便」而不是「必要」的。

## 关键术语（Key Terms）

| 术语 | 大家口头怎么说 | 它实际是什么 |
|------|----------------|------------------------|
| Tool | 「模型可以调的东西」 | 一个三件套：name + JSON-Schema 类型化的输入 + executor 函数 |
| Function calling | 「原生 tool use」 | 厂商级的 API 支持，让模型产出结构化 tool call 而不是散文 |
| Tool call | 「模型请求执行动作」 | 一个由模型产出的 JSON payload，含 `id`、`name`、`arguments` |
| Tool result | 「工具返回的东西」 | executor 的输出，包在带匹配 id 的 `tool` 角色消息里 |
| Parallel tool calls | 「一次很多 call」 | 一轮模型中多个 call 对象，相互独立，可按 id 排序 |
| Strict mode | 「保证 JSON」 | 受约束解码，强制模型输出能通过声明 schema 的校验 |
| Pure tool | 「只读工具」 | 没有副作用，重跑安全 |
| Consequential tool | 「动作工具」 | 改变外部状态，需要门禁、审计或用户确认 |
| 四步循环（Four-step loop） | 「tool-call 循环」 | describe → decide → execute → observe |
| Host | 「agent 运行时」 | 持有工具注册表、调用模型、运行 executor 的程序 |

## 延伸阅读（Further Reading）

- [OpenAI — Function calling guide](https://platform.openai.com/docs/guides/function-calling) — OpenAI 风格 tool 声明和 call 形态的权威参考
- [Anthropic — Tool use overview](https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/overview) — Claude 的 `tool_use` / `tool_result` 块格式
- [Google — Gemini function calling](https://ai.google.dev/gemini-api/docs/function-calling) — Gemini 里的 `functionDeclarations` 与并行调用语义
- [Model Context Protocol — Specification 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25) — tool interface 的厂商无关泛化版
- [JSON Schema — 2020-12 release notes](https://json-schema.org/draft/2020-12/release-notes) — 现代每个工具 API 都说的 schema 方言
