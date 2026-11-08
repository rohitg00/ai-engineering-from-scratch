# UI String Localization Workbench

Help a small product team localize JSON message catalogs while retaining stable keys, variable placeholders and contextual notes. Compare recorded or real provider proposals in a UI preview, require review of ambiguous strings, and export an approved locale catalog and unresolved-string queue.

You build reviewed locale JSON, an interactive message preview and unresolved-strings.json.

## Run the tool on your own input

Requires Node 22.18 or newer. No package install, API key, network account or provider is needed.

```bash
cd projects/ui-string-localization-workbench/solution
node cli.ts sample.json output
```

`sample.json` is original project data. Copy it, edit the values, and pass the new filename to the same command. `node cli.ts --help` documents the arguments. The report is output/report.html. JSON files preserve the evidence used by the interface.

## Build it yourself

```bash
python3 scripts/project_test.py ui-string-localization-workbench --init my-ui-string-localization-workbench
python3 scripts/project_test.py ui-string-localization-workbench --stage 1 --path my-ui-string-localization-workbench --strict
python3 scripts/project_test.py ui-string-localization-workbench --all --path my-ui-string-localization-workbench --strict --report completion.json
```

The first run fails until you implement the first stage. The initial starter supplies every public type, function signature, CLI wrapper and input fixture. Later stages add behavior in the same file.

1. [Read message keys, placeholders and context](stages/01-catalog-contract/docs/en.md)
2. [Generate bounded translation proposals](stages/02-recorded-proposals/docs/en.md)
3. [Preview strings with supplied interpolation values](stages/03-message-preview/docs/en.md)
4. [Export approved locale and unresolved questions](stages/04-approved-catalog/docs/en.md)

## Contracts and integration

- `placeholders(text:string):string[]; readCatalog(value:unknown):Message[]`
- `proposeTranslations(messages:Message[],recorded:unknown,locale:string):Proposal[]`
- `previewMessage(template:string,values:Record<string,string|number>):string`
- `reviewTranslations(messages,proposals,value?):{catalog,unresolved,review}; renderWorkbench(messages,proposals,state,locale,values?):string`

Read the stage documentation for exact input and return shapes, worked intermediate values, failure behavior and held-out cases. Import these functions from `main.ts` to reuse the tool from another TypeScript program. The HTML runs locally and its review downloads can be passed back to the CLI when documented; it never submits data to a third-party service.

## Verification and scope

```bash
python3 scripts/project_test.py ui-string-localization-workbench --all --solution --strict
```

Translations are recorded original proposals supplied in the input, not a live provider integration or a quality guarantee. This teaching subset supports simple named placeholders, not ICU messages. Locale tags affect preview language metadata; reviewers judge translation meaning.

The core implementation, fixtures and lesson prose are original. Local reference checks do not grant a learner certificate. Learner completion is self-reported evidence from the full grader, not external certification.
