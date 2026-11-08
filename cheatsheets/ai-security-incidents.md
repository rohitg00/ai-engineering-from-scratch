---
id: ai-security-incidents
title: Prompt Injection Incidents and AI CVEs
code: PI
subtitle: Find, trace and block indirect prompt injection. EchoLeak chain, PVE validator, rule detector, tool call firewall.
hue: 350
sources: phases/18-ethics-safety-alignment/15-indirect-prompt-injection, phases/18-ethics-safety-alignment/25-echoleak-cves-for-ai, phases/14-agent-engineering/27-prompt-injection-defense, phases/19-capstone-projects/83-prompt-injection-detector, projects/tool-call-firewall
source_hash: 1fcd87fb0e87220a
---

## Symptoms, causes and fixes
type: troubleshooting
from: phases/18-ethics-safety-alignment/15-indirect-prompt-injection/docs/en.md, phases/18-ethics-safety-alignment/15-indirect-prompt-injection/code/main.py, phases/18-ethics-safety-alignment/25-echoleak-cves-for-ai/docs/en.md, phases/14-agent-engineering/27-prompt-injection-defense/docs/en.md, phases/19-capstone-projects/83-prompt-injection-detector/docs/en.md, phases/19-capstone-projects/83-prompt-injection-detector/code/main.py

| Symptom | Cause | Fix |
|---|---|---|
| Agent forwards an email to all contacts | Naive agent obeys imperatives in the email body | Tag the email untrusted. Ignore its control flow |
| Filter blocks `[SYSTEM:` but a polite rewrite passes | Adaptive attacker drops the marker | Use IFC. Keyword filters fail adaptive attacks |
| Defense reports near-zero ASR, then breaks | Tested with static attacks only | Evaluate with adaptive attacks before you publish |
| Data leaves through an approved domain | Output crosses the trust boundary in a URL | Control retrieval, scope and output one by one |
| Model already touched the world | All guardrails run at the end | Validate each tool call before it runs |
| Yesterday's memory note hijacks today's run | Overtrust of retrieved memory | Refuse memory writes that look like directives |
| Regex misses "disregard the prior" | One regex, never measured | Report precision and recall per category |
| `load_taxonomy` raises FileNotFoundError | Lesson 82 artifact is missing | Run lesson 82 main.py first |

## Production incidents
type: comparison
from: phases/18-ethics-safety-alignment/25-echoleak-cves-for-ai/docs/en.md, phases/18-ethics-safety-alignment/15-indirect-prompt-injection/docs/en.md

| Factor | EchoLeak | CamoLeak | Copilot RCE |
|---|---|---|---|
| Target | Microsoft 365 Copilot | GitHub Copilot Chat | GitHub Copilot |
| CVE | CVE-2025-32711 | Number undisclosed | CVE-2025-53773 |
| CVSS | 9.3 | 9.6 | Details minimal |
| Entry | Crafted email in RAG context | Repository content | Code-suggestion surface |
| Effect | Mermaid image on a CSP-approved URL | Image loads through the Camo proxy | Remote code execution |
| Fix | Server-side update, June 2025 | Image rendering disabled | Details minimal |

## EchoLeak attack chain
type: flow
from: phases/18-ethics-safety-alignment/25-echoleak-cves-for-ai/docs/en.md

1. **Attacker**: sends an email with a routine subject to any employee.
2. **Victim**: does nothing. The attack is zero-click.
3. **Copilot**: RAG retrieval pulls the email into context for a routine query.
4. **Model**: runs the hidden text. It finds the recent MFA codes in the inbox.
5. **Renderer**: loads a Mermaid diagram from a signed URL that holds the codes.
6. **CSP**: allows the request because the domain is approved.
7. **Vendor**: rated it low first. The MFA demo raised it to 9.3.

## Three boundaries and the gate
type: architecture
from: phases/18-ethics-safety-alignment/25-echoleak-cves-for-ai/docs/en.md, phases/18-ethics-safety-alignment/25-echoleak-cves-for-ai/code/main.py, phases/18-ethics-safety-alignment/15-indirect-prompt-injection/docs/en.md

```arch
node | atk | 1,1 | Attacker email | trust untrusted | client
node | rag | 2,1 | Retrieval boundary | enters context | process
node | llm | 3,1 | Model | reads hidden text | model
node | out | 4,1 | Output boundary | CSP-approved URL | client
node | user | 1,2 | User prompt | trusted | client
node | gate | 2,2 | Scope separation | blocks untrusted calls | process
node | scope | 3,2 | Scope boundary | private inbox | store
edge | atk | rag | email
edge | rag | llm | context
edge | llm | out | render_image
edge | user | gate | intent
edge | gate | llm | ratified calls
edge | llm | scope | MFA codes
```

## Attack surface
type: concepts
from: phases/18-ethics-safety-alignment/15-indirect-prompt-injection/docs/en.md, phases/14-agent-engineering/27-prompt-injection-defense/docs/en.md

- **RAG vector**: attacker publishes a document. Retrieval puts it in the prompt.
- **Inbox vector**: attacker sends an email. The agent reads the body.
- **Tool output vector**: attacker controls a tool result, for example a web search.
- **Data theft**: agent sends conversation history to an attacker URL.
- **Worming**: injected content tells the agent to embed the exploit in its next output.
- **Memory poisoning**: agent stores the instructions and re-poisons itself next session.
- **Ecosystem contamination**: injected facts spread to other agents through shared memory.
- **Arbitrary tool use**: any tool in the registry becomes attacker-reachable.

## Run the labs
type: command-table
from: phases/18-ethics-safety-alignment/15-indirect-prompt-injection/docs/en.md, phases/18-ethics-safety-alignment/25-echoleak-cves-for-ai/docs/en.md, phases/14-agent-engineering/27-prompt-injection-defense/docs/en.md, phases/19-capstone-projects/83-prompt-injection-detector/docs/en.md, projects/tool-call-firewall/README.md

| Command | What it does |
|---|---|
| `python3 code/main.py` (18.15) | Attack naive, filter and IFC agents |
| `python3 code/main.py` (18.25) | EchoLeak trace, then scope separation |
| `python3 code/main.py` (14.27) | PVE validator verdicts per call |
| `python3 main.py` (19.83) | Detector metrics and JSON report |
| `project_test.py <id> --init <dir>` | Create the workspace. Id is tool-call-firewall |
| `project_test.py <id> --stage 1 --path <dir>` | Grade one stage |
| `project_test.py <id> --all --solution` | Check the reference. Add `--strict` |

## PVE validator before the executor
type: annotated-code
lang: python
from: phases/14-agent-engineering/27-prompt-injection-defense/code/main.py

```python
validator = Validator(
    allowed_tools=("search", "send_message", "read_memory"),
    sensitive_tools=("send_message",),
)
call = ToolCall("search", {"query": "<q>"}, intent="research")
contents = [Content("<text>", "user_message")]   # user text is not scanned
ok, reason = validator.assess(call, contents)    # allowlist, args, retrieved
if ok:
    executor.run(call)                           # runs only after allow
looks_like_directive("<text>")                   # marker or None
memory_write_guard(MemoryWrite("<text>"))        # refuse directive writes
```

## Layered injection detector
type: annotated-code
lang: python
from: phases/19-capstone-projects/83-prompt-injection-detector/code/main.py, phases/19-capstone-projects/83-prompt-injection-detector/code/rules.py

```python
{"name": "ignore-previous", "category": "instruction-override",
 "score": 0.85, "substring": "ignore previous"}   # a rule is data
detector = Detector()                             # compiles regex rules once
v = detector.analyze("<prompt>")                  # raw and normalized text
v.category                                        # top category, its max score
normalize(text)                                   # zero-width, base64, hex, leet, rot13
report = evaluate(detector, fixtures, benign)     # tp, fp, fn, tn per category
write_report(report)                              # outputs/detector_report.json
```

## Tool call firewall
type: task-table
from: projects/tool-call-firewall/solution, projects/tool-call-firewall/stages/02-evaluate-role-and-path-policy/docs/en.md, projects/tool-call-firewall/stages/03-consume-a-request-bound-approval-once/docs/en.md

| Task | Code |
|---|---|
| Parse the envelope | `call(raw, 256)` |
| Decide policy | `decide(&c)` gives Allow, ApprovalRequired or Deny |
| Reader writes a note | `reader + write notes.md -> Deny` |
| Editor writes a note | `editor + write notes.md -> ApprovalRequired` |
| Use an approval once | `authorize(request, Some(&mut gate))` |
| Execute with containment | `dispatch(root, &request, content, approval)` |
| Log the decision | `audit(&mut log, &c, &d, 10)` |
| Build the CLI | `rustc --edition=2021 cli.rs -o firewall` |

## Limits and numbers
type: defaults
span: 1
from: projects/tool-call-firewall/solution, phases/19-capstone-projects/83-prompt-injection-detector/code/main.py, phases/19-capstone-projects/83-prompt-injection-detector/outputs/detector_report.json, phases/18-ethics-safety-alignment/15-indirect-prompt-injection/docs/en.md

| Setting | Default | Note |
|---|---|---|
| CLI envelope bytes | 4096 | Longer input is refused |
| Write content bytes | 16384 | Same cap for reads |
| Audit `max_entries` | 10 | Duplicate id is refused |
| JSON `schema_version` | 1 | CLI result JSON |
| Base64 token length | 16 | Shorter tokens are not decoded |
| Rot13 word hits | 2 | Fewer hits keep the input |
| No rule fires | 0.0 | Verdict category is `benign` |
| Detector accuracy | 0.62 | 31 of 50 fixtures |

## Questions
type: qa
from: phases/18-ethics-safety-alignment/15-indirect-prompt-injection/docs/en.md, phases/18-ethics-safety-alignment/25-echoleak-cves-for-ai/docs/en.md, phases/14-agent-engineering/27-prompt-injection-defense/docs/en.md, phases/19-capstone-projects/83-prompt-injection-detector/docs/en.md, projects/tool-call-firewall/README.md

- **Why do user-input filters miss IPI?** The payload is in retrieved content, not in user input.
- **Why not filter only keywords?** A benign instruction like "please print Yes" has no keyword.
- **Does fixing one boundary secure the rest?** No. Prevent each of the three independently.
- **Is a system prompt rule enough?** No. Instruction-following alone is not enforcement.
- **Where does the role come from?** The trusted application. Never the model response.
- **Is the detector the safety gate?** No. It is one signal that the gate composes.
- **Is the firewall an OS sandbox?** No. Approvals are single-use in memory in one invocation.
