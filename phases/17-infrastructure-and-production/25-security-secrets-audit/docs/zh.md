# 安全 — 密钥、API Key 轮换、审计日志、Guardrails（护栏）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 用集中式 vault（HashiCorp Vault、AWS Secrets Manager、Azure Key Vault）消灭密钥散落问题。绝对不要把凭证放进配置文件、提交进 VCS 的 env 文件、电子表格里。优先用 IAM role 而不是静态 key；CI/CD 用 OIDC。AI-gateway 模式是 2026 年的标准答案：apps → gateway → 模型 provider，gateway 在运行时从 vault 拉取凭证。在 vault 里轮换，所有 app 几分钟内自动跟进——不用重新部署，也不用在 Slack 里追问「谁有新 key」。轮换策略 ≤90 天；每次提交都用 TruffleHog / GitGuardian / Gitleaks 扫描。Zero-trust（零信任）：MFA、SSO、RBAC/ABAC、短时效 token、设备健康检查。PII 脱敏用实体识别在转发前屏蔽 PHI/PII；一致性 tokenization（Mesh approach）把敏感值映射成稳定占位符，让 LLM 仍能保留代码 / 关系语义。网络出口：LLM 服务部署在专属 VPC/VNet 子网，只放行 `api.openai.com`、`api.anthropic.com` 等；其他全部 outbound 阻断。2026 年的标志性事故：Vercel 供应链攻击通过被攻陷的 CI/CD 凭证，在成千上万的客户部署间窃取了 env 变量。

**Type:** Learn
**Languages:** Python（标准库，玩具版 PII-scrubber + 审计日志写入器）
**Prerequisites:** Phase 17 · 19（AI Gateways）、Phase 17 · 13（Observability）
**Time:** ~60 分钟

## 学习目标（Learning Objectives）

- 列举密钥管理的四种反模式（VCS 里的配置文件、硬编码 env、电子表格、静态 key）并说出各自的替代方案。
- 解释「AI-gateway 从 vault 拉取」为什么是 2026 年的生产标准。
- 实现一个带一致性 tokenization 的 PII scrubber（同一个值 → 同一个占位符），让语义不丢。
- 说出 2026 年 Vercel 供应链事故，以及它在 CI/CD 凭证卫生上给我们的教训。

## 问题（Problem）

某实习生把带 API key 的 `.env` commit 上去了。他很快删除。但 key 已经进了 git history——GitGuardian 扫到了，而你的轮换流程是「Slack 通知全员，更新 40 个配置文件，重新部署所有服务」。8 小时后，一半服务上线了，另一半还在等部署窗口。

另一边，用户的 prompt 里写着「我的 SSN 是 123-45-6789」。这个 prompt 直接发到了 OpenAI。你们签了 BAA，但内部策略本来要求转发前 mask PII。你没做。

再另一边，你的 EKS 集群里 LLM pod 可以访问任何互联网主机。有人通过 DNS 查询把数据外传到攻击者控制的域名。没有任何东西阻止它。

LLM 服务的安全必须把这三个攻击面都覆盖到。Vault 托管的凭证。PII 脱敏。网络出口过滤。审计日志。

## 概念（Concept）

### 集中式 vault + IAM-role 拉取（Centralized vault + IAM-role pull）

**Vault**：HashiCorp Vault、AWS Secrets Manager、Azure Key Vault、GCP Secret Manager。单一可信源。

**IAM role**：app/gateway 用自己的 IAM 身份认证，不是静态 key。Vault 在 token 生命周期内返回密钥。

**AI-gateway 模式**：gateway 在请求时从 vault 拉 `OPENAI_API_KEY`。在 vault 里轮换；下一个请求就拿到新 key。不用重新部署。

### 轮换策略 ≤ 90 天（Rotation policy ≤ 90 days）

所有 API key、vault root token、CI/CD 凭证。能自动轮换就自动。手动轮换要记录、可追踪。

### 密钥扫描（Secret scanning）

- **TruffleHog** — commit 时跑正则 + entropy（熵）。
- **GitGuardian** — 商业产品，准确率高。
- **Gitleaks** — 开源，CI 里跑。

每次 commit 都跑。检测到新密钥就阻断 PR。

### 零信任姿态（Zero-trust posture）

- 所有账号强制 MFA。
- SSO 走 SAML/OIDC。
- 用 RBAC（role-based）或 ABAC（attribute-based）做细粒度访问控制。
- 短时效 token（小时级，不是天级）。
- 设备健康检查 —— 只允许带磁盘加密的公司设备。

### PII / PHI 脱敏（PII / PHI scrubbing）

在 prompt 离开你的基础设施之前：

1. 实体识别（spaCy NER、Presidio、商业方案）。
2. 把命中的实体 mask 掉：`"My SSN is 123-45-6789"` → `"My SSN is [SSN_TOKEN_A3F]"`。
3. 一致性 tokenization（Mesh approach）：同一个值映射到同一个占位符，让 LLM 保留实体之间的关系。
4. 可选：把 LLM 响应里的占位符反向映射回原值。

静态正则只能抓基础模式；NER 能抓更多。两个都用。

### 输入 + 输出 guardrails（护栏）

输入：拦截已知 jailbreak、禁话题；按用户限速。

输出：用正则扫泄漏的密钥（API key 模式、拒答上下文里的邮箱模式）、用分类器抓策略违规。

### 网络出口白名单（Network egress whitelist）

LLM 服务放在专属子网：
- 白名单：`api.openai.com`、`api.anthropic.com`、向量数据库 endpoint、vault endpoint。
- 其他：丢弃。
- DNS 走只许白名单的 resolver（避免 DNS 隧道外传）。

### 审计日志（Audit log）

每次 LLM 调用都写一条不可变日志，字段：
- 时间戳。
- 用户 / 租户。
- Prompt hash（不存原始 prompt，保护隐私）。
- 模型 + 版本。
- Token 数。
- 成本。
- Response hash。
- 任何 guardrail 触发记录。

按合规要求保留（SOC 2 一年，HIPAA 六年）。

### 2026 年 Vercel 事故（The 2026 Vercel incident）

供应链攻击：被攻陷的 CI/CD 凭证在成千上万的客户部署间窃取了 env 变量。教训：CI/CD 凭证等同于生产凭证。放进 vault。权限收窄。激进轮换。

### 你应该记住的数字（Numbers you should remember）

- 轮换策略：≤ 90 天。
- 每次 commit 都扫：TruffleHog / GitGuardian / Gitleaks。
- Vercel 2026：CI/CD 凭证被攻陷 → 成千上万客户的 env 变量泄漏。
- 审计日志保留：SOC 2 = 1 年，HIPAA = 6 年。

## 用起来（Use It）

`code/main.py` 实现了一个带一致性 tokenization 的玩具 PII scrubber，以及只追加的审计日志。

## 上线部署（Ship It）

本课产出 `outputs/skill-llm-security-plan.md`。结合合规范围与现状，规划 vault 迁移、scrubber、出口、审计日志。

## 练习（Exercises）

1. 跑 `code/main.py`。发两个引用同一个 SSN 的 prompt。确认两次拿到同一个占位符。
2. 为一个调用 OpenAI + Anthropic + Weaviate 的 vLLM-on-EKS 部署设计网络出口策略。
3. 你在 git history 里发现一个 2 年前的 key。正确的响应是什么——轮换 key、清洗 history、还是两者都做？给出理由。
4. 你的审计日志一天涨 10 GB。设计分级保留（热 30 天，温 12 个月，冷 6 年）。
5. 论证「反向 tokenization（把真实值替换回 LLM 响应）」相比「占位符直接保留可见」是否值得这份复杂度。

## 关键术语（Key Terms）

| 术语 | 大家口头怎么说 | 实际意思 |
|------|----------------|------------------------|
| Vault | 「密钥存储」 | 集中式凭证管理服务 |
| IAM role | 「基于身份的认证」 | app 扮演的角色；返回短时效凭证 |
| OIDC for CI/CD | 「云签发的 token」 | CI 里没有静态 key——身份走 OIDC |
| TruffleHog / GitGuardian / Gitleaks | 「密钥扫描器」 | commit 时刻的密钥检测 |
| RBAC / ABAC | 「访问控制」 | 基于角色 vs 基于属性 |
| PII scrubbing | 「数据脱敏」 | 移除或 tokenize 敏感实体 |
| Consistent tokenization | 「稳定占位符」 | 同一个值 → 每次同一个 token |
| Mesh approach | 「Mesh tokenization」 | 保留语义的 tokenization 模式 |
| Egress whitelist | 「出口 allowlist」 | 只能到达指定域名 |
| Audit log | 「不可变历史」 | 只追加的合规记录 |

## 延伸阅读（Further Reading）

- [Doppler — Advanced LLM Security](https://www.doppler.com/blog/advanced-llm-security)
- [Portkey — Manage LLM API keys with secret references](https://portkey.ai/blog/secret-references-ai-api-key-management/)
- [Datadog — LLM Guardrails Best Practices](https://www.datadoghq.com/blog/llm-guardrails-best-practices/)
- [JumpServer — Secrets Management Best Practices 2026](https://www.jumpserver.com/blog/secret-management-best-practices-2026)
- [Microsoft Presidio](https://github.com/microsoft/presidio) — PII 检测与匿名化。
- [HashiCorp Vault docs](https://developer.hashicorp.com/vault/docs)
