/*
 * Cross-Agent Skill Installer reference implementation.
 * Follow stages in projects/skill-installer/stages/.
 * The demo is deterministic and requires no provider credentials.
 * Protocol references are listed in the project README.
 */
import { pathToFileURL } from "node:url";
import path from "node:path";

import { promises as fs } from "node:fs";
import { createHash } from "node:crypto";
export type Bundle = {
  name: string;
  description: string;
  files: Record<string, string>;
};
export type Agent = "codex" | "claude" | "cursor";
export const directories: Record<Agent, string> = {
  codex: ".agents/skills",
  claude: ".claude/skills",
  cursor: ".cursor/skills",
};
export function safePath(name: string): boolean {
  return (
    !!name &&
    !name.includes("\\") &&
    !name.includes("\0") &&
    !path.posix.isAbsolute(name) &&
    !name.split("/").some((p) => !p || p === "." || p === "..") &&
    !/^[A-Za-z]:/.test(name)
  );
}
export function validate(bundle: Bundle): Bundle {
  if (
    !/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/.test(bundle.name) ||
    bundle.name.includes("--") ||
    typeof bundle.description !== "string" ||
    !bundle.description.trim() ||
    [...bundle.description].length > 1024
  )
    throw new Error("invalid metadata");
  if (!bundle.files || !Object.hasOwn(bundle.files, "SKILL.md"))
    throw new Error("SKILL.md required");
  for (const [file, text] of Object.entries(bundle.files)) {
    if (
      !safePath(file) ||
      file === ".installed.json" ||
      typeof text !== "string" ||
      Buffer.byteLength(text) > 100000
    )
      throw new Error("invalid bundle file");
  }
  return bundle;
}
export function digest(files: Record<string, string>): string {
  return createHash("sha256")
    .update(
      JSON.stringify(
        Object.entries(files).sort(([a], [b]) => a.localeCompare(b)),
      ),
    )
    .digest("hex");
}
export function translate(
  bundle: Bundle,
  agent: Agent,
): Record<string, string> {
  validate(bundle);
  if (!Object.hasOwn(directories, agent)) throw new Error("unsupported agent");
  const body = bundle.files["SKILL.md"].replace(/^---\n[\s\S]*?\n---\n/, "");
  return {
    ...bundle.files,
    "SKILL.md": `---\nname: ${JSON.stringify(bundle.name)}\ndescription: ${JSON.stringify(bundle.description)}\n---\n\n${body.trim()}\n`,
  };
}
export async function install(
  root: string,
  bundle: Bundle,
  agent: Agent,
  expectedDigest: string,
) {
  const files = translate(bundle, agent);
  if (digest(bundle.files) !== expectedDigest)
    throw new Error("integrity mismatch");
  await fs.mkdir(root, { recursive: true });
  const base = await fs.realpath(root);
  let parent = base;
  for (const part of directories[agent].split("/")) {
    parent = path.join(parent, part);
    try {
      const stat = await fs.lstat(parent);
      if (stat.isSymbolicLink() || !stat.isDirectory())
        throw new Error("unsafe install parent");
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
      await fs.mkdir(parent);
    }
  }
  const dest = path.join(parent, bundle.name);
  let exists = false;
  try {
    const stat = await fs.lstat(dest);
    if (stat.isSymbolicLink() || !stat.isDirectory())
      throw new Error("unsafe destination");
    exists = true;
    const previous = JSON.parse(
      await fs.readFile(path.join(dest, ".installed.json"), "utf8"),
    );
    const current: Record<string, string> = {};
    for (const file of previous.files) {
      if (!safePath(file)) throw new Error("invalid installed manifest");
      const target = path.join(dest, file);
      if ((await fs.lstat(target)).isSymbolicLink())
        throw new Error("modified installation");
      current[file] = await fs.readFile(target, "utf8");
    }
    if (digest(current) !== previous.digest)
      throw new Error("modified installation");
    const walk = async (dir: string, prefix = ""): Promise<string[]> => {
      const out: string[] = [];
      for (const e of await fs.readdir(dir, { withFileTypes: true })) {
        const rel = prefix + e.name;
        if (e.isDirectory())
          out.push(...(await walk(path.join(dir, e.name), rel + "/")));
        else if (rel !== ".installed.json") out.push(rel);
      }
      return out;
    };
    if ((await walk(dest)).some((f) => !previous.files.includes(f)))
      throw new Error("unmanaged installation file");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT" || exists) throw e;
  }
  const temp = await fs.mkdtemp(path.join(parent, ".stage-"));
  const backup = dest + ".backup-" + crypto.randomUUID();
  let moved = false;
  try {
    for (const [file, text] of Object.entries(files)) {
      await fs.mkdir(path.dirname(path.join(temp, file)), { recursive: true });
      await fs.writeFile(path.join(temp, file), text, { flag: "wx" });
    }
    await fs.writeFile(
      path.join(temp, ".installed.json"),
      JSON.stringify({ digest: digest(files), files: Object.keys(files) }),
    );
    if (exists) {
      await fs.rename(dest, backup);
      moved = true;
    }
    try {
      await fs.rename(temp, dest);
    } catch (e) {
      if (moved) await fs.rename(backup, dest);
      throw e;
    }
    if (moved) await fs.rm(backup, { recursive: true });
    return {
      agent,
      name: bundle.name,
      digest: digest(files),
      files: Object.keys(files),
      destination: dest,
    };
  } finally {
    await fs.rm(temp, { recursive: true, force: true });
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  const bundle: Bundle = {
    name: "review-checklist",
    description: "Review small diffs with quoted evidence",
    files: {
      "SKILL.md": "# Review\n\nQuote changed lines before making claims.\n",
      "references/checks.md": "Check bounds and error paths.\n",
    },
  };
  const result = await install(
    "installed-demo",
    bundle,
    "codex",
    digest(bundle.files),
  );
  console.log(
    JSON.stringify(
      { ...result, destination: ".agents/skills/review-checklist" },
      null,
      2,
    ),
  );
}
