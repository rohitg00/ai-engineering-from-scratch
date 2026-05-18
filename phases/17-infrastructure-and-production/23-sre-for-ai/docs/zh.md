# AI 时代的 SRE —— 多智能体事件响应、运维手册与预测性检测

> AI SRE 利用基于 RAG 的 LLM，将基础设施数据（日志、运维手册、服务拓扑）作为 grounding，实现调查、文档化和协调阶段的自动化。2026 年的架构模式是多智能体编排 —— 由主管协调的专业智能体（日志、指标、运维手册）；AI 提出假设和查询，人类审批判断。Datadog Bits AI 和 Azure SRE Agent 将其作为托管产品交付。运维手册正在演进：NeuBird Hawkeye 使用对抗性评估（两个模型分析同一事件；一致 = 有信心，不一致 = 不确定）；运维记忆在团队变动中持续存在。自动修复保持谨慎：AI 建议，人类审批。完全自主的行动范围很窄（重启 Pod、回滚特定部署），并有严格的护栏 —— 任何宣传"设置好就不用管"的人都在过度推销。新兴前沿：事故前预测。MIT 研究报告称，一个在历史日志 + GPU 温度 + API 错误模式上训练的 LLM，提前 10–15 分钟预测了 89% 的故障。预测：到 2026 年底，95% 的企业 LLM 将实现自动故障转移。

**类型：** 学习
**语言：** Python（标准库，简易多智能体事件分诊模拟器）
**前置知识：** 第 17 阶段 · 13（可观测性）、第 17 阶段 · 24（混沌工程）
**时间：** ~60 分钟

## 学习目标

- 绘制多智能体 AI SRE 架构图：主管 + 专业智能体（日志、指标、运维手册）+ 人类审批关卡。
- 解释为何自动修复范围狭窄（重启 Pod、回滚部署），而非广泛（重构服务）。
- 说明对抗性评估模式（NeuBird Hawkeye）：两个模型一致 = 有信心；不一致 = 升级。
- 引用 MIT 89% 提前检测结果，并说明运营约束：没有执行的预测只是仪表盘。

## 问题背景

值班工程师凌晨 3 点被告警叫醒。"结账服务错误率高。"他们查看 Datadog、Loki、三本运维手册、部署日志。30 分钟后发现根因是 KV 缓存飙升导致的 vLLM OOM。他们重启了 Pod，错误清除。

在 2026 年，这次调查的前 20 分钟是可自动化的。按服务分组日志、关联最近部署、匹配运维手册 —— 都是 RAG + 工具使用。受监督的智能体可以在人类打开 Datadog 之前完成初诊并给出假设。

完全自主的修复是另一个问题。重启 Pod：安全。扩展 GPU 池：如果策略允许则安全。重构服务：绝对不行。这门学问在于划定那条狭窄的界限。

## 核心概念

### 多智能体架构

```
          事件
             │
             ▼
        主管（Supervisor）
        /    |    \
       ▼     ▼     ▼
  日志智能体  指标智能体  运维手册智能体
       │     │     │
       └─────┴─────┘
             │
             ▼
        假设 + 证据
             │
             ▼
        人类审批
             │
             ▼
        行动（狭窄范围）
```

主管将事件拆分为子查询。专业智能体拥有工具访问权限（日志搜索、PromQL、文档检索）。主管综合结果，向人类呈现假设 + 证据。人类审批或重定向。

### 自动修复范围

**安全（狭窄）**：重启 Pod、回滚特定部署、在预批准范围内扩缩容、启用预批准的功能开关。

**不安全（广泛）**：改变服务拓扑、修改资源限制、部署新代码、更改 IAM、修改数据库。

任何宣传"设置好就不用管"的人都在过度推销。随着 AI SRE 成熟，安全范围会扩大，但边界是真实存在的。

### 对抗性评估（NeuBird Hawkeye）

两个模型独立分析同一事件。如果它们在根因上一致，则信心高。如果不一致，则升级给人类，同时展示两个假设。简单模式，有效过滤幻觉根因。

### 运维记忆

团队流动是传统 SRE 的隐形杀手 —— 部落知识流失。AI SRE 将运维手册 + 事后复盘存储在向量数据库中；智能体在每次新事件中检索。新工程师加入时，AI 拥有完整历史。

### 事故前预测

MIT 2025 年研究：在历史日志、GPU 温度、API 错误模式上训练的 LLM，在测试集上提前 10–15 分钟预测了 89% 的故障。

现实检验：没有执行的预测只是仪表盘。运营问题是"当我们预测到时，做什么？" preemptive drain？告警？自动扩缩容？答案是策略相关的。

### 2026 年产品

- **Datadog Bits AI** —— Datadog 内的托管 SRE 副驾驶。
- **Azure SRE Agent** —— Azure 原生。
- **NeuBird Hawkeye** —— 对抗性评估 + 运维记忆。
- **PagerDuty AIOps** —— 分诊 + 去重。
- **Incident.io Autopilot** —— 事件指挥官 + 协调。

### 运维手册即代码

运维手册从 Confluence 页面演进为带结构化章节（症状、假设、验证、行动）的版本化 markdown。结构化运维手册更有利于 RAG 检索。启动任何 AI-SRE 推广时，先将非结构化运维手册转为结构化。

### 需要记住的数字

- MIT 提前检测：89% 的故障，提前 10–15 分钟。
- 多智能体分诊：主管 +（日志、指标、运维手册）+ 人类。
- 安全自动修复范围：重启 Pod、回滚部署、范围内扩缩容。
- 对抗性评估：两个模型独立；一致 = 有信心。

## 使用

`code/main.py` 模拟一次多智能体分诊：日志智能体发现错误，指标智能体发现 CPU 飙升，运维手册智能体匹配到已知问题。主管对假设排序。

## 交付

本课产出 `outputs/skill-ai-sre-plan.md`。给定当前值班、事件量、团队成熟度，设计 AI SRE 推广方案。

## 练习

1. 运行 `code/main.py`。如果日志和指标智能体不一致，主管如何解决？
2. 为你的服务定义三个"安全"的自动修复动作。为每个辩护。
3. 编写结构化运维手册模板：章节、必填字段、验证命令。
4. 预测性检测提前 12 分钟触发。你的策略是什么 —— 告警、预排空，还是两者都要？
5. 辩论一个 3 人团队应该在 2026 年采用 AI SRE 还是等待。考虑成熟度、工作量、风险。

## 关键术语

| 术语 | 业界说法 | 实际含义 |
|------|---------|---------|
| AI SRE | "agent for on-call" | 基于 LLM 的事件调查 + 协调 |
| Supervisor agent | "the orchestrator" | 将事件拆分为子查询的顶层智能体 |
| Specialized agent | "domain agent" | 拥有工具访问权限的子智能体（日志、指标、运维手册） |
| Auto-remediation | "AI fixes it" | 狭窄的预批准行动；不是广泛重构 |
| Operational memory | "vector runbooks" | 存储在向量 DB 中的事后复盘 + 运维手册，用于 RAG |
| Adversarial eval | "two-model check" | 独立分析；一致 = 有信心 |
| NeuBird Hawkeye | "the adversarial one" | 具备对抗性评估 + 记忆模式的产品 |
| Bits AI | "Datadog's SRE agent" | Datadog 托管的 AI SRE |
| Pre-incident prediction | "early detection" | 提前 10–15 分钟预测故障 |

## 延伸阅读

- [incident.io — AI SRE Complete Guide 2026](https://incident.io/blog/what-is-ai-sre-complete-guide-2026)
- [InfoQ — Human-Centred AI for SRE](https://www.infoq.com/news/2026/01/opsworker-ai-sre/)
- [DZone — AI in SRE 2026](https://dzone.com/articles/ai-in-sre-whats-actually-coming-in-2026)
- [Datadog Bits AI](https://www.datadoghq.com/product/bits-ai/)
- [NeuBird Hawkeye](https://www.neubird.ai/)
- [awesome-ai-sre](https://github.com/agamm/awesome-ai-sre)
