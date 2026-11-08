---
id: security-compliance
title: Secrets, Audit Logs and Compliance
code: AU
subtitle: Vault-backed keys, PII scrubbing, audit logs, signed webhooks, framework controls and AI law dates.
hue: 140
sources: phases/17-infrastructure-and-production/25-security-secrets-audit, phases/17-infrastructure-and-production/26-compliance-frameworks, phases/18-ethics-safety-alignment/24-regulatory-frameworks-eu-us-uk-korea, projects/signed-webhook-inbox
source_hash: 67e98f82b081e529
---

## Run the labs
type: task-table
from: phases/17-infrastructure-and-production/25-security-secrets-audit/docs/en.md, phases/17-infrastructure-and-production/26-compliance-frameworks/docs/en.md, phases/18-ethics-safety-alignment/24-regulatory-frameworks-eu-us-uk-korea/code/main.py, projects/signed-webhook-inbox/README.md

| Task | Code |
|---|---|
| PII scrubber and audit log, lesson 25 | `code/main.py` |
| Control and profile map, lesson 26 | `code/main.py` |
| AI regulation timeline, phase 18 | `python3 code/main.py` |
| Webhook demo: 202, 200, 401 | `go run . --mode demo` |
| Build the webhook inbox | `go build -o /tmp/webhook-inbox .` |

## Gateway pulls keys from vault
type: architecture
from: phases/17-infrastructure-and-production/25-security-secrets-audit/docs/en.md

```arch
node | app | 1,1 | App | no provider key | client
node | gw | 2,1 | AI gateway | IAM role, guardrails | process
node | vault | 2,2 | Vault | OPENAI_API_KEY | store
node | egress | 3,1 | Egress whitelist | allowlist-only DNS | process
node | prov | 4,1 | Model provider | api.openai.com | model
node | audit | 3,2 | Audit log | immutable, per call | store
edge | app | gw | request
edge | gw | vault | pull at request time
edge | gw | egress | scrubbed prompt
edge | egress | prov | allowed host only
edge | gw | audit | append
```

## Security numbers
type: defaults
from: phases/17-infrastructure-and-production/25-security-secrets-audit/docs/en.md, projects/signed-webhook-inbox/solution/main.go, projects/signed-webhook-inbox/README.md

| Setting | Default | Note |
|---|---|---|
| Key rotation | ≤ 90 days | Keys, vault root tokens, CI/CD credentials |
| Token lifetime | hours | Short-lived tokens, not days |
| Audit retention, SOC 2 | 1 year | Retain per regulation |
| Audit retention, HIPAA | 6 years | Retain per regulation |
| Webhook clock skew | `5*time.Minute` | Both sides of now |
| Webhook body size | 1..65536 bytes | Read before any decoding |
| Webhook secret | WEBHOOK_SECRET | At least 16 bytes |
| `--seconds` | 60 | Receiver lifetime, 1..600 |

## Audit log entry
type: annotated-code
lang: python
from: phases/17-infrastructure-and-production/25-security-secrets-audit/code/main.py

```python
entry = AuditEntry(
    timestamp=datetime.utcnow().isoformat() + "Z",
    user=f"user_{i:03}",
    tenant="tenant_01",
    model="anthropic/claude-3.7-sonnet",  # model plus version
    prompt_hash=hash_short(scrubbed),  # hash, not the raw prompt
    response_hash=hash_short(response),
    input_tokens=len(scrubbed.split()),
    output_tokens=len(response.split()),
    cost_usd=0.0012,
    guardrail_trips=[],  # any guardrail trips
)
print(audit_log_call(entry))  # one JSON line per call
```

## PII scrubbing
type: concepts
from: phases/17-infrastructure-and-production/25-security-secrets-audit/docs/en.md, phases/17-infrastructure-and-production/25-security-secrets-audit/code/main.py, phases/17-infrastructure-and-production/26-compliance-frameworks/docs/en.md

- **Order**: entity recognition, mask, consistent tokenization, optional reverse mapping.
- **Lab patterns**: `SSN`, `EMAIL` and `PHONE` regexes in `scrubber.scrub`.
- **Consistent tokens**: the same value maps to the same placeholder every time.
- **Regex and NER**: regex catches basic patterns. NER catches more. Use both.
- **When**: before the LLM call. Post-processing cleanup is not defensible.
- **Storage**: only redacted prompts plus consented opt-in raw.
- **Output guardrail**: regex scrub for leaked API key patterns.

## Webhook receiver path
type: flow
from: projects/signed-webhook-inbox/solution/main.go, projects/signed-webhook-inbox/README.md

1. **ReadDelivery**: needs POST, a valid `X-Delivery-ID` and an integer `X-Timestamp`. Else 400.
2. **Verify**: rejects a timestamp outside the 5 minute window with 401.
3. **Verify**: compares the `v1=` HMAC-SHA256 of timestamp, ID and body with `hmac.Equal`. Else 401.
4. **Accept**: writes with fsync and an atomic hard link. A new delivery returns 202.
5. **Retry**: the same ID with the same body returns 200.
6. **Conflict**: the same ID with a different body returns 409.
7. **Replay**: an explicit `--run` ID writes one processing receipt. A second replay reuses it.

## Webhook inbox commands
type: command-table
span: 2
from: projects/signed-webhook-inbox/README.md

| Command | What it does |
|---|---|
| `/tmp/webhook-inbox --mode serve --dir <dir> --listen 127.0.0.1:8141 --seconds 120` | Receive deliveries for 120 seconds |
| `/tmp/webhook-inbox --mode sign --id delivery-1 --timestamp <unix> --body fixtures/event.json` | Print the three signed headers |
| `/tmp/webhook-inbox --mode inspect --dir <dir> --id delivery-1` | Show the stored delivery |
| `/tmp/webhook-inbox --mode replay --dir <dir> --id delivery-1 --run review-1` | Process once under run ID review-1 |

## Frameworks and their LLM duty
type: concepts
from: phases/17-infrastructure-and-production/26-compliance-frameworks/docs/en.md

- **SOC 2 Type II**: controls operate effectively over 6-12 months.
- **HIPAA**: no PHI to external AI services without a signed BAA.
- **GDPR**: real-time PII redaction, data subject rights, Article 30 records.
- **PCI-DSS**: configuration plus contracts for AI that touches payment.
- **EU AI Act**: risk tier classification. High-risk needs conformity assessment and logging.
- **Colorado AI Act**: impact assessments and right to appeal. Effective June 30, 2026.
- **ISO 42001**: AI governance. It pairs with ISO 27001.

## Cross-framework control map
type: command-table
from: phases/17-infrastructure-and-production/26-compliance-frameworks/code/main.py

| Command | What it does |
|---|---|
| `access logging` | ISO 27001 A.5.15-5.18, GDPR Art. 32, HIPAA §164.312(a), SOC 2 CC6 |
| `encryption in transit` | ISO 27001 A.8.24, GDPR Art. 32, HIPAA §164.312(e) |
| `secrets management` | ISO 27001 A.8.19, PCI DSS Req. 8, SOC 2 CC6.1 |
| `audit log retention` | SOC 2 CC7, HIPAA §164.312(b), ISO 27001 A.8.15 |
| `PII redaction (inference-time)` | GDPR Art. 25, EU AI Act Art. 10, HIPAA §164.514 |
| `impact assessment` | Colorado AI Act SB24-205, EU AI Act Art. 27 |
| `BAA signed` | HIPAA §164.504(e) |

## EU AI Act dates and fines
type: concepts
from: phases/18-ethics-safety-alignment/24-regulatory-frameworks-eu-us-uk-korea/docs/en.md, phases/17-infrastructure-and-production/26-compliance-frameworks/docs/en.md

- **1 Aug 2024**: in force.
- **2 Feb 2025**: prohibited practices and AI literacy apply.
- **2 Aug 2025**: GPAI and governance obligations apply.
- **2 Aug 2026**: full applicability, Article 50 transparency, penalties.
- **2 Aug 2027**: legacy GPAI and embedded high-risk systems.
- **Art. 99(4)**: up to €15M or 3% for high-risk obligations.
- **Art. 99(3)**: up to €35M or 7% for prohibited practices.

## Four jurisdictions
type: comparison
from: phases/18-ethics-safety-alignment/24-regulatory-frameworks-eu-us-uk-korea/docs/en.md

| Factor | EU | US | UK | Korea |
|---|---|---|---|---|
| Posture | Strict, risk-tiered | Innovation-favouring | Narrow security focus | MSIT-led |
| Body | AI Office | CAISI under NIST | AI Security Institute | AISI under MSIT |
| Key date | In force Aug 2024 | Renamed Jun 2025 | Renamed Feb 2025 | Effective Jan 2026 |
| Core duty | Risk tiers, logging | Standards support | Frontier security | Local representative |

## Troubleshooting
type: troubleshooting
from: phases/17-infrastructure-and-production/25-security-secrets-audit/docs/en.md, projects/signed-webhook-inbox/solution/main.go, projects/signed-webhook-inbox/README.md

| Symptom | Cause | Fix |
|---|---|---|
| Keys from a deleted `.env` still leak | Keys stay in git history | Rotate the keys. Scan every commit |
| Data leaves through a DNS lookup | LLM pod can reach any host | Egress whitelist, allowlist-only resolver |
| SSN reached the provider | No masking before forwarding | Scrub PII before the prompt leaves |
| 401 `signature mismatch` | Body bytes changed | Send the exact file bytes |
| 401 `timestamp outside acceptance window` | Old or future timestamp | Sign with the current Unix timestamp |
| 409 on a known delivery ID | Same ID, different body | Use a new delivery ID |
| `--dir, 16-byte key env and seconds 1..600 required` | Short key or no inbox directory | Set a 16-byte WEBHOOK_SECRET and `--dir` |

## Q&A
type: qa
from: phases/17-infrastructure-and-production/25-security-secrets-audit/docs/en.md, phases/17-infrastructure-and-production/26-compliance-frameworks/docs/en.md, phases/18-ethics-safety-alignment/24-regulatory-frameworks-eu-us-uk-korea/docs/en.md, projects/signed-webhook-inbox/README.md

- **How do you treat CI/CD credentials?** As prod-equivalent. Store in vault. Scope narrowly. Rotate aggressively.
- **Type I or Type II?** Type II. Type I is a starter. Type II is the gate.
- **Does a 202 mean the action ran?** No. Authenticated bytes were durably accepted.
- **Which rules bind across jurisdictions?** The strictest, typically the EU AI Act in 2026.
- **What makes GPAI systemic-risk?** Training compute above 1e25 FLOP.
