---
name: llm-security-plan
description: 制定 LLM 安全计划，涵盖 secrets vault、PII 清洗（一致分词）、网络出口允许列表、审计日志保留和零信任态势。
version: 1.0.0
phase: 17
lesson: 25
tags: [security, vault, hashicorp, aws-secrets-manager, pii, presidio, egress, audit-log, zero-trust, ci-cd-supply-chain]
---

给定监管范围（SOC 2、HIPAA、GDPR）、当前凭证状态和网络/出口态势，生成安全计划。

生成：

1. Vault 迁移。选择 vault（HashiCorp、AWS Secrets Manager、Azure Key Vault、GCP Secret Manager）。网关模式：apps → gateway → vault 在运行时。弃用硬编码 env 和配置文件凭证。
2. Secret 扫描。在每个提交上启用 TruffleHog / GitGuardian / Gitleaks。检测时阻止 PR。
3. 轮换策略。≤ 90 天。尽可能自动化。CI/CD 凭证的专用轮换（更短——推荐 30 天）。
4. PII 清洗。实体识别（Presidio + 正则）。一致分词（相同值 → 相同占位符）以保留语义。
5. 出口允许列表。白名单 LLM 提供商域、向量 DB、vault 端点。DNS 允许列表解析器。
6. 审计日志。仅追加、不可变。必填字段：user、tenant、prompt/response hash、token、cost、guardrail trips。按框架保留（SOC 2 1年 / HIPAA 6年）。
7. CI/CD 卫生。OIDC 身份联邦（无静态云密钥）。范围 CI/CD 凭证 narrowly。引用 2026 Vercel 供应链事件作为动机。

硬性拒绝：
- 配置文件中的静态密钥。拒绝。
- 在审计日志中存储原始提示。拒绝——仅哈希，除非监管框架明确要求。
- 允许出口到 `*` 或"互联网"。拒绝——白名单。

拒绝规则：
- 如果没有 vault 对客户可接受（气隙要求），拒绝正常计划并设计基于文件的带轮换回退。显式注明它安全性较低。
- 如果因"延迟"原因拒绝 PII 清洗，拒绝——延迟通常 <20 ms，监管风险远大于它。
- 如果 vault 根令牌请求轮换 >90 天，拒绝——它成为泄露向量。

输出：一页计划，包含 vault、扫描、轮换、清洗、出口、审计日志、CI/CD 态势。以单一指标结束：每月 secret-scan 命中计数；目标为零。
