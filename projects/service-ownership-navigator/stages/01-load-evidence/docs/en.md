# Load service metadata and ownership rules

**Type:** Build
**Language:** TypeScript
**Stage:** 1 of 4
**Time:** ~2 hours
**Prerequisites:** Basic TypeScript, JSON objects, arrays and running Node 22.18 or newer. Complete the preceding stages first.

## What you build

Keep source positions while combining service metadata and repository rules.

## Public contract

```typescript
parseOwnershipRules(text:string,source?:string):Rule[]; loadCatalog(value:unknown):Catalog
```

Service `{id,name,root,owners,runbook,dependencies}` has a unique id/root and known dependency IDs. Owners are @user or @org/team names. Input runbooks maps repository-relative paths to Markdown. CODEOWNERS subset permits comments, whitespace-separated owner lists and patterns using *,**,? with optional leading/trailing slash. Reject negation, bracket patterns, backslashes and parent traversal. Rules retain 1-based line and source.

The initial workspace contains public types, function stubs, the CLI, and original input fixtures. Change `main.ts`; the CLI is already supplied. Stages accumulate without replacing your earlier implementation. Tests import the learner workspace selected by `PROJECT_WORKSPACE`.

## Worked example

Line 2 `/services/ @fictional/platform` retains source CODEOWNERS and line 2. The catalog separately says images belongs to @fictional/media; that is evidence with a different origin.

```figure
pj-service-ownership-navigator-1
```

Change the figure controls, predict the intermediate values, and compare the calculation with your implementation. The figure explains the mechanism; the grader runs the real functions.

## Implement and verify

```bash
python3 scripts/project_test.py service-ownership-navigator --init my-service-ownership-navigator
python3 scripts/project_test.py service-ownership-navigator --stage 1 --path my-service-ownership-navigator --strict
```

Initialize once. The fresh first stage intentionally fails with a named not-implemented error. Preserve the signatures and reject malformed inputs with useful errors. Keep inputs unchanged. Each stage includes separate held-out inputs; passing the demonstration alone is insufficient.

## Failure cases and hints

Resolve relative paths within the supplied repository namespace, never the host filesystem. Duplicate service roots are ambiguous.

## Use your result

After stage four, pass a JSON file of your own through the same entry point:

```bash
cd my-service-ownership-navigator
node cli.ts sample.json output
```

Static service directory and source-backed ownership lookup JSON. Open `output/report.html` and inspect the machine-readable companion files.

## Extend it

Add line-aware catalog parsing if catalog-entry evidence needs exact JSON line numbers.

Scope: This project uses a documented local ownership-rule format. It does not implement the full GitHub CODEOWNERS format. It operates entirely on supplied local data. It checks runbook references without executing instructions or sending notifications.
