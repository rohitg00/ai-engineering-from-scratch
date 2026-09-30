/*
 * Multi-Agent Code Review Panel reference implementation.
 * Follow stages in projects/multi-agent-code-review-panel/stages/.
 * The demo is deterministic and requires no provider credentials.
 * Protocol references are listed in the project README.
 */
import { pathToFileURL } from "node:url";
import path from "node:path";

export type Finding = {
  file: string;
  line: number;
  quote: string;
  rule: string;
  severity: number;
};
export type Review = { reviewer: string; findings: Finding[] };
export type Reviewer = {
  id: string;
  cost: number;
  run: (signal: AbortSignal) => Promise<Finding[]>;
};
export function validateFinding(
  raw: unknown,
  files: Record<string, string[]>,
): Finding | null {
  if (!raw || typeof raw !== "object") return null;
  const f = raw as Finding;
  if (
    typeof f.file !== "string" ||
    !Number.isInteger(f.line) ||
    f.line < 1 ||
    typeof f.quote !== "string" ||
    !f.quote.trim() ||
    typeof f.rule !== "string" ||
    !f.rule ||
    !Number.isInteger(f.severity) ||
    f.severity < 1 ||
    f.severity > 3
  )
    return null;
  const line = Object.hasOwn(files, f.file)
    ? files[f.file][f.line - 1]
    : undefined;
  return line !== undefined && line.includes(f.quote) ? f : null;
}
export function aggregate(
  reviews: Review[],
  files: Record<string, string[]>,
  quorum = 2,
) {
  if (!Number.isInteger(quorum) || quorum < 1)
    throw new Error("invalid quorum");
  const ids = new Set<string>();
  const groups = new Map<
    string,
    { finding: Finding; supporters: string[]; severities: number[] }
  >();
  let rejected = 0;
  for (const review of reviews) {
    if (ids.has(review.reviewer)) throw new Error("duplicate reviewer");
    ids.add(review.reviewer);
    const seen = new Set<string>();
    for (const raw of review.findings) {
      const f = validateFinding(raw, files);
      if (!f) {
        rejected++;
        continue;
      }
      const key = JSON.stringify([f.file, f.line, f.rule]);
      if (seen.has(key)) continue;
      seen.add(key);
      let g = groups.get(key);
      if (!g) {
        g = { finding: f, supporters: [], severities: [] };
        groups.set(key, g);
      }
      g.supporters.push(review.reviewer);
      g.severities.push(f.severity);
    }
  }
  return {
    findings: [...groups.values()]
      .map((g) => ({
        ...g,
        status: g.supporters.length >= quorum ? "consensus" : "needs-review",
        disagreement: new Set(g.severities).size > 1,
      }))
      .sort(
        (a, b) =>
          b.supporters.length - a.supporters.length ||
          a.finding.file.localeCompare(b.finding.file) ||
          a.finding.line - b.finding.line,
      ),
    rejected,
  };
}
export async function runPanel(
  reviewers: Reviewer[],
  budget: number,
  timeoutMs = 1000,
) {
  if (!Number.isFinite(budget) || budget < 0 || timeoutMs <= 0)
    throw new Error("invalid limits");
  if (new Set(reviewers.map((r) => r.id)).size !== reviewers.length)
    throw new Error("duplicate reviewer");
  if (reviewers.some((r) => !Number.isFinite(r.cost) || r.cost < 0))
    throw new Error("invalid cost");
  let spent = 0;
  const trace: { reviewer: string; status: string; cost: number }[] = [];
  const jobs: Promise<Review | null>[] = [];
  for (const r of reviewers) {
    if (spent + r.cost > budget) {
      trace.push({ reviewer: r.id, status: "budget-skipped", cost: 0 });
      continue;
    }
    spent += r.cost;
    const event = { reviewer: r.id, status: "running", cost: r.cost };
    trace.push(event);
    jobs.push(
      (async () => {
        const controller = new AbortController();
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          const result = await Promise.race([
            r.run(controller.signal),
            new Promise<never>((_, reject) => {
              timer = setTimeout(() => {
                controller.abort();
                reject(new Error("deadline"));
              }, timeoutMs);
            }),
          ]);
          event.status = "complete";
          return { reviewer: r.id, findings: result };
        } catch (e) {
          event.status = controller.signal.aborted ? "timeout" : "failed";
          return null;
        } finally {
          clearTimeout(timer);
        }
      })(),
    );
  }
  const reviews = (await Promise.all(jobs)).filter(
    (r): r is Review => r !== null,
  );
  return { spent, trace, reviews };
}
export function evaluate(predicted: string[], expected: string[]) {
  const p = new Set(predicted),
    e = new Set(expected);
  const hits = [...p].filter((x) => e.has(x)).length;
  return {
    precision: p.size ? hits / p.size : 0,
    recall: e.size ? hits / e.size : 0,
    hits,
  };
}
export const files = { "src/run.ts": ["const raw = input;", "eval(raw);"] };
export const finding: Finding = {
  file: "src/run.ts",
  line: 2,
  quote: "eval(raw)",
  rule: "eval",
  severity: 3,
};
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  const run = await runPanel(
    [
      { id: "syntax-rules", cost: 1, run: async () => [finding] },
      {
        id: "security-checklist",
        cost: 1,
        run: async () => [{ ...finding, severity: 2 }],
      },
      { id: "extra-reviewer", cost: 1, run: async () => [] },
    ],
    2,
  );
  console.log(
    JSON.stringify({ ...run, ...aggregate(run.reviews, files) }, null, 2),
  );
}
