# 11 · 浏览器智能体与长周期 Web 任务

> ChatGPT agent（2025 年 7 月）将 Operator 与 deep research 合并为单一的浏览器/终端智能体，并在 BrowseComp 上以 68.9% 创下 SOTA。OpenAI 于 2025 年 8 月 31 日关停了 Operator——这是产品层面的整合。Anthropic 收购 Vercept 后，将 Claude Sonnet 在 OSWorld 上的成绩从不足 15% 提升到 72.5%。WebArena-Verified（ServiceNow，ICLR 2026）修正了原始 WebArena 中 11.3 个百分点的假阴性率（false-negative rate），并推出了包含 258 个任务的 Hard 子集。这些数字是真实的，攻击面同样真实：OpenAI 备灾（preparedness）负责人公开表示，针对浏览器智能体的间接提示注入（indirect prompt injection）「并非一个可以被完全修补的漏洞」。已记录在案的 2025–2026 攻击包括：Tainted Memories（Atlas CSRF）、HashJack（Cato Networks），以及 Perplexity Comet 中的一键劫持。

**类型：** 学习
**语言：** Python（标准库，间接提示注入攻击面模型）
**前置：** 阶段 15 · 10（权限模式）、阶段 15 · 01（长周期智能体）
**时长：** 约 45 分钟

## 问题所在

浏览器智能体（browser agent）是一种会读取不受信任内容并执行有实质后果操作的长周期智能体（long-horizon agent）。智能体访问的每一个页面，都是用户没有亲手写下的输入。每个页面上的每个表单，都是潜在的命令通道。2025–2026 的攻击语料表明这绝非假设：Tainted Memories 让攻击者通过精心构造的页面，把恶意指令绑定到智能体的记忆中；HashJack 把命令隐藏在智能体访问的 URL 片段（fragment）里；Perplexity Comet 的劫持只需一次点击即可命中。

防御态势令人不安。OpenAI 备灾负责人把那句没人愿意说出口的话挑明了：间接提示注入「并非一个可以被完全修补的漏洞」。原因在于，这类攻击寄生于智能体「读取 vs 行动」的边界，而这条边界在架构上本就模糊——原则上，模型读取的每一个 token 都可能被当作指令来读。

本课会逐一指认攻击面，梳理基准格局（BrowseComp、OSWorld、WebArena-Verified），并对一个最小化的间接提示注入场景进行建模，以便你能在第 14 课与第 18 课中推演真正的防御手段。

## 核心概念

### 2026 年的格局，每个系统一段话

**ChatGPT agent（OpenAI）。** 2025 年 7 月发布。统一了 Operator（浏览）与 Deep Research（多小时研究）。于 2025 年 8 月 31 日关停独立的 Operator。在 BrowseComp 上以 68.9% 居 SOTA；在 OSWorld 与 WebArena-Verified 上成绩亦强劲。

**Claude Sonnet + Vercept（Anthropic）。** Anthropic 收购 Vercept 聚焦于计算机使用（computer-use）能力，将 Claude Sonnet 在 OSWorld 上的成绩从不足 15% 提升到 72.5%。Claude Computer Use 以工具 API 形式提供。

**Gemini 3 Pro 搭配 Browser Use（DeepMind）。** Browser Use 集成提供计算机使用控制；FSF v3（2026 年 4 月，第 20 课）专门追踪 ML 研发（ML R&D）领域内的自主性。

**WebArena-Verified（ServiceNow，ICLR 2026）。** 修正了一个有据可查的问题：原始 WebArena 存在约 11.3% 的假阴性率（被判为失败、实则已解决的任务）。Verified 版本以人工筛定的成功标准重新评分，并新增了包含 258 个任务的 Hard 子集（ICLR 2026 论文，openreview.net/forum?id=94tlGxmqkN）。

### BrowseComp vs OSWorld vs WebArena

| 基准 | 衡量什么 | 周期 |
|---|---|---|
| BrowseComp | 在时间压力下从开放网络上找出特定事实 | 分钟级 |
| OSWorld | 智能体操作整台桌面（鼠标、键盘、shell） | 数十分钟 |
| WebArena-Verified | 模拟站点中的事务型 Web 任务 | 分钟级 |
| Hard 子集 | 带多页面状态转移的 WebArena-Verified 任务 | 数十分钟 |

它们衡量的是不同的维度。高 BrowseComp 分数说明智能体能找到事实，但不说明它能订机票。OSWorld 分数更接近「它在我的桌面上能不能用」。WebArena-Verified 更接近「它能不能走完一个流程」。任何生产决策都需要选用与任务分布相匹配的基准。

### 指认攻击面

1. **间接提示注入（Indirect prompt injection）。** 不受信任的页面内容包含指令。智能体读取它们，并执行它们。公开案例：2024 年 Kai Greshake 等人的工作、2025 年 Tainted Memories 论文、2026 年 HashJack（Cato Networks）。
2. **URL 片段 / 查询注入。** 被抓取 URL 的 `#fragment` 或查询串中包含命令。从不可见呈现，却仍处于智能体的上下文之内。
3. **记忆绑定攻击（Memory-binding attacks）。** 页面指示智能体写入一条持久化记忆（第 12 课讲述持久状态）。下一次会话中，该记忆会在没有任何可见触发的情况下引爆载荷。
4. **针对已认证会话的 CSRF 形态攻击。** Tainted Memories 这一类：智能体已在某处登录；攻击者的页面发起状态变更请求，智能体带着用户的 cookie 去执行。
5. **一键劫持（One-click hijack）。** 一个视觉上人畜无害的按钮承载着载荷，智能体随之执行。Comet 这一类。
6. **智能体宿主层面的内容安全策略（Content-Security-Policy）漏洞。** 渲染层与工具层本身也可能成为攻击向量；浏览器中嵌浏览器的智能体技术栈面非常宽。

### 为何「无法被完全修补」

这种攻击与智能体的能力是同构的。智能体必须读取不受信任的内容才能完成工作。它读取的任何内容都可能包含指令。它遵循的任何指令都可能与用户的真实请求相背离。各种防御手段（信任边界、分类器、工具白名单、对有实质后果操作的人在回路审批）会抬高攻击成本、缩小爆炸半径，但它们无法消除这一整类攻击。

这与 Löb 定理（第 8 课）的推理范式如出一辙：智能体无法证明下一个 token 是安全的；它只能搭建一个让不安全 token 更易被检测的系统。

### 真正能落地的防御姿态

- **读 / 写边界。** 读取永远没有实质后果。写入（提交表单、发布内容、调用有副作用的工具）若其发起内容来自信任边界之外，则需要重新获得人工审批。
- **每任务工具白名单。** 智能体可以浏览；但除非该工具已为当前任务显式启用，否则它不能发起电汇。第 13 课讲述预算。
- **会话隔离。** 浏览器智能体会话仅以受限范围的凭据运行。不接入生产认证，不接入个人邮箱。每一次 HTTP 请求的日志都保留以备审计。
- **内容净化器（Content sanitizer）。** 抓取到的 HTML 在拼接进模型上下文之前，先剥除已知的恶意模式。（能减少容易的攻击，挡不住老练的载荷。）
- **对有实质后果操作的人在回路（HITL）。** 先提议后提交（propose-then-commit）模式（第 15 课）。
- **记忆金丝雀令牌（Canary tokens）。** 一旦某条记忆被触发，用户能看到它（第 14 课）。

## 动手用

`code/main.py` 针对三个合成页面，对一次微型的浏览器智能体运行进行建模。一个页面是良性的，一个在可见文本中带有直接提示注入的载荷块，一个带有 URL 片段注入（不可见但处于智能体上下文之内）。脚本展示：(a) 一个朴素的智能体会怎么做，(b) 读 / 写边界能拦住什么，(c) 净化器能拦住什么，(d) 两者都拦不住什么。

## 交付它

`outputs/skill-browser-agent-trust-boundary.md` 界定了一项拟议的浏览器智能体部署的范围：它接触哪些信任区、被授权写入什么，以及在首次运行前必须就位的防御措施。

## 练习

1. 运行 `code/main.py`。找出哪种攻击是净化器能拦但读 / 写边界拦不住的，以及哪种攻击只有读 / 写边界才能拦住。

2. 扩展净化器，使其能检测一类 HashJack 风格的 URL 片段注入。在带有合法片段的良性 URL 上测量假阳性率（false-positive rate）。

3. 选一个你熟悉的真实浏览器智能体工作流（例如「订机票」）。列出每一次读和每一次写。标出哪些写入需要 HITL，以及为什么。

4. 阅读 WebArena-Verified 的 ICLR 2026 论文。找出一类原始 WebArena 评分不可靠的任务，并解释 Verified 子集如何解决它。

5. 为一个浏览器智能体场景设计一个记忆金丝雀。你会存什么、存在哪里、什么会触发告警？

## 关键术语

| 术语 | 人们怎么说 | 它实际是什么意思 |
|---|---|---|
| 间接提示注入（Indirect prompt injection） | 「坏的页面文本」 | 智能体所读页面中的不受信任内容包含了智能体会执行的指令 |
| Tainted Memories | 「记忆攻击」 | 智能体把攻击者提供的指令写入持久化记忆；在下一次会话中被触发 |
| HashJack | 「URL 片段攻击」 | 隐藏在 URL 片段 / 查询串中的载荷，处于智能体上下文之内但不被可见呈现 |
| 一键劫持（One-click hijack） | 「坏按钮」 | 可见的操作控件承载着后续载荷，智能体随之执行 |
| BrowseComp | 「网络搜索基准」 | 从开放网络上找出特定事实；分钟级周期 |
| OSWorld | 「桌面基准」 | 完整操作系统控制；多步骤 GUI 任务 |
| WebArena-Verified | 「修正后的 Web 任务基准」 | ServiceNow 重新评分的 WebArena，附带 Hard 子集 |
| 读 / 写边界（Read/write boundary） | 「副作用闸门」 | 读取永无实质后果；若内容超出信任范围，写入需重新审批 |

## 延伸阅读

- [OpenAI — Introducing ChatGPT agent](https://openai.com/index/introducing-chatgpt-agent/) — Operator 与 deep research 的合并；BrowseComp SOTA。
- [OpenAI — Computer-Using Agent](https://openai.com/index/computer-using-agent/) — Operator 的谱系，以及后来演化为 ChatGPT agent 的架构。
- [Zhou et al. — WebArena](https://webarena.dev/) — 最初的基准。
- [WebArena-Verified (OpenReview)](https://openreview.net/forum?id=94tlGxmqkN) — ICLR 2026 修正子集论文。
- [Anthropic — Measuring agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) — 包含针对计算机使用智能体的攻击面讨论。
