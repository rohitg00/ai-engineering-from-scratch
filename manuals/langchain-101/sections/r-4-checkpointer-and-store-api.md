# Checkpointer and store API

> A checkpointer saves one thread step by step under `thread_id`, a store saves JSON items by namespace across threads, and each has three backends at the pin.

The classes are in `langgraph-checkpoint` 4.3.2, `langgraph-checkpoint-sqlite` 3.1.3, and `langgraph-checkpoint-postgres` 3.2.1, from the `langgraph` repository at 1.2.22. A path below starts at `libs/` of that repository. [Section 4.2](#s-checkpointers-and-threads) runs the checkpointers, and [section 4.4](#s-stores-and-long-term-memory) runs the stores.

## The checkpointers

| Class | Import | Line | Notes |
|---|---|---|---|
| `InMemorySaver` | `langgraph.checkpoint.memory` | `checkpoint/.../memory/__init__.py:34` | in one process only. `MemorySaver` is the old name of the same class, at line 634 |
| `SqliteSaver` | `langgraph.checkpoint.sqlite` | `checkpoint-sqlite/.../sqlite/__init__.py:49` | `from_conn_string` at line 104, `setup` at line 134 |
| `AsyncSqliteSaver` | `langgraph.checkpoint.sqlite.aio` | `checkpoint-sqlite/.../sqlite/aio.py:49` | `setup` at line 317 |
| `PostgresSaver` | `langgraph.checkpoint.postgres` | `checkpoint-postgres/.../postgres/__init__.py:45` | `from_conn_string` at line 69, `setup` at line 90 |
| `AsyncPostgresSaver` | `langgraph.checkpoint.postgres.aio` | `checkpoint-postgres/.../postgres/aio.py:45` | `setup` at line 95 |

{{code checkpoint/langgraph/checkpoint/memory/__init__.py:34}} {{code checkpoint-sqlite/langgraph/checkpoint/sqlite/__init__.py:49-134}} {{code checkpoint-postgres/langgraph/checkpoint/postgres/__init__.py:45-90}}

Each class is a subclass of `BaseCheckpointSaver` {{code checkpoint/langgraph/checkpoint/base/__init__.py:199}}. Each method has an async twin with an `a` in front of its name.

| Method | What it does | Line |
|---|---|---|
| `get_tuple(config)` | returns the `CheckpointTuple` that the config names, or the latest one of the thread | 262 |
| `list(config, ...)` | returns the checkpoints of a thread, newest first | 277 |
| `put(config, checkpoint, metadata, new_versions)` | saves one checkpoint | 301 |
| `put_writes(config, writes, task_id)` | saves the pending writes of one task | 324 |
| `delete_thread(thread_id)` | deletes every checkpoint and write of a thread | 344 |
| `get_next_version(current, channel)` | returns the next version of a channel | 721 |

## Tables on disk

`setup()` creates the tables. Call it once before the first run on a new database.

| Saver | Tables |
|---|---|
| `SqliteSaver` | `checkpoints`, `writes` {{code checkpoint-sqlite/langgraph/checkpoint/sqlite/__init__.py:147-157}} |
| `PostgresSaver` | `checkpoint_migrations`, `checkpoints`, `checkpoint_blobs`, `checkpoint_writes` {{code checkpoint-postgres/langgraph/checkpoint/postgres/base.py:47-69}} |

## Records

| Type | Fields | Line |
|---|---|---|
| `CheckpointTuple` | `config`, `checkpoint`, `metadata`, `parent_config`, `pending_writes` | `base/__init__.py:140` |
| `Checkpoint` | `v`, `id`, `ts`, `channel_values`, `channel_versions`, `versions_seen`, `updated_channels` | `base/__init__.py:93` |
| `CheckpointMetadata` | `source`, `step`, `parents` | `base/__init__.py:39` |
| `StateSnapshot` | `values`, `next`, `config`, `metadata`, `created_at`, `parent_config`, `tasks`, `interrupts` | `langgraph/langgraph/types.py:721` |

{{code checkpoint/langgraph/checkpoint/base/__init__.py:39-150}} {{code langgraph/langgraph/types.py:721-746}}

`source` is `input`, `loop`, `update`, or `fork`. `step` is `-1` for the input checkpoint and `0` for the first checkpoint of the loop. Capture `30-state-history-forks.txt` shows `input`, `loop`, and `update`, and the lab replay of [section 5.6](#s-time-travel-replay-update-state-and-forks) shows `fork`.

## Config keys of a thread

| Key in `configurable` | Meaning |
|---|---|
| `thread_id` | the thread. A new value starts a new thread on the first checkpoint |
| `checkpoint_id` | one checkpoint of the thread, for a replay or a fork |
| `checkpoint_ns` | the namespace of a subgraph. The empty string is the top graph |

A graph with a checkpointer raises `ValueError` when the run config has no `configurable` entries at all {{code langgraph/langgraph/pregel/main.py:2701-2705}}. A `configurable` with other keys passes that check and fails later, such as with `KeyError: 'checkpoint_ns'`. The [errors reference](#s-ref-errors) has the text.

## State methods of a compiled graph

| Method | What it does | Line in `pregel/main.py` |
|---|---|---|
| `get_state(config)` | returns a `StateSnapshot` of the latest or the named checkpoint | 1479 |
| `get_state_history(config)` | yields the snapshots of a thread, newest first | 1529 |
| `update_state(config, values, as_node=None)` | writes a new checkpoint as if a node had returned `values` | 2636 |
| `bulk_update_state(config, supersteps)` | writes several updates in order | 1634 |

{{code langgraph/langgraph/pregel/main.py:1479-2636}}

## Durability

`Durability` is `sync`, `async`, or `exit` {{code langgraph/langgraph/types.py:99}}. The default is `async` {{code langgraph/langgraph/pregel/main.py:2715}}. The old argument `checkpoint_during` still works with a warning: `True` maps to `async` and `False` to `exit` {{code langgraph/langgraph/pregel/main.py:2837-2847}}. [Section 4.3](#s-durability-modes-and-a-crash-between-two-steps) gives what each mode saves before a crash.

## Checkpointers of a subgraph

The `checkpointer` argument of `compile` takes `None`, `True`, `False`, or a saver {{code langgraph/langgraph/types.py:110}}. `None` inherits the saver of the parent, `True` keeps the state of the subgraph across calls, and `False` turns checkpoints off. [Section 5.7](#s-subgraphs-and-multi-agent-patterns) describes the three.

## The stores

| Class | Import | Line | Notes |
|---|---|---|---|
| `InMemoryStore` | `langgraph.store.memory` | `checkpoint/.../store/memory/__init__.py:136` | `index=None` at line 183 |
| `SqliteStore` | `langgraph.store.sqlite` | `checkpoint-sqlite/.../store/sqlite/base.py:789` | `from_conn_string` at line 1014, `setup` at line 1064 |
| `PostgresStore` | `langgraph.store.postgres` | `checkpoint-postgres/.../store/postgres/base.py:668` | `from_conn_string` at line 784, `setup` at line 1121. An index needs pgvector |

{{code checkpoint/langgraph/store/memory/__init__.py:136-183}} {{code checkpoint-sqlite/langgraph/store/sqlite/base.py:789-1064}} {{code checkpoint-postgres/langgraph/store/postgres/base.py:668-1121}}

`InMemoryStore` in `langchain_core.stores` is another class, a key-value store without namespaces. The register records the docs link to it as D106.

Each store is a subclass of `BaseStore` {{code checkpoint/langgraph/store/base/__init__.py:708}}. Each method has an async twin with an `a` in front of its name.

| Method | Parameters and defaults | Line |
|---|---|---|
| `get` | `namespace`, `key`, `refresh_ttl=None` | 756 |
| `search` | `namespace_prefix`, then `query=None`, `filter=None`, `limit=10`, `offset=0`, `refresh_ttl=None` | 784 |
| `put` | `namespace`, `key`, `value`, `index=None`, `ttl` | 866 |
| `delete` | `namespace`, `key` | 952 |
| `list_namespaces` | `prefix=None`, `suffix=None`, `max_depth=None`, `limit=100`, `offset=0` | 966 |
| `batch` | a list of operations | 733 |

{{code checkpoint/langgraph/store/base/__init__.py:733-980}}

An `Item` has `value`, `key`, `namespace`, `created_at`, and `updated_at`. A `SearchItem` adds `score` {{code checkpoint/langgraph/store/base/__init__.py:51-151}}. `IndexConfig` sets the embedding, its size, and the fields to embed, and `TTLConfig` sets the expiry {{code checkpoint/langgraph/store/base/__init__.py:545-578}}.

A label of a namespace cannot be empty, and it cannot hold a period or a NUL byte. Each case raises `InvalidNamespaceError` {{code checkpoint/langgraph/store/base/__init__.py:1317-1341}}.

| Store | Tables |
|---|---|
| `SqliteStore` | `store`, `store_vectors`, `store_migrations`, `vector_migrations` {{code checkpoint-sqlite/langgraph/store/sqlite/base.py:44-1106}} |
| `PostgresStore` | `store`, `store_vectors`, and its migration tables {{code checkpoint-postgres/langgraph/store/postgres/base.py:66-1132}} |

## The serializer

Both savers use `JsonPlusSerializer` by default {{code checkpoint/langgraph/checkpoint/serde/jsonplus.py:104}}. `EncryptedSerializer` wraps it with AES and reads its key from `LANGGRAPH_AES_KEY` {{code checkpoint/langgraph/checkpoint/serde/encrypted.py:54-59}}. [Section 4.6](#s-serialization-of-state-and-what-does-not-round-trip) shows which values come back changed.

Sources: libs/checkpoint/langgraph/checkpoint/base/__init__.py, libs/checkpoint/langgraph/checkpoint/memory/__init__.py, libs/checkpoint/langgraph/store/base/__init__.py, libs/checkpoint/langgraph/store/memory/__init__.py, libs/checkpoint/langgraph/checkpoint/serde/jsonplus.py, libs/checkpoint/langgraph/checkpoint/serde/encrypted.py, libs/checkpoint-sqlite/langgraph/checkpoint/sqlite/__init__.py, libs/checkpoint-sqlite/langgraph/checkpoint/sqlite/aio.py, libs/checkpoint-sqlite/langgraph/store/sqlite/base.py, libs/checkpoint-postgres/langgraph/checkpoint/postgres/__init__.py, libs/checkpoint-postgres/langgraph/checkpoint/postgres/aio.py, libs/checkpoint-postgres/langgraph/checkpoint/postgres/base.py, libs/checkpoint-postgres/langgraph/store/postgres/base.py, libs/langgraph/langgraph/types.py, and libs/langgraph/langgraph/pregel/main.py at langgraph 1.2.22; capture/out/28-checkpoint-memory.txt, capture/out/29-checkpoint-sqlite.txt, capture/out/30-state-history-forks.txt, capture/out/33-store.txt.
