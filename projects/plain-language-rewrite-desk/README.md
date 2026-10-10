# Plain Language Rewrite Desk

Help a technical author revise dense prose using visible sentence and vocabulary measures, protected terms and an optional real rewriting provider. Compare original and proposed paragraphs, surface changed numbers and missing definitions, and export only the author's accepted revisions with a Markdown change record.

You build accepted Markdown, a paragraph-level HTML comparison and revision-decisions.json.

## Run the tool on your own input

Requires Node 22.18 or newer. No package install, API key, network account or provider is needed.

```bash
cd projects/plain-language-rewrite-desk/solution
node cli.ts sample.json output
```

`sample.json` is original project data. Copy it, edit the values, and pass the new filename to the same command. `node cli.ts --help` documents the arguments. The report is output/report.html. JSON files preserve the evidence used by the interface.

## Build it yourself

```bash
python3 scripts/project_test.py plain-language-rewrite-desk --init my-plain-language-rewrite-desk
python3 scripts/project_test.py plain-language-rewrite-desk --stage 1 --path my-plain-language-rewrite-desk --strict
python3 scripts/project_test.py plain-language-rewrite-desk --all --path my-plain-language-rewrite-desk --strict --report completion.json
```

The first run fails until you implement the first stage. The initial starter supplies every public type, function signature, CLI wrapper and input fixture. Later stages add behavior in the same file.

1. [Segment prose and record protected terms and facts](stages/01-record-facts/docs/en.md)
2. [Produce simpler candidate paragraphs](stages/02-propose-rewrites/docs/en.md)
3. [Compare omissions, numbers and readability measures](stages/03-compare-facts/docs/en.md)
4. [Export accepted revisions and a change record](stages/04-accepted-export/docs/en.md)

## Contracts and integration

- `segmentProse(text:string,protectedTerms?:string[]):Paragraph[]`
- `proposeParagraphs(paragraphs:Paragraph[],recorded?:Record<string,string>):{id,candidate,method}[]`
- `measures(text:string):{words,sentences,averageWords,longWords}; compareParagraphs(paragraphs,proposals,definitions?):Comparison[]`
- `exportRevisions(comparisons,value?):{markdown,changeRecord,decisions,unresolved}; renderDesk(comparisons,state):string`

Read the stage documentation for exact input and return shapes, worked intermediate values, failure behavior and held-out cases. Import these functions from `main.ts` to reuse the tool from another TypeScript program. The HTML runs locally and its review downloads can be passed back to the CLI when documented; it never submits data to a third-party service.

## Verification and scope

```bash
python3 scripts/project_test.py plain-language-rewrite-desk --all --solution --strict
```

The baseline uses deterministic phrase substitutions and recorded author proposals. No live model adapter is shipped. Numeric, protected-term and definition checks are lexical safeguards, not a proof that every fact or nuance is preserved. The author reviews meaning.

The core implementation, fixtures and lesson prose are original. Local reference checks do not grant a learner certificate. Learner completion is self-reported evidence from the full grader, not external certification.
