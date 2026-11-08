# Field Notes Map Builder

Help a community mapping group explore observations supplied as coordinates, notes and optional photos. Validate locations, group nearby records using an explicit distance rule, preserve original observations during review, and export GeoJSON with a standalone map and observation table.

You build a GeoJSON FeatureCollection, a standalone HTML map and reviewed observation groups.

## Run the tool on your own input

Requires Node 22.18 or newer. No package install, API key, network account or provider is needed.

```bash
cd projects/field-notes-map-builder/solution
node cli.ts sample.json output
```

`sample.json` is original project data. Copy it, edit the values, and pass the new filename to the same command. `node cli.ts --help` documents the arguments. The report is output/report.html. JSON files preserve the evidence used by the interface.

## Build it yourself

```bash
python3 scripts/project_test.py field-notes-map-builder --init my-field-notes-map-builder
python3 scripts/project_test.py field-notes-map-builder --stage 1 --path my-field-notes-map-builder --strict
python3 scripts/project_test.py field-notes-map-builder --all --path my-field-notes-map-builder --strict --report completion.json
```

The first run fails until you implement the first stage. The initial starter supplies every public type, function signature, CLI wrapper and input fixture. Later stages add behavior in the same file.

1. [Import coordinates, timestamps and evidence](stages/01-import-observations/docs/en.md)
2. [Compute distances and explain nearby groups](stages/02-distance-groups/docs/en.md)
3. [Review groups without merging observations](stages/03-review-groups/docs/en.md)
4. [Export GeoJSON and a portable map report](stages/04-export-geojson/docs/en.md)

## Contracts and integration

- `importObservations(value: unknown): Observation[]`
- `distanceMeters(a,b): number; groupNearby(items:Observation[],radiusMeters:number):Groups`
- `reviewGroups(groups:Groups,value?:unknown):{schemaVersion:1;groups;decisions}`
- `exportGeoJSON(items:Observation[],review):{type:string;features:any[]}; renderMap(items,groups,review):string`

Read the stage documentation for exact input and return shapes, worked intermediate values, failure behavior and held-out cases. Import these functions from `main.ts` to reuse the tool from another TypeScript program. The HTML runs locally and its review downloads can be passed back to the CLI when documented; it never submits data to a third-party service.

## Verification and scope

```bash
python3 scripts/project_test.py field-notes-map-builder --all --solution --strict
```

Distances use a spherical earth and connected components, appropriate for inspection rather than surveying. The map is a schematic plot with no network tiles. Photo evidence is linked, not downloaded. GeoJSON follows WGS84 longitude/latitude order (RFC 7946).

The core implementation, fixtures and lesson prose are original. Local reference checks do not grant a learner certificate. Learner completion is self-reported evidence from the full grader, not external certification.
