# 浏览器代理与长程网络任务

> ChatGPT 代理（2025年7月）将 Operator 和深度研究合并为一个浏览器/终端代理，并在 BrowseComp 上创下 68.9% 的 SOTA。OpenAI 于 2025 年 8 月 31 日关闭了 Operator——产品层面的整合。Anthropic 对 Vercept 的收购使 Claude Sonnet 在 OSWorld 上的得分从不到 15% 提升到 72.5%。WebArena-Verified（ServiceNow，ICLR 2026）修复了原始 WebArena 中 11.3% 的假阴性率，并发布了包含 258 个任务的 Hard 子集。这些数字是真实的。攻击面也同样真实：OpenAI 的准备负责人公开表示，针对浏览器代理的间接提示注入“不是一个可以完全修复的漏洞”。记录在案的 2025-2026 年攻击包括：Tainted Memories（Atlas CSRF）、HashJack（Cato Networks），以及 Perplexity Comet 中的一键劫持。

**类型：** 学习
**语言：** Python（标准库，间接提示注入攻击面模型）
**前置条件：** 第 15 阶段 · 10（权限模式），第 15 阶段 · 01（长程代理）
**时间：** ~45 分钟

## 问题

浏览器代理是一种长程代理，它读取不受信任的内容并采取有影响力的行动。代理访问的每个页面都是用户未编写的输入。每个页面上的每个表单都是潜在的命令通道。2025-2026 年的攻击库表明这并非假设：Tainted Memories 允许攻击者通过精心设计的页面将恶意指令绑定到代理的内存中；HashJack 将命令隐藏在代理访问的 URL 片段中；Perplexity Comet 通过一次点击即可劫持。

防御图景令人不安。OpenAI 的准备负责人直言不讳：间接提示注入“不是一个可以完全修复的漏洞”。这是因为攻击存在于代理的阅读与行动边界，而该边界在架构上是模糊的——模型读取的每个令牌原则上都可以被解读为指令。

本课命名了攻击面、基准测试全景（BrowseComp、OSWorld、WebArena-Verified），并建模了一个最小的间接提示注入场景，以便你在第 14 课和第 18 课中推理真实的防御措施。

## 概念

### 2026 年全景，每个系统一段

**ChatGPT 代理（OpenAI）。** 2025 年 7 月推出。统一了 Operator（浏览）和深度研究（数小时研究）。于 2025 年 8 月 31 日关闭了独立的 Operator。BrowseComp 上达到 SOTA 68.9%；在 OSWorld 和 WebArena-Verified 上表现强劲。

**Claude Sonnet + Vercept（Anthropic）。** Anthropic 对 Vercept 的收购专注于计算机使用能力。将 Claude Sonnet 在 OSWorld 上的得分从 <15% 提升到 72.5%。Claude 计算机使用作为工具 API 发布。

**Gemini 3 Pro 与浏览器使用（DeepMind）。** 浏览器使用集成发布了计算机使用控制；FSF v3（2026 年 4 月，第 20 课）专门追踪 ML R&D 领域的自主性。

**WebArena-Verified（ServiceNow，ICLR 2026）。** 修复了一个有据可查的问题：原始 WebArena 有约 11.3% 的假阴性率（标记为失败但实际上已解决的任务）。Verified 版本通过人工策划的成功标准重新评分，并增加了包含 258 个任务的 Hard 子集（ICLR 2026 论文，openreview.net/forum?id=94tlGxmqkN）。

### BrowseComp vs OSWorld vs WebArena

| 基准测试 | 衡量内容 | 时间跨度 |
|---|---|---|
| BrowseComp | 在时间压力下在开放网络上查找特定事实 | 分钟级 |
| OSWorld | 代理操作完整桌面（鼠标、键盘、shell） | 数十分钟 |
| WebArena-Verified | 模拟网站中的事务性网络任务 | 分钟级 |
| Hard 子集 | 具有多页面状态转换的 WebArena-Verified 任务 | 数十分钟 |

不同维度。高的 BrowseComp 分数说明代理能查找事实；不能说明它能预订航班。OSWorld 分数更接近“它在我的桌面上能用吗”。WebArena-Verified 更接近“它能完成一个流程吗”。任何生产决策都需要与任务分布匹配的基准测试。

### 攻击面，已命名

1. **间接提示注入。** 不受信任的页面内容包含指令。代理读取它们。代理执行它们。公开示例：2024 年 Kai Greshake 等，2025 年 Tainted Memories 论文，2026 年 HashJack（Cato Networks）。
2. **URL 片段 / 查询注入。** 爬取 URL 的 `#fragment` 或查询字符串包含命令。从不可见渲染；仍在代理的上下文中。
3. **内存绑定攻击。** 页面指示代理写入持久内存（第 12 课涵盖持久状态）。下个会话，内存触发有效载荷，没有可见触发器。
4. **针对认证会话的 CSRF 形状攻击。** Tainted Memories 类：代理在某处登录；攻击者的页面发出状态改变请求，代理使用用户的 cookie 执行。
5. **一键劫持。** 视觉上无害的按钮搭载代理跟随的有效载荷。Comet 类。
6. **代理主机表面的内容安全策略漏洞。** 渲染和工具层本身可能是攻击向量；浏览器中的浏览器代理堆栈很宽。

### 为什么“不能完全修复”

攻击与代理的能力是同构的。代理必须读取不受信任的内容才能完成工作。代理读取的任何内容都可能包含指令。代理遵循的任何指令都可能与用户的实际请求不一致。防御措施（信任边界、分类器、工具允许列表、对重要行动的人工介入）提高了攻击成本并减少了其爆炸半径。它们不能关闭整个类别。

这与 Lob 定理（第 8 课）的推理模式相同：代理无法证明下一个令牌是安全的；它只能建立一个使不安全令牌更可检测的系统。

### 实际发布的防御姿态

- **读/写边界。** 读取从不具有影响力。写入（提交表单、发布内容、调用具有副作用的工具）如果发起内容来自信任边界之外，则需要新的人工批准。
- **每个任务的工具允许列表。** 代理可以浏览；除非该工具已明确为任务启用，否则它不能发起电汇。第 13 课涵盖预算。
- **会话隔离。** 浏览器代理会话仅使用限定范围的凭证运行。没有生产认证，没有个人电子邮件。保留每次 HTTP 请求的日志以供审计。
- **内容清理器。** 在将获取的 HTML 连接入模型上下文之前，剥离已知的不良模式。（减少简单攻击；不能阻止复杂有效载荷。）
- **对重要行动的人工介入。** 提出-提交模式（第 15 课）。
- **内存上的金丝雀令牌。** 如果内存条目触发，用户会看到它（第 14 课）。

## 使用

`code/main.py` 针对三个合成页面建模了一个微型浏览器代理运行。一个页面是良性的，一个在可见文本中有直接提示注入块，一个有 URL 片段注入（不可见但在代理的上下文中）。脚本显示 (a) 天真代理会做什么，(b) 读/写边界能捕捉什么，(c) 清理器能捕捉什么，(d) 两者都不能捕捉什么。

## 交付

`outputs/skill-browser-agent-trust-boundary.md` 界定拟议的浏览器代理部署：它触及哪些信任区域、它被授权写入什么，以及在首次运行前必须部署哪些防御措施。

## 练习

1. 运行 `code/main.py`。识别清理器能捕捉但读/写边界不能的攻击，以及只有读/写边界能捕捉的攻击。

2. 扩展清理器以检测一类 HashJack 风格的 URL 片段注入。测量具有合法片段的良性 URL 上的误报率。

3. 选择一个你知道的真实浏览器代理工作流（例如，“预订航班”）。列出每次读取和每次写入。标记哪些写入需要人工介入以及原因。

4. 阅读 WebArena-Verified ICLR 2026 论文。识别一类原始 WebArena 评分不可靠的任务，并解释 Verified 子集如何解决它。

5. 为浏览器代理设置设计一个内存金丝雀。你会存储什么、在哪里存储，以及什么触发警报？

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|---|---|---|
| Indirect prompt injection | “不良页面文本” | 代理读取的页面中的不受信任内容包含代理执行的指令 |
| Tainted Memories | “内存攻击” | 代理将攻击者提供的指令写入持久内存；下个会话触发 |
| HashJack | “URL 片段攻击” | 隐藏在 URL 片段/查询字符串中的有效载荷在代理的上下文中但不可见渲染 |
| One-click hijack | “不良按钮” | 可见的交互元素搭载代理执行的后续有效载荷 |
| BrowseComp | “网络搜索基准” | 在开放网络上查找特定事实；分钟级时间跨度 |
| OSWorld | “桌面基准” | 完整操作系统控制；多步 GUI 任务 |
| WebArena-Verified | “修复的网络任务基准” | ServiceNow 重新评分的 WebArena 带 Hard 子集 |
| Read/write boundary | “副作用门控” | 读取从不具有影响力；如果内容超出信任范围，写入需要新批准 |

## 延伸阅读

- [OpenAI — Introducing ChatGPT agent](https://openai.com/index/introducing-chatgpt-agent/) —— Operator 和深度研究的合并；BrowseComp SOTA。
- [OpenAI — Computer-Using Agent](https://openai.com/index/computer-using-agent/) —— Operator 血统及成为 ChatGPT 代理的架构。
- [Zhou 等 — WebArena](https://webarena.dev/) —— 原始基准测试。
- [WebArena-Verified (OpenReview)](https://openreview.net/forum?id=94tlGxmqkN) —— ICLR 2026 修复子集论文。
- [Anthropic — 实践中测量代理自主性](https://www.anthropic.com/research/measuring-agent-autonomy) —— 包括计算机使用代理的攻击面讨论。