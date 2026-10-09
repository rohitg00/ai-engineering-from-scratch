# toolsets and mcps

> A toolset is one `type` from a fixed list of 27 that gives an agent tools, and `mcp` reaches a server by Docker reference, command, or URL.

Your agent answers questions about a repository from memory, and you suspect it never received a file tool. The agent file says `filesystem`, but the model sees tool names, not toolsets.

When you finish this section, you can list the tools an agent gives its model, call one without a model, and choose an MCP form.

## The 27 types

**Toolset:** one entry under an agent's `toolsets`, with a `type` and options, that the runtime turns into one or more tools. `docker-agent toolsets` prints 27 types, and the schema `Toolset` enum has the same 27 {{schema Toolset}}.

```listing
title: six of the 27 toolset types
source: capture/out/16-toolsets.txt
lang: text
note: Cut to the header and six rows. The other 21 types are listed in the toolsets reference table.
---
$ docker-agent toolsets
TYPE                SUMMARY
…
background_agents   Dispatch work to sub-agents concurrently and collect results
…
filesystem          Read, write, list, search, and navigate files and directories
…
mcp                 Extend agents with external tools via the Model Context Protocol
mcp_catalog         Discover and activate remote MCP servers from the Docker MCP Catalog
…
plan                Shared persistent scratchpad for multi-agent collaboration
…
shell               Execute shell commands in the user's environment
…
[exit 0]
```

`transfer_task` and `handoff` are not types. The docs built-in table lists both, the schema enum and the CLI list leave them out, and `sub_agents` and `handoffs` inject them ([conflict C56](#s-ref-sources-and-the-conflicts-register)). The same docs table lists `session_plan`, which the CLI does not print, and leaves out `environment` and `file` {{docs-agent Tool Configuration}}. [The toolsets table](#s-ref-toolsets) follows the CLI.

## From toolsets to tools

`files.yaml` declares two toolsets, `filesystem` and `shell`. Every `toolset_info` event of its run reports `"available_tools": 10` (`18-run-json.ndjson`). The request in the cassette `18-files.yaml` lists them: nine filesystem tools from `directory_tree` to `remove_directory`, then `shell`. The model chose `list_directory` and `read_file` from that list.

`debug toolsets FILE --json` prints the same names and schemas with no model {{help-agent docker-agent debug toolsets}}. For `guarded.yaml` it prints one tool:

```listing
title: the one tool of guarded.yaml
source: capture/out/20-debug-toolsets.json
lang: json
note: The description and the output schema are cut.
---
[
  {
    "agent": "root",
    "tools": [
      {
        "name": "shell",
        "category": "shell",
…
        "parameters": {
          "additionalProperties": false,
          "properties": {
            "cmd": {
              "description": "Shell command",
              "type": "string"
            },
            "cwd": {
              "description": "Working directory (default \".\")",
              "type": "string"
            },
            "timeout": {
              "description": "Timeout in seconds (default 30)",
              "type": "integer"
            }
          },
…
        "annotations": {
          "idempotentHint": false,
          "readOnlyHint": false,
          "title": "Shell"
        },
…
```

`debug tool FILE TOOL JSON` calls one tool with no model turn, and "Calls have real side effects and bypass other hooks and approval checks" {{help-agent docker-agent debug tool}}. In `20-debug-tool.txt`, `shell` with `{"cmd":"echo m101-direct"}` printed `m101-direct`. Use it to test a tool before any model calls it.

## Keys every toolset shares

**Tool filter:** a key that narrows what a toolset gives the model. `tools` keeps only the listed names, and `readonly` keeps only tools whose annotations carry a read-only hint {{schema Toolset}}. `defer` hides tools until the model finds them with `search_tool` and `add_tool`. `instruction` replaces the toolset's built-in instructions unless the text contains `{ORIGINAL_INSTRUCTIONS}`. `model` names the model for the turn after a tool result. Since v1.148.0 a complete tool result is bounded to 50 KiB {{rel-agent v1.148.0}}.

The `readOnlyHint: false` on `shell` matters again in [permissions, --safety, and hooks](#s-permissions-safety-and-hooks).

## The mcp type

**MCP toolset:** a toolset with `type: mcp` that connects to one MCP server and gives its tools to the agent. The docs name three forms {{docs-agent Tool Configuration}}:

- `ref: docker:duckduckgo` runs a catalog server in a container through the MCP Gateway.
- `command`, `args`, and `env` start a local process over stdio, and a missing binary is installed into `~/.cagent/tools/bin/` from the aqua registry.
- `remote.url` with `transport_type` set to `streamable` or `sse` reaches a server over the network, with optional `headers`.

`lifecycle.profile` sets reconnects for each `mcp` toolset: `resilient` by default, `strict`, or `best-effort`. A top-level `mcps` entry holds a server definition that agents reference as `{type: mcp, ref: <name>}` {{schema mcps}}. A top-level `toolsets` entry, named in `use_toolsets`, does the same for any type {{schema toolsets}}.

No `mcp` toolset ran in this edition's captures, so the three forms come from the docs and the schema. Whether `ref: docker:` needs Docker Desktop's MCP Toolkit stays open ([conflict C73](#s-ref-sources-and-the-conflicts-register)). The sandbox side of MCP is [sbx mcp add, load, and --static-mcp](#s-sbx-mcp-add-load-and-static-mcp). An agent served as an MCP server is [serve mcp and serve acp](#s-serve-mcp-and-serve-acp).

```figure
id: fig-5-3
kind: flow
title: what each toolset entry gives the model
claim: Each `toolsets` entry becomes named tools in the model request: built-in types run in process, and `mcp` goes through a gateway, a child process, or a URL.
caption: Read each row left to right, from the agent file entry to the tool names in the model request. Solid rows ran in capture/out/18-run-json.ndjson, with names from the tools array of capture/cassettes/18-files.yaml.gz. Dashed rows come from the docs Tool Configuration page and were not run.
```

```takeaways
- Run `docker-agent debug toolsets FILE --json` to see the tool names and schemas the model gets.
- Test a tool with `docker-agent debug tool` before a model calls it, and expect real side effects.
- Set `tools` or `readonly` to give an agent fewer tools than its toolset holds.
- Put a repeated MCP server under top-level `mcps` and reference it by name.
```

Sources: schema Toolset, mcps (research/sources/agent-schema.json); docs-agent Tool Configuration (research/sources/docs-docker-agent.md, page configuration/tools); help-agent docker-agent toolsets, debug toolsets, debug tool (research/sources/help-docker-agent.md); rel-agent v1.148.0 (research/sources/docker-agent-CHANGELOG.md); conflicts C56, C73 (research/conflicts-register.md); capture/fixtures/agents/files.yaml, guarded.yaml; capture/cassettes/18-files.yaml.gz; capture/out/16-toolsets.txt, 18-run-json.ndjson, 20-debug-toolsets.json, 20-debug-tool.txt
