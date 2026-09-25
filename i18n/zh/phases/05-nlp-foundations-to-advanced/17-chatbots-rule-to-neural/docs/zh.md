# 聊天机器人 — 从规则到神经网络再到 LLM 智能体

> ELIZA 用模式匹配来回复。DialogFlow 做意图映射。GPT 从权重中生成答案。Claude 运行工具并进行验证。每个时代都解决了上一个时代最糟糕的失败。

**Type:** Learn
**Languages:** Python
**Prerequisites:** Phase 5 · 13（问答），Phase 5 · 14（信息检索）
**Time:** 约 75 分钟

## 问题

用户说“我想改签航班。”系统必须弄清楚用户想要什么、缺少什么信息、如何获取这些信息，以及如何完成操作。然后用户说“等等，如果我取消预订呢？”，系统必须记住上下文、切换任务并保持状态。

对话对 ML 系统来说很难。输入是开放式的。输出必须在多轮对话中保持连贯。系统可能需要对现实世界执行操作（改签航班、扣款）。每一步错误对用户都清晰可见。

聊天机器人架构经历了四种范式的循环，每种范式的出现都是因为前一种范式的失败过于明显。本课按顺序讲解这些范式。2026 年的生产环境是后两种范式的混合体。

## 概念

![Chatbot evolution: rule-based → retrieval → neural → agent](../assets/chatbot.svg)

### 脚本化的半个世纪，1950-2001

第一种范式没有只持续五年，而是持续了五十年。了解它的发展轨迹很重要，因为其中的每个系统都是同一台机器——匹配输入、输出预设响应、更新少量状态——而五十年间向这台机器不断添加规则，始终没能产生通用能力。正是这个天花板催生了第二至第四种范式。

**1950 年。** Turing 通过提出一个操作性替代方案绕开了“机器能思考吗”的问题：如果审问者无法通过电传打字机区分机器和人，那么这个哲学问题就变得无关紧要。在这个领域还没有名字之前，对话就已经成为它的基准。

**1956 年。** 名字出现了——达特茅斯的夏季研讨会创造了“人工智能”一词，其假设是智能的每个特征“原则上都可以被足够精确地描述，以至于可以制造机器来模拟它”。该提案为取得实质性进展预算了两个月时间。

**1966 年。** ELIZA 实现了你在第 1 步中构建的反射技巧：分解规则从输入中提取片段，重组规则将它们作为问题回显。总共约 200 个模式，零状态，零理解——而用户还是向它倾诉了心声。Weizenbaum 余下的职业生涯都在为如此少的机制竟能产生如此效果而感到不安。

**1972 年。** PARRY 由斯坦福构建用于模拟偏执，它加入了 ELIZA 所缺失的部分：内部状态。表示恐惧、愤怒和怀疑的数值变量在每一轮中更新，并控制接下来触发哪个脚本，因此相同的输入会根据之前的对话产生不同的响应。在一项盲测转录实验中，精神病医生区分 PARRY 和人类患者的准确率仅相当于随机猜测。它是人格条件化的直接祖先——一个用三个浮点数实现的系统提示词。同年，这两个机器人通过 ARPANET 相互对话：一个治疗师脚本在采访一个偏执状态机，这是网络上第一次机器人对机器人的对话。

**1995 年。** ALICE 用 AIML 扩展了 ELIZA 的配方，AIML 是一种用于模式-模板对的 XML 方言。大约 40,000 个手写类别，三次 Loebner 奖获奖。它证明了基于规则的系统的扩展定律：更多规则只能买来覆盖率，永远买不来通用性。每条规则都是有人必须维护的负债。

**2001 年。** SmarterChild 把这个配方带到了 3000 万即时通讯用户面前，并加入后端查询——天气、股票、电影时刻表——拼接进模板中。眯起眼看，这就是穿着 2001 年戏服的工具调用：解析意图，调用服务，把结果渲染进回复。

五十年，一种机制，规则数量不断攀升。这个范式的终结不是因为有人推翻了它，而是因为手写状态机的维护成本随覆盖率线性增长，而用户期望则随着他们上周看到的任何东西而增长。

```figure
chatbot-lineage
```

**基于规则（ELIZA、AIML、DialogFlow）。** 手写的模式匹配用户输入并生成响应。意图分类器路由到预定义的流程。槽填充状态机收集所需信息。在其设计的狭窄范围内表现出色，超出范围立即失效。仍在不容忍幻觉的安全关键领域（银行身份验证、航空订票）中使用。

**基于检索。** 一种 FAQ 式系统。编码每一对（话语，响应）。运行时，编码用户的消息并检索最接近的已存储响应。想想 Zendesk 经典的“相似文章”功能。对改述的处理比规则更好。没有生成，因此没有幻觉。

**神经网络（seq2seq）。** 在对话日志上训练的编码器-解码器。从零生成响应。流畅但容易产生通用输出（“我不知道”）和事实漂移。从不稳定地切题。这就是 Google、Facebook 和微软在 2016-2019 年间的聊天机器人都不尽如人意的原因。

**LLM 智能体。** 被包裹在一个循环中的语言模型，该循环进行规划、调用工具并验证结果。不是一个带着长提示词的聊天机器人，而是一个智能体循环：规划 → 调用工具 → 观察结果 → 决定下一步。以检索为先的接地（RAG）防止它产生幻觉。工具调用让它能真正做事。这是 2026 年的架构。

四种范式并非依次取代。2026 年的生产聊天机器人会经过全部四种：规则用于身份验证和破坏性操作，检索用于 FAQ，神经网络生成用于自然措辞，LLM 智能体用于模糊的开放式查询。

## 构建它

### 第 1 步：基于规则的模式匹配

```python
import re


class RulePattern:
    def __init__(self, pattern, response_template):
        self.regex = re.compile(pattern, re.IGNORECASE)
        self.template = response_template


PATTERNS = [
    RulePattern(r"my name is (\w+)", "Nice to meet you, {0}."),
    RulePattern(r"i (need|want) (.+)", "Why do you {0} {1}?"),
    RulePattern(r"i feel (.+)", "Why do you feel {0}?"),
    RulePattern(r"(.*)", "Tell me more about that."),
]


def rule_based_respond(user_input):
    for pattern in PATTERNS:
        m = pattern.regex.match(user_input.strip())
        if m:
            return pattern.template.format(*m.groups())
    return "I don't understand."
```

20 行代码的 ELIZA。反射技巧（“I feel sad” → “Why do you feel sad”）是 Weizenbaum 1966 年经典的心理治疗师演示。至今仍有启发意义。

### 第 2 步：基于检索（FAQ）

这个说明性代码片段需要 `pip install sentence-transformers`（它会引入 torch）。本课可运行的 `code/main.py` 使用标准库的 Jaccard 相似度，因此课程运行无需外部依赖。

```python
from sentence_transformers import SentenceTransformer
import numpy as np


FAQ = [
    ("how do i reset my password", "Go to Settings > Security > Reset Password."),
    ("how do i cancel my order", "Go to Orders, find the order, click Cancel."),
    ("what is your return policy", "30-day returns on unused items, original packaging."),
]


encoder = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")
faq_questions = [q for q, _ in FAQ]
faq_embeddings = encoder.encode(faq_questions, normalize_embeddings=True)


def faq_respond(user_input, threshold=0.5):
    q_emb = encoder.encode([user_input], normalize_embeddings=True)[0]
    sims = faq_embeddings @ q_emb
    best = int(np.argmax(sims))
    if sims[best] < threshold:
        return None
    return FAQ[best][1]
```

基于阈值的拒答是关键设计选择。如果最佳匹配不够接近，返回 `None` 并让系统升级处理。

### 第 3 步：神经网络生成（基线）

使用一个小型指令微调的编码器-解码器（FLAN-T5）或微调过的对话模型。在 2026 年，单独使用无法投入生产（自相矛盾、跑题漂移、事实胡说），但在混合系统中用于自然措辞。DialoGPT 风格的仅解码器模型需要显式的轮次分隔符和 EOS 处理才能生成连贯的回复；FLAN-T5 的 text2text 管道则开箱即用，适合教学示例。

```python
from transformers import pipeline

chatbot = pipeline("text2text-generation", model="google/flan-t5-small")

response = chatbot("Respond politely to: Hi there!", max_new_tokens=40)
print(response[0]["generated_text"])
```

### 第 4 步：LLM 智能体循环

2026 年的生产形态：

```python
def agent_loop(user_message, tools, llm, max_steps=5):
    history = [{"role": "user", "content": user_message}]
    for _ in range(max_steps):
        response = llm(history, tools=tools)
        tool_call = response.get("tool_call")
        if tool_call:
            tool_name = tool_call.get("name")
            args = tool_call.get("arguments")
            if not isinstance(tool_name, str) or tool_name not in tools:
                history.append({"role": "assistant", "tool_call": tool_call})
                history.append({"role": "tool", "name": str(tool_name), "content": f"error: unknown tool {tool_name!r}"})
                continue
            if not isinstance(args, dict):
                history.append({"role": "assistant", "tool_call": tool_call})
                history.append({"role": "tool", "name": tool_name, "content": f"error: arguments must be a dict, got {type(args).__name__}"})
                continue
            fn = tools[tool_name]
            result = fn(**args)
            history.append({"role": "assistant", "tool_call": tool_call})
            history.append({"role": "tool", "name": tool_name, "content": result})
        else:
            return response["content"]
    return "I could not complete the task in the step budget."
```

三个需要命名的要点。工具是 LLM 可以调用的函数。当 LLM 返回最终答案而不是工具调用时，循环终止。步骤预算防止在模糊任务上出现无限循环。

实际生产中还要增加：以检索为先的接地（在每次 LLM 调用前注入相关文档）、护栏（未经确认拒绝破坏性操作）、可观测性（记录每一步）以及评估（自动检查智能体行为是否符合规范）。

### 第 5 步：混合路由

```python
def hybrid_chat(user_input):
    if is_destructive_action(user_input):
        return structured_flow(user_input)

    faq_answer = faq_respond(user_input, threshold=0.6)
    if faq_answer:
        return faq_answer

    return agent_loop(user_input, tools, llm)


def is_destructive_action(text):
    danger_words = ["delete", "cancel", "charge", "refund", "transfer"]
    return any(w in text.lower() for w in danger_words)
```

模式是：任何破坏性操作使用确定性规则，预设 FAQ 使用检索，其他一切使用 LLM 智能体。这就是 2026 年客服系统中实际部署的方案。

## 使用它

2026 年的技术栈：

| 使用场景 | 架构 |
|---------|---------------|
| 预订、支付、身份验证 | 基于规则的状态机 + 槽填充 |
| 客服 FAQ | 对精选答案进行检索 |
| 开放式帮助聊天 | 带 RAG + 工具调用的 LLM 智能体 |
| 内部工具 / IDE 助手 | 带工具调用（搜索、读取、写入）的 LLM 智能体 |
| 陪伴 / 角色聊天机器人 | 带人格系统提示词的微调 LLM，知识检索 |

在生产环境中始终使用混合路由。没有单一架构能很好地处理所有请求。路由层本身通常是一个小型意图分类器。

## 仍然上线运行的失败模式

- **自信的捏造。** LLM 智能体声称完成了它并未完成的操作。缓解措施：验证结果、记录工具调用，在没有成功的工具返回时绝不允许 LLM 声称完成某事。
- **提示词注入。** 用户插入覆盖系统提示词的文本。在 OWASP 2025 年 LLM 应用 Top 10 中排名第一（LLM01）。两种形式：直接注入（粘贴到聊天中）和间接注入（隐藏在智能体读取的文档、电子邮件或工具输出中）。

  攻击成功率因场景而异。在通用工具使用和编码基准中，各前沿模型的测量成功率约为 0.5-8.5%。特定的高风险配置（针对 AI 编码智能体的自适应攻击、存在漏洞的编排）曾达到约 84%。生产环境的 CVE 包括 EchoLeak（CVE-2025-32711，CVSS 9.3）——Microsoft 365 Copilot 中由攻击者控制的电子邮件触发的零点击数据泄露漏洞。

  缓解措施：在整个循环中将用户输入视为不可信；在工具调用前进行净化；将工具输出与主提示词隔离；使用“规划-验证-执行”（PVE）模式，即智能体先规划，然后在执行前根据该计划验证每个动作（这可以阻止工具结果注入新的未计划动作）；对破坏性操作要求用户确认；对工具权限应用最小特权原则。

  再多的提示词工程也无法完全消除这一风险。必须部署外部运行时防御层（LLM Guard、允许列表验证、语义异常检测）。
- **范围蔓延。** 智能体因为某个工具调用返回了间接相关的信息而偏离任务。缓解措施：收紧工具契约；保持系统提示词聚焦；为偏离任务率增加评估。
- **无限循环。** 智能体不断调用同一个工具。缓解措施：步骤预算、工具调用去重、由 LLM 判断“我们是否在取得进展”。
- **上下文窗口耗尽。** 长对话将最早的轮次挤出上下文。缓解措施：总结较早的轮次、按相似度检索相关的过往轮次，或使用长上下文模型。

## 部署它

保存为 `outputs/skill-chatbot-architect.md`：

```markdown
---
name: chatbot-architect
description: Design a chatbot stack for a given use case.
version: 1.0.0
phase: 5
lesson: 17
tags: [nlp, agents, chatbot]
---

Given a product context (user need, compliance constraints, available tools, data volume), output:

1. Architecture. Rule-based, retrieval, neural, LLM agent, or hybrid (specify which paths go where).
2. LLM choice if applicable. Name the model family (Claude, GPT-4, Llama-3.1, Mixtral). Match to tool-use quality and cost.
3. Grounding strategy. RAG sources, retrieval method (see lesson 14), tool contracts.
4. Evaluation plan. Task success rate, tool-call correctness, off-task rate, hallucination rate on held-out dialogs.

Refuse to recommend a pure-LLM agent for any destructive action (payments, account deletion, data modification) without a structured confirmation flow. Refuse to skip the prompt-injection audit if the agent has write access to anything.
```

## 练习

1. **简单。** 为一个咖啡店点单机器人实现上面带 10 个模式的基于规则的 respond。测试边界情况：重复下单、修改订单、取消、意图不明。
2. **中等。** 构建一个带 LLM 兜底的混合 FAQ 系统。为一个 SaaS 产品准备 50 条预设 FAQ 条目，LLM 兜底配合对文档网站的检索。在 100 个真实客服问题上测量拒答率和准确率。
3. **困难。** 用三个工具（search、read-user-data、send-email）实现上面的智能体循环。运行包含提示词注入尝试在内的 50 个测试场景的评估。报告偏离任务率、任务失败率以及任何注入成功案例。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|-----------------------|
| Intent | 用户想要什么 | 分类标签（book_flight、reset_password）。路由到处理程序。 |
| Slot | 一条信息 | 机器人需要的参数（日期、目的地）。槽填充是一系列询问的序列。 |
| RAG | 检索加生成 | 检索相关文档，然后为 LLM 的响应提供接地。 |
| Tool call | 函数调用 | LLM 发出带名称 + 参数的结构化调用。运行时执行并返回结果。 |
| Agent loop | 规划、行动、验证 | 交替运行 LLM 调用和工具调用直到任务完成的控制器。 |
| Prompt injection | 用户攻击提示词 | 试图覆盖系统提示词的恶意输入。 |

## 延伸阅读

- [Turing (1950). Computing Machinery and Intelligence](https://academic.oup.com/mind/article/LIX/236/433/986238) — 使对话成为该领域基准的论文。
- [Weizenbaum (1966). ELIZA — A Computer Program For the Study of Natural Language Communication](https://web.stanford.edu/class/cs124/p36-weizenabaum.pdf) — 最早的基于规则的聊天机器人论文。
- [Colby, Weber, Hilf (1971). Artificial Paranoia](https://doi.org/10.1016/0004-3702(71)90002-6) — PARRY 的情感变量架构，第一个有状态的聊天机器人。
- [Thoppilan et al. (2022). LaMDA: Language Models for Dialog Applications](https://arxiv.org/abs/2201.08239) — Google 后期的神经聊天机器人论文，恰在 LLM 智能体接管之前。
- [Yao et al. (2022). ReAct: Synergizing Reasoning and Acting in Language Models](https://arxiv.org/abs/2210.03629) — 命名智能体循环模式的论文。
- [Anthropic's guide on building effective agents](https://www.anthropic.com/research/building-effective-agents) — 2024 年的生产指南，在 2026 年依然适用。
- [Greshake et al. (2023). Not what you've signed up for: Compromising Real-World LLM-Integrated Applications with Indirect Prompt Injection](https://arxiv.org/abs/2302.12173) — 提示词注入论文。
- [OWASP Top 10 for LLM Applications 2025 — LLM01 Prompt Injection](https://genai.owasp.org/llmrisk/llm01-prompt-injection/) — 使提示词注入成为首要安全问题的排名。
- [AWS — Securing Amazon Bedrock Agents against Indirect Prompt Injections](https://aws.amazon.com/blogs/machine-learning/securing-amazon-bedrock-agents-a-guide-to-safeguarding-against-indirect-prompt-injections/) — 实用的编排层防御，包括“规划-验证-执行”和用户确认流程。
- [EchoLeak (CVE-2025-32711)](https://www.vectra.ai/topics/prompt-injection) — 由间接提示词注入导致的经典零点击数据泄露 CVE。说明写权限智能体需要运行时防御的参考案例。