# Check local runbook references

**Type:** Build
**Language:** TypeScript
**Stage:** 3 of 4
**Time:** ~2 hours
**Prerequisites:** Basic TypeScript, JSON objects, arrays and running Node 22.18 or newer. Complete the preceding stages first.

## What you build

Check that a handoff points to a supplied runbook and resolvable local references.

## Public contract

```typescript
checkRunbook(catalog:Catalog,service:Service):{path,exists,headings,links,issues}
```

Check runbook presence and Markdown heading lines. Parse inline Markdown links; resolve relative paths from the runbook directory and verify them against supplied files. Ignore HTTP(S) links and same-page fragments because they are not fetched. Detect traversal above repository root, missing linked files and heading-free documents.

The initial workspace contains public types, function stubs, the CLI, and original input fixtures. Change `main.ts`; the CLI is already supplied. Stages accumulate without replacing your earlier implementation. Tests import the learner workspace selected by `PROJECT_WORKSPACE`.

## Worked example

runbooks/images.md links queue.md, which resolves to runbooks/queue.md and exists. rollback.md resolves to runbooks/rollback.md and is reported missing; the report does not invent a recovery procedure.

```figure
pj-service-ownership-navigator-3
```

Change the figure controls, predict the intermediate values, and compare the calculation with your implementation. The figure explains the mechanism; the grader runs the real functions.

## Implement and verify

```bash
python3 scripts/project_test.py service-ownership-navigator --init my-service-ownership-navigator
python3 scripts/project_test.py service-ownership-navigator --stage 3 --path my-service-ownership-navigator --strict
```

Initialize once. The fresh first stage intentionally fails with a named not-implemented error. Preserve the signatures and reject malformed inputs with useful errors. Keep inputs unchanged. Each stage includes separate held-out inputs; passing the demonstration alone is insufficient.

## Failure cases and hints

This checks existence and structure, not operational accuracy or remote URL health. Preserve missing link evidence.

## Use your result

After stage four, pass a JSON file of your own through the same entry point:

```bash
cd my-service-ownership-navigator
node cli.ts sample.json output
```

Static service directory and source-backed ownership lookup JSON. Open `output/report.html` and inspect the machine-readable companion files.

## Extend it

Add an opt-in HTTP checker with deadlines and an explicit target allowlist.

Scope: This project uses a documented local ownership-rule format. It does not implement the full GitHub CODEOWNERS format. It operates entirely on supplied local data. It checks runbook references without executing instructions or sending notifications.
