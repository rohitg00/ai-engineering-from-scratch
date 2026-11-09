# 聊天机器人 基于规则的到神经系统到法学执法代理

> 卡罗里斯在一个小时内,他发现了一个不错的东西,然后他开始做了一些事情.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 13 (Question Answering), Phase 5 · 14 (Information Retrieval)
**Time:** ~75 minutes

## 问题

系统必须弄清楚他们想要什么,缺失什么信息,如何获取它,以及如何完成操作.然后用户说"等,如果我取消?"系统必须记住文本,切换任务,保存状态.

对于 ML 系统来说,对话很难.输入是无限的.输出必须在多个转折中保持一致.系统可能需要对世界产生影响 (改变飞行,充电卡).用户可以看到每一步错误.

聊天机器人架构已经通过四个范式进行了循环,每个范式都被引入,因为前一个太明显失败了.这堂课让它们顺序.2026年生产景观是最后两个混合物.

## 概念

![Chatbot evolution: rule-based → retrieval → neural → agent](../assets/chatbot.svg)

### 剧本写的半个世纪,1950-2001

首先,这个模式不持续五年.它持续了五十年.知道它的弧线是重要的,因为它中的每个系统都是相同的机器匹配输入,发出一个装响应,更新一个小状态,五十年的添加规则到那台机器从来没有产生了一般的情况.这天花板是为什么两到四个范式存在.

**1950.**图灵通过提出一个操作替代方案来回避"机器能思考吗?" 如果一个询问者无法通过电话来区分机器与人,那么哲学问题就会被争论.

**1956.**根据"人工智能"的假设,每个智能特征"原则上可以以如此精确的精度描述,以使一个机器可以模拟它".

**1966.**子在一步中建立了反思技巧:分解规则从输入中抽取碎片,重组规则回声回复它们作为问题.大约200个模式总数,零状态,零理解,用户无论如何都信任它.韦森巴姆在他的职业生涯的余分时间都惊于它需要多少机器.

**1972.**帕里在斯坦福大学建立了一个偏执的模型, 恐惧,愤怒和不信任的数值变量在每一个转折和门上更新, 脚本接下来开启, 在盲目的转录测试中,精神科医生将PARRY与人类患者分开. 它是人格调节的直接祖先, 作为三个浮动系统的系统提示. 同年,这两个机器人通过ARPANET互相指向:一个治疗师采访一个偏执状态机器的脚本,

**1995.**艾利斯用AIML来扩展ELIZA的配方,这是一个用于模式模板对的XML方言.大约有4万个手写类别,赢得了三个洛伯纳奖.它证明了基于规则的系统的扩展法:更多的规则买入覆盖,从来没有通用性.每个规则都是一个责任有人必须保持.

**2001.**智能儿童将该食谱放在3000万即时消息用户面前,并添加后端查询 天气,股票,电影时间 拼接到模板中.

五十年,一个机制,一个规则的增加. 范式结束了,不是因为有人否认它,

```figure
chatbot-lineage
```

**Rule-based (ELIZA, AIML, DialogFlow).**手动编写的模式与用户输入匹配,产生响应.意图分类器向预定义的流程路由.填充机器收集所需信息.它在设计的狭窄范围内工作得很好.它立即失败.仍然在安全关键领域 (银行身份验证,航空公司预订) 里运输,在这些领域不容忍幻觉.

**Retrieval-based.**采用常见问题类型的系统. 编码每一对 (发言,响应). 在运行时,编码用户的消息,并检索最近存储的响应. 想象Zendesk的经典"类似文章"功能. 处理比规则更好. 没有生成,所以没有幻觉.

**Neural (seq2seq).**编码解码器训练在对话日志上.从零开始生成响应.流动但容易产生通用输出 ("我不知道") 和事实漂移.从来没有在主题上靠谱. Google,Facebook和微软在2016-2019年都有令人失望的聊天机器人.

**LLM agents.**语言模型包裹在一个循环中,它计划,调用工具,并验证结果.不是一个长时间提示的聊天机.一个代理循环:计划 →调用工具 →观察结果 →决定下一步.检索-第一地定位 (RAG) 阻止它幻觉.工具调用让它实际上做事情.这是2026年架构.

通过所有四个路线:基于规则的身份验证和破坏性行动,查询常见问题,神经生成自然表达,对模糊的开放式查询的LLM代理.

## 建立它

### 步骤1:基于规则的模式匹配

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

思考技巧 ("我感到悲伤" → "你为什么感到悲伤") 是1966年威森巴姆的常规心理治疗师演示.

### 步骤2:基于检索 (FAQ)

这段插图需要`pip install sentence-transformers`火的火.`code/main.py`这一课使用了Stdlib Jaccard相似性,所以课程没有外部依赖.

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

如果最好的匹配不够近,请返回.`None`让系统升级.

### 步骤3:神经生成 (基线)

使用一个小的指示调节的编码器-解码器 (FLAN-T5) 或一个精细调节的对话模型. 产品本身无法使用2026年 (矛盾,非主题漂移,事实无稽之谈),但在混合系统内运输自然表达. 只有DialoGPT式解码器模型需要明确的转分区和EOS处理来产生一致的答案;一个FLAN-T5文本2文本管道作为教学例子是无机的.

```python
from transformers import pipeline

chatbot = pipeline("text2text-generation", model="google/flan-t5-small")

response = chatbot("Respond politely to: Hi there!", max_new_tokens=40)
print(response[0]["generated_text"])
```

### 步骤4:LLM代理循环

2026年生产形状:

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

工具是 LLM可以调用的可调用函数. LLM返回最终答案而不是工具调用时循环结束.步骤预算防止无限的循环在模糊任务.

实际生产增加了:检索-第一地 (在每次LLM电话之前注入相关文件),防护护 (不确认拒绝破坏性行动),可观察性 (每一步都记录),以及评估 (自动检查代理行为保持在规范状态).

### 步骤5:混合路由

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

模式:任何破坏性的决定性规则,用于装常见问题,用于其他所有的事情的LLM代理.

## 用它

现在,我们要做什么?

| Use case | Architecture |
|---------|---------------|
| Booking, payment, authentication | Rule-based state machines + slot filling |
| Customer support FAQs | Retrieval over curated answers |
| Open-ended help chat | LLM agent with RAG + tool calls |
| Internal tools / IDE assistants | LLM agent with tool calls (search, read, write) |
| Companion / character chatbots | Tuned LLM with persona system prompt, retrieval on knowledge |

总是使用混合路由在生产中.没有一个架构都能处理每一个请求.路由层本身通常是一个小的意图分类器.

## 仍运输的故障模式

- **Confident fabrication.**减轻:验证结果,记录工具的调用,永远不要让LLM声称没有成功的工具返回.
- **Prompt injection.**用户插入了超过系统提示的文本.在OWASP LLM应用程序2025年10大排名中排名的LLM01.两种口味:直接注射 (贴在聊天中) 和间接注射 (隐藏在文件,电子邮件或工具输出中,代理阅读).

  攻击率因情况而异. 在一般工具使用和编码基准中,测量成功率在边界模型中为0.5-8.5%. 特定高风险设置 (适应性攻击AI编码代理,脆弱的编排) 达到84%. 产品 CVE包括 EchoLeak (CVE-2025-32711, CVSS 9.3) 微软 365 副驾驶员中零点击数据泄露漏洞是由攻击者控制的电子邮件触发的.

  减轻措施:将用户输入视为整个循环中不值得信赖;在工具调用之前进行清洁;将工具输出从主提示中隔离;使用计划-验证-执行 (PVE) 模式,该模式首先计划,然后在执行之前验证每个行动与该计划相反 (这阻止工具结果注入新的未计划的行动);要求用户确认破坏性行动;对工具范围应用最小特权.

  没有大量的快速工程完全消除了这种风险. 需要外部运行时防护层 (LLM Guard,允许验证,语义异常检测).
- **Scope creep.**减轻:狭窄工具合约;保持系统的焦点;增加对任务之外的率的评估.
- **Infinite loops.**减轻:步骤预算,工具调用减倍,法师法官说"我们正在取得进展".
- **Context window exhaustion.**缓解:总结较早的转折,通过相似性检索相关的过去转折,或使用长文本模型.

## 运送它

保存如`outputs/skill-chatbot-architect.md`其他:

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

## 运动

1. **Easy.**执行上述基于规则的响应,为咖啡店订购机器人进行10个模式. 测试边缘情况:双订单,修改,取消,不明确的意图.
2. **Medium.**构建一个混合FAQ+LLM回复. 50个包装FAQ输入用于SaaS产品,LLM回复与文件网站检索.测量100个真正的支持问题上的拒绝率和准确性.
3. **Hard.**执行上述代理循环,使用三个工具 (搜索,阅读用户数据,发送电子邮件).运行50个测试场景的评估,包括即时注射尝试.报告出班率,失败任务率和任何注射成功.

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Intent | What the user wants | Categorical label (book_flight, reset_password). Routed to a handler. |
| Slot | A piece of info | Parameter the bot needs (date, destination). Slot filling is the sequence of asks. |
| RAG | Retrieval plus generation | Retrieve relevant docs, then ground the LLM's response. |
| Tool call | Function invocation | LLM emits a structured call with name + args. Runtime executes, returns result. |
| Agent loop | Plan, act, verify | Controller that runs LLM calls interleaved with tool calls until task complete. |
| Prompt injection | User attacks prompt | Malicious input that tries to override the system prompt. |

## 进一步阅读

- [Turing (1950). Computing Machinery and Intelligence](https://academic.oup.com/mind/article/LIX/236/433/986238)使对话成为该领域的基准.
- [Weizenbaum (1966). ELIZA — A Computer Program For the Study of Natural Language Communication](https://web.stanford.edu/class/cs124/p36-weizenabaum.pdf)基于规则的原始聊天机器人论文.
- [Colby, Weber, Hilf (1971). Artificial Paranoia](https://doi.org/10.1016/0004-3702(71)巴里的影响变量架构,是第一台充满状态的聊天机器人.
- [Thoppilan et al. (2022). LaMDA: Language Models for Dialog Applications](https://arxiv.org/abs/2201.08239)谷歌的晚期神经聊天机论文, 就在法学院代理人接管之前.
- [Yao et al. (2022). ReAct: Synergizing Reasoning and Acting in Language Models](https://arxiv.org/abs/2210.03629)是指指代理循环模式的文件.
- [Anthropic's guide on building effective agents](https://www.anthropic.com/research/building-effective-agents) 2024年生产预测,仍在2026年保持.
- [Greshake et al. (2023). Not what you've signed up for: Compromising Real-World LLM-Integrated Applications with Indirect Prompt Injection](https://arxiv.org/abs/2302.12173)即时注射纸.
- [OWASP Top 10 for LLM Applications 2025 — LLM01 Prompt Injection](https://genai.owasp.org/llmrisk/llm01-prompt-injection/)使即时注射成为安全问题.
- [AWS — Securing Amazon Bedrock Agents against Indirect Prompt Injections](https://aws.amazon.com/blogs/machine-learning/securing-amazon-bedrock-agents-a-guide-to-safeguarding-against-indirect-prompt-injections/)包括计划-验证-执行和用户确认流程在内的实用调整层防御.
- [EchoLeak (CVE-2025-32711)](https://www.vectra.ai/topics/prompt-injection)可视的零点击数据泄漏CVE从间接提示注射. 为什么写入访问代理需要运行时间防御的参考案例.
