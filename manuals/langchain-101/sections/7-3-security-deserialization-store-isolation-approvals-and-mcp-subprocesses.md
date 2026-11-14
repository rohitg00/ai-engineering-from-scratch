# Security: deserialization, store isolation, approvals, and MCP subprocesses

> At the pin, the fixed advisories hold, and the open risks sit in defaults you must change: msgpack checkpoints, store prefixes, batched approvals, tracing, and subprocesses.

You take an agent from a laptop to a service that many users reach. The checkpoint database now has other writers, the store holds memories of many users, and a reviewer approves tool calls. Each of those is a place where input you did not write reaches code that trusts it.

When you finish this section, you can name each place where input crosses into code, and say what the stack does there by default. You can also set the option that closes it. The checklist at the end puts the settings in one place.

## Four defaults to change

[Figure](#fig-7-3) shows four boundaries where our test input passed the default, with the change that stopped it. MCP is a fifth boundary, and there the default refused our input.

```figure
id: fig-7-3
kind: decision
title: where input crosses into code, by default and with the setting
claim: At four boundaries our test input passed the default, and one change stopped it: three settings, and a check in your code for the store prefix.
caption: Read each row from the input at the left, through the default result in rose, to the setting and its result. Every result is a recorded run on the Mac. From capture/lab/summary/serde-mac.json, capture/lab/summary/stores-mac.json, capture/lab/summary/approvals-mac.json, and capture/lab/summary/tracing-mac.json.
```

## Checkpoint rows and load

A checkpoint row names a type, and the loader builds that type. So whoever can write a row can choose what your process builds when it reads the thread. [Section 4.6](#s-serialization-of-state-and-what-does-not-round-trip) shows what the loader gives back for plain values.

Two loaders matter. `load` and `loads` in `langchain_core.load` read the LangChain serialization format of `dumps`. `JsonPlusSerializer` in `langgraph-checkpoint` reads checkpoint rows, in its `json`, `msgpack`, and `pickle` forms {{code libs/checkpoint/langgraph/checkpoint/serde/jsonplus.py}}.

**We measured** 26 cases against both loaders on the Mac, one run each. A lab class wrote a marker file when it was built, and a dummy variable stood for a secret. Three advisories were fixed at the pin:

- **GHSA-c67j-w6g6-q2cm.** `dumps` escapes a user dict that has the shape of a secret, so a round trip does not read the variable.
- **GHSA-pjwx-r37v-7724.** `loads` allows only core classes by default. A payload for `ChatOpenAI`, `os.system`, or the lab class raised `ValueError`, and a Jinja2 template was refused even with `allowed_objects="all"`.
- **GHSA-fjqc-hq36-qh5p.** A `json` checkpoint value that names a constructor came back as a plain dict.

```listing
title: loads refuses a partner class by default
source: capture/lab/T13-serde-mac/01-serde-default.jsonl
lang: text
note: One row, cut after the start of the message.
---
{"advisory": "GHSA-pjwx-r37v-7724", "case": "loads(ChatOpenAI constructor), defaults (allowed_objects=None -> 'core')", "strict_msgpack_env": false, "raised": "ValueError: Deserialization of ('langchain', 'chat_models', 'openai', 'ChatOpenAI') is not allowed. …
```

One path is still open by default. A `msgpack` value with a constructor extension built the lab class, with only a log warning. The same happened end to end: we edited a `SqliteSaver` row to name the class, and `get_state` built it. With `LANGGRAPH_STRICT_MSGPACK=true`, the loader gave back the raw fields:

```listing
title: the edited SqliteSaver row, by default and with strict msgpack
source: capture/lab/summary/serde-mac.json
lang: json
note: The same case from the two runs.
---
   "advisory": "GHSA-g48c-2wqr-h844 / fjqc",
   "case": "SqliteSaver: checkpoint row edited to hold a msgpack Marker, then get_state",
   "ran_code": true,
…
   "advisory": "GHSA-g48c-2wqr-h844 / fjqc",
   "case": "SqliteSaver: checkpoint row edited to hold a msgpack Marker, then get_state",
   "ran_code": false,
```

Three options turn a safe default into a risk, each by your choice. `allowed_json_modules=True` and `pickle_fallback=True` on `JsonPlusSerializer` each built the lab class. `secrets_from_env=True` on `loads` read the variable that a crafted payload named. So never pass `secrets_from_env=True` for input you did not write, and use `secrets_map` with the keys you expect.

## Store isolation

A store keeps the memories of every user in one database, apart only by namespace. [Section 4.4](#s-stores-and-long-term-memory) gives the run in full. **We measured** eight user ids on `InMemoryStore`, `SqliteStore`, and `PostgresStore` on the Mac, one run per query. No search with the prefix of one user returned an item of another user, in 24 of 24 searches. The fixes for GHSA-47pj-3jcm-6whg and GHSA-6hmw-9432-67qq held.

The same runs found the places where isolation depends on your code:

- `list_namespaces(prefix=("users", "*"))` listed every user, because `*` is a wildcard there.
- `search(())` with an empty prefix returned the items of every user.
- After a `delete` in `SqliteStore`, the vector row of the item stayed, which is issue #8757 {{issue 8757}}. A deleted memory keeps its embedding in the file.
- `SqliteStore` reads the index key `text_fields`, and the other stores read `fields`. With `fields`, `SqliteStore` embedded the whole item, including fields you meant to leave out of the index.

The store permissions of Agent Server had advisory GHSA-4hm6-w6qq-w73v, for JS custom auth in `langgraph-api` before 0.15.0. The pin is 0.18.0. We did not test them, and they come in the next edition.

## Approvals

`HumanInTheLoopMiddleware` is the control that keeps a person between the model and a tool with side effects. [Section 5.5](#s-human-in-the-loop-batched-and-per-call) gives the lab runs, 3 runs per case on the Mac. In batched mode, two of them let a tool run that no approval allowed:

- An edit of `send_email` into a call of `delete_file` ran `delete_file`. Per-call mode refused the same edit with a `ValidationError`.
- A middleware that returns `jump_to="tools"` from `after_model` skipped the review, or ran a call after the reviewer rejected it. This is issue #40492 {{issue langchain#40492}}. Per-call mode kept the review in both orders.

Deep Agents had two approval advisories in the window. GHSA-47w2-rfrr-wvq8 let file rules and approvals be bypassed through other paths, in `deepagents` before 0.7.25, and the pin is 0.7.38. GHSA-459r-276m-w72x is in `deepagents-acp`, which the pin does not install.

`ShellToolMiddleware` with no `execution_policy` runs commands with `HostExecutionPolicy`, on your machine and with your rights {{code libs/langchain_v1/langchain/agents/middleware/shell_tool.py}}. An approval is then the only control between the model and your shell. Use `DockerExecutionPolicy` for any agent that reads input from someone else.

## MCP subprocesses

A stdio MCP server is a program that your process starts, with your user and your rights. [Section 6.2](#s-mcp-with-langchain-mcp) gives the runs. At the pin, `MCPAdapter` starts a subprocess only for a `Path`, a `fastmcp` transport, or an `MCPConfig`. A string that names a file raised `ValueError` and launched nothing:

```listing
title: a string target is not a subprocess
source: capture/out/40-mcp.txt
lang: text
---
raised builtins.ValueError: MCP target 'server.py' is not a valid URL. To run a local MCP server over stdio, ask for it explicitly with `Path('server.py')`, a `fastmcp` transport, or an `MCPConfig` — a bare string is read as a URL so that it cannot silently become a subprocess.
```

The risk comes back in two places. A `fastmcp.Client` built from the same string started the script, on the Mac. `langchain-mcp-adapters` 0.3.2 started a new server for each tool call. So take the command of an MCP server from your own config, never from a model, a user, or a request.

## Traces that leave the machine

A trace holds the inputs and outputs of every model call and tool call, so it holds what your users typed. [Section 6.4](#s-langsmith-tracing) shows that `tracing_context(enabled="local")` keeps `traceable` runs local and sends LangChain runs. On the Mac, with no `LANGSMITH_*` variable at all, an agent inside `"local"` tried to send its runs to `api.smith.langchain.com`. [Section 6.5](#s-evaluation-with-langsmith) shows the same for an agent target of `evaluate` with `upload_results=False`.

`tracing_context(enabled=False)` around LangChain code sent nothing, and `collect_runs` kept the runs in memory. Under `evaluate` with the default client, the same wrap stopped the runs, but one `GET /info` still went to the default host. The pytest plugin, with tracking on by default, also contacted that host with no variable set. Advisory GHSA-f4xh-w4cj-qxq8 was a file read through the tracing middleware of `langsmith` before 0.8.18. The pin is 0.14.17.

## The advisories at the pin

GitHub lists these advisories for the Python packages from June 2026 to the pin, with older ones that explain the serialization model. The last column says if our runs tested the fix, or if only the version is outside the range.

| Advisory | Package and affected range | Pin | At the pin |
|---|---|---|---|
| GHSA-c67j-w6g6-q2cm, secret extraction through `dumps` and `loads` | `langchain-core` before 1.2.5 | 1.8.0 | fixed, tested |
| GHSA-pjwx-r37v-7724, broad `load` allowlists | `langchain-core` 1.0.0 to 1.3.2 | 1.8.0 | fixed, tested |
| GHSA-6qv9-48xg-fc7f, attribute access in prompt templates | `langchain-core` 1.0.6 and earlier | 1.8.0 | fixed, tested |
| GHSA-fjqc-hq36-qh5p, JSON constructors in checkpoints | `langgraph-checkpoint` before 4.1.1 | 4.3.2 | fixed, tested |
| GHSA-g48c-2wqr-h844, unsafe msgpack | `langgraph` 1.0.9 and earlier | 1.2.22 | the constructor path is open by default, tested |
| GHSA-47pj-3jcm-6whg, prefixes across segments | `langgraph-checkpoint-postgres` and `-sqlite` before 3.1.1 | 3.2.1, 3.1.3 | fixed, tested |
| GHSA-6hmw-9432-67qq, labels with a period | `-postgres` before 3.1.3, `-sqlite` before 3.1.2 | 3.2.1, 3.1.3 | fixed, tested |
| GHSA-gr75-jv2w-4656, path traversal in file search | `langchain` 1.3.8 and earlier | 1.5.0 | version outside the range |
| GHSA-47w2-rfrr-wvq8, file and approval rules | `deepagents` 0.5.2 to before 0.7.25 | 0.7.38 | version outside the range |
| GHSA-f4xh-w4cj-qxq8, file read in tracing middleware | `langsmith` before 0.8.18 | 0.14.17 | version outside the range |
| GHSA-3fx2-cqw9-xr3c, identifiers in SDK v3 streaming | `langgraph` 1.2.3 to before 1.2.14 | 1.2.22 | version outside the range |
| GHSA-fvww-7h3r-vfhp, custom auth ignores `actions=` | `langgraph-sdk` 0.4.3 and earlier | 0.4.14 | version outside the range |
| GHSA-4hm6-w6qq-w73v, JS custom auth and the store | `langgraph-api` before 0.15.0 | 0.18.0 | version outside the range |
| GHSA-8prr-f582-jqq3, push token in `deploy --verbose` | `langgraph-cli` 0.4.15 to 0.4.31 | 0.4.43 | version outside the range |

The pattern repeats across three repositories. The loaders of checkpoints and of `load` are the most frequent source of code execution, and store isolation had two defects in three months. Pin your packages with a lockfile, and read the advisories of each package before an upgrade.

## The checklist

1. Set `LANGGRAPH_STRICT_MSGPACK=true`, and list your own types in `allowed_msgpack_modules`.
2. Give write access to the checkpoint database only to the service that runs the graph.
3. Keep `pickle_fallback`, `allowed_json_modules=True`, `allowed_objects="all"`, and `secrets_from_env=True` off for any data you did not write.
4. Take the user id for a store prefix from your own code, refuse `*` and `.`, and never search with an empty prefix.
5. Delete the vector rows yourself after a delete in `SqliteStore`, and use the key `text_fields` there.
6. Set `interrupt_mode="per_call"` on every agent with review, and add no middleware that jumps to `tools`.
7. Run the shell tool with `DockerExecutionPolicy`, never `HostExecutionPolicy`, when input comes from someone else.
8. Build MCP servers from `Path` objects in your config, and never from a string a model or a user gave.
9. Wrap LangChain code in `tracing_context(enabled=False)` when its data must not leave the machine. Pass your own client to `evaluate`, and set `LANGSMITH_TEST_TRACKING=false` for tests.
10. Install from a lockfile, and check the advisories of each package before you raise a version.

```takeaways
- Set LANGGRAPH_STRICT_MSGPACK=true in every process that reads checkpoints.
- Build every store prefix from a trusted user id, and refuse * and periods in it.
- Use per-call approvals, and keep jumping middleware out of agents with review.
- Turn tracing off around LangChain code whose data must stay on the machine.
- Start MCP servers only from Path objects in your own config.
```

Sources: capture/lab/summary/serde-mac.json, capture/lab/T13-serde-mac/01-serde-default.jsonl, capture/lab/T13-serde-mac/02-serde-strict-msgpack.jsonl; capture/lab/summary/stores-mac.json, capture/lab/T14-stores-mac/01-memory-sqlite.jsonl, capture/lab/T14-stores-mac/03-postgres.jsonl, capture/lab/T14-stores-mac/05-orphan-vectors.txt; capture/lab/summary/approvals-mac.json; capture/lab/summary/mcp-mac.json, capture/out/40-mcp.txt; capture/lab/summary/tracing-mac.json, capture/lab/summary/evaluate-mac.json, capture/lab/summary/pytest-plugin-mac.json; libs/checkpoint/langgraph/checkpoint/serde/jsonplus.py at langgraph 1.2.22; libs/core/langchain_core/load/load.py and libs/langchain_v1/langchain/agents/middleware/shell_tool.py at langchain==1.5.0; GitHub issues langchain-ai/langgraph#8757 and langchain-ai/langchain#40492; the GitHub advisories GHSA-c67j-w6g6-q2cm, GHSA-pjwx-r37v-7724, GHSA-6qv9-48xg-fc7f, GHSA-fjqc-hq36-qh5p, GHSA-g48c-2wqr-h844, GHSA-47pj-3jcm-6whg, GHSA-6hmw-9432-67qq, GHSA-gr75-jv2w-4656, GHSA-47w2-rfrr-wvq8, GHSA-459r-276m-w72x, GHSA-f4xh-w4cj-qxq8, GHSA-3fx2-cqw9-xr3c, GHSA-fvww-7h3r-vfhp, GHSA-4hm6-w6qq-w73v, and GHSA-8prr-f582-jqq3.
