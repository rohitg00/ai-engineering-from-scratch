import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parseSkill, route } from "./main.ts";
export async function loadCatalog(root: string) {
  const base = await fs.realpath(root);
  const skills = [];
  for (const entry of (await fs.readdir(base, { withFileTypes: true })).sort(
    (a, b) => a.name.localeCompare(b.name),
  )) {
    if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
    const folder = path.join(base, entry.name);
    const fields: Record<string, string> = {};
    for (const file of ["SKILL.md", "routing.json"]) {
      const stat = await fs.lstat(path.join(folder, file));
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 100000)
        throw new Error("bounded regular skill files required");
    }
    const content = await fs.readFile(path.join(folder, "SKILL.md"), "utf8");
    const header = content
      .replaceAll("\r\n", "\n")
      .match(/^---\n([\s\S]*?)\n---(?:\n|$)/);
    if (!header) throw new Error("SKILL.md frontmatter required");
    for (const line of header[1].split("\n")) {
      const match = line.match(/^(name|description):\s*(.+)$/);
      if (match) {
        if (fields[match[1]]) throw new Error("duplicate metadata");
        fields[match[1]] = match[2].startsWith('"')
          ? JSON.parse(match[2])
          : match[2];
      }
    }
    if (fields.name !== entry.name || !fields.description)
      throw new Error("directory/name mismatch or missing description");
    const routing = JSON.parse(
      await fs.readFile(path.join(folder, "routing.json"), "utf8"),
    );
    skills.push(
      parseSkill(
        JSON.stringify({
          ...routing,
          id: fields.name,
          description: fields.description,
        }),
      ),
    );
  }
  return skills;
}
export async function execute(args: string[]) {
  const [folder, input] = args;
  if (!folder || !input)
    throw new Error("usage: cli.ts skill-folder request.json");
  const request = JSON.parse(await fs.readFile(input, "utf8"));
  return {
    schema_version: 1,
    ...route(
      await loadCatalog(folder),
      request.query,
      request.files ?? [],
      request.allowed ?? [],
      request.margin ?? 1,
    ),
  };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  try {
    console.log(JSON.stringify(await execute(process.argv.slice(2)), null, 2));
  } catch (e) {
    console.error((e as Error).message);
    process.exitCode = 1;
  }
}
