---
id: visual-explainers
title: Diagram, Chart and Infrastructure Explainers
code: DE
subtitle: Four local explainer projects. Run them, feed them, read their outputs and fix their errors.
hue: 262
sources: projects/chart-storyboard-builder, projects/diagram-reading-companion, projects/infrastructure-plan-explainer, projects/service-ownership-navigator
source_hash: 6fb01345df287c0d
---

## Four projects side by side
type: comparison
span: 3
from: projects/chart-storyboard-builder/README.md, projects/chart-storyboard-builder/solution/cli.py, projects/diagram-reading-companion/README.md, projects/diagram-reading-companion/solution/cli.ts, projects/infrastructure-plan-explainer/README.md, projects/infrastructure-plan-explainer/solution/cli.py, projects/service-ownership-navigator/README.md, projects/service-ownership-navigator/solution/cli.ts

| Factor | Chart Storyboard Builder | Diagram Reading Companion | Infrastructure Plan Explainer | Service Ownership Navigator |
|---|---|---|---|---|
| Language | Python 3.10+ | Node 22.18 or newer | Python 3.10+ | Node 22.18 or newer |
| Input | `csv`, `roles`, `periods`, `charts` | `svg`, `graph` | Terraform plan JSON | `catalog`, `path` |
| Outputs | `chart-N.svg`, `chart-specs.json`, `storyboard.html` | `graph.json`, `analysis.json`, `report.html` | `change-brief.md`, `resource-impact.json`, `review.html` | `handoff.json`, `catalog.json`, `report.html` |
| Review file | none | third argument, reviewed order | none | none |
| Never does | Infer dates or causation | Read meaning from SVG geometry | Apply a plan | Send notifications |

## Run the reference
type: command-table
from: projects/chart-storyboard-builder/README.md, projects/infrastructure-plan-explainer/README.md, projects/diagram-reading-companion/README.md, projects/service-ownership-navigator/README.md, projects/diagram-reading-companion/solution/cli.ts

| Command | What it does |
|---|---|
| `python3 cli.py samples/input.json --output demo-output` | Chart or infrastructure sample |
| `node cli.ts sample.json output` | Diagram or ownership sample |
| `node cli.ts <input.json> <dir> <review.json>` | Diagram with your reviewed order |
| `node cli.ts --help` | Prints the argument line |
| `python3 scripts/project_test.py <project> --all --solution --strict` | Grades the reference |
| `python3 scripts/project_test.py <project> --init <dir>` | Makes a starter |

## Explain a real Terraform plan
type: annotated-code
lang: bash
from: projects/infrastructure-plan-explainer/README.md, projects/infrastructure-plan-explainer/solution/cli.py

```bash
terraform show -json saved.plan > input.json  # saved plan as JSON
python3 cli.py input.json --output review  # never applies the plan
# review/change-brief.md        addresses with local anchors
# review/resource-impact.json   graph.edges and resources
# review/review.html            changes, edges, unresolved
```

## Plan explainer pipeline
type: flow
from: projects/infrastructure-plan-explainer/API.md, projects/infrastructure-plan-explainer/solution/main.py

1. **load_plan**: accepts only format major 1. It keeps actions and masked `before` and `after`.
2. **load_plan**: shows sensitive values as `[sensitive]` and computed values as `[unknown]`.
3. **classify**: maps each exact action sequence to one action name.
4. **impact_graph**: links references and `depends_on` by the longest address prefix.
5. **impact_graph**: skips `var`, `local`, `path`, `count`, `each`, `terraform` and `self`.
6. **explain**: writes Markdown with one anchor per address and the declared dependencies.

## Action sequences
type: command-table
from: projects/infrastructure-plan-explainer/solution/main.py, projects/infrastructure-plan-explainer/API.md

| Command | What it does |
|---|---|
| `["create"]` | create |
| `["update"]` | update, in place |
| `["delete", "create"]` | replace |
| `["create", "delete"]` | replace |
| `["delete"]` | delete |
| `["read"]`, `["no-op"]`, `["forget"]` | read, no-op, forget |
| any other list | `unsupported action sequence` |

## Diagram companion
type: architecture
from: projects/diagram-reading-companion/solution/main.ts, projects/diagram-reading-companion/solution/cli.ts

```arch
node | in | 1,1 | sample.json | svg, graph | client
node | load | 2,1 | loadDiagram() | node ids must be SVG ids | process
node | an | 3,1 | analyzeGraph() | order, branches, cycles | process
node | rev | 3,2 | reviewGraph() | order, reviewed | process
node | graph | 2,2 | graph.json | reviewed manifest | store
node | html | 1,2 | report.html | keyboard walkthrough | store
edge | in | load | svg, graph
edge | load | an | graph
edge | an | rev | order
edge | rev | graph | save
edge | graph | html | render
```

## Chart rules
type: concepts
from: projects/chart-storyboard-builder/API.md, projects/chart-storyboard-builder/solution/main.py, projects/chart-storyboard-builder/README.md

- **roles**: `group`, `value` and `unit` name CSV columns and a display unit.
- **Reducers**: `sum`, `mean` and `count`. Count uses nonblank values, unit `records`.
- **Grammar**: `bar` for categories, `line` for ordered periods.
- **Blank value**: it is missing, not zero. A line breaks there.
- **periods**: set the order. An absent period plots as null.
- **Axis**: always includes zero.
- **Annotation**: needs a plotted point. The text gets the exact value and unit.

## Ownership rules
type: concepts
from: projects/service-ownership-navigator/solution/main.ts, projects/service-ownership-navigator/README.md

- **Last match wins**: the last matching rule sets the effective owners.
- **Anchored**: a pattern that starts with `/` or holds a `/` matches from the root.
- **Wildcards**: `*` stays in one segment, `**/` spans folders, `?` is one character.
- **Directory**: a trailing `/` matches the folder and all below it.
- **Service**: the longest service `root` that holds the path.
- **Owners**: `@user` or `@org/team` names only.
- **Runbook links**: local links must point to a supplied runbook file.

## Defaults and limits
type: defaults
from: projects/chart-storyboard-builder/solution/main.py, projects/chart-storyboard-builder/solution/cli.py, projects/diagram-reading-companion/solution/main.ts, projects/service-ownership-navigator/solution/main.ts, projects/diagram-reading-companion/solution/cli.ts, projects/infrastructure-plan-explainer/solution/main.py

| Setting | Default | Note |
|---|---|---|
| `reducer` | `sum` | Per chart in `charts` |
| `grammar` | `bar` | Or `line` |
| `schema_version` | 1 | Chart specs and plan brief |
| SVG size | 500000 | Characters at most |
| Rule source | `CODEOWNERS` | Name in the evidence rows |
| Output folder | `output` | Second argument of the Node CLIs |
| Chart width | 640 | Minimum SVG width in pixels |

## Error messages and fixes
type: troubleshooting
from: projects/infrastructure-plan-explainer/solution/main.py, projects/chart-storyboard-builder/solution/main.py, projects/diagram-reading-companion/solution/main.ts, projects/service-ownership-navigator/solution/main.ts

| Symptom | Cause | Fix |
|---|---|---|
| `unsupported Terraform JSON format major` | Not a `terraform show -json` file | Export the saved plan as JSON |
| `periods omit data or duplicate a group` | A data group is not in `periods` | List every group once |
| `annotation needs a unique plotted point` | Note on a blank or unknown group | Annotate a point with a value |
| `Node missing from SVG or duplicated` | Manifest id has no SVG `id` | Add the `id` to the SVG element |
| `Unsupported SVG element` | Tag outside the safe subset | Use shapes, text, `g`, `title`, `desc` |
| `Review order must contain every node exactly once` | Old or partial order | List each node id one time |
| `Earlier matching rules name different owners; last matching rule wins` | Rules overlap | Check the last rule is right |
| `Missing local runbook link` | Runbook links a file not supplied | Add the file to `runbooks` |

## Worked examples
type: qa
from: projects/chart-storyboard-builder/solution/samples/input.json, projects/chart-storyboard-builder/README.md, projects/infrastructure-plan-explainer/solution/samples/input.json, projects/infrastructure-plan-explainer/README.md, projects/service-ownership-navigator/solution/sample.json, projects/diagram-reading-companion/solution/sample.json

- **What does W1 plot with sum?** 18. Its rows hold 8 and 10.
- **What happens to W2 and W3?** W2 is blank and W3 is absent. Both plot as missing.
- **Why is the database a replace?** Its actions are `delete` then `create`.
- **What does the brief show for the password?** `[sensitive]`, also inside arrays.
- **Who owns `services/images/cache/store.ts`?** `@fictional/cache`, from the last rule.
- **Where does the diagram branch?** At `check`, to `share` and `clarify`.

## Tips
type: tips
from: projects/infrastructure-plan-explainer/README.md, projects/infrastructure-plan-explainer/API.md, projects/diagram-reading-companion/README.md, projects/chart-storyboard-builder/API.md, projects/service-ownership-navigator/README.md

- Graph edges are declared dependencies, not the provider execution order.
- The plan tool does not predict outage time, cost or full execution order.
- A reading order is a candidate for review, not a proof of pedagogy.
- Chart SVGs carry `title` and `desc` and no JavaScript.
- The ownership format is a local subset, not the full CODEOWNERS format.
