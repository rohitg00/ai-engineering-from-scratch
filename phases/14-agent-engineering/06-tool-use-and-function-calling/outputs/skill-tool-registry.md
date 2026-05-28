---
name: tool-registry
description: JSON Schema validation、parallel dispatch、observabilityを備えたproduction tool catalogとregistryを構築する。
version: 1.0.0
phase: 14
lesson: 06
tags: [function-calling, tools, schema, validation, bfcl, parallel-tools]
---

task domainが与えられたら、BFCL V4 axes（agentic、multi-turn、live、non-live、hallucination）全体でagentが信頼して使えるtool catalogを生成する。

生成するもの:

1. Tool definitions。各toolについて、`name`（snake_case）、`description`（modelにいつ使うべきか、いつ使うべきでないかを伝える）、typed propertiesを持つJSON Schema input、required fields、該当する場合はenums、numericsのminimum/maximum、per-tool timeout、per-tool sandbox policy（fs surface、network、memory cap）を定義する。
2. Description quality check。各descriptionを「このtoolを他のtoolsよりいつ選ぶべきかをmodelに伝えているか」でcheckする。2つのtoolsに重複するdescriptionがあれば拒否して書き直す。
3. Parallel-dispatch plan。現実的なtaskごとに、どのtool callsがindependent（parallelizable）で、どれがsequentialでなければならないかを特定する。expected dispatch graphを出力する。
4. Validation policy。enum checks、type coercion rules（例: "accept int-as-string, reject float-as-string"）、required-field enforcement。すべてのfailureはstructured observation stringを返し、loopへraiseしない。
5. Observability。各toolはOpenTelemetry GenAI `tool_call` spanをemitし、attributes `gen_ai.tool.name`、`gen_ai.tool.call.id`、`gen_ai.tool.call.arguments`、`gen_ai.tool.call.result`（content policyが要求する場合はinlineではなくreference）を付ける。

強い却下条件:

- generic shell/command-exec tool。拒否し、specific verbs（`git_status`、`fs_read`、`npm_test`）へ分解する。
- parameterがclosed setを持つのにenumがないこと。enum validationはdriftを捕まえる最安の方法である。
- 異なる2つのtoolsに同じdescriptionがあること。modelは信頼して選べない。
- `description`がtool名だけを言うこと（「Adds two numbers」）。alternativesよりいつ選ぶべきかを含める。
- timeoutがないこと。すべてのtool callには上限が必要である。

拒否ルール:

- single agentのtool listが30 toolsを超える場合は拒否し、subagent delegation（レッスン17）を推奨する。
- destructive actionを実行するtoolにconfirmation gateがない場合は拒否し、レッスン09（permissions、sandboxing）を指す。
- taskがcomputer use（click、type、screenshot）の場合は拒否し、レッスン21を指す。これはvision-based actionsを持つ別のtool shapeである。

出力: Anthropic / OpenAI / Gemini SDK callsへ貼り付けられるJSON tool catalog、dispatch-graph diagram、validation-policy document、registryがpassすべきBFCL-style mini-eval。

最後に「次に読むもの」として、レッスン09（sandboxing）、レッスン23（OTel GenAI spans）、またはレッスン30（eval-driven）を指す。
