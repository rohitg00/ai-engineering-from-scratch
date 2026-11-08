---
id: sre-for-ai
title: SRE, Incidents and Postmortems for AI
code: IP
subtitle: Triage LLM incidents with agents, gate every fix, write evidence-bound postmortems and compact logs for an assistant.
hue: 352
sources: phases/17-infrastructure-and-production/23-sre-for-ai, phases/17-infrastructure-and-production/24-chaos-engineering-llm, phases/19-capstone-projects/06-devops-troubleshooting-agent, projects/postmortem-writer, projects/log-volume-reduction-lab
source_hash: 3245264d2ae57f3e
---

## Incident symptoms
type: troubleshooting
from: phases/17-infrastructure-and-production/23-sre-for-ai/code/main.py, phases/17-infrastructure-and-production/23-sre-for-ai/docs/en.md, phases/19-capstone-projects/06-devops-troubleshooting-agent/code/ts/src/agent.ts, phases/19-capstone-projects/06-devops-troubleshooting-agent/docs/en.md, phases/19-capstone-projects/06-devops-troubleshooting-agent/code/main.py, projects/log-volume-reduction-lab/README.md

| Symptom | Cause | Fix |
|---|---|---|
| High error rate in checkout | vLLM OOM from KV cache spike | Restart pod. Lower `--gpu-memory-utilization` to 0.85 |
| GPU memory at 98% before the spike | KV cache OOM under burst concurrency | Apply runbook RB-017 |
| Two models disagree on root cause | Possible hallucinated root cause | Escalate with both hypotheses visible |
| Pod OOMKilled twice in 10m | Memory request 256Mi too low | Request 512Mi, limit 1Gi |
| CrashLoopBackOff on auth-svc | Probe path changed to /ready | Revert the probe path to /healthz |
| Image `checkout-api:v2.41` fails /healthz | Bad rollout 14m ago | Roll back to v2.40 after approval |
| `blocked: no slack approval` | Destructive tool with no approver | Get the Slack card approved |
| Rare disk-full line lost from context | Uniform sampling with budget 8 | Use the `rarity` policy |

## Multi-agent triage
type: flow
from: phases/17-infrastructure-and-production/23-sre-for-ai/docs/en.md, phases/17-infrastructure-and-production/23-sre-for-ai/code/main.py

1. **Supervisor**: breaks the incident into sub-queries.
2. **Log agent**: log search. Finds the most common error pattern.
3. **Metric agent**: PromQL. Finds the GPU memory spike before the errors.
4. **Runbook agent**: doc retrieval. Matches a known runbook.
5. **Supervisor**: groups root causes. Two or more agents in agreement means confidence.
6. **Human**: approves or redirects the hypothesis and evidence.
7. **Action**: a narrow safe action only, for example restart pod.

## K8s troubleshooting agent
type: architecture
from: phases/19-capstone-projects/06-devops-troubleshooting-agent/docs/en.md

```arch
node | hook | 1,1 | Alert webhook | PagerDuty or Alertmanager | client
node | recv | 2,1 | FastAPI receiver | affected object, SLO breach | process
node | agent | 3,1 | Root-cause agent | sample, walk, hypothesize | model
node | graph | 2,2 | K8s knowledge graph | ownership, scheduling | store
node | tele | 3,2 | Telemetry slices | Prometheus, Loki, Tempo | store
node | slack | 4,1 | Slack brief | top-3, approval buttons | client
node | argo | 4,2 | ArgoCD rollback hook | after approval | process
node | audit | 4,3 | Audit log | considered vs executed | store
edge | hook | recv | webhook
edge | recv | agent | alert
edge | agent | graph | walk
edge | agent | tele | last 15m
edge | agent | slack | ranked hypotheses
edge | slack | argo | approved
edge | argo | audit | append
```

## Remediation scope
type: comparison
from: phases/17-infrastructure-and-production/23-sre-for-ai/docs/en.md, phases/19-capstone-projects/06-devops-troubleshooting-agent/code/main.py, phases/19-capstone-projects/06-devops-troubleshooting-agent/docs/en.md

| Factor | Safe, narrow | Not safe, broad |
|---|---|---|
| Pods and code | Restart pod | Deploy new code |
| Deploys | Revert a specific deploy | Change service topology |
| Capacity | Scale within pre-approved bounds | Modify resource limits |
| Config and access | Enable a pre-approved feature flag | Change IAM, alter databases |
| RBAC verbs | get, list, describe | delete, exec, scale |
| Capstone tools | `kubectl_get`, `promql`, `logql` | `kubectl_delete`, `argocd_rollback` |
| Gate | Runs at once | Needs Slack approval |

## Hypothesis score
type: annotated-code
lang: python
from: phases/19-capstone-projects/06-devops-troubleshooting-agent/code/main.py

```python
def score(self) -> float:
    recency_w = max(0.0, 1.0 - self.recency_mins / 60.0)  # 0 after 60 min
    path_w = 1.0 / (1 + self.path_len)  # short graph path wins
    return (recency_w * 0.35 +
            self.specificity * 0.35 +  # 0..1
            min(len(self.citations), 5) / 5 * 0.2 +  # caps at 5 citations
            path_w * 0.1)
```

## Run the labs
type: task-table
span: 2
from: phases/17-infrastructure-and-production/23-sre-for-ai/docs/en.md, phases/19-capstone-projects/06-devops-troubleshooting-agent/code/main.py, phases/19-capstone-projects/06-devops-troubleshooting-agent/code/ts/README.md, projects/postmortem-writer/README.md, projects/log-volume-reduction-lab/README.md

| Task | Code |
|---|---|
| Multi-agent triage simulator, lesson 23 | `code/main.py` |
| K8s graph agent with approval gate | `python main.py` |
| Slack skeleton self-check, then tests | `npm start` and `npm test` |
| Slack interactive server | `npm run serve` |
| Postmortem packet from the examples | `go run . --events ../examples/events.jsonl --review ../examples/review.json --out /tmp/incident-packet` |
| Build the log context tool | `rustc --edition 2021 main.rs -o /tmp/log-context` |
| Compact logs, budget 8, rarity | `/tmp/log-context fixtures/burst.log 8 rarity /tmp/context.jsonl` |
| Rare-template coverage report | `python3 main.py fixtures/burst.log /tmp/context.jsonl --out /tmp/coverage.json` |

## Limits in the code
type: defaults
from: phases/19-capstone-projects/06-devops-troubleshooting-agent/code/ts/src/slack_verify.ts, projects/log-volume-reduction-lab/solution/main.rs, projects/log-volume-reduction-lab/solution/main.py, projects/postmortem-writer/solution/integration.go

| Setting | Default | Note |
|---|---|---|
| `REPLAY_WINDOW_SECONDS` | 60 * 5 | Older Slack requests are stale |
| `SIGNATURE_VERSION` | v0 | HMAC sha256 over v0:ts:body |
| `rare_max` | 2 | Rare template frequency |
| Log input size | 1_048_576 | Bytes, one MiB |
| Log records | 10_000 | Lines per input |
| Log line length | 4096 | Bytes per line |
| Event JSONL size | 2<<20 | Postmortem events |
| Claims and actions | 100 | Each, per review |

## Postmortem packet rules
type: concepts
from: projects/postmortem-writer/solution/stage1.go, projects/postmortem-writer/solution/stage2.go, projects/postmortem-writer/solution/stage3.go, projects/postmortem-writer/solution/integration.go, projects/postmortem-writer/solution/main.go, projects/postmortem-writer/README.md

- **Event**: one JSONL row with `id`, `second`, `kind` and `message`.
- **Timeline**: sort by second. Ties sort by ID.
- **Claim**: nonblank text and at least one distinct known event ID.
- **Quote**: each evidence ID needs an exact substring of its message.
- **Approval**: `approved` needs a matching `sourceSHA256` and a reviewer.
- **Action**: state `open`, `doing` or `done`. Only `open` can have no owner.
- **Output**: index.html, packet.json and packet.txt, written with `0600`.

## Error strings
type: command-table
from: projects/postmortem-writer/solution/integration.go, projects/postmortem-writer/solution/types.go, projects/log-volume-reduction-lab/solution/main.rs, projects/log-volume-reduction-lab/solution/main.py

| Command | What it does |
|---|---|
| `review source changed` | Review hash differs from the events file |
| `approval requires matching source and reviewer` | Approved claim with no hash or reviewer |
| `quote for <id>` | Quote is blank or not in the message |
| `budget exceeded` | Too many events, claims or bytes |
| `conflict` | Duplicate event ID or evidence ID |
| `expected LEVEL<TAB>message` | Log line has no tab |
| `group count mismatch` | Context count differs from the source |
| `invalid locator` | firstLine or lastLine is out of range |

## Q&A
type: qa
from: phases/17-infrastructure-and-production/23-sre-for-ai/docs/en.md, phases/19-capstone-projects/06-devops-troubleshooting-agent/docs/en.md, projects/postmortem-writer/solution/stage4.go, projects/log-volume-reduction-lab/README.md

- **What does the audit log record?** Every command considered, executed or approved, and who approved it.
- **What is the capstone bar?** At least 80% correct root cause on 20 synthetic incidents.
- **How fast is a hypothesis?** p50 under 5 minutes from alert to Slack brief.
- **Can prediction alone help?** No. Predictions without actuation are dashboards.
- **Does the packet prove the cause?** No. Provenance is checked. Causality requires review.
- **Uniform or rarity sampling?** Rarity. Uniform with budget 8 misses line 138.

## Tips
type: tips
from: phases/17-infrastructure-and-production/23-sre-for-ai/docs/en.md, phases/17-infrastructure-and-production/24-chaos-engineering-llm/docs/en.md, projects/log-volume-reduction-lab/README.md

- Write runbooks with symptom, hypothesis, verify and act sections.
- Store runbooks and post-mortems in a vector DB for retrieval.
- Before chaos, have SLI/SLO, observability, automated rollback, runbooks and on-call.
- Hold a monthly game day. End it with a postmortem.
- Pre-redact logs before you send context to an assistant.
