# Real Projects Section Plan

The Projects section connects the course's individual mechanisms to useful artifacts. It is a separate staged catalog, with the same visual language, interactive SVG figures, agent tutor workflow, and explicit verification used by the rest of the course.

## Delivery contract

Each ready project has four to eight ordered stages, a real reference implementation, intentionally incomplete starters, deterministic tests against the learner workspace, original explanations, a mechanism figure per stage, and recorded run/output demos. Readiness validation checks file paths, stage identity, figure registration, and media. The grader independently runs the actual language toolchains; an empty suite is never a pass.

Python handles parsing, model-facing coordination, and evaluation. Rust handles bounded parsers, search loops, policy tools, and terminal interfaces. TypeScript handles typed contracts, browser artifacts, and workflow interfaces. Go handles concurrent workers, gateways, queues, and network-oriented tools. Mixed-language projects use explicit process or JSON contracts.

## Five-level ladder

1. Starter: one useful input/output tool and its basic contracts.
2. Builder: a pipeline that combines several mechanisms.
3. Engineer: state, budgets, retries, and measured outcomes.
4. Systems: protocol boundaries, concurrency, tool policy, and process control.
5. Frontier: reproducible comparisons, distributed evaluation, browser control, and trace diagnosis.

Projects are scoped learning artifacts, not claims of production completeness. Estimates reflect the supplied stages; production hardening and live integrations are separate work.

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

## Planned expansion

The catalog now has 100 entries: 48 ready projects and 52 planned projects across the same five levels. [ROADMAP.md](ROADMAP.md) contains each planned project's useful outcome, prerequisite path, original first-demo concept and four proposed milestones. `roadmap.json` supplies the planned cards on the website. Plans become ready only after satisfying the implementation, lesson, test, figure and recording contract.

## Research Report Agent pilot

The pilot has seven stages and three languages. Rust implements BM25 search behind newline-delimited JSON. Python extracts exact Unicode source spans, plans facets, writes cited claims, verifies evidence, applies budgets, and computes evaluation metrics. TypeScript validates the report contract and renders an interactive HTML report with hover/focus citations and an expandable run trace.

Its core grader includes native Rust and TypeScript tests, plus a prompt-injection and cache-boundary regression suite. Evaluation receipts include the supplied dataset and explicit scoring components; their scores describe that fixture, not unseen production accuracy. The demo recordings show starter initialization/failure, passing reference tests, and real browser inspection of report evidence.

## Completion and community submissions

Progress checkboxes are self-reported browser-local notes. Certificates require a complete strict learner report matching the project manifest, and remain clearly labeled local community evidence. Optional SDK checks are not implied by core completion. Contributors retain author attribution; community projects use the same readiness gate and grading contract.

## Verification and rollout

The shared build bundles docs and media inside the site output. CI validates manifests, grader contracts, certificates, and every reference stage. Browser verification covers desktop/mobile, light/dark, stage navigation, figure mounting, recordings, and certificate import. A feature PR is the review boundary; deployment and merge remain separate actions.

## Originality and references

All implementations and exercises are original. Cite primary papers, official API documentation, and standards where they explain the mechanism. No outside curriculum repository is used as a model. Framework names appear only where a requested integration is actually implemented and tested.
