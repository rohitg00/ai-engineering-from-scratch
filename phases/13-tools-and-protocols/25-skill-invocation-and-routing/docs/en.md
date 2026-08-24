# Skill Invocation and Routing

> Invocation is an authority decision followed by a relevance decision. A good description helps the model choose; a good policy decides whether that choice is allowed.

**Type:** Build
**Languages:** Python (stdlib)
**Prerequisites:** Phase 13 · 24 (Skill Discovery and Progressive Disclosure)
**Time:** ~105 minutes

## Learning Objectives

- Distinguish explicit user invocation, implicit model invocation, application invocation, and skill-to-skill invocation.
- Model human visibility and model eligibility as independent policy dimensions.
- Write routing descriptions with positive triggers and near-miss boundaries.
- Separate eligibility, selection, activation, argument binding, and execution in traces and tests.
- Adapt runtime-specific invocation fields without presenting them as portable frontmatter.

## The Problem

You install a `database-migration` skill. The user can run it by name, but the model also sees its description and selects it when someone asks a general database question. The skill then proposes a schema change for a task that only needed an explanation.

You add `user-invocable: false`, expecting to block people from running it manually. In another runtime, that field is ignored. You add `disable-model-invocation: true`, expecting the skill to disappear entirely. In the runtime that understands it, the user can still invoke it explicitly.

Nothing is wrong with the field names. The model is wrong. "User can see it," "model can select it," "application can preload it," and "tools inside it can execute" are separate facts. A single boolean called `invocable` cannot express them.

Routing has a second failure mode. If descriptions are vague, several skills become plausible. If descriptions are stuffed with keywords, unrelated tasks trigger them. The catalog is a probabilistic interface: compact enough to fit, specific enough to route.

## The Concept

### Five channels can start the lifecycle

| Actor | Invocation shape | Typical use | Main risk |
|---|---|---|---|
| Human user | Names a skill in the UI or prompt | Deliberate workflow selection | User expects availability or authority the host does not grant |
| Model or autonomous agent | Selects a catalog entry from task context | Automatic expert procedure | False-positive routing |
| Application | Activates or preloads a skill through runtime code | Fixed product workflow | Hidden coupling to one host |
| Another skill or subagent | Requests an exact skill as a workflow dependency | Composition | Cycles, missing dependency, or context bleed |
| Evaluation harness | Activates an exact skill under a fixed scenario | Repeatable measurement | Tests the skill while accidentally bypassing the production policy under study |

The portable Agent Skills specification defines the package. It does not standardize one universal slash-command UI, implicit-routing flag, application API, or subagent lifecycle.

### The five invocation stages

```figure
skill-invocation-stages
```

Use these words precisely:

- **Eligible** means policy permits this actor to request the skill.
- **Selected** means the user named it or a router judged it relevant.
- **Activated** means its instructions entered the working context.
- **Executing** means the agent began model or tool work under those instructions.
- **Completed** means the output met an independent success check.

A trace that records only `skill_used=true` hides the boundary where a failure happened.

### Human and model invocation form a 2x2 matrix

| Human can invoke | Model can invoke | Mode | Suitable examples |
|:---:|:---:|---|---|
| Yes | Yes | Shared | Code explanation, test planning, documentation review |
| Yes | No | Human-only | Publish preparation, billing export, destructive cleanup plan |
| No | Yes | Model-only | Internal style guide, domain reference, automatic support procedure |
| No | No | Disabled or application-only | Staged rollout, deprecated package, programmatic preload |

The matrix is a policy model, not standard YAML.

One current host uses `disable-model-invocation: true` for the human-only row and `user-invocable: false` for the model-only row. The default is both. Another host uses `agents/openai.yaml` with `allow_implicit_invocation: false` to keep explicit invocation while disabling implicit selection. These are runtime adapters. Unknown hosts may ignore them.

The confusing detail matters: `user-invocable: false` does not mean "the model cannot use this." It removes direct user invocation in the host that defines it. `disable-model-invocation: true` does not mean "the skill is disabled." It removes model-initiated selection while keeping explicit user access.

### Explicit invocation is identity-first

An explicit invocation supplies identity directly:

```text
/release-readiness v2.4.0
```

or:

```text
release-readiness check v2.4.0 without publishing
```

Current Codex interfaces document `/skills` for selection and plain skill names in requests for explicit invocation. Claude Code documents `/skill-name` and host-specific argument expansion. The exact syntax, menu visibility, quoting rules, and variable expansion belong to the host.

An explicit request still passes policy. Naming a skill should not bypass missing permissions, workspace constraints, approval gates, or runtime isolation.

### Implicit invocation is description-first

For implicit routing, the model initially sees catalog metadata rather than the full body. The description is therefore the skill's routing interface.

Weak:

```yaml
description: Helps with releases.
```

Over-broad:

```yaml
description: Use for release, version, package, build, deploy, publish, tag, changelog, GitHub, CI, or software tasks.
```

Bounded:

```yaml
description: Inspect an already prepared release candidate and produce a readiness report. Use when the user asks whether a version, tag, package, or image is ready to publish; do not use for ordinary build failures or feature development.
```

The bounded version contains:

1. **Capability:** inspect a prepared candidate.
2. **Output:** readiness report.
3. **Positive boundary:** asks whether a release artifact is ready.
4. **Negative boundary:** ordinary builds and development are out of scope.

Negative boundaries are useful when two nearby skills share vocabulary. They are not a replacement for near-miss evals.

### Routing is classification with an abstain option

For a skill `s` and request `x`, imagine a router score:

```text
score(s, x) = capability_match + trigger_match + context_match - exclusion_match - ambiguity_penalty
```

The exact scoring may be an LLM decision rather than arithmetic. The engineering principle still holds: selection should beat a threshold and a competing skill. When evidence is weak, abstain.

```figure
skill-routing-abstention
```

For high-impact skills, implicit routing may be inappropriate even with a strong description. Use human-only policy when the cost of a false positive exceeds the convenience of automatic selection.

### Eligibility must precede ranking

Do not score every discovered skill, choose the strongest match, and check that one skill's policy afterward. A blocked top match would incorrectly prevent an eligible lower-scored candidate from being considered.

Use this order for implicit routing:

1. Filter discovered skills by the requesting actor and the active host adapter.
2. Score only the eligible candidates.
3. Select the strongest eligible match if it clears the threshold and ambiguity rules.
4. Abstain when no candidate is eligible or no eligible score is strong enough.

Suppose `incident-triage` scores `0.80` but its host extension disables model invocation. `incident-review` scores `0.55` and allows model invocation. The router should evaluate `incident-review` as the best eligible candidate. It should not choose `incident-triage`, deny it, and stop.

This ordering also keeps policy changes from altering the meaning of a relevance score. Eligibility defines the selection set. Relevance ranks that set.

### Routing evals need near misses

Positive cases prove recall:

```json
{"prompt":"Is version 2.4.0 ready to publish?","expected":"release-readiness"}
```

Clear negatives prove basic precision:

```json
{"prompt":"Explain rotary position embeddings.","expected":null}
```

Near misses expose boundary quality:

```json
{"prompt":"Why did today's package build fail?","expected":"build-diagnostics"}
```

The near miss shares `package` and `build` with the release skill but belongs elsewhere. A routing set made only of obvious positives and unrelated negatives will overstate quality.

### Arguments have three representations

An invocation argument crosses several boundaries:

```figure
skill-argument-boundaries
```

At each boundary, preserve intent without treating text as code.

- The host parser decides command syntax and quoting.
- The skill receives bound text or variables according to host rules.
- The instructions validate required values and defaults.
- A tool call converts values to a typed schema and revalidates them.

Do not interpolate raw arguments into shell commands. Prefer a script invoked with an argument vector or a typed MCP tool.

### Application invocation is explicit orchestration

A product can activate a skill because its workflow already knows the task type. For example, a pull-request review service can preload `pull-request-risk-review` after the user presses Review.

This removes routing uncertainty but creates a dependency on the runtime API. Keep that adapter outside the portable body:

```figure
skill-host-adapter
```

The skill should remain intelligible when opened by a different compliant client.

### Skill-to-skill invocation is a tool-like edge

Suppose `release-readiness` asks for `security-change-review` when dependency files changed.

The caller should provide:

- the target skill identity;
- a bounded task and artifact paths;
- the expected response contract;
- the reason for invocation;
- a fallback if unavailable;
- a maximum depth or cycle rule.

```json
{
  "target_skill": "security-change-review",
  "task": "Review dependency changes in the candidate diff",
  "inputs": ["artifacts/release.diff"],
  "expected": "risk-report.json",
  "max_depth": 2
}
```

The second skill is not pasted blindly into the first. The host decides how to activate it and whether it shares context, runs in a fork, or returns through a tool result.

### Context lifecycle is host-specific

After activation, the skill body may remain in the conversation, be summarized during compaction, or run in a delegated context. Tool allowances may last one turn while instructions persist longer. A subagent may receive the skill without the parent's entire history.

Do not write a skill that depends on an invisible lifetime assumption. Put durable outputs in files or typed state, make re-entry safe, and state what must be reloaded after interruption.

```markdown
On resume, read `artifacts/release-readiness.json` if it exists.
Revalidate the candidate commit before continuing.
Do not repeat an external write whose idempotency key is already recorded.
```

## Build It

`code/main.py` implements policy and routing as separate adapters.

The model includes:

- `Actor` for human, model, autonomous agent, application, skill, and harness callers;
- `SkillMetadata` for routing identity;
- `InvocationPolicy` for the human/model matrix;
- `InvocationRequest` and `InvocationDecision` for traceable inputs and outcomes;
- `CorePolicyAdapter` for portable behavior with no host extensions;
- `ExtensionPolicyAdapter` for recognized runtime fields;
- `build_invocation_matrix(policy)` for the 2x2 view;
- `route_request(skills, request, adapter)` for eligibility filtering before relevance ranking, selection, and denial.

Run it:

```bash
cd phases/13-tools-and-protocols/25-skill-invocation-and-routing
python3 code/main.py
python3 -m unittest discover -s code/tests -v
```

The demo prints one matrix and decisions for explicit human, implicit model, autonomous-agent, application, skill-composition, and harness channels. Its extension-adapter results show a blocked top lexical match being removed before an eligible alternative is ranked. It also includes exact-name allowlists. No model API is required. The deterministic router exists to make policy boundaries inspectable, not to claim that lexical matching reproduces production model routing.

### Why core and extension adapters are separate

If one parser assigns meaning to every observed frontmatter field, it silently promotes runtime conventions into a fake standard. Separate adapters force the caller to name which host semantics are active.

The `CorePolicyAdapter` uses only application-supplied policy. The `ExtensionPolicyAdapter` recognizes an explicit set of host fields and records which field changed the decision.

## Use It

Write an invocation contract before publishing a skill:

```yaml
actors:
  human: allow
  model: deny
  application: allow
  skill: deny
explicit_name: release-readiness
arguments:
  candidate: required
  publish: fixed_false
ambiguity: ask_user
missing_dependency: stop
context:
  durable_state: artifacts/release-readiness.json
  max_composition_depth: 2
```

This contract is design documentation for adapters and tests. It is not portable `SKILL.md` frontmatter unless a standard explicitly adopts it.

## Ship It

This lesson produces the `skill-invocation-router` bundle. It includes an invocation-model reference, an example host policy, and a non-executing CLI that evaluates one human, model, autonomous-agent, application, skill-composition, or harness request and returns a JSON decision with channel, adapter, score, and reason.

The one-request CLI is a policy probe, not a full trigger evaluation. Use the labeled positive and near-miss design in Lesson 27 to compute confusion counts, precision, recall, and repeated-run stability.

## Exercises

1. Create all four rows of the human/model matrix and write one legitimate use case for each.
2. Add application-only activation to `CorePolicyAdapter`. Prove that human and model callers remain denied.
3. Write ten near misses for a deployment skill. Each prompt must share vocabulary with the skill while belonging to a different workflow.
4. Add an ambiguity margin between the top two routing scores. Return `ask` when the margin is too small.
5. Add a maximum composition depth to skill-to-skill requests and detect a two-skill cycle.
6. Run the same labeled set through core and extension adapters. Explain every changed decision.

## Key Terms

| Term | What people say | What it actually means |
|---|---|---|
| Explicit invocation | "Slash command" | An actor supplies skill identity directly, subject to policy |
| Implicit invocation | "The model chooses" | A router selects from eligible catalog metadata based on task context |
| User-invocable | "Humans can use it" | A host-specific menu or direct-invocation property, not a core field |
| Model-invocable | "The agent can use it" | Eligibility for implicit model selection under host policy |
| Invocation adapter | "Frontmatter parser" | Code that maps a host's fields and APIs into a declared policy model |
| Near miss | "Hard negative" | A non-triggering request that resembles a skill's intended inputs |
| Abstention | "No skill selected" | A deliberate routing result when evidence is absent or ambiguous |

## Further Reading

- [Optimizing skill descriptions](https://agentskills.io/skill-creation/optimizing-descriptions) for positive triggers, specificity, and evaluation.
- [Evaluating skills](https://agentskills.io/skill-creation/evaluating-skills) for trigger and output eval design.
- [OpenAI: Build skills](https://learn.chatgpt.com/docs/build-skills) for current Codex explicit and implicit invocation controls.
- [Claude Code skills](https://code.claude.com/docs/en/skills) for one host's `user-invocable`, `disable-model-invocation`, arguments, and delegated context.
