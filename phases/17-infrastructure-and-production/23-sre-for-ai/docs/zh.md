# AI 时代的 SRE —— 多 agent 故障响应、Runbook、预测式检测（SRE for AI — Multi-Agent Incident Response, Runbooks, Predictive Detection）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> AI SRE 通过 RAG 把 LLM 接到基础设施数据（日志、runbook、服务拓扑）上，让调查、文档化、协调这些环节自动化。2026 年的架构范式是多 agent 编排——若干专项 agent（日志、指标、runbook）由一个 supervisor 协调；AI 提出假设和查询，人类拍板做判断。Datadog Bits AI 和 Azure SRE Agent 已经把这套东西做成托管产品。Runbook 也在演化：NeuBird Hawkeye 用对抗式评估（两个模型分析同一起事故；一致即高置信，分歧即不确定）；运营记忆能跨团队人员变动持续累积。自动修复仍偏保守：AI 提建议，人类点确认。完全自主的动作集合很窄（重启 pod、回滚某个 deploy），且配有严格 guardrail（护栏）——任何卖你「设好就不用管」的人都在过度承诺。新前沿是事故前预测：MIT 的研究表明，用历史日志 + GPU 温度 + API 错误模式训练的 LLM，在测试集上能在故障发生前 10-15 分钟预测出 89% 的宕机。预测：到 2026 年底，95% 的企业 LLM 部署会带有自动故障切换。

**Type:** Learn
**Languages:** Python（标准库，玩具级多 agent 故障分诊模拟器）
**Prerequisites:** Phase 17 · 13（Observability）, Phase 17 · 24（Chaos Engineering）
**Time:** ~60 分钟

## 学习目标（Learning Objectives）

- 画出多 agent AI SRE 架构图：supervisor + 专项 agent（日志、指标、runbook）+ 人类审批闸门。
- 解释为何自动修复是「窄」的（重启 pod、回滚 deploy）而不是「宽」的（重构服务）。
- 说出对抗式评估范式（NeuBird Hawkeye）：两个模型一致 = 高置信；分歧 = 上报。
- 引用 MIT 89% 早期检测结果，并说出运营层面的限制：没有动作的预测只是仪表盘。

## 问题（The Problem）

值班工程师凌晨 3 点被 page。「checkout 错误率飙高。」他打开 Datadog、Loki、三个 runbook、deploy 日志。30 分钟后他意识到根因是 vLLM 因 KV cache 突增 OOM。他重启 pod，错误消失。

到了 2026 年，那段调查的前 20 分钟是可以自动化的。按服务对日志分组、和近期 deploy 关联、对照 runbook 匹配——这些都是 RAG + tool use（工具调用）。一个受监督的 agent 可以做第一遍分诊，并在人类打开 Datadog 之前就把假设端上来。

完全自主的修复是另一个问题。重启 pod：安全。在策略允许范围内扩 GPU 池：安全。重构服务：绝对不行。纪律就在于把那条窄线划清楚。

## 概念（The Concept）

### 多 agent 架构（Multi-agent architecture）

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

Supervisor 把事故拆成子查询。专项 agent 各自带工具访问权（日志检索、PromQL、文档检索）。Supervisor 综合结果，把「假设 + 证据」摆给人类看。人类批准或重新指引。

### 自动修复的边界（Auto-remediation scope）

**安全（窄）**：重启 pod、回滚特定 deploy、在预批准范围内扩缩池、开启预批准的 feature flag。

**不安全（宽）**：改服务拓扑、改资源 limit、部署新代码、改 IAM、动数据库。

任何卖你「设好就不用管」的人都在过度承诺。随着 AI SRE 成熟，安全集合会变大，但边界是真实存在的。

### 对抗式评估（Adversarial evaluation，NeuBird Hawkeye）

两个模型独立分析同一起事故。如果它们对根因看法一致，置信度高。如果分歧，连同两边假设一起上报给人。范式简单，但能有效过滤掉 hallucinate（幻觉）出来的根因。

### 运营记忆（Operational memory）

人员流动是传统 SRE 的隐形杀手——部落知识跟人走。AI SRE 把 runbook + post-mortem 存进向量数据库；每次新事故 agent 都去检索。新工程师入职时，AI 已经握有全部历史。

### 事故前预测（Pre-incident prediction）

MIT 2025 研究：用历史日志、GPU 温度、API 错误模式训练的 LLM，在测试集上对 89% 的宕机能提前 10-15 分钟预测到。

提个醒：没有动作的预测只是仪表盘。运营上的真问题是「预测出来之后我们做什么？」提前排空？发 page？自动扩容？答案因策略而异。

### 2026 年的产品（Products in 2026）

- **Datadog Bits AI** —— Datadog 内置的托管 SRE copilot。
- **Azure SRE Agent** —— Azure 原生。
- **NeuBird Hawkeye** —— 对抗式评估 + 运营记忆。
- **PagerDuty AIOps** —— 分诊 + 去重。
- **Incident.io Autopilot** —— 事故指挥官 + 协调。

### Runbook 即代码（Runbooks as code）

Runbook 从 Confluence 页面演化成带结构化分节（症状、假设、验证、动作）的版本化 markdown。结构化 runbook 喂给 RAG 检索效果更好。任何 AI-SRE 落地的第一步，就是把无结构 runbook 改造成结构化的。

### 该记住的数字（Numbers you should remember）

- MIT 早期检测：89% 的宕机，提前 10-15 分钟。
- 多 agent 分诊：supervisor +（日志、指标、runbook）+ 人类。
- 安全的自动修复集合：重启 pod、回滚 deploy、范围内扩缩。
- 对抗式评估：两个模型独立；一致即高置信。

## 用起来（Use It）

`code/main.py` 模拟了一次多 agent 分诊：log agent 找到错误、metric agent 找到 CPU 飙升、runbook agent 匹配到已知问题。Supervisor 给出假设排序。

## 上线部署（Ship It）

本课产出 `outputs/skill-ai-sre-plan.md`。基于当前的 on-call、事故量、团队成熟度，设计一份 AI SRE 落地方案。

## 练习（Exercises）

1. 跑 `code/main.py`。如果 log agent 和 metric agent 意见相左怎么办？supervisor 怎么解？
2. 为你的服务定义三个「安全」的自动修复动作。各自说明理由。
3. 写一份结构化 runbook 模板：分节、必填字段、验证命令。
4. 预测式检测在 12 分钟前触发。你的策略是什么——发 page、提前排空，还是两者兼有？
5. 论证一下：3 人小团队 2026 年应该上 AI SRE，还是再等等？考虑成熟度、体量、风险。

## 关键术语（Key Terms）

| 术语 | 大家嘴上怎么说 | 实际指什么 |
|------|----------------|------------------------|
| AI SRE | 「值班用的 agent」 | LLM 支持的事故调查 + 协调 |
| Supervisor agent | 「编排器」 | 顶层 agent，把事故拆成子查询 |
| Specialized agent | 「领域 agent」 | 子 agent，带工具访问权（日志、指标、runbook）|
| Auto-remediation | 「AI 自己修」 | 预批准的窄动作；**不是**重构 |
| Operational memory | 「向量化 runbook」 | post-mortem + runbook 进向量库供 RAG |
| Adversarial eval | 「两模型互检」 | 独立分析；一致即高置信 |
| NeuBird Hawkeye | 「搞对抗那个」 | 对抗式评估 + 记忆范式的产品 |
| Bits AI | 「Datadog 的 SRE agent」 | Datadog 托管的 AI SRE |
| Pre-incident prediction | 「早期检测」 | 宕机提前 10-15 分钟预测 |

## 延伸阅读（Further Reading）

- [incident.io — AI SRE Complete Guide 2026](https://incident.io/blog/what-is-ai-sre-complete-guide-2026)
- [InfoQ — Human-Centred AI for SRE](https://www.infoq.com/news/2026/01/opsworker-ai-sre/)
- [DZone — AI in SRE 2026](https://dzone.com/articles/ai-in-sre-whats-actually-coming-in-2026)
- [Datadog Bits AI](https://www.datadoghq.com/product/bits-ai/)
- [NeuBird Hawkeye](https://www.neubird.ai/)
- [awesome-ai-sre](https://github.com/agamm/awesome-ai-sre)
