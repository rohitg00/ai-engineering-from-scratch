# Anthropic's Workflow Patterns: Simple Over Complex

> Schluntz and Zhang (Anthropic, Dec 2024) は workflows (predefined paths) と agents (dynamic tool-use) を区別しました。5 つの workflow patterns が大半の case を cover します。Direct API calls から始めます。Steps が予測できないときだけ agents を追加します。

**種別:** 学習 + 構築
**言語:** Python (stdlib)
**前提条件:** Phase 14 · 01 (Agent Loop)
**所要時間:** 約60分

## Learning Objectives

- Anthropic の 5 つの workflow patterns を挙げる: prompt chaining、routing、parallelization、orchestrator-workers、evaluator-optimizer。
- Agent-vs-workflow の違いと、それぞれの engineering cost を説明する。
- Workflow を agent より選ぶべき時期 (およびその逆) を特定する。
- Scripted LLM に対して 5 つすべての patterns を stdlib で実装する。

## 問題

Team は single function call で済む問題に multi-agent framework を持ち込みがちです。Cost は本物です。Framework は layer を追加し、prompt を見えにくくし、control flow を隠し、premature complexity を招きます。Schluntz and Zhang の 2024 年 12 月の post は、industry で最も引用される pushback です。Simple に始め、complexity が cost に見合うときだけ追加します。

## The Concept

### Workflows vs agents

- **Workflow.** LLMs と tools を predefined code paths で orchestrate する。Engineers が graph を所有する。
- **Agent.** LLMs が自分の tools と steps を動的に direct する。Model が graph を所有する。

どちらにも役割があります。Workflows は cheaper、faster、debug しやすい。Agents は open-ended problems を unlock しますが、failure modes を推論しにくくします。

### The augmented LLM

5 patterns すべての foundation: search (retrieval)、tools (actions)、memory (persistence) の 3 capabilities を wire した 1 つの LLM。任意の API call がこれらを使えます。

### The five patterns

1. **Prompt chaining.** Call 1 の output が call 2 の input になる。Task が clean linear decomposition を持つときに使う。Step 間に optional programmatic gates を置ける。

2. **Routing.** Classifier LLM が downstream LLM または tool のどれを invoke するかを選ぶ。Categorically different inputs が異なる handling を必要とするときに使う (tier-1 support vs refund vs bug vs sales)。

3. **Parallelization.** N 個の LLM calls を concurrent に走らせ、results を aggregate する。2 つの shape がある: sectioning (different chunks) と voting (same prompt, N runs, majority/synthesis)。

4. **Orchestrator-workers.** Orchestrator LLM がどの workers (これも LLMs) を実行するかを動的に決め、output を synthesize する。Agent loops に似ているが、orchestrator は無期限には loop しない。

5. **Evaluator-optimizer.** 1 つの LLM が answer を propose し、別の LLM が evaluate する。Evaluator が pass するまで iterate する。これは Self-Refine (Lesson 05) の一般化です。

### Where workflows beat agents

- **Predictable tasks.** Steps を enumerate できるなら、そうすべきです。
- **Cost-bound tasks.** Workflows は step counts が bounded です。Agents は spiral する可能性があります。
- **Compliance-bound tasks.** Auditors は trajectory から推測するより graph を読みたい。

### Where agents beat workflows

- **Open-ended research.** 次の step が前の step の返り値に依存する場合。
- **Variable-length tasks.** Step count が未知な、minutes to hours の作業。
- **Novel domains.** まだ正しい workflow が分からない場合。まず exploration、後で codify。

### The context-engineering companion

"Effective context engineering for AI agents" (Anthropic 2025) は隣接 discipline を formalize します。200k window は container ではなく budget です。何を含めるか、いつ compact するか、いつ context を伸ばすか。この curriculum では context compression に関する Phase 14 の lesson (renumber 前の Phase 14 lesson 06) で詳しく扱います。

## 実装

`code/main.py` は `ScriptedLLM` に対して 5 つの workflow patterns すべてを実装します。

- `prompt_chain(input, steps)` — sequential。
- `route(input, classifier, handlers)` — classification + dispatch。
- `parallel_vote(prompt, n, aggregator)` — N runs, aggregate。
- `orchestrator_workers(task, workers)` — orchestrator が workers を選ぶ。
- `evaluator_optimizer(task, proposer, evaluator, max_iter)` — pass するまで loop。

実行:

```
python3 code/main.py
```

各 pattern が trace を出力します。Pattern ごとの code はおよそ 10-15 lines です。Framework の cost は thousands of lines で測られます。

## Use It

- ほとんどの task では direct API calls。
- Pattern が本当に durable state (LangGraph)、actor-model concurrency (AutoGen v0.4)、role templating (CrewAI) を必要とする場合だけ framework。
- Claude Code harness 形を自作せず使いたいときは Claude Agent SDK を使う。

## Ship It

`outputs/skill-workflow-picker.md` は、task description に対して正しい pattern を選びます。Decision rationale と、workflow が足りない場合に agent へ refactor する path も含みます。

## Exercises

1. Confidence threshold 付き routing を実装する。Threshold 未満なら human に escalate する。Tier-1 support use case では threshold はどこに置くか。
2. `parallel_vote` に timeout を追加する。1 call が hang したらどうなるか。Missing votes 付きでどう aggregate するか。
3. `evaluator_optimizer` を bandit に変える。Late good result が late bad result に上書きされないよう、iterations をまたいで top-2 outputs を保持する。
4. Prompt chaining と routing を組み合わせる。Router が 3 chains の 1 つを選ぶ。Single big-prompt alternative と token cost を比較する。
5. 自分の production features の 1 つを選ぶ。Workflow graph を描く。Steps を数える。Agent の方が本当に良いか。

## Key Terms

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Workflow | 「Predefined flow」 | Engineer-owned graph of LLM and tool calls |
| Agent | 「Autonomous AI」 | Model-owned graph。Dynamic tool direction |
| Augmented LLM | 「LLM with tools」 | LLM + search + tools + memory。Atomic unit |
| Prompt chaining | 「Sequential calls」 | Call N の output が call N+1 の input になる |
| Routing | 「Classifier dispatch」 | Input をどの chain/model が扱うか選ぶ |
| Parallelization | 「Fan out」 | N concurrent calls。Sectioning または voting で aggregate |
| Orchestrator-workers | 「Dispatcher agent」 | Orchestrator LLM が specialist LLMs を動的に選ぶ |
| Evaluator-optimizer | 「Proposer + judge」 | Evaluator が pass するまで iterate。Self-Refine の一般化 |

## 参考文献

- [Anthropic, Building Effective Agents (Dec 2024)](https://www.anthropic.com/research/building-effective-agents) — 5 つの workflow patterns
- [Anthropic, Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) — companion discipline
- [LangGraph overview](https://docs.langchain.com/oss/python/langgraph/overview) — stateful graphs が cost に見合うとき
- [OpenAI Agents SDK](https://openai.github.io/openai-agents-python/) — productized orchestrator-workers pattern
