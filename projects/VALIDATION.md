# Project validation

Core grading and review regressions were reverified locally on 2026-09-29. These results describe the checked implementations and supplied fixtures, not production performance or a hosted assessment. Initial catalog sweeps and optional SDK checks are distinguished from the latest targeted follow-up below.

| Surface | Result |
|---|---|
| Core project grader | 48 projects, 196 stages, 1,382 tests pass, zero skips after review corrections |
| Grader, builder, certificate and figure contracts | 65 tests pass |
| Optional framework SDK integrations | Initial acceptance: 29 additional tests pass: LangChain 5, Google ADK 10, AWS Strands 5, Mastra 9 |
| Fresh learner workspaces | Initial acceptance: all 48 initialize and fail their unfinished first stage; seven affected starters rechecked after corrections |
| Mechanism figures | Initial sweep: all 197 mount and update visible calculated results in Chromium; changed figures rechecked after corrections |
| Project pages | Initial sweep: all 48 load bundled lessons, figures, and recordings |
| Recordings | 100 GIFs with static posters and command/capture provenance |
| Course invariants | 523 lessons and 67 certification lessons pass audits; README/book counts match |

## Reproduce

```bash
node site/build.js
node site/build-projects.js --strict
node --test site/test_projects_data.js site/test_project_certificates.js site/test_project_figure_runtime.js site/test_dataset_project_figures.js site/test_budget_project_figures.js site/test_semantic_project_figures.js
python3 scripts/project_test.py --all --solution --strict --report /tmp/project-results.json
python3 scripts/audit_lessons.py
python3 scripts/audit_certifications.py
python3 scripts/check_readme_counts.py
```

The local core run used Python 3.12.12, Node 25.6.1, Rust 1.95.0, and Go 1.26.0 on macOS arm64. The optional Python SDK suites used Python 3.12 in an isolated environment. Framework versions and installation commands are pinned in each project's dependency files. The project CI separately uses Python 3.12, Node 24, Go 1.23, and the runner's Rust toolchain; a local pass does not establish remote CI status.

## Browser and artifact checks

During initial acceptance, the served catalog, pilot and document-extraction page were inspected at 1440x950 in light mode and 390x950 in dark mode, extending earlier checks of both themes at both widths. All 48 project pages were opened independently to exercise dynamic provider loading. All 197 mechanism figures mounted, accepted changed inputs and updated their visible calculations without initial errors. Earlier interface checks covered project filtering, stage navigation and browser history, saved completion, recording play/stop, and certificate import.

The eight new application outputs were inspected at 1120 and 390 pixels. The document review check selected a source span after a Unicode character, downloaded the actual approval, applied it through the CLI, and reopened the approved page without losing the choice. The study coach recorded an incorrect answer and a correct answer in the browser; its downloaded attempt events replayed through the CLI into the expected schedule.

Certificate import rejected reference-solution evidence and accepted a complete learner-mode QA report. The QA workspace intentionally copied a reference implementation solely to exercise the interface; no learner achievement is claimed. Certificates remain local self-attested community records. They cannot establish identity or prevent a user from copying code or modifying JSON.

The browser-agent adapter drove real Chromium against its local fixture and captured its result. The Rust shell was exercised through actual stdin/stdout and a PTY. The pilot report was opened in Chromium with citation inspection and its trace expanded. Terminal GIFs render captured command output; application output GIFs use actual browser frame captures. The four framework GIFs record the current optional graders, with core and additional SDK test counts distinguished.

## Review follow-up checks

After the corrections, the submission card, budget stage 4 and semantic-search stage 3 passed 12 route/width/theme checks at 1280 and 390 pixels in both themes. The served budget receipt uses `events[].status`. The semantic figure preserves the literal plural match in its editable example, explains the different file fixture, and correctly ranks `constructor` and `__proto__` as ordinary search terms. No document overflow or console errors appeared in these checks.

Generated meeting HTML preserves approved and rejected selections through its actual download handler. Mixed malformed and valid PR candidates produce consistent HTML and JSON. The actual Browser Agent CLI completed its local Chromium fixture in four steps and produced a valid screenshot; separate corrupt-screenshot tests preserve the failure receipt. Fixture success is not a general browser-accuracy claim.

Regression tests exercise provider HTTPS and redirect boundaries, gateway request replay after a real transport retry, bounded HTTP connection closure, split UTF-8 request bodies, optional cloud log windows, atomic-patch cleanup, root-level glob matching and native-process terminal receipts. Single-file runner overrides were removed where they omitted existing stage tests. The full grader also exposed a parallel desktop-fixture directory collision; an atomic sequence fixes it, and 30 repeated integration runs passed all 150 tests before the final full gate.

The calendar retains its documented explicit-endpoint subset, including exclusive all-day ends. Numeric extraction retains finite Python float syntax, with acceptance and rejection cases. These two review suggestions required clearer contracts, not broader parsers. Optional SDK tracks were not rerun during this follow-up because their integration code was unchanged.

## Integration and regression checks

Durable jobs and the evaluation farm ran real child processes, crashed at documented boundaries, recovered persisted work and rejected stale completions. Harness and gateway binaries made actual loopback HTTP requests with call budgets, distinct credentials, deadlines and bounded response bodies. Mastra suspended a workflow in one process and resumed the same stored run in another. Official MCP clients exercised the teaching servers over stdio and HTTP.

Cross-project checks include audited dataset partitions into evaluation, PR findings into the review panel, installed skill bundles into the native Rust validator, and research reports into the judge. Independent application review reproduced and fixed three additional defects: large CSV identifiers merging, approved extraction selections disappearing on export, and postmortem text dropping review metadata. Regression tests and the original reproductions pass.

## Limits

Native macOS desktop control was not executed. Fixture-backend success does not verify Accessibility permissions or native interactions. Optional framework suites import and execute real SDKs with deterministic local models; no live model-provider, Bedrock, or other cloud calls were made. Voice tests verify real WAV/multipart transport with controlled responses; the offline transcript is explicitly supplied, so these tests do not measure recognition accuracy. Visual search uses supplied text rectangles rather than claiming OCR.

Sandbox stages teach policy planning; the optional Docker probe was not exercised. Queue and farm recovery covers cooperating processes on a local filesystem, not distributed storage or exactly-once external effects. Evaluation datasets are public teaching fixtures, and their scores do not establish unseen performance. Source hashes bind content, not reviewer identity. Local drafts do not send email, publish issues or change an account calendar.
