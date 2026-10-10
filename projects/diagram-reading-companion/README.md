# Diagram Reading Companion

Help an educator turn an authored SVG diagram and an explicit node-edge manifest into a keyboard-navigable explanation. Check that referenced nodes exist, expose branches and cycles, let the author review the reading order, and export an accessible HTML walkthrough plus graph JSON.

You build a navigable HTML diagram walkthrough and a reviewed graph manifest.

## Run the tool on your own input

Requires Node 22.18 or newer. No package install, API key, network account or provider is needed.

```bash
cd projects/diagram-reading-companion/solution
node cli.ts sample.json output
```

`sample.json` is original project data. Copy it, edit the values, and pass the new filename to the same command. `node cli.ts --help` documents the arguments. The report is output/report.html. JSON files preserve the evidence used by the interface.

## Build it yourself

```bash
python3 scripts/project_test.py diagram-reading-companion --init my-diagram-reading-companion
python3 scripts/project_test.py diagram-reading-companion --stage 1 --path my-diagram-reading-companion --strict
python3 scripts/project_test.py diagram-reading-companion --all --path my-diagram-reading-companion --strict --report completion.json
```

The first run fails until you implement the first stage. The initial starter supplies every public type, function signature, CLI wrapper and input fixture. Later stages add behavior in the same file.

1. [Load an SVG and validate declared nodes and edges](stages/01-load-diagram/docs/en.md)
2. [Compute branches, cycles and candidate reading order](stages/02-analyze-graph/docs/en.md)
3. [Review explanations and reading order](stages/03-review-explanations/docs/en.md)
4. [Export the navigable walkthrough and graph data](stages/04-export-walkthrough/docs/en.md)

## Contracts and integration

- `loadDiagram(svg: string, value: unknown): {svg:string;graph:Graph}`
- `analyzeGraph(graph: Graph): Analysis`
- `reviewGraph(graph: Graph, value?: unknown): {schemaVersion:1;graph:Graph;order:string[];reviewed:boolean}`
- `renderWalkthrough(svg:string, review:ReturnType<typeof reviewGraph>):string`

Read the stage documentation for exact input and return shapes, worked intermediate values, failure behavior and held-out cases. Import these functions from `main.ts` to reuse the tool from another TypeScript program. The HTML runs locally and its review downloads can be passed back to the CLI when documented; it never submits data to a third-party service.

## Verification and scope

```bash
python3 scripts/project_test.py diagram-reading-companion --all --solution --strict
```

The graph relationships are explicitly authored; the tool does not infer meaning from SVG geometry or claim image understanding. Supported SVG is a safe, constrained drawing subset. Reading order is a reviewable candidate, not a proof of pedagogy.

The core implementation, fixtures and lesson prose are original. Local reference checks do not grant a learner certificate. Learner completion is self-reported evidence from the full grader, not external certification.
