# Resolve paths and conflicting ownership evidence

**Type:** Build
**Language:** TypeScript
**Stage:** 2 of 4
**Time:** ~2 hours
**Prerequisites:** Basic TypeScript, JSON objects, arrays and running Node 22.18 or newer. Complete the preceding stages first.

## What you build

Resolve a concrete file using deterministic rule precedence and expose disagreement.

## Public contract

```typescript
matchesRule(pattern:string,path:string):boolean; resolveOwnership(catalog:Catalog,path:string):Ownership
```

Leading slash or a slash-containing pattern anchors at repository root. Bare patterns match a final path segment. * matches within a segment, ** crosses segments, **/ can match zero directories, ? matches one non-slash character; trailing slash matches the directory subtree. Last matching rule wins. Fallback is the most-specific catalog root. Return owners, matchedRules, service, conflicts and source evidence.

The initial workspace contains public types, function stubs, the CLI, and original input fixtures. Change `main.ts`; the CLI is already supplied. Stages accumulate without replacing your earlier implementation. Tests import the learner workspace selected by `PROJECT_WORKSPACE`.

## Worked example

For services/images/cache/store.ts, all three sample rules match. The final cache rule wins with @fictional/cache. Earlier platform/media ownership and the service catalog disagreement remain explicit conflicts.

```figure
pj-service-ownership-navigator-2
```

Change the figure controls, predict the intermediate values, and compare the calculation with your implementation. The figure explains the mechanism; the grader runs the real functions.

## Implement and verify

```bash
python3 scripts/project_test.py service-ownership-navigator --init my-service-ownership-navigator
python3 scripts/project_test.py service-ownership-navigator --stage 2 --path my-service-ownership-navigator --strict
```

Initialize once. The fresh first stage intentionally fails with a named not-implemented error. Preserve the signatures and reject malformed inputs with useful errors. Keep inputs unchanged. Each stage includes separate held-out inputs; passing the demonstration alone is insufficient.

## Failure cases and hints

Earlier differing rules and catalog disagreement are conflicts to review, not reasons to silently combine owner lists. Unknown paths return unresolved ownership.

## Use your result

After stage four, pass a JSON file of your own through the same entry point:

```bash
cd my-service-ownership-navigator
node cli.ts sample.json output
```

Static service directory and source-backed ownership lookup JSON. Open `output/report.html` and inspect the machine-readable companion files.

## Extend it

Extend the subset only after testing official CODEOWNERS edge cases.

Scope: This project uses a documented local ownership-rule format. It does not implement the full GitHub CODEOWNERS format. It operates entirely on supplied local data. It checks runbook references without executing instructions or sending notifications.
