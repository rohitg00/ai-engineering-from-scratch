# Public implementation contract

Call guard(raw,schema) at the application boundary, or repair(generate,schema,maxAttempts) where generate receives structured Issue[] and a one-based attempt number.

This is an explicit JSON Schema subset. $ref, format and combinators are rejected. Schema acceptance does not establish whether an answer is factually correct. Recorded repair is not a live model call.

### main.ts

```typescript
export function checkSchema(schema: Schema, depth = 0): void
export function parseJSON(raw: string): unknown
export function validate( value: unknown, schema: Schema, pointer = "$", depth = 0, ): Issue[]
export function guard( raw: string, schema: Schema, ):
export async function repair( generate: (feedback: Issue[], attempt: number) => Promise<string>, schema: Schema, maxAttempts = 3, )
```

Record and class interfaces are supplied in the starter. Methods deliberately throw until implemented.

The stage tests specify ordinary results and rejected inputs. Do not replace the learner imports with reference imports. The final stage also runs the supplied input driver against your cumulative implementation.
