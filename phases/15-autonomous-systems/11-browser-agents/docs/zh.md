# 浏览器智能体和长时域 Web 任务

> ChatGPT 智能体（2025年7月）将 Operator 和深度研究合并为一个浏览器/终端智能体，并将 BrowseComp SOTA 设为68.9%。OpenAI 在2025年8月31日关闭了 Operator——产品层的整合。Anthropic 的 Vercept 收购将 Claude Sonnet 在 OSWorld 上从不到15%提升到72.5%。WebArena-Verified（ServiceNow，ICLR 2026）修复了原始 WebArena 中11.3个百分点的假阴性率，并发布了258任务 Hard 子集。数字是真实的。攻击面也是：OpenAI 的准备工作负责人公开表示，浏览器智能体的间接提示注入"不是可以完全修补的 Bug。"已记录的2025-2026年攻击：Tainted Memories（Atlas CSRF）、HashJack（Cato Networks）和 Perplexity Comet 中的一键劫持。

**类型：** 学习
**语言：** Python（标准库，间接提示注入攻击面模型）
**前置条件：** 第15阶段 · 10（权限模式），第15阶段 · 01（长时域智能体）
**时间：** 约45分钟

## 问题

浏览器智能体是一个读取不可信内容并采取后果性动作的长时域智能体。智能体访问的每个页面都是用户未编写的输入。每个页面上的每个表单都是潜在的命令通道。2025-2026年攻击语料库显示这不是假想的：Tainted Memories 让攻击者通过精心制作的页面将恶意指令绑定到智能体的内存；HashJack 将命令隐藏在智能体访问的 URL 片段中；Perplexity Comet 在一键点击中劫持命中。

防御图景令人不安。OpenAI 的准备工作负责人大声说出了安静的部分：间接提示注入"不是可以完全修补的 Bug。"这是因为攻击存在于智能体的读取与行动边界，这在架构上是模糊的——原则上，模型读取的每个 Token 都可能被读作指令。

本课命名攻击面，命名基准格局（BrowseComp、OSWorld、WebArena-Verified），并建模一个最小间接提示注入场景，以便你可以在第14和18课中推理真实防御。

## 概念

### 2026 年格局，每系统一段话

**ChatGPT 智能体（OpenAI）。** 2025年7月发布。统一 Operator（浏览）和深度研究（多小时研究）。2025年8月31日关闭独立 Operator。BrowseComp 上 SOTA 为68.9%；在 OSWorld 和 WebArena-Verified 上有强劲数字。

**Claude Sonnet + Vercept（Anthropic）。** Anthropic 的 Vercept 收购专注于计算机使用能力。将 Claude Sonnet 在 OSWorld 上从 <15% 提升到72.5%。Claude Computer Use 作为工具 API 发布。

**Gemini 3 Pro with Browser Use（DeepMind）。** Browser Use 集成发布计算机使用控制；FSF v3（2026年4月，第20课）专门跟踪 ML R&D 领域的自主性。

**WebArena-Verified（ServiceNow，ICLR 2026）。** 修复了一个有记录的问题：原始 WebArena 有约11.3%的假阴性率（标记为失败但实际上是解决的任务）。Verified 发布使用人工策展的成功标准重新评分，并增加了258任务 Hard 子集（ICLR 2026 论文，openreview.net/forum?id=94tlGxmqkN）。

### BrowseComp vs OSWorld vs WebArena

| 基准 | 测量内容 | 时域 |
|---|---|---|
| BrowseComp | 在时间压力下在开放 Web 上找到特定事实 | 分钟级 |
| OSWorld | 智能体操作完整桌面（鼠标、键盘、Shell） | 数十分钟 |
| WebArena-Verified | 模拟站点中的事务性 Web 任务 | 分钟级 |
| Hard 子集 | 具有多页面状态转换的 WebArena-Verified 任务 | 数十分钟 |

不同的轴。高 BrowseComp 分数表示智能体找到事实；它不表示智能体可以预订航班。OSWorld 分数更接近"它在我的桌面上工作吗。" WebArena-Verified 更接近"它可以完成流程吗。"任何生产决策都需要匹配任务分布的基准。

### 攻击面，已命名

1. **间接提示注入。** 不可信页面内容包含指令。智能体读取它们。智能体执行它们。公共示例：2024 Kai Greshake 等人，2025 Tainted Memories 论文，2026 HashJack（Cato Networks）。
2. **URL 片段/查询注入。** 被爬取 URL 的 `#fragment` 或查询字符串包含命令。永远不会可见渲染；仍在智能体的上下文中。
3. **内存绑定攻击。** 页面指示智能体写入持久内存（第12课涵盖持久状态）。下一次会话，内存触发有效负载，没有可见触发器。
4. **对认证会话的 CSRF 形状攻击。** Tainted Memories 类别：智能体在某处登录；攻击者的页面发出状态更改请求，智能体用用户的 Cookie 执行。
5. **一键劫持。** 视觉上无害的按钮携带智能体跟随的有效负载。Comet 类别。
6. **智能体主机表面中的内容安全策略漏洞。** 渲染和工具层本身可能是攻击向量；浏览器中的浏览器智能体堆栈很宽。

### 为什么"不能完全修补"

攻击与智能体的能力同构。智能体必须读取不可信内容才能完成工作。智能体读取的任何内容都可能包含指令。智能体遵循的任何指令都可能与用户的实际请求不对齐。防御（信任边界、分类器、工具允许列表、在后果性动作上的 HITL）提高了攻击成本并减少了其爆炸半径。它们不闭合类别。

这与 Lob 定理（第8课）的推理模式相同：智能体无法证明下一个 Token 是安全的；它只能建立一个不安全 Token 更易检测的系统。

### 实际出货的防御姿态

- **读取/写入边界。** 读取永远不会有后果。如果发起内容来自信任边界之外，写入（提交表单、发布内容、使用副作用调用工具）需要新的用户批准。
- **每任务工具允许列表。** 智能体可以浏览；它不能发起电汇，除非该工具被明确启用以用于任务。第13课涵盖预算。
- **会话隔离。** 浏览器智能体会话仅使用范围凭证运行。没有生产认证，没有个人电子邮件。保留每个 HTTP 请求的日志以供审计。
- **内容清理器。** 获取的 HTML 在被连接到模型上下文之前，会被去除已知坏模式。（减少简单攻击；不阻止复杂有效负载。）
- **在后果性动作上的 HITL。** 提议然后提交模式（第15课）。
- **内存上的金丝雀令牌。** 如果内存条目触发，用户会看到它（第14课）。

## 使用

`code/main.py` 对三个合成页面建模一个微小浏览器智能体运行。一个页面是良性的，一个在可见文本中有直接提示注入 Blob，一个具有 URL 片段注入（不可见但在智能体的上下文中）。脚本显示（a）朴素智能体会做什么，（b）读取/写入边界捕捉什么，（c）清理器捕捉什么，（d）两者都不捕捉什么。

## 实战

`outputs/skill-browser-agent-trust-boundary.md` 范围界定提议的浏览器智能体部署：它触及哪些信任区域，它被授权写入什么，以及在首次运行之前必须就位的防御措施。

## 练习

1. 运行 `code/main.py`。确定清理器捕捉但读取/写入边界没有捕捉的攻击，以及仅读取/写入边界捕捉的攻击。

2. 扩展清理器以检测一类 HashJack 风格的 URL 片段注入。测量在具有合法片段的良性 URL 上的假阳性率。

3. 选择你知道的一个真实浏览器智能体工作流（例如，"预订航班"）。列出每个读取和每个写入。标记哪些写入需要 HITL 以及为什么。

4. 阅读 WebArena-Verified ICLR 2026 论文。确定原始 WebArena 评分不可靠的一个任务类别，并解释 Verified 子集如何解决它。

5. 为浏览器智能体设置设计内存金丝雀。你会存储什么，在哪里，以及什么触发警报？

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|---|---|---|
| 间接提示注入（Indirect Prompt Injection） | "坏页面文本" | 智能体读取的页面中不可信内容包含智能体执行的指令 |
| Tainted Memories | "内存攻击" | 智能体将攻击者提供的指令写入持久内存；下一次会话触发 |
| HashJack | "URL 片段攻击" | 隐藏在 URL 片段/查询字符串中的有效负载在智能体的上下文中但不可见渲染 |
| 一键劫持（One-Click Hijack） | "坏按钮" | 可见示能（Affordance）携带智能体执行的后续有效负载 |
| BrowseComp | "Web 搜索基准" | 在开放 Web 上找到特定事实；分钟级时域 |
| OSWorld | "桌面基准" | 完整 OS 控制；多步骤 GUI 任务 |
| WebArena-Verified | "固定 Web 任务基准" | ServiceNow 重新评分的 WebArena 与 Hard 子集 |
| 读取/写入边界（Read/Write Boundary） | "副作用门控" | 读取永远不会有后果；如果内容超出信任，写入需要新批准 |

## 延伸阅读

- [OpenAI — 介绍 ChatGPT 智能体](https://openai.com/index/introducing-chatgpt-agent/) — Operator 和深度研究的合并；BrowseComp SOTA。
- [OpenAI — 计算机使用智能体](https://openai.com/index/computer-using-agent/) — Operator 血统和成为 ChatGPT 智能体的架构。
- [Zhou 等人 — WebArena](https://webarena.dev/) — 原始基准。
- [WebArena-Verified（OpenReview）](https://openreview.net/forum?id=94tlGxmqkN) — ICLR 2026 固定子集论文。
- [Anthropic — 实践中测量智能体自主性](https://www.anthropic.com/research/measuring-agent-autonomy) — 包括计算机使用智能体的攻击面讨论。
