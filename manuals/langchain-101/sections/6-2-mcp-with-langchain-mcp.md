# MCP with langchain.mcp

> `MCPAdapter` turns the tools of an MCP server into LangChain tools, refuses a string that is not a URL, and lets a server crash end the run.

You find an MCP server for your issue tracker and want its tools in your agent. Every example you find imports `MultiServerMCPClient` from `langchain_mcp_adapters`. You install that package next to `langchain[mcp]`, and pip downgrades `mcp` under the new adapter.

When you finish this section, you can load MCP tools into an agent with `langchain.mcp`. You can also predict what a tool error, a slow tool, and a server crash do to a run. And you can set the timeout that the adapter lacks, and answer a server that asks for input.

## The package and its beta warning

**MCP adapter:** the class `MCPAdapter` in `langchain.mcp`. It connects to an MCP server through FastMCP and returns the tools of that server as LangChain tools.

`langchain` 1.4.0 added `langchain.mcp` in place of the archived `langchain-mcp-adapters` package {{docs oss/python/releases/changelog}}. You install it with the extra `langchain[mcp]`, which asks for `fastmcp` 4.0.11 or later. The kit resolved `fastmcp` 4.2.0 and `mcp` 2.3.0. The first import warns once per process:

```listing
title: importing langchain.mcp
source: capture/out/40-mcp.txt
lang: text
---
warning LangChainBetaWarning: `langchain.mcp` is in beta. It is actively being worked on, so the API may change.
```

The package exports three names: `MCPAdapter`, `MCPToolArtifact`, and `as_langchain_tool`. Do not install the old adapter in the same environment. `langchain-mcp-adapters` 0.3.2 requires `mcp` below 2.0 {{code langchain-mcp-adapters pyproject.toml}}, and `fastmcp` 4.2.0 needs `mcp` 2.3.0. We tried it: pip would downgrade `mcp` to 1.30.0.

## From a server to an agent

The kit builds a FastMCP server named `calc` in the same process and passes the server object to `MCPAdapter`. An in-process server needs no port and no subprocess. `list_tools()` returns one LangChain tool for each MCP tool:

```listing
title: one of the three tools from list_tools
source: capture/out/40-mcp.txt
lang: json
note: The first tool. divide and stats are cut.
---
  {
    "name": "multiply",
    "description": "Multiply two integers.",
    "args": {
      "a": {
        "type": "integer"
      },
      "b": {
        "type": "integer"
      }
    },
    "response_format": "content_and_artifact"
  },
```

Each tool has `response_format` set to `content_and_artifact`. The model sees the content, a list of text blocks. On a successful call, the structured result of the server stays in the artifact, where your code can read it and the model cannot:

```listing
title: the ToolMessage of multiply
source: capture/out/40-mcp.txt
lang: json
---
    "type": "ToolMessage",
    "content": [
      {
        "type": "text",
        "text": "42",
        "id": "lc_<uuid-2>"
      }
    ],
    "name": "multiply",
    "id": "<uuid-3>",
    "tool_call_id": "call_m",
    "status": "success",
    "artifact": {
      "structured_content": {
        "result": 42
      }
    }
```

`langchain.mcp` has no API for MCP resources or prompts. The migration guide lists both as not supported {{docs oss/python/migrate/langchain-mcp-adapters}}. The kit read a resource through `adapter.client`, which is the FastMCP client underneath, and got `calc server: multiply, divide, stats`.

## A string target must be a URL

**Target:** the first argument of `MCPAdapter`. It can be an `http` or `https` URL, a `Path` to a script, or a FastMCP transport. It can also be an in-process `FastMCP` server, an `MCPConfig` dict, or a `fastmcp.Client`.

The type of the target chooses the transport. A `Path` starts the script as a subprocess over stdio. A `str` must be an `http` or `https` URL. Any other string raises when you build the adapter:

```listing
title: a string that names a file
source: capture/out/40-mcp.txt
lang: text
---
MCPAdapter('server.py'):

raised builtins.ValueError: MCP target 'server.py' is not a valid URL. To run a local MCP server over stdio, ask for it explicitly with `Path('server.py')`, a `fastmcp` transport, or an `MCPConfig` — a bare string is read as a URL so that it cannot silently become a subprocess.
```

The check is `_validate_url_target`, which runs before the adapter builds a FastMCP client {{code libs/langchain_v1/langchain/mcp/adapter.py}}. It also refuses a `file://` URL, because its scheme is not `http` or `https`.

The MCP page of the docs warns that a string naming an existing `.py` or `.js` file would start that file as a subprocess {{docs oss/python/langchain/mcp}}. That describes `fastmcp.Client`, and the same paragraph says that `MCPAdapter` refuses such a string. Our run agrees on both points.

On the Mac, we gave `MCPAdapter` three strings for an existing server script: a relative path, an absolute path, and a `file://` URL. Each one raised `ValueError` and launched nothing. `fastmcp.Client` with the same relative path started the script. The lab script filtered warnings, so the run did not record one. So the danger is real only when you build a `fastmcp.Client` from a string yourself, and then pass it to the adapter.

A target that comes from configuration or from a model is a string. Keep it a string, and the adapter reaches it only over HTTP. To start a local server, write `Path("server.py")` in your own code.

## Errors, timeouts, and crashes

**MCP tool error:** a tool result with `isError` set to true. A FastMCP server sends it when the tool raises `ToolError` or any other exception.

The adapter turns a tool error into a `ToolMessage` with `status` `error` {{code libs/langchain_v1/langchain/mcp/tools.py}}. The model reads the text of the server, and the run goes on. In the kit, `divide` with a zero divisor raised `ToolError`:

```listing
title: a tool error becomes an error ToolMessage
source: capture/out/40-mcp.txt
lang: json
---
    "type": "ToolMessage",
    "content": [
      {
        "type": "text",
        "text": "division by zero",
        "id": "lc_<uuid-5>"
      }
    ],
    "name": "divide",
    "id": "<uuid-6>",
    "tool_call_id": "call_d",
    "status": "error"
```

A failure of the transport is different. It is not a `ToolException`, so it skips the error handling and raises out of the run. The docs say the same: a server error reaches the model, and a transport or session failure raises {{docs oss/python/langchain/mcp/tools}}. The kit cannot crash an in-process server, so we tested the other cases with a real server on the Mac.

**We measured** each failure on the Mac, Apple M1 Max, 10 cores, 64 GiB, with `langchain` 1.5.0 and `fastmcp` 4.2.0. The FastMCP server ran over stdio and over Streamable HTTP, and we ran each case once. [Figure](#fig-6-2) shows the result of each case.

```figure
id: fig-6-2
kind: decision
title: what each MCP failure does to a run
claim: A tool error becomes an error ToolMessage and the run goes on, but a slow tool has no timeout and a server crash aborts the run.
caption: Read each row from the case on the left to the result on the right. Green rows go on to the next model call, the grey row waits, and rose rows raise. From capture/lab/summary/mcp-mac.json.
```

- **A tool that raises.** `ToolError` and a plain `RuntimeError` inside the tool each became a `ToolMessage` with `status` `error`. Inside `create_agent`, the run went on to the next model call.
- **A slow tool.** `MCPAdapter` takes only the target, so it has no timeout setting {{code libs/langchain_v1/langchain/mcp/adapter.py}}. A tool that slept 2 s returned after 2.0 s. To set a limit, build `fastmcp.Client(target, timeout=1)` and pass the client to the adapter. A tool that slept 5 s then raised `MCPError: Request 'tools/call' timed out` after 1.0 s, and the next call on the same client worked.
- **A crash over stdio.** The server called `os._exit(3)` in the middle of a call. The call raised `MCPError: Connection closed` within 0.01 s, and the agent run ended with that exception. The next call started the server again, which took 1.66 s.
- **A crash over HTTP.** The direct call raised `RemoteProtocolError`. The agent run after it, and every later call, raised `RuntimeError: Client failed to connect`, because nothing starts an HTTP server again for you.

A crash ends the whole run, and the model never sees an error message. A local tool that raises ends a run the same way, as [section 2.4](#s-tools-toolruntime-and-tool-errors) shows. Wrap the agent call in your own retry when a server can die, and resume it from its checkpoint.

## The cost of a call

**We measured** 50 calls of an `add` tool on each transport on the Mac, with `langchain` 1.5.0. The raw file keeps the median and the 95th percentile of each block of 50 calls, not each call. The laptop ran other work at the same time, so read the times as upper bounds.

| Transport | Median, adapter not open | 95th percentile | Median, inside `async with adapter` | 95th percentile |
|---|---|---|---|---|
| stdio | 9.5 ms | 27.3 ms | 5.9 ms | 15.0 ms |
| Streamable HTTP | 24.7 ms | 52.5 ms | 10.7 ms | 19.6 ms |

The stdio server started once, for `list_tools`, which took 1.54 s. All later calls used the same process. Open the adapter with `async with` around the whole agent run when it makes many calls, so the session stays open between them.

The archived adapter behaves differently. We ran `langchain-mcp-adapters` 0.3.2 in a separate environment, with `mcp` 1.30.0, against the same server:

```listing
title: server launches under langchain-mcp-adapters 0.3.2
source: capture/lab/T12-mcp-mac/03-adapters-launch-count.txt
lang: text
note: The first, third, and fourth lines of the count.
---
Server launch markers in T12/_marks after the langchain-mcp-adapters 0.3.2 run: 57.
02 stdio: 1 (get_tools) + 3 single calls + 50 timed calls + crash + call after crash = 56 stdio launches, plus 1 HTTP server process = 57.
So langchain-mcp-adapters 0.3.2 starts one stdio subprocess per tool call (MultiServerMCPClient without an explicit session).
```

Each stdio call started a new server, and the median call took 1,887 ms over 50 calls. Over HTTP, a server crash in the middle of a call never returned, and our script cut it after 40 s. Older code that uses the adapter carries both behaviours. Move it to `langchain.mcp`.

## Elicitation, structured errors, and progress

**Elicitation:** a request from an MCP server for input from the user during a tool call, such as a form with one field.

`MCPAdapter` arms each client that it builds for elicitation. For a client that you pass in, it arms a copy made with `client.new()`. It leaves a client alone when that client already has its own `elicitation_handler` {{code libs/langchain_v1/langchain/mcp/adapter.py:173-187}}. When a server returns its questions as an `InputRequiredResult`, the adapter asks them with a LangGraph `interrupt()` {{code libs/langchain_v1/langchain/mcp/elicitation.py:311-364}}. So an MCP tool can pause an agent run, like the review of [section 5.4](#s-interrupt-and-resume).

**We measured** these cases on the Mac with `langchain` 1.5.0, `fastmcp` 4.2.0, `mcp` 2.3.0, and `langgraph` 1.2.22. Each case ran 3 times, each in a new process, and the 3 runs of every case gave the same result. The server ran in the same process, and five cases ran again over Streamable HTTP. The server tool `ask_name` asked for one form field, `name`. The default adapter negotiated protocol `2026-07-28`.

Inside `create_agent` with an `InMemorySaver`, the run stopped with `__interrupt__`, and the state had `next` set to `tools`. The interrupt value names the tool and each request:

```listing
title: the interrupt value of an MCP elicitation
source: capture/lab/summary/mcp-edges-mac.json
lang: json
note: The schema of the field is cut.
---
       "value": {
        "requests": [
         {
          "key": "name",
          "message": "What is your name?",
          "mode": "form",
          "requested_schema": {
…
        "tool_name": "ask_name",
        "type": "mcp_elicitation"
       }
```

You resume with a `Command` whose `responses` map the key of each request to an answer:

```listing
title: three answers to the request, and the resume
source: capture/lab/T20-mcp-edges-mac/t20_mcp.py
lang: python
---
                    action = {"accept": {"action": "accept", "content": {"name": "Ada"}}, "decline": {"action": "decline"}, "cancel": {"action": "cancel"}}
…
                    out = await agent.ainvoke(Command(resume={"responses": {"name": action[which]}}), cfg)
```

- **Accept.** The tool returned a success `ToolMessage` with the greeting, and the run ended normally, in process and over HTTP.
- **Decline and cancel.** The server received the action and chose its own answer, `no name (decline)` or `no name (cancel)`. The adapter did not end the call on a cancel.
- **The cost of a resume.** The server ran `ask_name` 3 times for one answered question. On a resume, the adapter calls the tool again from the first round {{code libs/langchain_v1/langchain/mcp/elicitation.py:318-320}}. Make a tool that asks for input ask before it does any work.
- **No checkpointer.** The stream yielded `__interrupt__`, and the run ended with no exception and nothing to resume.
- **Outside a graph.** A direct `ainvoke` of the tool raised `KeyError: '__pregel_scratchpad'`, because `interrupt()` reads the config of a running graph {{code libs/langgraph/langgraph/types.py:1030}}. That is not a `ToolException`, so it is not an error `ToolMessage`.
- **Your own handler.** A `fastmcp.Client` with an `elicitation_handler`, passed to `MCPAdapter`, answered the question itself. The handler ran once, the tool returned success, and no interrupt happened, on both protocol versions and over HTTP.
- **A legacy server.** On protocol `2025-11-25`, a server that called `ctx.elicit` got no answer from the default adapter. The tool returned an error `ToolMessage`, and the agent went on to its next model call. [Errors](#s-ref-errors) gives the text.

Two more cases raised `MCPError` out of the tool instead of returning an error `ToolMessage`. A `fastmcp.Client` with no handler, given to `as_langchain_tool` on protocol `2026-07-28`, raised `Elicitation not supported`. A legacy client with no handler, asked through `ctx.elicit`, returned an error `ToolMessage` with that text. A legacy connection to a tool that returns an `InputRequiredResult` raised too, because that result exists only at `2026-07-28`. We ran both raising cases outside an agent only. An exception that is not a `ToolException` ends an agent run, as the crash cases above show.

**Structured content on an error.** Issue langchain#40471 reports that an error result loses its `structuredContent` {{issue langchain#40471}}. Our server tool returned `is_error` with the text `quota exceeded, retry in 30 s` and a structured payload. The raw `fastmcp` result kept both. The `ToolMessage` of the adapter kept only the text:

```listing
title: one error result, through the adapter and through fastmcp
source: capture/lab/summary/mcp-edges-mac.json
lang: json
note: The first event is the ToolMessage, and the second is the raw result of fastmcp.Client.call_tool.
---
      {
       "artifact": null,
       "status": "error",
       "step": "direct",
       "text": [
        "quota exceeded, retry in 30 s"
       ],
       "type": "ToolMessage"
      },
      {
       "is_error": true,
       "step": "raw-fastmcp",
       "structured_content": {
        "code": 429,
        "retry_after": 30
       },
```

The cause is in `_convert_call_tool_result`, which raises on an error result before it builds the artifact {{code libs/langchain_v1/langchain/mcp/tools.py:168-179}}. The error handler then returns only the content blocks {{code libs/langchain_v1/langchain/mcp/tools.py:104-117}}. The same result without `is_error` kept its artifact. The loss was the same on both protocol versions and over HTTP. So a server that puts `retry_after` only in its structured content gives your code nothing to read. Ask the server to repeat it in the text.

**Progress.** A server tool reported progress three times. With the default adapter, nothing about progress reached the caller. Inside an agent, `stream_mode="custom"` yielded 0 chunks, so progress does not become a stream event. A `fastmcp.Client(target, progress_handler=...)` passed to the adapter got all 3 reports, in process, over HTTP, and inside an agent. Progress, like the timeout, needs a client that you build.

This edition did not record OAuth, URL-mode elicitation, or several input requests in one round. [Section 7.6](#s-limits-at-the-pin-and-what-comes-in-the-next-edition) lists them.

```takeaways
- Install langchain[mcp] and remove langchain-mcp-adapters from the same environment.
- Pass a URL string for a remote server and a Path for a local script.
- Pass a fastmcp.Client with a timeout, because MCPAdapter has none.
- Expect a server crash to raise out of the run, and retry the run in your own code.
- Read structured MCP results from the artifact of a successful ToolMessage, because an error result drops them.
- Give an agent with MCP tools a checkpointer, so a server that asks for input can resume.
- Pass a fastmcp.Client with a progress_handler when you need the progress of a server.
- Keep the adapter open with async with for the whole agent run.
```

Sources: capture/s_integrations.py, capture/out/40-mcp.txt; capture/lab/summary/mcp-mac.json, capture/lab/T12-mcp-mac/01-langchain-mcp.jsonl, capture/lab/T12-mcp-mac/02-langchain-mcp-adapters-0.3.2.jsonl, capture/lab/T12-mcp-mac/03-adapters-launch-count.txt, capture/lab/T12-mcp-mac/00-venv-adapters-freeze.txt; capture/lab/summary/mcp-edges-mac.json, capture/lab/T20-mcp-edges-mac/01-mcp-edges.jsonl, capture/lab/T20-mcp-edges-mac/t20_mcp.py, capture/lab/T20-mcp-edges-mac/t20_server.py; libs/langchain_v1/langchain/mcp/adapter.py, libs/langchain_v1/langchain/mcp/elicitation.py, libs/langchain_v1/langchain/mcp/tools.py, and libs/langchain_v1/pyproject.toml at langchain==1.5.0; libs/langgraph/langgraph/types.py at langgraph 1.2.22; issue langchain#40471; pyproject.toml of langchain-mcp-adapters 0.3.2 (cc0f2843); docs.langchain.com at docs commit 04d4d4a (oss/python/releases/changelog, oss/python/langchain/mcp, oss/python/langchain/mcp/tools, oss/python/migrate/langchain-mcp-adapters).
