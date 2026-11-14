# Serialization of state, and what does not round-trip

> A checkpointer stores state with msgpack, so most Python values come back as they went in, and tuples, sets of tuples, dict subclasses, and time zones come back changed.

Your node puts a `Counter` in the state and adds to it on the next step. On one thread the code works. On a resumed thread it raises, because the value that came back from the checkpoint is a plain `dict`. The state you read after a checkpoint is the state that the serializer could rebuild.

When you finish this section, you can predict which values survive a checkpoint, choose types that do, and stop a checkpoint row from running code.

## JsonPlusSerializer

**Serializer:** the object that turns state values into bytes for a checkpointer and back. The default is `JsonPlusSerializer` in `langgraph.checkpoint.serde.jsonplus`.

**Round trip:** a value written into a checkpoint and read back. A value round-trips when it comes back with the same type and an equal value.

`JsonPlusSerializer` writes most values with msgpack and tags each value with a kind, such as `msgpack`, `bytes`, or `null`. The checkpointers page says that it uses ormsgpack and JSON, and that a pickle mode is allowed when you turn it on {{docs oss/python/langgraph/checkpointers}}. Every row of the SQLite file in [section 4.2](#s-checkpointers-and-threads) had the kind `msgpack`. Known types such as messages, Pydantic models, dataclasses, and enums carry their module and class name, so the loader can build them again.

## What comes back changed

**We measured** 29 values on the Mac, Apple M1 Max with 10 cores and 64 GiB, with `langgraph-checkpoint` 4.3.2, one run each. Each value went through `dumps_typed` and `loads_typed`, then through a one-node graph on `SqliteSaver` and `get_state`. Both paths gave the same result for every value. Twenty values round-tripped:

- `str`, `int`, `float`, `bool`, `None`, `list`, and `bytes`
- a `dict` with integer keys, a `set` and a `frozenset` of integers
- `Decimal`, `UUID`, `Path`, `date`, `timedelta`, and a `datetime` in UTC
- an `Enum`, a dataclass, a Pydantic model, and an `AIMessage`

Nine came back changed or did not save. [Figure](#fig-4-6) sorts them.

```figure
id: fig-4-6
kind: decision
title: what a checkpoint gives back for nine values
claim: Tuples and sets of tuples come back as lists, dict subclasses as dicts, time zones as fixed offsets, and a plain class does not save.
caption: Each row is one value from our run. Read the value on the left, then what get_state gave back. Amber rows changed type, and the rose row raised before any checkpoint. From capture/lab/summary/serde-mac.json.
```

| Value | What came back | Same value |
|---|---|---|
| `(1, 2)` | `[1, 2]`, a `list` | no |
| `{(1, 2), (3, 4)}` | `[[1, 2], [3, 4]]`, a `list` | no |
| `frozenset({(1, 2)})` | `[[1, 2]]`, a `list` | no |
| `defaultdict(list, ...)` | a `dict` with no default | equal |
| `Counter("abca")` | a `dict` | equal |
| `OrderedDict(...)` | a `dict` | equal |
| `datetime` in `Asia/Kolkata` | the same time with a fixed `+05:30` offset | equal |
| `datetime` with `fold=1` in `America/New_York` | a fixed offset, `fold` 0 | no |
| an instance of a plain class | `TypeError: Type is not msgpack serializable: Plain` | not saved |

A set of tuples failed to rebuild, and the loader gave back its raw data with a log line:

```listing
title: the log lines of the round trip
source: capture/lab/T13-serde-mac/04-round-trip-log.txt
lang: text
note: The lines for Point and Card are cut.
---
Could not reconstruct builtins.set from checkpoint (TypeError); returning its serialized data instead.
Could not reconstruct builtins.frozenset from checkpoint (TypeError); returning its serialized data instead.
Deserializing unregistered type __main__.Color from checkpoint. This will be blocked in a future version. Set LANGGRAPH_STRICT_MSGPACK=true to block now, or add to allowed_msgpack_modules to allow explicitly: [('__main__', 'Color')]
…
```

Three open issues report these cases. Issue #8388 reports that a set of tuples comes back as `None` {{issue 8388}}. At the pin it came back as a list of lists. Issue #8184 reports the dict subclasses, and issue #8826 reports the time zone and `fold` {{issue 8184}} {{issue 8826}}. Both reproduce at the pin.

A `ZoneInfo` time that comes back as a fixed offset still compares equal. After the next change of daylight saving time, its local time is wrong.

Keep the state in types that round-trip. Store a time as a UTC `datetime` and the zone name as a string. Store a `Counter` or a `defaultdict` as a `dict` and rebuild it in the node. Use lists in place of tuples, and lists of lists in place of sets of tuples. Give a custom class a Pydantic model or a dataclass.

## Your own types and strict msgpack

The log above has a second warning. An enum, a dataclass, or a Pydantic model from your own module is an unregistered type. The loader builds it and warns that a future version will block it. With `LANGGRAPH_STRICT_MSGPACK=true`, the loader blocks it now and gives back the raw fields. The warning names the fix: list your module and class in `allowed_msgpack_modules` of `JsonPlusSerializer`.

The same rule protects you from a changed checkpoint row. A row names a module and a class, and the loader imports and builds that class.

**We measured** what the loaders accept on the Mac, one run per case. A lab class wrote a marker file when it was built. With the default settings, 5 of 26 cases built the class. Two were the opt-in options `allowed_json_modules=True` and `pickle_fallback=True`, and two were msgpack values that named the lab class. The fifth was a `SqliteSaver` checkpoint row that we edited to name the class, and `get_state` built it. With `LANGGRAPH_STRICT_MSGPACK=true`, only the two opt-in cases built the class, and the edited row came back as a plain dict.

So at the pin, anyone who can write a checkpoint row can make your process import and build a class of their choice. The `JsonPlusSerializer` docstring warns of this {{code libs/checkpoint/langgraph/checkpoint/serde/jsonplus.py}}. Set `LANGGRAPH_STRICT_MSGPACK=true`, register your modules, and give write access to the checkpoint database only to the service that runs the graph. [Section 7.3](#s-security-deserialization-store-isolation-approvals-and-mcp-subprocesses) covers `load()` and the advisories behind these cases.

`PostgresSaver` uses the same serializer, and we did not run it. `EncryptedSerializer` and issue #8938, on plaintext rows that it accepts, come in the next edition, as [section 7.6](#s-limits-at-the-pin-and-what-comes-in-the-next-edition) says.

```takeaways
- Keep state in types that round-trip: dicts, lists, strings, numbers, models, and dataclasses.
- Store times in UTC with the zone name as a separate string.
- Convert tuples, sets of tuples, and dict subclasses before they enter the state.
- Set LANGGRAPH_STRICT_MSGPACK=true and list your modules in allowed_msgpack_modules.
- Restrict who can write to the checkpoint database, because a row names the class that loads.
```

Sources: capture/out/29-checkpoint-sqlite.txt; capture/lab/summary/serde-mac.json, capture/lab/T13-serde-mac/01-serde-default.jsonl, capture/lab/T13-serde-mac/02-serde-strict-msgpack.jsonl, capture/lab/T13-serde-mac/03-round-trip.jsonl, capture/lab/T13-serde-mac/04-round-trip-log.txt, capture/lab/T13-serde-mac/t13_roundtrip.py; libs/checkpoint/langgraph/checkpoint/serde/jsonplus.py and libs/checkpoint/langgraph/checkpoint/serde/_msgpack.py at langgraph 1.2.22; docs.langchain.com at docs commit 04d4d4a (oss/python/langgraph/checkpointers); GitHub issues langchain-ai/langgraph#8388, #8184, #8826, #8938, and advisories GHSA-g48c-2wqr-h844 and GHSA-fjqc-hq36-qh5p.
