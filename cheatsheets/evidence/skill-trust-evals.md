# Evidence: cheatsheets/skill-trust-evals.md

Abbreviations: L26 = phases/13-tools-and-protocols/26-skill-permissions-sandboxes-and-trust, L27 = phases/13-tools-and-protocols/27-skill-evals-packaging-and-portability, L10 = phases/14-agent-engineering/10-skill-libraries-voyager, PS = projects/skill-scanner, PL = projects/self-improving-skill-loop. d = docs/en.md, c = code/main.py.

## Symptoms, causes and fixes (troubleshooting, 8 rows)
- workspace-jail deny, path resolves outside the workspace jail, demo `../outside.txt`: L26/c:128-129, 199-201, 310
- command-review deny for `rm` even with approved=True, DESTRUCTIVE_EXECUTABLES; safer unit is a narrow tool: L26/c:69, 144-145, 204-206, 311; L26/d:166
- port 8443 is a different origin and needs its own allowlist entry: L26/d:222; network-allowlist deny: L26/c:233-240
- approval-gate when influenced_by_untrusted_content on network; approval shows target and consequence: L26/c:263-283, 312-316; L26/d:234
- secret-review deny on SECRET_PATTERNS match; inject a credential only into the narrow tool: L26/c:62-66, 242-260; L26/d:207
- orphan-file lint issue, SKILL.md does not directly reference the file: L27/c:279
- fixture_passed true while passed false; passed follows productionReady; --attestation and --trusted-attestation-sha256: L27/d:394, 396-402, 434, 609-610; L27/c:972, 1006
- audit usable false on content or group leaks; union content and groups before partition: PL/solution/dataset.py:66-73; PL/README.md:5

## review_action check order (flow, 8 steps)
1. policy-change gives DENY with rule authority-boundary: L26/c:178-184
2. kind not in allowed_kinds gives kind-allowlist: L26/c:185-191
3. read, write, delete go through normalize_workspace_path, failure gives workspace-jail: L26/c:195-201
4. inspect_command checks bare name, destructive set, git clean/reset, metacharacters, argv prefix: L26/c:139-155, 203-206
5. normalize_https_origin adds port 443 by default, origin must be allowlisted: L26/c:117-120, 208-240
6. contains_secret gives DENY, or REQUIRE_APPROVAL when permit_secret_use_after_approval: L26/c:242-260
7. approval_kinds or untrusted influence need approved, else approval-gate: L26/c:262-283
8. policy-allow; executed defaults to False: L26/c:50, 285-292

## Review one action (annotated-code, 11 lines)
- SandboxPolicy with workspace_root, allowed_kinds, command_allowlist, network_allowlist from the demo: L26/c:300-305
- workspace root resolved with strict=True: L26/c:124
- network allowlist entries are origins only (origin_only): L26/c:91-94, 221-224
- ActionRequest("write", target="summary.json") with and without approved=True: L26/c:308-309
- write is in approval_kinds default: L26/c:26
- verdict value "require-approval": L26/c:17; to_dict: L26/c:52-55
- rule "policy-allow": L26/c:287
- normalize_https_origin returns https://host:port with port 443 default; api.example.test example: L26/c:117-120; L26/d:222

## Run the labs and tools (command-table, 7 rows)
- python3 code/main.py, simulated decisions, starts no process: L26/d:291, 298
- python3 -m unittest discover -s code/tests -v: L26/d:292
- python3 scripts/review_action.py --policy ... --request ...: L26/outputs/skill-safety-reviewer/SKILL.md:16-17
- evaluate_skill.py --fixture-demo, fixturePassed true, productionReady false: L27/d:474-480
- scanner examples/reviewable 3, prints versioned JSON: PS/README.md:31, 34
- cli.py ... --out experiment.json, no promotion without --promote-to: PL/README.md:30, 37
- python3 scripts/project_test.py ... --all --solution --strict: PS/README.md:41, 45

## Run the isolation drill (annotated-code, 7 lines)
- docker build and docker run flags: L26/d:307-313
- probe expectations: input readable, read-only image, bounded /tmp, network fails: L26/d:315

## Defaults and limits (defaults, 8 rows)
- allowed_kinds ("read",): L26/c:23
- approval_kinds ("write", "delete", "network"): L26/c:26
- MAX_SKILL_BODY_CHARS 10_000, body-size issue: L27/c:23, 186
- MAX_COMPANION_FILE_BYTES 1_000_000, file-size issue: L27/c:24, 258
- min_precision and min_recall 0.8 in ReleaseThresholds: L27/c:630-631
- min_repeat_rate 0.9, compared with the lowest per-case rate: L27/c:632, 962
- min_gain 0.05, promote needs no regressions: PL/solution/promotion.py:13, 25
- scanner threshold defaults to 3, 0 is an error: PS/solution/cli.rs:81-83

## Isolation boundaries (comparison, 3 rows)
- Restricted subprocess row: L26/d:243
- Container row: L26/d:244
- MicroVM row: L26/d:247

## Six eval layers (concepts, 7 bullets)
- Structure, lint facts without a model, E_* blocks, W_* allowed: L27/d:99-121
- Routing, case types, precision and recall, raw counts: L27/d:125-148
- Behavior, baseline and treatment held constant: L27/d:170-177
- Scripts, tested outside model runs, minimum cases: L27/d:217-230
- Safety, record the control type: L27/d:253
- Portability, install into a clean destination and validate the installed copy: L27/d:259-265
- fixturePassed, localEvidenceReady, productionReady, passed follows productionReady: L27/d:390-394

## Project pipelines (architecture, 8 nodes, 6 edges)
- spans with byte offsets: PS/solution/stage1.rs:2-23
- scan with three named rules: PS/solution/stage2.rs:7-17
- risk_score once per rule and line: PS/solution/stage3.rs:9-11
- review gives review-required or below-threshold: PS/solution/stage4.rs:15-23
- split_cases with content and group union: PL/solution/dataset.py:13, 24-50
- evaluate with per-case rows: PL/solution/skill.py:20-31
- propose from development errors with min_support 2: PL/solution/propose.py:13, 29-39
- gate on gain and regressions: PL/solution/promotion.py:13-25

## Tasks in code (task-table, 8 rows)
- lint_package(root): L27/c:157
- classification_metrics(expected, predicted): L27/c:322
- verify_manifest(root, expected): L27/c:533
- portability_matrix(requirements, hosts): L27/c:595
- split_cases(cases, holdout_fraction=0.25): PL/solution/dataset.py:13
- propose(development, rules, min_support=2): PL/solution/propose.py:13
- gate(holdout, baseline, candidate): PL/solution/promotion.py:13
- register(skill, dedup=True) bumps the version: L10/c:29-39

## Questions (qa, 5 bullets)
- allowed-tools affects capability or permission prompting, not OS isolation: L26/d:68
- a hash proves bytes match a manifest, not that they are safe: L26/d:113
- below-threshold does not mean safe: PS/README.md:38
- a parent pinned to v1 does not pick up v3: L10/d:88
- repeated tuning on the same holdout leaks information: PL/stages/04-promotion/docs/en.md:5
