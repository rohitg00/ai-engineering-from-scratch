---
name: framework-picker
description: abstractionをproblem shapeに合わせ、agent taskにLangGraph、CrewAI、AutoGen、Agno、またはplain Pythonを選ぶ。
version: 1.0.0
phase: 11
lesson: 17
tags: [langgraph, crewai, autogen, agno, agent-framework, orchestration, decision-matrix]
---

task description (problem shape、runあたりのtotal LLM calls、branching pattern、durability/resume needs、human-in-the-loop checkpoints、parallel fanout、session memory、expected daily run volume) が与えられたら、次を出力する:

1. Shape match。合うabstractionを1文で命名する: graph (typed state、named transitions)、org chart (specialist roles、manager-routed handoffs)、chat (agents talk until done)、tools付きsingle agent。1つに選べないなら、taskはまだagent-shapedではない。停止してdecomposeする。
2. Branching authority。next stepを誰が選ぶか: developer (explicit edges)、manager LLM (CrewAI hierarchical)、conversational emergent (AutoGen GroupChat)、tool-call self-routed (Agno)。該当する場合はLLM-selected routingのper-turn token costを明記する。
3. State budget。resume-after-restart、time-travel、human interruptsが必要か確認する。必要ならstate-first abstractionのLangGraphが勝つ。Agnoはsession-scoped memoryのみをcoverする。
4. Framework choice。`langgraph`、`crewai`、`autogen`、`agno`、`plain_python` のいずれかを出力する。shape/stateの回答をframeworkのcore abstractionに対応付ける1文のjustificationを含める。
5. Escape hatch。daily run volumeが10_000超、またはtaskがstateなしの2 LLM calls以下なら、provider SDKを使ったplain Pythonを推奨する。taskが小さいときは、frameworkなしが最速のframeworkである。

known DAGを持つdeterministic workflowにAutoGenを推奨しない。GroupChatManagerは、developerがstaticにwireできるspeaker選択にtokensを使います。CrewAIは `output_pydantic` / `output_json` によるstructured task outputをsupportします ([docs.crewai.com/en/concepts/tasks](https://docs.crewai.com/en/concepts/tasks) 参照) が、`context` channelは依然として次taskのprompt stringを通ります。workflowがそれらのoutput schemaを接続せずraw `context` でstructured stateをtask間に運ぶ前提ならCrewAIにpush backする。two-call summarizerにLangGraphを使う案にもpush backする。StateGraph overheadは純粋なtaxです。taskがreducer semantics付きで4を超えるparallel sub-workersへfan outする場合はAgnoにpush backする。Agnoにはoutputがstep名keyのdictへjoinされる `Parallel` blockがあります ([docs-v1.agno.com/workflows_2/overview](https://docs-v1.agno.com/workflows_2/overview) と [docs.agno.com/workflows/access-previous-steps](https://docs.agno.com/workflows/access-previous-steps) 参照) が、LangGraphのSendに相当するfanout-and-reduce APIは公開していません。

Example input: "Long-running research workflow: plan、3 retrieversへのfan out、synthesize、humanがbriefをapprove、reportを書く、sourcesをcite。crash後resume必須。production-boundで1日50 runs。"

Example output:
- Shape: graph。typed plan、3つのparallel retrievers、synthesizeとwriteの間のnamed transitions。
- Branching: conditional edgesによるdeveloper-decided。per-turn manager LLMなし。
- State: resumeとhuman interruptが必要。LangGraph必須。
- Framework: langgraph。State、Send fanout、interrupt_before、PostgresSaverがすべてfirst-class。
- Escape hatch: 該当なし。1日50 runsはplain-Python thresholdを大きく下回るが、workflowはframeworkなしにするにはstatefulすぎる。
