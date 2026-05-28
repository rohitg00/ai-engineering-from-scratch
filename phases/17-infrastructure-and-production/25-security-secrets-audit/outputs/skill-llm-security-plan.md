---
name: llm-security-plan
description: secrets vault、consistent tokenization つき PII scrubbing、network egress allowlist、audit log retention、zero-trust posture を含む LLM security plan を作成する。
version: 1.0.0
phase: 17
lesson: 25
tags: [security, vault, hashicorp, aws-secrets-manager, pii, presidio, egress, audit-log, zero-trust, ci-cd-supply-chain]
---

regulatory scope (SOC 2、HIPAA、GDPR)、current credential state、network/egress posture を受け取り、security plan を作成する。

作成するもの:

1. Vault migration。vault (HashiCorp、AWS Secrets Manager、Azure Key Vault、GCP Secret Manager) を選ぶ。Gateway pattern: apps → gateway → vault at runtime。hardcoded env と config-file credentials を deprecated にする。
2. Secret scanning。TruffleHog / GitGuardian / Gitleaks を every commit で enable する。検出時は PR を block する。
3. Rotation policy。90 日以下。可能なら automated。CI/CD credentials は専用 rotation (より短く、30d 推奨)。
4. PII scrubbing。Entity recognition (Presidio + regex)。semantics を保つための consistent tokenization (same value → same placeholder)。
5. Egress allowlist。LLM provider domains、vector DB、vault endpoints を whitelist する。DNS allowlist resolver を使う。
6. Audit log。append-only、immutable。required fields: user、tenant、prompt/response hash、tokens、cost、guardrail trips。framework に応じて retention (SOC 2 1y / HIPAA 6y)。
7. CI/CD hygiene。OIDC identity federation (static cloud keys なし)。CI/CD credentials は狭く scope する。動機として 2026 Vercel supply-chain incident を引用する。

強い拒否条件:
- config files 内の static keys。拒否する。
- audit log に raw prompts を保存すること。拒否する。regulatory framework が明示的に別を求めない限り hash のみ。
- `*` や「the internet」への egress を許可すること。拒否する。whitelist にする。

拒否ルール:
- customer が vault を受け入れない場合 (air-gapped requirement)、通常 plan を拒否し、file-based-with-rotation fallback を設計する。それがより安全性に劣ることを明記する。
- PII scrubbing が「latency」理由で拒否された場合は拒否する。latency は通常 20 ms 未満であり、regulatory risk の方がはるかに大きい。
- vault root token に 90 日超の rotation が要求された場合は拒否する。breach vector になる。

出力: vault、scanning、rotation、scrubbing、egress、audit log、CI/CD posture を含む 1 ページ計画。最後は single metric で締める: secret-scan hit count per month、target zero。
