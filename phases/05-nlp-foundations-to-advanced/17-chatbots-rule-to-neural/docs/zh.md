# 聊天机器人——从基于规则到神经网络再到LLM智能体

> ELIZA 用模式匹配来回复。DialogFlow 映射意图。GPT 从权重中直接生成答案。Claude 使用工具并进行验证。每个时代都解决了前一个时代最严重的失败。

**类型:** 学习
**语言:** Python
**前置知识:** 阶段5 · 13（问答系统）、阶段5 · 14（信息检索）
**时间:** 约75分钟

## 问题

用户说“我想改签航班”。系统需要弄清楚用户想要什么、缺少哪些信息、如何获取这些信息以及如何完成操作。然后用户说“等等，如果我取消呢？”系统必须记住上下文、切换任务并保持状态。

对话对于一个机器学习系统来说很难。输入是开放式的。输出必须跨多个轮次保持连贯。系统可能需要对外部世界执行操作（改签航班、扣款）。每个错误的步骤对用户都是可见的。

聊天机器人架构经历了四个范式的迭代周期，每个新范式都是因为前一个范式的失败过于明显而被引入的。2026年的生产环境是后两个范式的混合体。

## 概念

![聊天机器人演进：基于规则 → 检索式 → 神经网络 → 智能体](../assets/chatbot.svg)

**基于规则（Rule-based，ELIZA、AIML、DialogFlow）。** 手工编写的模式匹配用户输入并生成回复。意图分类器将输入路由到预定义的流程。槽填充（Slot-filling）状态机收集所需信息。在其设计的狭窄范围内工作得非常出色。一旦超出这个范围就立刻失效。但仍被用于安全关键领域（银行身份验证、机票预订），这些领域不容忍幻觉。

**检索式（Retrieval-based）。** 一种 FAQ 风格的系统。对每一对（话语，回复）进行编码。运行时，对用户消息进行编码并检索最接近的存储回复。可以理解为 Zendesk 经典的“类似文章”功能。比规则更好地处理释义。不生成内容，因此没有幻觉。

**神经网络（Neural，seq2seq）。** 在对话日志上训练的编码器-解码器模型。从头生成回复。流畅但容易产生通用输出（“我不知道”）和事实偏离。永远无法可靠地保持在主题上。这是 Google、Facebook 和微软在 2016-2019 年间都推出过令人失望的聊天机器人的原因。

**LLM 智能体（LLM Agents）。** 一个语言模型被包裹在一个循环中，进行规划、调用工具并验证结果。不是带有长提示的聊天机器人。而是一个智能体循环（Agent loop）：规划 → 调用工具 → 观察结果 → 决定下一步。基于检索的接地（RAG）防止它产生幻觉。工具调用让它能实际做事情。这就是 2026 年的架构。

这四个范式并非顺序替代关系。一个 2026 年的生产级聊天机器人会经过所有四个阶段：基于规则用于认证和破坏性操作，检索式用于 FAQ，神经生成用于自然措辞，LLM 智能体用于模糊的开放式查询。

## 构建

### 步骤 1：基于规则的模式匹配

```python
import re


class RulePattern:
    def __init__(self, pattern, response_template):
        self.regex = re.compile(pattern, re.IGNORECASE)
        self.template = response_template


PATTERNS = [
    RulePattern(r"my name is (\w+)", "很高兴认识你，{0}。"),
    RulePattern(r"i (need|want) (.+)", "你为什么{0}{1}？"),
    RulePattern(r"i feel (.+)", "你为什么感到{0}？"),
    RulePattern(r"(.*)", "请多说一些。"),
]


def rule_based_respond(user_input):
    for pattern in PATTERNS:
        m = pattern.regex.match(user_input.strip())
        if m:
            return pattern.template.format(*m.groups())
    return "我不明白。"
```

20 行实现的 ELIZA。反射技巧（“我感觉难过” → “你为什么感到难过？”）是 Weizenbaum 1966 年典型的心理治疗师演示。仍然有教育意义。

### 步骤 2：检索式（FAQ）

此说明性代码片段需要 `pip install sentence-transformers`（会拉取 torch）。本课可运行的 `code/main.py` 改用标准库的 Jaccard 相似度，因此该课无需外部依赖即可运行。

```python
from sentence_transformers import SentenceTransformer
import numpy as np


FAQ = [
    ("如何重置密码", "前往 设置 > 安全 > 重置密码。"),
    ("如何取消订单", "前往 订单，找到该订单，点击 取消。"),
    ("退换政策是什么", "未使用商品在原始包装下可享受30天退货。"),
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

基于阈值的拒绝是关键设计选择。如果最佳匹配不够接近，则返回 `None` 让系统升级处理。

### 步骤 3：神经生成（基线）

使用一个经过指令微调的小型编码器-解码器（FLAN-T5）或一个经过微调的对话模型。在 2026 年单独使用它在生产中不可用（矛盾、偏离主题、事实错误），但作为混合系统的一部分用于自然措辞。DialoGPT 风格的解码器专用模型需要显式的轮次分隔符和 EOS 处理才能生成连贯的回复；FLAN-T5 的 text2text 流水线开箱即用，适合教学示例。

```python
from transformers import pipeline

chatbot = pipeline("text2text-generation", model="google/flan-t5-small")

response = chatbot("礼貌地回答：你好！", max_new_tokens=40)
print(response[0]["generated_text"])
```

### 步骤 4：LLM 智能体循环

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
    return "我无法在步骤预算内完成任务。"
```

要命名三个东西。工具（Tools）是 LLM 可以调用的可执行函数。当 LLM 返回最终答案而不是工具调用时，循环终止。步骤预算防止在模糊任务上无限循环。

实际生产环境还会添加：基于检索的接地（在每次 LLM 调用前注入相关文档）、护栏（拒绝未经确认的破坏性操作）、可观测性（记录每一步）和评估（自动检查智能体行为是否符合规范）。

### 步骤 5：混合路由

```python
def hybrid_chat(user_input):
    if is_destructive_action(user_input):
        return structured_flow(user_input)

    faq_answer = faq_respond(user_input, threshold=0.6)
    if faq_answer:
        return faq_answer

    return agent_loop(user_input, tools, llm)


def is_destructive_action(text):
    danger_words = ["删除", "取消", "扣款", "退款", "转账"]
    return any(w in text.lower() for w in danger_words)
```

模式：破坏性操作使用确定性规则，常见 FAQ 使用检索，其他所有情况使用 LLM 智能体。这就是 2026 年客户支持系统的实际形态。

## 使用

2026 年的技术栈：

| 使用场景 | 架构 |
|---------|---------------|
| 预订、支付、认证 | 基于规则的状态机 + 槽填充 |
| 客户支持 FAQ | 针对精选答案的检索 |
| 开放式帮助聊天 | 带 RAG 和工具调用的 LLM 智能体 |
| 内部工具 / IDE 助手 | 带工具调用（搜索、读取、写入）的 LLM 智能体 |
| 陪伴 / 角色聊天机器人 | 经过微调的 LLM，带有人设系统提示和知识检索 |

生产中始终使用混合路由。没有一种架构能很好地处理所有请求。路由层本身通常是一个小型意图分类器。

## 仍然常见的失败模式

- **自信的捏造（Confident fabrication）。** LLM 智能体声称完成了它并未执行的操作。缓解措施：验证结果、记录工具调用、绝不允许 LLM 在没有成功工具返回的情况下声称已完成某事。
- **提示注入（Prompt injection）。** 用户插入覆盖系统提示的文本。在 OWASP 2025 年 LLM 应用十大风险中排名 LLM01。两种形式：直接注入（粘贴到聊天中）和间接注入（隐藏在智能体读取的文档、电子邮件或工具输出中）。

  攻击率因场景而异。在前沿模型的通用工具使用和编码基准测试中，测得的成功率大约在 0.5%-8.5% 之间。特定的高风险设置（针对 AI 编码智能体的自适应攻击、脆弱的编排）已达到约 84%。生产环境的 CVE 包括 EchoLeak（CVE-2025-32711，CVSS 9.3）—— 微软 365 Copilot 中的一个零点击数据泄露漏洞，由攻击者控制的电子邮件触发。

  缓解措施：在整个循环中将用户输入视为不可信；在工具调用前进行清洗；将工具输出与主提示隔离；使用规划-验证-执行（PVE）模式，智能体先规划，然后在执行前验证每个操作是否符合该规划（这可以防止工具结果注入新的计划外操作）；要求用户确认破坏性操作；对工具范围应用最小权限原则。

  没有哪种提示工程技术能完全消除这一风险。需要外部运行时防御层（LLM Guard、白名单验证、语义异常检测）。
- **范围蔓延（Scope creep）。** 智能体因工具调用返回了间接相关信息而偏离任务。缓解措施：缩小工具契约；保持系统提示聚焦；添加对离任务率的评估。
- **无限循环（Infinite loops）。** 智能体不断调用同一个工具。缓解措施：步骤预算、工具调用去重、LLM 评判“我们是否在取得进展”。
- **上下文窗口耗尽（Context window exhaustion）。** 长对话将最早的轮次推出上下文。缓解措施：总结较早的轮次、通过相似度检索相关的过往轮次，或使用长上下文模型。

## 交付

保存为 `outputs/skill-chatbot-architect.md`：

```markdown
---
name: chatbot-architect
description: 为给定的使用场景设计聊天机器人技术栈。
version: 1.0.0
phase: 5
lesson: 17
tags: [nlp, agents, chatbot]
---

给定产品背景（用户需求、合规约束、可用工具、数据量），输出：

1. 架构。基于规则、检索式、神经网络、LLM 智能体或混合式（指明哪些路径指向哪里）。
2. 如适用，LLM 的选择。命名模型系列（Claude、GPT-4、Llama-3.1、Mixtral）。匹配工具使用质量和成本。
3. 接地策略。RAG 来源、检索方法（参见第 14 课）、工具契约。
4. 评估计划。任务成功率、工具调用正确率、离任务率、在保留对话集上的幻觉率。

拒绝为任何破坏性操作（支付、账户删除、数据修改）推荐纯 LLM 智能体，除非有结构化的确认流程。如果智能体对任何内容具有写权限，拒绝跳过提示注入审计。
```

## 练习

1. **简单。** 为咖啡店下单机器人实现上述基于规则的响应，包含 10 个模式。测试边界情况：重复订单、修改、取消、意图不明确。
2. **中等。** 构建一个混合型 FAQ + LLM 降级方案。为一个 SaaS 产品准备 50 条常见 FAQ 条目，LLM 降级方案使用文档站点的检索。在 100 个真实支持问题上测量拒绝率和准确率。
3. **困难。** 使用三个工具（搜索、读取用户数据、发送电子邮件）实现上述智能体循环。用 50 个测试场景进行评估，包括提示注入尝试。报告离任务率、任务失败率以及任何注入成功的案例。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|-----------------------|
| 意图（Intent） | 用户想要什么 | 分类标签（book_flight、reset_password）。路由到对应的处理程序。 |
| 槽位（Slot） | 一条信息 | 机器人需要的参数（日期、目的地）。槽填充是一连串的提问。 |
| RAG | 检索加生成 | 检索相关文档，然后基于检索结果来接地 LLM 的回复。 |
| 工具调用（Tool call） | 函数调用 | LLM 发出包含名称和参数的结构化调用。运行时执行，返回结果。 |
| 智能体循环（Agent loop） | 规划、行动、验证 | 控制器，在任务完成前交替运行 LLM 调用和工具调用。 |
| 提示注入（Prompt injection） | 用户攻击提示 | 恶意输入，试图覆盖系统提示。 |

## 延伸阅读

- [Weizenbaum (1966). ELIZA — A Computer Program For the Study of Natural Language Communication](https://web.stanford.edu/class/cs124/p36-weizenabaum.pdf) —— 最早的基于规则聊天机器人论文。
- [Thoppilan et al. (2022). LaMDA: Language Models for Dialog Applications](https://arxiv.org/abs/2201.08239) —— Google 在 LLM 智能体接管前发表的晚期神经聊天机器人论文。
- [Yao et al. (2022). ReAct: Synergizing Reasoning and Acting in Language Models](https://arxiv.org/abs/2210.03629) —— 命名了智能体循环模式的论文。
- [Anthropic's guide on building effective agents](https://www.anthropic.com/research/building-effective-agents) —— 2024 年的生产指南，2026 年仍然有效。
- [Greshake et al. (2023). Not what you've signed up for: Compromising Real-World LLM-Integrated Applications with Indirect Prompt Injection](https://arxiv.org/abs/2302.12173) —— 提示注入论文。
- [OWASP Top 10 for LLM Applications 2025 — LLM01 Prompt Injection](https://genai.owasp.org/llmrisk/llm01-prompt-injection/) —— 使提示注入成为首要安全问题的排名。
- [AWS — Securing Amazon Bedrock Agents against Indirect Prompt Injections](https://aws.amazon.com/blogs/machine-learning/securing-amazon-bedrock-agents-a-guide-to-safeguarding-against-indirect-prompt-injections/) —— 实际的编排层防御，包括规划-验证-执行和用户确认流程。
- [EchoLeak (CVE-2025-32711)](https://www.vectra.ai/topics/prompt-injection) —— 来自间接提示注入的典型零点击数据泄露 CVE。为什么写入权限的智能体需要运行时防御的参考案例。