# Public implementation contract

Input files maps names to text or lines. Optional reviewers contain id,cost,findings recordings. Expected labels use {file,line,rule}; the report records the source fingerprint and per-reviewer versus consensus metrics.

Local reviewers are distinct static heuristics, not independent LLMs. Consensus measures support, not truth. External callbacks must honor AbortSignal; timeout cannot undo a remote side effect.

### main.ts

```typescript
export function validateFinding( raw: unknown, files: Record<string, string[]>, ): Finding | null
export function aggregate( reviews: Review[], files: Record<string, string[]>, quorum = 2, )
export async function runPanel( reviewers: Reviewer[], budget: number, timeoutMs = 1000, )
export function evaluate(predicted: string[], expected: string[])
```

Record and class interfaces are supplied in the starter. Methods deliberately throw until implemented.

The stage tests specify ordinary results and rejected inputs. Do not replace the learner imports with reference imports. The final stage also runs the supplied input driver against your cumulative implementation.
