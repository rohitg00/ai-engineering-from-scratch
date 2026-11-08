# Load an SVG and validate declared nodes and edges

**Type:** Build
**Language:** TypeScript
**Stage:** 1 of 4
**Time:** ~2 hours
**Prerequisites:** Basic TypeScript, JSON objects, arrays and running Node 22.18 or newer. Complete the preceding stages first.

## What you build

Verify that every authored explanation points to a real SVG element.

## Public contract

```typescript
loadDiagram(svg: string, value: unknown): {svg:string;graph:Graph}
```

Graph nodes are `{id,label,explanation}`; edges are `{from,to,label}`. IDs are unique and must exist in SVG. SVG is at most 500000 characters and uses a tested structural subset: svg,g,rect,circle,ellipse,line,polyline,polygon,path,text,tspan,title,desc. Quoted drawing/identity attributes only; scripts, links, foreignObject, events, style and url() paint sources are rejected. Preserve original safe SVG.

The initial workspace contains public types, function stubs, the CLI, and original input fixtures. Change `main.ts`; the CLI is already supplied. Stages accumulate without replacing your earlier implementation. Tests import the learner workspace selected by `PROJECT_WORKSPACE`.

## Worked example

SVG `<rect id="check"/>` can be referenced by graph node check. A node named inspect with no matching SVG id must fail before any walkthrough is built.

```figure
pj-diagram-reading-companion-1
```

Change the figure controls, predict the intermediate values, and compare the calculation with your implementation. The figure explains the mechanism; the grader runs the real functions.

## Implement and verify

```bash
python3 scripts/project_test.py diagram-reading-companion --init my-diagram-reading-companion
python3 scripts/project_test.py diagram-reading-companion --stage 1 --path my-diagram-reading-companion --strict
```

Initialize once. The fresh first stage intentionally fails with a named not-implemented error. Preserve the signatures and reject malformed inputs with useful errors. Keep inputs unchanged. Each stage includes separate held-out inputs; passing the demonstration alone is insufficient.

## Failure cases and hints

Require one balanced svg root. Reject unknown edge endpoints and duplicate directed pairs. This is a bounded authored-SVG format, not general SVG ingestion.

## Use your result

After stage four, pass a JSON file of your own through the same entry point:

```bash
cd my-diagram-reading-companion
node cli.ts sample.json output
```

A navigable HTML diagram walkthrough and a reviewed graph manifest. Open `output/report.html` and inspect the machine-readable companion files.

## Extend it

Add an author-side validator that highlights missing metadata.

Scope: The graph relationships are explicitly authored; the tool does not infer meaning from SVG geometry or claim image understanding. Supported SVG is a safe, constrained drawing subset. Reading order is a reviewable candidate, not a proof of pedagogy.
