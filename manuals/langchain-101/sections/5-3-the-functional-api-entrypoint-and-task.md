# The functional API: @entrypoint and @task

> An `@entrypoint` function runs again from its top on every resume, and each `@task` that finished before the pause returns its saved result instead of running again.

You have a plain Python function that calls three services in a row. You want it to pause for a person and survive a restart. Rewriting it as nodes and edges would change code that works. The functional API keeps the function and adds checkpoints around its calls.

When you finish this section, you can turn a function into an `@entrypoint` with `@task` calls. You can also predict which calls run again on a resume, and keep a value between runs.

## The entrypoint and its tasks

**Entrypoint:** a function decorated with `@entrypoint`. LangGraph runs it as a graph with one node, and it saves checkpoints on its thread when you pass a checkpointer.

**Task:** a function decorated with `@task`. A call returns a future at once, and LangGraph saves the result of the task when it finishes.

The kit workflow doubles three numbers in three tasks, adds them, and asks a person to keep the total. The question is an `interrupt` inside a task:

```listing
title: an entrypoint with three tasks and a question
source: capture/s_graph.py
lang: python
---
    @task
    def double(x: int) -> int:
        runs.append(f"double({x})")
        return x * 2

    @task
    def ask_human(total: int) -> str:
        return interrupt({"total": total, "question": "Keep it?"})

    @entrypoint(checkpointer=InMemorySaver())
    def workflow(numbers: list[int]) -> dict:
        futures = [double(n) for n in numbers]
        total = sum(f.result() for f in futures)
        answer = ask_human(total).result()
        return {"total": total, "answer": answer}
```

The three calls of `double` start all three tasks before the first `result()`, and each `result()` waits for one of them.

The functional API page sets three rules for this code {{docs oss/python/langgraph/functional-api}}. The entrypoint takes one positional argument. Its input and output, and the output of each task, must be JSON-serializable when a checkpointer is set. You call a task only from an entrypoint, from another task, or from a node of a graph.

## The first run stops inside a task

The first run doubled 1, 2, and 3, added 12, and stopped at the question. `invoke` with `version="v2"` returns the value and the interrupts apart:

```listing
title: the first run of the workflow
source: capture/out/35-functional-api.txt
lang: json
---
{
  "value": {},
  "interrupts": [
    {
      "value": {
        "total": 12,
        "question": "Keep it?"
      },
      "id": "<hex-1>",
      "response_schema": null
    }
  ]
}

task runs:
[
  "double(1)",
  "double(2)",
  "double(3)"
]
```

The value is empty, because the function did not return.

## The resume restores finished tasks

`Command(resume="yes")` on the same thread runs `workflow` again from its first line. The three calls of `double` return their saved results, and the body of `double` does not run. `ask_human` gets `"yes"` from `interrupt`, and the function returns:

```listing
title: the resume of the workflow
source: capture/out/35-functional-api.txt
lang: json
---
{
  "total": 12,
  "answer": "yes"
}

task runs:
[
  "double(1)",
  "double(2)",
  "double(3)"
]
```

The list of task runs still has three entries. The docs say the same. A resume starts at the top of the entrypoint, and the checkpointer gives back the results of finished tasks {{docs oss/python/langgraph/functional-api}}. [Figure 5.3](#fig-5-3) draws both runs.

```figure
id: fig-5-3
kind: sequence
title: two runs of one entrypoint
claim: The resume runs workflow from its top, the three double tasks return saved results without running, and only ask_human runs again.
caption: Read run 1 at the top and run 2 under it. Plum arrows are task bodies that ran, teal arrows are saved results, and the amber row is the interrupt. From capture/out/35-functional-api.txt.
```

Code in the entrypoint itself is not a task, so it runs again on every resume. In the kit, the sum runs twice. Put each side effect inside a task, so that a resume does not repeat it.

The `updates` stream of a new run yields one chunk for each finished task, keyed by the task name. The run with the input `[5]` yielded `{"double": 10}`, then the `__interrupt__` chunk.

## A value that stays on the thread

**entrypoint.final:** a return value of an entrypoint that splits what the caller gets from what the thread saves. The saved value comes back as the `previous` argument of the next run.

The kit counter adds each input to the saved total. It returns a sentence and saves the number:

```listing
title: a counter that keeps its total
source: capture/s_graph.py
lang: python
---
    @entrypoint(checkpointer=InMemorySaver())
    def counter(n: int, *, previous: int | None = None) -> entrypoint.final[int, int]:
        total = (previous or 0) + n
        return entrypoint.final(value=f"added {n} to {previous}, saved {total}", save=total)
```

Three calls on one thread with 3, 4, and 5 returned these values:

```listing
title: three calls of the counter
source: capture/out/35-functional-api.txt
lang: json
---
three calls:
[
  "added 3 to None, saved 3",
  "added 4 to 3, saved 7",
  "added 5 to 7, saved 12"
]
```

The first call got `None` as `previous`. Each later call got the number that the call before it saved. The return type `entrypoint.final[int, int]` in the kit does not match the string value, and the run still works, because LangGraph does not check it.

## One node, not a graph of nodes

The graph of the workflow has three nodes: `__start__`, `workflow`, and `__end__`. The tasks are not nodes, so a graph drawing shows none of them. The functional API page says to use the graph API for new agents and workflows. It suggests the functional API for an agent that already exists in other code and must run on Agent Server {{docs oss/python/langgraph/functional-api}}.

A task can also take `retry_policy`, `cache_policy`, and `timeout` {{code libs/langgraph/langgraph/func/__init__.py}}. The kit does not run them on a task yet. Captures of them come in the next edition, with the other open items of section 7.6.

```takeaways
- Put each side effect in a task, because entrypoint code runs again on every resume.
- Expect the graph of an entrypoint to show one node and none of its tasks.
- Keep entrypoint and task values JSON-serializable when a checkpointer is set.
- Use entrypoint.final and previous to keep a value between runs on one thread.
- Choose the graph API for a new agent, and the functional API to wrap existing code.
```

Sources: capture/s_graph.py, capture/out/35-functional-api.txt; libs/langgraph/langgraph/func/__init__.py at langgraph 1.2.22; docs.langchain.com at docs commit 04d4d4a (oss/python/langgraph/functional-api).
