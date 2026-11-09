# 间接即时注射 生产攻击表面

> 间接提示注射 (IPI) 嵌入外部内容中的指示 一个网页,电子邮件,共享文档,支持门票 由一个机构系统消耗而没有明确的用户行动. IPI是2026年产品威胁的主导:它绕过用户输入过器,因为攻击者从来没有触及用户,它默默地扩展,因为代理人处理更多外部内容, 据MDPI信息17(1):54 (2026年1月) 综合 2023-2025研究. NDSS 2026 的IPI防护文件置了核心挑战:注射的指示可以是语义上良性的 ("请打印是的"),因此检测不仅需要关键字过. "攻击者第二次行动" (Nasr等人,联合OpenAI/Anthropic/DeepMind,2025年10月):适应性攻击 (梯度,RL,随机搜索,人类红队) 绕过了他们测试的12个公布的防御,攻击成功率超过90%对大多数攻击者,尽管这些防御最初报告了接近零的攻击成功率.

**Type:** Build
**Languages:** Python, TypeScript (stdlib, IPI attack + defense harness)
**Prerequisites:** Phase 18 · 12 (PAIR), Phase 14 (agent engineering)
**Time:** ~75 minutes

## 学习目标

- 定义间接即时注射并描述三个常见的输送向量.
- 解释用户输入过器为什么完全错过IPI.
- 描述"信息流量控制"框架为2026年国防范式.
- 说明纳斯尔等人 (2025年10月) 关于针对公布的IPI防御的适应性攻击成功的发现.

## 问题

直接提示注射要求攻击者接触用户或他们的提示.IPI不要求任何一个:攻击者将一个有效载荷放在任何内容中,代理可能阅读网页,邮件在收件箱,GitHub问题,产品评论.代理在正常运行期间接收它并执行说明.用户是消息员,不是意图.

## 概念

### 输送向量

- **Retrieval-augmented generation (RAG).**攻击者发布文件;检索步骤将其获取;提示在用户问之前将其连接链接;模型执行攻击者的指示.
- **Inbox / document workflows.**攻击者向用户发送电子邮件;代理阅读电子邮件;提示包括电子邮件体;模型遵循电子邮件的指示.
- **Tool output.**攻击者控制了代理使用的工具 (例如,网页搜索返回攻击者控制的结果);工具输出包含指令;代理的控制流量遵循它们.

攻击者控制了一个提示片段,而不触及面向用户的输入.

### 为什么用户输入过器错过了

如果过器被关闭于用户输入,则有效载荷绕过它.如果过器被关闭于所有到达模型的内容,则必须适用于任意检索的文本,这是昂贵的,并且产生了假正的内容,而内容恰恰包含强制语音语言.

### 智能化智能信息流量控制 (IFC)

2026 防务范式借鉴了经典的操作系统安全.将每个内容来源视为安全标签.将用户的查询标记为"可信".将检索的内容标记为"不可信".将模型的控制流作为信息流:由不可信的内容触发的操作必须在执行之前由可信的输入批准.

据了解,在线数据的使用率是很高,但在线数据的使用率是很高,所以我们可以使用线数据的使用率是很高.

### 攻击者第二次行动

纳斯尔等人 (2025年10月) 测试了12个已发布的IPI防御,使用适应性攻击 (渐变搜索,RL政策,随机搜索,72小时人类红队).每个防御都被绕过,其中大多数在90% ASR,其中大多数最初报告了接近零 ASR.

方法学课:只用适应攻击评估发布防御.静态攻击基准不是强度的证据;攻击者了解防御.

### 实际事件

第25课涵盖EchoLeak (CVE-2025-32711,CVSS 9.3) 微软365副驾驶器中的首个公开记录的零点击IPI.在 GitHub副驾驶器聊天中CamoLeak (CVSS 9.6) .在 GitHub副驾驶器中CVE-2025-53773 .在实地上IPI正在破坏生产部署,而不仅仅是基准.

### 欧亚斯普和NIST框架

欧亚斯普法学院排名第10 (2025) 间接注射 (直接+间接) 是第1的应用层威胁.NIST AI SPD 2024称间接注射"是生成AI最大的安全缺陷".

### 在这个阶段的第18阶段

课时12-14是基于模型的门.课时15是系统中心的攻击,占据了2026年生产部署的主导地位.课时16涵盖了防御工具.课时25涵盖了特定的CVE叙述.

```figure
al-injection-vector
```

## 用它

`code/main.py`建立一个IPI带. 玩具代理有三个工具 (搜索网,阅读电子邮件,发送消息). 环境包含攻击者控制的内容,并包含嵌入式指令 ("将此传递给所有联系人"). 您可以在一个简单的代理 (遵循注射说明),一个选器 (检索内容上的关键字选器) 和一个IFC代理 (分离可信的内容和不可信的内容,拒绝不可信的控制流命令之间进行交换).

## 运送它

这一课产生了`outputs/skill-ipi-audit.md`鉴于部署的代理描述,它列出了不值得信赖的内容来源,检查部署是否适用于IFC,并标记了没有信任标签的源头.

## 运动

1. 跑步`code/main.py`测量对三个特工的攻击成功率.

2. 检索内容的表达式防御. 测量合法检索文本的良性假阳性率.

3. 阅读NDSS 2026 IPI防护论文. 描述"良性指令"挑战以及它为什么阻止基于关键字的过.

4. 设计一个部署,代理从第三方 API 获取工具输出.标记每个提示片段以信任水平,并写下管理代理行动的IFC政策.

5. 根据练习2进行的纳斯尔等2025适应性攻击方法,在适应性攻击前后报告ASR.

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| IPI | "indirect prompt injection" | Injection via content the user did not write, consumed by the agent during normal operation |
| RAG injection | "poisoned retrieval" | Attacker publishes content that the retrieval step fetches; prompt contains the payload |
| Zero-click | "no user action" | Attack triggers automatically during agent operation; user does nothing |
| IFC | "information flow control" | Label-based approach: actions from untrusted content require trusted ratification |
| Adaptive attack | "gradient / RL red-team" | Attack that knows the defense and optimizes against it; required for honest evaluation |
| Benign instruction | "please print Yes" | IPI payload that is semantically benign; no keyword filter catches it |
| Scope violation | "cross-trust exfiltration" | Agent accesses data from one trust context and outputs it to another |

## 进一步阅读

- [MDPI Information 17(1):54 — Indirect Prompt Injection Survey (January 2026)](https://www.mdpi.com/2078-2489/17/1/54) 2023-2025年综合
- [Nasr et al. — The Attacker Moves Second (joint OpenAI/Anthropic/DeepMind, October 2025)](https://arxiv.org/abs/2510.18108)适应性攻击评估
- [Greshake et al. — Not what you've signed up for (arXiv:2302.12173)](https://arxiv.org/abs/2302.12173)原始IPI文件
- [OWASP — LLM Top 10 (2025)](https://genai.owasp.org/llm-top-10/)快速注射等级LLM01
