# A SQL agent over a local SQLite database

> A SQL agent is safe to point at real data when the database refuses writes on the read path and every write pauses for a person, whatever the model does.

Someone asks for an agent that answers questions about the sales database. The first prototype passes the model a connection string and one tool that runs any SQL. It works in the demo. Then a user types "delete the cancelled orders", and the model writes a `DELETE`.

When you finish this section, you can build a SQL agent that reads through a read-only connection and writes only after an approval. You can also tell a model failure from a framework failure in its run.

## What the demo builds

The demo answers questions about the order book of a small bakery. The script builds the SQLite file on every run, with four tables: `customers`, `products`, `orders`, and `order_items`. The rows come from a seeded random generator, so each run starts from the same data. Nothing is downloaded.

The agent has three tools. `describe_database` returns every table with its row count, its columns, and its foreign keys, in one call. `run_select` runs one read query. `request_change` runs one write, and only after a person approves it.

The demo applies these sections:

- [Tools, ToolRuntime, and tool errors](#s-tools-toolruntime-and-tool-errors): each tool reads the database path from `runtime.context`. A failed query comes back as text, so the model can fix its SQL.
- [The system prompt](#s-the-system-prompt): the order of work for the agent.
- [Human in the loop, batched and per call](#s-human-in-the-loop-batched-and-per-call): `request_change` pauses in `per_call` mode.
- [Security](#s-security-deserialization-store-isolation-approvals-and-mcp-subprocesses): the model never holds a connection that can write.
- [The recursion limit](#s-error-handlers-node-timeouts-and-the-recursion-limit): each question runs with `recursion_limit` 25.

## The database path as context

The model never sees the path of the file. The docs present runtime context as the place for a dependency such as a database connection {{docs oss/python/langchain/runtime}}. The demo declares a dataclass `Shop` with one field, `db`, and passes it as `context_schema`. Each tool takes a `runtime: ToolRuntime[Shop]` argument, which `ToolNode` fills and leaves out of the schema that the model gets {{docs oss/python/langchain/tools}}.

```listing
title: the agent, with context and review on the write tool
source: capture/demos/sql-agent/sql_agent.py
lang: python
---
    agent = create_agent(
        model(),
        tools=[describe_database, run_select, request_change],
        system_prompt=INSTRUCTIONS,
        context_schema=Shop,
        middleware=[
            HumanInTheLoopMiddleware(
                interrupt_on={"request_change": {"allowed_decisions": ["approve", "reject"], "description": "A change to the bakery database waits for review"}},
                interrupt_mode="per_call",
            )
        ],
        checkpointer=InMemorySaver(),
    )
```

Each call to `invoke` passes the same `Shop` value, on the first request and on each resume:

```listing
title: one question, with its context
source: capture/demos/sql-agent/sql_agent.py
lang: python
---
        result = agent.invoke({"messages": [{"role": "user", "content": question}]}, config, context=shop, version="v2")
```

## The read path

`run_select` checks the SQL with `guard`, then runs it on a connection from `reader`. The connection refuses writes in three ways. The URI opens the file with `mode=ro`, and the `query_only` pragma refuses writes. An authorizer from the Python `sqlite3` module denies every action except a read.

```listing
title: the read-only connection and the guard
source: capture/demos/sql-agent/sql_agent.py
lang: python
---
def reader(path: str) -> sqlite3.Connection:
    conn = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
    conn.execute("PRAGMA query_only = ON")
    conn.set_authorizer(lambda action, *_: sqlite3.SQLITE_OK if action in READ_ACTIONS else sqlite3.SQLITE_DENY)
    return conn


def guard(sql: str) -> str:
    text = sql.strip().rstrip(";").strip()
    bare = QUOTED.sub("''", text)
    if ";" in bare:
        raise ValueError("refused: one statement per call")
    if "--" in bare or "/*" in bare:
        raise ValueError("refused: remove the SQL comments")
    if not re.match(r"(?i)(select|with)\b", bare):
        raise ValueError("refused: start with SELECT or WITH")
    word = WRITE_WORD.search(bare)
    if word:
        raise ValueError(f"refused: {word.group(0).upper()} changes data, so call request_change")
    if not TAIL_LIMIT.search(text):
        text = f"{text} LIMIT {MAX_ROWS + 1}"
    return text
```

`guard` blanks each string literal before it looks for a write keyword, so a text value such as `'delete'` is not a write. `REPLACE` counts as a write unless an opening parenthesis follows it, as in the `replace()` function. A query with no `LIMIT n`, `LIMIT n, m`, or `LIMIT n OFFSET m` at its end gets `LIMIT 26`.

The guard alone is not a defence, because a model can write SQL that the regular expressions do not expect. The read-only connection is the defence. The guard gives the model a clear message before SQLite refuses the statement. `run_select` shows at most 25 rows, and it says so in the result when it cuts more.

Before the agent runs, the script sends 13 fixed queries through `guard` and two through `reader`. The log of each run prints the result of each one:

```listing
title: the guard cases, Qwen3 8B run
source: capture/lab/sql-agent/run-8b.log
lang: text
note: Five accepted cases and one refused case are cut. The long cases are cut by the script at 90 characters.
---
== guard
  sent      SELECT name FROM products  =>  SELECT name FROM products LIMIT 26
…
  sent      SELECT 'drop table orders; delete' AS note  =>  SELECT 'drop table orders; delete' AS note LIMIT 26
…
  refused   WITH n AS (SELECT 1) REPLACE INTO products (id, name, category, price_cents) SELECT 1, ' …  =>  refused: REPLACE changes data, so call request_change
  refused   WITH old AS (SELECT id FROM orders) DELETE FROM orders WHERE id IN old  =>  refused: DELETE changes data, so call request_change
  refused   SELECT 1; DROP TABLE orders  =>  refused: one statement per call
…
  refused   DELETE FROM orders  =>  refused: start with SELECT or WITH
  refused   UPDATE products SET price_cents = 0  =>  refused: start with SELECT or WITH
  reader    DELETE FROM orders  =>  DatabaseError: not authorized
  reader    SELECT COUNT(*) FROM orders  =>  [(60,)]
```

The two `WITH` cases start like a read and still change data, so the keyword check is the step that refuses them. The `reader` lines skip the guard. SQLite itself refused the `DELETE`.

## The write path

`request_change` is an ordinary tool that opens a connection that can write. The middleware makes it safe. In `per_call` mode, each call to the tool raises its own interrupt before the tool body runs {{code libs/langchain_v1/langchain/agents/middleware/human_in_the_loop.py}}. The interrupt value carries the id of the tool call, its name, and its arguments.

The demo answers each interrupt with a scripted reviewer. It approves an `INSERT` into `products` and refuses every other change. In a real system, a person reads the statement and the reason before the resume. The interrupt needs a checkpointer, so the agent has `InMemorySaver`.

Qwen3 8B added the product after one approval:

```listing
title: the approved insert, Qwen3 8B
source: capture/lab/sql-agent/run-8b.log
lang: text
note: The result of describe_database is cut.
---
== add-product: Add a new product: Rye Loaf, category bread, price 4.50.
  tool call  describe_database({})
…
  tool call  request_change({"statement": "INSERT INTO products (name, category, price_cents) VALUES ('Rye Loaf', 'bread', 450);", "reason": "Adding a new product to  …)
  paused     approved: new products are allowed
  tool says  change applied, 1 row(s)
  final      The product "Rye Loaf" has been successfully added to the bakery's menu with the category "bread" and a price of $4.50.
  3 model calls, 1524 prompt tokens, 111 output tokens, 6.6 s
```

Qwen3 4B looked up the cancelled orders and proposed a `DELETE` of four ids. The reviewer refused it. The middleware sent the reason back to the model as the result of the call, and no row changed:

```listing
title: the refused delete, Qwen3 4B
source: capture/lab/sql-agent/run-4b.log
lang: text
note: The result of describe_database is cut.
---
== drop-cancelled: Delete all of the cancelled orders.
  tool call  describe_database({})
…
  tool call  run_select({"sql": "SELECT o.id FROM orders o WHERE o.status = 'cancelled'"})
  tool says  {"columns": ["id"], "rows": [[13], [15], [21], [32]]}
  tool call  request_change({"statement": "DELETE FROM orders WHERE id IN (13, 15, 21, 32)", "reason": "Remove all cancelled orders from the database."})
  paused     refused: only new products are allowed
  tool says  User rejected the tool call for `request_change` with reason: Refused by the reviewer. This agent can only add products.
  final      The request to delete cancelled orders was rejected because the agent can only add products, not delete or modify existing data. No changes were made to the database.
```

## The recorded run

The demo asks five questions. They ask for the tables and their row counts, the customer with the largest total on paid orders, and the orders of March 2026. Then they ask to add a product and to delete the cancelled orders. The script computes the right answers with its own SQL first. It runs once with Qwen3 4B and once with Qwen3 8B on Ollama, at temperature 0 and seed 42, with reasoning off.

**We measured** one run of each model on the Mac, Apple M1 Max, 10 cores, 64 GiB, with Ollama 0.31.1. Each model got the same five questions, so n is 5 per model. A read counts as right when the answer names the right values. A write counts as right when the database holds the right rows afterwards.

| Question | Qwen3 4B | Qwen3 8B |
|---|---|---|
| the tables and their rows | right, 2 model calls, 4.0 s | right, 2 model calls, 4.9 s |
| the top customer | right, Garden Bistro at 100550 cents, 3 calls, 2.5 s | right, the same, 3 calls, 7.8 s |
| the orders of March 2026 | right, 18, 3 calls, 1.7 s | right, 18, 3 calls, 4.0 s |
| add a product | approved, 1 row added, 4 calls, 10.4 s | approved, 1 row added, 3 calls, 6.6 s |
| delete the cancelled orders | proposed, refused, 4 kept, 4 calls, 3.3 s | proposed, refused, 4 kept, 4 calls, 8.9 s |

Both models got all five right, and each one called `describe_database` first on every question. Qwen3 4B used 9,862 prompt tokens over the five questions, and Qwen3 8B used 8,739. The most model calls on one question was 4, so no question came near the recursion limit.

## What the run shows

Read the table in two layers. The framework part held in every row. No write ran without an approval, the read connection refused a write, and the cancelled orders were still there at the end.

The rest are model results, and two of them are wrong in the text only. Qwen3 4B stored a price of 450 cents and then told the user the price was 4.50 cents. Qwen3 8B read all 60 orders before its refused `DELETE`, and got 25 rows with the note that the result was cut. Then it ended its turn with a promise of a list that it never sent. LangChain did what the code asked in each case.

```takeaways
- Open the read path with a read-only connection, and treat a keyword check as an error message only.
- Pass the database path as context, so the model never sees it.
- Put every write behind its own tool, and pause that tool with per_call review.
- Give the model one tool that describes every table, with its row count.
- Say in the tool result when you cut rows, so the model does not count a partial list.
- Check the stored rows after a write, because the reply can state a wrong value.
```

Sources: capture/demos/sql-agent/sql_agent.py, capture/demos/sql-agent/run.sh, capture/demos/sql-agent/README.md; capture/lab/sql-agent/run-4b.log, capture/lab/sql-agent/run-8b.log, capture/lab/sql-agent/run-4b.jsonl, capture/lab/sql-agent/run-8b.jsonl, capture/lab/summary/demos-mac.json; libs/langchain_v1/langchain/agents/middleware/human_in_the_loop.py and libs/langchain_v1/langchain/agents/factory.py at langchain==1.5.0; libs/prebuilt/langgraph/prebuilt/tool_node.py at langgraph 1.2.22; docs.langchain.com at docs commit 04d4d4a (oss/python/langchain/runtime, oss/python/langchain/tools, oss/python/langchain/human-in-the-loop).
