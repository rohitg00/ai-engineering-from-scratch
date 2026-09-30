# Projects

Build useful AI engineering tools from scratch, one tested stage at a time. The catalog covers 100 projects across Python, Rust, TypeScript, and Go: 48 ready to build and 52 on the [roadmap](ROADMAP.md).

Each ready project includes a working reference implementation, a learner starter, cumulative stage tests, mechanism diagrams, explanations, and recorded run/output GIFs. Core tests use local fixtures and require no model credentials. Optional framework comparisons use real SDKs with deterministic fake models. Planned projects have proposed outcomes and learning milestones; their implementations and completion tests are still to come.

## Start

```bash
python3 scripts/project_test.py semantic-notes-search --list
python3 scripts/project_test.py semantic-notes-search --init my-semantic-notes-search
python3 scripts/project_test.py semantic-notes-search --stage 1 --path my-semantic-notes-search
```

Use Python 3.12+, Node 22.18+ for TypeScript, rustc with edition 2021, and Go 1.23+. Install only the toolchains the project's language badges require. The reference solution is an instructor artifact:

```bash
python3 scripts/project_test.py research-report-agent --all --solution --strict
python3 scripts/project_test.py --all --solution --strict --report project-results.json
```

The site is built with `node site/build-projects.js --strict`. It bundles project lessons and recordings for static hosting, so preview branches do not depend on unpublished GitHub main files.

## Learn with an agent

In Claude Code, use `/build-project <id>`. In Codex or another compatible host, ask it to use the `build-project` skill for the selected project. The tutor teaches one stage at a time: predict, build, test, reflect. It keeps learning notes in your own `PROJECTS-LEARNING.md`.

## Completion evidence

```bash
python3 scripts/project_test.py semantic-notes-search --all --strict --path my-semantic-notes-search --report completion.json
```

Import `completion.json` on the project page and enter your name to download a printable HTML certificate. Every stage must pass with nonzero tests and no skips. Reference solutions, partial runs, and outdated manifests cannot qualify. The certificate is a local, self-attested community course record, not a proctored or vendor credential. Optional SDK verification is separate from core completion.

## Ready catalog

| Project | Level | Languages | Stages | Estimate |
|---|---|---|---|---|
| [Dataset Split Auditor](dataset-split-auditor/) | 1 | Python | 4 | ~8h |
| [JSON Schema Output Guard](json-schema-output-guard/) | 1 | TypeScript | 4 | ~8h |
| [Prompt Regression Tester](prompt-regression-tester/) | 1 | Python | 4 | ~8h |
| [Semantic Notes Search](semantic-notes-search/) | 1 | Python | 4 | ~8h |
| [SKILL.md Validator and Loader](skill-validator/) | 1 | Rust | 4 | ~8h |
| [Tiny Coding Agent](tiny-coding-agent/) | 1 | Python | 4 | ~8h |
| [Token Counter and Cost Meter](token-counter-and-cost-meter/) | 1 | Rust | 4 | ~8h |
| [Calendar Focus Planner](calendar-focus-planner/) | 2 | TypeScript | 4 | ~8h |
| [Changelog Writer From Git](changelog-writer-from-git/) | 2 | Go | 4 | ~8h |
| [CSV Question Workbench](csv-sql-question-workbench/) | 2 | Python | 4 | ~8h |
| [Document Extraction Review Desk](document-extraction-desk/) | 2 | Python | 4 | ~8h |
| [Document QA With Citations and LangChain](doc-qa-with-citations/) | 2 | Python | 4 | ~8h |
| [Feedback Theme Board](feedback-theme-board/) | 2 | TypeScript | 4 | ~8h |
| [Inbox Triage Desk](inbox-triage-desk/) | 2 | Python | 4 | ~8h |
| [Incident Postmortem Writer](postmortem-writer/) | 2 | Go | 4 | ~8h |
| [Local Model Evaluation Harness](local-model-eval-harness/) | 2 | Python | 4 | ~8h |
| [Meeting Notes to Actions](meeting-notes-to-actions/) | 2 | Python | 4 | ~8h |
| [PR Review Reporter](pr-review-reporter/) | 2 | Python, TypeScript | 4 | ~8h |
| [Research Report Agent](research-report-agent/) | 2 | Rust, Python, TypeScript | 7 | ~20h |
| [Retrieval Evaluation Lab](retrieval-evaluation-lab/) | 2 | Python | 4 | ~8h |
| [Skill Router](skill-router/) | 2 | TypeScript | 4 | ~8h |
| [Source-Grounded Study Coach](source-grounded-study-coach/) | 2 | TypeScript | 4 | ~8h |
| [Agent Budget Planner](agent-budget-planner/) | 3 | Python | 4 | ~8h |
| [Agent Trace Debugger](agent-trace-debugger/) | 3 | TypeScript | 4 | ~8h |
| [Cross-Agent Skill Installer](skill-installer/) | 3 | TypeScript | 4 | ~8h |
| [Harness Bench](harness-bench/) | 3 | Go | 4 | ~8h |
| [LLM Gateway With Fallbacks](llm-gateway-with-fallbacks/) | 3 | Go | 4 | ~8h |
| [Multi-Agent Code Review Panel](multi-agent-code-review-panel/) | 3 | TypeScript | 4 | ~8h |
| [Persistent Memory Server](memory-server/) | 3 | TypeScript, Rust | 4 | ~8h |
| [RAG Freshness Pipeline](rag-freshness-pipeline/) | 3 | Python | 4 | ~8h |
| [Report Judge](report-judge/) | 3 | Python | 4 | ~8h |
| [Self-Correcting Workflow Hooks](workflow-hooks/) | 3 | TypeScript | 4 | ~8h |
| [Skill Supply-Chain Scanner](skill-scanner/) | 3 | Rust | 4 | ~8h |
| [Support Agent With Google ADK](support-agent-with-google-adk/) | 3 | Python | 4 | ~8h |
| [Typed Workflow Agent with Mastra](typed-workflow-agent-with-mastra/) | 3 | TypeScript | 4 | ~8h |
| [Visual Evidence Library](visual-evidence-library/) | 3 | Python | 4 | ~8h |
| [Voice Note Transcriber Pipeline](voice-note-transcriber-pipeline/) | 3 | Python | 4 | ~8h |
| [Web Change Brief](web-change-brief/) | 3 | Go | 4 | ~8h |
| [Cloud Agent With AWS Strands](cloud-agent-with-aws-strands/) | 4 | Python | 4 | ~8h |
| [Desktop Control Backend](desktop-control/) | 4 | Rust | 4 | ~8h |
| [Durable Agent Jobs](durable-agent-jobs/) | 4 | Go | 4 | ~8h |
| [MCP Tool Discovery Workbench](mcp-at-scale/) | 4 | Python, TypeScript | 5 | ~10h |
| [Sandbox Policy Planner](sandbox-ladder/) | 4 | Rust | 4 | ~8h |
| [Streaming Agent Shell in Rust](rust-agent-shell/) | 4 | Rust | 4 | ~8h |
| [Tool Call Firewall](tool-call-firewall/) | 4 | Rust | 4 | ~8h |
| [Browser Agent](browser-agent/) | 5 | TypeScript, Python | 4 | ~8h |
| [Distributed Eval Farm Coordinator](distributed-eval-farm/) | 5 | Go | 4 | ~8h |
| [Self-Improving Skill Loop](self-improving-skill-loop/) | 5 | Python | 4 | ~8h |

## Roadmap

The [52 planned projects](ROADMAP.md) extend all five levels with practical applications, data and multimodal workflows, developer tooling, DevOps, and agent systems. Each brief names its deliverable, prerequisites, first demo and four proposed milestones. The website marks these cards as planned; they do not count toward completed stages or certificates.

## Build an application you can use

The application track adds eight projects: CSV Question Workbench, Document Extraction Review Desk, Calendar Focus Planner, Feedback Theme Board, Inbox Triage Desk, Source-Grounded Study Coach, Visual Evidence Library and Web Change Brief. Each accepts your own input and exports a reviewable artifact such as HTML, JSON, iCalendar or unsent email drafts.

Start with the stated prerequisites, run a fixture, change one input and predict the result. Then implement the stages in your own workspace. Editable mechanism figures show intermediate values; passing tests and explicit limits make the artifact easier for another developer to integrate. Popularity is an outcome to measure after release, not a guarantee attached to a lesson.

## Framework comparisons

Document QA uses LangChain for splitters and model interfaces. Support routing uses Google ADK for real specialist handoffs. The cloud inspection project uses AWS Strands with a local model and keeps cloud calls opt-in. Typed workflows compare the hand-built executor with Mastra. Framework use is limited to those concrete jobs; standard-library implementations remain visible.

All four framework projects document their dependency setup and use `--optional --strict`. Missing modules produce a skip with an install hint; strict mode fails. Tests using fake models verify SDK integration, not live provider behavior.

## Scope and evidence

Published fixtures are reviewable, not secret. Evaluation scores describe those fixtures and do not establish production performance. The sandbox project plans policies; it does not provide OS isolation. Desktop control verifies its fixture backend and keeps native access explicit. The browser project includes a real browser adapter in addition to deterministic fixtures. Voice processing includes real PCM segmentation and a multipart HTTP recognition adapter; the offline spoken fixture uses an explicitly supplied reference transcript.

## Contribute

Read [AUTHORING.md](AUTHORING.md) and [SUBMITTING.md](SUBMITTING.md). Copy [_template/](_template/), write an original useful artifact, and add stages that test learner code.
