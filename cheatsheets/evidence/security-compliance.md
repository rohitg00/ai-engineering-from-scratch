# Evidence: cheatsheets/security-compliance.md

Abbreviations: L25 = phases/17-infrastructure-and-production/25-security-secrets-audit. L26 = phases/17-infrastructure-and-production/26-compliance-frameworks. R24 = phases/18-ethics-safety-alignment/24-regulatory-frameworks-eu-us-uk-korea. SWI = projects/signed-webhook-inbox.

## Run the labs (task-table)
- L25 code/main.py scrubber + audit log: L25/docs/en.md:112
- L26 code/main.py control map: L26/docs/en.md:107
- python3 code/main.py timeline: R24/code/main.py:8
- go run . --mode demo, statuses 202,200,401: SWI/README.md:26, 29
- go build -o /tmp/webhook-inbox .: SWI/README.md:34

## Gateway pulls keys from vault (architecture)
- App to gateway to provider, gateway pulls from vault: L25/docs/en.md:3
- IAM role, not static key: L25/docs/en.md:33
- OPENAI_API_KEY pulled at request time: L25/docs/en.md:35
- Guardrails input and output: L25/docs/en.md:70-72
- Egress whitelist, allowlist-only DNS resolver, api.openai.com: L25/docs/en.md:77-79
- Immutable audit log of every call: L25/docs/en.md:83

## Security numbers (defaults)
- Rotation ≤ 90 days, keys, root tokens, CI/CD: L25/docs/en.md:37-39
- Short-lived tokens hours not days: L25/docs/en.md:54
- Audit retention SOC 2 1 year: L25/docs/en.md:93
- Audit retention HIPAA 6 years: L25/docs/en.md:93
- 5*time.Minute skew, both sides: SWI/solution/main.go:250, 68
- 1..65536 bytes: SWI/solution/main.go:51-52
- WEBHOOK_SECRET at least 16 bytes: SWI/README.md:31, SWI/solution/main.go:63
- --seconds default 60, 1..600: SWI/solution/main.go:323, 358-359, SWI/README.md:35

## Audit log entry (annotated-code)
- AuditEntry fields and values: L25/code/main.py:104-115
- print(audit_log_call(entry)): L25/code/main.py:116, json.dumps at 60-72
- Prompt hash not raw prompt, model + version: L25/docs/en.md:86-87

## PII scrubbing (concepts)
- Order NER, mask, consistent tokenization, reverse mapping: L25/docs/en.md:61-64
- SSN, EMAIL, PHONE, scrubber.scrub: L25/code/main.py:17-19, 35-38, 88
- Same value same placeholder: L25/code/main.py:27-33, L25/docs/en.md:63
- Regex and NER, use both: L25/docs/en.md:66
- Before the LLM call, post-processing not defensible: L26/docs/en.md:50-52
- Store redacted + consented opt-in raw: L26/docs/en.md:54
- Output regex scrub for API key patterns: L25/docs/en.md:72

## Webhook receiver path (flow)
- POST, valid X-Delivery-ID, canonical integer X-Timestamp, 400: SWI/solution/main.go:33-45, 245-248
- Timestamp window, 401: SWI/solution/main.go:68-69, 250-251
- v1= HMAC-SHA256 of timestamp, id, body, hmac.Equal: SWI/solution/main.go:56-60, 74-76
- fsync + atomic hard link, 202 new: SWI/solution/main.go:112, 128, 137, 264-267, SWI/README.md:45
- Same body retry 200: SWI/solution/main.go:188-196, 264
- Different body 409: SWI/solution/main.go:24, 193-194, 257-258
- --run replay, second replay reuses receipt: SWI/README.md:29, 38

## Webhook inbox commands (command-table)
- serve --dir --listen 127.0.0.1:8141 --seconds 120: SWI/README.md:35
- sign --id delivery-1 --timestamp --body fixtures/event.json, headers: SWI/README.md:36, 41
- inspect: SWI/README.md:37
- replay --run review-1: SWI/README.md:38

## Frameworks and their LLM duty (concepts)
- SOC 2 Type II 6-12 months: L26/docs/en.md:29, 65
- HIPAA BAA: L26/docs/en.md:30, 60
- GDPR real-time redaction, rights, Article 30: L26/docs/en.md:31
- PCI-DSS config + contracts: L26/docs/en.md:32
- EU AI Act tiers, conformity, logging: L26/docs/en.md:33
- Colorado impact assessments, appeal, June 30, 2026: L26/docs/en.md:34, 99
- ISO 42001 pairs with ISO 27001: L26/docs/en.md:35

## Cross-framework control map (command-table)
- access logging: L26/code/main.py:11
- encryption in transit: L26/code/main.py:13
- secrets management: L26/code/main.py:14
- audit log retention: L26/code/main.py:16
- PII redaction (inference-time): L26/code/main.py:15
- impact assessment: L26/code/main.py:18
- BAA signed: L26/code/main.py:20

## EU AI Act dates and fines (concepts)
- 1 Aug 2024 in force: R24/docs/en.md:25
- 2 Feb 2025 prohibited + literacy: R24/docs/en.md:33
- 2 Aug 2025 GPAI + governance: R24/docs/en.md:34
- 2 Aug 2026 full applicability, Article 50, penalties: R24/docs/en.md:35
- 2 Aug 2027 legacy GPAI + embedded high-risk: R24/docs/en.md:36
- Art. 99(4) €15M / 3%: L26/docs/en.md:46
- Art. 99(3) €35M / 7%: L26/docs/en.md:46

## Four jurisdictions (comparison)
- Posture EU strict, US innovation-favouring, UK narrow security, Korea MSIT-led: R24/docs/en.md:75-78
- Bodies AI Office, CAISI under NIST, AI Security Institute, AISI under MSIT: R24/docs/en.md:48, 60, 54-56, 66
- Dates in force Aug 2024, Jun 2025, Feb 2025, Jan 2026: R24/docs/en.md:114, 118, 117, 119
- Core duties risk tiers + logging, standards support, frontier security, local representative: R24/docs/en.md:28, 60, 56, 67

## Troubleshooting (troubleshooting)
- .env committed, keys in git history, scan every commit: L25/docs/en.md:19, 47
- DNS exfil, pod can reach any host, egress + resolver: L25/docs/en.md:23, 77-79
- SSN forwarded unmasked: L25/docs/en.md:21, 59
- signature mismatch 401: SWI/solution/main.go:76, 251, SWI/README.md:41
- timestamp outside acceptance window, current Unix timestamp: SWI/solution/main.go:69, SWI/README.md:41
- 409 same ID different body: SWI/solution/main.go:24, 258
- serve error string, 16 bytes WEBHOOK_SECRET: SWI/solution/main.go:358-359, SWI/README.md:31

## Q&A (qa)
- CI/CD credentials prod-equivalent: L25/docs/en.md:97
- Type I starter, Type II gate: L26/docs/en.md:67
- 202 means durably accepted: SWI/README.md:41
- Strictest is EU AI Act: R24/docs/en.md:80
- Systemic-risk GPAI >1e25 FLOP: R24/docs/en.md:29
