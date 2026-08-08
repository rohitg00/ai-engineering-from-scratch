# 安全 —— 密钥、API 密钥轮换、审计日志、护栏

> 通过集中式密钥库（HashiCorp Vault、AWS Secrets Manager、Azure Key Vault）消除密钥扩散。绝不在配置文件、VCS 中的环境文件、电子表格中存储凭证。优先使用 IAM 角色而非静态密钥；CI/CD 使用 OIDC。AI 网关模式是 2026 年的解决方案：应用 → 网关 → 模型提供商，网关运行时从密钥库拉取凭证。在密钥库中轮换，所有应用在数分钟内生效 —— 无需重新部署，无需在 Slack 问"谁有新密钥"。轮换策略 ≤90 天；每次提交时用 TruffleHog / GitGuardian / Gitleaks 扫描。零信任：MFA、SSO、RBAC/ABAC、短时效令牌、设备姿态。PII 脱敏使用实体识别在转发前掩码 PHI/PII；一致性分词（Mesh 方法）将敏感值映射为稳定的占位符，使 LLM 保留代码/关系语义。网络出口：LLM 服务位于专用 VPC/VNet 子网，仅白名单 `api.openai.com`、`api.anthropic.com` 等；阻止所有其他出站流量。2026 年的典型事件：Vercel 供应链攻击，通过被入侵的 CI/CD 凭证窃取了数千个客户部署的环境变量。

**类型：** 学习
**语言：** Python（标准库，简易 PII 脱敏器 + 审计日志写入器）
**前置知识：** 第 17 阶段 · 19（AI 网关）、第 17 阶段 · 13（可观测性）
**时间：** ~60 分钟

## 学习目标

- 列举四种密钥管理反模式（VCS 中的配置文件、硬编码环境变量、电子表格、静态密钥）及其替代方案。
- 解释 AI 网关从密钥库拉取凭证的模式作为 2026 年生产标准。
- 实现一个带一致性分词（相同值 → 相同占位符）的 PII 脱敏器，使语义得以保留。
- 说出 2026 年 Vercel 供应链事件及其关于 CI/CD 凭证卫生的教训。

## 问题背景

实习生提交了包含 API 密钥的 `.env`。他们迅速删除。密钥已留在 git 历史记录中 —— GitGuardian 扫描捕获，你的轮换流程是"在 Slack 通知团队，更新 40 个配置文件，重新部署所有服务"。8 小时后，一半服务已上线，一半还在等部署窗口。

另一方面，用户 prompt 中包含"My SSN is 123-45-6789"。Prompt 发往 OpenAI。你有 BAA，但内部策略要求在转发前掩码 PII。你没做。

再一方面，你的 EKS 集群中 LLM Pod 可以访问任何互联网主机。有人通过 DNS 查询向攻击者控制的域名外泄数据。没有任何阻止。

LLM 服务的安全必须同时解决这三个向量。密钥库支持的凭证。PII 脱敏。网络出口过滤。审计日志。

## 核心概念

### 集中式密钥库 + IAM 角色拉取

**密钥库**：HashiCorp Vault、AWS Secrets Manager、Azure Key Vault、GCP Secret Manager。单一事实来源。

**IAM 角色**：应用/网关通过其 IAM 身份认证，而非静态密钥。密钥库在令牌生命周期内返回密钥。

**AI 网关模式**：网关运行时从密钥库拉取 `OPENAI_API_KEY`。在密钥库中轮换；下次请求获取新密钥。无需重新部署。

### 轮换策略 ≤ 90 天

所有 API 密钥、密钥库根令牌、CI/CD 凭证。尽可能自动轮换。手动轮换需记录并跟踪。

### 密钥扫描

- **TruffleHog** —— 基于正则 + 熵的提交扫描。
- **GitGuardian** —— 商业产品，高准确率。
- **Gitleaks** —— 开源，在 CI 中运行。

每次提交都运行。检测到新密钥时阻断 PR。

### 零信任姿态

- 所有账户强制 MFA。
- 通过 SAML/OIDC 实现 SSO。
- RBAC（基于角色）或 ABAC（基于属性）实现细粒度访问。
- 短时效令牌（小时级，非天级）。
- 设备姿态 —— 仅允许带有磁盘加密的公司设备。

### PII / PHI 脱敏

在 prompt 离开你的基础设施之前：

1. 实体识别（spaCy NER、Presidio、商业产品）。
2. 掩码匹配实体：`"My SSN is 123-45-6789"` → `"My SSN is [SSN_TOKEN_A3F]"`。
3. 一致性分词（Mesh 方法）：相同值映射为相同占位符，使 LLM 保留关系。
4. 可选的反向映射用于 LLM 响应。

静态正则过滤捕获基本模式；NER 捕获更多。两者都用。

### 输入 + 输出护栏

输入：阻止已知越狱、禁止主题；按用户限速。

输出：正则脱敏泄漏的密钥（API 密钥模式、拒绝上下文中的邮箱模式），策略违规分类器。

### 网络出口白名单

LLM 服务位于专用子网：
- 白名单：`api.openai.com`、`api.anthropic.com`、向量数据库端点、密钥库端点。
- 其他全部：丢弃。
- DNS 仅通过允许列表解析器（避免 DNS 隧道外泄）。

### 审计日志

每次 LLM 调用的不可变日志，包含：
- 时间戳。
- 用户 / 租户。
- Prompt 哈希（非原始 prompt，保护隐私）。
- 模型 + 版本。
- Token 数量。
- 成本。
- 响应哈希。
- 任何护栏触发。

按监管要求保留（SOC 2 为 1 年，HIPAA 为 6 年）。

### 2026 年 Vercel 事件

供应链攻击：被入侵的 CI/CD 凭证窃取了数千个客户部署的环境变量。教训：CI/CD 凭证等同于生产凭证。存储在密钥库中。范围缩到最小。积极轮换。

### 需要记住的数字

- 轮换策略：≤ 90 天。
- 每次提交扫描：TruffleHog / GitGuardian / Gitleaks。
- Vercel 2026：CI/CD 凭证被入侵 → 数千个客户环境变量泄漏。
- 审计日志保留：SOC 2 = 1 年，HIPAA = 6 年。

## 使用

`code/main.py` 实现一个带一致性分词的简易 PII 脱敏器和一个追加式审计日志。

## 交付

本课产出 `outputs/skill-llm-security-plan.md`。给定监管范围和当前状态，规划密钥库迁移、脱敏器、出口、审计日志。

## 练习

1. 运行 `code/main.py`。发送两个引用相同 SSN 的 prompt。确认两者得到相同的占位符。
2. 为调用 OpenAI + Anthropic + Weaviate 的 vLLM-on-EKS 部署设计网络出口策略。
3. 你在 git 历史中发现一个密钥（2 年前）。正确响应是什么 —— 轮换密钥、清理历史，还是两者都做？论证。
4. 你的审计日志每天增长 10 GB。设计保留层级（热 30 天、温 12 个月、冷 6 年）。
5. 辩论反向分词（将真实值替换回 LLM 响应）是否值得其复杂性，还是保持占位符可见更好。

## 关键术语

| 术语 | 业界说法 | 实际含义 |
|------|---------|---------|
| Vault | "secrets store" | 集中式凭证管理服务 |
| IAM role | "identity-based auth" | 应用承担的角色；返回短时效凭证 |
| OIDC for CI/CD | "cloud-issued tokens" | CI 中无静态密钥 —— 通过 OIDC 获取身份 |
| TruffleHog / GitGuardian / Gitleaks | "secret scanners" | 提交时密钥检测 |
| RBAC / ABAC | "access control" | 基于角色 vs 基于属性 |
| PII scrubbing | "data masking" | 移除或分词敏感实体 |
| Consistent tokenization | "stable placeholders" | 相同值 → 每次相同令牌 |
| Mesh approach | "Mesh tokenization" | 保留语义的分词模式 |
| Egress whitelist | "outbound allowlist" | 仅允许访问的域名 |
| Audit log | "immutable history" | 合规用的追加式记录 |

## 延伸阅读

- [Doppler — Advanced LLM Security](https://www.doppler.com/blog/advanced-llm-security)
- [Portkey — Manage LLM API keys with secret references](https://portkey.ai/blog/secret-references-ai-api-key-management/)
- [Datadog — LLM Guardrails Best Practices](https://www.datadoghq.com/blog/llm-guardrails-best-practices/)
- [JumpServer — Secrets Management Best Practices 2026](https://www.jumpserver.com/blog/secret-management-best-practices-2026)
- [Microsoft Presidio](https://github.com/microsoft/presidio) — PII 检测与匿名化。
- [HashiCorp Vault docs](https://developer.hashicorp.com/vault/docs)
