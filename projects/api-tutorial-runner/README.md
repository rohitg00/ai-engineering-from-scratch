# API Tutorial Runner

Help a documentation author verify a sequence of HTTP examples. Parse explicit request blocks, substitute only declared variables from prior responses, and run against a local fixture or an opted-in test endpoint. Produce a source-linked report that exposes stale examples and lets an assistant propose a reviewed correction.

You build replayable request manifest, JUnit results and annotated tutorial HTML.

## Run the tool on your own input

Requires Node 22.18 or newer. No package install, API key, network account or provider is needed.

```bash
cd projects/api-tutorial-runner/solution
node cli.ts sample.json output
```

`sample.json` is original project data. Copy it, edit the values, and pass the new filename to the same command. `node cli.ts --help` documents the arguments. Exports replayable requests.json, results.json, junit.xml, report.html and corrections.json. The sample deliberately demonstrates one stale field failure; the report command succeeds after writing evidence, while receipts record the failure.

## Build it yourself

```bash
python3 scripts/project_test.py api-tutorial-runner --init my-api-tutorial-runner
python3 scripts/project_test.py api-tutorial-runner --stage 1 --path my-api-tutorial-runner --strict
python3 scripts/project_test.py api-tutorial-runner --all --path my-api-tutorial-runner --strict --report completion.json
```

The first run fails until you implement the first stage. The initial starter supplies every public type, function signature, CLI wrapper and input fixture. Later stages add behavior in the same file.

1. [Extract explicit requests from an authored tutorial](stages/01-extract-requests/docs/en.md)
2. [Resolve typed variables across steps](stages/02-typed-variables/docs/en.md)
3. [Run bounded requests against a test service](stages/03-bounded-http/docs/en.md)
4. [Export source-linked failures and correction proposals](stages/04-source-linked-report/docs/en.md)

## Contracts and integration

- `extractRequests(markdown:string):RequestStep[]`
- `resolveValue(value:unknown,variables:Record<string,string|number|boolean>):unknown; captureVariables(body,declarations,previous?):Record<string,string|number|boolean>`
- `runTutorial(steps:RequestStep[],baseURL:string,options?):Promise<Receipt[]>`
- `exportResults(steps,receipts):{junit,html,corrections}; acceptedCorrections(receipts,value):{id,line,proposal}[]`

Read the stage documentation for exact input and return shapes, worked intermediate values, failure behavior and held-out cases. Import these functions from `main.ts` to reuse the tool from another TypeScript program. The HTML runs locally and its review downloads can be passed back to the CLI when documented; it never submits data to a third-party service.

## Verification and scope

```bash
python3 scripts/project_test.py api-tutorial-runner --all --solution --strict
```

The default fixture is an actual temporary loopback HTTP server serving authored JSON routes. It is a tutorial checker, not a production load tester. External test endpoints require the --allow-network flag. Responses are JSON; redirects, streaming protocols, credentials and full OpenAPI validation are outside this subset.

The core implementation, fixtures and lesson prose are original. Local reference checks do not grant a learner certificate. Learner completion is self-reported evidence from the full grader, not external certification.
