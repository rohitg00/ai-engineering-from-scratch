# Public implementation contract

Set MEMORY_TOKEN in the environment and run node cli.ts --data-dir memory-data --serve --port 8788. REST and MCP share the same store; no token is written into files.

Use one writer process per data directory. Appended JSONL is restart persistence, not a power-loss or multi-process transaction guarantee. Hashed lexical vectors are not semantic embeddings. MCP HTTP is a documented tools subset without streaming or sessions.

### main.ts

```typescript
export function validateMemory(raw: unknown): Omit<Memory, "revision">
export function embed(text: string, dimensions = 32): number[]
export function cosineScores(query: number[], vectors: number[][]): number[]
export function createMemoryServer(store: MemoryStore, token: string)
```

Record and class interfaces are supplied in the starter. Methods deliberately throw until implemented.

The stage tests specify ordinary results and rejected inputs. Do not replace the learner imports with reference imports. The final stage also runs the supplied input driver against your cumulative implementation.
