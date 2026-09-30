# Feedback Theme Board

Group product feedback with inspectable phrase evidence, count distinct sources, and export local issue drafts.

You finish with a portable evidence board, JSON summary and unsent Markdown investigation drafts.

## Run the finished tool

From the repository root:

```bash
cd projects/feedback-theme-board/solution
node cli.ts sample.jsonl themes.json output
```

The sample is authored for this project. Substitute your own input through the same CLI. No model key is needed for the baseline. See the command help before enabling an optional external adapter.

## Build it yourself

Start with [development setup](../../phases/00-setup-and-tooling/01-dev-environment/docs/en.md) and [data management](../../phases/00-setup-and-tooling/09-data-management/docs/en.md). You should be able to read a JSON object, call a function, run a terminal command and interpret a failing test before starting.

```bash
python3 scripts/project_test.py feedback-theme-board --init my-feedback-theme-board
python3 scripts/project_test.py feedback-theme-board --stage 1 --path my-feedback-theme-board --strict
python3 scripts/project_test.py feedback-theme-board --all --path my-feedback-theme-board --strict --report completion.json
```

The fresh workspace intentionally fails until you implement the functions. The CLI, input files and public types are supplied so completion does not require copying a reference entry point. Work through the stages in order:

1. [Import feedback with stable identities](stages/01-import-feedback/docs/en.md)
2. [Match phrases while preserving original spans](stages/02-match-evidence/docs/en.md)
3. [Count evidence without inflating source support](stages/03-count-without-inflation/docs/en.md)
4. [Publish evidence and reviewable investigation drafts](stages/04-publish-and-integrate/docs/en.md)

## Reuse the artifact

The CLI and importable functions consume ordinary local files and return structured output. Keep input identity and explicit failure metadata when integrating with another program. The HTML output has no third-party scripts and can be shared after inspecting the included source data.

## Verification and scope

```bash
python3 scripts/project_test.py feedback-theme-board --all --solution --strict
```

The baseline matches explicit word phrases, not semantic sentiment or truth. Distinct source labels are not verified people or market size. Optional model suggestions produce a separate proposed configuration that must be reviewed before use; nothing posts to an issue tracker.

Grading validates the supplied deterministic contracts. A learner certificate is a self-attested completion record; it does not claim live-provider verification or professional certification. Read the JSON receipt and test at least one new input before treating the tool as integrated.

Primary reference: [JSON text interchange, RFC 8259](https://www.rfc-editor.org/rfc/rfc8259).
