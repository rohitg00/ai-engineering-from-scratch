# 浏览器智能体与长时程 Web 任务

> ChatGPT agent（2025 年 7 月）将 Operator 和 deep research 合并为一个浏览器/终端智能体，并以 68.9% 的成绩创下 BrowseComp SOTA。OpenAI 于 2025 年 8 月 31 日关闭了 Operator——这是产品层面的整合。Anthropic 收购 Vercept 后，Claude Sonnet 在 OSWorld 上的成绩从不足 15% 提升至 72.5%。WebArena-Verified（ServiceNow，ICLR 2026）修正了原版 WebArena 中 11.3 个百分点的假阴性率，并发布了 258 个任务的 Hard 子集。这些数字是真实的。攻击面同样真实：OpenAI 负责准备工作的负责人曾公开表示，针对浏览器智能体的间接提示注入“不是一个可以完全修补的漏洞”。2025–2026 年已有记录的攻击包括：Tainted Memories（Atlas CSRF）、HashJack（Cato Networks），以及 Perplexity Comet 中的单次点击劫持。

**Type:** Learn
**Languages:** Python（标准库，间接提示注入攻击面模型）
**Prerequisites:** Phase 15 · 10（Permission modes）、Phase 15 · 01（Long-horizon agents）
**Time:** 约 45 分钟

## 问题所在

浏览器智能体是一种读取不可信内容并执行重大后果动作的长时程智能体。智能体访问的每一个页面都是用户未曾编写的输入。每个页面上的每个表单都是潜在的命令通道。2025–2026 年的攻击语料库表明这并非假设：Tainted Memories 让攻击者通过精心构造的页面将恶意指令绑定到智能体的记忆中；HashJack 把命令藏进智能体访问的 URL 片段里；Perplexity Comet 劫持只需一次点击。

防御态势令人不安。OpenAI 负责准备工作的负责人把不便言明的话说得很直白：间接提示注入“不是一个可以完全修补的漏洞”。这是因为攻击存在于智能体“读取与执行”的边界上，而这一边界在架构上是模糊的——模型读取的每一个 token，原则上都可能被当作指令。

本课将指明攻击面，梳理基准测试格局（BrowseComp、OSWorld、WebArena-Verified），并建模一个最小化的间接提示注入场景，以便你在第 14 课和第 18 课中推理真实防御方案。

## 核心概念

### 2026 年格局：每个系统一段话

**ChatGPT agent（OpenAI）。** 2025 年 7 月发布。统一了 Operator（浏览）和 Deep Research（多小时研究）。2025 年 8 月 31 日关闭独立的 Operator。以 68.9% 创下 BrowseComp SOTA；在 OSWorld 和 WebArena-Verified 上成绩强劲。

**Claude Sonnet + Vercept（Anthropic）。** Anthropic 收购 Vercept 聚焦于计算机使用能力。使 Claude Sonnet 在 OSWorld 上的成绩从 <15% 提升至 72.5%。Claude Computer Use 以工具 API 形式提供。

**Gemini 3 Pro with Browser Use（DeepMind）。** Browser Use 集成提供计算机使用控制；FSF v3（2026 年 4 月，第 20 课）专门追踪 ML R&D 领域的自主性。

**WebArena-Verified（ServiceNow，ICLR 2026）。** 修复了一个有据可查的问题：原版 WebArena 有约 11.3% 的假阴性率（实际已解决的任务被标记为失败）。Verified 版本以人工审定的成功标准重新评分，并新增一个 258 个任务的 Hard 子集（ICLR 2026 论文，openreview.net/forum?id=94tlGxmqkN）。

### BrowseComp vs OSWorld vs WebArena

| 基准 | 衡量内容 | 时程 |
|---|---|---|
| BrowseComp | 在时间压力下从开放网络中查找特定事实 | 分钟级 |
| OSWorld | 智能体操作完整桌面（鼠标、键盘、shell） | 数十分钟 |
| WebArena-Verified | 模拟站点中的事务性 Web 任务 | 分钟级 |
| Hard 子集 | 具有多页面状态转换的 WebArena-Verified 任务 | 数十分钟 |

各维度不同。高 BrowseComp 分数说明智能体能查找事实，并不说明它能订机票。OSWorld 分数更接近“在我桌面上能不能用”。WebArena-Verified 更接近“能不能完成一个流程”。任何生产决策都需要与任务分布匹配的基准测试。

### 攻击面的命名

1. **间接提示注入。** 不可信的页面内容中包含指令。智能体读取它们。智能体执行它们。公开示例：2024 年 Kai Greshake 等人、2025 年 Tainted Memories 论文、2026 年 HashJack（Cato Networks）。
2. **URL 片段 / 查询参数注入。** 被爬取 URL 的 `#fragment` 或查询字符串中包含命令。从不可见渲染，但仍在智能体的上下文之中。
3. **记忆绑定攻击。** 页面指示智能体写入一条持久记忆（第 12 课讲解持久状态）。下一个会话中，该记忆会在没有任何可见触发条件的情况下触发载荷。
4. **针对已认证会话的 CSRF 型攻击。** Tainted Memories 类别：智能体在某处已登录；攻击者的页面发起改变状态的请求，智能体使用用户的 cookie 执行这些请求。
5. **单次点击劫持。** 一个视觉上无害的按钮承载了智能体会遵循的载荷。Comet 类别。
6. **智能体宿主界面中的 Content-Security-Policy 漏洞。** 渲染层和工具层本身可能成为攻击向量；浏览器套浏览器智能体的技术栈面很宽。

### 为什么“无法完全修补”

攻击与智能体的能力同构。智能体必须读取不可信内容才能完成工作。智能体读取的任何内容都可能包含指令。智能体遵循的任何指令都可能偏离用户的实际请求。防御手段（信任边界、分类器、工具白名单、对重大后果动作的 HITL）会提高攻击成本并缩小影响范围，但无法关闭整个攻击类别。

这与 Lob 定理（第 8 课）是同一种推理模式：智能体无法证明下一个 token 是安全的，只能构建一个让不安全 token 更容易被发现的系统。

### 真正落地的防御姿态

- **读 / 写边界。** 读取永远不产生后果。写入（提交表单、发布内容、调用有副作用的工具）在发起内容来自信任边界之外时，需要新的人类批准。
- **按任务的工具白名单。** 智能体可以浏览；除非该任务显式启用了电汇工具，否则不能发起电汇。第 13 课讲解预算。
- **会话隔离。** 浏览器智能体会话仅使用限定范围的凭证运行。不用生产环境认证，不用个人邮箱。保留每个 HTTP 请求的日志以供审计。
- **内容净化器。** 抓取的 HTML 在拼接进模型上下文之前，先剥离已知恶意模式。（减少简单攻击；无法阻止复杂载荷。）
- **重大后果动作的 HITL。** 提议-提交模式（第 15 课）。
- **记忆上的金丝雀标记。** 一旦某条记忆触发，用户即可看到（第 14 课）。

```figure
injection-boundary
```

## 动手使用

`code/main.py` 模拟一次针对三个合成页面的微型浏览器智能体运行。一个页面是良性的，一个在可见文本中包含直接提示注入块，一个包含 URL 片段注入（不可见但在智能体的上下文中）。脚本展示 (a) 朴素的智能体会做什么，(b) 读/写边界能拦截什么，(c) 净化器能拦截什么，(d) 两者都拦截不了什么。

## 上线部署

`outputs/skill-browser-agent-trust-boundary.md` 界定一个拟议的浏览器智能体部署：它触及哪些信任区域、被授权写入什么，以及在首次运行前必须落实哪些防御。

## 练习

1. 运行 `code/main.py`。指出净化器能拦截而读/写边界不能拦截的攻击，以及只有读/写边界才能拦截的攻击。

2. 扩展净化器以检测一类 HashJack 式的 URL 片段注入。在带有合法片段的良性 URL 上测量假阳性率。

3. 选一个你熟悉的真实浏览器智能体工作流（例如“订机票”）。列出每一次读取和每一次写入。标注哪些写入需要 HITL 以及原因。

4. 阅读 WebArena-Verified ICLR 2026 论文。找出一类原版 WebArena 评分不可靠的任务，并解释 Verified 子集如何解决该问题。

5. 为浏览器智能体场景设计一个记忆金丝雀。你会存储什么、存储在哪里、什么触发警报？

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|---|---|---|
| 间接提示注入 | “恶意页面文本” | 智能体读取的页面中，不可信内容包含智能体会执行的指令 |
| Tainted Memories | “记忆攻击” | 智能体将攻击者提供的指令写入持久记忆；在下个会话中触发 |
| HashJack | “URL 片段攻击” | 藏在 URL 片段 / 查询字符串中的载荷存在于智能体的上下文中但不可见渲染 |
| 单次点击劫持 | “恶意按钮” | 可见的界面元素承载了智能体会执行的后续载荷 |
| BrowseComp | “网页搜索基准” | 从开放网络中查找特定事实；分钟级时程 |
| OSWorld | “桌面基准” | 完整操作系统控制；多步骤 GUI 任务 |
| WebArena-Verified | “修正后的 Web 任务基准” | ServiceNow 重新评分的 WebArena，含 Hard 子集 |
| 读/写边界 | “副作用门控” | 读取永不产生后果；内容越出信任边界时，写入需要新的批准 |

## 延伸阅读

- [OpenAI — Introducing ChatGPT agent](https://openai.com/index/introducing-chatgpt-agent/) — Operator 与 deep research 的合并；BrowseComp SOTA。
- [OpenAI — Computer-Using Agent](https://openai.com/index/computer-using-agent/) — Operator 的技术脉络以及后来演变为 ChatGPT agent 的架构。
- [Zhou et al. — WebArena](https://webarena.dev/) — 原版基准测试。
- [WebArena-Verified (OpenReview)](https://openreview.net/forum?id=94tlGxmqkN) — ICLR 2026 修正子集论文。
- [Anthropic — Measuring agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) — 包含针对计算机使用智能体的攻击面讨论。