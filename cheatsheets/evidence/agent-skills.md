# Evidence: cheatsheets/agent-skills.md

Abbreviations: P = phases/13-tools-and-protocols. L22 = P/22-skills-and-agent-sdks, L24 = P/24-skill-discovery-and-progressive-disclosure, L25 = P/25-skill-invocation-and-routing, SR = projects/skill-router, SI = projects/skill-installer, SV = projects/skill-validator. d = docs/en.md, c = code/main.py, sm = solution/main.ts, sc = solution/cli.ts.

## Skill lifecycle (flow, 8 steps)
- Discovery: L22/d:305
- Validation: L22/d:306
- Cataloging: L22/d:307
- Selection: L22/d:308
- Activation: L22/d:309
- Disclosure: L22/d:310
- Execution: L22/d:311
- Verification: L22/d:312

## Install, invoke, remove (command-table, 7)
- npx skills add ... --skill skill-contract-reviewer --full-depth, nested bundle: L22/d:91, 95-97
- /skill-contract-reviewer followed by request: L22/d:121, L25/d:87
- /skills in Codex: L22/d:120, L25/d:87
- python3 <SKILL_ROOT>/scripts/check_skill.py <TARGET_ROOT>/my-first-skill, show argv, cwd, exit code: L22/d:129, 146-148
- npx skills remove skill-contract-reviewer, same host and scope: L22/d:171-174
- python3 scripts/install_skills.py /tmp/aiefs-skills --phase 13 --type skill, writes manifest.json: L22/d:411-415
- python3 -m unittest discover -s code/tests -v: L22/d:365, L24/d:238, L25/d:261

## Project runs and grading (task-table, 8)
- --init learning-artifacts/skill-router: SR/README.md:14
- --stage 1 --path learning-artifacts/skill-router: SR/README.md:15
- node learning-artifacts/skill-router/cli.ts ... examples/skills ... examples/request.json: SR/README.md:30
- node learning-artifacts/skill-installer/cli.ts inspect ... orchard-release.json codex: SI/README.md:30
- cli.ts install bundle.json agent root expected-source-digest: SI/sc:9, SI/README.md:37
- rustc --edition=2021 learning-artifacts/skill-validator/cli.rs -o learning-artifacts/skill-validator/validator: SV/README.md:30
- validator projects/skill-validator/examples/orchard-release 2000 --activate references/restore.md: SV/README.md:31. Default budget 2000: SV/solution/cli.rs:57
- python3 scripts/project_test.py skill-validator --all --solution --strict: SV/README.md:41

## Validate, catalog, disclose, route (annotated-code, 11 lines)
- validate_skill_text(text, directory_name, allowed_runtime_extensions=()): L22/d:353
- select_primitives(task) maps to code, instructions, skill, hook, subagent, MCP tool: L22/d:357
- discover_scope(Scope("project", project_root)) and user scope: L24/c:373-376
- discover_scope checks immediate child directories only: L24/d:248
- build_catalog(candidates, precedence=("project", "user"), budget=CatalogBudget(max_entries=10, max_catalog_chars=2_000)): L24/c:377-381
- load_skill_body level 2, load_reference level 3: L24/c:383-384, L24/d:228-230
- validate_reference(skill_directory, reference) path containment: L24/c:301, L24/d:229
- route_request(skills, request, adapter) eligibility before ranking: L25/c:217-221, L25/d:254
- build_invocation_matrix(policy) 2x2 view: L25/c:195, L25/d:253

## Router and installer (annotated-code, 8 lines)
- loadCatalog(root) reads SKILL.md and routing.json: SR/sc:5, 14-48
- rank(skills, query, files) with keyword 2 and path 3: SR/sm:50, 60
- plan(skills, selected, allowed) dependencies first: SR/sm:78-102
- route(..., margin = 1) and four statuses: SR/sm:104-125
- safePath(name) rejects dot segments, absolute paths, drive prefixes, backslashes: SI/sm:23-31
- translate(bundle, agent) regenerates quoted header, keeps body: SI/sm:64-75
- digest(bundle.files) SHA-256 over sorted pairs: SI/sm:55-63, 83
- install(root, bundle, agent, expectedDigest) staged rename with backup: SI/sm:76-81, 134-156

## Human and model invocation (comparison, 4 rows)
- Human can invoke row, shared and human-only: L25/d:62-65
- Model can invoke row, shared and model-only: L25/d:62-65
- One host field row, default both: L25/d:69
- Example row, test planning, publish preparation, internal style guide, deprecated package: L25/d:62-65
- default both, disable-model-invocation: true human-only, user-invocable: false model-only: L25/d:69

## Limits and defaults (defaults, 8)
- name at most 64, NAME_PATTERN: L22/c:19, 150-151
- description at most 1024, what and when: L22/c:171-174, L22/d:244
- compatibility at most 500: L22/c:187-191
- max_description_chars 240: L24/c:33
- max_catalog_chars 8_000: L24/c:34
- max_chars 12_000 for body and reference: L24/c:289, 329
- model_threshold 0.2: L25/c:44
- margin = 1, smaller gap is ambiguous: SR/sm:109, 114-115

## Failures and fixes (troubleshooting, 8)
- no-match when nothing scored: SR/sm:70, 113
- ambiguous when gap below margin: SR/sm:114-115, SR/project.json:103
- blocked with permission denied: SR/sm:93-94, 122-123
- unsupported YAML syntax for tags, aliases, multiline and flow values; plain or double-quoted scalars accepted: SV/solution/stage1.rs:22-27, SV/README.md:5, 37
- integrity mismatch, inspect gives source_digest: SI/sm:83-84, SI/sc:12-18
- modified installation, move edit into source bundle: SI/sm:113-118, SI/stages/04-upgrades/docs/en.md:5
- skill unavailable, rescan or new session: L22/d:110-111, 150-151
- model never picks it, discovery log and catalog budget: L24/d:40-48, 173-177

## Writing rules (tips, 6)
- name matches parent directory: L22/d:244
- capability clause plus trigger clause: L24/d:105-111
- negative boundary and near misses: L25/d:120, 167-173
- eligibility first, then rank, abstain: L25/d:142-147
- no raw arguments in shell commands: L25/d:190
- dependency with fallback, stop when unavailable: L22/d:339-341

## Questions (qa, 5)
- hook vs skill: L22/d:389-390
- tool vs skill: L22/d:391, 318
- explicit invocation still passes policy: L25/d:89
- router emits plans, never executes: SR/README.md:37
- install does not prove activation: SI/README.md:37
