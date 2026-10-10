# Export a searchable directory and cited handoff packet

**Type:** Build
**Language:** TypeScript
**Stage:** 4 of 4
**Time:** ~2 hours
**Prerequisites:** Basic TypeScript, JSON objects, arrays and running Node 22.18 or newer. Complete the preceding stages first.

## What you build

Export a local handoff with every ownership answer linked to evidence.

## Public contract

```typescript
handoffPacket(catalog:Catalog,path:string):{schemaVersion:1,ownership,runbook,dependencies}; renderDirectory(catalog,packet):string
```

Packet includes resolved ownership, local runbook report and catalog owner lists for direct service dependencies. HTML includes a searchable directory, runbook content, source table and exact handoff.json download. Source line 0 means a catalog entry rather than a text line.

The initial workspace contains public types, function stubs, the CLI, and original input fixtures. Change `main.ts`; the CLI is already supplied. Stages accumulate without replacing your earlier implementation. Tests import the learner workspace selected by `PROJECT_WORKSPACE`.

## Worked example

The handoff JSON names the exact lookup path, effective owner, all matching rule lines, missing rollback reference and queue dependency owners. The HTML search can find a service by its root or catalog owner.

```figure
pj-service-ownership-navigator-4
```

Change the figure controls, predict the intermediate values, and compare the calculation with your implementation. The figure explains the mechanism; the grader runs the real functions.

## Implement and verify

```bash
python3 scripts/project_test.py service-ownership-navigator --init my-service-ownership-navigator
python3 scripts/project_test.py service-ownership-navigator --stage 4 --path my-service-ownership-navigator --strict
```

Initialize once. The fresh first stage intentionally fails with a named not-implemented error. Preserve the signatures and reject malformed inputs with useful errors. Keep inputs unchanged. Each stage includes separate held-out inputs; passing the demonstration alone is insufficient.

## Failure cases and hints

Do not notify owners or imply the runbook was exercised. Escape authored Markdown as plain text instead of injecting it as HTML.

## Use your result

After stage four, pass a JSON file of your own through the same entry point:

```bash
cd my-service-ownership-navigator
node cli.ts sample.json output
```

Static service directory and source-backed ownership lookup JSON. Open `output/report.html` and inspect the machine-readable companion files. Import loadCatalog and handoffPacket for programmatic lookups. JSON.parse(handoff.json) exposes ownership.owners, ownership.evidence and runbook.issues for the next handoff step.

## Extend it

Integrate the JSON lookup interface with a local command launcher.

Scope: This project uses a documented local ownership-rule format. It does not implement the full GitHub CODEOWNERS format. It operates entirely on supplied local data. It checks runbook references without executing instructions or sending notifications.
