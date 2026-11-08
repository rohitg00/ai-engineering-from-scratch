# Compute distances and explain nearby groups

**Type:** Build
**Language:** TypeScript
**Stage:** 2 of 4
**Time:** ~2 hours
**Prerequisites:** Basic TypeScript, JSON objects, arrays and running Node 22.18 or newer. Complete the preceding stages first.

## What you build

Group nearby records using a reproducible distance rule and retained pairwise evidence.

## Public contract

```typescript
distanceMeters(a,b): number; groupNearby(items:Observation[],radiusMeters:number):Groups
```

Compute haversine distance on radius 6371008.8 m. Radius must be finite 0..1000000. Add an edge for every pair at distance <= radius. Connected components are transitive groups, including singleton records; first member becomes group id. Return `{radiusMeters,groups:[{id,members}],edges:[{from,to,meters}]}`.

The initial workspace contains public types, function stubs, the CLI, and original input fixtures. Change `main.ts`; the CLI is already supplied. Stages accumulate without replacing your earlier implementation. Tests import the learner workspace selected by `PROJECT_WORKSPACE`.

## Worked example

At the equator, longitudes 0, 0.001 and 0.002 are roughly 111 m apart pairwise for adjacent records. A radius of 120 m yields edges a-b and b-c and one transitive group a,b,c.

```figure
pj-field-notes-map-builder-2
```

Change the figure controls, predict the intermediate values, and compare the calculation with your implementation. The figure explains the mechanism; the grader runs the real functions.

## Implement and verify

```bash
python3 scripts/project_test.py field-notes-map-builder --init my-field-notes-map-builder
python3 scripts/project_test.py field-notes-map-builder --stage 2 --path my-field-notes-map-builder --strict
```

Initialize once. The fresh first stage intentionally fails with a named not-implemented error. Preserve the signatures and reject malformed inputs with useful errors. Keep inputs unchanged. Each stage includes separate held-out inputs; passing the demonstration alone is insufficient.

## Failure cases and hints

A-B and B-C can share one group even when A-C exceeds the threshold. Handle dateline differences and identical points.

## Use your result

After stage four, pass a JSON file of your own through the same entry point:

```bash
cd my-field-notes-map-builder
node cli.ts sample.json output
```

A GeoJSON FeatureCollection, a standalone HTML map and reviewed observation groups. Open `output/report.html` and inspect the machine-readable companion files.

## Extend it

Compare spherical and ellipsoidal distances for a declared precision requirement.

Scope: Distances use a spherical earth and connected components, appropriate for inspection rather than surveying. The map is a schematic plot with no network tiles. Photo evidence is linked, not downloaded. GeoJSON follows WGS84 longitude/latitude order (RFC 7946).
