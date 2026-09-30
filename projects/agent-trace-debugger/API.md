# Public implementation contract

Export one Span JSON object per line from your instrumentation and retain trace.json beside trace.html in CI.

By default, input uses the documented JSONL Span contract. `--format otlp` also accepts the supplied OTLP JSON subset: `resourceSpans[].scopeSpans[].spans`, trace/span IDs, parent IDs, Unix nanosecond timestamps, status codes and numeric GenAI input/output token attributes. The adapter converts timestamps to relative milliseconds before the normal span validation. It does not accept protobuf or provide an OTLP receiver. Baseline files still use JSONL.

Tokens must be exclusive per-span usage. Cross-machine clocks must be normalized before import.

### main.ts

```typescript
export function parseTrace(raw: string): Span[]
export function validateTree(spans: Span[]): Map<string, Span>
export function unionDuration(intervals: [number, number][]): number
export function analyze(spans: Span[])
export function render(spans: Span[]): string
```

Record and class interfaces are supplied in the starter. Methods deliberately throw until implemented.

The stage tests specify ordinary results and rejected inputs. Do not replace the learner imports with reference imports. The final stage also runs the supplied input driver against your cumulative implementation.
