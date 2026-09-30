# Submitting a project

Build an artifact somebody can use after finishing the course. Teach it through four to eight stages, and make the entire reference path runnable offline without API keys. See [AUTHORING.md](AUTHORING.md) for the exact manifest, runner, figure, demonstration, and completion-evidence contracts.

## Pick a useful outcome

Good projects deliver a report generator, evidence index, skill validator, memory service, workflow tool, protocol server, or evaluation harness. Bound the scope honestly. A fixture backend teaches a desktop protocol; label it clearly rather than describing it as an operating-system integration.

Projects must use original implementations and lessons. Cite official documentation, specifications, and research papers for technical facts. Avoid personal-data scraping, security-control evasion, or a hosted-model call with no substantive engineering exercise.

## Create the project

```bash
cp -R projects/_template projects/your-project-id
```

Use a lowercase, hyphenated ID matching the directory. Set `source` to `community` and retain your name and GitHub handle in `author`. Keep `status` as `draft` while you develop the stages. The catalog preserves authorship and never promotes drafts automatically.

The template has one small Python stage to demonstrate the contract. Extend it to four to eight stages and replace the example with your own artifact. Python, TypeScript, Rust, and Go use standard-library runners. Mixed projects declare the real runner for each stage. Include every module and fixture a fresh learner workspace needs.

## Teach and verify each stage

Explain the useful behavior, the governing invariant, one worked example, exact public function signatures, errors, and a command the learner can copy. Every stage needs five meaningful tests, a failure case, a starter that clearly fails, and an original registered mechanism figure. Tests must load the learner's workspace, never quietly import the checked-in solution.

Later starters add files without overwriting earlier work. The initializer preserves existing files, including learner implementations, unless the learner explicitly passes `--force`. Include a held-out test or dataset, a measured evaluation result, and named end states for loops and budgets.

## Demonstrate the artifact

Declare a terminating argv command under `demo`, for example `{"command":["python3","demo.py"],"cwd":"solution"}`. Record real output and commit the GIF or video and its poster under the project's `media/` directory. Declare those relative paths in `demos`. The site bundles lessons and recordings with its build so a preview does not depend on unpublished files on GitHub main.

## Validate and submit

```bash
python3 scripts/project_test.py your-project-id --all --solution --strict
python3 scripts/project_test.py your-project-id --init /tmp/your-project-check
python3 scripts/project_test.py your-project-id --stage 1 --path /tmp/your-project-check
node --test site/test_projects_data.js
node site/build-projects.js --strict
```

The reference solution must pass every stage without skipped tests. The fresh starter must fail with an actionable implementation message. Strict mode rejects missing runtimes, empty suites, skipped tests, missing figures, and absent recordings. Do not commit generated `site/projects-data.js` or `site/project-content/` files.

Open a feature-branch pull request. A maintainer reviews the original lessons, tests the reference artifact, tries the first stages as a learner, and checks the rendered project on the website. Completion certificates use full learner grading reports; reference-solution results and manual checkboxes do not establish completion.
