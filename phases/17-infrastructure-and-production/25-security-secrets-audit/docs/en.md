# Security — Secrets, API Key Rotation, Audit Logs, Guardrails

> Eliminate secret sprawl via centralized vaults (HashiCorp Vault, AWS Secrets Manager, Azure Key Vault). Never store credentials in config files, env files in VCS, spreadsheets. Use IAM roles over static keys; OIDC for CI/CD. The AI-gateway pattern is the 2026 solution: apps → gateway → model provider, with gateway pulling credentials from vault at runtime. Rotate in vault and all apps pick up in minutes — no redeploys, no Slack "who has the new key" messages. Rotation policy ≤90 days; scan with TruffleHog / GitGuardian / Gitleaks on every commit. Zero-trust: MFA, SSO, RBAC/ABAC, short-lived tokens, device posture. PII scrubbing uses entity recognition to mask PHI/PII before forwarding; consistent tokenization (Mesh approach) maps sensitive values to stable placeholders so the LLM preserves code/relationship semantics. Network egress: LLM services in dedicated VPC/VNet subnet whitelisting only `api.openai.com`, `api.anthropic.com` etc; block all other outbound. The 2026 incident driver: Vercel supply-chain attack via compromised CI/CD credentials exfiltrated env vars across thousands of customer deployments.

**Type:** Learn
**Languages:** Python (stdlib, toy PII-scrubber + audit-log writer)
**Prerequisites:** Phase 17 · 19 (AI Gateways), Phase 17 · 13 (Observability)
**Time:** ~60 minutes

## Learning Objectives

- Enumerate the four secret-management anti-patterns (config files in VCS, hardcoded env, spreadsheets, static keys) and name their replacements.
- Explain the AI-gateway-pulls-from-vault pattern as 2026 production standard.
- Implement a PII scrubber with consistent tokenization (same value → same placeholder) so semantics survive.
- Name the 2026 Vercel supply-chain incident and what it taught about CI/CD credential hygiene.

## The Problem

An intern commits `.env` with API keys. They delete it quickly. The keys are already in git history — GitGuardian scan catches it, your rotation process is "Slack the team, update 40 config files, redeploy all services." 8 hours later, half your services are live and half are waiting for deploy windows.

Separately, user prompts include "My SSN is 123-45-6789." Prompt goes to OpenAI. You have a BAA but your internal policy is to mask PII before forwarding. You didn't.

Separately, your EKS cluster's LLM pod can reach any internet host. Someone exfils data via DNS lookup to an attacker-controlled domain. Nothing blocked it.

Security for LLM services has to address all three vectors. Vault-backed credentials. PII scrubbing. Network egress filtering. Audit logs.

## The Concept

### Centralized vault + IAM-role pull

**Vault**: HashiCorp Vault, AWS Secrets Manager, Azure Key Vault, GCP Secret Manager. One source of truth.

**IAM role**: app/gateway authenticates via its IAM identity, not a static key. Vault returns the secret for the lifetime of the token.

**The AI-gateway pattern**: gateway pulls `OPENAI_API_KEY` from vault at request time. Rotate in vault; next request gets the new key. No redeploys.

### Rotation policy ≤ 90 days

All API keys, vault root tokens, CI/CD credentials. Automated rotation where possible. Manual rotation logged and tracked.

### Secret scanning

- **TruffleHog** — regex + entropy on commits.
- **GitGuardian** — commercial, high accuracy.
- **Gitleaks** — OSS, runs in CI.

Run on every commit. Block PR if new secret detected.

### Zero-trust posture

- MFA required on all accounts.
- SSO via SAML/OIDC.
- RBAC (role-based) or ABAC (attribute-based) for fine grained access.
- Short-lived tokens (hours, not days).
- Device posture — only corp devices with disk encryption.

### PII / PHI scrubbing

Before the prompt leaves your infra:

1. Entity recognition (spaCy NER, Presidio, commercial).
2. Mask matched entities: `"My SSN is 123-45-6789"` → `"My SSN is [SSN_TOKEN_A3F]"`.
3. Consistent tokenization (Mesh approach): same value maps to the same placeholder so the LLM preserves relationships.
4. Optional reverse mapping for LLM response.

Static regex filters catch basic patterns; NER catches more. Use both.

### Input + output guardrails

Input: block known jailbreaks, forbidden topics; rate-limit per-user.

Output: regex scrub for leaked secrets (API key patterns, email patterns in refusal contexts), classifier for policy violations.

### Network egress whitelist

LLM services in a dedicated subnet:
- Whitelist: `api.openai.com`, `api.anthropic.com`, vector DB endpoints, vault endpoints.
- Everything else: drop.
- DNS via allowlist-only resolver (avoid DNS-tunneling exfil).

### Audit log

Immutable log of every LLM call with:
- Timestamp.
- User / tenant.
- Prompt hash (not raw prompt for privacy).
- Model + version.
- Token counts.
- Cost.
- Response hash.
- Any guardrail trips.

Retain per regulatory requirement (SOC 2 1 year, HIPAA 6 years).

### The 2026 Vercel incident

Supply-chain attack: compromised CI/CD credentials exfiltrated env vars across thousands of customer deployments. Lesson: CI/CD credentials are prod-equivalent. Store in vault. Scope narrowly. Rotate aggressively.

### Numbers you should remember

- Rotation policy: ≤ 90 days.
- Scan on every commit: TruffleHog / GitGuardian / Gitleaks.
- Vercel 2026: CI/CD creds compromised → thousands of customer env vars leaked.
- Audit log retention: SOC 2 = 1 year, HIPAA = 6 years.

## Use It

`code/main.py` implements a toy PII scrubber with consistent tokenization and an append-only audit log.

## Ship It

This lesson produces `outputs/skill-llm-security-plan.md`. Given regulatory scope and current state, plans the vault migration, scrubber, egress, audit log.

## Exercises

1. Run `code/main.py`. Send two prompts referencing the same SSN. Confirm both get the same placeholder.
2. Design the network egress policy for a vLLM-on-EKS deployment calling OpenAI + Anthropic + Weaviate.
3. You discover a key in git history (2 years old). What's the correct response — rotate the key, scrub history, or both? Justify.
4. Your audit log grows 10 GB/day. Design retention tiers (hot 30d, warm 12mo, cold 6yr).
5. Argue whether reverse-tokenization (substituting real values back into LLM response) is worth the complexity versus keeping placeholders visible.

## Key Terms

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Vault | "secrets store" | Centralized credential management service |
| IAM role | "identity-based auth" | Role assumed by app; returns short-lived creds |
| OIDC for CI/CD | "cloud-issued tokens" | No static keys in CI — identity via OIDC |
| TruffleHog / GitGuardian / Gitleaks | "secret scanners" | Commit-time secret detection |
| RBAC / ABAC | "access control" | Role-based vs attribute-based |
| PII scrubbing | "data masking" | Remove or tokenize sensitive entities |
| Consistent tokenization | "stable placeholders" | Same value → same token each time |
| Mesh approach | "Mesh tokenization" | Semantic-preserving tokenization pattern |
| Egress whitelist | "outbound allowlist" | Only permitted domains reachable |
| Audit log | "immutable history" | Append-only record for compliance |

## Further Reading

- [Doppler — Advanced LLM Security](https://www.doppler.com/blog/advanced-llm-security)
- [Portkey — Manage LLM API keys with secret references](https://portkey.ai/blog/secret-references-ai-api-key-management/)
- [Datadog — LLM Guardrails Best Practices](https://www.datadoghq.com/blog/llm-guardrails-best-practices/)
- [JumpServer — Secrets Management Best Practices 2026](https://www.jumpserver.com/blog/secret-management-best-practices-2026)
- [Microsoft Presidio](https://github.com/microsoft/presidio) — PII detection and anonymization.
- [HashiCorp Vault docs](https://developer.hashicorp.com/vault/docs)
