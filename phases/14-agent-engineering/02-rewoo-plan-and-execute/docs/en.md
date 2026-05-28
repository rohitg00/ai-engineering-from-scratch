# ReWOOとPlan-and-Execute: 分離されたplanning

> ReActはthoughtとactionを1つのstreamで交互に進める。ReWOOはそれを分離する。最初に大きなplanを作り、その後にexecuteする。tokenは5分の1、HotpotQAでaccuracyは+4%、plannerを7B modelへdistillできる。Plan-and-Executeはこれを一般化し、Plan-and-Actはweb navigationへscaleさせた。

**タイプ:** 構築
**言語:** Python（stdlib）
**前提条件:** フェーズ 14 · 01（Agent Loop）
**時間:** 約60分

## 学習目標

- ReWOOのPlanner / Worker / Solver分割が、ReActのinterleaved loopよりもtokenを節約しrobustnessを高める理由を説明する。
- plan DAG、dependency順のexecutor、worker outputを合成するsolverを、すべてstdlibで実装する。
- 2026年の「5つのworkflow patterns」（Anthropic）の枠組みを使い、taskをplan-then-executeで実行すべきか、interleaved ReActで実行すべきか判断する。
- long-horizon web/mobile taskでPlan-and-Actのsynthetic plan dataが必要になる場面を認識する。

## 課題

ReActのinterleaved thought-action-observation loopは単純で柔軟だが、各tool callがそれまでの全contextを運ばなければならない。以前のすべてのthoughtを含めてである。token usageはdepthに対して二次的に増える。さらに悪いことに、toolがloop途中で失敗すると、modelはerror observationからplan全体を再導出しなければならない。

ReWOO（Xuら、arXiv:2305.18323、2023年5月）はこれに気づき、別の賭けをした。最初に全体をplanし、evidenceをparallelに取得し、最後にanswerを合成する。plan用のLLM callが1回、evidence用のN tool calls（parallel可能）、solve用のLLM callが1回。柔軟性は下がる（planは静的）が、token efficiencyとfailure modeの明瞭さは大きく向上する。

## 考え方

### 3つの役割

```
Planner:  user_question -> [plan_dag]
Workers:  [plan_dag]     -> [evidence]        (tool calls, possibly parallel)
Solver:   user_question, plan_dag, evidence -> final_answer
```

PlannerはDAGを生成する。各nodeはtool、arguments、依存する以前のnode（`#E1`、`#E2`のようなreference）を持つ。Workersはtopological orderでnodeを実行する。Solverはすべてをつなぎ合わせる。

### なぜtokenが5分の1になるのか

ReActでは、prompt lengthはstep countに対して線形に増える。step 10では、promptにthought 1、action 1、observation 1、thought 2、action 2、observation 2……がすべて含まれる。各中間stepはoriginal promptも重複して含む。

ReWOOは、1つのplanner prompt（大きい）、N個の小さなworker prompt（それぞれtool callだけでchainなし）、1つのsolver promptを支払う。HotpotQAでは、論文は約5分の1のtokenで、絶対値+4のaccuracyを測定している。

### なぜよりrobustなのか

ReActでworker 3が失敗すると、loopはerrorの途中からreasoningし直さなければならない。ReWOOでは、worker 3がerror stringを返し、solverはそれをoriginal planと同じcontextで見るため、gracefulにdegradeできる。failure localizationはstep単位ではなくnode単位である。

### Planner distillation

論文の2つ目の結果はこうだ。plannerはobservationを見ないため、175B teacherのplanner outputで7B modelをfine-tuneできる。small modelがplanningを担い、inferenceではbig modelを必要としない。これは今では標準的であり、2026年のproduction agentの多くはsmall planner + big executor、またはその逆を使う。

### Plan-and-Execute（LangChain、2023）

LangChain teamの2023年8月の記事は、ReWOOをpattern名として一般化した。Plan-and-Executeである。up-front plannerがstep listを出し、executorが各stepを実行し、optional replannerが結果を観測した後に修正できる。これはReWOOよりReActに近い（replannerがobservationをplanningへ戻す）が、token savingは保つ。

### Plan-and-Act（Erdoganら、arXiv:2503.09572、ICML 2025）

Plan-and-Actは、このpatternをlong-horizon web/mobile agentsへscaleさせる。主な貢献はsynthetic plan dataである。labeled trajectory generatorが、planを明示したtraining dataを生成する。single ReAct trajectoryではcoherenceを失うWebArenaのような30〜50 steps超のtaskでも動き続けるplanner modelをfine-tuneするために使われる。

### どれを選ぶべきか

| Pattern | 使う場面 |
|---------|----------|
| ReAct | short task、unknown environment、reactiveなexception handlingが必要 |
| ReWOO | 既知のtoolsを持つstructured task、token-sensitive、parallelizable evidence |
| Plan-and-Execute | ReWOOに似るが、partial execution後のreplanningがある |
| Plan-and-Act | long-horizon（>30 steps）、web/mobile/computer-use |
| Tree of Thoughts | searchに支払う価値がある（レッスン04） |

Anthropicの2024年12月の指針は、最も単純なものから始めることだ。taskが1つのtool callとsummaryだけならReWOOを作らない。taskが40-stepのresearch assignmentならReActだけで済ませない。

## 構築

`code/main.py`はtoy ReWOOを実装する。

- `Planner` - promptからplan DAGを出すscripted policy。
- `Worker` - registryを通じて各nodeのtool callをdispatchする。
- `Solver` - evidenceを読みfinal answerを生成するscripted composition。
- Dependency resolution - `#E1`のようなreferenceを以前のworker outputに置換する。

demoは「フランスの首都の人口を、百万人単位に丸めると？」に、2-step planで答える。(1) 首都を調べる、(2) 人口を調べる、その後solveする。

実行する。

```
python3 code/main.py
```

traceはまずfull planを示し、その後worker results、最後にsolver compositionを示す。token count（rough character countをprintする）をReAct-style interleaved runと比較する。この種のstructured taskではReWOOが勝つ。

## 使い方

LangGraphはPlan-and-Executeをrecipeとして提供している（ReActには`create_react_agent`、plan-executeにはcustom graph）。CrewAIのFlowsはこのpatternを直接encodeする。tasksを事前に定義し、Flow DAGがそれを実行する。Plan-and-Actのsynthetic data approachはまだほぼresearchだが、runtime pattern（明示的なplan DAG）はLangGraphとCrewAI Flowsを通じてproductionに出ている。

## 出荷

`outputs/skill-rewoo-planner.md`は、tool catalogが与えられたときにuser requestからReWOO plan DAGを生成する。executorへ渡す前にplanをvalidateする（acyclic、すべてのreferenceが解決済み、すべてのtoolが存在する）。

## 演習

1. independentなplan nodeのworker executionをparallelizeする。2つのparallel groupを持つ6-node DAGで何が得られるか。
2. workerがerrorを返した場合に発火するreplanner nodeを追加する。ReWOOをPlan-and-Executeにする最小変更は何か。
3. `Planner`をsmall model（7B class）に置き換え、`Solver`はfrontier modelのままにする。end-to-end qualityを比較する。この分割はどこで失敗するか。
4. ReWOO論文のplanner distillationに関するSection 4を読む。175B -> 7Bの結果を概念的に再現するには、どんなtraining dataが必要で、plan qualityをどう採点するか。
5. toyをPlan-and-Actのtrajectory shapeへ移植する。planはDAGではなくsequenceである。どんなtradeoffが変わるか。

## 重要用語

| 用語 | よく言われること | 実際の意味 |
|------|----------------|------------|
| ReWOO | 「Reasoning without observations」 | 最初にplanし、evidenceをparallelに取得し、最後にsolveする。planning prompt内にobservationを入れない |
| Plan-and-Execute | 「LangChainのplan-execute pattern」 | execution後にoptional replanner nodeを持つReWOO |
| Plan-and-Act | 「scaleしたplan-execute」 | long-horizon task向けのsynthetic plan training dataを使う明示的planner/executor分割 |
| Evidence reference | 「#E1, #E2, ...」 | dispatch時にprior worker outputへ置換されるplan-node placeholder |
| Planner distillation | 「Small planner, big executor」 | large teacherのplanner traceでsmall modelをfine-tuneする |
| Token efficiency | 「Fewer round trips」 | 論文ではHotpotQAでReAct比5分の1のtoken |
| DAG executor | 「Topological dispatcher」 | dependency orderでplan nodeを実行し、各levelではparallelに実行する |

## 参考資料

- [Xu et al., ReWOO: Decoupling Reasoning from Observations (arXiv:2305.18323)](https://arxiv.org/abs/2305.18323) - 標準論文
- [Erdogan et al., Plan-and-Act (arXiv:2503.09572)](https://arxiv.org/abs/2503.09572) - synthetic plansを使うscaleしたplanner-executor
- [LangGraph Plan-and-Execute tutorial](https://docs.langchain.com/oss/python/langgraph/overview) - framework recipe
- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) - 動く最も単純なpatternを選ぶ
