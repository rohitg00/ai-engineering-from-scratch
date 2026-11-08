import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { loadCatalog, handoffPacket, renderDirectory } from "./main.ts";
async function main() {
  const [input, output = "output", reviewFile] = process.argv.slice(2);
  if (!input || input === "--help") {
    console.log("node cli.ts INPUT.json [OUTPUT_DIRECTORY] [REVIEW.json]");
    return input ? 0 : 2;
  }
  const data = JSON.parse(await readFile(input, "utf8"));
  const review = reviewFile
    ? JSON.parse(await readFile(reviewFile, "utf8"))
    : undefined;
  await mkdir(output, { recursive: true });
  const save = async (name: string, value: any) =>
    writeFile(
      path.join(output, name),
      typeof value === "string" ? value : JSON.stringify(value, null, 2) + "\n",
    );
  const catalog = loadCatalog(data.catalog),
    packet = handoffPacket(catalog, data.path);
  await save("handoff.json", packet);
  await save("catalog.json", catalog);
  await save("report.html", renderDirectory(catalog, packet));
  console.log(
    JSON.stringify(
      {
        path: packet.ownership.path,
        owners: packet.ownership.owners,
        conflicts: packet.ownership.conflicts,
        runbook: packet.runbook,
        output,
      },
      null,
      2,
    ),
  );
  return 0;
}
main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 2;
  });
