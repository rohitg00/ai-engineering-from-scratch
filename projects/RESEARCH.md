# Project research and selection

Reviewed on 2026-10-09. This is a focused survey of eleven public repositories across privacy, data quality, human review, workflows, migration, evaluation, visualization and HTTP delivery. It is not an exhaustive survey of GitHub.

Repository documentation informed the problem selection. No external implementation was copied or installed as a course dependency. These upstream repositories were inspected as research sources; the local tests and manual runs apply to this repository's original projects, not to upstream products.

| Research source | Commit inspected | Useful mechanism | Decision |
|---|---|---|---|
| [data-privacy-stack/presidio](https://github.com/data-privacy-stack/presidio) | [2523c7b74a46](https://github.com/data-privacy-stack/presidio/tree/2523c7b74a469270c5c78bb253f140eafca21e31) | Local recognizers and redaction operators need explicit coverage boundaries. | Add Sensitive Text Redaction Gate: original bounded detectors, overlap unions and receipts that omit source values. |
| [fivetran/great_expectations](https://github.com/fivetran/great_expectations) | [b8bf1fd898ec](https://github.com/fivetran/great_expectations/tree/b8bf1fd898ec3ffce2f9f37e605406e306ffd85f) | Data quality needs executable expectations and inspectable results. | Add Dataset Contract Gate: flat row rules plus cross-row uniqueness and quarantine. |
| [sodadata/soda-core](https://github.com/sodadata/soda-core) | [524057973ad8](https://github.com/sodadata/soda-core/tree/524057973ad8aaa64d87dc49560a2fe2f2e43ef6) | Data contracts separate the expected data shape from observed quality. | Use the same new dataset project; do not add a second overlapping quality checker. |
| [datacontract/datacontract-specification](https://github.com/datacontract/datacontract-specification) | [eeb60a94f8ff](https://github.com/datacontract/datacontract-specification/tree/eeb60a94f8ff3e5fdc8802aed4bff3b52797482d) | A contract declares the policy that validation must implement. | Document our smaller teaching format explicitly; do not claim conformance to this specification. |
| [HumanSignal/label-studio](https://github.com/HumanSignal/label-studio) | [b03f43c6a634](https://github.com/HumanSignal/label-studio/tree/b03f43c6a634d8a54646c82785533e05a408b428) | Human review requires portable decisions with source identity. | Strengthen catalog linking, subtitle review and CSV repair exports; the existing label-adjudication plan remains separate. |
| [temporalio/sdk-go](https://github.com/temporalio/sdk-go) | [6ae07bca8301](https://github.com/temporalio/sdk-go/tree/6ae07bca8301bd25ba1358d1ea92ae837932d76b) | Durable workflows make failures and retries visible. | Complete the retry lab and signed inbox with bounded local experiments; retain the existing durable-jobs project. |
| [transact-rs/sqlx](https://github.com/transact-rs/sqlx) | [8b65c2fb42a3](https://github.com/transact-rs/sqlx/tree/8b65c2fb42a3a523b77000f41b648986d1d49ba0) | Migration tools expose schema changes and validation workflows. | Complete Database Migration Rehearsal using SQLite backups and actual transaction checks. |
| [promptfoo/promptfoo](https://github.com/promptfoo/promptfoo) | [e1b31c2bd8e2](https://github.com/promptfoo/promptfoo/tree/e1b31c2bd8e24c821b5bbf46768911321911cfd5) | Evaluation tools provide declarative test inputs and failure reports. | Retain existing prompt regression and model-evaluation tools; avoid another thin evaluation wrapper. |
| [holoviz/panel](https://github.com/holoviz/panel) | [dd668711f030](https://github.com/holoviz/panel/tree/dd668711f0308bb189e0492a0dc0ad8c85602039) | Useful data apps connect visible controls to calculated results. | Complete the chart storyboard, tradeoff explorer and materials planner with real local controls. |
| [go-resty/resty](https://github.com/go-resty/resty) | [dabdb4c45c53](https://github.com/go-resty/resty/tree/dabdb4c45c530401247003c76445632122766af0) | HTTP clients need explicit retry and streaming behavior. | Complete the retry, hedging and streaming-recovery projects with local endpoint fixtures. |
| [standard-webhooks/standard-webhooks](https://github.com/standard-webhooks/standard-webhooks) | [7537d2a2d3d5](https://github.com/standard-webhooks/standard-webhooks/tree/7537d2a2d3d52d8f2e0ecd12527af4a9307fd81b) | Webhook contracts make raw bytes, signatures, time bounds and delivery identities explicit. | Complete Signed Webhook Inbox. Label its signature format as an authored contract rather than a provider-compatible adapter. |

## Two additions beyond the existing roadmap

[Sensitive Text Redaction Gate](sensitive-text-redaction-gate/) operates before a model or dataset consumer receives text. It detects only documented patterns and configured literals, merges overlap unions and exports redacted JSONL. Its tests include invalid addresses, overlapping literal matches, Unicode offsets and a second consumer reading the export. It is distinct from Tool Call Firewall, which authorizes actions, and Secret Injection Sidecar, which remains a plan for injecting credentials at a network boundary.

[Dataset Contract Gate](dataset-contract-gate/) checks a batch before ingestion. It separates row validity from whole-dataset gates and quarantines every member of a duplicate group. Its tests invoke the CLI and validate the accepted partition independently. It is distinct from Dataset Split Auditor, which examines train/test leakage, and JSON Schema Output Guard, which validates model response shapes.

## Promotion requirements

Only runnable implementations with four tested stages, learner starters, documented own-input commands, calculated figures and recordings enter the ready catalog. Existing plans retain their original scope until their implementations and local checks pass. No untested research candidate was added as a ready project.

Reference solutions passing tests do not earn learner certificates. Local fixtures do not prove live cloud-provider compatibility. Protocol sources and explicit limits are listed in each project README; the [validation report](VALIDATION.md) records what actually ran.
