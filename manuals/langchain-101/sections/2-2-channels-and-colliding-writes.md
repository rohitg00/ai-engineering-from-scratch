# Channels and colliding writes

> Give every key that two nodes write in one superstep a reducer before you deploy: a conflict breaks every later read of the thread, and only a reducer repairs it.

You add a second branch to a graph that works. Both branches ask the model for a value and set `x`. The first run fails with `InvalidUpdateError`. You open the thread in your admin page to look. That read fails with the same error, and so does a retry of the run, and so does a new turn.

When you finish this section, you can say what each channel type does with zero, one, or two writes in a superstep. You can also repair a thread that a conflict broke, and say when a message id can change across a resume.

## Seven channels, three cases

**Channel:** the object that holds one key of the graph state, or one internal value of the loop. `apply_writes` calls its `update` once per superstep with all the writes for it.

The capture drives each channel class directly with the same list of writes that `apply_writes` would pass. This part calls no model, because it tests the channel classes alone. The table is the result at `langgraph` 1.2.22:

| Channel | Used for | No write | One write | Two writes in one superstep |
|---|---|---|---|---|
| `LastValue` | a state key with no reducer | keeps the value | replaces it | raises `InvalidUpdateError` |
| `BinaryOperatorAggregate` | a key with a reducer, such as `add_messages` | keeps the value | folds it in | folds both, in task-path order |
| `Topic(accumulate=False)` | `__pregel_tasks`, the queue of `Send` | clears the queue | holds it | holds both |
| `EphemeralValue(guard=True)` | `__start__`, the input | clears it, new version | holds it | raises |
| `EphemeralValue(guard=False)` | `branch:to:<node>`, `jump_to` | clears it, new version | holds it | keeps the last |
| `NamedBarrierValue` | `join:a+b:c`, an edge that waits for several nodes | keeps the names seen | adds the name | adds both |
| `DeltaChannel` (beta) | a message list that saves writes instead of values | keeps the value | one reducer call | one reducer call for both |

The rows come from the channel code: `LastValue` raises on more than one value {{code libs/langgraph/langgraph/channels/last_value.py:56-64}}. `BinaryOperatorAggregate` folds each value and refuses two `Overwrite` values {{code libs/langgraph/langgraph/channels/binop.py:127-148}}. The two ephemeral channels clear on an empty update {{code libs/langgraph/langgraph/channels/ephemeral_value.py:55-68}}. A `Topic` without `accumulate` empties itself first on every update {{code libs/langgraph/langgraph/channels/topic.py:77-85}}. The barrier adds each name it knows {{code libs/langgraph/langgraph/channels/named_barrier_value.py:56-67}}. `DeltaChannel` passes the whole list of writes to its reducer in one call {{code libs/langgraph/langgraph/channels/delta.py:159-183}}.

```listing
title: one channel, three updates
source: capture/lab/internals/02-channels/trace.txt
lang: text
---
## LastValue
  update([1]) -> returns True; available=True get=1 checkpoint()=1
  update([]) -> returns False; available=True get=1 checkpoint()=1
  update([2, 3]) -> RAISES InvalidUpdateError: At key 'x': Can receive only one value per step. Use an Annotated key to handle multiple values.; available=True get=1 checkpoint()=1
```

## The conflict that breaks a thread

The error itself is documented in [section 6.1](#s-stategraph-state-and-reducers). What happens to the thread after it is not.

The capture runs `START -> a` and `START -> b` on `InMemorySaver`, with Qwen3 4B on the x86 server guest. `a` asks the model for the digit 1 and returns it as `x`, and `b` does the same for 2. `x` has no reducer. The raise comes from the update phase, after both node bodies and both model calls ran {{code libs/langgraph/langgraph/pregel/_loop.py:732}} {{code libs/langgraph/langgraph/pregel/_algo.py:319}}:

```listing
title: the raise, and the writes saved before it
source: capture/lab/internals/02-channels/trace.txt
lang: text
note: The frame list and the per-checkpoint dump are cut.
---
raised InvalidUpdateError: At key 'x': Can receive only one value per step. Use an Annotated key to handle multiple values.
…
node bodies that ran before the raise: ['a', 'b']
loop.put_writes calls before the raise (writes already persisted as pending): [('__start__', [('x', 0), ('branch:to:a', None), ('branch:to:b', None)]), ('b', [('x', 2)]), ('a', [('x', 1)])]
get_state after the raise ALSO raises InvalidUpdateError via ['main.py:1496', 'main.py:1331', '_algo.py:319', 'last_value.py:64']
get_state_history: 2 snapshots
raw saver.get_tuple works: checkpoint step=0 pending_writes=[('26351ed0', 'x', 1), ('8f6a50fe', 'x', 2)]
…
invoke(None) resume raises again: InvalidUpdateError; node bodies re-run on resume: [] (empty means the saved writes were reapplied, not re-executed)
```

Both writes were saved as pending writes of the checkpoint at step 0. `get_state` applies pending writes to build the state it returns {{code libs/langgraph/langgraph/pregel/main.py:1326-1333}}. So it calls the same `LastValue.update` with the same two values, and it raises the same error. `invoke(None)` reapplies the same writes and raises without running a node or the model. Only the raw saver reads the thread.

## Repairing a broken thread

**We measured** four ways out on the x86 server guest with Qwen3 4B, one run each, with the same graph and `InMemorySaver`. The file made 14 model calls in all:

```listing
title: four repairs of a thread with a LastValue conflict
source: capture/lab/internals/02-channels/repair.txt
lang: text
note: The checkpoint id in the update_state result is cut, and so are parts 3 and 4.
---
## 1. same graph, after the raise
get_state: raises InvalidUpdateError: At key 'x': Can receive only one value per step. Use an Annotated key to handle multiple v
update_state(cfg, {'x': 9}): ok -> {'configurable': {'thread_id': 't1', 'checkpoint_ns': '', …
invoke(None): raises InvalidUpdateError: At key 'x': Can receive only one value per step. Use an Annotated key to handle multiple v
node bodies run by invoke(None): ['a', 'b']; model calls so far 4
invoke({'x': 5}) as a new turn: raises InvalidUpdateError: At key 'x': Can receive only one value per step. Use an Annotated key to handle multiple v

## 2. same saver, graph recompiled with x: Annotated[int, operator.add]
get_state: ok -> {'x': 3}
invoke(None): ok -> {'x': 3}
node bodies run by invoke(None): []; model calls so far 8
```

`update_state` wrote a new checkpoint, and the next `invoke(None)` ran both nodes and both model calls again, then raised again. A new turn raised too, because the graph is still wrong. A fork from the input checkpoint ran both nodes and raised. Only a fixed schema helped. The same saver with `x: Annotated[int, operator.add]` read the thread at once and finished the run. No node ran again, so no model call was paid twice.

[Figure](#fig-2-2) draws the broken run and the repair.

```figure
id: fig-2-2
kind: sequence
title: a LastValue conflict, the reads that fail after it, and the repair
claim: Both writes are saved before the update raises, so every read replays the conflict until a schema with a reducer reapplies the same saved writes.
caption: Read top to bottom. Teal arrows are pending writes saved to InMemorySaver, rose arrows are raises, and the lower block is the same thread under the fixed graph. From capture/lab/internals/02-channels/trace.txt and capture/lab/internals/02-channels/repair.txt.
```

So a conflict needs no data repair. Deploy the reducer, and every broken thread finishes from its saved writes. The reducer you pick decides the value: `operator.add` gave 3 here, which is the input 0 plus 1 plus 2. Choose the reducer for what the key means, and expect it to see the writes in task-path order.

## The add_messages id race

**add_messages:** the reducer of a message list. It replaces a message with the same id, removes the message that a `RemoveMessage` names, and appends the rest.

A message with no id gets a new `uuid4` inside `add_messages`. The reducer sets it on the message object itself {{code libs/langgraph/langgraph/graph/message.py:199-205}}. That happens in the update phase. By then, the loop has already passed the same object to the background `put_writes` of the checkpointer. So the saved pending write has the id only if serialization ran after the reducer.

A reply from a chat model already carries an id, which LangChain sets from the run, so the race cannot touch it. The test node returns the model reply and a second message that it builds from the reply text, with no id:

```listing
title: the node of the race test
source: capture/lab/internals/02-channels/race.py
lang: python
---
    def node(s):
        r = MODEL.invoke("Say OK.")
…
        return {"messages": [r, AIMessage(content="copied: " + r.text)]}
```

**We measured** it on the x86 server guest with Qwen3 4B, two runs of 200, on `InMemorySaver` with `durability="async"`. All 400 model replies carried an id when the node returned. The built message was saved with its id in 200 of 200 runs, both times. A control with no model, where the node returns the built message at once, gave 200 of 200 twice. The same control with a 0.6 s sleep in the node saved 4 of 200 writes without an id:

```listing
title: the control run that lost the id
source: capture/lab/internals/02-channels/race_control_sleep06.txt
lang: text
---
  {"with id": 196, "without id": 4}
```

So the race is rare, and only a message that your own code builds is exposed. When the saved write has no id, a resume reapplies it and `add_messages` gives the message a second, different id. A client that streamed the first id and later edits or removes the message by id then misses it. The loop gives stable ids only to messages in a `DeltaChannel` {{code libs/langgraph/langgraph/pregel/_messages.py:516-547}}. Set `id=str(uuid4())` on every message you build, so the reducer never has to.

```takeaways
- Give every key that two nodes can write in one superstep a reducer.
- After a LastValue conflict, deploy the reducer and resume with invoke(None), because the saved writes are reapplied.
- Use update_state only to make the thread readable, because only a reducer stops the next run from raising.
- Set an id on every message your code builds, because model replies have one and built messages do not.
```

Sources: capture/lab/internals/02-channels/trace.txt, capture/lab/internals/02-channels/run.py, capture/lab/internals/02-channels/repair.txt, capture/lab/internals/02-channels/repair.py, capture/lab/internals/02-channels/race.py, capture/lab/internals/02-channels/race_run1.txt, capture/lab/internals/02-channels/race_run2.txt, capture/lab/internals/02-channels/race_control.py, capture/lab/internals/02-channels/race_control_nodelay_run1.txt, capture/lab/internals/02-channels/race_control_nodelay_run2.txt, capture/lab/internals/02-channels/race_control_sleep06.txt, capture/lab/internals/common/instrument.py, capture/lab/internals/common/real.py; libs/langgraph/langgraph/channels/last_value.py, libs/langgraph/langgraph/channels/binop.py, libs/langgraph/langgraph/channels/ephemeral_value.py, libs/langgraph/langgraph/channels/topic.py, libs/langgraph/langgraph/channels/named_barrier_value.py, libs/langgraph/langgraph/channels/delta.py, libs/langgraph/langgraph/graph/message.py, libs/langgraph/langgraph/pregel/_messages.py, libs/langgraph/langgraph/pregel/_loop.py, libs/langgraph/langgraph/pregel/_algo.py, and libs/langgraph/langgraph/pregel/main.py at langgraph 1.2.22.
