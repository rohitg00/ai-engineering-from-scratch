# Evidence: cheatsheets/ai-security-incidents.md

Abbreviations: L15 = phases/18-ethics-safety-alignment/15-indirect-prompt-injection, L25 = phases/18-ethics-safety-alignment/25-echoleak-cves-for-ai, L27 = phases/14-agent-engineering/27-prompt-injection-defense, L83 = phases/19-capstone-projects/83-prompt-injection-detector, FW = projects/tool-call-firewall. d = docs/en.md, c = code/main.py.

## Symptoms, causes and fixes (troubleshooting, 8 rows)
- Naive agent forwards email to all contacts on imperatives: L15/c:23-31, 50-61. Fix IFC tag untrusted and ignore control flow: L15/c:89-104, L15/d:37
- Keyword filter blocks `[SYSTEM:` but polite rewrite passes: L15/c:64-70, 107-115, 137-141
- Near-zero ASR defenses broken to >90% by adaptive attacks, evaluate with adaptive attacks: L15/d:43-45
- Exfiltration via CSP-approved domain, control three boundaries independently: L25/d:31, 41-46
- All guardrails at the end, model already touched the world: L27/d:64. PVE on every tool call: L27/d:55
- Overtrust of retrieved memory: L27/d:66. Memory-write guardrail refuses directive-shaped writes: L27/c:102-106, L27/d:102
- Single regex misses "disregard the prior", measure precision and recall: L83/d:12-14
- load_taxonomy raises FileNotFoundError, "run lesson 82 main.py first": L83/c:162-166

## Production incidents (comparison, 6 rows)
- Targets Microsoft 365 Copilot, GitHub Copilot Chat, GitHub Copilot: L25/d:3, 48, 54
- CVE-2025-32711, CVE undisclosed number, CVE-2025-53773: L25/d:3, 52, 54
- CVSS 9.3, 9.6, RCE details minimal: L25/d:3, 52, 56
- Entry: crafted email as RAG context, repository content, code-suggestion surface: L25/d:3, 50, 56
- Effect: Mermaid diagram on Microsoft-signed URL via CSP-approved domain, image-load events through Camo, remote code execution: L25/d:31, 50, 56
- Fix: server-side update June 2025, image rendering disabled, details minimal: L25/d:3, 50, 56

## EchoLeak attack chain (flow, 7 steps)
1. Attacker email with routine subject to any employee: L25/d:27
2. Victim does nothing, zero-click: L25/d:28
3. Copilot RAG retrieval pulls the email during a routine query: L25/d:29
4. Hidden instructions find the most recent MFA codes: L25/d:30
5. Mermaid diagram loads from a Microsoft-signed URL that contains the data: L25/d:31
6. CSP allows the request because the domain is approved: L25/d:31
7. First rated low, escalated to 9.3 after MFA-code demo: L25/d:35, 60

## Three boundaries and the gate (architecture, 7 nodes, 6 edges)
- Attacker email with trust untrusted: L25/c:26-34
- Retrieval boundary, untrusted input enters via retrieval surface: L25/d:42
- Model reads hidden text: L25/c:47-56
- Output boundary, CSP-approved URL, render_image tool call: L25/d:44, L25/c:55-56
- User prompt trusted: L15/d:37
- Scope separation blocks tool calls from untrusted content: L25/c:7-8, 65-75
- Scope boundary, private inbox MFA codes: L25/d:43, L25/c:36-39, 53
- Ratified calls from trusted input: L15/d:37

## Attack surface (concepts, 8 bullets)
- RAG vector: L15/d:25
- Inbox vector: L15/d:26
- Tool output vector, web search example: L15/d:27
- Data theft: L27/d:32
- Worming: L27/d:33
- Persistent memory poisoning: L27/d:34
- Information ecosystem contamination: L27/d:35
- Arbitrary tool use: L27/d:36

## Run the labs (command-table, 7 rows)
- 18.15 python3 code/main.py, naive, filter, IFC agents: L15/d:65, 73
- 18.25 python3 code/main.py, trace with scope separation: L25/d:77, 85
- 14.27 python3 code/main.py, per-call validator verdicts: L27/d:82-86
- 19.83 python3 main.py, metrics and outputs/detector_report.json: L83/d:60
- --init learner workspace: FW/README.md:14
- --stage 1 --path grades a stage: FW/README.md:15
- --all --solution --strict checks the reference: FW/README.md:41, 45

## PVE validator before the executor (annotated-code, 12 lines)
- Validator(allowed_tools=..., sensitive_tools=...): L27/c:114-117
- ToolCall("search", {"query": ...}, intent="research"): L27/c:125-126
- Content(..., "user_message") skipped by scan: L27/c:62-64, 127
- validator.assess(call, contents) checks allowlist, args, retrieved content: L27/c:53-71, 128
- executor.run(call) only if ok: L27/c:130-131
- looks_like_directive returns marker or None: L27/c:31-38
- memory_write_guard(MemoryWrite(...)): L27/c:97-106, 167

## Layered injection detector (annotated-code, 8 lines)
- Rule dict ignore-previous, instruction-override, 0.85, substring: L83/code/rules.py:8
- Detector() compiles regex rules once: L83/c:123-135, 234, L83/d:52
- detector.analyze on raw and normalized text: L83/c:137-139
- v.category is the highest scoring category with its max score: L83/c:156-159, L83/d:20
- normalize: zero-width, homoglyph, base64, hex, leet, rot13: L83/c:68-76
- evaluate(detector, fixtures, benign) gives tp, fp, fn, tn: L83/c:171-221, 235
- write_report to outputs/detector_report.json: L83/c:224-228

## Tool call firewall (task-table, 8 rows)
- call(raw, 256): FW/solution/main.rs:18, FW/solution/stage1.rs:2
- decide(&c) Allow, ApprovalRequired, Deny: FW/solution/main.rs:19, FW/solution/types.rs:17-21
- reader + write notes.md -> Deny: FW/stages/02-evaluate-role-and-path-policy/docs/en.md:27
- editor + write notes.md -> ApprovalRequired: FW/stages/02-evaluate-role-and-path-policy/docs/en.md:28
- authorize(request, Some(&mut gate)), approval used once: FW/solution/stage3.rs:2-15, 55-56, FW/stages/03-consume-a-request-bound-approval-once/docs/en.md:25-30
- dispatch(root, request, content, approval) with canonical containment: FW/solution/stage3.rs:24-41
- audit(&mut log, &c, &d, 10): FW/solution/main.rs:20, FW/solution/stage4.rs:2-17
- rustc --edition=2021 cli.rs -o <binary>: FW/solution/demo.py:9

## Limits and numbers (defaults, 8 rows)
- CLI envelope 4096 bytes, Error::Limit on longer input: FW/solution/cli.rs:49-52, FW/solution/stage1.rs:3-5
- Content 16384 bytes for write and read: FW/solution/cli.rs:66, FW/solution/stage3.rs:44, 67-71
- max_entries 10, duplicate id gives Conflict: FW/solution/cli.rs:82, FW/solution/stage4.rs:8-14
- schema_version 1 in CLI result JSON: FW/solution/cli.rs:100
- Base64 tokens of 16 or more chars: L83/c:81
- Rot13 kept only with score >= 2: L83/c:117-119
- No rule fires: benign, 0.0: L83/c:156-157
- Accuracy 0.62, 31 of 50 fixtures: L83/outputs/detector_report.json:2-4

## Questions (qa, 7 bullets)
- User-input filters miss IPI, payload in retrieved content: L15/d:33
- Benign instruction "please print Yes" defeats keyword filters: L15/d:3, 92
- Three boundaries must be prevented independently: L25/d:46
- Instruction-following alone is not enforcement: L27/d:65
- Role comes from the trusted application, not the model: FW/solution/cli.rs:53, FW/stages/01-validate-an-unambiguous-call-envelope/docs/en.md:32
- Detector is one signal the gate composes: L83/d:44
- Not an OS sandbox, approvals single-use in memory: FW/README.md:38
