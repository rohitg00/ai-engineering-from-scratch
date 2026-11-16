# A failure drill

> One script causes seven failures with Qwen3 4B on a local Ollama and prints the symptom, the state, the fix, and the time for each, in about 100 seconds.

Your agent fails in production with a symptom that the logs do not explain. A model call took six seconds and nothing raised. A customer has two charges. An email went out that nobody approved. Each of these failures has a section in this manual, and each one is easier to fix when you have seen it before.

When you finish this section, you can run seven documented failures on your own machine. You can also read the symptom of each and apply its fix.

## What the drill does

**Failure drill:** a script that causes each known failure on purpose, on a machine you can lose, and prints what you would see.

Qwen3 4B on Ollama plays the model. A relay in front of Ollama drops every connection for the retry case. No request leaves the machine. Two cases start child processes, one to kill and one to watch at exit.

```bash
cd capture/demos/failure-drill
./run.sh
```

For each case, the drill prints five lines: the symptom, the state, the fix, the result after the fix, and the time. The seven cases come from these sections:

| Case | Failure | Section |
|---|---|---|
| 1 | retry layers stack on one model call | [4.7](#s-retries-backup-models-rate-limits-and-caching) |
| 2 | a crash between a side effect and its checkpoint | [5.3](#s-durability-modes-and-a-crash-between-two-steps) |
| 3 | an approval skipped by a middleware that jumps to tools | [6.5](#s-human-in-the-loop-batched-and-per-call) |
| 4 | a run that ends with no structured response | [4.2](#s-structured-output-autostrategy-providerstrategy-toolstrategy) |
| 5 | a tracing endpoint that is down | [7.6](#s-langsmith-tracing) |
| 6 | two tools with the same name | [3.4](#s-tools-toolruntime-and-tool-errors) |
| 7 | a model that calls a tool forever | [6.8](#s-error-handlers-node-timeouts-and-the-recursion-limit) |

Each case is a short function. This is the middleware of case 3. It returns `jump_to="tools"` after any model message with a tool call:

```listing
title: the middleware that jumps past the review
source: capture/demos/failure-drill/drill.py
lang: python
---
class JumpToTools(AgentMiddleware):
    @hook_config(can_jump_to=["tools"])
    def after_model(self, state, runtime):
        if getattr(state["messages"][-1], "tool_calls", None):
            return {"jump_to": "tools"}
        return None
```

Case 2 runs this tool in a child process on `SqliteSaver`. In the first process it writes the charge, syncs the file, and kills its own process. A second process resumes the thread with `invoke(None)`. With `keyed` on, the tool checks its `tool_call_id` first:

```listing
title: the charge tool of case 2
source: capture/demos/failure-drill/drill.py
lang: python
---
    def charge_card(amount: int, runtime: ToolRuntime) -> str:
        """Charge the card of the customer."""
        key = runtime.tool_call_id
        lines = Path(sink).read_text().splitlines() if Path(sink).exists() else []
        if keyed and any(line.startswith(f"{key}\t") for line in lines):
            return f"already charged under key {key}"
        with open(sink, "a") as handle:
            handle.write(f"{key}\t{amount}\t{phase}\n")
            handle.flush()
            os.fsync(handle.fileno())
        if phase == "start":
            os.kill(os.getpid(), signal.SIGKILL)
        return f"charged {amount}"
```

## The recorded run

**We measured** three runs on the x86 server guest, n=3 for each case. Each run took 101 to 103 s. Most of it went to model calls on CPU. The tracing case took the longest, about 27 s, because it waited for the exit.

The drill prints the section numbers of the earlier layout of this manual. Read sections 3.5, 4.3, 5.5, 3.2, 6.4, 2.4, and 5.8 in its output as sections 4.7, 5.3, 6.5, 4.2, 7.6, 3.4, and 6.8.

The first two cases are silent. Nothing raised, and the damage is in a count:

```listing
title: retry layers and a crash after a side effect
source: capture/lab/failure-drill-x86/drill-run1.log
lang: text
note: The first of three runs.
---
== 1 retry layers stack on one model call (section 3.5)
  symptom   one model call sent 9 requests to a relay in front of Ollama that drops every connection, in 6.8 s
  state     the run ended without an exception, last AIMessage: Model call failed after 3 attempts with OpenAIConnectionError: Connection error.
  fix       ChatOpenAI(max_retries=0), so ModelRetryMiddleware is the only retry layer
  after     3 requests in 2.3 s
  time      9.59 s

== 2 a crash between a side effect and its checkpoint (section 4.3)
  symptom   the first process exited with -9 inside charge_card, the resume ran charge_card again: 4 charges
  state     after the resume: next [], 5 messages, charges ['start', 'start', 'resume', 'resume'], last 'Charged'
  fix       check runtime.tool_call_id against the charges before the charge, with durability sync
  after     exit -9, then the resume: 2 charge, next [], last 'Charged'
  time      14.32 s
```

In case 1, `ChatOpenAI` made 3 attempts inside each of the 3 attempts of `ModelRetryMiddleware`. The run then ended with the error as the text of an `AIMessage`, so a caller that reads only the last message sees an answer. In case 2, the exit code `-9` is the SIGKILL. The model asked for two charges in one reply, and the key cannot stop that second call. Check the order before the charge.

Without the key, the three runs left 4, 4, and 3 charges. With the key, each run left 2: one for each call id. The saved AI message keeps its call ids, so the key matched each call on the resume.

The next two cases change what a run does without an error:

```listing
title: a skipped approval and a missing structured response
source: capture/lab/failure-drill-x86/drill-run1.log
lang: text
note: The first of three runs. The last messages of the three None runs are cut at the mark.
---
== 3 an approval skipped by a middleware that jumps to tools (section 5.5)
  symptom   send_email ran 1 time before any decision, with 0 interrupts, to ['all-staff@example.org']
  state     batched mode, middleware=[HumanInTheLoopMiddleware, JumpToTools], next []
  fix       interrupt_mode="per_call", which pauses inside the tool call
  after     send_email ran 0 times, 1 interrupt waits, next ['tools']
  time      7.06 s

== 4 a run that ends with no structured response (section 3.2)
  symptom   3 of 5 prompts ended with no exception and structured_response None: ['Hello! How are you today?', 'Tell me a one-line joke.', 'What is the total of an empty order?']
  state     bound tools ['add', 'Answer']; last messages of the None runs: …
  fix       check structured_response for None after each run, and treat None as a failure
  after     the check raised on 3 of 5 runs
  time      15.56 s
```

In case 4, the two arithmetic prompts gave a structured response. The other three ended with plain text and no exception, in 3 of 3 runs. For the empty order, the model wrote `Answer(total=0)` as text in place of a call of the `Answer` tool.

The last three cases are a slow exit, a lost tool, and an endless loop:

```listing
title: a tracing endpoint that is down, a duplicate tool name, and the recursion limit
source: capture/lab/failure-drill-x86/drill-run1.log
lang: text
note: The first of three runs. The rest of the GraphRecursionError message is cut at the mark.
---
== 5 a tracing endpoint that is down (section 6.4)
  symptom   the agent run took 4436.9 ms, and the process exited 16.9 s after it (22.0 s in all)
  state     LANGSMITH_TRACING=true, nothing listens on the endpoint port, 3 lines of upload errors on stderr
  fix       probe GET /info with a 1 s timeout at start, and run inside tracing_context(enabled=False) when it fails
  after     tracing False, exit 0.3 s after the run (5.0 s in all), 0 lines of upload errors
  time      26.97 s

== 6 two tools with the same name (section 2.4)
  symptom   create_agent raised nothing, the model saw 1 tool named ['lookup']
  state     the call to lookup ran: ['from the refunds table']; final answer "I'm sorry, but I couldn't find any information about order 7 in the refunds tabl"
  fix       check that tool names are unique before create_agent
  after     the check found duplicate names ['lookup']
  time      5.92 s

== 7 a model that calls a tool forever (section 5.8)
  symptom   GraphRecursionError: Recursion limit of 10 reached without hitting a stop condition. …
  state     the model was called 5 times before the limit
  fix       ModelCallLimitMiddleware(run_limit=3, exit_behavior="end"), first with the same recursion_limit of 10
  after     recursion_limit 10: 3 model calls, GraphRecursionError: Recursion limit of 10 reached without hi …
  after     recursion_limit 25: 3 model calls, no exception, last message 'Model call limits exceeded: run limit (3/3)'
  time      23.61 s
```

Case 6 is a failure that the earlier sections do not show. The tool node of `create_agent` keeps its tools in a dict keyed by name, so the second `lookup` replaced the first {{code libs/prebuilt/langgraph/prebuilt/tool_node.py}}. The model saw one tool, the agent raised nothing, and every call went to the refunds function. So the answer said it found nothing about order 7 in the refunds table. Two instances of one middleware raise an `AssertionError`, as [section 4.5](#s-middleware-hooks-and-their-order) shows. Two tools with one name raise nothing.

Case 7 shows a fix that needs a second change. `ModelCallLimitMiddleware` adds its own node to each loop of the agent, so three model calls needed more than 10 steps. With `recursion_limit` 10 the run still raised. With 25 it ended by itself after the third call. [Figure](#fig-8-7) sets each symptom beside its result after the fix.

```figure
id: fig-8-7
kind: comparison
title: seven failures of the drill, before and after each fix
claim: Six of the seven failures raised nothing, and each fix in the right column comes from the section that documents the failure.
caption: Read each row from the symptom on the left to the result after the fix on the right. Rose cells are the failure, teal cells the result with the fix. From capture/lab/summary/failure-drill-x86.json.
```

## What the drill adds to the earlier sections

Three cases repeat a measured result of an earlier part on a smaller scale. Compare the counts, not the seconds, because the runs differ in size and machine.

| Case | Earlier result | The drill |
|---|---|---|
| retry layers | 9 model requests for a dropped connection on every call, 3 runs, section 3.2 | 9 requests, 3 runs |
| crash after a side effect | the effect ran twice in 80 of 150 graph trials, section 5.3 | 3 or 4 charges without the key, 2 with it, 3 trials |
| tracing endpoint down | the exit waited 9.9 s after 50 runs, section 7.6 | the exit waited 16.9 to 17.3 s after 1 run |

The tracing numbers come from processes of different sizes, 350 traced runs against 7, so do not compare their seconds. Both show the same symptom: a process with tracing on waits at exit for an endpoint that does not answer. The probe in case 5 is our own fix. Section 7.6 gives two others: call `wait_for_all_tracers()` at a point you choose, and put a timeout on the job.

## Limits of the drill

- The saved AI message keeps its call ids, so the key matches on resume. A real model can still ask for the same charge twice in one reply.
- The retry case uses `ChatOpenAI` through a relay that drops connections. Other provider packages have their own client retries. `ChatOllama` makes 1 attempt.
- The drill covers the failures that need only Ollama. The MCP, Postgres, and Agent Server failures of Parts 7 and 8 need their services. [Part 9](#p-9) runs the Postgres failures in a service: a crash after a refund, a SIGTERM, and a hung tool.
- Three runs show that the cases repeat, not how often they fail on other models.

```takeaways
- Run the drill after each upgrade of the stack, and compare its log with the recorded one.
- Count requests, charges, and tool runs, because six of the seven failures raise nothing.
- Check tool names for duplicates before create_agent.
- Raise recursion_limit when you add a call limit, because the middleware adds steps.
- Probe the tracing endpoint at start, and turn tracing off when it does not answer.
```

Sources: capture/demos/failure-drill/drill.py, capture/demos/failure-drill/real.py, capture/demos/failure-drill/run.sh, capture/demos/failure-drill/README.md; capture/lab/failure-drill-x86/drill-run1.log, capture/lab/failure-drill-x86/drill-run1.jsonl, capture/lab/failure-drill-x86/drill-run2.jsonl, capture/lab/failure-drill-x86/drill-run3.jsonl, capture/lab/summary/failure-drill-x86.json, capture/lab/summary/retries-x86.json, capture/lab/summary/crash-resume-mac.json, capture/lab/summary/tracing-mac-real.json; libs/prebuilt/langgraph/prebuilt/tool_node.py at langgraph 1.2.22; libs/langchain_v1/langchain/agents/factory.py at langchain==1.5.0.
