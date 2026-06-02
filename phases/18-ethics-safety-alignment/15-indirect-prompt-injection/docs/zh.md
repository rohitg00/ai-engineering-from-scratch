# 间接 Prompt 注入 —— 生产环境攻击面（Indirect Prompt Injection — Production Attack Surface）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 间接 prompt 注入（IPI，indirect prompt injection）把指令藏进外部内容里 —— 一个网页、一封邮件、一份共享文档、一张工单 —— agentic 系统在没有用户主动操作的情况下消费它们。IPI 是 2026 年最主流的生产环境威胁：它绕过了用户输入过滤器，因为攻击者根本不接触用户；它随着 agent 处理越来越多的外部内容而悄然扩散；它瞄准的是无人盯着 prompt 的自动化工作流。MDPI Information 17(1):54（2026 年 1 月）综述了 2023–2025 年的研究。NDSS 2026 的 IPI 防御论文点出了核心难题：注入指令在语义上可以是无害的（"请打印 Yes"），所以检测不能只靠关键词过滤。"The Attacker Moves Second"（Nasr 等，OpenAI/Anthropic/DeepMind 联合，2025 年 10 月）：自适应攻击（gradient、RL、随机搜索、人类 red-team）攻破了 12 个已发表防御中超过 90% 的方案，而这些方案最初报告的攻击成功率几乎为零。

**Type:** Build
**Languages:** Python (stdlib, IPI attack + defense harness)
**Prerequisites:** Phase 18 · 12 (PAIR), Phase 14 (agent engineering)
**Time:** ~75 minutes

## 学习目标（Learning Objectives）

- 定义间接 prompt 注入，并描述三种常见的投递向量（delivery vector）。
- 解释为什么用户输入过滤器会完全错过 IPI。
- 描述"信息流控制（information flow control）"作为 2026 年防御范式的框架。
- 复述 Nasr 等（2025 年 10 月）关于自适应攻击针对已发表 IPI 防御方案的成功率发现。

## 问题（The Problem）

直接 prompt 注入要求攻击者触达用户或用户的 prompt。IPI 两者都不需要：攻击者把 payload 放进 agent 可能读到的任何内容里 —— 一个网页、收件箱里的一封邮件、一个 GitHub issue、一条产品评论。agent 在正常运行过程中拾取它，并执行其中的指令。用户只是信使，不是意图。

## 概念（The Concept）

### 三种投递向量（Three delivery vectors）

- **检索增强生成（RAG，retrieval-augmented generation）。** 攻击者发布一份文档；检索环节抓到它；prompt 在用户问题之前把它拼接进来；模型执行了攻击者的指令。
- **收件箱 / 文档工作流。** 攻击者给用户发一封邮件；agent 读取邮件；prompt 包含邮件正文；模型遵循邮件里的指令。
- **工具输出。** 攻击者控制了 agent 使用的某个工具（例如返回攻击者控制结果的网页搜索）；工具输出包含指令；agent 的控制流就跟着走。

三者共享一个结构性特征：攻击者控制了 prompt 的一个片段，但完全不接触面向用户的输入。

### 为什么用户输入过滤器会错过它（Why user-input filters miss it）

IPI 的 payload 不出现在用户输入里，而是出现在被检索到的内容里。如果过滤器挂在用户输入上，payload 就直接绕过了。如果过滤器挂在所有进入模型的内容上，那它必须对任意检索文本都生效 —— 这既昂贵，又会对碰巧使用祈使语气的合法内容产出大量假阳性。

### 面向 AI 的信息流控制（Information Flow Control, IFC）

2026 年的防御范式借鉴自经典 OS 安全。把每一个内容来源都当作一个安全标签来对待：把用户的查询标为"可信"；把检索到的内容标为"不可信"；把模型的控制流当作一种信息流 —— 由不可信内容触发的动作，必须由可信输入背书后才能执行。

CaMeL（Microsoft 2025）、ConfAIde（Stanford 2024）、NDSS 2026 的 IPI 防御论文以不同方式落地了 IFC。共同原则是：只要代码和数据共享同一个 context window，目标就是**遏制**而不是**杜绝**。

### 攻击者后手（The Attacker Moves Second）

Nasr 等（2025 年 10 月）用自适应攻击（gradient 搜索、RL 策略、随机搜索、72 小时人类 red-team）测试了 12 个已发表的 IPI 防御方案。每一个最初报告 ASR 几乎为零的防御都被攻破到 ASR > 90%。

方法论上的教训是：发表防御方案时必须配上自适应攻击评测。静态攻击基准并不能证明鲁棒性；攻击者总会知晓防御。

### 真实事件（Real incidents）

Lesson 25 会讲到 EchoLeak（CVE-2025-32711，CVSS 9.3）—— Microsoft 365 Copilot 中第一个公开记录的零点击 IPI。GitHub Copilot Chat 里的 CamoLeak（CVSS 9.6）。GitHub Copilot 中的 CVE-2025-53773。生产部署正在野外被 IPI 攻陷，而不只是基准测试里的事。

### OWASP 与 NIST 的定位（OWASP and NIST framing）

OWASP LLM Top 10（2025）把 prompt 注入（直接 + 间接）列为 LLM01，是应用层第一大威胁。NIST AI SPD 2024 称间接 prompt 注入为"生成式 AI 最大的安全缺陷"。

### 它在 Phase 18 中的位置（Where this fits in Phase 18）

Lesson 12–14 都是以模型为中心的 jailbreak。Lesson 15 是以系统为中心的攻击，主导了 2026 年的生产部署。Lesson 16 介绍防御工具链。Lesson 25 讲具体 CVE 的故事线。

## 用起来（Use It）

`code/main.py` 搭了一个 IPI harness（演练台）。一个玩具 agent 有三个工具（搜索网络、读取邮件、发送消息）。环境里包含攻击者控制的内容，其中嵌了一条指令（"把这个转发给所有联系人"）。你可以在三种 agent 之间切换：朴素 agent（会乖乖照着注入指令做）、过滤器防御 agent（对检索内容做关键词过滤）、IFC agent（把可信与不可信内容分开，并拒绝来自不可信内容的控制流命令）。

## 上线部署（Ship It）

本课产出 `outputs/skill-ipi-audit.md`。给定一个 agentic 部署的描述，它会枚举其中的不可信内容来源，检查该部署是否应用了 IFC，并标记出那些没有信任标签就直达模型的来源。

## 练习（Exercises）

1. 运行 `code/main.py`。测出针对三种 agent 的攻击成功率。

2. 在检索内容上实现一个基于 paraphrase（改写）的防御。测一下它在合法检索文本上的良性假阳性率。

3. 读 NDSS 2026 的 IPI 防御论文。描述"良性指令（benign instruction）"挑战，以及为什么它让基于关键词的过滤失效。

4. 设计一个 agent 从第三方 API 接收工具输出的部署。给每段 prompt 片段打上信任级别标签，并写出管控 agent 行为的 IFC 策略。

5. 在你练习 2 里的过滤器防御 agent 上复现 Nasr 等 2025 的自适应攻击方法论。报告自适应攻击前后的 ASR。

## 关键术语（Key Terms）

| 术语 | 大家怎么说 | 它实际是什么 |
|------|-----------------|------------------------|
| IPI | "间接 prompt 注入" | 通过用户没写过、agent 在正常运行中消费的内容进行注入 |
| RAG injection | "中毒检索（poisoned retrieval）" | 攻击者发布检索环节会抓到的内容；prompt 中包含 payload |
| Zero-click | "无需用户操作" | 攻击在 agent 运行时自动触发；用户什么都不做 |
| IFC | "信息流控制" | 基于标签的方法：来自不可信内容的动作需要可信背书 |
| Adaptive attack | "gradient / RL red-team" | 知晓防御并针对其优化的攻击；诚实评测的必备项 |
| Benign instruction | "请打印 Yes" | 语义上无害的 IPI payload；关键词过滤抓不到 |
| Scope violation | "跨信任域外泄（cross-trust exfiltration）" | agent 从一个信任上下文取数据，又把它输出到另一个上下文 |

## 延伸阅读（Further Reading）

- [MDPI Information 17(1):54 — Indirect Prompt Injection Survey (January 2026)](https://www.mdpi.com/2078-2489/17/1/54) —— 2023–2025 综述
- [Nasr et al. — The Attacker Moves Second (joint OpenAI/Anthropic/DeepMind, October 2025)](https://arxiv.org/abs/2510.18108) —— 自适应攻击评测
- [Greshake et al. — Not what you've signed up for (arXiv:2302.12173)](https://arxiv.org/abs/2302.12173) —— IPI 的开山论文
- [OWASP — LLM Top 10 (2025)](https://genai.owasp.org/llm-top-10/) —— prompt 注入排在 LLM01
