# Chatbots — Rule-Based to Neural to LLM Agents

> 伊丽莎回复了模式匹配。DialogFlow映射了意图。GPT来自重量。克劳德运行工具并验证。每个时代都解决了前一个时代最严重的失败。

**Type:** Learn
**Languages:** Python
**Prerequisites:** Phase 5 · 13 (Question Answering), Phase 5 · 14 (Information Retrieval)
**Time:** ~75 minutes

## The Problem

一位用户说“我想更改航班。“系统必须弄清楚他们想要什么、缺少哪些信息、如何获取信息以及如何完成操作。然后用户说“等等，如果我取消怎么办？“系统必须记住上下文、切换任务并保存状态。

对话对于ML系统来说很难。输入是开放式的。输出必须在多圈内保持一致。系统可能需要对世界采取行动（改变航班，充值卡）。用户可以看到每一个错误的步骤。

聊天机器人架构已经经历了四种范式的循环，每一种都是因为前一种失败得太明显而引入的。这一课让他们按顺序走。2026年的生产格局是后两者的混合体。

## The Concept

![Chatbot evolution: rule-based → retrieval → neural → agent](../assets/chatbot.svg)

** 基于规则（ELIZA、AIML、DialogFlow）。**手工创作的模式匹配用户输入并产生响应。意图分类器路由到预定义的流。填充老虎机的状态机收集所需的信息。在它设计的狭窄范围内工作出色。在安全关键域（银行身份验证，航空公司预订）中仍然存在，在这些域中不允许出现幻觉。

** 基于检索。**常见问题解答式系统。对每对（话语、回应）进行编码。在运行时，对用户的消息进行编码并检索最近的存储响应。想想Zendesk的经典“相似文章”功能。比规则更好地处理解释。没有一代，所以没有幻觉。

** 神经（seq 2 seq）。**编码器-解码器根据对话日志进行训练。从头开始生成响应。流利，但容易产生一般性的输出（“我不知道”）和事实漂移。从不可靠地谈论话题。谷歌、Facebook和微软在2016-2019年都拥有令人失望的聊天机器人的原因。

** 法学硕士代理人。**包装在循环中的语言模型，用于计划、调用工具和验证结果。不是一个有长提示的聊天机器人。代理循环：计划-调用工具-观察结果-决定下一步。检索优先接地（RAG）可以防止它产生幻觉。工具调用让它实际执行任务。这是2026年的架构。

这四种范式并不是顺序替代。2026年的生产聊天机器人贯穿了所有四个：基于规则的身份验证和破坏性动作、常见问题解答检索、自然措辞的神经生成、用于模棱两可的开放式查询的LLM代理。

## Build It

### Step 1: rule-based pattern matching

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

20行的ELIZA。反思技巧（“我感到悲伤”--“你为什么感到悲伤”）是Weizenbaum 1966年的经典心理治疗师演示。仍然有启发性。

### Step 2: retrieval-based (FAQ)

这个说明性片段需要“pip installance-transformers”（拉动手电筒）。本课程的可运行“code/main.py”使用stdlib Jaccard相似性，因此本课程在没有外部依赖项的情况下运行。

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

基于身份的拒绝是关键的设计选择。如果最佳匹配不够接近，则返回“None”并让系统升级。

### Step 3: neural generation (baseline)

使用小型描述调整的编码器-解码器（FLAN-T5）或微调的对话模型。2026年，生产无法单独使用（矛盾、偏离主题的漂移、事实上的废话），但在混合系统中进行自然措辞。DialoGPT风格的纯解码器模型需要显式的转折分隔符和EOS处理来生成连贯的回复;对于教学示例，FLAN-T5文本2文本管道开箱即用。

```python
from transformers import pipeline

chatbot = pipeline("text2text-generation", model="google/flan-t5-small")

response = chatbot("Respond politely to: Hi there!", max_new_tokens=40)
print(response[0]["generated_text"])
```

### Step 4: LLM agent loop

2026年生产形态：

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
            result = tools[tool_name](**args)
            history.append({"role": "assistant", "tool_call": tool_call})
            history.append({"role": "tool", "name": tool_name, "content": result})
        else:
            return response["content"]
    return "I could not complete the task in the step budget."
```

有三件事可列举。工具是LLM可以调用的可调用函数。当LLM返回最终答案而不是工具调用时，循环终止。步进预算可以防止模糊任务的无限循环。

真实生产添加了：检索优先接地（在每次LLM呼叫之前注入相关文档）、护栏（未经确认拒绝破坏性操作）、可观察性（记录每一步）和评估（自动检查代理行为是否符合规范）。

### Step 5: hybrid routing

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

模式：针对任何破坏性的确定性规则、针对罐装常见问题解答的检索、针对其他一切的LLM代理。这就是2026年推出的客户支持系统。

## Use It

2026年堆栈：

| 用例 | 架构 |
|---------|---------------|
| 预订、付款、认证 | 基于规则的状态机+老虎机填充 |
| 客户支持常见问题解答 | 对精心策划的答案进行检索 |
| 开放式帮助聊天 | 具有RAG +工具调用的LLM代理 |
| 内部工具/ IDE助手 | 具有工具调用的LLM代理（搜索、读取、写入） |
| 伴侣/角色聊天机器人 | 通过角色系统提示调整LLM，检索知识 |

在生产中始终使用混合路由。没有一个单一的体系结构可以很好地处理每个请求。路由层本身通常是一个小意图分类器。

## Failure modes that still ship

- ** 自信捏造 ** LLM代理声称它完成了一项它没有完成的行动。缓解措施：验证结果，记录工具调用，永远不要让LLM在没有成功返回工具的情况下声称已经完成了一些事情。
- ** 及时注射。**用户插入覆盖系统提示的文本。在2025年LLM申请OWASP前10名中排名LLM 01。两种风格：直接注入（粘贴到聊天中）和间接注入（隐藏在文档、电子邮件或代理读取的工具输出中）。

  攻击率因场景而异。在一般工具使用和编码基准中，各个前沿模型的测量成功率范围约为0.5-8.5%。特定的高风险设置（针对AI编码代理的自适应攻击、脆弱的编排）已达到约84%。生产CVE包括EchoLeak（UTE-2025-32711，CVD 9.3）--Microsoft 365 Copilot中由攻击者控制的电子邮件触发的零点击数据泄露缺陷。

  缓解措施：在整个循环中将用户输入视为不受信任;在工具调用前进行清理;将工具输出与主提示隔离;使用计划-验证-执行（PVE）模式，其中代理首先进行计划，然后在执行之前根据该计划验证每个操作（这会阻止工具结果注入新的计划外操作）;要求用户确认破坏性操作;对工具范围应用最低特权。

  无论如何及时的工程都无法完全消除这种风险。需要外部运行时防御层（LLM Guard、允许列表验证、语义异常检测）。
- ** 范围蔓延。**由于工具调用返回了完全相关的信息，代理无法完成任务。缓解措施：缩小工具合同范围;保持系统及时专注;添加对非任务率的评估。
- ** 无限循环。**代理不断调用同一工具。缓解措施：逐步预算、工具呼叫重复数据删除、LLM判断“我们是否正在取得进展。"
- ** 上下文窗口耗尽。**长时间的对话会让最早的转变脱离上下文。缓解措施：总结旧的转折，通过相似性检索相关的过去转折，或使用长背景模型。

## Ship It

另存为“输出/skill-chatbot-architect.md”：

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

## Exercises

1. ** 简单。**通过咖啡店订购机器人的10种模式实现上述基于规则的响应。测试边缘案例：双重订单、修改、取消、意图不明确。
2. ** 中等。**构建混合常见问题解答+ LLM后备方案。SaaS产品的50个固定常见问题解答条目，通过文档网站检索LLM后备。衡量100个真实支持问题的拒绝率和准确性。
3. ** 很难。**使用三种工具（搜索、读取用户数据、发送电子邮件）实现上述代理循环。使用50个测试场景运行评估，包括提示注射尝试。报告任务外率、任务失败率和任何注入成功。

## Key Terms

| Term | 别人怎么说 | 它实际上意味着什么 |
|------|-----------------|-----------------------|
| 意图 | 用户想要什么 | 类别标签（book_flight、reset_code）。路由到处理器。 |
| 槽 | 一条信息 | 机器人需要的参数（日期、目的地）。老虎机填充是要求的顺序。 |
| 抹布 | 检索加生成 | 删除相关文档，然后禁止LLM的回应。 |
| 工具调用 | 函数调用 | LLM发出具有名称+参数的结构化调用。收件箱执行，返回结果。 |
| 代理循环 | 计划、行动、验证 | 控制器运行LLM调用与工具调用交错运行，直到任务完成。 |
| 及时注射 | 用户攻击提示 | 试图覆盖系统提示的恶意输入。 |

## Further Reading

- [魏曾鲍姆（1966）。ELIZA -自然语言沟通研究的计算机程序]（https：//web.stanford.edu/class/cs124/p36-weizenabaum.pdf）-基于规则的原始聊天机器人论文。
- [Thoppilan等人（2022）。LaEDA：对话框应用程序的语言模型]（https：//arxiv.org/ab/2201.08239）-谷歌后期的神经聊天机器人论文，就在法学硕士代理接手之前。
- [Yao等人（2022）。ReAct：在语言模型中协同推理和行为]（https：//arxiv.org/ab/2210.03629）-命名代理循环模式的论文。
- [Anthropic关于构建有效药剂的指南]（https：//www.anthropic.com/research/building-effective-agents）- 2024年生产指南，2026年仍然有效。
- [Greshake等人（2023）。不是您所注册的内容：通过间接提示注入损害现实世界法学硕士集成应用程序]（https：//arxiv.org/ab/2302.12173）-预算注入论文。
- [OWASP 2025年LLM应用程序十大-LLM 01提示注入]（https：//genai.owasp.org/llmrisk/llm01-spect-injection/）-使提示注入成为首要安全问题的排名。
- [AWS- 保护Amazon Bedrock Agents免受间接提示注射的影响]（https：//aws. amazon.com/blogs/machine-learning/securing-amazon-account-agents-a-guide-to-guardian-against-intermediate-project-injections/）-实用的编排层防御，包括计划-验证-执行和用户确认流。
- [EchoLeak（UTE-2025-32711）]（https：//www.vectra.ai/topics/spect-injection）-来自间接提示注入的典型零点击数据extration CVS。关于写访问代理为何需要运行时防御的参考案例。
