# 多模态 agent 与 computer-use（综合项目）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 2026 年的前沿产品形态是一种多模态 agent：读截图、点按钮、在 web UI 里穿梭、填表单，端到端地把一整套工作流跑完。SeeClick 和 CogAgent（2024）证明了 GUI grounding（图形界面定位）这个原语；Ferret-UI 把它带到了移动端；ChartAgent 引入了面向图表的 visual tool use（视觉工具调用）。VisualWebArena 和 AgentVista（2026）是当下前沿模型追赶的基准——即便是 Gemini 3 Pro 和 Claude Opus 4.7，在 AgentVista 的难任务上也只有约 30%。本综合项目把 Phase 12 的所有线头汇总起来：感知（高分辨率 VLM）、推理（带 tool use 的 LLM）、grounding（输出坐标）、long-horizon（长链路）记忆，以及评估。

**Type:** Capstone
**Languages:** Python (stdlib, action schema + agent loop skeleton)
**Prerequisites:** Phase 12 · 05 (LLaVA), Phase 12 · 09 (Qwen-VL JSON), Phase 14 (Agent Engineering)
**Time:** ~240 minutes

## 学习目标（Learning Objectives）

- 设计多模态 agent loop：感知 → 推理 → 行动 → 观察 → 循环。
- 构建一套 GUI grounding 的输出 schema（点击坐标、输入文本、滚动、拖拽），让 VLM 能以 JSON 形式吐出。
- 比较纯截图 agent、accessibility-tree agent 与混合 agent。
- 在 VisualWebArena 的小切片上搭一套多模态 agent 基准评估。

## 问题（Problem）

一个订票网站的工作流：「帮我订一张 4 月 15 日去东京的机票，靠过道，800 美元以下。」

一个多模态 agent 需要：

1. 截一张浏览器的截图。
2. 把「截图 + URL + 目标」解析成计划。
3. 输出一个结构化的 action：点击 (x, y)、在元素 E 处输入 "Tokyo"、向下滚动、选中（单选按钮）。
4. 把这个 action 应用到浏览器。
5. 观察新状态（下一张截图）。
6. 重复，直到任务完成。

每一步都是一次多模态 VLM 调用。VLM 的输出必须是可解析的 JSON。错误会跨步骤累积，所以恢复机制很重要。

## 概念（Concept）

### GUI grounding——这个原语（GUI grounding — the primitive）

GUI grounding 就是：给一张截图和一条自然语言指令，输出该点击的 (x, y) 坐标（或其他动作）。

SeeClick（arXiv:2401.10935）是第一个有规模的开源结果：在合成 + 真实 GUI 数据上微调一个 VLM，让它把坐标作为普通文本 token 输出。这一招可行。

CogAgent（arXiv:2312.08914）加上了 1120x1120 的高分辨率编码，用来吃下密集 UI。得分：网页导航约 84%。

Ferret-UI（arXiv:2404.05719）聚焦移动端 UI，集成了 iOS accessibility 数据。

输出格式通常是 JSON：

```json
{"action": "click", "x": 384, "y": 220, "element_desc": "Search button"}
```

`element_desc` 有助于恢复：当坐标在不同截图之间漂移时，这个语义提示能让系统重新 grounding。

### Action schema（Action schemas）

一份典型的 action schema 有 6-10 种动作类型：

- `click`：(x, y)
- `type`：(text, x?, y?)
- `scroll`：(direction, amount)
- `drag`：(x0, y0, x1, y1)
- `select`：(option_index)
- `hover`：(x, y)
- `navigate`：(url)
- `wait`：(ms)
- `done`：(success, explanation)

Agent 每一步发出一个 action。浏览器封装层执行它，并返回新状态。

### 纯截图 vs accessibility-tree（Screenshot-only vs accessibility-tree）

两种输入模式：

- 纯截图：完整图像，没有结构化信息。最通用；任何 app 都能用。
- Accessibility tree：结构化 DOM / iOS accessibility 信息。grounding 可靠得多；前提是这棵树能拿到。
- 混合：两者都用，把树作为原子动作的可靠 grounder（定位器），把截图作为语义上下文。

生产级 agent 在条件允许时一律走混合模式。浏览器自动化（Selenium + accessibility）总能拿到树；桌面 app 则要看情况。

### Long-horizon（长链路）记忆（Long-horizon memory）

一个 20 步的工作流会产生 20 张截图。VLM 的 context window（上下文窗口）很快就被塞满。三种压缩策略：

- Summary-chain（摘要链）：每 5 步做一次「至今发生了什么」的总结，丢掉旧截图。
- Skip-frame（跳帧）：保留首张、末张，以及每隔 3 张保留一张。
- Tool-recorded log（工具日志）：执行 action，把做过什么写入文本日志；不再回看旧截图。

Claude 的 computer-use API 用的就是日志模式。更简单，也更可靠。

### Visual tool use（视觉工具调用）（Visual tool use）

ChartAgent（arXiv:2510.04514）为图表理解引入了 visual tool use：裁剪、放大、OCR、调用外部检测。Agent 可以输出「裁剪到区域 (100, 200, 300, 400) 然后调用 OCR」这样的 tool call。工具返回文本；VLM 继续推理。

这个套路可以推广：set-of-mark prompting（标记集合提示）、区域标注、外部检测工具，统统能套进同一个「输出一个 tool call，收到一个结构化响应」的 schema 里。

### 2026 年的几个基准（The 2026 benchmarks）

- ScreenSpot-Pro。约 1k 张网页截图上的 GUI grounding。开源 SOTA 是 Qwen2.5-VL-72B 约 85%。前沿约 90%。
- VisualWebArena。端到端的 web 任务（电商、论坛、分类信息）。开源 SOTA 约 20%。Gemini 3 Pro 约 27%。
- AgentVista（arXiv:2602.23166）。2026 年最难的基准。覆盖 12 个领域的真实工作流。前沿模型得分 27-40%；开源模型 10-20%。
- WebArena / WebShop。更老的基准；已被前沿模型吃透。

### 为什么它依然很难（Why it's still hard）

Agent 性能的瓶颈：

1. 细粒度的视觉 grounding。「点那个小 X」在移动端分辨率下经常失败。
2. Long-horizon 规划。10 个 action 之后，agent 就开始偏离目标了。
3. 错误恢复。点击失败（点到了错的按钮）时，「检测到 + 恢复」很少出现在训练数据里。
4. 跨页上下文。在多个 tab 之间跳转或填长表单时，状态会丢失。

研究方向：记忆架构、显式 replanning、多模态验证（用截图比对来确认 action 是否成功）。

### 综合项目要做的事（The capstone build-it）

综合项目的任务：构建一个 computer-use agent，它要：

1. 读入一个订票网站 mock 页面的 HTML + 截图。
2. 规划一段多步序列：搜索 → 选择 → 填表 → 提交。
3. 输出符合 action schema 的 JSON action。
4. 在固定的 10 个任务切片上做评估。

本课提供了脚手架代码，方便扩展成真正的浏览器。

## 用起来（Use It）

`code/main.py` 是综合项目的脚手架：

- Action schema 的 JSON 定义（10 种 action）。
- 用 dict 表示的 mock 浏览器状态。
- Agent loop 骨架：接收状态、发出 action、应用、循环。
- 10 个任务的 mini-benchmark（合成页面），用于度量端到端成功率。
- 当 action 失败时的错误恢复 hook。

## 上线部署（Ship It）

本课产出 `outputs/skill-multimodal-agent-designer.md`。给定一个 computer-use 产品（领域、action 集合、评估目标），它会设计出完整的 agent loop、记忆策略、grounding 模式以及预期的基准分数。

## 练习（Exercises）

1. 给 action schema 扩展一个 `screenshot_region` 工具（裁剪 + 放大）。哪类任务会受益？

2. 读 AgentVista（arXiv:2602.23166）。描述最难的那一类任务，以及前沿模型在它上面仍然失败的原因。

3. Long-horizon 记忆压缩：设计一条 summary-chain，活跃保留 ≤4 张截图，日志数量不限。

4. 构建错误恢复 hook：当 action 失败（按钮没找到），agent 下一步该做什么？

5. 在 10 个 web 任务上比较纯截图模式的 Claude 4.7 与混合「截图 + accessibility-tree」模式的 Qwen2.5-VL。哪种模式在哪些任务上更胜一筹？

## 关键术语（Key Terms）

| 术语 | 大家嘴上是怎么说的 | 它实际是什么 |
|------|-----------------|------------------------|
| GUI grounding | 「点击坐标」 | 模型针对一张截图上的指令目标输出 (x, y) |
| Action schema | 「工具定义」 | 用 JSON 描述合法的动作（click、type、scroll、drag） |
| Accessibility tree | 「结构化 DOM」 | 来自浏览器 / iOS API 的机器可读 UI 层级 |
| 混合 agent | 「截图 + tree」 | 同时用图像和结构化信息；比单独用任何一种都更可靠 |
| Visual tool use | 「放大 / 裁剪 / 检测」 | Agent 在规划途中调用外部视觉工具（OCR、检测） |
| Summary-chain | 「记忆压缩」 | 用周期性的文本摘要替代长长的截图历史 |
| VisualWebArena | 「端到端 web 基准」 | 2024 年的端到端 web 任务基准 |
| AgentVista | 「2026 难基准」 | 12 个领域的真实工作流；连 Gemini 3 Pro 也只有约 30% |

## 延伸阅读（Further Reading）

- [Cheng et al. — SeeClick (arXiv:2401.10935)](https://arxiv.org/abs/2401.10935)
- [Hong et al. — CogAgent (arXiv:2312.08914)](https://arxiv.org/abs/2312.08914)
- [You et al. — Ferret-UI (arXiv:2404.05719)](https://arxiv.org/abs/2404.05719)
- [ChartAgent (arXiv:2510.04514)](https://arxiv.org/abs/2510.04514)
- [Koh et al. — VisualWebArena (arXiv:2401.13649)](https://arxiv.org/abs/2401.13649)
- [AgentVista (arXiv:2602.23166)](https://arxiv.org/abs/2602.23166)
