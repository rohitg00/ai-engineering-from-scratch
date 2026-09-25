# AI 运维 SRE — 多智能体事件响应、Runbook、预测性检测

> AI SRE 使用基于基础设施数据(日志、runbook、服务拓扑)并通过 RAG 检索增强的 LLM,自动化调查、文档记录和协调阶段。2026 年的架构模式是多智能体编排——由 supervisor 协调多个专用智能体(日志、指标、runbook);AI 提出假设和查询,人类对关键判断进行审批。Datadog Bits AI 和 Azure SRE Agent 已作为托管产品交付这一模式。Runbook 正在演变:NeuBird Hawkeye 使用对抗式评估(两个模型分析同一事件;一致 = 高置信度,分歧 = 不确定性);运维记忆在人员变动中持续保留。自动修复仍保持谨慎:AI 建议,人类审批。完全自主的操作范围很窄(重启 pod、回滚特定部署)并有严格护栏——任何宣传"设置后即可不管"的人都在夸大其词。新兴前沿:事前预测。MIT 的研究报告称,基于历史日志 + GPU 温度 + API 错误模式训练的 LLM,提前 10-15 分钟预测了 89% 的故障。预测:到 2026 年底,95% 的企业级 LLM 将具备自动故障转移能力。

**Type:** Learn
**Languages:** Python (标准库,简易多智能体事件分诊模拟器)
**Prerequisites:** Phase 17 · 13 (Observability), Phase 17 · 24 (Chaos Engineering)
**Time:** 约 60 分钟

## 学习目标

- 绘制多智能体 AI SRE 架构图:supervisor + 专用智能体(日志、指标、runbook)+ 人工审批门。
- 解释为什么自动修复范围狭窄(重启 pod、回滚部署)而非宽泛(重新设计服务架构)。
- 说出对抗式评估模式(NeuBird Hawkeye):两个模型一致 = 高置信度;分歧 = 上报人工。
- 引用 MIT 89% 早期检测结果及其运维约束:无法付诸行动的预测只是仪表盘。

## 问题

一名值班工程师在凌晨 3 点收到告警。"checkout 服务错误率过高。"他们查看 Datadog、Loki、三份 runbook、部署日志。30 分钟后,他们才发现根因是 KV cache 激增导致的 vLLM OOM。他们重启了 pod,错误消除。

在 2026 年,这类调查的前 20 分钟是可以自动化的。按服务分组日志、关联最近的部署、匹配 runbook——全都是 RAG + 工具调用。一个有监督的智能体可以在人类打开 Datadog 之前完成初步分诊并提出假设。

完全自主的修复是另一回事。重启 pod:安全。扩展 GPU 池:在策略允许时安全。重新设计服务架构:绝对不行。关键原则在于划定这条狭窄的边界。

## 概念

### 多智能体架构

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

Supervisor 将事件拆解为子查询。专用智能体拥有工具访问权限(日志搜索、PromQL、文档检索)。Supervisor 汇总结果,向人类呈现假设 + 证据。人类批准或调整方向。

### 自动修复范围

**安全(狭窄)**:重启 pod、回滚特定部署、在预批准范围内扩展资源池、启用预批准的功能开关。

**不安全(宽泛)**:更改服务拓扑、修改资源限制、部署新代码、更改 IAM、变更数据库。

任何宣传"设置后即可不管"的人都在夸大其词。随着 AI SRE 的成熟,安全集合会扩大,但这条边界是真实存在的。

### 对抗式评估(NeuBird Hawkeye)

两个模型独立分析同一事件。如果它们对根因结论一致,置信度高。如果分歧,则将两个假设同时呈现给人类并上报。模式简单,却是防止幻觉根因的有效过滤器。

### 运维记忆

人员流失是传统 SRE 的隐形杀手——部落知识随人员离职而消失。AI SRE 将 runbook + 复盘报告存储在向量数据库中;智能体在每次新事件中检索。当新工程师入职时,AI 已拥有完整的历史。

### 事前预测

MIT 2025 研究:基于历史日志、GPU 温度、API 错误模式训练的 LLM,在测试集上提前 10-15 分钟预测了 89% 的故障。

现实检验:无法付诸行动的预测只是仪表盘。运维层面的问题是"当我们做出预测时,该做什么?"提前排水?触发告警?自动扩容?答案取决于具体策略。

### 2026 年的产品

- **Datadog Bits AI** — Datadog 内置的托管 SRE 副驾驶。
- **Azure SRE Agent** — Azure 原生。
- **NeuBird Hawkeye** — 对抗式评估 + 运维记忆。
- **PagerDuty AIOps** — 分诊 + 去重。
- **Incident.io Autopilot** — 事件指挥 + 协调。

### Runbook 即代码

Runbook 正从 Confluence 页面演变为带有结构化章节(症状、假设、验证、操作)的版本化 markdown。结构化的 runbook 能带来更好的 RAG 检索效果。任何 AI SRE 落地的第一步都是将非结构化 runbook 结构化。

### 应当记住的数字

- MIT 早期检测:89% 的故障,提前 10-15 分钟。
- 多智能体分诊:supervisor +(日志、指标、runbook)+ 人类。
- 安全自动修复集合:重启 pod、回滚部署、在边界内扩容。
- 对抗式评估:两个模型独立分析;一致 = 高置信度。

```figure
i4-incident-agents
```

## 使用它

`code/main.py` 模拟多智能体分诊:日志智能体发现错误,指标智能体发现 CPU 激增,runbook 智能体匹配到已知问题。Supervisor 对假设排序。

## 交付它

本课产出 `outputs/skill-ai-sre-plan.md`。根据当前值班安排、事件量、团队成熟度,设计一份 AI SRE 落地方案。

## 练习

1. 运行 `code/main.py`。如果日志智能体和指标智能体结论不一致怎么办?Supervisor 如何裁决?
2. 为你的服务定义三个"安全"的自动修复操作,并逐一说明理由。
3. 编写一个结构化 runbook 模板:章节、必填字段、验证命令。
4. 预测性检测在提前 12 分钟时触发。你的策略是什么——告警、提前排水,还是两者兼用?
5. 论证一个 3 人团队在 2026 年应该采用 AI SRE 还是观望。考虑成熟度、事件量、风险。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|------------------------|------------------------|
| AI SRE | "值班智能体" | 基于 LLM 的事件调查 + 协调 |
| Supervisor 智能体 | "编排器" | 将事件拆解为子查询的顶层智能体 |
| 专用智能体 | "领域智能体" | 拥有工具访问权限的子智能体(日志、指标、runbook) |
| 自动修复 | "AI 修复它" | 狭窄的预批准操作;不是宽泛的架构重构 |
| 运维记忆 | "向量 runbook" | 存于向量数据库中的复盘报告 + runbook,用于 RAG |
| 对抗式评估 | "双模型校验" | 独立分析;一致 = 高置信度 |
| NeuBird Hawkeye | "对抗式那款" | 采用对抗式评估 + 记忆模式的产品 |
| Bits AI | "Datadog 的 SRE 智能体" | Datadog 托管的 AI SRE |
| 事前预测 | "早期检测" | 故障预测的 10-15 分钟提前量 |

## 延伸阅读

- [incident.io — AI SRE Complete Guide 2026](https://incident.io/blog/what-is-ai-sre-complete-guide-2026)
- [InfoQ — Human-Centred AI for SRE](https://www.infoq.com/news/2026/01/opsworker-ai-sre/)
- [DZone — AI in SRE 2026](https://dzone.com/articles/ai-in-sre-whats-actually-coming-in-2026)
- [Datadog Bits AI](https://www.datadoghq.com/product/bits-ai/)
- [NeuBird Hawkeye](https://www.neubird.ai/)
- [awesome-ai-sre](https://github.com/agamm/awesome-ai-sre)