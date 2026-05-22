# 安全 — 密钥、API 密钥轮换、审计日志、防护栏

> 通过集中式保管库（HashiCorp Vault、AWS Secrets Manager、Azure Key Vault）消除密钥蔓延。切勿将凭据存储在配置文件、VCS 中的 env 文件、电子表格中。对 CI/CD 使用 IAM 角色而不是静态密钥；使用 OIDC。AI 网关模式是 2026 年的解决方案：应用程序 → 网关 → 模型提供商，网关在运行时从保管库中提取凭据。在保管库中轮换，所有应用程序在几分钟内获取——无需重新部署，无需 Slack 上的"谁有新密钥"消息。轮换策略 ≤90 天；在每次提交时使用 TruffleHog / GitGuardian / Gitleaks 进行扫描。零信任：MFA、SSO、RBAC/ABAC、短期令牌、设备态势。PII 清理使用实体识别在转发之前屏蔽 PHI/PII；一致的 tokenization（Mesh 方法）将敏感值映射到稳定的占位符，以便 LLM 保留代码/关系语义。网络出口：LLM 服务位于专用 VPC/VNet 子网中，仅白名单 `api.openai.com`、`api.anthropic.com` 等；阻止所有其他出站。2026 年事件驱动程序：Vercel 供应链攻击通过受损的 CI/CD 凭据渗透到数千个客户部署中的 env var。

**类型：** 学习
**语言：** Python（标准库，简单的 PII 清理器 + 审计日志写入器）
**先决条件：** 阶段 17 · 19（AI 网关）、阶段 17 · 13（可观测性）
**时间：** 约 60 分钟

## 学习目标

- 列举四个密钥管理反模式（VCS 中的配置文件、硬编码 env、电子表格、静态密钥）并说出它们的替代品。
- 解释 AI 网关从保管库提取模式作为 2026 年生产标准。
- 使用一致的 tokenization（相同的值 → 相同的占位符）实现 PII 清理器，以便语义保留。
- 说出 2026 年 Vercel 供应链事件及其对 CI/CD 凭据卫生的启示。

## 问题

实习生提交了带有 API 密钥的 `.env`。他们很快将其删除。密钥已经在 git 历史记录中——GitGuardian 扫描捕获了它，你的轮换过程是"Slack 团队，更新 40 个配置文件，重新部署所有服务。"8 小时后，你的一半服务处于活动状态，一半正在等待部署窗口。

另外，用户提示包括"我的 SSN 是 123-45-6789。"提示转到 OpenAI。你有 BAA，但你的内部策略是在转发之前屏蔽 PII。你没有。

另外，你的 EKS 集群的 LLM pod 可以访问任何互联网主机。有人通过 DNS 查找到攻击者控制的域来渗透数据。没有任何东西阻止它。

LLM 服务的安全性必须解决所有这三个向量。保管库支持的凭据。PII 清理。网络出口过滤。审计日志。

## 概念

### 集中式保管库 + IAM 角色提取

**保管库**：HashiCorp Vault、AWS Secrets Manager、Azure Key Vault、GCP Secret Manager。唯一的事实来源。

**IAM 角色**：应用程序/网关通过其 IAM 身份进行身份验证，而不是静态密钥。保管库在令牌的生命周期内返回密钥。

**AI 网关模式**：网关在请求时从保管库中提取 `OPENAI_API_KEY`。在保管库中轮换；下一个请求获取新密钥。无需重新部署。

### 轮换策略 ≤ 90 天

所有 API 密钥、保管库根令牌、CI/CD 凭据。尽可能自动轮换。记录并跟踪手动轮换。

### 密钥扫描

- **TruffleHog**——提交时的正则表达式 + 熵。
- **GitGuardian**——商业，高精度。
- **Gitleaks**——OSS，在 CI 中运行。

在每次提交时运行。如果检测到新密钥，则阻止 PR。

### 零信任态势

- 所有帐户都需要 MFA。
- 通过 SAML/OIDC 的 SSO。
- 用于细粒度访问的 RBAC（基于角色）或 ABAC（基于属性）。
- 短期令牌（小时，不是天）。
- 设备态势——仅限具有磁盘加密的公司设备。

### PII / PHI 清理

在提示离开你的基础设施之前：

1. 实体识别（spaCy NER、Presidio、商业）。
2. 屏蔽匹配的实体：`"My SSN is 123-45-6789"` → `"My SSN is [SSN_TOKEN_A3F]"`。
3. 一致的 tokenization（Mesh 方法）：相同的值映射到相同的占位符，以便 LLM 保留关系。
4. LLM 响应的可选反向映射。

静态正则表达式过滤器捕获基本模式；NER 捕获更多。两者都使用。

### 输入 + 输出防护栏

输入：阻止已知的越狱、禁止的主题；每个用户的速率限制。

输出：用于泄漏密钥的正则表达式清理（API 密钥模式、拒绝上下文中的电子邮件模式）、用于违反策略的分类器。

### 网络出口白名单

LLM 服务位于专用子网中：

- 白名单：`api.openai.com`、`api.anthropic.com`、向量数据库端点、保管库端点。
- 其他所有内容：丢弃。
- DNS 通过仅允许列表的解析器（避免 DNS 隧道渗透）。

### 审计日志

每次 LLM 调用的不可变日志，包含：

- 时间戳。
- 用户 / 租户。
- 提示哈希（不是原始提示，为了隐私）。
- 模型 + 版本。
- Token 计数。
- 成本。
- 响应哈希。
- 任何防护栏行程。

根据监管要求保留（SOC 2 1 年，HIPAA 6 年）。

### 2026 年 Vercel 事件

供应链攻击：受损的 CI/CD 凭据渗透到数千个客户部署中的 env var。经验教训：CI/CD 凭据等同于生产。存储在保管库中。范围狭窄。积极轮换。

### 你应该记住的数字

- 轮换策略：≤ 90 天。
- 在每次提交时扫描：TruffleHog / GitGuardian / Gitleaks。
- Vercel 2026：CI/CD 凭据受损 → 数千个客户 env var 泄漏。
- 审计日志保留：SOC 2 = 1 年，HIPAA = 6 年。

## 使用它

`code/main.py` 实现了一个带有一致 tokenization 的简单 PII 清理器和仅追加审计日志。

## 部署它

本课生成 `outputs/skill-llm-security-plan.md`。根据给定的监管范围和当前状态，规划保管库迁移、清理器、出口、审计日志。

## 练习

1. 运行 `code/main.py`。发送两个引用相同 SSN 的提示。确认两者都获得相同的占位符。
2. 为调用 OpenAI + Anthropic + Weaviate 的 vLLM-on-EKS 部署设计网络出口策略。
3. 你在 git 历史记录中发现一个密钥（2 年旧）。正确的响应是什么——轮换密钥，清理历史记录，还是两者兼而有之？证明。
4. 你的审计日志每天增长 10 GB。设计保留层（热 30 天，温 12 个月，冷 6 年）。
5. 论证反向 tokenization（将真实值替换回 LLM 响应）是否值得复杂性，而不是保持占位符可见。

## 关键术语

| 术语 | 人们说的 | 实际含义 |
|------|----------------|------------------------|
| Vault | "密钥存储" | 集中式凭据管理服务 |
| IAM role | "基于身份的身份验证" | 应用程序 assume 的角色；返回短期凭据 |
| OIDC for CI/CD | "云颁发的令牌" | CI 中没有静态密钥——通过 OIDC 的身份 |
| TruffleHog / GitGuardian / Gitleaks | "密钥扫描程序" | 提交时密钥检测 |
| RBAC / ABAC | "访问控制" | 基于角色 vs 基于属性 |
| PII scrubbing | "数据屏蔽" | 删除或 tokenize 敏感实体 |
| Consistent tokenization | "稳定占位符" | 相同的值 → 每次都是相同的令牌 |
| Mesh approach | "Mesh tokenization" | 语义保留 tokenization 模式 |
| Egress whitelist | "出站允许列表" | 仅可访问允许的域 |
| Audit log | "不可变历史记录" | 用于合规性的仅追加记录 |

## 延伸阅读

- [Doppler — 高级 LLM 安全性](https://www.doppler.com/blog/advanced-llm-security)
- [Portkey — 使用密钥引用管理 LLM API 密钥](https://portkey.ai/blog/secret-references-ai-api-key-management/)
- [Datadog — LLM 防护栏最佳实践](https://www.datadoghq.com/blog/llm-guardrails-best-practices/)
- [JumpServer — 密钥管理最佳实践 2026](https://www.jumpserver.com/blog/secret-management-best-practices-2026)
- [Microsoft Presidio](https://github.com/microsoft/presidio) — PII 检测和匿名化。
- [HashiCorp Vault 文档](https://developer.hashicorp.com/vault/docs)
