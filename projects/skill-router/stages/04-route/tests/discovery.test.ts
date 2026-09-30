import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { pathToFileURL } from "node:url";
const cli = await import(
  pathToFileURL(path.join(process.env.PROJECT_WORKSPACE!, "cli.ts")).href
);
test("discovery uses SKILL.md identity and separate routing extension", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "router-discovery-"));
  try {
    const skill = path.join(root, "review");
    await fs.mkdir(skill);
    await fs.writeFile(
      path.join(skill, "SKILL.md"),
      '---\nname: "review"\ndescription: "Review replicas"\n---\nRead the diff.',
    );
    await fs.writeFile(
      path.join(skill, "routing.json"),
      JSON.stringify({
        keywords: ["replicas"],
        paths: [],
        priority: 1,
        requires: [],
        permissions: ["read"],
      }),
    );
    const catalog = await cli.loadCatalog(root);
    assert.equal(catalog[0].id, "review");
    assert.equal(catalog[0].description, "Review replicas");
    await fs.writeFile(
      path.join(skill, "SKILL.md"),
      "---\nname: different\ndescription: Review\n---",
    );
    await assert.rejects(() => cli.loadCatalog(root));
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
