# 聊天机器人 —— 从规则到神经网络再到 LLM agent

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> ELIZA 用模式匹配回复。DialogFlow 把意图映射到流程。GPT 从权重里答出来。Claude 调工具并验证结果。每一代都解决了上一代最显眼的失败。

**Type:** Learn
**Languages:** Python
**Prerequisites:** Phase 5 · 13 (Question Answering), Phase 5 · 14 (Information Retrieval)
**Time:** ~75 minutes

## 问题（The Problem）

用户说「我想改签航班」。系统得弄清楚他要什么、缺哪些信息、怎么补齐、怎么完成动作。然后用户又说「等等，要不直接取消？」——系统得记住上下文、切换任务、保住状态。

对话对一个 ML 系统来说很难。输入是开放式的。输出要在多轮里保持连贯。系统可能还要对世界产生影响（改签、扣款）。每一步走错都被用户看在眼里。

聊天机器人架构循环过四种范式，每一代的出现都是因为上一代败得太显眼。本课按时间顺序走一遍。2026 年生产环境的形态是后两种的混合体。

## 概念（The Concept）

![聊天机器人演进：rule-based → retrieval → neural → agent](../assets/chatbot.svg)

**Rule-based（基于规则，ELIZA、AIML、DialogFlow）。** 人工撰写的 pattern 匹配用户输入并产出回复。意图分类器把请求路由到预定义的流程。槽位填充（slot-filling）状态机收集所需信息。在它被设计的窄域内表现极好，出了这个域就立刻翻车。如今仍部署在不容许 hallucination（幻觉）的安全敏感场景里（银行身份核验、机票预订）。

**Retrieval-based（基于检索）。** FAQ 风格的系统。把每对（话术，回复）都编码出来。运行时把用户消息编码后检索最近的存储回复。想想 Zendesk 经典的「相似文章」功能。比规则更能处理改写表达，没有生成所以也没有 hallucination。

**Neural（神经网络，seq2seq）。** 在对话日志上训练的 encoder-decoder。从零生成回复。流畅但容易输出泛泛的「我不知道」，事实漂移，话题跑偏。这就是 2016–2019 年 Google、Facebook、Microsoft 的聊天机器人都让人失望的原因。

**LLM agents（LLM agent）。** 一个语言模型外面套一层循环：规划、调工具、验证结果。不是一个塞了长 prompt 的聊天机器人。是一条 agent loop：规划 → 调用工具 → 观察结果 → 决定下一步。检索优先的 grounding（RAG）防止它产生 hallucination。tool call（工具调用）让它真正能做事。这就是 2026 年的架构。

这四种范式不是依次替换的关系。一个 2026 年的生产级聊天机器人会同时穿过四条路径：rule-based 用于身份核验和破坏性动作，retrieval 用于 FAQ，神经生成用于自然措辞，LLM agent 用于含混的开放式查询。

## 动手实现（Build It）

### 第一步：rule-based 模式匹配

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

20 行就是 ELIZA。把「I feel sad」反射成「Why do you feel sad」的小把戏，是 Weizenbaum 1966 年那篇心理治疗师 demo 的招牌动作，今天看仍有启发。

### 第二步：retrieval-based（FAQ）

下面这段示意代码需要 `pip install sentence-transformers`（会顺带把 torch 拉下来）。本课可运行的 `code/main.py` 改用了 stdlib 里的 Jaccard 相似度，这样这一课不依赖外部库就能跑。

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

基于阈值的「拒绝回答」是这里的关键设计。如果最佳匹配不够近，就返回 `None`，让系统升级到下一层处理。

### 第三步：神经生成（baseline）

用一个小的指令微调过的 encoder-decoder（FLAN-T5），或者一个微调过的对话模型。在 2026 年单独使用还不够生产可用（自相矛盾、话题漂移、事实胡说），但作为混合系统里的一环、用来生成自然措辞还是会上线的。DialoGPT 那种 decoder-only 模型要靠显式的轮次分隔和 EOS 处理才能产出连贯回复；FLAN-T5 的 text2text pipeline 开箱即用，作为教学例子刚好。

```python
from transformers import pipeline

chatbot = pipeline("text2text-generation", model="google/flan-t5-small")

response = chatbot("Respond politely to: Hi there!", max_new_tokens=40)
print(response[0]["generated_text"])
```

### 第四步：LLM agent loop

2026 年生产环境的形态：

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

三个要点。Tools 是 LLM 可以调用的函数。当 LLM 返回最终答案而不是 tool call 时，循环终止。step budget（步数预算）防止在含混任务上无限循环。

真正的生产环境还要加上：检索优先的 grounding（每次调 LLM 之前注入相关文档）、guardrail（护栏，对破坏性动作要求确认才放行）、可观测性（每一步都记日志）、评估（自动化检查 agent 行为是否仍合规）。

### 第五步：混合路由

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

套路是：破坏性动作交给确定性规则，固定 FAQ 用检索，剩下的丢给 LLM agent。这就是 2026 年客服系统真正在跑的形态。

## 用起来（Use It）

2026 技术栈：

| 用途 | 架构 |
|---------|---------------|
| 预订、支付、身份核验 | Rule-based 状态机 + 槽位填充 |
| 客服 FAQ | 在精挑过的答案上做检索 |
| 开放式帮助聊天 | LLM agent + RAG + tool call |
| 内部工具 / IDE 助手 | LLM agent + tool call（搜索、读取、写入） |
| 陪伴 / 角色扮演聊天机器人 | 用人格 system prompt 调过的 LLM，知识层用检索 |

生产环境永远用混合路由。没有任何单一架构能把所有请求都处理好。路由层本身通常是一个小的意图分类器。

## 仍会上线的失败模式

- **自信的捏造（confident fabrication）。** LLM agent 声称自己完成了某个动作，实际上没做。缓解办法：验证结果、记录每次 tool call、绝不允许 LLM 在没有成功 tool 返回值的情况下宣称做了某事。
- **Prompt injection（提示词注入）。** 用户插入文字试图覆盖 system prompt。在 OWASP Top 10 for LLM Applications 2025 里被列为 LLM01。两种类型：直接注入（直接粘贴进对话）和间接注入（藏在文档、邮件或 agent 读到的工具输出里）。

  攻击成功率随场景不同。在通用 tool use 和编程 benchmark 中，前沿模型上的成功率大致在 0.5%–8.5%。某些高风险特定场景（针对 AI 编程 agent 的自适应攻击、有漏洞的编排）成功率达到过 ~84%。生产环境的 CVE 包括 EchoLeak（CVE-2025-32711，CVSS 9.3）——Microsoft 365 Copilot 的零点击数据外泄漏洞，由攻击者控制的邮件触发。

  缓解办法：在整条 loop 里都把用户输入视为不可信；调工具前做清洗；把工具输出和主 prompt 隔离；使用 Plan-Verify-Execute（PVE）模式，让 agent 先规划、再用规划核验每一步动作、然后才执行（这能阻止工具结果注入新的、未规划的动作）；破坏性动作要求用户确认；按最小权限原则限制 tool 的作用范围。

  无论怎么做 prompt engineering 都无法彻底消除这个风险。外部运行时防御层（LLM Guard、allowlist（白名单）校验、语义异常检测）是必需的。
- **Scope creep（任务范围漂移）。** 因为某次 tool call 返回了沾边的信息，agent 就跑题了。缓解办法：收紧 tool 契约；保持 system prompt 聚焦；加入「跑题率」相关的评估。
- **无限循环。** Agent 一直反复调用同一个工具。缓解办法：step budget、tool call 去重、用 LLM judge 判断「我们到底有没有在推进」。
- **Context window 耗尽。** 长对话会把最早的几轮挤出 context。缓解办法：把更早的轮次做摘要、按相似度检索相关历史轮、或者换一个长 context window 的模型。

## 上线部署（Ship It）

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

## 练习（Exercises）

1. **简单。** 把上面的 rule-based 回复实现出来，给一个咖啡店点单 bot 写 10 条 pattern。测试边界情况：双倍订单、修改订单、取消、意图不明。
2. **中等。** 搭一个 FAQ + LLM 兜底的混合系统。给一个 SaaS 产品准备 50 条预设 FAQ，LLM 兜底层基于其文档站做检索。在 100 条真实客服问题上量化拒答率和准确率。
3. **困难。** 把上面的 agent loop 实现出来，配三个工具（search、read-user-data、send-email）。用 50 个测试场景跑评估，包含 prompt injection 尝试。报告跑题率、任务失败率，以及任何一次 injection 成功的情况。

## 关键术语（Key Terms）

| 术语 | 大家嘴上怎么说 | 实际含义 |
|------|-----------------|-----------------------|
| Intent | 用户想要什么 | 一个分类标签（book_flight、reset_password），路由到对应处理逻辑。 |
| Slot | 一条信息 | bot 需要的参数（日期、目的地）。槽位填充是一连串追问的过程。 |
| RAG | 检索 + 生成 | 检索相关文档，再用它来 ground 住 LLM 的回答。 |
| Tool call | 函数调用 | LLM 输出一个结构化调用（名字 + 参数），运行时执行后把结果返回。 |
| Agent loop | 规划、行动、验证 | 一个控制器，把 LLM 调用和 tool 调用交织起来跑，直到任务完成。 |
| Prompt injection | 用户攻击 prompt | 试图覆盖 system prompt 的恶意输入。 |

## 延伸阅读（Further Reading）

- [Weizenbaum (1966). ELIZA — A Computer Program For the Study of Natural Language Communication](https://web.stanford.edu/class/cs124/p36-weizenabaum.pdf) —— 最早的 rule-based 聊天机器人论文。
- [Thoppilan et al. (2022). LaMDA: Language Models for Dialog Applications](https://arxiv.org/abs/2201.08239) —— Google 末期的神经聊天机器人论文，恰好赶在 LLM agent 接管之前。
- [Yao et al. (2022). ReAct: Synergizing Reasoning and Acting in Language Models](https://arxiv.org/abs/2210.03629) —— 给 agent loop 这个范式起了名字的论文。
- [Anthropic's guide on building effective agents](https://www.anthropic.com/research/building-effective-agents) —— 2024 年的生产指南，到 2026 年仍然成立。
- [Greshake et al. (2023). Not what you've signed up for: Compromising Real-World LLM-Integrated Applications with Indirect Prompt Injection](https://arxiv.org/abs/2302.12173) —— prompt injection 的经典论文。
- [OWASP Top 10 for LLM Applications 2025 — LLM01 Prompt Injection](https://genai.owasp.org/llmrisk/llm01-prompt-injection/) —— 把 prompt injection 推上「头号安全问题」位置的那份榜单。
- [AWS — Securing Amazon Bedrock Agents against Indirect Prompt Injections](https://aws.amazon.com/blogs/machine-learning/securing-amazon-bedrock-agents-a-guide-to-safeguarding-against-indirect-prompt-injections/) —— 编排层的实战防御，包括 Plan-Verify-Execute 和用户确认流程。
- [EchoLeak (CVE-2025-32711)](https://www.vectra.ai/topics/prompt-injection) —— 由间接 prompt injection 引发的零点击数据外泄 CVE 的标杆案例。说明为什么有写权限的 agent 必须配运行时防御。
