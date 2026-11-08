# Review groups without merging observations

**Type:** Build
**Language:** TypeScript
**Stage:** 3 of 4
**Time:** ~2 hours
**Prerequisites:** Basic TypeScript, JSON objects, arrays and running Node 22.18 or newer. Complete the preceding stages first.

## What you build

Let reviewers split a computed group without deleting any observation.

## Public contract

```typescript
reviewGroups(groups:Groups,value?:unknown):{schemaVersion:1;groups;decisions}
```

Review `{schemaVersion:1,decisions:Record<groupId,"pending"|"keep-group"|"keep-separate">}`. Missing decisions default to pending; unknown group ids fail. keep-separate expands members into singleton groups. Preserve distance evidence separately.

The initial workspace contains public types, function stubs, the CLI, and original input fixtures. Change `main.ts`; the CLI is already supplied. Stages accumulate without replacing your earlier implementation. Tests import the learner workspace selected by `PROJECT_WORKSPACE`.

## Worked example

Review `{schemaVersion:1,decisions:{"a":"keep-separate"}}` splits a,b,c into three singleton groups. All three original observations and both computed distance edges remain available.

```figure
pj-field-notes-map-builder-3
```

Change the figure controls, predict the intermediate values, and compare the calculation with your implementation. The figure explains the mechanism; the grader runs the real functions.

## Implement and verify

```bash
python3 scripts/project_test.py field-notes-map-builder --init my-field-notes-map-builder
python3 scripts/project_test.py field-notes-map-builder --stage 3 --path my-field-notes-map-builder --strict
```

Initialize once. The fresh first stage intentionally fails with a named not-implemented error. Preserve the signatures and reject malformed inputs with useful errors. Keep inputs unchanged. Each stage includes separate held-out inputs; passing the demonstration alone is insufficient.

## Failure cases and hints

Pending is not approval. Group decisions change grouping metadata, never coordinates or notes.

## Use your result

After stage four, pass a JSON file of your own through the same entry point:

```bash
cd my-field-notes-map-builder
node cli.ts sample.json output
```

A GeoJSON FeatureCollection, a standalone HTML map and reviewed observation groups. Open `output/report.html` and inspect the machine-readable companion files.

## Extend it

Allow explicit member-by-member reassignment with an audit trail.

Scope: Distances use a spherical earth and connected components, appropriate for inspection rather than surveying. The map is a schematic plot with no network tiles. Photo evidence is linked, not downloaded. GeoJSON follows WGS84 longitude/latitude order (RFC 7946).
