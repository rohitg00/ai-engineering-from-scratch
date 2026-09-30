/*
 * Self-Correcting Workflow Hooks reference implementation.
 * Follow stages in projects/workflow-hooks/stages/.
 * The demo is deterministic and requires no provider credentials.
 * Protocol references are listed in the project README.
 */
import { pathToFileURL } from "node:url";
import path from "node:path";

import { promises as fs } from "node:fs";
export type Correction = {
  id: string;
  session: string;
  scope: string;
  rule: string;
  source: string;
  locator?: string;
};
export type Rule = {
  key: string;
  scope: string;
  text: string;
  sourceIds: string[];
  sessions: string[];
  evidence?: { id: string; session: string; source: string; locator: string }[];
  state: "candidate" | "approved" | "retired";
};
export function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}
export function ingest(raw: unknown): Correction {
  if (!raw || typeof raw !== "object") throw new Error("invalid correction");
  const c = raw as Correction;
  for (const k of ["id", "session", "scope", "rule", "source"] as const)
    if (typeof c[k] !== "string" || !c[k].trim())
      throw new Error(`missing ${k}`);
  if (c.rule.length > 500 || c.source.length > 2000)
    throw new Error("too large");
  if (/(?:sk-|ghp_)[a-z0-9]{12,}/i.test(c.rule + " " + c.source))
    throw new Error("credential-like content");
  return {
    ...c,
    rule: c.rule.trim().replace(/\s+/g, " "),
    scope: normalize(c.scope),
  };
}
export function consolidate(corrections: Correction[]): Rule[] {
  const groups = new Map<string, Rule>();
  const ids = new Map<string, string>();
  for (const raw of corrections) {
    const c = ingest(raw);
    const signature = JSON.stringify(c);
    if (ids.has(c.id)) {
      if (ids.get(c.id) !== signature)
        throw new Error("conflicting correction id");
      continue;
    }
    ids.set(c.id, signature);
    const key = JSON.stringify([c.scope, c.rule]);
    let r = groups.get(key);
    if (!r) {
      r = {
        key,
        scope: c.scope,
        text: c.rule,
        sourceIds: [],
        sessions: [],
        evidence: [],
        state: "candidate",
      };
      groups.set(key, r);
    }
    r.sourceIds.push(c.id);
    r.evidence!.push({
      id: c.id,
      session: c.session,
      source: c.source,
      locator: c.locator ?? `session:${c.session}#${c.id}`,
    });
    if (!r.sessions.includes(c.session)) r.sessions.push(c.session);
  }
  return [...groups.values()].sort((a, b) => a.key.localeCompare(b.key));
}
export function transition(
  rule: Rule,
  event: "approve" | "retire",
  minimumSessions = 2,
): Rule {
  if (event === "retire") return { ...rule, state: "retired" };
  if (rule.state === "retired")
    throw new Error("retired rule cannot be approved");
  if (rule.sessions.length < minimumSessions)
    throw new Error("insufficient independent sessions");
  return { ...rule, state: "approved" };
}
export function hook(
  rules: Rule[],
  scope: string,
): {
  rules: string[];
  sources: string[];
  evidence: NonNullable<Rule["evidence"]>;
} {
  const selected = rules.filter(
    (r) =>
      r.state === "approved" &&
      (r.scope === "global" || r.scope === normalize(scope)),
  );
  return {
    rules: selected.map((r) => r.text),
    evidence: selected.flatMap((r) => r.evidence ?? []),
    sources: [...new Set(selected.flatMap((r) => r.sourceIds))],
  };
}
export async function save(file: string, rules: Rule[]): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temp = file + "." + process.pid + "." + crypto.randomUUID() + ".tmp";
  try {
    await fs.writeFile(temp, JSON.stringify({ version: 1, rules }, null, 2), {
      flag: "wx",
      mode: 0o600,
    });
    await fs.rename(temp, file);
  } finally {
    await fs.rm(temp, { force: true });
  }
}
export async function load(file: string): Promise<Rule[]> {
  try {
    const data = JSON.parse(await fs.readFile(file, "utf8"));
    if (data.version !== 1 || !Array.isArray(data.rules))
      throw new Error("invalid store");
    for (const r of data.rules)
      if (
        !["candidate", "approved", "retired"].includes(r.state) ||
        !Array.isArray(r.sourceIds) ||
        !Array.isArray(r.sessions) ||
        typeof r.text !== "string" ||
        typeof r.scope !== "string"
      )
        throw new Error("invalid rule");
    return data.rules;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw e;
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  const c = [
    {
      id: "c1",
      session: "s1",
      scope: "project",
      rule: "Run tests before changing snapshots",
      source: "Correction in session one",
    },
    {
      id: "c2",
      session: "s2",
      scope: "project",
      rule: "Run tests before changing snapshots",
      source: "Repeated in session two",
    },
  ];
  const rules = consolidate(c).map((r) => transition(r, "approve"));
  await save("rules.json", rules);
  console.log(
    JSON.stringify(
      { stored: "rules.json", ...hook(await load("rules.json"), "project") },
      null,
      2,
    ),
  );
}
