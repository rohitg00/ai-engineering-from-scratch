# Local validation of the project expansion

Validated on 2026-10-09 on macOS arm64 with Python 3.12.14, Node 25.6.1, Go 1.26.0 and Rust 1.95.0. All inputs described below were authored fixtures or independent local test inputs. No model credentials were required.

The [2026-09-29 validation snapshot](validation/2026-09-29.md) retains earlier catalog, optional SDK and integration evidence. Those historical checks are distinct from the current results below.

## Scope and results

The starting catalog had 48 ready projects and 52 plans. This change implements 26 of those plans, exactly half, and adds Sensitive Text Redaction Gate and Dataset Contract Gate. The resulting catalog has **76 ready projects and 26 plans, 102 total**.

- The full strict core grader passed all 76 projects and 308 stages with 2,049 tests and no skips. A subsequent glossary layout regression added one test; its focused 25-test run passed. Current coverage is **2,050 passing tests**, including **668 across the 112 new stages**.
- All 28 additions passed their documented CLI/demo, a separate own-input scenario and an exported-artifact consumer. Fresh stage-one learner starters failed as intended. The 48 pre-existing canonical demos also exited successfully in isolated copies with their fixtures.
- All 112 new stage figures mounted in the built course site and changed calculated output when their inputs were exercised.
- The 23 additions that produce browser interfaces were served locally and inspected at 1280×800 and 390×844, in light and dark themes. Their controls and applicable downloads were exercised. The remaining five produce CLI/JSON artifacts, which were executed and consumed directly.
- Project data, certificate, figure-runtime and existing figure tests passed: 62 tests. Project copy tests passed: 3 tests. Strict project build, course build, lesson audit, certification audit and README-count checks passed.

Each project includes recorded initialization/grading and output GIFs, PNG posters and recording receipts under its `media/` directory. Browser output recordings capture the generated interface. CLI-only projects capture command output. Machine-specific repository and Python paths in terminal recordings are normalized; recorded results and timings are retained.

## Manual scenarios

The two additional projects are Dataset Contract Gate and Sensitive Text Redaction Gate. Every other row completes an existing roadmap entry. Test totals below count the latest passing stage runs.

| Project | Languages | Tests | Local scenario and consumer evidence |
|---|---|---:|---|
| [API Tutorial Runner](api-tutorial-runner/) | TypeScript | 24 | Ran real loopback HTTP with pass/fail/skip, accepted a browser correction, then replayed a corrected own-input tutorial with all three steps passing. |
| [Bookmark Path Organizer](bookmark-path-organizer/) | TypeScript | 24 | Imported independent nested bookmarks; reordered the browser reading path, saved read progress and consumed that JSON in a new CLI run. |
| [Catalog Record Linker](catalog-record-linker/) | Python | 20 | Resolved a title/year conflict, retained an unmatched record and consumed a three-row crosswalk into two source-preserving entities. |
| [Chart Storyboard Builder](chart-storyboard-builder/) | Python | 20 | Preserved an absent month and negative values; parsed SVGs as XML and reproduced both charts from exported specifications. Mobile charts retain readable labels inside scroll regions. |
| [Community Learning Path Finder](community-learning-path-finder/) | Python | 20 | Selected a prerequisite route within budget, exposed a missing prerequisite and reimported completion to reduce remaining time. |
| [Configuration Drift Explainer](configuration-drift-explainer/) | Go | 21 | Ran layered configuration through the CLI, consumed the drift report and checked precedence, missing values and redacted exports. |
| [CSV Repair Workbench](csv-repair-workbench/) | Python | 20 | Normalized independent labels, reviewed an ambiguous date, parsed the cleaned CSV and replayed the exported recipe on a second table. |
| [Database Migration Rehearsal](database-migration-rehearsal/) | Python | 20 | Verified the source database remained byte-for-byte unchanged; reversible index changes passed and equal-row-count content corruption failed. |
| [Dataset Contract Gate](dataset-contract-gate/) | Python | 27 | Supplied independent rows with a Boolean in an integer field and duplicate IDs. The CLI exited 1; independent consumers found one accepted row and three quarantined rows. |
| [Decision Tradeoff Explorer](decision-tradeoff-explorer/) | TypeScript | 28 | Changed browser weights, exported a chosen scenario and consumed the JSON. Extreme finite weights and prototype-named criterion IDs have regression coverage. |
| [Diagram Reading Companion](diagram-reading-companion/) | TypeScript | 25 | Navigated SVG nodes, edited an explanation, approved the order and reimported the browser export. Own-input SVG control-name collisions were checked. |
| [Download Folder Sort Desk](download-folder-sort-desk/) | Python | 21 | Nested case-conflicting names received unique destinations. Duplicate bytes stayed explicit; changing source bytes invalidated an old approval. |
| [Field Notes Map Builder](field-notes-map-builder/) | TypeScript | 24 | Grouped independent dateline coordinates using distance evidence; reviewed a browser group and consumed GeoJSON without losing observations. |
| [Glossary Hovercard Publisher](glossary-hovercard-publisher/) | TypeScript | 25 | Published an independent glossary, opened the inline definition controls and parsed exported glossary JSON. Inline annotations retain valid paragraph and emphasis structure. |
| [Hedged Request Lab](hedged-request-lab/) | Go | 21 | Ran baseline and delayed duplicate GETs against actual loopback endpoints; independently consumed latency and service-work receipts, including work after cancellation. |
| [Infrastructure Plan Explainer](infrastructure-plan-explainer/) | Python | 20 | Resolved nested module and instance references, retained unknown endpoints and verified that secrets and raw variables were absent from exports. |
| [Kubernetes Event Storyboard](kubernetes-event-storyboard/) | Go, TypeScript | 27 | Joined authored Event/workload snapshots by UID, retained revision uncertainty, filtered Warning events in the browser and consumed redacted context JSON. |
| [Log Volume Reduction Lab](log-volume-reduction-lab/) | Rust, Python | 29 | Ran the compiled Rust reducer on supplied logs and consumed its output in Python; checked retained error evidence and byte/count accounting. |
| [Plain Language Rewrite Desk](plain-language-rewrite-desk/) | TypeScript | 24 | Accepted one browser proposal and retained another original paragraph; reimported decisions and consumed Markdown with recorded facts preserved. |
| [Retry Storm Lab](retry-storm-lab/) | Go, TypeScript | 26 | Exercised deterministic replay and actual loopback HTTP. The shared retry budget capped 20 clients at 32 total calls; separate CLI policies exposed different recovery/load tradeoffs. |
| [Sensitive Text Redaction Gate](sensitive-text-redaction-gate/) | Python | 30 | Used independent JSONL with an email, punctuated IPv4, literal and Unicode. Three spans were removed; JSONL and receipt consumers found no original matches in the HTML. |
| [Service Ownership Navigator](service-ownership-navigator/) | TypeScript | 24 | Queried independent paths, surfaced ownership conflict evidence, filtered the browser directory and parsed the downloaded handoff packet. |
| [Signed Webhook Inbox](signed-webhook-inbox/) | Go | 26 | Used an independent Python HMAC producer against the receiver, restarted its process, verified duplicate/conflicting delivery behavior and consumed one replay receipt. The canonical demo also passed twice. |
| [Streaming Answer Recovery](streaming-answer-recovery/) | TypeScript, Go | 32 | Recovered an interrupted browser stream from Caf to Café with four accepted events, replayed its downloaded trace in Node and checked explicit cancellation. |
| [Subtitle Localization Desk](subtitle-localization-desk/) | Python | 22 | Withheld WebVTT before approval, applied reviewed translations and round-tripped cue IDs/times/settings. Whitespace-only cue-block injection is rejected. |
| [UI String Localization Workbench](ui-string-localization-workbench/) | TypeScript | 24 | Changed preview variables, approved one valid proposal, rejected a placeholder mismatch and reimported the browser export into a one-key locale catalog. |
| [Vocabulary Autocomplete Pad](vocabulary-autocomplete-pad/) | TypeScript | 24 | Accepted an actual browser suggestion, exported its model and reused it in another CLI input. Independent text checked token/history behavior. |
| [Workshop Materials Planner](workshop-materials-planner/) | Python | 20 | Verified inch-to-centimeter conversion and a 23.80 cm shortage; retained an unknown conversion. Browser participant changes were exported and consumed by the CLI. |

## Reproduce the checks

From the repository root, with the documented language toolchains installed:

```bash
python3 scripts/project_test.py --all --solution --strict --report project-results.json
node --test site/test_projects_data.js site/test_project_certificates.js site/test_project_figure_runtime.js site/test_dataset_project_figures.js site/test_budget_project_figures.js
node --test site/test_project_copy.js
node site/build.js
node site/build-projects.js --strict
python3 scripts/audit_lessons.py
python3 scripts/audit_certifications.py
python3 scripts/check_readme_counts.py
```

Each project README gives its own-input command and output filenames. Serve generated HTML over localhost for browser checks. HTTP/SSE/webhook fixtures need permission to listen on loopback. The root grader does not enable optional framework comparisons unless requested.

## Limits

These checks establish local core behavior. They do not establish Windows compatibility, remote CI status, live model-provider behavior, a real Kubernetes cluster integration or production capacity. Timing results describe controlled local fixtures. The webhook signature and dataset contract formats are explicitly authored teaching contracts, not claims of provider or industry-specification compatibility. The redactor covers only its documented patterns and literals.

Reference solution reports do not qualify for learner certificates. Local validation and public deployment are separate: inspect the PR checks and preview before merging.
