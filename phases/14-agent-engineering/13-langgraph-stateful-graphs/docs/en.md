# LangGraph: Stateful Graphs and Durable Execution

> LangGraphは、2026年時点の低レベルなstateful orchestrationの基準です。Agentはstate machine、nodeは関数、edgeは遷移、stateはimmutableで各step後にcheckpointされます。どの失敗からでも、止まった場所から正確に再開できます。

**種別:** 学習 + 構築
**言語:** Python (stdlib)
**前提条件:** Phase 14 · 01 (Agent Loop), Phase 14 · 12 (Workflow Patterns)
**所要時間:** 約75分

## Learning Objectives

- LangGraphの中核モデルを説明する: immutable stateを持つstate machine、関数node、conditional edge、step後checkpoint。
- docsが強調する4つのcapabilityを挙げる: durable execution、streaming、human-in-the-loop、comprehensive memory。
- LangGraphが支援する3つのorchestration topologyを説明する: supervisor、peer-to-peer (swarm)、hierarchical (nested subgraphs)。
- immutable state、conditional edge、checkpoint/resume cycleを備えたstdlib state graphを実装する。

## 問題

Agentとworkflowには共通の問題があります。40 stepのrunが38 step目で失敗したら、最初からやり直すのではなく38 step目から再開したいはずです。stateを二級扱いするモデルでは、毎回fresh runを前提にするlibraryの外側にoperatorがretry処理を貼り付けることになります。

LangGraphの設計上の答えは、stateをfirst-classなtyped objectにし、mutationを明示し、各node後にcheckpointを永続化することです。再開は`load_state(session_id)`呼び出しになります。

## The Concept

### The graph

graphは次で定義されます。

- **State type.** すべてのnodeが読み、変更するtyped dict (またはPydantic model)。
- **Nodes.** pure function `(state) -> state_update`。返り値のupdateはstateへmergeされる。
- **Edges.** node間のconditionalまたはdirect transition。
- **Entry and exit.** `START`と`END`のsentinel nodeが境界を示す。

例: `classify`、`refund`、`bug`、`sales`、`done` nodeを持つagent。これはrouting workflowをgraphとして表したものです。

### Durable execution

各nodeが返った後、runtimeはstateをserializeし、checkpointer (SQLite、Postgres、Redis、custom)へ書き込みます。step Nで失敗した場合、runtimeは`resume(session_id)`でstep N+1から正確なstateを使って続行できます。

LangGraph docsは、この性質が重要になるproduction userとしてKlarna、Uber、J.P. Morganを明示しています。主張の中心はgraph shapeそのものではありません。graph shapeにcheckpointingを組み合わせることでrecoveryが安くなる、という点です。

### Streaming

各nodeはpartial outputをyieldできます。graphはnodeごとの差分eventをcallerへstreamするため、UIはgraphの実行中に更新できます。

### Human-in-the-loop

node間でstateをinspectし、変更します。実装は、critical nodeの前でpauseし、stateをhumanに提示し、修正を受け入れてresumeする形です。stateはすでにserializeされているため、checkpointerがこれを簡単にします。

### Memory

short-term (1 run内のconversation historyをstateに持つ) とlong-term (runをまたぐ永続memory。checkpointerと別のlong-term storeで保持) があります。LangGraphはtool経由で外部memory system (Mem0、customなど) と統合します。

### Three topologies

1. **Supervisor.** central router LLMがspecialist subagentsへdispatchする。`langgraph-supervisor`の`create_supervisor()` (ただし2026年のLangChain teamは、context controlを高めるためdirect tool callで実装することを推奨している)。
2. **Swarm / peer-to-peer.** agentがshared tool surface経由で直接handoffする。central routerはない。
3. **Hierarchical.** supervisorがsub-supervisorを管理する。nested subgraphsとして実装する。

### Where this pattern goes wrong

- **Checkpointが小さすぎる。** conversation turnだけをcheckpointすると、tool stateとmemory writeはrecover不能になります。full stateをserializeする必要があります。
- **非決定的なnode。** resumeは、同じnode inputが同じstate updateを生む前提です。random seed、wall-clock、external APIはcapturedにする必要があります。
- **conditional edgeの使いすぎ。** すべてのedgeがconditionalなgraphは、reasoningできないstate machineになります。基本はlinear chainにし、ときどきbranchする程度にします。

## 実装

`code/main.py`はstdlib stateful graphを実装しています。

- `State` — `messages`、`step`、`route`、`output`、`human_approval`を持つtyped dict。
- `Node` — stateを受け取りupdate dictを返すcallable。
- `StateGraph` — nodes + edges + conditional edges + run + resume。
- `SQLiteCheckpointer` (in-memory fake) — 各node後にstateをserializeする。`load(session_id)`でrestoreする。
- demo graph: classify -> branch(refund / bug / sales) -> human gate -> send。

実行:

```
python3 code/main.py
```

traceでは、最初のrunがhuman gateで失敗し、永続化され、その後resumeしてfinal outputを生成する様子が見えます。

## Use It

- **LangGraph** — referenceでありproduction-ready。`create_react_agent`、`create_supervisor`を使うか、自分でgraphを作る。
- **AutoGen v0.4** (Lesson 14) — high-concurrency scenario向けのactor model alternative。
- **Claude Agent SDK** (Lesson 17) — built-in session storeを持つmanaged harness。
- **Custom** — state shapeやcheckpointer backendを厳密に制御したい場合。

## Ship It

`outputs/skill-state-graph.md`は、任意のtarget runtimeに対して、checkpointingとresumeを組み込んだLangGraph型のstate graphを生成します。

## Exercises

1. classification confidenceがthreshold未満のとき、`classify`から`end`へ進むconditional edgeを追加する。humanが`route`を手動設定した後でrunをresumeする。
2. SQLite風のfakeを実際のSQLite checkpointerに差し替える。stepごとのserialization overheadを測る。
3. parallel edgeを実装する。2つのnodeをconcurrentlyに実行し、custom reducerでmergeする。immutable stateはここで何をもたらすか。
4. `langgraph-supervisor` referenceを読む。toyを`create_supervisor`へportする。trace shapeを比較する。
5. streamingを追加する。各nodeが実行中にpartial stateをyieldする。deltaが届いたらprintする。

## Key Terms

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| State graph | 「Agent as state machine」 | typed state + nodes + edges + reducers |
| Checkpointer | 「Persistence backend」 | 各node後にstateをserializeし、resumeを可能にする |
| Reducer | 「State merger」 | current stateとnode updateを結合する関数 |
| Conditional edge | 「Branch」 | stateの関数で選ばれるedge |
| Subgraph | 「Nested graph」 | 別のgraph内のnodeとして使われるgraph |
| Durable execution | 「Resume from failure」 | 最後に成功したnodeから正確なstateで再開する |
| Supervisor | 「Router LLM」 | specialist subagents向けのcentral dispatcher |
| Swarm | 「P2P agents」 | shared tools経由でagentがhandoffする。central routerはない |

## 参考文献

- [LangGraph overview](https://docs.langchain.com/oss/python/langgraph/overview) — reference docs
- [langgraph-supervisor reference](https://reference.langchain.com/python/langgraph/supervisor/) — supervisor pattern API
- [AutoGen v0.4, Microsoft Research](https://www.microsoft.com/en-us/research/articles/autogen-v0-4-reimagining-the-foundation-of-agentic-ai-for-scale-extensibility-and-robustness/) — actor-model alternative
- [Claude Agent SDK overview](https://platform.claude.com/docs/en/agent-sdk/overview) — session store and subagents
