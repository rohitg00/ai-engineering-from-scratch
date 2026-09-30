import type { Span } from "./main.ts";
export function fromOTLP(payload: any): Span[] {
  const spans = (payload.resourceSpans ?? []).flatMap((resource: any) =>
    (resource.scopeSpans ?? []).flatMap((scope: any) => scope.spans ?? []),
  );
  if (!spans.length) return [];
  const epoch = spans.reduce((min: bigint, span: any) => {
    const value = BigInt(span.startTimeUnixNano);
    return value < min ? value : min;
  }, BigInt(spans[0].startTimeUnixNano));
  return spans.map((span: any) => {
    const attrs = Object.fromEntries(
      (span.attributes ?? []).map((a: any) => [
        a.key,
        a.value?.intValue ?? a.value?.doubleValue ?? a.value?.stringValue,
      ]),
    );
    const key = (id: string) => span.traceId + ":" + id;
    const parent = span.parentSpanId ? key(span.parentSpanId) : undefined;
    return {
      id: key(span.spanId),
      ...(parent ? { parent } : {}),
      name: span.name,
      start: Number(BigInt(span.startTimeUnixNano) - epoch) / 1e6,
      end: Number(BigInt(span.endTimeUnixNano) - epoch) / 1e6,
      status: span.status?.code === 2 ? "error" : "ok",
      tokens:
        Number(attrs["gen_ai.usage.input_tokens"] ?? 0) +
        Number(attrs["gen_ai.usage.output_tokens"] ?? 0),
    };
  });
}
