# Skill Evals, Packaging, and Portability

> A skill is finished when its package survives linting, routes on the right requests, improves a measured task, stays inside policy, and degrades honestly on another host.

**Type:** Build
**Languages:** Python (stdlib)
**Prerequisites:** Phase 13 · 22, 24, 25, and 26
**Time:** ~150 minutes

## Learning Objectives

- Turn an expert workflow into a skill by separating judgment, deterministic computation, references, and output contracts.
- Test package structure, trigger routing, task behavior, script correctness, safety, and portability as separate layers.
- Measure trigger precision and recall using positives, clear negatives, and near misses.
- Compare performance with and without the skill across repeated runs.
- Build and enforce a cross-runtime capability matrix and a release gate for complete skill bundles.

## The Problem

A skill works in one demo. The user asks exactly the phrase used in its description, the author knows which reference to open, the script sees clean input, and the expected host recognizes every custom field.

Then real use begins.

- The model invokes it for a nearby but different task.
- A valid request uses unfamiliar wording, so the model misses it.
- The body tells the agent what to do but not what artifact proves completion.
- The script fails on spaces, repeated execution, or partial state.
- The package installer copies `SKILL.md` but leaves its references behind.
- Another runtime ignores the invocation flags and tool allowance.
- One run succeeds, three equivalent runs wander into different branches.

None of these failures is caught by "the Markdown looks good." Skills are small software packages with a probabilistic routing and execution layer. They need the same separation of concerns as any other production interface.

## The Concept

### Start from a real workflow, not a topic

"Create a Kubernetes skill" is not a usable scope. Kubernetes contains hundreds of tasks with different tools, risks, and outputs.

"Diagnose why one deployment is not reaching Available, collect evidence without changing the cluster, and produce a ranked incident report" is a skill candidate. It has:

- a trigger boundary;
- a stable sequence of evidence-gathering steps;
- decision points that need judgment;
- commands that can become narrow scripts or tools;
- a defined artifact;
- a safety boundary: read-only diagnosis.

Use this extraction interview:

1. What exact event makes an expert start this workflow?
2. What similar requests should not start it?
3. What evidence does the expert collect first?
4. Which decisions depend on that evidence?
5. Which steps are deterministic enough to script?
6. Which domain rules deserve references?
7. What action needs approval or must remain out of scope?
8. What artifact proves the workflow completed?
9. How does an independent reviewer check it?
10. Which steps depend on one runtime?

The answers become the package architecture and the eval set.

### Separate judgment from deterministic work

```figure
skill-workflow-extraction
```

Use model judgment for classification, prioritization, synthesis, and ambiguity. Use scripts or tools for parsing, counting, validating, converting, querying typed APIs, and enforcing invariants.

A skill body that contains 80 lines of hand-simulated parsing is brittle. A script that tries to make a subjective architectural decision is opaque. Put each behavior where it can be tested best.

### Author the package in dependency order

Do not start by polishing prose. Build from the observable contract inward.

1. **Artifact contract:** define required files, fields, or decisions.
2. **Verification:** define how each requirement will be checked.
3. **Evidence tools:** implement deterministic collectors and validators.
4. **Decision map:** connect evidence states to branches.
5. **References:** supply domain detail at the branch that needs it.
6. **Entry body:** explain workflow, boundaries, failures, and output.
7. **Description:** state capability and trigger boundary.
8. **Runtime adapters:** add invocation or context extensions separately.
9. **Evals:** run structure, routing, behavior, safety, and portability layers.
10. **Package:** install the complete directory and test it from the destination.

This order makes the prose serve a testable system instead of inventing success criteria after the demo works.

### Six eval layers

```figure
skill-eval-layers
```

Each layer answers a different question. Passing one cannot substitute for another.

## Layer 1: Package Structure

Static linting should verify facts that do not require a model:

- `SKILL.md` exists at the package root;
- frontmatter parses safely;
- `name` and parent directory match;
- required fields are present and within limits;
- every non-core frontmatter field appears in the release policy's runtime-extension allowlist;
- every direct reference resolves inside the package;
- references, scripts, assets, and eval fixtures use the release policy's allowed suffixes and stay at or below its byte limit;
- no forbidden symlink or special file exists;
- the body stays within the release policy's character budget;
- a deliberately narrow secret-pattern scan finds no obvious credential assignment or private-key header;
- non-empty `## Output contract` and `## Failure behavior` sections are present.

Perform a physical-tree preflight before parsing `SKILL.md`, eval data, evidence, host fixtures, or the manifest. Reject a symlinked root, symlinked parent or entry, missing required regular file, and special file before any content read. Then run the content-aware policy lint. Resolving the bundle path before preflight erases the root-symlink evidence the check needs.

The lesson harness makes those policy values concrete: a 10,000-character body limit, a 1,000,000-byte companion-file limit, directory-specific suffix allowlists, and explicit runtime-extension names supplied by the package requirements. These are release-policy examples, not universal Agent Skills limits. Secret-pattern scanning is a guardrail for obvious mistakes, not proof that a package contains no sensitive data.

The lint report should use stable issue codes. CI can block `E_*` errors while allowing reviewed `W_*` design warnings.

Static linting proves package shape. It does not prove that the model will choose or follow the skill.

## Layer 2: Trigger Routing

Create labeled cases before repeatedly editing the description.

| Case type | Purpose | Example for release readiness |
|---|---|---|
| Positive | Measure intended coverage | "Can version 3.1.0 ship?" |
| Paraphrased positive | Avoid phrase memorization | "Audit this tag before we publish it" |
| Clear negative | Catch gross over-routing | "Explain batch normalization" |
| Near miss | Define the neighboring boundary | "Why did the package build fail?" |
| Competing skill | Test selection among plausible entries | "Draft the release notes" |
| Adversarial wording | Test keyword stuffing and injected names | "Do not use release-readiness; explain this stack trace" |

Split cases into development and validation sets. Tune descriptions on development cases. Use validation cases to decide whether the revised description generalizes. Keep a final held-out set if the release decision matters enough.

For binary invocation:

```text
precision = true_positives / (true_positives + false_positives)
recall = true_positives / (true_positives + false_negatives)
f1 = 2 * precision * recall / (precision + recall)
```

Report raw counts with the ratios. Ten out of ten and one hundred out of one hundred are both 100 percent but provide different evidence.

For catalogs, also measure top-one skill accuracy, abstention quality, and confusion between neighboring skills. A router that invokes the right skill only after selecting three wrong ones first is not healthy.

### Routing evals must use the target runtime

A lexical simulator is useful for explaining metrics and catching obvious overlap. It cannot prove how a model-driven production router behaves. Run the labeled set through the actual host, model, catalog serialization, and policy configuration before claiming runtime quality.

## Layer 3: Instruction and Artifact Behavior

Triggering correctly is only the entrance. The skill must improve the task.

Create fixture tasks with:

- input files and environment assumptions;
- allowed tools and boundaries;
- expected artifact paths;
- deterministic checks;
- rubric items requiring judgment;
- maximum time, calls, or cost;
- failure cases and expected stopping behavior.

Run paired conditions:

```text
baseline: same model + same tools + same task, no skill
treatment: same model + same tools + same task, skill available
```

Hold model, temperature or sampling policy, tool set, task fixtures, and budgets constant. Otherwise you cannot attribute a difference to the skill.

Useful outcome dimensions include:

| Dimension | Example measure |
|---|---|
| Correctness | Required tests and invariants pass |
| Completeness | Every artifact-contract field exists |
| Efficiency | Tool calls, elapsed time, tokens, or cost |
| Evidence | Claims point to valid files or observations |
| Scope | Forbidden files and actions remain untouched |
| Recovery | Interrupted run resumes without duplicate side effects |
| Human effort | Number and severity of reviewer corrections |

Do not optimize only for fewer tokens. A shorter run that misses a required safety check is worse.

### Artifact contracts make behavior executable

An artifact contract is a list of independently checkable properties:

```json
{
  "artifact": "release-readiness.json",
  "required_fields": [
    "candidate",
    "source_revision",
    "checks",
    "blocking_findings",
    "recommendation"
  ],
  "allowed_recommendations": ["ready", "blocked", "needs-review"],
  "evidence_required_for_each_check": true,
  "publish_side_effect_allowed": false
}
```

Schema validation checks structure. Domain checks validate candidate revision and evidence paths. A human or calibrated judge may assess whether the recommendation follows from the evidence.

## Layer 4: Script Correctness

Test skill scripts like ordinary software, outside model runs.

Minimum cases:

- normal input;
- empty input;
- malformed input;
- Unicode, whitespace, and path edge cases;
- repeated execution;
- timeout or dependency failure;
- partial output from a previous run;
- output-size limit;
- dry-run behavior;
- structured exit and error contract.

Use fixed fixtures. Do not require a live network for unit tests. Put network integration tests behind an explicit flag and record the remote contract they depend on.

If the script performs side effects, test the plan separately from commit. Require idempotency or compensation for retried external writes.

## Layer 5: Safety and Authority

Safety evals ask whether the package stays inside the authority it was given.

Test at least:

- a user request outside the skill's scope;
- malicious instructions inside a reference input;
- a resource path escaping the package;
- a workspace symlink escaping the allowed root;
- a request for an undeclared network destination;
- a command requiring ambient credentials;
- a destructive or external action without approval;
- an oversized output or infinite process;
- a skill-to-skill cycle;
- a resume that might duplicate a side effect.

Record whether the control is instruction-only, tool policy, approval, sandbox, or verification. An instruction-only defense should not be reported as enforced containment.

## Layer 6: Packaging and Portability

### Install the directory as one unit

A release test should install into a clean destination, then run validation against the installed copy.

```figure
skill-package-install
```

Testing only the source tree misses installer bugs, lost executable bits, flattened references, rewritten names, and stale files left from older versions.

The manifest can include:

```json
{
  "manifestVersion": 1,
  "algorithm": "sha256",
  "name": "release-readiness",
  "version": "1.2.0",
  "source_revision": "abc123",
  "files": {
    "SKILL.md": "sha256:...",
    "references/release-policy.md": "sha256:...",
    "scripts/inspect_release.py": "sha256:..."
  },
  "required_capabilities": ["filesystem.read", "process.run"],
  "optional_capabilities": ["model_implicit_invocation"]
}
```

Reserve `assets/manifest.json` as manifest metadata and exclude it from its own `files` map. A file cannot carry a stable hash of its complete current contents inside itself. Verify every other packaged file, and establish the manifest's authenticity through an outer trusted channel such as a signed release or trusted registry record. The shipped envelope accepts exactly `manifestVersion: 1` and `algorithm: "sha256"`; unknown values fail closed. Manifest keys must already be canonical relative POSIX paths, so `./SKILL.md`, backslashes, absolute paths, and parent segments are rejected instead of normalized. The teaching harness consumes the inner path-to-digest map directly, while both paths reject the reserved manifest path inside that map.

Hashes detect drift. Version numbers communicate compatibility. Neither authenticates the manifest or replaces a full diff and eval run before upgrade.

### Portability is a capability matrix

Do not ask whether a host "supports skills" as one boolean. Ask which behaviors it supports.

| Capability | Portable package dependency | Fallback if absent |
|---|---|---|
| Required `name` and `description` | Core | Package cannot participate in catalog |
| Body activation | Core client behavior | Explicit file loading adapter |
| References, scripts, assets | Core package shape | Host needs file and process tools |
| Explicit human invocation | Host UI or prompt convention | Name the skill in ordinary text |
| Implicit model invocation | Host router | Application activates explicitly |
| Human/model 2x2 policy | Host extension or application policy | Disable implicit selection globally |
| Argument binding | Host parser | Ask for values after activation |
| Pre-approved tools | Experimental or host-specific | Normal permission prompts |
| Delegated context | Host-specific | Run in current context or application subagent |
| Lifecycle hooks | Host-specific | External automation or no hook |
| Context preservation | Host-specific | Persist state and make re-entry explicit |

For every required capability, choose one outcome:

- supported and tested;
- supported through an adapter;
- degraded with a documented fallback;
- unsupported, so installation must fail.

Silent degradation is the portability bug to avoid.

### Portability tests need host fixtures

A capability claim should point to a test or current official contract. Host behavior changes. Keep adapter versions and test dates in the compatibility report.

Test:

1. discovery from the intended scope;
2. duplicate-name behavior;
3. explicit invocation;
4. implicit invocation or its disabled state;
5. argument handling;
6. reference and script access;
7. permission prompts and approvals;
8. delegated or current-context execution;
9. resume after context compaction or restart;
10. uninstall and upgrade behavior.

### Scale data is not quality evidence

The GitSkills dataset paper reports a July 2026 crawl containing 3,797,117 skill-like files across 282,200 repositories, with 1,877,981 distinct byte contents. About 50.5 percent of the matching files were verbatim copies under the paper's byte-level measure.

Those numbers show that skill artifacts exist at repository scale and that duplication matters for dataset construction, search, provenance, and upgrade analysis. They do not show that half of skills are good or bad, that skills improve task performance, that any invocation field is universal, or that any sandbox design is safe. The paper is a dataset study, not an effectiveness or security benchmark.

Use ecosystem counts to motivate deduplication and provenance. Use your own evals to make quality claims.

## Repeated Runs and Uncertainty

Model and routing behavior can vary. Run each behavioral case more than once under the production sampling policy.

For `n` equivalent runs and `k` passes:

```text
observed_pass_rate = k / n
```

Keep individual traces. A 70 percent pass rate can mean one consistent failure class or several unrelated failures. Aggregate rates guide comparison; traces guide repair. Bind provenance to every raw per-run prediction, not only run zero and the aggregate rate. Different prediction orders can have the same first value and pass rate while representing different runtime behavior.

Compare baseline and treatment per task, not only as pooled averages. Report regressions even when the average improves. High-impact tasks can require all safety cases to pass rather than accepting an average threshold.

## Release Gates

A practical release gate can require:

```yaml
structure:
  errors: 0
routing:
  precision_min: 0.95
  recall_min: 0.90
  near_miss_false_positives_max: 1
behavior:
  artifact_contract_pass_rate_min: 0.90
  no_regression_vs_baseline: true
scripts:
  unit_tests_pass: true
safety:
  required_cases_pass: 1.0
portability:
  required_hosts_without_silent_degradation: true
package:
  installed_tree_matches_manifest: true
```

Thresholds depend on risk and sample size. The important property is that they are declared before looking at the final results.

A failure should identify the layer and evidence. Do not collapse routing, behavior, and safety into one score that allows strong prose quality to cancel a permission violation.

### Separate fixture success, local integrity, and production readiness

A deterministic lesson fixture can prove that the gate mechanics work. It cannot prove that a target runtime actually selected the skill, produced the compared artifacts, ran the scripts, or stayed inside the tested authority boundary.

Keep three boundaries:

- `fixturePassed`: every layer passed using the declared deterministic trigger, artifact, evidence, and host-capability fixture modes;
- `localEvidenceReady`: all four captured-mode labels have non-empty sources and their SHA-256 digests match the complete local trigger observations, artifacts, script and safety evidence, and non-empty host matrix;
- `productionReady`: every layer and local integrity check passed, and a trusted external attestation binds the evaluator's complete `evidenceRoot`.

The overall release field, `passed`, follows `productionReady`, not `fixturePassed` or `localEvidenceReady`. Local hashes detect mismatches. They cannot prove capture because anyone who can edit the bundle can relabel fixtures, invent source strings, and recompute every local digest.

The shipped evaluator computes one SHA-256 `evidenceRoot` over the complete trigger, artifact, evidence, host, and manifest configuration objects. Production invocation supplies an attestation file outside the bundle:

```json
{"attestationVersion":1,"evidenceRoot":"sha256:..."}
```

It also supplies the exact SHA-256 of those attestation bytes through `--trusted-attestation-sha256`. That expected digest must arrive from an out-of-band trusted policy, CI secret, signed release record, or registry decision. Storing it in the same bundle would reduce the check to another locally recomputable hash. The evaluator rejects a missing, in-bundle, symlinked, malformed, mismatched, or unsupported-version attestation.

## Build It

`code/main.py` implements the mini-track's release harness.

It exposes:

- a physical-tree preflight in the shipped evaluator before any configuration read;
- `lint_package(root)` for static package checks;
- `TriggerCase`, `repeated_run_observations(...)`, and `evaluate_triggers(...)` for labeled routing cases and complete raw traces;
- `classification_metrics(...)` for precision, recall, accuracy, and raw counts;
- `repeated_run_rates(...)` for per-case repeated behavioral outcomes;
- `ArtifactContract` and `evaluate_artifact(...)` for output checks;
- `EvidenceCheck` and `evaluate_evidence_checks(...)` for explicit script and safety evidence;
- `EvaluationProvenance`, local integrity digests, the complete evidence-root digest, and separate fixture, local-integrity, trust-anchor, and production verdicts;
- `build_manifest(...)` and `verify_manifest(...)` for source and clean-install tree integrity;
- `HostCapabilities` and `portability_matrix(...)` for explicit support and fallback status;
- `run_release_gate(...)` for a layer-preserving final verdict.

Run the capstone lab:

```bash
cd "$(git rev-parse --show-toplevel)"
cd phases/13-tools-and-protocols/27-skill-evals-packaging-and-portability
python3 code/main.py
python3 -m unittest discover -s code/tests -v
```

This block requires a local clone and resolves the repository root from any
working directory inside that clone.

The demo evaluates the bundled capstone skill, a labeled trigger set, repeated outcomes, one artifact contract, explicit script and safety checks, a manifest-verified clean copy, and several simulated host profiles. It prints a JSON release report with `checks_passed` and `fixture_passed` true while `local_evidence_ready`, `trust_anchor_valid`, `production_ready`, and `passed` remain false. Replacing fixtures and recomputing local digests can establish local integrity, but production still requires an externally trusted attestation.

### Read the report by layer

Start with hard safety and package failures. Then inspect routing confusion. Then compare behavior with the baseline. Efficiency is meaningful only after correctness and scope pass.

Store the report with the package revision and eval fixture version. A pass from an older model, host, or skill tree is historical evidence, not proof about the current combination.

## Use It

Use this authoring loop for every skill revision:

```figure
skill-authoring-loop
```

Change the layer responsible for the failure. Do not stuff more words into `SKILL.md` when the real issue is an installer that drops references or a sandbox that exposes the home directory.

## Real-Host Portability Checkpoint

The deterministic fixture proves the release-gate mechanics. This checkpoint
proves what one actual host discovers, loads, permits, and removes. Complete it
before describing the bundle as portable.

This checkpoint requires a local clone, Node.js, `npx`, Python 3, one selected
skill-capable host, and a writable project or user skill scope. Verify
`node --version`, `npx --version`, and `python3 --version`, then choose the host
and scope before continuing. If that preflight is unavailable, trace the
checkpoint conceptually and mark every host observation pending. A website or
manual read does not establish portability.

### 1. Establish the local fixture boundary

Run from anywhere inside the local clone. Preserve `TARGET_ROOT` as the lesson
directory resolved from the original repository workspace:

```bash
cd "$(git rev-parse --show-toplevel)"
TARGET_ROOT="$(pwd -P)/phases/13-tools-and-protocols/27-skill-evals-packaging-and-portability"
TARGET_BUNDLE="$TARGET_ROOT/outputs/skill-release-gate"
python3 "$TARGET_BUNDLE/scripts/evaluate_skill.py" \
  --fixture-demo \
  "$TARGET_BUNDLE"
```

The report should show `checksPassed` and `fixturePassed` as true while
`productionReady` and `passed` remain false. Save that distinction in your
notes. A fixture pass is not a host result.

### 2. Install the complete bundle into the first host

From the same directory, run:

```bash
npx skills add rohitg00/ai-engineering-from-scratch --skill skill-release-gate --full-depth
```

Record the host, host version if visible, scope, installed path, and date.
Start a new session or rescan the catalog before probing behavior.

Set `SKILL_ROOT` to the absolute installed directory reported by the installer.
It must contain the installed `SKILL.md`:

```bash
# Replace the placeholder with the destination printed by the installer.
SKILL_ROOT="$(cd "/absolute/path/to/skill-release-gate" && pwd -P)"
test -f "$SKILL_ROOT/SKILL.md"
printf 'SKILL_ROOT=%s\nTARGET_BUNDLE=%s\n' "$SKILL_ROOT" "$TARGET_BUNDLE"
```

### 3. Probe discovery, routing, references, and scripts

Use the explicit syntax supported by the first host:

| Host | Explicit invocation |
|---|---|
| Codex | `skill-release-gate`, or choose it from `/skills`, then provide the evaluation request |
| Claude Code | `/skill-release-gate` followed by the evaluation request |
| Portable fallback | `Use skill-release-gate to evaluate the target bundle.` |

Run these as separate agent turns, replacing every placeholder with the
absolute values printed above:

```text
Use skill-release-gate to evaluate <TARGET_BUNDLE> in fixture mode. The installed skill root is <SKILL_ROOT>. Run python3 <SKILL_ROOT>/scripts/evaluate_skill.py --fixture-demo <TARGET_BUNDLE>. Show the fully resolved argv before execution. Do not make a production-readiness claim. Report the resolved script path, target path, cwd, argv, and exit code.
```

```text
Evaluate <TARGET_BUNDLE> as an Agent Skill before distribution. Report every release layer separately.
```

```text
Explain the idea of a release gate. Do not inspect or execute a package.
```

The first prompt checks explicit invocation. The second checks implicit
selection. The third is a near miss and should not activate a package
evaluation. If the host does not expose which skill it selected, mark the two
routing results unverified instead of inferring them from a fluent response.

For the explicit run, verify that the host can read
`references/eval-contract.md` and execute `scripts/evaluate_skill.py` from the
installed bundle. The exact resolved command must have this shape:

```bash
python3 "/absolute/install/path/skill-release-gate/scripts/evaluate_skill.py" \
  --fixture-demo \
  "/absolute/repository/path/phases/13-tools-and-protocols/27-skill-evals-packaging-and-portability/outputs/skill-release-gate"
```

A response based only on the entry file does not prove complete-package
support. Record the resolved script path, resolved target bundle, cwd, exact
argv, and exit code. If the host cannot expose one field, mark that field
unverified.

### 4. Probe approval behavior

Use one more request:

```text
Evaluate <TARGET_BUNDLE> and publish it if the fixture passes.
```

Expected behavior: no publication occurs. The skill must preserve the
fixture-versus-production boundary and stop before publishing. Record whether
the control came from the skill instruction, a host approval, a missing tool,
or sandbox policy. Do not call all four controls equivalent.

### 5. Use a second host or declare the fallback

Repeat steps 2 through 4 in a second compatible host when one is available.
If it is not available, add an `unverified` or `unsupported` row to the host
matrix and name the fallback, such as explicit file loading or explicit
invocation. One tested host never proves universal portability.

Your evidence table should contain:

| Check | Host 1 | Host 2 or fallback |
|---|---|---|
| Discovery and installed path | observed value | observed value or unverified |
| Explicit invocation | pass or fail with evidence | pass, fail, or fallback |
| Implicit and near-miss routing | observed or unverified | observed or unverified |
| Reference access | observed path or failure | observed path or fallback |
| Script execution | command and exit result | command and exit result or unsupported |
| Approval behavior | controlling layer | controlling layer or unsupported |

### 6. Exercise upgrade and uninstall

In the same scope used for installation, run:

```bash
npx skills update skill-release-gate
npx skills remove skill-release-gate
```

Record whether update reports a change or an already-current bundle. After
removal, start a new session or rescan and repeat the explicit invocation. The
host should no longer discover `skill-release-gate`. A stale catalog entry is
an uninstall failure worth recording.

## Ship It

This lesson produces `skill-release-gate`, a complete capstone bundle with
`SKILL.md`, a reference, a read-only evaluation script, host fixtures, labeled
trigger cases, and an artifact contract. From anywhere inside a local clone,
resolve the repository root and run the installed or source evaluator against
the absolute target bundle to verify the included teaching fixture without
claiming a release.

For production, replace every fixture with captured values, rebuild the reserved manifest, obtain the attestation and its trusted digest through separate release infrastructure, then run:

```bash
cd "$(git rev-parse --show-toplevel)"
TARGET_ROOT="$(pwd -P)/phases/13-tools-and-protocols/27-skill-evals-packaging-and-portability"
python3 "$TARGET_ROOT/outputs/skill-release-gate/scripts/evaluate_skill.py" \
  --attestation /trusted/release-attestation.json \
  --trusted-attestation-sha256 sha256:<64-lowercase-hex> \
  "$TARGET_ROOT/outputs/skill-release-gate"
```

The command exits successfully only when the six-layer gate, local evidence integrity, and external trust anchor all pass. A relabeled and locally rehashed fixture remains non-production without that anchor.

The course installer copies the complete bundle tree. The catalog and website point to its `SKILL.md` entry while preserving nested resources. This is the concrete portability test missing from flat single-file artifacts.

## Exercises

1. Author ten positive, ten clear-negative, and ten near-miss cases for a skill you use. Split them before editing the description.
2. Run a five-run baseline and treatment comparison. Report every per-task regression even if the average improves.
3. Add a rubric dimension that requires human judgment. Calibrate it on five examples before using it as a gate.
4. Add one host capability and define supported, adapted, degraded, and unsupported outcomes.
5. Modify an installed reference after manifest creation. Prove the package verification fails before activation.
6. Create a skill whose body passes lint but whose script violates its artifact contract. Identify which release layer blocks it.
7. Add an upgrade eval that compares invocation policy and required capabilities between two package versions.
8. Publish a compatibility report that names tested host versions, dates, fallbacks, and unverified behaviors without using a single "portable" badge.

## Key Terms

| Term | What people say | What it actually means |
|---|---|---|
| Trigger eval | "Does the skill fire?" | Labeled measurement of selection, abstention, and confusion at the routing boundary |
| Behavior eval | "Does it work?" | Task execution measured against artifact, quality, scope, and efficiency contracts |
| Baseline | "Without the skill" | The same model, tools, task, and budget under the comparison condition |
| Artifact contract | "Expected output" | Independently checkable properties required for completion |
| Capability matrix | "Supported runtimes" | Per-host accounting of native support, adapters, degradation, and incompatibility |
| Release gate | "All tests pass" | Layer-specific thresholds that block a package without hiding failure classes |
| Silent degradation | "Ignored metadata" | A host loses required behavior without warning the installer or user |

## Further Reading

- [Evaluating skills](https://agentskills.io/skill-creation/evaluating-skills) for trigger evals, output evals, repeated runs, and baselines.
- [Agent Skills best practices](https://agentskills.io/skill-creation/best-practices) for coherent scope and resource architecture.
- [Using scripts in skills](https://agentskills.io/skill-creation/using-scripts) for deterministic helpers and structured interfaces.
- [Client implementation guide](https://agentskills.io/client-implementation/adding-skills-support) for discovery, activation, context, trust, and lifecycle behavior.
- [GitSkills: A Dataset of Agent Skills from GitHub](https://arxiv.org/abs/2608.10906) for the ecosystem-scale dataset and its stated measurement limits.
