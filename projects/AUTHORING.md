# Project authoring contract

Each project teaches a useful artifact through four to eight incremental stages. Each stage adds a distinct behavior, explains a concrete example, and tests the learner's implementation. Reference solutions and demonstrations run offline with standard libraries. A policy simulator must identify itself as a simulator; never claim it provides operating-system isolation.

## Planned projects

Keep unbuilt ideas in `projects/roadmap.json` under `planned`. Give each a unique `id`, `title`, `level`, `languages`, `source`, `tagline`, `summary`, concrete `output`, four proposed `milestones`, and `prerequisiteProjects` IDs. Add `distinctFrom` and `firstDemo` to explain its independent teaching focus. A starter plan may have no project prerequisite. Planned prerequisite links must resolve and must not form cycles.

Keep the readable briefs in [ROADMAP.md](ROADMAP.md) aligned with that metadata. Use `status: "planned"`; do not create empty reference implementations or completion claims. When a real project satisfies the ready contract, its ready manifest replaces the planned card in the built catalog.

## Files and metadata

`projects/<id>/project.json` owns the catalog metadata. `id` matches the directory and uses lowercase words separated by hyphens. Required fields are `title`, `tagline`, `summary`, `level` (1 through 5), `hours`, `languages`, `status` (`draft` or `ready`), `source` (`core` or `community`), and a nonempty `stages` array. Stage IDs are unique. README, solution, each stage's documentation, tests, and starter files must exist before `ready` is accepted. Draft projects never appear as ready.

```json
{
  "id": "example-project",
  "title": "Example Project",
  "tagline": "A concrete useful artifact.",
  "summary": "What you build and how you verify it.",
  "level": 2,
  "hours": 8,
  "languages": ["Python", "TypeScript"],
  "status": "draft",
  "source": "community",
  "author": {"name": "Your Name", "github": "your-handle"},
  "demo": {"command": ["python3", "demo.py"], "cwd": "solution"},
  "stages": [
    {
      "id": "01-first-stage",
      "title": "First stage",
      "summary": "One specific new capability.",
      "hours": 2,
      "difficulty": "starter",
      "concepts": ["input validation"],
      "language": "python",
      "timeout": 60
    }
  ]
}
```

Each stage lives at `stages/<stage-id>/`, with `docs/en.md`, `starter/`, and `tests/`. The cumulative reference implementation lives in `solution/`. Starter paths are relative to the learner's workspace. Initialization copies every regular file, including `.rs`, `.ts`, `.go`, fixtures and module files. It preserves existing files unless `--force` is explicit. Avoid repeating evolving source files in later starters: scaffolding should accumulate without overwriting the learner's work.

## Grader runners

Each stage declares `language`: `python`, `typescript`, `rust`, or `go`. Mixed stages use `language: "rust+python"` plus `runners: [{"language":"rust"},{"language":"python"}]`. The grader sets `PROJECT_WORKSPACE`, `PROJECT_ROOT`, and `PROJECT_STAGE` to absolute paths for every runner, and prepends the workspace to `PYTHONPATH`.

- Python discovers `tests/test_*.py` with `unittest`. Import the learner's package normally.
- TypeScript uses Node 22.18 or later, `--experimental-strip-types`, and `node --test` with `tests/*.test.ts` or `tests/*.test.mjs`. Import the learner's file using `pathToFileURL(path.join(process.env.PROJECT_WORKSPACE, 'main.ts'))`. Use erasable TypeScript syntax.
- Rust compiles each `tests/*.rs` separately with `rustc --edition 2021 --test`, then runs the binary. Import learner code with `include!(concat!(env!("PROJECT_WORKSPACE"), "/main.rs"));`, usually inside a module. No Cargo dependency is required.
- Go copies the workspace and stage `tests/*.go` into a temporary directory and runs `go test -json ./...`. Include `go.mod` for modular workspaces; without it the runner uses `GO111MODULE=off`. Stage test paths relative to `tests/` are preserved in the temporary workspace.

An explicit single runner is an argv array: `"runner": ["node", "--experimental-strip-types", "--test", "{tests}/stage.test.ts"]`. Multiple runners use `"runners": [{"language":"python","argv":["python3","-m","unittest","discover","-s","{tests}"]}]`. Supported substitutions are `{workspace}`, `{project}`, `{stage}`, and `{tests}`. Commands run without a shell. Custom runners must emit the selected language's standard test-runner summary; exit status zero with no tests is a failure.

Optional `requires: ["rustc"]` lists executable prerequisites. Runner settings inherit stage `requires` and `timeout` (seconds, positive, maximum 600). Missing tools produce `skip`; normal grading can continue with exit status zero, but `--strict` makes any skip fail the command. Test-level skips always prevent completion evidence. Timeouts and failed tests fail the command. Tool detection, test counts, skipped tests, and each runner's status are written into the report.

## Commands and completion evidence

```bash
python3 scripts/project_test.py example-project --init /tmp/example-work
python3 scripts/project_test.py example-project --stage 2 --path /tmp/example-work
python3 scripts/project_test.py example-project --all --solution --strict
python3 scripts/project_test.py --all --solution --strict
python3 scripts/project_test.py example-project --all --path /tmp/example-work --strict --report /tmp/example-result.json
```

`--stage N` checks stages 1 through N; `--only` checks just the selected stage. `--all` without a project checks every published ready project. A JSON report has `schemaVersion: 1`, `generatedAt`, `projects`, and aggregate `certificateEligible`. Each project contains `id`, `title`, `mode`, `manifestHash`, `selectedStages`, `stages`, `allStagesPassed`, and `certificateEligible`. Each stage contains `id`, `number`, `language`, `status` (`pass`, `fail`, or `skip`), `tests`, `skippedTests`, `durationMs`, `reason`, and `runners`.

A learner is eligible only when every declared stage ran and passed at least one test with no skipped test. Reference-solution runs, missing runtimes, partial selections, and failed stages never grant a certificate. This is local, self-reported evidence, not a cryptographic identity or anti-cheating system.

## Documentation, figures, and demos

Every lesson explains what you build, why it matters, a worked example, exact function contracts, test commands, failure cases, and extensions. Include a registered mechanism in a `figure` fence. Use an original SVG figure provider at `site/figures/projects/<id>.js`, calling `window.AIFSProjectFigures.register('pj-<id>-1', {title, steps: [{label, detail}], caption})`. Each figure should explain the stage's specific mechanism and state transitions. Give learners editable inputs and computed intermediate values; a row of boxes that only changes its highlighted label is not enough.

Add a `lab` to the registration for a calculated mechanism:

```javascript
lab: {
  controls: [
    {key: 'events', label: 'Completed events', type: 'range', value: 3, min: 0, max: 10, step: 1}
  ],
  calculate(values, stepIndex) {
    return {
      summary: values.events + ' receipts remain available for inspection.',
      metrics: [{label: 'Receipts', value: values.events}],
      bars: [{label: 'Completed events', value: values.events, max: 10}]
    };
  }
}
```

Controls support `range`, `number`, `text`, `select` and `checkbox`. Select options contain `value` and `label`. Calculations may also return `columns` and `rows` for an evidence table. The shared runtime validates finite numeric inputs, escapes displayed text, preserves focus and offers reset. Use domain-specific calculations that agree with the taught contract. Existing custom SVG providers can call `window.AIFSProjectFigures.mountLab(host, lab)` without replacing their animation.

Optional stage `figure` identifies a registered mechanism. The builder also extracts figures from documentation and emits `figures` and `figureScripts`. Unknown figure IDs fail a ready build. Demo metadata uses an argv `command` and project-relative `cwd`, commonly `solution`. Optional `path`, `poster`, or `video` fields refer to files inside the project. Demos terminate and show real output. Path traversal and symlink escapes are rejected.

## Publication checks

Write at least five meaningful tests per stage: ordinary inputs, boundaries, malformed inputs, and a failure or adversarial case. Keep a held-out case separate from the demonstration fixtures. Test observable contracts, not copies of the reference algorithm. All advertised languages must exercise real implementation code. Cite current official specifications and documentation for protocols, with original lesson prose and original code.

Require a documented command that accepts the learner's own input and composes the taught functions. A hardcoded demo alone does not establish a reusable tool. Name the output schema, integration command and scope of any live adapter. Confirm that one exported artifact can be consumed by its intended next step, including approval or progress files downloaded from an HTML interface.

Stage tests must depend only on behavior already taught or explicitly supplied scaffolding. Keep function signatures precise in starters, explain every hidden prerequisite and show one complete worked input through its intermediate values. A beginner should be able to locate a failure without guessing the intended return shape.

Run the solution with `--all --solution --strict`, initialize a fresh workspace, and confirm its first stage fails clearly. Run `node --test site/test_projects_data.js site/test_project_certificates.js` and `node site/build-projects.js --strict` before review. Inspect the served page in Chromium at desktop and mobile widths, in both themes. Check that controls change calculated output and that recordings match the current commands. HTML output recordings should show the actual generated interface and its evidence interactions. Generated `site/projects-data.js` is not committed. Community submissions retain their author credit and are reviewed through a pull request.

## Optional framework comparisons

A stage can add an optional SDK comparison without making the offline core depend on a framework:

```json
{
  "runners": [
    {"language": "python"},
    {
      "language": "python",
      "optional": true,
      "requires": ["python:google.adk"],
      "argv": ["{python}", "-m", "unittest", "discover", "-s", "{stage}/tests-framework", "-p", "test_framework.py"]
    }
  ]
}
```

`{python}` uses the current grader interpreter. Dependency declarations accept executable names, `python:module.name`, and `node:package-name`. Python and Node probes resolve package locations without importing the dependency. Missing packages produce `skip` with an installation hint; authors document pinned, supported dependency versions separately because import names and distribution names can differ.

Run `--optional` to include these runners. `--optional --strict` fails on an absent dependency. Default completion evidence covers the required offline core only; it does not claim framework proficiency. If optional runners are selected, their failures or skips also prevent completion. Keep optional instructor tests under the stage's `tests-framework/`, separate from the core `tests/`, and import learner implementation code from `PROJECT_WORKSPACE`.
