# 浏览器 agent 与长链路 Web 任务（Browser Agents and Long-Horizon Web Tasks）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> ChatGPT agent（2025 年 7 月）把 Operator 和 deep research 合并成一个浏览器/终端 agent，并在 BrowseComp 上把 SOTA 推到 68.9%。OpenAI 在 2025 年 8 月 31 日下线了 Operator——产品层面在做收敛。Anthropic 收购 Vercept 后，把 Claude Sonnet 在 OSWorld 上的成绩从不到 15% 拉到 72.5%。WebArena-Verified（ServiceNow，ICLR 2026）修复了原版 WebArena 中 11.3 个百分点的假阴性（false-negative）率，并放出了 258 个任务的 Hard 子集。这些数字是真的。攻击面也是真的：OpenAI 的 preparedness 负责人公开表示，对浏览器 agent 的间接 prompt 注入「不是一个能被完全修补的 bug」。2025–2026 已记录在案的攻击有：Tainted Memories（Atlas CSRF）、HashJack（Cato Networks），以及 Perplexity Comet 中的一键劫持。

**Type:** Learn
**Languages:** Python (stdlib, indirect prompt-injection attack surface model)
**Prerequisites:** Phase 15 · 10 (Permission modes), Phase 15 · 01 (Long-horizon agents)
**Time:** ~45 minutes

## 问题（Problem）

浏览器 agent 是一种长链路 agent，它读取不受信任的内容，并执行有后果的动作。agent 访问的每一个页面都是用户没写过的输入；每个页面上的每一个表单都是潜在的命令通道。2025–2026 的攻击案例库说明这不是假设：Tainted Memories 让攻击者通过精心构造的页面，把恶意指令绑定到 agent 的记忆里；HashJack 把命令藏在 agent 访问过的 URL 片段（fragment）中；Perplexity Comet 的劫持只需一次点击就能命中。

防御侧的图景并不让人舒服。OpenAI 的 preparedness 负责人把那句不愿明说的话说出来了：间接 prompt 注入「不是一个能被完全修补的 bug」。原因在于：攻击栖息在 agent「读」与「做」的边界上，而这条边界在架构上本身就是模糊的——模型读到的每一个 token，原则上都可能被读成一条指令。

本节会点名攻击面、点名 benchmark 全景图（BrowseComp、OSWorld、WebArena-Verified），并对一个最小化的间接 prompt 注入场景进行建模，让你能在第 14 课和第 18 课里推理实际的防御方案。

## 概念（Concept）

### 一段话讲清 2026 年的全景

**ChatGPT agent（OpenAI）。** 2025 年 7 月发布。把 Operator（浏览）与 Deep Research（多小时调研）统一起来。2025 年 8 月 31 日下线了独立的 Operator。在 BrowseComp 上 SOTA 68.9%；在 OSWorld 与 WebArena-Verified 上的数据也很强。

**Claude Sonnet + Vercept（Anthropic）。** Anthropic 收购的 Vercept 专注于 computer-use 能力。把 Claude Sonnet 在 OSWorld 上的成绩从 <15% 提到 72.5%。Claude Computer Use 以工具 API 的形式发布。

**Gemini 3 Pro 加 Browser Use（DeepMind）。** Browser Use 集成提供 computer-use 控制；FSF v3（2026 年 4 月，第 20 课）专门在 ML R&D 领域追踪自主性。

**WebArena-Verified（ServiceNow，ICLR 2026）。** 修了一个有据可查的问题：原版 WebArena 大约有 11.3% 的假阴性率（被标记为失败、但其实已经解决的任务）。Verified 版本用人工筛选的成功标准重新评分，并增加了一个 258 任务的 Hard 子集（ICLR 2026 论文，openreview.net/forum?id=94tlGxmqkN）。

### BrowseComp vs OSWorld vs WebArena

| 基准 | 测的是什么 | 时间尺度 |
|---|---|---|
| BrowseComp | 在时间压力下，到开放 Web 上找到具体事实 | 分钟级 |
| OSWorld | agent 操作完整的桌面（鼠标、键盘、shell） | 几十分钟 |
| WebArena-Verified | 在仿真站点上的事务性 Web 任务 | 分钟级 |
| Hard subset | WebArena-Verified 中跨多页状态切换的任务 | 几十分钟 |

它们度量的是不同维度。BrowseComp 分高，说明 agent 能查到事实；并不说明它能订机票。OSWorld 分更接近「它在我桌面上能不能用」。WebArena-Verified 更接近「它能不能跑完一个流程」。任何生产决策都需要选一个与目标任务分布匹配的 benchmark。

### 给攻击面命名

1. **间接 prompt 注入（Indirect prompt injection）。** 不受信任的页面内容里含指令。agent 读到，agent 执行。公开案例：2024 年 Kai Greshake 等、2025 年 Tainted Memories 论文、2026 年 HashJack（Cato Networks）。
2. **URL 片段 / 查询串注入。** 被爬取 URL 的 `#fragment` 或 query string 里藏有命令。它从来不会被可见地渲染出来；但它仍在 agent 的上下文里。
3. **记忆绑定攻击（Memory-binding attacks）。** 页面让 agent 把一条指令写进持久记忆（第 12 课讲持久状态）。下个会话里，记忆触发 payload，没有任何可见的触发线索。
4. **针对已认证会话的 CSRF 形态攻击。** 即 Tainted Memories 这一类：agent 在某处已登录；攻击者的页面发起会改变状态的请求，agent 拿着用户的 cookie 去执行。
5. **一键劫持（One-click hijack）。** 一个看上去无害的按钮背后挂着 payload，agent 跟着走。即 Comet 那一类。
6. **agent 宿主面上的 Content-Security-Policy 漏洞。** 渲染层和工具层本身都可能成为攻击向量；浏览器套浏览器套 agent 的栈表面非常宽。

### 为什么「无法被完全修补」

这种攻击与 agent 的能力是同构（isomorphic）的。agent 必须读不受信任的内容才能干活。它读的任何内容都可能含指令。它执行的任何指令都可能与用户真正的请求不一致。各种防御（信任边界、分类器、工具 allowlist（白名单）、对有后果动作做 HITL（human-in-the-loop，人工确认））能抬高攻击的成本、缩小爆炸半径。它们不能消除这一类问题。

这与第 8 课讲的 Löb 定理推理模式是同一个：agent 无法证明下一个 token 安全；它能做的只是搭建一个让不安全 token 更容易被检出的系统。

### 真正能上线的防御姿态

- **读 / 写边界。** 「读」永远没有后果。「写」（提交表单、发布内容、调用有副作用的工具）如果发起内容来自信任边界之外，必须重新拿一次人工许可。
- **按任务粒度的工具 allowlist。** agent 可以浏览；除非该任务显式开启了某个工具，否则它不能发起银行转账。第 13 课讲预算。
- **会话隔离。** 浏览器 agent 会话只在被限定范围的凭证下运行。没有生产环境凭证、没有个人邮箱。每次 HTTP 请求的日志都留档以备审计。
- **内容净化器（sanitizer）。** 抓回来的 HTML 在拼进模型上下文之前，先剥掉已知的恶意模式。（能挡掉简单攻击；挡不掉复杂 payload。）
- **对有后果动作做 HITL。** propose-then-commit 模式（第 15 课）。
- **记忆上的 canary token。** 一旦某条记忆被触发，用户能看到（第 14 课）。

## 用起来（Use It）

`code/main.py` 用三个合成页面，对一次极小的浏览器 agent 运行做了建模。一个页面是良性的；一个页面在可见文本里塞了直接 prompt 注入的 blob；还有一个有 URL 片段注入（不可见但在 agent 上下文里）。脚本展示了（a）一个朴素 agent 会怎么干，（b）读/写边界能拦下哪种，（c）净化器能拦下哪种，（d）哪种两者都拦不住。

## 上线部署（Ship It）

`outputs/skill-browser-agent-trust-boundary.md` 给出一份提案中的浏览器 agent 部署的 scope 清单：它会触及哪些信任域、被授权写什么、首次运行前必须就位哪些防御。

## 练习（Exercises）

1. 跑一下 `code/main.py`。指出：哪一种攻击是净化器能抓但读/写边界抓不住的，哪一种攻击是只有读/写边界才能抓住的。

2. 扩展净化器，让它能检出某一类 HashJack 风格的 URL 片段注入。在带有合法 fragment 的良性 URL 上测一下假阳性率（false-positive rate）。

3. 挑一个你熟悉的真实浏览器 agent 工作流（比如「订机票」）。把每一次「读」和每一次「写」都列出来，标出哪些「写」需要 HITL、为什么。

4. 阅读 WebArena-Verified 的 ICLR 2026 论文。指出原版 WebArena 在哪一类任务上的评分是不可靠的，并解释 Verified 子集如何修掉它。

5. 为一个浏览器 agent 场景设计一个记忆 canary。你会存什么、存到哪里、什么条件下触发警报？

## 关键术语（Key Terms）

| 术语 | 一般人怎么说 | 实际含义 |
|---|---|---|
| Indirect prompt injection（间接 prompt 注入） | 「坏页面文本」 | agent 读取的页面里含有不受信任的内容，里面是 agent 会去执行的指令 |
| Tainted Memories | 「记忆攻击」 | agent 把攻击者提供的指令写进持久记忆；下次会话被触发 |
| HashJack | 「URL 片段攻击」 | payload 藏在 URL fragment / query string 里，在 agent 上下文中但不可见地渲染 |
| One-click hijack（一键劫持） | 「坏按钮」 | 可见的交互件背后挂着会被 agent 执行的后续 payload |
| BrowseComp | 「Web 搜索基准」 | 在开放 Web 上找具体事实；分钟级时间尺度 |
| OSWorld | 「桌面基准」 | 全 OS 控制；多步 GUI 任务 |
| WebArena-Verified | 「修过的 Web 任务基准」 | ServiceNow 重打分的 WebArena，含 Hard 子集 |
| Read/write boundary（读/写边界） | 「副作用闸门」 | 读永远没有后果；写如果内容来自信任域外，需要重新拿许可 |

## 延伸阅读（Further Reading）

- [OpenAI — Introducing ChatGPT agent](https://openai.com/index/introducing-chatgpt-agent/) — Operator 与 deep research 的合并；BrowseComp SOTA。
- [OpenAI — Computer-Using Agent](https://openai.com/index/computer-using-agent/) — Operator 的谱系，以及最终演化为 ChatGPT agent 的架构。
- [Zhou et al. — WebArena](https://webarena.dev/) — 原版 benchmark。
- [WebArena-Verified (OpenReview)](https://openreview.net/forum?id=94tlGxmqkN) — ICLR 2026 修订子集的论文。
- [Anthropic — Measuring agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) — 含 computer-use agent 的攻击面讨论。
