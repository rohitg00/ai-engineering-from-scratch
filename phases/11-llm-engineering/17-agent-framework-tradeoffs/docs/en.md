# Agent Framework Tradeoffs — LangGraph vs CrewAI vs AutoGen vs Agno

> どのframeworkも同じdemo (research agentがreportを作る) を売り、同じbug (state schemaがorchestration layerと衝突する) を隠しています。problemの形にabstractionが合うframeworkを選びます。それ以外は、あなたが2回書くglueです。

**種別:** 学習
**言語:** Python
**前提条件:** Phase 11 · 09 (Function Calling), Phase 11 · 16 (LangGraph)
**所要時間:** 約45分

## 問題

複数のLLM callを必要とするtaskがあります。research workflow (plan、search、summarize、cite) かもしれません。code-review pipeline (parse diff、critique、patch、validate) かもしれません。flightを予約し、emailを書き、expense reportを提出するmulti-turn assistantかもしれません。そこでframeworkを選びます。

3日後、そのframeworkのabstractionが漏れていることに気づきます。CrewAIはrolesをくれますが、"researcher" がstructured planを "writer" に渡そうとすると衝突します。AutoGenはagents間chatをくれますが、first-class stateがないのでcheckpointはconversation logのpickleになります。LangGraphはstate graphをくれますが、agentが何をするか分かる前にすべてのtransitionに名前を付けることを要求します。Agnoはsingle-agent abstractionをくれますが、3つのconcurrent workersへfan outしようとすると苦しくなります。

解決策は「best frameworkを選ぶ」ことではありません。frameworkのcore abstractionをproblemの形に合わせることです。このlessonではその地図を描きます。

## 概念

![Agent framework matrix: core abstraction vs problem shape](../assets/framework-matrix.svg)

2026年のlandscapeでは4つのframeworkが支配的です。それぞれのcore abstractionは同じではありません。

| Framework | Core abstraction | Best fit | Worst fit |
|-----------|------------------|----------|-----------|
| **LangGraph** | `StateGraph` — typed state、nodes、conditional edges、checkpointer。 | explicit stateとhuman-in-the-loop interruptsを持つworkflow。time-travel debuggingが必要なproduction agents。 | topologyが未知のlooseなrole-driven brainstorming。 |
| **CrewAI** | `Crew` — roles (goal、backstory)、tasks、process (sequentialまたはhierarchical)。 | short linear/hierarchical planを持つrole-playingまたはpersona-driven workflow。 | crewのturn historyを超えるstatefulなもの、complex branching。 |
| **AutoGen** | `ConversableAgent` pair — exit conditionまでturnごとに話す2つ以上のagents。 | chatからthinkingが生まれるmulti-agent *dialogue* (teacher-student、proposer-critic、actor-reviewer)。 | known DAGを持つdeterministic workflow、restartをまたぐdurable stateが必要なもの。 |
| **Agno** | `Agent` — single LLM + tools + memory。teamへcompose可能。 | fast-to-build single agentsとlightweight teams。強いmulti-modalityとbuilt-in storage drivers。 | custom reducersを持つ深いexplicitly-branched graph。 |

### "Abstraction" が実際に意味するもの

frameworkのcore abstractionとは、architectureを説明するときwhiteboardに描くものです。

- **LangGraph** → graphを描きます。nodesはsteps、edgesはtransitionsで、各地点のstate objectはtypedです。mental modelはstate machineです。
- **CrewAI** → org chartを描きます。各roleにjob descriptionがあり、managerがtasksをrouteします。mental modelはspecialistsの小さなteamです。
- **AutoGen** → Slack DMを描きます。2つのagentsが互いにmessageし、moderatorが必要なら3つ目が参加します。mental modelはchatです。
- **Agno** → toolsがぶら下がったsingle boxを描きます。teamにしたければboxを隣に置きます。mental modelは "batteries includedのagent" です。

### Stateの問題

stateは、productionで多くのframework選択が破綻する場所です。

- **LangGraph。** Typed state (`TypedDict` またはPydantic model)、per-field reducers、first-class checkpointer (SQLite/Postgres/Redis)。resume、interrupt、time-travelは無料で付いてきます。*(Phase 11 · 16参照。)*
- **CrewAI。** stateは `context` field経由でtask間をstringとして流れるか、`output_pydantic` 経由でstructuredに流れます。durableなper-crew storeは標準ではなく、crewがrestartを生き残る必要があるなら自分で追加します。
- **AutoGen。** stateはchat historyとuser-defined `context` です。conversation transcriptはpersistしますが、arbitrary workflow stateはadapterを書かない限りpersistしません。
- **Agno。** `storage=` で `Agent` に接続されるbuilt-in storage drivers (SQLite、Postgres、Mongo、Redis、DynamoDB) があり、conversation sessionsとuser memoriesが自動でpersistします。full graph checkpointerではなく、session storeです。

### Branchingの問題

自明でないagentは必ずbranchします。誰がbranchを決めるかが重要です。

- **LangGraph** — conditional edgesでdeveloperが決めます。routingはnamed branchesを持つPython functionです。branchはcompiled graph内でfirst-classで、checkpointerがどのbranchを通ったかを記録します。
- **CrewAI** — hierarchical modeではmanagerが決めます。sequential modeではbuild時にdeveloperが決めます。routingはtask list内にimplicitで、manager prompt外にfirst-classな "if" はありません。
- **AutoGen** — agentsがchatで決めます。branchingは次に誰が話すかからemergentに生まれます。`GroupChatManager` がnext speakerを選びます。`speaker_selection_method` を手書きできますが、defaultはLLM-drivenです。
- **Agno** — agentが次にcallするtoolで決まります。teamにはcoordinator/router/collaborator modeがありますが、それを超えるbranchingはdeveloperの責任です。

### Observabilityの問題

- **LangGraph** — LangSmithまたは任意のOTel exporter経由のOpenTelemetry。すべてのnode transitionがtrace spanになり、checkpointsはreplay可能なtraceにもなります。LangSmithがfirst-party optionで、Langfuse/Phoenixにもadaptersがあります。
- **CrewAI** — 2025年後半からfirst-class OpenTelemetry。Langfuse、Phoenix、Opik、AgentOpsとのintegration。
- **AutoGen** — `autogen-core` 経由のOpenTelemetry integration。AgentOpsとOpikにconnectorsがあります。tracing granularityはper-nodeではなくper-agent-messageです。
- **Agno** — built-in `monitoring=True` flagとOpenTelemetry exporters。session trace用にLangfuseと密にintegrationします。

### Costとlatency

4つのframeworkはすべてper-call overhead (framework logic、validation、serialization) を追加します。overheadが小さい順の大まかな並びは Agno ≈ LangGraph < CrewAI ≈ AutoGen です。差の大半は、frameworkがどれだけextra LLM routingを行うかで決まります。CrewAIのhierarchical managerは誰が次に動くかを決めるためtokensを使います。AutoGenの `GroupChatManager` も同じです。LangGraphは、あなたが `llm.invoke` と書いた場所でだけtokensを使います。Agnoのsingle-agent pathは薄いです。

runあたりcostが重要なら、LLM-selected routingよりexplicit routing (LangGraph edges、AutoGen `speaker_selection_method`) を選びます。

### Interoperability

- **LangGraph** ↔ **LangChain** tools、retrievers、LLMs。first-class MCP adapter (MCP serversとしてimportされたtools)。
- **CrewAI** ↔ toolsは `BaseTool` を継承。LangChain tools、LlamaIndex tools、MCP toolsをすべてadapt可能。`allow_delegation=True` によるcrew-to-crew delegation。
- **AutoGen** → `FunctionTool` が任意のPython callableをwrap。MCP adapterあり。agent-to-agent patternではAG2 ecosystemと密結合。
- **Agno** → `@tool` decoratorまたはBaseTool subclass。MCP adapter。toolsはagents/teams間でshare可能。

## Skill

> あるagent problemに対して、なぜそのframeworkが正しいのかを1文で説明できる。

build前checklist:

1. **形を描く。** これはgraph (typed state、named transitions) か。role play (specialistsがworkをhandoff) か。chat (agentsが完了まで話す) か。tools付きsingle agentか。
2. **誰がbranchするかを決める。** Developer-decided branching → LangGraph。Manager-agent-decided → CrewAI hierarchical。Chat-emergent → AutoGen。Tool-call-decided → Agno。
3. **state budgetを確認する。** resume-from-checkpoint、time-travel、run途中のhuman interruptsが必要か。yesならdefaultはLangGraph。Agno sessionsはconversation-scoped stateをcoverします。
4. **cost budgetを確認する。** LLM-selected routingはturnごとにextra tokensを消費します。agentが1日数千回runするならexplicit routingを選びます。
5. **framework overheadを見積もる。** frameworkはすべて追加dependencyです。taskが2つのLLM callsと1つのtoolだけなら、plain Pythonを30行書きます。frameworkなしより安いframeworkはありません。

graph、org chart、chat、agent boxを描ける前にframeworkへ手を伸ばしてはいけません。実際に必要なもののためにstate modelと戦うことを強いるframeworkは選ばないでください。

## Decision Matrix

| Problem shape | Preferred framework | 理由 |
|---------------|---------------------|------|
| typed state、human approvals、long-runningを持つworkflow DAG | LangGraph | first-class state、checkpointer、interrupts、time-travel。 |
| distinct rolesを持つresearch/writing pipeline | CrewAI (sequential) またはLangGraph subgraphs | role-per-taskはCrewAIで安く表現できる。branchingが複雑になったらLangGraphへscale upする。 |
| proposer-criticまたはteacher-student dialogue | AutoGen | two-agent chatがnative shape。 |
| tools、sessions、memory付きsingle agent | Agno | setupが最も薄く、built-in storageとmemoryがある。 |
| reducers付きの数千parallel fanouts | LangGraph + `Send` | first-class parallel-dispatch APIを持つ唯一の選択肢。 |
| quick prototype、framework commitmentなし | Plain Python + provider SDK | frameworkなしが最速のframework。 |

## 演習

1. **Easy。** 同じtask — "Anthropicのheadquartersをresearchし、200-word briefを書き、sourcesをciteする" — をLangGraph (4 nodes: plan、search、write、cite) とCrewAI (3 roles: researcher、writer、editor) で実装します。runあたりtoken costとlines of codeを報告します。
2. **Medium。** 同じtaskをAutoGen (researcher ↔ writer chat、editorが `GroupChat` 経由で参加) とAgno (single agent with `search_tools` and `write_tools`、plus session store) で作ります。4実装を (a) runあたりcost、(b) crash後resume能力、(c) write step前にhuman approvalを挿入できる能力でrankします。
3. **Hard。** short problem description (JSON: `{has_typed_state, has_roles, has_dialogue, has_parallel_fanout, needs_resume}`) を受け取り、1文のjustification付きrecommendationを返すdecision-tree script `pick_framework.py` を作ります。自分で設計した6 casesで検証します。

## Key Terms

| Term | 俗に言うこと | 実際の意味 |
|------|---------------|------------|
| Orchestration | "agentsのcoordinate方法" | 次にどのnode/role/agentがrunするかを決めるlayer。 |
| Durable state | "restart後にresume" | process deathを生き残るstate。checkpointまたはsession storeにattachedされる。 |
| LLM-selected routing | "modelに決めさせる" | planner LLMが各turnでnext stepを選ぶ。柔軟だがdecisionごとにtokensを払う。 |
| Explicit routing | "developerが決める" | Python functionまたはstatic edgeがnext stepを選ぶ。安く、auditしやすい。 |
| Crew | "CrewAI team" | roles + tasks + process (sequentialまたはhierarchical) をsingle runnableに束ねたもの。 |
| GroupChat | "AutoGenのmulti-agent chat" | speaker selector付きのN agents間managed conversation。 |
| Team (Agno) | "Multi-agent Agno" | agents集合のroute / coordinate / collaborate mode。 |
| StateGraph | "LangGraphのgraph" | typed-state、node、conditional-edge、checkpointer abstraction。 |

## 参考文献

- [LangGraph documentation](https://langchain-ai.github.io/langgraph/) — StateGraph、checkpointers、interrupts、time-travel。
- [CrewAI documentation](https://docs.crewai.com/) — Crews、Flows、Agents、Tasks、Processes。
- [AutoGen documentation](https://microsoft.github.io/autogen/) — ConversableAgent、GroupChat、teams、tools。
- [Agno documentation](https://docs.agno.com/) — Agent、Team、Workflow、storage、memory。
- [Anthropic — Building effective agents (Dec 2024)](https://www.anthropic.com/research/building-effective-agents) — framework-agnosticなpattern library (prompt chaining、routing、parallelization、orchestrator-workers、evaluator-optimizer)。
- [Yao et al., "ReAct: Synergizing Reasoning and Acting" (ICLR 2023)](https://arxiv.org/abs/2210.03629) — すべてのframeworkが装飾するloop。
- [Wu et al., "AutoGen: Enabling Next-Gen LLM Applications via Multi-Agent Conversation" (2023)](https://arxiv.org/abs/2308.08155) — AutoGenのdesign paper。
- [Park et al., "Generative Agents: Interactive Simulacra of Human Behavior" (UIST 2023)](https://arxiv.org/abs/2304.03442) — CrewAI-style persona stackが土台にするrole-play foundation。
- Phase 11 · 16 (LangGraph) — このlessonがbenchmark対象にするframework。
- Phase 11 · 19 (Reflexion) — LangGraphにはきれいにmapされるが、CrewAIにはぎこちないpattern。
- Phase 11 · 22 (Production observability) — 選んだframeworkをinstrumentする方法。
