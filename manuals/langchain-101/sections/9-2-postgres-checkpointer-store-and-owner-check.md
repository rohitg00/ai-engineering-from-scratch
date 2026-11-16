# AsyncPostgresSaver, AsyncPostgresStore, and the owner check

> Neither the checkpointer nor the store knows users, so check thread ownership in your route and take the user id from the run context, never from the model.

A second customer signs up. Their client sends a thread id that it read in a log, and asks for that thread's state. `AsyncPostgresSaver` returns it, because a checkpoint row has a thread id and nothing else that names a person. The same holds for `AsyncPostgresStore`, which keys items by a namespace that you choose.

When you finish this section, you can put the checkpointer, the store, and your own tables on one connection pool. You can add the owner check that the savers do not have, and keep each tool on the right user's rows.

## One pool for three kinds of rows

**Checkpointer:** the saver that writes the state of each thread after each step, here `AsyncPostgresSaver`. **Store:** the key-value saver for data that outlives a thread, here `AsyncPostgresStore`. The service opens one `psycopg` pool and gives it to both, and its own tables use the same pool.

```listing
title: one pool for the checkpointer, the store, and the app tables
source: capture/lab/prodapp-mac/code/app/server.py
lang: python
---
        kwargs = {"autocommit": True, "prepare_threshold": 0, "row_factory": dict_row}
        locks = await ThreadLocks.connect(settings.database_url)
        async with AsyncConnectionPool(settings.database_url, max_size=settings.pool_max, kwargs=kwargs) as pool:
            checkpointer, store = AsyncPostgresSaver(pool), AsyncPostgresStore(pool)
            async with locks.exclusive("schema-setup"):
                await checkpointer.setup()
                await store.setup()
                await db.setup(pool, set(settings.tokens.values()))
```

The three settings in `kwargs` are the ones that `from_conn_string` of each saver uses {{code libs/checkpoint-postgres/langgraph/checkpoint/postgres/aio.py:87}}. A pool that you pass in yourself must set them too: `autocommit`, `prepare_threshold=0`, and `dict_row`. 

The last setting has a cost. **We measured** it on the Mac: on a connection with `prepare_threshold=0`, `select 1; select 2` failed with `cannot insert multiple commands into a prepared statement`. Without the setting it ran. So the app creates its tables one statement at a time.

The setup runs under a Postgres advisory lock. Two workers that start together would otherwise run the same `CREATE TABLE` and index statements at once. The lock connection sits outside the pool, and [section 9.7](#s-workers-the-advisory-lock-and-cost) explains why.

## The owner check

The service keeps its own `threads` table with one row for each thread and the user who made it. Every route that names a thread depends on this function.

```listing
title: the owner check on every thread route
source: capture/lab/prodapp-mac/code/app/server.py
lang: python
---
    async def owned(thread_id: str, user_id: str = Depends(user), s: Service = Depends(svc)) -> str:
        async with s.pool.connection() as conn:
            cur = await conn.execute("select user_id from threads where thread_id = %s", (thread_id,))
            row = await cur.fetchone()
        if row is None or row["user_id"] != user_id:
            raise HTTPException(404, "thread not found")
        return thread_id
```

A thread that belongs to someone else returns 404, the same as a thread that does not exist. A 403 would tell the caller that the id is real.

The check answers who owns a thread. It does not answer who can approve a refund, so the customer who made a thread can approve its refund. A real service needs a separate approver identity. The tokens `tok-alice` and `tok-bob` in the example configuration are demo values, so set your own `AUTH_TOKENS` before you deploy.

## The user comes from the context

A tool needs the user too. The model chooses an order id, and it can choose any string. So no tool takes a user id as an argument. The service puts the user in the run context, and each tool reads it from `runtime.context`.

```listing
title: two tools that scope every query to the user in the context
source: capture/lab/prodapp-mac/code/app/tools.py
lang: python
---
async def read_order(order_id: str, runtime: ToolRuntime[Ctx]) -> str:
    """Look up one of the customer's orders by id, for example ORD-alice-1."""
    async with runtime.context.pool.connection() as conn:
        cur = await conn.execute(
            "select id, item, status, total_cents, refunded_cents from orders where id = %s and user_id = %s",
            (order_id, runtime.context.user_id),
        )
…
async def save_note(text: str, runtime: ToolRuntime[Ctx]) -> str:
    """Save a fact or preference about the customer for future conversations."""
    await runtime.store.aput(("memories", runtime.context.user_id), str(uuid.uuid4()), {"text": text})
```

**We measured** what real models do with another customer's order id, on the Mac. User `e05` asked `Where is my order ORD-alice-1?`. Qwen3 4B and Qwen3 14B each called `read_order` with `ORD-alice-1`, in 3 of 3 runs each. Claude Haiku 5.5 did the same in its one run. The query returned no row, the tool returned an error, and the item name never reached the thread state. The model did ask, and only the `user_id` filter stopped it.

## Isolation, measured

The isolation test in the suite saves a note through the model, and Qwen3 4B never called `save_note`. So that test proved nothing on 4B. We ran the isolation check again with the note written straight into the store, so that it does not depend on a tool call.

**We measured** it once on the Mac with Qwen3 4B. The script wrote `door code is 4471` into the namespace `("memories", "alice")`. Then alice made a thread, and bob used his own token on it.

| Request by bob | Result |
|---|---|
| `GET /threads/{alice's thread}/state` | 404 |
| `POST /threads/{alice's thread}/runs` | 404 |
| `POST /threads/{alice's thread}/approve` | 404 |
| `GET /memories` | `[]` |
| `What do you remember about me?` in his own thread | the model called `recall_notes`, which returned `[]` |

The same question from alice called `recall_notes`, which returned `["door code is 4471"]`. The string `4471` was nowhere in bob's thread state. The model never saw another user's namespace, because the tool built the namespace from the context.

## What one conversation writes

**We measured** the rows of the load test in [section 9.7](#s-workers-the-advisory-lock-and-cost), with Qwen3 4B. Each user had one thread with four runs: an order question, a FAQ question, a refund request, and the approval. With 10 users, each run wrote 27.2 rows to the three checkpoint tables, about 20.3 to 20.4 KB of row data. That held in all three 10-user cells. A fourth cell was run again and replaced. With 50 users it was 29.5 to 30.1 rows and 21.6 to 22.1 KB, because some runs ended early when their clients timed out.

None of those rows names a user. A request for a thread reaches its rows only through the owner check, and a tool reaches a user's rows only through the context.

```figure
id: fig-9-2
kind: structure
title: the rows of one conversation, and who can read them
claim: Checkpoint rows carry only a thread id, so the owner check in the route and the user in the tool context are the only isolation.
caption: Each box is a Postgres table or a store namespace, with its key and the rows written for each run of the load test. Ink arrows are reads. The amber bar is the owner check. From capture/lab/prodapp-mac/summary/load-mac.json and capture/lab/prodapp-mac/summary/service-mac.json.
```

```takeaways
- Give the checkpointer, the store, and your tables one pool with autocommit, dict_row, and prepare_threshold 0.
- Run saver setup under an advisory lock when several workers start at once.
- Keep a threads table with the owner, and return 404 for a thread that another user owns.
- Read the user id in tools from runtime.context, and never accept it as a tool argument.
- Put the user id in every store namespace that holds personal data.
```

Sources: capture/lab/prodapp-mac/code/app/server.py, capture/lab/prodapp-mac/code/app/tools.py, capture/lab/prodapp-mac/code/app/db.py, capture/lab/prodapp-mac/code/app/locks.py, capture/lab/prodapp-mac/summary/service-mac.json, capture/lab/prodapp-mac/summary/load-mac.json, capture/lab/prodapp-mac/summary/evals-mac.json, capture/lab/prodapp-mac/runs/service/service-properties.json, capture/lab/prodapp-mac/runs/psycopg-multistatement.txt, capture/lab/prodapp-mac/runs/summary/suite-mac.json; libs/checkpoint-postgres/langgraph/checkpoint/postgres/aio.py and libs/checkpoint-postgres/langgraph/store/postgres/aio.py at langgraph-checkpoint-postgres 3.2.1.
