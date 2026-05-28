# CrewAI: Role-Based Crews and Flows

> CrewAIは、2026年のrole-based multi-agent frameworkです。4つのprimitive: Agent、Task、Crew、Process。top-level shapeは2つ: Crews (autonomousなrole-based collaboration) とFlows (event-drivenでdeterministic)。docsは率直です。「production-readyなapplicationでは、必ずFlowから始める」。

**種別:** 学習 + 構築
**言語:** Python (stdlib)
**前提条件:** Phase 14 · 12 (Workflow Patterns), Phase 14 · 14 (Actor Model)
**所要時間:** 約75分

## Learning Objectives

- CrewAIの4つのprimitive (Agent、Task、Crew、Process) と、それぞれが何をownするかを挙げる。
- Sequential、Hierarchical、planned Consensus processを区別し、workloadごとに選ぶ。
- Crews (autonomous role-based) とFlows (event-driven deterministic) を区別し、docsのproduction recommendationを説明する。
- `@tool` decoratorと`BaseTool` subclassでtoolをwireし、structured outputsとfree textの違いをreasoningする。
- CrewAIの4種類のmemoryと、それぞれがpay offする場面を挙げる。
- briefを生成するstdlib three-agent crew (researcher、writer、editor) を実装する。
- CrewAIの3つのfailure modeを見抜く: prompt-bloat、manager-LLM tax、brittle handoffs。

## 問題

multi-agent frameworkを採用するteamは同じ壁に当たります。「autonomous collaboration」はdemoでは見栄えがします。ところがcustomerがbugをfileし、deterministic replayが必要になります。あるいはfinanceがLLM-routed crewのrunごとのcostを聞きます。あるいはon-callが午前3時にどのagentがstallしたか知る必要があります。

free-formなLLM-routed crewは、これらにきれいに答えられません。pure DAGはすべてに答えられますが、brainstorming agentが必要とするexploratoryな形を失います。

CrewAIの分割は、このtrade-offに正直です。collaborative、role-based、exploratoryな作業にはCrews。event-driven、code-owned、auditableなproductionにはFlows。同じframeworkに2つのshapeがあり、surfaceごとに選びます。

## The Concept

### Four primitives

CrewAIのsurfaceは小さいです。これを覚えれば、残りはconfigです。

- **Agent.** `role + goal + backstory + tools + (optional) llm`。backstoryはload-bearingです。tone、judgment、agentがいつ止まるかを形作ります。toolsはagentが呼べる関数です (後述)。
- **Task.** `description + expected_output + agent + (optional) context + (optional) output_pydantic`。再利用可能なwork unit。`expected_output`がcontractです。`context`はoutputを渡すupstream taskを列挙します。`output_pydantic`はstructured shapeを強制します。
- **Crew.** containerです。`agents` list、`tasks` list、`process`、optionalな`memory` + `verbose` + `manager_llm` settingsをownします。
- **Process.** execution strategyです。Sequential、Hierarchical、Consensus (planned)。runのshapeを選びます。

Agent同士は直接見えません。TaskがAgentを参照します。CrewがTaskをsequenceします。Processが次のtaskを誰が選ぶかを決めます。mental modelはこれで全部です。

> **Validated against** CrewAI 0.86 (2026-05)。新しいversionではprocess typeがrenameまたはmergeされる可能性があります。specific shapeに依存する前に[CrewAI Processes docs](https://docs.crewai.com/concepts/processes)を確認してください。

### Sequential vs Hierarchical vs Consensus

- **Sequential.** Taskをdeclaration orderで実行します。Task NのoutputはTask N+1の`context`として使えます。最も低costで、最もpredictableです。orderがfixedならこれを使います。
- **Hierarchical.** manager Agent (別のLLM call) がspecialist間をrouteします。CrewAIは`manager_llm` configまたはdefaultからmanagerをspawnします。managerは各roundで次のtaskを選び、拒否やre-routeもできます。specialistが4つ以上あり、orderが本当にprior outputに依存する場合に使います。
- **Consensus.** plannedであり、public APIでは現在未実装です。docsは将来のvoting-based process用にこの名前を予約しています。現時点で依存しないでください。

Hierarchicalは、各specialist callに加えてroundごとにmanager LLM callを追加します。5 step runではtoken costが3倍になり得ます。routingが必要な場合だけ支払います。

### Crews vs Flows

これは2026年のdocsが前面に出すframingです。

- **Crew.** LLM-driven autonomy。frameworkがruntimeでshapeを選びます。向いているもの: research、brainstorming、first drafts、path自体がanswerの一部であるもの。replayしにくい。testしにくい。prototypeは安い。
- **Flow.** 自分がownするevent-driven graph。`@start`がentryを示します。`@listen(topic)`は別stepがそのtopicをemitしたときにfireするstepを示します。各stepはplain Pythonです (内部でCrewを呼ぶこともできます)。向いているもの: production。observable。testable。deterministic。

docsの2026年production recommendation: Flowから始める。autonomyがcostに見合う場合だけ、Flow step内の`Crew.kickoff()` callとしてCrewを折り込む。Flowがaudit trailを与え、Crewがexplorationを与えます。composeするのであって、片方だけを選ぶ必要はありません。

### Tool integration

Agentへtoolを渡す方法は3つあります。fitする中で最も単純なものを選びます。

1. **`@tool` decorator.** pure functionがtoolになります。signatureがschemaで、docstringがLLMに見えるdescriptionです。one-off helperに最適です。

   ```python
   from crewai.tools import tool

   @tool("Search the web")
   def search(query: str) -> str:
       """Return top results for the query."""
       return run_search(query)
   ```

2. **`BaseTool` subclass.** explicit args schema、async support、retryを持つclass-based toolです。toolにstate (client、cache) がある場合や、structured argsが必要な場合に使います。

   ```python
   from crewai.tools import BaseTool
   from pydantic import BaseModel

   class SearchArgs(BaseModel):
       query: str
       limit: int = 10

   class SearchTool(BaseTool):
       name = "web_search"
       description = "Search the web and return top results."
       args_schema = SearchArgs

       def _run(self, query: str, limit: int = 10) -> str:
           return self.client.search(query, limit=limit)
   ```

3. **Built-in toolkits.** CrewAIはfirst-party adaptersをshipしています: `SerperDevTool`、`FileReadTool`、`DirectoryReadTool`、`CodeInterpreterTool`、`RagTool`、`WebsiteSearchTool`。1 importでwireできます。

structured outputsにはPydanticを使います。Taskに`output_pydantic=MyModel`を渡します。CrewAIはLLM responseをmodelでvalidateし、coerceまたはretryします。tightな`expected_output` stringと組み合わせます。free-text outputはdraftには十分ですが、downstream Flowがconsumeできるのはstructured outputです。

### Memory hooks

CrewAIは4種類のmemoryをout of the boxでshipしています。これらはcomposeでき、1つのCrewで4つすべてをenableできます。

> **Validated against** CrewAI 0.86 (2026-05)。recent releasesでは、これら4 storeをwrapするunified `Memory` system経由で全体がrouteされます。下のconceptual modelは有効ですが、新しいversionではpublic class surfaceが単一の`Memory` entry-pointへcollapseする可能性があります。current APIは[CrewAI memory docs](https://docs.crewai.com/concepts/memory)を確認してください。

- **Short-term.** single run内のconversation buffer。終了時に消える。
- **Long-term.** runをまたいでpersistする。vector DB (defaultはChroma、差し替え可能) に保存され、current taskとのsimilarityでretrievedされる。
- **Entity.** entityごとのfact。「Customer X is on the enterprise plan.」similarityではなくentity keyで引く。runをまたいで残る。
- **Contextual.** assembly-time retrieval。preloadではなく、Agentが必要とする瞬間にrelevant memoryをpullする。

Crewで`memory=True`またはtype別configによりenableします。backingには設定したembeddings providerを使います (defaultはOpenAI、localに差し替え可能)。MemoryはCrewAIが薄いframeworkに対して価値を出す場所の1つです。pure LangGraphでは、これらをすべて自分でwireする必要があります。

### When CrewAI fits

- named roleを持つ3〜6 agentとcollaborative workflow。drafting、reviewing、planning、brainstorming。
- next stepについてのLLM judgment自体に価値があるrouting (Hierarchical)。
- teamがgraph definitionを読むより`role + goal + backstory`を読むほうが楽な場合。

### When CrewAI does not fit

- strict orderingを持つdeterministic DAG。LangGraph (Lesson 13) を使う。graph shapeが正しいabstractionであり、CrewAIのrole framingは摩擦になる。
- sub-second latency budget。Hierarchicalはround tripを追加します。Sequentialでもbackstoryとprior outputを含むpromptをserializeします。
- single-agent loop。frameworkをskipする。agent loop (Lesson 1) とtool registryのほうが短い。

Lesson 17 (Agent Framework Tradeoffs) はこれをmatrixで整理します。短く言えば、CrewAIは「collaborative role-based」のcornerにあります。

### Dependency shape

LangChainから独立しています。Python 3.10〜3.13。`uv`を使います。star countは[crewAIInc/crewAI](https://github.com/crewAIInc/crewAI)を参照してください (2026-05時点のsnapshot)。AWS Bedrock integrationはdocumentedです。vendor benchmarkはQA workloadでLangGraph比の大幅なspeedupを報告していますが、methodology (dataset、hardware、evaluation metric) が公開されていないため、framework vendorの数値はdirectionalに扱ってください。

### Where this pattern goes wrong

- **backstoryによるprompt-bloat。** agentごとに2000-word backstoryを持つ5-agent crewは、最初のtool call前にcontext budgetを燃やします。backstoryは200 words未満にします。agent間でphraseを再利用し、house styleを5回繰り返さないでください。
- **Manager-LLM token tax。** Hierarchical processは各specialist call前にmanager LLM callを追加します。5-task crewなら5回ではなく6回のLLM callになり、manager callはfull task listとprior outputsを運びます。routingがoutputに依存しないならSequentialへ切り替えます。
- **Brittle handoffs。** Task Nの`expected_output`が「an outline」。Task N+1はそれを`context`として読み、3 sectionをparseしようとします。LLMは4 sectionを生成しました。downstream Agentがad-libします。Task Nに`output_pydantic`を付け、Task N+1がfree textではなくtyped objectを読むようにします。
- **Crew-as-prod。** Flow wrapperなしでfree-form Crewをproductionへshipする。output variabilityが高く、replay不能で、on-callはbad runとgood runをdiffできません。Flowでwrapしてください。

## 実装

`code/main.py`は両方のshapeのstdlib versionとthree-agent crewを実装しています。

Shape:

- CrewAI surfaceに合わせた`Agent`、`Task` dataclasses。
- `SequentialCrew.kickoff(inputs)`はdeclaration orderでtaskを実行し、outputを`context`としてthreadする。
- `HierarchicalCrew.kickoff(topic)`はmanager Agentが各roundでnext specialistを選び、"done"で停止する。
- `@start`と`@listen(topic)` decorator、小さなevent loop、traceを持つ`Flow`。
- CrewAIの`@tool` shapeをmirrorする`tool(name)` decorator。
- `short_term`、`long_term`、`entity` storeを持つ`Memory`。mock similarityはnumpyを使う。
- mock LLM responseはroleとinput prefixに基づくhardcoded string。networkなし。deterministic。

具体的なdemo: researcher、writer、editor crewが"agent engineering 2026"についてbriefを生成します。Researcherはmocked sourceをpullします。Writerがdraftします。Editorがtightenします。同じcrewをFlow経由でも動かし、deterministic shapeを示します。

実行:

```bash
python3 code/main.py
```

traceは次をcoverします: sequential crewがoutputを`context`にthreadする様子、manager picks (researcher、writer、editor、その後"done") を持つhierarchical crew、explicit topics (`researched`、`drafted`、`edited`) で同じ3 stepを実行するflow、`@tool`経由のtool call、2回のkickoffをまたいで残るlong-term memory。

Crew traceはfluidで、managerは原理上re-orderできます。Flow traceはfixedです。その選択がlessonです。

## Use It

- **CrewAI Flow** for production。Flowが`Crew.kickoff()`を呼ぶ1 stepだけでもよい。Flowがaudit boundaryを与える。
- **CrewAI Crew (Sequential)** for clear-ordering collaborative work、特にfirst draftsとreview loops。
- **CrewAI Crew (Hierarchical)** when routing depends on output and you have four or more specialists。
- **LangGraph** (Lesson 13) for explicit state machines、durable resume、strict ordering。
- **AutoGen v0.4** (Lesson 14) for actor-model concurrency and fault isolation。
- **OpenAI Agents SDK** (Lesson 16) for OpenAI-first products with handoffs and guardrails。
- **Claude Agent SDK** (Lesson 17) for Claude-first products with subagents and session store。

## Ship It

`outputs/skill-crew-or-flow.md`は、taskに対してCrewかFlowかを選び、minimal implementationをscaffoldします。Crew-without-backstory、Flow-without-explicit-topics、specialistが3未満のHierarchicalはhard rejectします。

## Pitfalls

- **Backstory as flavor。** backstoryはoutputを形作ります。agentごとに3 variantsをtestしてください。varianceは実在します。1つ選んでfreezeします。
- **`expected_output`のskip。** taskごとのcontractがないと、downstream taskはLLMが生成したものを何でも拾います。Crewは動きますが、auditは失敗します。
- **Memory always-on。** long-termは毎run書き込みます。vector DBは増えます。retrievalはnoisyになります。persistentなfactがあるtaskにwriteをscopeします。
- **Manager prompt drift。** Hierarchicalのmanager promptはimplicitです。routingがおかしい場合はverbose modeでdumpして読みます。
- **Crew内tool side effect。** Crewは想定より多くtoolをcallすることがあります。POST、DELETE、paymentはFlow stepに置き、Crew toolにはしません。

## Exercises

1. Sequential crewをFlowに変換する。variabilityが下がったtouchpointを数える。readabilityが下がった場所もnoteする。
2. crewにentity memoryを追加する。customerに関するfactがkickoffをまたいでpersistする。retrievalが正しいentityをpullすることを確認する。
3. writer outputが少なくとも3 paragraphになるまでeditorへrouteすることをmanagerが拒否するHierarchical processを実装する。retryをtraceする。
4. (mocked) web search用の`BaseTool` subclassをwireする。`@tool` decorator versionとtrace shapeを比較する。
5. editor taskに`output_pydantic=Brief`を追加する。`Brief`は`title`、`summary`、`sections`を持つ。writer taskが一度malformed JSONを出すようにし、CrewAIのretry behaviorをtraceで確認する。
6. CrewAI docs introを読む。toyを実際の`crewai` APIへportする。stdlib versionはどのguaranteeをskipしたか。
7. AgentOpsまたはLangfuse (Lesson 24) をreal runへwireする。stdlib versionではどのtraceが欠けていたか。

## Key Terms

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Agent | 「Persona」 | role + goal + backstory + tools |
| Task | 「Unit of work」 | description + expected output + assignee + optional structured output |
| Crew | 「Agent team」 | Agents + Tasks + Processのcontainer |
| Process | 「Execution strategy」 | Sequential / Hierarchical / Consensus (planned) |
| Flow | 「Deterministic workflow」 | event-driven、code-owned、testable |
| Backstory | 「Persona prompt」 | Agentのtoneとjudgmentを形作るもの |
| `@tool` | 「Function tool」 | 関数をAgentが呼べるtoolへ変換するdecorator |
| `BaseTool` | 「Class tool」 | args schema、retry、async supportを持つclass-based tool |
| Entity memory | 「Per-entity facts」 | customer / account / issueにscopeされたmemory |
| Long-term memory | 「Cross-run memory」 | kickoff間で残るvector-backed memory |
| Contextual memory | 「Just-in-time retrieval」 | Agentが必要とする瞬間にpullされるmemory |
| Manager LLM | 「Router agent」 | Hierarchical processでnext taskを選ぶ追加LLM |
| `expected_output` | 「Task contract」 | Agentとauditに返すshapeを伝えるstring |

## 参考文献

- [CrewAI docs introduction](https://docs.crewai.com/en/introduction): concepts and the recommended production path
- [CrewAI Flows guide](https://docs.crewai.com/en/concepts/flows): event-driven shape, `@start`, `@listen`
- [CrewAI tools reference](https://docs.crewai.com/en/concepts/tools): `@tool`, `BaseTool`, built-in toolkits
- [CrewAI memory](https://docs.crewai.com/en/concepts/memory): short-term, long-term, entity, contextual
- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents): multi-agentが効く場合と効かない場合
- [LangGraph overview](https://docs.langchain.com/oss/python/langgraph/overview): state-machine alternative
