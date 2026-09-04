# Lesson 13 - Stateless MCP Server (TypeScript)

TypeScript half of the capstone. The Python side (`code/main.py`) ships the
registry and policy gate; this project is the MCP transport: hand-rolled
newline-delimited JSON-RPC 2.0 over stdio with three mock incident tools. It
implements MCP `2026-07-28` directly, without `@modelcontextprotocol/sdk`, so
you can inspect every byte on the wire.

The protocol is stateless even though the mock incident store persists data.
Every request repeats its protocol version and client capabilities in
`params._meta`; no connection, process, or earlier request establishes a
session. The server exposes mandatory `server/discover`, identifies itself in
every successful result, and publishes deterministic, cacheable tool listings.
`tools/call` validates arguments against the same bounded schemas returned by
`tools/list`; malformed arguments for a known tool return a complete tool result
with `isError: true` and never reach its executor.

The runtime identity is `com.example/internal-incidents`. It uses the reverse-DNS
namespace for the verified `example.com` publisher. A matching published
`server.json` must use that same name even though the local npm package has its
own private project name.

## Layout

```text
src/
  index.ts      entry: fixture demo (default) or stdio loop (--serve)
  transport.ts  stdin readline + fixture replay
  protocol.ts   request validation / server/discover / tools/list / tools/call
  tools.ts      three incident tools + executors
  types.ts      JSON-RPC + tool shapes
tests/
  protocol.test.ts  stateless metadata, discovery, tools, errors, roundtrip
```

## Run

```bash
npm install
npm run typecheck
npm test
npm start            # self-terminating fixture demo
npm run serve        # real stdio loop (waits on stdin)
```

The demo is self-terminating. The real stdio server stays alive until its input
stream closes; there is no MCP shutdown request or initialization handshake.
