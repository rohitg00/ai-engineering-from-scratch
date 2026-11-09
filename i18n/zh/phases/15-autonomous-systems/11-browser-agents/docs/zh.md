# 浏览器代理和长期的网络任务

> 聊天GPT代理 (2025年7月) 将运营商和深度研究合并成一个浏览器/终端代理,设定BrowseComp SOTA为68.9%. 开通AI关闭运营商在2025年8月31日 产品层的整合. 通过安特洛皮克的Vercept收购,OSWorld的Claude Sonnet从15%以下升至72.5%. 根据WebArena-verified (ServiceNow,ICLR 2026) 的规定,本 WebArena 中的误负率为 ~11.3%,并发送了258任务的硬件子集. 这些数字是真实的. 攻击表面也是如此:OpenAI准备部负责人公开表示,直接即时注入浏览器代理"不是一个完全可以修复的错误". 记录的20252026攻击:

**Type:** Learn
**Languages:** Python (stdlib, indirect prompt-injection attack surface model), TypeScript
**Prerequisites:** Phase 15 · 10 (Permission modes), Phase 15 · 01 (Long-horizon agents)
**Time:** ~45 minutes

## 问题

浏览器代理是一个长视线的代理,阅读不值得信赖的内容并采取后果行动. 任何访问的页面都是用户未写的输入. 每个页面上的每一个表格都是一个潜在的命令道. 20252026攻击体显示,这不是假设: 污染记忆允许攻击者通过制作的页面将恶意指示绑定到代理的记忆中; HashJack隐藏命令在代理访问的URL碎片中; 迷彗星劫持者只需单击.

防守图像不舒服.OpenAI的准备负责人说,安静的部分很大声:间接即时注射"不是一个完全可以修复的错误. "这是因为攻击存在于代理的读取与行动边界,这是结构模糊的.

这一课标识了攻击表面,标识了基准景观 (BrowseComp,OSWorld,WebArena-Verified),并建构了最小的间接即时注射情况,以便在14和18课中可以考虑实际的防御.

## 概念

### 系统每段时间,2026年景观

**ChatGPT agent (OpenAI).**启动于2025年7月. 统一运营商 (浏览) 和深度研究 (多小时的研究). 关闭独立运营商2025年8月31日. 浏览Comp上的SOTA为68.9%; OSWorld和WebArena-验证的强数.

**Claude Sonnet + Vercept (Anthropic).**亚洲人体公司的Vercept收购专注于计算机使用能力. 在OSWorld上移动了Claude Sonnet从<15%到72.5%.

**Gemini 3 Pro with Browser Use (DeepMind).**浏览器使用集成器提供计算机使用控制;FSF v3 (2026年4月20课) 专门追踪ML研发领域的自主性.

**WebArena-Verified (ServiceNow, ICLR 2026).**修复一个已被记录的问题:原始WebArena的错误负率为 ~11.3% (标记的任务实际上未能解决).验证版本根据人类策划的成功标准重新评级并添加了258任务的硬件子集 (ICLR 2026论文, openreview.net/forum?id=94tlGxmqkN).

### 浏览Comp VS OS世界 VS WebArena

| Benchmark | What it measures | Horizon |
|---|---|---|
| BrowseComp | Finding specific facts on the open web under time pressure | minutes |
| OSWorld | Agent operating a full desktop (mouse, keyboard, shell) | tens of minutes |
| WebArena-Verified | Transactional web tasks in simulated sites | minutes |
| Hard subset | WebArena-Verified tasks with multi-page state transitions | tens of minutes |

其他轴.一个高的BrowseComp分数表示代理发现事实;它并不说代理可以预订航班.OSWorld分数更接近"它是否在我的桌面上工作".WebArena-Verified更接近"它能完成流动吗?"任何生产决定都需要匹配任务分配的基准.

### 攻击表面,名为

1. **Indirect prompt injection.**网站内容包含指令.代理阅读它们.代理执行它们.公共例子: 2024 Kai Greshake等., 2025 污染记忆论文, 2026 HashJack (Cato Networks).
2. **URL fragment / query injection.**其他`#fragment`查询链接中包含命令. 始终是可见的;仍然存在代理的文本中.
3. **Memory-binding attacks.**页面指示代理写一个持久内存 (课程12涵盖持久状态). 下一个会议,内存将没有可见的触发器的有效载荷发射.
4. **CSRF-shaped attacks on authenticated sessions.**污染记忆类:代理在某个地方登录;攻击者的页面发出了该代理使用用户的cookies执行的状态变化请求.
5. **One-click hijack.**视觉无害的按,将使代理追随的有效载荷.
6. **Content-Security-Policy holes in the agent's host surface.**染和工具层本身可以是攻击向量;浏览器中的浏览器代理堆宽.

### 为什么"不能完全补丁"

攻击对代理人的能力是同形的. 为了做好自己的工作,代理必须阅读不可信的内容. 任何内容,代理阅读可能包含指令. 任何指令,代理遵循可能与用户的实际请求不一致. 防卫 (信任界限,分类器,工具允许器,HITL在后续行动) 增加了攻击的成本,并减少了爆炸射线. 他们不会关闭课堂.

这与洛布定理 (第8课) 的推理模式相同:代理人不能证明下一个代币是安全的;它只能设置一个系统,不安全的代币更容易检测.

### 实际上,这艘船的防御姿势

- **Read / write boundary.**阅读从来没有结果. 写作 (提交表格,发布内容,称呼副作用的工具) 需要新的人的批准,如果启动内容来自信任边界之外.
- **Tool allowlist per task.**经纪人可以浏览,除非该工具明确启用该任务,否则他不能启动转账.
- **Session isolation.**浏览器代理会议只使用限度的凭证,没有制作作者,没有个人电子邮件,每个HTTP请求的日志被保留为审计.
- **Content sanitizer.**带来的HTML在被连接到模型文本中之前被剥夺了已知的坏模式. (减少了轻松的攻击;不阻止了复杂的有效载荷).
- **HITL on consequential actions.**提出,然后承诺的模式 (课 15).
- **Canary tokens on memory.**如果记忆录录录像,用户会看到它 (课 14).

```figure
injection-boundary
```

## 用它

`code/main.py`模型是一个小浏览器代理与三个合成页面进行运行.一页是良性的,一个页面有可见的文本中直接提示注射斑点,一个有一个URL碎片注射 (不可见但在代理的文本中).脚本显示 (a) 一个天真的代理会做什么, (b) 读写界限捕获什么, (c) 净化剂捕获什么, (d) 什么都没有捕获.

## 运送它

`outputs/skill-browser-agent-trust-boundary.md`预计预期的浏览器代理部署范围:它接触到哪些信任区,它被授权写什么,以及在第一次运行之前必须设置哪些防御.

## 运动

1. 跑步`code/main.py`确定哪些攻击物吸收消毒剂,但读写界限没有,以及哪些攻击只吸收读写界限.

2. 扩展消毒剂以检测一个类型的HashJack类型的URL碎片注射. 测量良性URL的虚假阳性率.

3. 选择一个你知道的真实浏览器代理工作流程 (例如"预订飞行").列出每一个读取和写入.

4. 阅读WebArena-verified ICLR 2026论文. 确定一个任务类别,当原始WebArena的分数不可靠,并解释验证子集如何解决它.

5. 设计一个存储器的存储器,为浏览器代理设置设计.

## 关键词

| Term | What people say | What it actually means |
|---|---|---|
| Indirect prompt injection | "Bad page text" | Untrusted content in a page the agent reads contains instructions the agent executes |
| Tainted Memories | "Memory attack" | Agent writes an attacker-supplied instruction to durable memory; triggered next session |
| HashJack | "URL fragment attack" | Payload hidden in URL fragment / query string is in the agent's context but not visibly rendered |
| One-click hijack | "Bad button" | Visible affordance rides a follow-on payload the agent executes |
| BrowseComp | "Web search benchmark" | Finding specific facts on the open web; minute-scale horizon |
| OSWorld | "Desktop benchmark" | Full OS control; multi-step GUI tasks |
| WebArena-Verified | "Fixed web-task benchmark" | ServiceNow's regraded WebArena with Hard subset |
| Read/write boundary | "Side-effect gate" | Reading never consequential; writing requires fresh approval if content is out-of-trust |

## 进一步阅读

- [OpenAI — Introducing ChatGPT agent](https://openai.com/index/introducing-chatgpt-agent/)运营商与深度研究的融合;
- [OpenAI — Computer-Using Agent](https://openai.com/index/computer-using-agent/)运营商后裔和成为ChatGPT代理的架构.
- [Zhou et al. — WebArena](https://webarena.dev/)原始基准.
- [WebArena-Verified (OpenReview)](https://openreview.net/forum?id=94tlGxmqkN) ICLR 2026 固定子集纸.
- [Anthropic — Measuring agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy)包括对计算机使用代理进行攻击表面讨论.
