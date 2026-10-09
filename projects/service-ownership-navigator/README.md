# Service Ownership Navigator

Combine an authored service catalog, repository ownership rules and runbook links into a local directory. Resolve ownership at the requested path, surface conflicts and missing runbooks, and answer handoff questions with file-level evidence. Export a static site and JSON lookup interface without sending notifications.

You build static service directory and source-backed ownership lookup JSON.

## Run the tool on your own input

Requires Node 22.18 or newer. No package install, API key, network account or provider is needed.

```bash
cd projects/service-ownership-navigator/solution
node cli.ts sample.json output
```

`sample.json` is original project data. Copy it, edit the values, and pass the new filename to the same command. `node cli.ts --help` documents the arguments. The report is output/report.html. JSON files preserve the evidence used by the interface.

## Build it yourself

```bash
python3 scripts/project_test.py service-ownership-navigator --init my-service-ownership-navigator
python3 scripts/project_test.py service-ownership-navigator --stage 1 --path my-service-ownership-navigator --strict
python3 scripts/project_test.py service-ownership-navigator --all --path my-service-ownership-navigator --strict --report completion.json
```

The first run fails until you implement the first stage. The initial starter supplies every public type, function signature, CLI wrapper and input fixture. Later stages add behavior in the same file.

1. [Load service metadata and ownership rules](stages/01-load-evidence/docs/en.md)
2. [Resolve paths and conflicting ownership evidence](stages/02-resolve-paths/docs/en.md)
3. [Check local runbook references](stages/03-check-runbooks/docs/en.md)
4. [Export a searchable directory and cited handoff packet](stages/04-export-handoff/docs/en.md)

## Contracts and integration

- `parseOwnershipRules(text:string,source?:string):Rule[]; loadCatalog(value:unknown):Catalog`
- `matchesRule(pattern:string,path:string):boolean; resolveOwnership(catalog:Catalog,path:string):Ownership`
- `checkRunbook(catalog:Catalog,service:Service):{path,exists,headings,links,issues}`
- `handoffPacket(catalog:Catalog,path:string):{schemaVersion:1,ownership,runbook,dependencies}; renderDirectory(catalog,packet):string`

Read the stage documentation for exact input and return shapes, worked intermediate values, failure behavior and held-out cases. Import these functions from `main.ts` to reuse the tool from another TypeScript program. The HTML runs locally and its review downloads can be passed back to the CLI when documented; it never submits data to a third-party service.

## Verification and scope

```bash
python3 scripts/project_test.py service-ownership-navigator --all --solution --strict
```

This is a documented subset inspired by repository ownership files, not a complete GitHub CODEOWNERS emulator. It operates entirely on supplied local data. It checks runbook references without executing instructions or sending notifications.

The core implementation, fixtures and lesson prose are original. Local reference checks do not grant a learner certificate. Learner completion is self-reported evidence from the full grader, not external certification.
