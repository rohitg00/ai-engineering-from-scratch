---
id: agent-skills
title: Agent Skills: Discovery, Invocation, Routing
code: AR
subtitle: Write, install, discover, invoke and route SKILL.md packages. Validators, catalogs, router and installer projects.
hue: 130
sources: phases/13-tools-and-protocols/22-skills-and-agent-sdks, phases/13-tools-and-protocols/24-skill-discovery-and-progressive-disclosure, phases/13-tools-and-protocols/25-skill-invocation-and-routing, projects/skill-router, projects/skill-installer, projects/skill-validator
source_hash: 42ff5f76dc9ee9e5
---

## Skill lifecycle
type: flow
from: phases/13-tools-and-protocols/22-skills-and-agent-sdks/docs/en.md

1. **Discovery**: finds packages in configured locations.
2. **Validation**: rejects malformed or unsafe packages before the catalog.
3. **Cataloging**: exposes only `name` and `description`.
4. **Selection**: decides if the skill is relevant to the request.
5. **Activation**: loads the body into model-visible context.
6. **Disclosure**: reads references or assets only when a branch needs them.
7. **Execution**: uses host tools under host permission and isolation rules.
8. **Verification**: checks the artifact apart from the model's claim.

## Install, invoke, remove
type: command-table
span: 2
from: phases/13-tools-and-protocols/22-skills-and-agent-sdks/docs/en.md, phases/13-tools-and-protocols/25-skill-invocation-and-routing/docs/en.md

| Command | What it does |
|---|---|
| `npx skills add rohitg00/ai-engineering-from-scratch --skill skill-contract-reviewer --full-depth` | Installs the nested bundle with references, script and asset |
| `/skill-contract-reviewer <request>` | Explicit invocation in a host with `/skill-name` syntax |
| `/skills` | Picks a skill by name in the Codex interface |
| `python3 <SKILL_ROOT>/scripts/check_skill.py <TARGET_ROOT>/my-first-skill` | Runs the bundled validator. Show argv, cwd and exit code |
| `npx skills remove skill-contract-reviewer` | Removes the bundle. Use the same host and scope |
| `python3 scripts/install_skills.py /tmp/aiefs-skills --phase 13 --type skill` | Copies Phase 13 bundles and writes `manifest.json` |
| `python3 -m unittest discover -s code/tests -v` | Runs a lesson test suite |

## Project runs and grading
type: task-table
span: 2
from: projects/skill-router/README.md, projects/skill-installer/README.md, projects/skill-installer/solution/cli.ts, projects/skill-validator/README.md

| Task | Code |
|---|---|
| Create a learner workspace | `python3 scripts/project_test.py skill-router --init learning-artifacts/skill-router` |
| Grade one stage | `python3 scripts/project_test.py skill-router --stage 1 --path learning-artifacts/skill-router` |
| Route the sample request | `node learning-artifacts/skill-router/cli.ts projects/skill-router/examples/skills projects/skill-router/examples/request.json` |
| Dry run an install | `node learning-artifacts/skill-installer/cli.ts inspect projects/skill-installer/examples/orchard-release.json codex` |
| Install for real | `cli.ts install bundle.json agent root expected-source-digest` |
| Build the validator | `rustc --edition=2021 learning-artifacts/skill-validator/cli.rs -o learning-artifacts/skill-validator/validator` |
| Validate and load in 2000 characters | `validator projects/skill-validator/examples/orchard-release 2000 --activate references/restore.md` |
| Check a reference solution | `python3 scripts/project_test.py skill-validator --all --solution --strict` |

## Validate, catalog, disclose, route (lessons)
type: annotated-code
lang: python
from: phases/13-tools-and-protocols/22-skills-and-agent-sdks/docs/en.md, phases/13-tools-and-protocols/24-skill-discovery-and-progressive-disclosure/code/main.py, phases/13-tools-and-protocols/25-skill-invocation-and-routing/code/main.py

```python
report = validate_skill_text(text, directory_name, allowed_runtime_extensions=())
select_primitives(task)                          # code, skill, hook, subagent, tool
candidates = (*discover_scope(Scope("project", project_root)),
              *discover_scope(Scope("user", user_root)))  # immediate children only
catalog = build_catalog(candidates, precedence=("project", "user"),
                        budget=CatalogBudget(max_entries=10, max_catalog_chars=2_000))
body = load_skill_body(selected, candidates)     # level 2
reference = load_reference(selected, "references/format.md")  # level 3
validate_reference(skill_directory, reference)   # blocks traversal and escape
route_request(skills, request, adapter)          # eligibility before ranking
build_invocation_matrix(policy)                  # human by model view
```

## Router and installer (projects)
type: annotated-code
lang: ts
from: projects/skill-router/solution/main.ts, projects/skill-router/solution/cli.ts, projects/skill-installer/solution/main.ts

```ts
const skills = await loadCatalog(root);            // SKILL.md plus routing.json
rank(skills, query, files);                        // keyword 2, path 3
plan(skills, selected, allowed);                   // dependencies first
route(skills, query, files, allowed, margin = 1);  // ready, no-match, ambiguous, blocked
safePath(name);                                    // rejects .., absolute, C:, backslash
const files = translate(bundle, agent);            // new quoted header, same body
const expected = digest(bundle.files);             // SHA-256 of sorted pairs
await install(root, bundle, agent, expectedDigest);  // staged rename with backup
```

## Human and model invocation
type: comparison
from: phases/13-tools-and-protocols/25-skill-invocation-and-routing/docs/en.md

| Factor | Shared | Human-only | Model-only | Disabled |
|---|---|---|---|---|
| Human can invoke | Yes | Yes | No | No |
| Model can invoke | Yes | No | Yes | No |
| One host field | Default | `disable-model-invocation: true` | `user-invocable: false` | Not defined |
| Example | Test planning | Publish preparation | Internal style guide | Deprecated package |

## Limits and defaults
type: defaults
from: phases/13-tools-and-protocols/22-skills-and-agent-sdks/code/main.py, phases/13-tools-and-protocols/24-skill-discovery-and-progressive-disclosure/code/main.py, phases/13-tools-and-protocols/25-skill-invocation-and-routing/code/main.py, projects/skill-router/solution/main.ts, projects/skill-installer/solution/main.ts

| Setting | Default | Note |
|---|---|---|
| `name` length | 64 | Lowercase words joined by hyphens |
| `description` length | 1024 | Says what and when |
| `compatibility` length | 500 | Optional core field |
| `max_description_chars` | 240 | `CatalogBudget` per entry |
| `max_catalog_chars` | 8_000 | `CatalogBudget` total |
| `max_chars` | 12_000 | Body and reference loads |
| `model_threshold` | 0.2 | Implicit selection floor |
| Router `margin` | 1 | Smaller score gap is ambiguous |

## Failures and fixes
type: troubleshooting
from: projects/skill-router/solution/main.ts, projects/skill-installer/solution/main.ts, projects/skill-installer/solution/cli.ts, projects/skill-validator/solution/stage1.rs, projects/skill-installer/stages/04-upgrades/docs/en.md, phases/13-tools-and-protocols/22-skills-and-agent-sdks/docs/en.md, phases/13-tools-and-protocols/24-skill-discovery-and-progressive-disclosure/docs/en.md

| Symptom | Cause | Fix |
|---|---|---|
| `no-match` | No keyword or path scored | Add `keywords` or `paths` in routing.json |
| `ambiguous` | Top two scores differ by less than `margin` | Make the trigger boundaries distinct |
| `blocked` with `permission denied` | Skill or a dependency needs more permissions | Allow it or pick another route |
| `unsupported YAML syntax` | Tag, alias, multiline or flow value | Use a plain or double-quoted scalar |
| `integrity mismatch` | Bundle digest differs from the expected digest | Run `inspect`, compare `source_digest` |
| `modified installation` | A tracked file changed since install | Move the edit into the source bundle |
| Skill unavailable after install | Host did not rescan its catalog | Start a new session or rescan, then retry |
| Model never picks the skill | Vague description or budget cut it | Check the discovery log and catalog size |

## Writing rules
type: tips
from: phases/13-tools-and-protocols/24-skill-discovery-and-progressive-disclosure/docs/en.md, phases/13-tools-and-protocols/25-skill-invocation-and-routing/docs/en.md, phases/13-tools-and-protocols/22-skills-and-agent-sdks/docs/en.md

- `name` must match the parent directory.
- Description: one clause for the capability, one for the trigger boundary.
- Add a negative boundary when two skills share words. Test near misses.
- Filter by eligibility first. Then rank. Abstain when no score is strong enough.
- Do not interpolate raw arguments into shell commands.
- Name a dependency skill and a fallback. Stop when it is unavailable.

## Questions
type: qa
from: phases/13-tools-and-protocols/22-skills-and-agent-sdks/docs/en.md, phases/13-tools-and-protocols/25-skill-invocation-and-routing/docs/en.md, projects/skill-router/README.md, projects/skill-installer/README.md

- **Skill or hook?** A hook when every event must run. A skill for model judgment.
- **Skill or MCP tool?** A tool for a typed external capability. A skill for procedure.
- **Does an explicit name bypass policy?** No. It still passes every gate.
- **Does the router run the skill?** No. It emits plans and explanations only.
- **Does a successful install prove activation?** No. The agent must discover it.
