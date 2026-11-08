---
id: skill-trust-evals
title: Skill Permissions, Evals and Supply Chain
code: SE
subtitle: Review skill actions before they run, isolate them, gate each release by eval layer and scan bundles.
hue: 340
sources: phases/13-tools-and-protocols/26-skill-permissions-sandboxes-and-trust, phases/13-tools-and-protocols/27-skill-evals-packaging-and-portability, phases/14-agent-engineering/10-skill-libraries-voyager, projects/skill-scanner, projects/self-improving-skill-loop
source_hash: f18344df1d141366
---

## Symptoms, causes and fixes
type: troubleshooting
from: phases/13-tools-and-protocols/26-skill-permissions-sandboxes-and-trust/docs/en.md, phases/13-tools-and-protocols/26-skill-permissions-sandboxes-and-trust/code/main.py, phases/13-tools-and-protocols/27-skill-evals-packaging-and-portability/docs/en.md, phases/13-tools-and-protocols/27-skill-evals-packaging-and-portability/code/main.py, projects/self-improving-skill-loop/README.md, projects/self-improving-skill-loop/solution/dataset.py

| Symptom | Cause | Fix |
|---|---|---|
| `deny` with rule `workspace-jail` | The target resolves outside the root | Keep targets under `workspace_root` |
| `command-review` deny with `approved=True` | `rm` is in `DESTRUCTIVE_EXECUTABLES` | Approval cannot override it. Use a narrow tool |
| `network-allowlist` deny on port 8443 | Port 8443 is a different origin | Add that origin with its port |
| `approval-gate` on an allowlisted URL | `influenced_by_untrusted_content` is true | Show the target and consequence. Get approval |
| `secret-review` deny | The payload matches `SECRET_PATTERNS` | Inject the credential into one narrow tool |
| Lint issue `orphan-file` | `SKILL.md` does not reference the file | Reference the file or remove it |
| `fixture_passed` true, `passed` false | No trusted external attestation | Pass `--attestation` and `--trusted-attestation-sha256` |
| Audit `usable` is false | Same content or group in both partitions | Union by content and group before the split |

## review_action check order
type: flow
from: phases/13-tools-and-protocols/26-skill-permissions-sandboxes-and-trust/code/main.py

1. **policy-change**: always `deny` with rule `authority-boundary`.
2. **Kind**: a kind outside `allowed_kinds` gives a `kind-allowlist` deny.
3. **Path**: read, write and delete resolve through `normalize_workspace_path`. An escape gives `workspace-jail`.
4. **Command**: `inspect_command` checks the bare name, destructive set, metacharacters and argv prefix.
5. **Network**: `normalize_https_origin` adds the effective port. The origin must be in the allowlist.
6. **Secrets**: a `contains_secret` match gives `deny`, or `require-approval` with `permit_secret_use_after_approval`.
7. **Approval**: `approval_kinds` and untrusted influence need `approved`. Else rule `approval-gate`.
8. **Allow**: rule `policy-allow`. The field `executed` stays false.

## Review one action
type: annotated-code
lang: python
from: phases/13-tools-and-protocols/26-skill-permissions-sandboxes-and-trust/code/main.py, phases/13-tools-and-protocols/26-skill-permissions-sandboxes-and-trust/docs/en.md

```python
policy = SandboxPolicy(
    workspace_root=workspace,                            # resolved with strict=True
    allowed_kinds=("read", "write", "delete", "command", "network"),
    command_allowlist=(("python3", "-m", "unittest"),),  # argv prefixes
    network_allowlist=("https://docs.example.test",),    # origins only
)
request = ActionRequest("write", target="summary.json")  # write is in approval_kinds
review_action(policy, request).to_dict()["verdict"]      # "require-approval"
request = ActionRequest("write", target="summary.json", approved=True)
review_action(policy, request).rule                      # "policy-allow"
normalize_https_origin("https://api.example.test")       # adds ":443"
```

## Run the labs and tools
type: command-table
span: 2
from: phases/13-tools-and-protocols/26-skill-permissions-sandboxes-and-trust/docs/en.md, phases/13-tools-and-protocols/26-skill-permissions-sandboxes-and-trust/outputs/skill-safety-reviewer/SKILL.md, phases/13-tools-and-protocols/27-skill-evals-packaging-and-portability/docs/en.md, projects/skill-scanner/README.md, projects/self-improving-skill-loop/README.md

| Command | What it does |
|---|---|
| `python3 code/main.py` | Prints the demo decisions. It starts no process |
| `python3 -m unittest discover -s code/tests -v` | Runs the lesson tests |
| `python3 scripts/review_action.py --policy <policy> --request <request>` | Returns the verdict and the rule for one request |
| `evaluate_skill.py --fixture-demo <bundle>` | Fixture run. `fixturePassed` true, `productionReady` false |
| `scanner examples/reviewable 3` | Scans a bundle with threshold 3. Prints JSON |
| `cli.py <cases> --out experiment.json` | Proposes rules and runs the gate. It does not promote |
| `python3 scripts/project_test.py <project> --all --solution --strict` | Checks every stage of the reference solution |

## Run the isolation drill
type: annotated-code
lang: bash
from: phases/13-tools-and-protocols/26-skill-permissions-sandboxes-and-trust/docs/en.md

```bash
docker build -f code/sandbox/Containerfile -t aiefs-skill-sandbox code/sandbox
docker run --rm --network none --read-only --cap-drop ALL \
  --security-opt no-new-privileges --pids-limit 64 --memory 128m --cpus 0.5 \
  --tmpfs /tmp:rw,noexec,nosuid,size=16m \
  --mount type=bind,src="${PWD}/code/sandbox/input",dst=/input,readonly \
  --env DEMO_VALUE=bounded aiefs-skill-sandbox
# expect: /input readable, image read-only, network fails
```

## Defaults and limits
type: defaults
from: phases/13-tools-and-protocols/26-skill-permissions-sandboxes-and-trust/code/main.py, phases/13-tools-and-protocols/27-skill-evals-packaging-and-portability/code/main.py, projects/self-improving-skill-loop/solution/promotion.py, projects/skill-scanner/solution/cli.rs

| Setting | Default | Note |
|---|---|---|
| `allowed_kinds` | `("read",)` | `SandboxPolicy` allows reads only |
| `approval_kinds` | `("write", "delete", "network")` | These kinds need `approved` |
| `MAX_SKILL_BODY_CHARS` | 10_000 | Lint issue `body-size` above it |
| `MAX_COMPANION_FILE_BYTES` | 1_000_000 | Lint issue `file-size` above it |
| `min_precision`, `min_recall` | 0.8 | `ReleaseThresholds` in the lab |
| `min_repeat_rate` | 0.9 | Lowest per-case pass rate |
| `min_gain` | 0.05 | The loop gate also needs zero regressions |
| Scanner threshold | 3 | A threshold of 0 is an error |

## Isolation boundaries
type: comparison
from: phases/13-tools-and-protocols/26-skill-permissions-sandboxes-and-trust/docs/en.md

| Factor | Restricted subprocess | Container | MicroVM |
|---|---|---|---|
| Isolates | Environment, cwd, timeout, output | Filesystem and process namespaces | Separate guest kernel |
| Does not isolate | Kernel, host filesystem, network | Shared kernel, host mounts | Bad mounts, credentials, egress |
| Typical use | Reviewed local utilities | Repository builds and tests | Untrusted code, high impact |

## Six eval layers
type: concepts
from: phases/13-tools-and-protocols/27-skill-evals-packaging-and-portability/docs/en.md

- **Structure**: lint without a model. CI blocks `E_*` errors and allows reviewed `W_*` warnings.
- **Routing**: precision and recall over positives, clear negatives and near misses. Report raw counts.
- **Behavior**: baseline and treatment use the same model, tools, task and budget.
- **Scripts**: test outside model runs with empty, malformed and repeated input.
- **Safety**: record the control: instruction only, tool policy, approval, sandbox or verification.
- **Portability**: install into a clean destination. Validate the installed copy.
- **Verdicts**: `fixturePassed`, `localEvidenceReady`, `productionReady`. `passed` follows `productionReady`.

## Project pipelines
type: architecture
from: projects/skill-scanner/solution, projects/self-improving-skill-loop/solution

```arch
node | spans | 1,1 | spans | UTF-8 byte offsets | process
node | scan | 2,1 | scan | three named rules | process
node | score | 3,1 | risk_score | once per rule and line | process
node | review | 4,1 | review | review-required or below-threshold | client
node | split | 1,2 | split_cases | content and group union | store
node | eval | 2,2 | evaluate | per-case rows | process
node | prop | 3,2 | propose | dev errors, min_support 2 | process
node | gate | 4,2 | gate | gain and regressions | client
edge | spans | scan | lines
edge | scan | score | findings
edge | score | review | score
edge | split | eval | development
edge | eval | prop | errors
edge | prop | gate | candidate
```

## Tasks in code
type: task-table
span: 2
from: phases/13-tools-and-protocols/27-skill-evals-packaging-and-portability/code/main.py, phases/14-agent-engineering/10-skill-libraries-voyager/code/main.py, projects/self-improving-skill-loop/solution

| Task | Code |
|---|---|
| Lint a bundle | `lint_package(root)` |
| Score routing | `classification_metrics(expected, predicted)` |
| Check an installed copy | `verify_manifest(root, expected)` |
| Host support matrix | `portability_matrix(requirements, hosts)` |
| Split without leakage | `split_cases(cases, holdout_fraction=0.25)` |
| Propose rules | `propose(development, rules, min_support=2)` |
| Gate a candidate | `gate(holdout, baseline, candidate)` |
| Refine a library skill | `register(skill, dedup=True)` bumps the version |

## Questions
type: qa
span: 2
from: phases/13-tools-and-protocols/26-skill-permissions-sandboxes-and-trust/docs/en.md, projects/skill-scanner/README.md, phases/14-agent-engineering/10-skill-libraries-voyager/docs/en.md, projects/self-improving-skill-loop/stages/04-promotion/docs/en.md

- **Does `allowed-tools` sandbox a skill?** No. It affects capability or permission prompts. It is not OS isolation.
- **Does a hash prove a package is safe?** No. It proves that the bytes match a manifest.
- **Is a below-threshold scan safe?** No. Only these rules did not cross the threshold.
- **Why version skills?** A parent pinned to v1 does not pick up a refined v3.
- **Why rotate the holdout?** Repeated tuning on the same holdout leaks information.
