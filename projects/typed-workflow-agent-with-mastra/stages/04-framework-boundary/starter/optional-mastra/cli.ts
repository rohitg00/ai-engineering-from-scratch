import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { persistentWorkflow } from "./adapter.ts";
const args: Record<string, string> = {};
for (let i = 2; i < process.argv.length; i += 2) {
  if (
    !["--ticket", "--db", "--out", "--resume", "--approval"].includes(
      process.argv[i],
    ) ||
    !process.argv[i + 1]
  )
    throw new Error(
      "Use --ticket FILE --db FILE --out DIRECTORY, or --resume RUN_ID --approval FILE --db FILE --out DIRECTORY",
    );
  args[process.argv[i]] = process.argv[i + 1];
}
if (!args["--db"] || !args["--out"])
  throw new Error("--db and --out are required");
const out = resolve(args["--out"]);
mkdirSync(out, { recursive: true });
const effects: unknown[] = [];
const tool = async (name: string, query: string) => {
  effects.push({ name, query });
  return name === "lookup"
    ? "Workshop policy: label borrowed tools with the checkout date."
    : "Local simulation recorded the requested update: " + query;
};
const { workflow, storage } = await persistentWorkflow(
  tool,
  "file:" + resolve(args["--db"]),
);
try {
  const run = await workflow.createRun(
    args["--resume"] ? { runId: args["--resume"] } : {},
  );
  let result;
  if (args["--resume"]) {
    if (!args["--approval"])
      throw new Error("--resume requires a reviewed --approval JSON file");
    result = await run.resume({
      step: "execute",
      resumeData: JSON.parse(readFileSync(args["--approval"], "utf8")),
    });
  } else {
    if (!args["--ticket"]) throw new Error("Start requires --ticket JSON");
    result = await run.start({
      inputData: JSON.parse(readFileSync(args["--ticket"], "utf8")),
    });
  }
  writeFileSync(
    resolve(out, "workflow.json"),
    JSON.stringify(
      {
        runId: run.runId,
        status: result.status,
        result,
        effects,
        method: "Real persistent Mastra workflow with a local simulated tool",
      },
      null,
      2,
    ),
  );
  if (result.status === "suspended") {
    const p = result.steps.execute.suspendPayload;
    writeFileSync(
      resolve(out, "approval.json"),
      JSON.stringify(
        { approved: false, ticketId: p.ticketId, planHash: p.planHash },
        null,
        2,
      ),
    );
  }
  console.log(
    JSON.stringify(
      {
        runId: run.runId,
        status: result.status,
        effects,
        output: resolve(out, "workflow.json"),
        approval:
          result.status === "suspended"
            ? "Inspect workflow.json, then edit approval.json explicitly and resume."
            : null,
      },
      null,
      2,
    ),
  );
  if (result.status === "failed") process.exitCode = 1;
} finally {
  await storage.close();
}
