# Lesson 13 - Internal MCP Server (TypeScript)

Capstone の TypeScript 側。Python 側 (`code/main.py`) は registry と policy gate を
提供する。この project は MCP transport であり、3 つの mock incident tool を持つ
stdio 上の hand-rolled newline-delimited JSON-RPC 2.0 である。
`@modelcontextprotocol/sdk` は使わず、wire 上の byte をすべて見られる。

## 構成

```text
src/
  index.ts      entry: fixture demo (default) または stdio loop (--serve)
  transport.ts  stdin readline + fixture replay
  protocol.ts   initialize / tools/list / tools/call / shutdown
  tools.ts      3 つの incident tool + executors
  types.ts      JSON-RPC + tool shapes
tests/
  protocol.test.ts  roundtrip、list shape、dispatch、parse error
```

## Run

```bash
npm install
npm run typecheck
npm test
npm start            # 自動終了する fixture demo
npm run serve        # 実際の stdio loop (stdin を待つ)
```
