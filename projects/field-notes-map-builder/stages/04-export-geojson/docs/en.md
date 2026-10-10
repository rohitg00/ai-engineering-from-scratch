# Export GeoJSON and a portable map report

**Type:** Build
**Language:** TypeScript
**Stage:** 4 of 4
**Time:** ~2 hours
**Prerequisites:** Basic TypeScript, JSON objects, arrays and running Node 22.18 or newer. Complete the preceding stages first.

## What you build

Produce a mapping interchange artifact and a reviewable offline map.

## Public contract

```typescript
exportGeoJSON(items:Observation[],review):{type:string;features:any[]}; renderMap(items,groups,review):string
```

GeoJSON FeatureCollection contains one Point feature per original observation. Coordinates are [longitude,latitude]; properties retain note,timestamp,photo and reviewed group id. HTML uses an equirectangular schematic plot, with longitude unwrapped around the first point, original evidence table, distances and group review download.

The initial workspace contains public types, function stubs, the CLI, and original input fixtures. Change `main.ts`; the CLI is already supplied. Stages accumulate without replacing your earlier implementation. Tests import the learner workspace selected by `PROJECT_WORKSPACE`.

## Worked example

Feature a uses geometry `{type:"Point",coordinates:[77.59,12.97]}` and note/timestamp properties. A group of two nearby records still exports two Point features, never an invented averaged location.

```figure
pj-field-notes-map-builder-4
```

Change the figure controls, predict the intermediate values, and compare the calculation with your implementation. The figure explains the mechanism; the grader runs the real functions.

## Implement and verify

```bash
python3 scripts/project_test.py field-notes-map-builder --init my-field-notes-map-builder
python3 scripts/project_test.py field-notes-map-builder --stage 4 --path my-field-notes-map-builder --strict
```

Initialize once. The fresh first stage intentionally fails with a named not-implemented error. Preserve the signatures and reject malformed inputs with useful errors. Keep inputs unchanged. Each stage includes separate held-out inputs; passing the demonstration alone is insufficient.

## Failure cases and hints

Do not collapse group members into a representative coordinate. The schematic is not a navigational map or a distance scale.

## Use your result

After stage four, pass a JSON file of your own through the same entry point:

```bash
cd my-field-notes-map-builder
node cli.ts sample.json output
```

A GeoJSON FeatureCollection, a standalone HTML map and reviewed observation groups. Open `output/report.html` and inspect the machine-readable companion files. Rerun `node cli.ts sample.json reviewed-output group-review.json` to apply the downloaded review. Parse observations.geojson as GeoJSON and verify its feature count equals the original observation count.

## Extend it

Import observations.geojson into another mapping program and inspect the properties.

Scope: Distances use a spherical earth and connected components, appropriate for inspection rather than surveying. The map is a schematic plot with no network tiles. Photo evidence is linked, not downloaded. GeoJSON follows WGS84 longitude/latitude order (RFC 7946).
