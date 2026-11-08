# Evidence: cheatsheets/visual-explainers.md

Abbreviations. CS = projects/chart-storyboard-builder. DR = projects/diagram-reading-companion. IP = projects/infrastructure-plan-explainer. SO = projects/service-ownership-navigator.

## Front matter
- id, title, sources: cheatsheets/topics.yaml:1568-1575

## Four projects side by side (comparison)
- Language: CS/README.md:5, DR/README.md:9, IP/README.md:5, SO/README.md:9
- Input: CS/README.md:31, DR/solution/cli.ts:25, IP/README.md:31, SO/solution/cli.ts:20-21
- Outputs: CS/solution/cli.py:32-33,39. DR/solution/cli.ts:28-30. IP/solution/cli.py:14-15,23. SO/solution/cli.ts:22-24
- Review file: CS/solution/cli.py:6-9 (no review flag). DR/solution/cli.ts:10,16-18,27. IP/solution/cli.py:6-9. SO/solution/cli.ts:11-13,20-21 (read, not used)
- Never does: CS/README.md:37. DR/README.md:48. IP/README.md:37. SO/README.md:48

## Run the reference (command-table)
- python3 cli.py samples/input.json --output demo-output: CS/README.md:27, IP/README.md:27
- node cli.ts sample.json output: DR/README.md:13, SO/README.md:13
- review as third argument: DR/solution/cli.ts:10,12
- --help: DR/README.md:16
- --all --solution --strict: CS/README.md:25, DR/README.md:45
- --init: CS/README.md:10, DR/README.md:21

## Explain a real Terraform plan (annotated-code)
- terraform show -json saved.plan > input.json; python3 cli.py input.json --output review: IP/README.md:31
- never applies: IP/README.md:37
- change-brief.md, resource-impact.json, review.html: IP/solution/cli.py:14-23, IP/README.md:31
- local anchors: IP/API.md:35. graph.edges: IP/README.md:31

## Plan explainer pipeline (flow)
- format major 1: IP/solution/main.py:42-44
- keeps actions, masked before/after: IP/API.md:11, IP/solution/main.py:63-69
- [sensitive], [unknown]: IP/solution/main.py:4-8, IP/README.md:35
- classify exact sequences: IP/solution/main.py:107-122
- longest address prefix, depends_on: IP/API.md:27, IP/solution/main.py:95,160-162
- skipped prefixes var, local, path, count, each, terraform, self: IP/solution/main.py:137-146
- Markdown anchors and declared dependencies: IP/solution/main.py:186,191,204-208

## Action sequences (command-table)
- create: IP/solution/main.py:110
- update: IP/solution/main.py:111
- delete then create is replace: IP/solution/main.py:113
- create then delete is replace: IP/solution/main.py:114
- delete: IP/solution/main.py:112
- read, no-op, forget: IP/solution/main.py:115-117, IP/API.md:19
- update in place: IP/README.md:3
- unsupported action sequence: IP/solution/main.py:122

## Diagram companion (architecture)
- sample.json svg, graph: DR/solution/sample.json:2-3, DR/solution/cli.ts:25
- loadDiagram node ids must be SVG ids: DR/solution/main.ts:104-107
- analyzeGraph order, branches, cycles: DR/solution/main.ts:5-10,164-171
- reviewGraph order, reviewed: DR/solution/main.ts:173-216
- graph.json: DR/solution/cli.ts:28
- report.html keyboard walkthrough: DR/solution/cli.ts:30, DR/README.md:3

## Chart rules (concepts)
- roles group, value, unit: CS/API.md:11
- reducers sum, mean, count, unit records: CS/API.md:19, CS/solution/main.py:42,55-56,76
- bar and line: CS/solution/main.py:42, CS/README.md:37
- blank is missing, line breaks: CS/README.md:35, CS/API.md:35
- periods order, absent as null: CS/API.md:19
- axis includes zero: CS/API.md:19, CS/solution/main.py:70-71
- annotation needs plotted point, appends value and unit: CS/API.md:27, CS/solution/main.py:101

## Ownership rules (concepts)
- last matching rule wins: SO/solution/main.ts:143,175
- anchored on leading / or inner /: SO/solution/main.ts:116,133
- *, **/, ?: SO/solution/main.ts:122-129
- trailing / directory: SO/solution/main.ts:117,133
- longest service root: SO/solution/main.ts:139-141
- @user or @org/team: SO/solution/main.ts:46-49
- local runbook links must exist: SO/solution/main.ts:228-230

## Defaults and limits (defaults)
- reducer sum: CS/solution/cli.py:25, CS/solution/main.py:40
- grammar bar: CS/solution/cli.py:27, CS/solution/main.py:40
- schema_version 1: CS/solution/main.py:73, IP/solution/main.py:211
- SVG 500000 characters: DR/solution/main.ts:16-17
- rule source CODEOWNERS: SO/solution/main.ts:54
- output folder output: DR/solution/cli.ts:10
- chart width 640: CS/solution/main.py:121

## Error messages and fixes (troubleshooting)
- unsupported Terraform JSON format major: IP/solution/main.py:44
- periods omit data or duplicate a group: CS/solution/main.py:48-49
- annotation needs a unique plotted point: CS/solution/main.py:91-97
- Node missing from SVG or duplicated: DR/solution/main.ts:106-107
- Unsupported SVG element, allowed tags: DR/solution/main.ts:18-32,68
- Review order must contain every node exactly once: DR/solution/main.ts:186-194
- Earlier matching rules name different owners...: SO/solution/main.ts:168-176
- Missing local runbook link: SO/solution/main.ts:230

## Worked examples (qa)
- W1 rows 8 and 10, sum 18: CS/solution/samples/input.json:2,17, CS/README.md:35
- W2 blank, W3 absent: CS/solution/samples/input.json:2,8-13, CS/API.md:19
- database delete then create: IP/solution/samples/input.json:6-11
- password [sensitive], arrays: IP/README.md:35
- services/images/cache/store.ts, @fictional/cache last rule: SO/solution/sample.json:27,33
- check branches to share and clarify: DR/solution/sample.json:32-41

## Tips (tips)
- declared dependencies, not execution order: IP/API.md:35
- no outage, cost, execution order prediction: IP/README.md:37
- reading order is a candidate: DR/README.md:48
- SVG title, desc, no JavaScript: CS/API.md:35
- local subset, not full CODEOWNERS: SO/README.md:48
