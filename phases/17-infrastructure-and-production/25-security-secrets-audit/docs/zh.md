# 25 · 安全——密钥、API Key 轮换、审计日志与护栏

> 通过集中式保险库（HashiCorp Vault、AWS Secrets Manager、Azure Key Vault）消除密钥蔓延（secret sprawl）。绝不把凭据存放在配置文件、纳入版本控制（VCS）的 env 文件或电子表格中。优先使用 IAM 角色而非静态密钥；CI/CD 使用 OIDC。AI 网关（AI-gateway）模式是 2026 年的解决方案：应用 → 网关 → 模型提供方，由网关在运行时从保险库拉取凭据。在保险库里轮换一次，所有应用几分钟内即可生效——无需重新部署，也无需在 Slack 里追问"谁拿到了新 Key"。轮换策略不超过 90 天；每次提交都用 TruffleHog / GitGuardian / Gitleaks 扫描。零信任（zero-trust）：MFA、SSO、RBAC/ABAC、短时令牌、设备状态校验。个人身份信息（PII）脱敏使用实体识别在转发前屏蔽 PHI/PII；一致性令牌化（consistent tokenization，Mesh 方案）把敏感值映射为稳定的占位符，使大语言模型（LLM）得以保留代码与关系语义。网络出站（egress）：将 LLM 服务部署在专用 VPC/VNet 子网中，仅放行 `api.openai.com`、`api.anthropic.com` 等；阻断所有其他出站流量。2026 年的事件诱因：Vercel 供应链攻击通过被攻陷的 CI/CD 凭据，在数千个客户部署中窃取了环境变量。

**类型：** 学习
**语言：** Python（标准库，玩具级 PII 脱敏器 + 审计日志写入器）
**前置：** 阶段 17 · 19（AI 网关）、阶段 17 · 13（可观测性）
**时长：** 约 60 分钟

## 学习目标

- 列举四种密钥管理反模式（纳入 VCS 的配置文件、硬编码 env、电子表格、静态密钥），并说出各自的替代方案。
- 阐释"AI 网关从保险库拉取"模式为何是 2026 年的生产标准。
- 实现一个带一致性令牌化（同一值 → 同一占位符）的 PII 脱敏器，使语义得以保留。
- 说出 2026 年 Vercel 供应链事件，以及它对 CI/CD 凭据卫生的启示。

## 问题所在

一名实习生把含有 API Key 的 `.env` 提交了上去，随后迅速删除。但密钥已经进入 git 历史——GitGuardian 扫描捕获了它，而你的轮换流程是"在 Slack 通知团队、更新 40 个配置文件、重新部署所有服务"。8 小时后，一半服务上线，另一半仍在等待部署窗口。

另一方面，用户提示词里包含"My SSN is 123-45-6789"（我的社保号是 123-45-6789）。提示词发往 OpenAI。你虽然签了 BAA，但内部政策要求在转发前屏蔽 PII。你没做到。

再另一方面，你的 EKS 集群里的 LLM Pod 能访问任意互联网主机。有人通过向攻击者控制的域名发起 DNS 查询来窃取数据。没有任何东西拦住它。

LLM 服务的安全必须同时应对这三条攻击向量：保险库支撑的凭据、PII 脱敏、网络出站过滤、审计日志。

## 核心概念

### 集中式保险库 + IAM 角色拉取

**保险库（Vault）**：HashiCorp Vault、AWS Secrets Manager、Azure Key Vault、GCP Secret Manager。唯一可信源。

**IAM 角色**：应用/网关通过其 IAM 身份认证，而非静态密钥。保险库在令牌有效期内返回密钥。

**AI 网关模式**：网关在请求时从保险库拉取 `OPENAI_API_KEY`。在保险库里轮换；下一个请求即拿到新 Key。无需重新部署。

### 轮换策略不超过 90 天

涵盖所有 API Key、保险库根令牌、CI/CD 凭据。尽可能自动化轮换。手动轮换需记录并跟踪。

### 密钥扫描

- **TruffleHog**——对提交做正则 + 熵值检测。
- **GitGuardian**——商业方案，准确率高。
- **Gitleaks**——开源，可在 CI 中运行。

每次提交都运行。一旦检测到新密钥，就阻断该 PR。

### 零信任态势

- 所有账户强制启用 MFA。
- 通过 SAML/OIDC 实现 SSO。
- 使用 RBAC（基于角色）或 ABAC（基于属性）实现细粒度访问控制。
- 短时令牌（以小时计，而非以天计）。
- 设备状态校验——仅允许已加密磁盘的公司设备。

### PII / PHI 脱敏

在提示词离开你的基础设施之前：

1. 实体识别（spaCy NER、Presidio、商业方案）。
2. 屏蔽匹配到的实体：`"My SSN is 123-45-6789"` → `"My SSN is [SSN_TOKEN_A3F]"`。
3. 一致性令牌化（Mesh 方案）：同一值映射到同一占位符，使 LLM 得以保留关系。
4. 可选地为 LLM 响应做反向映射。

静态正则过滤器能捕获基础模式；NER 能捕获更多。两者都用。

### 输入 + 输出护栏

输入：阻断已知越狱（jailbreak）、禁止话题；按用户限流。

输出：用正则清洗泄露的密钥（API Key 模式、拒答场景中的邮箱模式），用分类器识别违规策略。

### 网络出站白名单

将 LLM 服务部署在专用子网中：

- 白名单：`api.openai.com`、`api.anthropic.com`、向量数据库端点、保险库端点。
- 其余一律：丢弃。
- DNS 仅经由白名单解析器（避免 DNS 隧道窃取）。

### 审计日志

为每一次 LLM 调用记录不可变日志，包含：

- 时间戳。
- 用户 / 租户。
- 提示词哈希（出于隐私，而非原始提示词）。
- 模型 + 版本。
- Token 数量。
- 成本。
- 响应哈希。
- 任何护栏触发。

按监管要求保留（SOC 2 为 1 年，HIPAA 为 6 年）。

### 2026 年 Vercel 事件

供应链攻击：被攻陷的 CI/CD 凭据在数千个客户部署中窃取了环境变量。教训：CI/CD 凭据等同于生产凭据。存入保险库。最小化授权范围。激进地轮换。

### 你应当记住的数字

- 轮换策略：不超过 90 天。
- 每次提交都扫描：TruffleHog / GitGuardian / Gitleaks。
- Vercel 2026：CI/CD 凭据被攻陷 → 数千个客户的环境变量泄露。
- 审计日志保留期：SOC 2 = 1 年，HIPAA = 6 年。

## 动手用

`code/main.py` 实现了一个带一致性令牌化的玩具级 PII 脱敏器，以及一个仅追加（append-only）的审计日志。

## 交付它

本课产出 `outputs/skill-llm-security-plan.md`。在给定监管范围与当前状态的前提下，规划保险库迁移、脱敏器、出站过滤与审计日志。

## 练习

1. 运行 `code/main.py`。发送两条引用同一个 SSN 的提示词。确认两者得到相同的占位符。
2. 为一个调用 OpenAI + Anthropic + Weaviate 的 vLLM-on-EKS 部署设计网络出站策略。
3. 你在 git 历史中发现了一个密钥（已有 2 年）。正确的应对是什么——轮换密钥、清洗历史，还是两者都做？请论证。
4. 你的审计日志每天增长 10 GB。设计保留分层（热数据 30 天、温数据 12 个月、冷数据 6 年）。
5. 论证反向令牌化（把真实值替换回 LLM 响应）相比保持占位符可见，是否值得增加这份复杂度。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|----------------|------------------------|
| 保险库（Vault） | "密钥存储" | 集中式凭据管理服务 |
| IAM 角色 | "基于身份的认证" | 应用承担的角色；返回短时凭据 |
| CI/CD 的 OIDC | "云端签发的令牌" | CI 中没有静态密钥——身份经由 OIDC |
| TruffleHog / GitGuardian / Gitleaks | "密钥扫描器" | 提交时刻的密钥检测 |
| RBAC / ABAC | "访问控制" | 基于角色 vs 基于属性 |
| PII 脱敏 | "数据屏蔽" | 移除或令牌化敏感实体 |
| 一致性令牌化 | "稳定占位符" | 同一值 → 每次都得到同一令牌 |
| Mesh 方案 | "Mesh 令牌化" | 保留语义的令牌化模式 |
| 出站白名单 | "出站放行清单" | 仅可达放行的域名 |
| 审计日志 | "不可变历史" | 用于合规的仅追加记录 |

## 延伸阅读

- [Doppler — Advanced LLM Security](https://www.doppler.com/blog/advanced-llm-security)
- [Portkey — Manage LLM API keys with secret references](https://portkey.ai/blog/secret-references-ai-api-key-management/)
- [Datadog — LLM Guardrails Best Practices](https://www.datadoghq.com/blog/llm-guardrails-best-practices/)
- [JumpServer — Secrets Management Best Practices 2026](https://www.jumpserver.com/blog/secret-management-best-practices-2026)
- [Microsoft Presidio](https://github.com/microsoft/presidio) —— PII 检测与匿名化。
- [HashiCorp Vault docs](https://developer.hashicorp.com/vault/docs)
