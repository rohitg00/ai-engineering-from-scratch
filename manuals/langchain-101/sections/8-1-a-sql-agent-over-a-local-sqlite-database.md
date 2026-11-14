# A SQL agent over a local SQLite database

> A SQL agent is safe to point at real data when the database refuses writes on the read path and every write pauses for a person, whatever the model does.

Someone asks for an agent that answers questions about the sales database. The first prototype passes the model a connection string and one tool that runs any SQL. It works in the demo. Then a user types "delete the test invoices", and the model writes a `DELETE`.

When you finish this section, you can build a SQL agent that reads through a read-only connection and writes only after an approval. You can also tell a model failure from a framework failure in its run.

## What the demo builds

The demo starts from the SQL agent lab of LangChain Academy, which is MIT licensed {{academy}}. That lab connects `create_agent` to the Chinook music store database, a SQLite file of 11 tables. It reads the database through `SQLDatabase` from `langchain_community`, a package that is being sunset. The demo folder keeps the MIT notice of the lab.

We changed four things. Plain `sqlite3` replaces `SQLDatabase`. The read path is read-only in SQLite itself. Writes go through a separate tool under human review. Each write runs on a copy of the file, so the source never changes.

The demo applies these sections:

- [Tools, ToolRuntime, and tool errors](#s-tools-toolruntime-and-tool-errors): each tool returns an `Error:` text in place of a raise, so the model can fix its SQL.
- [The system prompt](#s-the-system-prompt): the rules of the agent.
- [Human in the loop, batched and per call](#s-human-in-the-loop-batched-and-per-call): `propose_write` pauses in `per_call` mode.
- [Security](#s-security-deserialization-store-isolation-approvals-and-mcp-subprocesses): the model never holds a connection that can write.
- [The recursion limit](#s-error-handlers-node-timeouts-and-the-recursion-limit): each question runs with `recursion_limit` 30.

## The read path

The read tools open the file with `mode=ro` and turn on `query_only`. A second check refuses a statement that is not a `SELECT`, holds a write keyword outside a string literal, or holds two statements. The check is the one of the lab, written again for `sqlite3`:

```listing
title: the read-only connection and the SELECT check
source: capture/demos/sql-agent/sql_agent.py
lang: python
---
def read_only():
    conn = sqlite3.connect(f"file:{DB}?mode=ro", uri=True)
    conn.execute("PRAGMA query_only = ON")
    return conn


def checked_select(sql: str) -> str:
    sql = sql.strip()
    if sql.count(";") > 1 or (sql.endswith(";") and ";" in sql[:-1]):
        raise ValueError("Error: send one statement at a time.")
    sql = sql.rstrip(";").strip()
    if not sql.lower().startswith(("select", "with")):
        raise ValueError("Error: run_query takes only SELECT statements. Use propose_write for a change.")
    if WRITE_WORDS.search(STRING_LITERAL.sub("''", sql)):
        raise ValueError("Error: the query holds a write keyword. Use propose_write for a change.")
    if not LIMIT_AT_END.search(sql):
        sql += " LIMIT 21"
    return sql
```

The keyword check alone is not a defence, because a model can write SQL that the regular expression does not expect. The read-only connection is the defence. The check gives the model a clear error message before SQLite refuses the statement.

`run_query` cuts its result at 20 rows and says so in the text. Without that line, a model that counts the rows it sees gets a wrong number. In the run below, Qwen3 8B read the line and sent a `COUNT(*)` query next.

## The write path

`propose_write` is an ordinary tool. The middleware makes it safe:

```listing
title: the agent, with review on the write tool
source: capture/demos/sql-agent/sql_agent.py
lang: python
---
    agent = create_agent(
        model(),
        tools=[list_tables, describe_table, run_query, propose_write],
        system_prompt=SYSTEM_PROMPT,
        middleware=[HumanInTheLoopMiddleware(interrupt_on={"propose_write": {"allowed_decisions": ["approve", "reject"]}}, interrupt_mode="per_call")],
        checkpointer=InMemorySaver(),
    )
```

The interrupt needs a checkpointer, so the agent has `InMemorySaver`. The demo answers each interrupt with a scripted reviewer. It approves an `INSERT` into `Genre` and rejects every other write. In a real system, a person reads the SQL and the reason before the resume.

## The recorded run

The demo asks five questions. They ask for the tables, the largest table, and the genre with the longest tracks. Then they ask to add the genre Chiptune and to delete the invoices of 2009. The script computes the right answers with its own SQL first. It runs once with Qwen3 4B and once with Qwen3 8B on Ollama, at temperature 0 and seed 42.

Qwen3 8B answered the genre question with three tool calls:

```listing
title: the genre question, Qwen3 8B
source: capture/lab/sql-agent/run-8b.log
lang: text
note: The tool results are cut.
---
== genre: Which genre has the longest tracks on average?
  call       list_tables({})
…
  call       describe_table({"table": "Track"})
…
  call       run_query({"sql": "SELECT Genre.Name, AVG(Track.Milliseconds) AS AvgLength FROM Track JOIN Genre ON Track.GenreId = Genre.GenreId GROUP BY …)
…
  answer     The genre with the longest tracks on average is "Sci Fi & Fantasy" with an average length of approximately 2,911,783 milliseconds.
  model calls 4, prompt tokens 2081, output tokens 129, 11.0 s
```

The write question paused before any SQL ran. The reviewer approved, and one row went into the copy of the database:

```listing
title: the approved write, Qwen3 8B
source: capture/lab/sql-agent/run-8b.log
lang: text
note: The read calls in the middle are cut.
---
== add-genre: Add a new genre named Chiptune.
  interrupt  propose_write({"sql": "INSERT INTO Genre (Name) VALUES ('Chiptune');", "reason": "Adding a new genre named Chiptune."})
  reviewer   approve: an INSERT into Genre is on the allow list
…
  answer     The genre "Chiptune" has been successfully added. 1 row was inserted.
```

Qwen3 4B proposed the `DELETE`, and the reviewer rejected it. The middleware sent the reason back to the model as the result of the call, and no row changed:

```listing
title: the rejected delete, Qwen3 4B
source: capture/lab/sql-agent/run-4b.log
lang: text
---
  interrupt  propose_write({"sql": "DELETE FROM Invoice WHERE strftime('%Y', InvoiceDate) = '2009'", "reason": "Delete all invoices from 2009 as  …)
  reviewer   reject: not on the allow list
```

## What the run shows

**We measured** one run of each model on the Mac, Apple M1 Max, 10 cores, 64 GiB, with Ollama 0.31.1. Each model got the same five questions, so n is 5 per model. A run counts as right when the answer names the right value or the database holds the right rows afterwards.

| Question | Qwen3 4B | Qwen3 8B |
|---|---|---|
| list the tables | right, 2 model calls | right, 2 model calls |
| the largest table | `GraphRecursionError` after 10 model calls | `GraphRecursionError` after 10 model calls |
| the longest genre | stopped with a plan and no query | right, Sci Fi & Fantasy |
| add a genre | stopped with a plan, no write proposed | approved, 1 row added |
| delete the 2009 invoices | proposed, rejected, 83 invoices kept | counted 83, stopped before a proposal |

Qwen3 4B ended the genre question with a plan in place of a query:

```listing
title: the genre question, Qwen3 4B
source: capture/lab/sql-agent/run-4b.log
lang: text
note: The tool results are cut.
---
== genre: Which genre has the longest tracks on average?
  call       list_tables({})
…
  call       describe_table({"table": "Track"})
…
  call       describe_table({"table": "Genre"})
…
  answer     To determine which genre has the longest tracks on average, I need to join the `Track` and `Genre` tables using their `GenreId` column. The average track length is calculated using the `Milliseconds` column from the `Track` table. I will now run a query to find the genre with the longest average track length.
```

Read the table in two layers. The framework part held in every row. No write ran without an approval, the read connection refused writes, and the source file still had 25 genres at the end. The recursion limit stopped both runs of the largest-table question at 30 steps.

The rest are model results. Qwen3 4B twice described its next query and then ended the turn without calling the tool. Both models described the tables one at a time for the largest-table question, and the plan needed more steps than the limit allowed. A tool that returns the row counts of all tables in one call would shorten that plan. LangChain did what the code asked in each case.

```takeaways
- Open the read path with a read-only connection, and treat a keyword check as an error message only.
- Put every write behind its own tool, and pause that tool with per_call review.
- Say in the tool result when you cut rows, so the model does not count a partial list.
- Set recursion_limit for each question, and read GraphRecursionError as a plan that needed more steps.
- Separate model failures from framework failures before you change the agent.
```

Sources: capture/demos/sql-agent/sql_agent.py, capture/demos/sql-agent/run.sh, capture/demos/sql-agent/README.md, capture/demos/sql-agent/LICENSE-langchain-academy; capture/lab/sql-agent/run-4b.log, capture/lab/sql-agent/run-8b.log, capture/lab/sql-agent/run-4b.jsonl, capture/lab/sql-agent/run-8b.jsonl, capture/lab/summary/demos-mac.json; langchain-ai/lca-langchainV1-essentials at commit ab3492d (python_local, sql_db.py, studio/sql_agent1.py, L1_fast_agent.ipynb), MIT.
