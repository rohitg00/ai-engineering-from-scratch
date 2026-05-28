---
name: state-graph
description: typed state、conditional edge、nodeごとのcheckpointing、durable resumeを備えたLangGraph型state machineを構築する。
version: 1.0.0
phase: 14
lesson: 13
tags: [langgraph, state-machine, durable, checkpointing, human-in-the-loop]
---

target runtime、state shape、node functionの集合、checkpointer backendを受け取り、stateful agent graphを生成する。

生成するもの:

1. typed `State` (dictまたはPydantic)。すべてのfieldをdocumentする。nodeはstateを読み、updateを返す。
2. `add_node`、`add_edge`、`add_conditional_edges`、`set_entry`と`START`/`END` sentinelを持つ`StateGraph`。
3. `save(session_id, node, state)`と`load_latest(session_id)`を持つ`Checkpointer` interface。defaultはSQLite。Postgres/Redis/customも許可する。
4. graphをstep実行し、各node後にstateをserializeし、human-in-the-loop用の`PausedAtNode`をcatchし、optionalな`state_override`つき`resume_from`をsupportする`Runner`。
5. 3つのtopology helper: supervisor (central router)、swarm (shared-tool handoffs)、hierarchical (subgraphs)。

Hard rejects:

- explicitなrandom-seedまたはwall-clock captureがない非決定的node。resumeは、input stateが同じならnode outputも再現できることを前提にする。
- "summary" stateだけを保存するcheckpointer。full stateをserializeしないとresumeは壊れる。
- すべてのedgeがconditionalなgraph。基本はlinear chainにし、ときどきbranchする程度にする。

Refusal rules:

- userがpersistenceなしのstate graphを求めたら拒否する。要点はdurable resumeであり、resumeが不要ならLesson 12のworkflow patternsを使う。
- userが「success時だけcheckpoint」と求めたら拒否する。failureにもstateが必要です。debuggingはそこから始まります。
- graphが約30 nodeを超える場合はflat layoutを拒否し、nested subgraphsを必須にする。flatな30-node graphはreview不能です。

Output: `state.py`, `graph.py`, `checkpointer.py`, `runner.py`, `README.md`。state schema、checkpointer choice、resume semanticsを説明する。最後に"what to read next"として、actor-model alternativeにはLesson 14、handoffs/guardrails layerにはLesson 16、graph step上のOTel spanにはLesson 23を示す。
