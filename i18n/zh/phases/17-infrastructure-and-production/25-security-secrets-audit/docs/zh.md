# 安全——密钥管理、API 密钥轮换、审计日志、护栏

> 通过集中式保险库(HashiCorp Vault、AWS Secrets Manager、Azure Key Vault)消除密钥泛滥。绝不将凭据存储在配置文件、纳入版本控制的 env 文件或电子表格中。使用 IAM 角色而非静态密钥；CI/CD 使用 OIDC。AI 网关模式是 2026 年的解决方案：应用 → 网关 → 模型提供商，网关在运行时从保险库拉取凭据。在保险库中轮换，所有应用在几分钟内即可获取新密钥——无需重新部署，也不再有 Slack 上的“谁拿到新密钥了”的消息。轮换策略 ≤90 天；每次提交都使用 TruffleHog / GitGuardian / Gitleaks 扫描。零信任：MFA、SSO、RBAC/ABAC、短生命周期令牌、设备合规检查。PII 清洗使用实体识别在转发前遮蔽 PHI/PII;一致性令牌化(Mesh 方法)将敏感值映射为稳定的占位符，使 LLM 保留代码/关系语义。网络出站：将 LLM 服务置于专用 VPC/VNet 子网中，仅白名单允许 `api.openai.com`、`api.anthropic.com` 等；阻断所有其他出站流量。2026 年的事故驱动因素：Vercel 供应链攻击，通过泄露的 CI/CD 凭据从数千个客户部署环境中窃取了环境变量。

**Type:** Learn
**Languages:** Python (stdlib, toy PII-scrubber + audit-log writer)
**Prerequisites:** Phase 17 · 19 (AI Gateways), Phase 17 · 13 (Observability)
**Time:** ~60 minutes

## 学习目标

- 列举四种密钥管理反模式(纳入版本控制的配置文件、硬编码环境变量、电子表格、静态密钥)及其替代方案。
- 解释作为 2026 年生产标准的“AI 网关从保险库拉取凭据”模式。
- 实现带一致性令牌化的 PII 清洗器(相同值 → 相同占位符)，使语义得以保留。
- 说出 2026 年 Vercel 供应链事件，以及它对 CI/CD 凭据卫生的启示。

## 问题所在

一位实习生将 `.env` 连同 API 密钥一起提交了。他很快删除了它。但密钥已经存在于 git 历史中——GitGuardian 扫描发现了它，而你的轮换流程是“在 Slack 上通知团队，更新 40 个配置文件，重新部署所有服务。”8 小时后，一半服务已上线，另一半还在等待部署窗口。

另外，用户提示中包含“我的 SSN 是 123-45-6789。”提示被发送到 OpenAI。你有 BAA,但内部政策要求在转发前遮蔽 PII。你没有这么做。

另外，你的 EKS 集群中的 LLM Pod 可以访问任何互联网主机。有人通过向攻击者控制的域名发起 DNS 查询窃取数据。没有任何机制阻止它。

LLM 服务的安全必须同时应对这三个威胁向量。基于保险库的凭据。PII 清洗。网络出站过滤。审计日志。

## 核心概念

### 集中式保险库 + IAM 角色拉取

**保险库(Vault)**:HashiCorp Vault、AWS Secrets Manager、Azure Key Vault、GCP Secret Manager。唯一的可信来源。

**IAM 角色**：应用/网关通过其 IAM 身份而非静态密钥进行认证。保险库在令牌生命周期内返回密钥。

**AI 网关模式**：网关在请求时从保险库拉取 `OPENAI_API_KEY`。在保险库中轮换；下一个请求即获得新密钥。无需重新部署。

### 轮换策略 ≤ 90 天

所有 API 密钥、保险库根令牌、CI/CD 凭据。尽可能自动化轮换。手动轮换需记录并跟踪。

### 密钥扫描

- **TruffleHog** —— 对提交执行正则 + 熵检测。
- **GitGuardian** —— 商业产品，准确率高。
- **Gitleaks** —— 开源，可在 CI 中运行。

对每次提交执行扫描。检测到新密钥时阻止 PR。

### 零信任姿态

- 所有账户强制 MFA。
- 通过 SAML/OIDC 实现 SSO。
- 使用 RBAC(基于角色)或 ABAC(基于属性)实现细粒度访问控制。
- 短生命周期令牌(以小时计，而非天)。
- 设备合规检查——仅允许启用磁盘加密的公司设备。

### PII / PHI 清洗

在提示离开你的基础设施之前：

1. 实体识别(spaCy NER、Presidio、商业方案)。
2. 遮蔽匹配的实体：`"My SSN is 123-45-6789"` → `"My SSN is [SSN_TOKEN_A3F]"`。
3. 一致性令牌化(Mesh 方法)：相同值映射到相同占位符，使 LLM 保留关系语义。
4. 可选的逆映射，用于处理 LLM 响应。

静态正则过滤器能捕获基本模式；NER 能捕获更多。两者结合使用。

### 输入 + 输出护栏

输入：阻断已知的越狱提示、禁止话题；按用户限流。

输出：用正则清洗泄露的密钥(拒绝语境中的 API 密钥模式、邮箱模式)，用分类器检测策略违规。

### 网络出站白名单

将 LLM 服务置于专用子网：
- 白名单：`api.openai.com`、`api.anthropic.com`、向量数据库端点、保险库端点。
- 其余所有流量：丢弃。
- DNS 仅通过允许列表解析器(防止 DNS 隧道数据外泄)。

### 审计日志

对每次 LLM 调用记录不可篡改的日志，包含：
- 时间戳。
- 用户 / 租户。
- 提示哈希(出于隐私不存原始提示)。
- 模型 + 版本。
- Token 计数。
- 成本。
- 响应哈希。
- 任何触发的护栏。

按监管要求保留(SOC 2 为 1 年，HIPAA 为 6 年)。

### 2026 年 Vercel 事件

供应链攻击：泄露的 CI/CD 凭据从数千个客户部署环境中窃取了环境变量。教训：CI/CD 凭据等同于生产凭据。存储在保险库中。严格限定作用域。积极轮换。

### 你应记住的数字

- 轮换策略：≤ 90 天。
- 每次提交扫描：TruffleHog / GitGuardian / Gitleaks。
- Vercel 2026:CI/CD 凭据泄露 → 数千个客户环境变量外泄。
- 审计日志保留期：SOC 2 = 1 年，HIPAA = 6 年。

```figure
i4-vault-rotation
```

## 使用它

`code/main.py` 实现了一个带一致性令牌化的简易 PII 清洗器和只追加的审计日志。

## 交付它

本课程产出 `outputs/skill-llm-security-plan.md`。根据监管范围和现状，规划保险库迁移、清洗器、出站控制和审计日志。

## 练习

1. 运行 `code/main.py`。发送两个引用同一 SSN 的提示。确认两者得到相同的占位符。
2. 为一个调用 OpenAI + Anthropic + Weaviate 的 vLLM-on-EKS 部署设计网络出站策略。
3. 你在 git 历史中发现一个密钥(2 年前)。正确的应对是什么——轮换密钥、清洗历史，还是两者都要？给出理由。
4. 你的审计日志每天增长 10 GB。设计保留分层(热 30 天、温 12 个月、冷 6 年)。
5. 论证逆令牌化(将真实值替换回 LLM 响应)是否比保留可见占位符更值得引入复杂性。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|------------------------|
| Vault | “密钥存储” | 集中式凭据管理服务 |
| IAM 角色 | “基于身份的认证” | 应用扮演的角色；返回短生命周期凭据 |
| CI/CD 的 OIDC | “云签发的令牌” | CI 中无静态密钥——通过 OIDC 认证身份 |
| TruffleHog / GitGuardian / Gitleaks | “密钥扫描器” | 提交时的密钥检测 |
| RBAC / ABAC | “访问控制” | 基于角色 vs 基于属性 |
| PII 清洗 | “数据遮蔽” | 移除或令牌化敏感实体 |
| 一致性令牌化 | “稳定占位符” | 相同值每次 → 相同令牌 |
| Mesh 方法 | “Mesh 令牌化” | 保留语义的令牌化模式 |
| 出站白名单 | “出站允许列表” | 仅允许访问已许可的域名 |
| 审计日志 | “不可篡改的历史” | 用于合规的只追加记录 |

## 延伸阅读

- [Doppler — Advanced LLM Security](https://www.doppler.com/blog/advanced-llm-security)
- [Portkey — Manage LLM API keys with secret references](https://portkey.ai/blog/secret-references-ai-api-key-management/)
- [Datadog — LLM Guardrails Best Practices](https://www.datadoghq.com/blog/llm-guardrails-best-practices/)
- [JumpServer — Secrets Management Best Practices 2026](https://www.jumpserver.com/blog/secret-management-best-practices-2026)
- [Microsoft Presidio](https://github.com/microsoft/presidio) — PII 检测与匿名化。
- [HashiCorp Vault docs](https://developer.hashicorp.com/vault/docs)