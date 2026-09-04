# Agent Skills: Portable Contract and Runtime Boundary

> A skill is not a long prompt with a better filename. It is a discoverable package of instructions, resources, and executable helpers that enters an agent's context through a runtime contract.

**Type:** Build
**Languages:** Python (stdlib)
**Prerequisites:** Phase 13 · 01 (The Tool Interface), Phase 13 · 05 (Tool Schema Design)
**Time:** ~90 minutes

## Learning Objectives

- Define an agent skill without confusing it with a prompt, repository instructions, a tool, a hook, a subagent, or a plugin.
- Read the portable `SKILL.md` contract and separate it from runtime-specific extensions.
- Explain discovery, selection, activation, resource loading, tool use, and verification as distinct lifecycle stages.
- Validate a skill package before a runtime places it in an agent's catalog.
- Choose between a skill, MCP tool, hook, subagent, or ordinary code for a concrete task.

## Ten-Minute First Success

Do this before the long explanation. You will create a small skill, install
the complete reviewer bundle into a real agent host, invoke it, verify the
result, and remove it. This proves the lifecycle with an observable result.

### Preflight for the real-host lab

The real-host checkpoint requires Node.js, `npx`, Python 3, one selected
skill-capable host, and write access to the project or user scope you choose in
the installer. Verify the local commands first:

```bash
node --version
npx --version
python3 --version
```

Decide which host and scope you will use before installation. If any
requirement is unavailable, read this lesson on the website or continue with
the manual package exercise below. That fallback teaches the contract, but it
does not prove host discovery, invocation, bundled-script execution, or
uninstall behavior. Keep those observations marked pending.

### 1. Start in an empty working directory

Run these commands from any parent directory where you keep learning work:

```bash
mkdir -p agent-skills-first-run
cd agent-skills-first-run
TARGET_ROOT="$(pwd -P)"
printf 'TARGET_ROOT=%s\n' "$TARGET_ROOT"
ls -A
```

The final command should print nothing. If it prints files, choose a different
empty directory so the review has a clear boundary.

Create a directory for your first skill:

```bash
mkdir -p my-first-skill
```

Create `my-first-skill/SKILL.md` with this content:

```markdown
---
name: my-first-skill
description: Turn rough meeting notes into a compact decision record when the user asks to capture a technical decision.
---

# Decision record

Extract the decision, context, alternatives, owner, and next review date.
If the notes do not contain a decision, ask one clarifying question instead
of inventing one.
```

Verify that you created the file in the intended directory:

```bash
test -f my-first-skill/SKILL.md
```

No output and exit code 0 means the file exists.

### 2. Install the complete reviewer bundle

Stay in `agent-skills-first-run` and run:

```bash
npx skills add rohitg00/ai-engineering-from-scratch --skill skill-contract-reviewer --full-depth
```

Choose the agent host and scope you are using. The installer should list
`skill-contract-reviewer` and the destination it wrote. `--full-depth` is
required because this lesson's skill is a nested bundle with references, a
script, and an asset.

Set `SKILL_ROOT` to the absolute directory reported by the installer. It must
be the directory containing the installed `SKILL.md`, not the lesson source
directory and not the current workspace:

```bash
# Replace the placeholder with the destination printed by the installer.
SKILL_ROOT="$(cd "/absolute/path/to/skill-contract-reviewer" && pwd -P)"
test -f "$SKILL_ROOT/SKILL.md"
printf 'SKILL_ROOT=%s\n' "$SKILL_ROOT"
```

If the agent session was already open, start a new session or use that host's
skill rescan command. Do not assume every host hot-reloads its catalog.

### 3. Invoke it explicitly

In the installed agent, with `agent-skills-first-run` as the working
directory, use the syntax supported by that host:

| Host | Explicit invocation |
|---|---|
| Codex | `skill-contract-reviewer`, or choose it from `/skills`, then provide the review request |
| Claude Code | `/skill-contract-reviewer` followed by the review request |
| Portable fallback | `Use skill-contract-reviewer to review the target package.` |

Use the absolute values printed for `SKILL_ROOT` and `TARGET_ROOT` in the
request. Require the host to expand them before execution and show the exact
resolved command, not a command that depends on the process working directory:

```text
Use skill-contract-reviewer to review <TARGET_ROOT>/my-first-skill. The installed bundle root is <SKILL_ROOT>. Run python3 <SKILL_ROOT>/scripts/check_skill.py <TARGET_ROOT>/my-first-skill. Before running it, show the fully resolved argv. Return the validation report, selected primitives, and one sentence for each selection. Include the resolved script path, resolved target path, cwd, argv, and exit code as execution evidence.
```

The resolved command should have this shape, with no placeholders remaining:

```bash
python3 "/absolute/install/path/skill-contract-reviewer/scripts/check_skill.py" \
  "/absolute/workspace/path/agent-skills-first-run/my-first-skill"
```

A successful result has all three properties:

1. The host finds `skill-contract-reviewer` by name.
2. The reviewer reads the package contract and runs its bundled validator.
3. The response contains a validation report with no structural error for the
   sample, plus a justified primitive selection.

The execution evidence must also name the script path, target path, cwd, exact
argument vector, and exit code. A fluent report without those fields does not
prove that the installed companion script ran.

If the host reports that the skill is unavailable, verify the install
destination, rescan or restart once, and retry the explicit request. Do not
rewrite the skill description to hide an installation failure.

### 4. Probe implicit selection

Start a fresh agent turn and enter the same task without naming the skill:

```text
Review <TARGET_ROOT>/my-first-skill as a reusable agent package and tell me whether its package contract is valid.
```

If the host exposes selected skills, record whether it chose
`skill-contract-reviewer`. If the host does not expose routing, mark implicit
selection as unverified. The explicit invocation is the portable fallback.

### 5. Clean up

Remove only the installed reviewer bundle:

```bash
npx skills remove skill-contract-reviewer
```

Select the same host and scope used during installation. After a rescan or new
session, an explicit request for `skill-contract-reviewer` should report that
it is unavailable. Keep `my-first-skill` for the later lessons, or remove the
lab directory after you finish the track.

## The Problem

Suppose your team has a reliable release workflow. It finds merged changes, checks migration notes, updates the changelog, runs a packaging command, and produces a review checklist.

Putting that workflow in one prompt makes it easy to paste and hard to operate. The prompt has no stable identity, no discovery rule, no resource boundary, no testable package shape, and no answer to basic questions: Who may invoke it? When should the model select it? Which scripts can it run? Which files are trusted? What survives when context is compacted?

The opposite mistake is to treat every reusable instruction as a skill. Repository conventions, deterministic automation, external tools, event hooks, and delegated agents solve different problems. Packing all of them into `SKILL.md` produces a directory that looks portable while depending on one host's undocumented behavior.

The first engineering task is classification. Decide what the artifact is before you decide how to package it.

## The Concept

### Skills encode procedural knowledge

An agent skill is a directory whose entry point is `SKILL.md`. The entry file contains YAML frontmatter followed by Markdown instructions. The directory can also contain references, scripts, and assets.

```figure
skill-package-anatomy
```

The directory, not the Markdown file alone, is the deployable unit. A copied `SKILL.md` with missing references is a broken package even if its frontmatter parses.

### The neighboring abstractions

| Artifact | Primary job | Loaded or run when | What it should not impersonate |
|---|---|---|---|
| Prompt | Shape one model interaction | Included by an application or user | A versioned package with resources |
| Repository instructions | Explain one codebase's standing rules | A coding runtime enters that scope | A reusable task workflow |
| Agent skill | Supply reusable procedural knowledge | Explicit or implicit activation | A hard authorization boundary |
| MCP tool | Expose a typed remote capability | The model or application calls it | A detailed operating procedure |
| Hook | Run deterministic logic on an event | The declared event occurs | Probabilistic model routing |
| Subagent | Delegate work with separate context and state | An orchestrator creates or calls it | A static instruction bundle |
| Plugin | Distribute a larger runtime extension | The host installs or enables it | The portable skill contract itself |
| Learned skill library | Store behavior discovered through experience | A policy retrieves a prior program or trajectory | A standards-based `SKILL.md` package |

A release skill can tell the agent how to inspect a release. An MCP server can expose the release registry. A hook can forbid direct pushes. A subagent can independently audit the candidate. These pieces compose because they keep different responsibilities.

### The word "skill" names two different ideas

Research systems sometimes call a learned program, successful trajectory, or environment-specific policy fragment a skill. An agent can create these artifacts during exploration, retrieve them by task similarity, execute them, and revise the library from feedback. Phase 14 · 10 builds that kind of lifelong-learning library.

An Agent Skill in this mini-track is different. It is an authored package with a declared filesystem contract, catalog metadata, progressive disclosure, runtime-mediated invocation, and host-controlled tools. It can be generated or improved by an agent, but learning is not required for the format.

| Dimension | Agent Skill package | Learned skill library |
|---|---|---|
| Primary unit | `SKILL.md` directory | Program, policy, trajectory, or memory record |
| Creation | Authored, generated, or curated | Usually discovered from environment experience |
| Selection | Catalog description plus runtime policy | Retrieval or policy over task state |
| Execution | Model follows instructions and calls host tools | Environment runs a stored behavior or code artifact |
| Portability | Package contract can cross compatible hosts | Often tied to one environment and action space |
| Evaluation | Routing, artifact, safety, and host compatibility | Reward, success rate, transfer, and library growth |

Both ideas package reusable competence. They should not share implementation claims merely because they share a name.

### The portable core

The Agent Skills specification requires two frontmatter fields:

```yaml
---
name: release-readiness
description: Inspect a release candidate when the user asks whether a version is ready to publish.
---
```

`name` is the stable identifier. It must satisfy the specification's naming rules and match the parent directory. `description` is both documentation and routing metadata. It should say what the skill does and when it applies.

The portable optional fields are:

| Field | Purpose | Portability note |
|---|---|---|
| `license` | State the terms for the package | Core specification |
| `compatibility` | State environmental requirements | Core specification |
| `metadata` | Carry string-valued extension data | Core specification |
| `allowed-tools` | Suggest pre-approved tools | Experimental; host support varies |

The Markdown body holds the operational instructions. It should define the workflow, decision points, failure behavior, and direct paths to supporting resources.

```markdown
# Release readiness

Use this workflow for a release candidate, not for ordinary development builds.

1. Read `references/release-policy.md`.
2. Run `python3 scripts/inspect_release.py --format json`.
3. Stop if the report contains a blocking failure.
4. Produce the checklist from `assets/release-checklist.md`.
5. Ask for approval before any publish or tag action.
```

### Runtime extensions are a second layer

Some hosts accept extra frontmatter or companion configuration. Those fields can be useful, but they are not automatically portable.

| Behavior | Example host extension | Portable core? |
|---|---|:---:|
| Hide a skill from model routing while keeping direct user invocation | `disable-model-invocation` | No |
| Hide a skill from the user's command menu while allowing model routing | `user-invocable` | No |
| Show argument help in a command menu | `argument-hint` | No |
| Run the skill in delegated context | `context`, `agent` | No |
| Pin model or reasoning settings | `model`, `effort` | No |
| Register lifecycle automation | `hooks` | No |
| Disable implicit invocation in Codex | `agents/openai.yaml` policy | No |

Treat each extension as an adapter. Keep the core workflow valid without it, document the fallback, and test the host that consumes it. A runtime may ignore an unknown field, reject it, or preserve it without implementing the behavior.

### Frontmatter is executable metadata

Metadata changes system behavior before the skill body is read.

- A malformed `name` can make discovery fail.
- A vague `description` can route the wrong requests.
- A human-only flag can remove the skill from the model's catalog.
- A tool allowance can change whether a host asks for permission.
- A context setting can move execution into a separate agent session.

Review frontmatter like configuration code. Validate it, version it, and include its behavior in evals.

### The skill lifecycle

```figure
skill-runtime-lifecycle
```

Each arrow is a boundary with its own failure modes.

1. **Discovery** finds possible packages in configured locations.
2. **Validation** rejects malformed or unsafe packages before catalog publication.
3. **Cataloging** exposes a compact `name` and `description`, not the full package.
4. **Selection** decides whether the skill is relevant.
5. **Activation** loads the body into model-visible context.
6. **Disclosure** reads references or assets only when a branch requires them.
7. **Execution** uses host tools under the host's permission and isolation rules.
8. **Verification** checks the produced artifact independently of the model's claim.

Collapsing these stages causes bad mental models. A discovered skill is not active. An active skill is not authorized to do everything it describes. A permitted tool call is not proof that the result is correct.

### Skills and tools are orthogonal

MCP answers, "Which capabilities can this application call, and what are their schemas?" A skill answers, "How should an agent approach this class of task?"

```figure
skill-tool-orthogonality
```

The skill may name a tool, but the host owns the actual capability registry. If the tool is absent, the skill should state a fallback or fail clearly. It should never imply that naming a capability creates it.

### Skills and repository instructions are different scopes

Repository instructions describe the environment you are already in: commands, conventions, generated files, and boundaries. A skill provides reusable procedure for a task that may occur across many repositories.

When both apply, the active user request and repository rules constrain the skill. A generic refactoring skill must not override a repository rule that forbids editing generated files.

### Skills do not import one another

One skill can direct the agent to invoke another, but this is not a language-level import. The second skill still goes through runtime discovery, eligibility, activation, permissions, and context handling.

Write cross-skill dependencies as observable workflow edges:

```markdown
After producing the candidate changelog, invoke the `release-risk-review` skill.
Pass the candidate path and require a blocking or non-blocking verdict.
If that skill is unavailable, stop and report the missing dependency.
```

This makes the dependency testable and gives the host a chance to enforce policy.

## Build It

`code/main.py` implements a small standards-oriented validator and an artifact chooser. It stays stdlib-only so every rule is visible.

The validator exposes:

- `parse_frontmatter(text)` to separate metadata from the body.
- `validate_skill_text(text, directory_name, allowed_runtime_extensions=())` to check required fields, naming, unknown extensions, body presence, and portable limits.
- `ValidationIssue` and `SkillReport` to return structured evidence instead of one opaque boolean.
- `FrontmatterSyntaxError` for input that cannot be interpreted safely.

The chooser exposes `TaskShape` and `select_primitives(task)`. It maps a task's needs to ordinary code, repository instructions, a skill, a hook, a subagent, or an MCP tool.

Run the lab:

```bash
cd "$(git rev-parse --show-toplevel)"
cd phases/13-tools-and-protocols/22-skills-and-agent-sdks
python3 code/main.py
python3 -m unittest discover -s code/tests -v
```

This command block requires a local clone and must start from anywhere inside
that clone so `git rev-parse --show-toplevel` can resolve the repository root.

The demo prints JSON for one valid portable skill, one host-extended skill, one invalid package, and several task-shape decisions. Inspect the issue codes. A package validator should explain how to fix an artifact without guessing on the author's behalf.

### Validation order matters

Validate cheap structural facts before deeper content rules:

```figure
skill-validation-order
```

This order prevents secondary errors from obscuring the first broken invariant.

## Use It

Before writing a skill, fill out this decision card:

| Question | If yes | Likely primitive |
|---|---|---|
| Does this need reusable model judgment across several steps? | The procedure is stable but decisions vary | Skill |
| Must this happen every time an event fires? | Missing one execution is unacceptable | Hook or application code |
| Does the model need an external capability with typed inputs? | The operation lives outside model context | Tool or MCP server |
| Does the work need isolated context, state, or ownership? | A separate worker returns a bounded result | Subagent |
| Is this guidance specific to one repository? | It describes local commands and constraints | Repository instructions |
| Is one interaction enough? | No package lifecycle is needed | Prompt |

Many production workflows use more than one row. The card prevents one artifact from pretending to provide every property.

## Ship It

This lesson produces the `skill-contract-reviewer` bundle under `outputs/`. It contains:

- a portable `SKILL.md` that reviews a proposed skill package;
- reference checklists for the portable contract and primitive selection;
- a deterministic validation script;
- task-shape fixtures covering prompts, skills, tools, hooks, ordinary code, and subagents.

Install the full bundle, not only its entry file:

```bash
cd "$(git rev-parse --show-toplevel)"
python3 scripts/install_skills.py /tmp/aiefs-skills --phase 13 --type skill
```

The course installer reports each copied Phase 13 skill and writes
`/tmp/aiefs-skills/manifest.json`. This clean destination checks package shape;
the first-success loop above checks discovery and invocation in a real host.

The following lessons deepen each lifecycle stage. Lesson 24 builds discovery and progressive disclosure. Lesson 25 builds invocation policy and routing. Lesson 26 separates permissions from sandboxing. Lesson 27 turns the whole package into an evaluated release artifact.

## Exercises

1. Classify five workflows from your own team using `TaskShape`. Defend every case where you choose more than one primitive.
2. Add boundary tests proving that a 500-character `compatibility` value passes and a 501-character value fails as a specification error.
3. Add one runtime extension to the allowlist. Write a test proving the same file is still distinguishable from a portable-only skill.
4. Split a 400-line prompt into `SKILL.md`, one reference, one script contract, and one output template. Keep every file responsible for one kind of information.
5. Design a failure response for a skill that references an unavailable MCP tool. Do not silently substitute a tool with broader permissions.
6. Review an existing skill and label every sentence as routing, procedure, policy, reference pointer, or output contract. Move anything that does not belong.

## Key Terms

| Term | What people say | What it actually means |
|---|---|---|
| Agent skill | "A saved prompt" | A discoverable directory of procedural instructions and optional resources |
| Portable core | "Fields every runtime shares" | The contract defined by the Agent Skills specification |
| Runtime extension | "Extra frontmatter" | Host-specific configuration whose behavior requires a compatible adapter |
| Activation | "The skill ran" | The skill body entered model-visible context; execution may come later |
| Skill dependency | "Import another skill" | A runtime-mediated invocation edge with availability and policy checks |
| Tool contract | "A function schema" | Inputs, outputs, permissions, side effects, errors, and evidence for a capability |

## Further Reading

- [Agent Skills specification](https://agentskills.io/specification) for the portable directory and frontmatter contract.
- [Agent Skills best practices](https://agentskills.io/skill-creation/best-practices) for scope, instructions, and resource organization.
- [OpenAI: Build skills](https://learn.chatgpt.com/docs/build-skills) for current Codex discovery and invocation behavior.
- [Claude Code skills](https://code.claude.com/docs/en/skills) for one runtime's invocation, argument, tool, and delegated-context extensions.
