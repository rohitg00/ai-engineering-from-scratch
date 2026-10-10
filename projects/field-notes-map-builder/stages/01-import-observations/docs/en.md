# Import coordinates, timestamps and evidence

**Type:** Build
**Language:** TypeScript
**Stage:** 1 of 4
**Time:** ~2 hours
**Prerequisites:** Basic TypeScript, JSON objects, arrays and running Node 22.18 or newer. Complete the preceding stages first.

## What you build

Keep each location and its original evidence as an independent observation.

## Public contract

```typescript
importObservations(value: unknown): Observation[]
```

Require unique id, finite longitude [-180,180], latitude [-90,90], valid explicit ISO UTC timestamp and nonempty note. Optional photo is an HTTP(S) evidence link. Return copied `{id,longitude,latitude,timestamp,note,photo?}` records.

The initial workspace contains public types, function stubs, the CLI, and original input fixtures. Change `main.ts`; the CLI is already supplied. Stages accumulate without replacing your earlier implementation. Tests import the learner workspace selected by `PROJECT_WORKSPACE`.

## Worked example

A bench at longitude 77.59, latitude 12.97 remains one observation with its timestamp and note. A latitude string "12.97" is rejected so accidental CSV typing cannot silently change geometry.

```figure
pj-field-notes-map-builder-1
```

Change the figure controls, predict the intermediate values, and compare the calculation with your implementation. The figure explains the mechanism; the grader runs the real functions.

## Implement and verify

```bash
python3 scripts/project_test.py field-notes-map-builder --init my-field-notes-map-builder
python3 scripts/project_test.py field-notes-map-builder --stage 1 --path my-field-notes-map-builder --strict
```

Initialize once. The fresh first stage intentionally fails with a named not-implemented error. Preserve the signatures and reject malformed inputs with useful errors. Keep inputs unchanged. Each stage includes separate held-out inputs; passing the demonstration alone is insufficient.

## Failure cases and hints

Reject numeric strings, impossible dates, duplicate identities and unsafe photo schemes. Coordinates are longitude first in interchange data.

## Use your result

After stage four, pass a JSON file of your own through the same entry point:

```bash
cd my-field-notes-map-builder
node cli.ts sample.json output
```

A GeoJSON FeatureCollection, a standalone HTML map and reviewed observation groups. Open `output/report.html` and inspect the machine-readable companion files.

## Extend it

Add an explicit CSV adapter with column mapping.

Scope: Distances use a spherical earth and connected components, appropriate for inspection rather than surveying. The map is a schematic plot with no network tiles. Photo evidence is linked, not downloaded. GeoJSON follows WGS84 longitude/latitude order (RFC 7946).
