# 针对AI的SRE 多代理事件响应,跑本,预测检测

> 通过RAG,通过基础设施数据 (日志,运行簿,服务拓) 实现自动化调查,文档和协调阶段的LLM. 2026 建筑模式是多代理管弦乐专业代理 (日志,指标,运行书籍) 由监督者协调; AI提出假设和查询,人类批准判断调用. 数据狗比特人工智能和Azure SRE代理将这些作为管理产品. 跑本正在发展:NeuBird Hawkeye使用对抗评估 (两个模型分析相同事件;协议 =信心,不同意见 =不确定性); 操作记忆在团队变化中持续存在. 自动补救仍然谨慎:人工智能建议,人类批准. 完全自主操作是狭窄的 (重新启动,反弹特定部署) 紧密的防护 任何销售"设置并忘记"的人都在超销. 突出界限:事件前预测 麻省理工学院的研究报告显示,在历史记录+GPU时间+API错误模式上训练的LLM预测, 预测:到2026年底,企业中95%的LLM将自动转账.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, toy multi-agent incident triage simulator)
**Prerequisites:** Phase 17 · 13 (Observability), Phase 17 · 24 (Chaos Engineering)
**Time:** ~60 minutes

## 学习目标

- 绘制多代理AI SRE架构:监督者+专业代理 (日志,指标,运行簿) +人体批准门.
- 解释为什么自动补救是狭窄的 (重新启动,重新部署) 而不是广泛的 (重建服务).
- 举个对抗性评估模式 (NeuBird Hawkeye):两个模型一致=信心;不同=升级.
- 提及MIT 89%早期检测结果和操作限制:没有动作的预测只是仪表板.

## 问题

电话上的工程师在凌晨3点被调用"检查时错误率很高".他们检查了Datadog,Loki,三个运行簿,部署日志.30分钟后,他们意识到根本原因是从KV缓存尖端的VLLM OOM.他们重新启动了,错误清除了.

2026年,该调查的前20分钟可自动化. 根据服务,与最近部署相关的,与运行簿相匹配的集团日志都是RAG+工具使用.监督的代理人在打开Datadog之前可以进行第一次通过分类并提出假设.

完全自主修复是一个不同的问题. 重启:安全. 扩展GPU池:安全,如果政策允许. 重新构建服务:绝对不是. 纪律是画窄的线.

## 概念

### 多代理架构

```
          Incident
             │
             ▼
        Supervisor
        /    |    \
       ▼     ▼     ▼
  Log agent  Metric agent  Runbook agent
       │     │     │
       └─────┴─────┘
             │
             ▼
        Hypothesis + evidence
             │
             ▼
        Human approval
             │
             ▼
        Action (narrow set)
```

监督者将事件分为子查询.专业代理人有工具访问 (日志搜索,PromoQL,文件检索).监督者合成,向人类提供假设 +证据.人类批准或转向.

### 自动补救范围

**Safe (narrow)**:重新启动组,反转特定部署,在预先批准的边界内进行规模积分,启用预先批准的功能旗.

**Not safe (broad)**改变服务拓,修改资源限制,部署新代码,改变IAM,改变数据库.

随着AI SRE的成熟,安全套就会增长,但边界是真实的.

### 逆境评估 (新鸟眼)

两种模型独立分析相同的事件.如果他们同意根源,信心很高.如果他们不同意,升级到人类,两个假设可见.简单的模式,有效的过对幻觉根源.

### 运行内存

团队转换是传统的SRE 部落知识叶片的沉默杀戮.AI SRE在向量DB中存储跑本+死后检测;代理人在每次新事件中获取.当新工程师加入时,AI拥有完整的历史.

### 事件前预测

通过历史记录,GPU温度,API错误模式训练的LLM预测在测试组发生前10-15分钟发生的停机量占89%.

现实检查:没有动机的预测是仪表板. 操作问题是"当我们预测时,我们会做什么?" 预防性排泄? 页面? 自动扩展?

### 2026年产品

- **Datadog Bits AI**在Datadog内部管理了SRE副飞行员.
- **Azure SRE Agent** 蓝色原生.
- **NeuBird Hawkeye**对抗性评估+运行记忆.
- **PagerDuty AIOps**分类+减倍.
- **Incident.io Autopilot**事件指挥官+协调.

### 运行书籍作为代码

运行簿从"流通"页面发展到有结构化的部分 (症状,假设,验证,行为) 的版本分类.结构化运行簿提供更好的RAG检索.通过将未结构化运行簿转化为结构化,启动任何AI-SRE推广.

### 你应该记住的数字

- 早期检测:89%的停机,10-15分钟的领先时间.
- 多代理分类:监督者+ (日志,指标,运行簿) +人.
- 安全自动补救设置:重新启动,重新部署,在限度范围内扩展.
- 矛盾的评估:两个独立的模型; 协议 = 信心.

```figure
i4-incident-agents
```

## 用它

`code/main.py`模拟多代理分类:日志代理发现错误,测量代理发现CPU尖,运行簿代理匹配已知问题.监督员排列假设.

## 运送它

这一课产生了`outputs/skill-ai-sre-plan.md`鉴于当前的调用,事件数量,团队成熟度,设计了AI SRE部署.

## 运动

1. 跑步`code/main.py`如果记录和计量代理人不同意, 监督员怎么解决呢?
2. 确定为您服务的三项"安全"自动补救行动.
3. 编写一个结构化运行簿模板:部分,所需的字段,验证命令.
4. 预测检测火灾12分钟前,你有什么政策?
5. 讨论3人团队是否应该在2026年采用AI SRE,或者等待.

## 关键词

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| AI SRE | "agent for on-call" | LLM-backed incident investigation + coordination |
| Supervisor agent | "the orchestrator" | Top-level agent breaking incidents into sub-queries |
| Specialized agent | "domain agent" | Sub-agent with tool access (logs, metrics, runbooks) |
| Auto-remediation | "AI fixes it" | Narrow pre-approved action; NOT broad re-architecture |
| Operational memory | "vector runbooks" | Post-mortems + runbooks in vector DB for RAG |
| Adversarial eval | "two-model check" | Independent analyses; agreement = confidence |
| NeuBird Hawkeye | "the adversarial one" | Product with adversarial-eval + memory pattern |
| Bits AI | "Datadog's SRE agent" | Datadog-managed AI SRE |
| Pre-incident prediction | "early detection" | 10-15 min lead time on outage prediction |

## 进一步阅读

- [incident.io — AI SRE Complete Guide 2026](https://incident.io/blog/what-is-ai-sre-complete-guide-2026)
- [InfoQ — Human-Centred AI for SRE](https://www.infoq.com/news/2026/01/opsworker-ai-sre/)
- [DZone — AI in SRE 2026](https://dzone.com/articles/ai-in-sre-whats-actually-coming-in-2026)
- [Datadog Bits AI](https://www.datadoghq.com/product/bits-ai/)
- [NeuBird Hawkeye](https://www.neubird.ai/)
- [awesome-ai-sre](https://github.com/agamm/awesome-ai-sre)
