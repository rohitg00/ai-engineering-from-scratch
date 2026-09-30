import { readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import {
  FixtureDriver,
  GstackDriver,
  runAgent,
  parseObservation,
} from "./main.ts";
const { values } = parseArgs({
  options: {
    task: { type: "string" },
    live: { type: "boolean" },
    output: { type: "string", default: "browser-run.json" },
    screenshot: { type: "string", default: "browser-result.png" },
  },
});
if (!values.task) throw new Error("--task samples/contact.json is required");
const config = JSON.parse(readFileSync(values.task, "utf8"));
let driver;
if (values.live) {
  const url = new URL(config.url);
  if (
    url.origin !== config.task.allowedOrigin ||
    !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)
  )
    throw new Error(
      "live lab only navigates an explicitly allowed loopback fixture",
    );
  const binary = process.env.BROWSE_BIN;
  if (!binary) throw new Error("BROWSE_BIN is required for live Chromium");
  execFileSync(binary, ["goto", url.href], {
    timeout: 20000,
    encoding: "utf8",
  });
  driver = new GstackDriver(binary, values.screenshot!);
} else {
  driver = new FixtureDriver(
    fileURLToPath(new URL("./success.png", import.meta.url)),
  );
  if (config.observation)
    driver.observation = parseObservation(config.observation);
}
const result = {
  schema_version: 1,
  mode: values.live
    ? "live Chromium"
    : "fixture transitions with recorded success pixels",
  ...(await runAgent(driver, config.task, config.max_steps ?? 8)),
};
writeFileSync(values.output!, JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify(result, null, 2));
if (result.status !== "complete") process.exitCode = 2;
