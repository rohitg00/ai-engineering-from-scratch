# OpenAI Agents SDK: Handoffs, Guardrails, Tracing

> OpenAI Agents SDKは、Responses API上に構築されたlightweight multi-agent frameworkです。5つのprimitive: Agent、Handoff、Guardrail、Session、Tracing。Handoffは`transfer_to_<agent>`という名前のtoolです。Guardrailはinputまたはoutputでtripします。Tracingはdefaultでonです。

**種別:** 学習 + 構築
**言語:** Python (stdlib)
**前提条件:** Phase 14 · 01 (Agent Loop), Phase 14 · 06 (Tool Use)
**所要時間:** 約75分

## Learning Objectives

- OpenAI Agents SDKの5つのprimitiveを挙げる。
- handoffを説明する: toolとしてmodel化される理由、modelから見えるname shape、context transferの方法。
- input guardrails、output guardrails、tool guardrailsを区別し、`run_in_parallel`とblocking modeを説明する。
- handoffs + guardrails + span-style tracingを持つstdlib runtimeを実装する。

## 問題

きれいにdelegateできないagentは、すべてを1つのpromptに詰め込みます。guardrailのないagentはPII、policy-violating outputをshipしたり、永遠にloopしたりします。OpenAIのSDKは、multi-agentを扱いやすくする3つのprimitiveをcodifyしています。

## The Concept

### Five primitives

1. **Agent.** LLM + instructions + tools + handoffs。
2. **Handoff.** 別agentへのdelegation。modelには`transfer_to_<agent_name>`というtoolとして表現される。
3. **Guardrail.** input (first agentのみ)、output (last agentのみ)、tool invocation (function toolごと) のvalidation。
4. **Session.** turnをまたぐautomatic conversation history。
5. **Tracing.** LLM generation、tool call、handoff、guardrail用のbuilt-in spans。

### Handoffs as tools

modelはtool list内で`transfer_to_billing_agent`を見ます。これをcallすると、runtimeは次を行います。

1. conversation contextをcopyする (または`nest_handoff_history` betaでcollapseする)。
2. target agentをinstructionsでinitializeする。
3. target agentでrunを続行する。

これはsupervisor pattern (Lesson 13 / Lesson 28) をproductizeしたものです。

### Guardrails

3つのflavorがあります。

- **Input guardrails.** first agentのinputで実行する。LLM call前にunsafeまたはout-of-scope requestをrejectする。
- **Output guardrails.** last agentのoutputで実行する。PII leak、policy violation、malformed responseをcatchする。
- **Tool guardrails.** function toolごとに実行する。argumentをvalidateし、permissionをcheckし、executionをauditする。

Mode:

- **Parallel** (default)。guardrail LLMがmain LLMと並行して走る。tail latencyが低い。tripした場合、main LLMのworkはdiscardされる (token waste)。
- **Blocking** (`run_in_parallel=False`)。guardrail LLMが先に走る。tripした場合、main callのtokenは無駄にならない。

Tripwireは`InputGuardrailTripwireTriggered` / `OutputGuardrailTripwireTriggered`をraiseします。

### Tracing

defaultでonです。すべてのLLM generation、tool call、handoff、guardrailがspanをemitします。`OPENAI_AGENTS_DISABLE_TRACING=1`でopt outできます。`add_trace_processor(processor)`は、OpenAI側に加えて自分のbackendにもspanをfan outします。

### Sessions

`Session`はconversation historyをbackend (SQLite、Redis、custom) に保存します。`Runner.run(agent, input, session=session)`がauto-loadしてappendします。

### Where this pattern goes wrong

- **Handoff drift。** Agent AがAgent Bへhandoffし、BがAへhandoffし返す。hop counterを追加します。
- **Guardrail bypass。** Tool guardrailはfunction toolでしかfireしません。built-in tools (file reader、web fetch) には別policyが必要です。
- **Over-tracing。** spanにsensitive contentが入る。OTel GenAI content-capture rules (Lesson 23) と組み合わせます。contentは外部に保存し、IDで参照します。

## 実装

`code/main.py`はstdlibでSDK shapeを実装しています。

- `Agent`、`FunctionTool`、`Handoff` (transfer semanticsを持つfunction tool)。
- input/output/tool guardrails、handoff dispatch、hop counterを持つ`Runner`。
- trace shapeを示すsimple span emitter。
- user's queryに基づいてbillingまたはsupportへhandoffするtriage agent。1つのinputでguardrailがtripします。

実行:

```
python3 code/main.py
```

traceでは、2つのsuccessful handoff、1つのinput guardrail trip、real SDKがemitするものに対応したspan treeが見えます。

## Use It

- **OpenAI Agents SDK** for OpenAI-first products。
- **Claude Agent SDK** (Lesson 17) for Claude-first products。
- **LangGraph** (Lesson 13) when you want explicit state and durable resume。
- **Custom** when you need exact control (voice, multi-provider, federated deployments)。

## Ship It

`outputs/skill-agents-sdk-scaffold.md`は、triage agent、handoffs、input/output/tool guardrails、session store、trace processorを持つAgents SDK appをscaffoldします。

## Exercises

1. handoff hop counterを追加する。N transfers後に拒否する。behaviorをtraceする。
2. `nest_handoff_history`をoptionとして実装する。transfer前にprior messagesを1つのsummaryへcollapseする。
3. blocking output guardrailを書く。tripするpromptとpassするpromptでlatencyを比較する。
4. `add_trace_processor`をJSON loggerへwireする。spanごとにどんなshapeをemitするか。
5. SDK docsを読む。stdlib toyを`openai-agents-python`へportする。どこを間違ってmodel化していたか。

## Key Terms

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Agent | 「LLM + instructions」 | SDK内のAgent type。toolsとhandoffsをownする |
| Handoff | 「Transfer」 | modelが別agentへdelegateするためにcallするtool |
| Guardrail | 「Policy check」 | input / output / tool invocationのvalidation |
| Tripwire | 「Guardrail trip」 | guardrailがrejectしたときにraiseされるexception |
| Session | 「History store」 | run間でpersistされるconversation memory |
| Tracing | 「Spans」 | LLM + tool + handoff + guardrail上のbuilt-in observability |
| Blocking guardrail | 「Sequential check」 | guardrailが先に走る。trip時のtoken wasteはない |
| Parallel guardrail | 「Concurrent check」 | guardrailが並行して走る。低latencyだがtrip時にtokenを無駄にする |

## 参考文献

- [OpenAI Agents SDK docs](https://openai.github.io/openai-agents-python/) — primitives, handoffs, guardrails, tracing
- [Claude Agent SDK overview](https://platform.claude.com/docs/en/agent-sdk/overview) — Claude-flavored counterpart
- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) — handoffを使うべき場面
- [OpenTelemetry GenAI semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/) — Agents SDK spansがmapされるstandard
