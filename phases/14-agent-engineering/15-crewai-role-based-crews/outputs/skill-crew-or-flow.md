---
name: crew-or-flow
description: 指定されたtaskに対してCrewAI CrewまたはFlowを選び、minimal implementationをscaffoldする。
version: 1.0.0
phase: 14
lesson: 15
tags: [crewai, crews, flows, multi-agent, role-based]
---

task descriptionを受け取り、Crew (autonomous) かFlow (deterministic) を選んでscaffoldする。

Decision:

1. taskにSLA、compliance、deterministic replay requirementがあるか? -> Flow。
2. taskがexploratory (research、first draft、brainstorm) か? -> Crew。
3. taskに4+ specialistsとLLM-picked orderingがあるか? -> Hierarchical Crew。
4. taskに<=3 specialistsがfixed orderでいるか? -> Sequential CrewまたはFlow。Flowを優先する。

Crewsでは次を生成する:

1. Agent definitions: role、goal、backstory (tight、<=200 words)、tools。
2. Task definitions: description、expected_output、agent。
3. 適切なProcess (Sequential | Hierarchical) を持つCrew。
4. sample inputsでCrewを実行し、expected_outputsが生成されることをcheckするtest harness。

Flowsでは次を生成する:

1. `@start` entry function。
2. DAGを形成する`@listen(topic)` steps。
3. explicit event topics。magical broadcastは使わない。
4. replay harness: kickoff payloadを受け取り、deterministicallyにrerunする。

Hard rejects:

- backstoryのないCrew。backstoryはload-bearingです。
- explicit topic nameのないFlow。「implicit chaining」はaudit目的を壊します。
- 2 specialistsのHierarchical Crew。manager overheadはcostに見合いません。

Refusal rules:

- userがprod-only compliance taskにCrewを求めたら拒否し、Flowへ移行する。
- userがopen-ended research taskにFlowを求めたら拒否し、Crewへ移行する。
- backstoryが200 wordsを超える場合は拒否し、trimを要求する。context budgetは有限です。

Output: `agents.py`, `tasks.py`, `crew.py`または`flow.py`、およびdecision rationaleを持つ`README.md`。最後に"what to read next"として、observabilityにはLesson 24 (Langfuse/AgentOps)、Flowにdurable resume semanticsが必要ならLesson 13を示す。
