import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { ingest, consolidate, transition, hook, save, load } from "./main.ts";
export function ruleDigest(rule: any) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        scope: rule.scope,
        text: rule.text,
        evidence: rule.evidence,
      }),
    )
    .digest("hex");
}
export async function execute(args: string[]) {
  const [command, store, input] = args;
  if (!command || !store)
    throw new Error(
      "usage: cli.ts capture store.json corrections.jsonl | inspect store.json | approve store.json digest | emit store.json scope | retire store.json digest",
    );
  let rules = await load(store);
  if (command === "capture") {
    if (!input) throw new Error("corrections JSONL required");
    const incoming = (await fs.readFile(input, "utf8"))
      .split(/\r?\n/)
      .filter((x) => x.trim())
      .map((x) => ingest(JSON.parse(x)));
    const previous = rules.flatMap((r: any) => {
      if (!r.evidence)
        throw new Error(
          "legacy store lacks evidence; import the original corrections into a new store",
        );
      return r.evidence.map((e: any) => ({
        ...e,
        scope: r.scope,
        rule: r.text,
      }));
    });
    const merged = consolidate([...previous, ...incoming]);
    rules = merged.map((r: any) => {
      const old = rules.find((p: any) => p.key === r.key);
      return old && ruleDigest(old) === ruleDigest(r)
        ? { ...r, state: old.state }
        : r;
    });
    await save(store, rules);
  } else if (command === "approve" || command === "retire") {
    const selected = rules.findIndex((r: any) => ruleDigest(r) === input);
    if (selected < 0) throw new Error("exact current rule digest required");
    rules[selected] = transition(rules[selected], command);
    await save(store, rules);
  } else if (command === "emit") {
    const selected = hook(rules, input ?? "global");
    return {
      schema_version: 1,
      additional_context: selected.rules.join("\n"),
      ...selected,
    };
  } else if (command !== "inspect") throw new Error("unknown command");
  return {
    schema_version: 1,
    rules: rules.map((r: any) => ({ ...r, approval_digest: ruleDigest(r) })),
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
