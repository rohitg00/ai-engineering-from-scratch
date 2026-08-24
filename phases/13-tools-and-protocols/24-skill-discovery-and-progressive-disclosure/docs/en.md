# Skill Discovery and Progressive Disclosure

> A skill becomes useful before its body is loaded. Its name and description earn a place in the catalog; its deeper files earn context only when the task reaches them.

**Type:** Build
**Languages:** Python (stdlib)
**Prerequisites:** Phase 13 · 22 (Agent Skills: Portable Contract and Runtime Boundary)
**Time:** ~105 minutes

## Learning Objectives

- Build a filesystem discovery pipeline that separates scope, validation, collision policy, and catalog publication.
- Explain the three disclosure levels: catalog metadata, active instructions, and task-specific resources.
- Design references so an agent can reach required detail directly without loading the entire package.
- Budget catalog space independently from active-skill context.
- Reject path traversal and symlink escape when a skill reads its own resources.

## The Problem

Your agent has 200 installed skills. Loading every `SKILL.md`, reference file, script, and template at session start would bury the current task in unrelated procedure. Loading nothing would force the user to remember exact filesystem paths.

The usual compromise is a catalog: show the model a compact identity and routing description for each eligible skill, then load the full body only after selection. That creates two new engineering problems.

First, discovery is not just recursive file search. Skills can exist at project, user, administrator, plugin, or built-in scopes. Two packages can share a name. A symlink can point outside the trusted root. A malformed package can consume catalog space or become impossible to invoke.

Second, progressive disclosure can become progressive confusion. If `SKILL.md` says "read the relevant guide" and the package contains twelve guides, the model must guess. If every guide points to three more files, loading becomes an unbounded graph walk.

A good runtime makes discovery deterministic and disclosure intentional.

## The Concept

### Discovery is a compiler pipeline

Treat the filesystem as source input. Do not publish raw paths directly to the model.

```figure
skill-discovery-pipeline
```

Each stage should produce structured data and structured failures. A discovery log should answer:

- Which roots were searched?
- Which candidates were found?
- Which candidates were rejected, and why?
- Which package won a collision?
- Which catalog entries were shortened or omitted because of budget?

Without that evidence, "the model did not use my skill" is almost impossible to diagnose.

### Scope is runtime policy

The portable specification defines a skill package, not one universal installation path or precedence order. The host decides where it searches.

A generic runtime might use these scopes:

| Scope | Example root | Intended ownership |
|---|---|---|
| Workspace | `<repo>/.agents/skills/` | Project maintainers |
| User | `<user-data>/skills/` | One developer |
| Administrator | `<system>/skills/` | Machine or organization policy |
| Plugin | A signed plugin bundle | Plugin publisher and installer |
| Built-in | Runtime package | Runtime vendor |

As of August 2026, Codex documents project discovery from `$CWD/.agents/skills` through ancestor directories up to the repository root, plus user, administrator, and built-in locations. It supports symlinked skill directories. Duplicate names may both appear rather than being merged. Those are Codex behaviors, not requirements of `SKILL.md`; verify the current [Codex skill documentation](https://learn.chatgpt.com/docs/build-skills) when writing an adapter.

Never invent precedence from directory names. Declare it as policy and test it. The lesson lab uses an explicit integer rank for each `Scope` so the same candidate set always resolves the same way.

### Collisions need identity beyond `name`

Two packages named `release-readiness` can be legitimate. One may be a workspace override and one a user default. A catalog entry therefore needs at least:

```json
{
  "name": "release-readiness",
  "description": "Inspect a release candidate for this repository.",
  "scope": "workspace",
  "source": "/repo/.agents/skills/release-readiness",
  "selected": true
}
```

Common collision policies include:

| Policy | Benefit | Risk |
|---|---|---|
| Keep every candidate | Nothing is hidden | The model sees ambiguous names |
| Highest-precedence scope wins | Simple invocation | A local package can shadow a trusted one |
| Reject duplicates | No silent shadowing | Legitimate overrides stop working |
| Qualify names by source | Explicit identity | User-facing names become longer |

Choose one policy for the host. Preserve the rejected or shadowed candidates in diagnostics even when they are absent from the model catalog.

### Three disclosure levels

The Agent Skills specification describes staged loading. The key is that each level has a different purpose.

```figure
skill-disclosure-levels
```

#### Level 1: catalog metadata

The model needs enough information to distinguish the skill from neighbors. The specification estimates roughly 100 tokens per catalog entry, but actual serialization and tokenization belong to the host.

A useful description has two clauses:

```yaml
description: Validate a release candidate and produce a readiness report. Use when the user asks whether a version, tag, or package is ready to publish.
```

The first clause states the capability. The second states the trigger boundary. Lesson 25 evaluates this boundary with positive and near-miss prompts.

#### Level 2: active instructions

After activation, the body should function as a map and a procedure. The specification recommends keeping `SKILL.md` under 500 lines. That is a design signal, not a target to fill.

The body should contain:

- the task boundary;
- the default workflow;
- branch conditions;
- direct references to deeper files;
- tool and script contracts;
- failure and stopping behavior;
- the expected output and its verification.

Do not move the central workflow into a reference merely to make the entry file short. Activation must give the model enough context to begin correctly.

#### Level 3: supporting resources

References supply prose or data. Scripts provide deterministic computation. Assets are copied, filled, or transformed into deliverables rather than treated as instructions.

| Directory | Model reads it? | Model executes it? | Typical content |
|---|:---:|:---:|---|
| `references/` | Yes, when needed | No | schemas, policies, domain guides |
| `scripts/` | May inspect it | Through a permitted tool | validators, converters, collectors |
| `assets/` | Only if useful | No | templates, fixtures, images, starter files |

These names are conventions, not magic capabilities. The host still needs file access and an execution tool.

### Branch-specific references beat topic dumps

Write the entry file as a decision map:

```markdown
## Choose the path

- For a Python package, read `references/python-release.md`.
- For a container image, read `references/container-release.md`.
- For a documentation-only release, read `references/docs-release.md`.
- If the release combines artifact types, read only the guides for those artifacts.
```

This gives every reference an observable load condition. "Read `references/` for more" does not.

Keep the reference graph shallow. The official guidance recommends direct links from `SKILL.md` and avoiding deep chains. One hop makes reachability testable and reduces the chance that a needed constraint never enters context.

```figure
skill-reference-map
```

### Catalog budget and active context are different budgets

Let `c_i` be the serialized catalog cost of skill `i`, `B_c` the catalog budget, `b_j` the active body cost, and `r_k` the resources actually loaded.

```text
catalog_cost = sum(c_i for every published skill)
active_cost = sum(b_j for every activated skill) + sum(r_k for every disclosed resource)
```

Reducing one budget does not automatically reduce the other. Short descriptions can save catalog space while an activated 900-line body still overwhelms the task. Splitting the body into references can reduce active cost only when the runtime and instructions actually avoid loading irrelevant branches.

Codex currently budgets the initial skill list at 2 percent of the context
window when the context-window size is known. The 8,000-character value is a
fallback only when that size is unknown; it is not a second cap combined with
the 2 percent rule. When the catalog exceeds the applicable budget,
descriptions may be shortened or omitted. Treat those figures as current
Codex policy, not a property of the Agent Skills standard.

### Resource paths are a trust boundary

A skill should read only files inside its package. Literal string-prefix checks are not enough:

```text
references/../../../../.ssh/config
references/external-link -> /private/company-secrets
```

Resolve the package root and candidate with filesystem semantics, reject absolute inputs, and verify that the resolved candidate remains under the resolved root. Decide whether symlinks are allowed before discovery. If allowed, check the resolved target every time.

```figure
skill-resource-containment
```

Path containment does not establish content trust. A valid in-package reference can still contain malicious instructions. Lesson 26 handles that threat.

### Loading must be observable

Record disclosure events without logging secrets:

```json
{
  "event": "skill.resource.loaded",
  "skill": "release-readiness",
  "resource": "references/python-release.md",
  "reason": "candidate contains pyproject.toml",
  "bytes": 2840
}
```

The reason turns a context choice into reviewable evidence. It also helps identify instructions that cause the agent to load every file "just in case."

## Build It

`code/main.py` builds a deterministic discovery and disclosure engine.

The discovery surface includes:

- `Scope` for source and precedence metadata;
- `SkillCandidate` for an unvalidated filesystem candidate;
- `discover_scope(scope)` to enumerate immediate skill directories;
- `resolve_collisions(candidates, precedence)` to apply one declared policy;
- `CatalogEntry` and `build_catalog(...)` to publish bounded metadata;
- `CatalogBudget` to account for serialized entries without pretending characters are universal tokens.

The disclosure surface includes:

- `load_skill_body(entry, ...)` for Level 2 activation;
- `validate_reference(skill_dir, reference)` for path containment;
- `load_reference(...)` for bounded Level 3 reads.

Run the lab:

```bash
cd "$(git rev-parse --show-toplevel)"
cd phases/13-tools-and-protocols/24-skill-discovery-and-progressive-disclosure
python3 code/main.py
python3 -m unittest discover -s code/tests -v
```

This block requires a local clone and resolves the repository root from any
working directory inside that clone.

The demo creates temporary project and user scopes, inserts a collision, builds a catalog under a deliberately small budget, activates one skill, and attempts both a valid reference read and a traversal escape. No permanent files are installed.

### Why discovery is shallow

`discover_scope` checks immediate child directories for `SKILL.md`. It does not recursively treat every nested `SKILL.md` as a separate package. This preserves the package boundary and avoids accidentally publishing examples or fixtures inside an installed skill.

### Why the lab does not parse arbitrary YAML

The lab supports the scalar frontmatter needed for its catalog. A production runtime should use a safe YAML parser with an explicit schema, size limits, and disabled custom object construction. "Stdlib-only" is a teaching constraint, not permission to invent a partial YAML dialect silently.

## Use It

Apply this checklist to any discovery adapter:

1. List every configured root and who can write to it.
2. State whether symlinked packages are allowed.
3. Validate package name, directory name, required metadata, and entry-body size.
4. Preserve source and scope in the internal identity.
5. Declare and test duplicate-name behavior.
6. Measure the exact serialized catalog sent to the model.
7. Record why a body or resource was loaded.
8. Keep resource reads inside the resolved package root.
9. Fail clearly when a referenced file is missing.
10. Rebuild the catalog when installations or policies change.

## Ship It

This lesson produces the `skill-catalog-builder` bundle. It scans explicitly ordered roots, rejects symlinked entry files and name-directory mismatches, resolves cross-scope collisions, rejects equal-precedence duplicates, and fits selected metadata into declared entry, description, and serialized-character budgets.

Its JSON report contains selected entries, shadowed candidates, omitted entries, validation errors, precedence, and budget use. Body and reference loading remain separate runtime operations, so the catalog builder does not execute scripts or admit the whole package into context.

## Exercises

1. Add a plugin scope and place it between user and built-in precedence. Prove the collision result with a test.
2. Change the collision policy from highest precedence to qualified names. Preserve both entries in the catalog.
3. Add a byte-size limit to `load_reference`. Test a file exactly at the limit and one byte above it.
4. Create two descriptions that sound nearly identical. Rewrite them so the trigger boundaries do not overlap.
5. Add a manifest containing hashes for every reference and script. Detect a modified resource before loading it.
6. Instrument the demo to report Level 1, Level 2, and Level 3 byte counts separately.

## Key Terms

| Term | What people say | What it actually means |
|---|---|---|
| Skill discovery | "Find every SKILL.md" | Search configured scopes, validate packages, attach provenance, and apply policy |
| Skill catalog | "The list of installed skills" | Compact model-visible routing metadata for eligible packages |
| Collision policy | "Which duplicate wins" | A declared rule for same-name candidates from different sources |
| Progressive disclosure | "Lazy loading" | Staged context admission from catalog to body to branch-specific resources |
| Reference graph | "Files linked by the skill" | The reachable resource structure and its load conditions |
| Path containment | "Stay in the folder" | Verify resolved resource targets remain inside the resolved package root |

## Further Reading

- [Agent Skills specification](https://agentskills.io/specification) for package shape and progressive disclosure levels.
- [Optimizing skill descriptions](https://agentskills.io/skill-creation/optimizing-descriptions) for catalog routing metadata.
- [Agent Skills best practices](https://agentskills.io/skill-creation/best-practices) for direct references and entry-file size.
- [OpenAI: Build skills](https://learn.chatgpt.com/docs/build-skills) for current Codex discovery scopes and catalog limits.
