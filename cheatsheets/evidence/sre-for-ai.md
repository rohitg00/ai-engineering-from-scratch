# Evidence: cheatsheets/sre-for-ai.md

Abbreviations: L23 = phases/17-infrastructure-and-production/23-sre-for-ai. L24 = phases/17-infrastructure-and-production/24-chaos-engineering-llm. C06 = phases/19-capstone-projects/06-devops-troubleshooting-agent. PMW = projects/postmortem-writer. LVR = projects/log-volume-reduction-lab.

## Incident symptoms (troubleshooting)
- Checkout error rate, vLLM OOM from KV cache spike, restart pod, --gpu-memory-utilization 0.85: L23/code/main.py:25, 48, 78; L23/docs/en.md:19
- GPU memory 98% before spike, RB-017 KV cache OOM under burst concurrency: L23/code/main.py:36, 46-48
- Disagreement escalates with both hypotheses: L23/docs/en.md:62
- OOMKilled twice in 10m, 256Mi, 512Mi, 1Gi: C06/code/ts/src/agent.ts:16, 21
- CrashLoopBackOff auth-svc, /ready vs /healthz: C06/code/ts/src/agent.ts:38-43
- checkout-api:v2.41 fails /healthz, rollout 14m ago, roll back to v2.40 with approval: C06/docs/en.md:97-102
- "blocked: no slack approval": C06/code/main.py:179
- Uniform budget 8 misses disk-full line, rarity retains it: LVR/README.md:34

## Multi-agent triage (flow)
- Supervisor sub-queries: L23/docs/en.md:50
- Log agent, log search, most common error token: L23/docs/en.md:50, L23/code/main.py:20-21
- Metric agent PromQL, GPU memory 98% 4 minutes before: L23/code/main.py:32-36
- Runbook agent doc retrieval, runbook match: L23/docs/en.md:50, L23/code/main.py:42-46
- Supervisor groups root causes, agreement >= 2: L23/code/main.py:53-61
- Human approves or redirects: L23/docs/en.md:50
- Narrow safe action: L23/docs/en.md:47, 54, L23/code/main.py:96

## K8s troubleshooting agent (architecture)
- Alert webhook, PagerDuty or Alertmanager: C06/docs/en.md:28, 75
- FastAPI receiver, affected object and SLO breach: C06/docs/en.md:31, 75
- Root-cause agent nodes sample, walk, hypothesize: C06/docs/en.md:79
- K8s knowledge graph ownership + scheduling: C06/docs/en.md:39-41
- Telemetry slices Prometheus, Loki, Tempo, last 15m: C06/docs/en.md:39-41, 21
- Slack brief top-3 with approval buttons: C06/docs/en.md:21, 47
- ArgoCD rollback hook after approval: C06/docs/en.md:49-50
- Audit log considered vs executed: C06/docs/en.md:53

## Remediation scope (comparison)
- Restart pod vs deploy new code: L23/docs/en.md:54, 56
- Revert specific deploy vs change topology: L23/docs/en.md:54, 56
- Scale within bounds vs modify resource limits: L23/docs/en.md:54, 56
- Pre-approved feature flag vs IAM, databases: L23/docs/en.md:54, 56
- RBAC verbs get, list, describe vs delete, exec, scale: C06/docs/en.md:77
- read_only_tools and destructive_tools names: C06/code/main.py:164-165
- Destructive needs Slack approval: C06/docs/en.md:85, C06/code/main.py:169-179

## Hypothesis score (annotated-code)
- score function and weights 0.35, 0.35, 0.2, 0.1: C06/code/main.py:89-95
- specificity 0..1: C06/code/main.py:86

## Run the labs (task-table)
- code/main.py triage simulator: L23/docs/en.md:99
- python main.py: C06/code/main.py:9
- npm start, npm test: C06/code/ts/README.md:32-33
- npm run serve: C06/code/ts/README.md:34
- go run . with example files: PMW/README.md:33
- rustc --edition 2021: LVR/README.md:26
- /tmp/log-context ... 8 rarity: LVR/README.md:27
- python3 main.py ... --out /tmp/coverage.json: LVR/README.md:28

## Limits in the code (defaults)
- REPLAY_WINDOW_SECONDS 60 * 5, stale: C06/code/ts/src/slack_verify.ts:5, 18-19
- SIGNATURE_VERSION v0, HMAC sha256 over v0:ts:body: C06/code/ts/src/slack_verify.ts:4, 21-24
- rare_max 2: LVR/solution/main.py:7
- 1_048_576 bytes: LVR/solution/main.rs:35
- 10_000 records: LVR/solution/main.rs:40
- 4096 bytes per line: LVR/solution/main.rs:43
- 2<<20 events JSONL: PMW/solution/integration.go:57
- 100 claims and actions: PMW/solution/integration.go:110

## Postmortem packet rules (concepts)
- JSONL id, second, kind, message: PMW/solution/integration.go:66-71
- Sort by second, ties by ID: PMW/solution/stage2.go:15-20
- Claim nonblank text, distinct known IDs: PMW/solution/stage3.go:6-21
- Quote exact substring: PMW/solution/integration.go:137-141
- approved needs matching sourceSHA256 and reviewer: PMW/solution/integration.go:131-132
- Action states open/doing/done, non-open needs owner: PMW/solution/integration.go:148-149
- index.html, packet.json, packet.txt, 0600: PMW/solution/main.go:39, 45, 49, PMW/README.md:33

## Error strings (command-table)
- review source changed: PMW/solution/integration.go:107-108
- approval requires matching source and reviewer: PMW/solution/integration.go:131-132
- quote for id: PMW/solution/integration.go:139-140
- budget exceeded is ErrLimit: PMW/solution/types.go:6, PMW/solution/integration.go:57-58, 80-81, 98-99
- conflict is ErrConflict, duplicate IDs: PMW/solution/types.go:7, PMW/solution/stage1.go:23-24, PMW/solution/stage3.go:18-19
- expected LEVEL<TAB>message: LVR/solution/main.rs:46
- group count mismatch: LVR/solution/main.py:23-24
- invalid locator, firstLine/lastLine: LVR/solution/main.py:25-26

## Q&A (qa)
- Audit log considered, executed, approved, who: C06/docs/en.md:64, 87, 136
- >= 80% correct root cause on 20 incidents: C06/docs/en.md:111
- p50 under 5 minutes: C06/docs/en.md:113
- Predictions without actuation are dashboards: L23/docs/en.md:72
- Provenance checked, causality requires review: PMW/solution/stage4.go:22
- Uniform budget 8 misses line 138: LVR/README.md:34

## Tips (tips)
- Runbook sections symptom, hypothesis, verify, act: L23/docs/en.md:84
- Runbooks + post-mortems in vector DB: L23/docs/en.md:66
- Five chaos prerequisites: L24/docs/en.md:29-33
- Monthly game day with postmortem: L24/docs/en.md:70
- Pre-redact inputs: LVR/README.md:34
