# interrupt and resume

> `interrupt` saves the run and returns the question to the caller, and `Command(resume=...)` runs the paused node again from its first line with the answer.

You add a review step to a graph. The node writes a log line, asks a person to approve, and then records the verdict. After the person answers, the log line appears twice. The node did not continue from the question. It ran again from its first line.

When you finish this section, you can pause a node with `interrupt`, resume it with `Command(resume=...)`, and say which code runs twice. You can also name the four cases where a pause or a resume does not do what you expect.

## A node that asks a question

**Interrupt:** a call of `interrupt(value)` inside a node. It stops the run, saves a checkpoint, and gives `value` to the caller as the question.

The kit graph has two nodes. `write` sets a draft, and `review` asks for approval. `runs` records each line that the node reaches:

```listing
title: the review node
source: capture/s_persist.py
lang: python
---
    def review(state):
        runs.append("review before interrupt")
        answer = interrupt({"question": "Approve this draft?", "draft": state["draft"]})
        runs.append(f"review after interrupt: {answer}")
        return {"verdict": "approved" if answer == "yes" else f"rejected: {answer}"}
```

The graph has `InMemorySaver` as its checkpointer. The first `invoke` with `version="v2"` returned one interrupt, and the state said that `review` runs next:

```listing
title: the interrupt and the state while the run waits
source: capture/out/32-interrupt-resume.txt
lang: json
note: The state block is cut to its next key.
---
interrupts:
[
  {
    "value": {
      "question": "Approve this draft?",
      "draft": "Ship v2 on Friday."
    },
    "id": "<hex-1>",
    "response_schema": null
  }
]

state:
{
  "next": [
    "review"
  ],
```

The value of the interrupt must be JSON-serializable {{docs oss/python/langgraph/interrupts}}. With the default `invoke`, the interrupts come back in the result under the key `__interrupt__` {{docs oss/python/langgraph/interrupts}}.

## The resume runs the node from its top

**Resume:** an `invoke` or `stream` call whose input is `Command(resume=value)`, on the same thread as the pause. The `interrupt` call returns `value`.

The resume with `"yes"` finished the run with the verdict `approved`. The log of node lines shows what ran:

```listing
title: the lines the nodes reached
source: capture/out/32-interrupt-resume.txt
lang: json
---
node runs:
[
  "write",
  "review before interrupt",
  "review before interrupt",
  "review after interrupt: yes"
]
```

`write` ran once, because it finished before the pause. `review` ran twice, and the line before `interrupt` ran on both runs. The interrupts page says the same: the runtime starts the node again from the beginning {{docs oss/python/langgraph/interrupts}}. [Figure](#fig-5-4) draws the two calls.

```figure
id: fig-5-4
kind: sequence
title: one interrupt and one resume
claim: The resume runs review from its first line, so the line before interrupt runs twice, and write does not run again.
caption: Read the rows from top to bottom. Teal arrows are checkpoints, the amber row is the pause, and the rows in the lower half belong to the resume. The right column is the log of node bodies that ran. From capture/out/32-interrupt-resume.txt.
```

So the code before an `interrupt` must be safe to run twice. The docs ask for side effects before an interrupt to be idempotent {{docs oss/python/langgraph/interrupts}}. Move a side effect after the `interrupt`, or into its own node before the review node.

## Two questions in one node

A node can call `interrupt` more than once. The kit node asks for a title and then a body. The first run returned the title question. The resume with `"Release"` ran the node from its top, and the first `interrupt` returned `"Release"`. The second `interrupt` then stopped the run with the body question. The resume with `"Friday"` finished it with the draft `Release: Friday`.

LangGraph matches each answer to an `interrupt` call by its position in the node. The docs warn against code that skips or reorders `interrupt` calls between runs, and against an `interrupt` inside a `while True` loop {{docs oss/python/langgraph/interrupts}}. Since `langgraph` 1.2.20, each `interrupt` in a task has its own id {{code langgraph 1.2.20 release notes}}. The kit recorded two different ids for the two questions.

## An answer with a schema

`interrupt` takes a `response_schema`. With a Pydantic model, LangGraph checks the answer before the node gets it. The kit asks with the schema `Verdict`, whose field `approve` is a boolean. The answer `{'approve': 'maybe'}` raised:

```listing
title: an answer that the schema rejects
source: capture/out/32-interrupt-resume.txt
lang: text
note: The help line of pydantic is cut.
---
raised pydantic_core._pydantic_core.ValidationError: 1 validation error for Verdict
approve
  Input should be a valid boolean, unable to interpret input [type=bool_parsing, input_value='maybe', input_type=str]
```

After the error, the run still waited on the node `typed`, and the answer `{'approve': True}` finished it. So a bad answer leaves the pause as it was, and the caller can ask again. The interrupt also carries the JSON schema of `Verdict`, so a user interface can build its form from it.

## Four cases to know

**Interrupt without a checkpointer.** The docstring of `interrupt` says that a checkpointer is required {{code libs/langgraph/langgraph/types.py}}. The kit compiled the two-question graph with no checkpointer, and `invoke` did not raise. It returned the input state and the interrupt:

```listing
title: an interrupt with no checkpointer
source: capture/out/32-interrupt-resume.txt
lang: json
---
returned:
{
  "value": {
    "draft": "",
    "verdict": "",
    "edits": []
  },
  "interrupts": [
    {
      "value": "Title?",
      "id": "<hex-5>",
      "response_schema": null
    }
  ]
}
```

Nothing saved the pause, so it cannot resume. A `Command(resume=...)` with no checkpointer raises `RuntimeError` with the text `Cannot use Command(resume=...) without checkpointer` {{code libs/langgraph/langgraph/pregel/_loop.py}}. The kit does not record that error yet. A capture of it comes in the next edition, with the other open items of [section 7.6](#s-limits-at-the-pin-and-what-comes-in-the-next-edition).

**Resume of a thread that is not waiting.** The kit sent `Command(resume='x')` to the review thread after it had finished. The call did not raise. It returned the finished state with no interrupts, and no node ran:

```listing
title: a resume of a finished thread
source: capture/out/32-interrupt-resume.txt
lang: json
---
returned:
{
  "value": {
    "draft": "Ship v2 on Friday.",
    "verdict": "approved",
    "edits": []
  },
  "interrupts": []
}
```

The answer `x` went nowhere, and the caller got no sign of it. Before you resume, call `get_state` and check that `next` names a node and that `tasks` holds an interrupt.

**A stale answer.** An answer to an interrupt that a resume already used is also accepted and ignored. LangGraph can refuse it with a strict resume mode, but at the pin the only switch is the internal config key `__pregel_strict_resume` {{code libs/langgraph/langgraph/_internal/_constants.py}}. Its check for a stale answer applies only to a resume map keyed by interrupt id {{code libs/langgraph/langgraph/pregel/_loop.py:1037-1063}}. The name starts with `__pregel`, so treat it as private and do not depend on it.

**We measured** both modes on the Mac, 3 runs of each case, with `SqliteSaver` and a new process for each step. An agent in `per_call` mode made two calls that needed approval. The first resume approved one call by its interrupt id, and the second resume sent the same answer again. With `__pregel_strict_resume` set, the second resume raised `UnknownInterruptError: Unknown or already-consumed interrupt` in 3 of 3 runs. Without it, the second resume raised nothing and ran nothing in 3 of 3 runs. In every run, `send_email` ran once and the model ran once.

**NodeInterrupt.** Older code raises `NodeInterrupt` in a node. The class is deprecated at the pin, and its warning points to `interrupt` {{code libs/langgraph/langgraph/errors.py}}.

```takeaways
- Make the code before an interrupt safe to run twice, or move it to another node.
- Resume with Command(resume=...) on the same thread_id as the pause.
- Compile with a checkpointer before you call interrupt.
- Check get_state().next and its interrupts before you send a resume.
- Give interrupt a response_schema when a user interface sends the answer.
- Keep the order of interrupt calls in a node the same on every run.
```

Sources: capture/s_persist.py, capture/out/32-interrupt-resume.txt; capture/lab/summary/approvals-mac.json, capture/lab/T07-approvals-mac/01-cases.jsonl; libs/langgraph/langgraph/types.py, libs/langgraph/langgraph/errors.py, libs/langgraph/langgraph/pregel/_loop.py, and libs/langgraph/langgraph/_internal/_constants.py at langgraph 1.2.22; docs.langchain.com at docs commit 04d4d4a (oss/python/langgraph/interrupts).
