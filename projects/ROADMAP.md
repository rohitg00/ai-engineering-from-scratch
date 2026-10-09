# Project roadmap

The catalog contains **102 projects: 76 ready to build and 26 planned**. The plans below describe future work; they do not have runnable stages, completion tests or certificates yet.

Ready project manifests own implementation metadata; `roadmap.json` owns the remaining plans. These briefs give each plan a concrete deliverable, a starting path through existing projects and four proposed milestones. Milestones can expand into four to eight tested stages during implementation. No delivery dates are promised.

| Level | Ready | Planned | Total |
|---|---:|---:|---:|
| 1. Starter | 12 | 1 | 13 |
| 2. Builder | 30 | 2 | 32 |
| 3. Engineer | 22 | 7 | 29 |
| 4. Systems | 9 | 12 | 21 |
| 5. Frontier | 3 | 4 | 7 |

## Build order

Start with a project at your level and complete its linked prerequisites. Links identify whether a prerequisite is ready or also planned. Starter plans with no project prerequisite assume basic familiarity with their chosen language. Every future implementation should first produce a useful result on an authored local fixture, then explain one visible failure, and finally add a reusable export or adapter. External SDK and provider checks stay explicit.

Each brief defines its own task and acceptance boundary. During implementation, add original fixtures, a held-out case, source-backed explanations, an editable mechanism figure and a recording of the real output. Reference links describe protocols and formats, not evidence that the planned tool is already implemented.

## Level 1: Starter

<a id="photo-burst-contact-sheet"></a>

### Photo Burst Contact Sheet

Help a creator review repeated shots by computing simple pixel fingerprints and an inspectable sharpness measure. Group candidate duplicates, preserve the photographer's final choice, and export a contact sheet plus a selection manifest for an editor.

**Distinct focus:** Visual Evidence Library searches supplied text regions; this compares actual image pixels for photo selection.

**First demo to build:** Group original geometric scene images with blur, crop and exposure variations while leaving a different scene separate.

**Languages:** Python

**Deliverable:** HTML and PNG contact sheets, similarity explanations and selections.json

**Builds on:** None; begin with the basics of the selected language.

Proposed milestones:

1. Decode images and preserve source dimensions
2. Compute pixel fingerprints and sharpness measures
3. Group similar shots for manual selection
4. Export a contact sheet and editor selection manifest

## Level 2: Builder

<a id="dependency-upgrade-impact-map"></a>

### Dependency Upgrade Impact Map

Help a maintainer review an upgrade using supplied before/after API signatures and a bounded source parser. Map changed symbols to actual call sites, distinguish confirmed incompatibilities from unresolved uses, and emit a targeted test checklist. An optional model can explain evidence but cannot invent removed APIs.

**Distinct focus:** PR Review Reporter checks changed lines; this connects old and new dependency contracts to call sites throughout a repository.

**First demo to build:** Change an authored library signature and identify two affected callers plus one unresolved dynamic call.

**Languages:** Python, TypeScript

**Deliverable:** Call-site impact graph, SARIF findings and targeted test checklist

**Builds on:** [PR Review Reporter](pr-review-reporter/)

Proposed milestones:

1. Read supplied old and new API contracts
2. Index supported import and call-site forms
3. Link changed signatures to affected code
4. Export findings with unresolved cases visible

<a id="gesture-shortcut-pad"></a>

### Gesture Shortcut Pad

Help a presenter or educator control a local practice application with a few self-recorded gestures. Normalize pointer strokes, compare them with an explicit sequence-distance algorithm, expose uncertain matches, and export a portable gesture profile plus a small browser integration demo.

**Distinct focus:** Desktop Control executes coordinate actions; this learns labels from pointer gestures and integrates them into a local application.

**First demo to build:** Draw three original gesture classes to navigate a fictional slide deck and inspect an ambiguous stroke.

**Languages:** TypeScript

**Deliverable:** An interactive gesture pad, gesture-profile.json and label events for another browser app

**Builds on:** None; begin with the basics of the selected language.

Proposed milestones:

1. Capture and normalize original pointer strokes
2. Compare strokes with an inspectable distance function
3. Review uncertain matches and add better examples
4. Export the gesture profile and demonstrate app integration

## Level 3: Engineer

<a id="ci-failure-reproducer"></a>

### CI Failure Reproducer

Help a contributor reproduce a failed job from an exported workflow log, commit identity and declared environment. Identify the first failing command, distinguish infrastructure failures from test failures, and produce an allowlisted local replay recipe. Retain the original log lines beside every generated instruction.

**Distinct focus:** Tiny Coding Agent patches a local workspace; this recovers the environment and minimal replay steps from a failed CI job.

**First demo to build:** Reduce an authored failed job to a three-step local reproduction while retaining the original failure lines.

**Languages:** Python, TypeScript

**Deliverable:** Reproduction manifest, shell-free replay CLI and HTML failure brief

**Builds on:** [Tiny Coding Agent](tiny-coding-agent/), [PR Review Reporter](pr-review-reporter/)

Proposed milestones:

1. Normalize job steps and source line ranges
2. Separate the initiating failure from downstream noise
3. Build an explicit replay recipe
4. Run an approved local command and compare evidence

Primary references: [Reference 1](https://docs.github.com/en/actions/how-tos/monitor-workflows/use-workflow-run-logs).

<a id="label-adjudication-desk"></a>

### Label Adjudication Desk

Help a small team create useful evaluation labels without silently replacing disagreement with majority vote. Import independently labeled records, blind annotator identities during review, group disagreements and capture an explicit final decision with its evidence. Export a local review page and versioned JSONL that preserves both original labels and adjudication history.

**Distinct focus:** Dataset Split Auditor checks dataset separation and Feedback Theme Board groups comments; this project produces accountable human reference labels for evaluations.

**First demo to build:** Review three disagreements in an authored annotation set and export both accepted decisions and one unresolved case.

**Languages:** Python, TypeScript

**Deliverable:** Local adjudication UI, agreement report and provenance-preserving labeled JSONL

**Builds on:** [Dataset Split Auditor](dataset-split-auditor/), [Feedback Theme Board](feedback-theme-board/)

Proposed milestones:

1. Import independent labels and preserve record provenance
2. Measure agreement and build a blinded review queue
3. Capture evidence-backed adjudication decisions
4. Export versioned labels with unresolved cases visible

**Scope boundary:** Retain unresolved judgments and raw agreement counts. Inter-annotator agreement measures consistency, not the objective truth of a label.

<a id="lost-item-match-desk"></a>

### Lost Item Match Desk

Help a community venue match lost-item descriptions with photographed found objects. Combine explicit text features, simple image-color descriptors and optional reviewed vision proposals, then export an HTML candidate-pair desk and a decision file for the venue's existing records.

**Distinct focus:** Catalog Record Linker reconciles structured records; this teaches multimodal candidate matching with separate text and image evidence.

**First demo to build:** Compare original photos of two similar bottles and one umbrella against authored descriptions and leave an ambiguous bottle unresolved.

**Languages:** Python

**Deliverable:** An HTML object-pair review desk, feature explanations and match-decisions.json

**Builds on:** [Catalog Record Linker](catalog-record-linker/), [Photo Burst Contact Sheet](#photo-burst-contact-sheet) (planned)

Proposed milestones:

1. Import object descriptions, photos and intake identifiers
2. Compute text and image features independently
3. Rank candidate pairs and review conflicting evidence
4. Export match decisions with their source records

<a id="presentation-rehearsal-coach"></a>

### Presentation Rehearsal Coach

Help a speaker improve a rehearsal by aligning supplied slide text and timed transcript segments. Compute explicit pacing and topic-coverage signals, show the source phrases behind suggested practice targets, and export a slide-by-slide HTML report with a reusable rehearsal comparison file.

**Distinct focus:** Meeting Notes to Actions extracts commitments; this aligns a speaker's delivery to planned visual material and supports deliberate rehearsal.

**First demo to build:** Compare two original three-slide rehearsals and identify a skipped definition with its supporting transcript ranges.

**Languages:** Python

**Deliverable:** A slide-linked HTML rehearsal report, coverage.json and a comparison between two rehearsals

**Builds on:** [Voice Note Transcriber Pipeline](voice-note-transcriber-pipeline/), [Semantic Notes Search](semantic-notes-search/)

Proposed milestones:

1. Import slide text and timed rehearsal segments
2. Align spoken segments to candidate slides
3. Measure pacing and review apparent coverage gaps
4. Export a rehearsal report and compare a second attempt

<a id="semantic-cache-correctness-lab"></a>

### Semantic Cache Correctness Lab

Build an opt-in answer cache that binds entries to tenant, model, source revision and expiry. Compare exact and semantic candidate matching using authored near-miss questions, including changed numbers and negation. Export a local HTTP adapter and a false-hit report; similarity alone must not authorize cross-user reuse.

**Distinct focus:** RAG Freshness Pipeline versions source content; this decides whether a prior answer can be reused for a new query under identity and freshness constraints.

**First demo to build:** Show a cache hit for a paraphrase and a miss when the question changes a critical number or tenant.

**Languages:** Go, Python

**Deliverable:** Local cache adapter and false-hit, latency and invalidation report

**Builds on:** [Semantic Notes Search](semantic-notes-search/), [RAG Freshness Pipeline](rag-freshness-pipeline/)

Proposed milestones:

1. Define identity, freshness and privacy boundaries
2. Implement exact-match lookup and invalidation
3. Evaluate semantic candidates against adversarial pairs
4. Export a bounded HTTP adapter and reuse evidence

Primary references: [Reference 1](https://www.rfc-editor.org/rfc/rfc9111.html).

<a id="tool-contract-migration-checker"></a>

### Tool Contract Migration Checker

Help tool authors evolve a callable interface while existing agents still hold old argument shapes. Compare a documented subset of before-and-after schemas, generate counterexamples for required fields and narrowed values, and replay saved calls through both validators. Export a compatibility report and reviewable migration fixtures for CI.

**Distinct focus:** JSON Schema Output Guard validates one payload; this project reasons about compatibility between two tool contracts and supplies concrete calls that change validity. It does not map package upgrades to source call sites.

**First demo to build:** Add a required argument to a fictional catalog tool and generate a saved call that passes the old contract but fails the new one.

**Languages:** TypeScript, Python

**Deliverable:** Schema compatibility CLI, breaking-call fixtures and CI report

**Builds on:** [JSON Schema Output Guard](json-schema-output-guard/)

Proposed milestones:

1. Load versioned tool contracts and saved calls
2. Classify supported schema changes
3. Generate and replay breaking-call counterexamples
4. Export migration fixtures and a compatibility gate

**Scope boundary:** Publish the supported schema subset and mark unhandled keywords unresolved instead of declaring full JSON Schema compatibility.

<a id="video-highlight-storyboard"></a>

### Video Highlight Storyboard

Help a tutorial creator assemble short excerpts from a supplied video, frame samples and timed transcript. Combine visible shot changes with transcript topic scores, preserve exact source time ranges, and export a playable storyboard and edit-decision JSON for a video editor.

**Distinct focus:** Voice Note Transcriber Pipeline creates captions; this combines visual and transcript timing to select an editable video sequence.

**First demo to build:** Select a concise introduction and demonstration from an original paper-folding tutorial without cutting a sentence midway.

**Languages:** Python

**Deliverable:** A timestamped HTML storyboard, selected thumbnails and edit-decisions.json

**Builds on:** [Voice Note Transcriber Pipeline](voice-note-transcriber-pipeline/), [Photo Burst Contact Sheet](#photo-burst-contact-sheet) (planned)

Proposed milestones:

1. Align video metadata, frame samples and transcript time
2. Generate shot and topic boundary candidates
3. Review clip selections under a duration budget
4. Export the storyboard and editor-facing time ranges

## Level 4: Systems

<a id="a2a-task-handoff-workbench"></a>

### A2A Task Handoff Workbench

Help teams connect agents that expose different capabilities and task lifecycles. Read Agent Cards, choose a mutually supported binding, and run a handoff that includes a request for more input, cancellation and a final artifact. Export a local client-server pair and a replayable receipt showing every state transition and artifact owner.

**Distinct focus:** Multi-Agent Code Review Panel coordinates local reviewers for one purpose; this project tests task exchange between independent protocol participants.

**First demo to build:** Have two local agents assemble an authored workshop brief, pause for one missing input and exchange the final artifact.

**Languages:** Python, TypeScript

**Deliverable:** Two local agent endpoints, handoff client and task/artifact replay bundle

**Builds on:** [Typed Workflow Agent with Mastra](typed-workflow-agent-with-mastra/), [Agent Trace Debugger](agent-trace-debugger/)

Proposed milestones:

1. Read Agent Cards and select supported interfaces
2. Create a task and preserve message identity
3. Handle input requests and cancellation
4. Exchange artifacts and replay the complete handoff

**Scope boundary:** Select and pin the A2A protocol revision, binding and SDK versions at implementation time. Verify their wire compatibility and capability declarations with real local endpoints before claiming support; optional extensions remain explicit.

Primary references: [Reference 1](https://a2a-protocol.org/latest/specification/).

<a id="abstention-calibration-workbench"></a>

### Abstention Calibration Workbench

Help teams set a defensible accept-or-defer rule for a bounded task. Tune a score threshold on labeled development records under explicit error costs, freeze that policy, and evaluate held-out risk and coverage across slices. Export a decision-policy file and audit that shows how many requests need human review.

**Distinct focus:** Local Model Evaluation Harness reports model performance and calibration; this project turns scores into an operational defer policy with a separate threshold-selection phase.

**First demo to build:** Tune a defer threshold on an authored development split, freeze it and reveal its different coverage on the held-out split.

**Languages:** Python

**Deliverable:** Frozen accept/defer policy JSON, risk-coverage curves and held-out slice audit

**Builds on:** [Dataset Split Auditor](dataset-split-auditor/), [Local Model Evaluation Harness](local-model-eval-harness/)

Proposed milestones:

1. Validate separated development and holdout records
2. Tune thresholds under declared error costs
3. Freeze and evaluate the policy on holdout slices
4. Export a decision adapter and review-volume estimate

**Scope boundary:** Input scores are not automatically probabilities. Report empirical results and uncertainty without promising a deployment-wide error bound from a small dataset.

<a id="artifact-provenance-gate"></a>

### Artifact Provenance Gate

Help a maintainer inspect a downloaded agent plugin or release artifact before integrating it. Verify the subject digest and attestation signature, evaluate declared builder and source identities against an explicit policy, and preserve the reason for every rejection. Export a CI gate with authored signed fixtures and a separately verified external-verifier adapter.

**Distinct focus:** Cross-Agent Skill Installer writes a local skill package; this project checks artifact origin and build evidence before accepting a package or binary from an external build process.

**First demo to build:** Verify an authored signed artifact, then change one byte and separately reject a signature from an untrusted builder.

**Languages:** Go, Python

**Deliverable:** Artifact verification CLI, trust-policy file and provenance decision JSON

**Builds on:** [Cross-Agent Skill Installer](skill-installer/), [SKILL.md Validator and Loader](skill-validator/)

Proposed milestones:

1. Bind artifact bytes to the attestation subject
2. Verify signatures against an explicit trust root
3. Evaluate builder and source-material policies
4. Export a CI gate with reproducible rejection fixtures

**Scope boundary:** Pin the supported attestation formats and verifier versions. Provenance verification establishes particular origin claims, not content safety or automatic SLSA certification.

Primary references: [Reference 1](https://slsa.dev/spec/v1.2/provenance).

<a id="context-compaction-verifier"></a>

### Context Compaction Verifier

Help agent developers avoid losing a user constraint during a long session. Track explicit facts and constraints with source locators, create an extractive compressed context, and test candidate summaries against a declared retention contract. Export compaction middleware that keeps the prior snapshot when required evidence disappears.

**Distinct focus:** Persistent Memory Server stores persistent records; this project validates one active-session compression step against explicit constraints before replacing working context.

**First demo to build:** Compress an authored session whose required output format is easy to omit and restore the previous snapshot when that constraint disappears.

**Languages:** Python, Rust

**Deliverable:** Compaction middleware, constraint-retention receipt and restorable context snapshots

**Builds on:** [Persistent Memory Server](memory-server/), [Token Counter and Cost Meter](token-counter-and-cost-meter/)

Proposed milestones:

1. Build a source-linked fact and constraint ledger
2. Create a bounded extractive context snapshot
3. Check retention and authored contradiction cases
4. Commit or restore context with an audit receipt

**Scope boundary:** The baseline verifies explicit structured constraints and authored lexical relations. Optional model summaries require separate evaluation and do not turn these checks into general semantic-equivalence proof.

<a id="local-inference-capacity-planner"></a>

### Local Inference Capacity Planner

Help a team choose a concurrency limit for its own model endpoint. Replay an authored arrival schedule, record queue wait separately from service time, and compare observed percentiles and timeouts across bounded runs. Export a capacity curve and editable operating limit based on measured requests, not model-name lookup tables.

**Distinct focus:** Local Model Evaluation Harness scores outputs; this measures queue behavior under controlled arrival schedules and concurrency.

**First demo to build:** Replay the same authored arrivals at three concurrency limits and compare queue wait with service latency.

**Languages:** Python, Go

**Deliverable:** Load-replay manifest, capacity curve and measured operating-limit receipt

**Builds on:** [Local Model Evaluation Harness](local-model-eval-harness/), [Agent Budget Planner](agent-budget-planner/)

Proposed milestones:

1. Define an arrival schedule and resource limits
2. Measure queue and service time independently
3. Compare concurrency settings on the same workload
4. Export a reproducible capacity decision

<a id="mcp-protocol-compatibility-doctor"></a>

### MCP Compatibility Doctor

Help an integration author diagnose a client that connects but cannot use a server correctly. Run authored negotiation, request-correlation and capability probes through a bounded transport adapter. Export a compatibility matrix and the smallest wire transcript that explains a failure, with credentials removed.

**Distinct focus:** MCP Tool Discovery Workbench teaches serving and discovering a tool inventory; this project diagnoses disagreements between independently implemented clients and servers.

**First demo to build:** Connect two authored local participants whose declared capabilities disagree and export the first failing exchange.

**Languages:** TypeScript, Python

**Deliverable:** Protocol probe CLI, compatibility JSON and redacted reproduction transcript

**Builds on:** [MCP Tool Discovery Workbench](mcp-at-scale/), [Agent Trace Debugger](agent-trace-debugger/)

Proposed milestones:

1. Record initialization and negotiated capabilities
2. Probe supported operations and request correlation
3. Reduce a failing exchange to its required messages
4. Export a client-server compatibility receipt

**Scope boundary:** Pin the selected MCP specification revision and transport during implementation; validate probes against that revision and report unsupported capabilities explicitly. Planned probes are not a universal conformance certification.

Primary references: [Reference 1](https://modelcontextprotocol.io/specification/2025-11-25/basic/lifecycle).

<a id="metamorphic-evaluation-workbench"></a>

### Metamorphic Evaluation Workbench

Help evaluators catch inconsistent behavior across related inputs. Author transformations such as unit conversion, record reordering and equivalent formatting, define the output relationship each should preserve, and shrink violating examples. Export a property-based evaluation runner and small failure bundles that can be consumed by CI.

**Distinct focus:** Prompt Regression Tester compares known cases across prompt revisions; this project generates related inputs and checks domain invariants between their outputs.

**First demo to build:** Reorder an authored table, change equivalent unit notation and isolate the transformation that violates the answer contract.

**Languages:** Python, TypeScript

**Deliverable:** Transformation/property runner, minimized counterexample JSON and CI results

**Builds on:** [Prompt Regression Tester](prompt-regression-tester/), [JSON Schema Output Guard](json-schema-output-guard/)

Proposed milestones:

1. Define input transformations and expected relations
2. Run paired cases with recorded response provenance
3. Check relations and shrink violations
4. Export reproducible property failures for CI

**Scope boundary:** Relations are authored assumptions about a particular task. Passing them does not establish general model quality, and stochastic adapters must retain repeated-run evidence.

<a id="oauth-resource-boundary-lab"></a>

### OAuth Resource Boundary Lab

Help developers integrate delegated authorization without accepting a token intended for another service. Build local authorization and resource fixtures, follow metadata discovery, bind authorization to the requested resource, and check audience and scope at the server. Export reusable validation middleware and a redacted explanation of rejected requests.

**Distinct focus:** Tool Call Firewall checks a proposed tool action; this project establishes which resource and permissions a delegated credential actually authorizes.

**First demo to build:** Use a locally issued token against two fictional resources and explain why the second resource rejects it.

**Languages:** Go, TypeScript

**Deliverable:** Local authorization fixture, resource-server middleware and authorization decision transcript

**Builds on:** [MCP Tool Discovery Workbench](mcp-at-scale/), [Tool Call Firewall](tool-call-firewall/)

Proposed milestones:

1. Model the client, issuer and resource identities
2. Discover metadata and bind a proof-key authorization flow
3. Reject wrong audiences and insufficient scopes
4. Integrate middleware and export redacted decisions

**Scope boundary:** Pin the MCP authorization revision and underlying OAuth requirements before coding. Use a local issuer by default and verify any external identity-provider adapter separately; do not describe OAuth 2.1 draft material as a finalized RFC.

Primary references: [Reference 1](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization), [Reference 2](https://www.rfc-editor.org/info/rfc8707/).

<a id="outbound-request-policy-proxy"></a>

### Outbound Request Policy Proxy

Help developers constrain a fetch tool that follows URLs supplied by untrusted documents. Evaluate the scheme, host, resolved address and each redirect, then connect using the validated destination under explicit size and time limits. Export a local egress adapter and loopback cases that reveal redirect and address-policy mistakes.

**Distinct focus:** LLM Gateway With Fallbacks selects configured providers; this project constrains network destinations for arbitrary URL-fetch operations, including redirect transitions.

**First demo to build:** Follow an authored local redirect chain whose final destination violates the declared address policy and inspect the blocked hop.

**Languages:** Go

**Deliverable:** Policy-aware HTTP adapter, destination decision receipts and adversarial local fixtures

**Builds on:** [LLM Gateway With Fallbacks](llm-gateway-with-fallbacks/), [Tool Call Firewall](tool-call-firewall/)

Proposed milestones:

1. Parse destinations and define address policies
2. Bind resolution decisions to actual connections
3. Revalidate redirects and bound responses
4. Export an adapter and replay denied requests

**Scope boundary:** Document the supported DNS, proxy and network assumptions. A process-level adapter is not an operating-system sandbox or a guarantee about traffic that bypasses it.

<a id="release-canary-decision-lab"></a>

### Release Canary Decision Lab

Help a team decide whether an agent behavior change is ready for wider exposure. Assign stable request cohorts, compare candidate and baseline error and latency windows, and distinguish insufficient evidence from a failed gate. Export replayable decision receipts and a local shadow adapter that exercises the policy without deploying anything.

**Distinct focus:** Harness Bench compares policies on a fixed dataset; this project studies sequential release decisions, cohort assignment and evidence accumulated over time.

**First demo to build:** Replay authored baseline and candidate requests through windows that first lack evidence and then trigger an explicit stop decision.

**Languages:** Python, Go

**Deliverable:** Canary policy runner, local shadow adapter and stop/continue/insufficient-evidence receipts

**Builds on:** [Harness Bench](harness-bench/), [Agent Trace Debugger](agent-trace-debugger/)

Proposed milestones:

1. Assign stable cohorts and define release signals
2. Accumulate comparable baseline and candidate windows
3. Apply minimum-sample and stopping rules
4. Replay decisions through a local shadow adapter

**Scope boundary:** Export recommendations only. State the chosen statistical assumptions and do not interpret a small passing window as universal release safety.

<a id="secret-injection-sidecar"></a>

### Secret Injection Sidecar

Help developers keep service credentials out of model-visible tool arguments and routine traces. Build a local broker that resolves opaque handles, binds each handle to a destination and operation, and inserts environment-supplied credentials at the network boundary. Test echoed credential markers and export decision receipts with bounded response filtering.

**Distinct focus:** Tool Call Firewall authorizes actions, while this project removes raw credentials from the agent-facing interface and tests the broker's observable boundaries.

**First demo to build:** Call a local fixture using an opaque handle and demonstrate that its exact echoed credential marker is absent from the returned trace.

**Languages:** Rust, Python

**Deliverable:** Local credential broker, handle-based client adapter and redacted request receipts

**Builds on:** [Tool Call Firewall](tool-call-firewall/), [Streaming Agent Shell in Rust](rust-agent-shell/)

Proposed milestones:

1. Define opaque handles and destination-bound grants
2. Inject credentials inside the broker boundary
3. Exercise response and trace redaction fixtures
4. Integrate a client using handles alone

**Scope boundary:** Use environment secrets and loopback test services. Exact-marker filtering demonstrates a bounded property and cannot guarantee that an arbitrary upstream service never leaks a transformed secret.

<a id="tenant-fairness-scheduler"></a>

### Tenant Fairness Scheduler

Help platform developers share a finite worker pool across tenants with different job sizes. Implement weighted deficit scheduling, bounded admission and aging, then compare per-tenant wait distributions under authored bursts. Export a queue adapter and workload receipts that make starvation and unused capacity visible.

**Distinct focus:** Agent Budget Planner accounts for caller-supplied usage and deadlines; this project decides which tenant receives the next shared execution slot and measures fairness.

**First demo to build:** Replay a burst from one fictional tenant while a second submits small jobs, then compare their waits under two queue policies.

**Languages:** Rust, Python

**Deliverable:** Fair queue adapter, workload replay CLI and per-tenant wait/throughput report

**Builds on:** [Durable Agent Jobs](durable-agent-jobs/), [Agent Budget Planner](agent-budget-planner/)

Proposed milestones:

1. Represent tenant queues and declared job costs
2. Implement weighted deficit scheduling
3. Bound admission and detect starvation
4. Compare fairness on replayed burst workloads

**Scope boundary:** Define fairness against declared or measured service units and expose errors in cost estimates. The local adapter does not claim distributed consensus.

## Level 5: Frontier

<a id="agent-resource-deadlock-lab"></a>

### Agent Resource Deadlock Lab

Help developers coordinate agents that need several exclusive resources, such as a browser session and a workspace. Build wait-for graphs, explore bounded schedules, and compare ordered acquisition with timeout-and-release policies. Export deadlock traces and a resource-coordinator adapter with explicit acquisition receipts.

**Distinct focus:** Durable Agent Jobs coordinates queue leases; this project studies circular wait when tasks hold multiple scarce resources while requesting others.

**First demo to build:** Replay two local agents acquiring a browser and workspace in opposite order, then demonstrate a schedule that completes.

**Languages:** Rust, TypeScript

**Deliverable:** Bounded schedule explorer, deadlock replay traces and resource-coordinator adapter

**Builds on:** [Durable Agent Jobs](durable-agent-jobs/), [Multi-Agent Code Review Panel](multi-agent-code-review-panel/)

Proposed milestones:

1. Model resource ownership and wait-for edges
2. Explore bounded interleavings and detect cycles
3. Compare ordering and timeout-release policies
4. Export a coordinator and replayable deadlock evidence

**Scope boundary:** A bounded explorer proves only the schedules it actually examines. Define resource semantics explicitly and distinguish deadlock from slow work, starvation and crashed ownership.

<a id="judge-bias-calibration-lab"></a>

### Judge Bias Calibration Lab

Help evaluators decide whether an automated pairwise judge is useful for their task. Blind candidate identities, swap answer positions, run authored length counterfactuals and compare decisions with held-out human anchors. Export disagreement and bias breakdowns plus a versioned rubric and judge configuration receipt.

**Distinct focus:** Report Judge checks report evidence and citation support; this project evaluates the reliability and biases of the evaluator itself.

**First demo to build:** Swap the positions of two authored answers and expose a recorded judge that changes preference without new evidence.

**Languages:** Python, TypeScript

**Deliverable:** Pairwise judging runner, bias scorecard and versioned rubric/configuration bundle

**Builds on:** [Report Judge](report-judge/), [Dataset Split Auditor](dataset-split-auditor/), [Local Model Evaluation Harness](local-model-eval-harness/)

Proposed milestones:

1. Create blinded pairs and separated human anchors
2. Run position swaps and length counterfactuals
3. Measure disagreement and slice-specific bias
4. Export a rubric with held-out validation evidence

**Scope boundary:** Recorded judge responses form the offline baseline. Any live model judge must retain its model/configuration receipt, and calibration findings apply only to the tested task distribution.

<a id="trajectory-counterexample-minimizer"></a>

### Trajectory Counterexample Minimizer

Help agent developers diagnose failures that depend on action order. Express bounded temporal rules such as approval preceding an effect, check event traces, and remove irrelevant events while preserving declared causal dependencies. Export a minimal replay bundle with the violated rule and exact event identities.

**Distinct focus:** Agent Trace Debugger explains execution timing; this project checks event-order properties and automatically reduces a failing trajectory.

**First demo to build:** Reduce a twenty-event authored run to the approval and effect events that reproduce a stale-approval violation.

**Languages:** Rust, Python

**Deliverable:** Temporal trace checker, dependency-preserving reducer and minimal replay bundle

**Builds on:** [Agent Trace Debugger](agent-trace-debugger/), [Tool Call Firewall](tool-call-firewall/)

Proposed milestones:

1. Normalize events and declared causal dependencies
2. Check bounded temporal rules
3. Minimize failures without breaking prerequisites
4. Export the smallest reproducible violation

**Scope boundary:** Causal preservation depends on recorded dependencies and the supported rule language. A minimal trace is relative to the chosen reducer and replay oracle, not a proof of global minimality.

<a id="transactional-workspace-patch-broker"></a>

### Transactional Workspace Patch Broker

Help concurrent coding agents avoid overwriting each other's files halfway through a multi-file change. Bind a patch bundle to content hashes, apply it to a private versioned workspace, run declared checks, and publish by switching one workspace pointer. Export a transaction API with conflict evidence and an explicit rollback journal.

**Distinct focus:** Tiny Coding Agent teaches a coding loop; this project makes publication and conflicts explicit when several agents produce overlapping multi-file changes.

**First demo to build:** Let two local workers propose overlapping edits and show one complete publication alongside the other worker's revision conflict.

**Languages:** Rust, TypeScript

**Deliverable:** Workspace transaction API, reviewable patch bundle and conflict/rollback journal

**Builds on:** [Tiny Coding Agent](tiny-coding-agent/), [Sandbox Policy Planner](sandbox-ladder/)

Proposed milestones:

1. Bind a multi-file patch to its input revision
2. Stage edits in a private versioned workspace
3. Reject conflicts and run declared validation
4. Publish a workspace pointer and record rollback

**Scope boundary:** Atomicity applies to the versioned workspace pointer and readers that honor it. Do not claim arbitrary multi-file writes into an existing checkout are atomic.
