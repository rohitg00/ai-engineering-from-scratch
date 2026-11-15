# interrupt() and Command(resume): the resume index and interrupt ids

> A resume reruns the node from its first line, model calls too, and matches answers by position, so keep model calls out of interrupting nodes and resume by id map.

Your graph asks two people at once: a traveller in one branch and an approver in another. Each node first asks the model to write its question. Both questions reach your UI. The approver answers first, and your server sends `Command(resume="OK")`. LangGraph raises `RuntimeError`, and nothing resumes. When you send both answers as a map, it works, and your bill shows the model wrote the same questions again.

When you finish this section, you can trace a resume through `interrupt()` line by line and predict which answer each call gets. You can also resume two waiting nodes in one call, and count the model calls that a resume repeats.

## What interrupt() does on each call

**Resume list:** the list of answers that one task has received so far, saved as a write on the channel `__resume__`.

`interrupt()` keeps a counter in the scratchpad of its task. On each call it takes the next index and tries three sources in order {{code libs/langgraph/langgraph/types.py:1029-1058}}:

1. If the resume list of the task has an answer at this index, it returns that answer. This is the replay of an earlier question.
2. Otherwise, if the resume command carried one answer for the whole graph, it appends that answer to the list, saves the list, and returns it.
3. Otherwise, it raises `GraphInterrupt` with a new `Interrupt`, and the node stops.

**Interrupt id:** the id of one question. It is an `xxh3` hash of the task namespace, with `|n` added for the nth unanswered question of that task {{code libs/langgraph/langgraph/types.py:583-589}}.

When a task raises `GraphInterrupt`, the runner saves the question and the resume list as writes of that task {{code libs/langgraph/langgraph/pregel/_runner.py:594-600}}. The id needs no storage. The loop recomputes it from the namespace and the number of answers. The saver stores the question as a write on `__interrupt__` with index -3, and each answer on `__resume__` with index -4 {{code libs/checkpoint/langgraph/checkpoint/base/__init__.py:824}}.

## Three calls on one thread, captured

The capture graph runs `ask`, `approve`, and `other` in parallel after `START`, and then `after`. It uses Qwen3 4B on the x86 server guest at temperature 0. `ask` asks the model for a question, calls `interrupt()`, asks the model for a second question, and calls `interrupt()` again. `approve` asks the model for one question and calls `interrupt()` once. `other` calls the weather tool and the model, and never interrupts. Each node logs its first line with its namespace and its resume list, and logs each model call.

The first `invoke` returned two interrupts. `other` ran and finished, and its writes were saved:

```listing
title: run 1, two interrupts and the recomputed ids
source: capture/lab/internals/04-interrupt/trace.txt
lang: text
---
  returned interrupt id=462dc352bc169ed50a32e43c579712fb value={'q': 'Which city would you like to visit?'}
  returned interrupt id=11314d20c136a4a3ec3a8a26c24243c9 value={'q': 'Could you please approve a travel budget of 900 EUR for the upcoming business trip to Berlin?'}
…
  recompute id for ask: xxh3_128(task_checkpoint_ns='ask:db8df5fb-7f77-0ac1-61de-e4a38b97c8a0') = 462dc352bc16... matches=True
  recompute id for approve: xxh3_128(task_checkpoint_ns='approve:56f9f439-6fe7-44ef-ec89-762fd2b36cf4') = 11314d20c136... matches=True
```

A resume with one plain value raised, and no node and no model call ran. The loop counts the pending interrupts, and with more than one it requires a map from id to answer {{code libs/langgraph/langgraph/pregel/_loop.py:1066-1075}}:

```listing
title: run 2a, one answer for two questions
source: capture/lab/internals/04-interrupt/trace.txt
lang: text
---
## run 2a: Command(resume='yes') without an id while 2 interrupts are pending
  raises RuntimeError: When there are multiple pending interrupts, you must specify the interrupt id when resuming. Docs: https://docs.langchain.com/oss/python/lan
```

The map form worked. Both nodes ran again from their first line, and both called the model again before they reached `interrupt()`. `approve` got `OK` and finished. `ask` got `A1` for its first question, asked the model for its second, and stopped there with a new id. `other` did not run again. The loop reapplied its saved writes:

```listing
title: run 2b, a map of answers by id
source: capture/lab/internals/04-interrupt/trace.txt
lang: text
---
## run 2b: Command(resume={ask_id: 'A1', approve_id: 'OK'})
…
    {"node": "ask", "event": "enter (first line)", "ns": "ask:db8df5fb-7f77-0ac1-61de-e4a38b97c8a0", "scratchpad.resume": ["A1"], "null_resume": null}
    {"node": "ask", "event": "model call -> 'Which city would you like to visit?'", "model_s": 1.16}
    {"node": "ask", "event": "interrupt #0 returned 'A1'"}
…
  tick step=1 returns=True to_run=['approve', 'ask'] reapplied(no rerun)=['other']
  returned interrupt id=177b6fc6979f90e1a13103fec68d96fb value={'q': 'How many nights will the traveller stay at A1?'}
  second interrupt id expected = xxh3_128(ns + '|1') = 177b6fc6979f... matches=True
```

The third call, `Command(resume='A2')`, needed no id, because one question was left. `ask` ran a third time. It asked the model for its first question again and replayed `A1` from the list. Then it asked for its second question again and got `A2` from the command. [Figure](#fig-2-4) draws the three calls.

```figure
id: fig-2-4
kind: timeline
title: three calls that answer three questions in two parallel nodes
claim: Each call reran the waiting nodes and their model calls from the first line, replayed saved answers by index, and never ran the finished node other again.
caption: Columns are the calls in order, and rows are the four nodes. Amber cells stop at an interrupt, with its id, teal cells finish, and the dashed cell reapplied saved writes. The list in each cell is the resume list the node saw on its first line. The bottom rows count model calls and name the checkpoints each call saved. From capture/lab/internals/04-interrupt/trace.txt.
```

## What the replay costs

The graph has five model prompts: two in `ask`, one each in `approve`, `other`, and `after`. The three calls made 9 model calls:

```listing
title: model calls per call of the graph
source: capture/lab/internals/04-interrupt/trace.txt
lang: text
---
## model calls per invocation: {'run 1': 3, 'run 2a': 0, 'run 2b': 3, 'run 3': 3}
```

The first question of `ask` went to the model three times, and its second question and the question of `approve` twice each. At temperature 0 the replayed questions came back word for word the same. A model that samples can write a different question on the replay. The answer still goes to the same index, so your user can answer one question and the node then sees another.

## No new checkpoint inside a superstep

Three calls on the thread made four checkpoints, not six:

```listing
title: the checkpoint history after three calls
source: capture/lab/internals/04-interrupt/trace.txt
lang: text
---
## checkpoint history (newest first)
  step=2 source=loop next=() id=..bc1c0b7b902f
  step=1 source=loop next=('after',) id=..9a14716dbcea
  step=0 source=loop next=('ask', 'approve', 'other') id=..1ca1bd022200
  step=-1 source=input next=('__start__',) id=..88027e62558c
```

Run 2b ended with `ask` still waiting, so the superstep of step 1 was not done. The answers and the new question were saved as writes on checkpoint `1ca1bd022200`, next to the writes of `other`. A checkpoint appears only when every task of the superstep has finished. So a time-travel tool that lists checkpoints shows no point between two answers to the same node.

## What to do

Read the pending interrupts from `get_state(config).tasks`, and answer with `Command(resume={id: value})`. The loop reads a dict as a map when every key is an `xxh3` hex id, whatever the number of pending interrupts {{code libs/langgraph/langgraph/pregel/_loop.py:1045-1064}}. We did not run the map form with one interrupt. Use it always, so a second branch with a question does not break your server.

Move each model call that writes a question into its own node, before the node that calls `interrupt()`. That node finishes, its writes are saved, and a resume does not run it again, as `other` shows. The question then stays the same on every replay, and you pay for it once.

Keep the `interrupt()` calls of a node in the same order on every run, and do not skip one on a condition that can change. The answer goes to an index, not to a question.

The interrupt id is a stable name for a question. It depends only on the task namespace, and [section 2.3](#s-the-checkpoint-write-path-and-durability) measured that namespace across a crash and a new process. Use the id as the key of the question in your UI and your database.

```takeaways
- Resume with Command(resume={interrupt_id: value}), even for one question.
- Put the model call that writes a question in a node before the node that interrupts.
- Keep interrupt() calls in a fixed order, because answers are matched by index.
- Store the interrupt id as the key of each question in your own database.
```

Sources: capture/lab/internals/04-interrupt/trace.txt, capture/lab/internals/04-interrupt/run.py, capture/lab/internals/04-interrupt/run1.trace.jsonl, capture/lab/internals/04-interrupt/run2b.trace.jsonl, capture/lab/internals/common/real.py; libs/langgraph/langgraph/types.py, libs/langgraph/langgraph/pregel/_loop.py, libs/langgraph/langgraph/pregel/_algo.py, and libs/langgraph/langgraph/pregel/_runner.py at langgraph 1.2.22; libs/checkpoint/langgraph/checkpoint/base/__init__.py at langgraph-checkpoint 4.3.2.
