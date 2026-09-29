/*
 * Skill Router reference implementation.
 * Follow stages in projects/skill-router/stages/.
 * The demo is deterministic and requires no provider credentials.
 * Protocol references are listed in the project README.
 */
import { pathToFileURL } from "node:url";
import path from "node:path";

export type Skill = {
  id: string;
  description: string;
  keywords: string[];
  paths: string[];
  priority: number;
  requires: string[];
  permissions: string[];
};
export function tokens(text: string): string[] {
  return [...new Set(text.toLowerCase().match(/[a-z0-9]+/g) ?? [])];
}
export function parseSkill(raw: string): Skill {
  const data = JSON.parse(raw);
  if (
    !/^[a-z][a-z0-9-]*$/.test(data.id ?? "") ||
    typeof data.description !== "string"
  )
    throw new Error("invalid skill");
  for (const key of ["keywords", "paths", "requires", "permissions"])
    if (
      !Array.isArray(data[key]) ||
      !data[key].every((x: unknown) => typeof x === "string")
    )
      throw new Error(`invalid ${key}`);
  if (!Number.isFinite(data.priority)) throw new Error("invalid priority");
  return data;
}
export function matchPath(file: string, rule: string): boolean {
  const normalized = file.replaceAll("\\", "/");
  if (normalized.split("/").includes("..") || /^(?:\/|[a-z]:\/)/i.test(normalized))
    return false;
  const escaped = rule.replace(/\*\*\/|\*\*|\*|[.+?^${}()|[\]\\]/g, (token) => {
    if (token === "**/") return "(?:[^/]+/)*";
    if (token === "**") return ".*";
    if (token === "*") return "[^/]*";
    return "\\" + token;
  });
  return new RegExp(`^${escaped}$`).test(normalized);
}
export function rank(skills: Skill[], query: string, files: string[] = []) {
  const q = new Set(tokens(query));
  return skills
    .map((skill) => {
      const words = [
        ...new Set(skill.keywords.map((w) => w.normalize("NFC").toLowerCase())),
      ].filter((w) => tokens(w).some((t) => q.has(t)));
      const paths = [
        ...new Set(files.map((f) => f.replaceAll("\\", "/"))),
      ].filter((f) => skill.paths.some((p) => matchPath(f, p)));
      const score = words.length * 2 + paths.length * 3;
      return {
        skill,
        score,
        reasons: [
          ...words.map((w) => `keyword:${w}`),
          ...paths.map((p) => `path:${p}`),
        ],
      };
    })
    .filter((x) => x.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.skill.priority - a.skill.priority ||
        a.skill.id.localeCompare(b.skill.id),
    );
}
export function plan(
  skills: Skill[],
  selected: string[],
  allowed: string[],
): string[] {
  const map = new Map(skills.map((s) => [s.id, s]));
  if (map.size !== skills.length) throw new Error("duplicate skill");
  const visited = new Set<string>(),
    active = new Set<string>(),
    out: string[] = [];
  const visit = (id: string) => {
    if (active.has(id)) throw new Error("dependency cycle");
    if (visited.has(id)) return;
    const s = map.get(id);
    if (!s) throw new Error(`missing skill ${id}`);
    if (s.permissions.some((p) => !allowed.includes(p)))
      throw new Error(`permission denied: ${id}`);
    active.add(id);
    s.requires.forEach(visit);
    active.delete(id);
    visited.add(id);
    out.push(id);
  };
  selected.forEach(visit);
  return out;
}
export function route(
  skills: Skill[],
  query: string,
  files: string[],
  allowed: string[],
  margin = 1,
) {
  if (!Number.isFinite(margin) || margin < 0) throw new Error("invalid margin");
  const ranked = rank(skills, query, files);
  if (!ranked.length) return { status: "no-match", ranked };
  if (ranked[1] && ranked[0].score - ranked[1].score < margin)
    return { status: "ambiguous", ranked };
  try {
    return {
      status: "ready",
      ranked,
      plan: plan(skills, [ranked[0].skill.id], allowed),
    };
  } catch (e) {
    return { status: "blocked", ranked, reason: (e as Error).message };
  }
}
export const catalog: Skill[] = [
  {
    id: "tests",
    description: "Run local unit tests",
    keywords: ["test", "assert"],
    paths: ["**/*.test.ts"],
    priority: 1,
    requires: [],
    permissions: ["read"],
  },
  {
    id: "review",
    description: "Review TypeScript changes",
    keywords: ["review", "diff"],
    paths: ["src/*.ts"],
    priority: 2,
    requires: ["tests"],
    permissions: ["read"],
  },
  {
    id: "publish",
    description: "Publish package",
    keywords: ["publish"],
    paths: [],
    priority: 1,
    requires: ["tests"],
    permissions: ["network"],
  },
];
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
)
  console.log(
    JSON.stringify(
      route(catalog, "review this diff", ["src/main.ts"], ["read"]),
      null,
      2,
    ),
  );
