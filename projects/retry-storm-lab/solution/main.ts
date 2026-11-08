export function analyze(text: string) {
  const r = JSON.parse(text);
  if (
    r.schemaVersion !== 1 ||
    !["deterministic-simulation", "local-http-fixture"].includes(r.mode) ||
    !Number.isInteger(r.clients) ||
    r.clients < 0 ||
    !Array.isArray(r.timeline)
  )
    throw Error("invalid receipt");
  const per = new Map<number, number>(),
    bins = new Map<number, number>();
  let success = 0;
  const complete = new Set<number>();
  for (const a of r.timeline) {
    if (
      !Number.isInteger(a.client) ||
      a.client < 0 ||
      a.client >= r.clients ||
      !Number.isInteger(a.attempt) ||
      a.attempt !== (per.get(a.client) ?? 0) + 1 ||
      !Number.isInteger(a.atMs) ||
      a.atMs < 0 ||
      !Number.isInteger(a.status) ||
      a.status < 0 ||
      a.status > 599 ||
      complete.has(a.client)
    )
      throw Error("invalid attempt");
    per.set(a.client, a.attempt);
    bins.set(a.atMs, (bins.get(a.atMs) ?? 0) + 1);
    if (a.status >= 200 && a.status < 300) {
      success++;
      complete.add(a.client);
    }
  }
  const calls = r.timeline.length,
    retries = calls - per.size;
  if (
    r.calls !== calls ||
    r.successes !== success ||
    r.retries !== retries ||
    per.size !== r.clients
  )
    throw Error("counter mismatch");
  return {
    schemaVersion: 1,
    mode: r.mode,
    clients: r.clients,
    calls,
    retries,
    successes: success,
    amplification: r.clients ? calls / r.clients : 0,
    peakSameMillisecond: Math.max(0, ...bins.values()),
    timeline: [...bins]
      .sort((a, b) => a[0] - b[0])
      .map(([atMs, calls]) => ({ atMs, calls })),
  };
}
