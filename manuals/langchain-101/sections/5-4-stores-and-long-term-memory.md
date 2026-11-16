# Stores and long-term memory, and namespace isolation

> A store keeps JSON items under namespaces that every thread can read, and it isolates one user from another only as well as the namespace prefix that your code builds.

A user tells your assistant that they prefer short answers. A week later they start a new conversation, which is a new thread, and the assistant has forgotten. A checkpointer keeps one thread. A fact that must outlive the thread needs a different place.

When you finish this section, you can save and search memories in a store, read them from a tool, and keep users apart by namespace.

## Items and namespaces

**Store:** an object that saves JSON items by namespace and key, shared by all threads of a graph. `InMemoryStore`, `SqliteStore`, and `PostgresStore` are stores.

**Namespace:** a tuple of strings, such as `("users", "ada", "memories")`, that groups the items of a store. Each string is a label.

**Item:** one value in a store, with its namespace, its key, and the times it was created and updated.

The long-term memory page builds memory on stores in the same way {{docs oss/python/langchain/long-term-memory}}. Import `InMemoryStore` from `langgraph.store.memory`. The stores page links the name to a class in `langchain_core.stores`, which is a different key-value store without namespaces {{docs oss/python/langgraph/stores}}. This manual records the mix-up as conflict D106.

The kit puts four items for two users and reads one back:

```listing
title: one item from the store
source: capture/out/33-store.txt
lang: json
---
get:
{
  "__type__": "Item",
  "namespace": [
    "users",
    "ada",
    "memories"
  ],
  "key": "m1",
  "value": {
    "text": "prefers short answers"
  },
  "created_at": "<time>",
  "updated_at": "<time>"
}
```

`list_namespaces()` lists the three namespaces. With `prefix=("users", "ada")` it lists only the two of `ada`. With `max_depth=2` it cuts each namespace to two labels and lists `("users", "ada")` and `("users", "grace")`.

## search is a prefix match

`search(namespace_prefix)` returns the items of every namespace that starts with the prefix. The stores page says the same: the prefix is not an exact match {{docs oss/python/langgraph/stores}}. A search for `("users", "ada")` returned the items from both `memories` and `settings`:

```listing
title: search with a two-label prefix
source: capture/out/33-store.txt
lang: json
note: The values are cut.
---
search(('users', 'ada')):
[
  [
    [
      "users",
      "ada",
      "memories"
    ],
    "m1",
…
    [
      "users",
      "ada",
      "memories"
    ],
    "m2",
…
    [
      "users",
      "ada",
      "settings"
    ],
    "theme",
```

The stores page adds that the order of the results depends on the backend {{docs oss/python/langgraph/stores}}. A `filter` matches values inside the prefix, and `delete` removes one item, so `get` returns `null` after it. [Figure](#fig-5-4) draws the tree that these calls walk.

A store with an `index` adds semantic search over the fields that you name. The kit indexed three items of `ada` with `nomic-embed-text` on Ollama, with `dims` 768. A query for `works in Pune` scored 1.0 on its own item and 0.350555 on `likes tea`. The question `Which city is Ada's office in?` names no item, and it still ranked `works in Pune` first, with 0.484968, and `likes tea` second, with 0.386065.

```figure
id: fig-5-4
kind: tree
title: the namespaces of the kit store
claim: A search for users and ada covers both namespaces under ada, and no prefix that ends at a full label reaches the items of grace.
caption: Read from the root at the top. Each box is one label, and each card under a namespace is one item, with its key and value. The shaded part is what search with the prefix users, ada returns. From capture/out/33-store.txt and capture/lab/summary/stores-mac.json.
```

## A tool reads the store

`create_agent(..., store=store)` passes the store to each tool through `ToolRuntime`. The kit tool reads the user from the run context and searches that user's namespace:

```listing
title: a tool that reads the store
source: capture/s_persist.py
lang: python
---
    @tool
    def recall(runtime: ToolRuntime) -> str:
        """Recall what is known about the current user."""
        user = runtime.context["user"]
        return "; ".join(i.value["text"] for i in runtime.store.search(("users", user, "memories")))
```

```listing
title: the same tool for two users
source: capture/out/44-store-agent.txt
lang: text
note: The answers of the model are cut.
---
user ada: tool returned ['prefers short answers']
…
user grace: tool returned ['prefers long answers']
```

Qwen3 4B called `recall` in both runs. It answered Ada with `I know you prefer short answers.`, and Grace with a long reply about her taste for long answers.

The user comes from `context`, which your code sets, and never from the model. If the model could name the user in a tool argument, it could read another user's items. Each run also warned `PydanticSerializationUnexpectedValue` for the field `context`, because the agent had no `context_schema` for the dict. The warning did not change the result.

## Namespace isolation

**We measured** isolation on the Mac, Apple M1 Max with 10 cores and 64 GiB, one run per query. The stores were `InMemoryStore`, `SqliteStore`, and `PostgresStore` on PostgreSQL 14. Eight users each had one item under `("users", <user>, "memories")`. Five of the user ids were SQL `LIKE` and SQLite `GLOB` characters: `a_ice`, `%`, `*`, `al?ce`, and `[a]lice`. For each user and store, a search with the prefix of that user returned only that user's item: 0 of 24 searches crossed users.

The same runs found four places where isolation depends on your code:

- `list_namespaces(prefix=("users", "*"))` listed the namespaces of every user in all three stores. `*` is a wildcard in `list_namespaces` and a plain character in `search`. Refuse a user id of `*` before you build a prefix with it.
- `search(())` with an empty prefix returned the items of every user: 9 in `InMemoryStore` and 8 in the other two. Never search with a prefix shorter than the user label.
- A partial label matched nothing: `("users", "ali")` did not reach `alice`. The fix for advisory GHSA-47pj-3jcm-6whg holds at the pin.
- A label with a `.` was refused with `InvalidNamespaceError` in `put` and `get`. `SqliteStore` and `PostgresStore` also refused it in `batch`. `InMemoryStore` stored `("users", "bob.x")` through `batch`, and a `GetOp` for `("users", "alice.memories")` created an empty namespace. No item crossed users.

A filter stays inside its prefix. `search(("users", "bob"), filter={"owner": "alice"})` returned nothing. Semantic search stayed inside its prefix too. With `nomic-embed-text` on Ollama, a query that matched the item of `alice` best returned only `bob` under the prefix of `bob`.

## Deep Agents memory files and the namespace factory


A deep agent reads and writes memory as files. `CompositeBackend` sends paths under `/memories/` to a `StoreBackend`, and `StoreBackend` keeps each file as one store item. The namespace of every item comes from a factory that you pass, and the agent's tools never pick it {{code libs/deepagents/deepagents/backends/store.py:98-168}}.

**StoreBackend:** a Deep Agents backend that keeps files in a LangGraph store, under a namespace that a factory returns for each run.

At the pin the factory is required. `StoreBackend(store=s)` raised `TypeError: missing 1 required keyword-only argument: 'namespace'`. The backends page still says that without a factory the legacy default reads `assistant_id`, so all users of an assistant share storage {{docs oss/python/deepagents/backends}}. That default is gone at 0.7.38, and this manual records the page as stale.

The composite examples on the same page pass `namespace=lambda _rt: ("memories",)`. That is one namespace for every user of the agent. Copy it into a service with many users, and each user's agent reads the files of all the others.

**We measured** this with a real agent. A deep agent on Qwen3 8B, on Ollama on the Mac at temperature 0, had `/memories/` on a `StoreBackend`. In each session, Alice asked it to save a locker code in `/memories/notes.md`. Then Bob, in a new thread, asked for any locker code under `/memories/`. Each session had a fresh store, and we ran 10 sessions per setup on `InMemoryStore` and on `PostgresStore`, on PostgreSQL 14. Alice's save worked in all 80 sessions.

[Figure](#fig-5-4b) shows each session:

- **The docs factory, `("memories",)`.** Bob's agent called `ls` and `read_file` and told him Alice's code, in 10 of 10 sessions on each store.
- **A factory per user, `("users", rt.context.user_id)`.** Bob's agent listed an empty folder and told him there was no code, in 10 of 10 sessions on each store.
- **The same factory, plus a `recall` tool that searches `("users",)`.** This is the naive tool from [Namespace isolation](#s-stores-and-long-term-memory): a prefix one label short. Asked about `/memories/`, the model used `ls` only, and nothing leaked in 20 sessions. Asked to use its recall tool, it called `recall` and told Bob Alice's code, in 10 of 10 sessions on each store.

```figure
id: fig-5-4b
kind: chart
title: two users, one deep agent, and where the memory file is kept
claim: A constant namespace gave Bob Alice's code in 20 of 20 sessions, and a per-user factory gave it in 0 of 20.
caption: One square per session, Qwen3 8B on the Mac, temperature 0, a fresh store per session, 10 sessions per row. Rose is a session where Bob's answer held Alice's code. From capture/lab/summary/store-namespace-mac.json.
```

The recall result is the lesson of the figure. A per-user file backend kept the users apart. One tool that searched a shorter prefix undid it, and the model used that tool as soon as a user named it. Whether a model leaks depends on the prompt, so test the data path, and not only the answers. In one more session, Bob asked the agent to "check your long-term memory" without naming `/memories/`. It called no tool and said it had no memory.

The factory reads the user from the run context, which your code sets. Give the agent a `context_schema`, and pass the user with each call:

```listing
title: a namespace factory per user
source: capture/lab/T23-sec-store-namespace-mac/code/store6_agent.py
lang: python
note: Four cuts from the run code. cfg["ns"] is the lambda of the per-user setup.
---
class Ctx:
    user_id: str
…
    "per-user": {"ns": lambda rt: ("users", rt.context.user_id), "recall": False, …},
…
    backend = CompositeBackend(default=StateBackend(), routes={"/memories/": StoreBackend(namespace=cfg["ns"])})
…
    agent = create_deep_agent(model=model, backend=backend, store=store, context_schema=Ctx, system_prompt=SYSTEM, tools=tools, checkpointer=InMemorySaver())
…
                                    context=Ctx(user_id=user), stream_mode="updates", subgraphs=True):
```

Two validators check a namespace, and they disagree. `StoreBackend` allows letters, digits, and `-_.@+:~`, and it refused `*` {{code libs/deepagents/deepagents/backends/store.py:44-87}}. The store itself refuses a `.` in any label. So a factory that returns an email address, such as `carol@acme.com`, passed the first check and failed the write with `InvalidNamespaceError`, on both stores. The docs suggest `rt.server_info.user.identity` as the label. If your identities are email addresses, map each one to a label without a period first.

We also ran the raw store calls of [Namespace isolation](#s-stores-and-long-term-memory) again, one run each on `InMemoryStore` and `PostgresStore`. With Alice and Bob under `("users", <user>, ...)`, these calls returned the items or namespaces of both users: `search(("users",))`, `search(())`, `list_namespaces()`, and `list_namespaces(prefix=("users", "*"))`. `search(("users", "*", "memories"))` returned nothing, because `*` is a wildcard in `list_namespaces` only.

## Two defects of SqliteStore

The same runs found two defects in `SqliteStore` 3.1.3. They change what a store keeps and what it embeds, and they cross no user.

- After `delete`, the item row is gone and its row in `store_vectors` stays: 2 rows before the delete and 2 after. The table declares `ON DELETE CASCADE`, and `SqliteStore` never turns on SQLite foreign keys, so the cascade does not run. This is issue #8757, open at the pin {{issue 8757}}. Search no longer returns the item.
- `SqliteStore` reads the index fields from the key `text_fields`. `InMemoryStore`, `PostgresStore`, and the docstring of `SqliteStore` use `fields` {{code libs/checkpoint-sqlite/langgraph/store/sqlite/base.py}}. With `fields=["text"]`, `SqliteStore` embedded the whole item, and its vector rows have the field `$`.

```listing
title: the vector rows left after the delete
source: capture/lab/T14-stores-mac/05-orphan-vectors.txt
lang: text
---
users.alice.memories|k1|$|3072
users.bob.memories|k1|$|3072
```

`PostgresStore` with an index needs pgvector, which our Postgres did not have. That run, and the store permissions of Agent Server, come in the next edition, as [section 8.8](#s-limits-at-the-pin-and-what-comes-in-the-next-edition) says.

```takeaways
- Use a store for facts that outlive a thread, and a checkpointer for the thread itself.
- Take the user id from context in your code, and never from a tool argument.
- Build every prefix down to the user label, and never search with an empty prefix.
- Reject a user id of * or one with a period before it becomes a label.
- Treat search results as ordered by the backend, and sort them yourself when order matters.
- Delete the vector rows yourself after a delete in SqliteStore.
- Give every StoreBackend a factory that reads the user id from the run context, never a constant.
- Scope each memory tool you write to the same full prefix as the file backend.
- Map an email id to a label without a period before it reaches a namespace.
```

Sources: capture/s_persist.py, capture/out/33-store.txt, capture/out/44-store-agent.txt; capture/lab/summary/stores-mac.json, capture/lab/T14-stores-mac/01-memory-sqlite.jsonl, capture/lab/T14-stores-mac/02-inmemory-getop-side-effect.txt, capture/lab/T14-stores-mac/03-postgres.jsonl, capture/lab/T14-stores-mac/04-index.jsonl, capture/lab/T14-stores-mac/05-orphan-vectors.txt; libs/checkpoint/langgraph/store/base/__init__.py, libs/checkpoint/langgraph/store/memory/__init__.py, libs/checkpoint-sqlite/langgraph/store/sqlite/base.py, and libs/checkpoint-postgres/langgraph/store/postgres/base.py at langgraph 1.2.22; docs.langchain.com at docs commit 04d4d4a (oss/python/langgraph/stores, oss/python/langchain/long-term-memory); GitHub issue langchain-ai/langgraph#8757 and advisories GHSA-47pj-3jcm-6whg and GHSA-6hmw-9432-67qq; capture/lab/summary/store-namespace-mac.json, capture/lab/T23-sec-store-namespace-mac/store6_free.json, capture/lab/T23-sec-store-namespace-mac/store6-agent-memory.jsonl, capture/lab/T23-sec-store-namespace-mac/store6-agent-postgres.jsonl; libs/deepagents/deepagents/backends/store.py at deepagents 0.7.38; docs.langchain.com at docs commit 04d4d4a (oss/python/deepagents/backends).
