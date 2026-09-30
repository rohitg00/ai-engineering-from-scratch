import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execute } from "./cli.ts";
const examples = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../examples",
);
console.log(
  JSON.stringify(
    await execute([
      path.join(examples, "skills"),
      path.join(examples, "request.json"),
    ]),
    null,
    2,
  ),
);
