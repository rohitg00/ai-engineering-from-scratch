# Lesson 13 - Internal MCP Server (TypeScript)

TypeScript half of the capstone. The Python side (`code/main.py`) ships the
registry and policy gate; this project is the MCP transport: hand-rolled
newline-delimited JSON-RPC 2.0 over stdio with three mock incident tools. No
`@modelcontextprotocol/sdk`; you get to see every byte on the wire.

## Layout

```text
src/
  index.ts      entry: fixture demo (default) or stdio loop (--serve)
  transport.ts  stdin readline + fixture replay
  protocol.ts   initialize / tools/list / tools/call / shutdown
  tools.ts      three incident tools + executors
  types.ts      JSON-RPC + tool shapes
tests/
  protocol.test.ts  roundtrip, list shape, dispatch, parse error
```

## Run

```bash
npm install
npm run typecheck
npm test
npm start            # self-terminating fixture demo
npm run serve        # real stdio loop (waits on stdin)
```
