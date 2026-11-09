# 案例研究和2026年最新技术

> 对于研究的结尾到结尾,每一个都说明了多代理工程的不同部分. **Anthropic's Research system**,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,**MetaGPT / ChatDev**(软件工程的SOP编码角色专业化;ChatDev的"沟通性幻觉化";通过DAG扩展到1000个代理, arXiv:2406.07155) 是正规的角色分解案例. **OpenClaw / Moltbook**(原本由彼得·斯坦伯格 (Peter Steinberger) 命名为Clawdbot,2025年11月;两次改名;2026年3月247万个GitHub星;本地ReAct-loop代理;Moltbook作为一个仅供代理商使用的社交网络,在发行几天内拥有约2.3万个代理账户,Meta收购2026-03-10) 说明了人口规模发生的事情:新兴的经济活动,即时注射风险,国家级监管 (中国限制了OpenClaw在政府计算机上,2026年3月).**Framework landscape April 2026:**兰格拉夫和克鲁艾的首席生产;AG2是社区的AutoGen延续;微软的AutoGen处于维护模式 (融入微软代理框架,RC Feb 2026);OpenAI代理SDK是生产Swarm的继任者;谷歌ADK (4月 2025) 是A2A原生参与者. 现在每个主要框架都提供MCP支持;大多数都提供A2A. 这一课将每个案例都读完, 并将常见的模式进行分析,

**Type:** Learn (capstone)
**Languages:** Python, TypeScript
**Prerequisites:** all of Phase 16 (Lessons 01-24)
**Time:** ~90 minutes

## 问题

复合代理工程是一个年轻的学科. 制作参考数量很少,每个产品都涵盖了不同的空间. 读一读一读是有用的;比较它们作为一组更有用. 这一课将三项可信的2026例证作为一个完整的阅读列表, 入了共同的模式,

## 概念

### 人类研究系统

制作监督员工案例. 克劳德·奥普斯4计划和合成; 克劳德·索内特4副主题研究并行. 发表工程帖子: https://www.anthropic.com/engineering/multi-agent-research-system.

关键测量结果:

- **+90.2%**内部研究评估的单剂Opus 4的改善.
- **80% of BrowseComp variance**解释**token usage alone**多代理主要因为每个子代理得到一个新的背景窗口.
- **15x tokens per query**对于单人代理.
- **Rainbow deployment**因为代理人是长期的,有权力.

设计课程编码:

1. **Scale effort to query complexity.**简单 → 1 个代理,有 3-10 个工具调用. 中等 → 3 个代理. 复杂的研究 → 10+ 个子代理.
2. **Broad first, then narrow.**子做广泛的搜索;子合成; 后续的子做针对的深度.
3. **Rainbow deploys.**保持旧运行时间版本活着,直到他们的飞行员完成.
4. **Verification is not optional.**系统没有明确的验证器作用.

这就是生产规模的监督员工拓 (阶段16 · 05) 的参考案例.

### 转载数据

产品SOP角色分解案例. 覆盖 arXiv:2308.00352 (MetaGPT) 和 arXiv:2307.07924 (ChatDev).

编码软件工程SOP作为角色提示:产品经理,建筑师,项目经理,工程师,QA工程师.`Code = SOP(Team)`每个角色都有一个狭窄的专业提示; 角色间交换都包含结构化文物 (PRD文件,建筑文件,代码).

德夫的贡献: **communicative dehallucination**设计人员在设计UI之前向程序员询问该语言是什么,而不是猜测. 这一报告报告显示,多代理管道中的幻觉可测量.

现在,MacNet (arXiv:2406.07155) 扩展了ChatDev到**>1000 agents via DAGs**每个DAG节点都是角色专业化;边缘编码交换合约. 规模是可能的,因为路由是明确的和离线计算.

设计课程:

1. **Structure matters more than size.**紧密的五角色的SOP团队击败了50名非结构化团队.
2. **Handoff contracts in writing.**角色之间传递的文物遵循一个方案.
3. **Communicative dehallucination**它们是便宜的,承载的模式.
4. **DAGs scale further than chat.**当流量可识别时,将其编码.

这就是角色专业化 (16 · 08) 和结构化拓学 (16 · 15) 的参考案例.

### 开关/Moltbook生态系统

产量人口规模的情况.

- **Nov 2025:**鱼 (Peter Steinberger的当地ReAct循环编码代理) 舰船.
- **Jan 2026:**在一周内改名为两次 (在商标投诉后1月27日Clawdbot → Moltbot,然后三天后Moltbot → OpenClaw).
- **Feb 2026:**马尔特本作为一个只代理的社交网络,
- **Mar 2026 (2026-03-10):**梅塔收购了Moltbook.
- **Mar 2026:**中国限制了OpenClaw的政府计算机.
- **Mar 2026:**开关跨越了247万个GitHub星星.

它们是多元代理的,

- **Emergent economic activity.**代理商通过代币支付购买,销售和服务.
- **Prompt-injection risks at population scale.**病毒代理的一个恶意提示在几个小时内传播到成千上万的代理对代理的互动.
- **State-level regulatory response.**几个星期后, 监管进入生态系统.

设计的教训是部分技术,部分治理:

1. **Multi-agent at population scale is a new regime.**个人系统最佳实践 (验证,角色清晰度) 仍然适用,但不足.
2. **Prompt injection is the new XSS.**默认情况下,将代理人的个人资料和跨代理信息视为不可信赖的输入.
3. **Regulation is faster than design cycles.**计划一下.
4. **Open-source + viral scale compounds.**射4个月的247万颗星星是不寻常的;

看到[OpenClaw Wikipedia](https://en.wikipedia.org/wiki/OpenClaw)对于技术基础,Clawdbot / OpenClaw存储库揭示了本地ReAct循环;Moltbook的公开帖子显示了社交图架构.

### 框架景观2026年4月

| Framework | Status | Best for | Notes |
|---|---|---|---|
| **LangGraph** (LangChain) | Production leader | structured graph + checkpointing + human-in-the-loop | recommended default for production |
| **CrewAI** | Production leader | role-based crews with Sequential/Hierarchical processes | strong for role decomposition |
| **AG2** | Community maintained | GroupChat + speaker selection | AutoGen v0.2 continuation |
| **Microsoft AutoGen** | Maintenance mode (Feb 2026) | — | merged into Microsoft Agent Framework RC |
| **Microsoft Agent Framework** | RC (Feb 2026) | orchestration patterns + enterprise integration | new entrant; watch |
| **OpenAI Agents SDK** | Production | Swarm successor | tool-return handoff pattern |
| **Google ADK** | Production (April 2025) | A2A-native | Google Cloud integration |
| **Anthropic Claude Agent SDK** | Production | single-agent + Research extension | see the Research system post |

现在每个主要框架都在运输.**MCP**支持;大多数船**A2A**协议兼容性不再是区别因素.

### 在所有三个案件中,

1. **Orchestrator + workers**(人类明确监督者,MetaGPT PM-as-supervisor,OpenClaw个体代理 +网络效应).
2. **Structured handoff contracts**(人类的子基任务描述,MetaGPT PRD/架构文件,OpenClaw A2A文物).
3. **Verification as first-class role**(Anthropic的验证器,MetaGPT的QA工程师,OpenClaw的网络验证器).
4. **Scaling is topology + substrate, not just more agents**(彩虹部署,MacNet DAGs,人口规模基板).
5. **Cost is material and disclosed**对于每一个角色的预算,Moltbook的交互价格.
6. **Security posture is explicit**(人类的沙盒,MetaGPT的角色限制,OpenClaw的即时注射作为已知攻击表面).

### 选择下一个项目参考

- **Production research / knowledge task → Anthropic Research.**新文本的子集赢了.
- **Engineering / tool-chain workflow → MetaGPT / ChatDev.**角色+SOP+交换合同
- **Network-effect social product → OpenClaw / Moltbook.**基层+新兴经济.
- **Classic enterprise automation → CrewAI or LangGraph**(生产领导者,稳定运行时间).

### 2026年最新总结

在2026年4月的场地:

- **Frameworks are converging.**支持MCP+A2A是桌面投注. 交换语义是剩下的设计选择.
- **Evaluation is hardening.**现在的防污现实检查.
- **Production failure rates are measurable**现实MAS的比例为41%-86.7%,
- **Cost is the central engineering constraint.**代币成本每任务,墙钟每交互,彩虹部署的上海费用.多代理赢得准确性,但损失成本,交易是商业决定.
- **Regulation is a near-term input, not a background concern.**司法管辖区的速度比个体部署周期更快.

```figure
a5-orchestrator-scale
```

## 用它

`outputs/skill-case-study-mapper.md`是阅读拟议的多代理系统设计并将其映射到最近的案例研究中,并将已经测试的案例研究的设计决定呈现出来.

## 运送它

2026年生产多代理的初步规则:

- **Start from a case study, not from scratch.**选择最接近的人类研究/ MetaGPT/ OpenClaw 的方法,并适应.
- **Adopt MCP + A2A.**跨框架的可移植性是有价值的;协议支持是免费的.
- **Measure against SWE-bench Pro or your internal Pro-equivalent.**检测到是受污染的.
- **Pay the verification tax.**独立验证器的成本是您的代币预算的20-30%,并且可以测量准确度.
- **Rainbow deploy long-running agents.**预计多小时的代理运行将是常规的.
- **Read WMAC 2026 and the MAST follow-ups.**纪律正在迅速发展.

## 运动

1. 阅读人类研究系统的完整内容. 确定如果您将Opus 4取代于较小的模型 (例如,海库 4) 改变的三个设计决定.
2. 阅读 MetaGPT 第3-4节 (arXiv:2308.00352).从您自己的域名 (而不是软件) 编码一个SOP作为角色提示.SOP意味着多少角色?
3. 查看ChatDev (arXiv:2307.07924). 确定"沟通性幻觉"的机制.
4. 阅读OpenClaw和Moltbook. 选择一个特定的失败模式,在人口规模上出现,
5. 选择您目前的多代理项目. 在三个案例研究中,哪个是最接近参考?从该案例研究中,您尚未采取哪些设计决定? 写下您将在本季度采取的一个.

## 关键词

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Anthropic Research | "The supervisor reference" | Claude Opus 4 + Sonnet 4 subagents; 15x tokens; +90.2% over single-agent. |
| MetaGPT | "SOP as prompts" | Role decomposition for software engineering; `Code = SOP(Team)`. |
| ChatDev | "Agents as roles" | Designer / programmer / reviewer / tester; communicative dehallucination. |
| MacNet | "Scale ChatDev via DAG" | arXiv:2406.07155; 1000+ agents via explicit DAG routing. |
| OpenClaw | "Local ReAct-loop agents" | Steinberger's project; 247k stars by March 2026. |
| Moltbook | "Agent-only social network" | 2.3M agent accounts; acquired by Meta March 2026. |
| Rainbow deploy | "Multiple versions concurrent" | Keep old runtime versions alive for in-flight long-running agents. |
| Communicative dehallucination | "Ask before answering" | Agents request specifics from peers instead of guessing. |
| WMAC 2026 | "The AAAI workshop" | April 2026 community focal point for multi-agent coordination. |

## 进一步阅读

- [Anthropic — How we built our multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system)监督工人的生产参考
- [MetaGPT — Meta Programming for Multi-Agent Collaborative Framework](https://arxiv.org/abs/2308.00352) SOP作用分解
- [ChatDev — Communicative Agents for Software Development](https://arxiv.org/abs/2307.07924)沟通性幻觉
- [MacNet — scaling role-based agents to 1000+](https://arxiv.org/abs/2406.07155) DAG基础的规模
- [OpenClaw on Wikipedia](https://en.wikipedia.org/wiki/OpenClaw)生态系统概况
- [WMAC 2026](https://multiagents.org/2026/)AAAI2026年多代理协调桥梁计划研讨会
- [LangGraph docs](https://docs.langchain.com/oss/python/langgraph/workflows-agents)生产领导者
- [CrewAI docs](https://docs.crewai.com/en/introduction)基于角色的框架
