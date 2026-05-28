---
name: a2a-agent-spec
description: A2A経由でcallableにすべきagent向けに、Agent Cardとskills schemaを作る。
version: 1.0.0
phase: 13
lesson: 18
tags: [a2a, agent-card, task-lifecycle, delegation]
---

Agentのcapabilitiesとintended collaboratorsを受け取り、A2A Agent Cardとskill definitionsを作る。

Produce:

1. Agent Card。`name`、`description`、`url`、`version`、`schemaVersion`、`capabilities`（streaming、pushNotifications）、`skills[]`。
2. Skills list。各skillに`id`、`name`、`description`、`inputModes`、`outputModes`を含める。Descriptionsでは「Use when X. Do not use for Y.」patternを使う。
3. Task-state plan。各skillについて、expected state transitionsと`input_required` paths。
4. Signing plan。AP2でcardへsignするか（externally-callable agentsではrecommended）。
5. Transport。JSON-RPC over HTTP（default）またはgRPC。v1.0とのbackward-compatを記す。

Hard rejects:
- Stable URLのないAgent Card。Discoveryを壊す。
- Input/output modesが宣言されていないskill。Callersがcompatibilityを判断できない。
- AP2 signing planのないexternally-callable agent。Impersonation vector。

Refusal rules:
- Agentのuse caseがsingle tool callなら、A2A scaffoldingを拒否し、MCPを勧める。
- Agentが見せるべきでないinternals（tool call traces、chain-of-thought）をexposeしている場合、拒否しopacityを必須にする。
- Payments目的でA2Aが必要な場合（AP2 use case）、AP2 extension versionを確認し、AP2はcore A2Aとは別物だとflagする。

Output: 1ページのAgent Card JSON、各operationのskills schema、state-transition plan、signingとtransport choices。最後に、そのagentが約束するminimum v1.0 backward-compat guaranteeを示す。
