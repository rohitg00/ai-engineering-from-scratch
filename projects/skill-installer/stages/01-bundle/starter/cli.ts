import fs from "node:fs/promises";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { validate, digest, translate, install } from "./main.ts";
export async function execute(args: string[]) {
  const [command, file, agent = "codex", root, expected] = args;
  if (!["inspect", "install"].includes(command) || !file)
    throw new Error(
      "usage: cli.ts inspect bundle.json [agent] | install bundle.json agent root expected-source-digest",
    );
  const bundle = validate(JSON.parse(await fs.readFile(file, "utf8")));
  const source_digest = digest(bundle.files);
  if (command === "inspect")
    return {
      schema_version: 1,
      source_digest,
      translated_digest: digest(translate(bundle, agent)),
      files: translate(bundle, agent),
    };
  if (!root || !expected)
    throw new Error(
      "root and expected source digest required; inspect the bundle first",
    );
  return {
    schema_version: 1,
    source_digest,
    ...(await install(root, bundle, agent, expected)),
  };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  try {
    console.log(JSON.stringify(await execute(process.argv.slice(2)), null, 2));
  } catch (error) {
    console.error((error as Error).message);
    process.exitCode = 1;
  }
}
