# Evidence: cheatsheets/decision-briefing-tools.md

Abbreviations. DT = projects/decision-tradeoff-explorer. WB = projects/web-change-brief. AT = projects/api-tutorial-runner. LE = projects/local-model-eval-harness.

## Front matter
- id, title, sources: cheatsheets/topics.yaml:1577-1584

## Four projects side by side (comparison)
- Language: DT/README.md:30, WB/README.md:9, AT/README.md:9, LE/README.md:5
- Input: DT/solution/main.ts:16, WB/README.md:5, AT/solution/cli.ts:15,22-25, LE/README.md:44
- Outputs: DT/solution/cli.ts:8,10,13. WB/solution/main.go:326,334,401. AT/solution/cli.ts:64,72-74. LE/README.md:33
- Gate: DT/solution/main.ts:194-198. WB/solution/main.go:349,404-405, WB/README.md:49. AT/README.md:48. LE/solution/cli.py:59,123-124
- Never does: DT/README.md:34. WB/README.md:47. AT/README.md:48. LE/README.md:46

## Run the reference (command-table)
- node --experimental-strip-types cli.ts fixtures/exhibition.json /tmp/decision-board: DT/README.md:26
- python3 -m http.server 8123, stop after: DT/README.md:27,30
- go run . --before ... --after ... --url ... --out ./web-change-output: WB/README.md:29
- go run . --fetch ... --baseline ./web-change-output/baseline.json --out ./next-report: WB/README.md:49
- node cli.ts sample.json output, loopback fixture: AT/README.md:13,48
- python3 cli.py samples/input.json --output scorecard.json --html reliability.html: LE/README.md:33
- --all --solution --strict: DT/README.md:17, WB/README.md:20, AT/README.md:45, LE/README.md:31

## Decision scoring rules (concepts)
- Benefit: DT/solution/main.ts:86
- Cost: DT/solution/main.ts:87
- weighted sum over total: DT/solution/main.ts:100-103,124
- missing value ineligible even at zero weight: DT/solution/main.ts:118-121,134, DT/README.md:32
- hard limit, cost above or benefit below: DT/solution/main.ts:125-129, DT/README.md:32
- ties by id: DT/solution/main.ts:141, DT/README.md:32
- dominated: DT/solution/main.ts:144-158
- sensitivity sweep 0 to 1 in steps: DT/solution/main.ts:160-176

## Web change brief (architecture)
- before.html, after.html or --fetch: WB/solution/main.go:343-346
- ExtractBlocks readable blocks: WB/solution/main.go:47-149
- NewSnapshot canonical URL, hash: WB/solution/main.go:164-178
- Compare added, removed, unchanged: WB/solution/main.go:180-215
- ExportBrief index.html, changes.json: WB/solution/main.go:318-340
- SaveSnapshot baseline.json: WB/solution/main.go:401

## A tutorial request block (annotated-code)
- create-loan POST /loans, status 201, capture loanId number: AT/solution/sample.json:2
- status 100..599: AT/solution/main.ts:62-67
- typed capture: AT/solution/main.ts:70-79
- read-loan GET /loans/{{loanId}}, assert bookName: AT/solution/sample.json:2
- only declared variables: AT/solution/main.ts:205-211

## API tutorial runner steps (flow)
- request fence, 20 steps: AT/solution/main.ts:41,102
- loopback server from fixture: AT/solution/cli.ts:22-49
- {{name}} fill, undeclared fails: AT/solution/main.ts:205-211
- no redirects, timeout, byte limit: AT/solution/main.ts:228-251
- status and assert, then captures: AT/solution/main.ts:262-279
- skip after failure: AT/solution/main.ts:186-194
- JUnit, HTML, corrections: AT/solution/main.ts:299-312, AT/solution/cli.ts:73-78

## Record and compare a local model (annotated-code)
- record.py samples/cases.json --endpoint ... --model --revision --hardware --output measured.json: LE/README.md:51
- loopback HTTP only: LE/solution/record.py:17-24
- manifest, source, labels, records: LE/README.md:44, LE/solution/record.py:66-77
- cli.py measured.json --baseline samples/input.json --output compared.json: LE/README.md:52. Rejects different labels: LE/README.md:55
- --min-accuracy, exit 2: LE/solution/cli.py:59,123-124, LE/README.md:44

## Scorecard fields (concepts)
- accuracy, case folding and whitespace: LE/solution/main.py:26-29,38-42
- coverage: LE/solution/main.py:43
- ece weighted by count: LE/solution/main.py:69-72
- p50_ms, p95_ms nearest rank: LE/solution/main.py:77-80,90-91
- dataset_sha256 label hash, baseline must match: LE/solution/cli.py:26-31,37-38
- manifest required fields: LE/solution/cli.py:13-24

## Defaults and limits (defaults)
- --out web-change-output: WB/solution/main.go:348
- MaxHTMLBytes 2_000_000, 2 MB: WB/solution/main.go:24,49
- timeoutMs 1500, 1 to 30000: AT/solution/main.ts:170,172-175
- maxBytes 65536: AT/solution/main.ts:171
- 20 steps: AT/solution/main.ts:102
- bins 5: LE/solution/main.py:47
- --min-accuracy 0, exit 2: LE/solution/cli.py:59,123-124
- sensitivity steps 10, 1 to 100: DT/solution/main.ts:160-165

## Error messages and fixes (troubleshooting)
- chosen option must be eligible: DT/solution/main.ts:194-198
- value outside declared range: DT/solution/main.ts:76-77
- Snapshots must refer to the same canonical URL: WB/solution/main.go:181-182
- Live fetch requires --baseline JSON: WB/solution/main.go:359-360, --fetch WB/README.md:49
- Baseline checksum mismatch: WB/solution/main.go:312-313
- Network endpoint requires explicit allowNetwork, --allow-network: AT/solution/main.ts:168-169, AT/README.md:48
- Earlier step failed; no request sent: AT/solution/main.ts:191
- cannot compare different datasets: LE/solution/cli.py:37-38

## Worked examples (qa)
- pods 0.68, open 0.67: DT/solution/fixtures/exhibition.json:2-27 (criteria), 31-37 (open), 45-51 (pods), DT/solution/main.ts:84-142 (computed in memory with score())
- archive flow null: DT/solution/fixtures/exhibition.json:59,64, DT/solution/main.ts:118-121
- open wins at access weight 0.6 or more: DT/solution/main.ts:160-184 (computed in memory with sensitivity())
- read-loan stale bookName: AT/solution/sample.json:2, AT/README.md:16
- 2/3 accuracy, full coverage, p95 200 ms: LE/README.md:38

## Tips (tips)
- one filter policy for both snapshots: WB/README.md:47
- baseline untouched unless --accept: WB/README.md:49
- weights are preferences: DT/solution/main.ts:215
- confidence self-report, ECE varies: LE/README.md:46
- command succeeds after writing evidence: AT/README.md:16
