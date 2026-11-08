# Vocabulary Autocomplete Pad

Help a writer reuse their own terminology with a small local autocomplete model built from token counts, prefixes and short word histories. Show the evidence behind each suggestion and export an interactive writing pad plus a portable vocabulary model for another editor.

You build a local autocomplete writing page and vocabulary-model.json.

## Run the tool on your own input

Requires Node 22.18 or newer. No package install, API key, network account or provider is needed.

```bash
cd projects/vocabulary-autocomplete-pad/solution
node cli.ts sample.json output
```

`sample.json` is original project data. Copy it, edit the values, and pass the new filename to the same command. `node cli.ts --help` documents the arguments. The report is output/report.html. JSON files preserve the evidence used by the interface.

## Build it yourself

```bash
python3 scripts/project_test.py vocabulary-autocomplete-pad --init my-vocabulary-autocomplete-pad
python3 scripts/project_test.py vocabulary-autocomplete-pad --stage 1 --path my-vocabulary-autocomplete-pad --strict
python3 scripts/project_test.py vocabulary-autocomplete-pad --all --path my-vocabulary-autocomplete-pad --strict --report completion.json
```

The first run fails until you implement the first stage. The initial starter supplies every public type, function signature, CLI wrapper and input fixture. Later stages add behavior in the same file.

1. [Tokenize a corpus and count word histories](stages/01-count-histories/docs/en.md)
2. [Rank prefix and next-word candidates](stages/02-rank-candidates/docs/en.md)
3. [Accept suggestions in a writing pad](stages/03-accept-suggestions/docs/en.md)
4. [Export the learned model and editor function](stages/04-portable-model/docs/en.md)

## Contracts and integration

- `tokenize(text: string): string[]; train(corpus: unknown): Model`
- `suggest(model: Model, prefix: string, history?: string[], limit?: number): Suggestion[]`
- `completeText(model: Model, text: string, limit?: number): {prefix:string;history:string[];suggestions:Suggestion[]}; acceptSuggestion(text:string,prefix:string,word:string):string`
- `importModel(value: unknown): Model; renderPad(model: Model, initial?: string): string`

Read the stage documentation for exact input and return shapes, worked intermediate values, failure behavior and held-out cases. Import these functions from `main.ts` to reuse the tool from another TypeScript program. The HTML runs locally and its review downloads can be passed back to the CLI when documented; it never submits data to a third-party service.

## Verification and scope

```bash
python3 scripts/project_test.py vocabulary-autocomplete-pad --all --solution --strict
```

This is a transparent count-based local language model, not a hosted LLM. It suggests a single next token with up to two tokens of context. The browser editor operates at the end of input. No provider adapter is implied.

The core implementation, fixtures and lesson prose are original. Local reference checks do not grant a learner certificate. Learner completion is self-reported evidence from the full grader, not external certification.
