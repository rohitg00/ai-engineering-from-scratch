# 17 · 聊天机器人——从规则驱动到神经网络，再到 LLM 智能体

> ELIZA 靠模式匹配来回复，DialogFlow 映射意图，GPT 凭权重作答，而 Claude 会调用工具并加以验证。每一个时代都解决了上一时代最严重的缺陷。

**类型：** 学习
**语言：** Python
**前置：** 阶段 5 · 13（问答），阶段 5 · 14（信息检索）
**时长：** 约 75 分钟

## 问题所在

一位用户说"我想改签航班"。系统必须搞清楚他想要什么、缺少哪些信息、如何获取这些信息，以及如何完成这个操作。接着用户又说"等等，要是我改成退票呢？"，系统又得记住上下文、切换任务，并保留状态。

对一个机器学习系统来说，对话非常困难。输入是开放式的；输出必须在多轮之间保持连贯；系统可能还需要对现实世界采取行动（改签航班、刷卡扣款）。任何一步出错都会被用户直接看到。

聊天机器人架构经历过四种范式的循环更迭，每一种之所以出现，都是因为前一种失败得太过明显。本课将按顺序逐一讲解它们。2026 年的生产环境格局，是后两种范式的混合体。

## 核心概念

〔图：聊天机器人的演进：规则驱动 → 检索 → 神经网络 → 智能体〕

**规则驱动（ELIZA、AIML、DialogFlow）。** 由人工编写的模式去匹配用户输入并产出回复。「意图分类器（intent classifier）」将请求路由到预定义的流程。「槽位填充（slot-filling）」状态机负责收集必需的信息。在为其设计的狭窄范围内表现得极为出色，一旦超出该范围便立即失效。它至今仍部署在那些不容许「幻觉（hallucination）」的安全关键领域（银行身份认证、航空订票）中。

**检索驱动（retrieval-based）。** 一套 FAQ 式的系统。对每一组（话语，回复）进行编码。运行时，对用户的消息进行编码，并检索出最接近的已存储回复。可以联想到 Zendesk 经典的"相似文章"功能。它处理同义改写的能力比规则更强。由于不做生成，因此不会产生幻觉。

**神经网络（seq2seq）。** 在对话日志上训练的「编码器-解码器（encoder-decoder）」。从零开始生成回复。流畅，但容易给出泛泛的输出（"我不知道"）和事实漂移，从来无法可靠地紧扣主题。这正是 2016-2019 年间谷歌、Facebook 和微软的聊天机器人都令人失望的原因。

**LLM 智能体（LLM agents）。** 一个被包裹在循环中的语言模型，它会规划、调用工具并验证结果。这不是一个带着超长提示词的聊天机器人，而是一个智能体循环：规划 → 调用工具 → 观察结果 → 决定下一步。「检索优先的接地（retrieval-first grounding，即 RAG）」使它免于产生幻觉。工具调用让它能够真正地去做事。这就是 2026 年的架构。

这四种范式并非顺序式的相互取代。一个 2026 年的生产级聊天机器人会同时路由经过全部四种：用规则驱动处理身份认证和破坏性操作，用检索处理 FAQ，用神经生成产出自然的措辞，用 LLM 智能体应对含糊的开放式查询。

## 动手构建

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

20 行代码实现的 ELIZA。那个反射小技巧（"I feel sad" → "Why do you feel sad"）正是源自 Weizenbaum 1966 年的那个经典心理治疗师演示。至今仍有启发意义。

### 第 2 步：检索驱动（FAQ）

这个用于演示的片段需要执行 `pip install sentence-transformers`（它会一并拉入 torch）。本课实际可运行的 `code/main.py` 改用了标准库的 Jaccard 相似度，因此整堂课无需任何外部依赖即可运行。

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

基于阈值的拒绝应答是这里关键的设计抉择。如果最佳匹配还不够接近，就返回 `None`，让系统去做升级处理（escalate）。

### 第 3 步：神经生成（基线）

使用一个小型的、经过指令微调的编码器-解码器（FLAN-T5），或者一个经过微调的对话式模型。在 2026 年，它单独使用时无法用于生产（会自相矛盾、偏离主题地漂移、产出事实性的胡言乱语），但作为混合系统的一部分用于产出自然措辞时则可以上线。DialoGPT 式的「纯解码器（decoder-only）」模型需要显式的轮次分隔符和 EOS 处理才能产出连贯的回复；而对于教学示例而言，一个 FLAN-T5 的 text2text 流水线开箱即用。

```python
from transformers import pipeline

chatbot = pipeline("text2text-generation", model="google/flan-t5-small")

response = chatbot("Respond politely to: Hi there!", max_new_tokens=40)
print(response[0]["generated_text"])
```

### 第 4 步：LLM 智能体循环

2026 年的生产级形态：

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

有三点值得点明。工具（tools）是 LLM 可以调用的可调用函数。当 LLM 返回的是最终答案而非工具调用时，循环便终止。「步数预算（step budget）」可以防止在含糊任务上陷入无限循环。

真实的生产环境还会加上：检索优先的接地（在每次调用 LLM 之前注入相关文档）、「护栏（guardrails）」（未经确认拒绝执行破坏性操作）、「可观测性（observability）」（记录每一步），以及「评测（evaluations）」（自动化检查，确保智能体行为符合规范）。

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

这个范式是：任何破坏性的事情都交给确定性规则，固定话术的 FAQ 交给检索，其余一切都交给 LLM 智能体。这正是 2026 年客服系统中所部署的方案。

## 实际应用

2026 年的技术栈：

| 应用场景 | 架构 |
|---------|---------------|
| 订票、支付、身份认证 | 规则驱动的状态机 + 槽位填充 |
| 客服 FAQ | 在精选答案上做检索 |
| 开放式帮助聊天 | 带 RAG + 工具调用的 LLM 智能体 |
| 内部工具 / IDE 助手 | 带工具调用（搜索、读取、写入）的 LLM 智能体 |
| 陪伴型 / 角色型聊天机器人 | 带人设系统提示词的微调 LLM，并在知识上做检索 |

在生产环境中始终采用混合路由。没有任何单一架构能把每一种请求都处理得很好。路由层本身通常就是一个小型的意图分类器。

## 至今仍在上线运行的失败模式

- **自信地编造。** LLM 智能体声称它完成了某个其实并未执行的操作。缓解方法：验证结果、记录工具调用，绝不让 LLM 在没有成功的工具返回的情况下声称自己做过某件事。
- **提示词注入（prompt injection）。** 用户插入文本来覆盖系统提示词。在《2025 年 OWASP LLM 应用十大风险》中排名 LLM01。它有两种形态：直接注入（粘贴进聊天中）和间接注入（隐藏在智能体所读取的文档、邮件或工具输出中）。

  攻击成功率因场景而异。在通用的工具使用和编程基准测试中，前沿模型上测得的成功率大约在 0.5%-8.5% 之间。某些特定的高风险设置（针对 AI 编程智能体的自适应攻击、脆弱的编排）已达到约 84%。生产环境中的 CVE 包括 EchoLeak（CVE-2025-32711，CVSS 9.3）——这是 Microsoft 365 Copilot 中一个由攻击者可控的邮件触发的「零点击（zero-click）」数据外泄漏洞。

  缓解方法：在整个循环中把用户输入视为不可信；在工具调用前做净化；将工具输出与主提示词隔离开；采用「规划-验证-执行（Plan-Verify-Execute，PVE）」模式，即智能体先做规划，然后在执行前对照该规划逐一验证每个动作（这能阻止工具结果注入新的、未经规划的动作）；对破坏性操作要求用户确认；对工具的作用域施加「最小权限（least-privilege）」原则。

  再多的提示词工程也无法彻底消除这种风险。外部的运行时防御层（LLM Guard、白名单校验、语义异常检测）是必需的。
- **范围蔓延（scope creep）。** 智能体因为某次工具调用返回了沾边的相关信息而偏离了任务。缓解方法：收窄工具契约；保持系统提示词聚焦；为偏离任务率添加评测。
- **无限循环。** 智能体不停地调用同一个工具。缓解方法：步数预算、工具调用去重、用一个 LLM 裁判来判断"我们是否在取得进展"。
- **上下文窗口耗尽。** 长对话会把最早的轮次挤出上下文。缓解方法：对较早的轮次做摘要、按相似度检索相关的过往轮次，或者使用一个长上下文模型。

## 交付成果

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

1. **简单。** 用上面的规则驱动应答，为一家咖啡店点单机器人实现 10 条模式。测试边界情况：重复下单、修改订单、取消、意图不明。
2. **中等。** 构建一个混合的 FAQ + LLM 兜底系统。为某个 SaaS 产品准备 50 条固定话术的 FAQ 条目，LLM 兜底则在文档站点上做检索。在 100 个真实的客服问题上测量拒绝应答率和准确率。
3. **困难。** 用上面的智能体循环实现三个工具（搜索、读取用户数据、发送邮件）。在 50 个测试场景（包括提示词注入尝试）上运行一次评测。报告偏离任务率、任务失败率，以及任何注入成功的情况。

## 关键术语

| 术语 | 人们口中的说法 | 它实际的含义 |
|------|-----------------|-----------------------|
| 意图（Intent） | 用户想要什么 | 一个类别标签（book_flight、reset_password），被路由到某个处理器。 |
| 槽位（Slot） | 一条信息 | 机器人所需的参数（日期、目的地）。槽位填充就是依次提问的那一连串过程。 |
| RAG | 检索加生成 | 检索出相关文档，然后据此为 LLM 的回复做接地。 |
| 工具调用（Tool call） | 函数调用 | LLM 发出一个带名称 + 参数的结构化调用，运行时执行它并返回结果。 |
| 智能体循环（Agent loop） | 规划、行动、验证 | 一个控制器，交替运行 LLM 调用与工具调用，直到任务完成。 |
| 提示词注入（Prompt injection） | 用户攻击提示词 | 试图覆盖系统提示词的恶意输入。 |

## 延伸阅读

- [Weizenbaum (1966). ELIZA — A Computer Program For the Study of Natural Language Communication](https://web.stanford.edu/class/cs124/p36-weizenabaum.pdf) —— 最初那篇规则驱动聊天机器人的论文。
- [Thoppilan et al. (2022). LaMDA: Language Models for Dialog Applications](https://arxiv.org/abs/2201.08239) —— 谷歌后期的神经聊天机器人论文，恰好出现在 LLM 智能体接管局面之前。
- [Yao et al. (2022). ReAct: Synergizing Reasoning and Acting in Language Models](https://arxiv.org/abs/2210.03629) —— 为智能体循环范式命名的那篇论文。
- [Anthropic 关于构建高效智能体的指南](https://www.anthropic.com/research/building-effective-agents) —— 2024 年的生产实践指引，到 2026 年依然成立。
- [Greshake et al. (2023). Not what you've signed up for: Compromising Real-World LLM-Integrated Applications with Indirect Prompt Injection](https://arxiv.org/abs/2302.12173) —— 那篇关于提示词注入的论文。
- [OWASP Top 10 for LLM Applications 2025 — LLM01 Prompt Injection](https://genai.owasp.org/llmrisk/llm01-prompt-injection/) —— 让提示词注入登顶头号安全隐患的那份排名。
- [AWS — Securing Amazon Bedrock Agents against Indirect Prompt Injections](https://aws.amazon.com/blogs/machine-learning/securing-amazon-bedrock-agents-a-guide-to-safeguarding-against-indirect-prompt-injections/) —— 实用的编排层防御，包括"规划-验证-执行"和用户确认流程。
- [EchoLeak (CVE-2025-32711)](https://www.vectra.ai/topics/prompt-injection) —— 那个由间接提示词注入引发的、经典的零点击数据外泄 CVE。它是说明为何具有写入权限的智能体需要运行时防御的参考案例。
