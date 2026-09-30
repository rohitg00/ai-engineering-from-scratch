# Document Extraction Review Desk

Extract structured fields from a text document, inspect exact source spans, and approve ambiguous values before export.

You finish with a local HTML review desk that downloads source-bound approval decisions and an approved JSON value map.

## Run the finished tool

From the repository root:

```bash
cd projects/document-extraction-desk/solution
python3 cli.py sample.txt --schema schema.json --output output/review.html
```

The sample is authored for this project. Substitute your own input through the same CLI. No model key is needed for the baseline. See the command help before enabling an optional external adapter.

## Build it yourself

Start with [development setup](../../phases/00-setup-and-tooling/01-dev-environment/docs/en.md) and [data management](../../phases/00-setup-and-tooling/09-data-management/docs/en.md). You should be able to read a JSON object, call a function, run a terminal command and interpret a failing test before starting.

```bash
python3 scripts/project_test.py document-extraction-desk --init my-document-extraction-desk
python3 scripts/project_test.py document-extraction-desk --stage 1 --path my-document-extraction-desk --strict
python3 scripts/project_test.py document-extraction-desk --all --path my-document-extraction-desk --strict --report completion.json
```

The fresh workspace intentionally fails until you implement the functions. The CLI, input files and public types are supplied so completion does not require copying a reference entry point. Work through the stages in order:

1. [Define the fields before extracting values](stages/01-define-fields/docs/en.md)
2. [Extract candidates without losing their evidence](stages/02-retain-source-spans/docs/en.md)
3. [Bind approval to one document version](stages/03-review-and-approve/docs/en.md)
4. [Show evidence and export reviewed values](stages/04-export-review-desk/docs/en.md)

## Reuse the artifact

The CLI and importable functions consume ordinary local files and return structured output. Keep input identity and explicit failure metadata when integrating with another program. The HTML output has no third-party scripts and can be shared after inspecting the included source data.

## Verification and scope

```bash
python3 scripts/project_test.py document-extraction-desk --all --solution --strict
```

The core consumes UTF-8 text and explicitly labelled fields; it does not claim OCR or PDF parsing. External OCR or model adapters may supply proposals through --proposals, but every quote and offset is checked. Correct provenance alone does not establish correct field meaning.

Grading validates the supplied deterministic contracts. A learner certificate is a self-attested completion record; it does not claim live-provider verification or professional certification. Read the JSON receipt and test at least one new input before treating the tool as integrated.

Primary reference: [Python regular expression match offsets](https://docs.python.org/3/library/re.html#match-objects).
