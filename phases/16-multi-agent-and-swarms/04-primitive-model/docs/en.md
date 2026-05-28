# The Multi-Agent Primitive Model

> 2026 年に出荷されるすべての multi-agent framework、AutoGen、LangGraph、CrewAI、OpenAI Agents SDK、Microsoft Agent Framework は、4 次元 design space の 1 点です。primitives は 4 つだけです。agent、handoff、shared state、orchestrator。この lesson ではそれらをゼロから作り、toy system を 4 つすべての上で動かし、主要 frameworks を同じ axes に map します。これにより、新しい release を 1 段落で読めるようになります。

**種別:** 学習
**言語:** Python (stdlib)
**前提条件:** Phase 14 (Agent Engineering), Phase 16 · 01 (Why Multi-Agent)
**所要時間:** 約60分

## 問題

半年ごとに新しい multi-agent framework が出ます。2023 年に AutoGen。2024 年に CrewAI。2024 年に LangGraph と OpenAI Swarm。2025 年 4 月に Google ADK。2026 年 2 月に Microsoft Agent Framework RC。それぞれの press release は "the right abstraction" だと主張します。

1 つずつ学ぼうとすると疲弊します。APIs は違います。docs は "agent" の意味について食い違います。ある framework は shared memory を "blackboard" と呼び、別のものは "message pool"、3 つ目は "StateGraph" と呼びます。field がただ churn しているだけに見えてきます。

そうではありません。marketing の下では 4 つの primitives は安定しています。1 度学べば、どんな new framework も 1 段落で読めます。

## コンセプト

### 4 つの primitives

1. **Agent** — system prompt と tool list。stateless で、run のたびに system prompt と current message history から始まる。
2. **Handoff** — ある agent から別の agent への structured transfer of control。mechanically には、new agent を返す tool call、または condition に従う graph edge。
3. **Shared state** — 複数 agent が read (ときに write) できる data structure。message pool、blackboard、key-value store、vector memory。
4. **Orchestrator** — 次に誰が話すかを決めるもの。explicit graph (deterministic)、LLM speaker-selector (soft)、last speaker の handoff call (OpenAI Swarm)、queue 上の scheduler (swarm architecture) など。

design space はこれで全部です。各 framework は各 axis の defaults を選び、残りは surface syntax です。

### 2026 frameworks への mapping

| Framework | Agent | Handoff | Shared state | Orchestrator |
|-----------|-------|---------|--------------|--------------|
| OpenAI Swarm / Agents SDK | `Agent(instructions, tools)` | tool returns Agent | caller's problem | the LLM's next handoff call |
| AutoGen v0.4 / AG2 | `ConversableAgent` | speaker-selector on GroupChat | message pool | selector function (LLM or round-robin) |
| CrewAI | `Agent(role, goal, backstory)` | `Process.Sequential / Hierarchical` | Task outputs chained | manager LLM or static order |
| LangGraph | node function | graph edge + condition | `StateGraph` reducer | the graph, deterministic |
| Microsoft Agent Framework | agent + orchestration patterns | pattern-specific | thread / context | pattern-specific |
| Google ADK | agent + A2A card | A2A task | A2A artifacts | host decides |

surface differences は大きく見えます。下には同じ 4 knobs があります。

### なぜ重要か

primitives が見えると、framework comparison は短い checklist になります。

- orchestrator は routing を LLM に任せるか (Swarm)、code で固定するか (LangGraph)?
- shared state は full-history (GroupChat) か projected (StateGraph reducer) か?
- agents は互いの prompts を変更できるか (CrewAI manager)、handoff だけか (Swarm)?

この 3 questions で、どの framework が problem に合うかの 80% が決まります。"the best multi-agent framework" を探すのをやめ、自分が気にしている axis に対して設計できます。

### Stateless insight

shared state 以外の primitive はすべて stateless です。Agent は (prompt, tools) の function。Handoff は function call。Orchestrator は scheduler。**system の中で stateful なのは shared state だけです。** 面白い bugs はすべてそこにあります。memory poisoning (Lesson 15)、message ordering、versioning、write contention。

shared state を隠す frameworks (Swarm) は問題を caller に押し出します。centralize する frameworks (LangGraph checkpoint、AutoGen pool) は inspectable にしますが、coordination cost を shared-state implementation に移します。

### 各 primitive の anatomy

#### Agent

```
Agent = (system_prompt, tools, model, optional_name)
```

memory も state もありません。同じ system prompt と tools を持つ 2 agents は interchangeable です。per-agent state に見えるものは、実際には shared state か handoff protocol にあります。

#### Handoff

```
Handoff = (from_agent, to_agent, reason, payload)
```

3 implementations が主流です。

- **Function return** — tool が next agent を返す。OpenAI Swarm pattern。agents は tool schemas に routing を持つ。
- **Graph edge** — LangGraph。edges は declarative。LLM が value を出し、condition が next node を選ぶ。
- **Speaker selection** — AutoGen GroupChat。selector function (ときに LLM call) が pool を読んで次の speaker を選ぶ。

#### Shared state

```
SharedState = { messages: [], artifacts: {}, context: {} }
```

最低限は message list です。多くの場合、structured artifacts (CrewAI Task outputs)、typed context (LangGraph reducers)、external memory (MCP, vector DB) も入ります。

topology は 2 つです。**full pool** (すべての agent がすべての message を見る) と **projected** (agents が role-scoped view を見る)。full pool は simple ですが scale しにくい。projected pool は scale しますが upfront schema design が必要です。

#### Orchestrator

```
Orchestrator = ({state, last_speaker}) -> next_agent
```

4 flavors:

- **Static** — graph は build time に固定 (LangGraph deterministic、CrewAI Sequential)。
- **LLM-selected** — LLM が pool を読んで next speaker を選ぶ (AutoGen、CrewAI Hierarchical)。
- **Handoff-driven** — current agent が handoff tool を call して決める (Swarm)。
- **Queue-driven** — workers が shared queue から pull する。explicit next-speaker はない (swarm architectures、Matrix)。

### frameworks 間で変わるもの

primitives が固定されると、残る design decisions は次です。

- **Memory strategy** — ephemeral か durable checkpointing か (LangGraph checkpointer)。
- **Safety boundary** — handoff を誰が approve できるか (human-in-the-loop)。
- **Cost accounting** — per-agent token budgets。
- **Observability** — handoffs の tracing、state の replay 用 persistence。

これらはすべて primitives の上に実装できます。新しい primitive ではありません。

## 実装

`code/main.py` は 4 つの primitives を stdlib Python 約 150 lines で実装します。real LLM は使いません。各 agent は scripted policy で、focus は coordination structure にあります。

file が export するもの:

- `Agent` — name、system prompt、tools、policy function の dataclass。
- `Handoff` — new agent を返す function。
- `SharedState` — thread-safe message pool。
- `Orchestrator` — 3 variants: `StaticOrchestrator`、`HandoffOrchestrator`、`LLMSelectorOrchestrator` (simulated)。

demo は同じ 3-agent pipeline (research → write → review) を 3 orchestrator types で実行し、最後に message pool を print します。outputs の違いは *who picks next* だけで、agents と shared state は runs 間で同じです。

実行:

```
python3 code/main.py
```

期待 output: pattern ごとに 1 回、計 3 orchestrator runs。各 run が final message pool を print します。handoff-driven run は researcher が早期に done と判断すると到達する agents が少なくなります。これは LLM-routing tradeoff のミニチュアです。

## Use It

`outputs/skill-primitive-mapper.md` は任意の multi-agent codebase や framework doc を読み、4-primitive mapping を返す skill です。new framework release に使うと、docs を深く読む前に 1 段落で理解できます。

## Ship It

new framework 採用前に、その primitive mapping を書いてください。書けないなら、docs が incomplete か、framework が 5 つ目の primitive を発明しているかです (rare。未見の shared-state flavor でないか確認してください)。

mapping を architecture doc に pin します。new team member が入ったら API docs より先に mapping を送ります。framework versions が変わったら changelog ではなく mapping を diff します。

## Exercises

1. `code/main.py` を agent policies を変えて 3 回実行する。orchestrator choice がどの agents を run させるかを観察する。
2. 4 つ目の orchestrator type を実装する。agents が shared state から work を poll する queue-driven orchestrator。どんな deadlock が起きるか、どう検出するか?
3. LangGraph quickstart (https://docs.langchain.com/oss/python/langgraph/workflows-agents) を 4 primitives として書き直す。LangGraph の abstractions のどれが 1:1 に map され、どれが convenience wrappers か?
4. OpenAI Swarm cookbook (https://developers.openai.com/cookbook/examples/orchestrating_agents) を読む。Swarm が最も ergonomic にしている primitive と、caller に押し出している primitive を特定する。
5. この table から shared state を完全に隠す framework を 1 つ見つける。agents が history を reread せずに handoffs をまたいで coordinate する必要があるとき、何が壊れるか説明する。

## Key Terms

| Term | よくある言い方 | 実際の意味 |
|------|----------------|------------|
| Agent | "An LLM with tools" | `(system_prompt, tools, model)` triple。stateless。 |
| Handoff | "Transfer of control" | next agent と optional payload を named する structured call。実装は function return、graph edge、speaker selection。 |
| Shared state | "Memory" / "context" | multi-agent system の唯一の stateful part。message pool または blackboard。 |
| Orchestrator | "Coordinator" | 次に誰が run するかを決めるもの。static graph、LLM selector、handoff-driven、queue-driven。 |
| Primitive | "Abstraction" | すべての framework が parameterize する 4 axes の 1 つ。framework feature ではない。 |
| Message pool | "Shared chat history" | full-history shared state。reasoning しやすいが scale しにくい。 |
| Projected state | "Scoped view" | shared state の role-specific view。scale するが schema design が必要。 |
| Speaker selection | "Who talks next" | function (しばしば LLM) が group から next agent を選ぶ orchestrator pattern。 |

## 参考文献

- [OpenAI cookbook: Orchestrating Agents — Routines and Handoffs](https://developers.openai.com/cookbook/examples/orchestrating_agents) — handoff-driven orchestration の最も明確な説明
- [AutoGen stable docs](https://microsoft.github.io/autogen/stable/) — GroupChat + speaker selection は LLM-selected orchestration の reference
- [LangGraph workflows and agents](https://docs.langchain.com/oss/python/langgraph/workflows-agents) — graph-edge orchestration と reducer-based shared state
- [CrewAI introduction](https://docs.crewai.com/en/introduction) — role-goal-backstory agents、Sequential / Hierarchical processes
- [AG2 (community AutoGen continuation)](https://github.com/ag2ai/ag2) — Microsoft が v0.4 を maintenance に移した後の live AutoGen v0.2 line
